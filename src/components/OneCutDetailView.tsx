// src/components/OneCutDetailView.tsx — 한컷 상세 뷰 (마법 수정 구슬 레이아웃 기반)
import { useState, useEffect, useRef } from 'react';
import type { Post, UserData } from '../types';
import { formatKoreanNumber, getReputationLabel } from '../utils';
import OneCutListSidebar from './OneCutListSidebar';
import ThanksballModal from './ThanksballModal';
import { db } from '../firebase';
import { doc, deleteDoc, updateDoc, increment } from 'firebase/firestore';

interface Props {
  rootPost: Post;
  allPosts: Post[];
  otherTopics: Post[];
  onTopicChange: (post: Post) => void;
  userData?: UserData | null;
  onInlineReply: (content: string, parentPost: Post | null, side?: 'left' | 'right') => Promise<void>;
  onLikeClick?: (e: React.MouseEvent | null, postId: string) => void;
  currentNickname?: string;
  allUsers?: Record<string, UserData>;
  followerCounts?: Record<string, number>;
  commentCounts?: Record<string, number>;
  onEditPost?: (post: Post) => void;
  onBack?: () => void;
  isFriend?: boolean;
  onToggleFriend?: () => void;
}

const OneCutDetailView = ({
  rootPost, allPosts, otherTopics, onTopicChange,
  onInlineReply, onLikeClick, currentNickname, allUsers = {}, followerCounts = {},
  commentCounts = {}, onEditPost, onBack, isFriend, onToggleFriend
}: Props) => {
  const [imageError, setImageError] = useState(false);
  // 🚀 댓글 입력 내부 상태 — "공감해요(left) / 공감하기 힘들어요(right)"
  const [selectedSide, setSelectedSide] = useState<'left' | 'right'>('left');
  const [inputValue, setInputValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  // 공유 URL 복사 피드백
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // 아바타 라인 상태
  const [showThanksball, setShowThanksball] = useState(false);
  const [showSelfMsg, setShowSelfMsg] = useState(false);
  // 댓글 입력창 표시 여부 — 버튼 클릭 시 열림
  const [inputVisible, setInputVisible] = useState(false);
  // 댓글 수정 상태
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  // 댓글 땡스볼 대상
  const [thanksballCommentTarget, setThanksballCommentTarget] = useState<{ docId: string; recipient: string } | null>(null);

  useEffect(() => { setImageError(false); setInputValue(''); setSelectedSide('left'); setInputVisible(false); }, [rootPost.id]);

  const authorData = (rootPost.author_id && allUsers[rootPost.author_id]) || allUsers[`nickname_${rootPost.author}`];
  const realFollowers = followerCounts[rootPost.author] || 0;
  const displayLevel = authorData ? authorData.level : (rootPost.authorInfo?.level || 1);
  const displayLikes = authorData ? authorData.likes : (rootPost.authorInfo?.totalLikes || 0);
  const isLikedByMe = currentNickname && rootPost.likedBy?.includes(currentNickname);
  const isMyPost = !!currentNickname && rootPost.author === currentNickname;
  const pinnedCommentId = rootPost.pinnedCommentId;

  // 공유 URL 복사 — RootPostCard와 동일 방식
  const handleCopyUrl = () => {
    const shareToken = rootPost.id.split('_').slice(0, 2).join('_');
    const shareUrl = `${window.location.origin}?post=${shareToken}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const formatTime = (timestamp: { seconds: number } | null | undefined) => {
    if (!timestamp) return "";
    const d = new Date(timestamp.seconds * 1000);
    const diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return "방금 전";
    if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
    return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const submitComment = async () => {
    if (!inputValue.trim() || isSubmitting || !currentNickname) return;
    setIsSubmitting(true);
    try {
      await onInlineReply(inputValue.trim(), null, selectedSide);
      setInputValue('');
      setInputVisible(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 댓글 삭제 — comments 컬렉션 + 루트 글 commentCount 차감
  const handleDeleteComment = async (comment: Post) => {
    if (!window.confirm('댓글을 삭제하시겠습니까?')) return;
    await deleteDoc(doc(db, 'comments', comment.id));
    await updateDoc(doc(db, 'posts', rootPost.id), { commentCount: increment(-1) });
  };

  // 댓글 수정 저장
  const handleEditSave = async (comment: Post) => {
    if (!editContent.trim()) return;
    await updateDoc(doc(db, 'comments', comment.id), { content: editContent.trim() });
    setEditingCommentId(null);
    setEditContent('');
  };

  // 댓글 고정 토글 — 글 작성자만 가능
  const handlePin = async (commentId: string) => {
    const current = rootPost.pinnedCommentId;
    await updateDoc(doc(db, 'posts', rootPost.id), {
      pinnedCommentId: current === commentId ? null : commentId,
    });
  };

  // 댓글 목록: 최상위 댓글, 시간 오름차순
  const topComments = allPosts
    .filter(p => p.parentId === p.rootId)
    .sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));

  const agreeCount = allPosts.filter(p => p.side === 'left').length;
  const disagreeCount = allPosts.filter(p => p.side === 'right').length;

  const sideOneCuts = otherTopics.filter(t => (t.isOneCut || t.category === "한컷") && t.id !== rootPost.id);

  // 🚀 원본글 연결: linkedPostId로 내부 게시글 찾기 (연계글 작성 시 저장됨)
  const linkedPost = rootPost.linkedPostId
    ? otherTopics.find(p => p.id === rootPost.linkedPostId)
    : null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 w-full max-w-[1600px] mx-auto animate-in fade-in duration-700 items-start pb-20">

      {/* 메인 컬럼 */}
      <div className="col-span-1 md:col-span-9 flex flex-col">
        <section className="rounded-none flex flex-col mb-0 bg-white">

          {/* 헤더: ← 한컷 / 경과시간 / 공유 / 수정·삭제 */}
          <div className="flex-1 flex flex-col pt-8 px-4 md:px-8 pb-4">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <span
                  onClick={onBack}
                  className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-sm uppercase tracking-widest cursor-pointer hover:bg-blue-100 hover:text-blue-700 hover:-translate-x-0.5 transition-all duration-150 select-none"
                  title="한컷 목록으로 돌아가기"
                >
                  ← 한컷
                </span>
                <span className="text-[11px] font-bold text-slate-400">{formatTime(rootPost.createdAt)}</span>
              </div>
              <div className="flex items-center gap-3">
                {/* 공유 버튼 */}
                <button
                  onClick={handleCopyUrl}
                  className={`flex items-center gap-1 text-[11px] font-bold transition-colors ${copied ? 'text-emerald-500' : 'text-slate-400 hover:text-blue-500'}`}
                  title="이 글의 링크를 복사합니다"
                >
                  {copied ? (
                    <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"/></svg>복사됨</>
                  ) : (
                    <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>공유</>
                  )}
                </button>
                {isMyPost && (
                  <>
                    <button onClick={() => onEditPost?.(rootPost)} className="text-[11px] font-bold text-slate-400 hover:text-blue-500 transition-colors">수정</button>
                  </>
                )}
              </div>
            </div>

            {/* 제목 */}
            <h2 className="text-[22px] font-[1000] mb-5 leading-snug tracking-tighter max-w-4xl text-slate-900">
              {rootPost.title}
            </h2>

            {/* 원본글 바로가기 — linkedPostId(내부) 또는 linkUrl(외부) */}
            {linkedPost && (
              <button
                onClick={() => onTopicChange(linkedPost)}
                className="group flex items-center gap-2 mb-5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all shadow-sm w-fit max-w-full"
              >
                <span className="text-sm">🔗</span>
                <span className="text-[12px] font-[1000] truncate">원본글: {linkedPost.title}</span>
                <svg className="w-3.5 h-3.5 shrink-0 opacity-80 group-hover:translate-x-0.5 transition-transform ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
              </button>
            )}
            {!linkedPost && rootPost.linkUrl && (
              <a
                href={rootPost.linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-2 mb-5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all shadow-sm w-fit max-w-full"
              >
                <span className="text-sm">🔗</span>
                <span className="text-[12px] font-[1000] truncate">원본글 바로가기</span>
                <svg className="w-3.5 h-3.5 shrink-0 opacity-80 group-hover:translate-x-0.5 transition-transform ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
              </a>
            )}

            {/* 이미지 — 본문 위 배치, 2/3 너비 */}
            {rootPost.imageUrl && !imageError && (
              <div className="w-full md:w-2/3 mb-5 rounded-2xl overflow-hidden border border-slate-100 bg-slate-50">
                <img
                  src={rootPost.imageUrl}
                  alt="한컷"
                  className="w-full h-auto object-contain max-h-[600px]"
                  onError={() => setImageError(true)}
                />
              </div>
            )}

            {/* 본문 텍스트 */}
            {rootPost.content && rootPost.content.trim() ? (
              <div className="text-[15px] mb-6 leading-[1.8] font-medium text-slate-700 max-w-none [&_p]:mb-4 [&_p:last-child]:mb-0 whitespace-pre-wrap">
                {rootPost.content}
              </div>
            ) : null}

            {/* 태그 */}
            {(rootPost.tags || []).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-5">
                {(rootPost.tags || []).map((tag, i) => (
                  <span key={i} className="text-[10px] font-black text-blue-500 bg-blue-50/50 px-2 py-0.5 rounded-[2px] border border-blue-100/30">#{tag}</span>
                ))}
              </div>
            )}
          </div>

          {/* 🚀 작성자 정보 + 인터랙션 바 — RootPostCard 박스 스타일 */}
          <div className="border-t border-slate-100 px-4 md:px-8 py-4">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 border border-slate-100 rounded-2xl bg-slate-50/30">
              {/* 좌: 아바타 + 이름 + 레벨 */}
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-slate-100 overflow-hidden border border-slate-200 shrink-0">
                  <img src={authorData?.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${rootPost.author}`} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="flex flex-col">
                  <span className="font-[1000] text-[15px] text-slate-900 mb-0.5">{rootPost.author}</span>
                  <span className="text-[11px] text-slate-500 font-bold">
                    Lv {displayLevel} · {getReputationLabel(displayLikes)} · 깐부 {formatKoreanNumber(realFollowers)}
                  </span>
                </div>
              </div>
              {/* 우: 좋아요 + 땡스볼 + 깐부 */}
              <div className="flex items-center gap-2 w-full md:w-auto">
                <button
                  onClick={() => onLikeClick?.(null, rootPost.id)}
                  className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl transition-all duration-300 font-[1000] text-[12px] whitespace-nowrap ${isLikedByMe ? 'bg-[#FF2E56] text-white ring-2 ring-rose-300 scale-105' : 'bg-white text-rose-400 border border-rose-200 hover:bg-rose-50'}`}
                >
                  <svg className="w-3.5 h-3.5 fill-current shrink-0" viewBox="0 0 24 24" stroke="none"><path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" /></svg>
                  {formatKoreanNumber(rootPost.likes || 0)}
                </button>
                <button
                  onClick={() => { if (!isMyPost && currentNickname) setShowThanksball(true); }}
                  title={isMyPost ? '본인 글에는 땡스볼을 보낼 수 없습니다' : (currentNickname ? '땡스볼 보내기' : '로그인 후 이용하세요')}
                  className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-[12px] font-[1000] whitespace-nowrap transition-all ${isMyPost || !currentNickname ? 'bg-white text-slate-300 border-slate-200 cursor-default' : 'bg-white text-amber-500 border-amber-200 hover:bg-amber-50 cursor-pointer'}`}
                >
                  <span className="text-[14px] leading-none">⚾</span>
                  <span>{(rootPost.thanksballTotal || 0) > 0 ? `${rootPost.thanksballTotal}볼` : '땡스볼'}</span>
                </button>
                {isMyPost ? (
                  <div className="flex-1 md:flex-none flex flex-col items-center gap-1">
                    <button
                      onClick={() => { setShowSelfMsg(true); setTimeout(() => setShowSelfMsg(false), 1000); }}
                      className="w-full md:w-auto px-3 py-2 text-[12px] font-[1000] rounded-xl border bg-white text-slate-300 border-slate-200 cursor-default whitespace-nowrap"
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
                    onClick={() => onToggleFriend?.()}
                    className={`flex-1 md:flex-none px-3 py-2 text-[12px] font-[1000] rounded-xl border transition-all whitespace-nowrap ${isFriend ? 'bg-white text-slate-400 border-slate-200' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                  >
                    {isFriend ? '깐부해제' : '+ 깐부맺기'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 땡스볼 모달 */}
          {showThanksball && currentNickname && (
            <ThanksballModal
              postId={rootPost.id}
              postAuthor={rootPost.author}
              postTitle={rootPost.title}
              currentNickname={currentNickname}
              allUsers={allUsers}
              onClose={() => setShowThanksball(false)}
            />
          )}

          {/* 🚀 댓글 목록 — pandora 좌우 지그재그 스타일 */}
          {topComments.length > 0 && (
            <div className="border-t border-slate-100">
              {/* 공감 통계 헤더 */}
              <div className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-100">
                <span className="flex items-center gap-1.5 text-[11px] font-bold">
                  <span className="w-2 h-2 bg-blue-400 rounded-full" />
                  <span className="text-blue-600">👍 공감해요 {agreeCount}</span>
                </span>
                <span className="text-slate-200">·</span>
                <span className="flex items-center gap-1.5 text-[11px] font-bold">
                  <span className="w-2 h-2 bg-rose-400 rounded-full" />
                  <span className="text-rose-500">👎 공감하기 힘들어요 {disagreeCount}</span>
                </span>
              </div>

              {/* 지그재그 댓글 카드 */}
              <div className="flex flex-col gap-2.5 px-4 py-4">
                {topComments.map(comment => {
                  const isLeft = comment.side === 'left';
                  const isPinned = comment.id === pinnedCommentId;
                  const isLiked = !!(currentNickname && (comment.likedBy || []).includes(currentNickname));
                  const commentAuthorData = (comment.author_id && allUsers[comment.author_id]) || allUsers[`nickname_${comment.author}`];
                  const commentLevel = commentAuthorData ? commentAuthorData.level : (comment.authorInfo?.level || 1);
                  const commentLikes = commentAuthorData ? commentAuthorData.likes : (comment.authorInfo?.totalLikes || 0);
                  const commentFollowers = followerCounts[comment.author] || 0;
                  const isMyComment = comment.author === currentNickname;
                  const isEditing = editingCommentId === comment.id;
                  return (
                    <div key={comment.id} className={`flex ${isLeft ? 'justify-start' : 'justify-end'}`}>
                      <div className={`w-[84%] rounded-xl border px-4 py-3 transition-all ${
                        isPinned
                          ? 'bg-amber-50 border-amber-200 ring-1 ring-amber-300'
                          : isLeft ? 'bg-blue-50 border-blue-100' : 'bg-rose-50 border-rose-100'
                      }`}>
                        {isPinned && (
                          <div className="text-[10px] font-black text-amber-600 mb-1.5 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>
                            작성자가 고정한 댓글
                          </div>
                        )}
                        {/* 헤더: 아바타 + 이름/레벨/평판/깐부 + 액션 버튼들 */}
                        <div className={`flex items-center justify-between mb-2 ${!isLeft ? 'flex-row-reverse' : ''}`}>
                          <div className={`flex items-center gap-2 ${!isLeft ? 'flex-row-reverse' : ''}`}>
                            <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 border border-slate-200">
                              <img src={commentAuthorData?.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${comment.author}`} alt="" className="w-full h-full object-cover" />
                            </div>
                            <div className={`flex flex-col ${!isLeft ? 'items-end' : ''}`}>
                              <div className="flex items-center gap-2">
                                <span className={`font-black text-[12px] leading-none ${isLeft ? 'text-blue-800' : 'text-rose-800'}`}>{comment.author}</span>
                                <span className="text-[9px] font-bold text-slate-300">{formatTime(comment.createdAt)}</span>
                              </div>
                              <span className="text-[9px] text-slate-400 font-bold leading-tight mt-0.5">
                                Lv {commentLevel} · {getReputationLabel(commentLikes)} · 깐부 {formatKoreanNumber(commentFollowers)}
                              </span>
                            </div>
                          </div>
                          {/* 액션: 고정(작성자) + 좋아요 + 땡스볼(작성자) + 수정/삭제(본인) */}
                          <div className="flex items-center gap-2">
                            {isMyPost && (
                              <button onClick={() => handlePin(comment.id)}
                                title={isPinned ? '고정 해제' : '댓글 고정'}
                                className={`text-[10px] transition-colors ${isPinned ? 'text-amber-500' : 'text-slate-300 hover:text-amber-400'}`}>
                                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>
                              </button>
                            )}
                            <button onClick={e => { e.stopPropagation(); onLikeClick?.(e, comment.id); }}
                              className={`flex items-center gap-1 text-[11px] font-bold transition-colors ${isLiked ? 'text-rose-500' : 'text-slate-300 hover:text-rose-400'}`}>
                              <svg className={`w-3 h-3 ${isLiked ? 'fill-current' : 'fill-none'}`} stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                              {comment.likes || 0}
                            </button>
                            {(comment.thanksballTotal || 0) > 0 && (
                              <span className="flex items-center gap-0.5 text-[11px] font-bold text-amber-400">
                                <span className="text-[13px] leading-none">⚾</span>{comment.thanksballTotal}
                              </span>
                            )}
                            {currentNickname && comment.author !== currentNickname && (
                              <button onClick={e => { e.stopPropagation(); setThanksballCommentTarget({ docId: comment.id, recipient: comment.author }); }}
                                className="flex items-center gap-1 text-[11px] font-bold text-slate-300 hover:text-amber-500 transition-colors" title="땡스볼 보내기">
                                <span className="text-[13px] leading-none">⚾</span>
                              </button>
                            )}
                            {isMyComment && !isEditing && (
                              <>
                                <button onClick={() => { setEditingCommentId(comment.id); setEditContent(comment.content); }}
                                  className="text-[9px] font-bold text-slate-300 hover:text-blue-400 transition-colors">수정</button>
                                <button onClick={() => handleDeleteComment(comment)}
                                  className="text-[9px] font-bold text-slate-300 hover:text-rose-400 transition-colors">삭제</button>
                              </>
                            )}
                          </div>
                        </div>
                        {/* 본문 or 수정 textarea */}
                        {isEditing ? (
                          <div className="flex flex-col gap-1.5">
                            <textarea value={editContent} onChange={e => setEditContent(e.target.value)}
                              className="w-full bg-white border border-blue-200 rounded-lg px-3 py-2 text-[13px] font-bold text-slate-700 outline-none focus:border-blue-400 resize-none h-20" />
                            <div className="flex justify-end gap-2">
                              <button onClick={() => { setEditingCommentId(null); setEditContent(''); }}
                                className="px-3 py-1 text-[10px] font-bold text-slate-400 hover:text-slate-600 transition-colors">취소</button>
                              <button onClick={() => handleEditSave(comment)} disabled={!editContent.trim()}
                                className="px-3 py-1 text-[10px] font-bold bg-blue-500 hover:bg-blue-600 text-white rounded-md disabled:opacity-50 transition-colors">저장</button>
                            </div>
                          </div>
                        ) : (
                          <p className={`text-[13px] font-medium leading-relaxed whitespace-pre-line ${isLeft ? 'text-blue-900' : 'text-rose-900 text-right'}`}>
                            {comment.content}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 댓글 땡스볼 모달 */}
          {thanksballCommentTarget && currentNickname && (
            <ThanksballModal
              postId={rootPost.id}
              postAuthor={rootPost.author}
              postTitle={rootPost.title}
              recipientNickname={thanksballCommentTarget.recipient}
              targetDocId={thanksballCommentTarget.docId}
              targetCollection="comments"
              currentNickname={currentNickname}
              allUsers={allUsers}
              onClose={() => setThanksballCommentTarget(null)}
            />
          )}

          {/* 🚀 댓글 입력 — 댓글 목록 아래 배치, pandora 패턴 */}
          <div className="border-t border-slate-100">
            {currentNickname ? (
              inputVisible ? (
                <div className={`flex flex-col gap-2.5 px-4 py-3 ${selectedSide === 'left' ? 'bg-blue-50 border-blue-100' : 'bg-rose-50 border-rose-100'}`}>
                  <span className={`text-[11px] font-bold ${selectedSide === 'left' ? 'text-blue-400' : 'text-rose-400'}`}>
                    {selectedSide === 'left' ? '공감하는 댓글을 적어 주세요' : '공감하기 힘든 댓글을 적어 주세요'}
                  </span>
                  <textarea
                    ref={inputRef}
                    value={inputValue}
                    onChange={e => setInputValue(e.target.value)}
                    disabled={isSubmitting}
                    placeholder={selectedSide === 'left' ? '공감하는 이유를 남겨주세요...' : '공감하기 힘든 이유를 남겨주세요...'}
                    className={`w-full bg-white rounded-lg px-3 py-2 text-[13px] font-bold text-slate-700 outline-none resize-none transition-all h-24 ${selectedSide === 'left' ? 'border border-blue-200 focus:border-blue-400' : 'border border-rose-200 focus:border-rose-400'}`}
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button type="button" onClick={() => { setInputVisible(false); setInputValue(''); }}
                      className="px-3 py-1.5 text-[11px] font-bold text-slate-400 hover:text-slate-600 rounded-md transition-colors">취소</button>
                    <button type="button" onClick={submitComment} disabled={isSubmitting || !inputValue.trim()}
                      className={`px-3 py-1.5 text-[11px] font-bold text-white rounded-md disabled:opacity-50 transition-colors ${selectedSide === 'left' ? 'bg-blue-500 hover:bg-blue-600' : 'bg-rose-500 hover:bg-rose-600'}`}>댓글 달기</button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2 px-4 py-3">
                  <button type="button"
                    onClick={() => { setSelectedSide('left'); setInputVisible(true); setTimeout(() => inputRef.current?.focus(), 50); }}
                    className="flex-1 py-2.5 rounded-xl text-[12px] font-[1000] bg-blue-50 text-blue-500 hover:bg-blue-100 border border-blue-100 transition-all">👍 공감해요 댓글...</button>
                  <button type="button"
                    onClick={() => { setSelectedSide('right'); setInputVisible(true); setTimeout(() => inputRef.current?.focus(), 50); }}
                    className="flex-1 py-2.5 rounded-xl text-[12px] font-[1000] bg-rose-50 text-rose-500 hover:bg-rose-100 border border-rose-100 transition-all">👎 공감하기 힘들어요 댓글...</button>
                </div>
              )
            ) : (
              <p className="text-center text-[12px] font-bold text-slate-400 py-4">로그인 후 댓글을 남길 수 있습니다</p>
            )}
          </div>

        </section>
      </div>

      {/* 우측: 다른 한컷 목록 */}
      <OneCutListSidebar
        oneCuts={sideOneCuts}
        onOneCutClick={onTopicChange}
        commentCounts={commentCounts}
        allUsers={allUsers}
        followerCounts={followerCounts}
      />
    </div>
  );
};

export default OneCutDetailView;
