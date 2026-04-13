// functions/gloveBotFetcher.js — 🤖 정보봇 데이터 수집기
// 🚀 fetchBotNews: Google News RSS → 키워드 매칭 → community_posts 자동 게시
// 🚀 fetchBotDart: DART OpenAPI → corpCode별 공시 → community_posts 자동 게시
// 스케줄: 각각 매 30분 실행 (enabled=true이고 만료 전인 장갑만 대상)
// 중복 방지: glove_bot_dedup/{communityId}/items/{hash}
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

// ════════════════════════════════════════════════════════════
// 🚀 fetchBotDart — 매 30분 실행: DART 공시 자동 게시
// ════════════════════════════════════════════════════════════
// DART OpenAPI: https://opendart.fss.or.kr/api/list.json
// 파라미터: crtfc_key, corp_code, bgn_de(시작일), end_de(종료일), page_count
// 반환: { list: [{ corp_name, report_nm, rcept_no, rcept_dt, ... }] }
exports.fetchBotDart = onSchedule(
  { schedule: "every 30 minutes", region: "asia-northeast3", timeoutSeconds: 120 },
  async () => {
    // DART API 키 — functions/.env 파일에서 로드
    const DART_API_KEY = process.env.DART_API_KEY;
    if (!DART_API_KEY || DART_API_KEY === "여기에_DART_API_키를_넣으세요") {
      console.warn("[정보봇] DART API 키가 설정되지 않았습니다. functions/.env 파일을 확인하세요.");
      return;
    }

    const now = Timestamp.now();

    // 1. dart 소스가 활성화된 봇 커뮤니티 조회
    const botsSnap = await db.collection("communities")
      .where("infoBot.enabled", "==", true)
      .get();

    if (botsSnap.empty) {
      console.log("[정보봇] 활성 봇 없음 — DART 스킵");
      return;
    }

    // 오늘 날짜 (YYYYMMDD) — DART API 기준
    const today = new Date();
    const endDate = formatDate(today);
    // 7일 전부터 조회 (30분마다 실행이므로 넉넉하게, 중복은 dedup이 걸러줌)
    const startDate = formatDate(new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000));

    let totalPosted = 0;

    for (const communityDoc of botsSnap.docs) {
      const community = communityDoc.data();
      const infoBot = community.infoBot;

      // 만료 체크
      if (!infoBot.expiresAt || infoBot.expiresAt.toMillis() < now.toMillis()) {
        await communityDoc.ref.update({ "infoBot.enabled": false });
        console.log(`[정보봇] ${community.name}: 만료 → 자동 비활성화`);
        continue;
      }

      // dart 소스 활성화 + corpCode 필수
      if (!infoBot.sources.includes("dart")) continue;
      if (!infoBot.corpCode) {
        console.warn(`[정보봇] ${community.name}: DART 소스 활성화됐으나 corpCode 없음 — 스킵`);
        continue;
      }

      try {
        // 2. DART API 호출
        const apiUrl = `https://opendart.fss.or.kr/api/list.json?crtfc_key=${DART_API_KEY}&corp_code=${infoBot.corpCode}&bgn_de=${startDate}&end_de=${endDate}&page_count=10&sort=date&sort_mth=desc`;
        const response = await fetch(apiUrl, {
          headers: { "User-Agent": "GLove-InfoBot/1.0" },
          signal: AbortSignal.timeout(15000),
        });

        if (!response.ok) {
          console.warn(`[정보봇] DART API 실패 (${response.status}): ${community.name}`);
          continue;
        }

        const data = await response.json();
        // DART API 상태코드: "000"=정상, "013"=결과없음
        if (data.status !== "000") {
          if (data.status === "013") {
            // 공시 없음 — 정상 케이스
          } else {
            console.warn(`[정보봇] DART API 오류 (${data.status}): ${data.message || ""}`);
          }
          continue;
        }

        const disclosures = data.list || [];

        // 3. 공시별 중복 체크 + 게시
        for (const item of disclosures) {
          const rceptNo = item.rcept_no; // 접수번호 (고유값)
          if (!rceptNo) continue;

          const dedupId = `dart_${rceptNo}`;
          const dedupRef = db.collection("glove_bot_dedup").doc(communityDoc.id)
            .collection("items").doc(dedupId);
          const dedupSnap = await dedupRef.get();
          if (dedupSnap.exists) continue;

          // DART 공시 상세 페이지 URL
          const dartViewUrl = `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${rceptNo}`;

          // 공시 유형 이모지
          const reportType = classifyDartReport(item.report_nm || "");

          const timestamp = Date.now();
          const postId = `cpost_${timestamp}_${BOT_UID}`;

          await db.collection("community_posts").doc(postId).set({
            id: postId,
            communityId: communityDoc.id,
            communityName: community.name,
            author: BOT_NICKNAME,
            author_id: BOT_UID,
            title: `📋 ${reportType} ${item.report_nm || "공시"}`,
            content: [
              `<p><strong>${item.corp_name || ""}</strong></p>`,
              `<p>${item.report_nm || ""}</p>`,
              `<p>공시일: ${item.rcept_dt || ""} · 제출인: ${item.flr_nm || ""}</p>`,
              `<p><a href="${dartViewUrl}" target="_blank" rel="noopener">🔗 DART 원문 보기</a></p>`,
            ].join(""),
            likes: 0,
            likedBy: [],
            commentCount: 0,
            createdAt: Timestamp.now(),
            // 봇 전용 필드
            isBot: true,
            botSource: "dart",
            linkUrl: dartViewUrl,
          });

          await dedupRef.set({
            sourceType: "dart",
            externalId: dedupId,
            postedAt: Timestamp.now(),
          });

          totalPosted++;
        }
      } catch (err) {
        console.error(`[정보봇] ${community.name}: DART 수집 실패:`, err.message);
      }
    }

    console.log(`[정보봇] DART 공시 수집 완료 — 총 ${totalPosted}건 게시`);
  }
);

// YYYYMMDD 형식 날짜 문자열
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

// 공시 보고서명 → 카테고리 이모지
function classifyDartReport(reportName) {
  if (reportName.includes("사업보고서")) return "📊";
  if (reportName.includes("분기보고서") || reportName.includes("반기보고서")) return "📈";
  if (reportName.includes("주요사항")) return "🚨";
  if (reportName.includes("공정공시")) return "📢";
  if (reportName.includes("지분") || reportName.includes("주식등")) return "💼";
  if (reportName.includes("합병") || reportName.includes("분할")) return "🔀";
  return "📋";
}
