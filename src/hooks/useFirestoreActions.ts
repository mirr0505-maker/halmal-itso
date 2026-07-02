// src/hooks/useFirestoreActions.ts — 게시글·댓글·좋아요·깐부·차단 Firestore 핸들러
import { db } from '../firebase';
import {
  doc, setDoc, updateDoc, increment, writeBatch,
  arrayUnion, arrayRemove, serverTimestamp,
} from 'firebase/firestore';
import { useCallback } from 'react';
import type { Dispatch, SetStateAction, FormEvent } from 'react';
import type { Post, UserData } from '../types';
import { EXILE_CATEGORY } from '../types';
import type { MenuId } from '../components/Sidebar';
import { anonymizeExileNickname, buildExpLevelUpdate, calculateExpForPost } from '../utils';

// 🚀 Rate Limit 쿨다운 (클라이언트 사이드)
const RATE_LIMIT = {
  POST_COOLDOWN_MS: 60_000,
  COMMENT_COOLDOWN_MS: 15_000,
};
let lastPostTime = 0;
let lastCommentTime = 0;

// ⚡ 성능 2026-07-02: 상세 진입 조회수·EXP 쓰기를 클릭 임계경로에서 분리해 idle 타이밍에 커밋할 때 쓰는 상수
const VIEW_WRITE_IDLE_TIMEOUT_MS = 2_000; // requestIdleCallback이 마냥 미뤄지지 않도록 강제 실행 상한
const VIEW_WRITE_FALLBACK_DELAY_MS = 200;  // requestIdleCallback 미지원 브라우저(setTimeout 폴백) 지연

interface FirestoreActionDeps {
  userData: UserData | null;
  friends: string[];
  blocks: string[];
  allRootPosts: Post[];
  allChildPosts: Post[];
  selectedTopic: Post | null;
  // 게시글 폼 상태
  replyTarget: Post | null;
  setReplyTarget: Dispatch<SetStateAction<Post | null>>;
  newTitle: string;
  newContent: string;
  setNewTitle: Dispatch<SetStateAction<string>>;
  setNewContent: Dispatch<SetStateAction<string>>;
  selectedSide: 'left' | 'right';
  selectedType: 'comment' | 'formal';
  setIsSubmitting: Dispatch<SetStateAction<boolean>>;
  // 라우팅 상태
  setAllRootPosts: Dispatch<SetStateAction<Post[]>>;
  setSelectedTopic: Dispatch<SetStateAction<Post | null>>;
  setIsCreateOpen: Dispatch<SetStateAction<boolean>>;
  setEditingPost: Dispatch<SetStateAction<Post | null>>;
  setCreateMenuKey: Dispatch<SetStateAction<string | null>>;
  setActiveMenu: Dispatch<SetStateAction<MenuId>>;
  setActiveTab: Dispatch<SetStateAction<'any' | 'recent' | 'best' | 'rank' | 'friend' | 'subscribed'>>;
  setLinkedPostSide: Dispatch<SetStateAction<'left' | 'right' | null>>;
}

