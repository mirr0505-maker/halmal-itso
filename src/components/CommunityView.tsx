// src/components/CommunityView.tsx — 개별 커뮤니티 상세: 글 목록 + 글 작성
import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, where, orderBy, limit, doc, setDoc, updateDoc, deleteDoc, deleteField, increment, arrayUnion, arrayRemove, serverTimestamp } from 'firebase/firestore';
import type { Community, CommunityPost, CommunityMember, FingerRole, UserData, FirestoreTimestamp } from '../types';
import { CHAT_MEMBER_LIMIT } from '../types';
import TiptapEditor from './TiptapEditor';
import CommunityAdminPanel from './CommunityAdminPanel';
import CommunityChatPanel from './CommunityChatPanel';
import VerifiedBadgeComponent from './VerifiedBadge';
import VerifyMemberModal from './VerifyMemberModal';
import JoinAnswersDisplay from './JoinAnswersDisplay';
import { sanitizeHtml } from '../sanitize';
import { uploadToR2 } from '../uploadToR2';
import { calculateLevel } from '../utils';

// 🚀 다섯 손가락 Phase 2 — 손가락 배지 정의
const FINGER_META: Record<FingerRole, { emoji: string; label: string; colorCls: string }> = {
  thumb:  { emoji: '👍', label: '개설자',  colorCls: 'bg-yellow-50 text-yellow-600' },
  index:  { emoji: '☝️', label: '부관리',  colorCls: 'bg-blue-50 text-blue-600' },
  middle: { emoji: '🖐', label: '핵심멤버', colorCls: 'bg-purple-50 text-purple-600' },
  ring:   { emoji: '🤝', label: '멤버',    colorCls: 'bg-green-50 text-green-500' },
  pinky:  { emoji: '🤙', label: '새내기',  colorCls: 'bg-slate-50 text-slate-400' },
};

interface Props {
  community: Community;
  currentUserData: UserData | null;
  allUsers: Record<string, UserData>;
  onBack: () => void;
  onClosed?: () => void; // 🚀 Phase 3: 장갑 폐쇄 후 목록 복귀
}

