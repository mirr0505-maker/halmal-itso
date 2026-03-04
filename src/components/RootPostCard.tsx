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
  const totalParticipants = uniqueAgreeCount + uniqueDisagreeCount;

  // 🚀 동적 뱃지 생성 로직 (워딩 현지화: 갓나온 반영)
  const renderStatusBadge = () => {
    const now = new Date();
    const createdAt = post.createdAt?.seconds ? new Date(post.createdAt.seconds * 1000) : now;
    const isNew = (now.getTime() - createdAt.getTime()) < 86400000; // 24시간 이내

    if (totalParticipants >= 10) {
      return <span className="bg-rose-500 text-white px-3 py-1 rounded-lg text-[10px] md:text-xs font-black uppercase tracking-widest animate-pulse">🔥 앗뜨거</span>;
    } else if (totalParticipants >= 5) {
      return <span className="bg-orange-500 text-white px-3 py-1 rounded-lg text-[10px] md:text-xs font-black uppercase tracking-widest">⚡ 떠오르는</span>;
    } else if (isNew) {
      return <span className="bg-blue-500 text-white px-3 py-1 rounded-lg text-[10px] md:text-xs font-black uppercase tracking-widest">✨ 갓나온</span>;
    }
    return null;
  };

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
    if (window.confirm("이 원본 할말을 정말 영구히 파기하겠소? 관련 댓글도 모두 접근이 어려워질 수 있소.")) {
      try {
        await deleteDoc(doc(db, "posts", post.id));
        if (onDeleteSuccess) onDeleteSuccess();
        else window.location.reload();
      } catch (error) { console.error("삭제 실패:", error); }
    }
  };

  const handleEdit = () => {
    alert("원글 수정 기능은 현재 고도화 작업 중오! 곧 찾아오겠소.");
  };

  return (
    <>
      <section className="bg-white border-[3px] border-slate-900 rounded-[2rem] p-6 md:p-10 mb-4 shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] relative overflow-hidden">
        <div className="flex items-center justify-between mb-4">
           <div className="flex items-center gap-2">
             {renderStatusBadge()}
             {isMyPost && (
               <div className="flex items-center gap-3 ml-3">
                 {/* 🚀 수정/삭제 버튼 가독성 대폭 강화 (text-xs font-black) */}
                 <button onClick={handleEdit} className="text-xs font-black text-blue-600 hover:text-blue-800 transition-colors bg-blue-50 px-2 py-1 rounded-md border border-blue-100">수정</button>
                 <button onClick={handleDelete} className="text-xs font-black text-rose-600 hover:text-rose-800 transition-colors bg-rose-50 px-2 py-1 rounded-md border border-rose-100">삭제</button>
               </div>
             )}
           </div>
           <span className="text-[10px] md:text-xs font-bold text-slate-300">{formatTime(post.createdAt)}</span>
        </div>
        
        <h2 className="text-2xl md:text-4xl font-black mb-6 leading-tight tracking-tight break-keep">{post.title}</h2>

        {post.imageUrl && (
          <div className="w-full aspect-video rounded-3xl overflow-hidden border-2 border-slate-100 mb-8 shadow-sm">
            <img src={post.imageUrl} alt="Topic" className="w-full h-full object-cover" />
          </div>
        )}

        <div 
          className="text-base md:text-lg text-slate-600 mb-8 leading-relaxed font-medium prose prose-slate max-w-none"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />

        {post.linkUrl && (
          <div className="mb-8">
            <a 
              href={post.linkUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-50 text-blue-600 rounded-2xl border border-blue-100 font-bold text-sm hover:bg-blue-600 hover:text-white transition-all shadow-sm"
            >
              🔗 관련 링크/뉴스 바로가기
            </a>
          </div>
        )}
        
        <div className="flex items-center justify-between bg-white border border-slate-200 p-4 md:p-5 rounded-2xl shadow-sm mt-8 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-slate-200 overflow-hidden shrink-0 border border-slate-200">
               <img src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${post.author}`} alt="avatar" className="w-full h-full object-cover" />
            </div>
            <div className="flex flex-col">
              <span className="font-black text-lg md:text-xl text-slate-900 leading-none mb-2">{post.author}</span>
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-blue-600 text-white px-2 py-0.5 rounded-md text-[11px] font-black uppercase tracking-widest shadow-sm">
                  Lv.{userData.level}
                </span>
                <span className="text-xs md:text-sm text-slate-500 font-bold flex items-center gap-1.5">
                  <span className="w-0.5 h-0.5 bg-slate-300 rounded-full" />
                  깐부 {friendCount.toLocaleString()}
                  <span className="w-0.5 h-0.5 bg-slate-300 rounded-full" />
                  좋아요 {userData.likes.toLocaleString()}
                </span>
              </div>
              <p className="text-sm md:text-base text-slate-600 font-medium italic border-l-2 border-slate-200 pl-3 py-1">
                {userData.bio}
              </p>
            </div>
          </div>
          <button onClick={onToggleFriend} className={`px-4 py-1.5 md:py-2 text-xs md:text-sm font-bold rounded-full transition-all border shrink-0 ${isFriend ? 'border-slate-300 text-slate-500 bg-slate-50' : 'border-blue-500 text-blue-500 hover:bg-blue-50'}`}>
            {isFriend ? '깐부 취소' : '+ 깐부맺기'}
          </button>
        </div>

        <div className="flex items-center justify-end border-t-2 border-slate-50 pt-4">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100">
            <span>댓글 <span className="text-slate-900">{totalComment}</span></span>
            <span className="text-slate-300">|</span>
            <span>연계글 <span className="text-slate-900">{totalFormal}</span></span>
          </div>
        </div>
      </section>

      <div className="flex justify-between items-center mb-12 px-2 md:px-4">
        <div className="flex items-center gap-2 bg-white border-2 border-emerald-500 text-emerald-600 px-5 py-3 rounded-2xl font-black text-sm md:text-base shadow-[0_4px_0_0_rgba(16,185,129,1)]">
          👍 동의 <span className="bg-emerald-100 text-emerald-700 px-2.5 py-0.5 rounded-full ml-1">{uniqueAgreeCount}명</span>
        </div>
        <div className="flex items-center gap-2 bg-white border-2 border-orange-500 text-orange-600 px-5 py-3 rounded-2xl font-black text-sm md:text-base shadow-[0_4px_0_0_rgba(249,115,22,1)]">
          👇 비동의 <span className="bg-orange-100 text-orange-700 px-2.5 py-0.5 rounded-full ml-1">{uniqueDisagreeCount}명</span>
        </div>
      </div>
    </>
  );
};

export default RootPostCard;