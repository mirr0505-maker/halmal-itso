// src/components/AnyTalkList.tsx
import React from 'react';
import type { Post } from '../types';

interface Props {
  posts: Post[];
  onTopicClick: (post: Post) => void;
  onLikeClick?: (e: React.MouseEvent, postId: string) => void; 
}

const AnyTalkList = ({ posts, onTopicClick, onLikeClick }: Props) => {
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 w-full">
      {posts.length === 0 ? (
        <div className="col-span-full py-20 text-center text-slate-400 font-bold">
          아직 아무말이 없소. 첫 마디를 던져보시오!
        </div>
      ) : (
        posts.map((post) => {
          const displayInfo = post.authorInfo || { level: 1 };
          const likesLabel = post.likes && post.likes > 10000 ? `+${Math.floor(post.likes/10000)}만` : (post.likes && post.likes >= 1000 ? `+${Math.floor(post.likes/1000)}천` : null);

          return (
            <div 
              key={post.id}
              onClick={() => onTopicClick(post)}
              className="bg-white border border-slate-200 rounded-2xl p-5 cursor-pointer hover:shadow-md hover:border-slate-300 transition-all group flex flex-col"
            >
              <div className="flex justify-between items-start mb-1">
                <h3 className="text-lg font-[1000] text-slate-900 group-hover:text-blue-600 line-clamp-1 pr-2">
                  {post.title}
                </h3>
                {likesLabel && (
                  <span className="bg-blue-600 text-white text-[10px] font-black px-2 py-0.5 rounded-md whitespace-nowrap shadow-sm">
                    {likesLabel}
                  </span>
                )}
              </div>
              <span className="text-xs text-slate-400 font-medium mb-3 block">{formatRelativeTime(post.createdAt)}</span>
              
              <p className="text-sm text-slate-600 line-clamp-3 leading-relaxed mb-4 flex-1">
                {stripHtml(post.content)}
              </p>
              
              {post.imageUrl && (
                <div className="w-full aspect-[4/3] rounded-xl overflow-hidden mb-4 border border-slate-100 bg-slate-50 relative">
                  <img src={post.imageUrl} alt="Thumbnail" className="w-full h-full object-cover" />
                  {post.linkUrl && (
                    <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-white text-[9px] font-black px-2 py-1 rounded">🔗 LINK</div>
                  )}
                </div>
              )}

              {!post.imageUrl && post.linkUrl && (
                <div className="mb-4">
                  <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded font-bold inline-flex items-center gap-1">🔗 첨부된 링크 있음</span>
                </div>
              )}

              <div className="flex flex-wrap gap-1.5 mb-4">
                <span className="text-xs font-bold text-blue-500 bg-blue-50/50 px-1.5 py-0.5 rounded">#할말있소</span>
                <span className="text-xs font-bold text-blue-500 bg-blue-50/50 px-1.5 py-0.5 rounded">#{post.type === 'formal' ? '타운홀' : '자유로운할말'}</span>
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-slate-100 mt-auto">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-slate-100 overflow-hidden border border-slate-200 shrink-0">
                    <img src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${post.author}`} alt="avatar" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-[1000] text-slate-900 leading-none mb-1">{post.author}</span>
                    <span className="text-[10px] font-bold text-slate-500 leading-none">Lv.{displayInfo.level} · 중립</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 text-slate-400 text-xs font-bold">
                  <span className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                    {post.likes || 0}
                  </span>
                  <button 
                    onClick={(e) => {
                      if (onLikeClick) onLikeClick(e, post.id);
                    }}
                    className={`flex items-center gap-1 transition-colors ${post.likes && post.likes > 0 ? 'text-rose-500' : 'hover:text-rose-500'}`}
                  >
                    <svg className="w-4 h-4" fill={post.likes && post.likes > 0 ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                    {post.likes || 0}
                  </button>
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