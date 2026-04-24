// src/hooks/useAuthActions.ts — 인증 관련 핸들러 (로그인·로그아웃·테스트 계정)
import { useState } from 'react';
import { auth, googleProvider, db } from '../firebase';
import {
  signInWithPopup, signInWithRedirect, signOut, setPersistence,
  browserLocalPersistence, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  getAdditionalUserInfo,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import type { Dispatch, SetStateAction } from 'react';
import type { UserData } from '../types';
import type { MenuId } from '../components/Sidebar';
import { TEST_ACCOUNTS } from '../constants';

// 🚀 인앱 브라우저 모달 데이터 타입
export interface InAppModalData {
  appName: string;
  isIOS: boolean;
  isAndroid: boolean;
  currentUrl: string;
}

interface AuthActionDeps {
  userData: UserData | null;
  setUserData: Dispatch<SetStateAction<UserData | null>>;
  setActiveMenu: (m: MenuId) => void;
}

// 🚀 모바일 브라우저 감지 (인앱 브라우저 판정용)
// 로그인은 signInWithPopup 우선 → 팝업 차단 시 signInWithRedirect 폴백

// 🚀 인앱 브라우저 감지 — 카카오톡/인스타그램/라인 등 WebView는 Google OAuth 차단됨
const detectInAppBrowser = (): 'kakao' | 'instagram' | 'other' | null => {
  const ua = navigator.userAgent;
  if (/KAKAOTALK/i.test(ua)) return 'kakao';
  if (/Instagram/i.test(ua)) return 'instagram';
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return 'other'; // 페이스북
  if (/Line\//i.test(ua)) return 'other';
  return null;
};

// 외부 브라우저 강제 열기 — Android: Chrome intent URL, iOS: 현재 URL 복사 안내
const openExternalBrowser = () => {
  const currentUrl = window.location.href;
  const isAndroid = /Android/i.test(navigator.userAgent);
  if (isAndroid) {
    window.location.href = `intent://${currentUrl.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end;`;
  } else {
    navigator.clipboard?.writeText(currentUrl)
      .then(() => alert('URL이 복사되었습니다.\nSafari를 열고 주소창에 붙여넣기 해주세요.'))
      .catch(() => alert(`아래 주소를 Safari에서 열어주세요:\n${currentUrl}`));
  }
};

export function useAuthActions({ userData, setUserData, setActiveMenu }: AuthActionDeps) {
  // 🚀 인앱 브라우저 감지 시 모달 데이터 — null이면 모달 닫힘
  const [inAppModal, setInAppModal] = useState<InAppModalData | null>(null);

  // 🚪 Sprint 7.5 핫픽스 — 로그인/회원가입 분리
  // intent === 'login' : 이미 가입한 사용자. Auth 계정이 방금 생성되면(isNewUser=true) 잘못된 경로 → user.delete()로 Auth 정리 후 안내.
  // intent === 'signup': 신규 가입. Auth 계정이 이미 있던 경우(isNewUser=false) → signOut 후 안내(기존 users 문서 보호).
  // intent === 'either' : 하위 호환 (호출자가 구분 안 했을 때). 기존 동작 유지.
  const handleLogin = async (intent: 'login' | 'signup' | 'either' = 'either') => {
    const inAppType = detectInAppBrowser();
    if (inAppType) {
      const appName = inAppType === 'kakao' ? '카카오톡' : inAppType === 'instagram' ? '인스타그램' : '현재 앱';
      const isAndroid = /Android/i.test(navigator.userAgent);
      const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
      // alert/confirm 대신 커스텀 모달로 교체
      setInAppModal({ appName, isIOS, isAndroid, currentUrl: window.location.href });
      return;
    }
    try {
      await setPersistence(auth, browserLocalPersistence);
      // 🚀 모든 환경에서 signInWithPopup 사용
      // Why: signInWithRedirect는 iOS Safari ITP(쿠키 차단)로 인해 로그인 후 홈으로 돌아오는 버그 발생.
      // signInWithPopup은 사용자 클릭 직후 호출하면 iOS Safari에서도 팝업 차단 안 됨.
      // 딥링크 복원 불필요 (페이지 이동 없이 팝업으로 처리되므로 URL 유지).
      try {
        const result = await signInWithPopup(auth, googleProvider);
        // 🚪 intent-aware 분기 — OAuth 직후 isNewUser 판정으로 login/signup 경로 일치성 검증
        let isNewUser = false;
        try {
          const info = getAdditionalUserInfo(result);
          isNewUser = info?.isNewUser === true;
        } catch {
          // isNewUser 조회 실패 시 either로 취급 (기존 동작 유지)
        }

        if (intent === 'login' && isNewUser) {
          // 로그인 화면에서 눌렀는데 Auth 계정이 방금 생성됨 → 이 구글 계정은 미가입
          //   Auth 계정 정리: user.delete()가 credential 유효 동안(직후) 성공. 실패 시 signOut 폴백.
          try { await result.user.delete(); } catch { await signOut(auth); }
          alert('등록된 계정이 없어요.\n\n처음이시라면 "회원가입" 버튼을 눌러 주세요.');
          return;
        }
        if (intent === 'signup' && !isNewUser) {
          // 회원가입 화면에서 눌렀는데 Auth 계정이 이미 존재 → 기존 가입자
          //   Auth 계정은 보존(기존 users 문서 유지), 세션만 끊고 로그인 경로로 유도.
          await signOut(auth);
          alert('이미 가입된 계정이에요.\n\n"로그인" 버튼을 눌러 주세요.');
          return;
        }

        // 신규 가입 경로에서만 signup_session 플래그 세팅 (OnboardingGuard·ReferralScreen이 참조)
        if (isNewUser) {
          sessionStorage.setItem('signup_session', '1');
        }
      } catch (popupError: unknown) {
        const code = (popupError as { code?: string })?.code;
        // 팝업 차단된 경우에만 redirect 폴백 (구형 모바일 브라우저 대응)
        if (code === 'auth/popup-blocked') {
          sessionStorage.setItem('authRedirectUrl', window.location.href);
          // intent를 redirect 복귀 후에도 유지하기 위해 sessionStorage에 저장
          if (intent !== 'either') sessionStorage.setItem('authIntent', intent);
          await signInWithRedirect(auth, googleProvider);
        } else if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
          throw popupError;
        }
      }
    } catch (error: unknown) {
      console.error('로그인 에러:', error);
      alert('로그인 중 오류가 발생했소: ' + ((error as Error)?.message || '원인 불명'));
    }
  };

  const handleTestLogin = async (testUser: typeof TEST_ACCOUNTS[0]) => {
    try {
      if (userData) await signOut(auth);
      await setPersistence(auth, browserLocalPersistence);
      // 🚀 테스트 계정 초기값 (signIn·create 양쪽에서 재사용)
      const buildInitialData = () => ({
        nickname: testUser.nickname, email: testUser.email, bio: testUser.bio,
        level: testUser.level || 1,
        exp: (testUser as { exp?: number }).exp || 0,
        likes: (testUser as { likes?: number }).likes || 0,
        points: 0, subscriberCount: 0,
        // 📱 Sprint 7 Step 7-B — 표준 필드 phoneVerified로 통일 (isPhoneVerified는 legacy, 게이트 무관).
        //    App.tsx 게이트는 email로 bypass하므로 이 필드가 없어도 테스트 흐름은 통과.
        phoneVerified: true,
        isPhoneVerified: true,
        friendList: [], blockList: [], avatarUrl: '', createdAt: serverTimestamp(),
      });
      try {
        const cred = await signInWithEmailAndPassword(auth, testUser.email, '123456');
        // 🚀 signIn 성공 후 문서 존재 확인 → 없으면 최초 생성 (Commit 6 Rules create 규칙 경로)
        // Why: Auth 계정은 있으나 Firestore 문서가 유실된 경우(Console 수동 삭제 등) 복구.
        //      setDoc(merge) 시 update 규칙의 nickname·exp 가드에 걸리므로 반드시 create 경로로 써야 함.
        const userRef = doc(db, 'users', cred.user.uid);
        const snap = await getDoc(userRef);
        if (!snap.exists()) {
          const initialData = buildInitialData();
          await setDoc(userRef, initialData);
          setUserData({ ...initialData, uid: cred.user.uid } as unknown as UserData);
        }
      } catch (loginError: unknown) {
        const code = (loginError as { code: string }).code;
        if (code === 'auth/user-not-found' || code === 'auth/invalid-credential') {
          const res = await createUserWithEmailAndPassword(auth, testUser.email, '123456');
          const initialData = buildInitialData();
          await setDoc(doc(db, 'users', res.user.uid), initialData);
          setUserData({ ...initialData, uid: res.user.uid } as unknown as UserData);
        } else { throw loginError; }
      }
    } catch (error: unknown) {
      console.error('로그인 에러:', error);
      alert('깐부 로그인 중 오류가 발생했소: ' + ((error as Error)?.message || '원인 불명'));
    }
  };

  const handleLogout = async () => {
    if (window.confirm('정말 로그아웃 하시겠소?')) {
      await signOut(auth);
      setUserData(null);
      setActiveMenu('home');
    }
  };

  // 🥥 Sprint 8 — 카카오 로그인 트리거 (Authorization Code Flow, redirect 방식)
  //
  // Why redirect:
  //   Kakao JS SDK v2.x는 팝업 기반 Kakao.Auth.login()을 제거함 → Kakao.Auth.authorize() 전용.
  //   서버가 code를 access_token으로 교환한 뒤 Firebase Custom Token 발급.
  //
  // 플로우:
  //   1) sessionStorage에 intent·복귀 URL 보존
  //   2) Kakao.Auth.authorize() → kauth.kakao.com로 이동
  //   3) 유저 로그인 후 우리 사이트로 ?code=AUTHCODE 복귀
  //   4) App.tsx의 useKakaoAuthReturn 훅이 감지 → kakaoAuthCustomToken CF 호출
  //
  // ⚠️ 인앱 브라우저: Google과 동일 정책 — 카카오톡 인앱만 자체 로그인 허용(향후 optimization), 그 외 차단.
  const handleKakaoLogin = (intent: 'login' | 'signup' | 'either' = 'either') => {
    const inAppType = detectInAppBrowser();
    if (inAppType && inAppType !== 'kakao') {
      // 카카오톡 인앱 브라우저에서 카카오 로그인은 정상 작동 — 이 외 앱만 차단
      const appName = inAppType === 'instagram' ? '인스타그램' : '현재 앱';
      const isAndroid = /Android/i.test(navigator.userAgent);
      const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
      setInAppModal({ appName, isIOS, isAndroid, currentUrl: window.location.href });
      return;
    }

    const Kakao = (window as unknown as { Kakao?: { isInitialized: () => boolean; Auth: { authorize: (opts: Record<string, unknown>) => void } } }).Kakao;
    if (!Kakao || !Kakao.isInitialized?.()) {
      alert('카카오 로그인을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
      console.error('[kakaoLogin] Kakao SDK 미초기화');
      return;
    }

    // intent와 복귀 시점에 기존 URL 복원용 정보 저장
    // Why: redirect 복귀 후 App.tsx가 이 값을 읽어 CF 호출 분기
    try {
      if (intent !== 'either') sessionStorage.setItem('kakaoAuthIntent', intent);
      sessionStorage.setItem('kakaoAuthPending', '1');
    } catch {
      // private mode 등에서 sessionStorage 쓰기 실패해도 기본 경로로 진행
    }

    // redirect_uri는 현재 origin + '/' — CF가 동일 값으로 token 교환
    const redirectUri = `${window.location.origin}/`;
    Kakao.Auth.authorize({
      redirectUri,
      // 이메일 scope는 비즈 앱 전환 전까지 불가 → 닉네임만
      scope: 'profile_nickname',
    });
    // authorize()는 페이지를 이동시키므로 이 뒤 코드는 실행되지 않음
  };

  // 🟢 Sprint 8 — 네이버 로그인 트리거 (Authorization Code Flow, redirect + state)
  //
  // Why redirect + state:
  //   네이버는 JS SDK 필수 아님 → window.location.href로 단순 리다이렉트.
  //   state는 CSRF 방어용 랜덤 문자열. 클라가 세션에 저장 → 복귀 시 대조 → CF가 네이버에 다시 전달.
  //
  // 플로우:
  //   1) sessionStorage에 intent·state·pending 플래그 저장
  //   2) window.location.href = nid.naver.com/oauth2.0/authorize?...
  //   3) 유저 로그인 후 우리 사이트로 ?code=AUTHCODE&state=STATE 복귀
  //   4) App.tsx의 useNaverAuthReturn 훅이 감지 → state 일치 검증 → naverAuthCustomToken CF 호출
  //
  // ⚠️ 인앱 브라우저: Google·Kakao와 동일 정책 — 카카오톡 인앱 차단, 그 외도 차단.
  //   네이버는 자체 인앱 브라우저가 없으므로 모든 인앱에서 외부 브라우저 안내.
  const NAVER_CLIENT_ID = "gKAj34opkEhJO2nN1RFJ"; // public OAuth 식별자 (Secret 아님)
  const handleNaverLogin = (intent: 'login' | 'signup' | 'either' = 'either') => {
    const inAppType = detectInAppBrowser();
    if (inAppType) {
      const appName = inAppType === 'kakao' ? '카카오톡' : inAppType === 'instagram' ? '인스타그램' : '현재 앱';
      const isAndroid = /Android/i.test(navigator.userAgent);
      const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
      setInAppModal({ appName, isIOS, isAndroid, currentUrl: window.location.href });
      return;
    }

    // CSRF 방어용 state — 32자 hex (128비트)
    const randomState = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    try {
      if (intent !== 'either') sessionStorage.setItem('naverAuthIntent', intent);
      sessionStorage.setItem('naverAuthPending', '1');
      sessionStorage.setItem('naverAuthState', randomState);
    } catch {
      // private mode 등에서 sessionStorage 쓰기 실패해도 state는 URL 검증에 포함
    }

    const redirectUri = `${window.location.origin}/`;
    const authUrl = new URL('https://nid.naver.com/oauth2.0/authorize');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', NAVER_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('state', randomState);
    window.location.href = authUrl.toString();
    // 이 뒤 코드는 실행되지 않음 (페이지 이동)
  };

  return {
    handleLogin, handleTestLogin, handleLogout,
    handleKakaoLogin,
    handleNaverLogin,
    inAppModal,
    closeInAppModal: () => setInAppModal(null),
    openExternalBrowser,
  };
}
