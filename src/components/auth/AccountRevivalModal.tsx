// src/components/auth/AccountRevivalModal.tsx — 🗑️ Sprint 7.5 탈퇴 유예기간 복구 모달
//
// 🚀 기능명: AccountRevivalModal
//   users.isDeleted === true 상태에서 로그인한 유저에게 전체 화면으로 노출.
//   30일 유예기간 내에는 cancelAccountDeletion CF로 복구 가능.
//   복구를 원치 않으면 즉시 로그아웃 → 30일 뒤 purgeDeletedAccounts가 hard delete.
//
// Why 전체 화면 모달:
//   탈퇴된 상태에서 정상 UI 노출은 데이터 정합성 오해 유발 (친구·글 이미 익명화 예정).
//   선택을 강제하는 게이트로 처리.
//
// 플로우:
//   1. 유저가 로그인 → App.tsx가 userData.isDeleted=true 감지 → 이 모달 노출
//   2. [계정 복구] → cancelAccountDeletion → isDeleted=false → 모달 언마운트
//   3. [그냥 나가기] → 로그아웃 → 30일 뒤 hard delete

import { useState } from "react";
import { functions } from "../../firebase";
import { httpsCallable } from "firebase/functions";

interface Props {
  deletedAtMillis: number | null;   // users.deletedAt → Date.getTime()
  onLogout: () => void;
}

const GRACE_PERIOD_DAYS = 30;

export default function AccountRevivalModal({ deletedAtMillis, onLogout }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const graceEndsAt = deletedAtMillis ? new Date(deletedAtMillis + GRACE_PERIOD_DAYS * 24 * 3600 * 1000) : null;
  const daysLeft = graceEndsAt ? Math.max(0, Math.ceil((graceEndsAt.getTime() - Date.now()) / (24 * 3600 * 1000))) : GRACE_PERIOD_DAYS;

  const handleRevive = async () => {
    setLoading(true);
    setError(null);
    try {
      const cancel = httpsCallable(functions, "cancelAccountDeletion");
      await cancel({});
      // onSnapshot이 isDeleted=false 감지 → 이 모달 자동 언마운트
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message || "계정 복구 중 오류가 발생했습니다.";
      setError(msg);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center px-6">
      <div className="w-full max-w-[420px] bg-white rounded-2xl shadow-2xl p-6">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-[20px]">⏳</div>
          <h2 className="text-[18px] font-[1000] text-slate-900">탈퇴 예정 계정입니다</h2>
        </div>
        <p className="text-[12px] text-slate-600 font-bold leading-relaxed mb-4">
          탈퇴 요청 후 <b className="text-amber-600">{GRACE_PERIOD_DAYS}일 유예기간</b> 중이에요.
          지금 바로 복구하거나, 그대로 두시면 <b>{daysLeft}일 뒤</b> 모든 데이터가 영구 삭제됩니다.
        </p>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-4">
          <p className="text-[10px] font-[1000] text-slate-500 mb-1.5">💡 알아두세요</p>
          <ul className="text-[10px] text-slate-600 font-bold space-y-0.5 list-disc list-inside leading-relaxed">
            <li>복구 시 기존 닉네임·깐부·글·볼 잔액 모두 그대로</li>
            <li>삭제 후에는 작성한 글/댓글이 "탈퇴한 유저"로 표시</li>
            <li>복구 후 재탈퇴해도 새 유예기간이 다시 시작</li>
          </ul>
        </div>

        {error && (
          <div className="mb-4 px-3 py-2 bg-rose-50 border border-rose-200 rounded-xl">
            <p className="text-[11px] text-rose-600 font-bold leading-relaxed">{error}</p>
          </div>
        )}

        <button
          onClick={handleRevive}
          disabled={loading}
          className={`w-full h-12 rounded-xl font-[1000] text-[13px] transition-all mb-2 ${
            loading
              ? "bg-slate-200 text-slate-400 cursor-not-allowed"
              : "bg-violet-600 text-white hover:bg-violet-700 shadow-sm"
          }`}
        >
          {loading ? "복구 중..." : "계정 복구하기"}
        </button>
        <button
          onClick={onLogout}
          className="w-full h-11 rounded-xl text-[12px] font-bold text-slate-500 hover:text-slate-700 border border-slate-200 hover:bg-slate-50"
        >
          그냥 나가기 (유예기간 계속)
        </button>
      </div>
    </div>
  );
}
