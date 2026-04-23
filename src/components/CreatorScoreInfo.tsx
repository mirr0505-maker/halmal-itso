// src/components/CreatorScoreInfo.tsx — 🏅 크리에이터 점수 상세 박스
// CREATOR_SCORE.md §공식 — PublicProfile 상세 뷰 전용 (feedback_reputation_avatar_scope 규칙 준수)
// Why: Creator Score는 서버(creatorScoreCache) 집계값. 본 컴포넌트는 표시 전용 —
//      최종 점수 + 마패 티어 + 3축 브레이크다운(원시 입력값) + 관리자 override 배지
import type { UserData } from '../types';
import { ACTIVITY_WEIGHTS } from '../constants';
import { getMapaeTier, getMapaeLabel, getMapaeColor, getReputation } from '../utils';
import MapaeBadge from './MapaeBadge';

interface Props {
  userData: UserData;
}

// 🚀 FirestoreTimestamp → 상대 시간 라벨 (간이)
const formatUpdated = (ts?: UserData['creatorScoreUpdatedAt']): string => {
  if (!ts) return '집계 전';
  const ms = ts.seconds * 1000;
  const diff = Math.floor((Date.now() - ms) / 60000);
  if (diff < 1)    return '방금 갱신';
  if (diff < 60)   return `${diff}분 전 갱신`;
  if (diff < 1440) return `${Math.floor(diff / 60)}시간 전 갱신`;
  return `${Math.floor(diff / 1440)}일 전 갱신`;
};

const CreatorScoreInfo = ({ userData }: Props) => {
  const score = userData.creatorScoreCached;
  const tier = userData.creatorScoreTier ?? getMapaeTier(score);
  const color = getMapaeColor(tier);

  // 🚀 아직 집계되지 않은 유저 — 조용히 placeholder (신규/비활성)
  if (typeof score !== 'number') {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 mb-3">
        <h3 className="text-[11px] font-[1000] text-slate-400 uppercase tracking-widest mb-2">🏅 크리에이터 점수</h3>
        <p className="text-[12px] font-bold text-slate-400">
          아직 집계 전이에요. 매일 새벽 05:00 KST에 갱신됩니다.
        </p>
      </div>
    );
  }

  // 🚀 3축 원시값 (표시 전용 — 실제 곱셈은 서버 공식이 수행)
  const reputation = getReputation(userData);
  const p = userData.recent30d_posts    || 0;
  const c = userData.recent30d_comments || 0;
  const l = userData.recent30d_likesSent || 0;
  const recent30dTotal = p * ACTIVITY_WEIGHTS.post + c * ACTIVITY_WEIGHTS.comment + l * ACTIVITY_WEIGHTS.likeSent;

  // 🚀 override 표시용 — Phase C adminAdjustCreatorScore
  const override = userData.creatorScoreOverride;
  const isOverride = !!override && typeof override.value === 'number';

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 mb-3">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[11px] font-[1000] text-slate-400 uppercase tracking-widest">🏅 크리에이터 점수</h3>
        <span className="text-[9px] font-bold text-slate-300">{formatUpdated(userData.creatorScoreUpdatedAt)}</span>
      </div>

      {/* 최종 점수 + 마패 */}
      <div className={`flex items-center gap-3 p-3 rounded-xl border ${color.bg} ${color.border}`}>
        <div className="flex flex-col min-w-0">
          <span className={`text-[24px] font-[1000] leading-none ${color.text}`}>{score.toFixed(2)}</span>
          <span className="text-[10px] font-bold text-slate-400 mt-1">{getMapaeLabel(tier)}</span>
        </div>
        <div className="flex-1" />
        <MapaeBadge user={userData} size="lg" showTooltip={false} />
      </div>

      {/* Override 배지 — 관리자 수동 보정값 */}
      {isOverride && (
        <div className="mt-2 p-2 rounded-lg bg-amber-50 border border-amber-200">
          <p className="text-[10px] font-[1000] text-amber-700 mb-0.5">🔧 관리자 보정값 적용 중</p>
          <p className="text-[10px] font-bold text-amber-600 line-clamp-2">사유: {override!.reason}</p>
        </div>
      )}

      {/* 3축 브레이크다운 */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="p-2 rounded-lg bg-slate-50 border border-slate-100 text-center">
          <p className="text-[9px] font-bold text-slate-400 mb-0.5">평판</p>
          <p className="text-[13px] font-[1000] text-slate-700">{reputation.toLocaleString()}</p>
        </div>
        <div className="p-2 rounded-lg bg-slate-50 border border-slate-100 text-center">
          <p className="text-[9px] font-bold text-slate-400 mb-0.5">30일 활동</p>
          <p className="text-[13px] font-[1000] text-slate-700">{recent30dTotal.toFixed(1)}</p>
        </div>
        <div className="p-2 rounded-lg bg-slate-50 border border-slate-100 text-center">
          <p className="text-[9px] font-bold text-slate-400 mb-0.5">신뢰</p>
          <p className="text-[13px] font-[1000] text-slate-700">
            {userData.abuseFlags && Object.values(userData.abuseFlags).some(Boolean)
              ? '⚠️ 감산'
              : (userData.exileHistory?.length ? `유배 ${userData.exileHistory.length}회` : '정상')}
          </p>
        </div>
      </div>

      {/* 활동 세부 — 글·댓글·좋아요 */}
      <div className="mt-2 flex items-center justify-around text-[10px] font-bold text-slate-400">
        <span>📝 글 {p}</span>
        <span>💬 댓글 {c}</span>
        <span>♥ 좋아요 {l}</span>
      </div>
    </div>
  );
};

export default CreatorScoreInfo;
