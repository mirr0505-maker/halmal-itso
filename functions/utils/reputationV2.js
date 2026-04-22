// functions/utils/reputationV2.js — 🏅 REPUTATION V2 서버 공식 모듈
// Why: src/utils.ts의 getReputationScoreV2를 CF 런타임에서 재현.
//      TS import 불가하므로 포트 필수. ⚠️ src/constants.ts 값과 반드시 동기화 유지
//      (revenue.js:42 LEVEL_TABLE과 동일한 동기화 규칙)
// 검색어: getReputationScoreV2Server

// 🚀 REPUTATION 상수 — src/constants.ts:28~70 미러
const REPUTATION_TIERS = {
  neutral: 0,
  mild: 300,
  friendly: 1_000,
  veryFriendly: 2_000,
  firm: 3_000,
  legend: 10_000,
  awe: 50_000,
  mythic: 100_000,
};

const DECAY_CONFIG = {
  GRACE_PERIOD_DAYS: 30,
  MONTHLY_DECAY_RATE: 0.005,
  MIN_DECAY_FACTOR: 0.7,
};

const ABUSE_PENALTIES = {
  shortPostSpam: 500,
  circularThanksball: 300,
  multiAccount: 1_000,
  massFollowUnfollow: 200,
};

// 🚀 Phase A/B는 Prestige 비활성 — 클라 FEATURE_FLAGS.PRESTIGE_REPUTATION_ENABLED=false와 일치
const PRESTIGE_ENABLED = false;

/**
 * 시간 감쇠 — Firebase Admin Timestamp 또는 null 받음
 * src/utils.ts calculateDecayFactor의 서버 포트
 */
function calculateDecayFactor(lastActiveAt, nowMs = Date.now()) {
  if (!lastActiveAt) return 1.0;
  // Firebase Admin Timestamp: { seconds, nanoseconds } 구조
  const lastMs = lastActiveAt.seconds * 1000 + (lastActiveAt.nanoseconds || 0) / 1e6;
  const daysSinceActive = (nowMs - lastMs) / (1000 * 60 * 60 * 24);
  if (daysSinceActive <= DECAY_CONFIG.GRACE_PERIOD_DAYS) return 1.0;
  const monthsInactive = (daysSinceActive - DECAY_CONFIG.GRACE_PERIOD_DAYS) / 30;
  return Math.max(
    DECAY_CONFIG.MIN_DECAY_FACTOR,
    1.0 - monthsInactive * DECAY_CONFIG.MONTHLY_DECAY_RATE,
  );
}

/**
 * 어뷰징 감점 합산
 */
function calculateAbusePenalty(flags) {
  if (!flags) return 0;
  let penalty = 0;
  if (flags.shortPostSpam)      penalty += ABUSE_PENALTIES.shortPostSpam;
  if (flags.circularThanksball) penalty += ABUSE_PENALTIES.circularThanksball;
  if (flags.multiAccount)       penalty += ABUSE_PENALTIES.multiAccount;
  if (flags.massFollowUnfollow) penalty += ABUSE_PENALTIES.massFollowUnfollow;
  return penalty;
}

/**
 * 🏅 서버 V2 평판 계산 — users 문서 data 객체를 받아 점수 반환
 * max(0, floor(base × decay - penalty))
 */
function getReputationScoreV2Server(userData) {
  const base =
    (userData.likes || 0) * 2 +
    (userData.totalShares || 0) * 3 +
    (userData.ballReceived || 0) * 5;
  const decay = calculateDecayFactor(userData.lastActiveAt || null);
  const penalty = calculateAbusePenalty(userData.abuseFlags);
  return Math.max(0, Math.floor(base * decay - penalty));
}

/**
 * 🏅 평판 점수 → Tier 변환 (클라 getReputationTier 서버 포트)
 */
function getReputationTierServer(score) {
  if (score >= REPUTATION_TIERS.mythic && PRESTIGE_ENABLED) return 'mythic';
  if (score >= REPUTATION_TIERS.awe    && PRESTIGE_ENABLED) return 'awe';
  if (score >= REPUTATION_TIERS.legend && PRESTIGE_ENABLED) return 'legend';
  if (score >= REPUTATION_TIERS.firm)         return 'firm';
  if (score >= REPUTATION_TIERS.veryFriendly) return 'veryFriendly';
  if (score >= REPUTATION_TIERS.friendly)     return 'friendly';
  if (score >= REPUTATION_TIERS.mild)         return 'slightlyFriendly';
  return 'neutral';
}

module.exports = {
  getReputationScoreV2Server,
  getReputationTierServer,
  calculateDecayFactor,
  calculateAbusePenalty,
  REPUTATION_TIERS,
  DECAY_CONFIG,
  ABUSE_PENALTIES,
};