const CommunityView = ({ community, currentUserData, allUsers, onBack, onClosed }: Props) => {
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [isWriting, setIsWriting] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedPost, setSelectedPost] = useState<CommunityPost | null>(null);
  // 🚀 다섯 손가락 Phase 2 — 탭 + 멤버 상태
  const [activeTab, setActiveTab] = useState<'posts' | 'chat' | 'members' | 'admin'>('posts');
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [currentMembership, setCurrentMembership] = useState<CommunityMember | null>(null);
  // 🚀 Phase 4 — 현재 유저의 알림 구독 여부
  const isNotifying = currentUserData && (community.notifyMembers ?? []).includes(currentUserData.uid);

  // 🚀 커뮤니티 글 실시간 구독 — selectedCommunity 변경 시마다 갱신
  useEffect(() => {
    const q = query(
      collection(db, 'community_posts'),
      where('communityId', '==', community.id),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() } as CommunityPost)));
    }, (err) => console.error('[community_posts onSnapshot]', err));
    return () => unsub();
  }, [community.id]);

  // 🚀 다섯 손가락 Phase 2 — 커뮤니티 멤버 실시간 구독
  useEffect(() => {
    const q = query(collection(db, 'community_memberships'), where('communityId', '==', community.id));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ ...d.data() } as CommunityMember));
      setMembers(list);
      if (currentUserData) {
        setCurrentMembership(list.find(m => m.userId === currentUserData.uid) ?? null);
      }
    }, (err) => console.error('[community_memberships onSnapshot]', err));
    return () => unsub();
  }, [community.id, currentUserData]);

  // 🚀 현재 유저의 유효 finger 역할 판별 (finger 없을 경우 role 레거시 폴백)
  const myFinger: FingerRole | null = currentMembership
    ? (currentMembership.finger ?? (currentMembership.role === 'owner' ? 'thumb' : 'ring'))
    : null;
  const isAdmin = myFinger === 'thumb' || myFinger === 'index';
  const pendingMembers = members.filter(m => (m.joinStatus ?? 'active') === 'pending');
  const activeMembers  = members.filter(m => (m.joinStatus ?? 'active') === 'active');

  // 🚀 Phase 7: 채팅 활성화 여부 (50명 이하)
  const isChatAvailable = (community.memberCount ?? 0) <= CHAT_MEMBER_LIMIT;

  // 🚀 Phase 6: 비가입자 접근 제한
  // isMember: active 멤버 또는 pending(승인 대기)인 경우 true
  const isMember = !!currentMembership && (currentMembership.joinStatus === 'active' || !currentMembership.joinStatus);
  const isPending = !!currentMembership && currentMembership.joinStatus === 'pending';
  const joinType = community.joinType || 'open';
  // 승인제: 비가입자 완전 차단 / open·password: 글 목록만 보임(상세·글쓰기 차단)
  const isBlocked = !isMember && !isPending && joinType === 'approval';
  const isReadOnly = !isMember && !isBlocked; // open/password 비가입자: 글 목록만

  // 🚀 Phase 7: 읽지 않은 채팅 메시지 카운트
  const [chatLastReadAt, setChatLastReadAt] = useState<number>(0);
  const [latestChatMessages, setLatestChatMessages] = useState<{ createdAt?: { seconds: number } }[]>([]);

  // chatLastReadAt 초기 로드 — 멤버십 문서에서
  useEffect(() => {
    if (currentMembership) {
      const ts = (currentMembership as CommunityMember & { chatLastReadAt?: { seconds: number } }).chatLastReadAt;
      if (ts?.seconds) setChatLastReadAt(ts.seconds);
    }
  }, [currentMembership]);

  // 최신 채팅 메시지 구독 (카운트 계산용, 채팅 탭이 아닐 때만)
  useEffect(() => {
    if (activeTab === 'chat' || !isMember) return;
    const messagesRef = collection(doc(db, 'community_chats', community.id), 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'desc'), limit(50));
    const unsub = onSnapshot(q, (snap) => {
      setLatestChatMessages(snap.docs.map(d => ({ createdAt: d.data().createdAt })));
    }, () => {});
    return () => unsub();
  }, [community.id, activeTab, isMember]);

  const unreadChatCount = chatLastReadAt > 0
    ? latestChatMessages.filter(m => m.createdAt && m.createdAt.seconds > chatLastReadAt).length
    : (latestChatMessages.length > 0 ? latestChatMessages.length : 0);

  // 채팅 탭 진입 시 lastReadAt 갱신
  useEffect(() => {
    if (activeTab !== 'chat' || !currentUserData || !isMember) return;
    const membershipId = `${community.id}_${currentUserData.uid}`;
    setChatLastReadAt(Math.floor(Date.now() / 1000));
    setLatestChatMessages([]);
    updateDoc(doc(db, 'community_memberships', membershipId), { chatLastReadAt: serverTimestamp() }).catch(() => {});
  }, [activeTab, community.id, currentUserData, isMember]);

  // 🚀 Phase 3 — 공지 고정 글 (pinnedPostId로 찾기)
  const pinnedPost = community.pinnedPostId ? posts.find(p => p.id === community.pinnedPostId) : null;
  // 공지 제외한 일반 글 목록 (블라인드 필터링 포함)
  const visiblePosts = posts.filter(p => !p.isBlinded && p.id !== community.pinnedPostId);

  // 🚀 Phase 3 — 공지 고정 핸들러 (thumb/index만)
  const handlePinPost = async (postId: string) => {
    if (!isAdmin) return;
    const newPinnedId = community.pinnedPostId === postId ? null : postId;
    await updateDoc(doc(db, 'communities', community.id), { pinnedPostId: newPinnedId ?? null });
  };

  // 🚀 Phase 3 — 게시글 블라인드 처리 (thumb/index만)
  const handleBlindPost = async (post: CommunityPost) => {
    if (!isAdmin) return;
    if (!window.confirm(post.isBlinded ? '블라인드를 해제하시겠습니까?' : '이 글을 블라인드 처리하시겠습니까?')) return;
    // 낙관적 업데이트
    setPosts(prev => prev.map(p => p.id === post.id ? { ...p, isBlinded: !p.isBlinded } : p));
    await updateDoc(doc(db, 'community_posts', post.id), { isBlinded: !post.isBlinded });
  };

  // 🚀 게시글 영구 삭제 — 작성자 본인 또는 관리자(thumb/index)
  // Why: 블라인드는 숨김만이므로 스팸·부적절 글을 완전히 제거하는 수단 필요
  const handleDeletePost = async (post: CommunityPost) => {
    const isAuthor = post.author_id === currentUserData?.uid;
    if (!isAuthor && !isAdmin) return;
    if (!window.confirm('이 글을 영구 삭제하시겠습니까? 삭제 후 복구할 수 없습니다.')) return;
    // 공지 고정 글이면 pinnedPostId도 해제
    if (community.pinnedPostId === post.id) {
      await updateDoc(doc(db, 'communities', community.id), { pinnedPostId: null, postCount: increment(-1) });
    } else {
      await updateDoc(doc(db, 'communities', community.id), { postCount: increment(-1) });
    }
    // 낙관적 업데이트
    setPosts(prev => prev.filter(p => p.id !== post.id));
    if (selectedPost?.id === post.id) setSelectedPost(null);
    await deleteDoc(doc(db, 'community_posts', post.id));
    if (post.author_id) updateDoc(doc(db, 'users', post.author_id), { exp: increment(-2) }).catch(() => {});
  };

  // 🚀 Phase 5 — 중지(middle) 자동 산정
  // 조건: 커뮤니티 내 작성글 5개 이상 OR 수신 좋아요 합계 20개 이상 → finger: 'middle' 자동 승격
  // 이미 middle/index/thumb이거나 ring/pinky도 아닌 경우 스킵
  const checkMiddlePromotion = async () => {
    if (!currentUserData || !currentMembership) return;
    const currentFinger: FingerRole = currentMembership.finger ?? (currentMembership.role === 'owner' ? 'thumb' : 'ring');
    // 이미 middle 이상이면 스킵
    if (['thumb', 'index', 'middle'].includes(currentFinger)) return;

    // 이 커뮤니티에서 내가 작성한 글 목록 조회
    const myPostsInCommunity = posts.filter(p => p.author_id === currentUserData.uid);
    const postCount = myPostsInCommunity.length;
    // 수신 좋아요 합산
    const totalLikes = myPostsInCommunity.reduce((sum, p) => sum + (p.likes || 0), 0);

    const qualified = postCount >= 5 || totalLikes >= 20;
    if (!qualified) return;

    // middle로 자동 승격
    const membershipId = `${community.id}_${currentUserData.uid}`;
    await updateDoc(doc(db, 'community_memberships', membershipId), { finger: 'middle' });
    // 🚀 알림 경로: 닉네임 → UID
    const notifRef = doc(collection(db, 'notifications', currentUserData.uid, 'items'));
    await (await import('firebase/firestore')).setDoc(notifRef, {
      type: 'finger_promoted',
      communityId: community.id,
      communityName: community.name,
      message: `[${community.name}] 축하해요! 🖐 핵심멤버로 승급했습니다.`,
      isRead: false,
      createdAt: new Date(),
    });
  };

  // 🚀 Phase 4 — 새 글 알림 Opt-in 토글
  const handleToggleNotify = async () => {
    if (!currentUserData) return;
    const uid = currentUserData.uid;
    await updateDoc(doc(db, 'communities', community.id), {
      notifyMembers: isNotifying ? arrayRemove(uid) : arrayUnion(uid),
    });
  };


  // 🚀 다섯 손가락 Phase 2 — 멤버 승인 (pending → active, finger: pinky→ring)
  const handleApprove = async (member: CommunityMember) => {
    // 낙관적 업데이트
    setMembers(prev => prev.map(m => m.userId === member.userId ? { ...m, joinStatus: 'active', finger: 'ring' } : m));
    const membershipId = `${community.id}_${member.userId}`;
    await updateDoc(doc(db, 'community_memberships', membershipId), {
      joinStatus: 'active',
      finger: 'ring',
      role: 'member',
    });
    await updateDoc(doc(db, 'communities', community.id), { memberCount: increment(1) });
  };

  // 🚀 다섯 손가락 Phase 2 — 멤버 거절 (문서 삭제)
  const handleReject = async (member: CommunityMember) => {
    if (!window.confirm(`${member.nickname}님의 가입 신청을 거절하시겠습니까?`)) return;
    // 낙관적 업데이트
    setMembers(prev => prev.filter(m => m.userId !== member.userId));
    await deleteDoc(doc(db, 'community_memberships', `${community.id}_${member.userId}`));
  };

  // 🚀 Phase 6 Step 4B — 인증 마킹 상태
  const [verifyingMember, setVerifyingMember] = useState<CommunityMember | null>(null);
  const [viewingAnswersMember, setViewingAnswersMember] = useState<CommunityMember | null>(null);

  // 🚀 인증 부여 — active 멤버에게만 가능 (이중 안전 가드)
  const handleVerifyMember = async (member: CommunityMember, label: string) => {
    if (!currentUserData) return;
    if (member.joinStatus && member.joinStatus !== 'active') {
      alert('승인된 멤버에게만 인증을 부여할 수 있습니다.');
      return;
    }
    const membershipId = `${community.id}_${member.userId}`;
    const verifiedData = { verifiedAt: { seconds: Math.floor(Date.now() / 1000) }, verifiedBy: currentUserData.uid, verifiedByNickname: currentUserData.nickname, label: label.trim() };
    // 낙관적 업데이트
    setMembers(prev => prev.map(m => m.userId === member.userId ? { ...m, verified: verifiedData } : m));
    await updateDoc(doc(db, 'community_memberships', membershipId), {
      verified: {
        verifiedAt: serverTimestamp(),
        verifiedBy: currentUserData.uid,
        verifiedByNickname: currentUserData.nickname,
        label: label.trim(),
      },
    });
  };

  // 🚀 인증 해제
  const handleUnverifyMember = async (member: CommunityMember) => {
    if (!window.confirm(`${member.nickname}님의 인증을 해제하시겠습니까?`)) return;
    // 낙관적 업데이트
    setMembers(prev => prev.map(m => m.userId === member.userId ? { ...m, verified: undefined } : m));
    const membershipId = `${community.id}_${member.userId}`;
    await updateDoc(doc(db, 'community_memberships', membershipId), { verified: deleteField() });
  };

  // 🚀 다섯 손가락 Phase 2 — 손가락 역할 변경 (thumb/index만 가능)
  const handleChangeFinger = async (member: CommunityMember, newFinger: FingerRole) => {
    if (!isAdmin) return;
    // 낙관적 업데이트
    setMembers(prev => prev.map(m => m.userId === member.userId ? { ...m, finger: newFinger } : m));
    const membershipId = `${community.id}_${member.userId}`;
    await updateDoc(doc(db, 'community_memberships', membershipId), { finger: newFinger });
  };

  // 🚀 다섯 손가락 Phase 2 — 멤버 강퇴
  const handleBan = async (member: CommunityMember) => {
    if (!isAdmin) return;
    if (!window.confirm(`${member.nickname}님을 강퇴하시겠습니까?`)) return;
    // 낙관적 업데이트
    setMembers(prev => prev.map(m => m.userId === member.userId ? { ...m, joinStatus: 'banned' } : m));
    const membershipId = `${community.id}_${member.userId}`;
    await updateDoc(doc(db, 'community_memberships', membershipId), { joinStatus: 'banned', banReason: '관리자 강퇴' });
    await updateDoc(doc(db, 'communities', community.id), { memberCount: increment(-1) });
  };

  const uploadFile = async (file: File): Promise<string | null> => {
    if (!currentUserData) return null;
    setIsUploading(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `cpost_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
    const filePath = `uploads/${currentUserData.uid}/${fileName}`;
    try {
      return await uploadToR2(file, filePath);
    } catch { alert('이미지 업로드에 실패했습니다.'); return null; }
    finally { setIsUploading(false); }
  };

  const handleSubmit = async () => {
    if (!currentUserData || !newContent.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const { writeBatch } = await import('firebase/firestore');
      const batch = writeBatch(db);
      const postId = `cpost_${Date.now()}_${currentUserData.uid}`;
      const title = newTitle.trim() || null;

      // 🚀 글 작성 + postCount + 활동지수 + 알림 전체를 하나의 writeBatch로 묶음
      // Why: 개별 write 도중 네트워크 단절 시 글만 저장되고 통계·알림 누락 방지
      batch.set(doc(db, 'community_posts', postId), {
        communityId: community.id,
        communityName: community.name,
        author: currentUserData.nickname,
        author_id: currentUserData.uid,
        title,
        content: newContent,
        likes: 0,
        likedBy: [],
        commentCount: 0,
        createdAt: serverTimestamp(),
      });
      batch.update(doc(db, 'communities', community.id), { postCount: increment(1) });
      // 🚀 EXP: 장갑 글 작성 +2 (10자 이상일 때만)
      if (newContent.replace(/<[^>]*>/g, '').trim().length >= 10) {
        batch.update(doc(db, 'users', currentUserData.uid), { exp: increment(2) });
      }

      // 🚀 알림 구독자 push — 50명 이하이면 같은 batch에 포함 (원자성 보장)
      const targets = (community.notifyMembers ?? []).filter(uid => uid !== currentUserData.uid);
      if (targets.length > 0 && targets.length <= 50) {
        const notifText = `[${community.name}] ${title || '새 글이 올라왔어요'}`;
        targets.forEach(uid => {
          const notifRef = doc(collection(db, 'notifications', uid, 'items'));
          batch.set(notifRef, {
            type: 'community_post',
            communityId: community.id,
            communityName: community.name,
            message: notifText,
            senderNickname: currentUserData.nickname,
            postId,
            read: false,
            createdAt: serverTimestamp(),
          });
        });
      }

      await batch.commit();

      // 🚀 Phase 5 — 중지 자동 산정 (비동기, 실패 무시 — batch 외부 처리)
      checkMiddlePromotion().catch(console.error);
      setNewTitle(''); setNewContent(''); setIsWriting(false);
    } finally { setIsSubmitting(false); }
  };

  const handleLike = async (e: React.MouseEvent, post: CommunityPost) => {
    e.stopPropagation();
    if (!currentUserData) { alert('로그인이 필요합니다.'); return; }
    const isLiked = post.likedBy?.includes(currentUserData.nickname);
    const diff = isLiked ? -1 : 1;
    // 낙관적 업데이트
    setPosts(prev => prev.map(p => p.id === post.id ? {
      ...p,
      likes: Math.max(0, (p.likes || 0) + diff),
      likedBy: isLiked ? (p.likedBy || []).filter(n => n !== currentUserData.nickname) : [...(p.likedBy || []), currentUserData.nickname],
    } : p));
    await updateDoc(doc(db, 'community_posts', post.id), {
      likes: Math.max(0, (post.likes || 0) + diff),
      likedBy: isLiked ? arrayRemove(currentUserData.nickname) : arrayUnion(currentUserData.nickname),
    });
    // 🚀 좋아요 수신 시 글 작성자 활동지수 반영 — App.tsx handleLike와 동일 기준(±3)
    // Why: 장갑 글 좋아요도 일반 글과 동등한 활동 보상을 받아야 함
    if (post.author_id) {
      await updateDoc(doc(db, 'users', post.author_id), { likes: increment(diff * 3) });
    }
  };

  const formatTime = (ts: { seconds: number } | null | undefined) => {
    if (!ts) return '';
    const d = new Date(ts.seconds * 1000);
    const diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return '방금 전';
    if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
    return d.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' });
  };

  return (
    <div className="w-full max-w-[860px] mx-auto pb-20 animate-in fade-in">
      {/* 커뮤니티 헤더 */}
      <div className="rounded-xl overflow-hidden border border-slate-100 mb-4 bg-white shadow-sm">
        <div className="h-3 w-full" style={{ backgroundColor: community.coverColor || '#3b82f6' }} />
        <div className="px-5 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={onBack}
              className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-sm hover:bg-blue-100 transition-colors"
            >
              ← 커뮤니티 목록
            </button>
            {currentUserData && isMember && (
              <div className="flex items-center gap-2">
                {/* 🚀 Phase 4 — 알림 토글 버튼 */}
                {currentMembership && (
                  <button
                    onClick={handleToggleNotify}
                    className={`px-3 h-7 rounded-lg text-[11px] font-black transition-colors ${isNotifying ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                    title={isNotifying ? '새 글 알림 켜짐 — 클릭하면 끄기' : '새 글 알림 받기'}
                  >
                    {isNotifying ? '🔔 알림 ON' : '🔕 알림'}
                  </button>
                )}
                <button
                  onClick={() => setIsWriting(true)}
                  className="px-4 h-7 rounded-lg text-[12px] font-bold bg-slate-900 text-white hover:bg-blue-600 transition-colors"
                >
                  + 글 쓰기
                </button>
              </div>
            )}
          </div>
          <div className="mt-3">
            <div className="flex items-center gap-2">
              <h2 className="text-[20px] font-[1000] text-slate-900">{community.name}</h2>
              {community.joinType && community.joinType !== 'open' && (
                <span className="text-[10px] font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                  {community.joinType === 'password' ? '🔒 초대코드' : '🔵 승인제'}
                </span>
              )}
              {myFinger && (
                <span className={`text-[10px] font-black px-2 py-0.5 rounded ${FINGER_META[myFinger].colorCls}`}>
                  {FINGER_META[myFinger].emoji} {FINGER_META[myFinger].label}
                </span>
              )}
            </div>
            {community.description && <p className="text-[13px] font-bold text-slate-400 mt-1">{community.description}</p>}
            <div className="flex items-center gap-3 mt-2">
              <span className="text-[11px] font-[1000] text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full">{community.category}</span>
              <span className="text-[11px] font-bold text-slate-400">멤버 {community.memberCount}명</span>
              <span className="text-[11px] font-bold text-slate-400">글 {community.postCount}개</span>
              <span className="text-[11px] font-bold text-slate-400">개설자 {community.creatorNickname}</span>
            </div>
          </div>
          {/* 🚀 Phase 6: 비가입자 접근 제한 — 승인제 완전 차단 */}
          {isBlocked && (
            <div className="mt-4 py-16 text-center">
              <p className="text-[32px] mb-3">🔒</p>
              <p className="text-[14px] font-[1000] text-slate-700 mb-1">승인제 장갑입니다</p>
              <p className="text-[11px] font-bold text-slate-400 mb-4">가입 신청 후 관리자 승인이 필요합니다</p>
              {community.description && <p className="text-[12px] font-bold text-slate-500 mb-6">"{community.description}"</p>}
            </div>
          )}
          {/* 🚀 Phase 6: pending 상태 안내 */}
          {isPending && (
            <div className="mt-4 py-10 text-center bg-amber-50/50 rounded-xl border border-amber-100">
              <p className="text-[28px] mb-2">⏳</p>
              <p className="text-[13px] font-[1000] text-amber-700">가입 승인 대기 중</p>
              <p className="text-[11px] font-bold text-amber-500 mt-1">관리자가 승인하면 활동할 수 있습니다</p>
            </div>
          )}
          {/* 🚀 Phase 6: open/password 비가입자 — 글 목록만 표시, 읽기 전용 안내 */}
          {isReadOnly && !isBlocked && (
            <div className="mt-3 flex items-center gap-2 bg-blue-50/50 border border-blue-100 rounded-lg px-3 py-2">
              <span className="text-[12px]">👀</span>
              <p className="text-[10px] font-bold text-blue-600">가입하면 글쓰기·댓글·좋아요를 할 수 있습니다</p>
            </div>
          )}
          {/* 🚀 다섯 손가락 Phase 2 — 탭 바 (멤버만 표시) */}
          {!isBlocked && !isPending && <div className="flex gap-0 mt-3 border-b border-slate-100">
            {(['posts', 'chat', 'members', ...(isAdmin ? ['admin'] : [])] as Array<'posts' | 'chat' | 'members' | 'admin'>).map((tab) => {
              const chatBadge = isChatAvailable && unreadChatCount > 0 && activeTab !== 'chat' ? ` (${unreadChatCount > 99 ? '99+' : unreadChatCount})` : '';
              const chatLabel = isChatAvailable ? `💭 채팅${chatBadge}` : '💭 채팅 (50명+)';
              const labels: Record<string, string> = { posts: '💬 소곤소곤', chat: chatLabel, members: `🤝 멤버 ${activeMembers.length}`, admin: `⚙️ 관리${pendingMembers.length > 0 ? ` (${pendingMembers.length})` : ''}` };
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 text-[12px] font-black transition-colors border-b-2 -mb-px ${activeTab === tab ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                >
                  {labels[tab]}
                </button>
              );
            })}
          </div>}
        </div>
      </div>

      {/* 🚀 Phase 7 — 채팅 탭 */}
      {activeTab === 'chat' && (
        <CommunityChatPanel community={community} currentUser={currentUserData} members={members} allUsers={allUsers} />
      )}

      {/* 🚀 다섯 손가락 Phase 2 — 멤버 탭 (멤버만) */}
      {activeTab === 'members' && isMember && (
        <div className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm">
          <div className="px-5 py-3 border-b border-slate-50">
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">활성 멤버 {activeMembers.length}명</p>
          </div>
          {activeMembers.map(m => {
            const finger: FingerRole = m.finger ?? (m.role === 'owner' ? 'thumb' : 'ring');
            const meta = FINGER_META[finger];
            const isSelf = m.userId === currentUserData?.uid;
            const hasAnswers = !!m.joinAnswers || !!m.joinMessage;
            return (
              <div key={m.userId} className="px-5 py-3 border-b border-slate-50 last:border-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <img src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${m.nickname}`} className="w-8 h-8 rounded-full bg-slate-50 shrink-0" alt="" />
                    <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                      <span className="text-[13px] font-bold text-slate-800">{m.nickname}</span>
                      <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${meta.colorCls}`}>{meta.emoji} {meta.label}</span>
                      {/* 🚀 Phase 6: 인증 배지 */}
                      <VerifiedBadgeComponent verified={m.verified} size="sm" />
                    </div>
                  </div>
                  {/* 관리자 액션 (thumb/index만, 본인 제외) */}
                  {isAdmin && !isSelf && finger !== 'thumb' && (
                    <div className="flex items-center gap-1 shrink-0">
                      {/* 가입 답변 보기 */}
                      {hasAnswers && (
                        <button onClick={() => setViewingAnswersMember(m)}
                          className="text-[10px] font-bold text-slate-400 hover:text-blue-600 px-1.5 py-1 rounded hover:bg-blue-50 transition-colors" title="가입 답변 보기">📋</button>
                      )}
                      {/* 인증 부여/해제 */}
                      {m.verified ? (
                        <button onClick={() => handleUnverifyMember(m)}
                          className="text-[10px] font-bold text-red-400 hover:text-red-600 px-1.5 py-1 rounded hover:bg-red-50 transition-colors" title="인증 해제">🛡️✕</button>
                      ) : (
                        <button onClick={() => setVerifyingMember(m)}
                          className="text-[10px] font-bold text-emerald-500 hover:text-emerald-700 px-1.5 py-1 rounded hover:bg-emerald-50 transition-colors" title="인증 부여">🛡️+</button>
                      )}
                      <select
                        value={finger}
                        onChange={(e) => handleChangeFinger(m, e.target.value as FingerRole)}
                        className="text-[11px] font-bold text-slate-500 border border-slate-200 rounded-md px-1.5 py-1 outline-none"
                      >
                        {(['index', 'middle', 'ring', 'pinky'] as FingerRole[]).map(f => (
                          <option key={f} value={f}>{FINGER_META[f].label}</option>
                        ))}
                      </select>
                      <button onClick={() => handleBan(m)} className="text-[11px] font-black text-red-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50 transition-colors">강퇴</button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 🚀 Phase 6 Step 4B — 인증 부여 모달 */}
      {verifyingMember && (
        <VerifyMemberModal
          community={community}
          member={verifyingMember}
          onClose={() => setVerifyingMember(null)}
          onConfirm={async (label) => { await handleVerifyMember(verifyingMember, label); }}
        />
      )}

      {/* 🚀 Phase 6 Step 4B — 가입 답변 보기 모달 */}
      {viewingAnswersMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setViewingAnswersMember(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="text-[15px] font-[1000] text-slate-900">📋 {viewingAnswersMember.nickname}님의 가입 답변</h3>
              <p className="text-[10px] font-bold text-slate-400 mt-0.5">가입 신청 당시 제출한 정보</p>
            </div>
            <div className="px-6 py-5">
              <JoinAnswersDisplay answers={viewingAnswersMember.joinAnswers!} />
              {!viewingAnswersMember.joinAnswers && viewingAnswersMember.joinMessage && (
                <p className="text-[11px] font-bold text-slate-600">"{viewingAnswersMember.joinMessage}"</p>
              )}
            </div>
            <div className="px-6 py-4 border-t border-slate-100">
              <button onClick={() => setViewingAnswersMember(null)}
                className="w-full py-2.5 rounded-xl text-[13px] font-bold text-slate-500 border border-slate-200 hover:bg-slate-50 transition-colors">닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* 🚀 다섯 손가락 Phase 3 — 관리 탭 (CommunityAdminPanel) */}
      {activeTab === 'admin' && isAdmin && (
        <CommunityAdminPanel
          community={community}
          myFinger={myFinger}
          pendingMembers={pendingMembers}
          onApprove={handleApprove}
          onReject={handleReject}
          onClosed={onClosed ?? onBack}
        />
      )}

      {/* 글 작성 폼 */}
      {activeTab === 'posts' && isWriting && isMember && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm mb-4 mt-4">
          <div className="flex items-center justify-between px-5 h-11 border-b border-slate-100">
            <span className="text-[12px] font-bold text-slate-400">새 글 작성</span>
            <div className="flex gap-1.5">
              <button onClick={() => setIsWriting(false)} className="px-3.5 h-7 rounded-md text-[12px] font-bold text-slate-500 hover:bg-slate-100 transition-colors">취소</button>
              <button onClick={handleSubmit} disabled={isSubmitting || isUploading} className={`px-4 h-7 rounded-md text-[12px] font-bold transition-all ${isSubmitting || isUploading ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-900 text-white hover:bg-blue-600'}`}>
                {isSubmitting ? '올리는 중...' : '올리기'}
              </button>
            </div>
          </div>
          <div className="px-5 py-3 border-b border-slate-100">
            <input type="text" placeholder="제목 (선택)" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="w-full bg-transparent text-[16px] font-bold text-slate-900 outline-none placeholder:text-slate-200 placeholder:font-normal" />
          </div>
          <div className="min-h-[160px]">
            <TiptapEditor content={newContent} onChange={setNewContent} onImageUpload={uploadFile} />
          </div>
        </div>
      )}

      {/* 글 목록 */}
      {activeTab === 'posts' && !isBlocked && !isPending && (
        posts.length === 0 ? (
          <div className="py-32 text-center text-slate-400 font-bold text-sm italic">
            첫 번째 이야기를 남겨보세요!
          </div>
        ) : (
          <div className="flex flex-col gap-2 mt-4">
            {/* 🚀 Phase 3 — 공지 고정 글 최상단 표시 */}
            {pinnedPost && (
              <div
                key={`pinned_${pinnedPost.id}`}
                onClick={() => setSelectedPost(pinnedPost)}
                className="bg-amber-50 border-2 border-amber-300 rounded-xl px-5 py-4 transition-all group cursor-pointer hover:shadow-md"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] font-black text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">📌 공지</span>
                </div>
                {pinnedPost.title && <h3 className="text-[15px] font-[1000] text-slate-900 group-hover:text-amber-700 transition-colors mb-1">{pinnedPost.title}</h3>}
                <div className="text-[13px] font-medium text-slate-500 line-clamp-2 leading-relaxed [&_img]:hidden [&_p]:mb-1" dangerouslySetInnerHTML={{ __html: sanitizeHtml(pinnedPost.content) }} />
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-amber-200">
                  <img src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${pinnedPost.author}`} className="w-4 h-4 rounded-full bg-amber-100" alt="" />
                  <span className="text-[10px] font-bold text-amber-600">{pinnedPost.author}</span>
                </div>
              </div>
            )}
            {visiblePosts.map(post => {
              const isLiked = currentUserData && post.likedBy?.includes(currentUserData.nickname);
              const authorData = allUsers[`nickname_${post.author}`];
              return (
                <div
                  key={post.id}
                  onClick={() => setSelectedPost(post)}
                  className="bg-white border border-slate-100 rounded-xl px-5 py-4 transition-all group cursor-pointer hover:border-blue-300 hover:shadow-md"
                >
                  {post.title && (
                    <h3 className="text-[15px] font-[1000] text-slate-900 group-hover:text-blue-600 transition-colors mb-1">{post.title}</h3>
                  )}
                  <div
                    className="text-[13px] font-medium text-slate-500 line-clamp-3 leading-relaxed [&_img]:hidden [&_p]:mb-1"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.content) }}
                  />
                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-50">
                    <div className="flex items-center gap-2">
                      <img src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${post.author}`} className="w-5 h-5 rounded-full bg-slate-50" alt="" />
                      <span className="text-[11px] font-bold text-slate-500">{post.author}</span>
                      {/* 🚀 Phase 6: 글 작성자 인증 배지 (멤버 목록에서 조회) */}
                      <VerifiedBadgeComponent verified={members.find(m => m.userId === post.author_id)?.verified} size="sm" showDate={false} />
                      {authorData && <span className="text-[10px] font-bold text-slate-300">Lv{calculateLevel(authorData?.exp || 0)}</span>}
                      <span className="text-[10px] font-bold text-slate-300">{formatTime(post.createdAt)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] font-black text-slate-300">
                      {/* 관리자 핀/블라인드 버튼 */}
                      {isAdmin && (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); handlePinPost(post.id); }}
                            className={`text-[10px] font-black px-1.5 py-0.5 rounded transition-colors ${community.pinnedPostId === post.id ? 'text-amber-600 bg-amber-50' : 'text-slate-300 hover:text-amber-400'}`}
                            title="공지 고정"
                          >📌</button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleBlindPost(post); }}
                            className="text-[10px] font-black px-1.5 py-0.5 rounded text-slate-300 hover:text-red-400 transition-colors"
                            title="블라인드 처리"
                          >🚫</button>
                        </>
                      )}
                      {/* 🚀 삭제 버튼 — 작성자 본인 또는 관리자 */}
                      {(post.author_id === currentUserData?.uid || isAdmin) && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeletePost(post); }}
                          className="text-[10px] font-black px-1.5 py-0.5 rounded text-slate-300 hover:text-rose-500 transition-colors"
                          title="글 삭제"
                        >🗑️</button>
                      )}
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                        {post.commentCount || 0}
                      </span>
                      <span
                        onClick={(e) => handleLike(e, post)}
                        className={`flex items-center gap-1 cursor-pointer transition-colors ${isLiked ? 'text-rose-500' : 'hover:text-rose-400'}`}
                      >
                        <svg className={`w-3.5 h-3.5 ${isLiked ? 'fill-current' : 'fill-none'}`} stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
                        {post.likes || 0}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* 글 상세 (선택된 경우 오버레이) */}
      {selectedPost && (
        <CommunityPostDetail
          post={posts.find(p => p.id === selectedPost.id) ?? selectedPost}
          currentUserData={currentUserData}
          allUsers={allUsers}
          members={members}
          onClose={() => setSelectedPost(null)}
          onLike={handleLike}
        />
      )}
    </div>
  );
};

