// src/components/MarketItemEditor.tsx — 강변 시장: 가판대 판매글 작성/수정
// 제목 + 티저(미리보기) + 본문(private_data) + 가격 + 카테고리 + 태그 + 표지 이미지
import { useState } from 'react';
import { db } from '../firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { uploadToR2 } from '../uploadToR2';
import { calculateLevel } from '../utils';
import type { UserData, MarketCategory } from '../types';
import TiptapEditor from './TiptapEditor';

// 황금알을 낳는 거위와 동일한 분야 체계
const INFO_GROUPS: { label: string; items: string[] }[] = [
  { label: '금융·투자', items: ['주식', '코인', '부동산', '재테크', '금융'] },
  { label: '경제·경영', items: ['경제', '경영', '창업', '세금', '정책'] },
  { label: '사회·정치', items: ['정치', '사회', '글로벌'] },
  { label: '지식·학문', items: ['IT', '컴퓨터', '과학', '교육', '외국어', '역사', '철학', '인문', '문학', '종교'] },
  { label: '엔터·문화', items: ['게임', '애니메이션', '방송', '영화', '음악', '문화예술'] },
  { label: '라이프',   items: ['여행', '스포츠', '반려동물', '취미', '생활', '패션미용', '건강', '육아'] },
];

interface Props {
  currentUserData: UserData;
  onSuccess: (itemId: string) => void;
  onCancel: () => void;
}

