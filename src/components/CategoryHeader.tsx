// src/components/CategoryHeader.tsx

interface Props {
  menuInfo: {
    title: string;
    description: string;
    emoji: string;
  };
  onAction: () => void;
}

const CategoryHeader = ({ menuInfo, onAction }: Props) => {
  // "나의 이야기"인 경우 요청하신대로 "너와 나의 이야기"로 표시
  const displayTitle = menuInfo.title === "나의 이야기" ? "너와 나의 이야기" : menuInfo.title;

  return (
    <div className="sticky top-0 z-30 bg-[#F8FAFC]/80 backdrop-blur-md pt-5">
      <div className="flex items-center border-b border-slate-200 h-[42px] px-4 justify-between">
        <div className="flex items-center gap-3 overflow-hidden mr-4">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-blue-600 font-black text-[15px]">#</span>
            <h2 className="text-[14px] font-[1000] text-slate-900 tracking-tighter whitespace-nowrap">
              {displayTitle}
            </h2>
          </div>
          <div className="w-px h-3 bg-slate-200 shrink-0 mx-1" />
          <p className="text-[12px] font-bold text-slate-500 truncate tracking-tight break-keep">
            {menuInfo.description}
          </p>
        </div>
        
        <button 
          onClick={onAction}
          className="shrink-0 bg-slate-900 text-white px-4 h-[30px] rounded-lg font-black text-[11px] shadow-sm hover:bg-blue-600 transition-all active:scale-95 flex items-center gap-1.5"
        >
          <span>할말 올리기</span>
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v16m7.5-8h-15" />
          </svg>
        </button>
      </div>
      <div className="h-6" />
    </div>
  );
};

export default CategoryHeader;
