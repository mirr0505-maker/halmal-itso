// src/components/GloveNavBar.tsx — 우리들의 장갑 서브 탭 네비게이션
// 🚀 탭 2개(소곤소곤·장갑찾기) + 장갑 만들기 버튼

export type GloveTab = 'feed' | 'list';

interface Props {
  activeTab: GloveTab;
  onTabClick: (tab: GloveTab) => void;
  onCreateClick: () => void;
}

const TABS: { id: GloveTab; label: string; desc: string }[] = [
  { id: 'feed', label: '💬 소곤소곤',  desc: '가입 장갑 피드' },
  { id: 'list', label: '🧤 장갑 찾기', desc: '전체 커뮤니티' },
];

const GloveNavBar = ({ activeTab, onTabClick, onCreateClick }: Props) => {
  return (
    <div className="w-full mb-4 flex items-center gap-2">
      {/* 탭 버튼 */}
      <div className="flex gap-1.5 flex-1">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => onTabClick(tab.id)}
            className={`shrink-0 flex flex-col items-start px-4 py-2.5 rounded-xl border-2 transition-all ${
              activeTab === tab.id
                ? 'bg-blue-50 border-blue-200 text-blue-700'
                : 'bg-white border-slate-100 text-slate-500 hover:border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span className="text-[12px] font-[1000] leading-none">{tab.label}</span>
            <span className={`text-[9px] font-bold mt-0.5 leading-none ${activeTab === tab.id ? 'text-blue-500' : 'text-slate-300'}`}>
              {tab.desc}
            </span>
          </button>
        ))}
      </div>
      {/* 🚀 장갑 만들기 버튼 — 탭 우측 끝 */}
      <button
        onClick={onCreateClick}
        className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-blue-600 text-white border-2 border-slate-900 hover:border-blue-600 transition-all"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
        </svg>
        <span className="text-[12px] font-[1000] leading-none whitespace-nowrap">장갑 만들기</span>
      </button>
    </div>
  );
};

export default GloveNavBar;
