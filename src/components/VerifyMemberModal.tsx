// src/components/VerifyMemberModal.tsx — 인증 부여 모달 (Phase 6 Step 4B)
// 🚀 라벨 입력 + 가입 답변 확인 + 미리보기 + 추천 라벨 칩
import { useState } from 'react';
import type { Community, CommunityMember } from '../types';
import JoinAnswersDisplay from './JoinAnswersDisplay';

interface Props {
  community: Community;
  member: CommunityMember;
  onClose: () => void;
  onConfirm: (label: string) => Promise<void>;
}

const LABEL_SUGGESTIONS = ['주주', '홀더', '거주민', '동문', '회원', '조합원'];

const VerifyMemberModal = ({ community: _community, member, onClose, onConfirm }: Props) => {
  const [label, setLabel] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const trimmed = label.trim();
    if (!trimmed) { alert('인증 라벨을 입력해주세요.'); return; }
    if (trimmed.length > 10) { alert('인증 라벨은 10자 이내로 입력해주세요.'); return; }
    setSubmitting(true);
    try {
      await onConfirm(trimmed);
      onClose();
    } catch (e) {
      console.error(e);
      alert('인증 부여 중 오류가 발생했습니다.');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="px-6 py-4 border-b border-slate-100 shrink-0">
          <h3 className="text-[15px] font-[1000] text-slate-900">🛡️ 인증 부여</h3>
          <p className="text-[11px] font-bold text-slate-400 mt-0.5">
            <strong>{member.nickname}</strong>님에게 인증 마킹을 부여합니다
          </p>
        </div>

        {/* 본문 — 스크롤 */}
        <div className="px-6 py-5 flex flex-col gap-4 overflow-y-auto flex-1">
          {/* 가입 답변 다시 보기 */}
          {member.joinAnswers && (
            <div>
              <p className="text-[10px] font-[1000] text-slate-400 uppercase tracking-widest mb-2">📋 가입 당시 답변</p>
              <JoinAnswersDisplay answers={member.joinAnswers} />
            </div>
          )}
          {!member.joinAnswers && member.joinMessage && (
            <div>
              <p className="text-[10px] font-[1000] text-slate-400 uppercase tracking-widest mb-2">📋 가입 메시지</p>
              <p className="text-[11px] font-bold text-slate-600 bg-slate-50 rounded-lg px-3 py-2">"{member.joinMessage}"</p>
            </div>
          )}

          {/* 라벨 입력 */}
          <div>
            <label className="text-[11px] font-black text-slate-500 block mb-1">
              인증 라벨 <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={10}
              placeholder="예: 주주, 홀더, 거주민"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] font-bold text-slate-900 outline-none focus:border-emerald-400 transition-colors placeholder:text-slate-300"
              autoFocus
            />
            <span className="text-[10px] font-bold text-slate-300 mt-0.5 block text-right">{label.length}/10</span>

            {/* 추천 라벨 칩 */}
            <div className="flex flex-wrap gap-1.5 mt-1">
              {LABEL_SUGGESTIONS.map(sug => (
                <button
                  key={sug}
                  type="button"
                  onClick={() => setLabel(sug)}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all ${
                    label === sug
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white text-slate-400 border-slate-200 hover:border-emerald-300'
                  }`}
                >
                  {sug}
                </button>
              ))}
            </div>
          </div>

          {/* 미리보기 */}
          {label.trim() && (
            <div className="bg-emerald-50/50 border border-emerald-100 rounded-lg px-3 py-2.5">
              <p className="text-[10px] font-bold text-slate-400 mb-1">미리보기</p>
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-bold text-slate-800">{member.nickname}</span>
                <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-[1000]">
                  🛡️ {label.trim()} 인증 (오늘)
                </span>
              </div>
            </div>
          )}
        </div>

        {/* 하단 버튼 */}
        <div className="px-6 py-4 flex gap-2 border-t border-slate-100 shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-[13px] font-bold text-slate-500 border border-slate-200 hover:bg-slate-50 transition-colors">취소</button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !label.trim()}
            className={`flex-1 py-2.5 rounded-xl text-[13px] font-bold transition-all ${
              submitting || !label.trim() ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-700'
            }`}
          >
            {submitting ? '처리 중...' : '🛡️ 인증 부여'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default VerifyMemberModal;
