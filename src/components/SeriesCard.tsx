// src/components/SeriesCard.tsx — 마르지 않는 잉크병: 작품 카드 1개
// 🖋️ 표지 + 장르 뱃지 + 완결 뱃지 + 제목 + 작가명 + 회차/조회수/유료 표시
import type { Series } from '../types';
import { formatCount, GENRE_LABEL, GENRE_COLOR } from '../utils/inkwell';

interface SeriesCardProps {
  series: Series;
  onClick?: (series: Series) => void;
}

const SeriesCard = ({ series, onClick }: SeriesCardProps) => {
  const handleClick = () => {
    if (onClick) onClick(series);
  };

  return (
    <div
      onClick={handleClick}
      className="rounded-xl overflow-hidden bg-white border border-slate-200 cursor-pointer hover:border-blue-400 hover:shadow-lg transition-all duration-200 group"
    >
      {/* 표지 영역 (3:4 세로형) */}
      <div className="relative w-full aspect-[3/4] bg-slate-100 overflow-hidden">
        <img
          src={series.coverImageUrl}
          alt={series.title}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
        />

        {/* 🚀 장르 뱃지 (좌상단) */}
        <span
          className={`absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-[1000] text-white shadow ${GENRE_COLOR[series.genre]}`}
        >
          {GENRE_LABEL[series.genre]}
        </span>

        {/* 🚀 완결 뱃지 (우상단) — isCompleted=true일 때만 */}
        {series.isCompleted && (
          <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md text-[10px] font-[1000] text-white bg-slate-600/90 shadow">
            완결
          </span>
        )}
      </div>

      {/* 본문 영역 */}
      <div className="px-3 py-2">
        {/* 제목 — 2줄 ellipsis */}
        <h3 className="text-[13px] font-[1000] text-slate-900 line-clamp-2 leading-tight tracking-tight group-hover:text-blue-600 transition-colors">
          {series.title}
        </h3>

        {/* 작가명 */}
        <p className="text-[10px] text-slate-500 mt-0.5 truncate font-bold">
          {series.authorNickname}
        </p>

        {/* 메타 정보: 회차수 · 조회수 · 유료 */}
        <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-slate-400 font-bold">
          <span>📖 {formatCount(series.totalEpisodes || 0)}화</span>
          <span className="text-slate-300">·</span>
          <span>👁 {formatCount(series.totalViews || 0)}</span>
          {/* 🚀 유료 뱃지 — defaultPrice가 명확히 0 초과일 때만 (undefined·0 모두 무료 처리) */}
          {(series.defaultPrice ?? 0) > 0 && (
            <>
              <span className="text-slate-300">·</span>
              <span className="text-amber-600">🏀 유료</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SeriesCard;
