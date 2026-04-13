// src/components/admin/PlatformRevenueDashboard.tsx — 플랫폼 수익 현황
// platform_revenue 컬렉션의 inkwell, market, glove_bot 문서 조회
import { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { formatKoreanNumber } from '../../utils';

interface RevenueDoc {
  totalFee: number;
  totalGross?: number;
  lastUpdatedAt?: unknown;
}

const PlatformRevenueDashboard = () => {
  const [inkwell, setInkwell] = useState<RevenueDoc | null>(null);
  const [market, setMarket] = useState<RevenueDoc | null>(null);
  const [gloveBot, setGloveBot] = useState<RevenueDoc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getDoc(doc(db, 'platform_revenue', 'inkwell')),
      getDoc(doc(db, 'platform_revenue', 'market')),
      getDoc(doc(db, 'platform_revenue', 'glove_bot')),
    ]).then(([inkSnap, mktSnap, botSnap]) => {
      if (inkSnap.exists()) setInkwell(inkSnap.data() as RevenueDoc);
      if (mktSnap.exists()) setMarket(mktSnap.data() as RevenueDoc);
      if (botSnap.exists()) setGloveBot(botSnap.data() as RevenueDoc);
    }).catch(err => console.error('[PlatformRevenue]', err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="py-10 text-center text-slate-300 text-[12px] font-bold">불러오는 중...</div>;

  const inkFee = inkwell?.totalFee || 0;
  const mktFee = market?.totalFee || 0;
  const botFee = gloveBot?.totalFee || 0;
  const totalFee = inkFee + mktFee + botFee;

  const inkGross = inkwell?.totalGross || 0;
  const mktGross = market?.totalGross || 0;

  return (
    <div className="space-y-6">
      {/* 총합 카드 */}
      <div className="bg-slate-900 rounded-2xl p-6 text-center">
        <p className="text-[11px] font-bold text-slate-400 mb-1">플랫폼 총 수익</p>
        <p className="text-[32px] font-[1000] text-white">{formatKoreanNumber(totalFee)}</p>
        <p className="text-[11px] font-bold text-slate-500">땡스볼</p>
      </div>

      {/* 수익원별 카드 */}
      <div className="grid grid-cols-3 gap-3">
        {/* 잉크병 */}
        <div className="bg-white border border-slate-100 rounded-xl p-4">
          <p className="text-[10px] font-[1000] text-slate-400 mb-2">잉크병 (수수료 11%)</p>
          <p className="text-[20px] font-[1000] text-slate-900">{formatKoreanNumber(inkFee)}</p>
          <p className="text-[9px] font-bold text-slate-300 mt-1">총 거래: {formatKoreanNumber(inkGross)}볼</p>
        </div>

        {/* 강변 시장 */}
        <div className="bg-white border border-slate-100 rounded-xl p-4">
          <p className="text-[10px] font-[1000] text-slate-400 mb-2">강변 시장 (수수료 20~30%)</p>
          <p className="text-[20px] font-[1000] text-slate-900">{formatKoreanNumber(mktFee)}</p>
          <p className="text-[9px] font-bold text-slate-300 mt-1">총 거래: {formatKoreanNumber(mktGross)}볼</p>
        </div>

        {/* 정보봇 */}
        <div className="bg-white border border-slate-100 rounded-xl p-4">
          <p className="text-[10px] font-[1000] text-slate-400 mb-2">정보봇 (월 20볼 100%)</p>
          <p className="text-[20px] font-[1000] text-slate-900">{formatKoreanNumber(botFee)}</p>
          <p className="text-[9px] font-bold text-slate-300 mt-1">전액 플랫폼</p>
        </div>
      </div>

      {/* 수익 구조 요약 */}
      <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
        <p className="text-[11px] font-[1000] text-slate-600 mb-2">수익 구조</p>
        <div className="space-y-1.5 text-[10px] font-bold text-slate-500">
          <div className="flex justify-between">
            <span>잉크병 유료 회차 결제</span>
            <span>플랫폼 11% · 작가 89%</span>
          </div>
          <div className="flex justify-between">
            <span>강변 시장 가판대/단골장부</span>
            <span>플랫폼 20~30% (레벨별) · 크리에이터 70~80%</span>
          </div>
          <div className="flex justify-between">
            <span>강변 시장 광고 수익 쉐어</span>
            <span>플랫폼 30% · 크리에이터 70%</span>
          </div>
          <div className="flex justify-between">
            <span>정보봇 월간 이용료</span>
            <span>플랫폼 100% (20볼/월)</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlatformRevenueDashboard;
