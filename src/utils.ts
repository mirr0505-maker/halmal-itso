// src/utils.ts
import { increment } from 'firebase/firestore';
import { LEVEL_TABLE, REPUTATION_TIERS, DECAY_CONFIG, ABUSE_PENALTIES, FEATURE_FLAGS, MAPAE_THRESHOLDS, CREATOR_GATES } from './constants';
import type { CreatorGateKey } from './constants';
import type { AbuseFlags, MapaeKey, TierKey, UserData, FirestoreTimestamp } from './types';

/**
 * 숫자를 한국식 단위(천, 만)로 변환하여 반환합니다.
 * 예: 999 -> 999
 *     1000 -> 1천
 *     1200 -> 1.2천 (또는 요청에 따라 1천)
 *     10000 -> 1만
 *     12500 -> 1만 2천
 */
export const formatKoreanNumber = (num: number): string => {
  if (!num || num < 0) return "0";
  if (num < 1000) return String(num);
  if (num < 1000000) {
    const k = num / 1000;
    // 1K, 1.5K, 10K, 100K — 소수점 1자리까지, .0이면 제거
    return k % 1 === 0 ? `${k}K` : `${k.toFixed(1)}K`;
  }
  const m = num / 1000000;
  return m % 1 === 0 ? `${m}M` : `${m.toFixed(1)}M`;
};

/**
 * Firestore에 저장된 구 카테고리명을 현재 표시명으로 변환합니다.
 */
// 마이그레이션 완료 후에도 구버전 DB 데이터 backward-compat용
const CATEGORY_DISPLAY_MAP: Record<string, string> = {
  "나의 이야기":          "참새들의 방앗간",
  "너와 나의 이야기":       "참새들의 방앗간",
  "벌거벗은 임금님":       "판도라의 상자",
  "임금님 귀는 당나귀 귀": "솔로몬의 재판",
  "현지 소식":             "마법 수정 구슬",
  "지식 소매상":           "황금알을 낳는 거위",
  "뼈때리는 글":           "신포도와 여우",
  "magic_inkwell":         "마르지 않는 잉크병",
  "한컷":                  "헨젤의 빵부스러기",
};

export const getCategoryDisplayName = (category?: string): string => {
  if (!category) return "참새들의 방앗간";
  return CATEGORY_DISPLAY_MAP[category] || category;
};

/**
 * 🚀 레벨 계산 — EXP 기반 헬퍼 (프론트 표시용 실시간 계산)
 * 검색어: calculateLevel
 *
 * 저장 방식: 옵션 B (DB 저장) — LEVEL_V2.md §5 확정 (v2 §2.5 번복)
 *   types.ts UserData.level 필드 존재 (타입 수준 옵션 B 완료).
 *   EXP 증가 시 level 동기화 CF는 Sprint 2 이후 구현 예정 —
 *   현 단계는 초기값만 DB 기록, 이후는 이 헬퍼로 실시간 계산.
 *
 * LEVEL_TABLE 값은 src/constants.ts (Phase A 경계값, LEVEL_V2.md §11.1)
 */
export const calculateLevel = (exp: number): number => {
  for (let i = LEVEL_TABLE.length - 1; i >= 0; i--) {
    if (exp >= LEVEL_TABLE[i]) return i + 1;
  }
  return 1;
};

/**
 * 🚀 EXP·Level 동시 업데이트 빌더 (LEVEL_V2.md §5.5 원칙 1)
 * 검색어: buildExpLevelUpdate
 * Why: EXP 변경 시 level 불일치 방지 — 호출자가 본인 current exp를 아는 경우에만 사용.
 *      타인 EXP 지급(좋아요 마일스톤 등)은 exp만 증가시키고 Sprint 3 syncUserLevel CF에서 level 보정.
 *
 * 사용 예:
 *   await updateDoc(userRef, buildExpLevelUpdate(userData.exp, 2));
 */
