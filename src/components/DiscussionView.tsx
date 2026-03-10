// src/components/DiscussionView.tsx
import React, { useState, useEffect } from 'react';
import type { Post } from '../types';
import RootPostCard from './RootPostCard';
import DebateBoard from './DebateBoard';
import { formatKoreanNumber, getReputationLabel } from '../utils';

interface Props {
  rootPost: Post;
  allPosts: Post[];
  otherTopics: Post[];
  onTopicChange: (post: Post) => void;
  userData: any;
  friends: string[];
  onToggleFriend: (author: string) => void;
  onPostClick: (post: Post) => void;
  replyTarget: Post | null;
  setReplyTarget: (post: Post | null) => void;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  selectedSide: 'left' | 'right';
  setSelectedSide: (side: 'left' | 'right') => void;
  selectedType: 'comment' | 'formal';
  setSelectedType: (type: 'comment' | 'formal') => void;
  newTitle: string;
  setNewTitle: (t: string) => void;
  newContent: string;
  setNewContent: (c: string) => void;
  isSubmitting: boolean;
  commentCounts?: Record<string, number>;
  onLikeClick?: (e: React.MouseEvent | null, postId: string) => void;
  currentNickname?: string;
  allUsers?: Record<string, any>;
  followerCounts?: Record<string, number>;
  toggleBlock?: (author: string) => void;
}

export const CATEGORY_RULES: Record<string, { 
  allowDisagree: boolean, 
  allowFormal: boolean,
  boardType: 'debate' | 'single' | 'qa' | 'info' | 'factcheck' | 'onecut'
}> = {
  "나의 이야기": { allowDisagree: false, allowFormal: false, boardType: 'single' },
  "너와 나의 이야기": { allowDisagree: false, allowFormal: false, boardType: 'single' },
  "임금님 귀는 당나귀 귀": { allowDisagree: true, allowFormal: true, boardType: 'debate' },
  "벌거벗은 임금님": { allowDisagree: true, allowFormal: false, boardType: 'factcheck' },
  "유배·귀양지": { allowDisagree: true, allowFormal: false, boardType: 'single' },
  "뼈때리는 글": { allowDisagree: false, allowFormal: false, boardType: 'single' },
  "지식 소매상": { allowDisagree: false, allowFormal: false, boardType: 'qa' },
  "현지 소식": { allowDisagree: true, allowFormal: false, boardType: 'info' },
  "한컷": { allowDisagree: true, allowFormal: false, boardType: 'onecut' }
};

