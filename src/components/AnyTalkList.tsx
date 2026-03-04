// src/components/AnyTalkList.tsx
import React from 'react';
import type { Post } from '../types';

interface Props {
  posts: Post[];
  onTopicClick: (post: Post) => void;
  onLikeClick?: (e: React.MouseEvent, postId: string) => void; 
}

const AnyTalkList = ({ posts, onTopicClick, onLikeClick }: Props) => {
  // 🚀 줄바꿈을 보존하며 HTML을 제거하는 고도화된 헬퍼
  const stripHtml = (html: string) => {
    const tmp = document.createElement("DIV");
    tmp.innerHTML = html;
    // innerText는 <p>, <br> 등을 실제 줄바꿈(\n)으로 변환하여 텍스트가 붙는 현상을 방지합니다.
    return tmp.innerText || tmp.textContent || "";
  };

  // 🚀 상대적 시간 계산 헬퍼 (방금 전, n분 전 등)
  const formatRelativeTime = (timestamp: any) => {
    if (!timestamp) return "방금 전";
    const now = new Date();
    const createdAt = new Date(timestamp.seconds * 1000);
    const diffInSeconds = Math.floor((now.getTime() - createdAt.getTime()) / 1000);

    if (diffInSeconds < 60) return "방금 전";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}분 전`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}시간 전`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}일 전`;
    return createdAt.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
  };

  return (
    <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-3 duration-500 max-w-2xl mx-auto w-full px-2 sm:px-0">
      {posts.length === 0 ? (
        <div className="py-20 text-center text-slate-400 font-bold">
          아직 아무말이 없소. 첫 마디를 던져보시오!
        </div>
      ) : (
        posts.map((post) => {
          const currentLikes = post.likes || 0;
          
          // 🚀 시간 경과 계산 (시간에 따른 목표 자동 변경)
          const now = new Date();
          const createdAt = post.createdAt?.seconds ? new Date(post.createdAt.seconds * 1000) : now;
          const diffInHours = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

          let promotionGoal = 3;
          let targetName = "주목말";
          let targetIcon = "📣";
          let isExpired = false;

          if (diffInHours < 1) {
            promotionGoal = 3;
            targetName = "주목말";
            targetIcon = "📣";
          } else if (diffInHours < 6) {
            promotionGoal = 30;
            targetName = "대세말";
            targetIcon = "🌟";
          } else {
            isExpired = true;
          }

          const displayInfo = post.authorInfo || (post.author === "흑무영" ? {
            level: 1,
            friendCount: 1, 
            totalLikes: 12435
          } : { level: 1, friendCount: 0, totalLikes: 0 });

          return (
            <div 
              key={post.id}
              onClick={() => onTopicClick(post)}
              className="group bg-white border border-slate-200 rounded-xl p-3 cursor-pointer hover:border-slate-400 active:scale-[0.99] transition-all shadow-sm flex flex-col gap-2"
            >
              <div className="flex justify-end items-center">
                <span className="text-xs font-black text-slate-400 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100 shadow-inner italic">
                  ⏱️ {formatRelativeTime(post.createdAt)}
                </span>
              </div>

              <div className="flex flex-col gap-2">
                <div className="bg-slate-50/80 px-2 py-1.5 rounded-lg border border-slate-100/50 flex justify-between items-center">
                  <h3 className="text-base font-[1000] text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1 leading-tight">
                    {post.title}
                  </h3>
                  {post.linkUrl && (
                    <span className="text-[9px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-black shrink-0 ml-2">LINK</span>
                  )}
                </div>
                
                <div className="flex gap-3">
                  <div className="flex-1">
                    {/* 🚀 whitespace-pre-wrap을 추가하여 줄바꿈이 실제로 보이도록 함 */}
                    <p className="text-base text-slate-600 line-clamp-3 leading-relaxed px-1 whitespace-pre-wrap">
                      {stripHtml(post.content)}
                    </p>
                  </div>
                  {post.imageUrl && (
                    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg overflow-hidden border border-slate-100 shrink-0 shadow-sm">
                      <img src={post.imageUrl} alt="Thumbnail" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100 mt-1">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center border-2 border-slate-200 shadow-sm overflow-hidden shrink-0">
                    <img src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${post.author}`} alt="avatar" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-[1000] text-slate-900 leading-none mr-1">{post.author}</span>
                    <div className="flex items-center gap-2.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border-2 border-slate-200 shadow-inner">
                      <span className="text-xs font-black text-emerald-600 bg-white px-1.5 py-0.5 rounded-md border border-emerald-100 shadow-sm">Lv.{displayInfo.level}</span>
                      <span className="text-xs font-black text-slate-700">🤝 {displayInfo.friendCount}</span>
                      <span className="text-xs font-black text-slate-700">🔥 {displayInfo.totalLikes.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className={`${isExpired ? 'bg-slate-100 text-slate-400 border-slate-200 shadow-none' : 'bg-amber-50 text-amber-900 border-amber-200 shadow-sm'} px-3.5 py-1.5 rounded-xl border-2 flex items-center gap-2`}>
                    <span className="text-[13px] font-[1000] uppercase tracking-tighter whitespace-nowrap">
                      {isExpired ? (
                        <span className="flex items-center gap-1.5">
                          🏁 도전 종료 <span className="text-[10px] text-slate-300 font-black tracking-widest bg-slate-200 px-1.5 py-0.5 rounded leading-none">재업 준비중</span>
                        </span>
                      ) : (
                        <>
                          {targetIcon} {targetName} 승급까지 <span className="text-rose-600 text-sm font-black underline decoration-2 underline-offset-2">{Math.max(promotionGoal - currentLikes, 0)}개</span>
                        </>
                      )}
                    </span>
                  </div>
                  
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onLikeClick) onLikeClick(e, post.id);
                    }}
                    className="flex items-center justify-center w-10 h-10 rounded-full bg-white hover:bg-blue-50 border-2 border-slate-300 hover:border-blue-400 transition-all active:scale-90 shadow-sm"
                  >
                    <span className={`text-xl ${currentLikes > 0 ? 'text-blue-500' : 'text-slate-300 grayscale'}`}>👍</span>
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