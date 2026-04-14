// src/components/EditEpisode.tsx — 마르지 않는 잉크병: 회차 수정 폼
// 🖋️ CreateEpisode 패턴 차용 + 가격/공개 설정은 읽기 전용 (결제 형평성 보호)
// 수정 가능: episodeTitle, content, authorNote, previewContent (자동 갱신)
// 수정 불가: episodeNumber, isPaid, price, seriesId
import { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { uploadToR2 } from '../uploadToR2';
import type { Post, Series, EpisodePrivateContent } from '../types';
import TiptapEditor from './TiptapEditor';

interface EditEpisodeProps {
  postId: string;
  currentUserUid: string | null;
  currentUserNickname: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const EditEpisode = ({ postId, currentUserUid, onSuccess, onCancel }: EditEpisodeProps) => {
  const [episode, setEpisode] = useState<Post | null>(null);
  const [series, setSeries] = useState<Series | null>(null);
  const [loading, setLoading] = useState(true);

  const [episodeTitle, setEpisodeTitle] = useState('');
  const [content, setContent] = useState('');
  const [authorNote, setAuthorNote] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 초기 데이터 로드 (회차 + 작품 + 유료 회차의 경우 private_data 본문)
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const epSnap = await getDoc(doc(db, 'posts', postId));
        if (!epSnap.exists()) {
          if (mounted) { setError('회차를 찾을 수 없습니다.'); setLoading(false); }
          return;
        }

        const ep = { id: epSnap.id, ...epSnap.data() } as Post;

        // 작가 본인 검증
        if (ep.author_id !== currentUserUid) {
          if (mounted) { setError('회차의 작가만 수정할 수 있습니다.'); setLoading(false); }
          return;
        }

        // 잉크병 회차 검증
        if (ep.category !== 'magic_inkwell') {
          if (mounted) { setError('잉크병 회차가 아닙니다.'); setLoading(false); }
          return;
        }

        // 유료 회차: private_data에서 본문 로드
        let bodyContent = ep.content || '';
        if (ep.isPaid) {
          const privateSnap = await getDoc(doc(db, 'posts', postId, 'private_data', 'content'));
          if (privateSnap.exists()) {
            bodyContent = (privateSnap.data() as EpisodePrivateContent).body || '';
          }
        }

        // 작품 메타 (UI 표시용)
        if (ep.seriesId) {
          const seriesSnap = await getDoc(doc(db, 'series', ep.seriesId));
          if (seriesSnap.exists() && mounted) {
            setSeries({ id: seriesSnap.id, ...seriesSnap.data() } as Series);
          }
        }

        if (mounted) {
          setEpisode(ep);
          setEpisodeTitle(ep.episodeTitle || '');
          setContent(bodyContent);
          setAuthorNote(ep.authorNote || '');
          setLoading(false);
        }
      } catch (err: unknown) {
        console.error('[EditEpisode] 로드 실패:', err);
        if (mounted) {
          const msg = err instanceof Error ? err.message : '회차를 불러올 수 없습니다.';
          setError(msg);
          setLoading(false);
        }
      }
    })();

    return () => { mounted = false; };
  }, [postId, currentUserUid]);

  // Tiptap 이미지 업로드 (CreateEpisode 동일 패턴)
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

  const handleSubmit = async () => {
    if (!episode || !currentUserUid) return;
    if (!episodeTitle.trim()) { setError('회차 제목을 입력해주세요.'); return; }
    const isEmpty = !content || content.trim() === '' || content === '<p></p>';
    if (isEmpty) { setError('본문을 작성해주세요.'); return; }

    setSubmitting(true);
    setError(null);

    try {
      // 미리보기 텍스트 재추출 (HTML 태그 제거 후 200자)
      const previewText = content.replace(/<[^>]+>/g, '').trim().slice(0, 200);

      // 1. posts 문서 업데이트 — episodeNumber/isPaid/price/seriesId/category는 절대 포함 안 함
      const updates: Record<string, unknown> = {
        episodeTitle: episodeTitle.trim(),
        authorNote: authorNote.trim() || null,
      };

      if (episode.isPaid) {
        // 유료: posts.content는 빈 문자열 유지, previewContent만 갱신
        updates.previewContent = previewText;
      } else {
        // 무료: content 직접 갱신
        updates.content = content;
      }

      await updateDoc(doc(db, 'posts', postId), updates);

      // 2. 유료 회차는 private_data 본문 별도 갱신
      if (episode.isPaid) {
        await updateDoc(
          doc(db, 'posts', postId, 'private_data', 'content'),
          { body: content }
        );
      }

      onSuccess();
    } catch (err: unknown) {
      console.error('[EditEpisode] 수정 실패:', err);
      const msg = err instanceof Error ? err.message : '수정 중 오류가 발생했습니다.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // 로딩
  if (loading) {
    return <div className="py-20 text-center text-slate-400 font-bold text-sm italic">불러오는 중...</div>;
  }

  // 에러 (회차 못 불러옴)
  if (error && !episode) {
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
    <div className="max-w-[800px] mx-auto px-4 py-6">
      {/* 상단 헤더 */}
      <div className="flex items-center justify-between mb-6 pb-3 border-b border-slate-200">
        <button onClick={onCancel} className="text-[12px] text-slate-500 hover:text-slate-900 font-bold transition-colors">
          ← 취소
        </button>
        <h1 className="text-[14px] font-[1000] text-slate-700 truncate max-w-[400px]">
          {series && episode ? `${series.title} · ${episode.episodeNumber}화 수정` : '회차 수정'}
        </h1>
        <div className="w-12" />
      </div>

      <div className="space-y-6">
        {/* 회차 제목 */}
        <div>
          <label className="block text-[11px] font-[1000] text-slate-600 mb-2">
            회차 제목 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={episodeTitle}
            onChange={(e) => setEpisodeTitle(e.target.value)}
            maxLength={50}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* 본문 — Tiptap */}
        <div>
          <label className="block text-[11px] font-[1000] text-slate-600 mb-2">
            본문 <span className="text-red-500">*</span>
          </label>
          <div className="border border-slate-300 rounded-lg overflow-hidden">
            <TiptapEditor
              content={content}
              onChange={setContent}
              onImageUpload={uploadFile}
              placeholder="이야기를 이어가세요..."
            />
          </div>
        </div>

        {/* 작가의 말 */}
        <div>
          <label className="block text-[11px] font-[1000] text-slate-600 mb-2">작가의 말 (선택)</label>
          <textarea
            value={authorNote}
            onChange={(e) => setAuthorNote(e.target.value)}
            maxLength={300}
            rows={3}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 resize-none"
          />
          <p className="text-xs text-slate-400 mt-1 font-bold">{authorNote.length}/300</p>
        </div>

        {/* 공개 설정 (읽기 전용) */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
          <h3 className="text-[12px] font-[1000] text-slate-700 mb-2">🔒 공개 설정 (수정 불가)</h3>
          {episode?.isPaid ? (
            <div className="text-[12px] text-slate-600 font-bold">
              <p>이 회차는 <strong className="text-blue-600">유료 공개</strong>로 설정되어 있습니다.</p>
              <p className="text-[10px] text-slate-500 mt-1">가격: 🏀 {episode.price} 땡스볼</p>
              <p className="text-[10px] text-slate-400 mt-2">결제 형평성 보호를 위해 발행 후 가격 변경은 불가합니다.</p>
            </div>
          ) : (
            <div className="text-[12px] text-slate-600 font-bold">
              이 회차는 <strong className="text-blue-600">무료 공개</strong>로 설정되어 있습니다.
            </div>
          )}
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

export default EditEpisode;
