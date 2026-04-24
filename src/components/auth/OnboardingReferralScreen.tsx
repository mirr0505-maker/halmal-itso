// src/components/auth/OnboardingReferralScreen.tsx — 🔰 Sprint 7.5 온보딩 3단계: 추천코드 입력
//
// 🚀 기능명: OnboardingReferralScreen
//   닉네임 확정 직후 1회만 노출되는 추천코드 입력 게이트.
//   /r/:code 공유 링크로 들어온 유저는 pendingReferralCode가 자동 프리필되고,
//   일반 가입 유저는 코드가 없으면 "건너뛰기"로 바로 앱에 진입.
//
// Why 독립 컴포넌트:
//   MyPage ReferralSection는 코드 공유/통계/입력을 한 화면에 모두 노출 → 온보딩 맥락과 무관한 정보 과다.
//   이 화면은 입력 1장만 단순 노출 — 서버 호출은 동일 redeemReferralCode CF 재사용.
//
// 플로우:
//   1. sessionStorage('pendingReferralCode') 있으면 입력란 자동 프리필
//   2. [적용] → redeemReferralCode → 성공 시 isDismissed=true 로 게이트 해제
//   3. [건너뛰기] → localStorage('onboardingReferralSkipped')=true 로 게이트 해제
//      Why: referredByCode 빈 상태에서도 이 화면이 계속 뜨면 되돌아올 수 없음 → 로컬 플래그로 1회성화
//
// 게이트 해제 조건(OnboardingGuard에서 판단):
//   - userData.referredByCode 존재 OR
//   - localStorage('onboardingReferralSkipped') === 'true'
//
// 🚪 Sprint 7.5 핫픽스 — 이 화면이 온보딩의 마지막 단계이므로 success/skip 양쪽 경로에서
//   completeOnboarding CF를 호출해 users.onboardingCompleted=true 를 기록.
//   이후 로그인 시 OnboardingGuard가 이 플래그만 보고 전체 게이트를 skip.

