// src/components/PostCard.tsx
import React, { useState } from 'react';
import { db } from '../firebase';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore'; 
import type { Post } from '../types';

interface Props {
  post: Post;
  onReply: (post: Post) => void;
  currentUserData?: any; 
  currentUserFriends?: string[];
}

const PostCard = ({ post, onReply, currentUserData, currentUserFriends }: Props) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  
  const isMyPost = post.author === "흑무영"; 

  const renderAuthorInfo = () => {
    const info = isMyPost && currentUserData ? {
      level: currentUserData.level || 1,
      friendCount: currentUserFriends?.length || 0,
      totalLikes: currentUserData.likes || 0
    } : (post.authorInfo || { level: 1, friendCount: 2, totalLikes: 123456 });

    return (
      <div className="flex items-center gap-2 ml-3">
        <span className="bg-slate-900 text-white px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter shadow-sm">
          Lv.{info.level}
        </span>
        <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
          <span className="w-0.5 h-0.5 bg-slate-300 rounded-full" />
          깐부 {info.friendCount}
          <span className="w-0.5 h-0.5 bg-slate-300 rounded-full" />
          좋아요 {info.totalLikes.toLocaleString()}
        </span>
      </div>
    );
  };

  const handleUpdate = async () => {
    if (!editContent.trim()) return alert("수정할 내용을 입력하시오!");
    try {
      await updateDoc(doc(db, "posts", post.id), { content: editContent });
      setIsEditing(false);
    } catch (error) { console.error("수정 실패:", error); }
  };

  const handleDelete = async () => {
    if (window.confirm("정말 이 할말을 영구히 지우시겠소?")) {
      try { await deleteDoc(doc(db, "posts", post.id)); } 
      catch (error) { console.error("삭제 실패:", error); }
    }
  };

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 transition-all hover:shadow-md">
      <div className="flex flex-col gap-1 mb-2">
        <div className="flex justify-between items-start">
          <div className="flex items-center">
            <span className="font-bold text-sm text-slate-800">👤 {post.author}</span>
            {renderAuthorInfo()}
          </div>
          
          <div className="flex items-center gap-3">
            {isMyPost && !isEditing && (
              <div className="flex gap-2">
                <button onClick={() => setIsEditing(true)} className="text-[10px] font-bold text-slate-400 hover:text-blue-500 transition-colors">수정</button>
                <button onClick={handleDelete} className="text-[10px] font-bold text-slate-400 hover:text-rose-500 transition-colors">삭제</button>
              </div>
            )}
            <span className="text-[10px] font-bold text-slate-500 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">
              추천 {post.likes || 0}
            </span>
          </div>
        </div>
      </div>
      
      {isEditing ? (
        <div className="flex flex-col gap-2 mt-2 animate-in fade-in">
          <textarea 
            value={editContent} 
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full p-2 border-2 border-slate-300 rounded-lg text-sm outline-none focus:border-slate-900 resize-none h-20 transition-all"
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => { setIsEditing(false); setEditContent(post.content); }} className="text-xs bg-slate-100 px-3 py-1.5 rounded-lg font-bold text-slate-500 hover:bg-slate-200 transition-all">취소</button>
            <button onClick={handleUpdate} className="text-xs bg-slate-900 text-white px-3 py-1.5 rounded-lg font-bold shadow-md hover:bg-emerald-500 transition-all">저장</button>
          </div>
        </div>
      ) : (
        <>
          <div 
            className="text-sm text-slate-600 mb-3 leading-relaxed prose prose-slate prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />
          <button onClick={() => onReply(post)} className="text-[10px] font-bold text-slate-400 hover:text-slate-600 flex items-center gap-1 transition-colors w-fit">💬 이 의견에 답글 달기</button>
        </>
      )}
    </div>
  );
};

export default PostCard;