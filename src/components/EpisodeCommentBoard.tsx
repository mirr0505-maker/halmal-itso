// src/components/EpisodeCommentBoard.tsx — 마르지 않는 잉크병: 회차 댓글 목록
// 🖋️ 시간순 댓글 + 작가 본인 댓글 강조 (✍️ 작가 뱃지 + 배경색)
// 🖋️ Phase 4-E: 좋아요 + 땡스볼 인터랙션
// 🖋️ Phase 4-I: 인라인 수정/삭제 (작성자=수정+삭제, 작가=삭제만)
// 🖋️ Phase 5-C: Soft delete + placeholder
// 🖋️ Phase 5-D: 1단계 답글 (parentCommentId, depth 1 제한)
import { useState, useMemo } from 'react';
import { doc, updateDoc, arrayUnion, arrayRemove, increment } from 'firebase/firestore';
import { db } from '../firebase';
import type { Post } from '../types';
import EpisodeCommentForm from './EpisodeCommentForm';

interface EpisodeCommentBoardProps {
  episodeId: string;
  authorId: string;       // 작품 작가 UID — 작가 본인 댓글 강조용
  comments: Post[];
  currentUserUid: string | null;
  currentUserNickname: string;
  onThanksballClick?: (comment: Post) => void;
}

// 상대 시간 포맷 (방금 전 / N분 전 / N시간 전 / 날짜)
const formatRelativeTime = (ts: { seconds: number } | null | undefined): string => {
  if (!ts?.seconds) return '';
  const d = new Date(ts.seconds * 1000);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return '방금 전';
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
};

