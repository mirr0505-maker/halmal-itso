// src/components/revenue/RevenueDashboard.tsx — 수익 종합 대시보드 (MyPage 내 탭)
// 🚀 Phase 1: 스켈레톤 UI (pendingRevenue 표시)
// Phase 2+: 실제 수익 데이터 바인딩, 차트, 글별 상세
import { formatKoreanNumber } from '../../utils';
import { SETTLEMENT_MIN_AMOUNT } from '../../constants';

interface Props {
  pendingRevenue: number;       // 미정산 광고 수익
  pendingThanksBall: number;    // 미정산 땡스볼 수익
  totalSettled: number;         // 누적 정산 완료액
  userLevel: number;
}

const RevenueDashboard = ({ pendingRevenue, pendingThanksBall, totalSettled, userLevel }: Props) => {
  const total = pendingRevenue + pendingThanksBall;
  const canWithdraw = total >= SETTLEMENT_MIN_AMOUNT;

  return (
    <div className="flex flex-col gap-4">
      {/* 수익 요약 카드 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-violet-50 rounded-2xl p-4 border border-violet-100 text-center">
          <p className="text-[10px] font-black text-violet-400 uppercase tracking-widest mb-1">광고 수익</p>
          <p className="text-[18px] font-[1000] text-violet-700">₩{formatKoreanNumber(pendingRevenue)}</p>
        </div>
        <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100 text-center">
          <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-1">땡스볼</p>
          <p className="text-[18px] font-[1000] text-amber-600">₩{formatKoreanNumber(pendingThanksBall)}</p>
        </div>
        <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100 text-center">
          <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">합계</p>
          <p className="text-[18px] font-[1000] text-emerald-700">₩{formatKoreanNumber(total)}</p>
        </div>
      </div>

      {/* 레벨별 광고 슬롯 안내 */}
      {userLevel < 5 ? (
        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
          <p className="text-[12px] font-bold text-slate-500">
            Lv5 이상부터 광고 수익이 발생합니다. (현재 Lv{userLevel})
          </p>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 bg-slate-200 rounded-full h-1.5 overflow-hidden">
              <div className="h-full bg-violet-400 rounded-full" style={{ width: `${Math.min((userLevel / 5) * 100, 100)}%` }} />
            </div>
            <span className="text-[10px] font-bold text-slate-400">Lv{userLevel}/5</span>
          </div>
        </div>
      ) : (
        <div className="bg-violet-50 rounded-2xl p-4 border border-violet-100">
          <p className="text-[12px] font-bold text-violet-600">
            Lv{userLevel} — 광고 슬롯 {userLevel >= 9 ? 3 : userLevel >= 7 ? 2 : 1}개 활성, 수익 배분 {userLevel >= 9 ? '70%' : userLevel >= 7 ? '50%' : '30%'}
          </p>
        </div>
      )}

      {/* 출금 버튼 */}
      <div className="flex items-center justify-between bg-white rounded-2xl p-4 border border-slate-100">
        <div>
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">누적 정산 완료</p>
          <p className="text-[16px] font-[1000] text-slate-800">₩{formatKoreanNumber(totalSettled)}</p>
        </div>
        <button
          disabled={!canWithdraw}
          className={`px-5 py-2.5 rounded-xl text-[12px] font-[1000] transition-all ${
            canWithdraw
              ? 'bg-violet-600 text-white hover:bg-violet-700'
              : 'bg-slate-100 text-slate-300 cursor-not-allowed'
          }`}
        >
          {canWithdraw ? '출금 신청' : `₩${formatKoreanNumber(SETTLEMENT_MIN_AMOUNT)} 이상 출금 가능`}
        </button>
      </div>

      {/* 최근 7일 수익 추이 — Phase 2에서 구현 */}
      <div className="bg-white rounded-2xl p-4 border border-slate-100">
        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">최근 7일 수익 추이</p>
        <div className="py-8 text-center text-slate-300 font-bold text-[12px]">
          데이터 수집 중입니다. 곧 수익 차트가 표시됩니다.
        </div>
      </div>

      {/* 글별 수익 상세 — Phase 2에서 구현 */}
      <div className="bg-white rounded-2xl p-4 border border-slate-100">
        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">글별 수익 상세</p>
        <div className="py-8 text-center text-slate-300 font-bold text-[12px]">
          광고가 게재되면 글별 수익이 표시됩니다.
        </div>
      </div>
    </div>
  );
};

export default RevenueDashboard;