export const buildExpLevelUpdate = (currentExp: number | undefined, delta: number) => ({
  exp: increment(delta),
  level: calculateLevel((currentExp || 0) + delta),
});

/**
 * 🚀 다음 레벨까지 EXP 진행률(%) 계산
 */
export const getLevelProgress = (exp: number): number => {
  const level = calculateLevel(exp);
  if (level >= 10) return 100;
  const current = LEVEL_TABLE[level - 1];
  const next = LEVEL_TABLE[level];
  return Math.round(((exp - current) / (next - current)) * 100);
};

/**
 * 🚀 다음 레벨 필요 EXP 값 반환
 */
export const getNextLevelExp = (exp: number): number => {
  const level = calculateLevel(exp);
  if (level >= 10) return LEVEL_TABLE[9];
  return LEVEL_TABLE[level];
};

/**
 * 🚀 다음 평판 등급 임계값 반환
 */
const REPUTATION_THRESHOLDS = [300, 1000, 2000, 3000];
export const getNextReputationThreshold = (score: number): number => {
  for (const t of REPUTATION_THRESHOLDS) {
    if (score < t) return t;
  }
  return REPUTATION_THRESHOLDS[REPUTATION_THRESHOLDS.length - 1];
};

/**
 * 🚀 EXP 지급 조건 — 본문 10자 미만이면 EXP 미지급 (등록은 허용)
 * HTML 태그 제거 후 순수 텍스트 길이 판정
 */
const MIN_CHARS_FOR_EXP = 10;
export const isEligibleForExp = (content: string): boolean => {
  return content.replace(/<[^>]*>/g, '').trim().length >= MIN_CHARS_FOR_EXP;
};

/**
 * 🚀 calculateExpForPost — LEVEL_V2.md §3.2.1 품질 가중치 공식
 * 검색어: calculateExpForPost
 * Why: 본문 길이·이미지·링크 기반 차등 EXP (10자 미만=0, 1000자+=+6, 이미지/링크 각 +1)
 */
export const calculateExpForPost = (
  content: string,
  opts?: { hasImage?: boolean; hasLink?: boolean }
): number => {
  const plainLen = content.replace(/<[^>]*>/g, '').trim().length;
  if (plainLen < MIN_CHARS_FOR_EXP) return 0;
  let base = 1;
  if (plainLen >= 1000) base = 6;
  else if (plainLen >= 300) base = 4;
  else if (plainLen >= 100) base = 2;
  let bonus = 0;
  if (opts?.hasImage) bonus += 1;
  if (opts?.hasLink) bonus += 1;
  return base + bonus;
};

/**
 * 🚀 평판 점수 V1 (Legacy) — (좋아요 × 2) + (공유수 × 3) + (받은 땡스볼 × 5)
 * 검색어: getReputationScore
 * @deprecated Sprint 2부터 getReputationScoreV2 사용. Phase C에서 제거 예정 (REPUTATION_V2.md §8.1)
 * Why: V2는 시간 감쇠 + 어뷰징 감점을 적용 — V1은 호출부 점진 마이그레이션 위해 유지
 */
export const getReputationScore = (userData: { likes?: number; totalShares?: number; ballReceived?: number }): number => {
  return (userData.likes || 0) * 2 + (userData.totalShares || 0) * 3 + (userData.ballReceived || 0) * 5;
};

/**
 * 🏅 평판 조회 헬퍼 — 캐시 우선, 없으면 V2 계산 (REPUTATION_V2.md §5.2.2 옵션 B)
 * 검색어: getReputation
 * Why: UI 전반 20곳 이상에서 반복 호출 — Phase B CF 캐시 도입 시 리더보드 N회 compute 회피
 *      Phase A 현재는 캐시 없어 항상 V2 계산으로 폴백 (차후 CF `updateReputationCache`가 일일 갱신)
 */
