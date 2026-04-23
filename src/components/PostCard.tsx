// src/components/PostCard.tsx
import { useState } from 'react';
import { db } from '../firebase';
import { doc, deleteDoc, updateDoc } from 'firebase/firestore';
import type { Post, UserData } from '../types';
import { formatKoreanNumber, getReputationLabel, getReputation, calculateLevel } from '../utils';
import { sanitizeHtml, extractText } from '../sanitize';
import { handleReport } from '../utils/reportHandler';

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
  onAuthorClick?: (nickname: string) => void;
}

const PostCard = ({
  post, onReply, onPostClick,
  onLikeClick, currentNickname, allUsers = {}, followerCounts = {},
  isPinned, isRootAuthor, onPin, onThanksball, onAuthorClick
}: Props) => {
  const [showMenu, setShowMenu] = useState(false);
  const isMyPost = post.author === currentNickname;
  const isLikedByMe = currentNickname && post.likedBy?.includes(currentNickname);
  const [isEditing, setIsEditing] = useState(false);
  // HTML 태그 제거 후 편집용 plain text 추출
  const [editContent, setEditContent] = useState(() => {
    return extractText(post.content);
  });

  // 🚀 실시간 사용자 데이터 바인딩
  const authorData = (post.author_id && allUsers[post.author_id]) || allUsers[`nickname_${post.author}`];
  const realFollowers = followerCounts[post.author] || 0;
  const displayLevel = calculateLevel(authorData?.exp || 0);
  const displayLikes = authorData ? authorData.likes : (post.authorInfo?.totalLikes || 0);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("정말 삭제하시겠소?")) {
      try {
        const col = post.rootId ? 'comments' : 'posts';
        await deleteDoc(doc(db, col, post.id));
        // 🛡️ Anti-Abuse Commit 5a: 삭제 시 exp 감소 제거
        // Why: Rules가 exp 감소 차단. Phase B CF 이관 예정 (§5.2.2)
      } catch (e) { console.error(e); }
    }
  };

  const handleEditSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editContent.trim()) return;
    try {
      const col = post.rootId ? 'comments' : 'posts';
      await updateDoc(doc(db, col, post.id), { content: editContent });
      setIsEditing(false);
    } catch (e) { console.error(e); }
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
          <img src={authorData?.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${post.author}`} alt="" className="w-full h-full object-cover" />
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
                Lv {displayLevel} · {getReputationLabel(authorData ? getReputation(authorData) : displayLikes)} · 깐부수 {formatKoreanNumber(realFollowers)}
              </span>
            </div>
            {/* 🚀 아바타 라인 우측: 좋아요 · 땡스볼 · 답글 · 수정 · 삭제 · 핀 */}
            <div className="flex items-center gap-2 shrink-0">
              {isPinned && (
                <span className="text-[9px] font-black text-amber-500 flex items-center gap-0.5">
                  <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>
                  고정
                </span>
              )}
              {/* 좋아요 */}
              <button
                onClick={(e) => { e.stopPropagation(); onLikeClick?.(e, post.id); }}
                className={`flex items-center gap-1 text-[10.5px] font-black transition-colors ${isLikedByMe ? 'text-rose-500' : 'text-slate-300 hover:text-rose-400'}`}
              >
                <svg className={`w-3.5 h-3.5 ${isLikedByMe ? 'fill-current' : 'fill-none'}`} stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
                {formatKoreanNumber(post.likes || 0)}
              </button>
              {/* 땡스볼 버튼 — 로그인 유저가 본인 댓글 제외하고 누구에게나 */}
              {!isMyPost && onThanksball ? (
                <button
                  onClick={(e) => { e.stopPropagation(); onThanksball(post); }}
                  className="flex items-center gap-0.5 text-[10.5px] font-black text-slate-300 hover:text-amber-500 transition-colors"
                  title="땡스볼 보내기"
                >
                  <span className="text-[11px] leading-none">⚾</span>
                  {(post.thanksballTotal || 0) > 0 && <span className="text-amber-400">{post.thanksballTotal}</span>}
                </button>
              ) : (post.thanksballTotal || 0) > 0 ? (
                <span className="flex items-center gap-0.5 text-[10.5px] font-black text-amber-400">
                  <span className="text-[11px] leading-none">⚾</span>
                  {post.thanksballTotal}
                </span>
              ) : null}
              {/* 답글 */}
              <button
                onClick={(e) => { e.stopPropagation(); onReply(post); }}
                className="flex items-center gap-1 text-[10.5px] font-black text-slate-300 hover:text-blue-500 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                답글
              </button>
              {/* 수정 — 댓글 작성자 본인만 */}
              {isMyPost && currentNickname && (
                <button
                  onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
                  className="text-[10.5px] font-bold text-slate-300 hover:text-blue-500 transition-colors"
                >수정</button>
              )}
              {/* 삭제 — 댓글 작성자 본인만 */}
              {isMyPost && currentNickname && (
                <button onClick={handleDelete} className="text-slate-300 hover:text-rose-500 transition-colors" title="삭제">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h14" /></svg>
                </button>
              )}
              {/* 핀 고정 — 글 작성자만 */}
              {isRootAuthor && onPin && (
                <button onClick={(e) => { e.stopPropagation(); onPin(); }}
                  className={`p-0.5 transition-all ${isPinned ? 'text-amber-400 hover:text-slate-400' : 'text-slate-300 hover:text-amber-400'}`}
                  title={isPinned ? '고정 해제' : '댓글 고정'}
                >
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>
                </button>
              )}
              {/* 🚀 ⋯ 메뉴 */}
              <div className="relative">
                <button onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
                  className="text-slate-300 hover:text-slate-500 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
                </button>
                {showMenu && (
                  <div className="absolute right-0 bottom-5 z-50 bg-white border border-slate-200 rounded-lg shadow-md py-0.5 w-28 animate-in fade-in duration-150" onMouseLeave={() => setShowMenu(false)}>
                    <button onClick={(e) => { e.stopPropagation(); setShowMenu(false); onAuthorClick?.(post.author); }}
                      className="w-full text-left px-2.5 py-0.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50">공개프로필 보기</button>
                    <button onClick={(e) => {
                        e.stopPropagation(); setShowMenu(false);
                        handleReport(post.rootId ? 'comment' : 'post', post.id);
                      }}
                      className="w-full text-left px-2.5 py-0.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50">🚨 신고하기</button>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {post.type === 'formal' && post.title && (
            <h4 className="font-black text-[13.5px] text-blue-600 leading-tight tracking-tight mt-0.5">📝 {post.title}</h4>
          )}
          
          {/* 본문 또는 인라인 수정 폼 */}
          {isEditing ? (
            <div className="flex flex-col gap-2" onClick={e => e.stopPropagation()}>
              <textarea
                autoFocus
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                rows={3}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[13px] font-medium text-slate-700 outline-none focus:border-blue-400 resize-none"
              />
              <div className="flex gap-2 justify-end">
                <button onClick={() => setIsEditing(false)} className="px-3 py-1 text-[11px] font-bold text-slate-400 hover:text-slate-600 rounded-md">취소</button>
                <button onClick={handleEditSave} disabled={!editContent.trim()} className="px-3 py-1 text-[11px] font-bold bg-slate-900 text-white rounded-md hover:bg-blue-600 disabled:opacity-50">저장</button>
              </div>
            </div>
          ) : (
            <div
              className="text-[13.5px] text-slate-700 leading-relaxed font-medium break-words line-clamp-3 prose-compact"
              dangerouslySetInnerHTML={{
                __html: sanitizeHtml(
                  // 🖋️ 잉크병 유료 회차는 content가 빈 문자열 → previewContent(평문 200자) fallback
                  (post.category === 'magic_inkwell' && post.isPaid && !post.content && post.previewContent)
                    ? `<p>${post.previewContent}</p>`
                    : post.content
                ),
              }}
            />
          )}

          <style>{`
            .prose-compact img { display: none; } /* 목록에서는 이미지를 숨겨 쾌적함 유지 */
            .prose-compact p { margin: 0; display: inline; }
            .prose-compact h1, .prose-compact h2 { font-size: 13.5px; font-weight: 900; display: inline; }
          `}</style>

          {/* 🚀 카테고리 정보 노출 (댓글/연계글 타입) */}
          {post.category && (
            <span className="text-[8px] font-black text-blue-400/60 uppercase tracking-widest">
              {post.category === 'magic_inkwell' ? '마르지 않는 잉크병' : post.category}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default PostCard;
