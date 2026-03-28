// src/components/Sidebar.tsx

export type MenuId =
  | 'home'
  | 'onecut'
  | 'market'
  | 'my_story'
  | 'naked_king'
  | 'donkey_ears'
  | 'knowledge_seller'
  | 'bone_hitting'
  | 'local_news'
  | 'crying_boy'
  | 'exile_place'
  | 'kanbu_room'
  | 'friends'
  | 'glove'
  | 'ranking'
  | 'mypage';

interface Props {
  activeMenu: MenuId;
  setActiveMenu: (menu: MenuId) => void;
  kanbuRoomCount?: number;
  // 🚀 모바일 드로어 모드
  mobile?: boolean;
  onClose?: () => void;
}

const Sidebar = ({ activeMenu, setActiveMenu, kanbuRoomCount = 0, mobile = false, onClose }: Props) => {
  const mainServiceMenus = [
    {
      id: 'home',
      label: '홈',
      icon: (
        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      )
    },
    {
      id: 'my_story',
      label: '너와 나의 이야기',
      description: '일상 소식들',
      icon: (
        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      )
    },
    {
      id: 'naked_king',
      label: '판도라의 상자',
      description: '사실 확인',
      icon: (
        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      )
    },
    {
      id: 'donkey_ears',
      label: '솔로몬의 재판',
      description: '주장·토론',
      icon: (
        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      )
    },
    {
      id: 'knowledge_seller',
      label: '황금알을 낳는 거위',
      description: '지식·정보 공유',
      icon: (
        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      )
    },
    {
      id: 'bone_hitting',
      label: '신포도와 여우',
      description: '타골명언',
      icon: (
        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      )
    },
    {
      id: 'local_news',
      label: '마법 수정 구슬',
      description: '국내외 생생 뉴스',
      icon: (
        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )
    },
    {
      id: 'crying_boy',
      label: '양치기 소년의 외침',
      description: '속보 긴급뉴스',
      icon: (
        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      )
    },
  ];

  const oneCutMenu = {
    id: 'onecut',
    label: '한컷',
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    )
  };

  const marketMenu = {
    id: 'market',
    label: '마켓',
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
      </svg>
    )
  };

  const friendsMenu = {
    id: 'friends',
    label: '깐부 맺기',
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    )
  };

  const rankingMenu = {
    id: 'ranking',
    label: '랭킹',
    description: '좋아요 · 땡스볼',
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    )
  };

  const exileMenu = {
    id: 'exile_place',
    label: '유배·귀양지',
    description: '격리공간',
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    )
  };

  const userMenus = [
    {
      id: 'mypage',
      label: '내정보',
      icon: (
        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h10a7 7 0 00-7-7z" />
        </svg>
      )
    },
  ];

  const renderMenuButton = (menu: any) => {
    const isActive = activeMenu === menu.id;
    return (
      <button
        key={menu.id}
        onClick={() => setActiveMenu(menu.id as any)}
        className={`w-full flex flex-row items-start gap-2 px-2.5 py-1.5 rounded-xl transition-all duration-150 border-2 ${
          isActive
            ? 'bg-blue-50/40 text-blue-600 border-blue-100 shadow-sm shadow-blue-50 scale-[1.02]'
            : 'bg-transparent text-slate-400 border-transparent hover:bg-slate-50 hover:text-slate-600'
        }`}
      >
        <span className={`transition-colors duration-150 shrink-0 mt-[1px] ${isActive ? 'text-blue-600' : 'text-slate-300'}`}>
          {menu.icon}
        </span>
        <div className="flex flex-col items-start min-w-0 overflow-hidden">
          <span className={`text-[12px] tracking-tight whitespace-nowrap overflow-hidden text-ellipsis ${isActive ? 'font-black' : 'font-bold'}`}>
            {menu.label}
          </span>
          {menu.description && (
            <span className="text-[9px] font-bold text-slate-300 whitespace-nowrap overflow-hidden text-ellipsis leading-none mt-0.5">
              {menu.description}
            </span>
          )}
        </div>
      </button>
    );
  };

  return (
    <aside className={`flex flex-col bg-white overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] ${
      mobile
        ? 'w-72 h-full'
        : 'w-36 hidden md:flex h-full border-r border-slate-100'
    }`}>
      {/* 🚀 모바일 드로어 전용 상단 헤더 */}
      {mobile && (
        <div className="flex items-center justify-between px-4 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h2 className="text-[17px] font-[1000] italic tracking-tighter"><span className="text-blue-600">GL</span><span className="text-slate-900">ove</span></h2>
            <p className="text-[9px] font-bold text-slate-300 tracking-tight">집단지성의 힘</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
      <nav className="flex-1 px-2 pt-3 space-y-0.5 pb-4">
        {mainServiceMenus.map(renderMenuButton)}

        <div className="my-2.5 px-4">
          <div className="h-px bg-slate-100 w-full" />
        </div>

        {/* 🚀 우리들의 따뜻한 장갑: 커뮤니티 섹션 — 랭킹 위 배치 */}
        <button
          onClick={() => setActiveMenu('glove')}
          className={`w-full flex flex-row items-center gap-2 px-2.5 py-1.5 rounded-xl transition-all duration-150 border-2 ${
            activeMenu === 'glove'
              ? 'bg-blue-50/40 text-blue-600 border-blue-100 shadow-sm shadow-blue-50 scale-[1.02]'
              : 'bg-transparent text-slate-400 border-transparent hover:bg-slate-50 hover:text-slate-600'
          }`}
        >
          <span className="transition-all duration-150 shrink-0 text-[16px] leading-none" style={{ filter: 'grayscale(1)', opacity: activeMenu === 'glove' ? 0.65 : 0.20 }}>
            🧤
          </span>
          <div className="flex flex-col items-start min-w-0 flex-1 overflow-hidden">
            <span className={`text-[12px] tracking-tight whitespace-nowrap ${activeMenu === 'glove' ? 'font-black' : 'font-bold'}`}>우리들의 장갑</span>
            <span className="text-[9px] font-bold text-slate-300 whitespace-nowrap leading-none mt-0.5">커뮤니티</span>
          </div>
        </button>

        <div className="my-2.5 px-4">
          <div className="h-px bg-slate-100 w-full" />
        </div>

        {/* 랭킹 + 유배귀양지 섹션 */}
        {renderMenuButton(rankingMenu)}
        {renderMenuButton(exileMenu)}

        <div className="my-2.5 px-4">
          <div className="h-px bg-slate-100 w-full" />
        </div>

        {renderMenuButton(oneCutMenu)}
        {renderMenuButton(marketMenu)}

        <div className="my-2.5 px-4">
          <div className="h-px bg-slate-100 w-full" />
        </div>

        {/* 깐부 섹션: 깐부방 + 깐부맺기 */}
        <button
          onClick={() => setActiveMenu('kanbu_room')}
          className={`w-full flex flex-row items-center gap-2 px-2.5 py-1.5 rounded-xl transition-all duration-150 border-2 ${
            activeMenu === 'kanbu_room'
              ? 'bg-blue-50/40 text-blue-600 border-blue-100 shadow-sm shadow-blue-50 scale-[1.02]'
              : 'bg-transparent text-slate-400 border-transparent hover:bg-slate-50 hover:text-slate-600'
          }`}
        >
          <span className={`transition-colors duration-150 shrink-0 ${activeMenu === 'kanbu_room' ? 'text-blue-600' : 'text-slate-300'}`}>
            <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </span>
          <div className="flex flex-col items-start min-w-0 flex-1 overflow-hidden">
            <span className={`text-[12px] tracking-tight whitespace-nowrap ${activeMenu === 'kanbu_room' ? 'font-black' : 'font-bold'}`}>깐부방</span>
          </div>
          {kanbuRoomCount > 0 && (
            <span className="bg-blue-100 text-blue-600 text-[9px] font-black rounded-full px-1.5 py-0.5 min-w-[18px] text-center shrink-0">
              {kanbuRoomCount}
            </span>
          )}
        </button>

        {renderMenuButton(friendsMenu)}

        <div className="my-2.5 px-4">
          <div className="h-px bg-slate-100 w-full" />
        </div>

        {userMenus.map(renderMenuButton)}
      </nav>
      
      <div className="p-4 flex items-baseline gap-1.5 shrink-0">
        <span className="text-[11px] font-black text-slate-300 tracking-tight">GLove</span>
        <span className="text-[8px] font-bold text-slate-200 tracking-tight">집단지성의 힘</span>
      </div>
    </aside>
  );
};

export default Sidebar;
