// src/components/OneCutCommentBoard.tsx — 황금알을 낳는 거위 댓글: 작성자(좌) ↔ 독자(우) 지그재그 채팅형
// 🚀 좌=작성자(side:'left') / 우=독자(side:'right') — currentNickname vs rootPost.author로 자동 결정
// 🚀 고정: 작성자(isRootAuthor)가 양측 댓글 모두 고정 가능
// 🚀 땡스볼: 로그인 유저 누구나 타인 댓글에 전송 가능

import { useState } from 'react';
import ThanksballModal from './ThanksballModal';
import type { Post, UserData } from '../types';
import { db } from '../firebase';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { formatKoreanNumber, getReputationLabel, getReputationScore } from '../utils';

interface Props {
  allChildPosts: Post[];
  rootPost: Post;
  currentNickname?: string;
  currentUserData?: UserData | null;
  onLikeClick?: (e: React.MouseEvent | null, postId: string) => void;
  onInlineReply?: (content: string, parentPost: Post | null, side?: 'left' | 'right') => Promise<void>;
  allUsers?: Record<string, UserData>;
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

  // 땡스볼 모달
  const [thanksballTarget, setThanksballTarget] = useState<{ docId: string; recipient: string } | null>(null);

  // 댓글 인라인 수정 상태 (메인 댓글 + 대댓글 공통)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');

  const handleEditSave = async (post: Post) => {
    if (!editingContent.trim()) return;
    const col = post.rootId ? 'comments' : 'posts';
    await updateDoc(doc(db, col, post.id), { content: editingContent });
    setEditingId(null);
  };

  const handleDelete = async (post: Post) => {
    if (!window.confirm('정말 삭제하시겠소?')) return;
    const col = post.rootId ? 'comments' : 'posts';
    await deleteDoc(doc(db, col, post.id));
  };

  const pinnedCommentId = rootPost.pinnedCommentId;

  const formatTime = (ts: { seconds: number } | null | undefined) => {
    if (!ts) return '';
    const d = new Date(ts.seconds * 1000);
    const diff = Math.floor((Date.now() - d.getTime()) / 60000);
    if (diff < 1) return '방금';
    if (diff < 60) return `${diff}분 전`;
    if (diff < 1440) return `${Math.floor(diff / 60)}시간 전`;
    return d.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' });
  };

  // 핀 고정: 작성자(isRootAuthor)만 가능, 양측 댓글 모두 허용
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

      {/* 🚀 2컬럼 헤더: 좌=일반 댓글(blue), 우=글작성자 댓글(gray) */}
      <div className="flex border-b border-slate-100 sticky top-0 z-10 bg-white">
        <div className="flex-1 py-1 flex flex-row items-center justify-center gap-1.5 border-r border-slate-100">
          <span className="text-[11px] font-[1000] text-blue-600">일반 댓글</span>
          <span className="text-[9px] font-bold text-slate-300">댓글 {readerCount}</span>
        </div>
        <div className="flex-1 py-1 flex flex-row items-center justify-center gap-1.5">
          <span className="text-[11px] font-[1000] text-slate-500">글작성자 댓글</span>
          <span className="text-[9px] font-bold text-slate-300">댓글 {authorCount}</span>
        </div>
      </div>

      {/* 🚀 댓글 목록: 구분선 없는 지그재그 시간순 — 취득자(blue)=좌, 제공자(rose)=우 */}
      <div className="flex flex-col gap-1.5 py-1">

        {sortedComments.length === 0 && <div className="py-1" />}

