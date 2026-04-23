// src/components/mypage/DeleteAccountFlow.tsx — 🗑️ Sprint 7.5 회원탈퇴 플로우 모달
//
// 🚀 기능명: DeleteAccountFlow
//   MyPage 계정관리 섹션에서 "회원탈퇴" 클릭 시 띄워지는 3단계 확인 모달.
//   ① 안내 → ② 사유 선택/기입 → ③ 최종 확인 (닉네임 타이핑) → requestAccountDeletion CF
//
// Why 3단계:
//   즉시 탈퇴 버튼은 실수 유발. 민감 액션은 반드시 타이핑 확인 단계 필요 (GDPR 베스트 프랙티스).
//   ballBalance 소각·작성글 익명화 등 영구 영향 안내 선 고지.

import { useState } from "react";
import { functions } from "../../firebase";
import { httpsCallable } from "firebase/functions";
import { ACCOUNT_DELETION_CONFIG } from "../../constants";

interface Props {
  nickname: string;
  ballBalance: number;
  onClose: () => void;
  onRequested: () => void;  // 성공 후 (로그아웃 등 후속 처리)
}

export default function DeleteAccountFlow({ nickname, ballBalance, onClose, onRequested }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [reason, setReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [typedNickname, setTypedNickname] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finalReason = reason === "기타" ? customReason.trim().slice(0, 200) : reason;

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      const req = httpsCallable(functions, "requestAccountDeletion");
      await req({ reason: finalReason });
      onRequested();
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message || "탈퇴 요청 중 오류가 발생했습니다.";
      setError(msg);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center px-6" onClick={onClose}>
      <div
        className="w-full max-w-[440px] bg-white rounded-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[16px] font-[1000] text-slate-900">회원탈퇴 ({step}/3)</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-[14px] font-bold">✕</button>
        </div>

        {step === 1 && (
          <>
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 mb-4">
              <p className="text-[12px] font-[1000] text-rose-700 mb-1.5">⚠️ 탈퇴 전 확인</p>
              <ul className="text-[11px] text-rose-700 font-bold space-y-1 list-disc list-inside leading-relaxed">
                <li>탈퇴 요청 후 <b>30일 유예기간</b>이 있습니다. 이 기간 내 재로그인하면 복구 가능</li>
                <li><b>보유 볼 {ballBalance.toLocaleString()}볼은 소각</b>됩니다 (환불 없음)</li>
                <li>작성한 글/댓글은 <b>"탈퇴한 유저"</b>로 표시되며 30일 후 영구 익명화</li>
                <li>깐부 관계는 30일 후 자동 해제</li>
                <li>휴대폰 번호는 재가입 차단을 위해 <b>해시 형태로 영구 보존</b></li>
              </ul>
            </div>
            <button
              onClick={() => setStep(2)}
              className="w-full h-11 rounded-xl bg-rose-600 text-white font-[1000] text-[13px] hover:bg-rose-700 shadow-sm mb-2"
            >
              이해했습니다, 계속 진행
            </button>
            <button
              onClick={onClose}
              className="w-full h-10 rounded-xl text-[12px] font-bold text-slate-500 hover:text-slate-700 border border-slate-200"
            >
              취소
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <p className="text-[12px] text-slate-600 font-bold mb-3">탈퇴하시는 이유를 알려주시면 서비스 개선에 도움이 됩니다 (선택).</p>
            <div className="space-y-2 mb-4">
              {ACCOUNT_DELETION_CONFIG.DELETION_REASONS.map((r) => (
                <label key={r} className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50">
                  <input
                    type="radio"
                    name="deletionReason"
                    value={r}
                    checked={reason === r}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-4 h-4 accent-rose-600 cursor-pointer"
                  />
                  <span className="text-[12px] font-bold text-slate-700">{r}</span>
                </label>
              ))}
              {reason === "기타" && (
                <textarea
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value.slice(0, 200))}
                  placeholder="자유롭게 작성해주세요 (최대 200자)"
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-[12px] font-bold text-slate-700 placeholder:text-slate-300 focus:outline-none focus:border-rose-500 resize-none"
                />
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setStep(1)}
                className="flex-1 h-11 rounded-xl text-[12px] font-bold text-slate-500 hover:text-slate-700 border border-slate-200"
              >
                이전
              </button>
              <button
                onClick={() => setStep(3)}
                className="flex-1 h-11 rounded-xl bg-rose-600 text-white font-[1000] text-[13px] hover:bg-rose-700 shadow-sm"
              >
                다음
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <p className="text-[12px] text-slate-600 font-bold mb-3 leading-relaxed">
              탈퇴를 확정하시려면 아래에 본인 닉네임을 정확히 입력해주세요.
            </p>
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 mb-3">
              <p className="text-[11px] text-slate-500 font-bold">확인할 닉네임</p>
              <p className="text-[14px] font-[1000] text-slate-900">{nickname}</p>
            </div>
            <input
              type="text"
              value={typedNickname}
              onChange={(e) => setTypedNickname(e.target.value)}
              placeholder="닉네임을 정확히 입력"
              className="w-full h-11 px-3 rounded-xl border border-slate-300 text-[13px] font-bold text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-rose-500 mb-4"
            />
            {error && (
              <div className="mb-3 px-3 py-2 bg-rose-50 border border-rose-200 rounded-xl">
                <p className="text-[11px] text-rose-600 font-bold leading-relaxed">{error}</p>
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setStep(2)}
                disabled={loading}
                className="flex-1 h-11 rounded-xl text-[12px] font-bold text-slate-500 hover:text-slate-700 border border-slate-200 disabled:opacity-50"
              >
                이전
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || typedNickname !== nickname}
                className={`flex-1 h-11 rounded-xl font-[1000] text-[13px] ${
                  !loading && typedNickname === nickname
                    ? "bg-rose-600 text-white hover:bg-rose-700 shadow-sm"
                    : "bg-slate-200 text-slate-400 cursor-not-allowed"
                }`}
              >
                {loading ? "요청 중..." : "탈퇴 요청"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
