// src/components/EditorToolbar.tsx — Tiptap 에디터 도구 모음 (서식/제목/목록/이미지 버튼)
import { useRef, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { Editor } from '@tiptap/react';
import LinkPreviewCard from './LinkPreviewCard';
import type { OgData } from './LinkPreviewCard';

const LINK_PREVIEW_WORKER = 'https://halmal-link-preview.mirr0505.workers.dev';

const TEXT_COLORS = ['#000000','#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#8b5cf6','#ec4899','#64748b','#ffffff'];
const HIGHLIGHT_COLORS = ['#fef08a','#bbf7d0','#bfdbfe','#f9a8d4','#fed7aa','#e9d5ff'];

interface Props {
  editor: Editor;
  onImageUpload: (file: File) => Promise<string | null>;
}

const EditorToolbar = ({ editor, onImageUpload }: Props) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showColors, setShowColors] = useState(false);
  const [showHL, setShowHL] = useState(false);
  const colorRef = useRef<HTMLDivElement>(null);
  const hlRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (colorRef.current && !colorRef.current.contains(e.target as Node)) setShowColors(false);
      if (hlRef.current && !hlRef.current.contains(e.target as Node)) setShowHL(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const Btn = ({ onClick, active, title, children }: {
    onClick: () => void; active?: boolean; title?: string; children: ReactNode;
  }) => (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`w-7 h-7 flex items-center justify-center rounded transition-colors text-[12px] ${
        active ? 'bg-slate-900 text-white' : 'text-slate-400 hover:text-slate-800 hover:bg-slate-100'
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
    <>
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

      {/* 제목 크기 */}
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

      {/* 블록 요소 */}
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

      {/* 이미지 업로드 */}
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

      <Sep />

      {/* 글자색 */}
      <div ref={colorRef} className="relative">
        <button type="button" title="글자색" onClick={() => { setShowColors(v => !v); setShowHL(false); }}
          className="w-7 h-7 flex flex-col items-center justify-center rounded transition-colors text-slate-400 hover:text-slate-800 hover:bg-slate-100 gap-0.5">
          <span className="text-[12px] font-black leading-none">A</span>
          <span className="w-3.5 h-0.5 rounded-full" style={{ backgroundColor: editor.getAttributes('textStyle').color || '#000000' }} />
        </button>
        {showColors && (
          <div className="absolute top-full left-0 mt-1 p-1.5 bg-white border border-slate-200 rounded-lg shadow-lg z-[100] grid grid-cols-5 gap-1">
            {TEXT_COLORS.map(c => (
              <button key={c} type="button" title={c} onClick={() => { editor.chain().focus().setColor(c).run(); setShowColors(false); }}
                className="w-5 h-5 rounded border border-slate-200 hover:scale-110 transition-transform" style={{ backgroundColor: c }} />
            ))}
            <button type="button" onClick={() => { editor.chain().focus().unsetColor().run(); setShowColors(false); }}
              className="col-span-5 text-[9px] font-bold text-slate-400 hover:bg-slate-50 rounded py-0.5 mt-0.5 border border-slate-100">색 제거</button>
          </div>
        )}
      </div>

      {/* 배경 하이라이트 */}
      <div ref={hlRef} className="relative">
        <button type="button" title="배경색" onClick={() => { setShowHL(v => !v); setShowColors(false); }}
          className={`w-7 h-7 flex items-center justify-center rounded transition-colors text-[12px] ${editor.isActive('highlight') ? 'bg-slate-900 text-white' : 'text-slate-400 hover:text-slate-800 hover:bg-slate-100'}`}>
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.5 12 15.6 9.9 17.5 8l1.9 1.9L17.5 12zM9.5 20.5l-4-4 1.4-1.4 4 4-1.4 1.4zm8-11-4.5-4.5-6.5 6.5 4.5 4.5L17.5 9.5zm-3-3-1.5 1.5 4.5 4.5 1.5-1.5L14.5 6.5z"/></svg>
        </button>
        {showHL && (
          <div className="absolute top-full left-0 mt-1 p-1.5 bg-white border border-slate-200 rounded-lg shadow-lg z-[100] grid grid-cols-3 gap-1">
            {HIGHLIGHT_COLORS.map(c => (
              <button key={c} type="button" title={c} onClick={() => { editor.chain().focus().setHighlight({ color: c }).run(); setShowHL(false); }}
                className="w-5 h-5 rounded border border-slate-200 hover:scale-110 transition-transform" style={{ backgroundColor: c }} />
            ))}
            <button type="button" onClick={() => { editor.chain().focus().unsetHighlight().run(); setShowHL(false); }}
              className="col-span-3 text-[9px] font-bold text-slate-400 hover:bg-slate-50 rounded py-0.5 mt-0.5 border border-slate-100">제거</button>
          </div>
        )}
      </div>

      <Sep />

      {/* 텍스트 정렬 */}
      <Btn onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="왼쪽 정렬">
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M15 15H3v2h12v-2zm0-8H3v2h12V7zM3 13h18v-2H3v2zm0 8h18v-2H3v2zM3 3v2h18V3H3z"/></svg>
      </Btn>
      <Btn onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="가운데 정렬">
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M7 15v2h10v-2H7zm-4 6h18v-2H3v2zm0-8h18v-2H3v2zm4-6v2h10V7H7zM3 3v2h18V3H3z"/></svg>
      </Btn>
      <Btn onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="오른쪽 정렬">
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M3 21h18v-2H3v2zm6-4h12v-2H9v2zm-6-4h18v-2H3v2zm6-4h12V7H9v2zM3 3v2h18V3H3z"/></svg>
      </Btn>

      <Sep />

      {/* 링크 */}
      <Btn
        onClick={() => {
          const prev = editor.getAttributes('link').href;
          const url = window.prompt('링크 URL을 입력하세요', prev || 'https://');
          if (url === null) return;
          if (!url.trim()) { editor.chain().focus().unsetLink().run(); setPreview(null); return; }
          const { from, to } = editor.state.selection;
          if (from !== to) {
            // 텍스트 선택됨 → 선택 텍스트에 링크 적용
            editor.chain().focus().setLink({ href: url.trim(), target: '_blank' }).run();
          } else {
            // 선택 없음 → URL 자체를 링크 텍스트로 삽입
            editor.chain().focus()
              .insertContent(`<a href="${url.trim()}" target="_blank">${url.trim()}</a>`)
              .run();
          }
          fetchPreview(url.trim());
        }}
        active={editor.isActive('link')}
        title="링크 삽입"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"/>
        </svg>
      </Btn>
    </div>
    <LinkPreviewCard data={preview} loading={previewLoading} onClose={() => setPreview(null)} />
    </>
  );
};

export default EditorToolbar;
