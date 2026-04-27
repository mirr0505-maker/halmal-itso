// src/components/CreateMarathonHerald.tsx — 마라톤의 전령 새글 작성 폼
// CreateMyStory와 동일 구조 — 이모지·카테고리명만 다름
import { useState } from 'react';
import { uploadToR2 } from '../uploadToR2';
import type { Post, UserData } from '../types';
import TiptapEditor from './TiptapEditor';
import AdSlotSetting from './ads/AdSlotSetting';
import { useAdSlotSetting } from './ads/useAdSlotSetting';
import { calculateLevel } from '../utils';

const HERALD_TAGS = ['속보', '단독', '지진', '폭발', '테러', '비상계엄'];

interface Props {
  userData: UserData;
  editingPost: Post | null;
  onSubmit: (postData: Partial<Post>, postId?: string) => Promise<void>;
  onClose: () => void;
}

const CreateMarathonHerald = ({ userData, editingPost, onSubmit, onClose }: Props) => {
  const [postData, setPostData] = useState<Partial<Post>>({
    title: editingPost?.title || '',
    content: editingPost?.content || '',
    category: '마라톤의 전령',
    tags: editingPost?.tags || ['', '', '', '', ''],
    mood: editingPost?.mood || '',
    isOneCut: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  // 🚀 ADSMARKET: 광고 슬롯 설정
  const { adSlotFields, adSlotEnabled, adSlotType, selectedAds, onAdSlotChange, onSelectAd } = useAdSlotSetting();

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

  const handleMoodSelect = (m: string) => {
    const newMood = postData.mood === m ? '' : m;
    const newTags = [...(postData.tags || ['', '', '', '', ''])];
    const prevAutoTag = postData.mood ? postData.mood.replace(' ', '') : '';
    if (newMood) {
      newTags[0] = newMood.replace(' ', '');
    } else if (newTags[0] === prevAutoTag) {
      newTags[0] = '';
    }
    setPostData(p => ({ ...p, mood: newMood, tags: newTags }));
  };

  const handleSubmit = async () => {
    if (!userData || !postData.content?.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const filteredTags = (postData.tags || []).filter(t => t.trim() !== '');
      await onSubmit({ ...postData, tags: filteredTags, ...adSlotFields }, editingPost?.id);
    } finally { setIsSubmitting(false); }
  };

  return (
    <div className="w-full max-w-[1024px] mx-auto py-8 animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col shadow-sm" style={{ maxHeight: 'calc(100vh - 80px)' }}>
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 h-12 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="text-[12px] font-bold text-slate-400 tracking-wide uppercase">{editingPost ? '글 수정' : '새 글 작성'}</span>
            <span className="text-[11px] font-bold text-emerald-500">🏃 마라톤의 전령</span>
            {isUploading && <span className="flex items-center gap-1.5 text-[11px] font-bold text-blue-500"><span className="w-2.5 h-2.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin inline-block" />이미지 업로드 중</span>}
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={onClose} className="px-3.5 h-7 rounded-md text-[12px] font-bold text-slate-500 hover:bg-slate-100 transition-colors">취소</button>
            <button onClick={handleSubmit} disabled={isSubmitting || isUploading} className={`px-4 h-7 rounded-md text-[12px] font-bold transition-all ${isSubmitting || isUploading ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-900 text-white hover:bg-blue-600'}`}>{isSubmitting ? '업로드 중...' : '새글 올리기'}</button>
          </div>
        </div>

        {/* 제목 */}
        <div className="flex items-center px-5 py-3 border-b border-slate-100 shrink-0">
          <input type="text" placeholder="제목을 입력하세요" value={postData.title || ''} onChange={(e) => setPostData({ ...postData, title: e.target.value })} className="w-full bg-transparent text-[18px] font-bold text-slate-900 outline-none placeholder:text-slate-200 placeholder:font-normal" />
        </div>

        {/* 전령 전달 내용 */}
        <div className="flex items-center gap-2 px-5 py-2 border-b border-slate-100 shrink-0 flex-wrap">
          <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest shrink-0">전령 전달 내용</span>
          {HERALD_TAGS.map(m => (
            <button key={m} type="button" onClick={() => handleMoodSelect(m)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${postData.mood === m ? 'bg-emerald-100 text-emerald-700 border border-emerald-300' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>{m}</button>
          ))}
        </div>

        {/* 에디터 */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <TiptapEditor content={postData.content || ''} onChange={(html) => setPostData(prev => ({ ...prev, content: html }))} onImageUpload={uploadFile} />
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
          onChange={onAdSlotChange}
          selectedAds={selectedAds} onSelectAd={onSelectAd}
          postCategory={postData.category} />
      </div>
    </div>
  );
};

export default CreateMarathonHerald;
