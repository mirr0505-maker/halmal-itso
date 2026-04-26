// src/components/ads/AdBanner.tsx — 단일 광고 배너 렌더링
// 🚀 2026-04-25: imageStyle 2종 지원
//   - horizontal: 가로 플래카드형 (3:1 이미지 + 하단 텍스트)
//   - vertical: 세로형 (9:16 이미지 + 좌/우 위치 + 반대편 텍스트)
// 🚀 v2 P1-5 (2026-04-26): UTM 자동 부착 — 광고주 외부 측정(GA 등) 연동
//   ?utm_source=geulove&utm_medium={slot}&utm_campaign={adId}
import type { Ad } from '../../types';

interface Props {
  ad: Ad;
  position: 'top' | 'middle' | 'bottom';
  onImpression?: (adId: string) => void;
  onClick?: (adId: string) => void;
}

// 🚀 v2 P1-5: UTM 자동 부착 헬퍼
function appendUTM(landingUrl: string, adId: string, slot: string): string {
  if (!landingUrl) return '#';
  try {
    const u = new URL(landingUrl);
    if (!u.searchParams.has('utm_source')) u.searchParams.set('utm_source', 'geulove');
    if (!u.searchParams.has('utm_medium')) u.searchParams.set('utm_medium', slot);
    if (!u.searchParams.has('utm_campaign')) u.searchParams.set('utm_campaign', adId);
    return u.toString();
  } catch {
    return landingUrl;
  }
}

const AdBanner = ({ ad, position, onClick }: Props) => {
  const handleClick = () => {
    onClick?.(ad.id);
    const finalUrl = appendUTM(ad.landingUrl, ad.id, position);
    window.open(finalUrl, '_blank', 'noopener,noreferrer');
  };

  // 🔧 2026-04-25 정정: 광고주가 등록한 imageStyle 그대로 존중 (bottom 슬롯에서도 세로형 OK)
  //   사용자 의도 — 슬롯 위치 무관 광고주 선택 우선. 본문 끝에 세로 광고도 자연스러움.
  const style = ad.imageStyle || 'horizontal';
  const verticalImageOnRight = ad.imagePosition === 'right';

  // 가로 플래카드형 — 3:1 이미지 풀 가로 + 하단 텍스트
  if (style === 'horizontal') {
    return (
      <div
        onClick={handleClick}
        className="cursor-pointer rounded-xl overflow-hidden border border-slate-100 bg-white hover:shadow-md transition-all mx-auto max-w-md"
      >
        {ad.imageUrl ? (
          <div className="aspect-[3/1] bg-slate-50 overflow-hidden">
            <img src={ad.imageUrl} alt="" className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="aspect-[3/1] bg-slate-100 flex items-center justify-center">
            <span className="text-[10px] font-bold text-slate-300">이미지 없음</span>
          </div>
        )}
        <div className="px-3 py-2 flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-[1000] text-slate-800 line-clamp-1 leading-tight">{ad.headline}</p>
            <p className="text-[10px] font-bold text-slate-400 line-clamp-1 mt-0.5">{ad.description}</p>
          </div>
          <span className="text-[10px] font-black text-violet-600 bg-violet-50 px-2 py-0.5 rounded-lg border border-violet-100 shrink-0">
            {ad.ctaText || '자세히 보기'}
          </span>
        </div>
        <div className="px-3 pb-1.5">
          <span className="text-[8px] font-bold text-slate-300">광고</span>
        </div>
      </div>
    );
  }

  // 세로형 — 9:16 이미지 + 반대편 텍스트
  //   2026-04-26: 카드 폭은 가로형과 동일 max-w-md, 높이 약 100px(이전 150의 2/3).
  //   이미지 박스는 카드 height 기준 9:16 비율로 폭 자동 계산 (h=100px → w=56px).
  const imageBlock = ad.imageUrl ? (
    <div className="aspect-[9/16] bg-slate-50 shrink-0 overflow-hidden">
      <img src={ad.imageUrl} alt="" className="w-full h-full object-contain" />
    </div>
  ) : (
    <div className="aspect-[9/16] bg-slate-100 shrink-0 flex items-center justify-center">
      <span className="text-[10px] font-bold text-slate-300">없음</span>
    </div>
  );

  const textBlock = (
    <div className="flex-1 px-3 py-2 flex flex-col justify-between min-w-0">
      <div className="min-w-0">
        <p className="text-[12px] font-[1000] text-slate-800 line-clamp-3 leading-tight">{ad.headline}</p>
        <p className="text-[10px] font-bold text-slate-400 line-clamp-3 mt-1 leading-tight">{ad.description}</p>
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[8px] font-bold text-slate-300">광고</span>
        <span className="text-[10px] font-black text-violet-600 bg-violet-50 px-2 py-0.5 rounded-lg border border-violet-100 shrink-0">
          {ad.ctaText || '자세히 보기'}
        </span>
      </div>
    </div>
  );

  return (
    <div
      onClick={handleClick}
      className="cursor-pointer rounded-xl overflow-hidden border border-slate-100 bg-white hover:shadow-md transition-all mx-auto max-w-[320px] md:max-w-md"
    >
      {/* 반응형 — 모바일 80px / 데스크톱 140px. 이미지는 height 기준 9:16 폭 자동 */}
      <div className="flex items-stretch h-[80px] md:h-[140px]">
        {verticalImageOnRight ? (
          <>
            {textBlock}
            {imageBlock}
          </>
        ) : (
          <>
            {imageBlock}
            {textBlock}
          </>
        )}
      </div>
    </div>
  );
};

export default AdBanner;
