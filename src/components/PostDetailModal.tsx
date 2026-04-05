// src/components/PostDetailModal.tsx
import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth } from '../firebase';
import type { Post, UserData } from '../types';
import { getReputationLabel, getReputationScore, formatKoreanNumber, calculateLevel } from '../utils';
import { sanitizeHtml } from '../sanitize';

interface Props {
  post: Post;
  onClose: () => void;
  currentNickname?: string;
  onLikeClick?: (e: React.MouseEvent | null, postId: string) => void;
  isFriend?: boolean;
  onToggleFriend?: (author: string) => void;
  allUsers?: Record<string, UserData>;
  followerCounts?: Record<string, number>;
  toggleBlock?: (author: string) => void;
  isBlocked?: boolean;
}

const PostDetailModal = ({ post, onClose, currentNickname, onLikeClick, isFriend, onToggleFriend, allUsers = {}, followerCounts = {}, toggleBlock, isBlocked }: Props) => {
  const [comments, setComments] = useState<Post[]>([]);
  const [newComment, setNewComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 🚀 실시간 데이터 바인딩
  const authorData = (post.author_id && allUsers[post.author_id]) || allUsers[`nickname_${post.author}`];
  const realFollowers = followerCounts[post.author] || 0;
  const displayLevel = calculateLevel(authorData?.exp || 0);
  const displayLikes = authorData ? authorData.likes : (post.authorInfo?.totalLikes || 0);

  useEffect(() => {
    // 🚀 comments 컬렉션에서 읽기 (posts 컬렉션 아님)
    const q = query(collection(db, "comments"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const descendantDocs = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() } as Post))
        .filter(d => d.rootId === post.id);
      descendantDocs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setComments(descendantDocs);
    });
    return () => unsubscribe();
  }, [post.id]);

  const handleFullSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      // 🚀 수동 ID: CLAUDE.md 규칙 — comment_timestamp_uid 형식 (자동 ID 금지)
      const uid = auth.currentUser?.uid || 'anon';
      const commentId = `comment_${Date.now()}_${uid}`;
      await setDoc(doc(db, "comments", commentId), {
        author: currentNickname || "익명",
        author_id: uid,
        content: newComment,
        parentId: post.id,
        rootId: post.id,
        side: 'left',
        type: 'comment',
        createdAt: serverTimestamp(),
        likes: 0,
        likedBy: [],
        dislikes: 0
      });
      setNewComment("");
    } catch (err) { console.error(err); } finally { setIsSubmitting(false); }
  };

  const isLikedByMe = currentNickname && post.likedBy?.includes(currentNickname);
  const isMyPost = post.author === currentNickname;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in" onClick={onClose}>
      <div className="bg-white w-full max-w-2xl max-h-[90vh] rounded-[2.5rem] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b flex justify-between items-center bg-white shrink-0">
          <h3 className="font-black text-slate-400 text-xs uppercase tracking-widest">게시글 상세보기</h3>
          <button onClick={onClose} className="font-black text-slate-400 hover:text-slate-900 text-xl transition-colors">✕</button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 md:p-8 no-scrollbar bg-[#FDFDFD]">
          <h3 className="text-2xl font-[1000] mb-6 leading-tight tracking-tight text-slate-900">{post.title}</h3>
          
          {post.imageUrl && (
            <div className="w-full mb-8 rounded-[2rem] overflow-hidden border border-slate-100 shadow-sm">
              <img src={post.imageUrl} alt="" className="w-full h-auto object-cover max-h-[500px]" />
            </div>
          )}

          <div
            className="max-w-none mb-10 text-[15.5px] text-slate-700 leading-[1.8] font-medium [&_p]:mb-4 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-4 [&_li]:mb-1 [&_strong]:font-bold [&_em]:italic [&_a]:text-blue-600 [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-slate-200 [&_blockquote]:pl-4 [&_blockquote]:text-slate-500 [&_h1]:text-2xl [&_h1]:font-black [&_h2]:text-xl [&_h2]:font-black [&_h3]:text-lg [&_h3]:font-black"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.content) }}
          />

          <div className="bg-slate-50 border border-slate-200 p-5 rounded-[1.5rem] mb-10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-white overflow-hidden border border-slate-200 shadow-sm shrink-0">
                  <img src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${post.author}`} alt="" />
                </div>
                <div className="flex flex-col">
                  <span className="font-[1000] text-[15px] text-slate-900">{post.author}</span>
                  <span className="text-[11px] text-slate-400 font-bold">
                    Lv {displayLevel} · {getReputationLabel(authorData ? getReputationScore(authorData) : displayLikes)} · 깐부수 {formatKoreanNumber(realFollowers)}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                {!isMyPost && (
                  <>
                    <button 
                      onClick={() => toggleBlock?.(post.author)}
                      className={`px-3 py-1.5 text-[10px] font-black rounded-lg border transition-all ${isBlocked ? 'bg-rose-500 text-white border-rose-500' : 'text-slate-400 border-slate-200 hover:bg-slate-100'}`}
                    >
                      {isBlocked ? '차단됨' : '차단하기'}
                    </button>
                    <button 
                      onClick={() => onToggleFriend?.(post.author)}
                      className={`px-4 py-1.5 text-[10px] font-black rounded-lg border transition-all ${isFriend ? 'bg-white text-slate-400 border-slate-200' : 'bg-blue-600 text-white border-blue-600 shadow-md'}`}
                    >
                      {isFriend ? '깐부해제' : '+ 깐부맺기'}
                    </button>
                  </>
                )}
              </div>
            </div>
            
            <div className="flex justify-center border-t border-slate-200 pt-4">
              <button onClick={() => onLikeClick?.(null, post.id)} className={`flex items-center gap-2 px-6 py-2.5 rounded-full transition-all border ${isLikedByMe ? 'bg-rose-400 text-white border-rose-400 shadow-rose-100' : 'bg-white text-rose-300 border-rose-100 hover:bg-rose-50'}`}>
                <svg className={`w-5 h-5 ${isLikedByMe ? 'fill-current' : 'fill-none'}`} viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" /></svg>
                <span className="text-[15px] font-black">{formatKoreanNumber(post.likes || 0)}</span>
              </button>
            </div>
          </div>

          <div className="px-2 border-t border-slate-100 pt-6">
            <span className="text-[13px] font-black text-slate-400 italic mb-6 block">💬 댓글 {formatKoreanNumber(comments.length)}개</span>
            <div className="space-y-4">
              {comments.map(comment => (
                <div key={comment.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-black text-slate-700">👤 {comment.author}</span>
                  </div>
                  <p className="text-sm text-slate-600 font-medium">{comment.content}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 bg-slate-50 border-t shrink-0">
          <form onSubmit={handleFullSubmit} className="flex gap-2">
            <input 
              type="text" value={newComment} onChange={e => setNewComment(e.target.value)} 
              placeholder="예리한 한마디를 남겨보세요..." 
              className="flex-1 px-5 py-3 border-2 border-slate-100 rounded-2xl text-[13px] font-bold outline-none focus:border-slate-900 focus:bg-white transition-all shadow-inner" 
            />
            <button type="submit" disabled={!newComment.trim() || isSubmitting} className="bg-slate-900 text-white px-8 rounded-2xl font-black text-[13px] shadow-lg active:scale-95 disabled:opacity-50 transition-all">전송 🚀</button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PostDetailModal;
