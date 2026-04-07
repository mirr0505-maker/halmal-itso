// src/components/KanbuPromoModal.tsx — 깐부 홍보 팝업 상세
// 🚀 메인 이미지 + 키워드 + 공약 + 공개프로필 요약 + 깐부맺기 버튼
import type { UserData } from '../types';
import { calculateLevel, getReputationLabel, getReputationScore, formatKoreanNumber, getLevelProgress, getReputationProgress, getNextLevelExp, getNextReputationThreshold } from '../utils';

interface KanbuPromo {
  promoImageUrl?: string;
  promoKeywords?: string[];
  promoMessage?: string;
}

interface Props {
  userData: UserData & KanbuPromo;
  isFriend: boolean;
  isMutual: boolean;
  followerCount: number;
  postCount: number;
  onToggleFriend: () => void;
  onClose: () => void;
}

const KanbuPromoModal = ({ userData, isFriend, isMutual, followerCount, postCount, onToggleFriend, onClose }: Props) => {
  const level = calculateLevel(userData.exp || 0);
  const repScore = getReputationScore(userData);
  const repLabel = getReputationLabel(repScore);
  const levelPct = getLevelProgress(userData.exp || 0);
  const repPct = getReputationProgress(repScore);
  const nextLevelExp = getNextLevelExp(userData.exp || 0);
  const nextRepThreshold = getNextReputationThreshold(repScore);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl w-[420px] max-h-[85vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>

        {/* 메인 이미지 */}
        {userData.promoImageUrl && (
          <div className="aspect-[16/9] overflow-hidden rounded-t-2xl bg-slate-100">
            <img src={userData.promoImageUrl} alt="" className="w-full h-full object-cover" />
          </div>
        )}

        <div className="p-5">
          {/* 아바타 + 닉네임 + 레벨/평판 */}
          <div className="flex items-center gap-3 mb-3">
            <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-slate-200 bg-slate-50 shrink-0">
              <img src={userData.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${userData.nickname}`} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-[16px] font-[1000] text-slate-900 truncate">{userData.nickname}</h3>
                <span className="text-[10px] font-black text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded-md border border-violet-100">Lv{level}</span>
                <span className="text-[10px] font-bold text-slate-400">{repLabel}</span>
              </div>
              {/* EXP 바 */}
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[8px] font-bold text-slate-400 w-6">EXP</span>
                <div className="flex-1 bg-slate-100 rounded-full h-1 overflow-hidden">
                  <div className="h-full bg-violet-400 rounded-full" style={{ width: `${levelPct}%` }} />
                </div>
                <span className="text-[8px] font-bold text-slate-300">{userData.exp || 0}/{nextLevelExp}</span>
              </div>
              {/* 평판 바 */}
              <div className="flex items-center gap-2">
                <span className="text-[8px] font-bold text-slate-400 w-6">평판</span>
                <div className="flex-1 bg-slate-100 rounded-full h-1 overflow-hidden">
                  <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${repPct}%` }} />
                </div>
                <span className="text-[8px] font-bold text-slate-300">{repScore}/{nextRepThreshold}</span>
              </div>
            </div>
          </div>

          {/* 키워드 태그 */}
          {(userData.promoKeywords || []).length > 0 && (
            <div className="flex items-center gap-1.5 mb-3 flex-wrap">
              {userData.promoKeywords!.map((kw, i) => (
                <span key={i} className="text-[11px] font-[1000] text-violet-600 bg-violet-50 px-2.5 py-1 rounded-lg border border-violet-100">#{kw}</span>
              ))}
            </div>
          )}

          {/* 깐부 공약 */}
          {userData.promoMessage && (
            <div className="bg-slate-50 rounded-xl px-4 py-3 mb-3 border border-slate-100">
              <p className="text-[13px] font-bold text-slate-600 leading-relaxed italic">
                "{userData.promoMessage}"
              </p>
            </div>
          )}

          {/* 소개글 */}
          {userData.bio && (
            <p className="text-[12px] font-medium text-slate-400 italic mb-3">"{userData.bio}"</p>
          )}

          {/* 활동 지표 */}
          <div className="flex items-center justify-around text-center mb-4 bg-slate-50 rounded-xl py-3 border border-slate-100">
            <div>
              <span className="text-[14px] font-[1000] text-slate-800">{postCount}</span>
              <p className="text-[9px] font-bold text-slate-400">작성글</p>
            </div>
            <div className="w-px h-6 bg-slate-200" />
            <div>
              <span className="text-[14px] font-[1000] text-slate-800">{userData.friendList?.length || 0}</span>
              <p className="text-[9px] font-bold text-slate-400">깐부</p>
            </div>
            <div className="w-px h-6 bg-slate-200" />
            <div>
              <span className="text-[14px] font-[1000] text-slate-800">{followerCount}</span>
              <p className="text-[9px] font-bold text-slate-400">깐부수</p>
            </div>
            <div className="w-px h-6 bg-slate-200" />
            <div>
              <span className="text-[14px] font-[1000] text-amber-500">⚾ {formatKoreanNumber(userData.ballReceived || 0)}</span>
              <p className="text-[9px] font-bold text-slate-400">받은볼</p>
            </div>
          </div>

          {/* 깐부맺기 버튼 */}
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-[12px] font-[1000] text-slate-400 bg-slate-50 hover:bg-slate-100 transition-colors">닫기</button>
            {isMutual ? (
              <span className="flex-1 text-center py-2.5 rounded-xl text-[12px] font-[1000] text-emerald-600 bg-emerald-50 border border-emerald-200">서로 깐부 ✓</span>
            ) : isFriend ? (
              <button onClick={onToggleFriend} className="flex-1 py-2.5 rounded-xl text-[12px] font-[1000] text-slate-400 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors">깐부해제</button>
            ) : (
              <button onClick={onToggleFriend} className="flex-1 py-2.5 rounded-xl text-[12px] font-[1000] text-white bg-violet-600 hover:bg-violet-700 transition-colors">+ 깐부 맺기</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default KanbuPromoModal;
