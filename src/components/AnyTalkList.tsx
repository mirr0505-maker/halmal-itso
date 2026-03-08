// src/components/AnyTalkList.tsx
import React from 'react';
import type { Post } from '../types';
import { formatKoreanNumber, getReputationLabel } from '../utils';

interface Props {
  posts: Post[];
  onTopicClick: (post: Post) => void;
  onLikeClick?: (e: React.MouseEvent, postId: string) => void; 
  commentCounts?: Record<string, number>;
  currentNickname?: string;
  currentUserData?: any;
  allUsers?: Record<string, any>;
  followerCounts?: Record<string, number>;
}

const AnyTalkList = ({ 
  posts, onTopicClick, onLikeClick, commentCounts = {}, currentNickname, allUsers = {}, followerCounts = {}
}: Props) => {

  const stripHtml = (html: string) => {
    const tmp = document.createElement("DIV");
    tmp.innerHTML = html;
    return tmp.innerText || tmp.textContent || "";
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
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 w-full pb-10">
      {posts.length === 0 ? (
        <div className="col-span-full py-20 text-center text-slate-400 font-bold text-sm italic">아무말이 없소.</div>
      ) : (
        posts.map((post) => {
          const promoLevel = Math.min(post.likes || 0, 3);
          const commentCount = commentCounts[post.id] || 0;
          const isLikedByMe = currentNickname && post.likedBy?.includes(currentNickname);

          // 🚀 실시간 사용자 데이터 바인딩
          const authorData = (post.author_id && allUsers[post.author_id]) || allUsers[`nickname_${post.author}`];
          const realFollowers = followerCounts[post.author] || 0;
          const displayLevel = authorData ? authorData.level : (post.authorInfo?.level || 1);
          const displayLikes = authorData ? authorData.likes : (post.authorInfo?.totalLikes || 0);

          return (
            <div key={post.id} onClick={() => onTopicClick(post)} className="bg-white border border-slate-100 rounded-2xl p-3.5 cursor-pointer hover:border-blue-500 transition-all group flex flex-col h-full shadow-sm">
              <div className="flex justify-between items-center mb-1.5 shrink-0">
                <span className="text-[9px] text-slate-400 font-bold">{formatRelativeTime(post.createdAt)}</span>
                <div className="flex gap-0.5">
                  {[1, 2, 3].map((idx) => (
                    <svg 
                      key={idx} 
                      className={`w-2.5 h-3 transition-colors ${idx <= promoLevel ? 'text-rose-400 fill-current' : 'text-slate-200 fill-none'}`} 
                      viewBox="0 0 24 24" 
                      stroke="currentColor" 
                      strokeWidth="3"
                    >
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                    </svg>
                  ))}
                </div>
              </div>
              
              <h3 className="text-[13.5px] font-[1000] text-slate-900 group-hover:text-blue-600 line-clamp-1 mb-1 tracking-tight shrink-0">{post.title}</h3>
              <p className="text-[12.5px] text-slate-600 line-clamp-3 flex-1 mb-2.5 leading-snug font-medium">{stripHtml(post.content)}</p>
              
              {post.imageUrl && <div className="w-full h-20 rounded-xl overflow-hidden mb-2.5 shrink-0 bg-slate-50"><img src={post.imageUrl} alt="" className="w-full h-full object-cover" /></div>}
              
              <div className="pt-2 border-t border-slate-50 mt-auto flex flex-col gap-1.5 shrink-0">
                <div className="flex items-center">
                  <span className="text-[8.5px] font-black text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded-md uppercase tracking-tighter">
                    {post.category || "나의 이야기"}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6.5 h-6.5 rounded-full bg-slate-50 overflow-hidden shrink-0 border border-slate-100"><img src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${post.author}`} alt="" className="w-full h-full object-cover" /></div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[10.5px] font-black text-slate-900 truncate leading-none mb-0.5">{post.author}</span>
                      <span className="text-[8.5px] font-bold text-slate-400 truncate tracking-tight">
                        Lv {displayLevel} · {getReputationLabel(displayLikes)} · 깐부 {formatKoreanNumber(realFollowers)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-black shrink-0">
                    <span className="flex items-center gap-0.5"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>{formatKoreanNumber(commentCount)}</span>
                    <span 
                      onClick={(e) => { e.stopPropagation(); onLikeClick?.(e, post.id); }}
                      className={`flex items-center gap-0.5 cursor-pointer hover:text-rose-500 transition-colors ${isLikedByMe ? 'text-rose-500' : ''}`}
                    >
                      <svg className={`w-3 h-3 ${isLikedByMe ? 'fill-current' : 'fill-none'}`} stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
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
