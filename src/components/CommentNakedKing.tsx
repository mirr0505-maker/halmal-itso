// src/components/CommentNakedKing.tsx — 판도라의 상자 댓글 폼 (진실/거짓 탭)
import { useState } from 'react';
import type { FormEvent } from 'react';
import type { Post } from '../types';

interface Props {
  replyTarget: Post | null;
  setReplyTarget: (post: Post | null) => void;
  selectedSide: 'left' | 'right';
  setSelectedSide: (side: 'left' | 'right') => void;
  selectedType: 'comment' | 'formal';
  setSelectedType: (type: 'comment' | 'formal') => void;
  newTitle: string;
  setNewTitle: (t: string) => void;
  newContent: string;
  setNewContent: (c: string) => void;
  isSubmitting: boolean;
  handleSubmit: (e: FormEvent) => Promise<void>;
}

const CommentNakedKing = ({
  replyTarget, setReplyTarget,
  selectedSide, setSelectedSide,
  newContent, setNewContent,
  isSubmitting, handleSubmit,
}: Props) => {
  const [isInputFocused, setIsInputFocused] = useState(false);

  return (
    <div className="bg-[#F8FAFC] md:px-8 py-3 border-b border-slate-200">
      <div className="flex flex-col md:flex-row md:items-center gap-2 mb-2">
        <h4 className="font-[1000] text-slate-400 text-xs tracking-widest shrink-0 flex items-center gap-2">
          글 남기기
          {replyTarget && (
            <span className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-900 text-white rounded text-[9px] ml-2">
              🎯 {replyTarget.author}
              <button onClick={() => setReplyTarget(null)} className="hover:text-rose-400 ml-1">✕</button>
            </span>
          )}
        </h4>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setSelectedSide('left')}
            className={`px-3 py-1.5 rounded-md text-[10px] font-[1000] transition-all border ${selectedSide === 'left' ? 'bg-white text-emerald-600 border-emerald-200 shadow-sm' : 'text-slate-400 border-transparent hover:bg-white hover:border-slate-200'}`}>
            ⭕ 진실 (동의)
          </button>
          <button type="button" onClick={() => setSelectedSide('right')}
            className={`px-3 py-1.5 rounded-md text-[10px] font-[1000] transition-all border ${selectedSide === 'right' ? 'bg-white text-rose-500 border-rose-200 shadow-sm' : 'text-slate-400 border-transparent hover:bg-white hover:border-slate-200'}`}>
            ❌ 거짓 (반대)
          </button>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="relative mt-1">
        <div className="relative">
          <textarea
            value={newContent}
            onChange={e => setNewContent(e.target.value)}
            onFocus={() => setIsInputFocused(true)}
            placeholder="정확한 팩트를 제시해 주세요..."
            className={`w-full bg-white border border-slate-200 rounded-lg px-5 py-4 text-[13px] font-bold text-slate-700 outline-none focus:border-slate-400 transition-all resize-none shadow-sm ${isInputFocused ? 'h-32' : 'h-20'}`}
          />
          <button
            type="submit"
            disabled={isSubmitting || !newContent.trim()}
            className="absolute bottom-3 right-3 bg-slate-900 text-white px-4 py-2 rounded-md text-[10px] font-[1000] shadow-md hover:bg-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed tracking-wider"
          >
            전송 🚀
          </button>
        </div>
      </form>
    </div>
  );
};

export default CommentNakedKing;
