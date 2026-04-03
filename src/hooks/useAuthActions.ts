// src/hooks/useAuthActions.ts — 인증 관련 핸들러 (로그인·로그아웃·테스트 계정)
import { useState } from 'react';
import { auth, googleProvider, db } from '../firebase';
import {
  signInWithPopup, signInWithRedirect, signOut, setPersistence,
  browserLocalPersistence, signInWithEmailAndPassword, createUserWithEmailAndPassword,
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
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

// 🚀 모바일 브라우저 감지 — iOS Safari는 signInWithPopup을 팝업 차단함 → signInWithRedirect 사용
// 검색어: isMobileBrowser
const isMobileBrowser = (): boolean => /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

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

  const handleLogin = async () => {
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
      if (isMobileBrowser()) {
        // 🚀 모바일(iOS Safari 등): 팝업 차단 문제로 페이지 리디렉션 방식 사용
        // 로그인 완료 후 원래 페이지로 돌아오면 onAuthStateChanged가 자동 처리
        await signInWithRedirect(auth, googleProvider);
      } else {
        await signInWithPopup(auth, googleProvider);
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

  return {
    handleLogin, handleTestLogin, handleLogout,
    inAppModal,
    closeInAppModal: () => setInAppModal(null),
    openExternalBrowser,
  };
}
