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
  level?: number; // 🚀 대댓글 깊이 (0: 댓글, 1 이상: 대댓글)
}

const PostCard = ({ post, onReply, currentUserData, currentUserFriends, level = 0 }: Props) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  
  const isMyPost = post.author === "흑무영"; 
  const isFormal = post.type === 'formal' || (post.title && post.title.trim().length > 0);
  const isRightSide = post.side === 'right';

  // 🚀 들여쓰기 계산 (깊이당 16px, 최대 3단계까지)
  const indentSize = Math.min(level, 3) * 16;

  const getReputationLabel = (likes: number) => {
    if (likes >= 1000) return "확고";
    if (likes >= 500) return "우호";
    if (likes >= 100) return "약간 우호";
    if (likes < 0) return "적대";
    return "중립";
  };

  const renderAuthorInfo = () => {
    const info = isMyPost && currentUserData ? {
      level: currentUserData.level || 1,
      friendCount: currentUserFriends?.length || 0,
      totalLikes: currentUserData.likes || 0
    } : (post.authorInfo || { level: 1, friendCount: 2, totalLikes: 123456 });

    return (
      <div className={`flex items-center gap-2 ${isRightSide ? 'mr-2' : 'ml-2'}`}>
        <span className="bg-slate-900 text-white px-1.5 py-0.5 rounded-[4px] text-[10px] font-black uppercase tracking-tighter">
          Lv.{info.level}
        </span>
        <span className="text-[11.5px] font-bold text-slate-400">
          · {getReputationLabel(info.totalLikes)} · 깐부 {info.friendCount}
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

  // 🚀 진영별 스타일 클래스 정의
  const sideStyles = isRightSide 
    ? "text-right items-end border-r-4 border-r-rose-400 border-b-slate-100" 
    : "text-left items-start border-l-4 border-l-emerald-400 border-b-slate-100";

  return (
    <div 
      className={`p-4 rounded-none shadow-sm border-b transition-all ${isFormal ? 'bg-blue-50/20' : 'bg-white hover:bg-slate-50/50'} ${sideStyles} w-full flex flex-col`}
      style={{ 
        paddingLeft: !isRightSide ? `${16 + indentSize}px` : '16px',
        paddingRight: isRightSide ? `${16 + indentSize}px` : '16px'
      }}
    >
      <div className="flex flex-col gap-1.5 mb-3 w-full">
        <div className={`flex justify-between items-start ${isRightSide ? 'flex-row-reverse' : 'flex-row'}`}>
          <div className={`flex items-center ${isRightSide ? 'flex-row-reverse' : 'flex-row'}`}>
            {/* 🚀 대댓글 표시 아이콘 */}
            {level > 0 && (
              <span className={`text-slate-300 font-black text-sm ${isRightSide ? 'ml-2' : 'mr-2'}`}>
                {isRightSide ? '┒' : 'ㄴ'}
              </span>
            )}
            <span className="font-black text-[11.5px] text-slate-900">👤 {post.author}</span>
            {renderAuthorInfo()}
            {isFormal && (
              <span className={`${isRightSide ? 'mr-3' : 'ml-3'} bg-blue-600 text-white px-2 py-0.5 rounded-[4px] text-[9px] font-black uppercase shadow-sm`}>정식연계</span>
            )}
          </div>
          
          <div className={`flex items-center gap-3 ${isRightSide ? 'flex-row-reverse' : 'flex-row'}`}>
            {isMyPost && !isEditing && (
              <div className={`flex gap-3 ${isRightSide ? 'flex-row-reverse' : 'flex-row'}`}>
                <button onClick={() => setIsEditing(true)} className="text-[11px] font-black text-blue-400 hover:text-blue-600 transition-colors">수정</button>
                <button onClick={handleDelete} className="text-[11px] font-black text-rose-400 hover:text-rose-600 transition-colors">삭제</button>
              </div>
            )}
            <span className="text-[11.5px] font-black text-slate-400">👍 {post.likes || 0}</span>
          </div>
        </div>
      </div>
      
      {isEditing ? (
        <div className="flex flex-col gap-2 mt-1 animate-in fade-in w-full">
          <textarea 
            value={editContent} 
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full p-3 border border-slate-200 rounded-none text-[11.5px] outline-none focus:border-slate-900 resize-none h-20 transition-all"
          />
          <div className={`flex gap-2 ${isRightSide ? 'justify-start' : 'justify-end'}`}>
            <button onClick={() => { setIsEditing(false); setEditContent(post.content); }} className="text-[11.5px] bg-slate-50 px-3 py-1.5 rounded-none font-bold text-slate-400">취소</button>
            <button onClick={handleUpdate} className="text-[11.5px] bg-slate-900 text-white px-4 py-1.5 rounded-none font-bold shadow-md">저장</button>
          </div>
        </div>
      ) : (
        <div className="w-full">
          {isFormal && post.title && (
            <h4 className={`text-[13px] font-[1000] text-slate-900 mb-1.5 leading-tight ${isRightSide ? 'text-right' : 'text-left'}`}>{post.title}</h4>
          )}
          <div 
            className={`text-[11.5px] text-slate-600 mb-4 leading-relaxed font-bold prose prose-slate max-w-none ${isRightSide ? 'text-right' : 'text-left'}`}
            dangerouslySetInnerHTML={{ __html: post.content }}
          />
          <div className={`flex ${isRightSide ? 'justify-end' : 'justify-start'}`}>
            <button onClick={() => onReply(post)} className="text-[10px] font-black text-slate-300 hover:text-slate-500 flex items-center gap-1 transition-colors w-fit border border-slate-100 px-2.5 py-1 hover:bg-slate-50">💬 답글달기</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PostCard;
