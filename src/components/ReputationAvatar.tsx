// src/components/ReputationAvatar.tsx — 🏅 이중 링 아바타 (평판 + 레벨)
// REPUTATION_V2.md §6.4 — 바깥 링(평판 Tier) + 안쪽 링(레벨)
import type { UserData } from '../types';
import { getReputation, getReputationTier, getDisplayTier, getReputationRingColor, getLevelBorderColor, getTierLabel, calculateLevel } from '../utils';

interface Props {
  user: Pick<UserData, 'uid' | 'nickname' | 'level' | 'exp' | 'likes' | 'totalShares' | 'ballReceived' | 'reputationCached' | 'lastActiveAt' | 'abuseFlags' | 'grandfatheredPrestigeTier'> & { avatarUrl?: string };
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
  onClick?: () => void;
}

// 🚀 사이즈별 Tailwind 클래스 맵
const SIZE_MAP: Record<NonNullable<Props['size']>, string> = {
  sm: 'w-8 h-8',
  md: 'w-12 h-12',
  lg: 'w-20 h-20',
};

const ReputationAvatar = ({ user, size = 'md', showTooltip = true, onClick }: Props) => {
  // 🏅 평판·레벨 계산 — 캐시 우선, fallback으로 V2 공식
  const reputation = getReputation(user as UserData);
  const displayTier = getDisplayTier(user as UserData);
  const level = user.level ?? calculateLevel(user.exp || 0);
  const ringClass = getReputationRingColor(displayTier);
  const borderClass = getLevelBorderColor(level);

  const avatarUrl = user.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.nickname}`;
  const tooltip = showTooltip ? `평판: ${getTierLabel(displayTier)} (${reputation}점) · Lv.${level}` : undefined;

  return (
    <div
      className={`relative rounded-full ring-4 ${ringClass} ring-offset-2 ring-offset-white ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
      title={tooltip}
      aria-label={tooltip}
    >
      <div className={`${SIZE_MAP[size]} rounded-full border-2 ${borderClass} overflow-hidden bg-slate-100`}>
        <img src={avatarUrl} alt={user.nickname} className="w-full h-full object-cover" />
      </div>
    </div>
  );
};

export default ReputationAvatar;
// 검색어: ReputationAvatar
// getReputationTier는 컴포넌트 내부에서 직접 사용하지는 않지만 re-export 대비 import (Task ⑥ 전수 적용 시 활용)
void getReputationTier;
