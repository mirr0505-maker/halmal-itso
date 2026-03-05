// src/components/DiscussionView.tsx
import React from 'react';
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
}

const DiscussionView = ({
  rootPost, allPosts, otherTopics, onTopicChange, userData, friends, onToggleFriend, 
  replyTarget, setReplyTarget, handleSubmit, selectedSide, setSelectedSide,
  selectedType, setSelectedType, newTitle, setNewTitle, newContent, setNewContent, isSubmitting
}: Props) => {
  const agreePosts = allPosts.filter(p => p.side === 'left');
  const disagreePosts = allPosts.filter(p => p.side === 'right');

  const formatTime = (timestamp: any) => {
    if (!timestamp) return "";
    const createdAt = new Date(timestamp.seconds * 1000);
    return createdAt.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  };

  // RootPostCard에 전달할 userData 타입 보정
  const authorData = rootPost.authorInfo ? {
    level: rootPost.authorInfo.level,
    likes: rootPost.authorInfo.totalLikes,
    bio: "" 
  } : { level: 1, likes: 0, bio: "" };

  return (
    <div className="max-w-6xl mx-auto grid grid-cols-12 gap-6 w-full px-2">
      <div className="col-span-12 lg:col-span-8 flex flex-col gap-4 pb-40">
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

        <DebateBoard 
          agreePosts={agreePosts} 
          disagreePosts={disagreePosts} 
          setReplyTarget={setReplyTarget}
          currentUserData={userData}
          currentUserFriends={friends}
        />

        <div className="mt-10 bg-white border border-slate-100 rounded-2xl p-4 shadow-xl max-w-xl mx-auto w-full">
          <div className="flex gap-4 mb-4 border-b border-slate-50 pb-2">
            <button onClick={() => setSelectedType('comment')} className={`text-[11px] font-black pb-1.5 transition-all ${selectedType === 'comment' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-300'}`}>💬 일반 댓글</button>
            <button onClick={() => setSelectedType('formal')} className={`text-[11px] font-black pb-1.5 transition-all ${selectedType === 'formal' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-300'}`}>📝 정식 연계글</button>
          </div>

          {replyTarget && (
            <div className="mb-2 flex justify-between items-center px-2 py-1 bg-slate-100 rounded-lg text-[10px]">
              <span className="font-bold text-slate-500">🎯 "{replyTarget.author}"님에게 답글 중</span>
              <button onClick={() => setReplyTarget(null)} className="text-rose-500 font-black">취소</button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="flex gap-2">
              <button type="button" onClick={() => setSelectedSide('left')} className={`flex-1 py-1.5 rounded-lg text-[10px] font-black transition-all ${selectedSide === 'left' ? 'bg-emerald-500 text-white shadow-md' : 'bg-slate-50 text-slate-400'}`}>👍 동의</button>
              <button type="button" onClick={() => setSelectedSide('right')} className={`flex-1 py-1.5 rounded-lg text-[10px] font-black transition-all ${selectedSide === 'right' ? 'bg-orange-500 text-white shadow-md' : 'bg-slate-50 text-slate-400'}`}>👎 비동의</button>
            </div>

            {selectedType === 'formal' && (
              <input 
                value={newTitle} onChange={e => setNewTitle(e.target.value)}
                placeholder="연계글 제목을 입력하시오..."
                className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-[11px] font-black outline-none focus:border-blue-500 transition-all"
              />
            )}

            <div className="flex gap-2">
              <textarea 
                value={newContent} onChange={e => setNewContent(e.target.value)}
                placeholder={selectedType === 'formal' ? "논리적인 할말을 들려주시오..." : "예리한 한마디를 적어주시오..."}
                className="flex-1 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-[11px] font-bold outline-none focus:border-slate-900 transition-all h-16 resize-none"
              />
              <button type="submit" disabled={isSubmitting} className="bg-slate-900 text-white px-4 rounded-xl text-[11px] font-black shadow-lg hover:bg-emerald-600 transition-all h-16 shrink-0">
                {isSubmitting ? '...' : '전송'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <aside className="hidden lg:block lg:col-span-4">
        <div className="sticky top-4 flex flex-col gap-4">
          <div className="flex items-center justify-between px-1">
            <h4 className="text-[10px] font-[1000] text-slate-400 uppercase tracking-widest">Next Halmal</h4>
            <span className="text-[8px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded font-black">{otherTopics.length}</span>
          </div>
          
          <div className="flex flex-col gap-2 max-h-[calc(100vh-100px)] overflow-y-auto no-scrollbar pb-10">
            {otherTopics.map((topic) => (
              <div 
                key={topic.id}
                onClick={() => {
                  onTopicChange(topic);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="bg-white border border-slate-200 rounded-xl p-2 cursor-pointer hover:border-blue-400 hover:shadow-md transition-all group flex flex-col gap-1.5 shadow-sm"
              >
                <div className="flex gap-2 items-start">
                  {topic.imageUrl && (
                    <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 border border-slate-100">
                      <img src={topic.imageUrl} alt="Thumb" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h5 className="text-[10px] font-black text-slate-800 line-clamp-2 leading-tight group-hover:text-blue-600">
                      {topic.title}
                    </h5>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[8px] font-bold text-slate-400">👤 {topic.author}</span>
                      <span className="text-[7px] text-slate-300 font-medium">{formatTime(topic.createdAt)}</span>
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
