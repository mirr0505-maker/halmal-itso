// src/components/Sidebar.tsx

interface Props {
  activeMenu: 'home' | 'onecut' | 'friends' | 'mypage';
  setActiveMenu: (menu: 'home' | 'onecut' | 'friends' | 'mypage') => void;
}

const Sidebar = ({ activeMenu, setActiveMenu }: Props) => {
  const menus = [
    { id: 'home', label: '홈', icon: '🏠' },
    { id: 'onecut', label: '한컷', icon: '📸' },
    { id: 'friends', label: '깐부', icon: '🤝' },
    { id: 'mypage', label: '내정보', icon: '👤' },
  ];

  return (
    <aside className="w-64 bg-[#F8FAFC] border-r border-slate-200 hidden md:flex flex-col h-full sticky top-0">
      <div className="p-6">
        <h1 className="text-3xl font-[1000] italic text-blue-600 tracking-tighter cursor-pointer" onClick={() => setActiveMenu('home')}>
          HALMAL<span className="text-slate-900">.</span>
        </h1>
      </div>
      <nav className="flex-1 px-4 space-y-2">
        {menus.map(menu => (
          <button
            key={menu.id}
            onClick={() => setActiveMenu(menu.id as any)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${
              activeMenu === menu.id
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <span className="text-xl">{menu.icon}</span>
            {menu.label}
          </button>
        ))}
      </nav>
      <div className="p-6 text-[10px] font-bold text-slate-400">
        © 2026 HALMAL-ITSO.<br />All rights reserved.
      </div>
    </aside>
  );
};

export default Sidebar;