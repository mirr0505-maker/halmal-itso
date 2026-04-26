// src/components/SubNavbar.tsx
// 🔧 2026-04-25: 모바일 폭 좁을 때 탭이 두 줄/잘림 사고 → 가로 스크롤 fallback + 모바일 폰트·패딩 축소

type TabId = 'any' | 'recent' | 'best' | 'rank' | 'friend' | 'subscribed';

interface Props {
  activeTab: TabId;
  onTabClick: (tab: TabId) => void;
  showTabs: boolean;
}

// 🚀 탭 구분 화살표 — 컴포넌트 외부 선언으로 매 렌더마다 재생성 방지
const Chevron = () => (
  <div className="flex items-center text-slate-200 px-0.5 md:px-1 select-none shrink-0">
    <svg className="w-3 h-3 md:w-3.5 md:h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" />
    </svg>
  </div>
);

// 탭 그룹 구분선 — 컴포넌트 외부 선언으로 매 렌더마다 재생성 방지
const Divider = () => (
  <div className="flex items-center mx-1.5 md:mx-4 select-none shrink-0">
    <div className="w-[1.5px] h-4 bg-slate-200" />
  </div>
);

// 개별 탭 버튼 렌더 헬퍼 (컴포넌트 아님 — activeTab/onTabClick을 인자로 받음)
const renderTab = (
  id: TabId,
  label: string,
  activeTab: TabId,
  onTabClick: (tab: TabId) => void
) => {
  const isActive = activeTab === id;
  return (
    <button
      key={id}
      onClick={() => onTabClick(id)}
      className={`h-full text-[11px] md:text-[13px] font-[1000] tracking-tight relative transition-all flex items-center px-0.5 md:px-1 whitespace-nowrap shrink-0 ${
        isActive ? 'text-blue-600' : 'text-slate-400 hover:text-slate-800'
      }`}
    >
      {label}
      {isActive && (
        <span className="absolute bottom-0 left-0 w-full h-[3px] bg-blue-600 rounded-t-full animate-in fade-in slide-in-from-bottom-1" />
      )}
    </button>
  );
};

const SubNavbar = ({ activeTab, onTabClick, showTabs }: Props) => {
  if (!showTabs) return null;

  return (
    <div className="sticky top-0 z-30 bg-[#F8FAFC]/80 backdrop-blur-md pt-2 overflow-hidden">
      {/* 가로 스크롤 fallback — 좁은 폭에서 한 줄에 안 들어갈 때 부드럽게 스와이프 가능 */}
      <div className="overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <div className="flex items-center border-b border-slate-200 h-[36px] px-2 md:px-4 min-w-max">
          <div className="flex items-center h-full">
            {/* 단계별 게시글 탭 그룹 */}
            <div className="flex items-center h-full gap-0.5 md:gap-1">
              {renderTab('any', '새글', activeTab, onTabClick)}
              <Chevron />
              {renderTab('recent', '등록글', activeTab, onTabClick)}
              <Chevron />
              {renderTab('best', '인기글', activeTab, onTabClick)}
              <Chevron />
              {renderTab('rank', '최고글', activeTab, onTabClick)}
            </div>

            {/* 분리된 깐부글 + 구독글 영역 */}
            <Divider />
            <div className="flex items-center h-full gap-0.5 md:gap-1">
              {renderTab('friend', '깐부글', activeTab, onTabClick)}
              <Chevron />
              {renderTab('subscribed', '구독글', activeTab, onTabClick)}
            </div>
          </div>
        </div>
      </div>
      <div className="h-3" />
    </div>
  );
};

export default SubNavbar;
