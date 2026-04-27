// src/components/admin/AdAdminPage.tsx — 관리자 통합 페이지 (8탭)
// 🚀 플랫폼 수익 + 광고 검수 + 정산 + 부정행위 + 세무 + 유배 + 이의제기 + 시스템
// 포맷: 강변시장(MarketHomeView) 스티키 # 헤더 + pill 탭 스타일 통일
import { useState } from 'react';
import type { UserData } from '../../types';
import PlatformRevenueDashboard from './PlatformRevenueDashboard';
import AdReviewQueue from './AdReviewQueue';
import AdvertiserReviewQueue from './AdvertiserReviewQueue';
import SettlementQueue from './SettlementQueue';
import FraudAlerts from './FraudAlerts';
import TaxReportExport from './TaxReportExport';
import ExileManagement from './ExileManagement';
import AppealReview from './AppealReview';
import SystemPanel from './SystemPanel';
import ReportManagement from './ReportManagement';
// 🛡️ Sprint 6 A-1: Custom Claims + 닉네임 이중 체크 훅
import { useAdminAuth } from './AdminGuard';

interface Props {
  currentUser: UserData | null;
  onBack?: () => void;
}

type AdminTab = 'revenue' | 'advertiser_review' | 'review' | 'settlement' | 'fraud' | 'tax' | 'report' | 'exile' | 'appeal' | 'system';

const TABS: { id: AdminTab; label: string }[] = [
  { id: 'revenue',           label: '💵 플랫폼 수익' },
  { id: 'advertiser_review', label: '🏢 광고주 검수' },
  { id: 'review',            label: '📋 광고 검수' },
  { id: 'settlement', label: '💰 정산' },
  { id: 'fraud',      label: '🚨 부정행위' },
  { id: 'tax',        label: '📊 세무' },
  { id: 'report',     label: '🚨 신고 관리' },
  { id: 'exile',      label: '🏚️ 유배 관리' },
  { id: 'appeal',     label: '⚖️ 이의 제기' },
  { id: 'system',     label: '🔧 시스템' },
];

const AdAdminPage = ({ currentUser, onBack }: Props) => {
  const [tab, setTab] = useState<AdminTab>('revenue');

  // 🛡️ Sprint 6 A-1: Custom Claims OR 닉네임 화이트리스트 이중 체크
  const { loading, isAdmin } = useAdminAuth(currentUser);

  if (loading) {
    return (
      <div className="w-full max-w-2xl mx-auto py-20 text-center">
        <p className="text-[12px] font-bold text-slate-400">권한 확인 중...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="w-full max-w-2xl mx-auto py-20 text-center">
        <p className="text-[40px] mb-3">🔒</p>
        <p className="text-[15px] font-[1000] text-slate-700 mb-1">접근 권한이 없습니다</p>
        <p className="text-[12px] font-bold text-slate-400">관리자만 이용할 수 있어요</p>
        {onBack && (
          <button onClick={onBack} className="mt-4 px-4 py-2 rounded-lg text-[12px] font-bold text-slate-500 border border-slate-200 hover:bg-slate-50">
            ← 돌아가기
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="w-full pb-4 animate-in fade-in">
      {/* 헤더 — 강변시장/잉크병/장갑 패턴: sticky top-0, 전체 폭, # 접두 타이틀 */}
      <div className="sticky top-0 z-30 bg-[#F8FAFC]/80 backdrop-blur-md pt-2">
        <div className="flex items-center justify-between border-b border-slate-200 h-[44px] gap-3">
          {/* 좌: 타이틀 */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-slate-600 font-black text-[15px]">#</span>
            <h2 className="text-[14px] font-[1000] text-slate-900 tracking-tighter whitespace-nowrap">관리자</h2>
            <div className="w-px h-3 bg-slate-200 mx-1.5 hidden md:block" />
            <p className="text-[11px] font-bold text-slate-400 hidden md:block whitespace-nowrap">플랫폼 운영·수익·유배·감사 통합 관리</p>
          </div>
          {/* 우: 되돌아가기 */}
          {onBack && (
            <button onClick={onBack}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 text-[11px] font-[1000] whitespace-nowrap transition-all">
              ← 되돌아가기
            </button>
          )}
        </div>
      </div>

      {/* 탭 바 — 강변시장 pill 스타일. 8개라 헤더 하단 별도 줄 flex-wrap */}
      <div className="flex items-center gap-1.5 flex-wrap px-1 pt-3 pb-2">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all ${
              tab === t.id
                ? 'bg-blue-50 border-blue-200 text-blue-700'
                : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
            }`}>
            <span className="text-[12px] font-[1000] whitespace-nowrap">{t.label}</span>
          </button>
        ))}
      </div>

      {/* 탭 콘텐츠 */}
      <div className="mt-2">
        {tab === 'revenue' && <PlatformRevenueDashboard />}
        {tab === 'advertiser_review' && <AdvertiserReviewQueue />}
        {tab === 'review' && <AdReviewQueue />}
        {tab === 'settlement' && <SettlementQueue />}
        {tab === 'fraud' && <FraudAlerts />}
        {tab === 'tax' && <TaxReportExport />}
        {tab === 'report' && <ReportManagement />}
        {tab === 'exile' && <ExileManagement />}
        {tab === 'appeal' && <AppealReview />}
        {tab === 'system' && <SystemPanel />}
      </div>
    </div>
  );
};

export default AdAdminPage;
