// src/components/SubNavbar.tsx

type TabId = 'any' | 'recent' | 'best' | 'rank' | 'friend';

interface Props {
  activeTab: TabId;
  onTabClick: (tab: TabId) => void;
  showTabs: boolean;
}

// 🚀 탭 구분 화살표 — 컴포넌트 외부 선언으로 매 렌더마다 재생성 방지
const Chevron = () => (
  <div className="flex items-center text-slate-200 px-1 select-none">
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" />
    </svg>
  </div>
);

// 탭 그룹 구분선 — 컴포넌트 외부 선언으로 매 렌더마다 재생성 방지
const Divider = () => (
  <div className="flex items-center mx-4 select-none">
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
      className={`h-full text-[13px] font-[1000] tracking-tight relative transition-all flex items-center px-1 ${
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
    <div className="sticky top-0 z-30 bg-[#F8FAFC]/80 backdrop-blur-md pt-2">
      <div className="flex items-center border-b border-slate-200 h-[36px] px-2">
        <div className="flex items-center h-full">
          {/* 단계별 게시글 탭 그룹 */}
          <div className="flex items-center h-full gap-1">
            {renderTab('any', '새글', activeTab, onTabClick)}
            <Chevron />
            {renderTab('recent', '등록글', activeTab, onTabClick)}
            <Chevron />
            {renderTab('best', '인기글', activeTab, onTabClick)}
            <Chevron />
            {renderTab('rank', '최고글', activeTab, onTabClick)}
          </div>

          {/* 분리된 깐부글 영역 */}
          <Divider />
          <div className="flex items-center h-full">
            {renderTab('friend', '깐부글', activeTab, onTabClick)}
          </div>
        </div>
      </div>
      <div className="h-3" />
    </div>
  );
};

export default SubNavbar;
