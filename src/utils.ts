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
  if (num < 1000) return num.toLocaleString();
  
  if (num < 10000) {
    const thousands = Math.floor(num / 1000);
    const remainder = Math.floor((num % 1000) / 100);
    return remainder > 0 ? `${thousands}.${remainder}천` : `${thousands}천`;
  }
  
  const tenThousands = Math.floor(num / 10000);
  const thousands = Math.floor((num % 10000) / 1000);
  
  if (thousands > 0) {
    return `${tenThousands}만 ${thousands}천`;
  }
  return `${tenThousands}만`;
};

/**
 * Firestore에 저장된 구 카테고리명을 현재 표시명으로 변환합니다.
 */
// 마이그레이션 완료 후에도 구버전 DB 데이터 backward-compat용
const CATEGORY_DISPLAY_MAP: Record<string, string> = {
  "나의 이야기":          "너와 나의 이야기",
  "벌거벗은 임금님":       "판도라의 상자",
  "임금님 귀는 당나귀 귀": "솔로몬의 재판",
  "현지 소식":             "마법 수정 구슬",
  "지식 소매상":           "황금알을 낳는 거위",
  "뼈때리는 글":           "신포도와 여우",
};

export const getCategoryDisplayName = (category?: string): string => {
  if (!category) return "너와 나의 이야기";
  return CATEGORY_DISPLAY_MAP[category] || category;
};

/**
 * 🚀 평판 점수 계산: 좋아요 + (공유수 × 2)
 * userData.likes 대신 항상 이 함수를 사용하세요.
 * 검색어: getReputationScore
 */
export const getReputationScore = (userData: { likes?: number; totalShares?: number }): number => {
  return (userData.likes || 0) + (userData.totalShares || 0) * 2;
};

/**
 * 평판 점수에 따른 등급 이름을 반환합니다.
 */
export const getReputationLabel = (score: number): string => {
  if (score >= 2000) return "확고";
  if (score >= 1000) return "우호";
  if (score >= 300) return "약간 우호";
  return "중립";
};

/**
 * 평판 등급에 따른 배경 및 텍스트 색상 클래스를 반환합니다.
 */
export const getReputationStyle = (score: number): string => {
  if (score >= 2000) return "bg-purple-600 text-white shadow-purple-100"; // 확고: 보라
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
  if (score >= 2000) return 100;
  if (score >= 1000) return ((score - 1000) / 1000) * 100;
  if (score >= 300) return ((score - 300) / 700) * 100;
  return (score / 300) * 100;
};
