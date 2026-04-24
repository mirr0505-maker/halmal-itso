// src/components/PhoneVerifyScreen.tsx — 📱 Sprint 7 Step 7-B 휴대폰 인증 게이트
//
// 🚀 기능명: PhoneVerifyScreen
//   phoneVerified !== true 상태에서 App.tsx가 전체 화면으로 가로채기 하는 게이트 화면.
//   Firebase PhoneAuthProvider + RecaptchaVerifier로 SMS OTP 완료 → linkWithPhoneNumber로
//   현재 Google Auth record에 phoneNumber 박기 → verifyPhoneServer CF로 서버 검증.
//
// Why 차분한 slate 톤:
//   사약 화면(빨강 위협)과 톤 분리 — 여기는 정상 가입 플로우의 필수 단계이므로 친근·안정감 우선.
//   ShareholderVerifyScreen 차분 slate 패턴 차용.
//
// 플로우:
//   1. 번호 입력 → [인증번호 받기] → RecaptchaVerifier 해결 → linkWithPhoneNumber → SMS 발송
//   2. 6자리 OTP 입력 → [확인] → confirmationResult.confirm → Auth record에 phoneNumber 박힘
//   3. 즉시 verifyPhoneServer CF 호출 → banned_phones/duplicate 체크 + users 갱신
//   4. userData onSnapshot이 phoneVerified=true 감지 → App.tsx 게이트 자동 해제

import { useState, useRef, useEffect } from "react";
import { auth, functions } from "../firebase";
import { PhoneAuthProvider, RecaptchaVerifier, linkWithCredential } from "firebase/auth";
import { httpsCallable } from "firebase/functions";

interface Props {
  currentUid: string;
  onLogout: () => void;
}

// 한국 휴대폰 자동 마스킹: 010-XXXX-XXXX
function formatKoreanPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length < 4) return digits;
  if (digits.length < 8) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

// E.164 변환 (서버 normalizeE164와 동일 정책)
function toE164(masked: string): string | null {
  const digits = masked.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("010")) return `+82${digits.slice(1)}`;
  return null;
}

