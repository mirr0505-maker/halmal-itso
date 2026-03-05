// src/components/SubNavbar.tsx

interface Props {
  activeTab: 'any' | 'recent' | 'best' | 'rank';
  setActiveTab: (tab: 'any' | 'recent' | 'best' | 'rank') => void;
}

const SubNavbar = ({ activeTab, setActiveTab }: Props) => {
  const tabs = [
    { id: 'any', label: '아무말(전체글)' },
    { id: 'recent', label: '주목말' },
    { id: 'best', label: '대세말' },
    { id: 'rank', label: '명예말' },
  ];

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-[56px] z-30 h-[48px] flex items-center">
      <div className="flex gap-10 overflow-x-auto no-scrollbar h-full px-4">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`h-full px-1 text-[12.5px] font-[1000] transition-all whitespace-nowrap border-b-2 flex items-center ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-400 hover:text-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </nav>
  );
};

export default SubNavbar;