export function useFirestoreActions({
  userData, friends, blocks,
  allRootPosts, allChildPosts, selectedTopic,
  replyTarget, setReplyTarget,
  newTitle, newContent, setNewTitle, setNewContent,
  selectedSide, selectedType, setIsSubmitting,
  setAllRootPosts, setSelectedTopic,
  setIsCreateOpen, setEditingPost, setCreateMenuKey,
  setActiveMenu, setActiveTab, setLinkedPostSide,
}: FirestoreActionDeps) {

  // 게시글 제출/수정 — postId가 있으면 수정, 없으면 신규
  // ⚡ 성능 2026-07-02: useCallback 래핑 — 매 render마다 새 함수 identity 생성을 막아 하위 카드 React.memo 유지
  const handlePostSubmit = useCallback(async (postData: Partial<Post>, postId?: string) => {
    if (!userData) return;
    // 🚀 Rate Limit: 신규 글 작성 60초 쿨다운
    if (!postId && Date.now() - lastPostTime < RATE_LIMIT.POST_COOLDOWN_MS) {
      alert('글 작성은 1분에 1개만 가능합니다.'); return;
    }
    try {
      if (postId) {
        await updateDoc(doc(db, 'posts', postId), postData);
        // onSnapshot 지연 대비: allRootPosts와 selectedTopic 즉시 갱신
        setAllRootPosts(prev => prev.map(p => p.id === postId ? { ...p, ...postData } : p));
        setSelectedTopic(prev => prev && prev.id === postId ? { ...prev, ...postData } : prev);
      } else {
        const customId = `topic_${Date.now()}_${userData.uid}`;
        const shareToken = customId.split('_').slice(0, 2).join('_'); // "topic_타임스탬프" — ogRenderer 조회용
        // 🚀 contentTextLength: 서버사이드 글자수 검증용 (Firestore Rules에서 신포도와 여우 100자 제한 검증)
        const contentPlainText = (postData.content || '').replace(/<[^>]*>/g, '').replace(/\s/g, '');
        // 🏚️ 유배·귀양지 글은 닉네임 자동 익명화 (STOREHOUSE.md §11.4)
        const displayAuthor = postData.category === EXILE_CATEGORY
          ? anonymizeExileNickname(userData.uid)
          : userData.nickname;
        await setDoc(doc(db, 'posts', customId), {
          ...postData, author: displayAuthor, author_id: userData.uid,
          authorInfo: { level: userData.level, friendCount: friends.length, totalLikes: userData.likes },
          parentId: null, rootId: null, side: 'left', type: 'formal',
          createdAt: serverTimestamp(), likes: 0, dislikes: 0, shareToken,
          contentTextLength: contentPlainText.length,
        });
        // 🚀 EXP: 새글 작성 — LEVEL_V2 §3.2.1 품질 가중치 (길이·이미지·링크) + level 동시 쓰기 (옵션 B)
        const postExp = calculateExpForPost(postData.content || '', {
          hasImage: !!(postData.imageUrl || (postData.imageUrls && postData.imageUrls.length > 0)),
          hasLink: !!postData.linkUrl || /https?:\/\//.test(postData.content || ''),
        });
        if (postExp > 0) {
          await updateDoc(doc(db, 'users', userData.uid), buildExpLevelUpdate(userData.exp, postExp));
        }
        lastPostTime = Date.now();
      }
      setIsCreateOpen(false);
      setEditingPost(null);
      setCreateMenuKey(null);
      setActiveMenu('home');
      setActiveTab('any'); // 🚀 글 작성 완료 후 새글 탭으로 이동
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e: unknown) {
      alert(`저장 실패: ${(e as Error)?.message || '알 수 없는 오류'}`);
    }
  }, [userData, friends, setAllRootPosts, setSelectedTopic, setIsCreateOpen, setEditingPost, setCreateMenuKey, setActiveMenu, setActiveTab]);

  // 🚀 솔로몬의 재판 연계글 제출: 새 글 생성 후 현재 솔로몬 글로 돌아옴 (홈으로 이동 안 함)
  // ⚡ 성능 2026-07-02: useCallback 래핑 — 함수 identity 안정화(props로 내려가는 콜백 재생성 차단)
  const handleLinkedPostSubmit = useCallback(async (postData: Partial<Post>) => {
    if (!userData) return;
    try {
      const customId = `topic_${Date.now()}_${userData.uid}`;
      const shareToken = customId.split('_').slice(0, 2).join('_'); // "topic_타임스탬프" — ogRenderer 조회용
      // 🚀 contentTextLength: 서버사이드 글자수 검증용
      const contentPlainText = (postData.content || '').replace(/<[^>]*>/g, '').replace(/\s/g, '');
      await setDoc(doc(db, 'posts', customId), {
        ...postData, author: userData.nickname, author_id: userData.uid,
        authorInfo: { level: userData.level, friendCount: friends.length, totalLikes: userData.likes },
        parentId: null, rootId: null, side: 'left', type: 'formal',
        createdAt: serverTimestamp(), likes: 0, dislikes: 0, shareToken,
        contentTextLength: contentPlainText.length,
      });
      // 🚀 EXP: 연계글 작성 — LEVEL_V2 §3.2.1 품질 가중치 + level 동시 쓰기 (옵션 B)
      const linkedPostExp = calculateExpForPost(postData.content || '', {
        hasImage: !!(postData.imageUrl || (postData.imageUrls && postData.imageUrls.length > 0)),
        hasLink: !!postData.linkUrl || /https?:\/\//.test(postData.content || ''),
      });
      if (linkedPostExp > 0) {
        await updateDoc(doc(db, 'users', userData.uid), buildExpLevelUpdate(userData.exp, linkedPostExp));
      }
      setIsCreateOpen(false);
      setLinkedPostSide(null);
      // selectedTopic 유지 → 솔로몬의 재판 원글로 돌아감
    } catch (e: unknown) {
      alert(`연계글 저장 실패: ${(e as Error)?.message || '알 수 없는 오류'}`);
    }
  }, [userData, friends, setIsCreateOpen, setLinkedPostSide]);

  // 인라인 댓글 등록 (DiscussionView / OneCutDetailView 에서 호출)
  // ⚡ 성능 2026-07-02: useCallback 래핑 — 상세뷰로 내려가는 콜백 identity 안정화
  const handleInlineReply = useCallback(async (
    content: string,
    parentPost: Post | null,
    side?: 'left' | 'right',
    imageUrl?: string,
    linkUrl?: string,
  ) => {
    if (!userData || !content.trim() || !selectedTopic) return;
    // 🚀 Rate Limit: 댓글 15초 쿨다운
    if (Date.now() - lastCommentTime < RATE_LIMIT.COMMENT_COOLDOWN_MS) {
      alert('댓글은 15초에 1개만 작성할 수 있습니다.'); return;
    }
    const customId = `comment_${Date.now()}_${userData.uid}`;
    // 🏚️ 유배·귀양지 댓글은 닉네임 자동 익명화
    const displayAuthor = selectedTopic.category === EXILE_CATEGORY
      ? anonymizeExileNickname(userData.uid)
      : userData.nickname;
    try {
      await setDoc(doc(db, 'comments', customId), {
        author: displayAuthor, author_id: userData.uid,
        title: null, content,
        parentId: parentPost ? parentPost.id : selectedTopic.id,
        rootId: selectedTopic.id,
        side: side || 'left', type: 'comment',
        authorInfo: { level: userData.level, friendCount: friends.length, totalLikes: userData.likes },
        createdAt: serverTimestamp(), likes: 0, dislikes: 0,
        ...(imageUrl ? { imageUrl } : {}),
        ...(linkUrl ? { linkUrl } : {}),
      });
      await updateDoc(doc(db, 'posts', selectedTopic.id), { commentCount: increment(1) });
      // 🚀 EXP: 댓글 작성 — LEVEL_V2 §3.2.1 품질 가중치 + level 동시 쓰기 (옵션 B)
      const replyExp = calculateExpForPost(content, {
        hasImage: !!imageUrl,
        hasLink: !!linkUrl || /https?:\/\//.test(content),
      });
      if (replyExp > 0) {
        await updateDoc(doc(db, 'users', userData.uid), buildExpLevelUpdate(userData.exp, replyExp));
      }
      lastCommentTime = Date.now();
    } catch (e: unknown) {
      console.error('[handleInlineReply]', e);
      alert('댓글 등록에 실패했습니다: ' + (e as Error).message);
      throw e;
    }
  }, [userData, friends, selectedTopic]);

  // 폼 기반 댓글 제출 (DiscussionView 하단 댓글 폼)
  // ⚡ 성능 2026-07-02: useCallback 래핑 — 폼 콜백 identity 안정화
  const handleCommentSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    if (!userData || !newContent.trim() || !selectedTopic) return;
    // 🚀 Rate Limit: 댓글 15초 쿨다운
    if (Date.now() - lastCommentTime < RATE_LIMIT.COMMENT_COOLDOWN_MS) {
      alert('댓글은 15초에 1개만 작성할 수 있습니다.'); return;
    }
    setIsSubmitting(true);
    const customId = `comment_${Date.now()}_${userData.uid}`;
    // 🏚️ 유배·귀양지 댓글은 닉네임 자동 익명화
    const displayAuthor = selectedTopic.category === EXILE_CATEGORY
      ? anonymizeExileNickname(userData.uid)
      : userData.nickname;
    try {
      await setDoc(doc(db, 'comments', customId), {
        author: displayAuthor, author_id: userData.uid,
        title: selectedType === 'formal' ? newTitle : null,
        content: newContent,
        parentId: replyTarget ? replyTarget.id : selectedTopic.id,
        rootId: selectedTopic.id,
        side: selectedSide, type: selectedType,
        authorInfo: { level: userData.level, friendCount: friends.length, totalLikes: userData.likes },
        createdAt: serverTimestamp(), likes: 0, dislikes: 0,
      });
      await updateDoc(doc(db, 'posts', selectedTopic.id), { commentCount: increment(1) });
      // 🚀 EXP: 댓글 작성 — LEVEL_V2 §3.2.1 품질 가중치 + level 동시 쓰기 (옵션 B)
      const commentExp = calculateExpForPost(newContent, {
        hasLink: /https?:\/\//.test(newContent),
      });
      if (commentExp > 0) {
        await updateDoc(doc(db, 'users', userData.uid), buildExpLevelUpdate(userData.exp, commentExp));
      }
      lastCommentTime = Date.now();
      setNewTitle('');
      setNewContent('');
      setReplyTarget(null);
    } catch (e: unknown) {
      console.error('[handleCommentSubmit]', e);
      alert('댓글 등록에 실패했습니다: ' + (e as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  }, [userData, friends, selectedTopic, newContent, newTitle, selectedType, selectedSide, replyTarget, setIsSubmitting, setNewTitle, setNewContent, setReplyTarget]);

  // 깐부(팔로우) 토글 — 🛡️ Anti-Abuse Commit 7-B v2: Cloud Function 경유
  // Why: 대칭 ±2 EXP (맺기 +2, 해제 -2) + 서버측 5초 쿨다운으로 루프 어뷰징 차단
  //      클라가 friendList/exp를 직접 쓰지 않아 Rules increase-only 가드와 정합
  // ⚡ 성능 2026-07-02: useCallback 래핑 — 글카드마다 내려가는 깐부 콜백 identity 안정화(200 카드 재렌더 차단)
  const toggleFriend = useCallback(async (author: string) => {
    if (!userData) return;
    try {
      const { getFunctions, httpsCallable } = await import('firebase/functions');
      const functions = getFunctions(undefined, 'asia-northeast3');
      const call = httpsCallable(functions, 'toggleKanbu');
      await call({ targetNickname: author });
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      if (err.code === 'functions/resource-exhausted') {
        alert('깐부 버튼은 5초에 1회만 누를 수 있습니다.');
      } else if (err.code === 'functions/invalid-argument') {
        alert(err.message || '본인은 깐부 맺을 수 없습니다.');
      } else {
        console.error(e);
        alert('깐부 요청 실패. 잠시 후 다시 시도하세요.');
      }
    }
  }, [userData]);

  // 유저 차단 토글
  // ⚡ 성능 2026-07-02: useCallback 래핑 — 차단 콜백 identity 안정화
  const toggleBlock = useCallback(async (author: string) => {
    if (!userData) return;
    if (author === userData.nickname) { alert('본인은 차단할 수 없습니다!'); return; }
    const isBlocked = blocks.includes(author);
    if (!isBlocked && !window.confirm(`${author}님을 차단하시겠소? 모든 게시글이 숨겨집니다.`)) return;
    try {
      await updateDoc(doc(db, 'users', userData.uid), {
        blockList: isBlocked ? arrayRemove(author) : arrayUnion(author),
      });
    } catch (e) { console.error(e); }
  }, [userData, blocks]);

  // 게시글/댓글 좋아요 토글 — col(posts|comments) 자동 판별
  // ⚡ 성능 2026-07-02: useCallback 래핑 — 모든 글카드 좋아요 콜백 identity 안정화(최대 레버리지: PostCardItem React.memo 복원)
  const handleLike = useCallback(async (e: React.MouseEvent | null, postId: string) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (!userData) { alert('로그인이 필요합니다!'); return; }
    try {
      const targetPost = [...allRootPosts, ...allChildPosts].find(p => p.id === postId);
      if (!targetPost) return;
      const isLiked = targetPost.likedBy?.includes(userData.nickname);
      const diff = isLiked ? -1 : 1;
      const col = targetPost.rootId ? 'comments' : 'posts';
      // 🔒 P1 2026-07-02: 절대값 write → increment(diff)로 전환 (동시 좋아요 레이스로 카운트 유실 차단)
      //   likedBy가 진실원이며 likes는 필터 게이트(3/10/30개)라 drift가 제품에 노출됨
      await updateDoc(doc(db, col, postId), {
        likes: increment(diff),
        likedBy: isLiked ? arrayRemove(userData.nickname) : arrayUnion(userData.nickname),
      });
      // 🛡️ Anti-Abuse Commit 5: 좋아요 취소(diff=-1) 시 타인 users.likes 업데이트 스킵
      // Why: Rules §4.2.2가 타인 users.likes 감소 차단 → permission-denied 방지
      //      posts/comments의 likedBy/likes는 정상 동작 (UX 영향 없음)
      //      정밀 카운팅 보정은 Phase B+ auditReputationAnomalies CF에서
      if (diff === 1 && targetPost.author_id) {
        await updateDoc(doc(db, 'users', targetPost.author_id), { likes: increment(3) });
      }
      // 🚀 등록글 EXP: 좋아요 3개 달성 시 작성자에게 exp +5 (1회만)
      // 조건: 좋아요가 2→3이 되는 순간 (diff=+1이고 기존 likes가 2)
      const newLikes = (targetPost.likes || 0) + diff;
      if (diff === 1 && newLikes === 3 && targetPost.author_id) {
        await updateDoc(doc(db, 'users', targetPost.author_id), { exp: increment(5) });
      }
    } catch (e) { console.error(e); }
  }, [userData, allRootPosts, allChildPosts]);

  // 게시글 상세 열기 + 조회수 증가 (자기 글·세션 중복 방지)
  // ⚡ 성능 2026-07-02: setSelectedTopic만 동기 실행(화면 즉시 전환)하고, 조회수+EXP 두 write를
  //   단일 writeBatch(1왕복)로 묶어 requestIdleCallback로 지연 커밋 — 클릭 임계경로에서 write 제거로 상세 진입 버벅임 완화
  const handleViewPost = useCallback((post: Post) => {
    setSelectedTopic(post);
    if (!userData || userData.nickname === post.author) return;
    const sessionKey = `viewed_${post.id}`;
    if (sessionStorage.getItem(sessionKey)) return;
    sessionStorage.setItem(sessionKey, '1');
    const viewerUid = userData.uid;
    const viewerExp = userData.exp;
    // 조회수(+1)와 EXP(+1, 옵션 B level 동시 쓰기)를 한 배치로 합쳐 네트워크 왕복 1회로 커밋
    const commitViewWrites = () => {
      const batch = writeBatch(db);
      batch.update(doc(db, 'posts', post.id), { viewCount: increment(1) });
      batch.update(doc(db, 'users', viewerUid), buildExpLevelUpdate(viewerExp, 1));
      batch.commit().catch(() => {});
    };
    // 브라우저 idle 타이밍에 커밋 — 미지원(Safari 등)은 setTimeout 폴백
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(commitViewWrites, { timeout: VIEW_WRITE_IDLE_TIMEOUT_MS });
    } else {
      setTimeout(commitViewWrites, VIEW_WRITE_FALLBACK_DELAY_MS);
    }
  }, [userData, setSelectedTopic]);

  // 🚀 공유수 카운트: URL 복사 버튼 클릭 시 두 곳 동시 +1
  // ① posts/{postId}.shareCount   — 글별 공유 횟수 (랭킹용)
  // ② users/{authorId}.totalShares — 글쓴이 누적 공유수 (평판 점수 반영)
  // 검색어: handleShareCount
  // ⚡ 성능 2026-07-02: useCallback 래핑 — 글카드 공유 콜백 identity 안정화(외부 참조 없어 deps 빈 배열)
  const handleShareCount = useCallback((postId: string, authorId?: string) => {
    updateDoc(doc(db, 'posts', postId), { shareCount: increment(1) }).catch(() => {});
    if (authorId) {
      updateDoc(doc(db, 'users', authorId), { totalShares: increment(1) }).catch(() => {});
    }
  }, []);

  // 🚀 재등록: 등록글 미달 글을 새글로 다시 올리기 (1회 한정)
  // Why: 2시간 경과 + 좋아요 3개 미만 글이 영원히 묻히는 것 방지. 1회만 허용.
  // ⚡ 성능 2026-07-02: useCallback 래핑 — 재등록 콜백 identity 안정화(allRootPosts 조회 의존)
  const handleRepost = useCallback(async (postId: string) => {
    const post = allRootPosts.find(p => p.id === postId);
    if (!post) return;
    // 이미 재등록된 글이면 차단
    if ((post as Post & { repostedAt?: unknown }).repostedAt) {
      alert('이미 재등록된 글입니다. 재등록은 1회만 가능합니다.');
      return;
    }
    if (!confirm('[재등록] 하시겠습니까?\n제목 앞에 [재등록] 표시가 추가되며, 새글로 다시 올라갑니다.')) return;
    try {
      const newTitle = post.title?.startsWith('[재등록]') ? post.title : `[재등록] ${post.title || ''}`;
      await updateDoc(doc(db, 'posts', postId), {
        title: newTitle,
        createdAt: serverTimestamp(),
        repostedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('[재등록 실패]', err);
      alert('재등록에 실패했습니다. 다시 시도해주세요.');
    }
  }, [allRootPosts]);

  return {
    handlePostSubmit,
    handleLinkedPostSubmit,
    handleInlineReply,
    handleCommentSubmit,
    toggleFriend,
    toggleBlock,
    handleLike,
    handleViewPost,
    handleShareCount,
    handleRepost,
  };
}
