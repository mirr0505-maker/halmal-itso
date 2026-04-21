// src/components/admin/AdAdminPage.tsx — 광고 관리자 페이지 (5탭)
// 🚀 플랫폼 수익 + 광고 검수 + 정산 승인 + 부정행위 알림 + 세무 Export
import { useState } from 'react';
import type { UserData } from '../../types';
import { PLATFORM_ADMIN_NICKNAMES } from '../../constants';
import { functions } from '../../firebase';
import { httpsCallable } from 'firebase/functions';
import PlatformRevenueDashboard from './PlatformRevenueDashboard';
import AdReviewQueue from './AdReviewQueue';
import SettlementQueue from './SettlementQueue';
import FraudAlerts from './FraudAlerts';
import TaxReportExport from './TaxReportExport';
import ExileManagement from './ExileManagement';
import AppealReview from './AppealReview';

interface Props {
  currentUser: UserData | null;
  onBack?: () => void;
}

type AdminTab = 'revenue' | 'review' | 'settlement' | 'fraud' | 'tax' | 'exile' | 'appeal' | 'system';

const TABS: { id: AdminTab; label: string }[] = [
  { id: 'revenue',    label: '💵 플랫폼 수익' },
  { id: 'review',     label: '📋 광고 검수' },
  { id: 'settlement', label: '💰 정산' },
  { id: 'fraud',      label: '🚨 부정행위' },
  { id: 'tax',        label: '📊 세무' },
  { id: 'exile',      label: '🏚️ 유배 관리' },
  { id: 'appeal',     label: '⚖️ 이의 제기' },
  { id: 'system',     label: '🔧 시스템' },
];

// 🔧 시스템 관리 패널 — 관리자 전용 운영 도구
//   seedReservedNicknames: reserved_nicknames 컬렉션에 9개 예약어 시드 (흑무영/Admin/admin/운영자 등)
//   Why: 콘솔 httpsCallable 접근이 번거로워 UI 버튼으로 편입
const SystemPanel = () => {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string>('');
  const [error, setError] = useState<string>('');

  const handleSeed = async () => {
    if (busy) return;
    setBusy(true); setResult(''); setError('');
    try {
      const call = httpsCallable(functions, 'seedReservedNicknames');
      const res = await call({});
      setResult(JSON.stringify(res.data, null, 2));
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      setError(`${err.code || 'error'} — ${err.message || String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="p-4 border border-slate-200 rounded-lg">
        <h3 className="text-[13px] font-[1000] text-slate-800 mb-1">예약어 시드 (reserved_nicknames)</h3>
        <p className="text-[11px] font-bold text-slate-500 mb-3">
          흑무영·Admin·admin·운영자·관리자·claude·system·bot·전령 — 9개를 예약어 컬렉션에 주입합니다. 이미 존재하면 merge.
        </p>
        <button onClick={handleSeed} disabled={busy}
          className="px-3 py-1.5 rounded-md text-[12px] font-bold text-white bg-slate-800 hover:bg-slate-700 disabled:opacity-50"
        >
          {busy ? '실행 중...' : '시드 실행'}
        </button>
        {result && (
          <pre className="mt-3 p-2 bg-slate-50 text-[11px] text-slate-700 rounded border border-slate-200 overflow-x-auto">{result}</pre>
        )}
        {error && (
          <p className="mt-3 p-2 bg-red-50 text-[11px] font-bold text-red-600 rounded border border-red-200">{error}</p>
        )}
      </div>
    </div>
  );
};

const AdAdminPage = ({ currentUser, onBack }: Props) => {
  const [tab, setTab] = useState<AdminTab>('revenue');

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
        {tab === 'revenue' && <PlatformRevenueDashboard />}
        {tab === 'review' && <AdReviewQueue />}
        {tab === 'settlement' && <SettlementQueue />}
        {tab === 'fraud' && <FraudAlerts />}
        {tab === 'tax' && <TaxReportExport />}
        {tab === 'exile' && <ExileManagement />}
        {tab === 'appeal' && <AppealReview />}
        {tab === 'system' && <SystemPanel />}
      </div>
    </div>
  );
};

export default AdAdminPage;
