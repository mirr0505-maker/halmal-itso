// src/components/EpisodeCommentForm.tsx — 마르지 않는 잉크병: 회차 댓글 작성 폼
// 🖋️ 기존 useFirestoreActions.handleInlineReply와 동일한 comments 컬렉션 필드 구조 사용
// (author, author_id, content, parentId, rootId, side, type, authorInfo, createdAt, likes, dislikes)
import { useState } from 'react';
import { doc, setDoc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

interface EpisodeCommentFormProps {
  episodeId: string;
  currentUserUid: string | null;
  currentUserNickname: string;
  onSubmitted?: () => void;
  // 🖋️ Phase 5-D: 답글 모드 (parentCommentId가 있으면 대댓글로 저장)
  parentCommentId?: string;
  placeholder?: string;
}

const EpisodeCommentForm = ({ episodeId, currentUserUid, currentUserNickname, onSubmitted, parentCommentId, placeholder }: EpisodeCommentFormProps) => {
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!currentUserUid) {
      alert('로그인이 필요합니다.');
      return;
    }
    const trimmed = content.trim();
    if (!trimmed) {
      setError('댓글 내용을 입력해주세요.');
      return;
    }
    if (trimmed.length > 500) {
      setError('댓글은 500자 이하로 작성해주세요.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const customId = `comment_${Date.now()}_${currentUserUid}`;
      // 🚀 기존 handleInlineReply 패턴 그대로 — rootId === episodeId 유지 (답글도 같은 쿼리로 잡힘)
      // 🖋️ Phase 5-D: parentCommentId 있으면 답글, 없으면 원댓글
      await setDoc(doc(db, 'comments', customId), {
        author: currentUserNickname,
        author_id: currentUserUid,
        title: null,
        content: trimmed,
        parentId: episodeId,
        rootId: episodeId,
        side: 'left',
        type: 'comment',
        createdAt: serverTimestamp(),
        likes: 0,
        dislikes: 0,
        ...(parentCommentId ? { parentCommentId } : {}),
      });

      // posts.commentCount +1 (firestore.rules 카운터 화이트리스트에 commentCount 포함됨)
      await updateDoc(doc(db, 'posts', episodeId), {
        commentCount: increment(1),
      });

      setContent('');
      onSubmitted?.();
    } catch (err: unknown) {
      console.error('[EpisodeCommentForm] 댓글 작성 실패:', err);
      const msg = err instanceof Error ? err.message : '댓글 작성 중 오류가 발생했습니다.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!currentUserUid) {
    return (
      <div className="border border-slate-200 rounded-lg p-3 bg-white text-center text-[12px] text-slate-500 font-bold py-3">
        댓글을 작성하려면 로그인이 필요합니다
      </div>
    );
  }

  return (
    <div className="border border-slate-200 rounded-lg p-3 bg-white">
      <textarea
        value={content}
        onChange={(e) => {
          setContent(e.target.value);
          if (error) setError(null);
        }}
        maxLength={500}
        rows={3}
        placeholder={placeholder || '이 회차에 대한 감상을 남겨보세요...'}
        className="w-full px-3 py-2 border border-slate-200 rounded text-[15px] leading-[1.8] resize-none focus:outline-none focus:border-blue-500"
      />
      <div className="flex items-center justify-between mt-2">
        <span className="text-[10px] text-slate-500 font-bold">{content.length}/500</span>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || !content.trim()}
          className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded text-[11px] font-[1000] transition-colors"
        >
          {submitting ? '작성 중...' : (parentCommentId ? '답글 남기기' : '댓글 남기기')}
        </button>
      </div>
      {error && <p className="text-[10px] text-red-500 mt-2 font-bold">{error}</p>}
    </div>
  );
};

export default EpisodeCommentForm;
