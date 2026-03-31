// src/components/CreateNakedKing.tsx — 판도라의 상자 새글 작성 폼
import { useState } from 'react';
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3Client, BUCKET_NAME, PUBLIC_URL } from '../s3Client';
import type { Post, UserData } from '../types';
import TiptapEditor from './TiptapEditor';

interface Props {
  userData: UserData;
  editingPost: Post | null;
  onSubmit: (postData: Partial<Post>, postId?: string) => Promise<void>;
  onClose: () => void;
}

const CreateNakedKing = ({ userData, editingPost, onSubmit, onClose }: Props) => {
  const [postData, setPostData] = useState<Partial<Post>>({
    title: editingPost?.title || '',
    content: editingPost?.content || '',
    category: '판도라의 상자',
    tags: editingPost?.tags || ['', '', '', '', ''],
    claimSource: editingPost?.claimSource || '',
    claimLinkUrl: editingPost?.claimLinkUrl || '',
    verdict: editingPost?.verdict || undefined,
    factCheckResult: editingPost?.factCheckResult || '',
    factCheckSources: editingPost?.factCheckSources?.length ? editingPost.factCheckSources : [''],
    isOneCut: false,
  });

  const addFactCheckSource = () =>
    setPostData(p => ({ ...p, factCheckSources: [...(p.factCheckSources || ['']), ''] }));
  const removeFactCheckSource = (i: number) =>
    setPostData(p => ({ ...p, factCheckSources: (p.factCheckSources || []).filter((_, idx) => idx !== i) }));
  const updateFactCheckSource = (i: number, val: string) =>
    setPostData(p => { const arr = [...(p.factCheckSources || [])]; arr[i] = val; return { ...p, factCheckSources: arr }; });
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
      await onSubmit({
        ...postData,
        tags: filteredTags,
        factChecked: postData.verdict === 'fact',
        factCheckSources: (postData.factCheckSources || []).filter(s => s.trim() !== ''),
      }, editingPost?.id);
    } finally { setIsSubmitting(false); }
  };

  const verdictOptions: { value: 'fact' | 'false' | 'uncertain'; label: string; tag: string; color: string }[] = [
    { value: 'fact',      label: '✅ 사실 확인', tag: '사실 확인', color: 'bg-emerald-50 text-emerald-700 border-emerald-300' },
    { value: 'false',     label: '❌ 허위 판명', tag: '허위 판명', color: 'bg-rose-50 text-rose-600 border-rose-300' },
    { value: 'uncertain', label: '🔍 미정.보류', tag: '미정.보류', color: 'bg-slate-50 text-slate-500 border-slate-300' },
  ];

  return (
    <div className="w-full max-w-[860px] mx-auto py-8 animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col shadow-sm" style={{ maxHeight: 'calc(100vh - 80px)' }}>

        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 h-12 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="text-[12px] font-bold text-slate-400 tracking-wide uppercase">{editingPost ? '글 수정' : '새 글 기록'}</span>
            <span className="text-[11px] font-bold text-amber-500">👑 판도라의 상자</span>
            {isUploading && <span className="flex items-center gap-1.5 text-[11px] font-bold text-blue-500"><span className="w-2.5 h-2.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin inline-block" />이미지 업로드 중</span>}
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={onClose} className="px-3.5 h-7 rounded-md text-[12px] font-bold text-slate-500 hover:bg-slate-100 transition-colors">취소</button>
            <button onClick={handleSubmit} disabled={isSubmitting || isUploading} className={`px-4 h-7 rounded-md text-[12px] font-bold transition-all ${isSubmitting || isUploading ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-900 text-white hover:bg-blue-600'}`}>{isSubmitting ? '업로드 중...' : '새글 올리기'}</button>
          </div>
        </div>

        {/* 제목 */}
        <div className="flex items-center px-5 py-3 border-b border-slate-100 shrink-0">
          <input type="text" placeholder="제목을 입력하세요" value={postData.title || ''} onChange={(e) => setPostData({ ...postData, title: e.target.value })} className="w-full bg-transparent text-[18px] font-bold text-slate-900 outline-none placeholder:text-slate-300 placeholder:font-normal" />
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">

          {/* ── 섹션 1: 검증 대상 ── */}
          <div className="px-5 pt-4 pb-2">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-1.5 h-4 bg-blue-400 rounded-full" />
              <span className="text-[12px] font-black text-blue-600 uppercase tracking-widest">검증 대상</span>
            </div>
          </div>
          <TiptapEditor content={postData.content || ''} onChange={(html) => setPostData(prev => ({ ...prev, content: html }))} onImageUpload={uploadFile} placeholder="검증하고 싶은 대상 내용을 입력하세요" />
          {/* 출처 정보 */}
          <div className="flex flex-col border-t border-slate-100 bg-slate-50/40 shrink-0">
            <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-100">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0">출처</span>
              <input
                type="text"
                placeholder="언론사 · 인물 · 단체명 등 주장의 출처를 입력하세요"
                value={postData.claimSource || ''}
                onChange={e => setPostData(p => ({ ...p, claimSource: e.target.value }))}
                className="flex-1 bg-transparent text-[13px] font-bold text-slate-700 outline-none placeholder:text-slate-400 placeholder:font-normal"
              />
            </div>
            <div className="flex items-center gap-3 px-5 py-3">
              <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>
              <input
                type="text"
                placeholder="링크를 연결하세요 (https://...)"
                value={postData.claimLinkUrl || ''}
                onChange={e => setPostData(p => ({ ...p, claimLinkUrl: e.target.value }))}
                className="flex-1 bg-transparent text-[13px] font-bold text-blue-500 outline-none placeholder:text-slate-400 placeholder:font-normal"
              />
            </div>
          </div>

          {/* ── 섹션 2: 팩트체크 결과 (선택) ── */}
          <div className="px-5 pt-5 pb-1">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-1.5 h-4 bg-amber-400 rounded-full" />
              <span className="text-[12px] font-black text-amber-600 uppercase tracking-widest">팩트체크 결과</span>
              <span className="text-[10px] font-bold text-slate-400 ml-1">선택 사항</span>
            </div>
          </div>
          {/* 판정 */}
          <div className="flex items-center gap-2 px-5 pb-3">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0">판정</span>
            <div className="flex gap-2">
              {verdictOptions.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPostData(p => {
                    const isDeselecting = p.verdict === opt.value;
                    const newTags = [...(p.tags || ['', '', '', '', ''])];
                    // 🚀 판정 선택 시 tags[4]에 자동 해시태그 등록, 해제 시 삭제
                    newTags[4] = isDeselecting ? '' : opt.tag;
                    return { ...p, verdict: isDeselecting ? undefined : opt.value, tags: newTags };
                  })}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${postData.verdict === opt.value ? opt.color : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          {/* 결과 내용 */}
          <div className="px-5 pb-3">
            <textarea
              rows={10}
              placeholder="팩트체크 결과와 근거를 작성하세요..."
              value={postData.factCheckResult || ''}
              onChange={e => setPostData(p => ({ ...p, factCheckResult: e.target.value }))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[13px] font-medium text-slate-700 outline-none resize-none focus:border-slate-400 placeholder:text-slate-400 transition-colors"
            />
          </div>
          {/* 결과 출처 링크 (복수) */}
          <div className="px-5 pb-5 border-b border-slate-100 flex flex-col gap-2">
            {(postData.factCheckSources || ['']).map((src, i) => (
              <div key={i} className="flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>
                <input
                  type="text"
                  placeholder="출처 링크 (https://...)"
                  value={src}
                  onChange={e => updateFactCheckSource(i, e.target.value)}
                  className="flex-1 bg-transparent text-[13px] font-bold text-blue-500 outline-none placeholder:text-slate-400 placeholder:font-normal"
                />
                {(postData.factCheckSources || []).length > 1 && (
                  <button type="button" onClick={() => removeFactCheckSource(i)} className="text-slate-400 hover:text-rose-400 transition-colors text-[16px] leading-none">×</button>
                )}
              </div>
            ))}
            <button type="button" onClick={addFactCheckSource} className="self-start text-[11px] font-bold text-slate-400 hover:text-blue-500 transition-colors flex items-center gap-1">
              <span className="text-[14px] leading-none">+</span> 링크 추가
            </button>
          </div>

        </div>

        {/* 태그 */}
        <div className="flex items-center gap-3 px-5 py-2.5 border-t border-slate-100 bg-slate-50/60 shrink-0 flex-wrap">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tags</span>
          {[0, 1, 2, 3, 4].map((idx) => (
            <div key={idx} className="flex items-center gap-0.5">
              <span className="text-slate-400 text-[12px] font-bold">#</span>
              <input type="text" placeholder="태그" value={postData.tags?.[idx] || ''} onChange={(e) => handleTagChange(idx, e.target.value)} className="w-16 bg-transparent text-[12px] font-bold text-slate-500 outline-none border-b border-transparent focus:border-slate-300 placeholder:text-slate-300 transition-colors pb-px" />
            </div>
          ))}
        </div>

      </div>
    </div>
  );
};

export default CreateNakedKing;
