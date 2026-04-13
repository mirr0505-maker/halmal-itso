// src/components/MarketItemDetail.tsx — 강변 시장: 가판대 아이템 상세 + 페이월 + 리뷰
// 미구매자: 티저 + 페이월 오버레이 / 구매자: 전체 본문 + 리뷰 작성
import { useState, useEffect } from 'react';
import { db, functions } from '../firebase';
import { doc, getDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import type { MarketItem, MarketPurchase, UserData } from '../types';
import { sanitizeHtml } from '../sanitize';
import { formatKoreanNumber } from '../utils';

interface Props {
  itemId: string;
  currentUserData: UserData | null;
  allUsers: Record<string, UserData>;
  onBack: () => void;
}

const MarketItemDetail = ({ itemId, currentUserData, allUsers, onBack }: Props) => {
  const [item, setItem] = useState<MarketItem | null>(null);
  const [purchase, setPurchase] = useState<MarketPurchase | null>(null);
  const [privateContent, setPrivateContent] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 리뷰
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  // 아이템 실시간 구독
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'market_items', itemId), (snap) => {
      if (snap.exists()) setItem({ id: snap.id, ...snap.data() } as MarketItem);
    });
    return unsub;
  }, [itemId]);

  // 구매 여부 확인
  useEffect(() => {
    if (!currentUserData) return;
    const purchaseId = `${itemId}_${currentUserData.uid}`;
    getDoc(doc(db, 'market_purchases', purchaseId)).then(snap => {
      if (snap.exists()) {
        const data = snap.data() as MarketPurchase;
        setPurchase(data);
        if (data.rating) setRating(data.rating);
        if (data.review) setReview(data.review);
      }
    }).catch(() => {});
  }, [itemId, currentUserData]);

  // 구매자면 본문 로드
  useEffect(() => {
    if (!purchase && !(currentUserData && item?.authorId === currentUserData.uid)) return;
    getDoc(doc(db, 'market_items', itemId, 'private_data', 'content')).then(snap => {
      if (snap.exists()) setPrivateContent(snap.data().body || '');
    }).catch(() => {});
  }, [purchase, item, currentUserData, itemId]);

  // 구매 처리
  const handlePurchase = async () => {
    if (!currentUserData || !item) return;
    setPurchasing(true);
    setError(null);
    try {
      const fn = httpsCallable(functions, 'purchaseMarketItem');
      const result = await fn({ itemId });
      const data = result.data as { success: boolean; alreadyPurchased: boolean };
      if (data.success) {
        // 구매 완료 → 영수증 로드
        const snap = await getDoc(doc(db, 'market_purchases', `${itemId}_${currentUserData.uid}`));
        if (snap.exists()) setPurchase(snap.data() as MarketPurchase);
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || '구매에 실패했습니다.');
    } finally { setPurchasing(false); }
  };

  // 리뷰 제출
  const handleReviewSubmit = async () => {
    if (!currentUserData || !purchase || rating === 0) return;
    setReviewSubmitting(true);
    try {
      const purchaseId = `${itemId}_${currentUserData.uid}`;
      await updateDoc(doc(db, 'market_purchases', purchaseId), {
        rating,
        review: review.trim() || null,
        reviewedAt: new Date(),
      });
      // ratingAvg 재계산은 간단히 클라이언트에서 처리 (MVP)
      if (item) {
        const newCount = (item.ratingCount || 0) + (purchase.rating ? 0 : 1);
        const oldTotal = (item.ratingAvg || 0) * (item.ratingCount || 0);
        const newTotal = oldTotal - (purchase.rating || 0) + rating;
        const newAvg = newCount > 0 ? newTotal / newCount : 0;
        await updateDoc(doc(db, 'market_items', itemId), {
          ratingAvg: Math.round(newAvg * 10) / 10,
          ratingCount: newCount,
        });
      }
      setPurchase(prev => prev ? { ...prev, rating, review: review.trim() } : prev);
    } catch { setError('리뷰 등록에 실패했습니다.'); }
    finally { setReviewSubmitting(false); }
  };

  if (!item) return <div className="py-20 text-center text-slate-300 text-[12px] font-bold">불러오는 중...</div>;

  const isAuthor = currentUserData?.uid === item.authorId;
  const isPurchased = !!purchase || isAuthor;
  const authorData = allUsers[`nickname_${item.authorNickname}`];

  return (
    <div className="w-full max-w-[800px] mx-auto px-4 py-6">
      {/* 상단 */}
      <button onClick={onBack} className="text-[12px] text-slate-500 hover:text-slate-900 font-bold mb-4 transition-colors">← 목록으로</button>

      {/* 표지 */}
      {item.coverImageUrl && (
        <div className="w-full aspect-[16/9] rounded-xl overflow-hidden mb-4 bg-slate-100">
          <img src={item.coverImageUrl} alt="" className="w-full h-full object-cover" />
        </div>
      )}

      {/* 메타 */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-[1000] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{item.category}</span>
        {item.tags?.map(t => (
          <span key={t} className="text-[10px] font-bold text-slate-400">#{t}</span>
        ))}
      </div>

      <h1 className="text-[20px] font-[1000] text-slate-900 mb-2">{item.title}</h1>

      {/* 작성자 */}
      <div className="flex items-center gap-2 mb-4 pb-4 border-b border-slate-100">
        <div className="w-8 h-8 rounded-full bg-slate-50 overflow-hidden border border-slate-200">
          <img src={authorData?.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${item.authorNickname}`} alt="" className="w-full h-full object-cover" />
        </div>
        <div>
          <span className="text-[13px] font-[1000] text-slate-800">{item.authorNickname}</span>
          <span className="text-[10px] font-bold text-slate-400 ml-1.5">Lv{item.authorLevel}</span>
        </div>
        <div className="ml-auto flex items-center gap-3 text-[10px] font-bold text-slate-400">
          {item.ratingCount > 0 && <span>{item.ratingAvg.toFixed(1)} ({item.ratingCount})</span>}
          <span>{formatKoreanNumber(item.purchaseCount)}명 구매</span>
        </div>
      </div>

      {/* 미리보기 (항상 표시) */}
      <div className="text-[14px] font-medium text-slate-700 leading-[1.8] mb-4">
        {item.previewContent}
      </div>

      {/* 페이월 또는 전체 본문 */}
      {isPurchased && privateContent ? (
        <>
          <div className="border-t border-slate-100 pt-4">
            <div
              className="text-[15px] font-medium text-slate-700 leading-[1.8] [&_p]:mb-3 [&_strong]:font-bold [&_em]:italic [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_img]:rounded-lg [&_img]:max-w-full [&_a]:text-blue-400 [&_a]:underline"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(privateContent) }}
            />
          </div>

          {/* 리뷰 작성 (구매자 전용, 작성자 제외) */}
          {!isAuthor && purchase && (
            <div className="mt-6 pt-4 border-t border-slate-100">
              <p className="text-[12px] font-[1000] text-slate-600 mb-2">{purchase.rating ? '리뷰 수정' : '리뷰 작성'}</p>
              {/* 별점 */}
              <div className="flex gap-1 mb-2">
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} type="button" onClick={() => setRating(n)}
                    className={`text-[20px] transition-colors ${n <= rating ? 'text-amber-400' : 'text-slate-200'}`}>
                    ★
                  </button>
                ))}
              </div>
              {/* 한 줄 평 */}
              <input type="text" value={review} onChange={(e) => setReview(e.target.value)} maxLength={100}
                placeholder="한 줄 평 (선택)"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[12px] focus:outline-none focus:border-slate-400 mb-2" />
              <button onClick={handleReviewSubmit} disabled={reviewSubmitting || rating === 0}
                className="px-4 py-1.5 bg-slate-900 text-white rounded-lg text-[11px] font-[1000] hover:bg-slate-700 disabled:opacity-50 transition-colors">
                {reviewSubmitting ? '등록 중...' : '리뷰 등록'}
              </button>
            </div>
          )}
        </>
      ) : (
        /* 페이월 오버레이 */
        <div className="relative">
          <div className="h-24 bg-gradient-to-b from-transparent to-white pointer-events-none" />
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center">
            <p className="text-[14px] font-[1000] text-slate-700 mb-1">유료 콘텐츠</p>
            <p className="text-[11px] font-bold text-slate-400 mb-4">구매 후 전체 본문을 열람할 수 있습니다</p>
            <div className="flex items-center justify-center gap-2 mb-3">
              <span className="text-[24px] font-[1000] text-slate-900">{item.price}</span>
              <span className="text-[12px] font-bold text-slate-500">땡스볼</span>
            </div>
            {error && <p className="text-[11px] text-red-500 font-bold mb-2">{error}</p>}
            {currentUserData ? (
              <button onClick={handlePurchase} disabled={purchasing}
                className="px-8 py-2.5 bg-slate-900 hover:bg-slate-700 text-white rounded-xl text-[13px] font-[1000] disabled:opacity-50 transition-colors">
                {purchasing ? '구매 중...' : '구매하기'}
              </button>
            ) : (
              <p className="text-[11px] font-bold text-slate-400">로그인 후 구매할 수 있습니다</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketItemDetail;
