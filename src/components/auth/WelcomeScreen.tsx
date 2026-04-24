// src/components/auth/WelcomeScreen.tsx — 🔰 Sprint 7.5 로그인/회원가입 진입 화면
//
// 🚀 기능명: WelcomeScreen (3-뷰 상태 머신)
//   비로그인 유저가 "로그인" 버튼을 누르면 보여주는 전체 화면 오버레이.
//   landing → (login | signup) 으로 분기, 각 경로가 독립된 intent로 signInWithPopup을 호출.
//
// 뷰 구조:
//   1) landing  — 브랜드 + 서비스 소개 + [로그인] / [회원가입] 2-CTA
//   2) login    — 미니멀. 약관·추천코드 안내 없음. 이미 가입한 유저 전용.
//   3) signup   — 약관 동의 + 추천코드 1회성 안내 + Google 회원가입 버튼.
//
// Why 뷰 분리:
//   "로그인 화면은 이미 가입한 사람이 보는 화면" — 약관/추천 안내가 재노출되면 재가입 UX 혼선.
//   서버도 intent 불일치를 검증(useAuthActions): login+isNewUser=true는 Auth 계정 정리, signup+!isNewUser는 기존 계정 보호.
//
// 플로우:
//   • 기존 유저 → [로그인] → Google OAuth → 바로 앱 (OnboardingGuard가 onboardingCompleted로 스킵)
//   • 신규 유저 → [회원가입] → Google OAuth → 온보딩(전화→닉네임→추천) → completeOnboarding → 앱
//
// ⚠️ 기존 "로그인 없이 둘러보기" UX를 훼손하지 않도록, onClose로 닫고 다시 비로그인 앱 진입 가능.

import { useState } from "react";

type ViewMode = "landing" | "login" | "signup";

interface Props {
  // intent를 받아 useAuthActions.handleLogin(intent) 호출
  onGoogleLogin: (intent: "login" | "signup") => void | Promise<void>;
  // 🥥 Sprint 8 — 카카오 OAuth는 redirect 방식이므로 반환값 없음 (페이지 이동)
  onKakaoLogin: (intent: "login" | "signup") => void;
  // 🟢 Sprint 8 — 네이버 OAuth도 redirect 방식
  onNaverLogin: (intent: "login" | "signup") => void;
  onClose: () => void;
}

