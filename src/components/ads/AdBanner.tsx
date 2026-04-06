// src/components/ads/AdBanner.tsx — 단일 광고 배너 렌더링
// 🚀 Phase 3에서 경매 낙찰 광고를 표시할 때 사용
import type { Ad } from '../../types';

interface Props {
  ad: Ad;
  position: 'top' | 'middle' | 'bottom';
  onImpression?: (adId: string) => void;
  onClick?: (adId: string) => void;
}

const AdBanner = ({ ad, position, onClick }: Props) => {
  const handleClick = () => {
    onClick?.(ad.id);
    window.open(ad.landingUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      onClick={handleClick}
      className={`cursor-pointer rounded-xl overflow-hidden border border-slate-100 bg-white hover:shadow-md transition-all group ${
        position === 'middle' ? 'mx-auto max-w-lg' : 'w-full'
      }`}
    >
      {ad.imageUrl && (
        <img src={ad.imageUrl} alt="" className="w-full h-auto object-cover max-h-[90px]" />
      )}
      <div className="px-3 py-2 flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-[1000] text-slate-800 truncate">{ad.headline}</p>
          <p className="text-[10px] font-bold text-slate-400 truncate">{ad.description}</p>
        </div>
        <span className="text-[10px] font-black text-violet-600 bg-violet-50 px-2 py-1 rounded-lg border border-violet-100 shrink-0 ml-2">
          {ad.ctaText}
        </span>
      </div>
      <div className="px-3 pb-1.5">
        <span className="text-[8px] font-bold text-slate-300">광고</span>
      </div>
    </div>
  );
};

export default AdBanner;
