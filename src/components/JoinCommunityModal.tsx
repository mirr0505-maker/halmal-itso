// src/components/JoinCommunityModal.tsx — 장갑 가입 신청 폼 (Phase 6)
// 🚀 joinForm이 있으면 폼 빌더 모드, 없으면 레거시 모드 (단순 메시지)
import { useState } from 'react';
import type { Community, UserData, JoinAnswers, SharesUnit } from '../types';
import { REGIONS, getSigunguList } from '../data/regions';
import { validateJoinAnswers, STANDARD_FIELD_LABELS } from '../utils/joinForm';

interface Props {
  community: Community;
  currentUser: UserData;
  onClose: () => void;
  onSubmit: (answers?: JoinAnswers, joinMessage?: string) => Promise<void>;
}

const JoinCommunityModal = ({ community, currentUser: _currentUser, onClose, onSubmit }: Props) => {
  const [submitting, setSubmitting] = useState(false);
  // 레거시 모드 상태
  const [joinMessage, setJoinMessage] = useState('');
  // 폼 빌더 모드 상태
  const [answers, setAnswers] = useState<JoinAnswers>({ standard: {}, custom: [] });

  const jf = community.joinForm;
  const hasJoinForm = !!jf && (
    jf.standardFields.some(f => f.enabled) || jf.customQuestions.length > 0
  );

  // 🚀 표준 필드 답변 업데이트
  const updateStandard = (patch: Partial<NonNullable<JoinAnswers['standard']>>) => {
    setAnswers(prev => ({ ...prev, standard: { ...prev.standard, ...patch } }));
  };

  // 🚀 커스텀 질문 답변 업데이트
  const updateCustomAnswer = (questionId: string, question: string, answer: string) => {
    setAnswers(prev => {
      const existing = prev.custom ?? [];
      const idx = existing.findIndex(a => a.questionId === questionId);
      const next = [...existing];
      if (idx >= 0) {
        next[idx] = { ...next[idx], answer };
      } else {
        next.push({ questionId, question, answer });
      }
      return { ...prev, custom: next };
    });
  };

  const handleSubmit = async () => {
    if (submitting) return;

    if (!hasJoinForm) {
      // 레거시 모드
      if (!joinMessage.trim()) { alert('가입 인사말을 입력해주세요.'); return; }
      setSubmitting(true);
      try {
        await onSubmit(undefined, joinMessage.trim());
        onClose();
      } catch (e) {
        alert('가입 신청 중 오류가 발생했습니다.');
        console.error(e);
      } finally { setSubmitting(false); }
      return;
    }

    // 폼 빌더 모드 — 검증
    const result = validateJoinAnswers(jf!, answers);
    if (!result.valid) {
      alert(result.errors.join('\n'));
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(answers);
      onClose();
    } catch (e) {
      alert('가입 신청 중 오류가 발생했습니다.');
      console.error(e);
    } finally { setSubmitting(false); }
  };

  // 🚀 시/도 셀렉트 상태
  const selectedSido = answers.standard?.region?.sido ?? '';
  const sigunguOptions = getSigunguList(selectedSido);

  const labelClass = "text-[11px] font-black text-slate-500 block mb-1";
  const inputClass = "w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] font-bold text-slate-900 outline-none focus:border-blue-400 transition-colors placeholder:text-slate-300 placeholder:font-normal";
  const selectClass = "border border-slate-200 rounded-lg px-3 py-2 text-[13px] font-bold text-slate-900 outline-none focus:border-blue-400 bg-white";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h2 className="text-[15px] font-[1000] text-slate-900">🧤 {community.name}</h2>
            <p className="text-[11px] font-bold text-slate-400 mt-0.5">
              {hasJoinForm ? '대장이 요청한 정보를 입력해주세요' : '가입 인사말을 남겨주세요'}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-300 hover:text-slate-500 transition-colors text-[20px] leading-none">×</button>
        </div>

        {/* 본문 — 스크롤 가능 */}
        <div className="px-6 py-5 flex flex-col gap-4 overflow-y-auto flex-1">

          {/* ━━━ 레거시 모드 ━━━ */}
          {!hasJoinForm && (
            <div>
              <label className={labelClass}>
                {community.joinQuestion || '가입 인사말을 남겨주세요'}
              </label>
              <textarea
                rows={4}
                maxLength={200}
                placeholder="간단히 작성해주세요"
                value={joinMessage}
                onChange={(e) => setJoinMessage(e.target.value)}
                className={inputClass + " resize-none"}
              />
              <span className="text-[10px] font-bold text-slate-300 mt-0.5 block text-right">{joinMessage.length}/200</span>
            </div>
          )}

          {/* ━━━ 폼 빌더 모드: 표준 필드 ━━━ */}
          {hasJoinForm && jf!.standardFields.filter(f => f.enabled).map((field) => {
            const req = field.required;
            const star = req ? <span className="text-rose-500 ml-0.5">*</span> : null;

            // 이름
            if (field.key === 'name') return (
              <div key="name">
                <label className={labelClass}>{STANDARD_FIELD_LABELS.name}{star}</label>
                <input type="text" maxLength={50} placeholder="이름을 입력하세요"
                  value={answers.standard?.name ?? ''} onChange={(e) => updateStandard({ name: e.target.value })}
                  className={inputClass} />
              </div>
            );

            // 거주 지역
            if (field.key === 'region') return (
              <div key="region">
                <label className={labelClass}>{STANDARD_FIELD_LABELS.region}{star}</label>
                <div className="flex gap-2">
                  <select value={selectedSido}
                    onChange={(e) => updateStandard({ region: { sido: e.target.value, sigungu: '' } })}
                    className={selectClass + " flex-1"}
                  >
                    <option value="">시/도 선택</option>
                    {REGIONS.map(r => <option key={r.sido} value={r.sido}>{r.shortName}</option>)}
                  </select>
                  <select
                    value={answers.standard?.region?.sigungu ?? ''}
                    disabled={!selectedSido}
                    onChange={(e) => updateStandard({ region: { sido: selectedSido, sigungu: e.target.value } })}
                    className={selectClass + " flex-1 disabled:opacity-40"}
                  >
                    <option value="">시/군/구 선택</option>
                    {sigunguOptions.map(sg => <option key={sg} value={sg}>{sg}</option>)}
                  </select>
                </div>
              </div>
            );

            // 연락처
            if (field.key === 'phone') return (
              <div key="phone">
                <label className={labelClass}>{STANDARD_FIELD_LABELS.phone}{star}</label>
                <input type="tel" maxLength={15} placeholder="010-1234-5678"
                  value={answers.standard?.phone ?? ''} onChange={(e) => updateStandard({ phone: e.target.value })}
                  className={inputClass} />
              </div>
            );

            // 이메일
            if (field.key === 'email') return (
              <div key="email">
                <label className={labelClass}>{STANDARD_FIELD_LABELS.email}{star}</label>
                <input type="email" maxLength={100} placeholder="example@domain.com"
                  value={answers.standard?.email ?? ''} onChange={(e) => updateStandard({ email: e.target.value })}
                  className={inputClass} />
              </div>
            );

            // 보유 수량
            if (field.key === 'shares') {
              const unit = field.sharesUnit ?? '100';
              const sharesLabel = field.sharesLabel?.trim() || '주식';
              const multiplier = parseInt(unit, 10);
              const inputValue = answers.standard?.shares?.value ?? 0;
              const totalShares = inputValue * multiplier;

              return (
                <div key="shares">
                  <label className={labelClass}>{STANDARD_FIELD_LABELS.shares} ({sharesLabel}){star}</label>
                  <div className="flex items-center gap-2">
                    <input type="number" min={0} step={1}
                      value={inputValue || ''}
                      onChange={(e) => updateStandard({
                        shares: { value: parseInt(e.target.value, 10) || 0, unit: unit as SharesUnit, label: field.sharesLabel }
                      })}
                      className={inputClass + " w-28"} placeholder="0"
                    />
                    <span className="text-[12px] font-bold text-slate-400 shrink-0">
                      × {Number(unit).toLocaleString()}주 단위
                    </span>
                  </div>
                  {totalShares > 0 && (
                    <p className="text-[11px] font-bold text-blue-500 mt-1">
                      = 총 {totalShares.toLocaleString()}주
                    </p>
                  )}
                </div>
              );
            }

            return null;
          })}

          {/* ━━━ 폼 빌더 모드: 커스텀 질문 ━━━ */}
          {hasJoinForm && jf!.customQuestions.length > 0 && (
            <>
              <div className="border-t border-slate-100 pt-3">
                <p className="text-[9px] font-[1000] text-slate-400 uppercase tracking-widest mb-2">추가 질문</p>
              </div>
              {jf!.customQuestions.map((q) => {
                const existing = answers.custom?.find(a => a.questionId === q.id);
                const value = existing?.answer ?? '';
                const maxLen = q.maxLength ?? 200;
                const req = q.required;
                return (
                  <div key={q.id}>
                    <label className={labelClass}>
                      {q.label}{req && <span className="text-rose-500 ml-0.5">*</span>}
                    </label>
                    <textarea rows={3} maxLength={maxLen}
                      placeholder={q.placeholder || '답변을 입력하세요'}
                      value={value}
                      onChange={(e) => updateCustomAnswer(q.id, q.label, e.target.value)}
                      className={inputClass + " resize-none"}
                    />
                    <span className="text-[10px] font-bold text-slate-300 mt-0.5 block text-right">{value.length}/{maxLen}</span>
                  </div>
                );
              })}
            </>
          )}

          {/* 안내 문구 */}
          <div className="flex items-center gap-2 bg-amber-50/60 border border-amber-100 rounded-lg px-3 py-2">
            <span className="text-[13px]">⚠️</span>
            <p className="text-[10px] font-bold text-amber-600">신청 후 대장의 승인이 필요합니다</p>
          </div>
        </div>

        {/* 하단 버튼 */}
        <div className="px-6 py-4 flex gap-2 border-t border-slate-100 shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-[13px] font-bold text-slate-500 border border-slate-200 hover:bg-slate-50 transition-colors">취소</button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className={`flex-1 py-2.5 rounded-xl text-[13px] font-bold transition-all ${
              submitting ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {submitting ? '신청 중...' : '가입 신청하기'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default JoinCommunityModal;
