// src/components/ReportModalHost.tsx — 🚨 전역 신고 모달 호스트 (2026-04-24 Phase 1)
// App.tsx 루트에 1개 마운트. handleReport() 이벤트 감지 → ReportModal 오픈 → submitReportCall → 결과 alert
// 검색어: ReportModalHost

import { useEffect, useState } from 'react';
import ReportModal, { type ReportReasonKey } from './ReportModal';
import { subscribeReportRequests, submitReportCall, type ReportTargetType } from '../utils/reportHandler';

const ReportModalHost = () => {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<{ type: ReportTargetType; id: string } | null>(null);

  useEffect(() => {
    const unsub = subscribeReportRequests(({ targetType, targetId }) => {
      setTarget({ type: targetType, id: targetId });
      setOpen(true);
    });
    return unsub;
  }, []);

  const handleSubmit = async (reasonKey: ReportReasonKey, detail: string) => {
    if (!target) return;
    try {
      const res = await submitReportCall(target.type, target.id, reasonKey, detail);
      if (res.alreadyReported) {
        alert('이미 신고하신 내용입니다.');
      } else {
        alert('🚨 신고가 접수되었습니다.\n운영진 검토 후 조치 결과가 알림으로 전달됩니다.\n해당 글은 이 기기에서 숨겨집니다.');
      }
      setOpen(false);
      setTarget(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '알 수 없는 오류';
      alert(`신고 처리에 실패했습니다.\n${msg}`);
    }
  };

  return <ReportModal open={open} onClose={() => { setOpen(false); setTarget(null); }} onSubmit={handleSubmit} />;
};

export default ReportModalHost;
