// src/components/DebateBoard.tsx
import { useState } from 'react';
import type { Post } from '../types';
import PostCard from './PostCard';

interface DebateBoardProps {
  agreePosts: Post[];
  disagreePosts: Post[];
  setReplyTarget: (post: Post | null) => void;
  currentUserData?: any; 
  currentUserFriends?: string[];
}

const DebateBoard = ({ agreePosts, disagreePosts, setReplyTarget, currentUserData, currentUserFriends }: DebateBoardProps) => {
  const [visibleAgree, setVisibleAgree] = useState(3);
  const [visibleDisagree, setVisibleDisagree] = useState(3);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 relative">
      <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-0.5 bg-slate-100 -translate-x-1/2 rounded-full"></div>

      <div className="flex flex-col gap-2">
        <div className="bg-emerald-500 text-white text-center py-1.5 rounded-xl font-black text-xs shadow-sm">🟢 동의 ({agreePosts.length})</div>
        <div className="bg-emerald-50/30 border border-emerald-100 rounded-xl p-2.5 min-h-[150px] flex flex-col gap-2.5">
          {agreePosts.slice(0, visibleAgree).map(post => (
            <PostCard key={post.id} post={post} onReply={setReplyTarget} currentUserData={currentUserData} currentUserFriends={currentUserFriends} />
          ))}
          {visibleAgree < agreePosts.length && (
            <button onClick={() => setVisibleAgree(prev => prev + 3)} className="w-full py-1.5 bg-white border border-emerald-100 text-emerald-600 font-black rounded-lg text-[10px]">더보기</button>
          )}
        </div>
      </div>
      
      <div className="flex flex-col gap-2">
        <div className="bg-orange-500 text-white text-center py-1.5 rounded-xl font-black text-xs shadow-sm">🔴 비동의 ({disagreePosts.length})</div>
        <div className="bg-orange-50/30 border border-orange-100 rounded-xl p-2.5 min-h-[150px] flex flex-col gap-2.5">
          {disagreePosts.slice(0, visibleDisagree).map(post => (
            <PostCard key={post.id} post={post} onReply={setReplyTarget} currentUserData={currentUserData} currentUserFriends={currentUserFriends} />
          ))}
          {visibleDisagree < disagreePosts.length && (
            <button onClick={() => setVisibleDisagree(prev => prev + 3)} className="w-full py-1.5 bg-white border border-orange-100 text-orange-600 font-black rounded-lg text-[10px]">더보기</button>
          )}
        </div>
      </div>
    </div>
  );
};

export default DebateBoard;
