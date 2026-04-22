// functions/utils/creatorScore.js — 🏅 Creator Score 서버 공식 포트
// Sprint 4 Phase B — CREATOR_SCORE.md §공식 구현부
// Why: 클라이언트 TS는 CF Node 런타임에서 require 불가 → 독립 포트
//      src/constants.ts의 CREATOR_SCORE_CONFIG·ACTIVITY_WEIGHTS·TRUST_CONFIG와 반드시 동기화
// 검색어: creatorScore utils

// ═══════════════════════════════════════════════════════
// 상수 — src/constants.ts CREATOR_SCORE 블록과 동기화
// ═══════════════════════════════════════════════════════
const CREATOR_SCORE_CONFIG = {
  SCALING_DIVISOR: 1000,
  RECENT_WINDOW_DAYS: 30,
  MIN_TRUST: 0.3,
};

const ACTIVITY_WEIGHTS = {
  post: 3,
  comment: 1,
  likeSent: 0.5,
};

const LEVEL_MEDIAN_ACTIVITY = {
  1: 5, 2: 10, 3: 15, 4: 22, 5: 30, 6: 45, 7: 60, 8: 75, 9: 87, 10: 100,
};

const TRUST_CONFIG = {
  ABUSE_PENALTIES: {
    shortPostSpam: 0.05,
    circularThanksball: 0.10,
    multiAccount: 0.15,
    massFollowUnfollow: 0.05,
  },
  EXILE_PENALTIES: { 1: 0.05, 2: 0.25, 3: 1.50 },
  REPEAT_MULTIPLIER: { 2: 1.5, 3: 2.0 },
};

const MAPAE_THRESHOLDS = {
  bronze: 0.5,
  silver: 1.0,
  gold: 2.0,
  platinum: 3.5,
  diamond: 5.0,
};

// ═══════════════════════════════════════════════════════
// 1) Activity 축 — recent30d 집계값 기반
// ═══════════════════════════════════════════════════════
// Why: min(1.0, recent30d / 중위값) — 중위값 도달 시 1.0 캡
function calculateActivityScore(recent30d, level) {
  const effectiveLevel = Math.max(1, Math.min(10, level || 1));
  const median = LEVEL_MEDIAN_ACTIVITY[effectiveLevel] || LEVEL_MEDIAN_ACTIVITY[10];
  const activity = Math.min(1.0, recent30d / median);
  return Math.max(0, activity);
}

// 가중 합산: posts×3 + comments×1 + likesSent×0.5
function calculateRecent30dTotal(counts) {
  return (
    (counts.posts || 0) * ACTIVITY_WEIGHTS.post
    + (counts.comments || 0) * ACTIVITY_WEIGHTS.comment
    + (counts.likesSent || 0) * ACTIVITY_WEIGHTS.likeSent
  );
}

// ═══════════════════════════════════════════════════════
// 2) Trust 축 — 1.0에서 abuse / exile / report 감산, 하한 0.3
// ═══════════════════════════════════════════════════════
function calculateTrustScore(userData) {
  let trust = 1.0;

  // 어뷰징 플래그 감산
  if (userData.abuseFlags) {
    for (const key of Object.keys(TRUST_CONFIG.ABUSE_PENALTIES)) {
      if (userData.abuseFlags[key]) {
        trust -= TRUST_CONFIG.ABUSE_PENALTIES[key];
      }
    }
  }

  // 유배 이력 감산 — 재범 배수 적용
  const exileHistory = Array.isArray(userData.exileHistory) ? userData.exileHistory : [];
  // 유배 없으면 0 감산
  if (exileHistory.length > 0) {
    // 단계별 등장 횟수
    const countByLevel = { 1: 0, 2: 0, 3: 0 };
    for (const rec of exileHistory) {
      const lv = rec.level;
      if (lv === 1 || lv === 2 || lv === 3) countByLevel[lv]++;
    }
    for (const lv of [1, 2, 3]) {
      const occ = countByLevel[lv];
      if (occ === 0) continue;
      const base = TRUST_CONFIG.EXILE_PENALTIES[lv];
      const multiplier = TRUST_CONFIG.REPEAT_MULTIPLIER[occ] || 1.0;
      trust -= base * multiplier * occ;
    }
  }

  // Phase C — 고유신고자 감산은 TRUST_CONFIG.REPORT_PENALTIES로 별도 활성화 (본 Phase B는 skip)

  return Math.max(CREATOR_SCORE_CONFIG.MIN_TRUST, Math.min(1.0, trust));
}

// ═══════════════════════════════════════════════════════
// 3) 최종 점수 — (rep × act × trust) / 1000
// ═══════════════════════════════════════════════════════
function calculateCreatorScore(userData) {
  const reputation = userData.reputationCached || 0;
  const recent30d = calculateRecent30dTotal({
    posts: userData.recent30d_posts,
    comments: userData.recent30d_comments,
    likesSent: userData.recent30d_likesSent,
  });
  const activity = calculateActivityScore(recent30d, userData.level);
  const trust = calculateTrustScore(userData);
  const raw = (reputation * activity * trust) / CREATOR_SCORE_CONFIG.SCALING_DIVISOR;
  return Math.round(raw * 100) / 100; // 소수점 2자리
}

// 마패 티어 매핑
function getMapaeTier(score) {
  if (score >= MAPAE_THRESHOLDS.diamond) return "diamond";
  if (score >= MAPAE_THRESHOLDS.platinum) return "platinum";
  if (score >= MAPAE_THRESHOLDS.gold) return "gold";
  if (score >= MAPAE_THRESHOLDS.silver) return "silver";
  if (score >= MAPAE_THRESHOLDS.bronze) return "bronze";
  return null; // bronze 미만은 티어 없음
}

module.exports = {
  calculateCreatorScore,
  calculateActivityScore,
  calculateTrustScore,
  calculateRecent30dTotal,
  getMapaeTier,
  CREATOR_SCORE_CONFIG,
  ACTIVITY_WEIGHTS,
  LEVEL_MEDIAN_ACTIVITY,
  TRUST_CONFIG,
  MAPAE_THRESHOLDS,
};
