// functions/index.js — 마라톤의 전령 뉴스 자동화 봇 (v3)
// Firebase Cloud Functions v2 (Blaze 플랜 필수)
// 스케줄: 매 10분마다 실행, 분대(0~5)별 6개 언론사 1개씩 순차 수집

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onRequest } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue, Timestamp, FieldPath } = require("firebase-admin/firestore");
const { XMLParser } = require("fast-xml-parser");

initializeApp();
const db = getFirestore();

// 🤖 봇 계정 설정
const BOT_NICKNAME = "전령";
const BOT_UID = "marathon-herald-bot";
const BOT_AVATAR_URL = "https://api.dicebear.com/7.x/adventurer/svg?seed=marathon-herald";

// 📰 RSS 피드 목록 — 매 10분마다 실행, 분대(0~5)에 따라 1개씩 순차 수집
// 0분대(0~9분)=MBC, 10분대=연합뉴스TV, 20분대=연합뉴스, 30분대=경향, 40분대=동아, 50분대=뉴시스
// Why: KBS·뉴스1은 RSS 서비스 종료 → 연합뉴스·뉴시스로 대체 (2026-04-07)
const RSS_FEEDS = [
  { url: "https://imnews.imbc.com/rss/google_news/narrativeNews.rss", source: "MBC뉴스" },
  { url: "https://www.yonhapnewstv.co.kr/browse/feed/",              source: "연합뉴스TV" },
  { url: "https://www.yna.co.kr/rss/news.xml",                       source: "연합뉴스" },
  { url: "https://www.khan.co.kr/rss/rssdata/total_news.xml",        source: "경향신문" },
  { url: "https://rss.donga.com/total.xml",                          source: "동아일보" },
  // 🚀 뉴시스: 사회/정치/국제/문화 4개 피드를 한 슬롯에서 순차 수집 (뉴스1 RSS 폐지 대체)
  { urls: ["https://newsis.com/RSS/society.xml", "https://newsis.com/RSS/politics.xml", "https://newsis.com/RSS/international.xml", "https://newsis.com/RSS/culture.xml"], source: "뉴시스" },
];

// 🚨 속보 판정 키워드 — 기사 제목에 하나라도 포함되면 등록, 없으면 스킵
// 6개로 엄선: 언론사 라벨(속보·단독) + 실제 재난·긴급 상황(지진·폭발·테러·비상계엄)
// 제거: '긴급'(일반 뉴스 오탐 多), '화재'(지역 소규모 화재 잡음 多)
const BREAKING_KEYWORDS = [
  "속보", "단독",
  "지진", "폭발", "테러", "비상계엄",
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
  return String(raw).replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, c) => String.fromCharCode(Number(c))).replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16))).trim();
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
  return String(html)
    .replace(/<[^>]+>/g, "")
    // 🚀 HTML 엔티티 디코딩 — 이름형 + 숫자형(&#034; &#039; 등) 모두 처리
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    // 숫자형 엔티티: &#034; → ", &#039; → ' 등
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    // 16진수 엔티티: &#x27; → ' 등
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .trim();
}

/**
 * RSS item에서 이미지 URL 추출
 */
