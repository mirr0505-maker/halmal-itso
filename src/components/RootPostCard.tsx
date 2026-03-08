// src/components/RootPostCard.tsx
import { db } from '../firebase';
import { doc, deleteDoc } from 'firebase/firestore';
import type { Post } from '../types';
import { getReputationLabel, formatKoreanNumber } from '../utils';

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

  return (
    <section className="bg-white border border-slate-100 rounded-none mb-0 shadow-sm relative overflow-hidden flex flex-col">
      <div className="flex-1 flex flex-col p-10 md:p-12"> {/* 🚀 패딩 축소 */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-[11px] font-black text-slate-300 uppercase tracking-widest">{formatTime(post.createdAt)}</span>
          <div className="flex items-center gap-2">
            {isMyPost && (
              <div className="flex gap-4">
                <button className="text-[11px] font-black text-blue-400 hover:text-blue-600 transition-colors uppercase tracking-tighter underline">수정</button>
                <button onClick={handleDelete} className="text-[11px] font-black text-rose-400 hover:text-rose-600 transition-colors uppercase tracking-tighter underline">삭제</button>
              </div>
            )}
          </div>
        </div>
        
        {/* 🚀 카테고리 뱃지 추가 (제목 위) */}
        <div className="mb-3">
          <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded uppercase tracking-widest">
            {post.category || "나의 이야기"}
          </span>
        </div>

        <h2 className="text-[20px] font-[1000] text-slate-900 mb-4 leading-tight tracking-tighter max-w-4xl">{post.title}</h2>

        <div className="flex flex-wrap gap-2 mb-6">
          {(post.tags || []).map((tag, idx) => (
            <span key={idx} className="text-[10.5px] font-black text-blue-600 bg-blue-50 px-2.5 py-1 rounded-none border border-blue-100">
              {tag.startsWith('#') ? tag : `#${tag}`}
            </span>
          ))}
        </div>

        {post.imageUrl && !hasImageInContent && (
          <div className="w-full md:w-1/2 mb-8 border border-slate-50 overflow-hidden bg-slate-50 shrink-0">
            <img src={post.imageUrl} alt="Post Content" className="w-full h-auto object-contain max-h-[400px]" />
          </div>
        )}

        <div className="text-[14px] text-slate-700 mb-8 leading-[1.7] font-medium prose prose-slate max-w-none flex-1" dangerouslySetInnerHTML={{ __html: post.content }} />

        {post.linkUrl && (
          <div className="mb-8">
            <a href={post.linkUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-none font-black text-[11px] hover:bg-blue-600 transition-all tracking-wider">🔗 관련 링크 바로가기</a>
          </div>
        )}
        
        <div className="mt-auto pt-6 border-t border-slate-100">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-none bg-slate-50 overflow-hidden border border-slate-100 shrink-0 shadow-sm">
                <img src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${post.author}`} alt="avatar" className="w-full h-full object-cover" />
              </div>
              <div className="flex flex-col">
                <span className="font-black text-[13.5px] text-slate-900 leading-none mb-1">{post.author}</span>
                {/* 🚀 평판 정보 복구 */}
                <span className="text-[10px] text-slate-400 font-bold leading-none">
                  Lv {userData.level} · {getReputationLabel(userData.likes)} · 깐부 {formatKoreanNumber(friendCount)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 w-full md:w-auto">
              <button onClick={() => onLikeClick?.(null, post.id)} className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2 rounded-none transition-all duration-300 border-2 ${isLikedByMe ? 'bg-rose-500 text-white border-rose-500' : 'bg-white text-rose-400 border-slate-200 hover:border-rose-400'}`}><svg className={`w-3.5 h-3.5 ${isLikedByMe ? 'fill-current' : 'fill-none'}`} viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" /></svg><span className="text-[12px] font-[1000]">{formatKoreanNumber(post.likes || 0)}</span></button>
              <button onClick={() => onToggleFriend()} className={`flex-1 md:flex-none px-5 py-2 text-[11px] font-black rounded-none border-2 transition-all ${isFriend ? 'bg-white text-slate-400 border-slate-200' : 'bg-slate-900 text-white border-slate-900 hover:bg-blue-600 hover:border-blue-600'}`}>{isFriend ? '깐부해제' : '+ 깐부맺기'}</button>
            </div>
          </div>
          <div className="flex items-center justify-between text-[14px] font-[1000] text-slate-400 mt-6 pt-4 border-t border-slate-50 uppercase tracking-[0.1em]"><div className="flex gap-6"><span>댓글 {formatKoreanNumber(totalComment)}</span><span>연계글 {formatKoreanNumber(totalFormal)}</span></div><div className="flex gap-6"><span className="flex items-center gap-1">동의 {formatKoreanNumber(uniqueAgreeCount)}</span><span className="flex items-center gap-1">비동의 {formatKoreanNumber(uniqueDisagreeCount)}</span></div></div>
        </div>
      </div>
    </section>
  );
};

export default RootPostCard;
