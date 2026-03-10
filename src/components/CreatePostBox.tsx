// src/components/CreatePostBox.tsx
import React, { useState, useRef, useEffect } from 'react';
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3Client, BUCKET_NAME, PUBLIC_URL } from '../s3Client';
import type { Post } from '../types';

interface Props {
  userData: any;
  editingPost: Post | null;
  activeMenu: string;
  menuMessages: Record<string, any>;
  onSubmit: (postData: Partial<Post>, postId?: string) => Promise<void>;
  onClose: () => void;
}

const CreatePostBox = ({ userData, editingPost, activeMenu, menuMessages, onSubmit, onClose }: Props) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const savedSelection = useRef<Range | null>(null);

  const [postData, setPostData] = useState<Partial<Post>>({
    title: editingPost?.title || '',
    content: editingPost?.content || '',
    category: editingPost?.category || (menuMessages[activeMenu]?.title || '나의 이야기'),
    tags: editingPost?.tags || ['', '', '', '', ''],
    isOneCut: false
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (editingPost && editorRef.current) {
      editorRef.current.innerHTML = editingPost.content;
    }
  }, [editingPost]);

  const menuOptions = Object.keys(menuMessages)
    .filter(key => key !== 'onecut')
    .map(key => ({
      id: key,
      title: menuMessages[key].title
    }));

  // 🚀 커서 위치 저장
  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedSelection.current = sel.getRangeAt(0);
    }
  };

  // 🚀 커서 위치 복구
  const restoreSelection = () => {
    if (savedSelection.current) {
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(savedSelection.current);
      }
    }
  };

  const execCommand = (command: string, value: string = "") => {
    editorRef.current?.focus();
    restoreSelection();
    
    let finalValue = value;
    if (command === 'createLink') {
      const url = prompt("링크 주소를 입력해주시오:");
      if (!url) return;
      finalValue = url;
    }
    
    document.execCommand(command, false, finalValue);
    saveSelection(); // 명령 실행 후 새 위치 저장
    
    if (editorRef.current) {
      setPostData(prev => ({ ...prev, content: editorRef.current?.innerHTML || "" }));
    }
  };

  const uploadFile = async (file: File): Promise<string | null> => {
    if (!userData) return null;
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
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          saveSelection();
          setIsUploading(true);
          const url = await uploadFile(file);
          if (url) {
            restoreSelection();
            document.execCommand("insertImage", false, url);
            if (editorRef.current) {
              setPostData(prev => ({ ...prev, content: editorRef.current?.innerHTML || "" }));
            }
          }
          setIsUploading(false);
        }
      }
    }
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      const url = await uploadFile(file);
      if (url) {
        editorRef.current?.focus();
        restoreSelection();
        document.execCommand("insertImage", false, url);
        if (editorRef.current) {
          setPostData(prev => ({ ...prev, content: editorRef.current?.innerHTML || "" }));
        }
      }
      setIsUploading(false);
    }
  };

  const handleTagChange = (index: number, value: string) => {
    const newTags = [...(postData.tags || ['', '', '', '', ''])];
    newTags[index] = value;
    setPostData({ ...postData, tags: newTags });
  };

  const handleSubmit = async () => {
    const currentContent = editorRef.current?.innerHTML || "";
    if (!userData || !currentContent.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const filteredTags = (postData.tags || []).filter(tag => tag.trim() !== '');
      await onSubmit({ ...postData, content: currentContent, tags: filteredTags }, editingPost?.id);
    } finally {
      setIsSubmitting(false);
    }
  };

  const ToolbarButton = ({ icon, cmd, val = "", label = "" }: { icon?: React.ReactNode, cmd: string, val?: string, label?: string }) => (
    <button
      type="button"
      onMouseDown={(e) => { 
        e.preventDefault(); 
        saveSelection(); 
        execCommand(cmd, val); 
      }}
      className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-blue-600 transition-all cursor-pointer flex items-center justify-center gap-1 min-w-[32px]"
      title={label}
    >
      {icon}
      {label && <span className="text-[13px] font-black uppercase tracking-tighter leading-none">{label}</span>}
    </button>
  );

  return (
    <div className="w-full max-w-[1200px] mx-auto py-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className="px-10 py-6 flex justify-between items-center border-b border-slate-50">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <h2 className="text-[15px] font-[1000] text-slate-900 tracking-tighter">새 할말</h2>
          </div>
          <div className="flex items-center gap-6">
            <button onClick={onClose} className="text-[13px] font-bold text-slate-400 hover:text-slate-600 transition-colors cursor-pointer">취소</button>
            <button 
              onClick={handleSubmit}
              disabled={isSubmitting || isUploading}
              className={`px-8 py-2 rounded-xl font-black text-[13px] transition-all shadow-lg shadow-blue-100 ${
                isSubmitting || isUploading ? 'bg-slate-100 text-slate-300' : 'bg-[#0F172A] text-white hover:opacity-90 cursor-pointer'
              }`}
            >
              {isSubmitting ? '올리는 중...' : isUploading ? '이미지 업로드 중...' : '할말 올리기'}
            </button>
          </div>
        </div>

        <div className="px-10 py-8 space-y-4">
          {/* Category & Title */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 space-y-1">
              <label className="text-[11px] font-bold text-slate-400 ml-1">주제 선택</label>
              <div className="relative">
                <select 
                  value={Object.keys(menuMessages).find(key => menuMessages[key].title === postData.category) || activeMenu}
                  onChange={(e) => setPostData({ ...postData, category: menuMessages[e.target.value].title })}
                  className="w-full appearance-none bg-slate-50 border border-slate-50 px-6 py-2.5 rounded-2xl text-[14px] font-bold text-slate-700 focus:bg-white focus:border-blue-500 outline-none transition-all cursor-pointer"
                >
                  {menuOptions.map(opt => (
                    <option key={opt.id} value={opt.id}>{opt.title}</option>
                  ))}
                </select>
                <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
                </div>
              </div>
            </div>
            <div className="flex-[3] space-y-1">
              <label className="text-[11px] font-bold text-slate-400 ml-1">할말 제목</label>
              <input
                type="text"
                placeholder="무슨 할말이 있으시오?"
                value={postData.title || ''}
                onChange={(e) => setPostData({ ...postData, title: e.target.value })}
                className="w-full bg-slate-50 border border-slate-50 px-6 py-2.5 rounded-2xl text-[14px] font-bold text-slate-700 focus:bg-white focus:border-blue-500 outline-none transition-all placeholder:text-slate-300"
              />
            </div>
          </div>

          {/* Content Editor Area */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-400 ml-1">올릴 내용</label>
            <div className="bg-white border border-slate-100 rounded-[2rem] overflow-hidden focus-within:border-blue-200 transition-all flex flex-col relative">
              {/* World-class Rich Toolbar */}
              <div className="px-4 py-2.5 border-b border-slate-50 flex flex-wrap items-center gap-1 bg-slate-50/30">
                <div className="flex items-center gap-1 px-2 border-r border-slate-200">
                  <ToolbarButton label="H1" cmd="formatBlock" val="H1" />
                  <ToolbarButton label="H2" cmd="formatBlock" val="H2" />
                  <ToolbarButton label="P" cmd="formatBlock" val="P" />
                </div>
                
                <div className="flex items-center gap-1 px-2 border-r border-slate-200">
                  <ToolbarButton label="B" cmd="bold" />
                  <ToolbarButton icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M10 4h10M4 20h10M15 4L9 20"/></svg>} cmd="italic" />
                  <ToolbarButton icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M6 4v10.5a4.5 4.5 0 109 0V4M4 4h4m7 0h4M4 18h11"/></svg>} cmd="underline" />
                  <ToolbarButton icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M5 12h14M19 6H5a2 2 0 00-2 2v8a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2z"/></svg>} cmd="strikeThrough" />
                </div>

                <div className="flex items-center gap-1 px-2 border-r border-slate-200">
                  <ToolbarButton icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12"/></svg>} cmd="insertUnorderedList" />
                  <ToolbarButton icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5"/></svg>} cmd="insertOrderedList" />
                </div>

                <div className="flex items-center gap-1 px-2 border-r border-slate-200">
                  <ToolbarButton icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M3.75 12h16.5m-16.5 0a9 9 0 1118 0 9 9 0 01-18 0z"/></svg>} cmd="justifyLeft" />
                  <ToolbarButton icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M3.75 12h16.5m-16.5 0a9 9 0 1118 0 9 9 0 01-18 0z"/></svg>} cmd="justifyCenter" />
                </div>

                <div className="flex items-center gap-1 px-2">
                  <button 
                    type="button" 
                    onMouseDown={(e) => { e.preventDefault(); saveSelection(); }}
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-blue-600 transition-all cursor-pointer flex items-center gap-1"
                    title="이미지 추가"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>
                  </button>
                  <ToolbarButton icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"/></svg>} cmd="createLink" />
                  <ToolbarButton icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M5.25 8.25h15m-16.5 6.75h15"/></svg>} cmd="insertHorizontalRule" />
                </div>
              </div>

              {/* Hidden File Input */}
              <input type="file" ref={fileInputRef} onChange={handleImageSelect} accept="image/*" className="hidden" />

              {/* Rich Editor */}
              <div
                ref={editorRef}
                contentEditable
                onPaste={handlePaste}
                onMouseUp={saveSelection}
                onKeyUp={saveSelection}
                onInput={() => {
                  saveSelection();
                  setPostData(prev => ({ ...prev, content: editorRef.current?.innerHTML || "" }));
                }}
                className="w-full px-8 py-6 text-[15px] font-medium text-slate-700 outline-none min-h-[400px] overflow-y-auto leading-relaxed prose prose-slate max-w-none placeholder:text-slate-200"
                {...{placeholder: "나누고 싶은 할말을 자유롭게 적어주시오. 이미지를 복사해서 붙여넣을 수도 있소."} as any}
              />
              
              {isUploading && (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center z-10 animate-in fade-in">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm font-black text-slate-600">이미지를 올리고 있소...</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-400 ml-1">태그 (최대 5개)</label>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
              {[0, 1, 2, 3, 4].map((idx) => (
                <div key={idx} className="relative">
                  <span className="absolute left-5 top-1/2 -translate-y-1/2 text-blue-400 font-bold text-[13px]">#</span>
                  <input
                    type="text"
                    placeholder="태그입력"
                    value={postData.tags?.[idx] || ''}
                    onChange={(e) => handleTagChange(idx, e.target.value)}
                    className="w-full bg-slate-50 border border-slate-50 pl-9 pr-4 py-3 rounded-2xl text-[13px] font-bold text-slate-700 focus:bg-white focus:border-blue-500 outline-none transition-all placeholder:text-slate-300"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <style>{`
        [contenteditable]:empty:before {
          content: attr(placeholder);
          color: #cbd5e1;
          cursor: text;
        }
        .prose img {
          max-width: 100%;
          height: auto;
          border-radius: 1rem;
          margin: 1.5rem 0;
          box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1);
        }
        .prose h1 { font-size: 1.875rem; font-weight: 900; margin-top: 2rem; margin-bottom: 1rem; color: #0f172a; }
        .prose h2 { font-size: 1.5rem; font-weight: 800; margin-top: 1.5rem; margin-bottom: 0.75rem; color: #1e293b; }
        .prose p { margin-bottom: 1rem; }
      `}</style>
    </div>
  );
};

export default CreatePostBox;
