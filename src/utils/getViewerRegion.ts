// src/utils/getViewerRegion.ts — IP 기반 열람자 지역 추정 (광고 타겟팅용)
// 🚀 sessionStorage 30분 캐시 + 한글 시/도 매핑
// 실패 시 빈 문자열 (서버에서 전국 매칭으로 폴백)
// 🔧 2026-04-26: in-flight singleton + negative cache.
//   기존 — 한 페이지 다중 AdSlot이 동시 호출 → 429 + CORS 차단 + 실패도 캐시 안 돼서 매 호출마다 재시도.
//   수정 — 동시 호출 1번으로 합치고, 실패 결과도 30분 캐시(빈 문자열).
// 🚀 2026-04-26 v2: ipapi.co → halmal-link-preview Worker /region endpoint.
//   Cloudflare Workers `request.cf.region` 사용 — CORS·rate limit 0, 무료 무제한.
//   응답: { region: "Seoul"|..., country: "KR"|..., city: "..." } (ipapi.co와 동일 영문 schema)

const IP_REGION_CACHE_KEY = 'viewerRegion';
const CACHE_DURATION_MS = 30 * 60 * 1000; // 30분 (성공·실패 공통)

interface CachedRegion {
  region: string;
  timestamp: number;
}

// 동시 호출 차단 — 첫 호출의 Promise를 모든 caller가 공유
let inflight: Promise<string> | null = null;

/**
 * 열람자의 시/도 추정 (IP 기반)
 * - 캐시 30분 (성공·실패 공통)
 * - 실패 시 빈 문자열 → 서버에서 "지역 무관"으로 처리
 */
export async function getViewerRegion(): Promise<string> {
  // 1) sessionStorage 캐시 확인 (성공·실패 모두 hit으로 간주)
  try {
    const cached = sessionStorage.getItem(IP_REGION_CACHE_KEY);
    if (cached) {
      const parsed: CachedRegion = JSON.parse(cached);
      if (Date.now() - parsed.timestamp < CACHE_DURATION_MS) {
        return parsed.region;
      }
    }
  } catch { /* 무시 */ }

  // 2) in-flight Promise가 있으면 공유 (동시 다중 호출 차단)
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const response = await fetch('https://halmal-link-preview.mirr0505.workers.dev/region', {
        signal: AbortSignal.timeout(3000),
      });
      const region = response.ok ? mapRegionToKorean((await response.json())?.region || '') : '';
      try {
        sessionStorage.setItem(IP_REGION_CACHE_KEY, JSON.stringify({ region, timestamp: Date.now() }));
      } catch { /* 무시 */ }
      return region;
    } catch {
      // 실패 결과도 30분 캐시 — 재시도로 인한 429·CORS 폭주 차단
      try {
        sessionStorage.setItem(IP_REGION_CACHE_KEY, JSON.stringify({ region: '', timestamp: Date.now() }));
      } catch { /* 무시 */ }
      return '';
    } finally {
      inflight = null;
    }
  })();

  return inflight;
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
