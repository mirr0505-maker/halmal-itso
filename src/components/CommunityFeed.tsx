// src/components/CommunityFeed.tsx — 장갑 속 소곤소곤: 가입한 커뮤니티의 최신 글 피드
// 🚀 Firestore 'in' 쿼리 최대 30개 제한 — 초과 시 첫 30개 커뮤니티만 구독
// ✨ 2026-05-15 UI/UX 풀세트 Phase 2: 좋아요 작동 + 공유 버튼 (Web Share API + clipboard fallback)
import { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase';
import { collection, doc, query, where, orderBy, limit, onSnapshot, getDocs, updateDoc, arrayUnion, arrayRemove, increment } from 'firebase/firestore';
import type { CommunityPost, Community, UserData, CommunityMember } from '../types';
import CommunityPostDetail from './CommunityPostDetail';
import ThanksballModal from './ThanksballModal';
// ⚡ 2026-05-13 Perf Phase E-light: 카드 분리·메모화 (sanitize useMemo)
import CommunityFeedCard from './CommunityFeedCard';

interface Props {
  currentUserData: UserData | null;
  joinedCommunityIds: string[];
  allUsers: Record<string, UserData>;
  communities?: Community[];
  followerCounts?: Record<string, number>;
  onCommunityClick: (community: Community) => void;
}

const CommunityFeed = ({ currentUserData, joinedCommunityIds, allUsers, communities: _communities = [], followerCounts = {}, onCommunityClick: _onCommunityClick }: Props) => {
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  // 🚀 글 상세 모달 + 멤버 lazy load
  const [selectedPost, setSelectedPost] = useState<CommunityPost | null>(null);
  const [modalMembers, setModalMembers] = useState<CommunityMember[]>([]);

  useEffect(() => {
    if (joinedCommunityIds.length === 0) { setPosts([]); return; }
    const ids = joinedCommunityIds.slice(0, 30);
    // ⚡ 2026-05-13 Perf Phase A: 봇 활성 커뮤니티 1개만 가입해도 통합 피드가 무거워짐 → limit(100)로 상한.
    //   가입 커뮤니티 30개 × 평균 N건 → 100건 최신순 통합으로 일관 보호.
    const q = query(
      collection(db, 'community_posts'),
      where('communityId', 'in', ids),
      orderBy('createdAt', 'desc'),
      limit(100)
    );
    const unsub = onSnapshot(q, snap => {
      setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() } as CommunityPost)));
    }, (err) => console.error('[CommunityFeed onSnapshot]', err));
    return () => unsub();
  }, [joinedCommunityIds]);

  // 🚀 글 클릭 → 모달 열기 + 해당 커뮤니티 멤버 lazy load
  // ⚡ Phase E-light: useCallback로 stable 참조 (memo'd 카드의 비교가 매번 다른 함수로 실패하지 않도록)
  const handlePostClick = useCallback(async (post: CommunityPost) => {
    setSelectedPost(post);
    setModalMembers([]);
    try {
      const q = query(collection(db, 'community_memberships'), where('communityId', '==', post.communityId));
      const snap = await getDocs(q);
      setModalMembers(snap.docs.map(d => d.data() as CommunityMember));
    } catch (e) { console.error('[feed member load]', e); }
  }, []);

  const formatTime = (ts: { seconds: number } | null | undefined) => {
    if (!ts) return '';
    const d = new Date(ts.seconds * 1000);
    const diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return '방금 전';
    if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
    return d.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' });
  };

  // 🚀 피드 카드 땡스볼 모달
  const [feedThanksballTarget, setFeedThanksballTarget] = useState<{ postId: string; author: string } | null>(null);
  const handleThanksballClick = useCallback((postId: string, author: string) => {
    setFeedThanksballTarget({ postId, author });
  }, []);

  // ✨ Phase 2: 좋아요 토글 — CommunityPostDetail.handleLike와 동일 패턴
  //   Rules §4.2.2 가드: diff=-1 시 타인 users.likes 차감 skip (count rollback은 posts에만)
  const handleLikeClick = useCallback(async (post: CommunityPost) => {
    if (!currentUserData) return;
    const isLiked = post.likedBy?.includes(currentUserData.nickname);
    const diff = isLiked ? -1 : 1;
    try {
      // 🔒 P1 2026-07-02: 절대값 write → increment(diff) (동시 좋아요 레이스 카운트 유실 차단)
      await updateDoc(doc(db, 'community_posts', post.id), {
        likes: increment(diff),
        likedBy: isLiked ? arrayRemove(currentUserData.nickname) : arrayUnion(currentUserData.nickname),
      });
      if (diff === 1 && post.author_id) {
        await updateDoc(doc(db, 'users', post.author_id), { likes: increment(3) });
      }
    } catch (e) { console.error('[community_post like]', e); }
  }, [currentUserData]);

  // ✨ Phase 2: 공유 — Web Share API 우선, fallback clipboard. 베타엔 origin URL만 (직접 deep-link는 별 작업)
  const [shareToastTimer, setShareToastTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [sharedPostId, setSharedPostId] = useState<string | null>(null);
  const handleShareClick = useCallback(async (post: CommunityPost) => {
    const shareUrl = window.location.origin;
    const text = `[${post.communityName}] ${post.title || post.author}님의 글 — 글러브에서 보기`;
    try {
      if (navigator.share) {
        await navigator.share({ title: '글러브', text, url: shareUrl });
      } else {
        await navigator.clipboard.writeText(`${text}\n${shareUrl}`);
      }
      if (shareToastTimer) clearTimeout(shareToastTimer);
      setSharedPostId(post.id);
      setShareToastTimer(setTimeout(() => setSharedPostId(null), 1800));
    } catch { /* 사용자 취소 등 — 무시 */ }
  }, [shareToastTimer]);

  if (!currentUserData) {
    return (
      <div className="py-40 text-center">
        <p className="text-slate-400 font-bold text-sm">로그인 후 이용할 수 있어요.</p>
      </div>
    );
  }

  if (joinedCommunityIds.length === 0) {
    return (
      <div className="py-40 text-center">
        <p className="text-slate-400 font-bold text-sm italic mb-2">지금 장갑 안에서 들려오는 이야기가 없어요.</p>
        <p className="text-slate-300 font-bold text-[12px]">장갑 속 친구들 탭에서 커뮤니티에 가입해보세요!</p>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="py-40 text-center text-slate-400 font-bold text-sm italic">
        가입한 커뮤니티에 아직 글이 없어요. 첫 번째 이야기를 남겨보세요!
      </div>
    );
  }

  return (
    <div className="w-full pb-20 flex flex-col gap-2">
      {posts.map(post => {
        const authorData = allUsers[`nickname_${post.author}`];
        return (
          <CommunityFeedCard
            key={post.id}
            post={post}
            authorData={authorData}
            followerCount={followerCounts[post.author] || 0}
            isSelf={!!(currentUserData && post.author_id === currentUserData.uid)}
            isLikedByMe={!!(currentUserData && post.likedBy?.includes(currentUserData.nickname))}
            formattedTime={formatTime(post.createdAt)}
            onClick={handlePostClick}
            onThanksballClick={handleThanksballClick}
            onLikeClick={handleLikeClick}
            onShareClick={handleShareClick}
          />
        );
      })}

      {/* ✨ Phase 2: 공유 토스트 (간단한 fixed bottom) */}
      {sharedPostId && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[12px] font-[1000] px-4 py-2 rounded-full shadow-lg z-50 animate-in fade-in">
          🔗 링크가 복사됐어요
        </div>
      )}

      {/* 🚀 피드 카드 땡스볼 모달 */}
      {feedThanksballTarget && currentUserData && (
        <ThanksballModal
          postId={feedThanksballTarget.postId}
          postAuthor={feedThanksballTarget.author}
          currentNickname={currentUserData.nickname}
          recipientNickname={feedThanksballTarget.author}
          targetCollection="community_posts"
          onClose={() => setFeedThanksballTarget(null)}
        />
      )}

      {/* 🚀 글 상세 모달 */}
      {selectedPost && (
        <CommunityPostDetail
          post={selectedPost}
          currentUserData={currentUserData}
          allUsers={allUsers}
          followerCounts={followerCounts}
          members={modalMembers}
          onClose={() => { setSelectedPost(null); setModalMembers([]); }}
          communityCategory={_communities.find(c => c.id === selectedPost.communityId)?.category}
        />
      )}
    </div>
  );
};

export default CommunityFeed;
