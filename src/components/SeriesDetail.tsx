// src/components/SeriesDetail.tsx — 마르지 않는 잉크병: 작품 상세 (표지·정보·목차)
// 🖋️ series 문서 + posts(magic_inkwell) 에피소드 목록 onSnapshot 구독
import { useState, useEffect, useMemo } from 'react';
import { doc, collection, query, where, orderBy, limit, onSnapshot, getDocs, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import type { Series, Post } from '../types';
import { GENRE_LABEL, GENRE_COLOR, formatCount } from '../utils/inkwell';
import EpisodeListItem from './EpisodeListItem';
import SubscribeButton from './SubscribeButton';

interface SeriesDetailProps {
  seriesId: string;
  currentUserUid: string | null;
  onBack: () => void;
  onSelectEpisode: (postId: string) => void;
  onCreateEpisode?: () => void;
  onEditSeries?: () => void;
  onDeleteSuccess?: () => void;
}

const SeriesDetail = ({ seriesId, currentUserUid, onBack, onSelectEpisode, onCreateEpisode, onEditSeries, onDeleteSuccess }: SeriesDetailProps) => {
  const [series, setSeries] = useState<Series | null>(null);
  const [episodes, setEpisodes] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  // 🚀 Phase 3-D: 현재 유저 구매 내역 (구독 상태는 SubscribeButton 내부에서 자체 관리)
  const [unlockedSet, setUnlockedSet] = useState<Set<string>>(new Set());
  // 🖋️ Phase 4-D-2: 작품 삭제 진행 중 상태
  const [deletingSeries, setDeletingSeries] = useState(false);
  // 🖋️ Phase 5-A: 작품 비공개 → 공개 복귀 진행 중 상태
  const [republishingSeries, setRepublishingSeries] = useState(false);

  // 🔒 작품 메타 실시간 구독
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'series', seriesId),
      (snap) => {
        if (snap.exists()) {
          setSeries({ id: snap.id, ...snap.data() } as Series);
        } else {
          setSeries(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error('[SeriesDetail] 작품 조회 실패:', err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [seriesId]);

  // 🔒 현재 유저의 구매 내역 실시간 구독 (Phase 3-D)
  useEffect(() => {
    if (!currentUserUid) {
      setUnlockedSet(new Set());
      return;
    }
    const q = query(
      collection(db, 'unlocked_episodes'),
      where('userId', '==', currentUserUid),
      where('seriesId', '==', seriesId)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setUnlockedSet(new Set(snap.docs.map((d) => d.data().postId as string)));
      },
      (err) => {
        console.error('[SeriesDetail] 구매 내역 조회 실패:', err);
      }
    );
    return () => unsub();
  }, [currentUserUid, seriesId]);

  // 🔒 에피소드 목록 실시간 구독 (Phase 1 복합 인덱스: category+seriesId+episodeNumber 사용)
  useEffect(() => {
    const q = query(
      collection(db, 'posts'),
      where('category', '==', 'magic_inkwell'),
      where('seriesId', '==', seriesId),
      orderBy('episodeNumber', 'asc')
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Post));
        setEpisodes(list);
      },
      (err) => {
        console.error('[SeriesDetail] 에피소드 조회 실패:', err);
      }
    );
    return () => unsub();
  }, [seriesId]);

  // 🖋️ Phase 4-D-1: 작가 본인 판별 + 비공개(isHidden) 회차 필터링
  // 작가는 모든 회차를 보고, 일반 독자는 isHidden=true를 숨김
  const isAuthor = !!(series && currentUserUid && series.authorId === currentUserUid);
  const visibleEpisodes = useMemo(() => {
    if (isAuthor) return episodes;
    return episodes.filter((ep) => !ep.isHidden);
  }, [episodes, isAuthor]);

  // 🖋️ Phase 4-F: 작가 본인용 작품별 통계 (회차 합산)
  const seriesStats = useMemo(() => {
    if (!isAuthor) return null;
    return {
      totalEpisodeViews: visibleEpisodes.reduce((s, ep) => s + (ep.viewCount || 0), 0),
      totalEpisodeLikes: visibleEpisodes.reduce((s, ep) => s + (ep.likes || 0), 0),
      totalThanksballs: visibleEpisodes.reduce((s, ep) => s + (ep.thanksballTotal || 0), 0),
    };
  }, [visibleEpisodes, isAuthor]);

  // 🖋️ Phase 5-A: 비공개 작품 → 공개 복귀 (status: 'serializing')
  const handleRepublishSeries = async () => {
    if (!series || !isAuthor || republishingSeries) return;
    const confirmed = window.confirm(
      '이 작품을 다시 공개하시겠습니까?\n\n' +
      '- 작품 목록에 다시 표시됩니다\n' +
      '- 일반 독자도 작품에 접근할 수 있게 됩니다\n' +
      '- 구독 정보는 그대로 유지되어 있어 알림도 정상 발송됩니다'
    );
    if (!confirmed) return;

    setRepublishingSeries(true);
    try {
      await updateDoc(doc(db, 'series', seriesId), {
        status: 'serializing',
        updatedAt: serverTimestamp(),
      });
      alert('작품이 다시 공개되었습니다.');
    } catch (err: unknown) {
      console.error('[SeriesDetail] 공개 복귀 실패:', err);
      const msg = err instanceof Error ? err.message : '공개 복귀 중 오류가 발생했습니다.';
      alert(msg);
    } finally {
      setRepublishingSeries(false);
    }
  };

  // 🖋️ Phase 4-D-2: 작품 삭제 (회차 1개 이상이면 비공개 전환으로 폴백)
  const handleDeleteSeries = async () => {
    if (!series || !isAuthor || deletingSeries) return;
    setDeletingSeries(true);

    try {
      // 1. 회차 1개라도 있는지 확인
      const episodesQ = query(
        collection(db, 'posts'),
        where('category', '==', 'magic_inkwell'),
        where('seriesId', '==', seriesId),
        limit(1)
      );
      const episodesSnap = await getDocs(episodesQ);

      if (!episodesSnap.empty) {
        // 회차 있음 → 비공개 전환 제안
        const confirmed = window.confirm(
          '⚠️ 이 작품에 회차가 1개 이상 존재하여 삭제할 수 없습니다.\n\n' +
          '대신 "비공개 전환"하시겠습니까?\n' +
          '- 작품 목록에서 숨겨집니다\n' +
          '- 작가 본인은 마이페이지에서 계속 볼 수 있습니다\n' +
          '- 이미 구독한 독자는 알림을 받지 않습니다\n' +
          '- 회차를 모두 삭제한 뒤에는 작품도 영구 삭제 가능합니다'
        );
        if (!confirmed) { setDeletingSeries(false); return; }

        await updateDoc(doc(db, 'series', seriesId), {
          status: 'deleted',
          updatedAt: serverTimestamp(),
        });
        alert('작품이 비공개로 전환되었습니다.');
        onDeleteSuccess?.();
        return;
      }

      // 2. 회차 0개 → 영구 삭제 확인
      const confirmed = window.confirm(
        '정말 이 작품을 삭제하시겠습니까?\n' +
        '이 작업은 되돌릴 수 없습니다.\n\n' +
        '- 작품 메타데이터\n' +
        '- 모든 구독 정보\n\n' +
        '위 데이터가 영구 삭제됩니다.'
      );
      if (!confirmed) { setDeletingSeries(false); return; }

      // 3. 구독 cascade 삭제
      const subsQ = query(collection(db, 'series_subscriptions'), where('seriesId', '==', seriesId));
      const subsSnap = await getDocs(subsQ);
      await Promise.all(subsSnap.docs.map((d) => deleteDoc(d.ref)));

      // 4. series 문서 삭제
      await deleteDoc(doc(db, 'series', seriesId));

      alert('작품이 삭제되었습니다.');
      onDeleteSuccess?.();
    } catch (err: unknown) {
      console.error('[SeriesDetail] 삭제 실패:', err);
      const msg = err instanceof Error ? err.message : '삭제 중 오류가 발생했습니다.';
      alert(msg);
      setDeletingSeries(false);
    }
  };

  // 로딩
  if (loading) {
    return (
      <div className="py-20 text-center text-slate-400 font-bold text-sm italic">
        불러오는 중...
      </div>
    );
  }

  // 작품 없음
  if (!series) {
    return (
      <div className="py-20 text-center">
        <p className="text-slate-500 mb-4">작품을 찾을 수 없습니다.</p>
        <button onClick={onBack} className="text-blue-500 hover:underline text-sm font-bold">
          ← 작품 목록으로 돌아가기
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-[900px] mx-auto px-4 py-6">
      {/* 1. 뒤로가기 + 작가 액션 */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 font-bold transition-colors"
        >
          ← 작품 목록으로
        </button>
        {/* 🖋️ Phase 4-D-2: 작가 본인만 작품 수정/삭제 버튼 */}
        {isAuthor && (
          <div className="flex items-center gap-1 flex-shrink-0">
            {onEditSeries && (
              <button
                onClick={onEditSeries}
                disabled={deletingSeries}
                className="px-2 py-1 bg-blue-100 hover:bg-blue-200 disabled:opacity-50 text-blue-700 rounded text-xs font-[1000] transition-colors"
              >
                ✏️ 작품 수정
              </button>
            )}
            <button
              onClick={handleDeleteSeries}
              disabled={deletingSeries}
              className="px-2 py-1 bg-red-100 hover:bg-red-200 disabled:opacity-50 text-red-700 rounded text-xs font-[1000] transition-colors"
            >
              {deletingSeries ? '처리 중...' : '🗑️ 작품 삭제'}
            </button>
          </div>
        )}
      </div>

      {/* 🖋️ Phase 4-D-2 + 5-A: 비공개 작품 안내 + 다시 공개 버튼 */}
      {isAuthor && series.status === 'deleted' && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-800 font-bold mb-2">
            🙈 이 작품은 비공개 상태입니다. 작품 목록에서 숨겨지지만, 마이페이지의 "나의 연재작"에서 계속 관리할 수 있습니다.
          </p>
          <button
            onClick={handleRepublishSeries}
            disabled={republishingSeries}
            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded text-xs font-[1000] transition-colors"
          >
            {republishingSeries ? '처리 중...' : '👁 다시 공개하기'}
          </button>
        </div>
      )}

      {/* 2. 작품 헤더 (표지 + 정보) */}
      <div className="flex flex-col md:flex-row gap-6 mb-8">
        {/* 좌측: 표지 */}
        <div className="flex-shrink-0 w-full md:w-48 mx-auto md:mx-0 max-w-[200px]">
          <div className="aspect-[3/4] rounded-xl overflow-hidden bg-slate-100 shadow-md">
            <img src={series.coverImageUrl} alt={series.title} className="w-full h-full object-cover" />
          </div>
        </div>

        {/* 우측: 정보 */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* 장르 + 완결 뱃지 */}
          <div className="flex items-center gap-2 mb-2">
            <span className={`px-2 py-0.5 rounded text-[10px] font-[1000] text-white ${GENRE_COLOR[series.genre]}`}>
              {GENRE_LABEL[series.genre]}
            </span>
            {series.isCompleted && (
              <span className="px-2 py-0.5 rounded text-[10px] font-[1000] text-white bg-slate-600">
                완결
              </span>
            )}
          </div>

          {/* 제목 */}
          <h1 className="text-2xl font-bold text-slate-900 mb-1 break-words">{series.title}</h1>

          {/* 작가 */}
          <p className="text-sm text-slate-500 mb-4 font-bold">by {series.authorNickname}</p>

          {/* 메타 통계 */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-slate-600 font-bold mb-4">
            <span>📖 {series.totalEpisodes ?? 0}화</span>
            <span>👁 {formatCount(series.totalViews ?? 0)}</span>
            <span>❤️ {formatCount(series.totalLikes ?? 0)}</span>
            <span>👥 {formatCount(series.subscriberCount ?? 0)} 구독자</span>
          </div>

          {/* 시놉시스 */}
          <p className="text-sm text-slate-700 leading-relaxed mb-4 whitespace-pre-wrap">
            {series.synopsis}
          </p>

          {/* 태그 */}
          {series.tags && series.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-4">
              {series.tags.map((tag) => (
                <span key={tag} className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[11px] font-bold rounded">
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* 액션 버튼: 구독 + 첫화 보기 */}
          <div className="flex flex-wrap gap-2 mt-auto">
            <SubscribeButton
              seriesId={seriesId}
              authorId={series.authorId}
              currentUserUid={currentUserUid}
              subscriberCount={series.subscriberCount || 0}
            />
            {visibleEpisodes.length > 0 && (
              <button
                onClick={() => onSelectEpisode(visibleEpisodes[0].id)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-sm font-[1000] transition-colors"
              >
                ▶ 1화부터 보기
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 🖋️ Phase 4-F: 작가 본인 통계 박스 (목차 위) */}
      {isAuthor && seriesStats && (
        <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg">
          <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-1">
            📊 작가 통계
            <span className="text-xs font-bold text-slate-400">(작가 본인만 표시)</span>
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="bg-white rounded p-2 text-center">
              <div className="text-xs text-slate-500 font-bold">📖 회차</div>
              <div className="text-lg font-[1000] text-slate-900">{formatCount(visibleEpisodes.length)}</div>
            </div>
            <div className="bg-white rounded p-2 text-center">
              <div className="text-xs text-slate-500 font-bold">👁 누적 조회</div>
              <div className="text-lg font-[1000] text-slate-900">{formatCount(seriesStats.totalEpisodeViews)}</div>
            </div>
            <div className="bg-white rounded p-2 text-center">
              <div className="text-xs text-slate-500 font-bold">❤️ 좋아요</div>
              <div className="text-lg font-[1000] text-slate-900">{formatCount(seriesStats.totalEpisodeLikes)}</div>
            </div>
            <div className="bg-white rounded p-2 text-center">
              <div className="text-xs text-slate-500 font-bold">🏀 받은 응원</div>
              <div className="text-lg font-[1000] text-slate-900">{formatCount(seriesStats.totalThanksballs)}</div>
            </div>
          </div>
          <p className="text-xs text-slate-400 font-bold mt-2">
            💡 이 작품의 본문 인터랙션 누적 통계입니다. 댓글 땡스볼은 별도로 작가 ballReceived에 합산됩니다.
          </p>
        </div>
      )}

      {/* 3. 회차 목차 */}
      <div className="border-t border-slate-200 pt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-slate-900">
            목차 ({visibleEpisodes.length}화)
          </h2>
          {/* 🖋️ 작가 본인만 [+ 새 회차] 버튼 표시 */}
          {isAuthor && onCreateEpisode && (
            <button
              onClick={onCreateEpisode}
              className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded text-xs font-[1000] transition-colors"
            >
              + 새 회차
            </button>
          )}
        </div>

        {visibleEpisodes.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm font-bold italic">
            아직 등록된 회차가 없어요
          </div>
        ) : (
          <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
            {visibleEpisodes.map((ep) => (
              <EpisodeListItem
                key={ep.id}
                episode={ep}
                isUnlocked={unlockedSet.has(ep.id)}
                isAuthor={isAuthor}
                onClick={onSelectEpisode}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SeriesDetail;
