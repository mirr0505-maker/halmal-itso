// src/components/LatestTalkList.tsx
import React from 'react';
import type { Post } from '../types';
import { getReputationLabel, formatKoreanNumber } from '../utils';

interface Props {
  rootPosts: Post[];
  onTopicClick: (post: Post) => void;
  onLikeClick?: (e: React.MouseEvent, postId: string) => void;
  commentCounts?: Record<string, number>;
  currentNickname?: string;
  allUsers?: Record<string, any>;
  followerCounts?: Record<string, number>;
}

const LatestTalkList = ({ 
  rootPosts, onTopicClick, onLikeClick, commentCounts = {}, currentNickname, allUsers = {}, followerCounts = {} 
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
    return createdAt.toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' }).replace(/\./g, '.');
  };

  return (
    <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-4 w-full pb-10">
      {rootPosts.map((post) => {
        const likes = post.likes || 0;
        const promoLevel = Math.min(likes, 3);
        const commentCount = commentCounts[post.id] || 0;
        const isLikedByMe = currentNickname && post.likedBy?.includes(currentNickname);

        // 🚀 실시간 유저 데이터 바인딩
        const authorData = (post.author_id && allUsers[post.author_id]) || allUsers[`nickname_${post.author}`];
        const realFollowers = followerCounts[post.author] || 0;
        const displayLevel = authorData ? authorData.level : (post.authorInfo?.level || 1);
        const displayLikes = authorData ? authorData.likes : (post.authorInfo?.totalLikes || 0);

        return (
          <div key={post.id} onClick={() => onTopicClick(post)} className="bg-white border border-slate-100 rounded-2xl p-5 cursor-pointer hover:border-blue-200 hover:shadow-md transition-all group flex flex-col md:flex-row gap-5 relative overflow-hidden shadow-sm">
            {post.imageUrl && (
              <div className="w-full md:w-[240px] h-[150px] rounded-xl overflow-hidden border border-slate-50 bg-slate-50 shrink-0">
                <img src={post.imageUrl} alt="Thumbnail" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
              </div>
            )}
            <div className="flex-1 flex flex-col min-w-0 py-0.5">
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-[17px] font-[1000] text-slate-900 group-hover:text-blue-600 line-clamp-1 leading-tight tracking-tight transition-colors">{post.title}</h3>
                <div className="flex gap-0.5 shrink-0 ml-4">
                  {[1, 2, 3].map((idx) => (
                    <svg key={idx} className={`w-3.5 h-3.5 transition-colors ${idx <= promoLevel ? 'text-rose-400 fill-current' : 'text-slate-100'}`} viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3" fill="none"><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                  ))}
                </div>
              </div>
              <p className="text-[14px] text-slate-600 leading-[1.6] font-medium tracking-tight mb-4 flex-1 line-clamp-3">{stripHtml(post.content)}</p>
              
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-auto">
                {/* 🚀 카테고리 뱃지 추가 */}
                <span className="text-[10px] font-black text-blue-500 bg-blue-50 px-2 py-0.5 rounded uppercase tracking-tighter mr-1">
                  {post.category || "나의 이야기"}
                </span>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 overflow-hidden border border-slate-100 shrink-0"><img src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${post.author}`} alt="avatar" className="w-full h-full object-cover" /></div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="text-[12.5px] font-[1000] text-slate-900 leading-none">{post.author}</span>
                        <span className="text-[10px] text-slate-400 font-bold">{formatRelativeTime(post.createdAt)}</span>
                      </div>
                      {/* 🚀 평판 등급 포함 통합 정보 */}
                      <span className="text-[10px] font-bold text-slate-500 leading-none mt-1">
                        Lv {displayLevel} · {getReputationLabel(displayLikes)} · 깐부 {formatKoreanNumber(realFollowers)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 text-slate-400 text-[11px] font-black border-l border-slate-100 pl-4">
                    <div className="flex items-center gap-1"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg><span>{formatKoreanNumber(commentCount)}</span></div>
                    <div className="flex items-center gap-1"><svg className={`w-4 h-4 transition-colors ${isLikedByMe ? 'fill-current text-rose-400' : 'fill-none text-rose-300'}`} viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" /></svg><span>{formatKoreanNumber(post.likes || 0)}</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default LatestTalkList;