export default function WelcomeScreen({ onGoogleLogin, onKakaoLogin, onNaverLogin, onClose }: Props) {
  const [view, setView] = useState<ViewMode>("landing");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [loading, setLoading] = useState(false);

  const trigger = async (intent: "login" | "signup") => {
    if (intent === "signup" && !agreeTerms) return;
    setLoading(true);
    try {
      await onGoogleLogin(intent);
    } finally {
      // 팝업 취소 등으로 돌아온 경우를 위해 로딩 해제
      setLoading(false);
    }
  };

  // 🥥 카카오는 redirect 방식 — 페이지가 이동하므로 loading 상태는 의미 없음
  const triggerKakao = (intent: "login" | "signup") => {
    if (intent === "signup" && !agreeTerms) return;
    onKakaoLogin(intent);
  };

  // 🟢 네이버도 redirect 방식
  const triggerNaver = (intent: "login" | "signup") => {
    if (intent === "signup" && !agreeTerms) return;
    onNaverLogin(intent);
  };

  // ── 공통 브랜드 헤더 ────────────────────────────────────────────
  const BrandHeader = ({ tagline }: { tagline: string }) => (
    <div className="flex flex-col items-center mb-8">
      <h1 className="flex items-baseline gap-0 mb-2">
        <span className="text-[40px] font-[1000] tracking-tighter text-red-500" style={{ fontFamily: "'Pretendard Variable', Pretendard, sans-serif" }}>글</span>
        <span className="text-[40px] font-[1000] tracking-tighter text-blue-600" style={{ fontFamily: "'Pretendard Variable', Pretendard, sans-serif" }}>러브</span>
        <span className="italic text-[14px] font-bold text-slate-500 ml-1">beta</span>
      </h1>
      <p className="text-[13px] text-slate-500 font-bold">{tagline}</p>
    </div>
  );

  // ── Google 버튼 (색/문구만 intent로 차별화) ────────────────────
  const GoogleButton = ({ intent, disabled }: { intent: "login" | "signup"; disabled: boolean }) => (
    <button
      onClick={() => trigger(intent)}
      disabled={disabled || loading}
      className={`w-full h-12 rounded-xl flex items-center justify-center gap-2.5 font-[1000] text-[13px] transition-all shadow-sm ${
        !disabled && !loading
          ? "bg-white border border-slate-300 text-slate-800 hover:bg-slate-50 hover:shadow"
          : "bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed"
      }`}
    >
      {loading ? (
        <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
      ) : (
        <>
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          <span>{intent === "login" ? "Google로 로그인" : "Google로 회원가입"}</span>
        </>
      )}
    </button>
  );

  // ── 카카오 버튼 (공식 가이드: #FEE500 배경 + 검정 텍스트 + 카카오톡 말풍선 아이콘) ─────
  const KakaoButton = ({ intent, disabled }: { intent: "login" | "signup"; disabled: boolean }) => (
    <button
      onClick={() => triggerKakao(intent)}
      disabled={disabled || loading}
      className={`w-full h-12 rounded-xl flex items-center justify-center gap-2.5 font-[1000] text-[13px] transition-all shadow-sm ${
        !disabled && !loading
          ? "bg-[#FEE500] text-[#191919] hover:bg-[#FCDD00] hover:shadow"
          : "bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed"
      }`}
    >
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
        <path fill="#191919" d="M12 3C6.48 3 2 6.48 2 10.8c0 2.76 1.8 5.2 4.55 6.6l-1.15 4.2c-.1.36.31.64.61.43L10.9 19.1c.36.04.73.06 1.1.06 5.52 0 10-3.48 10-7.8S17.52 3 12 3Z" />
      </svg>
      <span>{intent === "login" ? "카카오로 로그인" : "카카오로 회원가입"}</span>
    </button>
  );

  // ── 네이버 버튼 (공식 가이드: #03C75A 그린 + 흰 텍스트 + 흰 N 로고) ─────
  const NaverButton = ({ intent, disabled }: { intent: "login" | "signup"; disabled: boolean }) => (
    <button
      onClick={() => triggerNaver(intent)}
      disabled={disabled || loading}
      className={`w-full h-12 rounded-xl flex items-center justify-center gap-2.5 font-[1000] text-[13px] transition-all shadow-sm ${
        !disabled && !loading
          ? "bg-[#03C75A] text-white hover:bg-[#02B350] hover:shadow"
          : "bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed"
      }`}
    >
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
        <path fill="#ffffff" d="M16.273 12.845 7.376 0H0v24h7.727V11.156L16.624 24H24V0h-7.727v12.845Z" />
      </svg>
      <span>{intent === "login" ? "네이버로 로그인" : "네이버로 회원가입"}</span>
    </button>
  );

  // ── 상단 닫기 / 뒤로가기 ────────────────────────────────────────
  const TopBar = () => (
    <div className="flex justify-between items-center mb-2">
      {view === "landing" ? (
        <span />
      ) : (
        <button
          onClick={() => { setView("landing"); setAgreeTerms(false); }}
          className="text-slate-400 hover:text-slate-600 text-[12px] font-bold"
        >
          ← 돌아가기
        </button>
      )}
      <button
        onClick={onClose}
        className="text-slate-400 hover:text-slate-600 text-[12px] font-bold"
        aria-label="닫기"
      >
        ✕ 둘러보기
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] bg-slate-50 flex flex-col overflow-y-auto">
      <div className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-[420px]">
          <TopBar />

          {view === "landing" && (
            <>
              <BrandHeader tagline="글로 대화하고, 마음을 전하는 공간" />

              {/* 서비스 소개 — 공용 */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-5 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">✍️</div>
                  <div>
                    <p className="text-[12px] font-[1000] text-slate-800">글로 대화하는 깐부</p>
                    <p className="text-[11px] text-slate-500 font-bold leading-relaxed">짧은 글, 긴 글, 연재 — 내 속도로 쓰고 나눠요.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">🎁</div>
                  <div>
                    <p className="text-[12px] font-[1000] text-slate-800">땡스볼로 마음 전송</p>
                    <p className="text-[11px] text-slate-500 font-bold leading-relaxed">마음에 든 글에 땡스볼을 선물하세요.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">🤝</div>
                  <div>
                    <p className="text-[12px] font-[1000] text-slate-800">깐부 맺고 함께 성장</p>
                    <p className="text-[11px] text-slate-500 font-bold leading-relaxed">추천코드로 맞깐부, 소통하며 레벨업.</p>
                  </div>
                </div>
              </div>

              {/* 2-CTA: 로그인 (primary) / 회원가입 (outline) */}
              <button
                onClick={() => setView("login")}
                className="w-full h-12 rounded-xl bg-violet-600 text-white font-[1000] text-[13px] hover:bg-violet-700 shadow-sm transition-all mb-2"
              >
                로그인
              </button>
              <button
                onClick={() => setView("signup")}
                className="w-full h-11 rounded-xl border border-slate-300 bg-white text-slate-800 font-[1000] text-[12px] hover:bg-slate-50 transition-all"
              >
                처음이신가요? <span className="text-violet-600">회원가입</span>
              </button>
            </>
          )}

          {view === "login" && (
            <>
              <BrandHeader tagline="다시 만나서 반가워요" />

              <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-5">
                <p className="text-[12px] font-[1000] text-slate-800 mb-1">👋 가입하신 Google 계정으로 로그인</p>
                <p className="text-[11px] text-slate-500 font-bold leading-relaxed">
                  처음 가입한 계정과 동일한 Google 계정을 선택해 주세요.
                </p>
              </div>

              <GoogleButton intent="login" disabled={false} />
              <div className="h-2" />
              <KakaoButton intent="login" disabled={false} />
              <div className="h-2" />
              <NaverButton intent="login" disabled={false} />

              <p className="text-center text-[11px] text-slate-500 font-bold mt-4">
                계정이 없으신가요?{" "}
                <button
                  onClick={() => setView("signup")}
                  className="text-violet-600 underline font-[1000]"
                >
                  회원가입
                </button>
              </p>
            </>
          )}

          {view === "signup" && (
            <>
              <BrandHeader tagline="깐부가 되어 주세요" />

              {/* 🎟️ 추천코드 1회성 안내 — 회원가입 온보딩에서만 입력 가능 */}
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                <p className="text-[11px] font-[1000] text-amber-800 mb-0.5">🎟️ 추천코드는 가입 시에만 입력할 수 있어요</p>
                <p className="text-[10px] text-amber-700 font-bold leading-relaxed">
                  회원가입 마지막 단계에서 1회 입력. 가입 후에는 다시 입력할 수 없으니 추천인 코드를 준비해두세요.
                </p>
              </div>

              {/* 약관 동의 */}
              <label className="flex items-start gap-2 mb-4 cursor-pointer select-none px-1">
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-violet-600 cursor-pointer"
                />
                <span className="text-[11px] text-slate-600 font-bold leading-relaxed">
                  가입 시 <a href="/terms" target="_blank" rel="noreferrer" className="text-violet-600 underline">이용약관</a> 및{" "}
                  <a href="/privacy" target="_blank" rel="noreferrer" className="text-violet-600 underline">개인정보처리방침</a>에 동의합니다.
                </span>
              </label>

              <GoogleButton intent="signup" disabled={!agreeTerms} />
              <div className="h-2" />
              <KakaoButton intent="signup" disabled={!agreeTerms} />
              <div className="h-2" />
              <NaverButton intent="signup" disabled={!agreeTerms} />

              <p className="text-center text-[11px] text-slate-500 font-bold mt-4">
                이미 회원이신가요?{" "}
                <button
                  onClick={() => setView("login")}
                  className="text-violet-600 underline font-[1000]"
                >
                  로그인
                </button>
              </p>
            </>
          )}

          {/* 추후 확장 자리 — 애플은 Sprint 8+ */}
          {view !== "landing" && (
            <p className="text-center text-[10px] text-slate-400 font-bold mt-4">
              애플 로그인은 곧 추가됩니다
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
