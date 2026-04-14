// src/utils.ts

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
};

export const getCategoryDisplayName = (category?: string): string => {
  if (!category) return "참새들의 방앗간";
  return CATEGORY_DISPLAY_MAP[category] || category;
};

/**
 * 🚀 레벨 계산 — EXP 기반, DB에 level 저장 안 함 (프론트에서만 계산)
 * 검색어: calculateLevel
 */
const LEVEL_TABLE = [0, 30, 100, 250, 500, 1000, 2000, 4000, 7000, 10000];
export const calculateLevel = (exp: number): number => {
  for (let i = LEVEL_TABLE.length - 1; i >= 0; i--) {
    if (exp >= LEVEL_TABLE[i]) return i + 1;
  }
  return 1;
};

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
 * 🚀 평판 점수 계산: (좋아요 × 2) + (공유수 × 3) + (받은 땡스볼 × 5)
 * 레벨(성실도)과 완전 분리 — 타인의 반응만 반영
 * 검색어: getReputationScore
 */
export const getReputationScore = (userData: { likes?: number; totalShares?: number; ballReceived?: number }): number => {
  return (userData.likes || 0) * 2 + (userData.totalShares || 0) * 3 + (userData.ballReceived || 0) * 5;
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
 * 평판 점수 계산 공식
 */
// 🚀 전체 활동 기반 평판 계산 (ActivityMilestones 전용 — 향후 전체 반영 예정)
// 검색어: calculateReputation
export const calculateReputation = (
  rootCount: number,
  formalCount: number,
  commentCount: number,
  totalLikesReceived: number,
  totalSharesReceived: number = 0  // 공유수 (기본값 0 — 하위 호환)
): number => {
  return (rootCount * 5) + (formalCount * 2) + (commentCount * 1) + (totalLikesReceived * 3) + (totalSharesReceived * 2);
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
