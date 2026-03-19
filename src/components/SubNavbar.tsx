// src/components/SubNavbar.tsx

interface Props {
  activeTab: 'any' | 'recent' | 'best' | 'rank' | 'friend';
  onTabClick: (tab: 'any' | 'recent' | 'best' | 'rank' | 'friend') => void;
  showTabs: boolean;
}

const SubNavbar = ({ activeTab, onTabClick, showTabs }: Props) => {
  if (!showTabs) return null;

  const renderTab = (id: 'any' | 'recent' | 'best' | 'rank' | 'friend', label: string) => {
    const isActive = activeTab === id;
    return (
      <button
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

  const Chevron = () => (
    <div className="flex items-center text-slate-200 px-1 select-none">
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" />
      </svg>
    </div>
  );

  const Divider = () => (
    <div className="flex items-center mx-4 select-none">
      <div className="w-[1.5px] h-4 bg-slate-200" />
    </div>
  );

  return (
    <div className="sticky top-0 z-30 bg-[#F8FAFC]/80 backdrop-blur-md pt-2">
      <div className="flex items-center border-b border-slate-200 h-[36px] px-2">
        <div className="flex items-center h-full">
          {/* 단계별 게시글 탭 그룹 */}
          <div className="flex items-center h-full gap-1">
            {renderTab('any', '새글')}
            <Chevron />
            {renderTab('recent', '등록글')}
            <Chevron />
            {renderTab('best', '인기글')}
            <Chevron />
            {renderTab('rank', '최고글')}
          </div>

          {/* 분리된 깐부글 영역 */}
          <Divider />
          <div className="flex items-center h-full">
            {renderTab('friend', '깐부글')}
          </div>
        </div>
      </div>
      <div className="h-3" />
    </div>
  );
};

export default SubNavbar;
