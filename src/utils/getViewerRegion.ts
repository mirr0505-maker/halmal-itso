// src/utils/getViewerRegion.ts — IP 기반 열람자 지역 추정 (광고 타겟팅용)
// 🚀 ipapi.co 무료 API + sessionStorage 30분 캐시 + 한글 시/도 매핑
// 실패 시 빈 문자열 (서버에서 전국 매칭으로 폴백)

const IP_REGION_CACHE_KEY = 'viewerRegion';
const CACHE_DURATION_MS = 30 * 60 * 1000; // 30분

interface CachedRegion {
  region: string;
  timestamp: number;
}

/**
 * 열람자의 시/도 추정 (IP 기반)
 * - 캐시 30분, 실패 시 빈 문자열
 * - 빈 문자열은 서버에서 "지역 무관"으로 처리
 */
export async function getViewerRegion(): Promise<string> {
  // 1) 메모리 캐시 확인
  try {
    const cached = sessionStorage.getItem(IP_REGION_CACHE_KEY);
    if (cached) {
      const parsed: CachedRegion = JSON.parse(cached);
      if (Date.now() - parsed.timestamp < CACHE_DURATION_MS) {
        return parsed.region;
      }
    }
  } catch { /* sessionStorage 접근 실패 시 무시 */ }

  // 2) ipapi.co 호출 (3초 타임아웃)
  try {
    const response = await fetch('https://ipapi.co/json/', {
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return '';

    const data = await response.json();
    // ipapi.co region 필드: 영문 시/도명 (예: "Seoul", "Gyeonggi-do")
    const region = mapRegionToKorean(data.region || '');

    // 캐시 저장
    try {
      sessionStorage.setItem(IP_REGION_CACHE_KEY, JSON.stringify({ region, timestamp: Date.now() }));
    } catch { /* 무시 */ }

    return region;
  } catch {
    return ''; // 실패 시 빈 문자열
  }
}

/**
 * ipapi.co 영문 region → 한글 시/도 매핑
 * 매핑 기준: data/regions.ts의 shortName과 일치
 */
function mapRegionToKorean(englishRegion: string): string {
  const mapping: Record<string, string> = {
    'Seoul': '서울',
    'Busan': '부산',
    'Daegu': '대구',
    'Incheon': '인천',
    'Gwangju': '광주',
    'Daejeon': '대전',
    'Ulsan': '울산',
    'Sejong': '세종',
    'Gyeonggi-do': '경기',
    'Gangwon-do': '강원',
    'North Chungcheong': '충북',
    'South Chungcheong': '충남',
    'North Jeolla': '전북',
    'South Jeolla': '전남',
    'North Gyeongsang': '경북',
    'South Gyeongsang': '경남',
    'Jeju-do': '제주',
    // 변형 표기 대비
    'Chungcheongbuk-do': '충북',
    'Chungcheongnam-do': '충남',
    'Jeollabuk-do': '전북',
    'Jeollanam-do': '전남',
    'Gyeongsangbuk-do': '경북',
    'Gyeongsangnam-do': '경남',
    'Gangwon': '강원',
    'Gyeonggi': '경기',
    'Jeju': '제주',
  };
  return mapping[englishRegion] || '';
}
