// src/components/ads/AdBanner.tsx — 단일 광고 배너 렌더링
// 🚀 2026-04-25: imageStyle 2종 지원
//   - horizontal: 가로 플래카드형 (3:1 이미지 + 하단 텍스트)
//   - vertical: 세로형 (9:16 이미지 + 좌/우 위치 + 반대편 텍스트)
import type { Ad } from '../../types';

interface Props {
  ad: Ad;
  position: 'top' | 'middle' | 'bottom';
  onImpression?: (adId: string) => void;
  onClick?: (adId: string) => void;
}

const AdBanner = ({ ad, position: _position, onClick }: Props) => {
  const handleClick = () => {
    onClick?.(ad.id);
    window.open(ad.landingUrl, '_blank', 'noopener,noreferrer');
  };

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
            {ad.ctaText}
          </span>
        </div>
        <div className="px-3 pb-1.5">
          <span className="text-[8px] font-bold text-slate-300">광고</span>
        </div>
      </div>
    );
  }

  // 세로형 — 9:16 이미지 + 반대편 텍스트
  const imageBlock = ad.imageUrl ? (
    <div className="w-[35%] aspect-[9/16] bg-slate-50 shrink-0 overflow-hidden">
      <img src={ad.imageUrl} alt="" className="w-full h-full object-cover" />
    </div>
  ) : (
    <div className="w-[35%] aspect-[9/16] bg-slate-100 shrink-0 flex items-center justify-center">
      <span className="text-[10px] font-bold text-slate-300">이미지 없음</span>
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
          {ad.ctaText}
        </span>
      </div>
    </div>
  );

  return (
    <div
      onClick={handleClick}
      className="cursor-pointer rounded-xl overflow-hidden border border-slate-100 bg-white hover:shadow-md transition-all mx-auto max-w-md"
    >
      <div className="flex items-stretch">
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
