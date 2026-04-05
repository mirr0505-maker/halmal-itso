// src/components/FormalBoard.tsx
import React, { useState } from 'react';
import { db } from '../firebase';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import type { Post, UserData } from '../types';
import { calculateLevel } from '../utils';

interface Props {
  agreePosts: Post[];
  disagreePosts: Post[];
  onPostClick: (post: Post) => void; 
  currentUserData?: UserData | null;
  currentUserFriends?: string[];
  currentNickname?: string;
  onLikeClick?: (e: React.MouseEvent | null, postId: string) => void;
}

const FormalBoard = ({ agreePosts, disagreePosts, onPostClick, currentUserData, currentUserFriends, currentNickname, onLikeClick }: Props) => {
  const [visibleAgree, setVisibleAgree] = useState(2);
  const [visibleDisagree, setVisibleDisagree] = useState(2);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");

  // 로그인 상태에서만 내 글 여부 판별 — 비로그인 시 항상 false (수정/삭제 버튼 미노출)
  const isMyPost = (author: string) => !!currentNickname && author === currentNickname;

  const renderAuthorInfo = (post: Post) => {
    const isMe = isMyPost(post.author);
    const info = isMe && currentUserData ? {
      level: calculateLevel(currentUserData?.exp || 0),
      friendCount: currentUserFriends?.length || 0,
      totalLikes: currentUserData.likes || 0
    } : (post.authorInfo || { level: 1, friendCount: 2, totalLikes: 123456 });

    return (
      <span className="text-[10px] font-bold text-slate-400 ml-2">
        Lv.{info.level} · 깐부수 {info.friendCount} · 좋아요 {info.totalLikes.toLocaleString()}
      </span>
    );
  };

  const handleEditStart = (e: React.MouseEvent, post: Post) => {
    e.stopPropagation();
    setEditingId(post.id);
    setEditTitle(post.title || "");
    setEditContent(post.content);
  };

  const handleUpdate = async (e: React.MouseEvent, postId: string) => {
    e.stopPropagation();
    if (!editTitle.trim() || !editContent.trim()) return alert("제목과 내용을 모두 채우시오!");
    try {
      await updateDoc(doc(db, "posts", postId), { title: editTitle, content: editContent });
      setEditingId(null);
    } catch (error) { console.error("연계글 수정 실패:", error); }
  };

  const handleDelete = async (e: React.MouseEvent, postId: string) => {
    e.stopPropagation();
    if (window.confirm("이 정식 연계글을 영구히 파기하겠소?")) {
      try { await deleteDoc(doc(db, "posts", postId)); } 
      catch (error) { console.error("연계글 삭제 실패:", error); }
    }
  };

  const renderPostCard = (post: Post, sideColor: string) => {
    const isEditing = editingId === post.id;
    const isLikedByMe = currentNickname && post.likedBy?.includes(currentNickname);

    return (
      <div 
        key={post.id} 
        onClick={() => !isEditing && onPostClick(post)} 
        className={`bg-white border-2 p-5 rounded-2xl shadow-sm transition-all ${isEditing ? 'border-slate-900 shadow-md' : `border-${sideColor}-200 hover:shadow-[4px_4px_0px_0px_rgba(var(--${sideColor}-rgb),0.2)] hover:-translate-y-1 cursor-pointer`}`}
      >
        {isEditing ? (
          <div className="flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-200">
            <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="font-black text-lg border-b-2 border-slate-200 outline-none focus:border-slate-900 pb-1" placeholder="제목 수정" />
            <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} className="text-sm text-slate-500 border-2 border-slate-100 rounded-lg p-2 h-24 outline-none focus:border-slate-900 resize-none" placeholder="내용 수정" />
            <div className="flex justify-end gap-2 mt-2">
              <button onClick={(e) => { e.stopPropagation(); setEditingId(null); }} className="px-3 py-1.5 text-xs font-bold text-slate-400 bg-slate-100 rounded-lg hover:bg-slate-200">취소</button>
              <button onClick={(e) => handleUpdate(e, post.id)} className="px-3 py-1.5 text-xs font-bold text-white bg-slate-900 rounded-lg hover:bg-emerald-500">저장</button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-start mb-2">
              <h4 className="font-black text-lg line-clamp-1 flex-1">{post.title}</h4>
              {isMyPost(post.author) && (
                <div className="flex gap-2 ml-2 shrink-0">
                  <button onClick={(e) => handleEditStart(e, post)} className="text-[10px] font-bold text-slate-400 hover:text-blue-500">수정</button>
                  <button onClick={(e) => handleDelete(e, post.id)} className="text-[10px] font-bold text-slate-400 hover:text-rose-500">삭제</button>
                </div>
              )}
            </div>
            <p className="text-sm text-slate-500 line-clamp-2 mb-4">{post.content}</p>
            <div className="flex justify-between items-center text-xs font-bold">
              <div className="flex items-center">
                <span className="text-slate-400">👤 {post.author}</span>
                {renderAuthorInfo(post)}
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); onLikeClick?.(null, post.id); }}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all ${isLikedByMe ? 'bg-rose-50 text-rose-500' : `bg-${sideColor}-50 text-${sideColor}-600 hover:bg-rose-50 hover:text-rose-500`}`}
              >
                <svg className={`w-3 h-3 transition-colors ${isLikedByMe ? 'fill-current' : 'fill-none'}`} viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                  <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
                </svg>
                <span>{post.likes || 0}</span>
              </button>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
      <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-1 bg-slate-200 -translate-x-1/2 rounded-full"></div>
      <div className="flex flex-col gap-4 relative z-10">
        <div className="bg-emerald-100 text-emerald-800 font-bold py-2 px-4 rounded-xl inline-block w-fit text-sm">🟢 동의측 연계글 ({agreePosts.length})</div>
        {agreePosts.slice(0, visibleAgree).map(post => renderPostCard(post, 'emerald'))}
        {visibleAgree < agreePosts.length && (
          <button onClick={() => setVisibleAgree(prev => prev + 2)} className="w-full py-3 bg-white border-2 border-emerald-200 text-emerald-600 font-bold rounded-xl hover:bg-emerald-50 transition-all">👇 더보기</button>
        )}
      </div>
      <div className="flex flex-col gap-4 relative z-10">
        <div className="bg-orange-100 text-orange-800 font-bold py-2 px-4 rounded-xl inline-block w-fit text-sm">🔴 비동의측 연계글 ({disagreePosts.length})</div>
        {disagreePosts.slice(0, visibleDisagree).map(post => renderPostCard(post, 'orange'))}
        {visibleDisagree < disagreePosts.length && (
          <button onClick={() => setVisibleDisagree(prev => prev + 2)} className="w-full py-3 bg-white border-2 border-orange-200 text-orange-600 font-bold rounded-xl hover:bg-orange-50 transition-all">👇 더보기</button>
        )}
      </div>
    </div>
  );
};

export default FormalBoard;