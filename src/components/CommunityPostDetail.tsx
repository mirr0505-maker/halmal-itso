// src/components/CommunityPostDetail.tsx — 커뮤니티 글 상세 오버레이
// 🚀 CommunityView + CommunityFeed 양쪽에서 재사용
// 댓글: 좋아요·땡스볼·수정·삭제·고정 (DebateBoard 패턴)
import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, doc, setDoc, updateDoc, deleteDoc, query, where, orderBy, onSnapshot, increment, serverTimestamp, arrayUnion, arrayRemove } from 'firebase/firestore';
import type { CommunityPost, CommunityMember, UserData, FirestoreTimestamp } from '../types';
import { sanitizeHtml } from '../sanitize';
import { calculateLevel, getReputationLabel, getReputationScore, formatKoreanNumber } from '../utils';
import VerifiedBadgeComponent from './VerifiedBadge';
import ThanksballModal from './ThanksballModal';

// 🚀 댓글 타입 (community_post_comments 문서 구조)
interface CommunityComment {
  id: string;
  author: string;
  author_id?: string;
  content: string;
  createdAt?: FirestoreTimestamp;
  likes?: number;
  likedBy?: string[];
  thanksballTotal?: number;
}

interface Props {
  post: CommunityPost;
  currentUserData: UserData | null;
  allUsers?: Record<string, UserData>;
  followerCounts?: Record<string, number>;
  members: CommunityMember[];
  onClose: () => void;
}

