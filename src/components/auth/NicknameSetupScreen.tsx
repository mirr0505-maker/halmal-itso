// src/components/auth/NicknameSetupScreen.tsx — 🔰 Sprint 7.5 최초 닉네임 설정 게이트
//
// 🚀 기능명: NicknameSetupScreen
//   Google 로그인 + 휴대폰 인증을 마친 신규 유저에게 정식 닉네임을 받아내는 전체 화면.
//   Google displayName은 실명일 가능성이 높으므로 서비스 노출 전 반드시 별도 닉네임 확정.
//
// Why 서버 CF 재사용:
//   changeNickname CF에 "최초 1회 무료" 분기(nicknameSet !== true)를 추가해 한 곳에서 처리.
//   중복·예약어·정규식 검증, users/nickname_{new} 역조회 문서 생성을 모두 서버가 보장.
//
// 플로우:
//   1. 닉네임 입력 (2~10자, 한/영/숫자/_)
//   2. 실시간 길이·정규식 안내 (서버 검증은 제출 시)
//   3. [확정하기] → changeNickname CF (first-time free) → users.nicknameSet=true 마킹
//   4. onSnapshot이 nicknameSet=true 감지 → 게이트 자동 해제 → OnboardingReferralScreen

import { useState } from "react";
import { functions } from "../../firebase";
import { httpsCallable } from "firebase/functions";

interface Props {
  currentNickname: string;  // Google displayName 등 임시값
  onLogout: () => void;
}

const MIN_LEN = 2;
const MAX_LEN = 10;
const NICKNAME_REGEX = /^[가-힣a-zA-Z0-9_]+$/;

export default function NicknameSetupScreen({ currentNickname, onLogout }: Props) {
  const [nickname, setNickname] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 실시간 검증 — 제출 전 사용자 피드백
  const localValidation = (): string | null => {
    const trimmed = nickname.trim();
    if (trimmed.length === 0) return null;  // 아직 입력 중
    if (trimmed.length < MIN_LEN) return `${MIN_LEN}자 이상 입력해 주세요.`;
    if (trimmed.length > MAX_LEN) return `${MAX_LEN}자 이하로 입력해 주세요.`;
    if (!NICKNAME_REGEX.test(trimmed)) return "한글/영문/숫자/밑줄(_)만 사용할 수 있어요.";
    if (trimmed.startsWith("nickname_")) return "예약된 접두사입니다.";
    return null;
  };

  const hint = localValidation();
  const canSubmit = !loading && nickname.trim().length >= MIN_LEN && !hint;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      const change = httpsCallable(functions, "changeNickname");
      await change({ newNickname: nickname.trim() });
      // 서버에서 nicknameSet=true로 갱신되며 onSnapshot이 게이트 해제
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message || "닉네임 설정 중 오류가 발생했습니다.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-50 flex flex-col overflow-y-auto">
      <div className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-[420px]">
          <div className="flex justify-between items-center mb-6">
            <span className="text-[11px] font-[1000] text-slate-400 tracking-wider">STEP 2 / 3</span>
            <button onClick={onLogout} className="text-[11px] text-slate-400 hover:text-slate-600 font-bold">로그아웃</button>
          </div>

          <h2 className="text-[22px] font-[1000] text-slate-900 mb-2">닉네임을 정해볼까요?</h2>
          <p className="text-[12px] text-slate-500 font-bold leading-relaxed mb-6">
            서비스에서 사용할 닉네임입니다. 평생 1회만 변경할 수 있으니 신중하게 정해주세요.
          </p>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-4">
            <label className="block">
              <span className="text-[11px] font-[1000] text-slate-500 mb-1.5 block">닉네임</span>
              <input
                type="text"
                value={nickname}
                onChange={(e) => { setNickname(e.target.value); setError(null); }}
                placeholder={currentNickname || "예: 마라톤의 전령"}
                maxLength={MAX_LEN}
                autoFocus
                className="w-full h-11 px-3 rounded-xl border border-slate-300 text-[14px] font-bold text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-violet-500"
              />
              <div className="flex justify-between mt-2">
                <span className={`text-[10px] font-bold ${hint ? "text-rose-500" : "text-slate-400"}`}>
                  {hint || `${MIN_LEN}~${MAX_LEN}자 · 한글/영문/숫자/_`}
                </span>
                <span className="text-[10px] font-bold text-slate-400">{nickname.trim().length}/{MAX_LEN}</span>
              </div>
            </label>

            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-3">
              <p className="text-[10px] font-[1000] text-amber-700 mb-1">💡 알아두세요</p>
              <ul className="text-[10px] text-amber-700 font-bold space-y-0.5 list-disc list-inside leading-relaxed">
                <li>최초 설정은 <b>무료</b>, 이후 변경은 100볼</li>
                <li>닉네임 변경은 <b>평생 1회</b>만 가능</li>
                <li>예약어·중복 닉네임은 사용할 수 없어요</li>
              </ul>
            </div>
          </div>

          {error && (
            <div className="mb-4 px-3 py-2 bg-rose-50 border border-rose-200 rounded-xl">
              <p className="text-[11px] text-rose-600 font-bold leading-relaxed">{error}</p>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`w-full h-12 rounded-xl font-[1000] text-[13px] transition-all ${
              canSubmit
                ? "bg-violet-600 text-white hover:bg-violet-700 shadow-sm"
                : "bg-slate-200 text-slate-400 cursor-not-allowed"
            }`}
          >
            {loading ? "설정 중..." : "닉네임 확정"}
          </button>
        </div>
      </div>
    </div>
  );
}
