// src/components/DebateBoard.tsx
import React, { useRef, useState, useEffect } from 'react';
import PostCard from './PostCard';
import ThanksballModal from './ThanksballModal';
import type { Post, UserData } from '../types';
import { CATEGORY_RULES } from './DiscussionView';
import { db } from '../firebase';
import { doc, updateDoc, deleteDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { formatKoreanNumber, getReputationLabel, getReputationScore } from '../utils';
import { uploadToR2 } from '../uploadToR2';

interface Props {
  allChildPosts: Post[];
  setReplyTarget: (post: Post) => void;
  onPostClick: (post: Post) => void;
  currentUserData?: UserData | null;
  currentUserFriends: string[];
  onLikeClick?: (e: React.MouseEvent | null, id: string) => void;
  currentNickname?: string;
  category: string;
  onInlineReply?: (content: string, parentPost: Post | null, side?: 'left' | 'right', imageUrl?: string, linkUrl?: string) => Promise<void>;
  onOpenLinkedPost?: (side: 'left' | 'right') => void;  // 솔로몬의 재판 연계글 팝업 트리거
  onNavigateToPost?: (postId: string) => void;          // 연계글 클릭 시 해당 글로 이동
  rootPost?: Post;
  allUsers?: Record<string, UserData>;
  followerCounts?: Record<string, number>;
}

const DebateBoard = ({
  allChildPosts, setReplyTarget, onPostClick, onLikeClick, currentNickname, category, onInlineReply, onOpenLinkedPost, onNavigateToPost, rootPost, allUsers = {}, followerCounts = {}
}: Props) => {
  const rule = CATEGORY_RULES[category] || CATEGORY_RULES["너와 나의 이야기"];

  const leftPosts = allChildPosts.filter(p => p.side === 'left');
  const rightPosts = allChildPosts.filter(p => p.side === 'right');

  // 댓글 정렬 상태 (단일 리스트형에서 사용)
  const [sortBy, setSortBy] = useState<'latest' | 'likes'>('latest');

  const isRootAuthor = !!(rootPost && currentNickname && rootPost.author === currentNickname);

  // 판도라 전용 이미지/링크 상태
  const [pandoraImageUrl, setPandoraImageUrl] = useState('');
  const [pandoraLinkUrl, setPandoraLinkUrl] = useState('');
  const [pandoraLinkInput, setPandoraLinkInput] = useState('');
  const [pandoraShowLink, setPandoraShowLink] = useState(false);
  const [pandoraUploading, setPandoraUploading] = useState(false);
  const pandoraFileRef = useRef<HTMLInputElement>(null);

  const normUrl = (url: string) => {
    const u = url.trim();
    return u && !/^https?:\/\//i.test(u) ? `https://${u}` : u;
  };

  const resetPandoraAttach = () => {
    setPandoraImageUrl(''); setPandoraLinkUrl('');
    setPandoraLinkInput(''); setPandoraShowLink(false);
  };

  const uploadPandoraImage = async (file: File): Promise<string | null> => {
    if (!file.type.startsWith('image/')) return null;
    setPandoraUploading(true);
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `uploads/${currentNickname || 'pandora'}/${Date.now()}_${safeName}`;
    try {
      return await uploadToR2(file, filePath);
    } catch { alert('이미지 업로드에 실패했습니다.'); return null; }
    finally { setPandoraUploading(false); }
  };
  const pinnedCommentId = rootPost?.pinnedCommentId;

  const handlePin = async (commentId: string) => {
    if (!rootPost) return;
    const newPinned = pinnedCommentId === commentId ? null : commentId;
    await updateDoc(doc(db, 'posts', rootPost.id), { pinnedCommentId: newPinned ?? '' });
  };

  const handleToggleLock = async () => {
    if (!rootPost) return;
    await updateDoc(doc(db, 'posts', rootPost.id), { commentsLocked: !rootPost.commentsLocked });
  };

  // 땡스볼 모달 상태 (글 작성자 → 댓글 작성자)
  const [thanksballTarget, setThanksballTarget] = useState<{ docId: string; recipient: string; col: string } | null>(null);

  // 🚀 솔로몬의 재판 전용: 이 글을 원본으로 하는 연계글 실시간 구독
  const [linkedPosts, setLinkedPosts] = useState<Post[]>([]);
  useEffect(() => {
    if (category !== '솔로몬의 재판' || !rootPost?.id) return;
    const q = query(collection(db, 'posts'), where('linkedPostId', '==', rootPost.id));
    const unsub = onSnapshot(q, snap => {
      const posts = snap.docs.map(d => ({ id: d.id, ...d.data() } as Post));
      posts.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
      setLinkedPosts(posts);
    });
    return () => unsub();
  }, [category, rootPost?.id]);

  // 판도라 댓글 인라인 수정 상태
  const [editingPandoraId, setEditingPandoraId] = useState<string | null>(null);
  const [editingPandoraContent, setEditingPandoraContent] = useState('');

  const handlePandoraEditSave = async (post: Post) => {
    if (!editingPandoraContent.trim()) return;
    try {
      const col = post.rootId ? 'comments' : 'posts';
      await updateDoc(doc(db, col, post.id), { content: editingPandoraContent });
      setEditingPandoraId(null);
    } catch (e) { console.error(e); }
  };

  const handlePandoraDelete = async (post: Post) => {
    if (!window.confirm('정말 삭제하시겠소?')) return;
    try {
      const col = post.rootId ? 'comments' : 'posts';
      await deleteDoc(doc(db, col, post.id));
    } catch (e) { console.error(e); }
  };

  // 너와 나의 이야기 전용 인라인 폼 상태
  // '__new__' = 새 최상위 댓글, post.id = 해당 댓글 답글
  const [activeId, setActiveId] = useState<string | null>(null);
  const [inlineContent, setInlineContent] = useState('');
  const [isInlineSubmitting, setIsInlineSubmitting] = useState(false);

  const openInline = (id: string) => {
    if (!currentNickname) return;
    setActiveId(prev => prev === id ? null : id);
    setInlineContent('');
  };

  const submitInline = async (parentPost: Post | null) => {
    if (!inlineContent.trim() || isInlineSubmitting) return;
    setIsInlineSubmitting(true);
    try {
      await onInlineReply?.(inlineContent, parentPost);
      setInlineContent(''); setActiveId(null);
    } catch {
      // 에러는 handleInlineReply에서 alert 처리됨
    } finally {
      setIsInlineSubmitting(false);
    }
  };


  // 답글 스레드: parentId === rootId 이면 최상위 댓글, 아니면 다른 댓글의 답글
  const topLevelComments = allChildPosts.filter(p => p.parentId === p.rootId);
  const getReplies = (id: string) => allChildPosts.filter(p => p.parentId === id);
  const sortedTopLevel = [...topLevelComments].sort((a, b) => {
    if (a.id === pinnedCommentId) return -1;
    if (b.id === pinnedCommentId) return 1;
    return sortBy === 'likes'
      ? (b.likes || 0) - (a.likes || 0)
      : (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
  });
  const renderThread = (post: Post, depth: number) => {
    const replies = getReplies(post.id);
    return (
      <div key={post.id}>
        <div className={depth > 0 ? 'ml-6 border-l-2 border-slate-100' : ''}>
          <PostCard post={post} onReply={setReplyTarget} onPostClick={onPostClick} onLikeClick={onLikeClick} currentNickname={currentNickname} />
        </div>
        {replies.map(reply => renderThread(reply, depth + 1))}
      </div>
    );
  };

  // 너와 나의 이야기 전용 — 인라인 답글 폼 포함
  const renderThreadMyStory = (post: Post, depth: number): React.ReactNode => {
    const replies = getReplies(post.id);
    return (
      <div key={post.id}>
        <div className={depth > 0 ? 'ml-6 border-l-2 border-slate-100' : ''}>
          <PostCard post={post} onReply={(p) => openInline(p.id)} onPostClick={onPostClick} onLikeClick={onLikeClick} currentNickname={currentNickname}
            isPinned={post.id === pinnedCommentId}
            isRootAuthor={isRootAuthor}
            onPin={() => handlePin(post.id)}
            onThanksball={currentNickname ? (p) => setThanksballTarget({ docId: p.id, recipient: p.author, col: p.rootId ? 'comments' : 'posts' }) : undefined}
            allUsers={allUsers}
            followerCounts={followerCounts}
          />
          {activeId === post.id && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border-t border-slate-100">
              <input autoFocus type="text" value={inlineContent} onChange={e => setInlineContent(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) submitInline(post); }}
                placeholder={`${post.author}에게 답글...`}
                className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-[13px] font-bold text-slate-700 outline-none focus:border-slate-400" />
              <button onClick={() => { setActiveId(null); setInlineContent(''); }}
                className="px-3 py-1.5 text-[11px] font-bold text-slate-400 hover:text-slate-600 rounded-md transition-colors shrink-0">취소</button>
              <button onClick={() => submitInline(post)} disabled={isInlineSubmitting || !inlineContent.trim()}
                className="px-3 py-1.5 text-[11px] font-bold bg-slate-900 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 transition-colors shrink-0">댓글 달기</button>
            </div>
          )}
        </div>
        {replies.map(reply => renderThreadMyStory(reply, depth + 1))}
      </div>
    );
  };

  // 🚀 판도라의 상자 전용 레이아웃 — 지그재그 + 인라인 입력 + 핀 고정
  if (rule.boardType === 'pandora') {
    const topLevel = allChildPosts.filter(p => p.parentId === p.rootId);
    const zigzag = [...topLevel].sort((a, b) => {
      if (a.id === pinnedCommentId) return -1;
      if (b.id === pinnedCommentId) return 1;
      return (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0);
    });

    const pandoraSubmit = async (side: 'left' | 'right') => {
      if (!inlineContent.trim() || isInlineSubmitting) return;
      setIsInlineSubmitting(true);
      await onInlineReply?.(inlineContent, null, side, pandoraImageUrl || undefined, pandoraLinkUrl || undefined);
      setInlineContent(''); setActiveId(null); setIsInlineSubmitting(false);
      resetPandoraAttach();
    };

    const formatTime = (ts: { seconds: number } | null | undefined) => {
      if (!ts) return '';
      const d = new Date(ts.seconds * 1000);
      const diff = Math.floor((Date.now() - d.getTime()) / 60000);
      if (diff < 1) return '방금';
      if (diff < 60) return `${diff}분 전`;
      if (diff < 1440) return `${Math.floor(diff / 60)}시간 전`;
      return d.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' });
    };

    return (
      <div className="flex flex-col bg-white min-h-[200px] mt-0">
        {/* 헤더 */}
        <div className="py-1 md:px-8 border-b border-slate-100 flex items-center justify-between sticky top-0 z-10 bg-white">
          <h4 className="text-[14px] font-[1000] text-slate-700 tracking-tight flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-blue-400 rounded-full" />
              <span className="text-blue-600">{rule.tab1} {leftPosts.length}</span>
            </span>
            {rule.allowDisagree && (<>
              <span className="text-slate-200">·</span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 bg-rose-400 rounded-full" />
                <span className="text-rose-500">{rule.tab2} {rightPosts.length}</span>
              </span>
            </>)}
          </h4>
          {isRootAuthor && (
            <button
              onClick={handleToggleLock}
              title={rootPost?.commentsLocked ? '댓글 잠금 해제' : '댓글 잠금'}
              className={`flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all ${rootPost?.commentsLocked ? 'bg-slate-100 text-slate-500 hover:bg-slate-200' : 'text-slate-300 hover:text-slate-500 hover:bg-slate-50'}`}
            >
              {rootPost?.commentsLocked
                ? <><svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>잠금 해제</>
                : <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"/></svg>댓글 잠금</>
              }
            </button>
          )}
        </div>

        {/* 지그재그 댓글 목록 */}
        <div className="flex flex-col gap-1.5 px-4 py-1">
          {zigzag.map(post => {
            const isLeft = post.side === 'left';
            const isPinned = post.id === pinnedCommentId;
            const isLiked = currentNickname && (post.likedBy || []).includes(currentNickname);
            const authorData = (post.author_id && allUsers[post.author_id]) || allUsers[`nickname_${post.author}`];
            const displayLevel = authorData ? authorData.level : (post.authorInfo?.level || 1);
            const displayLikes = authorData ? authorData.likes : (post.authorInfo?.totalLikes || 0);
            const realFollowers = followerCounts[post.author] || 0;
            return (
              <div key={post.id} className={`flex ${isLeft ? 'justify-start' : 'justify-end'}`}>
                <div className={`${category === '마라톤의 전령' ? 'w-full' : 'w-[84%]'} rounded-xl border px-3 py-2 transition-all ${
                  isPinned
                    ? 'bg-amber-50 border-amber-200 ring-1 ring-amber-300'
                    : isLeft
                      ? 'bg-blue-50 border-blue-100'
                      : 'bg-rose-50 border-rose-100'
                }`}>
                  {isPinned && (
                    <div className="text-[10px] font-black text-amber-600 mb-1.5 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>
                      작성자가 고정한 댓글
                    </div>
                  )}
                  <div className={`flex items-center justify-between mb-1 ${!isLeft ? 'flex-row-reverse' : ''}`}>
                    <div className={`flex items-center gap-2 ${!isLeft ? 'flex-row-reverse' : ''}`}>
                      <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 border border-slate-200">
                        <img src={authorData?.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${post.author}`} alt="avatar" className="w-full h-full object-cover" />
                      </div>
                      <div className={`flex flex-col ${!isLeft ? 'items-end' : ''}`}>
                        <div className="flex items-center gap-2">
                          <span className={`font-black text-[12px] leading-none ${isLeft ? 'text-blue-800' : 'text-rose-800'}`}>{post.author}</span>
                          <span className="text-[9px] font-bold text-slate-300">{formatTime(post.createdAt)}</span>
                        </div>
                        <span className="text-[9px] text-slate-400 font-bold leading-tight mt-0.5">
                          Lv {displayLevel} · {getReputationLabel(authorData ? getReputationScore(authorData) : displayLikes)} · 깐부수 {formatKoreanNumber(realFollowers)}
                        </span>
                      </div>
                    </div>
                    {/* 🚀 카드 헤더 우측: 좋아요·땡스볼·수정·삭제·핀 */}
                    <div className="flex items-center gap-2">
                      {/* 좋아요 */}
                      <button
                        onClick={(e) => { e.stopPropagation(); onLikeClick?.(e, post.id); }}
                        className={`flex items-center gap-1 text-[11px] font-bold transition-colors ${isLiked ? 'text-rose-500' : 'text-slate-300 hover:text-rose-400'}`}
                      >
                        <svg className={`w-3 h-3 ${isLiked ? 'fill-current' : 'fill-none'}`} stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                        {post.likes || 0}
                      </button>
                      {/* 땡스볼: 로그인 유저 누구나 본인 댓글 제외 */}
                      {currentNickname && post.author !== currentNickname ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); setThanksballTarget({ docId: post.id, recipient: post.author, col: post.rootId ? 'comments' : 'posts' }); }}
                          className="flex items-center gap-0.5 text-[11px] font-bold text-slate-300 hover:text-amber-500 transition-colors"
                          title="땡스볼 보내기"
                        >
                          <span className="text-[13px] leading-none">⚾</span>
                          {(post.thanksballTotal || 0) > 0 && <span className="text-amber-400">{post.thanksballTotal}</span>}
                        </button>
                      ) : (post.thanksballTotal || 0) > 0 ? (
                        <span className="flex items-center gap-0.5 text-[11px] font-bold text-amber-400">
                          <span className="text-[13px] leading-none">⚾</span>
                          {post.thanksballTotal}
                        </span>
                      ) : null}
                      {/* 수정 — 댓글 작성자 본인만 */}
                      {post.author === currentNickname && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditingPandoraId(post.id); setEditingPandoraContent(post.content); }}
                          className="text-[10px] font-bold text-slate-300 hover:text-blue-500 transition-colors"
                        >수정</button>
                      )}
                      {/* 삭제 — 댓글 작성자 본인만 */}
                      {post.author === currentNickname && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handlePandoraDelete(post); }}
                          className="text-slate-300 hover:text-rose-500 transition-colors"
                          title="삭제"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h14" /></svg>
                        </button>
                      )}
                      {/* 핀 고정 — 글 작성자만 */}
                      {isRootAuthor && (
                        <button
                          onClick={() => handlePin(post.id)}
                          title={isPinned ? '고정 해제' : '댓글 고정'}
                          className={`text-[10px] transition-colors ${isPinned ? 'text-amber-500' : 'text-slate-300 hover:text-amber-400'}`}
                        >
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>
                        </button>
                      )}
                    </div>
                  </div>
                  {editingPandoraId === post.id ? (
                    <div className="flex flex-col gap-2 mt-1">
                      <textarea
                        autoFocus
                        value={editingPandoraContent}
                        onChange={e => setEditingPandoraContent(e.target.value)}
                        rows={3}
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-[13px] font-medium text-slate-700 outline-none focus:border-blue-400 resize-none"
                      />
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => setEditingPandoraId(null)} className="px-3 py-1 text-[11px] font-bold text-slate-400 hover:text-slate-600 rounded-md">취소</button>
                        <button onClick={() => handlePandoraEditSave(post)} disabled={!editingPandoraContent.trim()} className="px-3 py-1 text-[11px] font-bold bg-slate-900 text-white rounded-md hover:bg-blue-600 disabled:opacity-50">저장</button>
                      </div>
                    </div>
                  ) : (
                    <p className={`text-[13px] font-medium leading-relaxed whitespace-pre-line ${isLeft ? 'text-blue-900' : 'text-rose-900 text-right'}`}>
                      {post.content}
                    </p>
                  )}
                  {post.imageUrl && (
                    <div className="mt-2 rounded-lg overflow-hidden border border-slate-200">
                      <img src={post.imageUrl} alt="" className="w-full h-auto max-h-52 object-cover" />
                    </div>
                  )}
                  {post.linkUrl && (
                    <a href={post.linkUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                      className={`mt-2 flex items-center gap-1 text-[11px] font-bold truncate ${isLeft ? 'text-blue-500 hover:text-blue-700' : 'text-rose-500 hover:text-rose-700'}`}>
                      <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>
                      {post.linkUrl}
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* 🚀 솔로몬의 재판 전용: 이 글에 연결된 연계글 목록 */}
        {category === '솔로몬의 재판' && linkedPosts.length > 0 && (
          <div className="border-t border-slate-100 px-4 py-2">
            <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>
              연계글 {linkedPosts.length}
            </h5>
            <div className="flex flex-col gap-1">
              {linkedPosts.map(lp => (
                <button
                  key={lp.id}
                  onClick={() => onNavigateToPost?.(lp.id)}
                  className={`flex items-center gap-2 w-full text-left px-3 py-1.5 rounded-lg border transition-all hover:opacity-80 ${
                    lp.debatePosition === 'pro' ? 'bg-blue-50 border-blue-100' : 'bg-rose-50 border-rose-100'
                  }`}
                >
                  <span className={`text-[9px] font-black shrink-0 px-1.5 py-0.5 rounded ${
                    lp.debatePosition === 'pro' ? 'bg-blue-100 text-blue-600' : 'bg-rose-100 text-rose-600'
                  }`}>
                    {lp.debatePosition === 'pro' ? '👍 동의' : '👎 비동의'}
                  </span>
                  <span className={`text-[12px] font-bold truncate flex-1 ${lp.debatePosition === 'pro' ? 'text-blue-800' : 'text-rose-800'}`}>
                    {lp.title}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 shrink-0">{lp.author}</span>
                  <svg className="w-3 h-3 shrink-0 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/></svg>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 하단 인라인 입력 */}
        <div className="border-t border-slate-100">
          {rootPost?.commentsLocked ? (
            <div className="flex items-center gap-2 px-4 py-2 text-[13px] font-bold text-slate-400">
              <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
              작성자가 댓글 기능을 잠궜습니다.
            </div>
          ) : !currentNickname ? (
            <div className="flex items-center gap-2 px-4 py-2 text-[13px] font-bold text-slate-400">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
              댓글을 작성하려면 로그인이 필요합니다.
            </div>
          ) : activeId === 'agree' || activeId === 'refute' ? (
            <div className={`flex flex-col gap-1.5 px-4 py-2 border-t ${activeId === 'agree' ? 'bg-blue-50 border-blue-100' : 'bg-rose-50 border-rose-100'}`}>
              {/* 힌트 + 첨부 아이콘 */}
              <div className={`flex items-center gap-2 text-[11px] font-bold ${activeId === 'agree' ? 'text-blue-400' : 'text-rose-400'}`}>
                <span>{activeId === 'agree' ? (rule.hintAgree ?? `${rule.tab1} 근거를 작성하세요.`) : (rule.hintRefute ?? `${rule.tab2} 근거를 작성하세요.`)}</span>
                {/* hideAttachment가 없는 카테고리(판도라 등)에서만 이미지·링크 첨부 버튼 표시 */}
                {!rule.hideAttachment && (<>
                  <input ref={pandoraFileRef} type="file" accept="image/*" className="hidden" onChange={async e => {
                    const file = e.target.files?.[0];
                    if (file) { const url = await uploadPandoraImage(file); if (url) setPandoraImageUrl(url); }
                    e.target.value = '';
                  }} />
                  <button onClick={() => pandoraFileRef.current?.click()} disabled={pandoraUploading} title="이미지 첨부"
                    className={`transition-opacity hover:opacity-70 ${pandoraImageUrl ? 'opacity-100' : 'opacity-60'} ${pandoraUploading ? 'opacity-30' : ''}`}>
                    {pandoraUploading
                      ? <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                      : '📷'}
                  </button>
                  <button onClick={() => setPandoraShowLink(prev => !prev)} title="링크 첨부"
                    className={`transition-opacity hover:opacity-70 ${pandoraLinkUrl ? 'opacity-100' : 'opacity-60'}`}>
                    🔗
                  </button>
                </>)}
              </div>
              {/* 이미지 미리보기 */}
              {pandoraImageUrl && (
                <div className="relative w-24 h-24 shrink-0">
                  <img src={pandoraImageUrl} alt="" className="w-full h-full object-cover rounded-lg border border-slate-200" />
                  <button onClick={() => setPandoraImageUrl('')} className="absolute -top-1 -right-1 w-5 h-5 bg-slate-700 text-white rounded-full text-[10px] flex items-center justify-center leading-none">×</button>
                </div>
              )}
              {/* 링크 입력 */}
              {pandoraShowLink && (
                <div className="flex gap-2">
                  <input
                    autoFocus
                    value={pandoraLinkInput}
                    onChange={e => setPandoraLinkInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { setPandoraLinkUrl(normUrl(pandoraLinkInput)); setPandoraShowLink(false); } if (e.key === 'Escape') { setPandoraShowLink(false); setPandoraLinkInput(''); } }}
                    placeholder="https://..."
                    className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-[12px] font-bold outline-none focus:border-blue-400"
                  />
                  <button onClick={() => { setPandoraLinkUrl(normUrl(pandoraLinkInput)); setPandoraShowLink(false); }} className="px-3 py-1.5 text-[11px] font-bold bg-slate-700 text-white rounded-lg">확인</button>
                  <button onClick={() => { setPandoraShowLink(false); setPandoraLinkInput(''); }} className="px-2 py-1.5 text-[11px] font-bold text-slate-400 hover:text-slate-600 rounded-lg">취소</button>
                </div>
              )}
              {/* 링크 미리보기 */}
              {pandoraLinkUrl && !pandoraShowLink && (
                <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5">
                  <svg className="w-3 h-3 shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>
                  <span className="text-[11px] text-blue-500 font-bold truncate flex-1">{pandoraLinkUrl}</span>
                  <button onClick={() => { setPandoraLinkUrl(''); setPandoraLinkInput(''); }} className="text-slate-300 hover:text-slate-500 text-[14px] leading-none">×</button>
                </div>
              )}
              {/* textarea */}
              <textarea
                autoFocus={!pandoraShowLink}
                value={inlineContent}
                onChange={e => setInlineContent(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey && !e.nativeEvent.isComposing) pandoraSubmit(activeId === 'agree' ? 'left' : 'right'); }}
                onPaste={async e => {
                  const items = e.clipboardData?.items;
                  if (!items) return;
                  for (const item of Array.from(items)) {
                    if (item.type.startsWith('image/')) {
                      e.preventDefault();
                      const file = item.getAsFile();
                      if (file) { const url = await uploadPandoraImage(file); if (url) setPandoraImageUrl(url); }
                      break;
                    }
                  }
                }}
                placeholder={activeId === 'agree' ? (rule.placeholderAgree ?? `${rule.tab1} 이유를 작성하세요... (Ctrl+Enter로 등록)`) : (rule.placeholderRefute ?? `${rule.tab2} 이유를 작성하세요... (Ctrl+Enter로 등록)`)}
                rows={3}
                className={`w-full bg-white border rounded-lg px-3 py-2 text-[13px] font-bold text-slate-700 outline-none resize-none transition-all ${activeId === 'agree' ? 'border-blue-200 focus:border-blue-400' : 'border-rose-200 focus:border-rose-400'}`}
              />
              {/* 버튼 */}
              <div className="flex items-center justify-end gap-2">
                <button onClick={() => { setActiveId(null); setInlineContent(''); resetPandoraAttach(); }} className="px-3 py-1.5 text-[11px] font-bold text-slate-400 hover:text-slate-600 rounded-md transition-colors">취소</button>
                <button
                  onClick={() => pandoraSubmit(activeId === 'agree' ? 'left' : 'right')}
                  disabled={isInlineSubmitting || !inlineContent.trim() || pandoraUploading}
                  className={`px-3 py-1.5 text-[11px] font-bold text-white rounded-md disabled:opacity-50 transition-colors ${activeId === 'agree' ? 'bg-blue-500 hover:bg-blue-600' : 'bg-rose-500 hover:bg-rose-600'}`}
                >댓글 달기</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5 px-4 py-2">
              {/* 🚀 마라톤의 전령 전용: 탭 버튼 없이 바로 입력창 */}
              {category === '마라톤의 전령' ? (
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                  <input
                    type="text"
                    value={inlineContent}
                    onChange={e => setInlineContent(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) pandoraSubmit('left'); }}
                    placeholder="이 뉴스에 공감해요"
                    className="flex-1 bg-transparent text-[13px] font-bold text-slate-700 outline-none placeholder:text-slate-300 min-w-0"
                  />
                  <button
                    onClick={() => pandoraSubmit('left')}
                    disabled={isInlineSubmitting || !inlineContent.trim()}
                    className="shrink-0 px-3 py-1.5 text-[11px] font-[1000] bg-slate-900 text-white rounded-lg hover:bg-blue-600 disabled:opacity-40 transition-colors"
                  >댓글달기</button>
                </div>
              ) : (
              <div className="flex gap-1.5">
                <button onClick={() => openInline('agree')} className="flex-1 py-1.5 rounded-xl text-[12px] font-[1000] bg-blue-50 text-blue-500 hover:bg-blue-100 border border-blue-100 transition-all">{rule.tab1} 댓글...</button>
                {rule.allowDisagree && <button onClick={() => openInline('refute')} className="flex-1 py-1.5 rounded-xl text-[12px] font-[1000] bg-rose-50 text-rose-500 hover:bg-rose-100 border border-rose-100 transition-all">{rule.tab2} 댓글...</button>}
              </div>
              )}
              {/* 🚀 솔로몬의 재판 전용 연계글 버튼: 동의/비동의측 새 글 작성 팝업 트리거 */}
              {category === '솔로몬의 재판' && onOpenLinkedPost && (
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest shrink-0">연계글</span>
                  <button onClick={() => onOpenLinkedPost('left')} className="flex-1 py-2 rounded-lg text-[11px] font-[1000] bg-blue-50 text-blue-400 hover:bg-blue-100 border border-blue-100 transition-all">동의 연계글 작성...</button>
                  <button onClick={() => onOpenLinkedPost('right')} className="flex-1 py-2 rounded-lg text-[11px] font-[1000] bg-rose-50 text-rose-400 hover:bg-rose-100 border border-rose-100 transition-all">비동의 연계글 작성...</button>
                </div>
              )}
            </div>
          )}
        </div>
      {thanksballTarget && currentNickname && rootPost && (
        <ThanksballModal
          postId={rootPost.id}
          postAuthor={rootPost.author}
          postTitle={rootPost.title}
          recipientNickname={thanksballTarget.recipient}
          targetDocId={thanksballTarget.docId}
          targetCollection={thanksballTarget.col}
          currentNickname={currentNickname}
          allUsers={allUsers}
          onClose={() => setThanksballTarget(null)}
        />
      )}
      </div>
    );
  }

  // 🚀 단일 리스트형 레이아웃 (나의 이야기, 뼈때리는 글, 지식 소매상 등)
  if (rule.boardType === 'single' || rule.boardType === 'qa' || rule.boardType === 'onecut') {
    let label = "댓글";
    let colorClass = "text-slate-800";
    let pointColor = "bg-slate-800";

    if (rule.boardType === 'qa') {
      label = "지식 답변"; colorClass = "text-blue-600"; pointColor = "bg-blue-500";
    } else if (category === '유배·귀양지') {
      label = "격리 구역 기록"; colorClass = "text-slate-500"; pointColor = "bg-slate-400";
    } else if (category === '신포도와 여우') {
      label = "뼈때리는 글"; colorClass = "text-purple-600"; pointColor = "bg-purple-500";
    } else if (rule.boardType === 'onecut') {
      label = "한컷 반응"; colorClass = "text-rose-600"; pointColor = "bg-rose-500";
    } else {
      label = "공감하는 글"; colorClass = "text-emerald-600"; pointColor = "bg-emerald-500";
    }

    return (
      <div className="flex flex-col bg-white min-h-[200px] mt-0">
        <div className="py-1 md:px-8 border-b border-slate-100 flex items-center justify-between sticky top-0 z-10 bg-white">
          <h4 className={`text-[14px] font-[1000] ${colorClass} tracking-tight flex items-center gap-2.5`}>
            <span className={`w-2.5 h-2.5 ${pointColor} rounded-full`} />
            {label} ({allChildPosts.length})
          </h4>
          <div className="flex gap-1">
            <button
              onClick={() => setSortBy('latest')}
              className={`text-[10px] font-black px-2.5 py-1 rounded-md transition-all ${sortBy === 'latest' ? 'bg-slate-900 text-white' : 'text-slate-400 hover:bg-slate-50'}`}
            >최신순</button>
            <button
              onClick={() => setSortBy('likes')}
              className={`text-[10px] font-black px-2.5 py-1 rounded-md transition-all ${sortBy === 'likes' ? 'bg-slate-900 text-white' : 'text-slate-400 hover:bg-slate-50'}`}
            >공감순</button>
          </div>
        </div>
        <div className="flex-1">
          {rule.allowInlineReply
            ? sortedTopLevel.map(post => renderThreadMyStory(post, 0))
            : sortedTopLevel.map(post => renderThread(post, 0))
          }
          {allChildPosts.length === 0 && !rule.hideEmptyMessage && <div className="py-6 text-center text-slate-300 font-bold text-xs">첫 번째 글을 남겨보세요.</div>}
        </div>

        {/* 인라인 답글 활성화 카테고리 전용 — 최하단 새 댓글 입력창 */}
        {rule.allowInlineReply && (
          <div className="border-t border-slate-100">
            {!currentNickname ? (
              <div className="flex items-center gap-2 px-4 py-2 text-[13px] font-bold text-slate-400">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                댓글을 작성하려면 로그인이 필요합니다.
              </div>
            ) : (category === '너와 나의 이야기' || category === '신포도와 여우') ? (
              /* 🚀 너와 나의 이야기 · 신포도와 여우: 직접 입력창 (버튼 클릭 없이 바로 입력) */
              <div className="flex items-center gap-2 bg-slate-50 border-t border-slate-100 px-4 py-2">
                <input
                  type="text"
                  value={inlineContent}
                  onChange={e => setInlineContent(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) submitInline(null); }}
                  placeholder={rule.placeholder}
                  className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-[13px] font-bold text-slate-700 outline-none focus:border-slate-400 placeholder:text-slate-300 min-w-0"
                />
                <button
                  onClick={() => submitInline(null)}
                  disabled={isInlineSubmitting || !inlineContent.trim()}
                  className="shrink-0 px-3 py-1.5 text-[11px] font-[1000] bg-slate-900 text-white rounded-lg hover:bg-blue-600 disabled:opacity-40 transition-colors"
                >댓글달기</button>
              </div>
            ) : activeId === '__new__' ? (
              <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border-t border-slate-100">
                <input autoFocus type="text" value={inlineContent} onChange={e => setInlineContent(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) submitInline(null); }}
                  placeholder={rule.placeholder}
                  className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-[13px] font-bold text-slate-700 outline-none focus:border-slate-400" />
                <button onClick={() => { setActiveId(null); setInlineContent(''); }}
                  className="px-3 py-1.5 text-[11px] font-bold text-slate-400 hover:text-slate-600 rounded-md transition-colors shrink-0">취소</button>
                <button onClick={() => submitInline(null)} disabled={isInlineSubmitting || !inlineContent.trim()}
                  className="px-3 py-1.5 text-[11px] font-bold bg-slate-900 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 transition-colors shrink-0">댓글 달기</button>
              </div>
            ) : (
              <button onClick={() => openInline('__new__')}
                className="w-full px-6 py-2 text-left text-[13px] font-bold text-slate-300 hover:text-slate-500 hover:bg-slate-50 transition-colors">
                댓글 달기...
              </button>
            )}
          </div>
        )}
        {thanksballTarget && currentNickname && rootPost && (
          <ThanksballModal
            postId={rootPost.id}
            postAuthor={rootPost.author}
            postTitle={rootPost.title}
            recipientNickname={thanksballTarget.recipient}
            targetDocId={thanksballTarget.docId}
            targetCollection={thanksballTarget.col}
            currentNickname={currentNickname}
            allUsers={allUsers}
            onClose={() => setThanksballTarget(null)}
          />
        )}
      </div>
    );
  }

  // 🚀 정보 공유형 레이아웃 (현지 소식 등)
  if (rule.boardType === 'info') {
    return (
      <div className="flex flex-col bg-white min-h-[200px] mt-0">
        <div className="py-3 md:px-8 border-b border-slate-100 flex items-center justify-between sticky top-0 z-10 bg-white">
          <h4 className="text-[14px] font-[1000] text-slate-700 tracking-tight flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 bg-slate-400 rounded-full" />
            나누고 싶은 정보 ({allChildPosts.length})
          </h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border-b border-slate-100">
          <div className="md:border-r border-slate-100">
            {leftPosts.map(post => (
              <PostCard key={post.id} post={post} onReply={setReplyTarget} onPostClick={onPostClick} onLikeClick={onLikeClick} currentNickname={currentNickname} />
            ))}
          </div>
          <div>
            {rightPosts.map(post => (
              <PostCard key={post.id} post={post} onReply={setReplyTarget} onPostClick={onPostClick} onLikeClick={onLikeClick} currentNickname={currentNickname} />
            ))}
          </div>
        </div>
        {allChildPosts.length === 0 && <div className="py-20 text-center text-slate-300 font-bold text-xs">🌍 따끈한 현지 소식을 기다리고 있어요.</div>}
      </div>
    );
  }

  // 🚀 기본 대립형 레이아웃 (당나귀 귀, 벌거벗은 임금님 등)
  const leftLabel = rule.boardType === 'factcheck' ? "진실 제보" : rule.tab1.replace(/[^가-힣\s]/g, '').trim() || "동의";
  const rightLabel = rule.boardType === 'factcheck' ? "반박/추가확인" : rule.tab2?.replace(/[^가-힣\s]/g, '').trim() || "비동의";

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 min-h-[400px] mt-0 bg-[#F8FAFC]">
      {/* 좌측 진영 */}
      <div className="flex flex-col md:border-r border-slate-200 bg-white">
        <div className="py-1.5 px-4 border-b border-slate-100 flex items-center justify-between sticky top-0 z-10 bg-white/90 backdrop-blur-sm">
          <h4 className="text-[14px] font-[1000] text-blue-600 tracking-tight flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-blue-500 rounded-full" />
            {leftLabel} ({leftPosts.length})
          </h4>
        </div>
        <div className="flex-1">
          {leftPosts.map(post => (
            <PostCard 
              key={post.id} post={post} onReply={setReplyTarget} onPostClick={onPostClick}
              onLikeClick={onLikeClick} currentNickname={currentNickname}
            />
          ))}
          {leftPosts.length === 0 && <div className="py-6 text-center text-slate-300 font-bold text-xs">첫 글을 남겨주세요.</div>}
        </div>
      </div>

      {/* 우측 진영 */}
      <div className="flex flex-col bg-white">
        <div className="py-1.5 px-4 border-b border-slate-100 flex items-center justify-between sticky top-0 z-10 bg-white/90 backdrop-blur-sm">
          <h4 className="text-[14px] font-[1000] text-rose-500 tracking-tight flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-rose-400 rounded-full" />
            {rightLabel} ({rightPosts.length})
          </h4>
        </div>
        <div className="flex-1">
          {rightPosts.map(post => (
            <PostCard 
              key={post.id} post={post} onReply={setReplyTarget} onPostClick={onPostClick}
              onLikeClick={onLikeClick} currentNickname={currentNickname}
            />
          ))}
          {rightPosts.length === 0 && <div className="py-6 text-center text-slate-300 font-bold text-xs">첫 글을 남겨주세요.</div>}
        </div>
      </div>
    </div>
  );
};

export default DebateBoard;
