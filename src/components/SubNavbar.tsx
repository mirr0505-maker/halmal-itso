// src/components/SubNavbar.tsx

interface Props {
  activeTab: 'any' | 'recent' | 'best' | 'rank';
  setActiveTab: (tab: 'any' | 'recent' | 'best' | 'rank') => void;
}

const SubNavbar = ({ activeTab, setActiveTab }: Props) => {
  const tabs = [
    { id: 'any', label: '타운 홀 (전체글)' },
    { id: 'recent', label: '주목말 (급상승)' },
    { id: 'best', label: '대세말 (인기글)' },
    { id: 'rank', label: '명예말 (랭킹)' },
  ];

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-16 z-30">
      <div className="max-w-6xl mx-auto px-6 flex gap-6 overflow-x-auto no-scrollbar">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`py-4 text-sm font-black transition-all whitespace-nowrap border-b-2 ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
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