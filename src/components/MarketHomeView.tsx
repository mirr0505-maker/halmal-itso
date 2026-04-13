// src/components/MarketHomeView.tsx — 강변 시장 메인 화면
// 가판대(단건 판매) + 단골장부(구독 상점) 2탭 구조
// 차분한 슬레이트 톤 — 기존 글카드 분위기와 통일
import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import type { MarketItem, MarketShop, UserData } from '../types';
import { calculateLevel } from '../utils';

interface Props {
  currentUserData: UserData | null;
  allUsers: Record<string, UserData>;
}

const MARKET_CATEGORIES: { id: string; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'stock', label: '주식' },
  { id: 'coin', label: '코인' },
  { id: 'realestate', label: '부동산' },
  { id: 'life', label: '생활정보' },
  { id: 'selfdev', label: '자기계발' },
  { id: 'essay', label: '창작/에세이' },
  { id: 'etc', label: '기타' },
];

const MarketHomeView = ({ currentUserData, allUsers }: Props) => {
  const [activeTab, setActiveTab] = useState<'stall' | 'subscription'>('stall');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [items, setItems] = useState<MarketItem[]>([]);
  const [shops, setShops] = useState<MarketShop[]>([]);
  const [loading, setLoading] = useState(true);

  // 가판대 아이템 조회
  useEffect(() => {
    if (activeTab !== 'stall') return;
    setLoading(true);
    const q = selectedCategory === 'all'
      ? query(collection(db, 'market_items'), where('status', '==', 'active'), orderBy('createdAt', 'desc'), limit(50))
      : query(collection(db, 'market_items'), where('status', '==', 'active'), where('category', '==', selectedCategory), orderBy('createdAt', 'desc'), limit(50));
    getDocs(q).then(snap => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as MarketItem)));
    }).catch(() => setItems([])).finally(() => setLoading(false));
  }, [activeTab, selectedCategory]);

  // 단골장부 상점 조회
  useEffect(() => {
    if (activeTab !== 'subscription') return;
    setLoading(true);
    getDocs(query(collection(db, 'market_shops'), where('status', '==', 'active'), orderBy('subscriberCount', 'desc'), limit(50)))
      .then(snap => {
        setShops(snap.docs.map(d => ({ id: d.id, ...d.data() } as MarketShop)));
      }).catch(() => setShops([])).finally(() => setLoading(false));
  }, [activeTab]);

  const userLevel = currentUserData ? calculateLevel(currentUserData.exp || 0) : 0;

  return (
    <div className="w-full max-w-[860px] mx-auto pb-20 animate-in fade-in">
      {/* 헤더 — 한 줄: 탭 + 판매글 작성 */}
      <div className="sticky top-[48px] z-10 bg-white/95 backdrop-blur-sm border-b border-slate-100 -mx-4 px-4 pb-3 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {([
              { id: 'stall', label: '가판대', desc: '단건 판매' },
              { id: 'subscription', label: '단골장부', desc: '구독 상점' },
            ] as const).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all ${
                  activeTab === tab.id
                    ? 'bg-slate-900 border-slate-900 text-white'
                    : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
              >
                <span className="text-[12px] font-[1000]">{tab.label}</span>
                <span className={`text-[10px] font-bold hidden md:inline ${activeTab === tab.id ? 'text-slate-400' : 'text-slate-300'}`}>{tab.desc}</span>
              </button>
            ))}
          </div>
          {userLevel >= 3 && (
            <button className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-[11px] font-[1000] hover:bg-slate-700 transition-colors">
              + 판매글 작성
            </button>
          )}
        </div>

        {/* 가판대 카테고리 필터 */}
        {activeTab === 'stall' && (
          <div className="flex items-center gap-1.5 mt-2 overflow-x-auto">
            {MARKET_CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`shrink-0 px-3 py-1 rounded-full text-[11px] font-[1000] transition-all ${
                  selectedCategory === cat.id
                    ? 'bg-slate-700 text-white'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 콘텐츠 */}
      <div className="mt-4">
        {loading ? (
          <div className="py-40 text-center text-slate-300 text-[12px] font-bold">불러오는 중...</div>
        ) : activeTab === 'stall' ? (
          // 가판대 목록
          items.length === 0 ? (
            <div className="py-40 text-center">
              <p className="text-slate-400 font-[1000] text-[13px]">아직 판매글이 없습니다</p>
              <p className="text-slate-300 font-bold text-[11px] mt-1">첫 번째 판매글을 작성해보세요</p>
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
              {items.map(item => (
                <MarketItemCard key={item.id} item={item} allUsers={allUsers} />
              ))}
            </div>
          )
        ) : (
          // 단골장부 목록
          shops.length === 0 ? (
            <div className="py-40 text-center">
              <p className="text-slate-400 font-[1000] text-[13px]">아직 개설된 상점이 없습니다</p>
              <p className="text-slate-300 font-bold text-[11px] mt-1">Lv5 이상이면 단골장부를 개설할 수 있습니다</p>
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
              {shops.map(shop => (
                <MarketShopCard key={shop.id} shop={shop} allUsers={allUsers} />
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
};

// 가판대 아이템 카드 — 차분한 슬레이트 톤
function MarketItemCard({ item, allUsers }: { item: MarketItem; allUsers: Record<string, UserData> }) {
  const authorData = allUsers[`nickname_${item.authorNickname}`];
  return (
    <div className="border border-slate-100 rounded-xl overflow-hidden bg-white hover:border-slate-300 hover:shadow-md transition-all cursor-pointer group">
      {/* 표지 이미지 또는 카테고리 헤더 */}
      {item.coverImageUrl ? (
        <div className="aspect-[16/9] w-full bg-slate-100 overflow-hidden">
          <img src={item.coverImageUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        </div>
      ) : (
        <div className="h-2 w-full bg-slate-300" />
      )}
      <div className="px-4 py-3">
        {/* 카테고리 + 가격 */}
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-[1000] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{item.category}</span>
          <span className="text-[11px] font-[1000] text-slate-700">{item.price}볼</span>
        </div>
        {/* 제목 */}
        <h3 className="text-[13px] font-[1000] text-slate-900 group-hover:text-slate-600 transition-colors line-clamp-2 mb-1.5">
          {item.title}
        </h3>
        {/* 티저 */}
        <p className="text-[11px] font-medium text-slate-400 line-clamp-2 mb-2">
          {item.previewContent}
        </p>
        {/* 하단: 작성자 + 통계 */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-50">
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-slate-50 overflow-hidden shrink-0">
              <img src={authorData?.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${item.authorNickname}`} alt="" className="w-full h-full object-cover" />
            </div>
            <span className="text-[10px] font-bold text-slate-500">{item.authorNickname}</span>
            <span className="text-[9px] font-bold text-slate-300">Lv{item.authorLevel}</span>
          </div>
          <div className="flex items-center gap-2 text-[9px] font-bold text-slate-300">
            {item.ratingCount > 0 && (
              <span>{item.ratingAvg.toFixed(1)} ({item.ratingCount})</span>
            )}
            <span>{item.purchaseCount}명 구매</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// 단골장부 상점 카드 — 차분한 슬레이트 톤
function MarketShopCard({ shop, allUsers: _allUsers }: { shop: MarketShop; allUsers: Record<string, UserData> }) {
  return (
    <div className="border border-slate-100 rounded-xl overflow-hidden bg-white hover:border-slate-300 hover:shadow-md transition-all cursor-pointer group">
      {shop.coverImageUrl ? (
        <div className="aspect-[16/9] w-full bg-slate-100 overflow-hidden">
          <img src={shop.coverImageUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        </div>
      ) : (
        <div className="h-2 w-full bg-slate-400" />
      )}
      <div className="px-4 py-3">
        <h3 className="text-[13px] font-[1000] text-slate-900 group-hover:text-slate-600 transition-colors mb-1">
          {shop.shopName}
        </h3>
        <p className="text-[11px] font-medium text-slate-400 line-clamp-2 mb-2">
          {shop.shopDescription}
        </p>
        <div className="flex items-center justify-between pt-2 border-t border-slate-50">
          <span className="text-[10px] font-bold text-slate-500">구독자 {shop.subscriberCount}명</span>
          <span className="text-[11px] font-[1000] text-slate-700">{shop.subscriptionPrice}볼 / 30일</span>
        </div>
      </div>
    </div>
  );
}

export default MarketHomeView;
