// src/components/CreateBoneHitting.tsx — 신포도와 여우 새글 작성 폼
import { useState } from 'react';
import { uploadToR2 } from '../uploadToR2';
import type { Post, UserData } from '../types';
import TiptapEditor from './TiptapEditor';
import AdSlotSetting from './ads/AdSlotSetting';
import { calculateLevel } from '../utils';

const BG_COLORS = [
  { hex: '#ffffff', label: '흰색' },
  { hex: '#fef3c7', label: '노랑' },
  { hex: '#dcfce7', label: '초록' },
  { hex: '#dbeafe', label: '파랑' },
  { hex: '#fce7f3', label: '분홍' },
  { hex: '#f1f5f9', label: '회색' },
  { hex: '#1e293b', label: '검정' },
  { hex: '#7c3aed', label: '보라' },
];

interface Props {
  userData: UserData;
  editingPost: Post | null;
  onSubmit: (postData: Partial<Post>, postId?: string) => Promise<void>;
  onClose: () => void;
}

const CreateBoneHitting = ({ userData, editingPost, onSubmit, onClose }: Props) => {
  const [postData, setPostData] = useState<Partial<Post>>({
    title: editingPost?.title || '',
    content: editingPost?.content || '',
    category: '신포도와 여우',
    tags: editingPost?.tags || ['', '', '', '', ''],
    bgColor: editingPost?.bgColor || '#ffffff',
    isOneCut: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  // 🚀 ADSMARKET: 광고 슬롯 설정
  const [adSlotEnabled, setAdSlotEnabled] = useState(false);
  const [adSlotType, setAdSlotType] = useState<'auction' | 'adsense'>('auction');

  const uploadFile = async (file: File): Promise<string | null> => {
    if (!userData) return null;
    setIsUploading(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `post_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
    const filePath = `uploads/${userData.uid}/${fileName}`;
    try {
      return await uploadToR2(file, filePath);
    } catch { alert("이미지 업로드에 실패했습니다."); return null; }
    finally { setIsUploading(false); }
  };

  const handleTagChange = (index: number, value: string) => {
    const newTags = [...(postData.tags || ['', '', '', '', ''])];
    newTags[index] = value;
    setPostData({ ...postData, tags: newTags });
  };

  const handleSubmit = async () => {
    if (!userData || !postData.content?.trim() || isSubmitting) return;
    // 🚀 신규 글만 제한 (수정은 제외) — 글자수 100자 이내 OR 이미지 1개 이내
    if (!editingPost) {
      // 공백 제거 후 순수 글자 수만 카운트 (한글 1글자 = 1)
      const plainText = (postData.content || '').replace(/<[^>]*>/g, '').replace(/\s/g, '');
      const imgCount = ((postData.content || '').match(/<img /gi) || []).length;
      if (plainText.length > 100 && imgCount === 0) {
        alert(`신포도와 여우는 공백 제외 100자 이내 또는 이미지 1개로 작성해주세요. (현재 ${plainText.length}자)`);
        return;
      }
      if (imgCount > 1) {
        alert('신포도와 여우는 이미지 1개까지만 가능합니다.');
        return;
      }
    }
    setIsSubmitting(true);
    try {
      const filteredTags = (postData.tags || []).filter(t => t.trim() !== '');
      await onSubmit({ ...postData, tags: filteredTags, ...(adSlotEnabled ? { adSlotEnabled: true, adSlotType } : {}) }, editingPost?.id);
    } finally { setIsSubmitting(false); }
  };

  return (
    <div className="w-full max-w-[860px] mx-auto py-8 animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col shadow-sm" style={{ maxHeight: 'calc(100vh - 80px)' }}>
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 h-12 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="text-[12px] font-bold text-slate-400 tracking-wide uppercase">{editingPost ? '글 수정' : '새 글 기록'}</span>
            <span className="text-[11px] font-bold text-purple-500">⚡ 신포도와 여우</span>
            {isUploading && <span className="flex items-center gap-1.5 text-[11px] font-bold text-blue-500"><span className="w-2.5 h-2.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin inline-block" />이미지 업로드 중</span>}
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={onClose} className="px-3.5 h-7 rounded-md text-[12px] font-bold text-slate-500 hover:bg-slate-100 transition-colors">취소</button>
            <button onClick={handleSubmit} disabled={isSubmitting || isUploading} className={`px-4 h-7 rounded-md text-[12px] font-bold transition-all ${isSubmitting || isUploading ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-900 text-white hover:bg-blue-600'}`}>{isSubmitting ? '업로드 중...' : '새글 올리기'}</button>
          </div>
        </div>

        {/* 제목 */}
        <div className="flex items-center px-5 py-3 border-b border-slate-100 shrink-0">
          <input type="text" placeholder="제목을 입력하세요 (선택)" value={postData.title || ''} onChange={(e) => setPostData({ ...postData, title: e.target.value })} className="w-full bg-transparent text-[18px] font-bold text-slate-900 outline-none placeholder:text-slate-200 placeholder:font-normal" />
        </div>

        {/* 배경색 선택 */}
        <div className="flex items-center gap-2.5 px-5 py-2.5 border-b border-slate-100 shrink-0">
          <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest shrink-0">배경색</span>
          {BG_COLORS.map(({ hex, label }) => (
            <button key={hex} type="button" title={label} onClick={() => setPostData(p => ({ ...p, bgColor: hex }))}
              className={`w-6 h-6 rounded-full border-2 transition-all ${postData.bgColor === hex ? 'border-slate-900 scale-125' : 'border-slate-200 hover:border-slate-400'}`}
              style={{ backgroundColor: hex }} />
          ))}
        </div>

        {/* 에디터 */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <TiptapEditor content={postData.content || ''} onChange={(html) => setPostData(prev => ({ ...prev, content: html }))} onImageUpload={uploadFile}
            placeholder={editingPost ? undefined : '나누고 싶은 글을 자유롭게 작성하세요.\n새 글은 공백 제외 100자 이내 또는 이미지 1개로 제한됩니다!'} />
        </div>

        {/* 태그 */}
        <div className="flex items-center gap-3 px-5 py-2.5 border-t border-slate-100 bg-slate-50/60 shrink-0 flex-wrap">
          <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Tags</span>
          {[0, 1, 2, 3, 4].map((idx) => (
            <div key={idx} className="flex items-center gap-0.5">
              <span className="text-slate-300 text-[12px] font-bold">#</span>
              <input type="text" placeholder="태그" value={postData.tags?.[idx] || ''} onChange={(e) => handleTagChange(idx, e.target.value)} className="w-16 bg-transparent text-[12px] font-bold text-slate-500 outline-none border-b border-transparent focus:border-slate-300 placeholder:text-slate-200 transition-colors pb-px" />
            </div>
          ))}
        </div>

        {/* 🚀 ADSMARKET: 광고 슬롯 설정 (Lv5+) */}
        <AdSlotSetting userLevel={calculateLevel(userData?.exp || 0)} adSlotEnabled={adSlotEnabled} adSlotType={adSlotType}
          onChange={(enabled, type) => { setAdSlotEnabled(enabled); setAdSlotType(type); }} />
      </div>
    </div>
  );
};

export default CreateBoneHitting;
