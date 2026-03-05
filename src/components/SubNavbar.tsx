// src/components/SubNavbar.tsx

interface Props {
  activeTab: 'any' | 'recent' | 'best' | 'rank';
  onTabClick: (tab: 'any' | 'recent' | 'best' | 'rank') => void;
  showTabs: boolean;
}

const SubNavbar = ({ activeTab, onTabClick, showTabs }: Props) => {
  if (!showTabs) return null;
  
  return (
    <div className="flex items-center justify-between border-b border-slate-200 mb-6 sticky top-0 bg-[#F8FAFC] z-30 pt-0 h-[42px]">
      <div className="flex gap-8 px-2 h-full">
        {/* 🚀 사이드바 메뉴 높이(42px)와 정확히 일치시켜 수평 라인을 맞춤 */}
        <button 
          onClick={() => onTabClick('any')}
          className={`h-full text-[13px] font-[1000] tracking-tight relative transition-colors flex items-center ${activeTab === 'any' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}
        >
          아무말(전체글)
          {activeTab === 'any' && <span className="absolute bottom-0 left-0 w-full h-[3px] bg-blue-600 rounded-t-sm" />}
        </button>
        <button 
          onClick={() => onTabClick('recent')}
          className={`h-full text-[13px] font-[1000] tracking-tight relative transition-colors flex items-center ${activeTab === 'recent' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}
        >
          주목말
          {activeTab === 'recent' && <span className="absolute bottom-0 left-0 w-full h-[3px] bg-blue-600 rounded-t-sm" />}
        </button>
        <button 
          onClick={() => onTabClick('best')}
          className={`h-full text-[13px] font-[1000] tracking-tight relative transition-colors flex items-center ${activeTab === 'best' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}
        >
          대세말
          {activeTab === 'best' && <span className="absolute bottom-0 left-0 w-full h-[3px] bg-blue-600 rounded-t-sm" />}
        </button>
        <button 
          onClick={() => onTabClick('rank')}
          className={`h-full text-[13px] font-[1000] tracking-tight relative transition-colors flex items-center ${activeTab === 'rank' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}
        >
          명예말
          {activeTab === 'rank' && <span className="absolute bottom-0 left-0 w-full h-[3px] bg-blue-600 rounded-t-sm" />}
        </button>
      </div>
    </div>
  );
};

export default SubNavbar;