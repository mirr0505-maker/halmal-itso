// src/components/JoinAnswersDisplay.tsx — 가입 신청 답변 구조화 표시 (Phase 6 Step 4A)
// 🚀 CommunityAdminPanel의 승인 대기 목록에서 joinAnswers를 보기 좋게 렌더링
import type { JoinAnswers } from '../types';
import { formatRegion } from '../data/regions';

interface Props {
  answers: JoinAnswers;
}

const JoinAnswersDisplay = ({ answers }: Props) => {
  const std = answers.standard;
  const custom = answers.custom;
  const hasStandard = std && (std.name || std.region?.sido || std.phone || std.email || std.shares);
  const hasCustom = custom && custom.length > 0;

  if (!hasStandard && !hasCustom) return null;

  const rowClass = "flex items-start gap-2 py-1.5";
  const labelClass = "text-[10px] font-[1000] text-slate-400 w-16 shrink-0 pt-0.5";
  const valueClass = "text-[11px] font-bold text-slate-700 break-all";

  return (
    <div className="mt-2 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
      {/* 표준 필드 */}
      {std?.name && (
        <div className={rowClass}>
          <span className={labelClass}>이름</span>
          <span className={valueClass}>{std.name}</span>
        </div>
      )}
      {std?.region?.sido && (
        <div className={rowClass}>
          <span className={labelClass}>지역</span>
          <span className={valueClass}>{formatRegion(std.region)}</span>
        </div>
      )}
      {std?.phone && (
        <div className={rowClass}>
          <span className={labelClass}>연락처</span>
          <span className={valueClass}>{std.phone}</span>
        </div>
      )}
      {std?.email && (
        <div className={rowClass}>
          <span className={labelClass}>이메일</span>
          <span className={valueClass}>{std.email}</span>
        </div>
      )}
      {std?.shares && std.shares.value > 0 && (
        <div className={rowClass}>
          <span className={labelClass}>보유수량</span>
          <span className={valueClass}>
            {std.shares.label ? `${std.shares.label} ` : ''}
            {(std.shares.value * parseInt(std.shares.unit, 10)).toLocaleString()}주
          </span>
        </div>
      )}

      {/* 커스텀 질문 */}
      {hasCustom && custom!.map((a, idx) => (
        <div key={a.questionId || idx} className={rowClass}>
          <span className={labelClass + " w-auto max-w-[80px] truncate"} title={a.question}>Q. {a.question}</span>
          <span className={valueClass}>{a.answer}</span>
        </div>
      ))}
    </div>
  );
};

export default JoinAnswersDisplay;
