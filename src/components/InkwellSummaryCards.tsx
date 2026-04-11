// src/components/InkwellSummaryCards.tsx — 마르지 않는 잉크병: 작가 KPI 요약 카드
// 🖋️ 데이터는 부모가 props로 전달, 단순 렌더링만 (집계 로직 없음)
import { formatCount } from '../utils/inkwell';

interface InkwellSummaryCardsProps {
  totalSeries: number;
  totalEpisodes: number;
  totalSubscribers: number;
  totalViews: number;
  totalLikes: number;
  totalRevenue: number;
  variant?: 'compact' | 'full';
}

const InkwellSummaryCards = ({
  totalSeries,
  totalEpisodes,
  totalSubscribers,
  totalViews,
  totalLikes,
  totalRevenue,
  variant = 'full',
}: InkwellSummaryCardsProps) => {
  const cards = [
    { key: 'series',      icon: '📚', label: '작품',      value: totalSeries,      unit: '개' },
    { key: 'episodes',    icon: '📖', label: '회차',      value: totalEpisodes,    unit: '화' },
    { key: 'subscribers', icon: '👥', label: '구독자',    value: totalSubscribers, unit: '명' },
    { key: 'views',       icon: '👁', label: '조회수',    value: totalViews,       unit: '회' },
    { key: 'likes',       icon: '❤️', label: '좋아요',    value: totalLikes,       unit: '개' },
    { key: 'revenue',     icon: '🏀', label: '받은 응원', value: totalRevenue,     unit: '볼' },
  ];

  // compact 모드: 작품/회차/구독자/받은 응원 4개만
  const visibleCards = variant === 'compact'
    ? cards.filter((c) => ['series', 'episodes', 'subscribers', 'revenue'].includes(c.key))
    : cards;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-4">
      {visibleCards.map((card) => (
        <div
          key={card.key}
          className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 hover:border-slate-300 transition-colors"
        >
          <div className="flex items-center gap-1 mb-0.5">
            <span className="text-[11px]">{card.icon}</span>
            <span className="text-[10px] text-slate-500 font-bold">{card.label}</span>
          </div>
          <div className="text-[13px] font-[1000] text-slate-900">
            {formatCount(card.value)}
            <span className="text-[10px] font-bold text-slate-400 ml-0.5">{card.unit}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default InkwellSummaryCards;
