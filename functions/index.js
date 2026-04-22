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
      headers: { "User-Agent": "Mozilla/5.0 (compatible; GeuLove-MarathonHerald/1.0)" },
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

// 🚀 ogRenderer 이미지 화이트리스트
// Why: 본문 <img>·이미지 필드에서 추출한 URL이 R2/자사 도메인인지 검증해 트래킹·피싱 URL 차단
// 설정 방법: functions/.env 에 쉼표 구분으로 추가 (예: OG_IMAGE_ALLOWED_HOSTS=halmal-itso.web.app,pub-xxx.r2.dev)
// 비어있으면 아래 기본값 사용
const OG_IMAGE_ALLOWED_HOSTS = (() => {
  const raw = process.env.OG_IMAGE_ALLOWED_HOSTS;
  if (raw && raw.trim()) return raw.split(",").map(s => s.trim()).filter(Boolean);
  return [
    "geulove.com",
    "halmal-itso.web.app",
    "pub-9e6af273cd034aa6b7857343d0745224.r2.dev",
  ];
})();

// 🚀 ogRenderer: /p/{postId} 요청 시 글 OG 태그를 동적으로 채운 HTML 반환
// SNS 봇(카카오·페이스북·트위터 등)이 크롤링할 때 글 제목·이미지·설명이 반영됨
exports.ogRenderer = onRequest(
  { region: "asia-northeast3", timeoutSeconds: 10, memory: "128MiB" },
  async (req, res) => {
    const APP_URL = "https://geulove.com";
    const DEFAULT_IMAGE = `${APP_URL}/og-image.png`;
    const SITE_NAME = "글러브 GeuLove";

    // URL 패턴: /p/{postId}
    const pathMatch = req.path.match(/^\/p\/(.+)$/);
    if (!pathMatch) {
      res.redirect(301, APP_URL);
      return;
    }

    const postId = pathMatch[1];
    // 🚀 node 쿼리 — giant_trees 전파 링크의 부모 노드 지정용 (posts에서는 무시)
    const nodeId = typeof req.query.node === "string" ? req.query.node : null;

    // postId는 "topic_{ts}" (posts) 또는 "tree_{ts}_{uid}" (giant_trees) — prefix로 컬렉션 분기
    let title = SITE_NAME;
    let description = "글러브 GeuLove에서 이 글을 확인해 보세요.";
    let image = DEFAULT_IMAGE;
    // canonical URL에 node 쿼리 보존 — SNS 미리보기 URL 일관성
    const nodeQuery = nodeId ? `?node=${encodeURIComponent(nodeId)}` : "";
    let canonicalUrl = `${APP_URL}/p/${postId}${nodeQuery}`;

    // 🚀 이미지 검증 헬퍼 — posts·giant_trees 분기 양쪽에서 재사용 (try 블록 밖 함수 스코프)
    const isHttps = (v) =>
      typeof v === "string" && v.startsWith("https://") && v.length > 10;
    const isAllowedImageUrl = (v) => {
      if (!isHttps(v)) return false;
      try {
        const u = new URL(v);
        if (OG_IMAGE_ALLOWED_HOSTS.includes(u.hostname)) return true;
        console.warn(`[ogRenderer] Image URL rejected (not in allowlist): ${v}`);
        return false;
      } catch {
        return false;
      }
    };

    try {
      // 🚀 giant_trees 분기: "tree_" 프리픽스는 posts로 fallthrough 금지
      // Why: tree ID 포맷 tree_{ts}_{uid}는 posts ID와 네임스페이스 겹치지 않음
      if (postId.startsWith("tree_")) {
        const treeDoc = await db.collection("giant_trees").doc(postId).get();
        if (treeDoc.exists) {
          const tree = treeDoc.data();
          // 🌳 프리픽스: SNS 카드에서 거대나무 컨텐츠 시각 구분 (제목 평균 17자, 여유 충분)
          title = `🌳 ${tree.title || "거대 나무"}`;
          // 본문 HTML 제거 후 120자 (posts와 동일 rawText 로직)
          const rawText = (tree.content || "").replace(/<[^>]+>/g, "").trim();
          description = rawText.slice(0, 120) + (rawText.length > 120 ? "..." : "") || description;
          // tree는 imageUrl/imageUrls/thumbnailUrl 필드 미보유 — 본문 첫 <img> 단일 단계
          if (typeof tree.content === "string") {
            const imgMatch = tree.content.match(/<img[^>]+src=["'](https:\/\/[^"']+)["']/i);
            if (imgMatch && isAllowedImageUrl(imgMatch[1])) image = imgMatch[1];
          }
        } else {
          console.warn(`[ogRenderer] giant_trees/${postId} not found`);
        }
      } else {
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
          // 카카오 권장 제목 40자 공간 확보 — 사이트명은 og:site_name으로 이미 노출
          title = post.title || SITE_NAME;

          // 본문에서 텍스트만 추출해 description 생성 (HTML 태그 제거, 120자 제한)
          const rawText = (post.content || "").replace(/<[^>]+>/g, "").trim();
          description = rawText.slice(0, 120) + (rawText.length > 120 ? "..." : "") || description;

          // 🚀 image 폴백 체인 — 첫 유효 값 채택
          // 우선순위: imageUrls[0] → imageUrl → thumbnailUrl → 본문 첫 <img> → linkUrl OG → 로고
          // 1~4단계는 OG_IMAGE_ALLOWED_HOSTS 화이트리스트 적용(자사 R2·호스팅만 허용)
          // 5단계(linkUrl OG)는 외부 뉴스 도메인이라 화이트리스트 미적용(https:// 검증만)
          let resolvedImage = null;

          // 1) 배열형 이미지 (빵부스러기 등, 최대 4장)
          if (Array.isArray(post.imageUrls) && isAllowedImageUrl(post.imageUrls[0])) {
            resolvedImage = post.imageUrls[0];
          }
          // 2) 단일 imageUrl (기존)
          if (!resolvedImage && isAllowedImageUrl(post.imageUrl)) {
            resolvedImage = post.imageUrl;
          }
          // 3) 별도 썸네일 필드
          if (!resolvedImage && isAllowedImageUrl(post.thumbnailUrl)) {
            resolvedImage = post.thumbnailUrl;
          }
          // 4) Tiptap 본문 내 첫 <img src="https://..."> — 본문에만 이미지 박힌 경우
          if (!resolvedImage && typeof post.content === "string") {
            const imgMatch = post.content.match(/<img[^>]+src=["'](https:\/\/[^"']+)["']/i);
            if (imgMatch && isAllowedImageUrl(imgMatch[1])) resolvedImage = imgMatch[1];
          }
          // 5) linkUrl의 외부 OG 이미지 (마라톤 뉴스 등) — 외부 도메인이라 화이트리스트 미적용
          if (!resolvedImage && post.linkUrl) {
            try {
              const ogRes = await fetch(post.linkUrl, {
                headers: { "User-Agent": "Mozilla/5.0 (compatible; GeuLoveBot/1.0)" },
                signal: AbortSignal.timeout(5000),
                redirect: "follow",
              });
              if (ogRes.ok) {
                const ogHtml = await ogRes.text();
                const ogImgMatch = ogHtml.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
                  || ogHtml.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
                if (ogImgMatch && isHttps(ogImgMatch[1])) resolvedImage = ogImgMatch[1];
              }
            } catch { /* 폴백 실패 시 기본 이미지 유지 */ }
          }

          if (resolvedImage) image = resolvedImage;
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
  <link rel="icon" type="image/png" href="/favicon.png" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <!-- 앱으로 리다이렉트: SNS 봇은 JS 미실행이므로 OG만 읽고 종료 -->
  <script>
    // 🚀 tree_ 프리픽스면 SPA의 ?tree=&node= 딥링크 파서로, 아니면 기존 ?post=
    // Why: App.tsx의 getDeepLinkParams가 기존에 tree/node/post 3종 모두 인식
    const idOrToken = ${JSON.stringify(postId)};
    const nodeId = ${JSON.stringify(nodeId)};
    if (idOrToken.indexOf("tree_") === 0) {
      const q = nodeId ? ("&node=" + encodeURIComponent(nodeId)) : "";
      window.location.replace("/?tree=" + encodeURIComponent(idOrToken) + q);
    } else {
      window.location.replace("/?post=" + encodeURIComponent(idOrToken));
    }
  </script>
</head>
<body></body>
</html>`;

    // 브라우저 짧게(글 수정 반영) · CDN 1시간 · stale-while-revalidate 24h
    res.set("Cache-Control", "public, max-age=60, s-maxage=3600, stale-while-revalidate=86400");
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
const { purchaseMarketItem, subscribeMarketShop, checkSubscriptionExpiry, processMarketAdRevenue } = require("./market");
const { sendToExile, releaseFromExile, executeSayak, checkAutoSayak } = require("./storehouse");

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
exports.purchaseMarketItem = purchaseMarketItem;
exports.subscribeMarketShop = subscribeMarketShop;
exports.checkSubscriptionExpiry = checkSubscriptionExpiry;
exports.processMarketAdRevenue = processMarketAdRevenue;
exports.sendToExile = sendToExile;
exports.releaseFromExile = releaseFromExile;
exports.executeSayak = executeSayak;
exports.checkAutoSayak = checkAutoSayak;

// 🛡️ 주주 인증 스크린샷 30일 자동 삭제 스케줄러
const { cleanupShareholderScreenshots } = require("./shareholderCleanup");
exports.cleanupShareholderScreenshots = cleanupShareholderScreenshots;

// 🚀 깐부방 유료 게시판 결제 + 구독 만료
const { joinPaidKanbuRoom, checkKanbuSubscriptionExpiry } = require("./kanbuPaid");
exports.joinPaidKanbuRoom = joinPaidKanbuRoom;
exports.checkKanbuSubscriptionExpiry = checkKanbuSubscriptionExpiry;

// 🛡️ 깐부 토글 — 대칭 ±2 EXP + 서버측 쿨다운 (Anti-Abuse Commit 7-B v2)
const { toggleKanbu } = require("./toggleKanbu");
exports.toggleKanbu = toggleKanbu;

// 🛡️ 닉네임 변경 (평생 1회, 100볼) — ANTI_ABUSE.md §8
const { changeNickname, seedReservedNicknames } = require("./nickname");
exports.changeNickname = changeNickname;
exports.seedReservedNicknames = seedReservedNicknames;

// 🔴 라이브 세션 presence 정리 (1분 주기)
const { cleanupLivePresence } = require("./livePresence");
exports.cleanupLivePresence = cleanupLivePresence;

// 💰 땡스볼 장부 감사 — 일일 스냅샷 + 장부↔잔액 정합성 검증
// Why: ball_transactions 원장과 users.ballBalance 사이 불일치 탐지 (유출·위조 조기 경보)
const { snapshotBallBalance } = require("./ballSnapshot");
const { auditBallBalance } = require("./ballAudit");
exports.snapshotBallBalance = snapshotBallBalance;
exports.auditBallBalance = auditBallBalance;

// 🏅 Sprint 3 Phase B — 유저 일일 스냅샷 + V2 평판 캐시
// Why: 클라이언트 getReputation() O(1) 조회 + Phase C 탐지망의 diff 기준점 축적
const { snapshotUserDaily } = require("./snapshotUserDaily");
const { reputationCache } = require("./reputationCache");
exports.snapshotUserDaily = snapshotUserDaily;
exports.reputationCache = reputationCache;
