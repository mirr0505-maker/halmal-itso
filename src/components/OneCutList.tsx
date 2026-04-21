// src/components/OneCutList.tsx
import React, { useState } from 'react';
import type { Post, UserData } from '../types';
import { formatKoreanNumber, getReputationLabel, getReputation, calculateLevel } from '../utils';

interface Props {
  posts: Post[];
  allPosts: Post[];
  onTopicClick: (post: Post) => void;
  onLikeClick?: (e: React.MouseEvent, postId: string) => void;
  currentNickname?: string;
  allUsers?: Record<string, UserData>;
  followerCounts?: Record<string, number>;
  commentCounts?: Record<string, number>;
  onShareCount?: (postId: string, authorId?: string) => void;
  onEditClick?: (post: Post) => void;
  onAuthorClick?: (nickname: string) => void;
}

const OneCutList = ({ posts, allPosts, onTopicClick, onLikeClick, currentNickname, allUsers = {}, followerCounts = {}, commentCounts = {}, onShareCount, onEditClick, onAuthorClick }: Props) => {
  // 🚀 공유 URL 복사 피드백 — 어떤 카드가 복사되었는지 추적
  const [copiedPostId, setCopiedPostId] = useState<string | null>(null);
  const handleCopyUrl = (e: React.MouseEvent, postId: string, authorId?: string) => {
    e.stopPropagation();
    const shareToken = postId.split('_').slice(0, 2).join('_');
    navigator.clipboard.writeText(`${window.location.origin}/p/${shareToken}`).then(() => {
      setCopiedPostId(postId);
      setTimeout(() => setCopiedPostId(null), 2000);
      onShareCount?.(postId, authorId);
    });
  };

  if (posts.length === 0) return (
    <div className="py-20 text-center text-slate-300 font-[1000] text-[16px]">
      첫 번째 한컷을 기다리고 있어요!
    </div>
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 pb-40">
      {posts.map((post) => {
        const isLikedByMe = currentNickname && post.likedBy?.includes(currentNickname);
        const authorData = (post.author_id && allUsers[post.author_id]) || allUsers[`nickname_${post.author}`];
        const realFollowers = followerCounts[post.author] || 0;
        const displayLevel = calculateLevel(authorData?.exp || 0);
        const displayLikes = authorData ? authorData.likes : (post.authorInfo?.totalLikes || 0);
        
        // 연결된 원본글 찾기
        const linkedPost = post.linkedPostId ? allPosts.find(p => p.id === post.linkedPostId) : null;

        return (
          <div 
            key={post.id} 
            onClick={() => onTopicClick(post)}
            className="group flex flex-col bg-white rounded-[4px] overflow-hidden cursor-pointer shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-100"
          >
            {/* 1. 이미지 영역 (세로 사이즈 절반 축소) */}
            <div className="relative aspect-[16/9] overflow-hidden bg-slate-900 shrink-0 border-b border-slate-50">
              {(() => {
                // 🍞 썸네일: imageUrls[0] 우선, fallback으로 imageUrl
                const thumb = post.imageUrls?.[0] || post.imageUrl;
                const cutCount = post.imageUrls?.length ?? (post.imageUrl ? 1 : 0);
                return (
                  <>
                    {thumb ? (
                      <img src={thumb} alt="" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-700">
                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      </div>
                    )}
                    {/* 🍞 N/M 배지 — 1컷도 1/1로 표시하여 통일성 유지 */}
                    {cutCount > 0 && (
                      <span className="absolute top-2 left-2 px-2 py-0.5 bg-black/60 backdrop-blur-sm text-white text-[10px] font-black rounded-full">
                        <span className="grayscale opacity-90">🍞</span> 1/{cutCount}
                      </span>
                    )}
                  </>
                );
              })()}

              {/* 내 글 수정 버튼 (태그는 삭제됨) */}
              {currentNickname && post.author === currentNickname && (
                <button
                  onClick={(e) => { e.stopPropagation(); onEditClick?.(post); }}
                  className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm text-slate-700 text-[8px] font-black px-1.5 py-0.5 rounded-[1px] shadow-lg hover:bg-white transition-colors"
                >
                  수정
                </button>
              )}
            </div>

            {/* 2. 텍스트 영역 */}
            <div className="flex-1 px-3 pt-2.5 pb-2 flex flex-col gap-1 bg-white">
              <h3 className="text-[13px] font-[1000] text-slate-900 line-clamp-1 tracking-tighter leading-tight group-hover:text-blue-600 transition-colors">
                {post.title}
              </h3>

              {/* 원본글 링크 — 있을 때만 렌더링 */}
              {/* 원본글 링크 — 없어도 높이 확보 (카드 세로 사이즈 통일) */}
              <div className="pt-1 min-h-[22px]">
                {linkedPost ? (
                  <div className="flex items-center gap-1 text-blue-600 bg-blue-50/50 px-2 py-0.5 rounded-[2px] border border-blue-100/20">
                    <span className="text-[8px]">🔗</span>
                    <span className="text-[8px] font-black truncate tracking-tighter">{linkedPost.title}</span>
                  </div>
                ) : post.linkUrl ? (
                  <a href={post.linkUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                    className="flex items-center gap-1 text-blue-600 bg-blue-50/50 px-2 py-0.5 rounded-[2px] border border-blue-100/20 hover:bg-blue-50 transition-colors">
                    <span className="text-[8px]">🔗</span>
                    <span className="text-[8px] font-black truncate tracking-tighter">{new URL(post.linkUrl).hostname}</span>
                  </a>
                ) : null}
              </div>

              {/* 🚀 하단: 일반 글카드(AnyTalkList)와 완전 동일 구조 */}
              <div className="flex-1" />
              <div className="pt-1 border-t border-slate-50 flex items-center justify-between">
                <div
                  className="flex items-center gap-1.5 min-w-0 cursor-pointer hover:opacity-70 transition-opacity"
                  onClick={(e) => { e.stopPropagation(); onAuthorClick?.(post.author); }}
                >
                  <div className="w-6 h-6 rounded-full bg-slate-50 overflow-hidden shrink-0 border border-white shadow-sm ring-1 ring-slate-100">
                    <img src={authorData?.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${post.author}`} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[11px] font-[1000] text-slate-900 truncate leading-none mb-0.5">{post.author}</span>
                    <span className="text-[9px] font-bold text-slate-400 truncate tracking-tight">Lv {displayLevel} · {getReputationLabel(authorData ? getReputation(authorData) : displayLikes)} · 깐부수 {formatKoreanNumber(realFollowers)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 text-[10px] font-black text-slate-300">
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                    {formatKoreanNumber(commentCounts[post.id] || 0)}
                  </span>
                  {(post.thanksballTotal || 0) > 0 && (
                    <span className="flex items-center gap-0.5 text-amber-400">
                      <span className="text-[13px]">⚾</span> {post.thanksballTotal}
                    </span>
                  )}
                  <span
                    onClick={(e) => { e.stopPropagation(); onLikeClick?.(e, post.id); }}
                    className={`flex items-center gap-1 cursor-pointer transition-colors ${isLikedByMe ? 'text-rose-500' : 'hover:text-rose-400'}`}
                  >
                    <svg className={`w-3.5 h-3.5 ${isLikedByMe ? 'fill-current' : 'fill-none'}`} stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
                    {formatKoreanNumber(post.likes || 0)}
                  </span>
                  {/* 공유 버튼 — hover 시 노출, 클릭 시 URL 복사 */}
                  <button
                    onClick={(e) => handleCopyUrl(e, post.id, post.author_id)}
                    className={`flex items-center gap-0.5 transition-all ${copiedPostId === post.id ? 'opacity-100 text-emerald-500' : 'opacity-0 group-hover:opacity-100 text-slate-300 hover:text-blue-400'}`}
                    title="글 링크 복사"
                  >
                    {copiedPostId === post.id
                      ? <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"/></svg>
                      : <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
                    }
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default OneCutList;
