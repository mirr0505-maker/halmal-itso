// src/components/OneCutList.tsx
import React from 'react';
import type { Post } from '../types';
import { formatKoreanNumber } from '../utils';

interface Props {
  posts: Post[];
  onTopicClick: (post: Post) => void;
  onLikeClick?: (e: React.MouseEvent, postId: string) => void;
  currentNickname?: string;
  allUsers?: Record<string, any>;
}

const OneCutList = ({ posts, onTopicClick, onLikeClick, currentNickname, allUsers = {} }: Props) => {
  if (posts.length === 0) {
    return <div className="w-full py-40 text-center text-slate-400 font-bold italic">아직 올라온 한컷이 없소.</div>;
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 pb-20">
      {posts.map((post) => {
        const isLikedByMe = currentNickname && post.likedBy?.includes(currentNickname);
        const authorData = (post.author_id && allUsers[post.author_id]) || allUsers[`nickname_${post.author}`];

        return (
          <div 
            key={post.id} 
            onClick={() => onTopicClick(post)}
            className="group relative aspect-[9/16] bg-slate-900 rounded-[2rem] overflow-hidden cursor-pointer shadow-lg hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 border border-slate-100"
          >
            {/* Image */}
            {post.imageUrl ? (
              <img src={post.imageUrl} alt="" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-700">
                <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </div>
            )}

            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-80 group-hover:opacity-100 transition-opacity" />

            {/* Content Overlay */}
            <div className="absolute inset-0 p-6 flex flex-col justify-end">
              <div className="translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                <h3 className="text-white font-[1000] text-lg leading-tight mb-3 italic tracking-tighter line-clamp-2 drop-shadow-md">
                  {post.title}
                </h3>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-white/10 border border-white/20 overflow-hidden shadow-sm">
                      <img src={authorData?.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${post.author}`} alt="" className="w-full h-full object-cover" />
                    </div>
                    <span className="text-white/80 text-[11px] font-black truncate max-w-[80px]">{post.author}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <button 
                      onClick={(e) => { e.stopPropagation(); onLikeClick?.(e, post.id); }}
                      className={`flex items-center gap-1 text-[11px] font-black transition-colors ${isLikedByMe ? 'text-rose-400' : 'text-white/60 hover:text-white'}`}
                    >
                      <svg className={`w-3.5 h-3.5 ${isLikedByMe ? 'fill-current' : 'fill-none'}`} stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
                      {formatKoreanNumber(post.likes || 0)}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Category Tag */}
            <div className="absolute top-5 left-5">
              <span className="bg-blue-600 text-white text-[9px] font-black px-2 py-1 rounded-lg shadow-lg uppercase tracking-widest">OneCut</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default OneCutList;
