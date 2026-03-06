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
  onLikeClick?: (e: React.MouseEvent | null, postId: string) => void;
  currentNickname?: string;
}

const RootPostCard = ({ 
  post, totalComment, totalFormal, uniqueAgreeCount, uniqueDisagreeCount, isFriend, onToggleFriend, userData, friendCount, onDeleteSuccess, onLikeClick, currentNickname
}: Props) => {
  
  const isMyPost = post.author === currentNickname || post.author === "흑무영"; 
  const isLikedByMe = currentNickname && post.likedBy?.includes(currentNickname);

  const getReputationLabel = (likes: number) => {
    if (likes >= 1000) return "확고";
    if (likes >= 500) return "우호";
    if (likes >= 100) return "약간 우호";
    if (likes < 0) return "적대";
    return "중립";
  };

  const formatKoreanNumber = (num: number) => {
    if (num >= 10000) return Math.floor(num / 10000) + '만';
    if (num >= 1000) return Math.floor(num / 1000) + '천';
    return num.toLocaleString();
  };

  const hasImageInContent = post.content.includes('<img');

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

  const handleFriendClick = () => {
    if (isMyPost) {
      alert("나 자신과는 이미 영원한 깐부입니다! 🤝");
      return;
    }
    onToggleFriend();
  };

  return (
    <section className="bg-white border border-slate-100 rounded-none px-8 py-4 mb-0 shadow-sm relative overflow-hidden">
      <div className="flex items-center justify-end mb-2">
         <span className="text-[11.5px] font-bold text-slate-300">{formatTime(post.createdAt)}</span>
      </div>
      
      <h2 className="text-sm font-[1000] text-slate-900 mb-2 leading-tight tracking-tight">{post.title}</h2>

      <div className="flex flex-wrap gap-2 mb-4">
        {(post.tags || []).map((tag, idx) => (
          <span key={idx} className="text-[11.5px] font-black text-blue-500 bg-blue-50/50 px-2.5 py-1 rounded-full">
            {tag.startsWith('#') ? tag : `#${tag}`}
          </span>
        ))}
      </div>

      {post.imageUrl && !hasImageInContent && (
        <div className="w-full max-h-[500px] rounded-[2rem] overflow-hidden border border-slate-50 mb-4 shadow-inner flex justify-center bg-slate-50/50">
          <img src={post.imageUrl} alt="Content Image" className="w-full h-full object-contain" />
        </div>
      )}

      <div 
        className="text-[11.5px] text-slate-600 mb-5 leading-[1.8] font-bold prose prose-slate max-w-none"
        dangerouslySetInnerHTML={{ __html: post.content }}
      />

      {post.linkUrl && (
        <div className="mb-5">
          <a 
            href={post.linkUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 font-black text-[11.5px] hover:bg-blue-600 hover:text-white transition-all shadow-sm"
          >
            🔗 관련 링크 바로가기
          </a>
        </div>
      )}
      
      <div className="flex items-center justify-between bg-slate-50/80 border border-slate-100 py-2.5 px-4 rounded-2xl mb-2">
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-full bg-white overflow-hidden border border-slate-100 shrink-0 shadow-sm">
             <img src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${post.author}`} alt="avatar" className="w-full h-full object-cover" />
          </div>
          <div className="flex flex-col">
            <span className="font-black text-[11.5px] text-slate-900 leading-none mb-1">{post.author}</span>
            <span className="text-[10px] text-slate-400 font-bold">
              Lv.{userData.level} · {getReputationLabel(userData.likes)} · 깐부 {formatKoreanNumber(friendCount)}
            </span>
          </div>
        </div>

        <div className="flex-1 flex justify-center items-center">
          <button 
            onClick={() => onLikeClick?.(null, post.id)}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full transition-all duration-300 active:scale-125 hover:scale-105 shadow-sm border ${isLikedByMe ? 'bg-rose-400 text-white border-rose-400 shadow-rose-100' : 'bg-white text-rose-300 border-rose-100 hover:bg-rose-50'}`}
          >
            <svg className={`w-4 h-4 transition-colors ${isLikedByMe ? 'fill-current' : 'fill-none'}`} viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
            </svg>
            <span className="text-[11.5px] font-black">{formatKoreanNumber(post.likes || 0)}</span>
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isMyPost && (
            <div className="flex gap-2 mr-2">
              <button className="text-[10px] font-black text-blue-400 hover:text-blue-600 transition-colors">수정</button>
              <button onClick={handleDelete} className="text-[10px] font-black text-rose-400 hover:text-rose-600 transition-colors">삭제</button>
            </div>
          )}
          <button 
            onClick={handleFriendClick} 
            className={`px-4 py-1.5 text-[10.5px] font-black rounded-full border transition-all ${isFriend ? 'bg-white text-slate-400 border-slate-200 shadow-sm' : 'bg-slate-900 text-white border-slate-900 shadow-lg'}`}
          >
            {isFriend ? '깐부해제' : '+ 깐부맺기'}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-end text-[11.5px] font-black text-slate-300 gap-5 border-t border-slate-50 pt-2">
        <span className="flex items-center gap-1.5">댓글 {totalComment}</span>
        <span className="flex items-center gap-1.5">연계글 {totalFormal}</span>
        <div className="flex gap-4 ml-2 items-center">
          <span className={`flex items-center gap-1 ${isLikedByMe ? 'text-rose-400' : 'text-slate-300'}`}>
            동의 {uniqueAgreeCount}
          </span>
          <span className="text-slate-300 flex items-center gap-1">
            비동의 {uniqueDisagreeCount}
          </span>
        </div>
      </div>
    </section>
  );
};

export default RootPostCard;