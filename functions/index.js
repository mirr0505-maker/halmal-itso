// functions/index.js — 마라톤의 전령 뉴스 자동화 봇
// Firebase Cloud Functions v2 (Blaze 플랜 필수)
// 스케줄: 매 60분마다 한국 주요 언론사 RSS → Firestore 자동 저장

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const { XMLParser } = require("fast-xml-parser");

initializeApp();
const db = getFirestore();

// 🤖 봇 계정 설정 — Firebase Auth에 bot 전용 계정을 만든 뒤 UID를 여기에 입력
// (현재는 고정 식별자 사용, Auth 계정 없어도 Firestore 쓰기는 Admin SDK로 가능)
const BOT_NICKNAME = "마라톤의 전령";
const BOT_UID = "marathon-herald-bot";
const BOT_AVATAR_URL = "https://api.dicebear.com/7.x/adventurer/svg?seed=marathon-herald";

// 📰 RSS 피드 목록 — 한국 주요 언론사 (2026-04-01 URL 검증 완료)
// 피드 URL이 변경된 경우 이곳만 수정
const RSS_FEEDS = [
  { url: "https://www.yonhapnewstv.co.kr/browse/feed/",    source: "연합뉴스TV" },
  { url: "https://news.kbs.co.kr/rss/rss.do?source=news",  source: "KBS뉴스" },
  { url: "https://www.khan.co.kr/rss/rssdata/total_news.xml", source: "경향신문" },
];

// 🚨 속보 판정 키워드 — 제목에 포함되면 newsType: 'breaking'
const BREAKING_KEYWORDS = [
  "속보", "긴급", "단독", "사망", "폭발", "화재", "지진",
  "붕괴", "테러", "사고", "충돌", "대피", "경보", "재난",
];

// 최대 중복 체크 기간 (ms) — 24시간 이내 같은 URL은 재등록 안 함
const DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000;

// 피드당 최대 등록 건수 — 한 번 실행 시 피드당 이 수만큼만 처리
const MAX_ITEMS_PER_FEED = 5;

/**
 * RSS XML 피드를 fetch해 기사 배열로 반환
 * 네트워크 오류 시 빈 배열 반환 (다른 피드 처리 계속)
 */
async function fetchRSS(feedUrl) {
  try {
    const resp = await fetch(feedUrl, {
      signal: AbortSignal.timeout(10_000), // 10초 타임아웃
      headers: { "User-Agent": "GLove-MarathonHerald/1.0" },
    });
    if (!resp.ok) {
      console.warn(`RSS HTTP ${resp.status}: ${feedUrl}`);
      return [];
    }
    const xml = await resp.text();
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
    const parsed = parser.parse(xml);
    // RSS 2.0 구조: rss.channel.item
    const items = parsed?.rss?.channel?.item ?? [];
    return Array.isArray(items) ? items : [items]; // 단일 item인 경우 배열로 통일
  } catch (err) {
    console.error(`RSS fetch 실패 (${feedUrl}):`, err.message);
    return [];
  }
}

/**
 * 제목에 속보 키워드가 있으면 'breaking', 아니면 'news'
 */
function detectNewsType(title = "") {
  return BREAKING_KEYWORDS.some((kw) => title.includes(kw)) ? "breaking" : "news";
}

/**
 * RSS item에서 이미지 URL 추출 — 언론사마다 구조가 다름
 * enclosure, media:thumbnail, media:content 순서로 시도
 */
function extractImageUrl(item) {
  return (
    item.enclosure?.["@_url"] ||
    item["media:thumbnail"]?.["@_url"] ||
    item["media:content"]?.["@_url"] ||
    null
  );
}

/**
 * HTML 태그 제거 — description에 섞여 있는 마크업 정리
 */
function stripHtml(html = "") {
  return html.replace(/<[^>]+>/g, "").trim();
}

