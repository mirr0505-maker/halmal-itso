// src/components/MarketDashboard.tsx — 강변 시장: 크리에이터 대시보드
// 수익 현황 + 판매글 관리 + 단골장부 구독자
import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, orderBy, getDocs, doc, updateDoc } from 'firebase/firestore';
import type { MarketItem, MarketShop, UserData } from '../types';
import { formatKoreanNumber } from '../utils';

interface Props {
  currentUserData: UserData;
  onBack: () => void;
  onItemClick: (itemId: string) => void;
}

const MarketDashboard = ({ currentUserData, onBack, onItemClick }: Props) => {
  const [activeTab, setActiveTab] = useState<'revenue' | 'items' | 'shop'>('revenue');
  const [myItems, setMyItems] = useState<MarketItem[]>([]);
  const [myShop, setMyShop] = useState<MarketShop | null>(null);
  const [loading, setLoading] = useState(true);

  // 내 판매글 조회
  useEffect(() => {
    getDocs(query(
      collection(db, 'market_items'),
      where('authorId', '==', currentUserData.uid),
      orderBy('createdAt', 'desc')
    )).then(snap => {
      setMyItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as MarketItem)));
    }).catch(() => {});
  }, [currentUserData.uid]);

  // 내 상점 조회
  useEffect(() => {
    getDocs(query(
      collection(db, 'market_shops'),
      where('creatorId', '==', currentUserData.uid)
    )).then(snap => {
      if (!snap.empty) setMyShop({ id: snap.docs[0].id, ...snap.docs[0].data() } as MarketShop);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [currentUserData.uid]);

  // 아이템 숨김/복귀 토글
  const handleToggleStatus = async (item: MarketItem) => {
    const newStatus = item.status === 'active' ? 'hidden' : 'active';
    await updateDoc(doc(db, 'market_items', item.id), { status: newStatus });
    setMyItems(prev => prev.map(i => i.id === item.id ? { ...i, status: newStatus } : i));
  };

  const totalSales = (currentUserData as UserData & { marketTotalSales?: number }).marketTotalSales || 0;
  const totalEarned = (currentUserData as UserData & { marketTotalEarned?: number }).marketTotalEarned || 0;
  const adRevenueTotal = (currentUserData as UserData & { marketAdRevenueTotal?: number }).marketAdRevenueTotal || 0;
  const activeItems = myItems.filter(i => i.status === 'active');
  const hiddenItems = myItems.filter(i => i.status === 'hidden');

  if (loading) return <div className="py-20 text-center text-slate-300 text-[12px] font-bold">불러오는 중...</div>;

  return (
    <div className="w-full max-w-[800px] mx-auto px-4 py-6">
      <button onClick={onBack} className="text-[12px] text-slate-500 hover:text-slate-900 font-bold mb-4 transition-colors">← 강변 시장으로</button>

      <h1 className="text-[18px] font-[1000] text-slate-900 mb-4">내 상점 관리</h1>

      {/* 탭 */}
      <div className="flex gap-1.5 mb-5">
        {([
          { id: 'revenue', label: '수익 현황' },
          { id: 'items', label: '판매글 관리' },
          { id: 'shop', label: '단골장부' },
        ] as const).map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-[1000] border transition-all ${
              activeTab === tab.id ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
            }`}>{tab.label}</button>
        ))}
      </div>

      {/* 수익 현황 */}
      {activeTab === 'revenue' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white border border-slate-100 rounded-xl p-4 text-center">
              <p className="text-[10px] font-bold text-slate-400 mb-1">판매 수익</p>
              <p className="text-[20px] font-[1000] text-slate-900">{formatKoreanNumber(totalEarned)}</p>
              <p className="text-[9px] font-bold text-slate-300">땡스볼</p>
            </div>
            <div className="bg-white border border-slate-100 rounded-xl p-4 text-center">
              <p className="text-[10px] font-bold text-slate-400 mb-1">광고 수익</p>
              <p className="text-[20px] font-[1000] text-slate-900">{formatKoreanNumber(adRevenueTotal)}</p>
              <p className="text-[9px] font-bold text-slate-300">땡스볼</p>
            </div>
            <div className="bg-white border border-slate-100 rounded-xl p-4 text-center">
              <p className="text-[10px] font-bold text-slate-400 mb-1">총 판매</p>
              <p className="text-[20px] font-[1000] text-slate-900">{totalSales}</p>
              <p className="text-[9px] font-bold text-slate-300">건</p>
            </div>
          </div>

          {myShop && (
            <div className="bg-white border border-slate-100 rounded-xl p-4">
              <p className="text-[10px] font-bold text-slate-400 mb-1">단골장부 구독자</p>
              <p className="text-[20px] font-[1000] text-slate-900">{formatKoreanNumber(myShop.subscriberCount)}명</p>
              <p className="text-[9px] font-bold text-slate-300">누적 수익: {formatKoreanNumber(myShop.totalRevenue)}볼</p>
            </div>
          )}
        </div>
      )}

      {/* 판매글 관리 */}
      {activeTab === 'items' && (
        <div className="space-y-3">
          {myItems.length === 0 ? (
            <p className="py-10 text-center text-slate-400 font-bold text-[12px]">등록된 판매글이 없습니다</p>
          ) : (
            <>
              {activeItems.length > 0 && (
                <div>
                  <p className="text-[11px] font-[1000] text-slate-500 mb-2">판매 중 ({activeItems.length})</p>
                  {activeItems.map(item => (
                    <ItemRow key={item.id} item={item} onToggle={handleToggleStatus} onClick={onItemClick} />
                  ))}
                </div>
              )}
              {hiddenItems.length > 0 && (
                <div className="mt-4">
                  <p className="text-[11px] font-[1000] text-slate-400 mb-2">숨김 ({hiddenItems.length})</p>
                  {hiddenItems.map(item => (
                    <ItemRow key={item.id} item={item} onToggle={handleToggleStatus} onClick={onItemClick} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* 단골장부 */}
      {activeTab === 'shop' && (
        <div>
          {myShop ? (
            <div className="bg-white border border-slate-100 rounded-xl p-5">
              <h3 className="text-[14px] font-[1000] text-slate-900 mb-1">{myShop.shopName}</h3>
              <p className="text-[12px] font-medium text-slate-500 mb-3">{myShop.shopDescription}</p>
              <div className="flex items-center gap-4 text-[11px] font-bold text-slate-400">
                <span>구독자 {myShop.subscriberCount}명</span>
                <span>{myShop.subscriptionPrice}볼 / 30일</span>
                <span>누적 수익 {formatKoreanNumber(myShop.totalRevenue)}볼</span>
              </div>
            </div>
          ) : (
            <p className="py-10 text-center text-slate-400 font-bold text-[12px]">단골장부를 아직 개설하지 않았습니다</p>
          )}
        </div>
      )}
    </div>
  );
};

// 판매글 1줄 — 제목 + 통계 + 숨김/복귀 토글
function ItemRow({ item, onToggle, onClick }: { item: MarketItem; onToggle: (item: MarketItem) => void; onClick: (id: string) => void }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border border-slate-100 rounded-lg mb-1.5 hover:border-slate-200 transition-all">
      <div className="min-w-0 flex-1 cursor-pointer" onClick={() => onClick(item.id)}>
        <p className="text-[13px] font-[1000] text-slate-800 truncate">{item.title}</p>
        <p className="text-[10px] font-bold text-slate-400 mt-0.5">
          {item.price}볼 · {item.purchaseCount}명 구매
          {item.ratingCount > 0 && ` · ${item.ratingAvg.toFixed(1)}`}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-3">
        <span className={`text-[9px] font-[1000] px-2 py-0.5 rounded-full ${
          item.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'
        }`}>{item.status === 'active' ? '판매 중' : '숨김'}</span>
        <button onClick={() => onToggle(item)}
          className="text-[10px] font-bold text-slate-400 hover:text-slate-700 transition-colors">
          {item.status === 'active' ? '숨김' : '복귀'}
        </button>
      </div>
    </div>
  );
}

export default MarketDashboard;
