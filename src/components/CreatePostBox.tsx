// src/components/CreatePostBox.tsx
import { useState, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Underline from '@tiptap/extension-underline';
import { s3Client, BUCKET_NAME, PUBLIC_URL } from '../s3Client';
import { PutObjectCommand } from "@aws-sdk/client-s3";

interface Props {
  userData: any;
  onSubmit: (title: string, content: string, imageUrl?: string, linkUrl?: string, tags?: string[]) => Promise<void>;
  onClose: () => void;
}

const CreatePostBox = ({ userData, onSubmit, onClose }: Props) => {
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState(["", "", "", "", ""]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false }),
      Image.configure({
        HTMLAttributes: { class: 'rounded-lg border border-slate-100 my-2 max-w-full mx-auto' },
      }),
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'prose prose-slate max-w-none focus:outline-none min-h-[250px] px-4 py-4 text-xs font-medium text-slate-700 leading-relaxed',
      },
    },
  });

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
      alert("이미지 전송 실패");
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
      const thumbnail = firstImgMatch ? firstImgMatch[1] : undefined;
      const validTags = tags.filter(t => t.trim() !== "");
      
      await onSubmit(title, content, thumbnail, undefined, validTags);
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
      className={`p-1.5 rounded hover:bg-slate-100 transition-colors ${active ? 'text-blue-600 bg-blue-50' : 'text-slate-500'}`}
    >
      {children}
    </button>
  );

  return (
    <div className="w-full bg-white h-[calc(100vh-80px)] p-4 md:p-6 animate-in fade-in duration-500 flex flex-col rounded-2xl shadow-sm border border-slate-200">
      <div className="w-full flex flex-col gap-4 h-full">
        
        {/* 🚀 헤더: 발행/취소 */}
        <div className="flex justify-between items-center pb-2 border-b border-slate-50">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-600"></div>
            <span className="text-[10px] font-black text-slate-900 tracking-widest uppercase italic">New Publication</span>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-1 rounded-lg text-[10px] font-black text-slate-400 hover:bg-slate-50 transition-all">취소</button>
            <button 
              onClick={handleSubmit} 
              disabled={isSubmitting || isUploading}
              className={`px-4 py-1 rounded-lg text-[10px] font-black transition-all shadow-sm ${isSubmitting ? 'bg-slate-100 text-slate-400' : 'bg-slate-900 text-white hover:bg-blue-600'}`}
            >
              {isSubmitting ? '전송 중...' : '발행하기'}
            </button>
          </div>
        </div>

        {/* 🚀 제목 섹션 */}
        <section className="flex flex-col gap-1.5">
          <label className="text-[10px] font-black text-slate-900">제목*</label>
          <input 
            type="text" 
            placeholder="제목을 입력해 주세요" 
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500 transition-all text-xs font-bold placeholder:text-slate-300 shadow-sm"
          />
        </section>

        {/* 🚀 내용 섹션 (에디터) */}
        <section className="flex flex-col gap-1.5 flex-1 min-h-0">
          <label className="text-[10px] font-black text-slate-900">내용*</label>
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm focus-within:border-blue-500 transition-all flex flex-col h-full">
            {/* 🛠️ 툴바 */}
            <div className="bg-white border-b border-slate-100 p-1 flex flex-wrap gap-0.5 items-center shrink-0">
              <ToolbarButton onClick={() => editor?.chain().focus().undo().run()} title="실행 취소">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
              </ToolbarButton>
              <ToolbarButton onClick={() => editor?.chain().focus().redo().run()} title="다시 실행">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 10h-10a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" /></svg>
              </ToolbarButton>
              <div className="w-[1px] h-3 bg-slate-200 mx-1"></div>
              
              <ToolbarButton onClick={() => editor?.chain().focus().toggleBold().run()} active={editor?.isActive('bold')} title="굵게">
                <span className="font-black text-[11px]">B</span>
              </ToolbarButton>
              <ToolbarButton onClick={() => editor?.chain().focus().toggleItalic().run()} active={editor?.isActive('italic')} title="기울임">
                <span className="italic font-black text-[11px]">I</span>
              </ToolbarButton>
              <ToolbarButton onClick={() => editor?.chain().focus().toggleUnderline().run()} active={editor?.isActive('underline')} title="밑줄">
                <span className="underline font-black text-[11px]">U</span>
              </ToolbarButton>
              <ToolbarButton onClick={() => editor?.chain().focus().toggleStrike().run()} active={editor?.isActive('strike')} title="취소선">
                <span className="line-through font-black text-[11px]">S</span>
              </ToolbarButton>
              
              <div className="w-[1px] h-3 bg-slate-200 mx-1"></div>
              
              <ToolbarButton onClick={() => editor?.chain().focus().toggleBulletList().run()} active={editor?.isActive('bulletList')} title="불렛 리스트">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
              </ToolbarButton>
              
              <ToolbarButton onClick={() => fileInputRef.current?.click()} title="이미지 삽입">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </ToolbarButton>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />

              <ToolbarButton onClick={() => editor?.chain().focus().toggleBlockquote().run()} active={editor?.isActive('blockquote')} title="인용구">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M14.017 21L14.017 18C14.017 16.8954 14.9124 16 16.017 16H19.017C19.5693 16 20.017 15.5523 20.017 15V9C20.017 8.44772 19.5693 8 19.017 8H16.017C15.4647 8 15.017 8.44772 15.017 9V12H13.017V9C13.017 6.79086 14.8079 5 17.017 5H19.017C21.2261 5 23.017 6.79086 23.017 9V15C23.017 17.2091 21.2261 19 19.017 19H17.517C17.2409 19 17.017 19.2239 17.017 19.5V21H14.017ZM1.017 21V18C1.017 16.8954 1.91243 16 3.017 16H6.017C6.56928 16 7.017 15.5523 7.017 15V9C7.017 8.44772 6.56928 8 6.017 8H3.017C2.46472 8 2.017 8.44772 2.017 9V12H0.017V9C0.017 6.79086 1.80786 5 4.017 5H6.017C8.22614 5 10.017 6.79086 10.017 9V15C10.017 17.2091 8.22614 19 6.017 19H4.517C4.24086 19 4.017 19.2239 4.017 19.5V21H1.017Z" /></svg>
              </ToolbarButton>
            </div>
            {/* 🛠️ 편집 영역 */}
            <div className="bg-white flex-1 overflow-y-auto no-scrollbar">
              <EditorContent editor={editor} />
            </div>
          </div>
        </section>

        {/* 🚀 해시태그 섹션 */}
        <section className="flex flex-col gap-1.5 shrink-0">
          <label className="text-[10px] font-black text-slate-900">해시태그 (최대 5개)</label>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag, idx) => (
              <div key={idx} className="flex-1 min-w-[70px] relative group">
                <span className="absolute left-1.5 top-1.5 text-slate-300 font-black text-[9px]">#</span>
                <input 
                  value={tag}
                  onChange={(e) => handleTagChange(idx, e.target.value)}
                  placeholder="태그입력"
                  className="w-full pl-4 pr-1.5 py-1 border-b border-slate-200 outline-none focus:border-blue-500 transition-all text-[9px] font-bold bg-transparent placeholder:text-slate-300/40 text-slate-600"
                />
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
};

export default CreatePostBox;