const CommunityPostDetail = ({ post, currentUserData, allUsers = {}, followerCounts = {}, members, onClose }: Props) => {
  const [livePost, setLivePost] = useState(post);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  // 🚀 댓글 수정
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  // 🚀 땡스볼 (글 + 댓글)
  const [thanksballTarget, setThanksballTarget] = useState<{ docId: string; recipient: string } | null>(null);
  const [postThanksballOpen, setPostThanksballOpen] = useState(false);

  const isPostAuthor = currentUserData && livePost.author_id === currentUserData.uid;

  // 🚀 글 실시간 구독 (좋아요·댓글수·pinnedCommentId 즉시 반영)
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'community_posts', post.id), (snap) => {
      if (snap.exists()) setLivePost({ id: snap.id, ...snap.data() } as CommunityPost);
    }, () => {});
    return () => unsub();
  }, [post.id]);

  // 🚀 댓글 실시간 구독
  useEffect(() => {
    const q = query(
      collection(db, 'community_post_comments'),
      where('postId', '==', post.id),
      orderBy('createdAt', 'asc')
    );
    const unsub = onSnapshot(q, snap => {
      setComments(snap.docs.map(d => ({ id: d.id, ...d.data() } as CommunityComment)));
    }, (err) => console.error('[community_post_comments onSnapshot]', err));
    return () => unsub();
  }, [post.id]);

  // 🚀 댓글 작성
  const handleCommentSubmit = async () => {
    if (!currentUserData || !newComment.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const commentId = `cpcomment_${Date.now()}_${currentUserData.uid}`;
      await setDoc(doc(db, 'community_post_comments', commentId), {
        postId: post.id,
        communityId: post.communityId,
        author: currentUserData.nickname,
        author_id: currentUserData.uid,
        content: newComment.trim(),
        likes: 0,
        likedBy: [],
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'community_posts', post.id), { commentCount: increment(1) });
      if (newComment.trim().length >= 10) {
        await updateDoc(doc(db, 'users', currentUserData.uid), { exp: increment(2) });
      }
      setNewComment('');
    } finally { setIsSubmitting(false); }
  };

  // 🚀 글 좋아요
  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUserData) return;
    const isLiked = livePost.likedBy?.includes(currentUserData.nickname);
    const diff = isLiked ? -1 : 1;
    await updateDoc(doc(db, 'community_posts', post.id), {
      likes: Math.max(0, (livePost.likes || 0) + diff),
      likedBy: isLiked ? arrayRemove(currentUserData.nickname) : arrayUnion(currentUserData.nickname),
    });
    if (post.author_id) {
      await updateDoc(doc(db, 'users', post.author_id), { likes: increment(diff * 3) });
    }
  };

  // 🚀 댓글 좋아요
  const handleCommentLike = async (comment: CommunityComment) => {
    if (!currentUserData) return;
    const isLiked = comment.likedBy?.includes(currentUserData.nickname);
    const diff = isLiked ? -1 : 1;
    await updateDoc(doc(db, 'community_post_comments', comment.id), {
      likes: Math.max(0, (comment.likes || 0) + diff),
      likedBy: isLiked ? arrayRemove(currentUserData.nickname) : arrayUnion(currentUserData.nickname),
    });
  };

  // 🚀 댓글 삭제
  const handleCommentDelete = async (comment: CommunityComment) => {
    if (!window.confirm('이 댓글을 삭제하시겠습니까?')) return;
    await deleteDoc(doc(db, 'community_post_comments', comment.id));
    await updateDoc(doc(db, 'community_posts', post.id), { commentCount: increment(-1) });
    if (comment.author_id) updateDoc(doc(db, 'users', comment.author_id), { exp: increment(-2) }).catch(() => {});
  };

  // 🚀 댓글 수정 저장
  const handleCommentEditSave = async () => {
    if (!editingCommentId || !editingContent.trim()) return;
    await updateDoc(doc(db, 'community_post_comments', editingCommentId), { content: editingContent.trim() });
    setEditingCommentId(null);
    setEditingContent('');
  };

  // 🚀 댓글 고정/해제 (글 작성자만)
  const handlePinComment = async (commentId: string) => {
    if (!isPostAuthor) return;
    const newPinned = (livePost as CommunityPost & { pinnedCommentId?: string }).pinnedCommentId === commentId ? null : commentId;
    await updateDoc(doc(db, 'community_posts', post.id), { pinnedCommentId: newPinned });
  };

  const formatTime = (ts: { seconds: number } | null | undefined) => {
    if (!ts) return '';
    const d = new Date(ts.seconds * 1000);
    const diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return '방금 전';
    if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
    return d.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' });
  };

  const isLiked = currentUserData && livePost.likedBy?.includes(currentUserData.nickname);
  const pinnedCommentId = (livePost as CommunityPost & { pinnedCommentId?: string }).pinnedCommentId;
  // 고정 댓글을 맨 앞으로
  const sortedComments = pinnedCommentId
    ? [...comments].sort((a, b) => (a.id === pinnedCommentId ? -1 : b.id === pinnedCommentId ? 1 : 0))
    : comments;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="sticky top-0 bg-white flex items-center justify-between px-6 py-3 border-b border-slate-100 z-10">
          <span className="text-[12px] font-bold text-slate-400">{livePost.communityName}</span>
          <button onClick={onClose} className="text-slate-300 hover:text-slate-500 text-[20px] leading-none">×</button>
        </div>
        {/* 본문 */}
        <div className="px-6 py-5">
          {livePost.title && <h2 className="text-[20px] font-[1000] text-slate-900 mb-3">{livePost.title}</h2>}
          <div
            className="text-[14px] font-medium text-slate-700 leading-[1.8] [&_p]:mb-3 [&_strong]:font-bold [&_em]:italic [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_img]:rounded-lg [&_img]:max-w-full [&_a]:text-blue-400 [&_a]:underline"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(livePost.content) }}
          />
          {/* 🚀 글 작성자 카드 — RootPostCard 완전 동일 패턴 */}
          {(() => {
            const authorData = allUsers[`nickname_${livePost.author}`];
            const displayLevel = calculateLevel(authorData?.exp || 0);
            const repLabel = getReputationLabel(authorData ? getReputationScore(authorData) : 0);
            const realFollowers = followerCounts[livePost.author] || 0;
            const isMyPost = currentUserData && livePost.author_id === currentUserData.uid;
            return (
              <div className="mt-6 flex flex-col md:flex-row items-center justify-between gap-3 bg-slate-50 rounded-2xl px-5 py-4 border border-slate-100">
                {/* 좌측: 큰 아바타 + 닉네임 + Lv/평판/깐부수 */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-full bg-white overflow-hidden shrink-0 border-2 border-white shadow-md ring-1 ring-slate-200">
                    <img src={authorData?.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${livePost.author}`} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[15px] font-[1000] text-slate-900 truncate">{livePost.author}</span>
                      <VerifiedBadgeComponent verified={members.find(m => m.userId === livePost.author_id)?.verified} size="sm" showDate={false} />
                    </div>
                    <span className="text-[11px] font-bold text-slate-500 truncate">
                      Lv {displayLevel} · {repLabel} · 깐부수 {formatKoreanNumber(realFollowers)}
                    </span>
                  </div>
                </div>
                {/* 우측: 좋아요 + 땡스볼 + 깐부맺기 — RootPostCard 동일 */}
                <div className="flex items-center gap-2 w-full md:w-auto">
                  {/* ❤️ 좋아요 */}
                  <button
                    onClick={handleLike}
                    className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl transition-all font-[1000] text-[12px] whitespace-nowrap ${
                      isLiked
                        ? 'bg-[#FF2E56] text-white ring-2 ring-rose-300 scale-105'
                        : 'bg-white text-rose-400 border border-rose-200 hover:bg-rose-50'
                    }`}
                  >
                    <svg className="w-3.5 h-3.5 fill-current shrink-0" viewBox="0 0 24 24" stroke="none"><path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" /></svg>
                    {formatKoreanNumber(livePost.likes || 0)}
                  </button>
                  {/* ⚾ 땡스볼 — 본인도 표시하되 비활성 */}
                  <button
                    onClick={() => { if (!isMyPost && currentUserData) setPostThanksballOpen(true); }}
                    className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-[12px] font-[1000] whitespace-nowrap transition-all ${
                      isMyPost || !currentUserData
                        ? 'bg-white text-slate-300 border-slate-200 cursor-default'
                        : 'bg-white text-amber-500 border-amber-200 hover:bg-amber-50 cursor-pointer'
                    }`}
                  >
                    <span className="text-[14px] leading-none">⚾</span>
                    <span>{(livePost.thanksballTotal || 0) > 0 ? `${livePost.thanksballTotal}볼` : '땡스볼'}</span>
                  </button>
                  {/* + 깐부맺기 — 본인은 비활성 표시 */}
                  <button
                    className={`flex-1 md:flex-none px-3 py-2 text-[12px] font-[1000] rounded-xl border transition-all whitespace-nowrap ${
                      isMyPost
                        ? 'bg-white text-slate-300 border-slate-200 cursor-default'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    + 깐부맺기
                  </button>
                </div>
              </div>
            );
          })()}
        </div>

        {/* 🚀 댓글 목록 — DebateBoard 패턴 */}
        <div className="px-6 pb-2 border-t border-slate-100">
          <p className="text-[13px] font-[1000] text-slate-700 py-3">댓글 {livePost.commentCount || comments.length}</p>
        </div>
        <div className="px-6 pb-2">
          {sortedComments.map(c => {
            const cAuthorData = allUsers[`nickname_${c.author}`];
            const cLevel = calculateLevel(cAuthorData?.exp || 0);
            const cRepLabel = getReputationLabel(cAuthorData ? getReputationScore(cAuthorData) : 0);
            const cFollowers = followerCounts[c.author] || 0;
            const cIsLiked = currentUserData && c.likedBy?.includes(currentUserData.nickname);
            const cIsMine = currentUserData && c.author_id === currentUserData.uid;
            const cIsPinned = pinnedCommentId === c.id;
            const isEditing = editingCommentId === c.id;

            return (
              <div key={c.id} className={`py-3 border-b border-slate-50 last:border-0 ${cIsPinned ? 'bg-amber-50/50 -mx-6 px-6 border-l-2 border-l-amber-400' : ''}`}>
                {/* 고정 표시 */}
                {cIsPinned && (
                  <div className="text-[10px] font-black text-amber-600 mb-1.5 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>
                    작성자가 고정한 댓글
                  </div>
                )}
                {/* 댓글 헤더: 좌측 아바타+정보, 우측 액션 */}
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 border border-slate-200">
                      <img src={cAuthorData?.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${c.author}`} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[12px] font-[1000] text-slate-800 leading-none">{c.author}</span>
                        <VerifiedBadgeComponent verified={members.find(m => m.userId === c.author_id)?.verified} size="sm" showDate={false} />
                        <span className="text-[9px] font-bold text-slate-300">{formatTime(c.createdAt)}</span>
                      </div>
                      <span className="text-[9px] text-slate-400 font-bold leading-tight mt-0.5">
                        Lv {cLevel} · {cRepLabel} · 깐부수 {formatKoreanNumber(cFollowers)}
                      </span>
                    </div>
                  </div>
                  {/* 우측 액션: 좋아요·땡스볼·수정·삭제·고정 */}
                  <div className="flex items-center gap-2 shrink-0">
                    {/* 좋아요 */}
                    <button onClick={() => handleCommentLike(c)}
                      className={`flex items-center gap-0.5 text-[11px] font-bold transition-colors ${cIsLiked ? 'text-rose-500' : 'text-slate-300 hover:text-rose-400'}`}>
                      <svg className={`w-3 h-3 ${cIsLiked ? 'fill-current' : 'fill-none'}`} stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                      {(c.likes || 0) > 0 && <span>{c.likes}</span>}
                    </button>
                    {/* 땡스볼 */}
                    {currentUserData && !cIsMine ? (
                      <button onClick={() => setThanksballTarget({ docId: c.id, recipient: c.author })}
                        className="flex items-center gap-0.5 text-[11px] font-bold text-slate-300 hover:text-amber-500 transition-colors">
                        <span className="text-[13px] leading-none">⚾</span>
                        {(c.thanksballTotal || 0) > 0 && <span className="text-amber-400">{c.thanksballTotal}</span>}
                      </button>
                    ) : (c.thanksballTotal || 0) > 0 ? (
                      <span className="flex items-center gap-0.5 text-[11px] font-bold text-amber-400">
                        <span className="text-[13px] leading-none">⚾</span>{c.thanksballTotal}
                      </span>
                    ) : null}
                    {/* 수정 (본인만) */}
                    {cIsMine && (
                      <button onClick={() => { setEditingCommentId(c.id); setEditingContent(c.content); }}
                        className="text-[10px] font-bold text-slate-300 hover:text-blue-500 transition-colors">수정</button>
                    )}
                    {/* 삭제 (본인만) */}
                    {cIsMine && (
                      <button onClick={() => handleCommentDelete(c)}
                        className="text-slate-300 hover:text-rose-500 transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h14" /></svg>
                      </button>
                    )}
                    {/* 고정 (글 작성자만) */}
                    {isPostAuthor && (
                      <button onClick={() => handlePinComment(c.id)}
                        title={cIsPinned ? '고정 해제' : '댓글 고정'}
                        className={`transition-colors ${cIsPinned ? 'text-amber-500' : 'text-slate-300 hover:text-amber-400'}`}>
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>
                      </button>
                    )}
                  </div>
                </div>
                {/* 댓글 본문 또는 수정 모드 */}
                {isEditing ? (
                  <div className="pl-9 flex gap-2 mt-1">
                    <input type="text" value={editingContent} onChange={(e) => setEditingContent(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleCommentEditSave(); }}
                      className="flex-1 bg-slate-50 rounded-lg px-3 py-1.5 text-[13px] font-medium text-slate-900 outline-none border border-blue-300" autoFocus />
                    <button onClick={handleCommentEditSave} className="text-[11px] font-bold text-blue-600 hover:text-blue-800 shrink-0">저장</button>
                    <button onClick={() => setEditingCommentId(null)} className="text-[11px] font-bold text-slate-400 hover:text-slate-600 shrink-0">취소</button>
                  </div>
                ) : (
                  <p className="text-[13px] font-medium text-slate-600 pl-9 mt-0.5">{c.content}</p>
                )}
              </div>
            );
          })}
        </div>

        {/* 댓글 입력 */}
        {currentUserData && (
          <div className="sticky bottom-0 bg-white px-6 py-3 border-t border-slate-100 flex gap-2">
            <input
              type="text"
              placeholder="댓글을 남겨보세요..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleCommentSubmit(); }}
              className="flex-1 bg-slate-50 rounded-lg px-3 py-2 text-[13px] font-bold text-slate-900 outline-none border border-transparent focus:border-blue-300 transition-colors placeholder:text-slate-300"
            />
            <button onClick={handleCommentSubmit} disabled={isSubmitting || !newComment.trim()} className={`px-4 rounded-lg text-[12px] font-bold transition-all ${isSubmitting || !newComment.trim() ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-900 text-white hover:bg-blue-600'}`}>
              등록
            </button>
          </div>
        )}

        {/* 🚀 글 땡스볼 모달 */}
        {postThanksballOpen && currentUserData && (
          <ThanksballModal
            postId={post.id}
            postAuthor={livePost.author}
            postTitle={livePost.title || '[커뮤니티 글]'}
            currentNickname={currentUserData.nickname}
            allUsers={allUsers}
            targetDocId={post.id}
            targetCollection="community_posts"
            onClose={() => setPostThanksballOpen(false)}
          />
        )}

        {/* 🚀 댓글 땡스볼 모달 */}
        {thanksballTarget && currentUserData && (
          <ThanksballModal
            postId={post.id}
            postAuthor={thanksballTarget.recipient}
            postTitle={livePost.title || '[커뮤니티 댓글]'}
            currentNickname={currentUserData.nickname}
            allUsers={allUsers}
            recipientNickname={thanksballTarget.recipient}
            targetDocId={thanksballTarget.docId}
            targetCollection="community_post_comments"
            onClose={() => setThanksballTarget(null)}
          />
        )}
      </div>
    </div>
  );
};

export default CommunityPostDetail;
