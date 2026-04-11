// src/components/CreateEpisode.tsx — 마르지 않는 잉크병: 회차 작성 폼
// 🖋️ Tiptap 본문 + 무료/유료 자동 판별 + 작가의 말
// 🚀 실제 회차 생성은 Cloud Function createEpisode가 처리 (서버측 episodeNumber 트랜잭션 — 레이스 방지)
import { useState, useEffect, useMemo } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import { uploadToR2 } from '../uploadToR2';
import type { Series } from '../types';
import TiptapEditor from './TiptapEditor';

interface CreateEpisodeProps {
  seriesId: string;
  currentUserUid: string | null;
  currentUserNickname: string;
  onSuccess: (newPostId: string) => void;
  onCancel: () => void;
}

const CreateEpisode = ({ seriesId, currentUserUid, onSuccess, onCancel }: CreateEpisodeProps) => {
  const [series, setSeries] = useState<Series | null>(null);
  const [nextEpisodeNumber, setNextEpisodeNumber] = useState<number>(1);
  const [episodeTitle, setEpisodeTitle] = useState('');
  const [content, setContent] = useState('');
  const [authorNote, setAuthorNote] = useState('');
  // null = 시리즈 기본 설정 따름, true/false = 작가가 명시적으로 변경
  const [isPaidOverride, setIsPaidOverride] = useState<boolean | null>(null);
  const [customPrice, setCustomPrice] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 작품 메타 조회 — 다음 회차 번호는 `(series.totalEpisodes || 0) + 1`로 UI 미리보기
  // (실제 확정은 Cloud Function createEpisode 트랜잭션에서 결정 — 동시 제출 레이스 방지)
  useEffect(() => {
    getDoc(doc(db, 'series', seriesId)).then((snap) => {
      if (snap.exists()) {
        const s = { id: snap.id, ...snap.data() } as Series;
        setSeries(s);
        setNextEpisodeNumber((s.totalEpisodes || 0) + 1);
      }
    }).catch((err) => console.error('[CreateEpisode] 작품 조회 실패:', err));
  }, [seriesId]);

  // Tiptap 이미지 업로드 (기존 CreateMyStory 패턴 동일)
  const uploadFile = async (file: File): Promise<string | null> => {
    if (!currentUserUid) return null;
    try {
      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `episode_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
      const filePath = `uploads/${currentUserUid}/${fileName}`;
      return await uploadToR2(file, filePath);
    } catch {
      alert('이미지 업로드에 실패했습니다.');
      return null;
    }
  };

  // 자동 유료 판단 — 작가 override 우선, 없으면 시리즈 freeEpisodeLimit 기준
  const willBePaid = useMemo(() => {
    if (!series) return false;
    if (isPaidOverride !== null) return isPaidOverride;
    return nextEpisodeNumber > series.freeEpisodeLimit && (series.defaultPrice || 0) > 0;
  }, [series, nextEpisodeNumber, isPaidOverride]);

  const finalPrice = useMemo(() => {
    if (!willBePaid) return 0;
    if (customPrice !== null) return customPrice;
    return series?.defaultPrice || 0;
  }, [willBePaid, customPrice, series]);

  const handleSubmit = async () => {
    if (!currentUserUid) { setError('로그인이 필요합니다.'); return; }
    if (!series) { setError('작품 정보를 불러오지 못했습니다.'); return; }
    if (series.authorId !== currentUserUid) { setError('작품의 작가만 회차를 작성할 수 있습니다.'); return; }
    if (!episodeTitle.trim()) { setError('회차 제목을 입력해주세요.'); return; }
    const isEmpty = !content || content.trim() === '' || content === '<p></p>';
    if (isEmpty) { setError('본문을 작성해주세요.'); return; }
    if (willBePaid && finalPrice <= 0) { setError('유료 회차의 가격은 1볼 이상이어야 합니다.'); return; }

    setSubmitting(true);
    setError(null);

    try {
      // 🚀 Cloud Function createEpisode 호출 — 서버측 episodeNumber 트랜잭션 결정
      // (클라이언트에서 episodeNumber를 계산하면 동시 제출 시 중복 생성 발생 가능)
      const createEpisodeFn = httpsCallable<
        { seriesId: string; episodeTitle: string; content: string; authorNote?: string; isPaidOverride: boolean | null; customPrice: number | null },
        { success: boolean; postId: string }
      >(functions, 'createEpisode');

      const result = await createEpisodeFn({
        seriesId,
        episodeTitle: episodeTitle.trim(),
        content,
        authorNote: authorNote.trim() || undefined,
        isPaidOverride,
        customPrice,
      });

      onSuccess(result.data.postId);
    } catch (err: unknown) {
      console.error('[CreateEpisode] 회차 생성 실패:', err);
      const fnErr = err as { code?: string; message?: string };
      if (fnErr.code === 'functions/permission-denied') {
        setError(fnErr.message || '작품의 작가만 회차를 작성할 수 있습니다.');
      } else if (fnErr.code === 'functions/invalid-argument') {
        setError(fnErr.message || '입력값을 확인해주세요.');
      } else if (fnErr.code === 'functions/not-found') {
        setError('작품을 찾을 수 없습니다.');
      } else {
        setError(fnErr.message || '회차 생성 중 오류가 발생했습니다.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-[800px] mx-auto px-4 py-6">
      {/* 상단 헤더 */}
      <div className="flex items-center justify-between mb-6 pb-3 border-b border-slate-200">
        <button onClick={onCancel} className="text-[12px] text-slate-500 hover:text-slate-900 font-bold transition-colors">
          ← 취소
        </button>
        <h1 className="text-[14px] font-[1000] text-slate-700 truncate max-w-[400px]">
          {series ? `${series.title} · ${nextEpisodeNumber}화 작성` : '회차 작성'}
        </h1>
        <div className="w-12" />
      </div>

      <div className="space-y-6">
        {/* 회차 제목 */}
        <div>
          <label className="block text-[12px] font-[1000] text-slate-600 mb-2">
            회차 제목 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={episodeTitle}
            onChange={(e) => setEpisodeTitle(e.target.value)}
            maxLength={50}
            placeholder="예: 프롤로그, 만남, 엇갈림"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* 본문 — Tiptap 에디터 (기존 컴포넌트 시그니처: content, onChange, onImageUpload, placeholder) */}
        <div>
          <label className="block text-[12px] font-[1000] text-slate-600 mb-2">
            본문 <span className="text-red-500">*</span>
          </label>
          <div className="border border-slate-300 rounded-lg overflow-hidden">
            <TiptapEditor
              content={content}
              onChange={setContent}
              onImageUpload={uploadFile}
              placeholder="이야기를 시작해보세요..."
            />
          </div>
        </div>

        {/* 작가의 말 */}
        <div>
          <label className="block text-[12px] font-[1000] text-slate-600 mb-2">작가의 말 (선택)</label>
          <textarea
            value={authorNote}
            onChange={(e) => setAuthorNote(e.target.value)}
            maxLength={300}
            rows={3}
            placeholder="독자에게 전하고 싶은 말을 적어주세요."
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 resize-none"
          />
          <p className="text-xs text-slate-400 mt-1 font-bold">{authorNote.length}/300</p>
        </div>

        {/* 유료/무료 설정 — 차분한 회색 톤 */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
          <h3 className="text-[12px] font-[1000] text-slate-700 mb-3">💰 공개 설정</h3>

          <div className="flex gap-1.5 mb-3">
            <button
              type="button"
              onClick={() => setIsPaidOverride(false)}
              className={`flex-1 px-3 py-1.5 rounded-full text-[11px] font-[1000] transition-colors ${
                !willBePaid ? 'bg-blue-600 text-white shadow-sm' : 'bg-white border border-slate-300 text-slate-500 hover:bg-slate-100'
              }`}
            >
              🆓 무료 공개
            </button>
            <button
              type="button"
              onClick={() => setIsPaidOverride(true)}
              className={`flex-1 px-3 py-1.5 rounded-full text-[11px] font-[1000] transition-colors ${
                willBePaid ? 'bg-blue-600 text-white shadow-sm' : 'bg-white border border-slate-300 text-slate-500 hover:bg-slate-100'
              }`}
            >
              🔒 유료 공개
            </button>
          </div>

          {/* 자동 안내 (override 안 한 상태) */}
          {series && isPaidOverride === null && (
            <p className="text-[10px] text-slate-500 font-bold">
              ℹ️ 작품 설정에 따라 {nextEpisodeNumber > series.freeEpisodeLimit ? '유료' : '무료'}로 자동 설정됩니다.
              <br />
              (무료 회차 한도: {series.freeEpisodeLimit}화 / 기본 가격: 🏀 {series.defaultPrice})
            </p>
          )}

          {/* 유료일 때 가격 조정 */}
          {willBePaid && (
            <div className="mt-3 pt-3 border-t border-slate-200">
              <label className="block text-[11px] font-[1000] text-slate-600 mb-1">이 회차의 가격</label>
              <div className="flex items-center gap-2">
                <span className="text-base">🏀</span>
                <input
                  type="number"
                  value={customPrice ?? series?.defaultPrice ?? 0}
                  onChange={(e) => setCustomPrice(Math.max(0, parseInt(e.target.value) || 0))}
                  min={1}
                  max={100}
                  className="w-24 px-3 py-1.5 border border-slate-300 rounded text-[12px]"
                />
                <span className="text-[11px] text-slate-500 font-bold">땡스볼</span>
              </div>
            </div>
          )}
        </div>

        {/* 미리보기 안내 (유료일 때) */}
        {willBePaid && (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-[10px] text-slate-500 font-bold">
            ℹ️ 유료 회차의 본문은 자동으로 보안 영역(private_data)에 분리 저장됩니다.
            본문 앞 200자가 자동으로 미리보기로 제공됩니다.
          </div>
        )}

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
            {submitting ? '게시 중...' : '✍️ 회차 발행'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateEpisode;
