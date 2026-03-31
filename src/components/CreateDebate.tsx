// src/components/CreateDebate.tsx — 솔로몬의 재판 새글 작성 폼
import { useState } from 'react';
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3Client, BUCKET_NAME, PUBLIC_URL } from '../s3Client';
import type { Post, UserData } from '../types';
import TiptapEditor from './TiptapEditor';

const POSITIONS: { value: 'pro' | 'con' | 'neutral'; label: string; cls: string }[] = [
  { value: 'pro',     label: '👍 찬성', cls: 'bg-blue-50 text-blue-700 border-blue-300' },
  { value: 'con',     label: '👎 반대', cls: 'bg-rose-50 text-rose-700 border-rose-300' },
  { value: 'neutral', label: '🤝 중립', cls: 'bg-slate-100 text-slate-600 border-slate-300' },
];

interface Props {
  userData: UserData;
  editingPost: Post | null;
  onSubmit: (postData: Partial<Post>, postId?: string) => Promise<void>;
  onClose: () => void;
  linkedTitle?: string;             // 연계글 모드: '[연계글]' prefix 고정 표시 트리거
  linkedSide?: 'left' | 'right';   // 연계글 모드: 입장 자동 설정 (left→pro, right→con)
  originalPost?: Post;              // 연계글 모드: 원본 솔로몬 글 (ID·제목 저장용)
}

const CreateDebate = ({ userData, editingPost, onSubmit, onClose, linkedTitle, linkedSide, originalPost }: Props) => {
  // 연계글 모드일 때: linkedSide 기반으로 입장 초기값 결정
  const initialPosition = linkedSide === 'left' ? 'pro' : linkedSide === 'right' ? 'con' : (editingPost?.debatePosition || 'neutral');
  const [postData, setPostData] = useState<Partial<Post>>({
    // 연계글 모드: title은 사용자 입력 suffix만 저장, submit 시 '[연계글] ' 자동 prepend
    title: linkedTitle ? '' : (editingPost?.title || ''),
    content: editingPost?.content || '',
    category: '솔로몬의 재판',
    tags: editingPost?.tags || ['', '', '', '', ''],
    debatePosition: initialPosition,
    isOneCut: false,
    // 🚀 연계글 모드: 원본글 ID·제목 저장 → 상세글에서 원본글 바로가기 링크에 사용
    ...(originalPost ? { linkedPostId: originalPost.id, linkedPostTitle: originalPost.title } : {}),
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const uploadFile = async (file: File): Promise<string | null> => {
    if (!userData) return null;
    setIsUploading(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `post_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
    const filePath = `uploads/${userData.uid}/${fileName}`;
    try {
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      await s3Client.send(new PutObjectCommand({ Bucket: BUCKET_NAME, Key: filePath, Body: uint8Array, ContentType: file.type }));
      return `${PUBLIC_URL}/${filePath}`;
    } catch { alert("이미지 업로드에 실패했습니다."); return null; }
    finally { setIsUploading(false); }
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
      const filteredTags = (postData.tags || []).filter(t => t.trim() !== '');
      // 연계글 모드: '[연계글] ' + 사용자 입력 제목으로 최종 title 조합
      const finalTitle = linkedTitle ? `[연계글] ${postData.title || ''}`.trim() : postData.title;
      await onSubmit({ ...postData, title: finalTitle, tags: filteredTags }, editingPost?.id);
    } finally { setIsSubmitting(false); }
  };

  return (
    <div className="w-full max-w-[860px] mx-auto py-8 animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col shadow-sm" style={{ maxHeight: 'calc(100vh - 80px)' }}>
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 h-12 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="text-[12px] font-bold text-slate-400 tracking-wide uppercase">{editingPost ? '글 수정' : linkedTitle ? '연계글 작성' : '새 글 기록'}</span>
            <span className="text-[11px] font-bold text-blue-500">👂 솔로몬의 재판</span>
            {isUploading && <span className="flex items-center gap-1.5 text-[11px] font-bold text-blue-500"><span className="w-2.5 h-2.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin inline-block" />이미지 업로드 중</span>}
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={onClose} className="px-3.5 h-7 rounded-md text-[12px] font-bold text-slate-500 hover:bg-slate-100 transition-colors">취소</button>
            <button onClick={handleSubmit} disabled={isSubmitting || isUploading} className={`px-4 h-7 rounded-md text-[12px] font-bold transition-all ${isSubmitting || isUploading ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-900 text-white hover:bg-blue-600'}`}>{isSubmitting ? '업로드 중...' : '새글 올리기'}</button>
          </div>
        </div>

        {/* 제목 — 연계글 모드: '[연계글]' prefix 고정 + 사용자 입력 suffix / 일반: 전체 입력 */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100 shrink-0">
          {linkedTitle && (
            <span className="text-[18px] font-bold text-slate-400 shrink-0">[연계글]</span>
          )}
          <input
            type="text"
            placeholder={linkedTitle ? "제목을 입력하세요" : "제목을 입력하세요"}
            value={postData.title || ''}
            onChange={(e) => setPostData({ ...postData, title: e.target.value })}
            className="w-full bg-transparent text-[18px] font-bold text-slate-900 outline-none placeholder:text-slate-200 placeholder:font-normal"
          />
        </div>

        {/* 입장 선택 */}
        <div className="flex items-center gap-3 px-5 py-2.5 border-b border-slate-100 shrink-0">
          <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest shrink-0">입장 선택</span>
          {POSITIONS.map(({ value, label, cls }) => (
            <button key={value} type="button" onClick={() => setPostData(p => ({ ...p, debatePosition: value }))}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all border ${postData.debatePosition === value ? cls : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* 🚀 연계글 모드: 원본글 제목 표시 — 작성 완료 후 상세글에서 바로가기 제공 */}
        {originalPost && (
          <div className="flex items-center gap-3 px-5 py-2.5 border-b border-slate-100 shrink-0">
            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest shrink-0">원본글</span>
            <span className="text-[12px] font-bold text-blue-500 truncate">🔗 {originalPost.title}</span>
          </div>
        )}

        {/* 에디터 */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <TiptapEditor content={postData.content || ''} onChange={(html) => setPostData(prev => ({ ...prev, content: html }))} onImageUpload={uploadFile} />
        </div>

        {/* 태그 */}
        <div className="flex items-center gap-3 px-5 py-2.5 border-t border-slate-100 bg-slate-50/60 shrink-0 flex-wrap">
          <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Tags</span>
          {[0, 1, 2, 3, 4].map((idx) => (
            <div key={idx} className="flex items-center gap-0.5">
              <span className="text-slate-300 text-[12px] font-bold">#</span>
              <input type="text" placeholder="태그" value={postData.tags?.[idx] || ''} onChange={(e) => handleTagChange(idx, e.target.value)} className="w-16 bg-transparent text-[12px] font-bold text-slate-500 outline-none border-b border-transparent focus:border-slate-300 placeholder:text-slate-200 transition-colors pb-px" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CreateDebate;
