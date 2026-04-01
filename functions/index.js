// functions/index.js — 마라톤의 전령 뉴스 자동화 봇
// Firebase Cloud Functions v2 (Blaze 플랜 필수)
// 스케줄: 매 30분마다 한국 주요 언론사 RSS 속보만 Firestore 저장

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const { XMLParser } = require("fast-xml-parser");

initializeApp();
const db = getFirestore();

// 🤖 봇 계정 설정
const BOT_NICKNAME = "마라톤의 전령";
const BOT_UID = "marathon-herald-bot";
const BOT_AVATAR_URL = "https://api.dicebear.com/7.x/adventurer/svg?seed=marathon-herald";

// 📰 RSS 피드 목록 — 2026-04-01 기준 실제 작동 확인된 피드만 사용
const RSS_FEEDS = [
  { url: "https://www.yonhapnewstv.co.kr/browse/feed/",              source: "연합뉴스TV" },
  { url: "https://news.kbs.co.kr/rss/rss.do?source=news",            source: "KBS뉴스" },
  { url: "https://www.khan.co.kr/rss/rssdata/total_news.xml",        source: "경향신문" },
  { url: "https://www.donga.com/news/rss",                           source: "동아일보" },
  { url: "https://news.sbs.co.kr/news/SectionRssFeed.do?sectionId=01&plink=RSSREADER", source: "SBS뉴스" },
];

// 🚨 속보 판정 키워드 — 기사 제목에 하나라도 포함되면 등록, 없으면 스킵
// 8개로 엄선: 언론사 라벨(속보·긴급·단독) + 실제 재난·긴급 상황(화재·지진·폭발·테러·비상계엄)
const BREAKING_KEYWORDS = [
  "속보", "긴급", "단독",
  "화재", "지진", "폭발", "테러", "비상계엄",
];

// 중복 체크 기간 — 24시간
const DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000;

// 피드당 최대 처리 건수 (속보만 추리므로 넉넉하게)
const MAX_ITEMS_PER_FEED = 20;

/**
 * RSS XML fetch → 기사 배열 반환
 * 실패 시 빈 배열 (다른 피드 계속 처리)
 */
async function fetchRSS(feedUrl) {
  try {
    const resp = await fetch(feedUrl, {
      signal: AbortSignal.timeout(10_000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; GLove-MarathonHerald/1.0)" },
    });
    if (!resp.ok) {
      console.warn(`[피드오류] HTTP ${resp.status}: ${feedUrl}`);
      return [];
    }
    const xml = await resp.text();
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      // CDATA를 문자열로 자동 언래핑
      cdataTagName: "__cdata",
      cdataPositionChar: "\\c",
    });
    const parsed = parser.parse(xml);
    const items = parsed?.rss?.channel?.item ?? parsed?.feed?.entry ?? [];
    return Array.isArray(items) ? items : [items];
  } catch (err) {
    console.warn(`[피드오류] ${feedUrl}: ${err.message}`);
    return [];
  }
}

/**
 * 제목에서 텍스트 추출 — CDATA 객체/문자열 양쪽 대응
 */
function extractTitle(raw) {
  if (!raw) return "";
  // fast-xml-parser가 CDATA를 객체로 반환하는 경우
  if (typeof raw === "object") {
    return String(raw.__cdata ?? raw["#text"] ?? raw["_"] ?? "").trim();
  }
  return String(raw).trim();
}

/**
 * 링크 추출 — link / guid 순서로 fallback
 */
function extractLink(item) {
  const link = item.link ?? item.guid;
  if (!link) return "";
  if (typeof link === "object") {
    return String(link["#text"] ?? link.__cdata ?? link["@_href"] ?? "").trim();
  }
  return String(link).trim();
}

/**
 * 제목에 속보 키워드 포함 여부 확인
 */
function isBreaking(title) {
  return BREAKING_KEYWORDS.some((kw) => title.includes(kw));
}

/**
 * HTML 태그 제거
 */
function stripHtml(html = "") {
  return String(html).replace(/<[^>]+>/g, "").trim();
}

/**
 * RSS item에서 이미지 URL 추출
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
 * URL → Firestore doc ID로 안전한 base64url 키 변환
 * (/ 포함 불가, 길이 100자 제한)
 */
function urlToKey(url) {
  return Buffer.from(url)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "")
    .slice(0, 100);
}

// ============================================================
// 🚀 스케줄 함수 — 매 30분 실행 (서울 리전)
// ============================================================
exports.fetchMarathonNews = onSchedule(
  {
    schedule: "every 30 minutes",
    region: "asia-northeast3",
    timeoutSeconds: 120,
    memory: "256MiB",
  },
  async () => {
    console.log("[마라톤의 전령] 뉴스 수집 시작");

    // 1️⃣ 24시간 이내 등록된 URL 캐시 로드 (중복 방지)
    const cutoff = Timestamp.fromMillis(Date.now() - DEDUP_WINDOW_MS);
    const dedupSnap = await db.collection("marathon_dedup")
      .where("createdAt", ">=", cutoff)
      .get();
    const postedKeys = new Set(dedupSnap.docs.map((d) => d.id));
    console.log(`[마라톤의 전령] 캐시 ${postedKeys.size}건`);

    let totalAdded = 0;
    let totalSkipped = 0;

    // 2️⃣ 각 피드 처리
    for (const feed of RSS_FEEDS) {
      const items = await fetchRSS(feed.url);
      let feedAdded = 0;

      for (const item of items.slice(0, MAX_ITEMS_PER_FEED)) {
        const title = extractTitle(item.title);
        const linkUrl = extractLink(item);

        if (!title || !linkUrl) continue;

        const urlKey = urlToKey(linkUrl);

        // 중복 체크
        if (postedKeys.has(urlKey)) continue;

        // 🚨 핵심: 속보 키워드 없으면 무조건 스킵
        if (!isBreaking(title)) {
          totalSkipped++;
          continue;
        }

        const description = stripHtml(String(item.description ?? item.summary ?? ""));
        const imageUrl = extractImageUrl(item);

        const postId = `topic_${Date.now()}_${Math.random().toString(36).slice(2, 6)}_${BOT_UID}`;

        await db.collection("posts").doc(postId).set({
          id: postId,
          author: BOT_NICKNAME,
          author_id: BOT_UID,
          avatarUrl: BOT_AVATAR_URL,
          category: "마라톤의 전령",
          title: `[${feed.source}] ${title}`,
          content: description ? `<p>${description}</p>` : `<p>${title}</p>`,
          imageUrl: imageUrl ?? null,
          linkUrl,
          newsType: "breaking",
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
          authorInfo: { level: 99, friendCount: 0, totalLikes: 0 },
          createdAt: FieldValue.serverTimestamp(),
        });

        // dedup 컬렉션에 URL 해시 저장
        await db.collection("marathon_dedup").doc(urlKey).set({
          linkUrl,
          source: feed.source,
          title,
          createdAt: FieldValue.serverTimestamp(),
        });

        postedKeys.add(urlKey);
        totalAdded++;
        feedAdded++;

        // Firestore 쓰기 속도 제한 방지
        await new Promise((r) => setTimeout(r, 150));
      }

      if (feedAdded > 0) {
        console.log(`[${feed.source}] ${feedAdded}건 등록`);
      }
    }

    console.log(`[마라톤의 전령] 완료 — 등록 ${totalAdded}건 / 키워드 미해당 스킵 ${totalSkipped}건`);
  }
);
