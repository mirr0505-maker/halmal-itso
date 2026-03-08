// src/components/CreatePostBox.tsx
import { useState, useRef, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Underline from '@tiptap/extension-underline';
import { s3Client, BUCKET_NAME, PUBLIC_URL } from '../s3Client';
import { PutObjectCommand } from "@aws-sdk/client-s3";
import type { Post } from '../types';

interface Props {
  userData: any;
  editingPost?: Post | null; // 🚀 수정 모드용 데이터
  onSubmit: (title: string, content: string, imageUrl?: string, linkUrl?: string, tags?: string[], category?: string, postId?: string) => Promise<void>;
  onClose: () => void;
}

const CATEGORIES = [
  "나의 이야기",
  "벌거벗은 임금님",
  "임금님 귀는 당나귀 귀",
  "지식 소매상",
  "뼈때리는 글",
  "현지 소식",
  "유배·귀양지"
];

const CreatePostBox = ({ userData, editingPost, onSubmit, onClose }: Props) => {
  const [title, setTitle] = useState(editingPost?.title || "");
  const [category, setCategory] = useState(editingPost?.category || CATEGORIES[0]);
  const [tags, setTags] = useState(editingPost?.tags ? [...editingPost.tags, "", "", "", "", ""].slice(0, 5) : ["", "", "", "", ""]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false }),
      Image.configure({
        HTMLAttributes: { class: 'rounded-xl border border-slate-100 my-2 max-w-full mx-auto' },
      }),
    ],
    content: editingPost?.content || '',
    editorProps: {
      attributes: {
        class: 'prose prose-slate max-w-none focus:outline-none min-h-[300px] px-5 py-5 text-[13.5px] font-medium text-slate-700 leading-relaxed',
      },
    },
  });

  // 🚀 수정 모드일 때 에디터 내용 초기화
  useEffect(() => {
    if (editingPost && editor) {
      editor.commands.setContent(editingPost.content);
    }
  }, [editingPost, editor]);

  const handleTagChange = (index: number, value: string) => {
    const newTags = [...tags];
    newTags[index] = value;
    setTags(newTags);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    setIsUploading(true);
    try {
      const fileName = `posts/${userData.nickname}_${Date.now()}_${file.name}`;
      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME, Key: fileName, Body: file, ContentType: file.type,
      });
      await s3Client.send(command);
      const url = `${PUBLIC_URL}/${fileName}`;
      editor.chain().focus().setImage({ src: url }).run();
    } catch (error) {
      console.error(error);
      alert("이미지 전송에 실패했소.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async () => {
    const content = editor?.getHTML() || "";
    if (!title.trim() || editor?.getText().trim() === "") return alert("제목과 내용을 모두 채워주시오!");
    
    setIsSubmitting(true);
    try {
      const firstImgMatch = content.match(/<img[^>]+src="([^">]+)"/);
      const thumbnail = firstImgMatch ? firstImgMatch[1] : (editingPost?.imageUrl || undefined);
      const validTags = tags.filter(t => t.trim() !== "");
      
      await onSubmit(title, content, thumbnail, undefined, validTags, category, editingPost?.id);
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const ToolbarButton = ({ onClick, active, children, title }: any) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-2 rounded-lg hover:bg-slate-100 transition-colors ${active ? 'text-blue-600 bg-blue-50' : 'text-slate-400'}`}
    >
      {children}
    </button>
  );

  return (
    <div className="w-full bg-white h-[calc(100vh-100px)] p-6 md:p-8 animate-in fade-in slide-in-from-bottom-2 duration-500 flex flex-col rounded-[2rem] shadow-xl shadow-blue-900/5 border border-slate-100 overflow-hidden">
      <div className="w-full flex flex-col gap-6 h-full overflow-y-auto no-scrollbar">
        
        {/* 🚀 상단 헤더 영역 */}
        <div className="flex justify-between items-center pb-4 border-b border-slate-50 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></div>
            <h2 className="text-[13px] font-[1000] text-slate-900 tracking-tighter uppercase italic">
              {editingPost ? '할말 수정하기' : '새 할말 남기기'}
            </h2>
          </div>
          <div className="flex gap-2.5">
            <button onClick={onClose} className="px-4 py-2 rounded-xl text-[12px] font-black text-slate-400 hover:bg-slate-50 transition-all uppercase tracking-tighter">취소</button>
            <button 
              onClick={handleSubmit} 
              disabled={isSubmitting || isUploading}
              className={`px-6 py-2 rounded-xl text-[12px] font-[1000] transition-all shadow-md active:scale-95 ${isSubmitting ? 'bg-slate-100 text-slate-400' : 'bg-slate-900 text-white hover:bg-blue-600 hover:shadow-blue-200'}`}
            >
              {isSubmitting ? '전송 중...' : '할말 올리기'}
            </button>
          </div>
        </div>

        {/* 🚀 카테고리 및 제목 섹션 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 shrink-0">
          <div className="md:col-span-1 flex flex-col gap-2">
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest pl-1">주제 선택</label>
            <div className="relative">
              <select 
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full appearance-none bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-[13px] font-black text-slate-700 outline-none focus:border-blue-500 focus:bg-white transition-all cursor-pointer shadow-sm"
              >
                {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>
          </div>
          <div className="md:col-span-3 flex flex-col gap-2">
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest pl-1">할말 제목</label>
            <input 
              type="text" 
              placeholder="무슨 할말이 있으시오?" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 border border-slate-100 bg-slate-50 rounded-xl outline-none focus:border-blue-500 focus:bg-white transition-all text-[14px] font-[1000] placeholder:text-slate-300 shadow-sm tracking-tight"
            />
          </div>
        </div>

        {/* 🚀 에디터 섹션 */}
        <div className="flex flex-col gap-2 flex-1 min-h-0">
          <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest pl-1">상세 내용</label>
          <div className="border border-slate-100 rounded-[1.5rem] overflow-hidden shadow-sm focus-within:border-blue-500 transition-all flex flex-col h-full bg-white">
            {/* 🛠️ 툴바 */}
            <div className="bg-slate-50/50 border-b border-slate-50 p-1.5 flex flex-wrap gap-1 items-center shrink-0">
              <ToolbarButton onClick={() => editor?.chain().focus().undo().run()} title="실행 취소">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
              </ToolbarButton>
              <ToolbarButton onClick={() => editor?.chain().focus().redo().run()} title="다시 실행">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 10h-10a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" /></svg>
              </ToolbarButton>
              <div className="w-px h-4 bg-slate-200 mx-1"></div>
              
              <ToolbarButton onClick={() => editor?.chain().focus().toggleBold().run()} active={editor?.isActive('bold')} title="굵게">
                <span className="font-[1000] text-[13px]">B</span>
              </ToolbarButton>
              <ToolbarButton onClick={() => editor?.chain().focus().toggleUnderline().run()} active={editor?.isActive('underline')} title="밑줄">
                <span className="underline font-[1000] text-[13px]">U</span>
              </ToolbarButton>
              
              <div className="w-px h-4 bg-slate-200 mx-1"></div>
              
              <ToolbarButton onClick={() => fileInputRef.current?.click()} title="이미지 삽입">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </ToolbarButton>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />

              <ToolbarButton onClick={() => editor?.chain().focus().toggleBlockquote().run()} active={editor?.isActive('blockquote')} title="인용구">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M14.017 21L14.017 18C14.017 16.8954 14.9124 16 16.017 16H19.017C19.5693 16 20.017 15.5523 20.017 15V9C20.017 8.44772 19.5693 8 19.017 8H16.017C15.4647 8 15.017 8.44772 15.017 9V12H13.017V9C13.017 6.79086 14.8079 5 17.017 5H19.017C21.2261 5 23.017 6.79086 23.017 9V15C23.017 17.2091 21.2261 19 19.017 19H17.517C17.2409 19 17.017 19.2239 17.017 19.5V21H14.017ZM1.017 21V18C1.017 16.8954 1.91243 16 3.017 16H6.017C6.56928 16 7.017 15.5523 7.017 15V9C7.017 8.44772 6.56928 8 6.017 8H3.017C2.46472 8 2.017 8.44772 2.017 9V12H0.017V9C0.017 6.79086 1.80786 5 4.017 5H6.017C8.22614 5 10.017 6.79086 10.017 9V15C10.017 17.2091 8.22614 19 6.017 19H4.517C4.24086 19 4.017 19.2239 4.017 19.5V21H1.017Z" /></svg>
              </ToolbarButton>
            </div>
            {/* 🛠️ 편집 영역 */}
            <div className="bg-white flex-1 overflow-y-auto no-scrollbar">
              <EditorContent editor={editor} />
            </div>
          </div>
        </div>

        {/* 🚀 해시태그 섹션 */}
        <div className="flex flex-col gap-2 shrink-0 pb-2">
          <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest pl-1">태그 (최대 5개)</label>
          <div className="flex flex-wrap gap-3">
            {tags.map((tag, idx) => (
              <div key={idx} className="flex-1 min-w-[100px] relative group">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400 font-black text-[12px]">#</span>
                <input 
                  value={tag}
                  onChange={(e) => handleTagChange(idx, e.target.value)}
                  placeholder="태그입력"
                  className="w-full pl-6 pr-3 py-2 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:border-blue-500 focus:bg-white transition-all text-[12px] font-bold placeholder:text-slate-300 text-slate-600 shadow-sm"
                />
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

export default CreatePostBox;
