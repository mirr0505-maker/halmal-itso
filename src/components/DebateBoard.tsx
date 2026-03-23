// src/components/DebateBoard.tsx
import React, { useState } from 'react';
import PostCard from './PostCard';
import type { Post } from '../types';
import { CATEGORY_RULES } from './DiscussionView';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';

interface Props {
  allChildPosts: Post[];
  setReplyTarget: (post: Post) => void;
  onPostClick: (post: Post) => void;
  currentUserData?: any;
  currentUserFriends: string[];
  onLikeClick?: (e: any, id: string) => void;
  currentNickname?: string;
  category: string;
  onInlineReply?: (content: string, parentPost: Post | null) => Promise<void>;
  rootPost?: Post;
}

const DebateBoard = ({
  allChildPosts, setReplyTarget, onPostClick, onLikeClick, currentNickname, category, onInlineReply, rootPost
}: Props) => {
  const rule = CATEGORY_RULES[category] || CATEGORY_RULES["나의 이야기"];

  const leftPosts = allChildPosts.filter(p => p.side === 'left');
  const rightPosts = allChildPosts.filter(p => p.side === 'right');

  // 댓글 정렬 상태 (단일 리스트형에서 사용)
  const [sortBy, setSortBy] = useState<'latest' | 'likes'>('latest');

  const isRootAuthor = !!(rootPost && currentNickname && rootPost.author === currentNickname);
  const pinnedCommentId = rootPost?.pinnedCommentId;

  const handlePin = async (commentId: string) => {
    if (!rootPost) return;
    const newPinned = pinnedCommentId === commentId ? null : commentId;
    await updateDoc(doc(db, 'posts', rootPost.id), { pinnedCommentId: newPinned ?? '' });
  };

  // 너와 나의 이야기 전용 인라인 폼 상태
  // '__new__' = 새 최상위 댓글, post.id = 해당 댓글 답글
  const [activeId, setActiveId] = useState<string | null>(null);
  const [inlineContent, setInlineContent] = useState('');
  const [isInlineSubmitting, setIsInlineSubmitting] = useState(false);

  const openInline = (id: string) => { setActiveId(prev => prev === id ? null : id); setInlineContent(''); };

  const submitInline = async (parentPost: Post | null) => {
    if (!inlineContent.trim() || isInlineSubmitting) return;
    setIsInlineSubmitting(true);
    await onInlineReply?.(inlineContent, parentPost);
    setInlineContent(''); setActiveId(null); setIsInlineSubmitting(false);
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

  // 🚀 단일 리스트형 레이아웃 (나의 이야기, 뼈때리는 글, 지식 소매상 등)
  if (rule.boardType === 'single' || rule.boardType === 'qa' || rule.boardType === 'onecut') {
    let label = "댓글";
    let colorClass = "text-slate-800";
    let pointColor = "bg-slate-800";

    if (rule.boardType === 'qa') {
      label = "지식 답변"; colorClass = "text-blue-600"; pointColor = "bg-blue-500";
    } else if (category === '유배·귀양지') {
      label = "격리 구역 기록"; colorClass = "text-slate-500"; pointColor = "bg-slate-400";
    } else if (category === '신포도와 여우' || category === '뼈때리는 글') {
      label = "뼈때리는 글"; colorClass = "text-purple-600"; pointColor = "bg-purple-500";
    } else if (rule.boardType === 'onecut') {
      label = "한컷 반응"; colorClass = "text-rose-600"; pointColor = "bg-rose-500";
    } else {
      label = "공감하는 글"; colorClass = "text-emerald-600"; pointColor = "bg-emerald-500";
    }

    return (
      <div className="flex flex-col bg-white min-h-[200px] mt-0">
        <div className="py-3 md:px-8 border-b border-slate-100 flex items-center justify-between sticky top-0 z-10 bg-white">
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
          {allChildPosts.length === 0 && !rule.hideEmptyMessage && <div className="py-20 text-center text-slate-300 font-bold text-xs">첫 번째 글을 남겨보세요.</div>}
        </div>

        {/* 인라인 답글 활성화 카테고리 전용 — 최하단 새 댓글 입력창 */}
        {rule.allowInlineReply && (
          <div className="border-t border-slate-100">
            {activeId === '__new__'
              ? (
                <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border-t border-slate-100">
                  <input autoFocus type="text" value={inlineContent} onChange={e => setInlineContent(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) submitInline(null); }}
                    placeholder="따뜻한 공감의 한마디를 남겨보세요..."
                    className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-[13px] font-bold text-slate-700 outline-none focus:border-slate-400" />
                  <button onClick={() => { setActiveId(null); setInlineContent(''); }}
                    className="px-3 py-1.5 text-[11px] font-bold text-slate-400 hover:text-slate-600 rounded-md transition-colors shrink-0">취소</button>
                  <button onClick={() => submitInline(null)} disabled={isInlineSubmitting || !inlineContent.trim()}
                    className="px-3 py-1.5 text-[11px] font-bold bg-slate-900 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 transition-colors shrink-0">댓글 달기</button>
                </div>
              )
              : <button onClick={() => openInline('__new__')}
                  className="w-full px-8 py-4 text-left text-[13px] font-bold text-slate-300 hover:text-slate-500 hover:bg-slate-50 transition-colors">
                  댓글 달기...
                </button>
            }
          </div>
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
        <div className="py-4 px-6 border-b border-slate-100 flex items-center justify-between sticky top-0 z-10 bg-white/90 backdrop-blur-sm">
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
          {leftPosts.length === 0 && <div className="py-16 text-center text-slate-300 font-bold text-xs">첫 글을 남겨주세요.</div>}
        </div>
      </div>

      {/* 우측 진영 */}
      <div className="flex flex-col bg-white">
        <div className="py-4 px-6 border-b border-slate-100 flex items-center justify-between sticky top-0 z-10 bg-white/90 backdrop-blur-sm">
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
          {rightPosts.length === 0 && <div className="py-16 text-center text-slate-300 font-bold text-xs">첫 글을 남겨주세요.</div>}
        </div>
      </div>
    </div>
  );
};

export default DebateBoard;
