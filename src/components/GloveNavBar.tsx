// src/components/GloveNavBar.tsx — 우리들의 장갑 서브 탭 네비게이션
// 🚀 탭: 장갑 속 친구들 | 나의 아늑한 장갑 | 장갑 속 소곤소곤 | 장갑 나누기

type GloveTab = 'list' | 'mine' | 'feed' | 'create';

interface Props {
  activeTab: GloveTab;
  onTabClick: (tab: GloveTab) => void;
}

const TABS: { id: GloveTab; label: string; desc: string }[] = [
  { id: 'list',   label: '🧤 장갑 속 친구들',    desc: '전체 커뮤니티' },
  { id: 'mine',   label: '❤️ 나의 아늑한 장갑',  desc: '내가 가입한 곳' },
  { id: 'feed',   label: '💬 장갑 속 소곤소곤',   desc: '가입 커뮤니티 최신글' },
  { id: 'create', label: '✨ 장갑 나누기',         desc: '새 커뮤니티 개설' },
];

const GloveNavBar = ({ activeTab, onTabClick }: Props) => {
  return (
    <div className="w-full mb-4">
      {/* 탭 버튼 */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => onTabClick(tab.id)}
            className={`shrink-0 flex flex-col items-start px-4 py-2.5 rounded-xl border-2 transition-all ${
              activeTab === tab.id && tab.id !== 'create'
                ? 'bg-blue-50 border-blue-200 text-blue-700'
                : tab.id === 'create'
                  ? 'bg-slate-900 border-slate-900 text-white hover:bg-blue-600 hover:border-blue-600'
                  : 'bg-white border-slate-100 text-slate-500 hover:border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span className="text-[12px] font-[1000] leading-none">{tab.label}</span>
            <span className={`text-[9px] font-bold mt-0.5 leading-none ${tab.id === 'create' ? 'text-slate-300' : activeTab === tab.id ? 'text-blue-500' : 'text-slate-300'}`}>
              {tab.desc}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default GloveNavBar;
