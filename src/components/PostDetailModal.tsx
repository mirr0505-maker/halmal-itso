// src/components/PostDetailModal.tsx
import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot, doc, updateDoc, addDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import type { Post } from '../types';

interface Props {
  post: Post;
  onClose: () => void;
  currentNickname?: string;
  onLikeClick?: (e: React.MouseEvent | null, postId: string) => void;
  isFriend?: boolean;
  onToggleFriend?: (author: string) => void;
}

const PostDetailModal = ({ post, onClose, currentNickname, onLikeClick, isFriend, onToggleFriend }: Props) => {
  const [comments, setComments] = useState<Post[]>([]);
  const [newComment, setNewComment] = useState("");
  const [replyTarget, setReplyTarget] = useState<Post | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const qAll = query(collection(db, "posts"));
    const unsubscribe = onSnapshot(qAll, (snapshot) => {
      const allDocs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Post));
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
        author: currentNickname || "익명",
        content: newComment,
        parentId: replyTarget ? replyTarget.id : post.id,
        rootId: post.id,
        side: post.side,
        type: 'comment',
        createdAt: serverTimestamp(),
        likes: 0,
        likedBy: [],
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

  const getReputationLabel = (likes: number) => {
    if (likes >= 1000) return "확고";
    if (likes >= 500) return "우호";
    if (likes >= 100) return "약간 우호";
    if (likes < 0) return "적대";
    return "중립";
  };

  const formatKoreanNumber = (num: number) => {
    if (num >= 10000) return Math.floor(num / 10000) + '만';
    if (num >= 1000) return Math.floor(num / 1000) + '천';
    return num.toLocaleString();
  };

  const promoLevel = Math.min(post.likes || 0, 3);
  const isLikedByMe = currentNickname && post.likedBy?.includes(currentNickname);
  const isMyPost = post.author === currentNickname;

  const renderComments = (parentId: string, depth = 0) => {
    return comments.filter(c => c.parentId === parentId).map(comment => (
      <div key={comment.id} className={`${depth > 0 ? 'ml-6 border-l-2 border-slate-100 pl-4 mt-2' : 'mb-4'}`}>
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-black text-slate-700">👤 {comment.author}</span>
            {comment.author === currentNickname && (
              <div className="flex gap-2">
                <button onClick={() => {setEditingId(comment.id); setEditContent(comment.content);}} className="text-[10px] text-slate-400 font-bold">수정</button>
                <button onClick={() => deleteDoc(doc(db, "posts", comment.id))} className="text-[10px] text-slate-400 font-bold">삭제</button>
              </div>
            )}
          </div>
          {editingId === comment.id ? (
            <div className="flex flex-col gap-2">
              <textarea value={editContent} onChange={e => setEditContent(e.target.value)} className="w-full p-2 text-sm border rounded outline-none focus:border-slate-900" />
              <button onClick={() => handleUpdate(comment.id)} className="bg-slate-900 text-white text-[10px] py-1 rounded">저장</button>
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-600 font-medium">{comment.content}</p>
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
        
        <div className="p-6 border-b flex justify-between items-center bg-white shrink-0">
          <div className="flex gap-1.5 items-center">
            {[1, 2, 3].map((idx) => (
              <svg 
                key={idx}
                className={`w-5 h-5 transition-all duration-500 ${idx <= promoLevel ? 'text-rose-400 fill-current scale-110' : 'text-slate-100'}`} 
                viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" fill="none"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            ))}
          </div>
          <button onClick={onClose} className="font-black text-slate-400 hover:text-slate-900 text-xl transition-colors">✕</button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 md:p-8 no-scrollbar bg-[#FDFDFD]">
          <h3 className="text-2xl font-[1000] mb-3 leading-tight tracking-tight text-slate-900">{post.title}</h3>
          
          <div className="flex flex-wrap gap-2 mb-5">
            {(post.tags || []).map((tag, idx) => (
              <span key={idx} className="text-[11.5px] font-black text-blue-500 bg-blue-50 px-3 py-1 rounded-full">
                {tag.startsWith('#') ? tag : `#${tag}`}
              </span>
            ))}
          </div>

          {post.imageUrl && (
            <div className="w-full mb-8 rounded-[2rem] overflow-hidden border border-slate-100 shadow-sm">
              <img src={post.imageUrl} alt="Post" className="w-full h-auto object-cover max-h-[500px]" />
            </div>
          )}

          <div className="prose prose-slate max-w-none mb-10">
            <p className="text-[15.5px] text-slate-700 whitespace-pre-wrap leading-[1.8] font-bold">{post.content}</p>
          </div>

          <div className="flex items-center justify-between bg-slate-50 border border-slate-200 py-3.5 px-4 rounded-[1.5rem] mb-10">
            <div className="flex items-center gap-3 shrink-0">
              <div className="w-10 h-10 rounded-full bg-white overflow-hidden border border-slate-200 shadow-sm">
                 <img src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${post.author}`} alt="avatar" className="w-full h-full object-cover" />
              </div>
              <div className="flex flex-col">
                <span className="font-[1000] text-[12.5px] text-slate-900 leading-none mb-1.5">{post.author}</span>
                <span className="text-[10px] text-slate-400 font-bold tracking-tight">
                  Lv.{post.authorInfo?.level || 1} · {getReputationLabel(post.authorInfo?.totalLikes || 0)} · 깐부 {formatKoreanNumber(post.authorInfo?.friendCount || 0)}
                </span>
              </div>
            </div>

            {/* 🚀 가운데: 모던 핑크 하트 버튼 */}
            <div className="flex-1 flex justify-center items-center px-4">
              <button 
                onClick={(e) => onLikeClick?.(null, post.id)}
                className={`flex items-center gap-2 px-5 py-2 rounded-full transition-all duration-300 active:scale-150 hover:scale-105 shadow-sm border ${isLikedByMe ? 'bg-rose-400 text-white border-rose-400 shadow-rose-100' : 'bg-white text-rose-300 border-rose-100 hover:bg-rose-50'}`}
              >
                <svg className={`w-5 h-5 transition-colors ${isLikedByMe ? 'fill-current' : 'fill-none'}`} viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                  <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
                </svg>
                <span className="text-[14px] font-[1000]">{formatKoreanNumber(post.likes || 0)}</span>
              </button>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {isMyPost && (
                <div className="flex gap-3 mr-1">
                  <button className="text-[11px] font-black text-blue-500 hover:text-blue-700 transition-colors">수정</button>
                  <button className="text-[11px] font-black text-rose-500 hover:text-rose-700 transition-colors">삭제</button>
                </div>
              )}
              {/* 🚀 항상 보이는 깐부 버튼 */}
              <button 
                onClick={() => onToggleFriend?.(post.author)}
                className={`px-4 py-2 text-[11px] font-black rounded-full border transition-all ${isFriend ? 'bg-white text-slate-400 border-slate-200 shadow-sm' : 'bg-slate-900 text-white border-slate-900 shadow-md'}`}
              >
                {isFriend ? '깐부해제' : '+ 깐부맺기'}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-[13px] font-black text-slate-400 mb-6 px-2 border-t border-slate-100 pt-6">
            <span className="italic font-bold">💬 댓글 {comments.length}개</span>
          </div>

          <div className="space-y-4">
            {renderComments(post.id)}
          </div>
        </div>
        
        <div className="p-4 bg-slate-50 border-t shrink-0">
          <form onSubmit={handleFullSubmit} className="flex gap-2">
            <input 
              type="text" value={newComment} onChange={e => setNewComment(e.target.value)}
              placeholder="예리한 한마디를 던져보시오..."
              className="flex-1 px-5 py-3 border-2 border-slate-100 rounded-2xl text-[13px] font-bold outline-none focus:border-slate-900 focus:bg-white transition-all shadow-inner"
            />
            <button type="submit" disabled={!newComment.trim() || isSubmitting} className="bg-slate-900 text-white px-8 rounded-2xl font-black text-[13px] shadow-lg active:scale-95 disabled:opacity-50">전송 🚀</button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PostDetailModal;