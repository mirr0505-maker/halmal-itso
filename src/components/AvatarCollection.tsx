// src/components/AvatarCollection.tsx

interface AvatarCollectionProps {
  currentLevel: number;
}

const AvatarCollection = ({ currentLevel }: AvatarCollectionProps) => {
  // 🚀 레벨에 따른 아바타 해금 상태 정의
  const avatars = [
    { lockLevel: 1, imageUrl: "https://api.dicebear.com/7.x/adventurer/svg?seed=1" },
    { lockLevel: 2, imageUrl: "https://api.dicebear.com/7.x/adventurer/svg?seed=2" },
    { lockLevel: 4, imageUrl: "https://api.dicebear.com/7.x/adventurer/svg?seed=3" },
    { lockLevel: 6, imageUrl: "https://api.dicebear.com/7.x/adventurer/svg?seed=4" },
    { lockLevel: 8, imageUrl: "https://api.dicebear.com/7.x/adventurer/svg?seed=5" },
    { lockLevel: 10, imageUrl: "https://api.dicebear.com/7.x/adventurer/svg?seed=6" },
  ];

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4 px-1">
        <h3 className="text-sm font-[1000] text-slate-900 tracking-tight">아바타 컬렉션</h3>
      </div>
      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3">
        {avatars.map((avatar, idx) => {
          const isLocked = currentLevel < avatar.lockLevel;
          return (
            <div key={idx} className="aspect-square rounded-xl overflow-hidden relative border border-slate-100 shadow-sm bg-white group hover:shadow-md transition-all duration-500 hover:-translate-y-0.5">
              {isLocked ? (
                <div className="w-full h-full flex flex-col items-center justify-center text-center p-2 bg-slate-50/30">
                  <svg className="w-3 h-3 text-slate-300 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  <span className="text-[8px] font-black text-slate-400 leading-tight uppercase tracking-tight">Lv.{avatar.lockLevel}</span>
                </div>
              ) : (
                <img src={avatar.imageUrl} alt="" className="w-full h-full object-cover grayscale-[0.2] group-hover:grayscale-0 transition-all duration-500" />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default AvatarCollection;
