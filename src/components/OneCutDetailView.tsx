// src/components/OneCutDetailView.tsx
import React, { useState } from 'react';
import type { Post } from '../types';
import { formatKoreanNumber, getReputationLabel } from '../utils';
import DebateBoard from './DebateBoard';

interface Props {
  rootPost: Post;
  allPosts: Post[];
  otherTopics: Post[];
  onTopicChange: (post: Post) => void;
  userData: any;
  friends: string[];
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  selectedSide: 'left' | 'right';
  setSelectedSide: (side: 'left' | 'right') => void;
  newContent: string;
  setNewContent: (c: string) => void;
  isSubmitting: boolean;
  onLikeClick?: (e: React.MouseEvent | null, postId: string) => void;
  currentNickname?: string;
  allUsers?: Record<string, any>;
  followerCounts?: Record<string, number>;
  onEditPost?: (post: Post) => void;
}

const OneCutDetailView = ({
  rootPost, allPosts, otherTopics, onTopicChange, userData, friends,
  handleSubmit, selectedSide, setSelectedSide, newContent, setNewContent, isSubmitting,
  onLikeClick, currentNickname, allUsers = {}, followerCounts = {}, onEditPost
}: Props) => {
  const [imageError, setImageError] = useState(false);
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

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-10 w-full max-w-[1600px] mx-auto animate-in fade-in duration-700 pb-20 items-start">
      {/* 🚀 한컷 전용 메인 영역 (좌측 8) */}
      <div className="col-span-1 md:col-span-8 flex flex-col gap-6">
        
        {/* 1. 상단 헤더 영역 (이미지 밖) */}
        <div className="bg-white border border-slate-100 p-8 rounded-[4px] shadow-sm space-y-4">
          <div className="flex justify-between items-start">
            <div className="space-y-3">
              {linkedPost ? (
                <button
                  onClick={() => onTopicChange(linkedPost)}
                  className="group flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-[4px] transition-all max-w-[360px]"
                >
                  <span className="text-[11px]">🔗</span>
                  <span className="text-[11px] font-black truncate">{linkedPost.title}</span>
                  <svg className="w-3 h-3 shrink-0 opacity-70 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                </button>
              ) : (
                <span className="text-[10px] font-black text-rose-500 bg-rose-50 px-2 py-0.5 rounded-[2px] tracking-widest uppercase">🎞️ OneCut</span>
              )}
              <h2 className="text-3xl font-[1000] text-slate-900 tracking-tighter leading-tight">{rootPost.title}</h2>
              <div className="flex flex-wrap gap-2 pt-1">
                {(rootPost.tags || []).map((tag, i) => (
                  <span key={i} className="text-[11px] font-black text-blue-500 bg-blue-50/50 px-2 py-0.5 rounded-[2px]">#{tag}</span>
                ))}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className="text-[10px] font-bold text-slate-300 uppercase">{getTimeAgo(rootPost.createdAt)}</span>
              {isMyPost && (
                <button onClick={() => onEditPost?.(rootPost)} className="text-[11px] font-black text-blue-400 hover:text-blue-600 transition-colors uppercase tracking-tighter underline">Edit</button>
              )}
            </div>
          </div>
        </div>

        {/* 2. 메인 한컷 이미지 (9:16 최적화) */}
        <div className="w-full aspect-[9/16] max-h-[900px] bg-slate-900 rounded-[4px] overflow-hidden border-[1px] border-slate-200 shadow-2xl relative">
          <img
            src={rootPost.imageUrl || ""}
            alt="OneCut"
            className={`w-full h-full object-contain ${imageError ? 'hidden' : 'block'}`}
            onError={() => setImageError(true)}
          />
          {imageError && (
            <div className="w-full h-full flex flex-col items-center justify-center gap-4 text-white px-10 text-center">
              <svg className="w-16 h-16 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              <p className="font-bold">이미지를 불러올 수 없습니다.</p>
            </div>
          )}
        </div>

        {/* 3. 이미지 아래 정보 영역 (설명 + 작성자) */}
        <div className="flex flex-col gap-6">
          {/* 상세 설명 */}
          {rootPost.content && rootPost.content.trim() ? (
            <div className="bg-white border border-slate-100 rounded-[4px] p-8 shadow-sm">
              <p className="text-[15px] text-slate-700 leading-relaxed font-medium whitespace-pre-wrap">{rootPost.content}</p>
            </div>
          ) : null}

          {/* 작성자 상세 정보 카드 */}
          <div className="flex items-center justify-between p-6 bg-white rounded-[4px] border border-slate-100 shadow-sm">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 rounded-full bg-white border border-slate-100 shadow-sm overflow-hidden shrink-0">
                <img src={authorData?.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${rootPost.author}`} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="font-[1000] text-slate-900 text-lg leading-none">{rootPost.author}</span>
                  <span className="bg-blue-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-[2px] uppercase">Lv.{displayLevel}</span>
                </div>
                <div className="flex items-center gap-3 text-[12px] text-slate-400 font-bold">
                  <span className="flex items-center gap-1.5"><i className="w-1.5 h-1.5 rounded-full bg-emerald-400" />{getReputationLabel(displayLikes)}</span>
                  <span className="w-px h-3 bg-slate-100" />
                  <span>깐부 {formatKoreanNumber(realFollowers)}</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-8 pr-4">
              <div className="text-center">
                <p className="text-[10px] font-black text-slate-300 uppercase mb-1">Talks</p>
                <p className="text-lg font-[1000] text-slate-900">{formatKoreanNumber(allPosts.length)}</p>
              </div>
              <button onClick={() => onLikeClick?.(null, rootPost.id)} className="flex flex-col items-center group">
                <p className="text-[10px] font-black text-slate-300 uppercase mb-1 group-hover:text-rose-400 transition-colors">Likes</p>
                <div className="flex items-center gap-1.5">
                  <svg className={`w-6 h-6 transition-all duration-300 ${isLikedByMe ? 'text-rose-500 fill-current scale-110' : 'text-slate-200 fill-none group-hover:text-rose-300'}`} stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" /></svg>
                  <span className={`text-lg font-[1000] ${isLikedByMe ? 'text-rose-500' : 'text-slate-900'}`}>{formatKoreanNumber(rootPost.likes || 0)}</span>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* 4. 하단 인터랙션 (동의/반대 및 댓글 입력) */}
        <div className="grid grid-cols-2 gap-4 mt-4">
          <button 
            onClick={() => setSelectedSide('left')}
            className={`py-6 rounded-[4px] font-[1000] text-lg transition-all shadow-sm flex flex-col items-center gap-2 border-2 ${selectedSide === 'left' ? 'bg-emerald-500 text-white border-emerald-400' : 'bg-white text-emerald-500 border-emerald-50 hover:bg-emerald-50'}`}
          >
            <span className="text-2xl">👍</span>
            <span>동의 {formatKoreanNumber(allPosts.filter(p => p.side === 'left').length)}</span>
          </button>
          <button 
            onClick={() => setSelectedSide('right')}
            className={`py-6 rounded-[4px] font-[1000] text-lg transition-all shadow-sm flex flex-col items-center gap-2 border-2 ${selectedSide === 'right' ? 'bg-rose-500 text-white border-rose-400' : 'bg-white text-rose-500 border-rose-50 hover:bg-rose-50'}`}
          >
            <span className="text-2xl">👎</span>
            <span>반대 {formatKoreanNumber(allPosts.filter(p => p.side === 'right').length)}</span>
          </button>
        </div>

        <div className="bg-white border border-slate-100 rounded-[4px] p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className={`p-1 rounded-[4px] border transition-all flex items-center bg-slate-50 ${selectedSide === 'left' ? 'border-emerald-200' : 'border-rose-200'}`}>
              <button type="button" onClick={() => setSelectedSide('left')} className={`flex-1 py-3 rounded-[2px] text-[11px] font-black transition-all ${selectedSide === 'left' ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-400'}`}>👍 동의하며 댓글</button>
              <button type="button" onClick={() => setSelectedSide('right')} className={`flex-1 py-3 rounded-[2px] text-[11px] font-black transition-all ${selectedSide === 'right' ? 'bg-rose-500 text-white shadow-md' : 'text-slate-400'}`}>👎 반대하며 댓글</button>
            </div>
            <div className="relative">
              <textarea value={newContent} onChange={e => setNewContent(e.target.value)} placeholder="한컷에 대한 생각을 남겨보세요..." className="w-full bg-slate-50 border border-slate-100 rounded-[4px] px-6 py-6 text-[15px] font-bold outline-none focus:bg-white focus:border-blue-500 transition-all resize-none h-32" />
              <button type="submit" disabled={isSubmitting || !newContent.trim()} className="absolute bottom-4 right-4 bg-slate-900 text-white px-6 py-3 rounded-[4px] text-[11px] font-black shadow-lg hover:bg-blue-600 transition-all uppercase tracking-widest">전송 🚀</button>
            </div>
          </form>
        </div>

        <DebateBoard 
          allChildPosts={allPosts} 
          setReplyTarget={() => {}} // 한컷은 대댓글을 일단 단순화
          onPostClick={() => {}}
          currentUserData={userData}
          currentUserFriends={friends}
          onLikeClick={onLikeClick}
          currentNickname={currentNickname}
          category="한컷"
        />
      </div>

      {/* 🚀 우측 추천 영역 (우측 4) */}
      <aside className="hidden md:block md:col-span-4 sticky top-0">
        <div className="flex flex-col gap-5 max-h-[calc(100vh-100px)] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] pb-20">
          <div className="px-2">
            <h4 className="text-xl font-[1000] text-slate-900 tracking-tighter uppercase italic">Trending</h4>
            <p className="text-[10px] font-bold text-slate-400">함께 보면 좋은 한컷들</p>
          </div>
          
          {otherTopics.filter(t => t.isOneCut && t.id !== rootPost.id).slice(0, 10).map((topic) => (
            <div key={topic.id} onClick={() => onTopicChange(topic)} className="bg-white border border-slate-100 p-4 rounded-[4px] cursor-pointer hover:border-blue-500 hover:shadow-xl transition-all group flex flex-col gap-3">
              <div className="aspect-[9/16] bg-slate-900 rounded-[2px] overflow-hidden relative">
                <img src={topic.imageUrl || ""} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />
                <div className="absolute bottom-4 left-4 right-4">
                  <h5 className="text-white text-xs font-black line-clamp-2 leading-tight tracking-tight">{topic.title}</h5>
                </div>
              </div>
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full overflow-hidden border border-slate-100"><img src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${topic.author}`} alt="" /></div>
                  <span className="text-[9px] font-black text-slate-400">{topic.author}</span>
                </div>
                <span className="text-[9px] font-black text-rose-400">❤️ {formatKoreanNumber(topic.likes || 0)}</span>
              </div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
};

export default OneCutDetailView;

        <DebateBoard 
          allChildPosts={allPosts} 
          setReplyTarget={() => {}} // 한컷은 대댓글을 일단 단순화
          onPostClick={() => {}}
          currentUserData={userData}
          currentUserFriends={friends}
          onLikeClick={onLikeClick}
          currentNickname={currentNickname}
          category="한컷"
        />
      </div>

      {/* 🚀 우측 추천 영역 (우측 4) */}
      <aside className="hidden md:block md:col-span-4 sticky top-0">
        <div className="flex flex-col gap-5 max-h-[calc(100vh-100px)] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] pb-20">
          <div className="px-2">
            <h4 className="text-2xl font-[1000] text-slate-900 tracking-tighter uppercase italic">Trending OneCuts</h4>
            <p className="text-xs font-bold text-slate-400">함께 보면 좋은 한컷들</p>
          </div>
          
          {otherTopics.filter(t => t.isOneCut && t.id !== rootPost.id).slice(0, 10).map((topic) => (
            <div key={topic.id} onClick={() => onTopicChange(topic)} className="bg-white border border-slate-100 p-5 rounded-[2.5rem] cursor-pointer hover:border-blue-500 hover:shadow-2xl transition-all group flex flex-col gap-4">
              <div className="aspect-[9/16] bg-slate-900 rounded-[2rem] overflow-hidden relative">
                <img src={topic.imageUrl || ""} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />
                <div className="absolute bottom-6 left-6 right-6">
                  <h5 className="text-white text-sm font-black line-clamp-2 leading-tight tracking-tight">{topic.title}</h5>
                </div>
              </div>
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full overflow-hidden border border-slate-100"><img src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${topic.author}`} alt="" /></div>
                  <span className="text-[10px] font-black text-slate-400">{topic.author}</span>
                </div>
                <span className="text-[10px] font-black text-rose-400">❤️ {formatKoreanNumber(topic.likes || 0)}</span>
              </div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
};

export default OneCutDetailView;
