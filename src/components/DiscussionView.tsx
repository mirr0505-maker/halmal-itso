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
  onLikeClick?: (e: React.MouseEvent | null, postId: string) => void;
  currentNickname?: string;
  allUsers?: Record<string, any>;
  followerCounts?: Record<string, number>;
  toggleBlock?: (author: string) => void;
}

const DiscussionView = ({
  rootPost, allPosts, otherTopics, onTopicChange, userData, friends, onToggleFriend, 
  replyTarget, setReplyTarget, handleSubmit, selectedSide, setSelectedSide,
  selectedType, setSelectedType, newTitle, setNewTitle, newContent, setNewContent, isSubmitting,
  commentCounts = {}, onLikeClick, currentNickname, allUsers = {}, followerCounts = {}
}: Props) => {
  const [isInputFocused, setIsInputFocused] = useState(false);

  const formatKoreanNumber = (num: number) => {
    if (num >= 10000) return Math.floor(num / 10000) + '만';
    return num.toLocaleString();
  };

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

  const extractFirstImage = (content: string) => {
    if (!content) return null;
    const imgRegex = /<img[^>]+src=["']?([^"'>\s]+)["']?[^>]*>/i;
    const match = content.match(imgRegex);
    return match ? match[1] : null;
  };

  // 🚀 실시간 데이터 바인딩
  const authorData = (rootPost.author_id && allUsers[rootPost.author_id]) || allUsers[`nickname_${rootPost.author}`];
  const realFollowers = followerCounts[rootPost.author] || 0;
  const displayLevel = authorData ? authorData.level : (rootPost.authorInfo?.level || 1);
  const displayLikes = authorData ? authorData.likes : (rootPost.authorInfo?.totalLikes || 0);

  return (
    <div className="grid grid-cols-12 gap-8 w-full max-w-[1600px] mx-auto animate-in fade-in duration-700 pr-0 items-start">
      <div className="col-span-12 lg:col-span-8 flex flex-col gap-0 pb-40">
        <RootPostCard 
          post={rootPost} 
          totalComment={allPosts.filter(p => p.type === 'comment').length}
          totalFormal={allPosts.filter(p => p.type === 'formal').length}
          uniqueAgreeCount={new Set(allPosts.filter(p => p.side === 'left').map(p => p.author)).size}
          uniqueDisagreeCount={new Set(allPosts.filter(p => p.side === 'right').map(p => p.author)).size}
          isFriend={friends.includes(rootPost.author)}
          onToggleFriend={() => onToggleFriend(rootPost.author)}
          userData={{ level: displayLevel, likes: displayLikes, bio: authorData?.bio || "" }}
          friendCount={realFollowers}
          onLikeClick={onLikeClick}
          currentNickname={currentNickname}
        />

        <div className="bg-slate-50 border-x border-b border-slate-100 rounded-none p-3 w-full transition-all duration-500">
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <div className="flex gap-3 items-center">
                <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest opacity-40">작성 시점</span>
                <div className="flex bg-white p-0.5 rounded-none border border-slate-200">
                  <select 
                    value={selectedType} onChange={(e) => setSelectedType(e.target.value as 'comment' | 'formal')}
                    className="appearance-none bg-transparent px-2 py-1 text-[10px] font-[1000] text-blue-600 outline-none cursor-pointer"
                  >
                    <option value="comment">💬 댓글</option>
                    <option value="formal">📝 연계글</option>
                  </select>
                  <select 
                    value={selectedSide} onChange={(e) => setSelectedSide(e.target.value as 'left' | 'right')}
                    className={`ml-1 appearance-none border-l border-slate-100 px-2 py-1 text-[10px] font-[1000] outline-none cursor-pointer ${selectedSide === 'left' ? 'text-emerald-600' : 'text-rose-600'}`}
                  >
                    <option value="left">👍 동의</option>
                    <option value="right">👎 비동의</option>
                  </select>
                </div>
              </div>
              {replyTarget && (
                <div className="flex items-center gap-2 px-2 py-1 bg-slate-900 text-white rounded-none">
                  <span className="text-[10px] font-black uppercase tracking-tighter">🎯 TO: {replyTarget.author}</span>
                  <button onClick={() => setReplyTarget(null)} className="text-white hover:text-rose-400 font-black text-[10px] ml-1">✕</button>
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-2">
              {selectedType === 'formal' && (
                <input 
                  value={newTitle} onChange={e => setNewTitle(e.target.value)}
                  placeholder="제목을 입력하시오..."
                  className="bg-white border border-slate-200 rounded-none px-3 py-2 text-[16px] font-[1000] outline-none focus:border-slate-900 transition-all"
                />
              )}
              <div className="relative">
                <textarea 
                  value={newContent} onChange={e => setNewContent(e.target.value)}
                  onFocus={() => setIsInputFocused(true)} onBlur={() => setIsInputFocused(false)}
                  placeholder={selectedType === 'formal' ? "논리적인 할말을 들려주시오..." : "예리한 한마디를 적어주시오..."}
                  className={`w-full bg-white border border-slate-200 rounded-none px-3 py-2 text-[16px] font-bold outline-none focus:border-slate-900 transition-all resize-none ${isInputFocused ? 'h-24' : 'h-16'}`}
                />
                <button type="submit" disabled={isSubmitting || !newContent.trim()} className="absolute bottom-2 right-2 bg-slate-900 text-white px-4 py-2 rounded-none text-[10px] font-black shadow-lg hover:bg-blue-600 transition-colors uppercase tracking-widest"> 전송 🚀 </button>
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
        />
      </div>

      <aside className="hidden lg:block lg:col-span-4 pr-0 sticky top-0">
        <div className="flex flex-col gap-3 max-h-[calc(100vh-40px)] overflow-y-auto no-scrollbar pb-20">
          <h4 className="text-[22px] font-[1000] text-slate-900 px-2 tracking-tighter mb-6 uppercase mt-0">아무말 더보기</h4>
          {otherTopics.map((topic) => {
            const displayImage = (topic.imageUrl && topic.imageUrl.length > 0) 
              ? topic.imageUrl 
              : extractFirstImage(topic.content);
            
            return (
              <div 
                key={topic.id} onClick={() => onTopicChange(topic)}
                className="bg-white border border-slate-100 py-6 px-3 rounded-none cursor-pointer hover:border-slate-900 transition-all group flex flex-col mb-0 shadow-sm"
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{getTimeAgo(topic.createdAt)}</span>
                  <span className="text-[10px] font-bold text-slate-400">👤 {topic.author}</span>
                </div>
                
                <div className="flex gap-2.5 mb-2 items-stretch min-h-[120px]">
                  <div className="flex-1 min-w-0">
                    <h5 className="text-[13.5px] font-[1000] text-slate-900 line-clamp-2 group-hover:text-blue-600 transition-colors leading-tight mb-1.5 tracking-tight">{topic.title}</h5>
                    <p className="text-[11.5px] text-slate-500 line-clamp-5 leading-relaxed font-medium opacity-80">{topic.content.replace(/<[^>]*>?/gm, '')}</p>
                  </div>
                  {displayImage && (
                    <div className="w-[100px] bg-slate-50 border border-slate-100 shrink-0 overflow-hidden relative">
                      <img 
                        src={displayImage} 
                        alt="" 
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                        onError={(e) => {
                          (e.target as HTMLImageElement).parentElement!.style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-start gap-2.5 pt-2 border-t border-slate-50 mt-auto">
                  <span className="text-[9.5px] font-black text-slate-300">댓글 {commentCounts[topic.id] || 0}</span>
                  <span className={`text-[9.5px] font-black ${currentNickname && topic.likedBy?.includes(currentNickname) ? 'text-rose-400' : 'text-slate-300'}`}>❤️ {formatKoreanNumber(topic.likes || 0)}</span>
                </div>
              </div>
            );
          })}
          {otherTopics.length === 0 && (
            <p className="center py-20 text-slate-300 font-bold italic">게시 중인 아무말이 없소.</p>
          )}
        </div>
      </aside>
    </div>
  );
};

export default DiscussionView;
