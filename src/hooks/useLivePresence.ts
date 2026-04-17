// src/hooks/useLivePresence.ts — 🔴 라이브 세션 동접 하트비트
// 60초 주기 presence 갱신 + Cloud Function이 120초 stale 정리
import { useEffect } from 'react';
import { db } from '../firebase';
import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';

/**
 * 라이브 세션 참여자 presence 관리.
 * - 진입 시: live_sessions/{sessionId}/presence/{uid} 생성 + 60초 주기 갱신
 * - 퇴장 시: 문서 삭제 (Cloud Scheduler가 좀비는 120초 후 정리)
 */
export const useLivePresence = (sessionId: string | null, userUid: string | null) => {
  useEffect(() => {
    if (!sessionId || !userUid) return;
    const presenceRef = doc(db, 'live_sessions', sessionId, 'presence', userUid);
    const ping = () => setDoc(presenceRef, { lastPing: serverTimestamp() }, { merge: true });

    ping();
    const timer = setInterval(ping, 60_000);

    // 탭 닫힘 대비 — beforeunload beacon
    const handleUnload = () => {
      // 동기 삭제 불가 → Cloud Scheduler의 stale 정리에 위임
      // navigator.sendBeacon은 Firestore SDK에 맞지 않아 스킵
    };
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      clearInterval(timer);
      window.removeEventListener('beforeunload', handleUnload);
      // 정상 언마운트 시 즉시 삭제
      deleteDoc(presenceRef).catch(() => {});
    };
  }, [sessionId, userUid]);
};
