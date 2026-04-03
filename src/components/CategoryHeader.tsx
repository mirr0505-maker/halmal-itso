// src/components/CategoryHeader.tsx

interface Props {
  menuInfo: {
    title: string;
    description: string;
    emoji: string;
    tags?: string[];
  };
}

const CategoryHeader = ({ menuInfo }: Props) => {
  const displayTitle = menuInfo.title === "나의 이야기" ? "너와 나의 이야기" : menuInfo.title;

  return (
    <div className="sticky top-0 z-30 bg-[#F8FAFC]/80 backdrop-blur-md pt-2">
      <div className="flex items-center border-b border-slate-200 h-[36px] px-4">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-blue-600 font-black text-[15px]">#</span>
            <h2 className="text-[14px] font-[1000] text-slate-900 tracking-tighter whitespace-nowrap">
              {displayTitle}
            </h2>
          </div>
          <div className="w-px h-3 bg-slate-200 shrink-0 mx-1" />
          <p className="text-[12px] font-bold text-slate-500 tracking-tight break-keep shrink-0">
            {menuInfo.description}
          </p>
          {menuInfo.tags && menuInfo.tags.map(tag => (
            <span key={tag} className="shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-black bg-rose-50 text-rose-500 border border-rose-100">
              {tag}
            </span>
          ))}
        </div>
      </div>
      <div className="h-3" />
    </div>
  );
};

export default CategoryHeader;
