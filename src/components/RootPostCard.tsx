// src/components/RootPostCard.tsx
import { useState } from 'react';
import { db } from '../firebase';
import { doc, deleteDoc } from 'firebase/firestore';
import type { Post } from '../types';
import { getReputationLabel, formatKoreanNumber, getCategoryDisplayName } from '../utils';
import { CATEGORY_RULES } from './DiscussionView';
import ThanksballModal from './ThanksballModal';

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
  onEdit?: (post: Post) => void;
  onBack?: () => void;
  thanksballTotal?: number;
  allUsers?: Record<string, any>;
}

const RootPostCard = ({
  post, totalComment, totalFormal, uniqueAgreeCount, uniqueDisagreeCount, isFriend, onToggleFriend, userData, friendCount, onDeleteSuccess, onLikeClick, currentNickname, onEdit, onBack, thanksballTotal, allUsers = {}
}: Props) => {

  const isMyPost = post.author === currentNickname;
  const isLikedByMe = currentNickname && post.likedBy?.includes(currentNickname);
  const [showSelfMsg, setShowSelfMsg] = useState(false);
  const [showThanksball, setShowThanksball] = useState(false);
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
    <section className="bg-white rounded-none flex flex-col mb-0">
      {/* 본문 영역 (콤팩트 패딩) */}
      <div className="flex-1 flex flex-col pt-8 px-4 md:px-8 pb-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <span
              onClick={onBack}
              className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-sm uppercase tracking-widest cursor-pointer hover:bg-blue-100 hover:text-blue-700 hover:-translate-x-0.5 transition-all duration-150 select-none"
              title="목록으로 돌아가기"
            >
              ← {getCategoryDisplayName(post.category)}
            </span>
            <span className="text-[11px] font-bold text-slate-400">{formatTime(post.createdAt)}</span>
          </div>
          
          {isMyPost && (
            <div className="flex gap-3">
              <button onClick={() => onEdit?.(post)} className="text-[11px] font-bold text-slate-400 hover:text-blue-500 transition-colors">수정</button>
              <button onClick={handleDelete} className="text-[11px] font-bold text-slate-400 hover:text-rose-500 transition-colors">삭제</button>
            </div>
          )}
        </div>

        <h2 className="text-[22px] font-[1000] text-slate-900 mb-5 leading-snug tracking-tighter max-w-4xl">{post.title}</h2>

        <div className="text-[15px] text-slate-700 mb-6 leading-[1.8] font-medium max-w-none flex-1 [&_p]:mb-4 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-4 [&_li]:mb-1 [&_strong]:font-bold [&_em]:italic [&_a]:text-blue-600 [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-slate-200 [&_blockquote]:pl-4 [&_blockquote]:text-slate-500 [&_h1]:text-2xl [&_h1]:font-black [&_h2]:text-xl [&_h2]:font-black [&_h3]:text-lg [&_h3]:font-black" dangerouslySetInnerHTML={{ __html: post.content }} />

        {post.imageUrl && !hasImageInContent && (
          <div className="w-full md:w-2/3 mb-6 rounded-2xl overflow-hidden border border-slate-100 bg-slate-50">
            <img src={post.imageUrl} alt="Post Content" className="w-full h-auto object-contain max-h-[500px]" />
          </div>
        )}

        {post.linkUrl && (
          <div className="mb-6">
            <a href={post.linkUrl} target="_blank" rel="noopener noreferrer" className="text-[13px] font-bold text-blue-500 hover:text-blue-600 hover:underline transition-all">
              {post.linkUrl}
            </a>
          </div>
        )}

        <div className="flex flex-wrap gap-2 mb-8">
          {(post.tags || []).map((tag, idx) => (
            <span key={idx} className="text-[11px] font-bold text-slate-400 before:content-['#']">
              {tag.replace('#', '')}
            </span>
          ))}
        </div>
        
        {/* 작성자 & 인터랙션 바 (박스 형태) */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 border border-slate-100 rounded-2xl bg-slate-50/30 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-slate-100 overflow-hidden border border-slate-200 shrink-0">
              <img src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${post.author}`} alt="avatar" className="w-full h-full object-cover" />
            </div>
            <div className="flex flex-col">
              <span className="font-[1000] text-[15px] text-slate-900 mb-0.5">{post.author}</span>
              <span className="text-[11px] text-slate-500 font-bold">
                Lv {userData.level} · {getReputationLabel(userData.likes)} · 깐부 {formatKoreanNumber(friendCount)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <button
              onClick={() => onLikeClick?.(null, post.id)}
              className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl transition-all duration-300 font-[1000] text-[13px] ${isLikedByMe ? 'bg-[#FF2E56] text-white ring-2 ring-rose-300 scale-105' : 'bg-white text-rose-400 border border-rose-200 hover:bg-rose-50'}`}
            >
              <svg className={`w-4 h-4 fill-current`} viewBox="0 0 24 24" stroke="none"><path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" /></svg>
              {formatKoreanNumber(post.likes || 0)}
            </button>
            <button
              onClick={() => { if (!isMyPost && currentNickname) setShowThanksball(true); }}
              title={isMyPost ? '본인 글에는 땡스볼을 보낼 수 없습니다' : (currentNickname ? '땡스볼 보내기' : '로그인 후 이용하세요')}
              className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl border text-[13px] font-[1000] transition-all ${
                isMyPost || !currentNickname
                  ? 'bg-white text-slate-300 border-slate-200 cursor-default'
                  : 'bg-white text-amber-500 border-amber-200 hover:bg-amber-50 cursor-pointer'
              }`}
            >
              <span className="text-[16px] leading-none">⚾</span>
              <span>{(thanksballTotal || 0) > 0 ? `${thanksballTotal}볼` : '땡스볼'}</span>
            </button>
            {isMyPost ? (
              <div className="flex-1 md:flex-none flex flex-col items-center gap-1">
                <button
                  onClick={() => { setShowSelfMsg(true); setTimeout(() => setShowSelfMsg(false), 1000); }}
                  className="w-full md:w-auto px-6 py-2.5 text-[13px] font-[1000] rounded-xl border bg-white text-slate-300 border-slate-200 cursor-default"
                >
                  + 깐부맺기
                </button>
                {showSelfMsg && (
                  <span className="text-[11px] font-bold text-rose-400 bg-rose-50 border border-rose-200 rounded-lg px-3 py-1.5 whitespace-nowrap">
                    본인은 이 세상 절대 깐부입니다 🚫
                  </span>
                )}
              </div>
            ) : (
              <button
                onClick={() => onToggleFriend()}
                className={`flex-1 md:flex-none px-6 py-2.5 text-[13px] font-[1000] rounded-xl border transition-all ${isFriend ? 'bg-white text-slate-400 border-slate-200' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
              >
                {isFriend ? '깐부해제' : '+ 깐부맺기'}
              </button>
            )}
          </div>
        </div>

        {/* 하단 통계 텍스트 */}
        <div className="flex items-center justify-between text-[13px] font-bold text-slate-500 pt-2 px-2">
          {/* 좌: 댓글 / 연계글 */}
          <div className="flex gap-4">
            <span>댓글 <span className="font-black text-slate-700">{formatKoreanNumber(totalComment)}</span></span>
            {CATEGORY_RULES[post.category || ""]?.allowFormal && (
              <span>연계글 <span className="font-black text-slate-700">{formatKoreanNumber(totalFormal)}</span></span>
            )}
          </div>

          {/* 우: 동의 / 비동의 */}
          <div className="flex gap-4">
            {CATEGORY_RULES[post.category || ""]?.allowDisagree && (
              <>
                <span>동의 <span className="font-black text-slate-700">{formatKoreanNumber(uniqueAgreeCount)}</span></span>
                <span>{CATEGORY_RULES[post.category || ""]?.boardType === 'pandora' ? '반박' : '비동의'} <span className="font-black text-slate-700">{formatKoreanNumber(uniqueDisagreeCount)}</span></span>
              </>
            )}
          </div>
        </div>

        {/* 땡스볼 모달 */}
        {showThanksball && currentNickname && (
          <ThanksballModal
            postId={post.id}
            postAuthor={post.author}
            postTitle={post.title}
            currentNickname={currentNickname}
            allUsers={allUsers}
            onClose={() => setShowThanksball(false)}
          />
        )}
      </div>
    </section>
  );
};

export default RootPostCard;
