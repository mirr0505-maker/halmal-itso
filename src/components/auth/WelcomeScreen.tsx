// src/components/auth/WelcomeScreen.tsx — 🔰 Sprint 7.5 로그인/회원가입 진입 화면
//
// 🚀 기능명: WelcomeScreen
//   비로그인 유저가 "로그인" 버튼을 누르면 보여주는 전체 화면 오버레이.
//   서비스 소개 + Google OAuth 1-click(로그인/회원가입 구분 없음) + 약관 안내.
//
// Why 차분한 slate 톤:
//   PhoneVerifyScreen·ShareholderVerifyScreen과 동일한 slate 계열 유지 → 온보딩 3단계(로그인→휴대폰→닉네임)
//   가 시각적으로 같은 흐름이라는 신호. 사약(red)·활동(violet)과 분리.
//
// 플로우:
//   1. [Google로 시작하기] 클릭 → useAuthActions.handleLogin 호출 (기존 경로)
//   2. OAuth 성공 후 users 문서 자동 생성 (useFirebaseListeners)
//   3. onSnapshot이 phoneVerified=false → PhoneVerifyScreen
//   4. 인증 완료 후 nicknameSet=false → NicknameSetupScreen
//   5. 닉네임 확정 후 pendingReferralCode 또는 선택 입력 → OnboardingReferralScreen
//   6. 모든 게이트 통과 → 앱 메인
//
// ⚠️ 기존 "로그인 없이 둘러보기" UX를 훼손하지 않도록, onClose로 닫고 다시 비로그인 앱 진입 가능.

import { useState } from "react";

interface Props {
  onGoogleLogin: () => void;
  onClose: () => void;
}

export default function WelcomeScreen({ onGoogleLogin, onClose }: Props) {
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleGoogle = async () => {
    if (!agreeTerms) return;
    setLoading(true);
    try {
      await onGoogleLogin();
      // OAuth 성공 후 이 화면은 자연스럽게 언마운트 됨 (userData 생성 + onSnapshot)
    } finally {
      // 팝업 취소 등으로 돌아온 경우를 위해 로딩 해제
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-50 flex flex-col overflow-y-auto">
      <div className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-[420px]">
          {/* 닫기 */}
          <div className="flex justify-end mb-2">
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 text-[12px] font-bold"
              aria-label="닫기"
            >
              ✕ 둘러보기
            </button>
          </div>

          {/* 로고 / 브랜드 */}
          <div className="flex flex-col items-center mb-8">
            <h1 className="flex items-baseline gap-0 mb-2">
              <span className="text-[40px] font-[1000] tracking-tighter text-red-500" style={{ fontFamily: "'Pretendard Variable', Pretendard, sans-serif" }}>글</span>
              <span className="text-[40px] font-[1000] tracking-tighter text-blue-600" style={{ fontFamily: "'Pretendard Variable', Pretendard, sans-serif" }}>러브</span>
              <span className="italic text-[14px] font-bold text-slate-500 ml-1">beta</span>
            </h1>
            <p className="text-[13px] text-slate-500 font-bold">글로 대화하고, 마음을 전하는 공간</p>
          </div>

          {/* 서비스 소개 */}
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

          {/* Google 로그인 */}
          <button
            onClick={handleGoogle}
            disabled={!agreeTerms || loading}
            className={`w-full h-12 rounded-xl flex items-center justify-center gap-2.5 font-[1000] text-[13px] transition-all shadow-sm ${
              agreeTerms && !loading
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
                <span>Google로 시작하기</span>
              </>
            )}
          </button>

          {/* 추후 확장 자리 — 카카오·네이버·애플은 Sprint 8+ */}
          <p className="text-center text-[10px] text-slate-400 font-bold mt-3">
            다른 로그인 방식은 곧 추가됩니다
          </p>
        </div>
      </div>
    </div>
  );
}
