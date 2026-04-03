// src/components/ActivityStats.tsx
import type { UserData } from '../types';
import { getReputationLabel, getReputationScore } from '../utils';

// 통계 항목 내부 타입 — 선택적 플래그로 스타일 분기
interface StatItem {
  label: string;
  value: string | number;
  emoji?: string;
  isHighlight?: boolean;
  isUnderline?: boolean;
  isReceived?: boolean;
  isThanksball?: boolean;
  isGlove?: boolean;
  isGlovePost?: boolean;
}

interface ActivityStatsProps {
  userData: UserData;
  rootCount: number;
  totalThanksball?: number;
  joinedGloveCount?: number;  // 🚀 가입한 커뮤니티(장갑) 수
  glovePostCount?: number;    // 🚀 커뮤니티에 쓴 글 수
}

const ActivityStats = ({ userData, rootCount, totalThanksball = 0, joinedGloveCount = 0, glovePostCount = 0 }: ActivityStatsProps) => {
  const reputationLabel = getReputationLabel(getReputationScore(userData));
  const ballBalance = userData.ballBalance || 0;

  const statItems: StatItem[] = [
    { label: '레벨', value: userData.level, emoji: '🐥' },
    { label: '평판', value: reputationLabel, isHighlight: true },
    { label: '게시글', value: rootCount, isUnderline: true },
    { label: '활동지수', value: userData.likes || 0, isUnderline: true },
    { label: '보유볼', value: `⚾ ${ballBalance}볼`, isThanksball: true },
    ...(totalThanksball > 0 ? [{ label: '받은볼', value: `⚾ ${totalThanksball}볼`, isReceived: true }] : []),
    ...(joinedGloveCount > 0 ? [{ label: '가입장갑', value: `🧤 ${joinedGloveCount}개`, isGlove: true }] : []),
    ...(glovePostCount > 0 ? [{ label: '장갑글', value: `${glovePostCount}개`, isGlovePost: true }] : []),
  ];

  return (
    <div className="flex flex-wrap bg-slate-50/80 rounded-xl p-1 gap-1 items-center border border-slate-100 shadow-inner w-full md:w-fit">
      {statItems.map((item, idx) => (
        <div key={idx} className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-slate-100 shadow-sm transition-transform hover:scale-105">
          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{item.label}</span>
          <span className={`text-[12px] font-[1000] tracking-tight ${item.isReceived ? 'text-emerald-500' : item.isThanksball ? 'text-amber-500' : item.isGlove || item.isGlovePost ? 'text-teal-600' : item.isHighlight ? 'text-blue-600' : 'text-slate-900'} ${item.isUnderline ? 'underline decoration-blue-100 underline-offset-2' : ''}`}>
            {item.value}
          </span>
          {item.emoji && <span className="text-xs">{item.emoji}</span>}
        </div>
      ))}
    </div>
  );
};

export default ActivityStats;
