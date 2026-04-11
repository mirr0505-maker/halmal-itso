// src/components/SubscribeButton.tsx — 마르지 않는 잉크병: 작품 구독/구독취소 토글
// 🖋️ series_subscriptions/{seriesId}_{userId} 문서 생성·삭제 + series.subscriberCount 카운터 증감
// 🔒 작가 본인은 자기 작품 구독 불가 (UI + 핸들러 양쪽 차단)
import { useState, useEffect } from 'react';
import {
  doc, onSnapshot, setDoc, deleteDoc, updateDoc, increment, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';

interface SubscribeButtonProps {
  seriesId: string;
  authorId: string;
  currentUserUid: string | null;
  subscriberCount: number;
  size?: 'normal' | 'small';
}

const SubscribeButton = ({ seriesId, authorId, currentUserUid, subscriberCount }: SubscribeButtonProps) => {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // 🔒 구독 여부 실시간 구독
  useEffect(() => {
    if (!currentUserUid) {
      setIsSubscribed(false);
      setLoading(false);
      return;
    }
    const docId = `${seriesId}_${currentUserUid}`;
    const ref = doc(db, 'series_subscriptions', docId);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setIsSubscribed(snap.exists());
        setLoading(false);
      },
      (err) => {
        console.error('[SubscribeButton] 구독 상태 조회 실패:', err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [seriesId, currentUserUid]);

  const handleToggle = async () => {
    if (!currentUserUid) {
      alert('로그인이 필요합니다.');
      return;
    }
    if (currentUserUid === authorId) {
      alert('자신의 작품은 구독할 수 없습니다.');
      return;
    }
    if (submitting) return;

    setSubmitting(true);
    const subDocId = `${seriesId}_${currentUserUid}`;
    const subRef = doc(db, 'series_subscriptions', subDocId);
    const seriesRef = doc(db, 'series', seriesId);

    try {
      if (isSubscribed) {
        // 구독 취소
        await deleteDoc(subRef);
        await updateDoc(seriesRef, { subscriberCount: increment(-1) });
      } else {
        // 구독 시작
        await setDoc(subRef, {
          userId: currentUserUid,
          seriesId,
          subscribedAt: serverTimestamp(),
          notifyOnNewEpisode: true,
        });
        await updateDoc(seriesRef, { subscriberCount: increment(1) });
      }
    } catch (err: unknown) {
      console.error('[SubscribeButton] 구독 토글 실패:', err);
      const msg = err instanceof Error ? err.message : '구독 처리 중 오류가 발생했습니다.';
      alert(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const isAuthor = currentUserUid === authorId;

  if (loading) {
    return (
      <button disabled className="px-4 py-2 bg-slate-200 text-slate-400 rounded-lg text-sm font-[1000]">
        불러오는 중...
      </button>
    );
  }

  if (isAuthor) {
    // 작가 본인: 구독자 수만 표시 (비활성)
    return (
      <div className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-[1000]">
        👥 구독자 {subscriberCount}명
      </div>
    );
  }

  return (
    <button
      onClick={handleToggle}
      disabled={submitting}
      className={`px-4 py-2 rounded-lg text-sm font-[1000] transition-colors disabled:opacity-50 ${
        isSubscribed
          ? 'bg-slate-200 hover:bg-slate-300 text-slate-700'
          : 'bg-blue-500 hover:bg-blue-600 text-white'
      }`}
    >
      {submitting
        ? '처리 중...'
        : isSubscribed
          ? `✓ 구독 중 · ${subscriberCount}`
          : `+ 구독하기 · ${subscriberCount}`}
    </button>
  );
};

export default SubscribeButton;
