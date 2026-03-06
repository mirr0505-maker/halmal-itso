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
  selectedType: 'comment' | 'formal';
  setSelectedType: (type: 'comment' | 'formal') => void;
  selectedSide: 'left' | 'right';
  setSelectedSide: (side: 'left' | 'right') => void;
  currentNickname?: string;
  onLikeClick?: (e: React.MouseEvent | null, postId: string) => void;
}

const DebateBoard = ({
  agreePosts, disagreePosts, setReplyTarget, currentUserData, currentUserFriends,
  selectedType, setSelectedType, selectedSide, setSelectedSide,
  currentNickname, onLikeClick
}: DebateBoardProps) => {
  const [visibleAgree, setVisibleAgree] = useState(5);
  const [visibleDisagree, setVisibleDisagree] = useState(5);

  const handleTypeChange = (side: 'left' | 'right', type: 'comment' | 'formal') => {
    setSelectedSide(side);
    setSelectedType(type);
    const inputArea = document.querySelector('form');
    if (inputArea) inputArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // 🚀 계층형 렌더링을 위한 재귀 함수
  const renderPostTree = (posts: Post[], parentId: string, level: number = 0) => {
    const children = posts.filter(p => p.parentId === parentId);
    return children.map(post => (
      <div key={post.id} className="flex flex-col w-full">
        <PostCard
          post={post}
          onReply={setReplyTarget}
          currentUserData={currentUserData}
          currentUserFriends={currentUserFriends}
          level={level}
          currentNickname={currentNickname}
          onLikeClick={onLikeClick}
        />
        {renderPostTree(posts, post.id, level + 1)}
      </div>
    ));
  };
  const topAgree = agreePosts.filter(p => agreePosts.every(other => other.id !== p.parentId));
  const topDisagree = disagreePosts.filter(p => disagreePosts.every(other => other.id !== p.parentId));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-0 relative border-x border-slate-100">
      <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-px bg-slate-100 -translate-x-1/2 z-10"></div>

      {/* 🟢 동의 진영 영역 */}
      <div className="flex flex-col border-r border-slate-50 md:border-r-0">
        <div className="bg-emerald-50/50 border-l-4 border-emerald-400 text-emerald-700 px-4 py-3 flex justify-between items-center shadow-sm">
          <span className="font-[1000] text-[11.5px] tracking-tighter">동의 <span className="ml-1 opacity-50 font-black">({agreePosts.length})</span></span>
          <div className="relative">
            <select 
              value={selectedSide === 'left' ? selectedType : 'comment'}
              onChange={(e) => handleTypeChange('left', e.target.value as any)}
              className="appearance-none bg-white/80 border border-emerald-100 rounded-none px-2 py-0.5 pr-6 text-[9px] font-black text-emerald-600 outline-none cursor-pointer"
            >
              <option value="comment">💬 댓글 쓰기</option>
              <option value="formal">📝 연계글 쓰기</option>
            </select>
            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-[7px] text-emerald-400">▼</div>
          </div>
        </div>
        <div className="bg-white min-h-[150px] flex flex-col">
          {renderPostTree(agreePosts, agreePosts[0]?.rootId || "").slice(0, visibleAgree)}
          {visibleAgree < topAgree.length && (
            <button onClick={() => setVisibleAgree(prev => prev + 5)} className="w-full py-3 bg-slate-50 text-emerald-600 font-black text-[10px] hover:bg-emerald-50 border-b border-slate-100">더보기</button>
          )}
        </div>
      </div>
      
      {/* 🔴 비동의 진영 영역 */}
      <div className="flex flex-col">
        <div className="bg-rose-50/50 border-r-4 border-rose-400 text-rose-700 px-4 py-3 flex justify-between items-center shadow-sm">
          <div className="relative">
            <select 
              value={selectedSide === 'right' ? selectedType : 'comment'}
              onChange={(e) => handleTypeChange('right', e.target.value as any)}
              className="appearance-none bg-white/80 border border-rose-100 rounded-none px-2 py-0.5 pr-6 text-[9px] font-black text-rose-600 outline-none cursor-pointer text-right"
            >
              <option value="comment">💬 댓글 쓰기</option>
              <option value="formal">📝 연계글 쓰기</option>
            </select>
            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-[7px] text-rose-400">▼</div>
          </div>
          <span className="font-[1000] text-[11.5px] tracking-tighter">비동의 <span className="ml-1 opacity-50 font-black">({disagreePosts.length})</span></span>
        </div>
        <div className="bg-white min-h-[150px] flex flex-col">
          {renderPostTree(disagreePosts, disagreePosts[0]?.rootId || "").slice(0, visibleDisagree)}
          {visibleDisagree < topDisagree.length && (
            <button onClick={() => setVisibleDisagree(prev => prev + 5)} className="w-full py-3 bg-slate-50 text-rose-600 font-black text-[10px] hover:bg-rose-50 border-b border-slate-100">더보기</button>
          )}
        </div>
      </div>
    </div>
  );
};

export default DebateBoard;
