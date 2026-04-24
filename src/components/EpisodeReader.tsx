// src/components/EpisodeReader.tsx — 마르지 않는 잉크병: 본문 뷰어
// 🖋️ 에피소드 본문 표시 + 작가의 말 + 이전화/다음화 네비게이션 + 유료 회차 페이월
import { useState, useEffect, useMemo, useRef } from 'react';
import {
  doc, collection, query, where, orderBy, limit,
  onSnapshot, getDoc, getDocs, updateDoc, deleteDoc, increment,
  arrayUnion, arrayRemove,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import type { Post, Series, EpisodePrivateContent, UserData } from '../types';
import { formatCount } from '../utils/inkwell';
import { calculateLevel, formatKoreanNumber, getReputationLabel, getReputation } from '../utils';
import { sharePost } from '../utils/share';
import { handleReport } from '../utils/reportHandler';
import ReportStateBanner from './ReportStateBanner';
import PaywallOverlay from './PaywallOverlay';
import EpisodeCommentBoard from './EpisodeCommentBoard';
import EpisodeCommentForm from './EpisodeCommentForm';
import ThanksballModal from './ThanksballModal';

interface EpisodeReaderProps {
  postId: string;
  currentUserUid: string | null;
  currentUserNickname: string;
  onBack: () => void;
  onNavigateEpisode: (postId: string) => void;
  onEditEpisode?: () => void;
  onDeleteSuccess?: () => void;
  // 🖋️ 하단 "목차" 버튼 전용 — 항상 작품 SeriesDetail(목차)로 이동
  // 생략되면 onBack과 동일하게 동작 (하위 호환)
  onGoToSeries?: (seriesId: string) => void;
  // 🖋️ 점세개 메뉴 "공개프로필 보기" — 작가 닉네임 전달
  onAuthorClick?: (nickname: string) => void;
  // 🚀 작성자 카드용 데이터 (RootPostCard와 동일한 UX 재현)
  allUsers?: Record<string, UserData>;
  followerCounts?: Record<string, number>;
  friends?: string[];
  onToggleFriend?: (author: string) => void;
}

const EpisodeReader = ({ postId, currentUserUid, currentUserNickname, onBack, onNavigateEpisode, onEditEpisode, onDeleteSuccess, onGoToSeries, onAuthorClick, allUsers = {}, followerCounts = {}, friends = [], onToggleFriend }: EpisodeReaderProps) => {
  const [episode, setEpisode] = useState<Post | null>(null);
  const [series, setSeries] = useState<Series | null>(null);
  const [allEpisodes, setAllEpisodes] = useState<Post[]>([]);
  const [privateContent, setPrivateContent] = useState<EpisodePrivateContent | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 🖋️ Phase 4-C: 회차 댓글 실시간 구독
  const [comments, setComments] = useState<Post[]>([]);
  // 🖋️ Phase 4-D-1: 삭제 진행 중 상태 (작가 본인 액션)
  const [deleting, setDeleting] = useState(false);
  // 🖋️ Phase 5-A: 비공개 → 공개 복귀 진행 중 상태
  const [republishing, setRepublishing] = useState(false);
  // 🖋️ 공유 / 더보기 메뉴
  const [shareCopied, setShareCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  // 🖋️ Phase 4-E/4-G: 땡스볼 모달 타겟 (null이면 미표시)
  // type='post'면 본문 자체, type='comment'면 댓글 — targetId/recipientNickname은 공통
  const [thanksballTarget, setThanksballTarget] = useState<{
    type: 'post' | 'comment';
    targetId: string;
    recipientNickname: string;
  } | null>(null);

  // 🚀 postId 변경 시 모든 상태 초기화 (이전화/다음화 네비게이션 시)
  useEffect(() => {
    setEpisode(null);
    setPrivateContent(null);
    setIsUnlocked(false);
    setLoading(true);
    setError(null);
    // 스크롤 맨 위로
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [postId]);

  // 🔒 1. 에피소드 메타 실시간 구독
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'posts', postId),
      (snap) => {
        if (snap.exists()) {
          setEpisode({ id: snap.id, ...snap.data() } as Post);
        } else {
          setEpisode(null);
          setError('에피소드를 찾을 수 없습니다.');
          setLoading(false);
        }
      },
      (err) => {
        console.error('[EpisodeReader] 에피소드 조회 실패:', err);
        setError('에피소드를 불러올 수 없습니다.');
        setLoading(false);
      }
    );
    return () => unsub();
  }, [postId]);

  // 🔒 2. 작품 메타 + 형제 회차 구독 (이전화/다음화 계산용)
  useEffect(() => {
    if (!episode?.seriesId) return;

    const seriesUnsub = onSnapshot(doc(db, 'series', episode.seriesId), (snap) => {
      if (snap.exists()) {
        setSeries({ id: snap.id, ...snap.data() } as Series);
      }
    });

    const q = query(
      collection(db, 'posts'),
      where('category', '==', 'magic_inkwell'),
      where('seriesId', '==', episode.seriesId),
      orderBy('episodeNumber', 'asc')
    );
    const epUnsub = onSnapshot(q, (snap) => {
      setAllEpisodes(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Post)));
    });

    return () => {
      seriesUnsub();
      epUnsub();
    };
  }, [episode?.seriesId]);

  // 🔒 3. 구매 여부 확인 + private_data 로드
  useEffect(() => {
    if (!episode) return;

    const isAuthor = !!(currentUserUid && episode.author_id === currentUserUid);
    const price = episode.price || 0;
    const needsPayment = episode.isPaid === true && price > 0 && !isAuthor;

    // 무료 회차 또는 작가 본인 → 바로 본문 표시
    if (!needsPayment) {
      setIsUnlocked(true);
      setPrivateContent(null);
      setLoading(false);
      return;
    }

    // 유료 회차 + 비로그인 → 페이월
    if (!currentUserUid) {
      setIsUnlocked(false);
      setLoading(false);
      return;
    }

    // 유료 회차 + 로그인 → 구매 영수증 확인
    const unlockedRef = doc(db, 'unlocked_episodes', `${episode.id}_${currentUserUid}`);
    getDoc(unlockedRef)
      .then(async (unlockSnap) => {
        if (unlockSnap.exists()) {
          // 구매 완료 → private_data 로드
          try {
            const privateRef = doc(db, 'posts', episode.id, 'private_data', 'content');
            const privateSnap = await getDoc(privateRef);
            if (privateSnap.exists()) {
              setPrivateContent(privateSnap.data() as EpisodePrivateContent);
            }
            setIsUnlocked(true);
          } catch (err) {
            console.error('[EpisodeReader] private_data 로드 실패:', err);
            setError('본문을 불러올 수 없습니다.');
          }
        } else {
          setIsUnlocked(false);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('[EpisodeReader] 구매 내역 조회 실패:', err);
        setLoading(false);
      });
  }, [episode, currentUserUid]);

  // 🚀 4. viewCount 증가 (자기 글 제외, 세션 중복 방지) — 기존 useFirestoreActions 패턴 따름
  useEffect(() => {
    if (!episode || !currentUserUid) return;
    if (episode.author_id === currentUserUid) return; // 자기 글 제외

    const sessionKey = `viewed_${episode.id}`;
    if (sessionStorage.getItem(sessionKey)) return;
    sessionStorage.setItem(sessionKey, '1');

    updateDoc(doc(db, 'posts', episode.id), { viewCount: increment(1) }).catch(() => {});

    if (episode.seriesId) {
      updateDoc(doc(db, 'series', episode.seriesId), { totalViews: increment(1) }).catch(() => {});
    }
  }, [episode?.id, currentUserUid]);

  // 🖋️ Phase 4-C: 회차 댓글 실시간 구독 (rootId === episode.id)
  // 단일 필드 where + 단일 필드 orderBy → 자동 인덱스 사용 (별도 복합 인덱스 불필요)
  useEffect(() => {
    if (!episode?.id) {
      setComments([]);
      return;
    }
    const q = query(
      collection(db, 'comments'),
      where('rootId', '==', episode.id),
      orderBy('createdAt', 'asc')
    );
    const unsub = onSnapshot(
      q,
      (snap) => setComments(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Post))),
      (err) => console.error('[EpisodeReader] 댓글 구독 실패:', err)
    );
    return () => unsub();
  }, [episode?.id]);

  // 🚀 5. 결제 처리 — Phase 2의 unlockEpisode Cloud Function 호출
  const handleUnlock = async () => {
    if (!episode || !currentUserUid || unlocking) return;

    setUnlocking(true);
    try {
      const unlockEpisode = httpsCallable(functions, 'unlockEpisode');
      const result = await unlockEpisode({
        postId: episode.id,
        seriesId: episode.seriesId,
      });

      console.log('[EpisodeReader] 결제 성공:', result.data);

      // 결제 성공 → private_data 로드
      const privateRef = doc(db, 'posts', episode.id, 'private_data', 'content');
      const privateSnap = await getDoc(privateRef);
      if (privateSnap.exists()) {
        setPrivateContent(privateSnap.data() as EpisodePrivateContent);
      }
      setIsUnlocked(true);
    } catch (err: unknown) {
      console.error('[EpisodeReader] 결제 실패:', err);
      const fnErr = err as { code?: string; message?: string };
      if (fnErr.code === 'functions/failed-precondition') {
        alert(fnErr.message || '땡스볼이 부족합니다.');
      } else if (fnErr.code === 'functions/unauthenticated') {
        alert('로그인이 필요합니다.');
      } else {
        alert('결제 중 오류가 발생했습니다. 다시 시도해주세요.');
      }
    } finally {
      setUnlocking(false);
    }
  };

  // 🖋️ Phase 4-D-1: 작가 본인 판별
  const isAuthor = !!(episode && currentUserUid && episode.author_id === currentUserUid);

  // 🖋️ 드롭다운 메뉴 외부 클릭 감지
  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  // 🖋️ 공유 — 공용 헬퍼 sharePost() 사용
  const handleShare = async () => {
    if (!episode) return;
    const title = `${series?.title ? `${series.title} · ` : ''}${episode.episodeNumber}화 ${episode.episodeTitle || episode.title || ''}`.trim();
    const result = await sharePost({
      postId: episode.id,
      authorId: episode.author_id,
      title,
      text: `${episode.author}님의 작품 | 마르지 않는 잉크병`,
    });
    if (result.status === 'copied') {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    }
  };

  // 🖋️ Phase 5-A: 비공개 회차 → 공개 복귀 (isHidden: false)
  const handleRepublishEpisode = async () => {
    if (!episode || !isAuthor || republishing) return;
    const confirmed = window.confirm(
      '이 회차를 다시 공개하시겠습니까?\n\n' +
      '- 작품 목차에 다시 표시됩니다\n' +
      '- 일반 독자도 회차에 접근할 수 있게 됩니다'
    );
    if (!confirmed) return;

    setRepublishing(true);
    try {
      await updateDoc(doc(db, 'posts', episode.id), { isHidden: false });
      alert('회차가 다시 공개되었습니다.');
    } catch (err: unknown) {
      console.error('[EpisodeReader] 공개 복귀 실패:', err);
      const msg = err instanceof Error ? err.message : '공개 복귀 중 오류가 발생했습니다.';
      alert(msg);
    } finally {
      setRepublishing(false);
    }
  };

  // 🖋️ Phase 4-G: 회차 본문 좋아요 토글 (Phase 4-E 댓글 좋아요 패턴 차용)
  // - likedBy는 닉네임 배열, posts.likes Math.max(0, ±1)
  // - 작가 평판 users.likes ±3, series.totalLikes ±1
  const handleEpisodeLike = async () => {
    if (!currentUserUid || !currentUserNickname) {
      alert('로그인이 필요합니다.');
      return;
    }
    if (!episode) return;
    if (episode.author_id === currentUserUid) {
      alert('자신의 회차에는 좋아요를 누를 수 없습니다.');
      return;
    }

    const likedBy = episode.likedBy || [];
    const isLiked = likedBy.includes(currentUserNickname);
    const diff = isLiked ? -1 : 1;

    try {
      // 1. 회차 좋아요 토글
      await updateDoc(doc(db, 'posts', episode.id), {
        likes: Math.max(0, (episode.likes || 0) + diff),
        likedBy: isLiked ? arrayRemove(currentUserNickname) : arrayUnion(currentUserNickname),
      });

      // 🛡️ Anti-Abuse Commit 5b: 좋아요 취소(diff=-1) 시 타인 users.likes 업데이트 스킵
      // Why: Rules §4.2.2가 타인 users.likes 감소 차단
      //      posts의 likedBy/likes는 정상 동작 (UX 영향 없음)
      if (diff === 1 && episode.author_id) {
        await updateDoc(doc(db, 'users', episode.author_id), { likes: increment(3) });
      }

      // 3. series.totalLikes 동기화 (Rules 화이트리스트 포함됨)
      if (episode.seriesId) {
        await updateDoc(doc(db, 'series', episode.seriesId), {
          totalLikes: increment(diff),
        });
      }
    } catch (err: unknown) {
      console.error('[EpisodeReader] 본문 좋아요 실패:', err);
      const msg = err instanceof Error ? err.message : '좋아요 처리 중 오류가 발생했습니다.';
      alert(msg);
    }
  };

  // 🖋️ Phase 4-G: 회차 본문 땡스볼 (모달 열기)
  const handleEpisodeThanksball = () => {
    if (!currentUserUid) {
      alert('로그인이 필요합니다.');
      return;
    }
    if (!episode) return;
    if (episode.author_id === currentUserUid) {
      alert('자신의 회차에는 땡스볼을 보낼 수 없습니다.');
      return;
    }
    setThanksballTarget({
      type: 'post',
      targetId: episode.id,
      recipientNickname: episode.author || '익명',
    });
  };

  // 🖋️ Phase 4-D-1: 회차 삭제 (구매자 있으면 비공개 전환으로 폴백)
  const handleDelete = async () => {
    if (!episode || !isAuthor || deleting) return;
    setDeleting(true);

    try {
      // 1. 구매자 1명이라도 있는지 확인 — Rules는 작가 본인 영수증만 read 허용하므로
      //    authorId 필터 추가 필수 (이 핸들러는 isAuthor 가드로 보호되어 currentUserUid === authorId)
      const unlockedQ = query(
        collection(db, 'unlocked_episodes'),
        where('postId', '==', episode.id),
        where('authorId', '==', currentUserUid),
        limit(1)
      );
      const unlockedSnap = await getDocs(unlockedQ);

      if (!unlockedSnap.empty) {
        // 구매자 있음 → 비공개 전환 제안
        const confirmed = window.confirm(
          '⚠️ 이 회차를 구매한 독자가 있어 삭제할 수 없습니다.\n\n' +
          '대신 "비공개 전환"하시겠습니까?\n' +
          '- 일반 독자의 목차에서 숨겨집니다\n' +
          '- 작가 본인은 계속 볼 수 있습니다\n' +
          '- 이미 구매한 독자는 계속 읽을 수 있습니다'
        );
        if (!confirmed) { setDeleting(false); return; }

        await updateDoc(doc(db, 'posts', episode.id), { isHidden: true });
        alert('회차가 비공개로 전환되었습니다.');
        onDeleteSuccess?.();
        return;
      }

      // 2. 구매자 없음 → 영구 삭제 확인
      const confirmed = window.confirm(
        '정말 이 회차를 삭제하시겠습니까?\n' +
        '이 작업은 되돌릴 수 없습니다.\n\n' +
        '- 회차 본문\n' +
        '- 회차에 달린 모든 댓글\n' +
        '- private_data (유료 회차의 경우)\n\n' +
        '위 데이터가 모두 영구 삭제됩니다.'
      );
      if (!confirmed) { setDeleting(false); return; }

      // 3. private_data 삭제 (유료 회차)
      if (episode.isPaid) {
        try {
          await deleteDoc(doc(db, 'posts', episode.id, 'private_data', 'content'));
        } catch (err) {
          console.warn('[EpisodeReader] private_data 삭제 실패 (무시):', err);
        }
      }

      // 4. 댓글 cascade 삭제 (rootId === episode.id)
      const commentsQ = query(collection(db, 'comments'), where('rootId', '==', episode.id));
      const commentsSnap = await getDocs(commentsQ);
      await Promise.all(commentsSnap.docs.map((d) => deleteDoc(d.ref)));

      // 5. posts 문서 삭제
      await deleteDoc(doc(db, 'posts', episode.id));

      // 6. series.totalEpisodes -1 (onEpisodeDelete 트리거 없음 → 수동 처리)
      if (episode.seriesId) {
        await updateDoc(doc(db, 'series', episode.seriesId), {
          totalEpisodes: increment(-1),
        });
      }

      alert('회차가 삭제되었습니다.');
      onDeleteSuccess?.();
    } catch (err: unknown) {
      console.error('[EpisodeReader] 삭제 실패:', err);
      const msg = err instanceof Error ? err.message : '삭제 중 오류가 발생했습니다.';
      alert(msg);
      setDeleting(false);
    }
  };

  // 이전화 / 다음화 계산
  const { prevEpisode, nextEpisode } = useMemo(() => {
    if (!episode || allEpisodes.length === 0) {
      return { prevEpisode: null as Post | null, nextEpisode: null as Post | null };
    }
    const idx = allEpisodes.findIndex((e) => e.id === episode.id);
    return {
      prevEpisode: idx > 0 ? allEpisodes[idx - 1] : null,
      nextEpisode: idx >= 0 && idx < allEpisodes.length - 1 ? allEpisodes[idx + 1] : null,
    };
  }, [episode, allEpisodes]);

  // 에러 / 로딩 / 본문 분기
  if (loading && !episode) {
    return <div className="py-20 text-center text-slate-400 font-bold text-sm italic">불러오는 중...</div>;
  }

  if (error || !episode) {
    return (
      <div className="py-20 text-center max-w-md mx-auto px-4">
        <div className="text-5xl mb-4">🕊️</div>
        <h2 className="text-lg font-bold text-slate-700 mb-2">회차를 찾을 수 없습니다</h2>
        <p className="text-sm text-slate-500 font-bold mb-6">
          {error || '이 회차는 작가에 의해 삭제되었거나, 링크가 만료되었을 수 있습니다.'}
        </p>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-[1000] transition-colors"
        >
          ← 목차로 돌아가기
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-[800px] mx-auto px-4 py-6">
      {/* 상단 네비게이션 — 되돌아가기 + 작품명 + 공유 / 더보기 */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200">
        <button
          onClick={onBack}
          className="text-[12px] text-slate-500 hover:text-slate-900 font-bold transition-colors"
        >
          ← 되돌아가기
        </button>
        <div className="flex items-center gap-1 min-w-0">
          {series && (
            <span className="text-[11px] text-slate-500 truncate max-w-[180px] font-bold mr-1">
              {series.title}
            </span>
          )}
          {/* 🖋️ 2026-04-24 작가 전용 수정/삭제 텍스트 버튼 — RootPostCard 우측 액션바 패턴 통일 */}
          {/* Why: ⋮ 안 숨김 제거, 다른 메뉴(황금알·너와 나의 이야기 등) 상세뷰와 톤 일치 */}
          {isAuthor && (
            <>
              {onEditEpisode && (
                <button
                  onClick={onEditEpisode}
                  disabled={deleting || republishing}
                  className="text-[11px] font-bold text-slate-400 hover:text-blue-500 disabled:opacity-50 transition-colors"
                  title="회차 수정"
                >
                  수정
                </button>
              )}
              <button
                onClick={handleDelete}
                disabled={deleting || republishing}
                className="text-[11px] font-bold text-slate-400 hover:text-rose-500 disabled:opacity-50 transition-colors"
                title="회차 삭제"
              >
                {deleting ? '삭제중...' : '삭제'}
              </button>
            </>
          )}
          {/* 🖋️ 공유 아이콘 버튼 — Web Share API + fallback 클립보드 */}
          <button
            onClick={handleShare}
            className={`w-7 h-7 flex items-center justify-center rounded-full transition-colors ${shareCopied ? 'text-emerald-500 bg-emerald-50' : 'text-slate-500 hover:bg-slate-100 hover:text-blue-500'}`}
            title="공유"
          >
            {shareCopied ? (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"/></svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
            )}
          </button>
          {/* 🖋️ 더보기(⋮) 드롭다운 — 공개프로필 / 신고 + 작가 본인 액션 */}
          <div className="relative flex-shrink-0" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              disabled={deleting || republishing}
              className="w-7 h-7 flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 transition-colors"
              title="더보기"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="5" r="1.5" />
                <circle cx="12" cy="12" r="1.5" />
                <circle cx="12" cy="19" r="1.5" />
              </svg>
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-8 z-40 w-36 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden whitespace-nowrap flex flex-col">
                {/* 누구나 — 공개프로필 / 신고 */}
                {onAuthorClick && (
                  <button
                    onClick={() => { setMenuOpen(false); onAuthorClick(episode.author); }}
                    className="w-full text-left px-3 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    👤 공개프로필 보기
                  </button>
                )}
                <button
                  onClick={() => { setMenuOpen(false); handleReport('episode', episode.id); }}
                  className="w-full text-left px-3 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition-colors border-t border-slate-100"
                >
                  🚨 신고하기
                </button>
                {/* 🖋️ 2026-04-24 수정/삭제는 외부 상단 버튼으로 이동. 다시공개는 비공개 회차 전용이라 여기만 유지 */}
                {isAuthor && episode.isHidden && (
                  <button
                    onClick={() => { setMenuOpen(false); handleRepublishEpisode(); }}
                    className="w-full text-left px-3 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition-colors border-t border-slate-100"
                  >
                    👁 다시 공개
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 🖋️ Phase 4-D-1 + 5-A: 비공개 회차 안내 + 다시 공개 버튼 — 차분 회색 톤 */}
      {isAuthor && episode.isHidden && (
        <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-lg">
          <p className="text-[11px] text-slate-600 font-bold mb-2">
            🙈 이 회차는 비공개 상태입니다. 일반 독자에게는 목차에서 숨겨지지만, 이미 구매한 독자는 계속 읽을 수 있습니다.
          </p>
          <button
            onClick={handleRepublishEpisode}
            disabled={republishing}
            className="px-3 py-1 bg-slate-200 hover:bg-slate-300 disabled:opacity-50 text-slate-700 rounded text-[11px] font-[1000] transition-colors"
          >
            {republishing ? '처리 중...' : '👁 다시 공개하기'}
          </button>
        </div>
      )}

      {/* 🚨 2026-04-24 신고 상태 배너 + 작성자 이의제기 */}
      <ReportStateBanner
        reportState={episode.reportState}
        reportCount={episode.reportCount}
        dominantReason={episode.dominantReason}
        targetType="episode"
        targetId={episode.id}
        isAuthor={isAuthor}
        appealStatus={episode.appealStatus}
      />

      {/* 회차 헤더 */}
      <div className="mb-5">
        <div className="text-[10px] text-slate-500 mb-1 font-bold">제 {episode.episodeNumber}화</div>
        <h1 className="text-[16px] font-[1000] text-slate-900 mb-2 break-words tracking-tight">
          {episode.episodeTitle || episode.title}
        </h1>
        <div className="flex items-center gap-3 text-[11px] text-slate-500 font-bold">
          <span>{episode.author}</span>
          <span>👁 {formatCount(episode.viewCount || 0)}</span>
          <span>❤️ {formatCount(episode.likes || 0)}</span>
        </div>
      </div>

      {/* 본문 영역 */}
      {loading ? (
        <div className="py-20 text-center text-slate-400 font-bold text-sm italic">
          불러오는 중...
        </div>
      ) : isUnlocked ? (
        <>
          <article
            className="max-w-none mb-8 text-[15px] leading-[1.8] font-medium text-slate-700 [&_p]:mb-4 [&_p:last-child]:mb-0 [&_img]:rounded-lg [&_img]:my-4 [&_strong]:font-bold [&_em]:italic [&_a]:text-blue-500 [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-slate-200 [&_blockquote]:pl-4 [&_blockquote]:text-slate-500 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-4 [&_li]:mb-1 [&_h1]:text-[18px] [&_h1]:font-black [&_h2]:text-[16px] [&_h2]:font-black [&_h3]:text-[15px] [&_h3]:font-black"
            dangerouslySetInnerHTML={{
              __html: privateContent?.body || episode.content || '',
            }}
          />

          {/* 작가의 말 — 차분한 회색 톤 */}
          {episode.authorNote && (
            <div className="mb-6 p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="text-[11px] font-[1000] text-slate-600 mb-1">📝 작가의 말</div>
              <p className="text-[15px] leading-[1.8] text-slate-600 whitespace-pre-wrap">{episode.authorNote}</p>
            </div>
          )}

          {/* 🖋️ 작성자 카드 + 인터랙션 바 — RootPostCard 하단 동일 패턴 */}
          {(() => {
            const authorData = (episode.author_id && allUsers[episode.author_id]) || allUsers[`nickname_${episode.author}`];
            const displayLevel = calculateLevel(authorData?.exp || 0);
            const repScore = authorData ? getReputation(authorData) : 0;
            const realFollowers = followerCounts[episode.author || ''] || 0;
            const isLiked = !!(currentUserNickname && episode.likedBy?.includes(currentUserNickname));
            // 🚀 골드스타: Lv5+ 유저가 좋아요한 수 (RootPostCard 동일 로직)
            const goldStarCount = (episode.likedBy || []).filter(nick => {
              const ud = allUsers[`nickname_${nick}`];
              return ud && calculateLevel(ud.exp || 0) >= 5;
            }).length;
            const isFriend = !!episode.author && friends.includes(episode.author);
            return (
              <div className="flex flex-col md:flex-row items-center justify-between gap-2 p-2 border border-slate-100 rounded-2xl bg-slate-50/30 my-6">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => episode.author && onAuthorClick?.(episode.author)}
                    className="w-12 h-12 rounded-xl bg-slate-100 overflow-hidden border border-slate-200 shrink-0 hover:ring-2 hover:ring-violet-300 transition-all"
                    title="공개프로필 보기"
                  >
                    <img src={authorData?.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${episode.author}`} alt="avatar" className="w-full h-full object-cover" />
                  </button>
                  <div className="flex flex-col">
                    <button
                      onClick={() => episode.author && onAuthorClick?.(episode.author)}
                      className="font-[1000] text-[15px] text-slate-900 mb-0.5 text-left hover:text-violet-600 transition-colors"
                    >
                      {episode.author}
                    </button>
                    <span className="text-[11px] text-slate-500 font-bold">
                      Lv {displayLevel} · {getReputationLabel(repScore)} · 깐부수 {formatKoreanNumber(realFollowers)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto">
                  {goldStarCount > 0 && (
                    <div className="flex items-center gap-0.5 px-2 py-1.5 rounded-xl bg-amber-50 border border-amber-200 shrink-0">
                      <svg className="w-3.5 h-3.5 text-amber-400 fill-current" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                      <span className="text-[11px] font-[1000] text-amber-500">{goldStarCount}</span>
                    </div>
                  )}
                  <button
                    onClick={handleEpisodeLike}
                    disabled={isAuthor}
                    className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl transition-all duration-300 font-[1000] text-[12px] whitespace-nowrap ${
                      isAuthor
                        ? 'bg-white text-slate-300 border border-slate-200 cursor-not-allowed'
                        : isLiked
                          ? 'bg-[#FF2E56] text-white ring-2 ring-rose-300 scale-105'
                          : 'bg-white text-rose-400 border border-rose-200 hover:bg-rose-50'
                    }`}
                  >
                    <svg className="w-3.5 h-3.5 fill-current shrink-0" viewBox="0 0 24 24" stroke="none"><path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" /></svg>
                    {formatKoreanNumber(episode.likes || 0)}
                  </button>
                  <button
                    onClick={handleEpisodeThanksball}
                    disabled={isAuthor || !currentUserNickname}
                    title={isAuthor ? '본인 회차에는 땡스볼을 보낼 수 없습니다' : (currentUserNickname ? '땡스볼 보내기' : '로그인 후 이용하세요')}
                    className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-[12px] font-[1000] whitespace-nowrap transition-all ${
                      isAuthor || !currentUserNickname
                        ? 'bg-white text-slate-300 border-slate-200 cursor-default'
                        : 'bg-white text-amber-500 border-amber-200 hover:bg-amber-50 cursor-pointer'
                    }`}
                  >
                    <span className="text-[14px] leading-none">⚾</span>
                    <span>{(episode.thanksballTotal || 0) > 0 ? `${episode.thanksballTotal}볼` : '땡스볼'}</span>
                  </button>
                  {isAuthor ? (
                    <div className="flex-1 md:flex-none px-3 py-2 text-[12px] font-[1000] rounded-xl border bg-white text-slate-300 border-slate-200 cursor-default whitespace-nowrap text-center">
                      + 깐부맺기
                    </div>
                  ) : (
                    <button
                      onClick={() => episode.author && onToggleFriend?.(episode.author)}
                      disabled={!onToggleFriend || !currentUserNickname}
                      className={`flex-1 md:flex-none px-3 py-2 text-[12px] font-[1000] rounded-xl border transition-all whitespace-nowrap ${
                        isFriend
                          ? 'bg-white text-slate-400 border-slate-200'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      } ${(!onToggleFriend || !currentUserNickname) ? 'opacity-40 cursor-not-allowed' : ''}`}
                    >
                      {isFriend ? '깐부해제' : '+ 깐부맺기'}
                    </button>
                  )}
                </div>
              </div>
            );
          })()}

          {/* 하단 통계 바 — 댓글수 / 땡스볼총합 (RootPostCard 동일 패턴) */}
          <div className="flex items-center justify-between text-[13px] font-bold text-slate-500 bg-white border-t border-b border-slate-100 px-6 py-2 mb-6">
            <span>댓글 <span className="font-black text-slate-700">{formatKoreanNumber(episode.commentCount || 0)}</span></span>
            <span>땡스볼 <span className="font-black text-slate-700">{formatKoreanNumber(episode.thanksballTotal || 0)}</span></span>
          </div>
        </>
      ) : (
        <PaywallOverlay
          episode={episode}
          onUnlock={handleUnlock}
          unlocking={unlocking}
          currentUserUid={currentUserUid}
        />
      )}

      {/* 🖋️ Phase 4-C: 댓글 영역 — 잠금 해제된 회차에만 표시 (미구매자에게는 본문 정보 유출 차단) */}
      {isUnlocked && (
        <div className="mt-8 pt-5 border-t-2 border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[13px] font-[1000] text-slate-700">
              💬 댓글 {comments.length > 0 && `(${comments.length})`}
            </h2>
          </div>

          {/* 작성 폼 */}
          <div className="mb-4">
            <EpisodeCommentForm
              episodeId={episode.id}
              currentUserUid={currentUserUid}
              currentUserNickname={currentUserNickname}
            />
          </div>

          {/* 목록 */}
          <EpisodeCommentBoard
            episodeId={episode.id}
            authorId={episode.author_id || ''}
            comments={comments}
            currentUserUid={currentUserUid}
            currentUserNickname={currentUserNickname}
            onThanksballClick={(comment) => {
              if (!currentUserUid) { alert('로그인이 필요합니다.'); return; }
              if (comment.author_id === currentUserUid) {
                alert('자신의 댓글에는 땡스볼을 보낼 수 없습니다.');
                return;
              }
              setThanksballTarget({
                type: 'comment',
                targetId: comment.id,
                recipientNickname: comment.author || '익명',
              });
            }}
          />
        </div>
      )}

      {/* 하단 네비게이션 — 잠금 해제된 상태에서만 표시 */}
      {isUnlocked && (
        <div className="flex items-center justify-between gap-2 mt-6 pt-4 border-t border-slate-200">
          <button
            onClick={() => prevEpisode && onNavigateEpisode(prevEpisode.id)}
            disabled={!prevEpisode}
            className="flex-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 rounded-lg text-[12px] font-[1000] transition-colors"
          >
            ← 이전 화
          </button>
          <button
            onClick={() => {
              // 🖋️ 하단 "목차" 버튼은 항상 작품 SeriesDetail로 이동 (onBack과 구분)
              if (episode?.seriesId && onGoToSeries) {
                onGoToSeries(episode.seriesId);
              } else {
                onBack();
              }
            }}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[12px] font-[1000] transition-colors"
          >
            목차
          </button>
          <button
            onClick={() => nextEpisode && onNavigateEpisode(nextEpisode.id)}
            disabled={!nextEpisode}
            className="flex-1 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-[12px] font-[1000] transition-colors"
          >
            다음 화 →
          </button>
        </div>
      )}

      {/* 🖋️ Phase 4-E/4-G: 땡스볼 모달 (본문/댓글 공용) — type에 따라 targetCollection 분기 */}
      {thanksballTarget && episode && (
        <ThanksballModal
          postId={episode.id}
          postAuthor={episode.author || ''}
          postTitle={episode.episodeTitle || episode.title}
          recipientNickname={thanksballTarget.recipientNickname}
          targetDocId={thanksballTarget.targetId}
          targetCollection={thanksballTarget.type === 'comment' ? 'comments' : 'posts'}
          currentNickname={currentUserNickname}
          onClose={() => setThanksballTarget(null)}
        />
      )}
    </div>
  );
};

export default EpisodeReader;
