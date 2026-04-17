// src/components/KanbuBoardView.tsx — 깐부방 게시판 1개 뷰 (AnyTalkList 카드 그리드 포맷)
// 3개 보드(자유/유료1회/유료구독) 공통 사용. boardType으로 필터.
import { useState } from 'react';
import { db } from '../firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import type { Post, UserData, KanbuRoom } from '../types';
import { calculateLevel, formatKoreanNumber, getReputationLabel, getReputationScore } from '../utils';
import { sanitizeHtml, extractText, extractFirstImage } from '../sanitize';
import CreateKanbuPost from './CreateKanbuPost';

interface Props {
  room: KanbuRoom;
  boardType: 'free' | 'paid_once' | 'paid_monthly';
  posts: Post[];
  currentUserData: UserData;
  onPostClick: (post: Post) => void;
  allUsers?: Record<string, UserData>;
  followerCounts?: Record<string, number>;
  commentCounts?: Record<string, number>;
}

const KanbuBoardView = ({ room, boardType, posts, currentUserData, onPostClick, allUsers = {}, followerCounts = {}, commentCounts = {} }: Props) => {
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

  const formatRelativeTime = (ts: { seconds: number } | null | undefined) => {
    if (!ts?.seconds) return '방금 전';
    const diff = Math.floor((Date.now() - ts.seconds * 1000) / (1000 * 60 * 60));
    if (diff < 1) return '방금 전';
    if (diff < 24) return `${diff}시간 전`;
    return new Date(ts.seconds * 1000).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' });
  };

  const hasText = (html: string) => !!extractText(html).trim();

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

      {/* 글 카드 그리드 — 홈 새글 동일 포맷 */}
      <div className="flex-1 overflow-y-auto bg-slate-50/30 p-3">
        {boardPosts.length === 0 ? (
          <div className="py-20 text-center text-slate-300 text-[13px] font-bold italic">첫 글을 작성해보세요.</div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-2 w-full">
            {boardPosts.map(post => {
              const displayImage = post.imageUrl || extractFirstImage(post.content || '');
              const hasContent = hasText(post.content || '');
              const authorData = (post.author_id && allUsers[post.author_id]) || allUsers[`nickname_${post.author}`];
              const realFollowers = followerCounts[post.author] || 0;
              const displayLevel = calculateLevel(authorData?.exp || 0);
              const displayLikes = authorData ? (authorData.likes || 0) : (post.authorInfo?.totalLikes || 0);
              const commentCount = commentCounts[post.id] || post.commentCount || 0;

              return (
                <div
                  key={post.id}
                  onClick={() => onPostClick(post)}
                  className="border border-slate-300 rounded-xl px-3.5 py-2 cursor-pointer hover:border-blue-400 hover:shadow-xl transition-all group flex flex-col shadow-sm bg-white"
                >
                  {/* 1. 최상단: 시간 + 제목 */}
                  <div className="flex justify-between items-start mb-1 shrink-0">
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="text-[9px] font-black uppercase tracking-tighter text-slate-500">{formatRelativeTime(post.createdAt)}</span>
                      <h3 className="text-[15px] font-[1000] line-clamp-2 leading-tight tracking-tight text-slate-900 group-hover:text-blue-600 transition-colors">
                        {post.title || '(제목 없음)'}
                      </h3>
                    </div>
                  </div>

                  {/* 2. 본문 — HTML 그대로, 이미지 숨김 */}
                  {hasContent && (
                    <div
                      className={`overflow-hidden mb-1 text-[13px] leading-relaxed font-medium text-slate-500 [&_img]:hidden [&_p]:mb-1 [&_p:last-child]:mb-0 [&_strong]:font-bold [&_em]:italic [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 ${displayImage ? 'line-clamp-3' : 'line-clamp-6'}`}
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.content || '') }}
                    />
                  )}

                  {/* 3. 이미지 */}
                  {displayImage && (
                    <div className="w-full aspect-video rounded-lg overflow-hidden shrink-0 bg-slate-50 border border-slate-300 mb-1">
                      <img src={displayImage} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    </div>
                  )}

                  {/* 4. 최하단: 아바타/유저정보 + 통계 */}
                  <div className="pt-1 border-t border-slate-100 mt-auto flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className="w-6 h-6 rounded-full bg-slate-50 overflow-hidden shrink-0 border border-white shadow-sm ring-1 ring-slate-100">
                        <img src={authorData?.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${post.author}`} alt="" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[11px] font-[1000] truncate leading-none mb-0.5 text-slate-900">{post.author}</span>
                        <span className="text-[9px] font-bold truncate tracking-tight text-slate-500">
                          Lv {displayLevel} · {getReputationLabel(authorData ? getReputationScore(authorData) : displayLikes)} · 깐부수 {formatKoreanNumber(realFollowers)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-[10px] font-black shrink-0 text-slate-500">
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                        {formatKoreanNumber(commentCount)}
                      </span>
                      {(post.thanksballTotal || 0) > 0 && (
                        <span className="flex items-center gap-0.5 text-amber-400">
                          <span className="text-[13px]">⚾</span> {post.thanksballTotal}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5 fill-none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
                        {formatKoreanNumber(post.likes || 0)}
                      </span>
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
