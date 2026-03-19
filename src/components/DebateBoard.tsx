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
  if (rule.boardType === 'single' || rule.boardType === 'qa' || rule.boardType === 'onecut') {
    let label = "댓글";
    let colorClass = "text-slate-800";
    let pointColor = "bg-slate-800";

    if (rule.boardType === 'qa') {
      label = "지식 답변"; colorClass = "text-blue-600"; pointColor = "bg-blue-500";
    } else if (category === '유배·귀양지') {
      label = "격리 구역 기록"; colorClass = "text-slate-500"; pointColor = "bg-slate-400";
    } else if (category === '뼈때리는 글') {
      label = "뼈때리는 글"; colorClass = "text-purple-600"; pointColor = "bg-purple-500";
    } else if (rule.boardType === 'onecut') {
      label = "한컷 반응"; colorClass = "text-rose-600"; pointColor = "bg-rose-500";
    } else {
      label = "공감하는 글"; colorClass = "text-emerald-600"; pointColor = "bg-emerald-500";
    }

    return (
      <div className="flex flex-col bg-white min-h-[200px] mt-4">
        <div className="py-4 md:px-8 border-b border-slate-100 flex items-center justify-between sticky top-0 z-10 bg-white">
          <h4 className={`text-[14px] font-[1000] ${colorClass} tracking-tight flex items-center gap-2.5`}>
            <span className={`w-2.5 h-2.5 ${pointColor} rounded-full`} />
            {label} ({allChildPosts.length})
          </h4>
        </div>
        <div className="flex-1">
          {allChildPosts.map(post => (
            <PostCard 
              key={post.id} post={post} onReply={setReplyTarget} onPostClick={onPostClick}
              onLikeClick={onLikeClick} currentNickname={currentNickname}
            />
          ))}
          {allChildPosts.length === 0 && <div className="py-20 text-center text-slate-300 font-bold text-xs">첫 번째 글을 남겨보세요.</div>}
        </div>
      </div>
    );
  }

  // 🚀 정보 공유형 레이아웃 (현지 소식 등)
  if (rule.boardType === 'info') {
    return (
      <div className="flex flex-col bg-white min-h-[200px] mt-4">
        <div className="py-4 md:px-8 border-b border-slate-100 flex items-center justify-between sticky top-0 z-10 bg-white">
          <h4 className="text-[14px] font-[1000] text-slate-700 tracking-tight flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 bg-slate-400 rounded-full" />
            나누고 싶은 정보 ({allChildPosts.length})
          </h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border-b border-slate-100">
          <div className="md:border-r border-slate-100">
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
        {allChildPosts.length === 0 && <div className="py-20 text-center text-slate-300 font-bold text-xs">🌍 따끈한 현지 소식을 기다리고 있어요.</div>}
      </div>
    );
  }

  // 🚀 기본 대립형 레이아웃 (당나귀 귀, 벌거벗은 임금님 등)
  const leftLabel = rule.boardType === 'factcheck' ? "진실 제보" : rule.tab1.replace(/[^가-힣\s]/g, '').trim() || "동의";
  const rightLabel = rule.boardType === 'factcheck' ? "반박/추가확인" : rule.tab2?.replace(/[^가-힣\s]/g, '').trim() || "비동의";

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 min-h-[400px] mt-4 bg-[#F8FAFC]">
      {/* 좌측 진영 */}
      <div className="flex flex-col md:border-r border-slate-200 bg-white">
        <div className="py-4 px-6 border-b border-slate-100 flex items-center justify-between sticky top-0 z-10 bg-white/90 backdrop-blur-sm">
          <h4 className="text-[14px] font-[1000] text-blue-600 tracking-tight flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-blue-500 rounded-full" />
            {leftLabel} ({leftPosts.length})
          </h4>
        </div>
        <div className="flex-1">
          {leftPosts.map(post => (
            <PostCard 
              key={post.id} post={post} onReply={setReplyTarget} onPostClick={onPostClick}
              onLikeClick={onLikeClick} currentNickname={currentNickname}
            />
          ))}
          {leftPosts.length === 0 && <div className="py-16 text-center text-slate-300 font-bold text-xs">첫 글을 남겨주세요.</div>}
        </div>
      </div>

      {/* 우측 진영 */}
      <div className="flex flex-col bg-white">
        <div className="py-4 px-6 border-b border-slate-100 flex items-center justify-between sticky top-0 z-10 bg-white/90 backdrop-blur-sm">
          <h4 className="text-[14px] font-[1000] text-rose-500 tracking-tight flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-rose-400 rounded-full" />
            {rightLabel} ({rightPosts.length})
          </h4>
        </div>
        <div className="flex-1">
          {rightPosts.map(post => (
            <PostCard 
              key={post.id} post={post} onReply={setReplyTarget} onPostClick={onPostClick}
              onLikeClick={onLikeClick} currentNickname={currentNickname}
            />
          ))}
          {rightPosts.length === 0 && <div className="py-16 text-center text-slate-300 font-bold text-xs">첫 글을 남겨주세요.</div>}
        </div>
      </div>
    </div>
  );
};

export default DebateBoard;
