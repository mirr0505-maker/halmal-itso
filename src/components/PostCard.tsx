// src/components/PostCard.tsx
import { useState } from 'react';
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
  const isFormal = post.type === 'formal' || (post.title && post.title.trim().length > 0);

  const renderAuthorInfo = () => {
    const info = isMyPost && currentUserData ? {
      level: currentUserData.level || 1,
      friendCount: currentUserFriends?.length || 0,
      totalLikes: currentUserData.likes || 0
    } : (post.authorInfo || { level: 1, friendCount: 2, totalLikes: 123456 });

    return (
      <div className="flex items-center gap-1.5 ml-2">
        <span className="bg-slate-900 text-white px-1 py-0.5 rounded-[3px] text-[7px] font-black uppercase tracking-tighter">
          Lv.{info.level}
        </span>
        <span className="text-[8px] font-bold text-slate-400">
          깐부 {info.friendCount}
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
    <div className={`p-3 rounded-xl shadow-sm border transition-all ${isFormal ? 'bg-blue-50/30 border-blue-100' : 'bg-white border-slate-100 hover:border-slate-200'}`}>
      <div className="flex flex-col gap-1 mb-1.5">
        <div className="flex justify-between items-start">
          <div className="flex items-center">
            <span className="font-black text-[9px] text-slate-700">👤 {post.author}</span>
            {renderAuthorInfo()}
            {isFormal && (
              <span className="ml-2 bg-blue-600 text-white px-1.5 py-0.5 rounded-[3px] text-[7px] font-black uppercase">정식연계</span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {isMyPost && !isEditing && (
              <div className="flex gap-1.5">
                <button onClick={() => setIsEditing(true)} className="text-[8px] font-black text-slate-300 hover:text-blue-500">수정</button>
                <button onClick={handleDelete} className="text-[8px] font-black text-slate-300 hover:text-rose-500">삭제</button>
              </div>
            )}
            <span className="text-[8px] font-black text-slate-400">👍 {post.likes || 0}</span>
          </div>
        </div>
      </div>
      
      {isEditing ? (
        <div className="flex flex-col gap-1.5 mt-1 animate-in fade-in">
          <textarea 
            value={editContent} 
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full p-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-slate-900 resize-none h-16 transition-all"
          />
          <div className="flex justify-end gap-1.5">
            <button onClick={() => { setIsEditing(false); setEditContent(post.content); }} className="text-[9px] bg-slate-50 px-2 py-1 rounded-md font-bold text-slate-400">취소</button>
            <button onClick={handleUpdate} className="text-[9px] bg-slate-900 text-white px-2.5 py-1 rounded-md font-bold shadow-md">저장</button>
          </div>
        </div>
      ) : (
        <>
          {isFormal && post.title && (
            <h4 className="text-[11px] font-black text-slate-800 mb-1 leading-tight">{post.title}</h4>
          )}
          <div 
            className="text-[10px] text-slate-500 mb-2 leading-relaxed prose prose-slate max-w-none"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />
          <button onClick={() => onReply(post)} className="text-[8px] font-black text-slate-300 hover:text-slate-500 flex items-center gap-1 transition-colors w-fit underline underline-offset-2">💬 답글달기</button>
        </>
      )}
    </div>
  );
};

export default PostCard;