// 🚀 커뮤니티 글 상세 오버레이 — 댓글 목록 + 댓글 작성 (인라인 컴포넌트, 200줄 이내 유지용)
interface DetailProps {
  post: CommunityPost;
  currentUserData: UserData | null;
  allUsers: Record<string, UserData>;
  members: CommunityMember[];
  onClose: () => void;
  onLike: (e: React.MouseEvent, post: CommunityPost) => void;
}

const CommunityPostDetail = ({ post, currentUserData, allUsers: _allUsers, members, onClose, onLike }: DetailProps) => {
  const [comments, setComments] = useState<{id: string; author: string; author_id?: string; content: string; createdAt?: FirestoreTimestamp}[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, 'community_post_comments'),
      where('postId', '==', post.id),
      orderBy('createdAt', 'asc')
    );
    const unsub = onSnapshot(q, snap => {
      setComments(snap.docs.map(d => ({ id: d.id, ...d.data() } as { id: string; author: string; author_id?: string; content: string; createdAt?: FirestoreTimestamp })));
    }, (err) => console.error('[community_post_comments onSnapshot]', err));
    return () => unsub();
  }, [post.id]);

  const handleCommentSubmit = async () => {
    if (!currentUserData || !newComment.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const commentId = `cpcomment_${Date.now()}_${currentUserData.uid}`;
      await setDoc(doc(db, 'community_post_comments', commentId), {
        postId: post.id,
        communityId: post.communityId,
        author: currentUserData.nickname,
        author_id: currentUserData.uid,
        content: newComment.trim(),
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'community_posts', post.id), { commentCount: increment(1) });
      // 🚀 EXP: 장갑 댓글 +2 (10자 이상일 때만)
      if (newComment.trim().length >= 10) {
        await updateDoc(doc(db, 'users', currentUserData.uid), { exp: increment(2) });
      }
      setNewComment('');
    } finally { setIsSubmitting(false); }
  };

  const formatTime = (ts: { seconds: number } | null | undefined) => {
    if (!ts) return '';
    const d = new Date(ts.seconds * 1000);
    const diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return '방금 전';
    if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
    return d.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' });
  };

  const isLiked = currentUserData && post.likedBy?.includes(currentUserData.nickname);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="sticky top-0 bg-white flex items-center justify-between px-6 py-3 border-b border-slate-100 z-10">
          <span className="text-[12px] font-bold text-slate-400">{post.communityName}</span>
          <button onClick={onClose} className="text-slate-300 hover:text-slate-500 text-[20px] leading-none">×</button>
        </div>
        {/* 본문 */}
        <div className="px-6 py-5">
          {post.title && <h2 className="text-[20px] font-[1000] text-slate-900 mb-3">{post.title}</h2>}
          <div className="flex items-center gap-2 mb-4">
            <img src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${post.author}`} className="w-6 h-6 rounded-full bg-slate-50" alt="" />
            <span className="text-[12px] font-bold text-slate-600">{post.author}</span>
            {/* 🚀 Phase 6: 글 상세 작성자 인증 배지 */}
            <VerifiedBadgeComponent verified={members.find(m => m.userId === post.author_id)?.verified} size="sm" showDate={false} />
            <span className="text-[11px] font-bold text-slate-300">{formatTime(post.createdAt)}</span>
          </div>
          <div
            className="text-[14px] font-medium text-slate-700 leading-[1.8] [&_p]:mb-3 [&_strong]:font-bold [&_em]:italic [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_img]:rounded-lg [&_img]:max-w-full [&_a]:text-blue-400 [&_a]:underline"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.content) }}
          />
          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-slate-100">
            <span
              onClick={(e) => onLike(e, post)}
              className={`flex items-center gap-1.5 text-[13px] font-black cursor-pointer transition-colors ${isLiked ? 'text-rose-500' : 'text-slate-300 hover:text-rose-400'}`}
            >
              <svg className={`w-4 h-4 ${isLiked ? 'fill-current' : 'fill-none'}`} stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
              {post.likes || 0}
            </span>
            <span className="text-[12px] font-bold text-slate-400">댓글 {post.commentCount || 0}</span>
          </div>
        </div>
        {/* 댓글 목록 */}
        <div className="px-6 pb-2 border-t border-slate-100">
          {comments.map(c => (
            <div key={c.id} className="py-3 border-b border-slate-50 last:border-0">
              <div className="flex items-center gap-2 mb-1">
                <img src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${c.author}`} className="w-5 h-5 rounded-full bg-slate-50" alt="" />
                <span className="text-[12px] font-bold text-slate-700">{c.author}</span>
                {/* 🚀 Phase 6 Step 6: 댓글 작성자 인증 배지 */}
                <VerifiedBadgeComponent verified={members.find(m => m.userId === c.author_id)?.verified} size="sm" showDate={false} />
                <span className="text-[10px] font-bold text-slate-300">{formatTime(c.createdAt)}</span>
              </div>
              <p className="text-[13px] font-medium text-slate-600 pl-7">{c.content}</p>
            </div>
          ))}
        </div>
        {/* 댓글 입력 */}
        {currentUserData && (
          <div className="sticky bottom-0 bg-white px-6 py-3 border-t border-slate-100 flex gap-2">
            <input
              type="text"
              placeholder="댓글을 남겨보세요..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleCommentSubmit(); }}
              className="flex-1 bg-slate-50 rounded-lg px-3 py-2 text-[13px] font-bold text-slate-900 outline-none border border-transparent focus:border-blue-300 transition-colors placeholder:text-slate-300"
            />
            <button onClick={handleCommentSubmit} disabled={isSubmitting || !newComment.trim()} className={`px-4 rounded-lg text-[12px] font-bold transition-all ${isSubmitting || !newComment.trim() ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-900 text-white hover:bg-blue-600'}`}>
              등록
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CommunityView;
