// src/components/CreateKanbuPost.tsx — 깐부방 게시글 작성 폼 (참새방 스타일)
// 자유·유료(1회)·유료(구독) 3개 보드 공통 사용. boardType 구분하여 저장.
import { useState } from 'react';
import { uploadToR2 } from '../uploadToR2';
import type { Post, UserData, KanbuRoom } from '../types';
import TiptapEditor from './TiptapEditor';

interface Props {
  userData: UserData;
  room: KanbuRoom;
  boardType: 'free' | 'paid_once' | 'paid_monthly';
  onSubmit: (postData: Partial<Post>) => Promise<void>;
  onClose: () => void;
}

const BOARD_LABEL = {
  free: '📋 자유 게시판',
  paid_once: '🔒 유료 게시판 (1회)',
  paid_monthly: '🔒 유료 게시판 (구독)',
} as const;

const CreateKanbuPost = ({ userData, room, boardType, onSubmit, onClose }: Props) => {
  const [postData, setPostData] = useState<Partial<Post>>({
    title: '',
    content: '',
    tags: ['', '', '', '', ''],
    kanbuRoomId: room.id,
    kanbuBoardType: boardType,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const uploadFile = async (file: File): Promise<string | null> => {
    setIsUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `uploads/${userData.uid}/kanbu_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;
      return await uploadToR2(file, path);
    } catch { alert('이미지 업로드에 실패했습니다.'); return null; }
    finally { setIsUploading(false); }
  };

  const handleTagChange = (i: number, v: string) => {
    const tags = [...(postData.tags || ['', '', '', '', ''])];
    tags[i] = v;
    setPostData({ ...postData, tags });
  };

  const handleSubmit = async () => {
    if (!postData.content?.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const filteredTags = (postData.tags || []).filter(t => t.trim() !== '');
      await onSubmit({ ...postData, tags: filteredTags });
    } finally { setIsSubmitting(false); }
  };

  return (
    <div className="w-full max-w-[1024px] mx-auto py-3 animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col shadow-sm" style={{ maxHeight: 'calc(100vh - 32px)' }}>
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 h-12 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="text-[12px] font-bold text-slate-400 uppercase tracking-wide">새 글 작성</span>
            <span className="text-[11px] font-bold text-blue-600">{BOARD_LABEL[boardType]} · {room.title}</span>
            {isUploading && <span className="flex items-center gap-1.5 text-[11px] font-bold text-blue-500"><span className="w-2.5 h-2.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin inline-block" />이미지 업로드 중</span>}
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={onClose} className="px-3.5 h-7 rounded-md text-[12px] font-bold text-slate-500 hover:bg-slate-100 transition-colors">취소</button>
            <button onClick={handleSubmit} disabled={isSubmitting || isUploading}
              className={`px-4 h-7 rounded-md text-[12px] font-bold transition-all ${isSubmitting || isUploading ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-900 text-white hover:bg-blue-600'}`}>
              {isSubmitting ? '업로드 중...' : '새글 올리기'}
            </button>
          </div>
        </div>

        {/* 제목 */}
        <div className="flex items-center px-5 py-3 border-b border-slate-100 shrink-0">
          <input type="text" placeholder="제목을 입력하세요" value={postData.title || ''}
            onChange={e => setPostData({ ...postData, title: e.target.value })}
            className="w-full bg-transparent text-[18px] font-bold text-slate-900 outline-none placeholder:text-slate-200 placeholder:font-normal" />
        </div>

        {/* 에디터 */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <TiptapEditor content={postData.content || ''} onChange={html => setPostData(p => ({ ...p, content: html }))} onImageUpload={uploadFile} />
        </div>

        {/* 태그 */}
        <div className="flex items-center gap-3 px-5 py-2.5 border-t border-slate-100 bg-slate-50/60 shrink-0 flex-wrap">
          <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Tags</span>
          {[0, 1, 2, 3, 4].map(idx => (
            <div key={idx} className="flex items-center gap-0.5">
              <span className="text-slate-300 text-[12px] font-bold">#</span>
              <input type="text" placeholder="태그" value={postData.tags?.[idx] || ''}
                onChange={e => handleTagChange(idx, e.target.value)}
                className="w-16 bg-transparent text-[12px] font-bold text-slate-500 outline-none border-b border-transparent focus:border-slate-300 placeholder:text-slate-200 transition-colors pb-px" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CreateKanbuPost;
