import type { UserData } from '../types';
// src/components/ActivityMilestones.tsx
import { getReputationProgress, getReputationStyle, getLevelStyle, getReputationLabel, getReputation, calculateLevel } from '../utils';

interface ActivityMilestonesProps {
  userData: UserData;
  rootCount: number;
  formalCount: number;
  commentCount: number;
  totalThanksball?: number;
}

const ActivityMilestones = ({ userData, rootCount, formalCount, commentCount, totalThanksball = 0 }: ActivityMilestonesProps) => {
  // 🏅 평판 점수 — V2 공식 + 캐시 우선 (REPUTATION_V2.md §5.2.2)
  const repScore = getReputation(userData);
  const reputationLabel = getReputationLabel(repScore);
  const repProgress = getReputationProgress(repScore);
  const expProgress = userData.exp || 0;

  // 🚀 스타일 로직 연동
  const repStyleClass = getReputationStyle(repScore);
  const levelStyleClass = getLevelStyle(calculateLevel(userData?.exp || 0));

  return (
    <section className="mb-10">
      <h3 className="text-sm font-[1000] text-slate-900 tracking-tight mb-4 px-1">활동 마일스톤</h3>
      <div className="grid grid-cols-1 gap-4 items-stretch">
        
        {/* 🚀 경험치 & 평판 카드 */}
        <div className="bg-white rounded-2xl p-6 shadow-md border border-slate-50 flex flex-col gap-6 justify-center">
          
          {/* 경험치 영역 */}
          <div className="flex items-center gap-6">
            <div className={`w-12 h-16 ${levelStyleClass} rounded-lg flex items-center justify-center font-[1000] text-base shadow-lg relative overflow-hidden shrink-0`}>
              Lv {calculateLevel(userData?.exp || 0)}
              <div className="absolute -bottom-2 -right-2 w-6 h-6 bg-white/20 rotate-45" />
            </div>
            <div className="flex-1 flex flex-col gap-2">
              <div className="flex justify-between text-[10px] font-black text-slate-700 uppercase tracking-widest">
                <span>경험치</span>
                <span className="text-blue-600 font-bold">{expProgress.toLocaleString()}%</span>
              </div>
              <div className="h-2.5 w-full bg-slate-50 rounded-full overflow-hidden relative border border-slate-100 p-0.5">
                <div className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-1000 shadow-sm" style={{ width: `${expProgress}%` }} />
              </div>
            </div>
          </div>
          
          {/* 평판 영역 */}
          <div className="flex items-center gap-6">
            <div className={`w-12 h-10 ${repStyleClass} text-[11px] font-[1000] text-center flex items-center justify-center shrink-0 tracking-tight py-1.5 rounded-md border shadow-inner transition-all duration-500`}>
              {reputationLabel}
            </div>
            <div className="flex-1 flex flex-col gap-2">
              <div className="flex justify-between text-[10px] font-black text-slate-700 uppercase tracking-widest">
                <span>평판 진행도</span>
                <span className="text-emerald-500 font-bold">{Math.floor(repProgress).toLocaleString()}%</span>
              </div>
              <div className="h-2.5 w-full bg-slate-50 rounded-full overflow-hidden relative border border-slate-100 p-0.5">
                <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all duration-1000 shadow-sm" style={{ width: `${repProgress}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* 🚀 통계 요약 카드 */}
        <div className="bg-slate-900 rounded-2xl p-6 shadow-lg relative overflow-hidden text-white group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 rounded-full blur-3xl -mr-16 -mt-16" />
          <div className="flex flex-col justify-between h-full relative z-10">
            <div className="mb-4">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">기록 통계</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-[1000] tracking-tight">{rootCount}</span>
                <span className="text-[10px] font-black text-blue-500 uppercase font-sans">글 남김</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/10">
              <div>
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">토론 참여</span>
                <span className="text-sm font-[1000] tracking-tight">{formalCount + commentCount} 회</span>
              </div>
              <div className="text-right">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">총 활동 지수</span>
                <span className="text-sm font-[1000] tracking-tight">{(userData.likes || 0).toLocaleString()}</span>
              </div>
              {totalThanksball > 0 && (
                <div className="col-span-2 pt-3 border-t border-white/10">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">받은 땡스볼</span>
                  <span className="text-sm font-[1000] tracking-tight text-amber-400">⚾ {totalThanksball}볼</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ActivityMilestones;
