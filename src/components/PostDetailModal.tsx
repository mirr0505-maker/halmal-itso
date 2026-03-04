// src/components/PostDetailModal.tsx
import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot, doc, updateDoc, addDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import type { Post } from '../types';

interface Props {
  post: Post;
  onClose: () => void;
}

const PostDetailModal = ({ post, onClose }: Props) => {
  const [comments, setComments] = useState<Post[]>([]);
  const [newComment, setNewComment] = useState("");
  const [replyTarget, setReplyTarget] = useState<Post | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // 실제로는 post.id를 부모로 가진 모든 자식들을 가져오기 위해 통합 쿼리를 사용합니다.
    const qAll = query(collection(db, "posts")); // 단순화를 위해 전체 로드 후 필터링 (데이터가 많아지면 쿼리 최적화 필요)
    
    const unsubscribe = onSnapshot(qAll, (snapshot) => {
      const allDocs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Post));
      // 현재 연계글(post.id)의 자손들만 필터링하는 로직
      const findChildren = (parentId: string): Post[] => {
        const direct = allDocs.filter(d => d.parentId === parentId);
        return direct.concat(direct.flatMap(d => findChildren(d.id)));
      };
      const descendantDocs = findChildren(post.id);
      descendantDocs.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
      setComments(descendantDocs);
    });
    return () => unsubscribe();
  }, [post.id]);

  const handleFullSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "posts"), {
        author: "흑무영",
        content: newComment,
        parentId: replyTarget ? replyTarget.id : post.id, // 🚀 대댓글 대상이 있으면 그 ID를, 없으면 연계글 ID를 부모로!
        side: post.side,
        type: 'comment',
        createdAt: serverTimestamp(),
        likes: 0,
        dislikes: 0
      });
      setNewComment("");
      setReplyTarget(null);
    } catch (err) { console.error(err); } finally { setIsSubmitting(false); }
  };

  const handleUpdate = async (postId: string) => {
    await updateDoc(doc(db, "posts", postId), { content: editContent });
    setEditingId(null);
  };

  const renderComments = (parentId: string, depth = 0) => {
    return comments.filter(c => c.parentId === parentId).map(comment => (
      <div key={comment.id} className={`${depth > 0 ? 'ml-6 border-l-2 border-slate-100 pl-4 mt-2' : 'mb-4'}`}>
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-black text-slate-700">👤 {comment.author}</span>
            {comment.author === "흑무영" && (
              <div className="flex gap-2">
                <button onClick={() => {setEditingId(comment.id); setEditContent(comment.content);}} className="text-[10px] text-slate-400">수정</button>
                <button onClick={() => deleteDoc(doc(db, "posts", comment.id))} className="text-[10px] text-slate-400">삭제</button>
              </div>
            )}
          </div>
          {editingId === comment.id ? (
            <div className="flex flex-col gap-2">
              <textarea value={editContent} onChange={e => setEditContent(e.target.value)} className="w-full p-2 text-sm border rounded" />
              <button onClick={() => handleUpdate(comment.id)} className="bg-slate-900 text-white text-[10px] py-1 rounded">저장</button>
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-600">{comment.content}</p>
              <button onClick={() => setReplyTarget(comment)} className="text-[10px] font-bold text-slate-400 mt-2">💬 답글 달기</button>
            </>
          )}
        </div>
        {renderComments(comment.id, depth + 1)}
      </div>
    ));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in" onClick={onClose}>
      <div className="bg-white w-full max-w-2xl max-h-[90vh] rounded-[2.5rem] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b flex justify-between items-center">
          <span className="text-xs font-black px-3 py-1 bg-slate-100 rounded-lg uppercase">Discussion</span>
          <button onClick={onClose} className="font-black text-slate-400">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          <h3 className="text-2xl font-black mb-4">{post.title}</h3>
          <p className="text-slate-600 mb-8 whitespace-pre-wrap">{post.content}</p>
          <div className="pt-8 border-t">
            {renderComments(post.id)}
          </div>
        </div>
        <div className="p-4 bg-slate-50 border-t">
          {replyTarget && (
            <div className="mb-2 flex justify-between items-center px-3 py-1 bg-white border rounded-lg">
              <span className="text-[10px] text-slate-400 font-bold">🎯 "{replyTarget.content}"에 답글 중</span>
              <button onClick={() => setReplyTarget(null)} className="text-[10px] text-rose-500 font-black">취소</button>
            </div>
          )}
          <form onSubmit={handleFullSubmit} className="flex gap-2">
            <input 
              type="text" value={newComment} onChange={e => setNewComment(e.target.value)}
              placeholder="당신의 예리한 한마디..." // 🚀 문구 수정 완료
              className="flex-1 p-3 border-2 rounded-xl text-sm font-bold outline-none focus:border-slate-900"
            />
            <button type="submit" className="bg-slate-900 text-white px-6 rounded-xl font-black text-sm">전송 🚀</button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PostDetailModal;