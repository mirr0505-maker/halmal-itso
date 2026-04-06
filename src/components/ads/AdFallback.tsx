// src/components/ads/AdFallback.tsx — Waterfall 폴백 (자체 프로모션)
// 🚀 Phase 1: 자체 프로모션 배너만
// Phase 2: 구글 애드센스 스니펫 삽입
// Phase 3: 경매 낙찰 광고 → 애드센스 → 프로모션 순서

interface Props {
  position: 'top' | 'middle' | 'bottom';
}

// 자체 프로모션 배너 — 앱 내 기능 홍보
const PROMO_BANNERS = [
  { headline: '거대 나무에 주장을 심어보세요', description: '당신의 목소리가 수백 명에게 전파됩니다', cta: '나무 심기', emoji: '🌳' },
  { headline: '땡스볼로 감사를 전하세요', description: '좋은 글에 볼을 보내면 작성자에게 힘이 됩니다', cta: '알아보기', emoji: '⚾' },
  { headline: '깐부를 맺고 소통하세요', description: '깐부의 글을 모아보고 깐부방에서 대화해요', cta: '깐부 찾기', emoji: '🤝' },
  { headline: '우리들의 장갑에서 소곤소곤', description: '관심사가 같은 사람들과 커뮤니티를 만들어요', cta: '장갑 보기', emoji: '🧤' },
];

const AdFallback = ({ position }: Props) => {
  // 슬롯 위치에 따라 다른 프로모션 표시 (고정적이지만 다양한 내용)
  const idx = position === 'top' ? 0 : position === 'middle' ? 1 : 2;
  const promo = PROMO_BANNERS[idx] || PROMO_BANNERS[0];

  return (
    <div className="w-full rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-3 flex items-center gap-3">
      <span className="text-[20px] shrink-0">{promo.emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-[1000] text-slate-600 truncate">{promo.headline}</p>
        <p className="text-[9px] font-bold text-slate-400 truncate">{promo.description}</p>
      </div>
      <span className="text-[9px] font-black text-slate-400 bg-white px-2 py-1 rounded-lg border border-slate-200 shrink-0">
        {promo.cta}
      </span>
    </div>
  );
};

export default AdFallback;
