// src/components/AnyTalkList.tsx
import React from 'react';
import type { Post } from '../types';

interface Props {
  posts: Post[];
  onTopicClick: (post: Post) => void;
  onLikeClick?: (e: React.MouseEvent, postId: string) => void; 
  commentCounts?: Record<string, number>;
  currentNickname?: string;
}

const AnyTalkList = ({ posts, onTopicClick, onLikeClick, commentCounts = {}, currentNickname }: Props) => {
  const formatKoreanNumber = (num: number) => {
    if (num >= 10000) return Math.floor(num / 10000) + '만';
    if (num >= 1000) return Math.floor(num / 1000) + '천';
    return num.toLocaleString();
  };

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

  const getReputationLabel = (likes: number) => {
    if (likes >= 1000) return "확고";
    if (likes >= 500) return "우호";
    if (likes >= 100) return "약간 우호";
    if (likes < 0) return "적대";
    return "중립";
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 animate-in fade-in slide-in-from-bottom-4 w-full pb-4">
      {posts.length === 0 ? (
        <div className="col-span-full py-20 text-center text-slate-400 font-bold text-sm">
          아직 아무말이 없소. 첫 마디를 던져보시오!
        </div>
      ) : (
        posts.map((post) => {
          const likes = post.likes || 0;
          const promoLevel = Math.min(likes, 3);
          const commentCount = commentCounts[post.id] || 0;
          const isLikedByMe = currentNickname && (post as any).likedBy?.includes(currentNickname);

          return (
            <div 
              key={post.id}
              onClick={() => onTopicClick(post)}
              className="bg-white border border-slate-100 rounded-xl p-2.5 cursor-pointer hover:bg-slate-50 transition-all group flex flex-col h-full relative"
            >
              {/* 🚀 1. 상단: 제목 (1줄) */}
              <h3 className="text-[13px] font-[1000] text-slate-900 group-hover:text-blue-600 line-clamp-1 leading-tight tracking-tight mb-1">
                {post.title}
              </h3>

              {/* 🚀 2. 메타: 시간 & 승급 하트 */}
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[9px] text-slate-400 font-bold tracking-tight">{formatRelativeTime(post.createdAt)}</span>
                <div className="flex gap-0.5">
                  {[1, 2, 3].map((idx) => (
                    <svg 
                      key={idx}
                      className={`w-3 h-3 transition-colors ${idx <= promoLevel ? 'text-rose-200 fill-current' : 'text-slate-100'}`} 
                      viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3" fill="none"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                  ))}
                </div>
              </div>

              {/* 🚀 3. 중단: 본문 */}
              <p className={`text-[13.5px] text-slate-700 leading-[1.5] font-medium tracking-tight mb-1.5 flex-1 ${post.imageUrl ? 'line-clamp-2' : 'line-clamp-5'}`}>
                {stripHtml(post.content)}
              </p>

              {/* 🚀 4. 중단: 이미지 (h-100으로 확대) */}
              {post.imageUrl && (
                <div className="w-full h-[100px] rounded-lg overflow-hidden border border-slate-100 bg-slate-50 mb-1.5 shrink-0">
                  <img src={post.imageUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                </div>
              )}

              {/* 🚀 5. 하단 직전: 태그 & 통계 (데이터 노출 전용) */}
              <div className="flex justify-between items-center mb-2 border-b border-slate-50 pb-1.5">
                <div className="flex gap-1 overflow-hidden">
                  {(post.tags || ['#할말', '#있소']).slice(0, 3).map((tag, i) => (
                    <span key={i} className="text-[9.5px] font-bold text-blue-500 whitespace-nowrap">
                      {tag.startsWith('#') ? tag : `#${tag}`}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-slate-400 text-[10px] font-black shrink-0">
                  <div className="flex items-center gap-0.5">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <span>{formatKoreanNumber(commentCount)}</span>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <svg className={`w-3 h-3 transition-colors ${isLikedByMe ? 'fill-current text-rose-200' : 'text-rose-100'}`} viewBox="0 0 24 24">
                      <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
                    </svg>
                    <span>{formatKoreanNumber(likes)}</span>
                  </div>
                </div>
              </div>

              {/* 🚀 6. 최하단: 작성자 프로필 & 실제 클릭 가능한 하트 버튼 (토글 아이콘 적용) */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className="w-6 h-6 rounded-full bg-slate-100 overflow-hidden border border-slate-200 shrink-0">
                    <img src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${post.author}`} alt="avatar" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex flex-col justify-center min-w-0">
                    <span className="text-[11px] font-[1000] text-slate-900 leading-none mb-0.5 truncate">{post.author}</span>
                    <span className="text-[9px] font-bold text-slate-500 leading-none truncate">
                      Lv.{post.authorInfo?.level || 1} · {getReputationLabel(post.authorInfo?.totalLikes || 0)} · 깐부 {formatKoreanNumber(post.authorInfo?.friendCount || 0)}
                    </span>
                  </div>
                </div>
                
                {/* 🚀 실제 하트 토글 버튼 */}
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onLikeClick) onLikeClick(e, post.id);
                  }}
                  className={`w-7 h-7 flex items-center justify-center rounded-full transition-all active:scale-125 group/like shrink-0 ml-1 ${isLikedByMe ? 'bg-rose-50' : 'hover:bg-rose-50'}`}
                >
                  <svg className={`w-4 h-4 transition-colors ${isLikedByMe ? 'text-rose-500 fill-current' : 'text-rose-200 group-hover/like:text-rose-400 fill-none'}`} viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
                  </svg>
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};

export default AnyTalkList;