export const getReputation = (userData: UserData): number => {
  return userData.reputationCached ?? getReputationScoreV2(userData);
};

/**
 * 🏅 평판 V2-R 공식 (REPUTATION_V2.md §3.2)
 * 검색어: getReputationScoreV2
 * 최종 = max(0, floor(기본 × 감쇠 - 어뷰징감점))
 */
export const getReputationScoreV2 = (userData: UserData): number => {
  const base =
    (userData.likes || 0) * 2 +
    (userData.totalShares || 0) * 3 +
    (userData.ballReceived || 0) * 5;
  const decay = calculateDecayFactor(userData.lastActiveAt ?? null);
  const penalty = calculateAbusePenalty(userData.abuseFlags);
  return Math.max(0, Math.floor(base * decay - penalty));
};

/**
 * 🏅 시간 감쇠 함수 (REPUTATION_V2.md §3.2.2)
 * 검색어: calculateDecayFactor
 * Why: 비활성 유저 평판 완만 감쇠. GRACE_PERIOD_DAYS 이내면 1.0, 이후 월 MONTHLY_DECAY_RATE씩 감소, MIN_DECAY_FACTOR 하한
 */
export const calculateDecayFactor = (
  lastActiveAt: FirestoreTimestamp | null,
  nowMs: number = Date.now()
): number => {
  if (!lastActiveAt) return 1.0; // 최초 가입자 보호
  const lastMs = lastActiveAt.seconds * 1000 + (lastActiveAt.nanoseconds ?? 0) / 1e6;
  const daysSinceActive = (nowMs - lastMs) / (1000 * 60 * 60 * 24);
  if (daysSinceActive <= DECAY_CONFIG.GRACE_PERIOD_DAYS) return 1.0;
  const monthsInactive = (daysSinceActive - DECAY_CONFIG.GRACE_PERIOD_DAYS) / 30;
  return Math.max(DECAY_CONFIG.MIN_DECAY_FACTOR, 1.0 - monthsInactive * DECAY_CONFIG.MONTHLY_DECAY_RATE);
};

/**
 * 🏅 어뷰징 감점 합산 (REPUTATION_V2.md §3.2.3)
 * 검색어: calculateAbusePenalty
 * Why: CF detectAbuse* 계열이 플래그 설정 → 공식 내부에서 고정값 감산
 */
export const calculateAbusePenalty = (flags?: AbuseFlags): number => {
  if (!flags) return 0;
  let penalty = 0;
  if (flags.shortPostSpam)      penalty += ABUSE_PENALTIES.shortPostSpam;
  if (flags.circularThanksball) penalty += ABUSE_PENALTIES.circularThanksball;
  if (flags.multiAccount)       penalty += ABUSE_PENALTIES.multiAccount;
  if (flags.massFollowUnfollow) penalty += ABUSE_PENALTIES.massFollowUnfollow;
  return penalty;
};

/**
 * 🏅 평판 점수 → Tier 변환 (REPUTATION_V2.md §4.3)
 * 검색어: getReputationTier
 * Why: Phase A/B는 firm에서 캡, Phase C에서 PRESTIGE_REPUTATION_ENABLED=true 되면 legend/awe/mythic 해금
 */
export const getReputationTier = (score: number): TierKey => {
  const prestigeOn = FEATURE_FLAGS.PRESTIGE_REPUTATION_ENABLED;
  if (score >= REPUTATION_TIERS.mythic && prestigeOn) return 'mythic';
  if (score >= REPUTATION_TIERS.awe     && prestigeOn) return 'awe';
  if (score >= REPUTATION_TIERS.legend  && prestigeOn) return 'legend';
  if (score >= REPUTATION_TIERS.firm)          return 'firm';
  if (score >= REPUTATION_TIERS.veryFriendly)  return 'veryFriendly';
  if (score >= REPUTATION_TIERS.friendly)      return 'friendly';
  if (score >= REPUTATION_TIERS.mild)          return 'slightlyFriendly';
  return 'neutral';
};

