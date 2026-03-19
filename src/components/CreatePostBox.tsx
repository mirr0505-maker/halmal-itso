// src/components/CreatePostBox.tsx
import { useState } from 'react';
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3Client, BUCKET_NAME, PUBLIC_URL } from '../s3Client';
import type { Post } from '../types';
import TiptapEditor from './TiptapEditor';

interface Props {
  userData: any;
  editingPost: Post | null;
  activeMenu: string;
  menuMessages: Record<string, any>;
  onSubmit: (postData: Partial<Post>, postId?: string) => Promise<void>;
  onClose: () => void;
}

const CreatePostBox = ({ userData, editingPost, activeMenu, menuMessages, onSubmit, onClose }: Props) => {
  const [postData, setPostData] = useState<Partial<Post>>({
    title: editingPost?.title || '',
    content: editingPost?.content || '',
    category: editingPost?.category || (menuMessages[activeMenu]?.categoryKey || menuMessages[activeMenu]?.title || '나의 이야기'),
    tags: editingPost?.tags || ['', '', '', '', ''],
    isOneCut: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const menuOptions = Object.keys(menuMessages)
    .filter(key => key !== 'onecut')
    .map(key => ({
      id: key,
      title: menuMessages[key].title,
      categoryKey: menuMessages[key].categoryKey || menuMessages[key].title,
    }));

  const selectedMenuKey = Object.keys(menuMessages).find(
    key => (menuMessages[key].categoryKey || menuMessages[key].title) === postData.category
  ) || activeMenu;

  const uploadFile = async (file: File): Promise<string | null> => {
    if (!userData) return null;
    setIsUploading(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `post_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
    const filePath = `uploads/${userData.uid}/${fileName}`;
    try {
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      await s3Client.send(new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: filePath,
        Body: uint8Array,
        ContentType: file.type,
      }));
      return `${PUBLIC_URL}/${filePath}`;
    } catch (error) {
      console.error("R2 업로드 실패:", error);
      alert("이미지 업로드에 실패했습니다.");
      return null;
    } finally {
      setIsUploading(false);
    }
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
      const filteredTags = (postData.tags || []).filter(tag => tag.trim() !== '');
      await onSubmit({ ...postData, tags: filteredTags }, editingPost?.id);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-[860px] mx-auto py-8 animate-in fade-in duration-200">
      <div
        className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col shadow-sm"
        style={{ maxHeight: 'calc(100vh - 80px)' }}
      >
        {/* ── 헤더 ── */}
        <div className="flex items-center justify-between px-5 h-12 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="text-[12px] font-bold text-slate-400 tracking-wide uppercase">
              {editingPost ? '글 수정' : '새 글 기록'}
            </span>
            {isUploading && (
              <span className="flex items-center gap-1.5 text-[11px] font-bold text-blue-500">
                <span className="w-2.5 h-2.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin inline-block" />
                이미지 업로드 중
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={onClose}
              className="px-3.5 h-7 rounded-md text-[12px] font-bold text-slate-500 hover:bg-slate-100 transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || isUploading}
              className={`px-4 h-7 rounded-md text-[12px] font-bold transition-all ${
                isSubmitting || isUploading
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-slate-900 text-white hover:bg-blue-600'
              }`}
            >
              {isSubmitting ? '업로드 중...' : '새글 올리기'}
            </button>
          </div>
        </div>

        {/* ── 주제 + 제목 ── */}
        <div className="flex items-stretch border-b border-slate-100 shrink-0">
          {/* 주제 드롭다운 */}
          <div className="flex items-center px-5 py-3 border-r border-slate-100 shrink-0">
            <div className="relative flex items-center gap-1.5">
              <svg className="w-3 h-3 text-slate-300 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 3l14 9-14 9V3z" />
              </svg>
              <select
                value={selectedMenuKey}
                onChange={(e) => setPostData({
                  ...postData,
                  category: menuMessages[e.target.value].categoryKey || menuMessages[e.target.value].title,
                })}
                className="appearance-none bg-transparent text-[13px] font-bold text-slate-600 outline-none cursor-pointer pr-4"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23cbd5e1' stroke-width='2.5'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19.5 8.25l-7.5 7.5-7.5-7.5'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 0 center',
                  backgroundSize: '14px',
                }}
              >
                {menuOptions.map(opt => (
                  <option key={opt.id} value={opt.id}>{opt.title}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 제목 입력 */}
          <div className="flex-1 flex items-center px-5 py-3">
            <input
              type="text"
              placeholder="제목을 입력하세요"
              value={postData.title || ''}
              onChange={(e) => setPostData({ ...postData, title: e.target.value })}
              className="w-full bg-transparent text-[18px] font-bold text-slate-900 outline-none placeholder:text-slate-200 placeholder:font-normal"
            />
          </div>
        </div>

        {/* ── 에디터 ── */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <TiptapEditor
            content={postData.content || ''}
            onChange={(html) => setPostData(prev => ({ ...prev, content: html }))}
            onImageUpload={uploadFile}
          />
        </div>

        {/* ── 태그 ── */}
        <div className="flex items-center gap-3 px-5 py-2.5 border-t border-slate-100 bg-slate-50/60 shrink-0 flex-wrap">
          <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Tags</span>
          {[0, 1, 2, 3, 4].map((idx) => (
            <div key={idx} className="flex items-center gap-0.5">
              <span className="text-slate-300 text-[12px] font-bold">#</span>
              <input
                type="text"
                placeholder="태그"
                value={postData.tags?.[idx] || ''}
                onChange={(e) => handleTagChange(idx, e.target.value)}
                className="w-16 bg-transparent text-[12px] font-bold text-slate-500 outline-none border-b border-transparent focus:border-slate-300 placeholder:text-slate-200 transition-colors pb-px"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CreatePostBox;
