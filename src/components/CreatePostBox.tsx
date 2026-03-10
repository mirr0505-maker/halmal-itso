// src/components/CreatePostBox.tsx
import React, { useState, useRef, useEffect } from 'react';
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
    category: editingPost?.category || (menuMessages[activeMenu]?.title || '나의 이야기'),
    tags: editingPost?.tags || ['', '', '', '', ''],
    isOneCut: false
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const menuOptions = Object.keys(menuMessages)
    .filter(key => key !== 'onecut')
    .map(key => ({
      id: key,
      title: menuMessages[key].title
    }));

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
      alert("이미지 업로드에 실패했소.");
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
    <div className="w-full max-w-[1200px] mx-auto py-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header - Fixed */}
        <div className="px-10 py-7 flex justify-between items-center border-b border-slate-50 bg-white z-[60] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
            <h2 className="text-[17px] font-[1000] text-slate-900 tracking-tighter">새 할말 기록</h2>
          </div>
          <div className="flex items-center gap-6">
            <button onClick={onClose} className="text-[14px] font-bold text-slate-400 hover:text-slate-600 transition-colors cursor-pointer">취소</button>
            <button 
              onClick={handleSubmit}
              disabled={isSubmitting || isUploading}
              className={`px-10 py-2.5 rounded-2xl font-black text-[14px] transition-all shadow-xl shadow-blue-100/50 ${
                isSubmitting || isUploading ? 'bg-slate-100 text-slate-300' : 'bg-[#0F172A] text-white hover:scale-[1.02] active:scale-95 cursor-pointer'
              }`}
            >
              {isSubmitting ? '기록 중...' : isUploading ? '이미지 전송 중...' : '할말 올리기'}
            </button>
          </div>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto no-scrollbar">
          <div className="px-10 py-8 space-y-8">
            {/* Category & Title Section */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50/50 p-6 rounded-[2rem] border border-slate-50">
              <div className="md:col-span-1 space-y-2">
                <label className="text-[11px] font-black text-slate-400 ml-1 uppercase tracking-widest">주제</label>
                <div className="relative">
                  <select 
                    value={Object.keys(menuMessages).find(key => menuMessages[key].title === postData.category) || activeMenu}
                    onChange={(e) => setPostData({ ...postData, category: menuMessages[e.target.value].title })}
                    className="w-full appearance-none bg-white border-2 border-transparent px-5 py-3 rounded-2xl text-[14px] font-black text-slate-700 shadow-sm focus:border-blue-500 outline-none transition-all cursor-pointer"
                  >
                    {menuOptions.map(opt => (
                      <option key={opt.id} value={opt.id}>{opt.title}</option>
                    ))}
                  </select>
                  <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
                  </div>
                </div>
              </div>
              <div className="md:col-span-3 space-y-2">
                <label className="text-[11px] font-black text-slate-400 ml-1 uppercase tracking-widest">제목</label>
                <input
                  type="text"
                  placeholder="무슨 할말이 있으시오?"
                  value={postData.title || ''}
                  onChange={(e) => setPostData({ ...postData, title: e.target.value })}
                  className="w-full bg-white border-2 border-transparent px-6 py-3 rounded-2xl text-[15px] font-[1000] text-slate-900 shadow-sm focus:border-blue-500 outline-none transition-all placeholder:text-slate-200"
                />
              </div>
            </div>

            {/* UPGRADED Rich Editor Section */}
            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-400 ml-1 uppercase tracking-widest">본문 내용</label>
              <div className="bg-white border border-slate-100 rounded-[2.5rem] overflow-hidden flex flex-col shadow-inner">
                <TiptapEditor 
                  content={postData.content || ""} 
                  onChange={(html) => setPostData(prev => ({ ...prev, content: html }))} 
                  onImageUpload={uploadFile}
                />
                
                {isUploading && (
                  <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center z-[70] animate-in fade-in">
                    <div className="flex flex-col items-center gap-4 bg-white p-8 rounded-[2.5rem] shadow-2xl border border-slate-50">
                      <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      <span className="text-[14px] font-[1000] text-slate-900 tracking-tight">이미지를 전송하고 있소...</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Tags Section */}
            <div className="space-y-3">
              <label className="text-[11px] font-black text-slate-400 ml-1 uppercase tracking-widest">태그 키워드 (최대 5개)</label>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[0, 1, 2, 3, 4].map((idx) => (
                  <div key={idx} className="relative group">
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-blue-400 font-black text-[14px]">#</span>
                    <input
                      type="text"
                      placeholder="태그입력"
                      value={postData.tags?.[idx] || ''}
                      onChange={(e) => handleTagChange(idx, e.target.value)}
                      className="w-full bg-slate-50 border-2 border-transparent pl-10 pr-4 py-3 rounded-2xl text-[13px] font-black text-slate-700 group-hover:bg-white focus:bg-white focus:border-blue-500 focus:shadow-md outline-none transition-all placeholder:text-slate-200"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default CreatePostBox;
