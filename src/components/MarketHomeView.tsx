// src/components/MarketHomeView.tsx — 강변 시장 메인 화면
// 가판대(단건 판매) + 단골장부(구독 상점) 2탭 구조
// 차분한 슬레이트 톤 — 기존 글카드 분위기와 통일
import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import type { MarketItem, MarketShop, UserData } from '../types';
import { calculateLevel } from '../utils';
import MarketItemDetail from './MarketItemDetail';
import MarketItemEditor from './MarketItemEditor';
import MarketShopDetail from './MarketShopDetail';
import MarketShopEditor from './MarketShopEditor';
import MarketDashboard from './MarketDashboard';

interface Props {
  currentUserData: UserData | null;
  allUsers: Record<string, UserData>;
}

// 황금알을 낳는 거위와 동일한 분야 체계
const INFO_GROUPS: { label: string; items: string[] }[] = [
  { label: '금융·투자', items: ['주식', '코인', '부동산', '재테크', '금융'] },
  { label: '경제·경영', items: ['경제', '경영', '창업', '세금', '정책'] },
  { label: '사회·정치', items: ['정치', '사회', '글로벌'] },
  { label: '지식·학문', items: ['IT', '컴퓨터', '과학', '교육', '외국어', '역사', '철학', '인문', '문학', '종교'] },
  { label: '엔터·문화', items: ['게임', '애니메이션', '방송', '영화', '음악', '문화예술'] },
  { label: '라이프',   items: ['여행', '스포츠', '반려동물', '취미', '생활', '패션미용', '건강', '육아'] },
];

