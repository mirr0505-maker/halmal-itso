// src/components/DiscussionView.tsx
import React from 'react';
import RootPostCard from './RootPostCard';
import DebateBoard from './DebateBoard';
import FormalBoard from './FormalBoard';
import type { Post } from '../types';

interface Props {
  rootPost: Post;
  allPosts: Post[];
  userData: any;
  friends: string[];
  onToggleFriend: (author: string) => void;
  onPostClick: (post: Post) => void;
  // 입력 폼 관련 Props
  replyTarget: Post | null;
  setReplyTarget: (post: Post | null) => void;
  handleSubmit: (e: React.FormEvent) => void;
  selectedSide: 'left' | 'right';
  setSelectedSide: (side: 'left' | 'right') => void;
  selectedType: 'comment' | 'formal';
  setSelectedType: (type: 'comment' | 'formal') => void;
  newTitle: string;
  setNewTitle: (title: string) => void;
  newContent: string;
  setNewContent: (content: string) => void;
  isSubmitting: boolean;
}

const DiscussionView = ({ 
  rootPost, allPosts, userData, friends, onToggleFriend, onPostClick,
  replyTarget, setReplyTarget, handleSubmit, selectedSide, setSelectedSide,
  selectedType, setSelectedType, newTitle, setNewTitle, newContent, setNewContent, isSubmitting
}: Props) => {

  // 🚀 데이터 필터링 로직
  const agreePosts = allPosts.filter(p => p.side === 'left');
  const disagreePosts = allPosts.filter(p => p.side === 'right');
  const formalAgree = agreePosts.filter(p => p.type === 'formal');
  const formalDisagree = disagreePosts.filter(p => p.type === 'formal');
  const commentAgree = agreePosts.filter(p => p.type === 'comment');
  const commentDisagree = disagreePosts.filter(p => p.type === 'comment');
  
  const uniqueAgreeCount = new Set(agreePosts.map(p => p.author)).size;
  const uniqueDisagreeCount = new Set(disagreePosts.map(p => p.author)).size;

  const totalComments = commentAgree.length + commentDisagree.length;
  const totalFormals = formalAgree.length + formalDisagree.length;

  return (
    <div className="animate-in fade-in duration-500">
      {/* 1. 원글 사령부 카드 */}
      <RootPostCard 
        post={rootPost} 
        totalComment={totalComments} 
        totalFormal={totalFormals} 
        uniqueAgreeCount={uniqueAgreeCount} 
        uniqueDisagreeCount={uniqueDisagreeCount}
        isFriend={friends.includes(rootPost.author)} 
        onToggleFriend={() => onToggleFriend(rootPost.author)}
        userData={userData}
        friendCount={friends.length}
      />

      {/* 2. 나의 의견 입력 구역 */}
      <section className="bg-white rounded-2xl p-5 md:p-6 mb-10 border-2 border-slate-200 shadow-sm">
        <h3 className="text-base md:text-lg font-black mb-4">
          {replyTarget ? '🎯 특정 의견에 한마디 거들기' : '✍️ 나의 할말 남기기'}
        </h3>
        {replyTarget && (
          <div className="mb-4 p-3 bg-slate-100 rounded-lg flex justify-between items-center">
            <p className="text-sm line-clamp-1">"{replyTarget.content.replace(/<(.|\n)*?>/g, '')}"</p>
            <button onClick={() => setReplyTarget(null)} className="text-xs bg-white font-black px-2 py-1 rounded shadow-sm hover:bg-slate-200">취소</button>
          </div>
        )}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-2">
              <select value={selectedSide} onChange={e => setSelectedSide(e.target.value as 'left'|'right')} className="p-1.5 md:p-2 border-2 border-slate-300 rounded-lg text-sm font-black bg-white outline-none">
                <option value="left">🟢 동의</option>
                <option value="right">🔴 비동의</option>
              </select>
              <select value={selectedType} onChange={e => setSelectedType(e.target.value as 'comment'|'formal')} disabled={!!replyTarget} className="p-1.5 md:p-2 border-2 border-slate-300 rounded-lg text-sm font-black bg-white outline-none">
                <option value="comment">✉️ 댓글</option>
                {!replyTarget && <option value="formal">🔗 연계글</option>}
              </select>
            </div>
            <button type="submit" disabled={isSubmitting} className={`px-6 py-2 rounded-lg font-black text-white text-sm shadow-sm transition-all active:scale-95 ${isSubmitting ? 'bg-slate-400' : (selectedSide === 'left' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-orange-600 hover:bg-orange-700')}`}>
              {isSubmitting ? '전송 중...' : '남기기'}
            </button>
          </div>
          {selectedType === 'formal' && (
            <input type="text" placeholder="제목" value={newTitle} onChange={e => setNewTitle(e.target.value)} className="w-full p-2.5 border-2 border-slate-300 rounded-lg text-sm font-black outline-none focus:border-slate-900" />
          )}
          <textarea placeholder="내용" value={newContent} onChange={e => setNewContent(e.target.value)} className="w-full p-2.5 border-2 border-slate-300 rounded-lg h-24 resize-none text-sm font-medium outline-none focus:border-slate-900" />
        </form>
      </section>

      {/* 3. 댓글 영역: 1개 이상일 때만 노출 */}
      {totalComments > 0 && (
        <section className="mb-12 animate-in slide-in-from-top-4 duration-500">
          <h3 className="text-xl font-[1000] mb-6 text-slate-800 italic">✉️ 소중한 한마디</h3>
          <DebateBoard 
            agreePosts={commentAgree} 
            disagreePosts={commentDisagree} 
            setReplyTarget={setReplyTarget} 
            currentUserData={userData} 
            currentUserFriends={friends} 
          />
        </section>
      )}
      
      {/* 4. 연계글 영역: 1개 이상일 때만 노출 */}
      {totalFormals > 0 && (
        <section className="pt-8 border-t-[3px] border-slate-200 border-dashed animate-in slide-in-from-top-4 duration-500">
          <h3 className="text-xl font-[1000] mb-6 text-slate-800 italic">🔗 이어지는 할말</h3>
          <FormalBoard 
            agreePosts={formalAgree} 
            disagreePosts={formalDisagree} 
            onPostClick={onPostClick} 
            currentUserData={userData} 
            currentUserFriends={friends} 
          />
        </section>
      )}
    </div>
  );
};

export default DiscussionView;