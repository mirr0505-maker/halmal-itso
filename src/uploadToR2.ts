// src/uploadToR2.ts — R2 업로드 프록시 (Worker 경유)
// 🚀 목적: 클라이언트에서 R2 API 키를 제거하고, Worker를 통해 안전하게 업로드
// 기존 s3Client.ts(PutObjectCommand 직접 호출)를 대체

import { auth } from './firebase';

// Worker 엔드포인트 — 배포 후 실제 URL로 교체
const UPLOAD_WORKER_URL = import.meta.env.VITE_UPLOAD_WORKER_URL
  || 'https://halmal-upload-worker.mirr0505.workers.dev';

/**
 * R2에 파일 업로드 (Worker 프록시 경유)
 * @param file - 업로드할 File 객체
 * @param filePath - R2 내 저장 경로 (예: "uploads/{uid}/filename.jpg", "avatars/nickname_123.jpg")
 * @returns 업로드된 파일의 공개 URL
 */
export async function uploadToR2(file: File, filePath: string): Promise<string> {
  // Firebase Auth ID Token 획득
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('로그인이 필요합니다.');
  const idToken = await currentUser.getIdToken();

  const formData = new FormData();
  formData.append('file', file);
  formData.append('filePath', filePath);

  const res = await fetch(UPLOAD_WORKER_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}` },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: '업로드 실패' }));
    throw new Error((err as { error: string }).error || `업로드 실패 (${res.status})`);
  }

  const data = await res.json() as { url: string };
  return data.url;
}
