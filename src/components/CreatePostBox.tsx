// src/components/CreatePostBox.tsx
import React, { useState, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { s3Client, BUCKET_NAME, PUBLIC_URL } from '../s3Client'; // 🚀 R2 설정 도입
import { PutObjectCommand } from "@aws-sdk/client-s3";

interface Props {
  userData: any;
  onSubmit: (title: string, content: string, imageUrl?: string, linkUrl?: string) => Promise<void>;
}

const CreatePostBox = ({ userData, onSubmit }: Props) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [title, setTitle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false); // 🚀 이미지 업로드 상태 추가
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ history: true }),
      Link.configure({ 
        openOnClick: false, 
        autolink: true, 
        linkOnPaste: true, 
        HTMLAttributes: { 
          class: 'text-blue-500 underline font-bold',
          target: '_blank',
          rel: 'noopener noreferrer'
        } 
      }),
      Image.configure({
        allowBase64: true,
        HTMLAttributes: { class: 'rounded-2xl border-2 border-slate-100 my-4 shadow-sm max-w-full' },
      }),
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'prose prose-slate max-w-none focus:outline-none min-h-[400px] px-2 py-4 text-base font-medium text-slate-600 leading-relaxed',
      },
    },
  });

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const content = editor?.getHTML() || "";
    const isContentEmpty = editor?.getText().trim().length === 0 && !content.includes('<img');
    
    if (!title.trim() || isContentEmpty) return alert("제목과 내용을 모두 채워주시오!");
    
    setIsSubmitting(true);
    try {
      const firstImgMatch = content.match(/<img[^>]+src="([^">]+)"/);
      const thumbnailFromContent = firstImgMatch ? firstImgMatch[1] : undefined;
      const firstLinkMatch = content.match(/href="([^">]+)"/);
      const linkFromContent = firstLinkMatch ? firstLinkMatch[1] : undefined;

      await onSubmit(title, content, thumbnailFromContent, linkFromContent);
      setTitle("");
      editor?.commands.clearContent();
      setIsExpanded(false);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 🚀 Cloudflare R2 이미지 업로드 및 에디터 삽입 로직
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("이미지 크기가 너무 크오! 2MB 이하의 사진만 허용하오.");
      return;
    }

    setIsUploading(true);
    try {
      const fileName = `posts/${userData.nickname}_${Date.now()}_${file.name}`;
      
      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileName,
        Body: file,
        ContentType: file.type,
      });

      await s3Client.send(command);
      const url = `${PUBLIC_URL}/${fileName}`;
      
      // 🚀 에디터에 이미지 삽입
      editor.chain().focus().setImage({ src: url }).run();
    } catch (error) {
      console.error("게시글 이미지 R2 업로드 실패:", error);
      alert("이미지 전송에 실패했소. R2 설정을 확인해 보시오.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = ""; // 선택 초기화
    }
  };

  const MenuBar = () => {
    if (!editor) return null;
    return (
      <div className="flex flex-wrap gap-1 pb-2 border-b border-slate-100 mb-2 items-center">
        <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={`px-2 py-1 rounded hover:bg-slate-100 ${editor.isActive('bold') ? 'bg-slate-200 font-bold' : ''}`}>B</button>
        <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={`px-2 py-1 rounded hover:bg-slate-100 ${editor.isActive('italic') ? 'bg-slate-200 italic' : ''}`}>I</button>
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={`px-2 py-1 rounded hover:bg-slate-100 ${editor.isActive('heading', { level: 2 }) ? 'bg-slate-200 font-bold' : ''}`}>H2</button>
        <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={`px-2 py-1 rounded hover:bg-slate-100 ${editor.isActive('bulletList') ? 'bg-slate-200' : ''}`}>• List</button>
        <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()} className={`px-2 py-1 rounded hover:bg-slate-100 ${editor.isActive('blockquote') ? 'bg-slate-200' : ''}`}>Quote</button>
        
        {/* 🚀 파일 선택기 트리거 버튼 */}
        <button 
          type="button" 
          onClick={() => fileInputRef.current?.click()} 
          disabled={isUploading}
          className={`px-2 py-1 rounded hover:bg-slate-100 text-sm flex items-center gap-1 ${isUploading ? 'opacity-50' : ''}`}
        >
          {isUploading ? "⌛ 전송중" : "🖼️ Image"}
        </button>
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept="image/*" 
          onChange={handleImageUpload} 
        />

        <button type="button" onClick={() => editor.chain().focus().undo().run()} className="px-2 py-1 rounded hover:bg-slate-100 text-sm opacity-50 ml-auto">Undo</button>
        <button type="button" onClick={() => editor.chain().focus().redo().run()} className="px-2 py-1 rounded hover:bg-slate-100 text-sm opacity-50">Redo</button>
      </div>
    );
  };

  return (
    <div className="bg-white border-2 border-slate-200 rounded-[2rem] p-4 mb-6 shadow-sm transition-all focus-within:border-blue-500 focus-within:shadow-md max-w-2xl mx-auto w-full">
      {!isExpanded ? (
        <div className="flex items-center gap-4 cursor-pointer" onClick={() => setIsExpanded(true)}>
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200 text-lg overflow-hidden">
            <img 
              src={userData.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${userData.nickname}`} 
              alt="avatar" 
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 bg-slate-50 border border-slate-100 rounded-full px-5 py-2.5 text-slate-400 font-medium hover:bg-slate-100 transition-colors text-sm">
            내 할말 입력하기
          </div>
          <button className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-100 hover:scale-110 transition-transform">+</button>
        </div>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex justify-between items-center border-b border-slate-50 pb-3">
            <span className="text-sm font-[1000] text-blue-600 italic ml-2">내 할말</span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => handleSubmit()} disabled={isSubmitting || isUploading} className={`px-3 py-1 rounded-lg font-black text-xs transition-all active:scale-95 shadow-sm ${isSubmitting || isUploading ? 'bg-slate-100 text-slate-400' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-100'}`}>{isSubmitting ? '중...' : '등록'}</button>
              <button type="button" onClick={() => setIsExpanded(false)} className="px-3 py-1 rounded-lg font-black text-xs text-slate-500 bg-slate-100 hover:bg-slate-200 transition-all">닫기</button>
            </div>
          </div>
          <input type="text" placeholder="제목" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus className="w-full text-xl font-black text-slate-900 outline-none placeholder:text-slate-300 px-2" />
          <div className="px-2 min-h-[450px]">
            <MenuBar />
            <EditorContent editor={editor} />
            <p className="mt-4 text-[10px] font-bold text-slate-300 leading-relaxed border-t border-slate-50 pt-3">⚠️ 이미지는 Cloudflare R2 저장소에 안전하게 보관되며, 본문 삽입 시 2MB 이하의 사진을 권장하오.</p>
          </div>
        </form>
      )}
    </div>
  );
};

export default CreatePostBox;