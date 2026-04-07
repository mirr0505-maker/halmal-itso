import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary'

// 🚀 청크 로드 실패 자동 복구: 새 배포 후 구버전 JS 청크가 없을 때 자동 새로고침
// 무한 루프 방지: 5초 내 이미 재로드한 경우 재시도하지 않음
window.addEventListener('unhandledrejection', (event) => {
  const msg = event.reason?.message || '';
  if (msg.includes('Failed to fetch dynamically imported module') || msg.includes('Importing a module script failed')) {
    const lastReload = Number(sessionStorage.getItem('chunkReloadAt') || '0');
    if (Date.now() - lastReload > 5000) {
      sessionStorage.setItem('chunkReloadAt', String(Date.now()));
      window.location.reload();
    }
  }
});

// 🚀 Firestore 리스너 끊김 감지 시 3초 후 자동 새로고침
const originalError = console.error;
let reloadScheduled = false;
console.error = (...args) => {
  originalError.apply(console, args);
  const msg = args.join(' ');
  if (!reloadScheduled && (msg.includes('FIRESTORE') || msg.includes('WebChannel') || msg.includes('Failed to get document'))) {
    reloadScheduled = true;
    setTimeout(() => window.location.reload(), 3000);
  }
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
