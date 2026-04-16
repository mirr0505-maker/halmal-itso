// src/components/SecureImage.tsx — 🔒 인증 기반 보안 이미지 로더
// R2 직접 URL 대신 Worker 프록시(/api/screenshot)를 통해 Firebase Auth 인증 후 이미지 로드
// Why: 스크린샷 URL이 외부 유출되더라도 인증 없이 접근 불가
import { useState, useEffect } from 'react';
import { auth } from '../firebase';

const WORKER_URL = 'https://halmal-upload-worker.mirr0505.workers.dev';

interface Props {
  r2Url: string;                    // 기존 R2 공개 URL (pub-xxx.r2.dev/uploads/...)
  alt?: string;
  className?: string;
  onClick?: () => void;
}

// R2 공개 URL에서 파일 경로 추출
function extractPath(url: string): string | null {
  const match = url.match(/r2\.dev\/(.+)$/);
  return match ? match[1] : null;
}

const SecureImage = ({ r2Url, alt = '', className = '', onClick }: Props) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const filePath = extractPath(r2Url);
      if (!filePath) { setError(true); setLoading(false); return; }

      try {
        const token = await auth.currentUser?.getIdToken();
        if (!token) { setError(true); setLoading(false); return; }

        const res = await fetch(`${WORKER_URL}/api/screenshot?path=${encodeURIComponent(filePath)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) { setError(true); setLoading(false); return; }

        const blob = await res.blob();
        if (cancelled) return;
        setBlobUrl(URL.createObjectURL(blob));
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [r2Url]);

  // 메모리 해제
  useEffect(() => {
    return () => { if (blobUrl) URL.revokeObjectURL(blobUrl); };
  }, [blobUrl]);

  if (loading) return <div className={`animate-pulse bg-slate-200 rounded ${className}`} style={{ minHeight: '100px' }} />;
  if (error || !blobUrl) return <div className={`flex items-center justify-center bg-slate-100 text-slate-400 text-[10px] font-bold rounded ${className}`} style={{ minHeight: '60px' }}>이미지를 불러올 수 없습니다</div>;

  return <img src={blobUrl} alt={alt} className={className} onClick={onClick} />;
};

export default SecureImage;
