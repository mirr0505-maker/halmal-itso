// src/components/EditSeries.tsx — 마르지 않는 잉크병: 작품 수정 폼
// 🖋️ CreateSeries 패턴 차용 + 제목/장르는 읽기 전용 (브랜드 일관성)
// 수정 가능: synopsis, coverImageUrl, tags, freeEpisodeLimit, defaultPrice
// 수정 불가: title, genre, authorId, totalEpisodes, status
// ⚠️ freeEpisodeLimit/defaultPrice 변경은 신규 회차에만 적용. 기존 회차 가격 불변.
import { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { uploadToR2 } from '../uploadToR2';
import type { Series, SeriesGenre } from '../types';
import { GENRE_LABEL } from '../utils/inkwell';

interface EditSeriesProps {
  seriesId: string;
  currentUserUid: string | null;
  onSuccess: () => void;
  onCancel: () => void;
}

const EditSeries = ({ seriesId, currentUserUid, onSuccess, onCancel }: EditSeriesProps) => {
  const [series, setSeries] = useState<Series | null>(null);
  const [loading, setLoading] = useState(true);

  // 수정 가능한 필드만 별도 state
  const [synopsis, setSynopsis] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [freeEpisodeLimit, setFreeEpisodeLimit] = useState(10);
  const [defaultPrice, setDefaultPrice] = useState(3);

  // 표지 교체 (선택)
  const [newCoverFile, setNewCoverFile] = useState<File | null>(null);
  const [newCoverPreview, setNewCoverPreview] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 초기 데이터 로드
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const snap = await getDoc(doc(db, 'series', seriesId));
        if (!snap.exists()) {
          if (mounted) { setError('작품을 찾을 수 없습니다.'); setLoading(false); }
          return;
        }
        const s = { id: snap.id, ...snap.data() } as Series;

        // 작가 본인 검증
        if (s.authorId !== currentUserUid) {
          if (mounted) { setError('작품의 작가만 수정할 수 있습니다.'); setLoading(false); }
          return;
        }

        if (mounted) {
          setSeries(s);
          setSynopsis(s.synopsis || '');
          setTags(s.tags || []);
          setFreeEpisodeLimit(s.freeEpisodeLimit ?? 10);
          setDefaultPrice(s.defaultPrice ?? 3);
          setLoading(false);
        }
      } catch (err: unknown) {
        console.error('[EditSeries] 로드 실패:', err);
        if (mounted) {
          const msg = err instanceof Error ? err.message : '작품을 불러올 수 없습니다.';
          setError(msg);
          setLoading(false);
        }
      }
    })();

    return () => { mounted = false; };
  }, [seriesId, currentUserUid]);

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
    setNewCoverFile(file);
    setNewCoverPreview(URL.createObjectURL(file));
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
    if (!series || !currentUserUid) return;
    if (!synopsis.trim()) { setError('시놉시스를 입력해주세요.'); return; }

    setSubmitting(true);
    setError(null);

    try {
      // 1. 표지 교체가 있으면 R2 업로드 (없으면 기존 URL 유지 — 불필요한 업로드 방지)
      let coverUrl = series.coverImageUrl;
      if (newCoverFile) {
        const fileExt = newCoverFile.name.split('.').pop() || 'jpg';
        const fileName = `cover_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
        const filePath = `uploads/${currentUserUid}/${fileName}`;
        coverUrl = await uploadToR2(newCoverFile, filePath);
      }

      // 2. series 문서 업데이트 — title/genre/authorId/totalEpisodes/status는 절대 포함 안 함
      const updates: Record<string, unknown> = {
        synopsis: synopsis.trim(),
        tags,
        freeEpisodeLimit,
        defaultPrice,
        coverImageUrl: coverUrl,
        updatedAt: serverTimestamp(),
      };

      await updateDoc(doc(db, 'series', seriesId), updates);
      onSuccess();
    } catch (err: unknown) {
      console.error('[EditSeries] 수정 실패:', err);
      const msg = err instanceof Error ? err.message : '수정 중 오류가 발생했습니다.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="py-20 text-center text-slate-400 font-bold text-sm italic">불러오는 중...</div>;
  }

  if (error && !series) {
    return (
      <div className="py-20 text-center">
        <p className="text-slate-500 mb-4 font-bold text-sm">{error}</p>
        <button onClick={onCancel} className="text-blue-500 hover:underline text-sm font-bold">
          뒤로가기
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-[700px] mx-auto px-4 py-6">
      {/* 상단 헤더 */}
      <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-200">
        <button onClick={onCancel} className="text-[12px] text-slate-500 hover:text-slate-900 font-bold transition-colors">
          ← 취소
        </button>
        <h1 className="text-[14px] font-[1000] text-slate-700">작품 수정</h1>
        <div className="w-12" />
      </div>

      <div className="space-y-6">
        {/* 표지 (변경 가능) */}
        <div>
          <label className="block text-[12px] font-[1000] text-slate-600 mb-2">표지 이미지</label>
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-32 aspect-[3/4] bg-slate-100 rounded-lg overflow-hidden border border-slate-200">
              {newCoverPreview ? (
                <img src={newCoverPreview} alt="새 표지" className="w-full h-full object-cover" />
              ) : series?.coverImageUrl ? (
                <img src={series.coverImageUrl} alt="현재 표지" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-3xl text-slate-300">📕</div>
              )}
            </div>
            <div className="flex-1 flex flex-col justify-center">
              <input
                type="file"
                accept="image/*"
                onChange={handleCoverSelect}
                className="text-sm text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-500 file:text-white file:cursor-pointer file:font-bold hover:file:bg-blue-600"
              />
              <p className="text-xs text-slate-500 mt-2 font-bold">변경하지 않으려면 그대로 두세요. 5MB 이하.</p>
            </div>
          </div>
        </div>

        {/* 제목 (수정 불가) */}
        <div>
          <label className="block text-[12px] font-[1000] text-slate-600 mb-2">
            작품 제목 <span className="text-xs font-bold text-slate-400">(수정 불가)</span>
          </label>
          <input
            type="text"
            value={series?.title || ''}
            disabled
            className="w-full px-3 py-2 border border-slate-200 bg-slate-50 text-slate-500 rounded-lg text-sm cursor-not-allowed"
          />
          <p className="text-xs text-slate-400 mt-1 font-bold">작품 브랜드 일관성을 위해 발행 후 제목 변경은 불가합니다.</p>
        </div>

        {/* 장르 (수정 불가) */}
        <div>
          <label className="block text-[12px] font-[1000] text-slate-600 mb-2">
            장르 <span className="text-xs font-bold text-slate-400">(수정 불가)</span>
          </label>
          <div className="flex flex-wrap gap-1.5">
            {(['novel', 'poem', 'essay', 'webtoon', 'comic'] as SeriesGenre[]).map((g) => (
              <button
                key={g}
                type="button"
                disabled
                className={`px-3 py-1.5 rounded-full text-[11px] font-[1000] cursor-not-allowed ${
                  series?.genre === g ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-50 text-slate-400'
                }`}
              >
                {GENRE_LABEL[g]}
              </button>
            ))}
          </div>
        </div>

        {/* 시놉시스 (수정 가능) */}
        <div>
          <label className="block text-[12px] font-[1000] text-slate-600 mb-2">
            시놉시스 <span className="text-red-500">*</span>
          </label>
          <textarea
            value={synopsis}
            onChange={(e) => setSynopsis(e.target.value)}
            maxLength={500}
            rows={5}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 resize-none"
          />
          <p className="text-xs text-slate-400 mt-1 font-bold">{synopsis.length}/500</p>
        </div>

        {/* 태그 */}
        <div>
          <label className="block text-[12px] font-[1000] text-slate-600 mb-2">태그 (최대 5개)</label>
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

        {/* 부분 유료화 (미래 회차에만 적용) — 차분한 회색 톤 */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
          <h3 className="text-[12px] font-[1000] text-slate-700 mb-2">💰 부분 유료화 설정</h3>
          <p className="text-[10px] text-slate-500 mb-3 font-bold">
            ⚠️ 변경 사항은 <strong>새로 발행하는 회차에만 적용</strong>됩니다. 이미 발행된 회차의 가격은 변하지 않습니다.
          </p>

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
            {submitting ? '저장 중...' : '💾 수정 저장'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditSeries;
