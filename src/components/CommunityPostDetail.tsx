// src/components/CommunityPostDetail.tsx — 커뮤니티 글 상세 오버레이 (댓글 + 좋아요)
// 🚀 CommunityView + CommunityFeed 양쪽에서 재사용
import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, doc, setDoc, updateDoc, query, where, orderBy, onSnapshot, increment, serverTimestamp, arrayUnion, arrayRemove } from 'firebase/firestore';
import type { CommunityPost, CommunityMember, UserData, FirestoreTimestamp } from '../types';
import { sanitizeHtml } from '../sanitize';
import { calculateLevel, getReputationLabel, getReputationScore, formatKoreanNumber } from '../utils';
import VerifiedBadgeComponent from './VerifiedBadge';

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
  const [comments, setComments] = useState<{id: string; author: string; author_id?: string; content: string; createdAt?: FirestoreTimestamp}[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 🚀 글 실시간 구독 (좋아요 등 즉시 반영)
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
      setComments(snap.docs.map(d => ({ id: d.id, ...d.data() } as { id: string; author: string; author_id?: string; content: string; createdAt?: FirestoreTimestamp })));
    }, (err) => console.error('[community_post_comments onSnapshot]', err));
    return () => unsub();
  }, [post.id]);

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
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'community_posts', post.id), { commentCount: increment(1) });
      if (newComment.trim().length >= 10) {
        await updateDoc(doc(db, 'users', currentUserData.uid), { exp: increment(2) });
      }
      setNewComment('');
    } finally { setIsSubmitting(false); }
  };

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

  const formatTime = (ts: { seconds: number } | null | undefined) => {
    if (!ts) return '';
    const d = new Date(ts.seconds * 1000);
    const diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return '방금 전';
    if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
    return d.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' });
  };

  const isLiked = currentUserData && livePost.likedBy?.includes(currentUserData.nickname);

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
          {/* 🚀 하단: AnyTalkList 글카드와 동일 구조 (공유 제외) */}
          {(() => {
            const authorData = allUsers[`nickname_${livePost.author}`];
            const displayLevel = calculateLevel(authorData?.exp || 0);
            const repLabel = getReputationLabel(authorData ? getReputationScore(authorData) : 0);
            const realFollowers = followerCounts[livePost.author] || 0;
            return (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-slate-50 overflow-hidden shrink-0 border border-white shadow-sm ring-1 ring-slate-100">
                    <img src={authorData?.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${livePost.author}`} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-[12px] font-[1000] text-slate-900 truncate leading-none">{livePost.author}</span>
                      <VerifiedBadgeComponent verified={members.find(m => m.userId === livePost.author_id)?.verified} size="sm" showDate={false} />
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 truncate tracking-tight">
                      Lv {displayLevel} · {repLabel} · 깐부수 {formatKoreanNumber(realFollowers)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-[11px] font-black shrink-0 text-slate-300">
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                    {formatKoreanNumber(livePost.commentCount || 0)}
                  </span>
                  {(livePost.thanksballTotal || 0) > 0 && (
                    <span className="flex items-center gap-0.5 text-amber-400">
                      <span className="text-[13px]">⚾</span> {livePost.thanksballTotal}
                    </span>
                  )}
                  <span
                    onClick={handleLike}
                    className={`flex items-center gap-1 cursor-pointer transition-colors ${isLiked ? 'text-rose-500' : 'hover:text-rose-400'}`}
                  >
                    <svg className={`w-3.5 h-3.5 ${isLiked ? 'fill-current' : 'fill-none'}`} stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
                    {formatKoreanNumber(livePost.likes || 0)}
                  </span>
                </div>
              </div>
            );
          })()}
        </div>
        {/* 댓글 목록 */}
        <div className="px-6 pb-2 border-t border-slate-100">
          {comments.map(c => (
            <div key={c.id} className="py-3 border-b border-slate-50 last:border-0">
              <div className="flex items-center gap-2 mb-1">
                <img src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${c.author}`} className="w-5 h-5 rounded-full bg-slate-50" alt="" />
                <span className="text-[12px] font-bold text-slate-700">{c.author}</span>
                <VerifiedBadgeComponent verified={members.find(m => m.userId === c.author_id)?.verified} size="sm" showDate={false} />
                <span className="text-[10px] font-bold text-slate-300">{formatTime(c.createdAt)}</span>
              </div>
              <p className="text-[13px] font-medium text-slate-600 pl-7">{c.content}</p>
            </div>
          ))}
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
      </div>
    </div>
  );
};

export default CommunityPostDetail;