export default function PhoneVerifyScreen({ onLogout }: Props) {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [stage, setStage] = useState<"input" | "otp" | "verifying">("input");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const verifierRef = useRef<RecaptchaVerifier | null>(null);
  const verificationIdRef = useRef<string | null>(null);
  const recaptchaContainerRef = useRef<HTMLDivElement | null>(null);

  // 🚀 RecaptchaVerifier invisible 초기화 — stage가 바뀔 때마다 재생성 안 하려고 마운트 시 1회
  useEffect(() => {
    if (!recaptchaContainerRef.current || verifierRef.current) return;
    verifierRef.current = new RecaptchaVerifier(auth, recaptchaContainerRef.current, {
      size: "invisible",
    });
    return () => {
      verifierRef.current?.clear();
      verifierRef.current = null;
    };
  }, []);

  // 🚀 단계 1: 인증번호 발송
  const handleSendCode = async () => {
    setError(null);
    const e164 = toE164(phone);
    if (!e164) {
      setError("올바른 휴대폰 번호 형식이 아닙니다. 010으로 시작하는 11자리를 입력해주세요.");
      return;
    }
    if (!verifierRef.current) {
      setError("reCAPTCHA가 준비되지 않았습니다. 새로고침 후 다시 시도해주세요.");
      return;
    }
    if (!auth.currentUser) {
      setError("로그인 세션이 만료되었습니다. 다시 로그인해주세요.");
      return;
    }
    setLoading(true);
    try {
      const provider = new PhoneAuthProvider(auth);
      const verificationId = await provider.verifyPhoneNumber(e164, verifierRef.current);
      verificationIdRef.current = verificationId;
      setStage("otp");
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code;
      if (code === "auth/too-many-requests") {
        setError("요청이 너무 많습니다. 잠시 후 다시 시도해주세요.");
      } else if (code === "auth/invalid-phone-number") {
        setError("유효하지 않은 번호입니다.");
      } else {
        setError("인증번호 발송에 실패했습니다: " + ((e as Error)?.message || "원인 불명"));
      }
      console.error("[PhoneVerify] send code failed:", e);
    } finally {
      setLoading(false);
    }
  };

  // 🚀 단계 2: OTP 확인 + 서버 검증
  const handleConfirmCode = async () => {
    setError(null);
    if (otp.length !== 6) {
      setError("6자리 인증번호를 입력해주세요.");
      return;
    }
    if (!verificationIdRef.current || !auth.currentUser) {
      setError("세션이 만료되었습니다. 처음부터 다시 시도해주세요.");
      return;
    }
    setStage("verifying");
    setLoading(true);
    try {
      // 🔒 linkWithCredential — 현재 Auth record에 phoneNumber 연결
      // 🔧 2026-04-24 이미 phone provider 연결된 경우(재시도·유령 링크) link 스킵 → verifyPhoneServer로 바로
      // Why: linkWithCredential은 동일 provider 중복 연결 시 'provider-already-linked' 에러 던짐.
      //      유저가 이전에 link 성공했으나 onboarding 미완료로 중단한 경우 재시도 불가해짐 → UX 차단 유발
      const credential = PhoneAuthProvider.credential(verificationIdRef.current, otp);
      const alreadyHasPhone = auth.currentUser.providerData.some((p) => p.providerId === "phone");
      if (!alreadyHasPhone) {
        await linkWithCredential(auth.currentUser, credential);
      } else {
        console.log("[PhoneVerify] phone provider already linked — skipping linkWithCredential");
      }

      // 🔒 서버 검증 — Admin SDK로 Auth record의 phoneNumber를 직접 읽어 위조 차단
      const verifyPhone = httpsCallable(functions, "verifyPhoneServer");
      await verifyPhone();
      // 성공 — App.tsx의 userData onSnapshot이 phoneVerified=true 감지해 자동 해제
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code;
      if (code === "auth/invalid-verification-code") {
        setError("인증번호가 틀립니다. 다시 확인해주세요.");
      } else if (code === "auth/code-expired") {
        setError("인증번호가 만료되었습니다. 처음부터 다시 시도해주세요.");
      } else if (code === "permission-denied" || code === "functions/permission-denied") {
        setError("이 번호는 재진입이 차단되었습니다. 관리자에게 문의해주세요.");
      } else if (code === "already-exists" || code === "functions/already-exists") {
        setError("이 번호는 이미 다른 계정에 연결되어 있습니다.");
      } else if (code === "auth/credential-already-in-use") {
        setError("이 번호는 다른 Firebase 계정에 이미 연결되어 있습니다.");
      } else if (code === "auth/account-exists-with-different-credential") {
        // 🔒 2026-04-24 — 같은 전화번호가 다른 SNS(구글/카카오/네이버) 계정에 연결된 상태
        setError("이 번호는 이미 다른 계정(다른 SNS 로그인)에 등록되어 있습니다. 기존 계정으로 로그인해 주세요.");
      } else {
        setError("인증 실패: " + ((e as Error)?.message || "원인 불명"));
      }
      console.error("[PhoneVerify] confirm failed:", e);
      setStage("otp");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
        {/* 상단 안내 */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-slate-100 mb-4">
            <svg className="w-7 h-7 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
            </svg>
          </div>
          <h1 className="text-[18px] font-[1000] text-slate-800 tracking-tight">휴대폰 인증이 필요합니다</h1>
          <p className="text-[12px] font-medium text-slate-500 mt-2 leading-relaxed">
            안전한 커뮤니티 유지를 위해 1회 본인 확인이 필요해요.<br />
            번호는 단방향 해시로만 저장되며, 원본은 보관하지 않습니다.
          </p>
        </div>

        {/* 단계 1: 번호 입력 */}
        {stage === "input" && (
          <div className="space-y-3">
            <label className="block text-[11px] font-[1000] text-slate-600 uppercase tracking-wider">
              휴대폰 번호 (한국 🇰🇷)
            </label>
            <input
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(formatKoreanPhone(e.target.value))}
              placeholder="010-0000-0000"
              disabled={loading}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-slate-400 focus:outline-none text-[15px] font-bold text-slate-800 placeholder:text-slate-300 placeholder:font-medium transition-all"
            />
            <button
              onClick={handleSendCode}
              disabled={loading || phone.replace(/\D/g, "").length !== 11}
              className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-900 disabled:bg-slate-200 disabled:text-slate-400 text-white font-[1000] text-[13px] tracking-wide transition-all"
            >
              {loading ? "발송 중..." : "인증번호 받기"}
            </button>
          </div>
        )}

        {/* 단계 2: OTP 입력 */}
        {(stage === "otp" || stage === "verifying") && (
          <div className="space-y-3">
            <label className="block text-[11px] font-[1000] text-slate-600 uppercase tracking-wider">
              인증번호 (6자리)
            </label>
            <input
              type="tel"
              inputMode="numeric"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="123456"
              disabled={loading}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-slate-400 focus:outline-none text-[18px] font-black text-slate-800 placeholder:text-slate-300 placeholder:font-medium tracking-[0.4em] text-center transition-all"
              autoFocus
            />
            <button
              onClick={handleConfirmCode}
              disabled={loading || otp.length !== 6}
              className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-900 disabled:bg-slate-200 disabled:text-slate-400 text-white font-[1000] text-[13px] tracking-wide transition-all"
            >
              {loading ? "확인 중..." : "확인"}
            </button>
            <button
              onClick={() => {
                setStage("input");
                setOtp("");
                setError(null);
              }}
              disabled={loading}
              className="w-full py-2 text-[11px] font-bold text-slate-400 hover:text-slate-600 transition-colors"
            >
              번호를 다시 입력하기
            </button>
          </div>
        )}

        {/* 에러 메시지 */}
        {error && (
          <div className="mt-4 px-3 py-2.5 rounded-lg bg-rose-50 border border-rose-100">
            <p className="text-[12px] font-semibold text-rose-600 leading-relaxed">{error}</p>
          </div>
        )}

        {/* 하단 로그아웃 */}
        <div className="mt-6 pt-5 border-t border-slate-100 text-center">
          <button
            onClick={onLogout}
            className="text-[11px] font-bold text-slate-300 hover:text-slate-500 uppercase tracking-widest transition-colors"
          >
            다른 계정으로 로그인
          </button>
        </div>

        {/* 🔒 invisible reCAPTCHA 컨테이너 — 화면에는 표시되지 않음 */}
        <div ref={recaptchaContainerRef} />
      </div>
    </div>
  );
}
