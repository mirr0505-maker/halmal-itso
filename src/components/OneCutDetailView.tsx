// src/components/OneCutDetailView.tsx — 한컷 상세 뷰 (이미지 + 댓글 + 우측 한컷 목록)
// 🚀 댓글 구조 업그레이드: 작성자(좌) ↔ 독자(우) 지그재그 — OneCutCommentBoard 사용
import { useState, useEffect } from 'react';
import type { Post } from '../types';
import { formatKoreanNumber, getReputationLabel } from '../utils';
import OneCutCommentBoard from './OneCutCommentBoard';
import OneCutListSidebar from './OneCutListSidebar';

interface Props {
  rootPost: Post;
  allPosts: Post[];
  otherTopics: Post[];
  onTopicChange: (post: Post) => void;
  userData: any;
  friends: string[];
  onInlineReply?: (content: string, parentPost: Post | null, side?: 'left' | 'right') => Promise<void>;
  onLikeClick?: (e: React.MouseEvent | null, postId: string) => void;
  currentNickname?: string;
  allUsers?: Record<string, any>;
  followerCounts?: Record<string, number>;
  commentCounts?: Record<string, number>;
  onEditPost?: (post: Post) => void;
}

const OneCutDetailView = ({
  rootPost, allPosts, otherTopics, onTopicChange, userData,
  onInlineReply, onLikeClick, currentNickname, allUsers = {}, followerCounts = {}, commentCounts = {}, onEditPost
}: Props) => {
  const [imageError, setImageError] = useState(false);

  useEffect(() => { setImageError(false); }, [rootPost.id]);

  const authorData = (rootPost.author_id && allUsers[rootPost.author_id]) || allUsers[`nickname_${rootPost.author}`];
  const realFollowers = followerCounts[rootPost.author] || 0;
  const displayLevel = authorData ? authorData.level : (rootPost.authorInfo?.level || 1);
  const displayLikes = authorData ? authorData.likes : (rootPost.authorInfo?.totalLikes || 0);
  const isLikedByMe = currentNickname && rootPost.likedBy?.includes(currentNickname);
  const isMyPost = !!currentNickname && rootPost.author === currentNickname;
  
  const linkedPost = rootPost.linkedPostId
    ? (otherTopics.find(p => p.id === rootPost.linkedPostId) || allPosts.find(p => p.id === rootPost.linkedPostId))
    : undefined;

  const getTimeAgo = (timestamp: any) => {
    if (!timestamp) return "";
    const now = new Date();
    const createdAt = new Date(timestamp.seconds * 1000);
    const diffInSeconds = Math.floor((now.getTime() - createdAt.getTime()) / 1000);
    if (diffInSeconds < 60) return "방금 전";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}분 전`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}시간 전`;
    return createdAt.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  };

  const sideOneCuts = otherTopics.filter(t => (t.isOneCut || t.category === "한컷") && t.id !== rootPost.id);

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 w-full max-w-[1600px] mx-auto animate-in fade-in duration-700 items-start">
      
      {/* 🚀 중앙 단일 통합 박스 (좌측 8) */}
      <div className="col-span-1 md:col-span-9">
        <div className="bg-white border border-slate-100 rounded-[4px] shadow-2xl flex flex-col">
          
          {/* 이미지 → 헤더 → 아바타 → 댓글 중앙 정렬 컬럼 */}
          <div className="bg-white flex flex-col items-center">

            {/* 헤더 (제목, 태그, 시간) */}
            <div className="w-[65%] pt-2 pb-1 space-y-1 border-x border-slate-100">
              <div className="flex justify-between items-start gap-2">
                <div className="space-y-1 min-w-0">
                  <h2 className="text-base font-[1000] text-slate-900 tracking-tighter leading-tight">{rootPost.title}</h2>
                  {(rootPost.tags || []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {(rootPost.tags || []).map((tag, i) => (
                        <span key={i} className="text-[10px] font-black text-blue-500 bg-blue-50/50 px-2 py-0.5 rounded-[2px] border border-blue-100/30">#{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{getTimeAgo(rootPost.createdAt)}</span>
                  {isMyPost && (
                    <button onClick={() => onEditPost?.(rootPost)} className="text-[9px] font-black text-blue-400 hover:text-blue-600 transition-colors uppercase tracking-tighter border-b border-blue-100 hover:border-blue-400">Edit</button>
                  )}
                </div>
              </div>
            </div>

            {/* 이미지 */}
            <div className="w-[65%] aspect-[3/4] bg-white overflow-hidden border-x border-slate-100">
              <img
                src={rootPost.imageUrl || ""}
                alt="OneCut"
                className={`w-full h-full object-cover transition-all duration-1000 ${imageError ? 'hidden' : 'block'}`}
                onError={() => setImageError(true)}
              />
              {imageError && (
                <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-slate-300 text-center">
                  <svg className="w-12 h-12 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                  <p className="font-black text-sm">이미지를 불러올 수 없소.</p>
                </div>
              )}
            </div>

            {/* 상세 설명 */}
            {rootPost.content && rootPost.content.trim() ? (
              <div className="w-[65%] py-1 px-0 border-x border-slate-100">
                <p className="text-[12px] text-slate-500 leading-relaxed font-medium whitespace-pre-wrap">{rootPost.content}</p>
              </div>
            ) : null}

            {/* 아바타 (작성자 정보) */}
            <div className="w-[65%] py-2 border-x border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-white border border-slate-100 shadow-sm overflow-hidden shrink-0">
                  <img src={authorData?.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${rootPost.author}`} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="font-[1000] text-slate-900 text-sm leading-none tracking-tighter">{rootPost.author}</span>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold">
                    <span className="bg-blue-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded-[2px] uppercase">Lv {displayLevel}</span>
                    <span className="w-px h-3 bg-slate-200" />
                    <span>{getReputationLabel(displayLikes)}</span>
                    <span className="w-px h-3 bg-slate-200" />
                    <span>깐부 {formatKoreanNumber(realFollowers)}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="text-[9px] font-[1000] text-slate-300 uppercase tracking-widest">댓글</p>
                  <p className="text-sm font-[1000] text-slate-900">{formatKoreanNumber(allPosts.length)}</p>
                </div>
                <button onClick={() => onLikeClick?.(null, rootPost.id)} className="flex flex-col items-center group transition-all active:scale-90">
                  <p className="text-[9px] font-[1000] text-slate-300 uppercase tracking-widest group-hover:text-rose-400 transition-colors">좋아요</p>
                  <div className="flex items-center gap-1">
                    <svg className={`w-3.5 h-3.5 transition-all ${isLikedByMe ? 'text-rose-500 fill-current' : 'text-slate-200 fill-none group-hover:text-rose-300'}`} stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" /></svg>
                    <span className={`text-sm font-[1000] ${isLikedByMe ? 'text-rose-500' : 'text-slate-900'}`}>{formatKoreanNumber(rootPost.likes || 0)}</span>
                  </div>
                </button>
              </div>
            </div>

            {/* 원본글 링크 */}
            {linkedPost && (
              <div className="w-[65%] pb-2 border-x border-slate-100">
                <button onClick={() => onTopicChange(linkedPost)} className="group flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-[4px] transition-all w-full shadow-sm">
                  <span className="text-[11px]">🔗</span>
                  <span className="text-[11px] font-[1000] truncate">{linkedPost.title}</span>
                  <svg className="w-3 h-3 shrink-0 opacity-80 group-hover:translate-x-0.5 transition-transform ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                </button>
              </div>
            )}

            {/* 🚀 좌우 지그재그 댓글: 작성자(좌) ↔ 독자(우) */}
            <div className="w-[65%] border-x border-slate-100">
              <OneCutCommentBoard
                allChildPosts={allPosts}
                rootPost={rootPost}
                currentNickname={currentNickname}
                currentUserData={userData}
                onLikeClick={onLikeClick}
                onInlineReply={onInlineReply}
                allUsers={allUsers}
                followerCounts={followerCounts}
              />
            </div>

          </div>
        </div>
      </div>

      {/* 우측: 다른 한컷 목록 */}
      <OneCutListSidebar
        oneCuts={sideOneCuts}
        onOneCutClick={onTopicChange}
        commentCounts={commentCounts}
        allUsers={allUsers}
        followerCounts={followerCounts}
      />
    </div>
  );
};

export default OneCutDetailView;
