// src/components/MapaeBadge.tsx — 🏅 마패 배지 (Creator Score Tier)
// CREATOR_SCORE.md §마패 티어 경계 — 상세 뷰 전용 (feedback_reputation_avatar_scope 동일 규칙: 리스트·피드 금지)
import type { UserData } from '../types';
import { getMapaeTier, getMapaeLabel, getMapaeColor } from '../utils';

interface Props {
  user: Pick<UserData, 'creatorScoreCached' | 'creatorScoreTier'>;
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
}

// 🚀 사이즈별 Tailwind — ReputationAvatar와 톤 맞춤
const SIZE_MAP: Record<NonNullable<Props['size']>, { wrap: string; text: string }> = {
  sm: { wrap: 'px-2 py-0.5',   text: 'text-[10px]' },
  md: { wrap: 'px-2.5 py-1',   text: 'text-[11px]' },
  lg: { wrap: 'px-3 py-1.5',   text: 'text-[13px]' },
};

const MapaeBadge = ({ user, size = 'md', showTooltip = true }: Props) => {
  // 🏅 캐시 Tier 우선, 없으면 점수로 재계산
  const tier = user.creatorScoreTier ?? getMapaeTier(user.creatorScoreCached);
  if (!tier) return null; // 신규/저활동 유저는 조용히 숨김

  const color = getMapaeColor(tier);
  const label = getMapaeLabel(tier);
  const { wrap, text } = SIZE_MAP[size];
  const tooltip = showTooltip
    ? `크리에이터 점수 ${user.creatorScoreCached?.toFixed(2) ?? '—'} · ${label}`
    : undefined;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border font-[1000] ${color.bg} ${color.text} ${color.border} ${wrap} ${text}`}
      title={tooltip}
      aria-label={tooltip}
    >
      {label}
    </span>
  );
};

export default MapaeBadge;
