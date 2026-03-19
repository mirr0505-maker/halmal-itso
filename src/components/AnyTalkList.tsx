// src/components/AnyTalkList.tsx
import React from 'react';
import type { Post } from '../types';
import { formatKoreanNumber, getReputationLabel, getCategoryDisplayName } from '../utils';

interface Props {
  posts: Post[];
  onTopicClick: (post: Post) => void;
  onLikeClick?: (e: React.MouseEvent, postId: string) => void;
  commentCounts?: Record<string, number>;
  currentNickname?: string;
  currentUserData?: any;
  allUsers?: Record<string, any>;
  followerCounts?: Record<string, number>;
  tab?: string;
}

const AnyTalkList = ({
  posts, onTopicClick, onLikeClick, commentCounts = {}, currentNickname, allUsers = {}, followerCounts = {}, tab
}: Props) => {
  const showGoldHeart = tab === 'recent' || tab === 'best' || tab === 'rank';

  const stripHtml = (html: string) => {
    const tmp = document.createElement("DIV");
    tmp.innerHTML = html;
    return tmp.innerText || tmp.textContent || "";
  };

  // 🚀 본문 HTML에서 첫 번째 이미지 URL 추출
  const extractFirstImage = (html: string) => {
    const div = document.createElement('div');
    div.innerHTML = html;
    const img = div.querySelector('img');
    return img ? img.src : null;
  };

  const formatRelativeTime = (timestamp: any) => {
    if (!timestamp) return "방금 전";
    const now = new Date();
    const createdAt = new Date(timestamp.seconds * 1000);
    const diffInHours = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60));
    if (diffInHours < 1) return "방금 전";
    if (diffInHours < 24) return `${diffInHours}시간 전`;
    return createdAt.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' });
  };

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4 w-full pb-20">
      {posts.length === 0 ? (
        <div className="col-span-full py-40 text-center text-slate-400 font-bold text-sm italic">기록된 글이 없어요.</div>
      ) : (
        posts.map((post) => {
          const promoLevel = Math.min(post.likes || 0, 3);
          const commentCount = commentCounts[post.id] || 0;
          const isLikedByMe = currentNickname && post.likedBy?.includes(currentNickname);
          const displayImage = post.imageUrl || extractFirstImage(post.content);

          // 🚀 실시간 사용자 데이터 바인딩
          const authorData = (post.author_id && allUsers[post.author_id]) || allUsers[`nickname_${post.author}`];
          const realFollowers = followerCounts[post.author] || 0;
          const displayLevel = authorData ? authorData.level : (post.authorInfo?.level || 1);
          const displayLikes = authorData ? (authorData.likes || 0) : (post.authorInfo?.totalLikes || 0);

          const goldHeartCount = (post.likedBy || []).filter(nickname => {
            const ud = allUsers[`nickname_${nickname}`];
            return ud && (ud.level || 1) >= 5;
          }).length;

          return (
            <div 
              key={post.id} 
              onClick={() => onTopicClick(post)} 
              className="bg-white border border-slate-100 rounded-[2rem] p-5 cursor-pointer hover:border-blue-400 hover:shadow-xl transition-all group flex flex-col shadow-sm"
            >
              {/* 1. 최상단: 제목 및 시간/프로모션 */}
              <div className="flex justify-between items-start mb-3 shrink-0">
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="text-[9px] text-slate-300 font-black uppercase tracking-tighter">{formatRelativeTime(post.createdAt)}</span>
                  <h3 className="text-[15px] font-[1000] text-slate-900 group-hover:text-blue-600 line-clamp-2 leading-tight tracking-tight transition-colors">
                    {post.title}
                  </h3>
                </div>
                {showGoldHeart ? (
                  <div className="flex items-center gap-0.5 shrink-0 ml-2 pt-1">
                    <svg className={`w-3.5 h-3.5 text-amber-400 ${goldHeartCount > 0 ? 'fill-current' : 'fill-none'}`} viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                    </svg>
                    <span className="text-[9px] font-[1000] text-amber-400">{goldHeartCount}</span>
                  </div>
                ) : (
                  <div className="flex gap-0.5 shrink-0 ml-2 pt-1">
                    {[1, 2, 3].map((idx) => (
                      <svg
                        key={idx}
                        className={`w-3 h-3 transition-colors ${idx <= promoLevel ? 'text-rose-400 fill-current' : 'text-slate-100 fill-none'}`}
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="3"
                      >
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                      </svg>
                    ))}
                  </div>
                )}
              </div>
              
              {/* 2. 중간: 내용 (이미지 여부에 따라 줄 수 가변적 조절) */}
              <div className="flex-1 overflow-hidden mb-4">
                <p className={`text-[13px] text-slate-500 leading-relaxed font-medium ${displayImage ? 'line-clamp-5' : 'line-clamp-[12]'}`}>
                  {stripHtml(post.content)}
                </p>
              </div>
              
              {/* 3. 하단부: 이미지 (있는 경우만 노출) */}
              {displayImage && (
                <div className="w-full aspect-video rounded-2xl overflow-hidden shrink-0 bg-slate-50 border border-slate-50 mb-2">
                  <img src={displayImage} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                </div>
              )}
              
              {/* 4. 최하단: 카테고리 & 아바타/유저정보 */}
              <div className="pt-2 border-t border-slate-50 mt-auto flex flex-col gap-2 shrink-0">
                <div className="flex items-center">
                  <span className="text-[8px] font-[1000] text-blue-500 bg-blue-50 px-2 py-0.5 rounded-md uppercase tracking-widest border border-blue-100/30">
                    {getCategoryDisplayName(post.category)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-slate-50 overflow-hidden shrink-0 border-2 border-white shadow-sm ring-1 ring-slate-100">
                      <img src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${post.author}`} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[11px] font-[1000] text-slate-900 truncate leading-none mb-1">{post.author}</span>
                      <span className="text-[9px] font-bold text-slate-400 truncate tracking-tight">
                        Lv {displayLevel} · {getReputationLabel(displayLikes)} · 깐부 {formatKoreanNumber(realFollowers)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 text-slate-300 text-[10px] font-black shrink-0">
                    <span className="flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                      {formatKoreanNumber(commentCount)}
                    </span>
                    <span 
                      onClick={(e) => { e.stopPropagation(); onLikeClick?.(e, post.id); }}
                      className={`flex items-center gap-1 cursor-pointer transition-colors ${isLikedByMe ? 'text-rose-500' : 'hover:text-rose-400'}`}
                    >
                      <svg className={`w-3.5 h-3.5 ${isLikedByMe ? 'fill-current' : 'fill-none'}`} stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
                      {formatKoreanNumber(post.likes || 0)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};

export default AnyTalkList;
