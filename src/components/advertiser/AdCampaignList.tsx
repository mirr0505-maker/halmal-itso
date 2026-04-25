// src/components/advertiser/AdCampaignList.tsx — 내 광고 목록
import type { Ad } from '../../types';
import { formatKoreanNumber } from '../../utils';

interface Props {
  ads: Ad[];
  onCreateNew: () => void;
  onEdit: (ad: Ad) => void;  // 🚀 2026-04-25: 광고 수정 진입
  onToggleStatus: (ad: Ad, newStatus: 'active' | 'paused') => void;  // 🚀 2026-04-25: 일시정지/재개
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

const AdCampaignList = ({ ads, onCreateNew, onEdit, onToggleStatus }: Props) => {
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
    <div className="flex flex-col gap-3">
      {ads.map(ad => {
        const st = STATUS_LABEL[ad.status] || STATUS_LABEL.draft;
        return (
          <div key={ad.id} className="bg-white rounded-2xl border border-slate-100 p-4 hover:shadow-sm transition-all">
            <div className="flex items-start justify-between mb-2">
              <div className="min-w-0 flex-1">
                <h4 className="text-[14px] font-[1000] text-slate-900 truncate">{ad.title}</h4>
                <p className="text-[11px] font-bold text-slate-400">{ad.headline}</p>
              </div>
              <span className={`text-[9px] font-black px-2 py-0.5 rounded-md border shrink-0 ml-2 ${st.cls}`}>{st.label}</span>
            </div>
            <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400 flex-wrap">
              <span>노출 {formatKoreanNumber(ad.totalImpressions)}</span>
              <span>클릭 {formatKoreanNumber(ad.totalClicks)}</span>
              <span>CTR {(ad.ctr * 100).toFixed(2)}%</span>
              <span>소진 ⚾ {formatKoreanNumber(ad.totalSpent)}</span>
              <span className="ml-auto">{ad.bidType.toUpperCase()} ⚾ {formatKoreanNumber(ad.bidAmount)}</span>
            </div>
            {/* 🚀 2026-04-25: 광고주 액션 — 수정 + 일시정지/재개 */}
            <div className="mt-2 flex justify-end gap-1.5">
              {ad.status === 'active' && (
                <button onClick={() => onToggleStatus(ad, 'paused')}
                  className="text-[10px] font-[1000] text-amber-600 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-md border border-amber-100">
                  ⏸ 일시정지
                </button>
              )}
              {ad.status === 'paused' && (
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
  );
};

export default AdCampaignList;