/**
 * 🏅 표시용 Tier — grandfathered 보호 (REPUTATION_V2.md §4.5)
 * 검색어: getDisplayTier
 * Why: Phase C 경계값 조정 시 과거 달성자가 Tier 하락하지 않도록
 */
const PRESTIGE_RANK: Record<TierKey, number> = {
  neutral: 0, slightlyFriendly: 1, friendly: 2, veryFriendly: 3, firm: 4,
  legend: 5, awe: 6, mythic: 7,
};
export const getDisplayTier = (userData: UserData): TierKey => {
  const current = getReputationTier(getReputation(userData));
  const grandfathered = userData.grandfatheredPrestigeTier;
  if (grandfathered && PRESTIGE_RANK[current] < PRESTIGE_RANK[grandfathered]) {
    return grandfathered;
  }
  return current;
};

/**
 * 🏅 평판 Tier → 바깥 링 CSS (REPUTATION_V2.md §6.2)
 * 검색어: getReputationRingColor
 * Why: ReputationAvatar 이중 링의 외곽. Phase C Prestige는 PRESTIGE_REPUTATION_ENABLED 전까지 도달 불가
 */
export const getReputationRingColor = (tier: TierKey): string => {
  switch (tier) {
    case 'mythic':           return 'ring-indigo-900';
    case 'awe':              return 'ring-amber-300 animate-pulse';
    case 'legend':           return 'ring-amber-400 animate-pulse';
    case 'firm':             return 'ring-purple-600 animate-pulse';
    case 'veryFriendly':     return 'ring-violet-500';
    case 'friendly':         return 'ring-emerald-400';
    case 'slightlyFriendly': return 'ring-emerald-200';
    case 'neutral':          return 'ring-slate-200';
    default:                 return 'ring-slate-200';
  }
};

/**
 * 🏅 레벨 → 안쪽 링 border CSS (REPUTATION_V2.md §6.3)
 * 검색어: getLevelBorderColor
 */
export const getLevelBorderColor = (level: number): string => {
  if (level >= 10) return 'border-rose-500';
  if (level >= 8)  return 'border-purple-600';
  if (level >= 6)  return 'border-indigo-600';
  if (level >= 4)  return 'border-blue-600';
  if (level >= 2)  return 'border-sky-400';
  return 'border-slate-400';
};

/**
 * 🏅 Tier 한글 라벨 (REPUTATION_V2.md §6.4 툴팁용)
 * 검색어: getTierLabel
 */
// 🤝 맞깐부 판정 — KANBU_V2 §4.5.2
// 양쪽의 friendList에 서로가 포함되어 있는지 확인 (단방향 구조에서 양방향 관계 감지)
// 검색어: isMutualKanbu
export const isMutualKanbu = (
  myFriendList: string[] | undefined,
  theirFriendList: string[] | undefined,
  myNickname: string,
  theirNickname: string,
): boolean => {
  if (!myFriendList || !theirFriendList) return false;
  return myFriendList.includes(theirNickname) && theirFriendList.includes(myNickname);
};

export const getTierLabel = (tier: TierKey): string => {
  const labels: Record<TierKey, string> = {
    neutral: '중립',
    slightlyFriendly: '약간 우호',
    friendly: '우호',
    veryFriendly: '매우 우호',
    firm: '확고',
    legend: '전설',
    awe: '경외',
    mythic: '신화',
  };
  return labels[tier];
};

/**
 * 🏅 Creator Score → 마패 티어 (CREATOR_SCORE.md §마패 티어 경계)
 * 검색어: getMapaeTier
 * Why: creatorScoreTier 캐시가 있으면 우선, 없으면 MAPAE_THRESHOLDS로 실시간 재계산
 *      score < bronze(0.5)이면 티어 없음(null) — 신규/저활동 유저
 */
