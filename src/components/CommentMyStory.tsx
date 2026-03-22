// src/components/CommentMyStory.tsx — 너와 나의 이야기 댓글 폼 (단순 공감형)
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

const CommentMyStory = ({
  replyTarget, setReplyTarget,
  newContent, setNewContent,
  isSubmitting, handleSubmit,
}: Props) => {
  return (
    <div className="bg-[#F8FAFC] md:px-8 py-3 border-b border-slate-200">
      {replyTarget && (
        <div className="mb-2 flex items-center gap-2">
          <span className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-900 text-white rounded text-[9px]">
            ↩ {replyTarget.author}에게
            <button onClick={() => setReplyTarget(null)} className="hover:text-rose-400 ml-1">✕</button>
          </span>
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <input
          type="text"
          value={newContent}
          onChange={e => setNewContent(e.target.value)}
          placeholder="첫 번째 글을 남겨보세요."
          className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-[13px] font-bold text-slate-700 outline-none focus:border-slate-400 transition-all shadow-sm"
        />
        <button
          type="submit"
          disabled={isSubmitting || !newContent.trim()}
          className="self-start bg-slate-900 text-white px-4 py-1.5 rounded-md text-[11px] font-[1000] hover:bg-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed tracking-wider"
        >
          댓글 달기
        </button>
      </form>
    </div>
  );
};

export default CommentMyStory;
