// src/components/PublicProfile.tsx — 공개 프로필 (다른 사람이 보는 나)
// 🚀 진입점: 우측 상단 아바타 클릭 (본인), 글카드 작성자 닉네임 클릭 (타인)
import type { Post, UserData } from '../types';
import { formatKoreanNumber, calculateLevel, getLevelProgress, getNextLevelExp, getReputation, getReputationLabel, getReputationStyle, getReputationProgress, getNextReputationThreshold } from '../utils';
import ReputationAvatar from './ReputationAvatar';
import CreatorScoreInfo from './CreatorScoreInfo';
// 🏷️ Sprint 5 Stage 5 — 타인 프로필에서도 칭호 도감 열람 (isOwnProfile=false)
import TitleCollection from './TitleCollection';

interface Props {
  targetNickname: string;
  allUsers: Record<string, UserData>;
  allRootPosts: Post[];
  commentCounts: Record<string, number>;
  followerCounts: Record<string, number>;
  currentNickname?: string;
  friends: string[];
  onToggleFriend: (author: string) => void;
  onPostClick: (post: Post) => void;
  onClose: () => void;
}

const PublicProfile = ({
  targetNickname, allUsers, allRootPosts, commentCounts, followerCounts,
  currentNickname, friends, onToggleFriend, onPostClick, onClose,
}: Props) => {
  const userData = allUsers[`nickname_${targetNickname}`];
  if (!userData) return (
    <div className="w-full max-w-2xl mx-auto px-4 py-20 text-center">
      <p className="text-slate-300 font-bold">유저 정보를 찾을 수 없습니다.</p>
      <button onClick={onClose} className="mt-4 text-[12px] font-bold text-violet-500 hover:text-violet-700">← 돌아가기</button>
    </div>
  );

  const exp = userData.exp || 0;
  const level = calculateLevel(exp);
  const levelPct = getLevelProgress(exp);
  const nextLevelExp = getNextLevelExp(exp);
  const repScore = getReputation(userData);
  const repLabel = getReputationLabel(repScore);
  const repStyle = getReputationStyle(repScore);
  const repPct = getReputationProgress(repScore);
  const nextRepThreshold = getNextReputationThreshold(repScore);
  const followerCount = followerCounts[targetNickname] || 0;
  const friendCount = userData.friendList?.length || 0;
  const isMe = currentNickname === targetNickname;
  const isFriend = friends.includes(targetNickname);
  const isFollowingMe = !!(userData.friendList && currentNickname && userData.friendList.includes(currentNickname));
  const isMutual = isFriend && isFollowingMe;

  // 내 홍보 이미지 — 해금 + 등록된 것만
  const promoImages: string[] = ((userData as unknown as { promoImages?: string[] }).promoImages || []).filter(url => url && url.length > 0);

  // 유저 글 목록 (최신순)
  const userPosts = allRootPosts
    .filter(p => p.author === targetNickname)
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

  // Best 3: 좋아요 상위 3개 (최소 좋아요 1개 이상)
  const best3 = [...userPosts]
    .filter(p => (p.likes || 0) >= 1)
    .sort((a, b) => (b.likes || 0) - (a.likes || 0))
    .slice(0, 3);

  const formatTime = (ts: { seconds: number } | null | undefined) => {
    if (!ts) return '';
    const diff = Math.floor((Date.now() - ts.seconds * 1000) / 60000);
    if (diff < 1) return '방금';
    if (diff < 60) return `${diff}분 전`;
    if (diff < 1440) return `${Math.floor(diff / 60)}시간 전`;
    return new Date(ts.seconds * 1000).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-6 animate-in fade-in duration-500">
      {/* 뒤로가기 */}
      <button onClick={onClose} className="flex items-center gap-1 text-[11px] font-black text-slate-400 hover:text-slate-700 mb-4 transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"/></svg>
        돌아가기
      </button>

      {/* 1. Identity — 아바타 + 닉네임 + 레벨 + 평판 */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-3">
        <div className="flex items-center gap-4 mb-4">
          {/* 🏅 이중 링 아바타 — 바깥(평판) + 안쪽(레벨) — REPUTATION_V2 §6.4 시범 적용 */}
          <ReputationAvatar user={userData} size="lg" showTooltip={false} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-[18px] font-[1000] text-slate-900 truncate">{targetNickname}</h2>
              <span className="text-[10px] font-black text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded-md border border-violet-100">Lv{level}</span>
              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${repStyle}`}>{repLabel}</span>
              {/* 🏚️ 유배 상태 배지 */}
              {userData.sanctionStatus?.startsWith('exiled_') && (
                <span className="text-[10px] font-black text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded-md border border-rose-200" title={userData.sanctionReason || '유배 중'}>
                  🏚️ 수감 중 · {userData.strikeCount || 1}범
                </span>
              )}
              {userData.sanctionStatus === 'banned' && (
                <span className="text-[10px] font-black text-white bg-slate-900 px-1.5 py-0.5 rounded-md">
                  ☠️ 사약
                </span>
              )}
            </div>
            {/* EXP 바 */}
            <div className="mb-1.5">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[9px] font-bold text-slate-400">EXP</span>
                <span className="text-[9px] font-bold text-slate-400">{exp} / {nextLevelExp}</span>
              </div>
              <div className="bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div className="h-full bg-violet-400 rounded-full transition-all duration-500" style={{ width: `${levelPct}%` }} />
              </div>
            </div>
            {/* 평판 바 */}
            <div>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[9px] font-bold text-slate-400">평판</span>
                <span className="text-[9px] font-bold text-slate-400">{repScore} / {nextRepThreshold}</span>
              </div>
              <div className="bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div className="h-full bg-emerald-400 rounded-full transition-all duration-500" style={{ width: `${repPct}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* 2. Social CTA */}
        {!isMe && currentNickname && (
          <div className="flex items-center gap-2 mb-4">
            {isMutual ? (
              <span className="flex-1 text-center py-2 text-[12px] font-[1000] text-emerald-600 bg-emerald-50 rounded-xl border border-emerald-200">🤝 맞깐부</span>
            ) : isFriend ? (
              <button onClick={() => onToggleFriend(targetNickname)} className="flex-1 py-2 text-[12px] font-[1000] text-slate-400 bg-slate-50 rounded-xl border border-slate-200 hover:bg-slate-100 transition-colors">깐부해제</button>
            ) : (
              <button onClick={() => onToggleFriend(targetNickname)} className="flex-1 py-2 text-[12px] font-[1000] text-white bg-violet-600 rounded-xl hover:bg-violet-700 transition-colors">+ 깐부맺기</button>
            )}
          </div>
        )}

        {/* 3. Intro */}
        <p className="text-[13px] font-medium text-slate-500 italic leading-relaxed">
          "{userData.bio || '소개글을 기다리고 있어요'}"
        </p>
      </div>

      {/* 4. Showcase — 내 홍보 이미지 */}
      {promoImages.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 mb-3">
          <h3 className="text-[11px] font-[1000] text-slate-400 uppercase tracking-widest mb-3">내 홍보</h3>
          <div className="grid grid-cols-3 gap-2">
            {promoImages.slice(0, 6).map((url, i) => (
              <div key={i} className="aspect-[16/9] rounded-lg overflow-hidden border border-slate-100 bg-slate-50">
                <img src={url} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. Stats — 활동 지표 */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 mb-3">
        <div className="flex items-center justify-around text-center">
          <div className="flex flex-col">
            <span className="text-[16px] font-[1000] text-slate-900">{userPosts.length}</span>
            <span className="text-[10px] font-bold text-slate-400">작성글</span>
          </div>
          <div className="w-px h-8 bg-slate-100" />
          <div className="flex flex-col">
            <span className="text-[16px] font-[1000] text-slate-900">{friendCount}</span>
            <span className="text-[10px] font-bold text-slate-400">깐부</span>
          </div>
          <div className="w-px h-8 bg-slate-100" />
          <div className="flex flex-col">
            <span className="text-[16px] font-[1000] text-slate-900">{followerCount}</span>
            <span className="text-[10px] font-bold text-slate-400">깐부수</span>
          </div>
          <div className="w-px h-8 bg-slate-100" />
          <div className="flex flex-col">
            <span className="text-[16px] font-[1000] text-amber-500">⚾ {formatKoreanNumber(userData.ballReceived || 0)}</span>
            <span className="text-[10px] font-bold text-slate-400">받은볼</span>
          </div>
        </div>
      </div>

      {/* 5-1. 🏅 크리에이터 점수 — 상세 뷰 전용 (feedback_reputation_avatar_scope) */}
      <CreatorScoreInfo userData={userData} />

      {/* 5-2. 🏷️ 칭호 도감 — 타인 프로필에서도 수집 현황 열람 */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 mb-3">
        <TitleCollection titles={userData.titles} isOwnProfile={false} />
      </div>

      {/* 6. Best 3 — 대표 콘텐츠 */}
      {best3.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 mb-3">
          <h3 className="text-[11px] font-[1000] text-slate-400 uppercase tracking-widest mb-3">대표 콘텐츠</h3>
          <div className="flex flex-col gap-2">
            {best3.map(post => (
              <button
                key={post.id}
                onClick={() => onPostClick(post)}
                className="w-full text-left bg-slate-50 rounded-xl px-4 py-3 hover:bg-slate-100 transition-colors border border-slate-100"
              >
                <h4 className="text-[13px] font-[1000] text-slate-900 line-clamp-1 mb-1">{post.title}</h4>
                <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400">
                  <span className="flex items-center gap-1">
                    <svg className="w-3 h-3 text-rose-400 fill-current" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                    {formatKoreanNumber(post.likes || 0)}
                  </span>
                  <span className="flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
                    {commentCounts[post.id] || 0}
                  </span>
                  <span>{formatTime(post.createdAt)}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 7. Feed — 작성 글 전체 목록 */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <h3 className="text-[11px] font-[1000] text-slate-400 uppercase tracking-widest mb-3">
          작성 글 ({userPosts.length})
        </h3>
        {userPosts.length === 0 ? (
          <p className="text-center text-slate-300 font-bold text-[12px] py-8">곧 멋진 글이 올라올 거예요!</p>
        ) : (
          <div className="flex flex-col gap-2">
            {userPosts.map(post => (
              <button
                key={post.id}
                onClick={() => onPostClick(post)}
                className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-[13px] font-[1000] text-slate-800 line-clamp-1 flex-1 mr-3">{post.title}</h4>
                  <div className="flex items-center gap-2 text-[9px] font-bold text-slate-300 shrink-0">
                    <span className="text-rose-400">♥ {post.likes || 0}</span>
                    <span>{formatTime(post.createdAt)}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PublicProfile;
