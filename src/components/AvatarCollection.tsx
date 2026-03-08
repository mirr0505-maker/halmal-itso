// src/components/AvatarCollection.tsx

interface AvatarCollectionProps {
  cards: any[];
}

const AvatarCollection = ({ cards }: AvatarCollectionProps) => {
  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4 px-1">
        <h3 className="text-sm font-[1000] text-slate-900 tracking-tight">아바타 컬렉션</h3>
      </div>
      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-7 gap-3">
        <div className="aspect-square bg-white border-2 border-dashed border-slate-100 rounded-xl flex flex-col items-center justify-center gap-1 hover:border-blue-400 hover:bg-blue-50 transition-all cursor-pointer group shadow-sm">
          <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>
          </div>
          <span className="text-[10px] font-black text-blue-600 tracking-tight">2/5</span>
        </div>
        {cards.map((card, idx) => (
          <div key={idx} className="aspect-square rounded-xl overflow-hidden relative border border-slate-100 shadow-sm bg-white group hover:shadow-md transition-all duration-500 hover:-translate-y-0.5">
            {card.isLocked ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-center p-2 bg-slate-50/30">
                <svg className="w-3 h-3 text-slate-300 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                <span className="text-[8px] font-black text-slate-400 leading-tight uppercase tracking-tight">Lv.{card.lockLevel}</span>
              </div>
            ) : (
              <img src={card.imageUrl} alt="" className="w-full h-full object-cover grayscale-[0.2] group-hover:grayscale-0 transition-all duration-500" />
            )}
          </div>
        ))}
      </div>
    </section>
  );
};

export default AvatarCollection;
