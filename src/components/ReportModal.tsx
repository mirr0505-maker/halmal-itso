// src/components/ReportModal.tsx — 🚨 신고 사유 선택 모달 (2026-04-24 Phase 1)
// window.prompt 대신 카테고리 라디오 + 상세 텍스트 에리어. 제출 후 localStorage에 `hiddenByMe` 추가.
// 검색어: ReportModal

import { useState } from 'react';

// 🚨 2026-04-24 카테고리 9종 개편 (커뮤니티 가이드라인 실제 표현에 맞춤)
// 기타 선택 시에만 50자 사유 입력 노출. 나머지 8개는 라디오 선택만
export type ReportReasonKey =
  | 'spam_flooding'
  | 'severe_abuse'
  | 'life_threat'
  | 'discrimination'
  | 'unethical'
  | 'anti_state'
  | 'obscene'
  | 'illegal_fraud_ad'
  | 'other';

// 🔒 클라·서버 동기화 — functions/reportSubmit.js ALLOWED_REASON_KEYS와 동일
export const REPORT_REASON_META: Record<ReportReasonKey, { label: string; emoji: string }> = {
  spam_flooding: { label: '스팸 · 도배', emoji: '📢' },
  severe_abuse: { label: '심한 욕설', emoji: '🤬' },
  life_threat: { label: '생명 경시', emoji: '💀' },
  discrimination: { label: '인종·성 차별적 표현', emoji: '🚷' },
  unethical: { label: '비윤리', emoji: '⚖️' },
  anti_state: { label: '반국가', emoji: '🏛️' },
  obscene: { label: '음란물', emoji: '🔞' },
  illegal_fraud_ad: { label: '불법정보 · 사기 · 광고', emoji: '💸' },
  other: { label: '기타', emoji: '📝' },
};

// 🔒 기타 선택 시 사유 입력 최대 길이 (서버 reportSubmit.js OTHER_DETAIL_MAX_LENGTH와 동기화)
export const OTHER_DETAIL_MAX = 50;

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (reasonKey: ReportReasonKey, detail: string) => Promise<void>;
}

const ReportModal = ({ open, onClose, onSubmit }: Props) => {
  const [reasonKey, setReasonKey] = useState<ReportReasonKey>('spam_flooding');
  const [detail, setDetail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const isOther = reasonKey === 'other';
  const detailRequired = isOther && detail.trim().length === 0;

  const handleSubmit = async () => {
    if (detailRequired) return; // '기타' 선택 시 사유 필수
    setSubmitting(true);
    try {
      const finalDetail = isOther ? detail.trim().slice(0, OTHER_DETAIL_MAX) : '';
      await onSubmit(reasonKey, finalDetail);
      // 성공 후 초기화 + 닫기는 호출자가 처리
      setReasonKey('spam_flooding');
      setDetail('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center px-4 animate-in fade-in">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-[15px] font-[1000] text-slate-900">🚨 신고하기</h2>
            <p className="text-[11px] text-slate-500 font-bold mt-0.5">커뮤니티 가이드라인 위반을 알려주세요</p>
          </div>
          <button onClick={onClose} disabled={submitting}
            className="text-slate-400 hover:text-slate-600 text-[14px] font-bold disabled:opacity-50">
            ✕
          </button>
        </div>

        <div className="px-5 py-4 space-y-3 max-h-[60vh] overflow-y-auto">
          <div>
            <p className="text-[11px] font-[1000] text-slate-700 mb-2">신고 사유를 선택해주세요</p>
            <div className="space-y-1.5">
              {(Object.keys(REPORT_REASON_META) as ReportReasonKey[]).map((key) => {
                const meta = REPORT_REASON_META[key];
                const selected = reasonKey === key;
                return (
                  <label key={key}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                      selected ? 'bg-rose-50 border border-rose-200' : 'bg-slate-50 border border-slate-100 hover:bg-slate-100'
                    }`}>
                    <input type="radio" name="reportReason" checked={selected}
                      onChange={() => setReasonKey(key)}
                      className="w-3.5 h-3.5 accent-rose-500 cursor-pointer" />
                    <span className="text-[12px]">{meta.emoji}</span>
                    <span className={`text-[12px] ${selected ? 'font-[1000] text-rose-700' : 'font-bold text-slate-700'}`}>
                      {meta.label}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* 🚨 2026-04-24: "기타" 선택 시에만 사유 입력 필드 노출 (50자 필수) */}
          {isOther && (
            <div>
              <p className="text-[11px] font-[1000] text-slate-700 mb-1.5">
                기타 사유 <span className="text-rose-500">*</span> <span className="text-slate-400 font-bold">({OTHER_DETAIL_MAX}자 이내 필수)</span>
              </p>
              <textarea value={detail} onChange={(e) => setDetail(e.target.value.slice(0, OTHER_DETAIL_MAX))}
                placeholder="신고 사유를 간단히 적어주세요"
                maxLength={OTHER_DETAIL_MAX} rows={2}
                className="w-full px-3 py-2 text-[12px] border border-slate-200 rounded-lg resize-none focus:outline-none focus:border-rose-300 font-medium text-slate-900 placeholder:text-slate-300" />
              <p className="text-[10px] font-bold text-slate-400 mt-0.5 text-right">{detail.length}/{OTHER_DETAIL_MAX}</p>
            </div>
          )}

          <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            <p className="text-[10px] font-bold text-amber-700 leading-relaxed">
              💡 접수 즉시 해당 글은 <strong>내 화면에서 가려집니다</strong>. 운영진 검토 후 조치 결과가 알림으로 전달됩니다.
            </p>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-slate-100 flex gap-2 justify-end">
          <button onClick={onClose} disabled={submitting}
            className="px-4 py-2 rounded-lg text-[12px] font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-50 transition-colors">
            취소
          </button>
          <button onClick={handleSubmit} disabled={submitting || detailRequired}
            title={detailRequired ? '기타 사유를 입력해주세요' : ''}
            className="px-4 py-2 rounded-lg text-[12px] font-[1000] text-white bg-rose-500 hover:bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {submitting ? '접수 중...' : '신고 제출'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReportModal;
