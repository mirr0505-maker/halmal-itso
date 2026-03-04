// src/components/TopNavbar.tsx

interface Props {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  userData: any;
  onCreateClick: () => void;
}

const TopNavbar = ({ searchQuery, setSearchQuery, userData, onCreateClick }: Props) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 h-[42px] flex items-center justify-between px-4">
      <div className="flex-1 max-w-xl">
        <div className="relative flex items-center bg-slate-100 rounded-full px-3 py-1.5 border border-transparent focus-within:border-blue-500 focus-within:bg-white transition-all">
          <svg className="w-3.5 h-3.5 text-slate-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="검색어를 입력해 주세요."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent outline-none w-full text-[11px] font-bold text-slate-700 placeholder:text-slate-400 placeholder:font-medium"
          />
        </div>
      </div>

      <div className="flex items-center gap-2.5 ml-4">
        <button 
          onClick={onCreateClick}
          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md text-[11px] font-black transition-colors shadow-sm flex items-center gap-1"
        >
          <span className="text-xs">+</span> 새 포스트
        </button>

        <button className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </button>

        <div className="w-7 h-7 rounded-full border border-slate-200 overflow-hidden cursor-pointer">
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