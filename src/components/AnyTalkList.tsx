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
    <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3.5 animate-in fade-in slide-in-from-bottom-4 w-full">
      {posts.length === 0 ? (
        <div className="col-span-full py-20 text-center text-slate-400 font-bold text-sm">
          아직 아무말이 없소. 첫 마디를 던져보시오!
        </div>
      ) : (
        posts.map((post) => {
          return (
            <div 
              key={post.id}
              onClick={() => onTopicClick(post)}
              className="bg-white border border-slate-200 rounded-xl p-3.5 cursor-pointer hover:shadow-lg transition-all group flex flex-col justify-between"
            >
              <div className="flex gap-3.5 h-full overflow-hidden mb-2.5">
                {/* 🚀 왼쪽: 글 내용 (30% 키움) */}
                <div className="flex-1 flex flex-col min-w-0">
                  <h3 className="text-[13px] font-[1000] text-slate-900 group-hover:text-blue-600 line-clamp-2 leading-tight mb-1">
                    {post.title}
                  </h3>
                  <span className="text-[10px] text-slate-400 font-medium mb-2 block">{formatRelativeTime(post.createdAt)}</span>
                  
                  <p className="text-[12px] text-slate-600 line-clamp-4 leading-snug flex-1">
                    {stripHtml(post.content)}
                  </p>
                </div>

                {/* 🚀 오른쪽: 이미지 */}
                {post.imageUrl && (
                  <div className="w-28 h-24 rounded-lg overflow-hidden border border-slate-100 bg-slate-50 shrink-0 relative">
                    <img src={post.imageUrl} alt="Thumbnail" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    {post.linkUrl && (
                      <div className="absolute top-1.5 right-1.5 bg-black/60 backdrop-blur-sm text-white text-[8px] font-black px-1.5 py-0.5 rounded">🔗</div>
                    )}
                  </div>
                )}
              </div>

              <div className="pt-2.5 border-t border-slate-50 flex justify-between items-center mt-auto">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-slate-100 overflow-hidden border border-slate-200 shrink-0">
                    <img src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${post.author}`} alt="avatar" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[11px] font-[1000] text-slate-900 leading-none mb-0.5">{post.author}</span>
                    <span className="text-[9px] font-bold text-slate-500 leading-none">Lv.1 · 중립</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2.5 text-slate-400 text-[10px] font-black">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onLikeClick) onLikeClick(e, post.id);
                    }}
                    className="hover:text-rose-500 transition-colors"
                  >
                    👍 {post.likes || 0}
                  </button>
                  <span>{formatRelativeTime(post.createdAt)}</span>
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
