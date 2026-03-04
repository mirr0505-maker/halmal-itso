// src/components/TopNavbar.tsx

interface Props {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  userData: any;
  onCreateClick: () => void;
}

const TopNavbar = ({ searchQuery, setSearchQuery, userData, onCreateClick }: Props) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 h-16 flex items-center justify-between px-6">
      <div className="flex-1 max-w-2xl">
        <div className="relative flex items-center bg-slate-100 rounded-full px-4 py-2 border border-transparent focus-within:border-blue-500 focus-within:bg-white transition-all">
          <span className="text-slate-400 mr-2">🔍</span>
          <input
            type="text"
            placeholder="검색어를 입력해 주세요."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent outline-none w-full text-sm font-bold text-slate-700 placeholder:text-slate-400 placeholder:font-medium"
          />
        </div>
      </div>

      <div className="flex items-center gap-4 ml-4">
        <button 
          onClick={onCreateClick}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-black transition-colors shadow-sm flex items-center gap-1"
        >
          <span>+</span> 새 포스트
        </button>
        
        <button className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-600 transition-colors">
          🔔
        </button>

        <div className="w-10 h-10 rounded-full border border-slate-200 overflow-hidden cursor-pointer">
          <img 
            src={userData.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${userData.nickname}`} 
            alt="avatar" 
            className="w-full h-full object-cover bg-slate-50"
          />
        </div>
      </div>
    </header>
  );
};

export default TopNavbar;