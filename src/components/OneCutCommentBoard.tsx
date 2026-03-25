// src/components/OneCutCommentBoard.tsx — 황금알을 낳는 거위 댓글: 작성자(좌) ↔ 독자(우) 지그재그 채팅형
// 🚀 좌=작성자(side:'left') / 우=독자(side:'right') — currentNickname vs rootPost.author로 자동 결정
// 🚀 고정·땡스볼: 독자 댓글(우)에만 허용 / 독자는 작성자 댓글에 대댓글 가능

import { useState } from 'react';
import ThanksballModal from './ThanksballModal';
import type { Post } from '../types';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { formatKoreanNumber, getReputationLabel } from '../utils';

interface Props {
  allChildPosts: Post[];
  rootPost: Post;
  currentNickname?: string;
  currentUserData?: any;
  onLikeClick?: (e: any, postId: string) => void;
  onInlineReply?: (content: string, parentPost: Post | null, side?: 'left' | 'right') => Promise<void>;
  allUsers?: Record<string, any>;
  followerCounts?: Record<string, number>;
}

const OneCutCommentBoard = ({
  allChildPosts, rootPost, currentNickname,
  onLikeClick, onInlineReply, allUsers = {}, followerCounts = {},
}: Props) => {
  // 현재 유저가 글 작성자인지 여부
  const isRootAuthor = !!(currentNickname && rootPost.author === currentNickname);

  const [inputContent, setInputContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 독자 → 작성자 댓글 대댓글 상태
  const [replyTarget, setReplyTarget] = useState<Post | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [isReplySubmitting, setIsReplySubmitting] = useState(false);

  // 땡스볼 모달 (작성자 → 독자 댓글에 발송)
  const [thanksballTarget, setThanksballTarget] = useState<{ docId: string; recipient: string } | null>(null);

  const pinnedCommentId = rootPost.pinnedCommentId;

  const formatTime = (ts: any) => {
    if (!ts) return '';
    const d = new Date(ts.seconds * 1000);
    const diff = Math.floor((Date.now() - d.getTime()) / 60000);
    if (diff < 1) return '방금';
    if (diff < 60) return `${diff}분 전`;
    if (diff < 1440) return `${Math.floor(diff / 60)}시간 전`;
    return d.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' });
  };

  // 독자 댓글(우)에만 핀 허용 — 작성자만 가능
  const handlePin = async (commentId: string) => {
    if (!rootPost || !isRootAuthor) return;
    const newPinned = pinnedCommentId === commentId ? '' : commentId;
    await updateDoc(doc(db, 'posts', rootPost.id), { pinnedCommentId: newPinned });
  };

  // 최상위 댓글만 추출 (parentId === rootId)
  const topLevelComments = allChildPosts.filter(p => p.parentId === p.rootId);

  // 고정 댓글 맨 앞, 나머지 시간 오름차순 (오래된 것부터)
  const sortedComments = [...topLevelComments].sort((a, b) => {
    if (a.id === pinnedCommentId) return -1;
    if (b.id === pinnedCommentId) return 1;
    return (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0);
  });

  // 특정 댓글에 달린 대댓글 조회
  const getReplies = (id: string) => allChildPosts.filter(p => p.parentId === id);

  const authorCount = topLevelComments.filter(p => p.side === 'left').length;
  const readerCount = topLevelComments.filter(p => p.side === 'right').length;

  // 최상위 댓글 제출 — side 자동 결정
  const handleSubmit = async () => {
    if (!inputContent.trim() || isSubmitting || !currentNickname) return;
    const side: 'left' | 'right' = isRootAuthor ? 'left' : 'right';
    setIsSubmitting(true);
    try {
      await onInlineReply?.(inputContent.trim(), null, side);
      setInputContent('');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 독자 → 작성자 댓글 대댓글 제출 (항상 right)
  const handleReplySubmit = async (parentPost: Post) => {
    if (!replyContent.trim() || isReplySubmitting || !currentNickname) return;
    setIsReplySubmitting(true);
    try {
      await onInlineReply?.(replyContent.trim(), parentPost, 'right');
      setReplyContent('');
      setReplyTarget(null);
    } finally {
      setIsReplySubmitting(false);
    }
  };

  return (
    <div className="flex flex-col bg-white">

      {/* 🚀 2컬럼 헤더: 좌=정보취득자(blue), 우=정보제공자(rose) */}
      <div className="flex border-b border-slate-100 sticky top-0 z-10 bg-white">
        <div className="flex-1 py-3 flex flex-col items-center gap-0.5 border-r border-slate-100">
          <span className="text-[11px] font-[1000] text-blue-600">정보취득자</span>
          <span className="text-[9px] font-bold text-slate-300">댓글 {readerCount}</span>
        </div>
        <div className="flex-1 py-3 flex flex-col items-center gap-0.5">
          <span className="text-[11px] font-[1000] text-rose-500">정보제공자</span>
          <span className="text-[9px] font-bold text-slate-300">댓글 {authorCount}</span>
        </div>
      </div>

      {/* 🚀 댓글 목록: 중앙 세로 구분선 + 시간순 지그재그 */}
      {/* side='right'(독자/취득자) → 좌측 blue / side='left'(작성자/제공자) → 우측 rose */}
      <div className="relative flex flex-col gap-3 py-4">
        {/* 세로 구분선 */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-100 z-0" style={{ transform: 'translateX(-50%)' }} />

        {sortedComments.length === 0 && <div className="py-6" />}

        {sortedComments.map(post => {
          const isAuthorComment = post.side === 'left'; // 작성자(정보제공자) → 우측
          const isPinned = post.id === pinnedCommentId;
          const isLiked = !!(currentNickname && (post.likedBy || []).includes(currentNickname));
          const replies = getReplies(post.id);
          const postAuthorData = (post.author_id && allUsers[post.author_id]) || allUsers[`nickname_${post.author}`];
          const displayLevel = postAuthorData ? postAuthorData.level : (post.authorInfo?.level || 1);
          const displayLikes = postAuthorData ? (postAuthorData.likes || postAuthorData.totalLikes || 0) : (post.authorInfo?.totalLikes || 0);
          const realFollowers = followerCounts?.[post.author] || 0;

          return (
            <div key={post.id} className="relative z-10 px-2">
              {/* 메인 댓글 카드 — 취득자:좌(justify-start) / 제공자:우(justify-end) */}
              <div className={`flex ${isAuthorComment ? 'justify-end' : 'justify-start'}`}>
                <div className={`w-[47%] rounded-2xl border px-3 py-3 transition-all ${
                  isPinned
                    ? 'bg-amber-50 border-amber-200 ring-1 ring-amber-200'
                    : isAuthorComment
                      ? 'bg-rose-50 border-rose-100'
                      : 'bg-blue-50 border-blue-100'
                }`}>

                  {/* 핀 배지 */}
                  {isPinned && (
                    <div className="text-[10px] font-black text-amber-600 mb-1.5 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>
                      고정
                    </div>
                  )}

                  {/* 아바타+정보(좌) ↔ 액션버튼(우) — DebateBoard 동일 구조 */}
                  <div className={`flex items-center justify-between mb-2 ${isAuthorComment ? 'flex-row-reverse' : ''}`}>
                    <div className={`flex items-center gap-2 ${isAuthorComment ? 'flex-row-reverse' : ''}`}>
                      <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 border border-slate-200">
                        <img src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${post.author}`} alt="" className="w-full h-full object-cover" />
                      </div>
                      <div className={`flex flex-col ${isAuthorComment ? 'items-end' : ''}`}>
                        <div className="flex items-center gap-2">
                          <span className={`font-black text-[12px] leading-none ${isAuthorComment ? 'text-rose-800' : 'text-blue-800'}`}>{post.author}</span>
                          <span className="text-[9px] font-bold text-slate-300">{formatTime(post.createdAt)}</span>
                        </div>
                        <span className="text-[9px] text-slate-400 font-bold leading-tight mt-0.5">
                          Lv {displayLevel} · {getReputationLabel(displayLikes)} · 깐부 {formatKoreanNumber(realFollowers)}
                        </span>
                      </div>
                    </div>

                    {/* 액션 버튼들 — 반대편 끝 */}
                    <div className="flex items-center gap-2">
                      {/* 핀: 작성자(isRootAuthor)만, 독자 댓글(!isAuthorComment)에만 */}
                      {isRootAuthor && !isAuthorComment && (
                        <button
                          onClick={() => handlePin(post.id)}
                          title={isPinned ? '고정 해제' : '댓글 고정'}
                          className={`text-[10px] transition-colors ${isPinned ? 'text-amber-500' : 'text-slate-300 hover:text-amber-400'}`}
                        >
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>
                        </button>
                      )}
                      {/* 좋아요 */}
                      <button
                        onClick={(e) => { e.stopPropagation(); onLikeClick?.(e, post.id); }}
                        className={`flex items-center gap-1 text-[11px] font-bold transition-colors ${isLiked ? 'text-rose-500' : 'text-slate-300 hover:text-rose-400'}`}
                      >
                        <svg className={`w-3 h-3 ${isLiked ? 'fill-current' : 'fill-none'}`} stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                        </svg>
                        {post.likes || 0}
                      </button>
                      {/* 땡스볼 수신 표시 */}
                      {(post.thanksballTotal || 0) > 0 && (
                        <span className="flex items-center gap-1 text-[11px] font-bold text-amber-400">
                          <span className="text-[13px] leading-none">⚾</span>
                          {post.thanksballTotal}
                        </span>
                      )}
                      {/* 땡스볼 보내기: 작성자(isRootAuthor)만, 독자 댓글(!isAuthorComment)에만 */}
                      {isRootAuthor && !isAuthorComment && post.author !== currentNickname && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setThanksballTarget({ docId: post.id, recipient: post.author }); }}
                          className="flex items-center gap-1 text-[11px] font-bold text-slate-300 hover:text-amber-500 transition-colors"
                          title="땡스볼 보내기"
                        >
                          <span className="text-[13px] leading-none">⚾</span>
                        </button>
                      )}
                      {/* 답글: 독자(!isRootAuthor)만, 작성자 댓글(isAuthorComment)에만 */}
                      {!isRootAuthor && isAuthorComment && currentNickname && (
                        <button
                          onClick={() => { setReplyTarget(prev => prev?.id === post.id ? null : post); setReplyContent(''); }}
                          className="text-[10px] font-black text-slate-300 hover:text-blue-500 transition-colors"
                        >
                          답글
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 본문 */}
                  <p className={`text-[13px] font-medium leading-relaxed whitespace-pre-line ${isAuthorComment ? 'text-rose-900 text-right' : 'text-blue-900'}`}>
                    {post.content}
                  </p>
                </div>
              </div>

              {/* 답글 폼: 우측 작성자 댓글 아래, 좌측(취득자쪽)에 표시 */}
              {replyTarget?.id === post.id && (
                <div className="mt-1.5 pr-[53%] pl-2">
                  <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl border border-slate-200">
                    <input
                      autoFocus
                      type="text"
                      value={replyContent}
                      onChange={e => setReplyContent(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleReplySubmit(post);
                      }}
                      placeholder={`${post.author}에게 답글...`}
                      className="flex-1 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[12px] font-bold text-slate-700 outline-none focus:border-slate-400 min-w-0"
                    />
                    <button onClick={() => { setReplyTarget(null); setReplyContent(''); }} className="text-[11px] font-bold text-slate-400 hover:text-slate-600 shrink-0">취소</button>
                    <button onClick={() => handleReplySubmit(post)} disabled={isReplySubmitting || !replyContent.trim()} className="px-2 py-1.5 text-[11px] font-bold bg-slate-900 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 shrink-0">달기</button>
                  </div>
                </div>
              )}

              {/* 대댓글 목록: 취득자쪽(좌)에 표시 */}
              {replies.length > 0 && (
                <div className="mt-1.5 pr-[53%] pl-2 flex flex-col gap-1.5">
                  {replies.map(reply => {
                    const isReplyLiked = !!(currentNickname && (reply.likedBy || []).includes(currentNickname));
                    const replyAuthorData = (reply.author_id && allUsers[reply.author_id]) || allUsers[`nickname_${reply.author}`];
                    const replyLevel = replyAuthorData ? replyAuthorData.level : (reply.authorInfo?.level || 1);
                    return (
                      <div key={reply.id} className="bg-white rounded-xl border border-slate-200 px-3 py-2">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div className="w-4 h-4 rounded-full overflow-hidden shrink-0 border border-slate-200">
                              <img src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${reply.author}`} alt="" className="w-full h-full object-cover" />
                            </div>
                            <span className="font-black text-[10px] text-slate-600 truncate">{reply.author}</span>
                            <span className="text-[9px] font-bold text-slate-300 shrink-0">Lv {replyLevel}</span>
                            <span className="text-[9px] font-bold text-slate-300 shrink-0">{formatTime(reply.createdAt)}</span>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); onLikeClick?.(e, reply.id); }}
                            className={`flex items-center gap-0.5 text-[10px] font-bold transition-colors shrink-0 ${isReplyLiked ? 'text-rose-500' : 'text-slate-300 hover:text-rose-400'}`}
                          >
                            <svg className={`w-2.5 h-2.5 ${isReplyLiked ? 'fill-current' : 'fill-none'}`} stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                            </svg>
                            {reply.likes || 0}
                          </button>
                        </div>
                        <p className="text-[11px] font-medium text-slate-700 leading-relaxed whitespace-pre-line">{reply.content}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 🚀 입력 영역: 좌=정보취득자(blue) / 우=정보제공자(rose) — 세로 구분선으로 분리 */}
      <div className="flex border-t border-slate-100 pt-4 pb-4 gap-0">
        {/* 정보취득자 입력 (좌) */}
        <div className="flex-1 pr-3">
          {!currentNickname ? (
            <p className="text-[11px] font-bold text-slate-300 text-center pt-4">로그인이 필요합니다</p>
          ) : !isRootAuthor ? (
            <div className="flex flex-col gap-2">
              <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest">💬 정보취득자 댓글 입력</span>
              <textarea
                value={inputContent}
                onChange={e => setInputContent(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                placeholder="정보에 대한 당신의 생각을 남겨주세요..."
                className="w-full bg-white border border-blue-200 rounded-xl px-3 py-2 text-[12px] font-bold outline-none focus:border-blue-400 transition-all resize-none h-16 text-slate-900"
              />
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !inputContent.trim()}
                className="w-full bg-blue-600 text-white py-1.5 rounded-xl text-[11px] font-[1000] hover:bg-blue-700 transition-all disabled:opacity-50 active:scale-95"
              >
                댓글 입력
              </button>
            </div>
          ) : (
            <p className="text-[10px] font-bold text-slate-200 text-center pt-4">정보 제공자 영역을 이용하세요</p>
          )}
        </div>

        {/* 수직 구분선 */}
        <div className="w-px bg-slate-100 self-stretch shrink-0" />

        {/* 정보제공자 입력 (우) */}
        <div className="flex-1 pl-3">
          {isRootAuthor && currentNickname ? (
            <div className="flex flex-col gap-2">
              <span className="text-[9px] font-black text-rose-400 uppercase tracking-widest text-right">정보제공자 댓글 입력 ✍</span>
              <textarea
                value={inputContent}
                onChange={e => setInputContent(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                placeholder="정보에 대한 부연 설명을 남겨 주세요..."
                className="w-full bg-white border border-rose-200 rounded-xl px-3 py-2 text-[12px] font-bold outline-none focus:border-rose-400 transition-all resize-none h-16 text-slate-900 text-right"
              />
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !inputContent.trim()}
                className="w-full bg-rose-500 text-white py-1.5 rounded-xl text-[11px] font-[1000] hover:bg-rose-600 transition-all disabled:opacity-50 active:scale-95"
              >
                댓글 입력
              </button>
            </div>
          ) : currentNickname ? (
            <p className="text-[10px] font-bold text-slate-200 text-center pt-4">정보 제공자만 입력 가능</p>
          ) : null}
        </div>
      </div>

      {/* 땡스볼 모달 */}
      {thanksballTarget && currentNickname && (
        <ThanksballModal
          postId={rootPost.id}
          postAuthor={rootPost.author}
          currentNickname={currentNickname}
          allUsers={allUsers}
          recipientNickname={thanksballTarget.recipient}
          targetDocId={thanksballTarget.docId}
          targetCollection="comments"
          onClose={() => setThanksballTarget(null)}
        />
      )}
    </div>
  );
};

export default OneCutCommentBoard;
