// src/components/admin/AdAdminPage.tsx — 광고 관리자 페이지 (4탭)
// 🚀 광고 검수 + 정산 승인 + 부정행위 알림 + 세무 Export
import { useState } from 'react';
import type { UserData } from '../../types';
import { PLATFORM_ADMIN_NICKNAMES } from '../../constants';
import AdReviewQueue from './AdReviewQueue';
import SettlementQueue from './SettlementQueue';
import FraudAlerts from './FraudAlerts';
import TaxReportExport from './TaxReportExport';

interface Props {
  currentUser: UserData | null;
  onBack?: () => void;
}

type AdminTab = 'review' | 'settlement' | 'fraud' | 'tax';

const TABS: { id: AdminTab; label: string }[] = [
  { id: 'review',     label: '📋 광고 검수' },
  { id: 'settlement', label: '💰 정산' },
  { id: 'fraud',      label: '🚨 부정행위' },
  { id: 'tax',        label: '📊 세무' },
];

const AdAdminPage = ({ currentUser, onBack }: Props) => {
  const [tab, setTab] = useState<AdminTab>('review');

  // 🚀 관리자 권한 체크 — 닉네임 화이트리스트 (MVP)
  const isAdmin = !!currentUser && PLATFORM_ADMIN_NICKNAMES.includes(currentUser.nickname);

  if (!isAdmin) {
    return (
      <div className="w-full max-w-2xl mx-auto py-20 text-center">
        <p className="text-[40px] mb-3">🔒</p>
        <p className="text-[15px] font-[1000] text-slate-700 mb-1">접근 권한이 없습니다</p>
        <p className="text-[12px] font-bold text-slate-400">광고 관리자만 이용할 수 있어요</p>
        {onBack && (
          <button onClick={onBack} className="mt-4 px-4 py-2 rounded-lg text-[12px] font-bold text-slate-500 border border-slate-200 hover:bg-slate-50">
            ← 돌아가기
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="w-full max-w-[860px] mx-auto pb-20">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-[20px] font-[1000] text-slate-900">📢 광고 관리</h1>
        {onBack && (
          <button onClick={onBack} className="text-[11px] font-bold text-slate-400 hover:text-slate-600">← 돌아가기</button>
        )}
      </div>

      {/* 탭 바 */}
      <div className="flex gap-0 border-b border-slate-100 mb-4">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-[12px] font-[1000] transition-colors border-b-2 -mb-px ${
              tab === t.id ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 탭 콘텐츠 */}
      <div>
        {tab === 'review' && <AdReviewQueue />}
        {tab === 'settlement' && <SettlementQueue />}
        {tab === 'fraud' && <FraudAlerts />}
        {tab === 'tax' && <TaxReportExport />}
      </div>
    </div>
  );
};

export default AdAdminPage;
