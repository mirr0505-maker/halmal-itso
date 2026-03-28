// src/App.tsx — 루트 컴포넌트 (전역 상태, 실시간 리스너, 라우팅)
import { useState, useEffect, lazy, Suspense } from 'react';
import { db, auth, googleProvider } from './firebase';
import { signInWithPopup, signOut, setPersistence, browserLocalPersistence, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { serverTimestamp, doc, setDoc, updateDoc, increment, arrayUnion, arrayRemove, collection, onSnapshot, query, where } from 'firebase/firestore';
import type { Post, KanbuRoom, Community } from './types';
import { useFirebaseListeners } from './hooks/useFirebaseListeners';
// 항상 초기 화면에 필요한 컴포넌트 — 정적 import 유지
import AnyTalkList from './components/AnyTalkList';
import NotificationBell from './components/NotificationBell';
import Sidebar from './components/Sidebar';
import type { MenuId } from './components/Sidebar';
import SubNavbar from './components/SubNavbar';
import CategoryHeader from './components/CategoryHeader';
import { TEST_ACCOUNTS, MENU_MESSAGES, POST_FILTER, FRIENDS_MENU_ALLOWED_NICKNAMES, EXTERNAL_URLS } from './constants';
// 조건부 렌더링 컴포넌트 — lazy load (청크 분리)
const MyPage = lazy(() => import('./components/MyPage'));
const PostDetailModal = lazy(() => import('./components/PostDetailModal'));
const DiscussionView = lazy(() => import('./components/DiscussionView'));
const OneCutDetailView = lazy(() => import('./components/OneCutDetailView'));
const OneCutList = lazy(() => import('./components/OneCutList'));
const CreatePostBox = lazy(() => import('./components/CreatePostBox'));
const CreateOneCutBox = lazy(() => import('./components/CreateOneCutBox'));
const KanbuRoomList = lazy(() => import('./components/KanbuRoomList'));
const KanbuRoomView = lazy(() => import('./components/KanbuRoomView'));
const CreateKanbuRoomModal = lazy(() => import('./components/CreateKanbuRoomModal'));
const RankingView = lazy(() => import('./components/RankingView'));
const CreateDebate = lazy(() => import('./components/CreateDebate')); // 연계글 팝업 전용
// 🚀 우리들의 따뜻한 장갑: 커뮤니티 컴포넌트
const CommunityList = lazy(() => import('./components/CommunityList'));
const MyCommunityList = lazy(() => import('./components/MyCommunityList'));
const CommunityFeed = lazy(() => import('./components/CommunityFeed'));
const CommunityView = lazy(() => import('./components/CommunityView'));
const CreateCommunityModal = lazy(() => import('./components/CreateCommunityModal'));
const CREATE_MENU_COMPONENTS: Record<string, ReturnType<typeof lazy>> = {
  my_story:        lazy(() => import('./components/CreateMyStory')),
  naked_king:      lazy(() => import('./components/CreateNakedKing')),
  donkey_ears:     lazy(() => import('./components/CreateDebate')),
  knowledge_seller:lazy(() => import('./components/CreateKnowledge')),
  bone_hitting:    lazy(() => import('./components/CreateBoneHitting')),
  local_news:      lazy(() => import('./components/CreateLocalNews')),
  crying_boy:      lazy(() => import('./components/CreateCryingBoy')),
  exile_place:     lazy(() => import('./components/CreateExile')),
  market:          lazy(() => import('./components/CreateMarket')),
};

function App() {
  // Firebase 실시간 데이터 — useFirebaseListeners 훅에서 관리
  const {
    allRootPosts, setAllRootPosts,
    userData, setUserData,
    allUsers,
    followerCounts,
    friends,
    blocks,
    isLoading,
    kanbuRooms,
    communities,
    joinedCommunityIds,
    setJoinedCommunityIds,
  } = useFirebaseListeners();

  // 댓글 컬렉션 분리 — 상태
  const [allChildPosts, setAllChildPosts] = useState<Post[]>([]);
  const [myComments, setMyComments] = useState<Post[]>([]);

  // UI 전용 상태
  const [selectedTopic, setSelectedTopic] = useState<Post | null>(null);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [selectedSide, setSelectedSide] = useState<'left' | 'right'>('left');
  const [selectedType, setSelectedType] = useState<'comment' | 'formal'>('comment');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [replyTarget, setReplyTarget] = useState<Post | null>(null);
  const [activeMenu, setActiveMenu] = useState<MenuId>('home');
  const [activeTab, setActiveTab] = useState<'any' | 'recent' | 'best' | 'rank' | 'friend'>('any');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [linkedPostSide, setLinkedPostSide] = useState<'left' | 'right' | null>(null); // 솔로몬의 재판 연계글 팝업
  const [selectedRoom, setSelectedRoom] = useState<KanbuRoom | null>(null);
  const [isCreateRoomOpen, setIsCreateRoomOpen] = useState(false);
  // 🚀 우리들의 따뜻한 장갑: 커뮤니티 상태
  const [gloveSubTab, setGloveSubTab] = useState<'feed' | 'list'>('feed');
  const [selectedCommunity, setSelectedCommunity] = useState<Community | null>(null);
  const [isCreateCommunityOpen, setIsCreateCommunityOpen] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<string | null>(null);
  const [viewingAuthor, setViewingAuthor] = useState<string | null>(null);

  // 🚀 URL 공유 링크 처리: ?post=글ID 로 직접 접근 시 해당 글 자동 오픈
  // - lazy 초기화로 앱 마운트 시 딱 한 번만 URL 파라미터를 읽음
  // 🚀 모바일 드로어 메뉴 열림 여부
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  // 🚀 홈에서 새 글 쓰기 2단계 UX — 1단계(카테고리 선택) 후 설정되는 메뉴 키
  const [createMenuKey, setCreateMenuKey] = useState<string | null>(null);

  const [pendingSharedPostId, setPendingSharedPostId] = useState<string | null>(() =>
    new URLSearchParams(window.location.search).get('post')
  );

  const accessibleRooms = kanbuRooms.filter(r =>
    r.creatorNickname === userData?.nickname || friends.includes(r.creatorNickname)
  );

  useEffect(() => { if (replyTarget) { setSelectedType('comment'); setNewTitle(""); } }, [replyTarget]);
  useEffect(() => { setSelectedFriend(null); setViewingAuthor(null); }, [activeMenu, activeTab]);
  // 🚀 장갑 메뉴 이탈 시 커뮤니티 선택 초기화
  useEffect(() => { if (activeMenu !== 'glove') { setSelectedCommunity(null); } }, [activeMenu]);

  // 🚀 공유 링크로 접근 시: allRootPosts가 로드되면 해당 글을 찾아 자동으로 상세 뷰 오픈
  // - allRootPosts가 아직 빈 배열이면 대기, 로드 완료 후 실행
  // - 처리 완료 후 pendingSharedPostId를 null로 초기화해 재실행 방지
  useEffect(() => {
    if (!pendingSharedPostId || allRootPosts.length === 0) return;
    // topic_타임스탬프 로 시작하는 글 검색 (URL에 UID 노출 방지를 위해 타임스탬프까지만 공유)
    // 하위 호환: 구버전 전체 ID 직접 매칭도 지원
    const sharedPost = allRootPosts.find(p =>
      p.id === pendingSharedPostId || p.id.startsWith(pendingSharedPostId + '_')
    );
    if (sharedPost) {
      setSelectedTopic(sharedPost);
      setPendingSharedPostId(null);
      window.history.replaceState({}, '', window.location.pathname); // URL에서 ?post= 파라미터 제거
    }
  }, [allRootPosts, pendingSharedPostId]);

  // 댓글 컬렉션 분리 — per-topic 실시간 구독
  useEffect(() => {
    if (!selectedTopic) { setAllChildPosts([]); return; }
    const unsub = onSnapshot(
      query(collection(db, 'comments'), where('rootId', '==', selectedTopic.id)),
      (snap) => {
        const comments = snap.docs.map(d => ({ id: d.id, ...d.data() } as Post));
        comments.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setAllChildPosts(comments);
      },
      (err) => console.error('[comments onSnapshot]', err)
    );
    return unsub;
  }, [selectedTopic?.id]);

  // 내 댓글 구독 (MyPage 용)
  useEffect(() => {
    if (!userData?.uid) { setMyComments([]); return; }
    const unsub = onSnapshot(
      query(collection(db, 'comments'), where('author_id', '==', userData.uid)),
      (snap) => setMyComments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Post)))
    );
    return unsub;
  }, [userData?.uid]);

  const goHome = () => {
    setActiveMenu('home'); setSelectedTopic(null); setIsCreateOpen(false); setReplyTarget(null); setEditingPost(null); setCreateMenuKey(null);
    setSelectedRoom(null); setIsCreateRoomOpen(false);
    setActiveTab('any');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCreateRoom = async (data: Pick<KanbuRoom, 'title' | 'description'>) => {
    if (!userData) return;
    const roomId = `room_${Date.now()}_${userData.uid}`;
    await setDoc(doc(db, 'kanbu_rooms', roomId), {
      title: data.title,
      description: data.description || '',
      creatorId: userData.uid,
      creatorNickname: userData.nickname,
      creatorLevel: userData.level,
      createdAt: serverTimestamp(),
    });
    setIsCreateRoomOpen(false);
  };

  // 🚀 커뮤니티 개설 핸들러 — Lv3 이상 확인 후 communities 컬렉션에 문서 생성
  // GLOVE_CREATE_MIN_LEVEL 상수를 바꾸면 개설 레벨 조건 일괄 변경
  const GLOVE_CREATE_MIN_LEVEL = 3;
  const handleCreateCommunity = async (data: {
    name: string; description: string; category: string;
    isPrivate: boolean; coverColor?: string;
    joinType?: string; minLevel?: number; password?: string; joinQuestion?: string;
  }) => {
    if (!userData) return;
    if ((userData.level || 1) < GLOVE_CREATE_MIN_LEVEL) {
      alert(`커뮤니티 개설은 Lv${GLOVE_CREATE_MIN_LEVEL} 이상만 가능합니다. (현재 Lv${userData.level || 1})`);
      return;
    }
    const communityId = `community_${Date.now()}_${userData.uid}`;
    await setDoc(doc(db, 'communities', communityId), {
      name: data.name,
      description: data.description || '',
      category: data.category,
      isPrivate: data.isPrivate,
      coverColor: data.coverColor || '',
      creatorId: userData.uid,
      creatorNickname: userData.nickname,
      creatorLevel: userData.level || 1,
      memberCount: 1,
      postCount: 0,
      createdAt: serverTimestamp(),
      // 🚀 다섯 손가락 Phase 1 — 가입 조건
      joinType: data.joinType || 'open',
      minLevel: data.minLevel || 1,
      ...(data.password ? { password: data.password } : {}),
      ...(data.joinQuestion ? { joinQuestion: data.joinQuestion } : {}),
    });
    // 개설자를 community_memberships에 엄지(thumb)로 등록
    const membershipId = `${communityId}_${userData.uid}`;
    await setDoc(doc(db, 'community_memberships', membershipId), {
      communityId,
      communityName: data.name,
      userId: userData.uid,
      nickname: userData.nickname,
      role: 'owner',
      finger: 'thumb',       // 🚀 다섯 손가락: 개설자 = 엄지
      joinStatus: 'active',  // 🚀 가입 상태: 활성
      joinedAt: serverTimestamp(),
    });
    setIsCreateCommunityOpen(false);
    setGloveSubTab('feed');
  };

  // 🚀 커뮤니티 가입 핸들러 — joinType에 따라 즉시가입/대기 분기
  const handleJoinCommunity = async (community: Community) => {
    if (!userData) { alert('로그인이 필요합니다.'); return; }

    // 최소 레벨 체크
    const minLevel = community.minLevel || 1;
    if ((userData.level || 1) < minLevel) {
      alert(`이 장갑은 Lv${minLevel} 이상만 가입할 수 있습니다. (현재 Lv${userData.level || 1})`);
      return;
    }

    const joinType = community.joinType || 'open';

    // 초대 코드 방식: 비밀번호 입력 확인
    if (joinType === 'password') {
      const input = window.prompt('초대 코드를 입력해주세요:');
      if (!input) return;
      if (input.trim() !== (community.password || '').trim()) {
        alert('초대 코드가 올바르지 않습니다.');
        return;
      }
    }

    // 승인제 방식: 가입 신청 메시지 입력
    let joinMessage = '';
    if (joinType === 'approval') {
      const question = community.joinQuestion || '가입 인사말을 남겨주세요.';
      const input = window.prompt(question);
      if (!input) return;
      joinMessage = input.trim();
    }

    const isApprovalPending = joinType === 'approval';
    const membershipId = `${community.id}_${userData.uid}`;
    await setDoc(doc(db, 'community_memberships', membershipId), {
      communityId: community.id,
      communityName: community.name,
      userId: userData.uid,
      nickname: userData.nickname,
      role: 'member',
      finger: isApprovalPending ? 'pinky' : 'ring',   // 🚀 대기=새끼, 승인=약지
      joinStatus: isApprovalPending ? 'pending' : 'active',
      ...(joinMessage ? { joinMessage } : {}),
      joinedAt: serverTimestamp(),
    });

    if (!isApprovalPending) {
      // 즉시 가입(open/password): memberCount 증가 + 로컬 상태 반영
      await updateDoc(doc(db, 'communities', community.id), { memberCount: increment(1) });
      setJoinedCommunityIds(prev => [...prev, community.id]);
      alert(`'${community.name}' 장갑에 가입되었습니다!`);
    } else {
      // 승인제: memberCount 증가 없음, 대기 안내
      alert(`가입 신청이 완료되었습니다.\n관리자 승인 후 활동할 수 있습니다.`);
    }
  };

  // 🚀 커뮤니티 탈퇴 핸들러 — membership 문서 삭제 + memberCount decrement + 로컬 상태 즉시 반영
  const handleLeaveCommunity = async (community: Community) => {
    if (!userData) return;
    if (!window.confirm(`'${community.name}'에서 탈퇴하시겠소?`)) return;
    const membershipId = `${community.id}_${userData.uid}`;
    const { deleteDoc } = await import('firebase/firestore');
    await deleteDoc(doc(db, 'community_memberships', membershipId));
    await updateDoc(doc(db, 'communities', community.id), { memberCount: increment(-1) });
    setJoinedCommunityIds(prev => prev.filter(id => id !== community.id));
  };

  // 🚀 인앱 브라우저 감지 — 카카오톡/인스타그램/라인 등 WebView는 Google OAuth 차단됨
  const detectInAppBrowser = (): 'kakao' | 'instagram' | 'other' | null => {
    const ua = navigator.userAgent;
    if (/KAKAOTALK/i.test(ua)) return 'kakao';
    if (/Instagram/i.test(ua)) return 'instagram';
    if (/FBAN|FBAV|FB_IAB/i.test(ua)) return 'other'; // 페이스북
    if (/Line\//i.test(ua)) return 'other';
    return null;
  };

  // 🚀 외부 브라우저 강제 열기 — Android: Chrome intent URL, iOS: 현재 URL 복사 안내
  const openExternalBrowser = () => {
    const currentUrl = window.location.href;
    const isAndroid = /Android/i.test(navigator.userAgent);
    if (isAndroid) {
      // Android: Chrome으로 강제 이동
      window.location.href = `intent://${currentUrl.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end;`;
    } else {
      // iOS: 클립보드에 복사 후 안내
      navigator.clipboard?.writeText(currentUrl).then(() => {
        alert('URL이 복사되었습니다.\nSafari를 열고 주소창에 붙여넣기(붙여넣기) 해주세요.');
      }).catch(() => {
        alert(`아래 주소를 Safari에서 열어주세요:\n${currentUrl}`);
      });
    }
  };

  const handleLogin = async () => {
    // 🚀 인앱 브라우저 차단 — Google은 WebView에서 OAuth를 허용하지 않음
    const inAppType = detectInAppBrowser();
    if (inAppType) {
      const appName = inAppType === 'kakao' ? '카카오톡' : inAppType === 'instagram' ? '인스타그램' : '현재 앱';
      const isAndroid = /Android/i.test(navigator.userAgent);
      const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
      if (isAndroid) {
        if (window.confirm(`${appName} 내부 브라우저에서는 구글 로그인이 지원되지 않습니다.\n\nChrome 브라우저에서 열겠습니까?`)) {
          openExternalBrowser();
        }
      } else if (isIOS) {
        alert(`${appName} 내부 브라우저에서는 구글 로그인이 지원되지 않습니다.\n\n[확인]을 누르면 주소가 복사됩니다.\nSafari 앱을 열고 주소창에 붙여넣기 해주세요.`);
        openExternalBrowser();
      } else {
        alert(`${appName} 내부 브라우저에서는 구글 로그인이 지원되지 않습니다.\n기기의 기본 브라우저(Chrome, Safari)에서 열어주세요.`);
      }
      return;
    }
    try {
      await setPersistence(auth, browserLocalPersistence);
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error("로그인 에러:", error);
      alert("로그인 중 오류가 발생했소: " + (error.message || "원인 불명"));
    }
  };

  const handleTestLogin = async (testUser: typeof TEST_ACCOUNTS[0]) => {
    if (isLoading) return;

    try {
      if (userData) {
        await signOut(auth);
      }
      await setPersistence(auth, browserLocalPersistence);
      try {
        await signInWithEmailAndPassword(auth, testUser.email, "123456");
      } catch (loginError: any) {
        if (loginError.code === 'auth/user-not-found' || loginError.code === 'auth/invalid-credential') {
          const res = await createUserWithEmailAndPassword(auth, testUser.email, "123456");
          const initialData = {
            nickname: testUser.nickname,
            email: testUser.email,
            bio: testUser.bio,
            level: testUser.level || 1, exp: 0, likes: 0, points: 0,
            subscriberCount: 0, isPhoneVerified: true,
            friendList: [], blockList: [], avatarUrl: "", createdAt: serverTimestamp()
          };
          await setDoc(doc(db, "users", res.user.uid), initialData);
          setUserData({ ...initialData, uid: res.user.uid });
        } else { throw loginError; }
      }
    } catch (error: any) {
      console.error("로그인 에러:", error);
      alert("깐부 로그인 중 오류가 발생했소: " + (error.message || "원인 불명"));
    }
  };

  const handleLogout = async () => {
    if (window.confirm("정말 로그아웃 하시겠소?")) {
      await signOut(auth);
      setUserData(null);
      setActiveMenu('home');
    }
  };

  const filterBySearch = (posts: Post[]) => {
    let filtered = posts;
    if (blocks.length > 0) filtered = filtered.filter(p => !blocks.includes(p.author));
    if (!searchQuery.trim()) return filtered;
    const query = searchQuery.toLowerCase();
    return filtered.filter(p => (p.title?.toLowerCase().includes(query)) || (p.content.toLowerCase().includes(query)));
  };

  const commentCounts = allRootPosts.reduce((acc, post) => {
    acc[post.id] = post.commentCount || 0;
    return acc;
  }, {} as Record<string, number>);

  const toggleFriend = async (author: string) => {
    if (!userData) return;
    const isFriend = friends.includes(author);
    try { await updateDoc(doc(db, "users", userData.uid), { friendList: isFriend ? arrayRemove(author) : arrayUnion(author) }); } catch (e) { console.error(e); }
  };

  const toggleBlock = async (author: string) => {
    if (!userData) return;
    if (author === userData.nickname) { alert("본인은 차단할 수 없습니다!"); return; }
    const isBlocked = blocks.includes(author);
    if (!isBlocked && !window.confirm(`${author}님을 차단하시겠소? 모든 게시글이 숨겨집니다.`)) return;
    try { await updateDoc(doc(db, "users", userData.uid), { blockList: isBlocked ? arrayRemove(author) : arrayUnion(author) }); } catch (e) { console.error(e); }
  };

  const handleLike = async (e: any, postId: string) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (!userData) { alert("로그인이 필요합니다!"); return; }
    try {
      const targetPost = [...allRootPosts, ...allChildPosts].find(p => p.id === postId);
      if (!targetPost) return;
      const isLiked = targetPost.likedBy?.includes(userData.nickname);
      const diff = isLiked ? -1 : 1;
      const col = targetPost.rootId ? 'comments' : 'posts';
      await updateDoc(doc(db, col, postId), { likes: Math.max(0, (targetPost.likes || 0) + diff), likedBy: isLiked ? arrayRemove(userData.nickname) : arrayUnion(userData.nickname) });
      if (targetPost.author_id) await updateDoc(doc(db, "users", targetPost.author_id), { likes: increment(diff * 3) });
    } catch (e) { console.error(e); }
  };

  const handleViewPost = (post: Post) => {
    setSelectedTopic(post);
    // 자기 글 제외 + 세션 내 중복 방지 (새로고침마다 카운트 방지)
    if (!userData || userData.nickname === post.author) return;
    const sessionKey = `viewed_${post.id}`;
    if (sessionStorage.getItem(sessionKey)) return;
    sessionStorage.setItem(sessionKey, '1');
    updateDoc(doc(db, 'posts', post.id), { viewCount: increment(1) }).catch(() => {});
  };

  const renderContent = () => {
    if (isLoading) return (
      <div className="w-full flex flex-col items-center justify-center py-40 gap-3">
        <h1 className="text-[36px] font-[1000] italic tracking-tighter animate-logo-pulse">
          <span className="text-blue-600">GL</span><span className="text-slate-900">ove</span>
        </h1>
        <p className="text-[11px] font-black text-slate-300 tracking-tight">집단지성의 힘</p>
      </div>
    );
    
    if (isCreateOpen) {
      if (activeMenu === 'onecut' || editingPost?.isOneCut || selectedTopic?.isOneCut) {
        return <CreateOneCutBox userData={userData} editingPost={editingPost} allPosts={allRootPosts} onSubmit={handlePostSubmit} onClose={() => { setIsCreateOpen(false); setEditingPost(null); }} />;
      }
      // 솔로몬의 재판 연계글 팝업 — linkedPostSide가 있으면 CreateDebate를 연계글 모드로 렌더링
      if (linkedPostSide !== null) {
        return <CreateDebate userData={userData} editingPost={null} onSubmit={handleLinkedPostSubmit} onClose={() => { setIsCreateOpen(false); setLinkedPostSide(null); }} linkedTitle="[연계글]" linkedSide={linkedPostSide} originalPost={selectedTopic ?? undefined} />;
      }

      // 🚀 홈 2단계 UX — activeMenu가 'home'이고 카테고리 미선택 시 카테고리 선택 카드 화면 표시
      if (activeMenu === 'home' && !editingPost && createMenuKey === null) {
        const CATEGORY_CARD_KEYS = ['my_story', 'naked_king', 'donkey_ears', 'knowledge_seller', 'bone_hitting', 'local_news', 'crying_boy', 'onecut'] as const;
        return (
          <div className="w-full max-w-2xl mx-auto py-8 px-4 animate-in fade-in">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-[1000] text-slate-900">어떤 글을 쓸까요?</h2>
              <button onClick={() => { setIsCreateOpen(false); setCreateMenuKey(null); }} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {CATEGORY_CARD_KEYS.map(key => {
                const info = MENU_MESSAGES[key];
                if (!info) return null;
                return (
                  <button
                    key={key}
                    onClick={() => {
                      if (key === 'onecut') {
                        // 한컷은 activeMenu를 변경하지 않고 직접 CreateOneCutBox를 열기 위해 별도 처리
                        setCreateMenuKey('onecut');
                      } else {
                        setCreateMenuKey(key);
                      }
                    }}
                    className="flex flex-col items-start gap-2 p-4 rounded-2xl border border-slate-100 bg-white hover:border-blue-200 hover:bg-blue-50/40 transition-all text-left shadow-sm"
                  >
                    <span className="text-2xl">{info.emoji}</span>
                    <span className="text-[13px] font-[1000] text-slate-900">{info.title}</span>
                    <span className="text-[11px] text-slate-400 font-medium line-clamp-2 leading-relaxed">{info.description}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      }

      // 🚀 홈 2단계 UX — 카테고리 선택 후 또는 카테고리 메뉴에서 직접 진입: 전용 폼 렌더링
      const resolvedKey = createMenuKey ?? activeMenu;
      if (resolvedKey === 'onecut') {
        return <CreateOneCutBox userData={userData} editingPost={editingPost} allPosts={allRootPosts} onSubmit={handlePostSubmit} onClose={() => { setIsCreateOpen(false); setEditingPost(null); setCreateMenuKey(null); }} />;
      }
      if (resolvedKey && CREATE_MENU_COMPONENTS[resolvedKey]) {
        const CreateComponent = CREATE_MENU_COMPONENTS[resolvedKey];
        return <CreateComponent userData={userData} editingPost={editingPost} onSubmit={handlePostSubmit} onClose={() => { setIsCreateOpen(false); setEditingPost(null); setCreateMenuKey(null); }} />;
      }
      return <CreatePostBox userData={userData} editingPost={editingPost} activeMenu={activeMenu} menuMessages={MENU_MESSAGES} onSubmit={handlePostSubmit} onClose={() => { setIsCreateOpen(false); setEditingPost(null); setCreateMenuKey(null); }} />;
    }
    
    if (activeMenu === 'mypage') {
      if (userData) {
        const userPosts = allRootPosts.filter(p => p.author_id === userData.uid || p.author === userData.nickname);
        const userComments = myComments;
        return <MyPage
          userData={userData}
          allUserRootPosts={userPosts}
          allUserChildPosts={userComments}
          friends={friends}
          friendCount={followerCounts[userData.nickname] || 0}
          onPostClick={handleViewPost}
          onEditPost={(post) => { setEditingPost(post); setIsCreateOpen(true); }}
          onToggleFriend={toggleFriend}
          allUsers={allUsers}
          followerCounts={followerCounts}
          toggleBlock={toggleBlock}
          blocks={blocks}
          communities={communities}
          joinedCommunityIds={joinedCommunityIds}
          onGloveClick={(communityId) => {
            setActiveMenu('glove');
            setGloveSubTab('feed');
            if (communityId) {
              const target = communities.find(c => c.id === communityId);
              if (target) setSelectedCommunity(target);
            }
          }}
          onLeaveGlove={(communityId) => {
            const target = communities.find(c => c.id === communityId);
            if (target) handleLeaveCommunity(target);
          }}
          onLogout={handleLogout}
        />;
      }
      return <div className="w-full py-40 text-center"><button onClick={handleLogin} className="bg-slate-900 text-white px-8 py-3 rounded-xl font-black shadow-lg">로그인하기</button></div>;
    }

    if (activeMenu === 'friends') {
      // 개발 단계: FRIENDS_MENU_ALLOWED_NICKNAMES에 등록된 닉네임만 표시 (실 서비스 시 전체 유저로 변경)
      const others = Object.values(allUsers).filter(u => u.nickname && u.nickname !== userData?.nickname && !u.uid.startsWith('nickname_') && FRIENDS_MENU_ALLOWED_NICKNAMES.includes(u.nickname));
      return (
        <div className="w-full max-w-4xl mx-auto py-10 px-4 animate-in fade-in">
          <div className="text-center mb-12"><h2 className="text-3xl font-[1000] text-slate-900 mb-2">🤝 깐부 맺기 홍보</h2><p className="text-slate-500 font-bold">새로운 인연을 맺고 깊은 토론을 나눠보세요.</p></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{others.map(u => (
            <div key={u.uid} className="bg-white border border-slate-100 p-6 rounded-2xl flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-4"><div className="w-14 h-14 rounded-full overflow-hidden bg-slate-50 shrink-0"><img src={u.avatarUrl || `${EXTERNAL_URLS.AVATAR_BASE}${u.nickname}`} alt="" className="w-full h-full object-cover" /></div><div><h3 className="font-[1000] text-slate-900">{u.nickname}</h3><p className="text-xs text-slate-400 font-bold">깐부 {followerCounts[u.nickname] || 0} · 좋아요 {u.likes?.toLocaleString() || 0}</p></div></div>
              <button onClick={() => toggleFriend(u.nickname)} className={`px-5 py-2 rounded-xl text-xs font-black transition-all ${friends.includes(u.nickname) ? 'bg-slate-100 text-slate-400' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-md'}`}>{friends.includes(u.nickname) ? '깐부해제' : '+ 깐부맺기'}</button>
            </div>
          ))}</div>
        </div>
      );
    }

    if (activeMenu === 'market') {
      const marketPosts = allRootPosts.filter(p => p.category === "마켓");
      return (
        <div className="w-full animate-in fade-in">
          {marketPosts.length > 0
            ? <OneCutList posts={marketPosts} allPosts={allRootPosts} onTopicClick={handleViewPost} onLikeClick={handleLike} currentNickname={userData?.nickname} allUsers={allUsers} followerCounts={followerCounts} onEditClick={(post) => { setEditingPost(post); setIsCreateOpen(true); }} />
            : <div className="py-40 text-center text-slate-300 font-black text-sm">기록된 글이 없어요</div>
          }
        </div>
      );
    }

    // 🚀 우리들의 장갑: 커뮤니티 라우팅 — 2탭(소곤소곤·장갑찾기) + 우측 내 장갑 사이드바
    if (activeMenu === 'glove') {
      return (
        <div className="w-full animate-in fade-in">
          {/* 🚀 상단 바 — 타이틀 + 탭 2개 + 장갑 만들기 버튼 한 줄에 통합 */}
          <div className="sticky top-0 z-30 bg-[#F8FAFC]/80 backdrop-blur-md pt-2">
            <div className="flex items-center justify-between border-b border-slate-200 h-[44px] px-4 gap-3">
              {/* 좌: 타이틀 */}
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-blue-600 font-black text-[15px]">#</span>
                <h2 className="text-[14px] font-[1000] text-slate-900 tracking-tighter whitespace-nowrap">우리들의 장갑</h2>
                <div className="w-px h-3 bg-slate-200 mx-1.5 hidden md:block" />
                <p className="text-[11px] font-bold text-slate-400 hidden md:block whitespace-nowrap">관심사가 같은 사람들이 모이는 따뜻한 커뮤니티</p>
              </div>
              {/* 우: 탭 2개 + 장갑 만들기 버튼 */}
              <div className="flex items-center gap-1.5 shrink-0">
                {([{ id: 'feed', label: '💬 소곤소곤', desc: '가입 장갑 피드' }, { id: 'list', label: '🧤 장갑 찾기', desc: '전체 커뮤니티' }] as const).map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => { setGloveSubTab(tab.id); setSelectedCommunity(null); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all ${
                      gloveSubTab === tab.id
                        ? 'bg-blue-50 border-blue-200 text-blue-700'
                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-[12px] font-[1000] whitespace-nowrap">{tab.label}</span>
                    <span className={`text-[10px] font-bold hidden md:inline whitespace-nowrap ${gloveSubTab === tab.id ? 'text-blue-400' : 'text-slate-300'}`}>{tab.desc}</span>
                  </button>
                ))}
                <button
                  onClick={() => setIsCreateCommunityOpen(true)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-blue-600 text-white border border-slate-900 hover:border-blue-600 transition-all"
                >
                  <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
                  <span className="text-[11px] font-[1000] whitespace-nowrap hidden md:inline">장갑 만들기</span>
                </button>
              </div>
            </div>
            <div className="h-3" />
          </div>
          {/* 🚀 2컬럼 레이아웃 — 메인(피드/목록) + 우측(내 장갑 사이드바, 데스크톱만) */}
          <div className="flex gap-4 items-start">
            {/* 메인 컨텐츠 영역 */}
            <div className="flex-1 min-w-0">
              {selectedCommunity ? (
                <CommunityView
                  community={selectedCommunity}
                  currentUserData={userData}
                  allUsers={allUsers}
                  onBack={() => setSelectedCommunity(null)}
                  onClosed={() => setSelectedCommunity(null)}
                />
              ) : gloveSubTab === 'feed' ? (
                <CommunityFeed
                  currentUserData={userData}
                  joinedCommunityIds={joinedCommunityIds}
                  allUsers={allUsers}
                  onCommunityClick={setSelectedCommunity}
                />
              ) : (
                <CommunityList
                  communities={communities}
                  currentUserData={userData}
                  joinedCommunityIds={joinedCommunityIds}
                  onCommunityClick={setSelectedCommunity}
                  onJoin={handleJoinCommunity}
                />
              )}
            </div>
            {/* 🚀 우측 사이드바 — 내가 가입한 장갑 목록 (데스크톱만) */}
            <div className="hidden md:block w-64 shrink-0">
              <div className="sticky top-[60px]">
                <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                    <span className="text-[13px] font-[1000] text-slate-900">❤️ 나의 아늑한 장갑</span>
                  </div>
                  <MyCommunityList
                    communities={communities}
                    joinedCommunityIds={joinedCommunityIds}
                    onCommunityClick={(c) => { setSelectedCommunity(c); }}
                    onLeave={handleLeaveCommunity}
                    compact={true}
                  />
                </div>
              </div>
            </div>
          </div>
          {isCreateCommunityOpen && (
            <CreateCommunityModal
              userData={userData}
              onSubmit={handleCreateCommunity}
              onClose={() => setIsCreateCommunityOpen(false)}
            />
          )}
        </div>
      );
    }

    if (activeMenu === 'kanbu_room') {
      if (selectedRoom) {
        const roomPosts = allRootPosts.filter(p => p.kanbuRoomId === selectedRoom.id);
        return <KanbuRoomView room={selectedRoom} roomPosts={roomPosts} onBack={() => setSelectedRoom(null)} currentUserData={userData} allUsers={allUsers} />;
      }
      return <KanbuRoomList rooms={accessibleRooms} onRoomClick={setSelectedRoom} onCreateRoom={() => setIsCreateRoomOpen(true)} currentUserLevel={userData?.level || 1} allUsers={allUsers} />;
    }

    if (activeMenu === 'ranking') {
      return <RankingView allRootPosts={allRootPosts.filter(p => !p.isOneCut)} allUsers={allUsers} onPostClick={handleViewPost} />;
    }

    if (selectedTopic) {
      const livePost = allRootPosts.find(p => p.id === selectedTopic.id) || selectedTopic;
      // 🚀 한컷 판정 로직 강화: isOneCut 플래그 또는 카테고리명이 "한컷"인 경우
      if (livePost.isOneCut || livePost.category === "한컷") {
        return <OneCutDetailView rootPost={livePost} allPosts={allChildPosts.filter(p => p.rootId === livePost.id)} otherTopics={allRootPosts} onTopicChange={handleViewPost} userData={userData} friends={friends} handleSubmit={handleCommentSubmit} selectedSide={selectedSide} setSelectedSide={setSelectedSide} newContent={newContent} setNewContent={setNewContent} isSubmitting={isSubmitting} onLikeClick={handleLike} currentNickname={userData?.nickname} allUsers={allUsers} followerCounts={followerCounts} commentCounts={commentCounts} onEditPost={(post) => { setEditingPost(post); setIsCreateOpen(true); }} />;
      }
      return <DiscussionView rootPost={livePost} allPosts={allChildPosts.filter(p => p.rootId === livePost.id)} otherTopics={allRootPosts.filter(p => {
          if (p.id === livePost.id) return false;
          const myStory = ['너와 나의 이야기'];
          const liveIsMyStory = !livePost.category || myStory.includes(livePost.category);
          if (liveIsMyStory) return !p.category || myStory.includes(p.category || '');
          return p.category === livePost.category;
        })} onTopicChange={handleViewPost} userData={userData} friends={friends} onToggleFriend={toggleFriend} onPostClick={() => {}} replyTarget={replyTarget} setReplyTarget={setReplyTarget} handleSubmit={handleCommentSubmit} selectedSide={selectedSide} setSelectedSide={setSelectedSide} selectedType={selectedType} setSelectedType={setSelectedType} newTitle={newTitle} setNewTitle={setNewTitle} newContent={newContent} setNewContent={setNewContent} isSubmitting={isSubmitting} commentCounts={commentCounts} onLikeClick={handleLike} currentNickname={userData?.nickname} allUsers={allUsers} followerCounts={followerCounts} toggleBlock={toggleBlock} onEditPost={(post) => { setEditingPost(post); setIsCreateOpen(true); }} onInlineReply={handleInlineReply} onOpenLinkedPost={(side) => { setLinkedPostSide(side); setIsCreateOpen(true); }} onNavigateToPost={(postId) => { const target = allRootPosts.find(p => p.id === postId); if (target) handleViewPost(target); }} onBack={() => { setSelectedTopic(null); setReplyTarget(null); setEditingPost(null); }} />;
    }

    if (activeMenu === 'onecut') {
      const onecutPosts = allRootPosts.filter(p => p.isOneCut);
      return <div className="w-full animate-in fade-in"><OneCutList posts={onecutPosts} allPosts={allRootPosts} onTopicClick={handleViewPost} onLikeClick={handleLike} currentNickname={userData?.nickname} allUsers={allUsers} followerCounts={followerCounts} onEditClick={(post) => { setEditingPost(post); setIsCreateOpen(true); }} /></div>;
    }

    // 🚀 포스트 필터링 및 탭 처리
    let basePosts = allRootPosts.filter(p => !p.isOneCut);
    
    if (activeMenu !== 'home' && MENU_MESSAGES[activeMenu]) {
      const menuInfo = MENU_MESSAGES[activeMenu];
      const categoryKey = menuInfo.title;
      basePosts = basePosts.filter(p =>
        menuInfo.title === "너와 나의 이야기"
          ? (p.category === "너와 나의 이야기" || p.category === undefined)
          : (p.category === categoryKey)
      );
      // 🚀 카테고리별 보기: 살아남은 글(좋아요 3개 이상)만 노출
      const categoryPosts = basePosts.filter(p => (p.likes || 0) >= 3);
      const searchedPosts = filterBySearch(categoryPosts);
      return (
        <div className="w-full animate-in fade-in">
          <AnyTalkList posts={searchedPosts} onTopicClick={handleViewPost} onLikeClick={handleLike} commentCounts={commentCounts} currentNickname={userData?.nickname} currentUserData={userData} allUsers={allUsers} followerCounts={followerCounts} />
        </div>
      );
    }

    const now = new Date();
    const newPostCutoff = new Date(now.getTime() - POST_FILTER.NEW_POST_WINDOW_MS); // 새글/등록글 경계 시각

    let filteredPosts = basePosts;
    if (activeTab === 'any') {
      // 새글: 게시 후 NEW_POST_WINDOW_MS(2시간) 이내
      filteredPosts = basePosts.filter(p => {
        const createdAt = p.createdAt?.toDate ? p.createdAt.toDate() : (p.createdAt?.seconds ? new Date(p.createdAt.seconds * 1000) : null);
        return createdAt && createdAt > newPostCutoff;
      });
    } else if (activeTab === 'recent') {
      // 등록글: 새글 심사 통과 — 2시간 경과 + 좋아요 REGISTERED_MIN_LIKES(3개) 이상
      filteredPosts = basePosts.filter(p => {
        const createdAt = p.createdAt?.toDate ? p.createdAt.toDate() : (p.createdAt?.seconds ? new Date(p.createdAt.seconds * 1000) : null);
        return (p.likes || 0) >= POST_FILTER.REGISTERED_MIN_LIKES && (!createdAt || createdAt <= newPostCutoff);
      });
    } else if (activeTab === 'best') {
      filteredPosts = basePosts.filter(p => (p.likes || 0) >= POST_FILTER.BEST_MIN_LIKES);
    } else if (activeTab === 'rank') {
      filteredPosts = basePosts.filter(p => (p.likes || 0) >= POST_FILTER.RANK_MIN_LIKES);
    } else if (activeTab === 'friend') {
      // 깐부글: 좋아요 REGISTERED_MIN_LIKES(3개) 이상 + 팔로우 유저 (시간 제한 없음)
      filteredPosts = basePosts.filter(p =>
        friends.includes(p.author) && (p.likes || 0) >= POST_FILTER.REGISTERED_MIN_LIKES
      );
      // 특정 깐부 선택 시 추가 필터
      if (selectedFriend) filteredPosts = filteredPosts.filter(p => p.author === selectedFriend);
    }

    // 특정 작가 피드 보기 (A 탭 칩 또는 글카드 작가 클릭)
    if (viewingAuthor) {
      const authorPosts = filterBySearch(basePosts.filter(p => p.author === viewingAuthor));
      const avatarSrc = `${EXTERNAL_URLS.AVATAR_BASE}${viewingAuthor}`;
      return (
        <div className="w-full animate-in fade-in">
          <div className="flex items-center gap-2 px-1 py-2 mb-1">
            <img src={avatarSrc} className="w-7 h-7 rounded-full bg-slate-100" alt="" />
            <span className="font-[1000] text-slate-800 text-sm">{viewingAuthor}의 글</span>
            <span className="text-xs text-slate-400 font-bold">({authorPosts.length})</span>
            <button onClick={() => setViewingAuthor(null)} className="ml-auto w-6 h-6 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-400 transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
          <AnyTalkList posts={authorPosts} onTopicClick={handleViewPost} onLikeClick={handleLike} commentCounts={commentCounts} currentNickname={userData?.nickname} currentUserData={userData} allUsers={allUsers} followerCounts={followerCounts} tab={activeTab} onAuthorClick={setViewingAuthor} />
        </div>
      );
    }

    const searchedPosts = filterBySearch(filteredPosts);

    return (
      <div className="w-full animate-in fade-in">
        {/* 깐부글 탭: 깐부 아바타 칩 가로 스크롤 */}
        {activeTab === 'friend' && friends.length > 0 && (
          <div className="flex items-center gap-2 px-1 pb-3 overflow-x-auto">
            <button
              onClick={() => setSelectedFriend(null)}
              className={`flex items-center px-3 py-1.5 rounded-full text-[11px] font-[1000] transition-all shrink-0 ${!selectedFriend ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
            >전체</button>
            {friends.map(nick => (
              <button
                key={nick}
                onClick={() => setSelectedFriend(selectedFriend === nick ? null : nick)}
                className={`flex items-center gap-1.5 pl-1.5 pr-3 py-1 rounded-full text-[11px] font-[1000] transition-all shrink-0 ${selectedFriend === nick ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
              >
                <img src={`${EXTERNAL_URLS.AVATAR_BASE}${nick}`} className="w-5 h-5 rounded-full bg-white" alt="" />
                {nick}
              </button>
            ))}
          </div>
        )}
        <AnyTalkList posts={searchedPosts} onTopicClick={handleViewPost} onLikeClick={handleLike} commentCounts={commentCounts} currentNickname={userData?.nickname} currentUserData={userData} allUsers={allUsers} followerCounts={followerCounts} tab={activeTab} onAuthorClick={setViewingAuthor} />
      </div>
    );
  };

  const handlePostSubmit = async (postData: Partial<Post>, postId?: string) => {
    if (!userData) return;
    try {
      if (postId) {
        await updateDoc(doc(db, "posts", postId), postData);
        // onSnapshot 지연 대비: allRootPosts와 selectedTopic 즉시 갱신
        setAllRootPosts(prev => prev.map(p => p.id === postId ? { ...p, ...postData } : p));
        setSelectedTopic(prev => prev && prev.id === postId ? { ...prev, ...postData } : prev);
      } else {
        const customId = `topic_${Date.now()}_${userData.uid}`;
        await setDoc(doc(db, "posts", customId), {
          ...postData, author: userData.nickname, author_id: userData.uid,
          authorInfo: { level: userData.level, friendCount: friends.length, totalLikes: userData.likes },
          parentId: null, rootId: null, side: 'left', type: 'formal', createdAt: serverTimestamp(), likes: 0, dislikes: 0
        });
        await updateDoc(doc(db, "users", userData.uid), { likes: increment(5) });
      }
      setIsCreateOpen(false); setEditingPost(null); setCreateMenuKey(null);
      setActiveMenu('home'); setActiveTab('any'); // 🚀 글 작성 완료 후 새글 탭으로 이동
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e: any) {
      alert(`저장 실패: ${e?.message || '알 수 없는 오류'}`);
    }
  };

  // 🚀 솔로몬의 재판 연계글 제출: 새 글 생성 후 현재 솔로몬 글로 돌아옴 (홈으로 이동 안 함)
  const handleLinkedPostSubmit = async (postData: Partial<Post>) => {
    if (!userData) return;
    try {
      const customId = `topic_${Date.now()}_${userData.uid}`;
      await setDoc(doc(db, "posts", customId), {
        ...postData, author: userData.nickname, author_id: userData.uid,
        authorInfo: { level: userData.level, friendCount: friends.length, totalLikes: userData.likes },
        parentId: null, rootId: null, side: 'left', type: 'formal', createdAt: serverTimestamp(), likes: 0, dislikes: 0
      });
      await updateDoc(doc(db, "users", userData.uid), { likes: increment(5) });
      setIsCreateOpen(false);
      setLinkedPostSide(null);
      // selectedTopic 유지 → 솔로몬의 재판 원글로 돌아감
    } catch (e: any) {
      alert(`연계글 저장 실패: ${e?.message || '알 수 없는 오류'}`);
    }
  };

  const handleInlineReply = async (content: string, parentPost: Post | null, side?: 'left' | 'right', imageUrl?: string, linkUrl?: string) => {
    if (!userData || !content.trim() || !selectedTopic) return;
    const customId = `comment_${Date.now()}_${userData.uid}`;
    try {
      await setDoc(doc(db, "comments", customId), { author: userData.nickname, author_id: userData.uid, title: null, content, parentId: parentPost ? parentPost.id : selectedTopic.id, rootId: selectedTopic.id, side: side || 'left', type: 'comment', authorInfo: { level: userData.level, friendCount: friends.length, totalLikes: userData.likes }, createdAt: serverTimestamp(), likes: 0, dislikes: 0, ...(imageUrl ? { imageUrl } : {}), ...(linkUrl ? { linkUrl } : {}) });
      await updateDoc(doc(db, "posts", selectedTopic.id), { commentCount: increment(1) });
      await updateDoc(doc(db, "users", userData.uid), { likes: increment(1) });
    } catch (e: any) {
      console.error('[handleInlineReply]', e);
      alert('댓글 등록에 실패했습니다: ' + e.message);
      throw e;
    }
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!userData || !newContent.trim() || !selectedTopic) return;
    setIsSubmitting(true);
    const customId = `comment_${Date.now()}_${userData.uid}`;
    try {
      await setDoc(doc(db, "comments", customId), { author: userData.nickname, author_id: userData.uid, title: selectedType === 'formal' ? newTitle : null, content: newContent, parentId: replyTarget ? replyTarget.id : selectedTopic.id, rootId: selectedTopic.id, side: selectedSide, type: selectedType, authorInfo: { level: userData.level, friendCount: friends.length, totalLikes: userData.likes }, createdAt: serverTimestamp(), likes: 0, dislikes: 0 });
      await updateDoc(doc(db, "posts", selectedTopic.id), { commentCount: increment(1) });
      await updateDoc(doc(db, "users", userData.uid), { likes: increment(selectedType === 'formal' ? 2 : 1) });
      setNewTitle(""); setNewContent(""); setReplyTarget(null);
    } catch (e: any) {
      console.error('[handleCommentSubmit]', e);
      alert('댓글 등록에 실패했습니다: ' + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-[#F8FAFC] text-slate-900 font-sans h-screen flex flex-col overflow-hidden">
      <header className="bg-white border-b border-slate-100 h-[56px] md:h-[64px] flex items-center justify-between px-4 md:px-6 shrink-0 z-50 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-40 flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity shrink-0" onClick={goHome}><h1 className="text-[22px] font-[1000] italic tracking-tighter shrink-0"><span className="text-blue-600">GL</span><span className="text-slate-900">ove</span></h1><div className="flex flex-col"><span className="text-[11px] font-[1000] text-slate-500 tracking-tight leading-tight">글러브</span><span className="text-[9px] font-black text-slate-300 tracking-tight leading-tight">집단지성의 힘</span></div></div>
          <div className="hidden md:flex gap-1.5 items-center px-4 border-l border-slate-100" onClick={(e) => e.stopPropagation()}>
            <span className="text-[9px] font-black text-slate-300 uppercase tracking-tighter mr-1">Dev:</span>
            {TEST_ACCOUNTS.map((acc, i) => (
              <button key={i} onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleTestLogin(acc); }} className={`text-[10px] font-bold px-2 py-1 rounded border transition-all ${userData?.nickname === acc.nickname ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-500 hover:text-blue-600 border-slate-100 hover:bg-white'}`}>{acc.nickname}</button>
            ))}
          </div>
        </div>
        <div className="hidden md:flex flex-1 justify-center h-full items-center px-4"><div className="relative flex items-center bg-slate-50/80 rounded-full px-4 h-[42px] border border-slate-100 focus-within:border-blue-500 focus-within:bg-white transition-all w-full max-w-sm"><svg className="w-4 h-4 text-slate-400 mr-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg><input type="text" placeholder="검색어를 입력해 주세요." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="bg-transparent outline-none w-full text-[13px] font-bold text-slate-700" /></div></div>
        {/* 🚀 데스크톱 우측 액션 — 모바일에서 숨김 */}
        <div className="hidden md:flex items-center gap-4 ml-auto shrink-0">{isLoading ? <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div> : userData ? <><button onClick={() => setIsCreateOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-5 h-[40px] rounded-xl text-[13px] font-black shadow-sm">+ 새 글</button><NotificationBell currentNickname={userData.nickname} onNavigate={(postId) => { const post = allRootPosts.find(p => p.id === postId); if (post) { setSelectedTopic(post); setActiveMenu('home'); } }} /><div className="flex items-center gap-3"><div className="w-[42px] h-[42px] rounded-full border-2 border-slate-100 overflow-hidden cursor-pointer bg-slate-50" onClick={() => setActiveMenu('mypage')}><img src={userData.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${userData.nickname}`} alt="avatar" /></div><button onClick={handleLogout} className="text-[11px] font-black text-slate-300 hover:text-rose-500 transition-colors uppercase tracking-widest">Logout</button></div></> : <button onClick={handleLogin} className="flex items-center gap-2 bg-white border border-slate-200 hover:border-slate-900 px-5 h-[42px] rounded-xl text-[13px] font-black transition-all shadow-sm group"><svg className="w-4 h-4 group-hover:scale-110 transition-transform" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>구글 계정으로 시작하기</button>}</div>
        {/* 🚀 모바일 우측 — 햄버거 버튼만 표시 */}
        <div className="flex md:hidden items-center gap-2 ml-auto shrink-0">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-50 transition-colors"
            aria-label="메뉴 열기"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </header>
      <div className="flex flex-1 overflow-hidden">{!(selectedTopic || isCreateOpen) && <Sidebar activeMenu={activeMenu} setActiveMenu={(menu) => { setActiveMenu(menu); setSelectedTopic(null); setIsCreateOpen(false); setSelectedRoom(null); }} kanbuRoomCount={accessibleRooms.length} />}<main className={`flex-1 overflow-y-auto bg-[#F8FAFC] transition-all duration-500 ${(selectedTopic || isCreateOpen) ? 'px-4 md:px-6 pt-4' : 'pt-0'}`}><div className={(selectedTopic || isCreateOpen) ? "max-w-[1600px] mx-auto pb-20 md:pb-20 pb-28" : "pb-20 md:pb-20 pb-28"}>
        {!(selectedTopic || isCreateOpen) && (
          activeMenu === 'home' ? (
            <SubNavbar activeTab={activeTab} onTabClick={setActiveTab} showTabs={true} />
          ) : MENU_MESSAGES[activeMenu] ? (
            <CategoryHeader menuInfo={MENU_MESSAGES[activeMenu]} />
          ) : null
        )}
        <div className={(selectedTopic || isCreateOpen) ? "w-full" : "w-full px-4"}>
          <Suspense fallback={<div className="w-full flex items-center justify-center py-20"><div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>}>
            {renderContent()}
          </Suspense>
        </div>
      </div></main></div>
      {isCreateRoomOpen && (
        <Suspense fallback={null}>
          <CreateKanbuRoomModal onSubmit={handleCreateRoom} onClose={() => setIsCreateRoomOpen(false)} />
        </Suspense>
      )}
      {selectedPost && (
        <Suspense fallback={null}>
          <PostDetailModal post={selectedPost} onClose={() => setSelectedPost(null)} currentNickname={userData?.nickname} onLikeClick={handleLike} isFriend={friends.includes(selectedPost.author)} onToggleFriend={toggleFriend} allUsers={allUsers} followerCounts={followerCounts} toggleBlock={toggleBlock} isBlocked={blocks.includes(selectedPost.author)} />
        </Suspense>
      )}

      {/* 🚀 모바일 드로어 메뉴 — md 미만에서만 표시 */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[60] md:hidden">
          {/* 반투명 배경 오버레이 */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          {/* 드로어 패널 — 좌측에서 슬라이드 인 */}
          <div className="absolute left-0 top-0 bottom-0 w-72 shadow-2xl animate-in slide-in-from-left duration-200">
            <Sidebar
              activeMenu={activeMenu}
              setActiveMenu={(menu) => {
                setActiveMenu(menu);
                setSelectedTopic(null);
                setIsCreateOpen(false);
                setSelectedRoom(null);
                setIsMobileMenuOpen(false);
              }}
              kanbuRoomCount={accessibleRooms.length}
              mobile={true}
              onClose={() => setIsMobileMenuOpen(false)}
            />
          </div>
        </div>
      )}

      {/* 🚀 모바일 하단 네비게이션 바 — md 미만에서만 표시 */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white border-t border-slate-100 flex items-stretch h-14 safe-area-inset-bottom">
        {/* 홈 */}
        <button
          onClick={goHome}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${activeMenu === 'home' && !selectedTopic && !isCreateOpen ? 'text-blue-600' : 'text-slate-400'}`}
        >
          <svg className="w-[22px] h-[22px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <span className="text-[9px] font-[1000]">홈</span>
        </button>
        {/* 새 글 */}
        <button
          onClick={() => { setIsCreateOpen(true); setSelectedTopic(null); }}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${isCreateOpen ? 'text-blue-600' : 'text-slate-400'}`}
        >
          <svg className="w-[22px] h-[22px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
          </svg>
          <span className="text-[9px] font-[1000]">새 글</span>
        </button>
        {/* 알림 */}
        <div className="flex-1 flex flex-col items-center justify-center">
          {userData ? (
            <NotificationBell
              currentNickname={userData.nickname}
              onNavigate={(postId) => {
                const post = allRootPosts.find(p => p.id === postId);
                if (post) { setSelectedTopic(post); setActiveMenu('home'); }
              }}
            />
          ) : (
            <svg className="w-[22px] h-[22px] text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          )}
          <span className="text-[9px] font-[1000] text-slate-400 mt-0.5">알림</span>
        </div>
        {/* 내정보 */}
        <button
          onClick={() => { setActiveMenu('mypage'); setSelectedTopic(null); setIsCreateOpen(false); }}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${activeMenu === 'mypage' && !selectedTopic && !isCreateOpen ? 'text-blue-600' : 'text-slate-400'}`}
        >
          {userData ? (
            <div className={`w-6 h-6 rounded-full overflow-hidden border-2 ${activeMenu === 'mypage' ? 'border-blue-400' : 'border-slate-200'}`}>
              <img src={userData.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${userData.nickname}`} alt="avatar" className="w-full h-full object-cover" />
            </div>
          ) : (
            <svg className="w-[22px] h-[22px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          )}
          <span className="text-[9px] font-[1000]">내정보</span>
        </button>
        {/* 메뉴 더보기 */}
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 text-slate-400 transition-colors"
        >
          <svg className="w-[22px] h-[22px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          <span className="text-[9px] font-[1000]">메뉴</span>
        </button>
      </nav>
    </div>
  );
}

export default App;