function extractImageUrl(item) {
  // 🚀 RSS 이미지 추출 강화 — 다양한 피드 형식 대응
  if (item.enclosure?.["@_url"]) return item.enclosure["@_url"];
  if (item["media:thumbnail"]?.["@_url"]) return item["media:thumbnail"]["@_url"];
  if (item["media:content"]?.["@_url"]) return item["media:content"]["@_url"];
  // 배열 형태의 media:content (일부 피드)
  if (Array.isArray(item["media:content"]) && item["media:content"][0]?.["@_url"]) return item["media:content"][0]["@_url"];
  // enclosure 배열 형태
  if (Array.isArray(item.enclosure) && item.enclosure[0]?.["@_url"]) return item.enclosure[0]["@_url"];
  // description/content 내 <img> 태그에서 추출
  const htmlContent = String(item.description ?? item["content:encoded"] ?? item.summary ?? "");
  const imgMatch = htmlContent.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgMatch) return imgMatch[1];
  return null;
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
// 🚀 스케줄 함수 — 매 10분 실행, 분대별 1개 언론사 순차 수집 (서울 리전)
// ============================================================
exports.fetchMarathonNews = onSchedule(
  {
    schedule: "every 10 minutes",
    region: "asia-northeast3",
    timeoutSeconds: 60,
    memory: "256MiB",
  },
  async () => {
    // 🚀 현재 시각의 분대(0~5)에 해당하는 언론사 1개만 처리
    // 0분대(0~9분)=MBC, 10분대=연합뉴스TV, 20분대=연합뉴스, 30분대=경향, 40분대=동아, 50분대=JTBC
    const nowMinute = new Date().getMinutes();
    const slotIndex = Math.floor(nowMinute / 10);  // 0~5
    const feed = RSS_FEEDS[slotIndex];
    if (!feed) { console.log(`[마라톤의 전령] 슬롯 ${slotIndex} 피드 없음 — 스킵`); return; }

    console.log(`[마라톤의 전령] ${feed.source} 수집 시작 (슬롯 ${slotIndex}, ${nowMinute}분)`);

    // 1️⃣ 24시간 이내 등록된 URL 캐시 로드 (중복 방지)
    const cutoff = Timestamp.fromMillis(Date.now() - DEDUP_WINDOW_MS);
    const dedupSnap = await db.collection("marathon_dedup")
      .where("createdAt", ">=", cutoff)
      .get();
    const postedKeys = new Set(dedupSnap.docs.map((d) => d.id));

    let totalAdded = 0;
    let totalSkipped = 0;

    // 2️⃣ 해당 슬롯의 피드 처리 — urls 배열이면 여러 피드를 순차 수집
    const feedUrls = feed.urls ? feed.urls : [feed.url];
    for (const feedUrl of feedUrls) {
      const items = await fetchRSS(feedUrl);
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
        const urlLabel = feed.urls ? feedUrl.split('/').pop() : feed.source;
        console.log(`[${feed.source}/${urlLabel}] ${feedAdded}건 등록`);
      }
    }

    console.log(`[마라톤의 전령] ${feed.source} 완료 — 등록 ${totalAdded}건 / 키워드 미해당 스킵 ${totalSkipped}건`);
  }
);

