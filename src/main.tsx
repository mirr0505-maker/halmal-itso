import { StrictMode, Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

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

// 🚀 에러 바운더리: 화이트스크린 방지 — 장시간 방치 후 리스너 끊김 등 복구
// Why: React 렌더링 에러 시 전체 앱이 언마운트되어 빈 화면이 됨
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '12px', fontFamily: 'sans-serif' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 900, fontStyle: 'italic' }}>
            <span style={{ color: '#ef4444' }}>G</span><span style={{ color: '#2563eb' }}>L</span><span style={{ color: '#1e293b' }}>ove</span>
          </h1>
          <p style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 700 }}>연결이 끊어졌습니다. 새로고침합니다...</p>
        </div>
      );
    }
    return this.props.children;
  }
}

// 🚀 에러 바운더리 감지 시 3초 후 자동 새로고침
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
