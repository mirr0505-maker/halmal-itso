// src/components/DebateBoard.tsx
import PostCard from './PostCard';
import type { Post } from '../types';

interface Props {
  allChildPosts: Post[];
  setReplyTarget: (post: Post) => void;
  onPostClick: (post: Post) => void;
  currentUserData?: any;
  currentUserFriends: string[];
  onLikeClick?: (e: any, id: string) => void;
  currentNickname?: string;
}

const DebateBoard = ({ 
  allChildPosts, setReplyTarget, onPostClick, onLikeClick, currentNickname
}: Props) => {
  const leftPosts = allChildPosts.filter(p => p.side === 'left');
  const rightPosts = allChildPosts.filter(p => p.side === 'right');

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 bg-slate-100/50 border-x border-b border-slate-100 min-h-[600px] items-stretch">
      {/* 동의 영역 */}
      <div className="flex flex-col border-r border-slate-100">
        <div className="bg-emerald-50/50 p-4 border-b border-emerald-100 flex items-center justify-between sticky top-0 z-10 backdrop-blur-sm">
          <span className="text-[12px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            동의하는 할말 ({leftPosts.length})
          </span>
        </div>
        <div className="flex-1">
          {leftPosts.map(post => (
            <PostCard 
              key={post.id} post={post} onReply={setReplyTarget} onPostClick={onPostClick}
              onLikeClick={onLikeClick} currentNickname={currentNickname}
            />
          ))}
          {leftPosts.length === 0 && <div className="py-20 text-center text-slate-300 font-bold italic text-sm">침묵이 흐르고 있소.</div>}
        </div>
      </div>

      {/* 비동의 영역 */}
      <div className="flex flex-col">
        <div className="bg-rose-50/50 p-4 border-b border-rose-100 flex items-center justify-between sticky top-0 z-10 backdrop-blur-sm">
          <span className="text-[12px] font-black text-rose-600 uppercase tracking-widest flex items-center gap-2">
            <span className="w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
            비동의하는 할말 ({rightPosts.length})
          </span>
        </div>
        <div className="flex-1">
          {rightPosts.map(post => (
            <PostCard 
              key={post.id} post={post} onReply={setReplyTarget} onPostClick={onPostClick}
              onLikeClick={onLikeClick} currentNickname={currentNickname}
            />
          ))}
          {rightPosts.length === 0 && <div className="py-20 text-center text-slate-300 font-bold italic text-sm">침묵이 흐르고 있소.</div>}
        </div>
      </div>
    </div>
  );
};

export default DebateBoard;
