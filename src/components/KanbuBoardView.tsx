// src/components/KanbuBoardView.tsx — 깐부방 게시판 1개 뷰 (카드 리스트 + 상단 + 새 글)
// 3개 보드(자유/유료1회/유료구독) 공통 사용. boardType으로 필터.
import { useState } from 'react';
import { db } from '../firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import type { Post, UserData, KanbuRoom } from '../types';
import { calculateLevel } from '../utils';
import { sanitizeHtml } from '../sanitize';
import CreateKanbuPost from './CreateKanbuPost';

interface Props {
  room: KanbuRoom;
  boardType: 'free' | 'paid_once' | 'paid_monthly';
  posts: Post[];
  currentUserData: UserData;
  onPostClick: (post: Post) => void;
}

const KanbuBoardView = ({ room, boardType, posts, currentUserData, onPostClick }: Props) => {
  const [isCreating, setIsCreating] = useState(false);
  const boardPosts = posts
    .filter(p => (p.kanbuBoardType || 'free') === boardType)
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

  const handleSubmit = async (data: Partial<Post>) => {
    const postId = `kanbu_${Date.now()}_${currentUserData.uid}`;
    await setDoc(doc(db, 'posts', postId), {
      ...data,
      author: currentUserData.nickname,
      author_id: currentUserData.uid,
      authorInfo: { level: calculateLevel(currentUserData.exp || 0), friendCount: 0, totalLikes: currentUserData.likes || 0 },
      category: null,
      parentId: null,
      rootId: null,
      side: 'left',
      type: 'formal',
      createdAt: serverTimestamp(),
      likes: 0,
      dislikes: 0,
      commentCount: 0,
    });
    setIsCreating(false);
  };

  if (isCreating) {
    return <CreateKanbuPost userData={currentUserData} room={room} boardType={boardType} onSubmit={handleSubmit} onClose={() => setIsCreating(false)} />;
  }

  const formatDate = (ts: { seconds: number } | null | undefined) => {
    if (!ts?.seconds) return '';
    const diff = Math.floor((Date.now() - ts.seconds * 1000) / 1000);
    if (diff < 60) return '방금 전';
    if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
    return new Date(ts.seconds * 1000).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  };

  const extractFirstImage = (html: string): string | null => {
    const m = html.match(/<img[^>]+src=["']([^"']+)["']/);
    return m ? m[1] : null;
  };

  const stripHtml = (html: string): string => html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* 상단 바: 새 글 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-white shrink-0">
        <span className="text-[12px] font-[1000] text-slate-700">{boardPosts.length}개 글</span>
        <button onClick={() => setIsCreating(true)}
          className="flex items-center gap-1 px-3 py-1.5 bg-slate-900 hover:bg-blue-600 text-white rounded-lg text-[11px] font-[1000] transition-colors">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
          새 글
        </button>
      </div>

      {/* 글 카드 목록 */}
      <div className="flex-1 overflow-y-auto bg-slate-50/30">
        {boardPosts.length === 0 ? (
          <div className="py-20 text-center text-slate-300 text-[13px] font-bold italic">첫 글을 작성해보세요.</div>
        ) : (
          <div className="flex flex-col gap-2 p-3">
            {boardPosts.map(post => {
              const thumb = post.imageUrl || extractFirstImage(post.content || '');
              const preview = stripHtml(post.content || '').slice(0, 120);
              return (
                <div key={post.id} onClick={() => onPostClick(post)}
                  className="bg-white border border-slate-100 rounded-xl p-3 cursor-pointer hover:border-blue-200 hover:shadow-sm transition-all flex gap-3">
                  {thumb && (
                    <div className="w-20 h-20 rounded-lg overflow-hidden bg-slate-100 shrink-0">
                      <img src={thumb} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    {post.title && (
                      <h3 className="text-[13px] font-[1000] text-slate-900 truncate mb-0.5">{post.title}</h3>
                    )}
                    {preview && (
                      <p className="text-[11px] font-bold text-slate-500 line-clamp-2 leading-relaxed">{preview}</p>
                    )}
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 mt-1.5">
                      <span>{post.author}</span>
                      <span>·</span>
                      <span>{formatDate(post.createdAt)}</span>
                      {(post.likes || 0) > 0 && <><span>·</span><span>❤️ {post.likes}</span></>}
                      {(post.commentCount || 0) > 0 && <><span>·</span><span>💬 {post.commentCount}</span></>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default KanbuBoardView;

// sanitize 사용 안 함 방지 (향후 content 렌더링 시 필요)
void sanitizeHtml;
