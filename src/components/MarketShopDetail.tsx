// src/components/MarketShopDetail.tsx — 강변 시장: 단골장부 상점 상세 + 구독
import { useState, useEffect } from 'react';
import { db, functions } from '../firebase';
import { doc, getDoc, onSnapshot, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import type { MarketShop, MarketItem, MarketSubscription, UserData } from '../types';
import { formatKoreanNumber } from '../utils';

interface Props {
  shopId: string;
  currentUserData: UserData | null;
  allUsers: Record<string, UserData>;
  onBack: () => void;
  onItemClick: (itemId: string) => void;
}

const MarketShopDetail = ({ shopId, currentUserData, allUsers, onBack, onItemClick }: Props) => {
  const [shop, setShop] = useState<MarketShop | null>(null);
  const [subscription, setSubscription] = useState<MarketSubscription | null>(null);
  const [creatorItems, setCreatorItems] = useState<MarketItem[]>([]);
  const [subscribing, setSubscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 상점 실시간 구독
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'market_shops', shopId), (snap) => {
      if (snap.exists()) setShop({ id: snap.id, ...snap.data() } as MarketShop);
    });
    return unsub;
  }, [shopId]);

  // 내 구독 상태 확인
  useEffect(() => {
    if (!currentUserData || !shop) return;
    const subId = `${shop.creatorId}_${currentUserData.uid}`;
    getDoc(doc(db, 'market_subscriptions', subId)).then(snap => {
      if (snap.exists()) setSubscription(snap.data() as MarketSubscription);
    }).catch(() => {});
  }, [shopId, currentUserData, shop]);

  // 크리에이터의 판매글 목록
  useEffect(() => {
    if (!shop) return;
    getDocs(query(
      collection(db, 'market_items'),
      where('authorId', '==', shop.creatorId),
      where('status', '==', 'active'),
      orderBy('createdAt', 'desc'),
      limit(20)
    )).then(snap => {
      setCreatorItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as MarketItem)));
    }).catch(() => {});
  }, [shop]);

  // 구독 처리
  const handleSubscribe = async () => {
    if (!currentUserData || !shop) return;
    setSubscribing(true);
    setError(null);
    try {
      const fn = httpsCallable(functions, 'subscribeMarketShop');
      const result = await fn({ shopId });
      const data = result.data as { success: boolean; alreadyActive?: boolean };
      if (data.alreadyActive) {
        setError('이미 활성 구독 중입니다.');
      } else {
        // 구독 완료 → 상태 리로드
        const subId = `${shop.creatorId}_${currentUserData.uid}`;
        const snap = await getDoc(doc(db, 'market_subscriptions', subId));
        if (snap.exists()) setSubscription(snap.data() as MarketSubscription);
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || '구독에 실패했습니다.');
    } finally { setSubscribing(false); }
  };

  if (!shop) return <div className="py-20 text-center text-slate-300 text-[12px] font-bold">불러오는 중...</div>;

  const isCreator = currentUserData?.uid === shop.creatorId;
  const isSubscribed = subscription?.isActive && subscription.expiresAt &&
    (subscription.expiresAt as unknown as { toMillis?: () => number }).toMillis
      ? (subscription.expiresAt as unknown as { toMillis: () => number }).toMillis() > Date.now()
      : false;
  const creatorData = allUsers[`nickname_${(shop as MarketShop & { creatorNickname?: string }).creatorNickname}`];

  return (
    <div className="w-full max-w-[800px] mx-auto px-4 py-6">
      <button onClick={onBack} className="text-[12px] text-slate-500 hover:text-slate-900 font-bold mb-4 transition-colors">← 목록으로</button>

      {/* 표지 */}
      {shop.coverImageUrl && (
        <div className="w-full aspect-[16/9] rounded-xl overflow-hidden mb-4 bg-slate-100">
          <img src={shop.coverImageUrl} alt="" className="w-full h-full object-cover" />
        </div>
      )}

      {/* 상점 정보 */}
      <h1 className="text-[20px] font-[1000] text-slate-900 mb-1">{shop.shopName}</h1>
      <p className="text-[13px] font-medium text-slate-500 mb-3">{shop.shopDescription}</p>

      {/* 크리에이터 + 통계 */}
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-slate-50 overflow-hidden border border-slate-200">
            <img src={creatorData?.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${shopId}`} alt="" className="w-full h-full object-cover" />
          </div>
          <span className="text-[13px] font-[1000] text-slate-800">{(shop as MarketShop & { creatorNickname?: string }).creatorNickname || '크리에이터'}</span>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400">
          <span>구독자 {formatKoreanNumber(shop.subscriberCount)}명</span>
          <span>{shop.subscriptionPrice}볼 / 30일</span>
        </div>
      </div>

      {/* 구독 상태 + 버튼 */}
      {!isCreator && (
        <div className="mb-6">
          {isSubscribed ? (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
              <p className="text-[13px] font-[1000] text-slate-700 mb-1">단골손님</p>
              <p className="text-[10px] font-bold text-slate-400">
                {subscription?.expiresAt && (subscription.expiresAt as unknown as { toDate: () => Date }).toDate
                  ? `${(subscription.expiresAt as unknown as { toDate: () => Date }).toDate().toLocaleDateString('ko-KR')}까지`
                  : '구독 중'}
              </p>
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center">
              <p className="text-[14px] font-[1000] text-slate-700 mb-1">단골장부 구독</p>
              <p className="text-[11px] font-bold text-slate-400 mb-3">30일간 구독 전용 콘텐츠를 열람할 수 있습니다</p>
              <div className="flex items-center justify-center gap-2 mb-3">
                <span className="text-[24px] font-[1000] text-slate-900">{shop.subscriptionPrice}</span>
                <span className="text-[12px] font-bold text-slate-500">땡스볼 / 30일</span>
              </div>
              {error && <p className="text-[11px] text-red-500 font-bold mb-2">{error}</p>}
              {currentUserData ? (
                <button onClick={handleSubscribe} disabled={subscribing}
                  className="px-8 py-2.5 bg-slate-900 hover:bg-slate-700 text-white rounded-xl text-[13px] font-[1000] disabled:opacity-50 transition-colors">
                  {subscribing ? '구독 중...' : '단골 되기'}
                </button>
              ) : (
                <p className="text-[11px] font-bold text-slate-400">로그인 후 구독할 수 있습니다</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* 크리에이터 판매글 목록 */}
      <div>
        <h2 className="text-[13px] font-[1000] text-slate-700 mb-3">판매글 ({creatorItems.length})</h2>
        {creatorItems.length === 0 ? (
          <p className="text-[11px] font-bold text-slate-300 py-8 text-center">아직 등록된 판매글이 없습니다</p>
        ) : (
          <div className="flex flex-col gap-2">
            {creatorItems.map(item => (
              <div key={item.id} onClick={() => onItemClick(item.id)}
                className="flex items-center justify-between px-4 py-3 border border-slate-100 rounded-lg hover:border-slate-300 transition-all cursor-pointer">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-[1000] text-slate-800 truncate">{item.title}</p>
                  <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                    {item.category} · {item.purchaseCount}명 구매
                    {item.ratingCount > 0 && ` · ${item.ratingAvg.toFixed(1)}`}
                  </p>
                </div>
                <span className="text-[12px] font-[1000] text-slate-700 shrink-0 ml-3">{item.price}볼</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MarketShopDetail;