// ============================================================
// 🚀 스케줄 함수 — 매 60분마다 실행 (서울 리전)
// Blaze 플랜 + asia-northeast3 리전 설정으로 Pub/Sub 스케줄 사용
// ============================================================
exports.fetchMarathonNews = onSchedule(
  {
    schedule: "every 30 minutes",
    region: "asia-northeast3", // 서울 리전 — 레이턴시 최소화
    timeoutSeconds: 120,       // 최대 실행 시간 2분
    memory: "256MiB",
  },
  async () => {
    console.log("[마라톤의 전령] 뉴스 수집 시작");

    // 1️⃣ 중복 방지: marathon_dedup 컬렉션에서 24시간 이내 등록된 URL 해시 목록 조회
    // (복합 인덱스 없이 단일 필드 쿼리만 사용)
    const dedupcutoff = Timestamp.fromMillis(Date.now() - DEDUP_WINDOW_MS);
    const dedupSnap = await db.collection("marathon_dedup")
      .where("createdAt", ">=", dedupcutoff)
      .get();
    const postedUrls = new Set(dedupSnap.docs.map((d) => d.id)); // doc ID = URL 해시
    console.log(`[마라톤의 전령] 기존 캐시 ${postedUrls.size}건`);

    let totalAdded = 0;

    // 2️⃣ 피드별 RSS 수집 → Firestore 저장
    for (const feed of RSS_FEEDS) {
      const items = await fetchRSS(feed.url);
      const recent = items.slice(0, MAX_ITEMS_PER_FEED);

      for (const item of recent) {
        const title = String(item.title ?? "").trim();
        // link 태그가 없는 경우 guid(영구 링크)로 fallback
        const linkUrl = String(item.link ?? item.guid?.["#text"] ?? item.guid ?? "").trim();
        const description = stripHtml(String(item.description ?? ""));
        const imageUrl = extractImageUrl(item);

        // URL을 Firestore doc ID로 안전한 키로 변환
        // base64url (+ → -, / → _ 치환) 사용하여 경로 구분자 / 제거
        const urlKey = Buffer.from(linkUrl)
          .toString("base64")
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=/g, "")
          .slice(0, 100);

        // 제목/URL 없거나 이미 등록된 URL이면 건너뜀
        if (!title || !linkUrl || postedUrls.has(urlKey)) continue;

        const newsType = detectNewsType(title);
        // 속보/긴급 키워드 없으면 등록하지 않음 — 일반 뉴스는 스킵
        if (newsType !== "breaking") continue;

        // ID 충돌 방지: 밀리초 + 무작위 4자리
        const postId = `topic_${Date.now()}_${Math.random().toString(36).slice(2, 6)}_${BOT_UID}`;

        await db.collection("posts").doc(postId).set({
          id: postId,
          author: BOT_NICKNAME,
          author_id: BOT_UID,
          avatarUrl: BOT_AVATAR_URL,
          category: "마라톤의 전령",
          title: `[${feed.source}] ${title}`,
          // 기사 요약이 있으면 본문으로, 없으면 제목 반복
          content: description
            ? `<p>${description}</p>`
            : `<p>${title}</p>`,
          imageUrl: imageUrl ?? null,
          linkUrl,                    // RootPostCard [🔗 원본 기사 바로가기] 버튼에 사용
          newsType,                   // 'breaking' | 'news' — AnyTalkList 배지 분기용
          likes: 0,
          dislikes: 0,
          likedBy: [],
          side: "left",
          type: "comment",
          parentId: null,
          rootId: null,
          commentCount: 0,
          thanksballTotal: 0,
          viewCount: 0,
          authorInfo: {
            level: 99,               // 봇 전용 레벨 (UI에 Lv.99로 표시)
            friendCount: 0,
            totalLikes: 0,
          },
          createdAt: FieldValue.serverTimestamp(),
        });

        // marathon_dedup에 URL 해시 저장 — 다음 실행 시 중복 방지용
        await db.collection("marathon_dedup").doc(urlKey).set({
          linkUrl,
          createdAt: FieldValue.serverTimestamp(),
        });

        postedUrls.add(urlKey); // 같은 실행 내 중복 방지
        totalAdded++;

        // Firestore 쓰기 속도 제한 방지 — 건당 100ms 대기
        await new Promise((r) => setTimeout(r, 100));
      }
    }

    console.log(`[마라톤의 전령] 완료 — ${totalAdded}건 신규 등록`);
  }
);
