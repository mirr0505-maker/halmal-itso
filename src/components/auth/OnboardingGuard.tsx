// src/components/auth/OnboardingGuard.tsx — 🔰 Sprint 7.5 온보딩 게이트 오케스트레이터
//
// 🚀 기능명: OnboardingGuard
//   userData 상태를 검사해 순서대로 게이트 화면을 덮는 라우터 컴포넌트.
//   App.tsx는 이 컴포넌트 하나만 마운트하면 사약/탈퇴/휴대폰/닉네임/추천 모두 제어됨.
//
// 게이트 우선순위 (위에서 아래로):
//   1. SayakScreen            — sanctionStatus === 'banned' (App.tsx에서 이미 먼저 처리)
//   2. AccountRevivalModal    — isDeleted === true (30일 유예기간 복구 유도)
//   3. PhoneVerifyScreen      — phoneVerified !== true (기존 Sprint 7 Step 7-B)
//   4. NicknameSetupScreen    — nicknameSet !== true (Sprint 7.5 신규)
//   5. OnboardingReferralScreen — referredByCode 없고 onboardingReferralSkipped 로컬 플래그도 없음
//   6. children (앱 메인)
//
// ⚠️ 테스트 계정 bypass: App.tsx에서 phoneVerified와 동일 패턴으로 이 게이트를 우회시킴.
//    Why: TEST_ACCOUNTS의 DB 문서는 nicknameSet 없을 가능성 → 개발자 플로우를 막으면 안 됨.

import { lazy, Suspense, useState } from "react";
import type { ReactNode } from "react";
import type { UserData } from "../../types";

const AccountRevivalModal = lazy(() => import("./AccountRevivalModal"));
const NicknameSetupScreen = lazy(() => import("./NicknameSetupScreen"));
const OnboardingReferralScreen = lazy(() => import("./OnboardingReferralScreen"));
const PhoneVerifyScreen = lazy(() => import("../PhoneVerifyScreen"));

interface Props {
  userData: UserData;
  onLogout: () => void;
  isTestAccount: boolean;
  children: ReactNode;
}

// Firestore Timestamp or Date-like → millis
function toMillis(v: unknown): number | null {
  if (!v) return null;
  if (typeof v === "number") return v;
  if (v instanceof Date) return v.getTime();
  const withMethod = v as { toMillis?: () => number; seconds?: number };
  if (typeof withMethod.toMillis === "function") return withMethod.toMillis();
  if (typeof withMethod.seconds === "number") return withMethod.seconds * 1000;
  return null;
}

// 게이트 대기 중 잠깐 보이는 로딩 화면 (lazy suspense fallback)
function GateLoading() {
  return (
    <div className="fixed inset-0 z-[100] bg-slate-50 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function OnboardingGuard({ userData, onLogout, isTestAccount, children }: Props) {
  // OnboardingReferralScreen이 localStorage 플래그를 세팅한 뒤 강제 재평가를 위한 bump
  // Why: localStorage 변경은 React state가 아니므로 이 훅으로 리렌더 유도
  const [referralDoneBump, setReferralDoneBump] = useState(0);
  void referralDoneBump;
  // 2. 탈퇴 예정 계정 — 복구/로그아웃 선택 전까지 다른 UI 차단
  if (userData.isDeleted === true) {
    const ms = toMillis(userData.deletedAt);
    return (
      <Suspense fallback={<GateLoading />}>
        <AccountRevivalModal deletedAtMillis={ms} onLogout={onLogout} />
      </Suspense>
    );
  }

  // 3. 휴대폰 인증 — 테스트 계정은 bypass (App.tsx 기존 패턴과 동일)
  if (!isTestAccount && userData.phoneVerified !== true) {
    return (
      <Suspense fallback={<GateLoading />}>
        <PhoneVerifyScreen currentUid={userData.uid} onLogout={onLogout} />
      </Suspense>
    );
  }

  // 4. 최초 닉네임 설정 — 테스트 계정은 bypass (DB 문서의 nicknameSet 여부 무관하게 통과)
  if (!isTestAccount && userData.nicknameSet !== true) {
    return (
      <Suspense fallback={<GateLoading />}>
        <NicknameSetupScreen
          currentNickname={userData.nickname || ""}
          onLogout={onLogout}
        />
      </Suspense>
    );
  }

  // 5. 추천코드 온보딩 — referredByCode 없고 skip 플래그도 없을 때만 1회 노출
  //    isTestAccount에는 skip (테스트 계정은 referredByCode 필드 무의미)
  const skipped = (() => {
    try { return localStorage.getItem("onboardingReferralSkipped") === "true"; } catch { return false; }
  })();
  const needsReferralStep = !isTestAccount
    && !userData.referredByCode
    && !skipped;

  if (needsReferralStep) {
    return (
      <Suspense fallback={<GateLoading />}>
        <OnboardingReferralScreen onDone={() => setReferralDoneBump((n) => n + 1)} />
      </Suspense>
    );
  }

  // 모든 게이트 통과
  return <>{children}</>;
}
