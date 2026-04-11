// src/components/PaywallOverlay.tsx — 마르지 않는 잉크병: 유료 회차 결제 오버레이
// 🖋️ 미리보기 + 그라데이션 페이드 + 결제 박스 (잔액 부족/로그인 안 됨/정상 3분기)
import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import type { Post } from '../types';

interface PaywallOverlayProps {
  episode: Post;
  onUnlock: () => void;
  unlocking: boolean;
  currentUserUid: string | null;
}

const PaywallOverlay = ({ episode, onUnlock, unlocking, currentUserUid }: PaywallOverlayProps) => {
  const [userBallBalance, setUserBallBalance] = useState<number | null>(null);

  // 🔒 사용자 잔액 실시간 구독 (결제 후 자동 갱신)
  useEffect(() => {
    if (!currentUserUid) return;
    const unsub = onSnapshot(doc(db, 'users', currentUserUid), (snap) => {
      if (snap.exists()) {
        setUserBallBalance(snap.data().ballBalance || 0);
      }
    });
    return () => unsub();
  }, [currentUserUid]);

  const price = episode.price || 0;

  return (
    <div className="relative">
      {/* 미리보기 본문 — RootPostCard와 동일 톤 */}
      <article
        className="max-w-none text-[15px] leading-[1.8] font-medium mb-4 text-slate-700 [&_p]:mb-4 [&_p:last-child]:mb-0"
        dangerouslySetInnerHTML={{
          __html: episode.previewContent || episode.content || '',
        }}
      />

      {/* 그라데이션 페이드 */}
      <div className="relative h-32 -mt-32 bg-gradient-to-b from-transparent to-white pointer-events-none" />

      {/* 결제 박스 — 차분한 회색 톤 */}
      <div className="border border-slate-200 rounded-xl p-5 bg-slate-50 text-center mt-4">
        <div className="text-3xl mb-2">🔒</div>
        <h3 className="text-[14px] font-[1000] text-slate-700 mb-1">유료 회차</h3>
        <p className="text-[12px] text-slate-500 font-bold mb-4">
          이 회차의 나머지 내용을 보려면 땡스볼이 필요합니다.
        </p>

        {/* 가격 표시 */}
        <div className="inline-flex items-center gap-2 mb-3 px-3 py-1.5 bg-white rounded-full border border-slate-200">
          <span className="text-base">🏀</span>
          <span className="text-[14px] font-[1000] text-slate-900">{price}</span>
          <span className="text-[11px] text-slate-500 font-bold">땡스볼</span>
        </div>

        {/* 잔액 표시 */}
        {currentUserUid && userBallBalance !== null && (
          <p className="text-[10px] text-slate-500 mb-3 font-bold">
            보유: 🏀 {userBallBalance} 땡스볼
          </p>
        )}

        {/* 결제 버튼 — 3분기: 비로그인 / 잔액부족 / 정상 */}
        {!currentUserUid ? (
          <button
            disabled
            className="px-5 py-2 bg-slate-200 text-slate-500 rounded-lg text-[12px] font-[1000] cursor-not-allowed"
          >
            로그인이 필요합니다
          </button>
        ) : userBallBalance !== null && userBallBalance < price ? (
          <div>
            <button
              disabled
              className="px-5 py-2 bg-slate-200 text-slate-500 rounded-lg text-[12px] font-[1000] cursor-not-allowed mb-2"
            >
              땡스볼 부족
            </button>
            <p className="text-[10px] text-red-500 font-bold">
              {price - userBallBalance}볼이 부족합니다
            </p>
          </div>
        ) : (
          <button
            onClick={onUnlock}
            disabled={unlocking}
            className="px-5 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg text-[12px] font-[1000] transition-colors"
          >
            {unlocking ? '결제 중...' : `🏀 ${price}볼로 잠금 해제`}
          </button>
        )}
      </div>
    </div>
  );
};

export default PaywallOverlay;
