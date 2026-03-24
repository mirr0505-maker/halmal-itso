// src/components/CommentBoneHitting.tsx — 신포도와 여우 댓글 폼 (단순형)
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
  placeholder?: string;
}

const CommentBoneHitting = ({
  replyTarget, setReplyTarget,
  newContent, setNewContent,
  isSubmitting, handleSubmit,
  placeholder = '뼈때리는 한마디를 남겨보세요...',
}: Props) => {
  const [isInputFocused, setIsInputFocused] = useState(false);

  return (
    <div className="bg-[#F8FAFC] md:px-8 py-3 border-b border-slate-200">
      <div className="mb-2 flex items-center gap-2">
        <h4 className="font-[1000] text-slate-400 text-xs tracking-widest flex items-center gap-2">
          댓글 남기기
          {replyTarget && (
            <span className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-900 text-white rounded text-[9px] ml-2">
              ↩ {replyTarget.author}에게
              <button onClick={() => setReplyTarget(null)} className="hover:text-rose-400 ml-1">✕</button>
            </span>
          )}
        </h4>
      </div>
      <form onSubmit={handleSubmit} className="relative mt-1">
        <div className="relative">
          <textarea
            value={newContent}
            onChange={e => setNewContent(e.target.value)}
            onFocus={() => setIsInputFocused(true)}
            placeholder={placeholder}
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

export default CommentBoneHitting;