// 🚀 ogRenderer: /p/{postId} 요청 시 글 OG 태그를 동적으로 채운 HTML 반환
// SNS 봇(카카오·페이스북·트위터 등)이 크롤링할 때 글 제목·이미지·설명이 반영됨
exports.ogRenderer = onRequest(
  { region: "asia-northeast3", timeoutSeconds: 10, memory: "128MiB" },
  async (req, res) => {
    const APP_URL = "https://halmal-itso.web.app";
    const DEFAULT_IMAGE = `${APP_URL}/og-image.jpg?v=2`;
    const SITE_NAME = "GLove";

    // URL 패턴: /p/{postId}
    const pathMatch = req.path.match(/^\/p\/(.+)$/);
    if (!pathMatch) {
      res.redirect(301, APP_URL);
      return;
    }

    const postId = pathMatch[1];

    // postId는 "topic_타임스탬프" 형식 — Firestore에서 해당 글 조회
    // posts 컬렉션에서 ID가 postId로 시작하는 문서 탐색 (공유 토큰은 topic_timestamp까지)
    let title = SITE_NAME;
    let description = "GLove에서 이 글을 확인해 보세요.";
    let image = DEFAULT_IMAGE;
    let canonicalUrl = `${APP_URL}/p/${postId}`;

    try {
      // 1순위: postId가 완전한 문서 ID인 경우 직접 조회
      let snap = null;
      const directDoc = await db.collection("posts").doc(postId).get();
      if (directDoc.exists) {
        snap = { empty: false, docs: [directDoc] };
      }

      // 2순위: shareToken 필드로 조회 (신규 글 — useFirestoreActions에서 저장)
      if (!snap || snap.empty) {
        const tokenSnap = await db.collection("posts")
          .where("shareToken", "==", postId)
          .limit(1)
          .get();
        if (!tokenSnap.empty) snap = tokenSnap;
      }

      // 3순위: 문서 ID prefix 범위 검색 (기존 글 호환)
      if (!snap || snap.empty) {
        const querySnap = await db.collection("posts")
          .orderBy(FieldPath.documentId())
          .startAt(postId)
          .endAt(postId + "\uf8ff")
          .limit(1)
          .get();
        snap = querySnap;
      }

      if (!snap.empty) {
        const post = snap.docs[0].data();
        title = post.title ? `${post.title} — ${SITE_NAME}` : SITE_NAME;

        // 본문에서 텍스트만 추출해 description 생성 (HTML 태그 제거, 120자 제한)
        const rawText = (post.content || "").replace(/<[^>]+>/g, "").trim();
        description = rawText.slice(0, 120) + (rawText.length > 120 ? "..." : "") || description;

        if (post.imageUrl) {
          image = post.imageUrl;
        } else if (post.linkUrl) {
          // 🚀 이미지 없을 때 원본 기사 linkUrl의 OG 이미지를 폴백으로 사용
          try {
            const ogRes = await fetch(post.linkUrl, {
              headers: { "User-Agent": "Mozilla/5.0 (compatible; GLoveBot/1.0)" },
              signal: AbortSignal.timeout(5000),
              redirect: "follow",
            });
            if (ogRes.ok) {
              const ogHtml = await ogRes.text();
              const ogImgMatch = ogHtml.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
                || ogHtml.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
              if (ogImgMatch) image = ogImgMatch[1];
            }
          } catch { /* 폴백 실패 시 기본 이미지 유지 */ }
        }
      }
    } catch (e) {
      console.error("[ogRenderer] Firestore 조회 실패:", e);
    }

    // React 앱 JS를 포함한 HTML 반환 — 브라우저에서는 SPA로 정상 동작
    const html = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <meta property="og:type"        content="article" />
  <meta property="og:site_name"   content="${SITE_NAME}" />
  <meta property="og:title"       content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:url"         content="${canonicalUrl}" />
  <meta property="og:image"       content="${escapeHtml(image)}" />
  <meta property="og:image:width"  content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card"        content="summary_large_image" />
  <meta name="twitter:title"       content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image"       content="${escapeHtml(image)}" />
  <link rel="icon" type="image/svg+xml" href="/vite.svg" />
  <!-- 앱으로 리다이렉트: SNS 봇은 JS 미실행이므로 OG만 읽고 종료 -->
  <script>
    // postId를 쿼리 파라미터로 전달하여 앱이 해당 글을 자동으로 오픈
    const postId = "${postId}";
    window.location.replace("/?post=" + postId);
  </script>
</head>
<body></body>
</html>`;

    res.set("Cache-Control", "public, max-age=300, s-maxage=300");
    res.status(200).send(html);
  }
);

// HTML 특수문자 이스케이프 (XSS 방지)
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ════════════════════════════════════════════════════════════
// 🚀 기능별 분리 모듈 re-export
// ════════════════════════════════════════════════════════════
const { registerKanbuPromo } = require("./kanbuPromo");
const { adAuction } = require("./auction");
const { aggregateDailyRevenue } = require("./revenue");
const { detectFraud } = require("./fraud");
const { processSettlements } = require("./settlement");
const { recalcContentTextLength } = require("./contentLength");
const { testChargeBall } = require("./testCharge");
const { sendThanksball } = require("./thanksball");
const { syncAdBids, updateAdMetrics } = require("./adTriggers");
const { unlockEpisode, createEpisode, onEpisodeCreate, onInkwellPostDelete } = require("./inkwell");
const { activateInfoBot, deactivateInfoBot, updateInfoBot } = require("./gloveBot");
const { fetchBotNews, fetchBotDart } = require("./gloveBotFetcher");
const { syncDartCorpMap, triggerSyncDartCorpMap, lookupCorpCode } = require("./dartCorpMap");

exports.registerKanbuPromo = registerKanbuPromo;
exports.adAuction = adAuction;
exports.aggregateDailyRevenue = aggregateDailyRevenue;
exports.detectFraud = detectFraud;
exports.processSettlements = processSettlements;
exports.syncAdBids = syncAdBids;
exports.updateAdMetrics = updateAdMetrics;
exports.recalcContentTextLength = recalcContentTextLength;
exports.testChargeBall = testChargeBall;
exports.sendThanksball = sendThanksball;
exports.unlockEpisode = unlockEpisode;
exports.createEpisode = createEpisode;
exports.onEpisodeCreate = onEpisodeCreate;
exports.onInkwellPostDelete = onInkwellPostDelete;
exports.activateInfoBot = activateInfoBot;
exports.deactivateInfoBot = deactivateInfoBot;
exports.updateInfoBot = updateInfoBot;
exports.fetchBotNews = fetchBotNews;
exports.fetchBotDart = fetchBotDart;
exports.syncDartCorpMap = syncDartCorpMap;
exports.triggerSyncDartCorpMap = triggerSyncDartCorpMap;
exports.lookupCorpCode = lookupCorpCode;
