// src/components/CreateKanbuRoomModal.tsx — 깐부방 개설 모달
import { useState } from 'react';
import type { KanbuRoom } from '../types';

interface Props {
  onSubmit: (data: Pick<KanbuRoom, 'title' | 'description'>) => Promise<void>;
  onClose: () => void;
}

const CreateKanbuRoomModal = ({ onSubmit, onClose }: Props) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim() || isSubmitting) return;
    setIsSubmitting(true);
    await onSubmit({ title: title.trim(), description: description.trim() });
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="text-[15px] font-[1000] text-slate-900 tracking-tight">새 깐부방 개설</h3>
          <button onClick={onClose} className="text-slate-300 hover:text-slate-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4">
          <div>
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">방 제목 *</label>
            <input
              type="text"
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="깐부방 이름을 입력하세요"
              maxLength={30}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-[14px] font-bold text-slate-800 outline-none focus:border-blue-400 transition-colors"
            />
          </div>
          <div>
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">방 소개 (선택)</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="이 방에 대한 짧은 소개를 적어보세요"
              maxLength={100}
              rows={3}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-[13px] font-bold text-slate-700 outline-none focus:border-blue-400 transition-colors resize-none"
            />
          </div>
        </div>

        <div className="flex gap-2 px-6 pb-5">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl text-[13px] font-bold text-slate-400 hover:bg-slate-50 transition-colors border border-slate-100">
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={!title.trim() || isSubmitting}
            className="flex-1 py-3 rounded-xl text-[13px] font-[1000] bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? '개설 중...' : '깐부방 개설'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateKanbuRoomModal;
