// src/components/TiptapEditor.tsx — 리치 텍스트 에디터 (툴바는 EditorToolbar.tsx로 분리)
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import Color from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import { useEffect, useState } from 'react';
import EditorToolbar from './EditorToolbar';
import LinkPreviewCard from './LinkPreviewCard';
import type { OgData } from './LinkPreviewCard';

const LINK_PREVIEW_WORKER = 'https://halmal-link-preview.mirr0505.workers.dev';

const URL_PATTERN = /^https?:\/\/[^\s]{4,}$/;

interface Props {
  content: string;
  onChange: (html: string) => void;
  onImageUpload: (file: File) => Promise<string | null>;
}

const TiptapEditor = ({ content, onChange, onImageUpload }: Props) => {
  const [preview, setPreview] = useState<OgData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const fetchPreview = async (url: string) => {
    setPreviewLoading(true);
    setPreview(null);
    try {
      const res = await fetch(`${LINK_PREVIEW_WORKER}?url=${encodeURIComponent(url)}`);
      const data = await res.json() as OgData & { error?: string };
      if (!data.error) setPreview(data);
    } catch {
      // 미리보기 실패는 무시
    } finally {
      setPreviewLoading(false);
    }
  };

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
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
        // URL 텍스트 붙여넣기 감지 → 미리보기 자동 발동
        const text = event.clipboardData?.getData('text/plain')?.trim() || '';
        if (URL_PATTERN.test(text)) {
          fetchPreview(text);
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

  return (
    <div className="flex flex-col w-full bg-white">
      <EditorToolbar editor={editor} onImageUpload={onImageUpload} onLinkInserted={fetchPreview} />
      <LinkPreviewCard data={preview} loading={previewLoading} onClose={() => setPreview(null)} />

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