export const getMapaeTier = (score: number | undefined | null): MapaeKey | null => {
  if (score == null) return null;
  if (score >= MAPAE_THRESHOLDS.diamond)  return 'diamond';
  if (score >= MAPAE_THRESHOLDS.platinum) return 'platinum';
  if (score >= MAPAE_THRESHOLDS.gold)     return 'gold';
  if (score >= MAPAE_THRESHOLDS.silver)   return 'silver';
  if (score >= MAPAE_THRESHOLDS.bronze)   return 'bronze';
  return null;
};

/**
 * 🏅 마패 티어 한글 라벨 (이모지 포함)
 * 검색어: getMapaeLabel
 */
export const getMapaeLabel = (tier: MapaeKey | null): string => {
  switch (tier) {
    case 'diamond':  return '💠 다이아패';
    case 'platinum': return '🏵️ 백금패';
    case 'gold':     return '🥇 금패';
    case 'silver':   return '🥈 은패';
    case 'bronze':   return '🥉 동패';
    default:         return '— 미부여';
  }
};

/**
 * 🏅 마패 티어 색상 (Tailwind 클래스 3종 묶음)
 * 검색어: getMapaeColor
 * Why: 동/은/금/백금/다이아 — slate → amber → violet 그라데이션으로 시각적 희소성 표현
 */
