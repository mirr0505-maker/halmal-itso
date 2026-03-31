// src/components/PostCard.tsx
import { db } from '../firebase';
import { doc, deleteDoc } from 'firebase/firestore';
import type { Post, UserData } from '../types';
import { formatKoreanNumber, getReputationLabel } from '../utils';

interface Props {
  post: Post;
  onReply: (post: Post) => void;
  onPostClick: (post: Post) => void;
  currentUserData?: UserData | null;
  onLikeClick?: (e: React.MouseEvent | null, id: string) => void;
  currentNickname?: string;
  allUsers?: Record<string, UserData>;
  followerCounts?: Record<string, number>;
  isPinned?: boolean;
  isRootAuthor?: boolean;
  onPin?: () => void;
  onThanksball?: (post: Post) => void;
}

const PostCard = ({
  post, onReply, onPostClick,
  onLikeClick, currentNickname, allUsers = {}, followerCounts = {},
  isPinned, isRootAuthor, onPin, onThanksball
}: Props) => {
  const isMyPost = post.author === currentNickname;
  const isLikedByMe = currentNickname && post.likedBy?.includes(currentNickname);

  // 🚀 실시간 사용자 데이터 바인딩
  const authorData = (post.author_id && allUsers[post.author_id]) || allUsers[`nickname_${post.author}`];
  const realFollowers = followerCounts[post.author] || 0;
  const displayLevel = authorData ? authorData.level : (post.authorInfo?.level || 1);
  const displayLikes = authorData ? authorData.likes : (post.authorInfo?.totalLikes || 0);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("정말 삭제하시겠소?")) {
      try {
        const col = post.rootId ? 'comments' : 'posts';
        await deleteDoc(doc(db, col, post.id));
      } catch (e) { console.error(e); }
    }
  };

  const formatRelativeTime = (timestamp: { seconds: number } | null | undefined) => {
    if (!timestamp) return "";
    const now = new Date();
    const createdAt = new Date(timestamp.seconds * 1000);
    const diff = Math.floor((now.getTime() - createdAt.getTime()) / 1000);
    if (diff < 60) return "방금 전";
    if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
    return createdAt.toLocaleDateString();
  };

  return (
    <div
      onClick={() => post.type === 'formal' && onPostClick(post)}
      className={`group relative p-4 md:p-5 border-b border-slate-100 transition-all ${isPinned ? 'bg-amber-50/40 border-l-2 border-l-amber-300' : post.type === 'formal' ? 'bg-white cursor-pointer hover:bg-slate-50' : 'bg-transparent'}`}
    >
      <div className="flex gap-3.5">
        <div className="w-9 h-9 rounded-full overflow-hidden bg-slate-50 shrink-0 border border-slate-100 shadow-sm">
          <img src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${post.author}`} alt="" className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-black text-[12.5px] text-slate-900 leading-none">{post.author}</span>
                <span className="text-[9px] font-bold text-slate-300">{formatRelativeTime(post.createdAt)}</span>
              </div>
              {/* 🚀 평판 정보 복구 (Lv 1 · 중립 · 깐부 0) */}
              <span className="text-[9px] font-bold text-slate-400 mt-0.5 leading-none">
                Lv {displayLevel} · {getReputationLabel(displayLikes)} · 깐부 {formatKoreanNumber(realFollowers)}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {isPinned && (
                <span className="text-[9px] font-black text-amber-500 flex items-center gap-0.5">
                  <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>
                  작성자가 고정한 댓글
                </span>
              )}
              {isRootAuthor && onPin && (
                <button onClick={(e) => { e.stopPropagation(); onPin(); }}
                  className={`opacity-0 group-hover:opacity-100 p-1 transition-all ${isPinned ? 'text-amber-400 hover:text-slate-400' : 'text-slate-300 hover:text-amber-400'}`}
                  title={isPinned ? '고정 해제' : '댓글 고정'}
                >
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>
                </button>
              )}
              {isMyPost && (
                <button onClick={handleDelete} className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-rose-500 transition-all">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h14" /></svg>
                </button>
              )}
            </div>
          </div>
          
          {post.type === 'formal' && post.title && (
            <h4 className="font-black text-[13.5px] text-blue-600 leading-tight tracking-tight mt-0.5">📝 {post.title}</h4>
          )}
          
          <div 
            className="text-[13.5px] text-slate-700 leading-relaxed font-medium break-words line-clamp-3 prose-compact"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />
          
          <style>{`
            .prose-compact img { display: none; } /* 목록에서는 이미지를 숨겨 쾌적함 유지 */
            .prose-compact p { margin: 0; display: inline; }
            .prose-compact h1, .prose-compact h2 { font-size: 13.5px; font-weight: 900; display: inline; }
          `}</style>
          
          <div className="flex items-center justify-between mt-1">
            <div className="flex items-center gap-4">
              <button 
                onClick={(e) => { e.stopPropagation(); onLikeClick?.(e, post.id); }}
                className={`flex items-center gap-1.5 text-[10.5px] font-black transition-colors ${isLikedByMe ? 'text-rose-500' : 'text-slate-300 hover:text-rose-400'}`}
              >
                <svg className={`w-3.5 h-3.5 ${isLikedByMe ? 'fill-current' : 'fill-none'}`} stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
                {formatKoreanNumber(post.likes || 0)}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onReply(post); }}
                className="flex items-center gap-1.5 text-[10.5px] font-black text-slate-300 hover:text-blue-500 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                답글
              </button>
              {(post.thanksballTotal || 0) > 0 && (
                <span className="flex items-center gap-1 text-[10.5px] font-black text-amber-400">
                  <span className="text-[12px] leading-none">⚾</span>
                  {post.thanksballTotal}
                </span>
              )}
              {isRootAuthor && !isMyPost && onThanksball && (
                <button
                  onClick={(e) => { e.stopPropagation(); onThanksball(post); }}
                  className="flex items-center gap-1 text-[10.5px] font-black text-slate-300 hover:text-amber-500 transition-colors"
                  title="이 댓글에 땡스볼 보내기"
                >
                  <span className="text-[12px] leading-none">⚾</span>
                </button>
              )}
            </div>
            
            {/* 🚀 카테고리 정보 노출 (댓글/연계글 타입) */}
            {post.category && (
              <span className="text-[8px] font-black text-blue-400/60 uppercase tracking-widest">{post.category}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PostCard;
