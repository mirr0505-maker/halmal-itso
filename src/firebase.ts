// Firebase 앱 초기화 및 설정을 위한 함수 임포트
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth, GoogleAuthProvider } from "firebase/auth"; // 🚀 인증(Auth) 추가

// 환경 변수에서 설정값 가져오기
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);

// 🚀 데이터베이스, 저장소, 인증 내보내기
export const db = getFirestore(app);
export const storage = getStorage(app); 
export const auth = getAuth(app); // 🚀 인증 객체 추가
export const googleProvider = new GoogleAuthProvider(); // 🚀 구글 로그인 프로바이더 추가

export default app;