const MarketHomeView = ({ currentUserData, allUsers }: Props) => {
  const [activeTab, setActiveTab] = useState<'stall' | 'subscription'>('stall');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [filterGroup, setFilterGroup] = useState<number | null>(null);
  const [items, setItems] = useState<MarketItem[]>([]);
  const [shops, setShops] = useState<MarketShop[]>([]);
  const [loading, setLoading] = useState(true);
  // 상세뷰 / 작성 모드
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingItem, setEditingItem] = useState<MarketItem | null>(null);
  const [editingContent, setEditingContent] = useState<string | null>(null);
  const [isCreatingShop, setIsCreatingShop] = useState(false);
  const [isDashboard, setIsDashboard] = useState(false);
  // 목록 리로드 트리거
  const [reloadKey, setReloadKey] = useState(0);

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
  }, [activeTab, selectedCategory, reloadKey]);

  // 단골장부 상점 조회
  useEffect(() => {
    if (activeTab !== 'subscription') return;
    setLoading(true);
    getDocs(query(collection(db, 'market_shops'), where('status', '==', 'active'), orderBy('subscriberCount', 'desc'), limit(50)))
      .then(snap => {
        setShops(snap.docs.map(d => ({ id: d.id, ...d.data() } as MarketShop)));
      }).catch(() => setShops([])).finally(() => setLoading(false));
  }, [activeTab, reloadKey]);

  const userLevel = currentUserData ? calculateLevel(currentUserData.exp || 0) : 0;

  // 아이템 상세뷰
  if (selectedItemId) {
    return <MarketItemDetail itemId={selectedItemId} currentUserData={currentUserData} allUsers={allUsers}
      onBack={() => setSelectedItemId(null)}
      onEdit={(item, content) => { setSelectedItemId(null); setEditingItem(item); setEditingContent(content); setIsEditing(true); }} />;
  }

  // 상점 상세뷰
  if (selectedShopId) {
    return <MarketShopDetail shopId={selectedShopId} currentUserData={currentUserData} allUsers={allUsers}
      onBack={() => setSelectedShopId(null)} onItemClick={(id) => { setSelectedShopId(null); setSelectedItemId(id); }} />;
  }

  // 판매글 작성
  if (isEditing && currentUserData) {
    return <MarketItemEditor currentUserData={currentUserData} editingItem={editingItem} editingContent={editingContent}
      onSuccess={() => { setIsEditing(false); setEditingItem(null); setEditingContent(null); setReloadKey(k => k + 1); }}
      onCancel={() => { setIsEditing(false); setEditingItem(null); setEditingContent(null); }} />;
  }

  // 상점 개설
  if (isCreatingShop && currentUserData) {
    return <MarketShopEditor currentUserData={currentUserData} onSuccess={() => { setIsCreatingShop(false); setReloadKey(k => k + 1); }} onCancel={() => setIsCreatingShop(false)} />;
  }

  // 대시보드
  if (isDashboard && currentUserData) {
    return <MarketDashboard currentUserData={currentUserData} onBack={() => setIsDashboard(false)}
      onItemClick={(id) => { setIsDashboard(false); setSelectedItemId(id); }} />;
  }

  return (
    <div className="w-full pb-4 animate-in fade-in">
      {/* 헤더 — 잉크병/장갑 패턴: sticky top-0, 전체 폭 */}
      <div className="sticky top-0 z-30 bg-[#F8FAFC]/80 backdrop-blur-md pt-2">
        <div className="flex items-center justify-between border-b border-slate-200 h-[44px] gap-3">
          {/* 좌: 타이틀 */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-slate-600 font-black text-[15px]">#</span>
            <h2 className="text-[14px] font-[1000] text-slate-900 tracking-tighter whitespace-nowrap">강변 시장</h2>
            <div className="w-px h-3 bg-slate-200 mx-1.5 hidden md:block" />
            <p className="text-[11px] font-bold text-slate-400 hidden md:block whitespace-nowrap">크리에이터가 지식·감성·정보를 판매하는 크리에이터 이코노미</p>
          </div>
          {/* 우: 탭 + 판매글 작성 — 장갑 패턴 동일 */}
          <div className="flex items-center gap-1.5 shrink-0">
            {([
              { id: 'stall', label: '가판대', desc: '단건 판매' },
              { id: 'subscription', label: '단골장부', desc: '구독 상점' },
            ] as const).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all ${
                  activeTab === tab.id
                    ? 'bg-blue-50 border-blue-200 text-blue-700'
                    : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
              >
                <span className="text-[12px] font-[1000] whitespace-nowrap">{tab.label}</span>
                <span className={`text-[10px] font-bold hidden md:inline whitespace-nowrap ${activeTab === tab.id ? 'text-blue-400' : 'text-slate-300'}`}>{tab.desc}</span>
              </button>
            ))}
            {userLevel >= 3 && (
              <button onClick={() => setIsDashboard(true)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 text-[11px] font-[1000] whitespace-nowrap transition-all">
                내 상점
              </button>
            )}
            {userLevel >= (activeTab === 'subscription' ? 5 : 3) && (
              <button onClick={() => activeTab === 'subscription' ? setIsCreatingShop(true) : setIsEditing(true)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-blue-600 text-white border border-slate-900 hover:border-blue-600 transition-all">
                <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
                <span className="text-[11px] font-[1000] whitespace-nowrap">{activeTab === 'subscription' ? '상점 개설' : '판매글 작성'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 카테고리 필터 — 그룹탭 + 세부항목 */}
      {activeTab === 'stall' && (
        <div className="px-1 pt-3 pb-1">
          {/* 전체 + 그룹탭 */}
          <div className="flex items-center gap-1.5 flex-wrap mb-2">
            <button onClick={() => setSelectedCategory('all')}
              className={`shrink-0 px-3 py-1 rounded-full text-[10px] font-[1000] border transition-all ${
                selectedCategory === 'all' ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
              }`}>전체</button>
            {INFO_GROUPS.map((g, i) => (
              <button key={g.label} onClick={() => { setFilterGroup(i); setSelectedCategory(g.items[0]); }}
                className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-[1000] border transition-all ${
                  filterGroup === i && selectedCategory !== 'all' ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                }`}>{g.label}</button>
            ))}
          </div>
          {/* 세부 항목 */}
          {selectedCategory !== 'all' && filterGroup !== null && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {INFO_GROUPS[filterGroup].items.map(item => (
                <button key={item} onClick={() => setSelectedCategory(item)}
                  className={`shrink-0 px-3 py-1 rounded-full text-[11px] font-bold border transition-all ${
                    selectedCategory === item ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-400'
                  }`}>{item}</button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 콘텐츠 */}
      <div className={activeTab === 'stall' ? 'mt-1' : 'mt-4'}>
        {loading ? (
          <div className="py-20 text-center text-slate-300 text-[12px] font-bold">불러오는 중...</div>
        ) : activeTab === 'stall' ? (
          // 가판대 목록
          items.length === 0 ? (
            <div className="py-20 text-center">
              <p className="text-slate-400 font-[1000] text-[13px]">아직 판매글이 없습니다</p>
              <p className="text-slate-300 font-bold text-[11px] mt-1">첫 번째 판매글을 작성해보세요</p>
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
              {items.map(item => (
                <div key={item.id} onClick={() => setSelectedItemId(item.id)}>
                  <MarketItemCard item={item} allUsers={allUsers} />
                </div>
              ))}
            </div>
          )
        ) : (
          // 단골장부 목록
          shops.length === 0 ? (
            <div className="py-20 text-center">
              <p className="text-slate-400 font-[1000] text-[13px]">아직 개설된 상점이 없습니다</p>
              <p className="text-slate-300 font-bold text-[11px] mt-1">Lv5 이상이면 단골장부를 개설할 수 있습니다</p>
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
              {shops.map(shop => (
                <div key={shop.id} onClick={() => setSelectedShopId(shop.id)}>
                  <MarketShopCard shop={shop} allUsers={allUsers} />
                </div>
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
