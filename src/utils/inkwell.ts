// src/utils/inkwell.ts — 마르지 않는 잉크병 공용 헬퍼 (장르 라벨/색상, 카운트 포맷)
import type { SeriesGenre } from '../types';

// 🚀 1000 이상 카운트는 "1.2k" 형식으로 축약
export function formatCount(n: number): string {
  if (typeof n !== 'number' || !isFinite(n)) return '0';
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

// 장르별 한국어 라벨
export const GENRE_LABEL: Record<SeriesGenre, string> = {
  novel: '소설',
  poem: '시',
  essay: '에세이',
  webtoon: '웹툰',
  comic: '만화',
};

// 장르별 뱃지 배경색 (Tailwind 클래스)
export const GENRE_COLOR: Record<SeriesGenre, string> = {
  novel: 'bg-purple-500',
  poem: 'bg-pink-500',
  essay: 'bg-emerald-500',
  webtoon: 'bg-blue-500',
  comic: 'bg-orange-500',
};

// 장르 필터 탭 옵션 ('all' 포함)
export const GENRE_FILTER_OPTIONS: Array<{ key: SeriesGenre | 'all'; label: string }> = [
  { key: 'all', label: '전체' },
  { key: 'novel', label: '소설' },
  { key: 'poem', label: '시' },
  { key: 'essay', label: '에세이' },
  { key: 'webtoon', label: '웹툰' },
  { key: 'comic', label: '만화' },
];