export const getMapaeColor = (tier: MapaeKey | null): { bg: string; text: string; border: string } => {
  switch (tier) {
    case 'diamond':  return { bg: 'bg-violet-50',  text: 'text-violet-700',  border: 'border-violet-300' };
    case 'platinum': return { bg: 'bg-indigo-50',  text: 'text-indigo-700',  border: 'border-indigo-300' };
    case 'gold':     return { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-300' };
    case 'silver':   return { bg: 'bg-slate-100',  text: 'text-slate-700',   border: 'border-slate-300' };
    case 'bronze':   return { bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-300' };
    default:         return { bg: 'bg-slate-50',   text: 'text-slate-400',   border: 'border-slate-200' };
  }
};

/**
 * 🏅 Creator Score 조회 헬퍼 — 캐시 우선, 없으면 null
 * 검색어: getCreatorScore
 * Why: 캐시 없는 유저(신규/집계 대기)는 UI에서 "집계 대기 중"으로 fallback — 공식 재계산은 서버 전용
 */
export const getCreatorScore = (userData: Pick<UserData, 'creatorScoreCached'>): number | null => {
  return typeof userData.creatorScoreCached === 'number' ? userData.creatorScoreCached : null;
};

/**
 * 🚪 Creator Gate 통과 여부 — Lv × Creator Score 동시 충족
 * 검색어: checkCreatorGate
 * Why: 출금/라이브/잉크병 유료화/깐부방 개설 등 고가치 기능에 품질 Gate 적용
 *      UI 버튼 비활성·서버 assert 양쪽에서 동일 공식 사용
 *      score가 아직 집계 전(null/undefined)이면 0으로 간주하여 기본 차단
 */
export const checkCreatorGate = (
  userData: Pick<UserData, 'level' | 'exp' | 'creatorScoreCached'>,
  gateKey: CreatorGateKey
): { pass: boolean; reason?: 'level' | 'score' } => {
  const gate = CREATOR_GATES[gateKey];
  const level = typeof userData.level === 'number' ? userData.level : calculateLevel(userData.exp ?? 0);
  const score = typeof userData.creatorScoreCached === 'number' ? userData.creatorScoreCached : 0;

  if (level < gate.minLevel) return { pass: false, reason: 'level' };
  if (score < gate.minScore) return { pass: false, reason: 'score' };
  return { pass: true };
};

/**
 * 🚪 Gate 요구 조건 라벨 — UI 툴팁/안내 문구용
 * 검색어: getGateRequirementLabel
 */
export const getGateRequirementLabel = (gateKey: CreatorGateKey): string => {
  const gate = CREATOR_GATES[gateKey];
  const lvPart = gate.minLevel > 0 ? `Lv${gate.minLevel}+` : '레벨 무관';
  const scorePart = `크리에이터 점수 ${gate.minScore.toFixed(1)}+`;
  return `${lvPart} · ${scorePart}`;
};

/**
 * 평판 점수에 따른 등급 이름을 반환합니다.
 */
export const getReputationLabel = (score: number): string => {
  if (score >= 3000) return "확고";
  if (score >= 2000) return "매우 우호";
  if (score >= 1000) return "우호";
  if (score >= 300) return "약간 우호";
  return "중립";
};

/**
 * 평판 등급에 따른 배경 및 텍스트 색상 클래스를 반환합니다.
 */
export const getReputationStyle = (score: number): string => {
  if (score >= 3000) return "bg-purple-600 text-white shadow-purple-100"; // 확고: 보라
  if (score >= 2000) return "bg-violet-500 text-white shadow-violet-100"; // 매우 우호: 바이올렛
  if (score >= 1000) return "bg-emerald-500 text-white shadow-emerald-100"; // 우호: 녹색
  if (score >= 300) return "bg-emerald-50 text-emerald-600 border-emerald-100"; // 약간 우호: 연녹색
  return "bg-slate-100 text-slate-500 border-slate-200"; // 중립: 회색
};

/**
 * 레벨에 따른 배경 색상 클래스를 반환합니다. (Lv 1~10)
 */
export const getLevelStyle = (level: number): string => {
  if (level >= 10) return "bg-gradient-to-br from-purple-600 to-rose-500 text-white";
  if (level >= 8) return "bg-purple-600 text-white";
  if (level >= 6) return "bg-indigo-600 text-white";
  if (level >= 4) return "bg-blue-600 text-white";
  if (level >= 2) return "bg-sky-400 text-white";
  return "bg-slate-400 text-white"; // Lv 1: 회색
};

/**
 * 다음 등급까지의 퍼센트(%)를 계산합니다.
 */
export const getReputationProgress = (score: number): number => {
  if (score >= 3000) return 100;
  if (score >= 2000) return ((score - 2000) / 1000) * 100;
  if (score >= 1000) return ((score - 1000) / 1000) * 100;
  if (score >= 300) return ((score - 300) / 700) * 100;
  return (score / 300) * 100;
};

// ════════════════════════════════════════════════════════════
// 🚀 ADSMARKET — 세금·정산 유틸리티
// ════════════════════════════════════════════════════════════

/**
 * 원천세 계산
 * @param grossAmount 세전 총액
 * @param incomeType 소득 유형 (business=3.3%, other=8.8%)
 */
export const calculateWithholdingTax = (
  grossAmount: number,
  incomeType: 'business' | 'other'
): { taxAmount: number; netAmount: number; taxRate: number } => {
  const taxRate = incomeType === 'business' ? 0.033 : 0.088;
  const taxAmount = Math.floor(grossAmount * taxRate);
  return { taxAmount, netAmount: grossAmount - taxAmount, taxRate };
};

// 🏚️ 유배자 익명 닉네임 생성 — uid 기반 결정적 해시 → "곳간 거주자 #NNNN"
// Why: STOREHOUSE.md §11.4 — 유배자는 타인에게 익명으로만 인지되어야 함.
//      동일 uid는 항상 동일 번호가 생성되므로 "유배 중 일관성 유지" 요건 충족.
//      author_id는 실제 uid로 저장되어 본인 식별·관리자 추적은 유지됨.
export const anonymizeExileNickname = (uid: string): string => {
  // FNV-1a 32bit 해시 → 4자리 숫자(0000~9999)로 압축
  let hash = 2166136261;
  for (let i = 0; i < uid.length; i++) {
    hash ^= uid.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const num = Math.abs(hash) % 10000;
  return `곳간 거주자 #${String(num).padStart(4, '0')}`;
};
