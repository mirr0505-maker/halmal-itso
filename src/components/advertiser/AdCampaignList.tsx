// src/components/advertiser/AdCampaignList.tsx — 내 광고 목록
// 🚀 v2 (2026-04-26): 예산 게이지(P0-1) + 가시 노출률(P0-4) + [📊 통계] 진입(P0-3)
import { useState, lazy, Suspense } from 'react';
import type { Ad } from '../../types';
import { formatKoreanNumber } from '../../utils';

const AdStatsModal = lazy(() => import('./AdStatsModal'));

interface Props {
  ads: Ad[];
  onCreateNew: () => void;
  onEdit: (ad: Ad) => void;
  onToggleStatus: (ad: Ad, newStatus: 'active' | 'paused') => void;
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  draft: { label: '임시저장', cls: 'text-slate-500 bg-slate-50 border-slate-200' },
  pending_review: { label: '검수중', cls: 'text-amber-600 bg-amber-50 border-amber-200' },
  active: { label: '활성', cls: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  paused: { label: '일시정지', cls: 'text-amber-600 bg-amber-50 border-amber-200' },
  rejected: { label: '거절', cls: 'text-rose-600 bg-rose-50 border-rose-200' },
  completed: { label: '종료', cls: 'text-slate-400 bg-slate-50 border-slate-200' },
  exhausted: { label: '예산소진', cls: 'text-rose-500 bg-rose-50 border-rose-200' },
};

// 🚀 v2 P0-1: 예산 게이지 색상 — 80%↑ amber / 95%↑ rose
function gaugeColor(pct: number): string {
  if (pct >= 95) return 'bg-rose-500';
  if (pct >= 80) return 'bg-amber-500';
  return 'bg-emerald-500';
}

const AdCampaignList = ({ ads, onCreateNew, onEdit, onToggleStatus }: Props) => {
  const [statsAdId, setStatsAdId] = useState<string | null>(null);

  if (ads.length === 0) return (
    <div className="py-16 text-center">
      <p className="text-slate-300 font-[1000] text-[16px] mb-2">등록된 광고가 없습니다</p>
      <p className="text-slate-300 font-bold text-[12px] mb-4">첫 번째 광고를 만들어보세요!</p>
      <button onClick={onCreateNew} className="px-5 py-2.5 bg-violet-600 text-white rounded-xl text-[12px] font-[1000] hover:bg-violet-700 transition-colors">
        + 새 광고 등록
      </button>
    </div>
  );

  return (
    <>
      <div className="flex flex-col gap-3">
        {ads.map(ad => {
          const st = STATUS_LABEL[ad.status] || STATUS_LABEL.draft;
          const todaySpent = ad.todaySpent || 0;
          const totalSpent = ad.totalSpent || 0;
          const dailyPct = ad.dailyBudget ? Math.min(100, (todaySpent / ad.dailyBudget) * 100) : 0;
          const totalPct = ad.totalBudget ? Math.min(100, (totalSpent / ad.totalBudget) * 100) : 0;
          const viewableImps = ad.viewableImpressions || 0;
          const viewableRate = ad.totalImpressions > 0 ? ((viewableImps / ad.totalImpressions) * 100).toFixed(1) : '0.0';
          const isPausedByBudget = ad.status === 'paused' && ad.pausedReason === 'budget_daily';
          return (
            <div key={ad.id} className="bg-white rounded-2xl border border-slate-100 p-4 hover:shadow-sm transition-all">
              <div className="flex items-start justify-between mb-2">
                <div className="min-w-0 flex-1">
                  <h4 className="text-[14px] font-[1000] text-slate-900 truncate">{ad.title}</h4>
                  <p className="text-[11px] font-bold text-slate-400">{ad.headline}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-2">
                  {isPausedByBudget && (
                    <span className="text-[8px] font-[1000] text-amber-700 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded">📊 예산소진</span>
                  )}
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-md border ${st.cls}`}>{st.label}</span>
                </div>
              </div>

              {/* 🚀 v2 P0-1: 예산 게이지 (일/총) */}
              {(ad.dailyBudget > 0 || ad.totalBudget > 0) && (
                <div className="grid grid-cols-2 gap-3 mb-2">
                  <div>
                    <div className="flex items-center justify-between text-[9px] font-[1000] text-slate-500 mb-0.5">
                      <span>일예산 ⚾ {formatKoreanNumber(ad.dailyBudget)}</span>
                      <span className={dailyPct >= 80 ? 'text-amber-600' : 'text-slate-400'}>{Math.round(dailyPct)}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full ${gaugeColor(dailyPct)} transition-all`} style={{ width: `${dailyPct}%` }} />
                    </div>
                    <p className="text-[9px] font-bold text-slate-400 mt-0.5">{formatKoreanNumber(todaySpent)}볼 사용</p>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-[9px] font-[1000] text-slate-500 mb-0.5">
                      <span>총예산 ⚾ {formatKoreanNumber(ad.totalBudget)}</span>
                      <span className={totalPct >= 80 ? 'text-amber-600' : 'text-slate-400'}>{Math.round(totalPct)}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full ${gaugeColor(totalPct)} transition-all`} style={{ width: `${totalPct}%` }} />
                    </div>
                    <p className="text-[9px] font-bold text-slate-400 mt-0.5">{formatKoreanNumber(totalSpent)}볼 사용</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400 flex-wrap">
                <span>노출 {formatKoreanNumber(ad.totalImpressions)}</span>
                <span className="text-sky-600 font-[1000]">가시 {formatKoreanNumber(viewableImps)} ({viewableRate}%)</span>
                <span>클릭 {formatKoreanNumber(ad.totalClicks)}</span>
                <span>CTR {(ad.ctr * 100).toFixed(2)}%</span>
                <span className="ml-auto">{ad.bidType.toUpperCase()} ⚾ {formatKoreanNumber(ad.bidAmount)}</span>
              </div>

              <div className="mt-2 flex justify-end gap-1.5">
                <button onClick={() => setStatsAdId(ad.id)}
                  className="text-[10px] font-[1000] text-sky-600 bg-sky-50 hover:bg-sky-100 px-2.5 py-1 rounded-md border border-sky-100">
                  📊 통계
                </button>
                {ad.status === 'active' && (
                  <button onClick={() => onToggleStatus(ad, 'paused')}
                    className="text-[10px] font-[1000] text-amber-600 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-md border border-amber-100">
                    ⏸ 일시정지
                  </button>
                )}
                {ad.status === 'paused' && !isPausedByBudget && (
                  <button onClick={() => onToggleStatus(ad, 'active')}
                    className="text-[10px] font-[1000] text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-md border border-emerald-100">
                    ▶ 재개
                  </button>
                )}
                <button onClick={() => onEdit(ad)}
                  className="text-[10px] font-[1000] text-violet-600 bg-violet-50 hover:bg-violet-100 px-2.5 py-1 rounded-md border border-violet-100">
                  ✏️ 수정
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 🚀 v2 P0-3: 광고주 통계 대시보드 모달 */}
      {statsAdId && (
        <Suspense fallback={null}>
          <AdStatsModal adId={statsAdId} ad={ads.find(a => a.id === statsAdId)!} onClose={() => setStatsAdId(null)} />
        </Suspense>
      )}
    </>
  );
};

export default AdCampaignList;
