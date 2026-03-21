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

// env 불러오기 실패 시 명확하게 예외 처리
if (!firebaseConfig.apiKey || firebaseConfig.apiKey === "") {
  console.error("Firebase 초기화 실패: VITE_FIREBASE_API_KEY가 설정되지 않았습니다.");
  throw new Error("Firebase API key is missing. Set VITE_FIREBASE_API_KEY in .env file.");
}
if (!firebaseConfig.authDomain || !firebaseConfig.projectId) {
  console.warn("Firebase 설정이 일부 누락되었습니다. authDomain 또는 projectId를 확인해 주세요.");
}

const app = initializeApp(firebaseConfig);

// 🚀 데이터베이스, 저장소, 인증 내보내기
export const db = getFirestore(app);
export const storage = getStorage(app); 
export const auth = getAuth(app); // 🚀 인증 객체 추가
export const googleProvider = new GoogleAuthProvider(); // 🚀 구글 로그인 프로바이더 추가

export default app;