const MarketItemEditor = ({ currentUserData, onSuccess, onCancel }: Props) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<MarketCategory>('주식');
  const [activeGroup, setActiveGroup] = useState(0);
  const [price, setPrice] = useState(10);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userLevel = calculateLevel(currentUserData.exp || 0);

  // 태그 추가
  const addTag = () => {
    const t = tagInput.trim();
    if (!t || tags.length >= 5 || tags.includes(t)) return;
    setTags(prev => [...prev, t]);
    setTagInput('');
  };

  // 이미지 업로드 핸들러 (Tiptap 본문 내 이미지)
  const uploadFile = async (file: File): Promise<string | null> => {
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const fileName = `market_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;
      const filePath = `uploads/${currentUserData.uid}/${fileName}`;
      return await uploadToR2(file, filePath);
    } catch {
      return null;
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) { setError('제목을 입력해주세요.'); return; }
    const isEmpty = !content || content.trim() === '' || content === '<p></p>';
    if (isEmpty) { setError('본문을 작성해주세요.'); return; }
    // 본문에서 HTML 태그 제거 후 앞 200자를 미리보기로 자동 추출
    const previewContent = content.replace(/<[^>]+>/g, '').trim().slice(0, 200);
    if (price < 1 || price > 100) { setError('가격은 1~100볼 사이로 설정해주세요.'); return; }

    setSubmitting(true);
    setError(null);

    try {
      // 표지 이미지 R2 업로드
      let coverImageUrl: string | undefined;
      if (coverFile) {
        const ext = coverFile.name.split('.').pop() || 'jpg';
        const filePath = `uploads/${currentUserData.uid}/market_cover_${Date.now()}.${ext}`;
        const url = await uploadToR2(coverFile, filePath);
        if (url) coverImageUrl = url;
      }

      const timestamp = Date.now();
      const itemId = `mkt_${timestamp}_${currentUserData.uid}`;

      // market_items 문서 생성
      await setDoc(doc(db, 'market_items', itemId), {
        id: itemId,
        authorId: currentUserData.uid,
        authorNickname: currentUserData.nickname,
        authorLevel: userLevel,
        title: title.trim(),
        previewContent: previewContent.trim(),
        category,
        tags,
        price,
        coverImageUrl: coverImageUrl || null,
        purchaseCount: 0,
        ratingAvg: 0,
        ratingCount: 0,
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // 본문은 private_data 서브문서에 분리 저장 (Rules로 미구매자 차단)
      await setDoc(doc(db, 'market_items', itemId, 'private_data', 'content'), {
        body: content,
        updatedAt: serverTimestamp(),
      });

      onSuccess(itemId);
    } catch (err) {
      console.error('[MarketItemEditor] 작성 실패:', err);
      setError('판매글 작성 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-[800px] mx-auto px-4 py-6">
      {/* 상단 헤더 */}
      <div className="flex items-center justify-between mb-6 pb-3 border-b border-slate-200">
        <button onClick={onCancel} className="text-[12px] text-slate-500 hover:text-slate-900 font-bold transition-colors">
          ← 취소
        </button>
        <h1 className="text-[14px] font-[1000] text-slate-700">판매글 작성</h1>
        <div className="w-12" />
      </div>

      <div className="space-y-5">
        {/* 제목 */}
        <div>
          <label className="block text-[12px] font-[1000] text-slate-600 mb-1.5">제목 <span className="text-red-500">*</span></label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80}
            placeholder="판매글 제목을 입력하세요"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-slate-500" />
        </div>

        {/* 카테고리 — 황금알 그룹 방식 */}
        <div>
          <label className="block text-[12px] font-[1000] text-slate-600 mb-1.5">분야</label>
          <div className="flex gap-1.5 mb-2 flex-wrap">
            {INFO_GROUPS.map((g, i) => (
              <button key={g.label} type="button" onClick={() => setActiveGroup(i)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-[1000] border transition-all ${
                  activeGroup === i ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                }`}>{g.label}</button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {INFO_GROUPS[activeGroup].items.map(item => (
              <button key={item} type="button" onClick={() => setCategory(item)}
                className={`px-3 py-1 rounded-full text-[11px] font-bold border transition-all ${
                  category === item ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-400'
                }`}>{item}</button>
            ))}
          </div>
          {category && <p className="text-[10px] font-bold text-slate-400 mt-1">선택: {category}</p>}
        </div>

        {/* 가격 */}
        <div>
          <label className="block text-[12px] font-[1000] text-slate-600 mb-1.5">가격 (땡스볼)</label>
          <div className="flex items-center gap-3">
            <input type="range" min={1} max={100} value={price} onChange={(e) => setPrice(Number(e.target.value))}
              className="flex-1 accent-slate-700" />
            <span className="text-[14px] font-[1000] text-slate-800 w-16 text-right">{price}볼</span>
          </div>
        </div>

        {/* 태그 */}
        <div>
          <label className="block text-[12px] font-[1000] text-slate-600 mb-1.5">태그 (최대 5개)</label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {tags.map((t, i) => (
              <span key={i} className="flex items-center gap-1 bg-slate-100 text-slate-600 text-[11px] font-bold px-2 py-0.5 rounded-full">
                {t}
                <button type="button" onClick={() => setTags(prev => prev.filter((_, idx) => idx !== i))} className="text-slate-400 hover:text-red-500">×</button>
              </span>
            ))}
          </div>
          {tags.length < 5 && (
            <div className="flex gap-1.5">
              <input type="text" value={tagInput} onChange={(e) => setTagInput(e.target.value)} maxLength={20}
                placeholder="태그 입력 후 추가" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-[12px] focus:outline-none focus:border-slate-400" />
              <button type="button" onClick={addTag} className="px-3 py-1.5 bg-slate-700 text-white rounded-lg text-[11px] font-bold">추가</button>
            </div>
          )}
        </div>

        {/* 표지 이미지 */}
        <div>
          <label className="block text-[12px] font-[1000] text-slate-600 mb-1.5">표지 이미지 (선택)</label>
          <input type="file" accept="image/*" className="hidden" id="market-cover-input"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 5 * 1024 * 1024) { alert('5MB 이하만 업로드 가능합니다.'); return; }
              setCoverFile(file);
              setCoverPreview(URL.createObjectURL(file));
            }} />
          {coverPreview ? (
            <div className="relative w-2/3 aspect-[16/9] rounded-lg overflow-hidden border border-slate-200">
              <img src={coverPreview} alt="" className="w-full h-full object-cover" />
              <button type="button" onClick={() => { setCoverFile(null); setCoverPreview(null); }}
                className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/50 text-white rounded-full text-[13px] flex items-center justify-center hover:bg-black/70">×</button>
            </div>
          ) : (
            <label htmlFor="market-cover-input"
              className="w-2/3 aspect-[16/9] border-2 border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center gap-1 hover:border-slate-400 transition-all cursor-pointer">
              <span className="text-[11px] font-bold text-slate-400">클릭하여 표지 선택</span>
              <span className="text-[9px] text-slate-300">5MB 이하</span>
            </label>
          )}
        </div>

        {/* 본문 — 하나만 작성, 앞 200자가 자동으로 미리보기 */}
        <div>
          <label className="block text-[12px] font-[1000] text-slate-600 mb-1.5">본문 <span className="text-red-500">*</span></label>
          <p className="text-[10px] text-slate-400 mb-1">앞부분 200자가 미구매자에게 미리보기로 공개됩니다. 나머지는 구매 후 열람.</p>
          <div className="border border-slate-300 rounded-lg overflow-hidden">
            <TiptapEditor
              content={content}
              onChange={setContent}
              onImageUpload={uploadFile}
              placeholder="유료 콘텐츠 본문을 작성하세요..."
            />
          </div>
        </div>

        {/* 에러 */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-[12px] text-red-700 font-bold">{error}</div>
        )}

        {/* 제출 */}
        <div className="flex gap-2 pt-3">
          <button type="button" onClick={onCancel}
            className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[12px] font-[1000] transition-colors">
            취소
          </button>
          <button type="button" onClick={handleSubmit} disabled={submitting}
            className="flex-1 px-4 py-2.5 bg-slate-900 hover:bg-slate-700 disabled:opacity-50 text-white rounded-lg text-[12px] font-[1000] transition-colors">
            {submitting ? '등록 중...' : '판매글 등록'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MarketItemEditor;