import { useEffect, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { getInstallations, getId } from "firebase/installations";
import app, { functions } from "../../firebase";

interface Props {
  onDone: () => void;  // 입력 성공 또는 건너뛰기 시
}

// ReferralSection와 동일한 deviceFingerprint 수집 로직 (재사용 위해 작게 포트)
async function getDeviceFingerprint(): Promise<string> {
  try {
    const id = await getId(getInstallations(app));
    return typeof id === "string" && id.length > 0 && id.length <= 128 ? id : "";
  } catch {
    return "";
  }
}

function mapRedeemError(code: string | undefined, message: string): string {
  if (!code) return message || "추천코드 등록에 실패했습니다.";
  if (code === "functions/invalid-argument") return message || "추천코드 형식이 올바르지 않습니다.";
  if (code === "functions/not-found") return "존재하지 않는 추천코드입니다.";
  if (code === "functions/permission-denied") return "사용할 수 없는 추천코드입니다.";
  if (code === "functions/already-exists") return message || "이미 사용했거나 중복된 번호입니다.";
  if (code === "functions/failed-precondition") return message || "휴대폰 인증이 먼저 필요합니다.";
  return message || "추천코드 등록에 실패했습니다.";
}

export default function OnboardingReferralScreen({ onDone }: Props) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 공유 링크로 들어온 코드 프리필
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("pendingReferralCode");
      if (saved && /^[A-Z0-9]{6,8}$/.test(saved)) {
        setCode(saved);
      }
    } catch {
      /* sessionStorage 차단 환경 무시 */
    }
  }, []);

  // 🚪 온보딩 완결 플래그 기록 — 실패해도 UI는 통과 (다음 로그인 시 게이트가 재등장해도 재시도됨)
  const markOnboardingCompleted = async () => {
    try {
      const complete = httpsCallable(functions, "completeOnboarding");
      await complete({});
    } catch (e) {
      console.warn("[onboarding] completeOnboarding 실패 (무시하고 진입):", e);
    }
  };

  const handleRedeem = async () => {
    const normalized = code.trim().toUpperCase();
    if (!/^[A-Z0-9]{6,8}$/.test(normalized)) {
      setError("6~8자 영문/숫자 코드만 사용할 수 있어요.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const deviceFingerprint = await getDeviceFingerprint();
      const redeem = httpsCallable(functions, "redeemReferralCode");
      await redeem({ code: normalized, deviceFingerprint });
      try { sessionStorage.removeItem("pendingReferralCode"); } catch { /* 무시 */ }
      await markOnboardingCompleted();
      try { sessionStorage.removeItem("signup_session"); } catch { /* 무시 */ }
      onDone();
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      setError(mapRedeemError(err.code, err.message || ""));
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    try { localStorage.setItem("onboardingReferralSkipped", "true"); } catch { /* 무시 */ }
    try { sessionStorage.removeItem("pendingReferralCode"); } catch { /* 무시 */ }
    await markOnboardingCompleted();
    try { sessionStorage.removeItem("signup_session"); } catch { /* 무시 */ }
    onDone();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-50 flex flex-col overflow-y-auto">
      <div className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-[420px]">
          <div className="flex justify-between items-center mb-6">
            <span className="text-[11px] font-[1000] text-slate-400 tracking-wider">STEP 3 / 3</span>
            <button onClick={handleSkip} className="text-[11px] text-slate-500 hover:text-slate-700 font-bold">건너뛰기 →</button>
          </div>

          <h2 className="text-[22px] font-[1000] text-slate-900 mb-2">추천받은 코드가 있나요?</h2>
          <p className="text-[12px] text-slate-500 font-bold leading-relaxed mb-6">
            추천인이 있으면 <b className="text-violet-600">맞깐부 + EXP 보너스</b>를 받아요. 나중에 입력할 수도 있어요.
          </p>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-4">
            <label className="block">
              <span className="text-[11px] font-[1000] text-slate-500 mb-1.5 block">추천코드 (6~8자)</span>
              <input
                type="text"
                value={code}
                onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(null); }}
                placeholder="ABCD1234"
                maxLength={8}
                className="w-full h-11 px-3 rounded-xl border border-slate-300 text-[14px] font-[1000] tracking-widest text-slate-800 placeholder:text-slate-300 placeholder:font-bold focus:outline-none focus:border-violet-500 uppercase"
              />
              {error && (
                <p className="mt-2 text-[11px] text-rose-600 font-bold leading-relaxed">{error}</p>
              )}
            </label>

            <div className="mt-4 bg-violet-50 border border-violet-200 rounded-xl p-3">
              <p className="text-[10px] font-[1000] text-violet-700 mb-1">🎁 추천 혜택</p>
              <ul className="text-[10px] text-violet-700 font-bold space-y-0.5 list-disc list-inside leading-relaxed">
                <li>추천인과 <b>자동 맞깐부</b></li>
                <li>가입 즉시 <b>+5 EXP</b>, 7일 활성 시 추가 +5 EXP</li>
                <li>추천인도 +10 EXP (활성 확정 시)</li>
              </ul>
            </div>
          </div>

          <button
            onClick={handleRedeem}
            disabled={loading || code.trim().length < 6}
            className={`w-full h-12 rounded-xl font-[1000] text-[13px] transition-all ${
              !loading && code.trim().length >= 6
                ? "bg-violet-600 text-white hover:bg-violet-700 shadow-sm"
                : "bg-slate-200 text-slate-400 cursor-not-allowed"
            }`}
          >
            {loading ? "적용 중..." : "적용하고 시작하기"}
          </button>

          <button
            onClick={handleSkip}
            className="w-full mt-2 h-10 rounded-xl text-[12px] font-bold text-slate-500 hover:text-slate-700"
          >
            추천인 없이 시작하기
          </button>
        </div>
      </div>
    </div>
  );
}