const DiscussionView = ({
  rootPost, allPosts, otherTopics, onTopicChange, userData, friends, onToggleFriend, 
  replyTarget, setReplyTarget, handleSubmit, selectedSide, setSelectedSide,
  selectedType, setSelectedType, newTitle, setNewTitle, newContent, setNewContent, isSubmitting,
  commentCounts = {}, onLikeClick, currentNickname, allUsers = {}, followerCounts = {}
}: Props) => {
  const [isInputFocused, setIsInputFocused] = useState(false);

  const rule = CATEGORY_RULES[rootPost.category || "나의 이야기"] || CATEGORY_RULES["나의 이야기"];

  useEffect(() => {
    if (!rule.allowDisagree && selectedSide === 'right') setSelectedSide('left');
    if (!rule.allowFormal && selectedType === 'formal') setSelectedType('comment');
  }, [rootPost.category]);

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

  const filteredSideTopics = otherTopics.filter(topic => topic.id !== rootPost.id).slice(0, 10);

  const authorData = (rootPost.author_id && allUsers[rootPost.author_id]) || allUsers[`nickname_${rootPost.author}`];
  const realFollowers = followerCounts[rootPost.author] || 0;
  const displayLevel = authorData ? authorData.level : (rootPost.authorInfo?.level || 1);
  const displayLikes = authorData ? authorData.likes : (rootPost.authorInfo?.totalLikes || 0);
  const isLikedByMe = currentNickname && rootPost.likedBy?.includes(currentNickname);

  const linkedPost = otherTopics.find(p => p.id === rootPost.linkedPostId);

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-8 w-full max-w-[1600px] mx-auto animate-in fade-in duration-700 items-start pb-20">
      {/* Left Column: Post Details */}
      <div className="col-span-1 md:col-span-8 flex flex-col gap-6">
        
        {/* 🚀 한컷일 경우 전용 상단 UI */}
        {rootPost.isOneCut && (
          <div className="bg-white border border-slate-100 p-8 md:p-10 rounded-none shadow-sm space-y-6">
            <div className="space-y-2">
              <span className="text-[9px] font-black text-rose-500 bg-rose-50 px-2 py-0.5 rounded uppercase tracking-widest">OneCut Series</span>
              <h2 className="text-3xl font-[1000] text-slate-900 tracking-tighter leading-tight">{rootPost.title}</h2>
            </div>

            <div className="flex items-center justify-between py-4 border-y border-slate-50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-100 overflow-hidden shadow-sm">
                  <img src={authorData?.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${rootPost.author}`} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="flex flex-col">
                  <span className="font-black text-slate-900 text-sm">{rootPost.author}</span>
                  <span className="text-[11px] text-slate-400 font-bold">
                    Lv {displayLevel} · {getReputationLabel(displayLikes)} · 깐부 {formatKoreanNumber(realFollowers)}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <span className="block text-[9px] font-black text-slate-300 uppercase">Comments</span>
                  <span className="text-sm font-black text-slate-900">{formatKoreanNumber(allPosts.length)}</span>
                </div>
                <button 
                  onClick={() => onLikeClick?.(null, rootPost.id)}
                  className="flex flex-col items-center group"
                >
                  <span className="block text-[9px] font-black text-slate-300 uppercase group-hover:text-rose-400 transition-colors">Likes</span>
                  <div className="flex items-center gap-1">
                    <svg className={`w-4 h-4 transition-all duration-300 ${isLikedByMe ? 'text-rose-500 fill-current scale-110' : 'text-slate-300 fill-none'}`} stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" /></svg>
                    <span className={`text-sm font-black transition-colors ${isLikedByMe ? 'text-rose-500' : 'text-slate-900'}`}>{formatKoreanNumber(rootPost.likes || 0)}</span>
                  </div>
                </button>
              </div>
            </div>

            {/* 원본 글 연결 (한컷 이미지 위 중앙 배치) */}
            {linkedPost && (
              <div className="flex justify-center">
                <button 
                  onClick={() => onTopicChange(linkedPost)}
                  className="group flex items-center gap-3 px-6 py-3 bg-blue-600 hover:bg-slate-900 text-white rounded-full shadow-lg shadow-blue-100 transition-all transform hover:-translate-y-1"
                >
                  <span className="text-lg">🔗</span>
                  <div className="flex flex-col items-start">
                    <span className="text-[9px] font-black opacity-70 uppercase tracking-tighter">Connected Halmal</span>
                    <span className="text-[13px] font-black line-clamp-1">{linkedPost.title}</span>
                  </div>
                  <svg className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                </button>
              </div>
            )}

            <div className="w-full aspect-[9/16] max-h-[900px] bg-slate-900 rounded-[2.5rem] overflow-hidden border-8 border-slate-900 shadow-2xl relative">
              <img src={rootPost.imageUrl || undefined} alt="OneCut" className="w-full h-full object-contain" />
            </div>

            <div 
              className="prose prose-slate max-w-none py-4 text-[15px] text-slate-700 leading-relaxed font-medium"
              dangerouslySetInnerHTML={{ __html: rootPost.content }} 
            />
          </div>
        )}

        {/* 🚀 일반 게시글일 경우 기존 RootPostCard 사용 */}
        {!rootPost.isOneCut && (
          <RootPostCard 
            post={rootPost} 
            totalComment={allPosts.filter(p => p.type === 'comment').length}
            totalFormal={allPosts.filter(p => p.type === 'formal').length}
            uniqueAgreeCount={allPosts.filter(p => p.side === 'left').length}
            uniqueDisagreeCount={allPosts.filter(p => p.side === 'right').length}
            isFriend={friends.includes(rootPost.author)}
            onToggleFriend={() => onToggleFriend(rootPost.author)}
            userData={{ level: displayLevel, likes: displayLikes, bio: authorData?.bio || "" }}
            friendCount={realFollowers}
            onLikeClick={onLikeClick}
            currentNickname={currentNickname}
          />
        )}

        {/* 🚀 공통: 상호작용 및 댓글 영역 */}
        <div className="grid grid-cols-2 gap-4">
          <button 
            onClick={() => { setSelectedSide('left'); setIsInputFocused(true); }}
            className={`py-6 rounded-[2rem] font-[1000] text-lg transition-all shadow-xl flex flex-col items-center gap-2 border-4 ${selectedSide === 'left' ? 'bg-emerald-500 text-white border-emerald-200 scale-[1.02]' : 'bg-white text-emerald-500 border-emerald-50 hover:bg-emerald-50'}`}
          >
            <span className="text-3xl">👍</span>
            <span>동의하오 {formatKoreanNumber(allPosts.filter(p => p.side === 'left').length)}</span>
          </button>
          <button 
            onClick={() => { if (rule.allowDisagree) { setSelectedSide('right'); setIsInputFocused(true); } else { alert("이 주제는 비동의가 비활성화되어 있소."); } }}
            className={`py-6 rounded-[2rem] font-[1000] text-lg transition-all shadow-xl flex flex-col items-center gap-2 border-4 ${selectedSide === 'right' ? 'bg-rose-500 text-white border-rose-200 scale-[1.02]' : 'bg-white text-rose-500 border-rose-50 hover:bg-rose-50'} ${!rule.allowDisagree ? 'opacity-30 grayscale cursor-not-allowed' : ''}`}
          >
            <span className="text-3xl">👎</span>
            <span>반대하오 {formatKoreanNumber(allPosts.filter(p => p.side === 'right').length)}</span>
          </button>
        </div>

        <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm">
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center px-2">
              <h4 className="font-[1000] text-slate-900 tracking-tighter">할말 더하기</h4>
              {replyTarget && (
                <div className="flex items-center gap-2 px-3 py-1 bg-slate-900 text-white rounded-full">
                  <span className="text-[10px] font-black uppercase">🎯 {replyTarget.author}</span>
                  <button onClick={() => setReplyTarget(null)} className="text-white hover:text-rose-400 font-black text-[10px]">✕</button>
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex gap-2">
                <div className={`flex-1 p-1 rounded-2xl border-2 transition-all flex items-center bg-slate-50 ${selectedSide === 'left' ? 'border-emerald-200' : 'border-rose-200'}`}>
                  <button type="button" onClick={() => setSelectedSide('left')} className={`flex-1 py-2 rounded-xl text-[11px] font-black transition-all ${selectedSide === 'left' ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-400'}`}>👍 동의</button>
                  <button type="button" onClick={() => rule.allowDisagree && setSelectedSide('right')} className={`flex-1 py-2 rounded-xl text-[11px] font-black transition-all ${selectedSide === 'right' ? 'bg-rose-500 text-white shadow-md' : 'text-slate-400'} ${!rule.allowDisagree ? 'opacity-30 grayscale' : ''}`}>👎 반대</button>
                </div>
                {rule.allowFormal && (
                  <select value={selectedType} onChange={(e) => setSelectedType(e.target.value as any)} className="bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 text-[11px] font-black text-blue-600 outline-none cursor-pointer">
                    <option value="comment">💬 댓글</option>
                    <option value="formal">📝 연계글</option>
                  </select>
                )}
              </div>

              {selectedType === 'formal' && (
                <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="연계글 제목을 입력하시오..." className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-[15px] font-black outline-none focus:bg-white focus:border-blue-500 transition-all" />
              )}

              <div className="relative">
                <textarea 
                  value={newContent} onChange={e => setNewContent(e.target.value)}
                  onFocus={() => setIsInputFocused(true)}
                  placeholder="예리한 한마디를 적어주시오..."
                  className={`w-full bg-slate-50 border-2 border-slate-100 rounded-[2rem] px-6 py-6 text-[15px] font-bold outline-none focus:bg-white focus:border-blue-500 transition-all resize-none ${isInputFocused ? 'h-40' : 'h-24'}`}
                />
                <button type="submit" disabled={isSubmitting || !newContent.trim()} className="absolute bottom-4 right-4 bg-slate-900 text-white px-6 py-3 rounded-2xl text-[12px] font-black shadow-lg hover:bg-blue-600 transition-all uppercase tracking-widest"> 전송 🚀 </button>
              </div>
            </form>
          </div>
        </div>

        <DebateBoard 
          allChildPosts={allPosts} 
          setReplyTarget={setReplyTarget}
          onPostClick={onTopicChange}
          currentUserData={userData}
          currentUserFriends={friends}
          onLikeClick={onLikeClick}
          currentNickname={currentNickname}
          category={rootPost.category || "나의 이야기"}
        />
      </div>

      {/* Right Column: Next Halmals */}
      <aside className="hidden md:block md:col-span-4 sticky top-0">
        <div className="flex flex-col gap-4 max-h-[calc(100vh-100px)] overflow-y-auto no-scrollbar pb-20">
          <div className="px-2 mb-2">
            <h4 className="text-xl font-[1000] text-slate-900 tracking-tighter uppercase italic">Next Halmals</h4>
            <p className="text-[11px] font-bold text-slate-400">주목받는 다른 할말들</p>
          </div>
          
          {filteredSideTopics.map((topic) => (
            <div 
              key={topic.id} onClick={() => onTopicChange(topic)}
              className="bg-white border border-slate-100 p-5 rounded-[2rem] cursor-pointer hover:border-blue-500 hover:shadow-xl hover:shadow-blue-50/50 transition-all group flex flex-col gap-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black text-blue-500 bg-blue-50 px-2 py-0.5 rounded-md uppercase tracking-widest">{topic.category}</span>
                <span className="text-[9px] font-bold text-slate-300">{getTimeAgo(topic.createdAt)}</span>
              </div>
              
              <div className="flex gap-3">
                <div className="flex-1">
                  <h5 className="text-[13px] font-[1000] text-slate-900 line-clamp-2 leading-tight tracking-tighter mb-1.5 group-hover:text-blue-600 transition-colors">{topic.title}</h5>
                  <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed font-medium">{topic.content.replace(/<[^>]*>?/gm, '')}</p>
                </div>
                {topic.imageUrl && (
                  <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 shrink-0 overflow-hidden">
                    <img src={topic.imageUrl} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between mt-1 pt-3 border-t border-slate-50">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-slate-50 border border-slate-100 overflow-hidden"><img src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${topic.author}`} alt="" /></div>
                  <span className="text-[10px] font-black text-slate-400">{topic.author}</span>
                </div>
                <div className="flex items-center gap-2.5 text-slate-300 text-[10px] font-black">
                  <span className="flex items-center gap-1">💬 {formatKoreanNumber(commentCounts[topic.id] || 0)}</span>
                  <span className={`flex items-center gap-1 ${currentNickname && topic.likedBy?.includes(currentNickname) ? 'text-rose-400' : ''}`}>❤️ {formatKoreanNumber(topic.likes || 0)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
};

export default DiscussionView;
