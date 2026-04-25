// src/components/CreateLocalNews.tsx — 마법 수정 구슬 새글 작성 폼
import { useState } from 'react';
import { uploadToR2 } from '../uploadToR2';
import type { Post, UserData } from '../types';
import TiptapEditor from './TiptapEditor';
import AdSlotSetting from './ads/AdSlotSetting';
import { useAdSlotSetting } from './ads/useAdSlotSetting';
import { calculateLevel } from '../utils';

interface Props {
  userData: UserData;
  editingPost: Post | null;
  onSubmit: (postData: Partial<Post>, postId?: string) => Promise<void>;
  onClose: () => void;
}

const CreateLocalNews = ({ userData, editingPost, onSubmit, onClose }: Props) => {
  // 🚀 국내/해외 지역 분리: "국내:서울 강남구" 또는 "해외:도쿄 시부야" 형식으로 저장
  const existingLocation = editingPost?.location || '';
  const [domesticLoc, setDomesticLoc] = useState(existingLocation.startsWith('국내:') ? existingLocation.slice(3) : '');
  const [overseasLoc, setOverseasLoc] = useState(existingLocation.startsWith('해외:') ? existingLocation.slice(3) : '');

  const [postData, setPostData] = useState<Partial<Post>>({
    title: editingPost?.title || '',
    content: editingPost?.content || '',
    category: '마법 수정 구슬',
    tags: editingPost?.tags || ['', '', '', '', ''],
    location: existingLocation,
    isOneCut: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  // 🚀 ADSMARKET: 광고 슬롯 설정
  const { adSlotFields, adSlotEnabled, adSlotType, onAdSlotChange } = useAdSlotSetting();

  // 🚀 국내 입력 시: 해외 잠금, location + tags[3] 자동 업데이트
  // Array.from으로 5칸 보장 — tags가 5개 미만이면 중간에 undefined 구멍이 생겨 .trim() 에러 발생
  const handleDomesticChange = (val: string) => {
    setDomesticLoc(val);
    if (val) setOverseasLoc('');
    const location = val ? `국내:${val}` : '';
    const newTags = Array.from({ length: 5 }, (_, i) => (postData.tags || [])[i] ?? '');
    newTags[3] = val ? `국내 ${val}` : '';
    setPostData(p => ({ ...p, location, tags: newTags }));
  };

  // 🚀 해외 입력 시: 국내 잠금, location + tags[3] 자동 업데이트
  const handleOverseasChange = (val: string) => {
    setOverseasLoc(val);
    if (val) setDomesticLoc('');
    const location = val ? `해외:${val}` : '';
    const newTags = Array.from({ length: 5 }, (_, i) => (postData.tags || [])[i] ?? '');
    newTags[3] = val ? `해외 ${val}` : '';
    setPostData(p => ({ ...p, location, tags: newTags }));
  };

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
    setIsSubmitting(true);
    try {
      const filteredTags = (postData.tags || []).filter(t => t?.trim() !== '');
      // undefined 필드 제거 — Firestore updateDoc는 undefined 값을 거부함
      const cleanData = Object.fromEntries(
        Object.entries({ ...postData, tags: filteredTags, ...adSlotFields }).filter(([, v]) => v !== undefined)
      ) as Partial<Post>;
      await onSubmit(cleanData, editingPost?.id);
    } catch (e: unknown) {
      alert(`저장 실패: ${(e as Error)?.message || '알 수 없는 오류'}`);
    } finally { setIsSubmitting(false); }
  };

  return (
    <div className="w-full max-w-[1024px] mx-auto py-8 animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col shadow-sm" style={{ maxHeight: 'calc(100vh - 80px)' }}>
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 h-12 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="text-[12px] font-bold text-slate-400 tracking-wide uppercase">{editingPost ? '글 수정' : '새 글 기록'}</span>
            <span className="text-[11px] font-bold text-indigo-500">🔮 마법 수정 구슬</span>
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

        {/* 🚀 발생 지역 — 국내/해외 상호 배타 입력 */}
        <div className="flex items-center gap-0 border-b border-slate-100 shrink-0 divide-x divide-slate-100">
          <div className="flex items-center gap-2 px-5 py-2.5 flex-1">
            <span className="text-[10px] font-black text-blue-400 tracking-widest shrink-0 whitespace-nowrap">📍 국내</span>
            <input
              type="text"
              placeholder="예: 서울 강남구, 부산 해운대..."
              value={domesticLoc}
              onChange={e => handleDomesticChange(e.target.value)}
              disabled={!!overseasLoc}
              className="flex-1 bg-transparent text-[13px] font-bold text-slate-700 outline-none border-b border-slate-200 focus:border-blue-400 pb-px placeholder:text-slate-300 placeholder:font-normal disabled:opacity-30 disabled:cursor-not-allowed"
            />
          </div>
          <div className="flex items-center gap-2 px-5 py-2.5 flex-1">
            <span className="text-[10px] font-black text-indigo-400 tracking-widest shrink-0 whitespace-nowrap">🌐 해외</span>
            <input
              type="text"
              placeholder="예: 도쿄 시부야, 뉴욕..."
              value={overseasLoc}
              onChange={e => handleOverseasChange(e.target.value)}
              disabled={!!domesticLoc}
              className="flex-1 bg-transparent text-[13px] font-bold text-slate-700 outline-none border-b border-slate-200 focus:border-indigo-400 pb-px placeholder:text-slate-300 placeholder:font-normal disabled:opacity-30 disabled:cursor-not-allowed"
            />
          </div>
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
          onChange={onAdSlotChange} />
      </div>
    </div>
  );
};

export default CreateLocalNews;
