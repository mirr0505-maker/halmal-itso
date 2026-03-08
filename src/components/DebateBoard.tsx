// src/components/DebateBoard.tsx
import PostCard from './PostCard';
import type { Post } from '../types';
import { CATEGORY_RULES } from './DiscussionView';

interface Props {
  allChildPosts: Post[];
  setReplyTarget: (post: Post) => void;
  onPostClick: (post: Post) => void;
  currentUserData?: any;
  currentUserFriends: string[];
  onLikeClick?: (e: any, id: string) => void;
  currentNickname?: string;
  category: string;
}

const DebateBoard = ({ 
  allChildPosts, setReplyTarget, onPostClick, onLikeClick, currentNickname, category
}: Props) => {
  const rule = CATEGORY_RULES[category] || CATEGORY_RULES["나의 이야기"];
  
  const leftPosts = allChildPosts.filter(p => p.side === 'left');
  const rightPosts = allChildPosts.filter(p => p.side === 'right');

  // 🚀 단일 리스트형 레이아웃 (나의 이야기, 뼈때리는 글, 지식 소매상 등)
  if (rule.boardType === 'single' || rule.boardType === 'qa') {
    const label = rule.boardType === 'qa' ? "지식 답변" : "공감하는 할말";
    const emoji = rule.boardType === 'qa' ? "💡" : "💬";
    const colorClass = rule.boardType === 'qa' ? "text-blue-600 bg-blue-50/50 border-blue-100" : "text-emerald-600 bg-emerald-50/50 border-emerald-100";
    const pointColor = rule.boardType === 'qa' ? "bg-blue-500" : "bg-emerald-500";

    return (
      <div className="flex flex-col bg-white border-x border-b border-slate-100 min-h-[400px]">
        <div className={`${colorClass} p-4 border-b flex items-center justify-between sticky top-0 z-10 backdrop-blur-sm`}>
          <span className="text-[12px] font-black uppercase tracking-widest flex items-center gap-2">
            <span className={`w-2 h-2 ${pointColor} rounded-full animate-pulse`} />
            {label} ({allChildPosts.length})
          </span>
        </div>
        <div className="flex-1">
          {allChildPosts.map(post => (
            <PostCard 
              key={post.id} post={post} onReply={setReplyTarget} onPostClick={onPostClick}
              onLikeClick={onLikeClick} currentNickname={currentNickname}
            />
          ))}
          {allChildPosts.length === 0 && <div className="py-20 text-center text-slate-300 font-bold italic text-sm">{emoji} 첫 번째 기록을 남겨보시오.</div>}
        </div>
      </div>
    );
  }

  // 🚀 정보 공유형 레이아웃 (현지 소식 등)
  if (rule.boardType === 'info') {
    return (
      <div className="flex flex-col bg-white border-x border-b border-slate-100 min-h-[400px]">
        <div className="bg-slate-50/80 p-4 border-b border-slate-100 flex items-center justify-between sticky top-0 z-10 backdrop-blur-sm">
          <span className="text-[12px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
            <span className="w-2 h-2 bg-slate-400 rounded-full animate-pulse" />
            나누고 싶은 정보 ({allChildPosts.length})
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
          <div className="border-r border-slate-50">
            {leftPosts.map(post => (
              <PostCard key={post.id} post={post} onReply={setReplyTarget} onPostClick={onPostClick} onLikeClick={onLikeClick} currentNickname={currentNickname} />
            ))}
          </div>
          <div>
            {rightPosts.map(post => (
              <PostCard key={post.id} post={post} onReply={setReplyTarget} onPostClick={onPostClick} onLikeClick={onLikeClick} currentNickname={currentNickname} />
            ))}
          </div>
        </div>
        {allChildPosts.length === 0 && <div className="py-20 text-center text-slate-300 font-bold italic text-sm">🌍 따끈한 현지 소식을 기다리고 있소.</div>}
      </div>
    );
  }

  // 🚀 기본 대립형 레이아웃 (당나귀 귀, 벌거벗은 임금님 등)
  const leftLabel = rule.boardType === 'factcheck' ? "진실 제보" : "동의하는 할말";
  const rightLabel = rule.boardType === 'factcheck' ? "반박/추가확인" : "비동의하는 할말";

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 bg-slate-100/50 border-x border-b border-slate-100 min-h-[600px] items-stretch">
      {/* 좌측 진영 */}
      <div className="flex flex-col border-r border-slate-100 bg-white">
        <div className="bg-emerald-50/50 p-4 border-b border-emerald-100 flex items-center justify-between sticky top-0 z-10 backdrop-blur-sm">
          <span className="text-[12px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            {leftLabel} ({leftPosts.length})
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

      {/* 우측 진영 */}
      <div className="flex flex-col bg-white">
        <div className="bg-rose-50/50 p-4 border-b border-rose-100 flex items-center justify-between sticky top-0 z-10 backdrop-blur-sm">
          <span className="text-[12px] font-black text-rose-600 uppercase tracking-widest flex items-center gap-2">
            <span className="w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
            {rightLabel} ({rightPosts.length})
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
