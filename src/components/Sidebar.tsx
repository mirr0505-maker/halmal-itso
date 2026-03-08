// src/components/Sidebar.tsx

interface Props {
  activeMenu: 'home' | 'onecut' | 'friends' | 'mypage';
  setActiveMenu: (menu: 'home' | 'onecut' | 'friends' | 'mypage') => void;
}

const Sidebar = ({ activeMenu, setActiveMenu }: Props) => {
  const menus = [
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
      id: 'onecut', 
      label: '한컷', 
      icon: (
        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )
    },
    { 
      id: 'friends', 
      /* 🚀 메뉴 명칭을 '깐부'에서 '깐부 맺기'로 변경 */
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

  return (
    <aside className="w-40 hidden md:flex flex-col h-full bg-white border-r border-slate-100">
      <nav className="flex-1 px-3 pt-4 space-y-1">
        {menus.map(menu => {
          const isActive = activeMenu === menu.id;
          return (
            <button
              key={menu.id}
              onClick={() => setActiveMenu(menu.id as any)}
              className={`w-full flex flex-row items-center gap-3 px-4 py-2.5 rounded-xl transition-colors duration-150 border-2 ${
                isActive
                  ? 'bg-blue-50/40 text-blue-600 border-blue-100 shadow-sm shadow-blue-50'
                  : 'bg-transparent text-slate-400 border-transparent hover:bg-slate-50 hover:text-slate-600'
              }`}
            >
              <span className={`transition-colors duration-150 ${isActive ? 'text-blue-600' : 'text-slate-300'}`}>
                {menu.icon}
              </span>
              <span className={`text-[13.5px] tracking-tight ${isActive ? 'font-black' : 'font-bold'}`}>
                {menu.label}
              </span>
            </button>
          );
        })}
      </nav>
      
      <div className="p-6 text-[9px] font-black text-slate-300 tracking-tighter uppercase opacity-50">
        © 2026 HALMAL-ITSO
      </div>
    </aside>
  );
};

export default Sidebar;
