// src/components/ads/AdSlotSetting.tsx — 새글 작성 시 광고 슬롯 ON/OFF (Lv5+)
// 🚀 작성자가 본인 글에 광고를 붙일지 선택. posts/{id}.adSlotEnabled 필드에 저장.
import { getCreatorAdSlots } from '../../constants';

interface Props {
  userLevel: number;
  adSlotEnabled: boolean;
  adSlotType: 'auction' | 'adsense';
  onChange: (enabled: boolean, type: 'auction' | 'adsense') => void;
}

const AdSlotSetting = ({ userLevel, adSlotEnabled, adSlotType, onChange }: Props) => {
  const rs = getCreatorAdSlots(userLevel);

  // Lv5 미만이면 표시 안 함
  if (rs.slots === 0) return null;

  return (
    <div className="flex items-center gap-3 px-5 py-2.5 border-t border-slate-100 bg-violet-50/30 shrink-0">
      <span className="text-[10px] font-black text-violet-400 uppercase tracking-widest shrink-0">📢 광고 슬롯</span>
      <div className="flex items-center gap-2 flex-1">
        <button
          onClick={() => onChange(!adSlotEnabled, adSlotType)}
          className={`px-3 py-1 rounded-lg text-[10px] font-[1000] transition-all ${adSlotEnabled ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-400'}`}
        >
          {adSlotEnabled ? `ON (${rs.slots}슬롯, ${Math.round(rs.creatorRate * 100)}% 수익)` : 'OFF'}
        </button>
        {adSlotEnabled && (
          <div className="flex gap-1">
            <button onClick={() => onChange(true, 'auction')}
              className={`px-2 py-0.5 rounded text-[9px] font-bold transition-all ${adSlotType === 'auction' ? 'bg-violet-600 text-white' : 'bg-white text-slate-400 border border-slate-200'}`}>
              광고마켓
            </button>
            <button onClick={() => onChange(true, 'adsense')}
              className={`px-2 py-0.5 rounded text-[9px] font-bold transition-all ${adSlotType === 'adsense' ? 'bg-violet-600 text-white' : 'bg-white text-slate-400 border border-slate-200'}`}>
              애드센스 (준비 중)
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdSlotSetting;
