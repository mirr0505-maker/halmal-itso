// src/components/PostCard.tsx
import { db } from '../firebase';
import { doc, deleteDoc } from 'firebase/firestore';
import type { Post } from '../types';

interface Props {
  post: Post;
  onReply: (post: Post) => void;
  onPostClick: (post: Post) => void;
  currentUserData?: any;
  onLikeClick?: (e: any, id: string) => void;
  currentNickname?: string;
}

const PostCard = ({ 
  post, onReply, onPostClick, 
  onLikeClick, currentNickname 
}: Props) => {
  const isMyPost = post.author === currentNickname;
  const isLikedByMe = currentNickname && post.likedBy?.includes(currentNickname);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("정말 삭제하시겠소?")) {
      try {
        await deleteDoc(doc(db, "posts", post.id));
      } catch (e) {
        console.error(e);
      }
    }
  };

  const formatRelativeTime = (timestamp: any) => {
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
      className={`group relative p-5 border-b border-slate-100 transition-all ${post.type === 'formal' ? 'bg-white cursor-pointer hover:bg-slate-50' : 'bg-transparent'}`}
    >
      <div className="flex gap-4">
        <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-100 shrink-0 border border-slate-200">
          <img src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${post.author}`} alt="" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="font-black text-[13px] text-slate-900">{post.author}</span>
              <span className="text-[10px] font-bold text-slate-300">{formatRelativeTime(post.createdAt)}</span>
            </div>
            {isMyPost && (
              <button onClick={handleDelete} className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-rose-500 transition-all">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h14" /></svg>
              </button>
            )}
          </div>
          
          {post.type === 'formal' && post.title && (
            <h4 className="font-black text-[14px] text-blue-600 mb-1 leading-tight tracking-tight">📝 {post.title}</h4>
          )}
          
          <p className="text-[14px] text-slate-700 leading-relaxed font-medium break-words mb-3">{post.content}</p>
          
          <div className="flex items-center gap-4 mt-2">
            <button 
              onClick={(e) => { e.stopPropagation(); onLikeClick?.(e, post.id); }}
              className={`flex items-center gap-1.5 text-[11px] font-black transition-colors ${isLikedByMe ? 'text-rose-500' : 'text-slate-300 hover:text-rose-400'}`}
            >
              <svg className={`w-4 h-4 ${isLikedByMe ? 'fill-current' : 'fill-none'}`} stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
              {post.likes || 0}
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onReply(post); }}
              className="flex items-center gap-1.5 text-[11px] font-black text-slate-300 hover:text-blue-500 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
              답글
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PostCard;