        {sortedComments.map(post => {
          const isAuthorComment = post.side === 'left'; // 작성자(정보제공자) → 우측
          const isPinned = post.id === pinnedCommentId;
          const isLiked = !!(currentNickname && (post.likedBy || []).includes(currentNickname));
          const replies = getReplies(post.id);
          const postAuthorData = (post.author_id && allUsers[post.author_id]) || allUsers[`nickname_${post.author}`];
          const displayLevel = postAuthorData ? postAuthorData.level : (post.authorInfo?.level || 1);
          const displayLikes = postAuthorData ? (postAuthorData.likes || 0) : (post.authorInfo?.totalLikes || 0);
          const realFollowers = followerCounts?.[post.author] || 0;

          return (
            <div key={post.id} className="px-2">
              {/* 메인 댓글 카드 — 취득자:좌(justify-start) / 제공자:우(justify-end) */}
              <div className={`flex ${isAuthorComment ? 'justify-end' : 'justify-start'}`}>
                <div className={`w-[80%] rounded-2xl border px-3 py-2 transition-all ${
                  isPinned
                    ? 'bg-amber-50 border-amber-200 ring-1 ring-amber-200'
                    : isAuthorComment
                      ? 'bg-slate-50 border-slate-200'
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
                  <div className={`flex items-center justify-between mb-1 ${isAuthorComment ? 'flex-row-reverse' : ''}`}>
                    <div className={`flex items-center gap-2 ${isAuthorComment ? 'flex-row-reverse' : ''}`}>
                      <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 border border-slate-200">
                        <img src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${post.author}`} alt="" className="w-full h-full object-cover" />
                      </div>
                      <div className={`flex flex-col ${isAuthorComment ? 'items-end' : ''}`}>
                        <div className="flex items-center gap-2">
                          <span className={`font-black text-[12px] leading-none ${isAuthorComment ? 'text-slate-700' : 'text-blue-800'}`}>{post.author}</span>
                          <span className="text-[9px] font-bold text-slate-300">{formatTime(post.createdAt)}</span>
                        </div>
                        <span className="text-[9px] text-slate-400 font-bold leading-tight mt-0.5">
                          Lv {displayLevel} · {getReputationLabel(postAuthorData ? getReputationScore(postAuthorData) : displayLikes)} · 깐부수 {formatKoreanNumber(realFollowers)}
                        </span>
                      </div>
                    </div>

                    {/* 액션 버튼들 — 반대편 끝 */}
                    <div className="flex items-center gap-2">
                      {/* 핀: 작성자(isRootAuthor)만, 양측 댓글 모두 가능 */}
                      {isRootAuthor && (
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
                      {/* 땡스볼 보내기: 로그인 유저 누구나 타인 댓글에 전송 가능 */}
                      {currentNickname && post.author !== currentNickname && (
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
                      {/* 수정/삭제: 댓글 작성자 본인만 */}
                      {post.author === currentNickname && (<>
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditingId(post.id); setEditingContent(post.content); }}
                          className="text-[10px] font-bold text-slate-300 hover:text-blue-500 transition-colors"
                        >수정</button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(post); }}
                          className="text-slate-300 hover:text-rose-500 transition-colors"
                          title="삭제"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h14" /></svg>
                        </button>
                      </>)}
                    </div>
                  </div>

                  {/* 본문 또는 인라인 수정 폼 */}
                  {editingId === post.id ? (
                    <div className="flex flex-col gap-2 mt-1">
                      <textarea
                        autoFocus
                        value={editingContent}
                        onChange={e => setEditingContent(e.target.value)}
                        rows={3}
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-[13px] font-medium text-slate-700 outline-none focus:border-blue-400 resize-none"
                      />
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => setEditingId(null)} className="px-3 py-1 text-[11px] font-bold text-slate-400 hover:text-slate-600 rounded-md">취소</button>
                        <button onClick={() => handleEditSave(post)} disabled={!editingContent.trim()} className="px-3 py-1 text-[11px] font-bold bg-slate-900 text-white rounded-md hover:bg-blue-600 disabled:opacity-50">저장</button>
                      </div>
                    </div>
                  ) : (
                    <p className={`text-[13px] font-medium leading-relaxed whitespace-pre-line ${isAuthorComment ? 'text-slate-700 text-right' : 'text-blue-900'}`}>
                      {post.content}
                    </p>
                  )}
                </div>
              </div>

              {/* 답글 폼: 댓글 아래 들여쓰기 표시 */}
              {replyTarget?.id === post.id && (
                <div className="mt-1.5 pl-6 pr-2">
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

              {/* 대댓글 목록: 댓글 아래 들여쓰기 표시 */}
              {replies.length > 0 && (
                <div className="mt-1.5 pl-6 pr-2 flex flex-col gap-1.5">
                  {replies.map(reply => {
                    const isReplyLiked = !!(currentNickname && (reply.likedBy || []).includes(currentNickname));
                    const replyAuthorData = (reply.author_id && allUsers[reply.author_id]) || allUsers[`nickname_${reply.author}`];
                    const replyLevel = replyAuthorData ? replyAuthorData.level : (reply.authorInfo?.level || 1);
                    return (
                      <div key={reply.id} className="bg-white rounded-xl border border-slate-200 px-3 py-2">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div className="w-4 h-4 rounded-full overflow-hidden shrink-0 border border-slate-200">
                              <img src={replyAuthorData?.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${reply.author}`} alt="" className="w-full h-full object-cover" />
                            </div>
                            <span className="font-black text-[10px] text-slate-600 truncate">{reply.author}</span>
                            <span className="text-[9px] font-bold text-slate-300 shrink-0">Lv {replyLevel}</span>
                            <span className="text-[9px] font-bold text-slate-300 shrink-0">{formatTime(reply.createdAt)}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={(e) => { e.stopPropagation(); onLikeClick?.(e, reply.id); }}
                              className={`flex items-center gap-0.5 text-[10px] font-bold transition-colors ${isReplyLiked ? 'text-rose-500' : 'text-slate-300 hover:text-rose-400'}`}
                            >
                              <svg className={`w-2.5 h-2.5 ${isReplyLiked ? 'fill-current' : 'fill-none'}`} stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                              </svg>
                              {reply.likes || 0}
                            </button>
                            {/* 수정/삭제: 대댓글 작성자 본인만 */}
                            {reply.author === currentNickname && (<>
                              <button
                                onClick={(e) => { e.stopPropagation(); setEditingId(reply.id); setEditingContent(reply.content); }}
                                className="text-[10px] font-bold text-slate-300 hover:text-blue-500 transition-colors"
                              >수정</button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDelete(reply); }}
                                className="text-slate-300 hover:text-rose-500 transition-colors"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h14" /></svg>
                              </button>
                            </>)}
                          </div>
                        </div>
                        {editingId === reply.id ? (
                          <div className="flex flex-col gap-2 mt-1">
                            <textarea
                              autoFocus
                              value={editingContent}
                              onChange={e => setEditingContent(e.target.value)}
                              rows={2}
                              className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] font-medium text-slate-700 outline-none focus:border-blue-400 resize-none"
                            />
                            <div className="flex gap-2 justify-end">
                              <button onClick={() => setEditingId(null)} className="px-2 py-1 text-[10px] font-bold text-slate-400 hover:text-slate-600 rounded-md">취소</button>
                              <button onClick={() => handleEditSave(reply)} disabled={!editingContent.trim()} className="px-2 py-1 text-[10px] font-bold bg-slate-900 text-white rounded-md hover:bg-blue-600 disabled:opacity-50">저장</button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-[11px] font-medium text-slate-700 leading-relaxed whitespace-pre-line">{reply.content}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 🚀 입력 영역: 비로그인 시 전체 너비 메시지 / 로그인 시 2컬럼 입력창 */}
      {!currentNickname ? (
        <div className="flex items-center gap-2 px-4 py-3 border-t border-slate-100 text-[13px] font-bold text-slate-400">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
          댓글을 작성하려면 로그인이 필요합니다.
        </div>
      ) : (
      <div className="flex border-t border-slate-100 pt-2 pb-2 gap-0">
        {/* 일반 댓글 입력 (좌) */}
        <div className="flex-1 pr-3">
          {!isRootAuthor ? (
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest">일반 댓글 입력</span>
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
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">글작성자 댓글 입력</span>
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
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-[12px] font-bold outline-none focus:border-slate-400 transition-all resize-none h-16 text-slate-900 text-right"
              />
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !inputContent.trim()}
                className="w-full bg-slate-600 text-white py-1.5 rounded-xl text-[11px] font-[1000] hover:bg-slate-700 transition-all disabled:opacity-50 active:scale-95"
              >
                댓글 입력
              </button>
            </div>
          ) : currentNickname ? (
            <p className="text-[10px] font-bold text-slate-200 text-center pt-4">정보 제공자만 입력 가능</p>
          ) : null}
        </div>
      </div>
      )}

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
