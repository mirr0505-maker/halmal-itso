// src/components/SeriesGrid.tsx — 마르지 않는 잉크병: 작품 목록 그리드
// 🖋️ Firestore series 컬렉션 onSnapshot 구독 + 장르 필터(클라이언트) + SeriesCard 그리드 렌더
import { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import type { Series, SeriesGenre } from '../types';
import SeriesCard from './SeriesCard';
import { GENRE_FILTER_OPTIONS } from '../utils/inkwell';

interface SeriesGridProps {
  onSelectSeries?: (seriesId: string) => void;
  onCreateSeries?: () => void;
}

const SeriesGrid = ({ onSelectSeries, onCreateSeries }: SeriesGridProps) => {
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);
  const [genreFilter, setGenreFilter] = useState<SeriesGenre | 'all'>('all');

  // 🔒 Firestore series 컬렉션 실시간 구독
  useEffect(() => {
    const q = query(collection(db, 'series'), orderBy('lastEpisodeAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Series));
        setSeriesList(list);
        setLoading(false);
      },
      (err) => {
        console.error('[SeriesGrid] 구독 실패:', err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  // 🚀 장르 필터링은 클라이언트 측에서 처리 (작품 수가 적을 때 충분 — 인덱스 추가 불필요)
  // 🖋️ Phase 4-D-2: status === 'deleted' 작품은 일반 목록에서 숨김 (작가도 마이페이지에서만 관리)
  const filtered = useMemo(() => {
    let result = seriesList.filter((s) => s.status !== 'deleted');
    if (genreFilter !== 'all') {
      result = result.filter((s) => s.genre === genreFilter);
    }
    return result;
  }, [seriesList, genreFilter]);

  return (
    <div className="w-full pb-20">
      {/* 상단: 장르 필터 + 작품 만들기 (장르 필터 끝, 만화 옆에 배치) */}
      <div className="flex items-center gap-1.5 px-1 pb-4 overflow-x-auto">
        {GENRE_FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            onClick={() => setGenreFilter(opt.key)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-[1000] transition-all ${
              genreFilter === opt.key
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >
            {opt.label}
          </button>
        ))}
        {/* 🖋️ 작품 만들기 — 장르 필터와 동일한 라인/사이즈 (만화 옆) */}
        {onCreateSeries && (
          <button
            onClick={onCreateSeries}
            className="shrink-0 px-3 py-1.5 rounded-full text-[11px] font-[1000] transition-all bg-blue-500 text-white hover:bg-blue-600 shadow-sm"
          >
            ✍️ 작품 만들기
          </button>
        )}
      </div>

      {/* 본문 영역: 로딩 / 빈 상태 / 그리드 */}
      {loading ? (
        <div className="py-40 text-center text-slate-400 font-bold text-sm italic">
          불러오는 중...
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <div className="text-5xl mb-3">📭</div>
          <p className="text-sm font-bold">
            {genreFilter === 'all'
              ? '아직 등록된 작품이 없어요'
              : '이 장르의 작품이 없어요'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3 px-1 py-1">
          {filtered.map((series) => (
            <SeriesCard
              key={series.id}
              series={series}
              onClick={(s) => {
                console.log('[SeriesGrid] 작품 클릭:', s.id);
                onSelectSeries?.(s.id);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default SeriesGrid;
