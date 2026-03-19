// src/components/TiptapEditor.tsx
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import { useEffect, useRef } from 'react';

interface Props {
  content: string;
  onChange: (html: string) => void;
  onImageUpload: (file: File) => Promise<string | null>;
}

const TiptapEditor = ({ content, onChange, onImageUpload }: Props) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Image.configure({
        HTMLAttributes: {
          class: 'rounded-lg shadow-sm border border-slate-100 max-w-full my-6 block mx-auto',
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-blue-600 underline cursor-pointer' },
      }),
      Placeholder.configure({
        placeholder: '나누고 싶은 글을 자유롭게 작성하세요. 이미지를 붙여넣거나 드래그할 수 있어요.',
      }),
    ],
    content,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: 'prose prose-slate max-w-none focus:outline-none min-h-[380px] px-8 py-7 text-[15px] leading-[1.85] text-slate-700',
      },
      handlePaste: (view, event) => {
        const items = Array.from(event.clipboardData?.items || []);
        for (const item of items) {
          if (item.type.startsWith('image')) {
            const file = item.getAsFile();
            if (file) {
              onImageUpload(file).then(url => {
                if (url) view.dispatch(
                  view.state.tr.replaceSelectionWith(view.state.schema.nodes.image.create({ src: url }))
                );
              });
              return true;
            }
          }
        }
        return false;
      },
      handleDrop: (view, event) => {
        const files = Array.from(event.dataTransfer?.files || []);
        if (files.length > 0 && files[0].type.startsWith('image')) {
          event.preventDefault();
          onImageUpload(files[0]).then(url => {
            if (url) {
              const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
              if (coords) view.dispatch(
                view.state.tr.insert(coords.pos, view.state.schema.nodes.image.create({ src: url }))
              );
            }
          });
          return true;
        }
        return false;
      },
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) editor.commands.setContent(content);
  }, [content, editor]);

  if (!editor) return null;

  const Btn = ({ onClick, active, title, children }: {
    onClick: () => void; active?: boolean; title?: string; children: React.ReactNode;
  }) => (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`w-7 h-7 flex items-center justify-center rounded transition-colors text-[12px] ${
        active
          ? 'bg-slate-900 text-white'
          : 'text-slate-400 hover:text-slate-800 hover:bg-slate-100'
      }`}
    >
      {children}
    </button>
  );

  const Sep = () => <div className="w-px h-4 bg-slate-200 mx-0.5" />;

  const handleImageFile = async (file: File) => {
    const url = await onImageUpload(file);
    if (url) editor.chain().focus().setImage({ src: url }).run();
  };

  return (
    <div className="flex flex-col w-full bg-white">
      {/* Toolbar */}
      <div className="sticky top-0 z-50 flex flex-wrap items-center gap-0.5 px-4 py-2 border-b border-slate-100 bg-white">

        {/* 서식 */}
        <Btn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="굵게">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M15.6 10.79c.97-.67 1.65-1.77 1.65-2.79 0-2.26-1.75-4-4-4H7v14h7.04c2.09 0 3.71-1.7 3.71-3.79 0-1.52-.86-2.82-2.15-3.42zM10 6.5h3c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-3v-3zm3.5 9H10v-3h3.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5z"/>
          </svg>
        </Btn>
        <Btn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="기울임">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M10 4v3h2.21l-3.42 8H6v3h8v-3h-2.21l3.42-8H18V4z"/>
          </svg>
        </Btn>
        <Btn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="밑줄">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 17c3.31 0 6-2.69 6-6V3h-2.5v8c0 1.93-1.57 3.5-3.5 3.5S8.5 12.93 8.5 11V3H6v8c0 3.31 2.69 6 6 6zm-7 2v2h14v-2H5z"/>
          </svg>
        </Btn>
        <Btn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="취소선">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M10 19h4v-3h-4v3zM5 4v3h5v3h4V7h5V4H5zM3 14h18v-2H3v2z"/>
          </svg>
        </Btn>

        <Sep />

        {/* 제목 */}
        <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="제목 1">
          <span className="font-black text-[10px]">H1</span>
        </Btn>
        <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="제목 2">
          <span className="font-black text-[10px]">H2</span>
        </Btn>
        <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="제목 3">
          <span className="font-black text-[10px]">H3</span>
        </Btn>

        <Sep />

        {/* 목록 */}
        <Btn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="글머리 기호">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M4 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm0-6c-.83 0-1.5.67-1.5 1.5S3.17 7.5 4 7.5 5.5 6.83 5.5 6 4.83 4.5 4 4.5zm0 12c-.83 0-1.5.68-1.5 1.5s.68 1.5 1.5 1.5 1.5-.68 1.5-1.5-.67-1.5-1.5-1.5zM7 19h14v-2H7v2zm0-6h14v-2H7v2zm0-8v2h14V5H7z"/>
          </svg>
        </Btn>
        <Btn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="번호 목록">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M2 17h2v.5H3v1h1v.5H2v1h3v-4H2v1zm1-9h1V4H2v1h1v3zm-1 3h1.8L2 13.1v.9h3v-1H3.2L5 10.9V10H2v1zm5-6v2h14V5H7zm0 14h14v-2H7v2zm0-6h14v-2H7v2z"/>
          </svg>
        </Btn>

        <Sep />

        {/* 블록 */}
        <Btn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="인용">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z"/>
          </svg>
        </Btn>
        <Btn onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} title="코드 블록">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/>
          </svg>
        </Btn>
        <Btn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="구분선">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M19 13H5v-2h14v2z"/>
          </svg>
        </Btn>

        <Sep />

        {/* 이미지 */}
        <Btn onClick={() => fileInputRef.current?.click()} title="이미지 업로드">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"/>
          </svg>
        </Btn>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleImageFile(file);
            e.target.value = '';
          }}
        />
      </div>

      {/* 에디터 본문 */}
      <div className="flex-1">
        <EditorContent editor={editor} />
      </div>

      <style>{`
        .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #cbd5e1;
          pointer-events: none;
          height: 0;
          font-style: italic;
        }
        .ProseMirror { outline: none !important; }
        .prose h1 { font-size: 1.5rem; font-weight: 800; letter-spacing: -0.03em; color: #0f172a; margin-top: 1.75rem; margin-bottom: 0.5rem; }
        .prose h2 { font-size: 1.2rem; font-weight: 700; letter-spacing: -0.02em; color: #1e293b; margin-top: 1.5rem; margin-bottom: 0.4rem; }
        .prose h3 { font-size: 1.05rem; font-weight: 700; color: #334155; margin-top: 1.25rem; margin-bottom: 0.35rem; }
        .prose p { line-height: 1.85; color: #334155; margin-bottom: 0.75rem; }
        .prose blockquote { border-left: 3px solid #e2e8f0; padding-left: 1rem; color: #64748b; font-style: italic; margin: 1.25rem 0; background: #f8fafc; padding: 0.75rem 1rem; border-radius: 0 6px 6px 0; }
        .prose code { background: #f1f5f9; color: #e11d48; padding: 0.15em 0.4em; border-radius: 4px; font-size: 0.875em; font-family: 'Fira Mono', monospace; }
        .prose pre { background: #0f172a; color: #e2e8f0; padding: 1.25rem 1.5rem; border-radius: 8px; overflow-x: auto; margin: 1.25rem 0; }
        .prose pre code { background: none; color: inherit; padding: 0; font-size: 0.875em; }
        .prose hr { border: none; border-top: 1px solid #e2e8f0; margin: 1.75rem 0; }
        .prose ul li, .prose ol li { color: #334155; line-height: 1.75; }
      `}</style>
    </div>
  );
};

export default TiptapEditor;
