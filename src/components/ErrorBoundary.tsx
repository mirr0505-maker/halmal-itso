// src/components/ErrorBoundary.tsx — 화이트스크린 방지 에러 바운더리
// 🚀 React 렌더링 에러 시 전체 앱이 언마운트되어 빈 화면이 되는 것을 방지
// 장시간 방치 후 Firestore 리스너 끊김, 청크 로드 실패 등에서 복구
// 🏚️ 에러 감지 시 5초 카운트다운 후 자동으로 홈(/)으로 이동 (새로고침 포함)
import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';

// 🔧 청크 로드 실패 판정 — 배포 직후 hash 변경으로 lazy chunk 404 시 발생
// Firebase Hosting이 SPA fallback으로 index.html(text/html)을 반환해서
// MIME 에러 + "Failed to fetch dynamically imported module" 형태로 나타남.
// 이 경우 홈 리다이렉트는 무한 루프 → 브라우저 캐시 우회 hard reload만이 근본 해결.
function isChunkLoadError(error: Error): boolean {
  const msg = error?.message || '';
  const name = error?.name || '';
  return (
    name === 'ChunkLoadError' ||
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Loading chunk') ||
    msg.includes('Expected a JavaScript') ||
    msg.includes('MIME type')
  );
}

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; countdown: number }> {
  private timer: number | null = null;

  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, countdown: 5 };
  }

  static getDerivedStateFromError() { return { hasError: true, countdown: 5 }; }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info);

    // 🔧 청크 로드 에러: 홈 이동으론 해결 안 됨 (캐시된 index.html이 원인)
    //   → 쿼리스트링 붙여 캐시 무효화 + 강제 새로고침
    //   30초 이내 중복 재시도는 방지 (무한 reload 루프 차단)
    if (isChunkLoadError(error)) {
      const lastAttempt = parseInt(sessionStorage.getItem('chunk_reload_at') || '0', 10);
      const cooldown = 30_000;
      if (Date.now() - lastAttempt > cooldown) {
        sessionStorage.setItem('chunk_reload_at', String(Date.now()));
        window.location.href = `/?_cb=${Date.now()}`;
        return;
      }
      // 쿨다운 내 재발 시 기본 카운트다운 경로로 fallback
    }

    // 🚀 자동 복구: 1초 단위 카운트다운 → 0 되면 홈으로 이동 (새로고침 포함)
    this.timer = window.setInterval(() => {
      this.setState(prev => {
        if (prev.countdown <= 1) {
          if (this.timer) clearInterval(this.timer);
          window.location.href = '/';
          return { ...prev, countdown: 0 };
        }
        return { ...prev, countdown: prev.countdown - 1 };
      });
    }, 1000);
  }

  componentWillUnmount() {
    if (this.timer) clearInterval(this.timer);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '12px', fontFamily: 'sans-serif' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 900, fontStyle: 'italic' }}>
            <span style={{ color: '#ef4444' }}>G</span><span style={{ color: '#2563eb' }}>L</span><span style={{ color: '#1e293b' }}>ove</span>
          </h1>
          <p style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 700 }}>
            연결이 끊어졌습니다. {this.state.countdown}초 후 자동으로 다시 시작합니다...
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
