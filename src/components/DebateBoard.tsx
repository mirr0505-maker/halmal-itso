// src/components/DebateBoard.tsx
import React, { useState } from 'react';
import type { Post } from '../types';
import PostCard from './PostCard';

interface DebateBoardProps {
  agreePosts: Post[];
  disagreePosts: Post[];
  setReplyTarget: (post: Post | null) => void;
  currentUserData?: any; // 🚀 추가
  currentUserFriends?: string[]; // 🚀 추가
}

const DebateBoard = ({ agreePosts, disagreePosts, setReplyTarget, currentUserData, currentUserFriends }: DebateBoardProps) => {
  const [visibleAgree, setVisibleAgree] = useState(3);
  const [visibleDisagree, setVisibleDisagree] = useState(3);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
      <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-1 bg-slate-200 -translate-x-1/2 rounded-full"></div>

      <div className="flex flex-col relative">
        <div className="bg-emerald-500 text-white text-center py-2 rounded-t-xl font-bold text-lg shadow-sm z-10">🟢 동의 ({agreePosts.length})</div>
        <div className="bg-emerald-50/50 border-x-2 border-b-2 border-emerald-100 rounded-b-xl p-4 min-h-[200px] flex flex-col gap-4">
          {agreePosts.slice(0, visibleAgree).map(post => (
            <PostCard 
              key={post.id} 
              post={post} 
              onReply={setReplyTarget} 
              currentUserData={currentUserData} 
              currentUserFriends={currentUserFriends} 
            />
          ))}
          {visibleAgree < agreePosts.length && (
            <button onClick={() => setVisibleAgree(prev => prev + 3)} className="w-full py-2 bg-white border border-emerald-200 text-emerald-600 font-bold rounded-lg hover:bg-emerald-100 transition-all text-sm">👇 댓글 더보기</button>
          )}
        </div>
      </div>
      
      <div className="flex flex-col relative">
        <div className="bg-orange-500 text-white text-center py-2 rounded-t-xl font-bold text-lg shadow-sm z-10">🔴 비동의 ({disagreePosts.length})</div>
        <div className="bg-orange-50/50 border-x-2 border-b-2 border-orange-100 rounded-b-xl p-4 min-h-[200px] flex flex-col gap-4">
          {disagreePosts.slice(0, visibleDisagree).map(post => (
            <PostCard 
              key={post.id} 
              post={post} 
              onReply={setReplyTarget} 
              currentUserData={currentUserData} 
              currentUserFriends={currentUserFriends} 
            />
          ))}
          {visibleDisagree < disagreePosts.length && (
            <button onClick={() => setVisibleDisagree(prev => prev + 3)} className="w-full py-2 bg-white border border-orange-200 text-orange-600 font-bold rounded-lg hover:bg-orange-100 transition-all text-sm">👇 댓글 더보기</button>
          )}
        </div>
      </div>
    </div>
  );
};

export default DebateBoard;