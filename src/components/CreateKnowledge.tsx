// src/components/CreateKnowledge.tsx — 황금알을 낳는 거위 새글 작성 폼
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

// 🚀 황금알 정보 분야: 최대 2개 선택, 비슷한 분야끼리 인접 배치
const INFO_FIELDS = [
  '주식', '코인', '부동산', '재테크', '금융',           // 금융·투자
  '경제', '경영', '창업', '세금', '정책',               // 경제·경영
  '정치', '사회', '글로벌',                             // 사회·정치
  'IT', '컴퓨터', '과학', '교육외국어', '철학', '인문', '문학', '종교', // 지식·학문
  '게임', '애니메이션', '방송', '영화', '음악', '문화예술', // 엔터·문화
  '여행', '스포츠', '반려동물', '취미', '생활', '패션미용', '건강', '육아', // 라이프
];

const CreateKnowledge = ({ userData, editingPost, onSubmit, onClose }: Props) => {
  const [postData, setPostData] = useState<Partial<Post>>({
    title: editingPost?.title || '',
    content: editingPost?.content || '',
    category: '황금알을 낳는 거위',
    tags: editingPost?.tags || ['', '', '', '', ''],
    infoFields: editingPost?.infoFields || [],
    isOneCut: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // 🚀 분야 칩 토글 — 최대 2개, 선택 시 tags[0]/[1]에 자동 반영 (tags[2]~[4]는 유저 직접 입력용 유지)
  const toggleField = (field: string) => {
    const current = postData.infoFields || [];
    const isSelected = current.includes(field);
    const newFields = isSelected
      ? current.filter(f => f !== field)
      : current.length < 2 ? [...current, field] : current;
    if (newFields === current) return; // 최대 2개 초과 시 무시

    // tags[0]~[1]에 선택된 분야 자동 입력, 나머지 유저 입력 tags[2]~[4] 보존
    const userTags = Array.from({ length: 5 }, (_, i) => (postData.tags || [])[i] ?? '');
    userTags[0] = newFields[0] || '';
    userTags[1] = newFields[1] || '';
    setPostData(p => ({ ...p, infoFields: newFields, tags: userTags }));
  };

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
      await onSubmit({ ...postData, tags: filteredTags }, editingPost?.id);
    } finally { setIsSubmitting(false); }
  };

  return (
    <div className="w-full max-w-[860px] mx-auto py-8 animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col shadow-sm" style={{ maxHeight: 'calc(100vh - 80px)' }}>
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 h-12 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="text-[12px] font-bold text-slate-400 tracking-wide uppercase">{editingPost ? '글 수정' : '새 글 기록'}</span>
            <span className="text-[11px] font-bold text-yellow-500">📚 황금알을 낳는 거위</span>
            {isUploading && <span className="flex items-center gap-1.5 text-[11px] font-bold text-blue-500"><span className="w-2.5 h-2.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin inline-block" />이미지 업로드 중</span>}
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={onClose} className="px-3.5 h-7 rounded-md text-[12px] font-bold text-slate-500 hover:bg-slate-100 transition-colors">취소</button>
            <button onClick={handleSubmit} disabled={isSubmitting || isUploading} className={`px-4 h-7 rounded-md text-[12px] font-bold transition-all ${isSubmitting || isUploading ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-900 text-white hover:bg-blue-600'}`}>{isSubmitting ? '업로드 중...' : '새글 올리기'}</button>
          </div>
        </div>

        {/* 제목 */}
        <div className="flex items-center px-5 py-3 border-b border-slate-100 shrink-0">
          <input type="text" placeholder="제목을 입력하세요" value={postData.title || ''} onChange={(e) => setPostData({ ...postData, title: e.target.value })} className="w-full bg-transparent text-[18px] font-bold text-slate-900 outline-none placeholder:text-slate-200 placeholder:font-normal" />
        </div>

        {/* 🚀 정보 분야 선택 — 최대 2개, 선택된 분야는 상세글에 배지로 표시 */}
        <div className="flex items-center gap-2.5 px-5 py-2.5 border-b border-slate-100 shrink-0 flex-wrap">
          <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest shrink-0">정보 분야</span>
          <span className="text-[9px] font-bold text-slate-200 shrink-0">최대 2개</span>
          {INFO_FIELDS.map(field => {
            const isSelected = (postData.infoFields || []).includes(field);
            const isDisabled = !isSelected && (postData.infoFields || []).length >= 2;
            return (
              <button
                key={field}
                type="button"
                onClick={() => toggleField(field)}
                disabled={isDisabled}
                className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all border ${
                  isSelected
                    ? 'bg-yellow-400 text-yellow-900 border-yellow-400'
                    : isDisabled
                      ? 'bg-white text-slate-200 border-slate-100 cursor-not-allowed'
                      : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                }`}
              >
                {field}
              </button>
            );
          })}
        </div>

        {/* 에디터 */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <TiptapEditor content={postData.content || ''} onChange={(html) => setPostData(prev => ({ ...prev, content: html }))} onImageUpload={uploadFile} />
        </div>

        {/* 태그 — 0/1은 분야 자동 입력(readOnly), 2~4만 직접 입력 */}
        <div className="flex items-center gap-3 px-5 py-2.5 border-t border-slate-100 bg-slate-50/60 shrink-0 flex-wrap">
          <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Tags</span>
          {[0, 1, 2, 3, 4].map((idx) => {
            const isAutoField = idx < 2;
            return (
              <div key={idx} className="flex items-center gap-0.5">
                <span className={`text-[12px] font-bold ${isAutoField && postData.tags?.[idx] ? 'text-yellow-400' : 'text-slate-300'}`}>#</span>
                <input
                  type="text"
                  placeholder={isAutoField ? '분야 자동' : '태그'}
                  value={postData.tags?.[idx] || ''}
                  onChange={isAutoField ? undefined : (e) => handleTagChange(idx, e.target.value)}
                  readOnly={isAutoField}
                  className={`w-16 bg-transparent text-[12px] font-bold outline-none border-b transition-colors pb-px ${
                    isAutoField
                      ? 'text-yellow-500 border-transparent cursor-default'
                      : 'text-slate-500 border-transparent focus:border-slate-300 placeholder:text-slate-200'
                  }`}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CreateKnowledge;
