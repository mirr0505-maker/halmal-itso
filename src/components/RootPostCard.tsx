// src/components/RootPostCard.tsx
import { db } from '../firebase';
import { doc, deleteDoc } from 'firebase/firestore';
import type { Post } from '../types';

interface Props {
  post: Post;
  totalComment: number;
  totalFormal: number;
  uniqueAgreeCount: number;
  uniqueDisagreeCount: number;
  isFriend: boolean;
  onToggleFriend: () => void;
  userData: {
    level: number;
    likes: number;
    bio: string;
  };
  friendCount: number;
  onDeleteSuccess?: () => void;
}

const RootPostCard = ({ 
  post, totalComment, totalFormal, uniqueAgreeCount, uniqueDisagreeCount, isFriend, onToggleFriend, userData, friendCount, onDeleteSuccess
}: Props) => {
  
  const isMyPost = post.author === "흑무영"; 

  const formatTime = (timestamp: any) => {
    if (!timestamp) return "";
    const now = new Date();
    const createdAt = new Date(timestamp.seconds * 1000);
    const diffInSeconds = Math.floor((now.getTime() - createdAt.getTime()) / 1000);
    if (diffInSeconds < 60) return "방금 전";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}분 전`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}시간 전`;
    return createdAt.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const handleDelete = async () => {
    if (window.confirm("정말 영구히 파기하겠소?")) {
      try {
        await deleteDoc(doc(db, "posts", post.id));
        if (onDeleteSuccess) onDeleteSuccess();
        else window.location.reload();
      } catch (error) { console.error("삭제 실패:", error); }
    }
  };

  return (
    <section className="bg-white border border-slate-100 rounded-xl p-4 mb-4 shadow-sm relative overflow-hidden">
      <div className="flex items-center justify-end mb-2">
         <span className="text-[9px] font-bold text-slate-300">{formatTime(post.createdAt)}</span>
      </div>
      
      <h2 className="text-sm font-[1000] text-slate-900 mb-2 leading-tight tracking-tight">{post.title}</h2>

      {post.imageUrl && (
        <div className="w-full aspect-video rounded-xl overflow-hidden border border-slate-50 mb-3 shadow-inner">
          <img src={post.imageUrl} alt="Topic" className="w-full h-full object-cover" />
        </div>
      )}

      <div 
        className="text-[11px] text-slate-600 mb-4 leading-relaxed font-medium prose prose-slate max-w-none"
        dangerouslySetInnerHTML={{ __html: post.content }}
      />

      {post.linkUrl && (
        <div className="mb-4">
          <a 
            href={post.linkUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-600 rounded-lg border border-blue-100 font-bold text-[9px] hover:bg-blue-600 hover:text-white transition-all shadow-sm"
          >
            🔗 관련 링크
          </a>
        </div>
      )}
      
      <div className="flex items-center justify-between bg-slate-50/50 border border-slate-100 p-2.5 rounded-lg mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-slate-200 overflow-hidden border border-slate-200 shrink-0">
             <img src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${post.author}`} alt="avatar" className="w-full h-full object-cover" />
          </div>
          <div className="flex flex-col">
            <span className="font-black text-[10px] text-slate-900 leading-none mb-0.5">{post.author}</span>
            <span className="text-[8px] text-slate-400 font-bold">Lv.{userData.level} · 깐부 {friendCount}</span>
          </div>
        </div>
        <div className="flex gap-2">
          {isMyPost && (
            <button onClick={handleDelete} className="text-[9px] font-black text-rose-400 hover:underline">삭제</button>
          )}
          <button onClick={onToggleFriend} className={`px-2.5 py-0.5 text-[9px] font-bold rounded-full border ${isFriend ? 'bg-white text-slate-400 border-slate-200' : 'bg-blue-600 text-white border-blue-600'}`}>
            {isFriend ? '깐부해제' : '+ 깐부'}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-end text-[8px] font-black text-slate-300 gap-3 border-t border-slate-50 pt-2.5">
        <span>댓글 {totalComment}</span>
        <span>연계글 {totalFormal}</span>
        <div className="flex gap-2 ml-1.5 text-slate-400">
          <span className="text-emerald-500/70">👍 {uniqueAgreeCount}</span>
          <span className="text-orange-500/70">👎 {uniqueDisagreeCount}</span>
        </div>
      </div>
    </section>
  );
};

export default RootPostCard;
