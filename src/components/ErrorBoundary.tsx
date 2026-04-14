// src/components/ErrorBoundary.tsx — 화이트스크린 방지 에러 바운더리
// 🚀 React 렌더링 에러 시 전체 앱이 언마운트되어 빈 화면이 되는 것을 방지
// 장시간 방치 후 Firestore 리스너 끊김, 청크 로드 실패 등에서 복구
import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';

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
          <p style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 700 }}>연결이 끊어졌습니다. 새로고침 해주세요.</p>
          <button
            onClick={() => { window.location.href = '/'; }}
            style={{ marginTop: '8px', padding: '8px 20px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 900, cursor: 'pointer' }}
          >
            홈으로 이동
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
