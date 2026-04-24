// src/components/ReportStateBanner.tsx — 🚨 신고 상태 경고 배너 + 이의제기 (2026-04-24 Phase A/B)
// 상세뷰에서 reportState에 따라 상단 배너 표시. 작성자 본인이면 이의제기 버튼 노출
// hidden 상태는 App.tsx 피드 필터에서 제외되므로 여기 오지 않음 (단, 작성자 본인은 자기 글 여전히 보임)
// 검색어: ReportStateBanner

import { useState } from 'react';
import { functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';

type ReportState = 'review' | 'preview_warning' | 'hidden' | null | undefined;
type AppealStatus = 'none' | 'pending' | 'resolved' | undefined;

interface Props {
  reportState?: ReportState;
  reportCount?: number;
  dominantReason?: string;
  // 이의제기 관련 (작성자 본인일 때만 노출)
  targetType?: 'post' | 'comment' | 'community_post' | 'community_post_comment' | 'episode';
  targetId?: string;
  isAuthor?: boolean;
  appealStatus?: AppealStatus;
}

const REASON_LABEL: Record<string, string> = {
  spam_flooding: '스팸 · 도배',
  severe_abuse: '심한 욕설',
  life_threat: '생명 경시',
  discrimination: '인종·성 차별적 표현',
  unethical: '비윤리',
  anti_state: '반국가',
  obscene: '음란물',
  illegal_fraud_ad: '불법정보 · 사기 · 광고',
  other: '기타',
};

const ReportStateBanner = ({
  reportState, reportCount, dominantReason,
  targetType, targetId, isAuthor, appealStatus,
}: Props) => {
  const [dismissed, setDismissed] = useState(false);
  const [appealModalOpen, setAppealModalOpen] = useState(false);

  if (!reportState) return null;

  const reasonText = dominantReason ? REASON_LABEL[dominantReason] || dominantReason : null;
  const canAppeal = isAuthor && targetType && targetId && appealStatus !== 'pending';

  // ───────────────────────────────────────────
  // hidden 단계 — 작성자만 보이는 배너 (피드 필터로 일반 유저는 차단됨)
  // ───────────────────────────────────────────
  if (reportState === 'hidden') {
    return (
      <>
        <div className="mb-4 px-4 py-4 rounded-xl bg-slate-100 border-2 border-slate-400">
          <div className="flex items-start gap-2 mb-2">
            <span className="text-[18px]">🙈</span>
            <div className="flex-1">
              <p className="text-[12px] font-[1000] text-slate-800">이 글은 숨김 처리되었습니다</p>
              <p className="text-[10px] font-bold text-slate-600 mt-0.5">
                신고자 수 <strong>{reportCount || 0}명</strong>
                {reasonText ? <> · 주 사유 <strong>{reasonText}</strong></> : null}
                {' '}— 일반 사용자에게는 보이지 않습니다
              </p>
            </div>
          </div>
          {canAppeal && (
            <div className="mt-2 pt-2 border-t border-slate-300">
              <p className="text-[10px] font-bold text-slate-600 mb-1.5">부당하다고 생각되시면 이의제기하실 수 있습니다</p>
              <button onClick={() => setAppealModalOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-white text-[11px] font-[1000] hover:bg-slate-900 transition-colors">
                ⚡ 이의제기 제출
              </button>
            </div>
          )}
          {appealStatus === 'pending' && (
            <div className="mt-2 pt-2 border-t border-slate-300">
              <p className="text-[11px] font-[1000] text-amber-700">⏳ 이의제기 검토 중 — 관리자 우선 확인 예정</p>
            </div>
          )}
        </div>
        {appealModalOpen && (
          <AppealModal
            targetType={targetType!} targetId={targetId!}
            onClose={() => setAppealModalOpen(false)}
            onDone={() => setAppealModalOpen(false)} />
        )}
      </>
    );
  }

  // ───────────────────────────────────────────
  // review 단계 — 배지만 + 작성자 본인에겐 이의제기 버튼
  // ───────────────────────────────────────────
  if (reportState === 'review') {
    return (
      <>
        <div className="mb-4 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200">
          <div className="flex items-start gap-2">
            <span className="text-[16px]">⚠️</span>
            <div className="flex-1">
              <p className="text-[11px] font-[1000] text-amber-800">이 글은 여러 신고가 접수되어 검토 중입니다</p>
              <p className="text-[10px] font-bold text-amber-700 mt-0.5">
                신고자 수 {reportCount || 0}명{reasonText ? ` · 주 사유 ${reasonText}` : ''}
              </p>
            </div>
            {canAppeal && (
              <button onClick={() => setAppealModalOpen(true)}
                className="text-[10px] font-[1000] text-amber-800 bg-amber-100 hover:bg-amber-200 px-2 py-1 rounded transition-colors shrink-0">
                ⚡ 이의제기
              </button>
            )}
            {appealStatus === 'pending' && (
              <span className="text-[10px] font-[1000] text-amber-800 shrink-0">⏳ 이의제기 검토 중</span>
            )}
          </div>
        </div>
        {appealModalOpen && (
          <AppealModal
            targetType={targetType!} targetId={targetId!}
            onClose={() => setAppealModalOpen(false)}
            onDone={() => setAppealModalOpen(false)} />
        )}
      </>
    );
  }

  // ───────────────────────────────────────────
  // preview_warning 단계 — 본문 앞 경고 게이트
  // ───────────────────────────────────────────
  if (reportState === 'preview_warning' && !dismissed) {
    return (
      <>
        <div className="mb-4 px-4 py-5 rounded-xl bg-rose-50 border-2 border-rose-300 flex flex-col items-center text-center">
          <span className="text-[40px] mb-2">🚫</span>
          <p className="text-[13px] font-[1000] text-rose-800 mb-1">
            이 글은 다수의 신고를 받아 경고 대상입니다
          </p>
          <p className="text-[11px] font-bold text-rose-700 mb-3 leading-relaxed">
            신고자 수: <strong>{reportCount || 0}명</strong>
            {reasonText ? <> · 주 사유: <strong>{reasonText}</strong></> : null}
            <br />
            불쾌하거나 유해할 수 있으니 주의해서 열람해주세요.
          </p>
          <div className="flex gap-2 flex-wrap justify-center">
            <button onClick={() => setDismissed(true)}
              className="px-4 py-2 rounded-lg bg-rose-500 text-white text-[12px] font-[1000] hover:bg-rose-600 transition-colors">
              ▸ 계속 열람
            </button>
            {canAppeal && (
              <button onClick={() => setAppealModalOpen(true)}
                className="px-4 py-2 rounded-lg bg-white border border-rose-300 text-rose-700 text-[12px] font-[1000] hover:bg-rose-100 transition-colors">
                ⚡ 이의제기
              </button>
            )}
            {appealStatus === 'pending' && (
              <span className="px-4 py-2 text-[12px] font-[1000] text-amber-700">⏳ 이의제기 검토 중</span>
            )}
          </div>
        </div>
        {appealModalOpen && (
          <AppealModal
            targetType={targetType!} targetId={targetId!}
            onClose={() => setAppealModalOpen(false)}
            onDone={() => setAppealModalOpen(false)} />
        )}
      </>
    );
  }

  if (reportState === 'preview_warning' && dismissed) {
    return (
      <div className="mb-4 px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 flex items-start gap-2">
        <span className="text-[14px]">🚫</span>
        <p className="text-[11px] font-[1000] text-rose-700 flex-1">
          경고 대상 게시글 · 신고 {reportCount || 0}명
        </p>
        {canAppeal && (
          <button onClick={() => setAppealModalOpen(true)}
            className="text-[10px] font-[1000] text-rose-800 bg-rose-100 hover:bg-rose-200 px-2 py-0.5 rounded shrink-0">
            ⚡ 이의제기
          </button>
        )}
        {appealModalOpen && (
          <AppealModal
            targetType={targetType!} targetId={targetId!}
            onClose={() => setAppealModalOpen(false)}
            onDone={() => setAppealModalOpen(false)} />
        )}
      </div>
    );
  }

  return null;
};

// ═══════════════════════════════════════════════════════════════
// 이의제기 모달
// ═══════════════════════════════════════════════════════════════
interface AppealModalProps {
  targetType: NonNullable<Props['targetType']>;
  targetId: string;
  onClose: () => void;
  onDone: () => void;
}

const MAX_NOTE = 500;

const AppealModal = ({ targetType, targetId, onClose, onDone }: AppealModalProps) => {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const trimmed = note.trim();
    if (trimmed.length < 5) {
      alert('이의제기 사유를 5자 이상 입력해주세요.');
      return;
    }
    setBusy(true);
    try {
      const fn = httpsCallable(functions, 'submitContentAppeal');
      await fn({ targetType, targetId, note: trimmed });
      alert('⚡ 이의제기가 접수되었습니다.\n관리자 우선 검토 큐에 표시되며, 처리 결과는 알림으로 전달됩니다.');
      onDone();
    } catch (err) {
      console.error('[submitContentAppeal]', err);
      const msg = err instanceof Error ? err.message : '알 수 없는 오류';
      alert(`이의제기 실패: ${msg}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-[14px] font-[1000] text-slate-900">⚡ 이의제기</h2>
            <p className="text-[11px] text-slate-500 font-bold mt-0.5">신고 판정이 부당하다고 생각되는 이유를 적어주세요</p>
          </div>
          <button onClick={onClose} disabled={busy} className="text-slate-400 hover:text-slate-600 text-[14px] font-bold disabled:opacity-50">✕</button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, MAX_NOTE))}
            placeholder="예: 본 글은 특정 종교를 비방한 것이 아니라 개인 경험 공유입니다 (5자 이상 필수)"
            maxLength={MAX_NOTE} rows={5}
            className="w-full px-3 py-2 text-[12px] border border-slate-200 rounded-lg resize-none focus:outline-none focus:border-slate-400 font-medium text-slate-900 placeholder:text-slate-300" />
          <p className="text-[10px] font-bold text-slate-400 text-right">{note.length}/{MAX_NOTE}</p>
          <div className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
            <p className="text-[10px] font-bold text-slate-500 leading-relaxed">
              💡 이의제기는 관리자 우선 검토 큐에 표시됩니다. 처리 결과는 알림으로 전달되며, 관리자가 오탐으로 판단하면 글이 복구됩니다.
            </p>
          </div>
        </div>
        <div className="px-5 py-3 border-t border-slate-100 flex gap-2 justify-end">
          <button onClick={onClose} disabled={busy}
            className="px-4 py-2 rounded-lg text-[12px] font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-50">취소</button>
          <button onClick={submit} disabled={busy}
            className="px-4 py-2 rounded-lg text-[12px] font-[1000] text-white bg-slate-800 hover:bg-slate-900 disabled:opacity-50">
            {busy ? '접수 중...' : '이의제기 제출'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReportStateBanner;
