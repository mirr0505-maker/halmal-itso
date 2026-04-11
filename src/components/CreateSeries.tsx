// src/components/CreateSeries.tsx — 마르지 않는 잉크병: 작품 개설 폼
// 🖋️ 표지 업로드(R2) + 제목/시놉시스/장르/태그/유료화 설정 → series 컬렉션 생성
import { useState } from 'react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { uploadToR2 } from '../uploadToR2';
import type { SeriesGenre } from '../types';
import { GENRE_LABEL } from '../utils/inkwell';

interface CreateSeriesProps {
  currentUserUid: string | null;
  currentUserNickname: string;
  currentUserProfileImage?: string | null;
  onSuccess: (newSeriesId: string) => void;
  onCancel: () => void;
}

const CreateSeries = ({ currentUserUid, currentUserNickname, currentUserProfileImage, onSuccess, onCancel }: CreateSeriesProps) => {
  const [title, setTitle] = useState('');
  const [synopsis, setSynopsis] = useState('');
  const [genre, setGenre] = useState<SeriesGenre>('novel');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [freeEpisodeLimit, setFreeEpisodeLimit] = useState(10);
  const [defaultPrice, setDefaultPrice] = useState(3);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('이미지 파일만 업로드 가능합니다.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('이미지 크기는 5MB 이하여야 합니다.');
      return;
    }
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
    setError(null);
  };

  const handleAddTag = () => {
    const trimmed = tagInput.trim();
    if (!trimmed) return;
    if (tags.length >= 5) {
      setError('태그는 최대 5개까지 추가할 수 있습니다.');
      return;
    }
    if (tags.includes(trimmed)) return;
    setTags([...tags, trimmed]);
    setTagInput('');
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleSubmit = async () => {
    if (!currentUserUid) { setError('로그인이 필요합니다.'); return; }
    if (!title.trim()) { setError('작품 제목을 입력해주세요.'); return; }
    if (!synopsis.trim()) { setError('시놉시스를 입력해주세요.'); return; }
    if (!coverFile) { setError('표지 이미지를 등록해주세요.'); return; }

    setSubmitting(true);
    setError(null);

    try {
      // 1. 표지 R2 업로드 — 기존 CreateMyStory.tsx 패턴: uploads/{uid}/{filename}
      const fileExt = coverFile.name.split('.').pop() || 'jpg';
      const fileName = `cover_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
      const filePath = `uploads/${currentUserUid}/${fileName}`;
      const coverUrl = await uploadToR2(coverFile, filePath);

      // 2. series 문서 생성 — ID 형식: series_{timestamp}_{uid}
      const timestamp = Date.now();
      const seriesId = `series_${timestamp}_${currentUserUid}`;

      await setDoc(doc(db, 'series', seriesId), {
        id: seriesId,
        title: title.trim(),
        synopsis: synopsis.trim(),
        coverImageUrl: coverUrl,
        genre,
        tags,
        authorId: currentUserUid,
        authorNickname: currentUserNickname,
        authorProfileImage: currentUserProfileImage || null,
        totalEpisodes: 0,
        totalViews: 0,
        totalLikes: 0,
        subscriberCount: 0,
        isCompleted: false,
        status: 'serializing',
        freeEpisodeLimit,
        defaultPrice,
        lastEpisodeAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      onSuccess(seriesId);
    } catch (err: unknown) {
      console.error('[CreateSeries] 작품 생성 실패:', err);
      const msg = err instanceof Error ? err.message : '작품 생성 중 오류가 발생했습니다.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-[700px] mx-auto px-4 py-6">
      {/* 상단 헤더 */}
      <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-200">
        <button onClick={onCancel} className="text-[12px] text-slate-500 hover:text-slate-900 font-bold transition-colors">
          ← 취소
        </button>
        <h1 className="text-[14px] font-[1000] text-slate-700">새 작품 개설</h1>
        <div className="w-12" />
      </div>

      <div className="space-y-6">
        {/* 표지 업로드 */}
        <div>
          <label className="block text-[12px] font-[1000] text-slate-600 mb-2">
            표지 이미지 <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-32 aspect-[3/4] bg-slate-100 rounded-lg overflow-hidden border-2 border-dashed border-slate-300 flex items-center justify-center">
              {coverPreview ? (
                <img src={coverPreview} alt="표지" className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl text-slate-300">📕</span>
              )}
            </div>
            <div className="flex-1 flex flex-col justify-center">
              <input
                type="file"
                accept="image/*"
                onChange={handleCoverSelect}
                className="text-sm text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-500 file:text-white file:cursor-pointer file:font-bold hover:file:bg-blue-600"
              />
              <p className="text-xs text-slate-500 mt-2 font-bold">권장 비율 3:4, 5MB 이하</p>
            </div>
          </div>
        </div>

        {/* 제목 */}
        <div>
          <label className="block text-[12px] font-[1000] text-slate-600 mb-2">
            작품 제목 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={50}
            placeholder="예: 달빛 아래 서신"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-400 mt-1 font-bold">{title.length}/50</p>
        </div>

        {/* 장르 — 차분한 회색/블루 톤 */}
        <div>
          <label className="block text-[12px] font-[1000] text-slate-600 mb-2">
            장르 <span className="text-red-500">*</span>
          </label>
          <div className="flex flex-wrap gap-1.5">
            {(['novel', 'poem', 'essay', 'webtoon', 'comic'] as SeriesGenre[]).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGenre(g)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-[1000] transition-colors ${
                  genre === g ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                {GENRE_LABEL[g]}
              </button>
            ))}
          </div>
        </div>

        {/* 시놉시스 */}
        <div>
          <label className="block text-[12px] font-[1000] text-slate-600 mb-2">
            시놉시스 <span className="text-red-500">*</span>
          </label>
          <textarea
            value={synopsis}
            onChange={(e) => setSynopsis(e.target.value)}
            maxLength={500}
            rows={5}
            placeholder="작품에 대한 소개를 적어주세요."
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 resize-none"
          />
          <p className="text-xs text-slate-400 mt-1 font-bold">{synopsis.length}/500</p>
        </div>

        {/* 태그 */}
        <div>
          <label className="block text-[12px] font-[1000] text-slate-600 mb-2">태그 (선택, 최대 5개)</label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); } }}
              placeholder="태그 입력 후 Enter"
              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
            />
            <button type="button" onClick={handleAddTag} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-bold">
              추가
            </button>
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tags.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded">
                  #{tag}
                  <button type="button" onClick={() => handleRemoveTag(tag)} className="ml-1 hover:text-red-500">×</button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 부분 유료화 설정 — 차분한 회색 톤 */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
          <h3 className="text-[12px] font-[1000] text-slate-700 mb-3">💰 부분 유료화 설정</h3>

          <div className="mb-3">
            <label className="block text-[11px] font-[1000] text-slate-600 mb-1">무료 회차 수</label>
            <input
              type="number"
              value={freeEpisodeLimit}
              onChange={(e) => setFreeEpisodeLimit(Math.max(0, parseInt(e.target.value) || 0))}
              min={0}
              max={999}
              className="w-24 px-3 py-1.5 border border-slate-300 rounded text-[12px] focus:outline-none focus:border-blue-500"
            />
            <span className="text-[11px] text-slate-500 ml-2 font-bold">화까지 무료 공개</span>
            <p className="text-[10px] text-slate-500 mt-1 font-bold">전체 무료로 운영하려면 999 이상으로 설정</p>
          </div>

          <div>
            <label className="block text-[11px] font-[1000] text-slate-600 mb-1">기본 회차 가격</label>
            <div className="flex items-center gap-2">
              <span className="text-base">🏀</span>
              <input
                type="number"
                value={defaultPrice}
                onChange={(e) => setDefaultPrice(Math.max(0, parseInt(e.target.value) || 0))}
                min={0}
                max={100}
                className="w-24 px-3 py-1.5 border border-slate-300 rounded text-[12px] focus:outline-none focus:border-blue-500"
              />
              <span className="text-[11px] text-slate-500 font-bold">땡스볼</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1 font-bold">유료 회차 1편당 독자가 지불할 땡스볼 수</p>
          </div>
        </div>

        {/* 에러 */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-[12px] text-red-700 font-bold">{error}</div>
        )}

        {/* 제출 */}
        <div className="flex gap-2 pt-3">
          <button type="button" onClick={onCancel} className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[12px] font-[1000] transition-colors">
            취소
          </button>
          <button type="button" onClick={handleSubmit} disabled={submitting} className="flex-1 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg text-[12px] font-[1000] transition-colors">
            {submitting ? '생성 중...' : '🖋️ 작품 개설하기'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateSeries;