const EpisodeCommentBoard = ({ episodeId, authorId, comments, currentUserUid, currentUserNickname, onThanksballClick }: EpisodeCommentBoardProps) => {
  // Phase 4-I: 인라인 수정 모드 상태
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // 🖋️ Phase 5-D: 답글 폼 토글 (한 번에 하나의 답글 폼만 열림)
  const [replyingToCommentId, setReplyingToCommentId] = useState<string | null>(null);

  // 🖋️ Phase 5-D: 원댓글과 답글 분리 + 답글은 부모 ID로 그룹화
  const rootComments = useMemo(() => comments.filter((c) => !c.parentCommentId), [comments]);
  const repliesMap = useMemo(() => {
    const map: Record<string, Post[]> = {};
    comments
      .filter((c) => !!c.parentCommentId)
      .forEach((reply) => {
        const pid = reply.parentCommentId!;
        if (!map[pid]) map[pid] = [];
        map[pid].push(reply);
      });
    Object.keys(map).forEach((k) => {
      map[k].sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
    });
    return map;
  }, [comments]);

  // 권한 헬퍼
  const canEditComment = (comment: Post): boolean => {
    if (!currentUserUid) return false;
    return comment.author_id === currentUserUid;
  };
  const canDeleteComment = (comment: Post): boolean => {
    if (!currentUserUid) return false;
    return comment.author_id === currentUserUid || authorId === currentUserUid;
  };

  // 수정 시작 / 취소
  const handleStartEdit = (comment: Post) => {
    if (!canEditComment(comment)) return;
    setEditingCommentId(comment.id);
    setEditContent(comment.content || '');
    setEditError(null);
  };
  const handleCancelEdit = () => {
    setEditingCommentId(null);
    setEditContent('');
    setEditError(null);
  };

  // 수정 저장
  const handleSaveEdit = async (comment: Post) => {
    if (submitting) return;
    const trimmed = editContent.trim();
    if (!trimmed) { setEditError('댓글 내용을 입력해주세요.'); return; }
    if (trimmed.length > 500) { setEditError('댓글은 500자 이하로 작성해주세요.'); return; }
    if (trimmed === comment.content) { handleCancelEdit(); return; }

    setSubmitting(true);
    setEditError(null);
    try {
      await updateDoc(doc(db, 'comments', comment.id), { content: trimmed });
      handleCancelEdit();
    } catch (err: unknown) {
      console.error('[EpisodeCommentBoard] 수정 실패:', err);
      const msg = err instanceof Error ? err.message : '수정 중 오류가 발생했습니다.';
      setEditError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Phase 5-C: Soft delete
  const handleDeleteComment = async (comment: Post) => {
    if (!canDeleteComment(comment)) return;
    const isAuthorDeleting = comment.author_id !== currentUserUid && authorId === currentUserUid;
    const message = isAuthorDeleting
      ? `다른 사용자(${comment.author})의 댓글을 삭제하시겠습니까?\n\n댓글 내용은 사라지고 "삭제된 댓글" 표시가 남습니다.\n작가 권한으로 처리됩니다.`
      : '정말 이 댓글을 삭제하시겠습니까?\n댓글 내용은 사라지고 "삭제된 댓글" 표시가 남습니다.';
    if (!window.confirm(message)) return;
    try {
      await updateDoc(doc(db, 'comments', comment.id), { isDeleted: true });
    } catch (err: unknown) {
      console.error('[EpisodeCommentBoard] soft delete 실패:', err);
      const msg = err instanceof Error ? err.message : '삭제 중 오류가 발생했습니다.';
      alert(msg);
    }
  };

  // Phase 4-E: 댓글 좋아요 토글
  const handleLikeClick = async (comment: Post) => {
    if (!currentUserUid || !currentUserNickname) {
      alert('로그인이 필요합니다.');
      return;
    }
    if (comment.author_id === currentUserUid) {
      alert('자신의 댓글에는 좋아요를 누를 수 없습니다.');
      return;
    }
    const likedBy = comment.likedBy || [];
    const isLiked = likedBy.includes(currentUserNickname);
    const diff = isLiked ? -1 : 1;
    try {
      await updateDoc(doc(db, 'comments', comment.id), {
        likes: Math.max(0, (comment.likes || 0) + diff),
        likedBy: isLiked ? arrayRemove(currentUserNickname) : arrayUnion(currentUserNickname),
      });
      if (comment.author_id) {
        await updateDoc(doc(db, 'users', comment.author_id), { likes: increment(diff * 3) });
      }
      const newLikes = (comment.likes || 0) + diff;
      if (diff === 1 && newLikes === 3 && comment.author_id) {
        await updateDoc(doc(db, 'users', comment.author_id), { exp: increment(5) });
      }
    } catch (err: unknown) {
      console.error('[EpisodeCommentBoard] 좋아요 실패:', err);
      const msg = err instanceof Error ? err.message : '좋아요 처리 중 오류가 발생했습니다.';
      alert(msg);
    }
  };

  // 🖋️ 단일 댓글 아이템 렌더 (원댓글/답글 공통) — isReply로 일부 동작 차이만 분기
  const renderCommentItem = (comment: Post, isReply: boolean) => {
    // Soft delete placeholder
    if (comment.isDeleted) {
      return (
        <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded text-center text-xs text-slate-400 font-bold">
          🗑️ 삭제된 {isReply ? '답글' : '댓글'}입니다
        </div>
      );
    }

    const isAuthorComment = !!(comment.author_id && comment.author_id === authorId);

    return (
      <div className={`${isAuthorComment && !isReply ? 'bg-purple-50/40' : ''} ${!isReply ? 'px-4 py-3' : ''}`}>
        <div className="flex items-start gap-3">
          {/* 아바타 */}
          <div className={`${isReply ? 'w-6 h-6 text-[10px]' : 'w-8 h-8 text-xs'} rounded-full bg-slate-200 flex items-center justify-center font-[1000] text-slate-500 flex-shrink-0`}>
            {comment.author?.[0] || '?'}
          </div>

          {/* 본문 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-[12px] font-[1000] text-slate-800">{comment.author}</span>
              {isAuthorComment && (
                <span className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 text-slate-600 text-[9px] font-[1000] rounded">
                  ✍️ 작가
                </span>
              )}
              <span className="text-[10px] text-slate-500 font-bold">{formatRelativeTime(comment.createdAt)}</span>
            </div>

            {/* 인라인 수정 모드 / 일반 모드 */}
            {editingCommentId === comment.id ? (
              <div className="mb-2">
                <textarea
                  value={editContent}
                  onChange={(e) => {
                    setEditContent(e.target.value);
                    if (editError) setEditError(null);
                  }}
                  maxLength={500}
                  rows={3}
                  autoFocus
                  className="w-full px-2 py-1.5 border border-blue-300 rounded text-[12px] resize-none focus:outline-none focus:border-blue-500"
                />
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-slate-500 font-bold">{editContent.length}/500</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={handleCancelEdit}
                      disabled={submitting}
                      className="px-2 py-1 text-[11px] text-slate-500 hover:text-slate-900 font-bold transition-colors"
                    >
                      취소
                    </button>
                    <button
                      onClick={() => handleSaveEdit(comment)}
                      disabled={submitting || !editContent.trim()}
                      className="px-3 py-1 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white rounded text-[11px] font-[1000] transition-colors"
                    >
                      {submitting ? '저장 중...' : '저장'}
                    </button>
                  </div>
                </div>
                {editError && <p className="text-[10px] text-red-500 mt-1 font-bold">{editError}</p>}
              </div>
            ) : (
              <p className="text-[12px] text-slate-700 whitespace-pre-wrap break-words mb-2 leading-relaxed">
                {comment.content}
              </p>
            )}

            {/* 액션 버튼 영역 — 수정 모드일 땐 숨김 */}
            {editingCommentId !== comment.id && (
              <div className="flex items-center gap-3 text-xs">
                {/* 좋아요 */}
                {(() => {
                  const isMine = !!(currentUserUid && comment.author_id === currentUserUid);
                  const isLiked = !!(currentUserNickname && comment.likedBy?.includes(currentUserNickname));
                  return (
                    <button
                      onClick={() => handleLikeClick(comment)}
                      disabled={isMine}
                      className={`flex items-center gap-1 transition-colors font-bold ${
                        isMine
                          ? 'text-slate-300 cursor-not-allowed'
                          : isLiked
                            ? 'text-rose-500 hover:text-rose-600'
                            : 'text-slate-400 hover:text-rose-500'
                      }`}
                    >
                      <span>{isLiked ? '❤️' : '🤍'}</span>
                      <span>{comment.likes || 0}</span>
                    </button>
                  );
                })()}

                {/* 땡스볼 */}
                {comment.author_id !== currentUserUid && onThanksballClick && (
                  <button
                    onClick={() => onThanksballClick(comment)}
                    className="flex items-center gap-1 text-slate-400 hover:text-amber-500 transition-colors font-bold"
                  >
                    <span>🏀</span>
                    <span>{comment.thanksballTotal || 0}</span>
                  </button>
                )}
                {comment.author_id === currentUserUid && (comment.thanksballTotal || 0) > 0 && (
                  <span className="flex items-center gap-1 text-slate-400 font-bold">
                    <span>🏀</span>
                    <span>{comment.thanksballTotal}</span>
                  </span>
                )}

                {/* 🖋️ Phase 5-D: 답글 쓰기 — 원댓글에만 (depth 1 제한) */}
                {!isReply && currentUserUid && (
                  <button
                    onClick={() => setReplyingToCommentId(replyingToCommentId === comment.id ? null : comment.id)}
                    className="text-slate-400 hover:text-blue-500 font-bold transition-colors"
                  >
                    💬 답글
                  </button>
                )}

                {/* 수정 */}
                {canEditComment(comment) && (
                  <button
                    onClick={() => handleStartEdit(comment)}
                    className="text-slate-400 hover:text-blue-500 font-bold transition-colors"
                  >
                    ✏️ 수정
                  </button>
                )}

                {/* 삭제 */}
                {canDeleteComment(comment) && (
                  <button
                    onClick={() => handleDeleteComment(comment)}
                    className="text-slate-400 hover:text-red-500 font-bold transition-colors"
                  >
                    🗑️ {comment.author_id !== currentUserUid && authorId === currentUserUid ? '삭제(작가)' : '삭제'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (rootComments.length === 0) {
    return (
      <div className="py-6 text-center text-slate-500 text-[12px] font-bold italic">
        아직 댓글이 없어요. 첫 감상을 남겨보세요!
      </div>
    );
  }

  return (
    <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
      {rootComments.map((comment) => {
        const replies = repliesMap[comment.id] || [];
        return (
          <div key={comment.id} className="border-b border-slate-100 last:border-b-0">
            {/* 원댓글 (placeholder도 동일 컨테이너 안에서 처리) */}
            {comment.isDeleted ? (
              <div className="px-4 py-3">
                {renderCommentItem(comment, false)}
              </div>
            ) : (
              renderCommentItem(comment, false)
            )}

            {/* 🖋️ Phase 5-D: 답글 폼 (토글) */}
            {replyingToCommentId === comment.id && currentUserUid && (
              <div className="ml-12 mr-4 mb-3 pl-3 border-l-2 border-blue-200">
                <EpisodeCommentForm
                  episodeId={episodeId}
                  currentUserUid={currentUserUid}
                  currentUserNickname={currentUserNickname}
                  parentCommentId={comment.id}
                  placeholder={`${comment.author}님에게 답글 작성...`}
                  onSubmitted={() => setReplyingToCommentId(null)}
                />
              </div>
            )}

            {/* 🖋️ Phase 5-D: 답글 목록 (들여쓰기) — placeholder 원댓글 아래에도 표시 */}
            {replies.length > 0 && (
              <div className="ml-12 mr-4 mb-3 pl-3 border-l-2 border-slate-200 space-y-2">
                {replies.map((reply) => (
                  <div key={reply.id}>
                    {renderCommentItem(reply, true)}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default EpisodeCommentBoard;
