// src/components/ActivityStats.tsx

interface ActivityStatsProps {
  userData: any;
  friendCount: number;
  reputationLabel: string;
}

const ActivityStats = ({ userData, friendCount, reputationLabel }: ActivityStatsProps) => {
  const statItems = [
    { label: '레벨', value: userData.level, emoji: '🐥' },
    { label: '평판', value: reputationLabel, isHighlight: true },
    { label: '깐부', value: friendCount, isUnderline: true },
    { label: '구독자', value: userData.subscriberCount, isUnderline: true }
  ];

  return (
    <div className="flex flex-wrap bg-slate-50/80 rounded-xl p-1 gap-1 items-center border border-slate-100 shadow-inner w-full md:w-fit mt-4">
      {statItems.map((item, idx) => (
        <div key={idx} className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-slate-100 shadow-sm transition-transform hover:scale-105">
          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{item.label}</span>
          <span className={`text-[12px] font-[1000] tracking-tight ${item.isHighlight ? 'text-blue-600' : 'text-slate-900'} ${item.isUnderline ? 'underline decoration-blue-100 underline-offset-2' : ''}`}>
            {item.value}
          </span>
          {item.emoji && <span className="text-xs">{item.emoji}</span>}
        </div>
      ))}
    </div>
  );
};

export default ActivityStats;
