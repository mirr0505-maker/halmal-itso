// functions/titleSeed.js — 🏷️ Sprint 5: 칭호 마스터 14종 seed CF
//
// seedTitles — 관리자 전용. titles/{titleId} 문서 14개를 merge 주입.
//
// Why: 클라이언트 TITLE_CATALOG(src/constants.ts)와 동일 소스로 DB에 주입해야
//      titleChecker.js의 awardTitle 훅이 viable. 운영 단계에서 설계 변경 시
//      이 파일만 업데이트 후 재실행(merge)으로 무중단 반영.
//
// ⚠️ src/constants.ts TITLE_CATALOG와 반드시 동기화 (CF는 TS import 불가 → 중복 불가피)
// 🛡️ assertAdmin + logAdminAction: 무단 호출 차단 + 감사 로그

const { onCall } = require("firebase-functions/v2/https");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const { assertAdmin } = require("./utils/adminAuth");
const { logAdminAction } = require("./adminAudit");

const db = getFirestore();

// 📖 14종 마스터 seed — src/constants.ts TITLE_CATALOG와 1:1 매칭
//   revocationPolicy: 'permanent' | 'revoke_on_ban' | 'suspend_lv2_revoke_lv3'
//   notificationLevel: 'toast' | 'celebration' | 'modal'
const TITLE_SEED = [
  // ── creator (5) ─────────────────────────────────────────
  {
    id: "writer_seed", emoji: "🔰", label: "새싹 작가",
    category: "creator", description: "첫 유효 글 작성",
    revocationPolicy: "revoke_on_ban", notificationLevel: "toast",
  },
  {
    id: "writer_diligent", emoji: "✍️", label: "근면한 작가",
    labelByTier: { I: "근면한 작가", II: "꾸준한 작가", III: "거장 작가" },
    category: "creator", description: "연속 일자 유효 글 (I=30일 / II=100일 / III=365일)",
    revocationPolicy: "suspend_lv2_revoke_lv3", notificationLevel: "celebration",
    tiered: true,
  },
  {
    id: "viral_first", emoji: "🔥", label: "첫 화제",
    category: "creator", description: "단일 글 고유 좋아요 30개+",
    revocationPolicy: "suspend_lv2_revoke_lv3", notificationLevel: "celebration",
  },
  {
    id: "popular_writer", emoji: "⭐", label: "인기 작가",
    category: "creator", description: "단일 글 고유 좋아요 100개+",
    revocationPolicy: "suspend_lv2_revoke_lv3", notificationLevel: "modal",
  },
  {
    id: "super_hit", emoji: "💎", label: "초대박",
    category: "creator", description: "단일 글 고유 좋아요 1,000개+",
    revocationPolicy: "suspend_lv2_revoke_lv3", notificationLevel: "modal",
  },
  // ── community (5) ───────────────────────────────────────
  {
    id: "social_master", emoji: "🤝", label: "사교의 달인",
    category: "community", description: "맞깐부 30명+",
    revocationPolicy: "suspend_lv2_revoke_lv3", notificationLevel: "celebration",
  },
  {
    id: "chat_master", emoji: "💬", label: "대화의 명수",
    labelByTier: { I: "대화의 명수", II: "대화의 달인", III: "대화의 마스터" },
    category: "community", description: "누적 유효 댓글 (I=1,000 / II=5,000 / III=20,000)",
    revocationPolicy: "suspend_lv2_revoke_lv3", notificationLevel: "celebration",
    tiered: true,
  },
  {
    id: "sponsor", emoji: "🎁", label: "후원자",
    labelByTier: { I: "후원자", II: "든든한 후원자", III: "위대한 후원자" },
    category: "community", description: "누적 보낸 땡스볼 (I=1,000볼 / II=10,000볼 / III=100,000볼)",
    revocationPolicy: "revoke_on_ban", notificationLevel: "celebration",
    tiered: true,
  },
  {
    id: "kanbu_star", emoji: "🌟", label: "인기인",
    category: "community", description: "나를 깐부 맺은 수 100명+",
    revocationPolicy: "suspend_lv2_revoke_lv3", notificationLevel: "celebration",
  },
  {
    id: "influencer", emoji: "👑", label: "영향력자",
    category: "community", description: "나를 깐부 맺은 수 1,000명+",
    revocationPolicy: "suspend_lv2_revoke_lv3", notificationLevel: "modal",
  },
  // ── loyalty (4) ─────────────────────────────────────────
  {
    id: "pioneer_2026", emoji: "🌱", label: "초기 개척자",
    category: "loyalty", description: "2026년 내 가입 (한정판)",
    revocationPolicy: "permanent", notificationLevel: "toast",
  },
  {
    id: "loyal_1year", emoji: "🎖️", label: "1년 개근",
    category: "loyalty", description: "가입 365일 + 월 1회+ 활동",
    revocationPolicy: "suspend_lv2_revoke_lv3", notificationLevel: "toast",
  },
  {
    id: "veteran_2year", emoji: "🏛️", label: "베테랑",
    category: "loyalty", description: "가입 2년+",
    revocationPolicy: "revoke_on_ban", notificationLevel: "toast",
  },
  {
    id: "dedication", emoji: "⚡", label: "헌신",
    labelByTier: { I: "헌신", II: "헌신 (예약)", III: "헌신 (예약)" },
    category: "loyalty", description: "Lv10 도달 (Phase C Lv15/20 확장 예약)",
    revocationPolicy: "suspend_lv2_revoke_lv3", notificationLevel: "modal",
    tiered: true,
  },
];

exports.seedTitles = onCall(
  { region: "asia-northeast3" },
  async (request) => {
    // 🛡️ Sprint 6 A-1: Claims OR 닉네임 이중 체크
    const { adminUid, adminName, viaClaims } = await assertAdmin(request.auth);

    const batch = db.batch();
    const now = Timestamp.now();
    for (const entry of TITLE_SEED) {
      batch.set(
        db.collection("titles").doc(entry.id),
        {
          ...entry,
          updatedAt: now,
          // createdAt은 merge 시 기존 값 보존 (최초 주입 시점 유지)
          createdAt: entry.createdAt || now,
        },
        { merge: true },
      );
    }
    await batch.commit();

    // 🛡️ 감사 로그
    await logAdminAction({
      action: "seed_titles",
      adminUid,
      adminName,
      viaClaims,
      targetUid: null,
      payload: {
        count: TITLE_SEED.length,
        ids: TITLE_SEED.map((t) => t.id),
      },
      reason: "system_seed",
    });

    return {
      success: true,
      count: TITLE_SEED.length,
      ids: TITLE_SEED.map((t) => t.id),
    };
  },
);
