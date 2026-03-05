// src/components/DiscussionView.tsx
import React, { useState } from 'react';
import type { Post } from '../types';
import RootPostCard from './RootPostCard';
import DebateBoard from './DebateBoard';

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
}

const DiscussionView = ({
  rootPost, allPosts, otherTopics, onTopicChange, userData, friends, onToggleFriend, 
  replyTarget, setReplyTarget, handleSubmit, selectedSide, setSelectedSide,
  selectedType, setSelectedType, newTitle, setNewTitle, newContent, setNewContent, isSubmitting,
  commentCounts = {}
}: Props) => {
  const [isInputFocused, setIsInputFocused] = useState(false);
  const agreePosts = allPosts.filter(p => p.side === 'left');
  const disagreePosts = allPosts.filter(p => p.side === 'right');

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

  const getTimeAgo = (timestamp: any) => {
    if (!timestamp) return "";
    const now = new Date();
    const createdAt = new Date(timestamp.seconds * 1000);
    const diffInSeconds = Math.floor((now.getTime() - createdAt.getTime()) / 1000);

    if (diffInSeconds < 60) return "방금 전";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}분 전`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}시간 전`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}일 전`;
    return createdAt.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  };

  const authorData = rootPost.authorInfo ? {
    level: rootPost.authorInfo.level,
    likes: rootPost.authorInfo.totalLikes,
    bio: "" 
  } : { level: 1, likes: 0, bio: "" };

  return (
    <div className="grid grid-cols-12 gap-4 w-full">
      <div className="col-span-12 lg:col-span-8 flex flex-col gap-2 pb-40">
        <RootPostCard 
          post={rootPost} 
          totalComment={allPosts.filter(p => p.type === 'comment').length}
          totalFormal={allPosts.filter(p => p.type === 'formal').length}
          uniqueAgreeCount={new Set(agreePosts.map(p => p.author)).size}
          uniqueDisagreeCount={new Set(disagreePosts.map(p => p.author)).size}
          isFriend={friends.includes(rootPost.author)}
          onToggleFriend={() => onToggleFriend(rootPost.author)}
          userData={authorData}
          friendCount={rootPost.authorInfo?.friendCount || 0}
        />

        < DebateBoard 
          agreePosts={agreePosts} 
          disagreePosts={disagreePosts} 
          setReplyTarget={setReplyTarget}
          currentUserData={userData}
          currentUserFriends={friends}
          selectedType={selectedType}
          setSelectedType={setSelectedType}
          selectedSide={selectedSide}
          setSelectedSide={setSelectedSide}
        />

        {/* 🚀 개편된 동적 입력 영역 (드롭다운 스타일) */}
        <div className="mt-12 bg-white border border-slate-100 rounded-[2.5rem] p-6 md:p-8 shadow-2xl max-w-2xl mx-auto w-full transition-all duration-500">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <div className="flex gap-2 items-center">
                  <span className="text-[11.5px] font-black text-slate-900 uppercase tracking-widest">Post as</span>
                  <div className="relative inline-block">
                    <select 
                      value={selectedType}
                      onChange={(e) => setSelectedType(e.target.value as 'comment' | 'formal')}
                      className="appearance-none bg-slate-50 border border-slate-100 rounded-lg px-3 py-1.5 pr-8 text-[11px] font-bold text-blue-600 outline-none focus:border-blue-500 transition-all cursor-pointer shadow-sm"
                    >
                      <option value="comment">💬 일반 댓글</option>
                      <option value="formal">📝 정식 연계글</option>
                    </select>
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[8px] text-slate-400">▼</div>
                  </div>

                  <span className="text-[11.5px] font-black text-slate-900 mx-1">with</span>
                  
                  <div className="relative inline-block">
                    <select 
                      value={selectedSide}
                      onChange={(e) => setSelectedSide(e.target.value as 'left' | 'right')}
                      className={`appearance-none border rounded-lg px-3 py-1.5 pr-8 text-[11px] font-bold outline-none transition-all cursor-pointer shadow-sm ${selectedSide === 'left' ? 'bg-emerald-50 border-emerald-100 text-emerald-600 focus:border-emerald-500' : 'bg-orange-50 border-orange-100 text-orange-600 focus:border-orange-500'}`}
                    >
                      <option value="left">👍 동의 진영</option>
                      <option value="right">👎 비동의 진영</option>
                    </select>
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[8px] text-slate-400">▼</div>
                  </div>
                </div>

                {replyTarget && (
                  <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-full animate-in slide-in-from-top-2">
                    <span className="text-[11.5px] font-bold text-slate-500">🎯 "{replyTarget.author}"님에게 답글 중</span>
                    <button onClick={() => setReplyTarget(null)} className="text-rose-500 font-black text-[11.5px]">✕</button>
                  </div>
                )}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4 animate-in fade-in duration-700">
              {selectedType === 'formal' && (
                <input 
                  value={newTitle} onChange={e => setNewTitle(e.target.value)}
                  placeholder="연계글 제목을 입력하시오..."
                  className="bg-slate-50 border-2 border-slate-50 rounded-2xl px-5 py-4 text-[11.5px] font-black outline-none focus:border-blue-500 focus:bg-white transition-all shadow-inner"
                />
              )}

              <div className="relative group">
                <textarea 
                  value={newContent} onChange={e => setNewContent(e.target.value)}
                  onFocus={() => setIsInputFocused(true)}
                  onBlur={() => setIsInputFocused(false)}
                  placeholder={selectedType === 'formal' ? "논리적인 할말을 들려주시오..." : "예리한 한마디를 적어주시오..."}
                  className={`w-full bg-slate-50 border-2 border-slate-50 rounded-[2rem] px-6 py-5 text-[11.5px] font-bold outline-none focus:border-slate-900 focus:bg-white transition-all resize-none shadow-inner ${isInputFocused ? 'h-40' : 'h-24'}`}
                />
                <button 
                  type="submit" 
                  disabled={isSubmitting || !newContent.trim()} 
                  className={`absolute bottom-4 right-4 bg-slate-900 text-white px-8 py-3 rounded-2xl text-[11.5px] font-black shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-30 disabled:hover:scale-100`}
                >
                  {isSubmitting ? '...' : '전송 🚀'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <aside className="hidden lg:block lg:col-span-4 pr-12">
        <div className="sticky top-4 flex flex-col gap-2">
          <div className="flex items-center justify-between px-2">
            <h4 className="text-[11.5px] font-[1000] text-slate-900 tracking-tighter uppercase">아무말 더보기</h4>
            <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-black">{otherTopics.length}</span>
          </div>
          
          <div className="flex flex-col gap-2 max-h-[calc(100vh-100px)] overflow-y-auto no-scrollbar pb-10">
            {otherTopics.map((topic) => (
              <div 
                key={topic.id}
                onClick={() => {
                  onTopicChange(topic);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="bg-white border border-slate-100 rounded-none p-5 cursor-pointer hover:border-slate-900 hover:shadow-xl transition-all group flex flex-col shadow-sm h-[400px]"
              >
                {/* 🚀 0. 최상단: 작성 시간 */}
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">
                    {getTimeAgo(topic.createdAt)}
                  </span>
                  <div className="h-1 w-8 bg-slate-50 rounded-full" />
                </div>

                {/* 🚀 1. 제목: 1줄 제한 */}
                <h5 className="text-[11.5px] font-[1000] text-slate-900 line-clamp-1 leading-tight mb-4 group-hover:text-blue-600 transition-colors">
                  {topic.title}
                </h5>

                {/* 🚀 2. 이미지: 높이 축소 (h-16) */}
                {topic.imageUrl && (
                  <div className="w-full h-16 rounded-none overflow-hidden border border-slate-50 shrink-0 bg-slate-50 shadow-inner mb-4">
                    <img src={topic.imageUrl} alt="Thumb" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                  </div>
                )}

                {/* 🚀 3. 하단: 본문(5줄 제한) + 하단 정보 밀착 */}
                <div className="flex-1 min-w-0 flex flex-col h-full">
                  <p className="text-[10.5px] text-slate-500 line-clamp-5 leading-relaxed mb-2 font-medium flex-1">
                    {stripHtml(topic.content)}
                  </p>
                  
                  <div className="flex items-center justify-between pt-1.5 border-t border-slate-50 mt-auto bg-white">
                    <span className="text-[10px] font-bold text-slate-400 truncate max-w-[75px]">👤 {topic.author}</span>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex items-center gap-1 text-slate-300 group-hover:text-blue-400 transition-colors">
                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                        <span className="text-[9.5px] font-black">{formatKoreanNumber(commentCounts[topic.id] || 0)}</span>
                      </div>
                      <div className="flex items-center gap-1 text-slate-300 group-hover:text-rose-400 transition-colors">
                        <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 24 24"><path d="M11.645 20.91l-.007-.003-.022-.012 a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" /></svg>
                        <span className="text-[9.5px] font-black">{formatKoreanNumber(topic.likes || 0)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
};

export default DiscussionView;
