// src/hooks/useAuthActions.ts — 인증 관련 핸들러 (로그인·로그아웃·테스트 계정)
import { auth, googleProvider, db } from '../firebase';
import {
  signInWithPopup, signOut, setPersistence,
  browserLocalPersistence, signInWithEmailAndPassword, createUserWithEmailAndPassword,
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import type { Dispatch, SetStateAction } from 'react';
import type { UserData } from '../types';
import type { MenuId } from '../components/Sidebar';
import { TEST_ACCOUNTS } from '../constants';

interface AuthActionDeps {
  userData: UserData | null;
  setUserData: Dispatch<SetStateAction<UserData | null>>;
  setActiveMenu: (m: MenuId) => void;
}

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
  const handleLogin = async () => {
    const inAppType = detectInAppBrowser();
    if (inAppType) {
      const appName = inAppType === 'kakao' ? '카카오톡' : inAppType === 'instagram' ? '인스타그램' : '현재 앱';
      const isAndroid = /Android/i.test(navigator.userAgent);
      const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
      if (isAndroid) {
        if (window.confirm(`${appName} 내부 브라우저에서는 구글 로그인이 지원되지 않습니다.\n\nChrome 브라우저에서 열겠습니까?`)) openExternalBrowser();
      } else if (isIOS) {
        alert(`${appName} 내부 브라우저에서는 구글 로그인이 지원되지 않습니다.\n\n[확인]을 누르면 주소가 복사됩니다.\nSafari 앱을 열고 주소창에 붙여넣기 해주세요.`);
        openExternalBrowser();
      } else {
        alert(`${appName} 내부 브라우저에서는 구글 로그인이 지원되지 않습니다.\n기기의 기본 브라우저(Chrome, Safari)에서 열어주세요.`);
      }
      return;
    }
    try {
      await setPersistence(auth, browserLocalPersistence);
      await signInWithPopup(auth, googleProvider);
    } catch (error: unknown) {
      console.error('로그인 에러:', error);
      alert('로그인 중 오류가 발생했소: ' + ((error as Error)?.message || '원인 불명'));
    }
  };

  const handleTestLogin = async (testUser: typeof TEST_ACCOUNTS[0]) => {
    try {
      if (userData) await signOut(auth);
      await setPersistence(auth, browserLocalPersistence);
      try {
        await signInWithEmailAndPassword(auth, testUser.email, '123456');
      } catch (loginError: unknown) {
        const code = (loginError as { code: string }).code;
        if (code === 'auth/user-not-found' || code === 'auth/invalid-credential') {
          const res = await createUserWithEmailAndPassword(auth, testUser.email, '123456');
          const initialData = {
            nickname: testUser.nickname, email: testUser.email, bio: testUser.bio,
            level: testUser.level || 1, exp: 0, likes: 0, points: 0,
            subscriberCount: 0, isPhoneVerified: true,
            friendList: [], blockList: [], avatarUrl: '', createdAt: serverTimestamp(),
          };
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

  return { handleLogin, handleTestLogin, handleLogout };
}
