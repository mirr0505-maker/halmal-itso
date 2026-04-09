// src/components/KanbuPromoCard.tsx — 깐부 홍보 카드 (목록용 컴팩트)
import type { UserData } from '../types';
import { calculateLevel, getReputationLabel, getReputationScore } from '../utils';

interface KanbuPromo {
  promoImageUrl?: string;
  promoKeywords?: string[];
  promoMessage?: string;
  promoExpireAt?: { seconds: number };
}

interface Props {
  userData: UserData & KanbuPromo;
  followerCount?: number;
  onClick: () => void;
}

const KanbuPromoCard = ({ userData, followerCount = 0, onClick }: Props) => {
  const level = calculateLevel(userData.exp || 0);
  const repLabel = getReputationLabel(getReputationScore(userData));

  // 🚀 남은 기간 표시
  const getRemaining = () => {
    if (!userData.promoExpireAt) return null;
    const diffMs = userData.promoExpireAt.seconds * 1000 - Date.now();
    if (diffMs <= 0) return { text: '게시 만료된 홍보입니다', expired: true };
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours < 24) return { text: `게시 종료 ${diffHours}시간`, expired: false };
    return { text: `게시 종료 ${Math.floor(diffHours / 24)}일`, expired: false };
  };
  const remaining = getRemaining();

  return (
    <div
      onClick={remaining?.expired ? undefined : onClick}
      className={`bg-white rounded-2xl border p-4 transition-all ${remaining?.expired ? 'border-slate-200 opacity-50 cursor-default grayscale-[30%]' : 'border-slate-100 hover:border-violet-200 hover:shadow-md cursor-pointer group'}`}
    >
      {/* 1. 아바타 + 닉네임 + 레벨 */}
      <div className="flex items-center gap-2.5 mb-2">
        <div className="w-10 h-10 rounded-full overflow-hidden border border-slate-200 bg-slate-50 shrink-0">
          <img src={userData.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${userData.nickname}`} alt="" className="w-full h-full object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] font-[1000] text-slate-900 truncate">{userData.nickname}</span>
            {remaining && (
              <span className={`text-[8px] font-bold px-1 py-0.5 rounded border ml-auto shrink-0 ${remaining.expired ? 'text-slate-400 bg-slate-50 border-slate-200' : 'text-amber-500 bg-amber-50 border-amber-100'}`}>
                {remaining.text}
              </span>
            )}
          </div>
          <span className="text-[9px] font-bold text-slate-400">Lv{level} · {repLabel} · 깐부수 {followerCount}</span>
        </div>
      </div>

      {/* 2. 키워드 태그 */}
      {(userData.promoKeywords || []).length > 0 && (
        <div className="flex items-center gap-1 mb-2 flex-wrap">
          {userData.promoKeywords!.slice(0, 3).map((kw, i) => (
            <span key={i} className="text-[9px] font-bold text-violet-500 bg-violet-50 px-1.5 py-0.5 rounded-md">#{kw}</span>
          ))}
        </div>
      )}

      {/* 3. 공약 */}
      {userData.promoMessage && (
        <p className="text-[11px] font-bold text-slate-500 line-clamp-2 leading-relaxed mb-2">
          "{userData.promoMessage}"
        </p>
      )}

      {/* 4. 이미지 — 원본 비율 그대로 (세로든 가로든 자연스럽게) */}
      {userData.promoImageUrl && (
        <div className="rounded-xl overflow-hidden bg-slate-100 max-h-[200px]">
          <img src={userData.promoImageUrl} alt="" className="w-full h-auto object-contain max-h-[200px] group-hover:scale-105 transition-transform duration-500" />
        </div>
      )}
    </div>
  );
};

export default KanbuPromoCard;
