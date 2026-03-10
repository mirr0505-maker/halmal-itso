// src/components/TiptapEditor.tsx
import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import { useEffect } from 'react';

interface Props {
  content: string;
  onChange: (html: string) => void;
  onImageUpload: (file: File) => Promise<string | null>;
}

const TiptapEditor = ({ content, onChange, onImageUpload }: Props) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Image.configure({
        HTMLAttributes: {
          class: 'rounded-2xl shadow-lg border border-slate-100 max-w-full my-8 block mx-auto',
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-600 underline font-bold cursor-pointer',
        },
      }),
      Placeholder.configure({
        placeholder: '나누고 싶은 할말을 자유롭게 적어주시오. 이미지를 붙여넣거나 드래그할 수도 있소...',
      }),
    ],
    content: content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-slate max-w-none focus:outline-none min-h-[400px] px-10 py-10 text-[16px] leading-[1.8] font-medium text-slate-700',
      },
      handlePaste: (view, event) => {
        const items = Array.from(event.clipboardData?.items || []);
        for (const item of items) {
          if (item.type.indexOf('image') === 0) {
            const file = item.getAsFile();
            if (file) {
              onImageUpload(file).then(url => {
                if (url) {
                  view.dispatch(view.state.tr.replaceSelectionWith(view.state.schema.nodes.image.create({ src: url })));
                }
              });
              return true;
            }
          }
        }
        return false;
      },
      handleDrop: (view, event) => {
        const files = Array.from(event.dataTransfer?.files || []);
        if (files.length > 0 && files[0].type.indexOf('image') === 0) {
          event.preventDefault();
          onImageUpload(files[0]).then(url => {
            if (url) {
              const { schema } = view.state;
              const coordinates = view.posAtCoords({ left: event.clientX, top: event.clientY });
              if (coordinates) {
                const node = schema.nodes.image.create({ src: url });
                const transaction = view.state.tr.insert(coordinates.pos, node);
                view.dispatch(transaction);
              }
            }
          });
          return true;
        }
        return false;
      },
    },
  });

  // 외부 content 변경 시 에디터 동기화 (수정 모드 지원)
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  if (!editor) return null;

  const ToolbarButton = ({ onClick, isActive, icon, label }: any) => (
    <button
      type="button"
      onClick={onClick}
      className={`p-2 rounded-lg transition-all flex items-center gap-1.5 ${
        isActive ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-white hover:shadow-sm'
      }`}
    >
      {icon}
      {label && <span className="text-[11px] font-black uppercase tracking-tight">{label}</span>}
    </button>
  );

  return (
    <div className="flex flex-col w-full">
      {/* 🚀 Main Sticky Toolbar */}
      <div className="sticky top-0 px-5 py-3 border-b border-slate-50 flex flex-wrap items-center gap-1.5 bg-slate-50/90 backdrop-blur-md z-50 rounded-t-[2.5rem]">
        <ToolbarButton 
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} 
          isActive={editor.isActive('heading', { level: 1 })} 
          label="H1" 
        />
        <ToolbarButton 
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} 
          isActive={editor.isActive('heading', { level: 2 })} 
          label="H2" 
        />
        <ToolbarButton 
          onClick={() => editor.chain().focus().setParagraph().run()} 
          isActive={editor.isActive('paragraph')} 
          label="P" 
        />
        <div className="w-px h-4 bg-slate-200 mx-1" />
        <ToolbarButton 
          onClick={() => editor.chain().focus().toggleBold().run()} 
          isActive={editor.isActive('bold')} 
          icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6zM6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z"/></svg>}
        />
        <ToolbarButton 
          onClick={() => editor.chain().focus().toggleItalic().run()} 
          isActive={editor.isActive('italic')} 
          icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M10 4h10M4 20h10M15 4L9 20"/></svg>}
        />
        <ToolbarButton 
          onClick={() => editor.chain().focus().toggleUnderline().run()} 
          isActive={editor.isActive('underline')} 
          icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M6 4v10.5a4.5 4.5 0 109 0V4M4 4h4m7 0h4M4 18h11"/></svg>}
        />
        <div className="w-px h-4 bg-slate-200 mx-1" />
        <ToolbarButton 
          onClick={() => editor.chain().focus().toggleBulletList().run()} 
          isActive={editor.isActive('bulletList')} 
          icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12"/></svg>}
        />
        <ToolbarButton 
          onClick={() => editor.chain().focus().toggleOrderedList().run()} 
          isActive={editor.isActive('orderedList')} 
          icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5"/></svg>}
        />
        <div className="w-px h-4 bg-slate-200 mx-1" />
        <button
          type="button"
          onClick={() => {
            const url = window.prompt('이미지 URL을 입력하시오:');
            if (url) editor.chain().focus().setImage({ src: url }).run();
          }}
          className="p-2.5 text-slate-500 hover:text-blue-600 flex items-center gap-2 transition-all"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>
          <span className="text-[11px] font-[1000] uppercase tracking-tight">사진 추가</span>
        </button>
      </div>

      {/* 🚀 Bubble Menu (Text Selection) */}
      <BubbleMenu editor={editor} tippyOptions={{ duration: 100 }}>
        <div className="flex items-center gap-1 bg-slate-900 text-white p-1 rounded-xl shadow-2xl border border-white/10 backdrop-blur-md">
          <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={`p-2 rounded-lg hover:bg-white/20 ${editor.isActive('bold') ? 'text-blue-400' : ''}`}><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6zM6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z"/></svg></button>
          <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={`p-2 rounded-lg hover:bg-white/20 ${editor.isActive('italic') ? 'text-blue-400' : ''}`}><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M10 4h10M4 20h10M15 4L9 20"/></svg></button>
          <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()} className={`p-2 rounded-lg hover:bg-white/20 ${editor.isActive('underline') ? 'text-blue-400' : ''}`}><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M6 4v10.5a4.5 4.5 0 109 0V4M4 4h4m7 0h4M4 18h11"/></svg></button>
          <button type="button" onClick={() => {
            const url = window.prompt('URL을 입력하시오:');
            if (url) editor.chain().focus().setLink({ href: url }).run();
          }} className={`p-2 rounded-lg hover:bg-white/20 ${editor.isActive('link') ? 'text-blue-400' : ''}`}><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"/></svg></button>
        </div>
      </BubbleMenu>

      <div className="flex-1 bg-white">
        <EditorContent editor={editor} />
      </div>

      <style>{`
        .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #cbd5e1;
          pointer-events: none;
          height: 0;
          font-weight: 700;
          font-style: italic;
        }
        .ProseMirror { min-height: 450px; }
        .ProseMirror:focus { outline: none; }
      `}</style>
    </div>
  );
};

export default TiptapEditor;
