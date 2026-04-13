// functions/gloveBotFetcher.js — 🤖 정보봇 뉴스 수집기
// 🚀 fetchBotNews: Google News RSS → 키워드 매칭 → community_posts 자동 게시
// 스케줄: 매 30분 실행 (enabled=true이고 만료 전인 장갑만 대상)
// 중복 방지: glove_bot_dedup/{communityId}/items/{urlHash}
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const { XMLParser } = require("fast-xml-parser");
const crypto = require("crypto");

const db = getFirestore();
const xmlParser = new XMLParser({ ignoreAttributes: false });

// 🤖 봇 게시글 작성자 정보
const BOT_NICKNAME = "🤖 정보봇";
const BOT_UID = "glove-info-bot";

// URL → 짧은 hash (중복 판별용)
function hashUrl(url) {
  return crypto.createHash("md5").update(url).digest("hex").slice(0, 16);
}

// HTML 태그 제거 + 길이 제한
function stripHtml(html, maxLen = 300) {
  return (html || "").replace(/<[^>]+>/g, "").trim().slice(0, maxLen);
}

// Google News RSS 호출 — 키워드로 한국 뉴스 검색
async function fetchGoogleNewsRss(keyword) {
  const encoded = encodeURIComponent(keyword);
  const url = `https://news.google.com/rss/search?q=${encoded}&hl=ko&gl=KR&ceid=KR:ko`;

  const response = await fetch(url, {
    headers: { "User-Agent": "GLove-InfoBot/1.0" },
    signal: AbortSignal.timeout(10000), // 10초 타임아웃
  });
  if (!response.ok) {
    console.warn(`[정보봇] Google News RSS 실패 (${response.status}): keyword=${keyword}`);
    return [];
  }

  const xml = await response.text();
  const parsed = xmlParser.parse(xml);
  const items = parsed?.rss?.channel?.item;
  if (!items) return [];
  // 단일 아이템이면 배열로 변환
  return Array.isArray(items) ? items : [items];
}

// ════════════════════════════════════════════════════════════
// 🚀 fetchBotNews — 매 30분 실행: 활성 봇 커뮤니티에 뉴스 자동 게시
// ════════════════════════════════════════════════════════════
exports.fetchBotNews = onSchedule(
  { schedule: "every 30 minutes", region: "asia-northeast3", timeoutSeconds: 120 },
  async () => {
    const now = Timestamp.now();

    // 1. 활성 + 미만료 봇 커뮤니티 조회
    const botsSnap = await db.collection("communities")
      .where("infoBot.enabled", "==", true)
      .get();

    if (botsSnap.empty) {
      console.log("[정보봇] 활성 봇 없음 — 스킵");
      return;
    }

    let totalPosted = 0;

    for (const communityDoc of botsSnap.docs) {
      const community = communityDoc.data();
      const infoBot = community.infoBot;

      // 만료 체크
      if (!infoBot.expiresAt || infoBot.expiresAt.toMillis() < now.toMillis()) {
        // 만료된 봇 자동 비활성화
        await communityDoc.ref.update({ "infoBot.enabled": false });
        console.log(`[정보봇] ${community.name}: 만료 → 자동 비활성화`);
        continue;
      }

      // news 소스가 활성화되지 않았으면 스킵
      if (!infoBot.sources.includes("news")) continue;

      const keywords = infoBot.keywords || [];
      if (keywords.length === 0) continue;

      // 2. 키워드별 뉴스 수집
      for (const keyword of keywords) {
        try {
          const articles = await fetchGoogleNewsRss(keyword);
          // 최신 5개만 처리 (봇이 너무 많이 올리지 않도록)
          const recent = articles.slice(0, 5);

          for (const article of recent) {
            const link = article.link || "";
            if (!link) continue;

            // 3. 중복 체크
            const dedupId = hashUrl(link);
            const dedupRef = db.collection("glove_bot_dedup").doc(communityDoc.id)
              .collection("items").doc(dedupId);
            const dedupSnap = await dedupRef.get();
            if (dedupSnap.exists) continue;

            // 4. community_posts에 자동 게시
            const title = stripHtml(article.title, 200);
            const description = stripHtml(article.description, 300);
            const source = article.source || "Google News";
            const timestamp = Date.now();
            const postId = `cpost_${timestamp}_${BOT_UID}`;

            await db.collection("community_posts").doc(postId).set({
              id: postId,
              communityId: communityDoc.id,
              communityName: community.name,
              author: BOT_NICKNAME,
              author_id: BOT_UID,
              title: `📰 ${title}`,
              content: `<p>${description}</p>${link ? `<p><a href="${link}" target="_blank" rel="noopener">🔗 원문 보기</a></p>` : ""}`,
              likes: 0,
              likedBy: [],
              commentCount: 0,
              createdAt: Timestamp.now(),
              // 봇 전용 필드
              isBot: true,
              botSource: "news",
              linkUrl: link,
              botKeyword: keyword,
            });

            // 5. 중복 마킹
            await dedupRef.set({
              sourceType: "news",
              externalId: dedupId,
              postedAt: Timestamp.now(),
            });

            totalPosted++;
          }
        } catch (err) {
          // 개별 키워드 실패 시 다음 키워드로 계속 (전체 중단 방지)
          console.error(`[정보봇] ${community.name}: keyword="${keyword}" 수집 실패:`, err.message);
        }
      }
    }

    console.log(`[정보봇] 뉴스 수집 완료 — 총 ${totalPosted}건 게시`);
  }
);
