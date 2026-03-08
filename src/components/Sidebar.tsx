// src/components/Sidebar.tsx

export type MenuId = 
  | 'home' 
  | 'onecut' 
  | 'my_story' 
  | 'naked_king' 
  | 'donkey_ears' 
  | 'knowledge_seller' 
  | 'bone_hitting' 
  | 'local_news' 
  | 'exile_place' 
  | 'friends' 
  | 'mypage';

interface Props {
  activeMenu: MenuId;
  setActiveMenu: (menu: MenuId) => void;
}

const Sidebar = ({ activeMenu, setActiveMenu }: Props) => {
  const categoryMenus = [
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
      label: '나의 이야기', 
      icon: (
        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      )
    },
    { 
      id: 'naked_king', 
      label: '벌거벗은 임금님', 
      icon: (
        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      )
    },
    { 
      id: 'donkey_ears', 
      label: '임금님 귀는 당나귀 귀', 
      icon: (
        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      )
    },
    { 
      id: 'knowledge_seller', 
      label: '지식 소매상', 
      icon: (
        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      )
    },
    { 
      id: 'bone_hitting', 
      label: '뼈때리는 글', 
      icon: (
        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      )
    },
    { 
      id: 'local_news', 
      label: '현지 소식', 
      icon: (
        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )
    },
    { 
      id: 'exile_place', 
      label: '유배·귀양지', 
      icon: (
        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      )
    },
  ];

  const userMenus = [
    { 
      id: 'friends', 
      label: '깐부 맺기', 
      icon: (
        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      )
    },
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
        className={`w-full flex flex-row items-center gap-2 px-2.5 py-2.5 rounded-xl transition-all duration-150 border-2 ${
          isActive
            ? 'bg-blue-50/40 text-blue-600 border-blue-100 shadow-sm shadow-blue-50 scale-[1.02]'
            : 'bg-transparent text-slate-400 border-transparent hover:bg-slate-50 hover:text-slate-600'
        }`}
      >
        <span className={`transition-colors duration-150 shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-300'}`}>
          {menu.icon}
        </span>
        <span className={`text-[12.5px] tracking-tight whitespace-nowrap overflow-hidden text-ellipsis ${isActive ? 'font-black' : 'font-bold'}`}>
          {menu.label}
        </span>
      </button>
    );
  };

  return (
    <aside className="w-48 hidden md:flex flex-col h-full bg-white border-r border-slate-100 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      <nav className="flex-1 px-2 pt-4 space-y-1 pb-4">
        {categoryMenus.map(renderMenuButton)}
        
        <div className="my-4 px-4">
          <div className="h-px bg-slate-100 w-full" />
        </div>

        {userMenus.map(renderMenuButton)}
      </nav>
      
      <div className="p-6 text-[9px] font-black text-slate-300 tracking-tighter uppercase opacity-50 shrink-0">
        © 2026 HALMAL-ITSO
      </div>
    </aside>
  );
};

export default Sidebar;
