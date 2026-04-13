// src/App.tsx — 루트 컴포넌트 (전역 상태, 실시간 리스너, 라우팅)

// 🚀 딥링크 파라미터 복원 헬퍼 — 앱 마운트 시 한 번만 실행
// 모바일 signInWithRedirect 후 복귀 시 URL 파라미터가 사라지므로
// 리디렉션 전 sessionStorage('authRedirectUrl')에 저장한 URL에서 파라미터 복원
// 검색어: getDeepLinkParams
const getDeepLinkParams = (() => {
  let cached: { params: URLSearchParams; path: string } | null = null;
  return () => {
    if (cached) return cached;
    const currentParams = new URLSearchParams(window.location.search);
    const currentPath = window.location.pathname;
    // 현재 URL에 파라미터가 있으면 그대로 사용
    if (currentParams.has('post') || currentParams.has('tree') || currentParams.has('node') || /^\/p\//.test(currentPath)) {
      cached = { params: currentParams, path: currentPath };
      return cached;
    }
    // 모바일 리디렉션 로그인 후 복귀: 저장된 원래 URL에서 파라미터 복원
    const savedUrl = sessionStorage.getItem('authRedirectUrl');
    if (savedUrl) {
      sessionStorage.removeItem('authRedirectUrl');
      try {
        const url = new URL(savedUrl);
        cached = { params: new URLSearchParams(url.search), path: url.pathname };
        return cached;
      } catch { /* 파싱 실패 시 현재 URL 사용 */ }
    }
    cached = { params: currentParams, path: currentPath };
    return cached;
  };
})();
import { useState, useEffect, lazy, Suspense } from 'react';
import { db } from './firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import type { Post, KanbuRoom, Community } from './types';
import { useFirebaseListeners } from './hooks/useFirebaseListeners';
import { useAuthActions } from './hooks/useAuthActions';
import { useGloveActions } from './hooks/useGloveActions';
import { useFirestoreActions } from './hooks/useFirestoreActions';
// 항상 초기 화면에 필요한 컴포넌트 — 정적 import 유지
import InAppBrowserModal from './components/InAppBrowserModal';
import AnyTalkList from './components/AnyTalkList';
import NotificationBell from './components/NotificationBell';
import Sidebar from './components/Sidebar';
import type { MenuId } from './components/Sidebar';
import SubNavbar from './components/SubNavbar';
import CategoryHeader from './components/CategoryHeader';
import { TEST_ACCOUNTS, MENU_MESSAGES, POST_FILTER, EXTERNAL_URLS } from './constants';
// 조건부 렌더링 컴포넌트 — lazy load (청크 분리)
const MyPage = lazy(() => import('./components/MyPage'));
const PublicProfile = lazy(() => import('./components/PublicProfile'));
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
const GiantTreeView = lazy(() => import('./components/GiantTreeView'));
const CreateDebate = lazy(() => import('./components/CreateDebate')); // 연계글 팝업 전용
// 🚀 ADSMARKET: 광고주 센터
const AdvertiserCenter = lazy(() => import('./components/advertiser/AdvertiserCenter'));
const AdAdminPage = lazy(() => import('./components/admin/AdAdminPage'));
const FriendsView = lazy(() => import('./components/FriendsView'));
const AdvertiserRegister = lazy(() => import('./components/advertiser/AdvertiserRegister'));
// 🖋️ 마르지 않는 잉크병 — 사이드 메뉴 진입 화면 (회차/작품 2탭) + 상세/본문/생성 폼
const InkwellHomeView = lazy(() => import('./components/InkwellHomeView'));
const MarketHomeView = lazy(() => import('./components/MarketHomeView'));
const SeriesDetail = lazy(() => import('./components/SeriesDetail'));
const EpisodeReader = lazy(() => import('./components/EpisodeReader'));
const CreateSeries = lazy(() => import('./components/CreateSeries'));
const CreateEpisode = lazy(() => import('./components/CreateEpisode'));
const EditEpisode = lazy(() => import('./components/EditEpisode'));
const EditSeries = lazy(() => import('./components/EditSeries'));
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
  marathon_herald: lazy(() => import('./components/CreateMarathonHerald')),
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
  const [activeTab, setActiveTab] = useState<'any' | 'recent' | 'best' | 'rank' | 'friend' | 'subscribed'>('any');
  // 🖋️ 내가 구독한 작품 ID Set (홈 구독글 탭 필터링용) — 잉크병 작품 단위 구독
  const [mySubscribedSeriesIds, setMySubscribedSeriesIds] = useState<Set<string>>(new Set());
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [linkedPostSide, setLinkedPostSide] = useState<'left' | 'right' | null>(null); // 솔로몬의 재판 연계글 팝업
  const [selectedRoom, setSelectedRoom] = useState<KanbuRoom | null>(null);
  // 🖋️ 마르지 않는 잉크병 — 선택된 작품 (null이면 그리드, 값이 있으면 SeriesDetail)
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null);
  // 🖋️ 마르지 않는 잉크병 — 선택된 에피소드 (값이 있으면 EpisodeReader가 최우선 표시)
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string | null>(null);
  // 🖋️ 잉크병 모드: 'list' | 'createSeries' | 'createEpisode'
  // (detail/reader는 selectedSeriesId/selectedEpisodeId 존재 여부로 판단)
  const [inkwellMode, setInkwellMode] = useState<'list' | 'createSeries' | 'createEpisode' | 'editEpisode' | 'editSeries'>('list');
  // 🖋️ 잉크병 홈뷰 탭 (episodes/series) — SeriesDetail 진입/복귀 시 유지되도록 부모에서 관리
  const [inkwellTab, setInkwellTab] = useState<'episodes' | 'series'>('episodes');
  const [isCreateRoomOpen, setIsCreateRoomOpen] = useState(false);
  // 🚀 우리들의 따뜻한 장갑: 커뮤니티 상태
  // 🚀 장갑찾기가 기본 탭 (사용자가 커뮤니티를 발견하도록 유도)
  const [gloveSubTab, setGloveSubTab] = useState<'feed' | 'mine' | 'list'>('list');
  const [selectedCommunity, setSelectedCommunity] = useState<Community | null>(null);
  const [isCreateCommunityOpen, setIsCreateCommunityOpen] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<string | null>(null);
  const [viewingAuthor, setViewingAuthor] = useState<string | null>(null);
  // 🚀 공개 프로필: 아바타 클릭 시 PublicProfile 표시
  const [publicProfileNick, setPublicProfileNick] = useState<string | null>(null);

  // 🚀 URL 공유 링크 처리: ?post=글ID 로 직접 접근 시 해당 글 자동 오픈
  // - lazy 초기화로 앱 마운트 시 딱 한 번만 URL 파라미터를 읽음
  // 🚀 모바일 드로어 메뉴 열림 여부
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  // 🚀 홈에서 새 글 쓰기 2단계 UX — 1단계(카테고리 선택) 후 설정되는 메뉴 키
  const [createMenuKey, setCreateMenuKey] = useState<string | null>(null);

  const [pendingSharedPostId, setPendingSharedPostId] = useState<string | null>(() => {
    // ?post=topic_xxx (기존 방식) 또는 /p/topic_xxx (신규 방식) 모두 지원
    // 모바일 리디렉션 로그인 후 복귀 시: getDeepLinkParams()가 sessionStorage에서 원래 URL 복원
    const { params, path } = getDeepLinkParams();
    const qParam = params.get('post');
    if (qParam) return qParam;
    const pathMatch = path.match(/^\/p\/(.+)$/);
    return pathMatch ? pathMatch[1] : null;
  });

  // 🚀 거대 나무 공유 URL 처리: ?tree=treeId&node=parentNodeId
  const [pendingTreeId] = useState<string | null>(() => getDeepLinkParams().params.get('tree'));
  const [pendingParentNodeId] = useState<string | null>(() => getDeepLinkParams().params.get('node'));

  // 🚀 광고 딥링크: ?menu=friends 등 → 해당 메뉴 자동 이동
  useEffect(() => {
    const menuParam = new URLSearchParams(window.location.search).get('menu');
    if (menuParam) {
      setActiveMenu(menuParam as MenuId);
      // URL에서 ?menu= 파라미터 제거 (뒤로가기 시 반복 방지)
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const accessibleRooms = kanbuRooms.filter(r =>
    r.creatorNickname === userData?.nickname || friends.includes(r.creatorNickname)
  );

  // 🚀 인증 훅 — 로그인·로그아웃·테스트 계정 핸들러
  const { handleLogin, handleTestLogin, handleLogout, inAppModal, closeInAppModal, openExternalBrowser } = useAuthActions({ userData, setUserData, setActiveMenu });

  // 🚀 장갑 훅 — 커뮤니티 개설·가입·탈퇴·깐부방 생성 핸들러
  const { handleCreateRoom, handleCreateCommunity, handleJoinCommunity, handleLeaveCommunity } = useGloveActions({
    userData, setJoinedCommunityIds, setIsCreateCommunityOpen, setGloveSubTab, setIsCreateRoomOpen,
  });

  // 🚀 Firestore 훅 — 게시글·댓글·좋아요·깐부·차단 핸들러
  const {
    handlePostSubmit, handleLinkedPostSubmit,
    handleInlineReply, handleCommentSubmit,
    toggleFriend, toggleBlock, handleLike, handleViewPost, handleShareCount, handleRepost,
  } = useFirestoreActions({
    userData, friends, blocks, allRootPosts, allChildPosts, selectedTopic,
    replyTarget, setReplyTarget, newTitle, newContent, setNewTitle, setNewContent,
    selectedSide, selectedType, setIsSubmitting,
    setAllRootPosts, setSelectedTopic, setIsCreateOpen, setEditingPost, setCreateMenuKey,
    setActiveMenu, setActiveTab, setLinkedPostSide,
  });

  // 🚀 거대 나무 공유 링크 접근: ?tree= 파라미터 감지 시 giant_tree 메뉴 자동 이동
  useEffect(() => {
    if (pendingTreeId) {
      setActiveMenu('giant_tree');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [pendingTreeId]);

  useEffect(() => { if (replyTarget) { setSelectedType('comment'); setNewTitle(""); } }, [replyTarget]);
  useEffect(() => { setSelectedFriend(null); setViewingAuthor(null); setPublicProfileNick(null); }, [activeMenu, activeTab]);

  // 🚀 깐부맺기 홍보 조회수 — 별도 함수로 분리 (FriendsView + AnyTalkList에서 호출)
  // 조회수는 홍보 모달 열릴 때 카운트 (오픈프로필이 아님)
  // 🚀 장갑 메뉴 이탈 시 커뮤니티 선택 초기화
  useEffect(() => { if (activeMenu !== 'glove') { setSelectedCommunity(null); } }, [activeMenu]);

  // 🚀 공유 링크로 접근 시: allRootPosts가 로드되면 해당 글을 찾아 자동으로 상세 뷰 오픈
  // - allRootPosts가 아직 빈 배열이면 대기, 로드 완료 후 실행
  // - 처리 완료 후 pendingSharedPostId를 null로 초기화해 재실행 방지
  // - 10초 타임아웃: 글을 찾지 못하면 홈으로 이동 + 안내
  useEffect(() => {
    if (!pendingSharedPostId) return;
    if (allRootPosts.length === 0) return;
    const sharedPost = allRootPosts.find(p =>
      p.id === pendingSharedPostId || p.id.startsWith(pendingSharedPostId + '_')
    );
    if (sharedPost) {
      setSelectedTopic(sharedPost);
      setPendingSharedPostId(null);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [allRootPosts, pendingSharedPostId]);

  // 🚀 공유 링크 타임아웃: 10초 내 글을 못 찾으면 홈으로 이동
  useEffect(() => {
    if (!pendingSharedPostId) return;
    const timer = setTimeout(() => {
      if (pendingSharedPostId) {
        setPendingSharedPostId(null);
        window.history.replaceState({}, '', window.location.pathname);
        alert('공유된 글을 찾을 수 없습니다. 삭제되었거나 접근이 제한된 글일 수 있어요.');
      }
    }, 10_000);
    return () => clearTimeout(timer);
  }, [pendingSharedPostId]);

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

  // 🖋️ 내가 구독한 잉크병 작품 ID Set 구독 (홈 구독글 탭 필터링용)
  useEffect(() => {
    if (!userData?.uid) { setMySubscribedSeriesIds(new Set()); return; }
    const q = query(collection(db, 'series_subscriptions'), where('userId', '==', userData.uid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setMySubscribedSeriesIds(new Set(snap.docs.map(d => d.data().seriesId as string)));
      },
      (err) => console.error('[mySubscribedSeriesIds]', err)
    );
    return unsub;
  }, [userData?.uid]);

  const goHome = () => {
    setActiveMenu('home'); setSelectedTopic(null); setIsCreateOpen(false); setReplyTarget(null); setEditingPost(null); setCreateMenuKey(null);
    setSelectedRoom(null); setIsCreateRoomOpen(false); setPublicProfileNick(null);
    setActiveTab('any');
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

  const renderContent = () => {
    // 🚀 공유 링크 로딩 중: 글을 찾는 동안 로딩 스피너 표시 (10초 타임아웃)
    if (pendingSharedPostId) return (
      <div className="w-full flex flex-col items-center justify-center py-40 gap-3">
        <h1 className="text-[36px] font-[1000] italic tracking-tighter animate-logo-pulse">
          <span className="text-red-500">G</span><span className="text-blue-600">L</span><span className="text-slate-900">ove</span>
        </h1>
        <p className="text-[11px] font-black text-slate-400 tracking-tight">공유된 글을 불러오는 중...</p>
      </div>
    );
    if (isLoading) return (
      <div className="w-full flex flex-col items-center justify-center py-40 gap-3">
        <h1 className="text-[36px] font-[1000] italic tracking-tighter animate-logo-pulse">
          <span className="text-red-500">G</span><span className="text-blue-600">L</span><span className="text-slate-900">ove</span>
        </h1>
        <p className="text-[11px] font-black text-violet-300 tracking-tight">집단지성의 힘</p>
      </div>
    );
    
    if (isCreateOpen) {
      if (activeMenu === 'onecut' || editingPost?.isOneCut || selectedTopic?.isOneCut) {
        return <CreateOneCutBox userData={userData!} editingPost={editingPost} allPosts={allRootPosts} onSubmit={handlePostSubmit} onClose={() => { setIsCreateOpen(false); setEditingPost(null); }} />;
      }
      // 솔로몬의 재판 연계글 팝업 — linkedPostSide가 있으면 CreateDebate를 연계글 모드로 렌더링
      if (linkedPostSide !== null) {
        return <CreateDebate userData={userData!} editingPost={null} onSubmit={handleLinkedPostSubmit} onClose={() => { setIsCreateOpen(false); setLinkedPostSide(null); }} linkedTitle="[연계글]" linkedSide={linkedPostSide} originalPost={selectedTopic ?? undefined} />;
      }

      // 🚀 홈 2단계 UX — activeMenu가 'home'이고 카테고리 미선택 시 카테고리 선택 카드 화면 표시
      if (activeMenu === 'home' && !editingPost && createMenuKey === null) {
        const CATEGORY_CARD_KEYS = ['my_story', 'naked_king', 'donkey_ears', 'knowledge_seller', 'bone_hitting', 'local_news', 'marathon_herald', 'onecut'] as const;
        // 🚀 이모지 옆 짧은 설명 — 카드 UI 전용 (description은 너무 길어 별도 정의)
        const CARD_SUBTITLES: Record<string, string> = {
          my_story:        '일상 이야기',
          naked_king:      '시사 · 사회 이슈',
          donkey_ears:     '찬반 토론',
          knowledge_seller:'지식 · 정보 공유',
          bone_hitting:    '뼈때리는 명언',
          local_news:      '지역 · 세계 소식',
          marathon_herald: '속보 긴급뉴스',
          onecut:          '이미지 한 장',
        };
        return (
          <div className="w-full max-w-2xl mx-auto py-8 px-4 animate-in fade-in">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[18px] font-[1000] text-slate-900">어떤 글을 쓸까요?</h2>
              <button onClick={() => { setIsCreateOpen(false); setCreateMenuKey(null); }} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORY_CARD_KEYS.map(key => {
                const info = MENU_MESSAGES[key];
                if (!info) return null;
                return (
                  <button
                    key={key}
                    onClick={() => {
                      if (key === 'onecut') {
                        setCreateMenuKey('onecut');
                      } else {
                        setCreateMenuKey(key);
                      }
                    }}
                    className="flex flex-col items-start p-3.5 rounded-xl border border-slate-100 bg-white hover:bg-slate-50 hover:border-slate-200 transition-all text-left"
                  >
                    {/* 이모지 + 짧은 설명 (같은 줄) */}
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="text-[18px] leading-none">{info.emoji}</span>
                      <span className="text-[10px] font-bold text-slate-400 leading-tight">{CARD_SUBTITLES[key]}</span>
                    </div>
                    {/* 메뉴 제목 */}
                    <span className="text-[13px] font-[1000] text-slate-900 leading-snug">{info.title}</span>
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
        return <CreateOneCutBox userData={userData!} editingPost={editingPost} allPosts={allRootPosts} onSubmit={handlePostSubmit} onClose={() => { setIsCreateOpen(false); setEditingPost(null); setCreateMenuKey(null); }} />;
      }
      if (resolvedKey && CREATE_MENU_COMPONENTS[resolvedKey]) {
        const CreateComponent = CREATE_MENU_COMPONENTS[resolvedKey];
        return <CreateComponent userData={userData!} editingPost={editingPost} onSubmit={handlePostSubmit} onClose={() => { setIsCreateOpen(false); setEditingPost(null); setCreateMenuKey(null); }} />;
      }
      return <CreatePostBox userData={userData!} editingPost={editingPost} activeMenu={resolvedKey} menuMessages={MENU_MESSAGES} onSubmit={handlePostSubmit} onClose={() => { setIsCreateOpen(false); setEditingPost(null); setCreateMenuKey(null); }} />;
    }
    
    // 🚀 공개 프로필 — 아바타 클릭 시 표시
    if (publicProfileNick) {
      return <PublicProfile
        targetNickname={publicProfileNick}
        allUsers={allUsers}
        allRootPosts={allRootPosts}
        commentCounts={commentCounts}
        followerCounts={followerCounts}
        currentNickname={userData?.nickname}
        friends={friends}
        onToggleFriend={toggleFriend}
        onPostClick={(post) => { setPublicProfileNick(null); handleViewPost(post); }}
        onClose={() => setPublicProfileNick(null)}
      />;
    }

    // 🚀 ADSMARKET: 광고주 센터
    if (activeMenu === 'adsmarket') {
      if (!userData) return (
        <div className="py-20 text-center text-slate-300 font-bold">로그인 후 이용할 수 있습니다.</div>
      );
      const isAdvertiser = !!(userData as unknown as { isAdvertiser?: boolean }).isAdvertiser;
      if (!isAdvertiser) {
        return <AdvertiserRegister onComplete={() => setActiveMenu('adsmarket')} onCancel={() => setActiveMenu('home')} />;
      }
      return <AdvertiserCenter onBack={() => setActiveMenu('home')} />;
    }

    // 🚀 광고 관리자 페이지 (PLATFORM_ADMIN_NICKNAMES만)
    if (activeMenu === 'ad_admin') {
      return <AdAdminPage currentUser={userData} onBack={() => setActiveMenu('home')} />;
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
          friendCount={friends.length}
          followerCount={followerCounts[userData.nickname] || 0}
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
          onRepost={handleRepost}
          onNavigateToSeries={(seriesId) => {
            // 🖋️ 마이페이지 → 잉크병 작품 상세로 이동
            setActiveMenu('inkwell');
            setSelectedSeriesId(seriesId);
            setSelectedEpisodeId(null);
            setInkwellMode('list');
          }}
          onGoToInkwellCatalog={() => {
            // 🖋️ 마이페이지 구독 빈 상태 → 잉크병 작품 카탈로그(작품 탭)
            setActiveMenu('inkwell');
            setSelectedSeriesId(null);
            setSelectedEpisodeId(null);
            setInkwellMode('list');
            setInkwellTab('series');
          }}
        />;
      }
      return <div className="w-full py-40 text-center"><button onClick={handleLogin} className="bg-slate-900 text-white px-8 py-3 rounded-xl font-black shadow-lg">로그인하기</button></div>;
    }

    if (activeMenu === 'friends') {
      return <FriendsView currentNickname={userData?.nickname} currentUserData={userData} allUsers={allUsers} allRootPosts={allRootPosts} friends={friends} followerCounts={followerCounts} onToggleFriend={toggleFriend} onViewProfile={setPublicProfileNick} />;
    }

    if (activeMenu === 'market') {
      return (
        <MarketHomeView
          currentUserData={userData}
          allUsers={allUsers}
        />
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
              <div className="flex items-center gap-1 shrink-0">
                {([
                  { id: 'feed', label: '소곤소곤', desc: '가입 장갑 피드', mobileOnly: false },
                  { id: 'list', label: '장갑 찾기', desc: '전체 커뮤니티', mobileOnly: false },
                  { id: 'mine', label: '나의 장갑', desc: '가입한 장갑', mobileOnly: true },
                ] as const).map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => { setGloveSubTab(tab.id); setSelectedCommunity(null); }}
                    className={`${tab.mobileOnly ? 'md:hidden' : ''} flex items-center gap-1 px-2 py-1.5 rounded-lg border transition-all ${
                      gloveSubTab === tab.id
                        ? 'bg-blue-50 border-blue-200 text-blue-700'
                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-[11px] font-[1000] whitespace-nowrap">{tab.label}</span>
                    <span className={`text-[10px] font-bold hidden md:inline whitespace-nowrap ${gloveSubTab === tab.id ? 'text-blue-400' : 'text-slate-300'}`}>{tab.desc}</span>
                  </button>
                ))}
                <button
                  onClick={() => setIsCreateCommunityOpen(true)}
                  className="flex items-center gap-0.5 px-2 py-1.5 rounded-lg bg-slate-900 hover:bg-blue-600 text-white border border-slate-900 hover:border-blue-600 transition-all"
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
                  community={communities.find(c => c.id === selectedCommunity.id) ?? selectedCommunity}
                  currentUserData={userData}
                  allUsers={allUsers}
                  followerCounts={followerCounts}
                  onBack={() => setSelectedCommunity(null)}
                  onClosed={() => setSelectedCommunity(null)}
                />
              ) : gloveSubTab === 'feed' ? (
                <CommunityFeed
                  currentUserData={userData}
                  joinedCommunityIds={joinedCommunityIds}
                  allUsers={allUsers}
                  communities={communities}
                  followerCounts={followerCounts}
                  onCommunityClick={setSelectedCommunity}
                />
              ) : gloveSubTab === 'mine' ? (
                <MyCommunityList
                  communities={communities}
                  joinedCommunityIds={joinedCommunityIds}
                  onCommunityClick={setSelectedCommunity}
                  onLeave={handleLeaveCommunity}
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
                    <span className="text-[13px] font-[1000] text-slate-900">나의 장갑</span>
                  </div>
                  <div className="p-3">
                    <MyCommunityList
                      communities={communities}
                      joinedCommunityIds={joinedCommunityIds}
                      onCommunityClick={(c) => { setSelectedCommunity(c); }}
                      onLeave={handleLeaveCommunity}
                      compact={false}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
          {isCreateCommunityOpen && (
            <CreateCommunityModal
              userData={userData!}
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
        return <KanbuRoomView room={selectedRoom} roomPosts={roomPosts} onBack={() => setSelectedRoom(null)} currentUserData={userData!} allUsers={allUsers} />;
      }
      return <KanbuRoomList rooms={accessibleRooms} onRoomClick={setSelectedRoom} onCreateRoom={() => setIsCreateRoomOpen(true)} currentUserLevel={userData?.level || 1} allUsers={allUsers} />;
    }

    if (activeMenu === 'giant_tree') {
      return <GiantTreeView currentNickname={userData?.nickname} currentUserData={userData} allUsers={allUsers} initialTreeId={pendingTreeId || undefined} initialParentNodeId={pendingParentNodeId || undefined} />;
    }

    // 🖋️ 마르지 않는 잉크병 — 5단계 우선순위 라우팅 (Phase 3-E)
    if (activeMenu === 'inkwell') {
      const currentUserUid = userData?.uid || null;
      const currentUserNickname = userData?.nickname || '익명';
      const currentUserProfileImage = userData?.avatarUrl || null;

      // 1순위: 작품 개설 폼
      if (inkwellMode === 'createSeries') {
        return (
          <CreateSeries
            currentUserUid={currentUserUid}
            currentUserNickname={currentUserNickname}
            currentUserProfileImage={currentUserProfileImage}
            onSuccess={(newSeriesId) => {
              setInkwellMode('list');
              setSelectedSeriesId(newSeriesId);
            }}
            onCancel={() => setInkwellMode('list')}
          />
        );
      }
      // 1.5순위: 작품 수정 폼 (selectedSeriesId 필수)
      if (inkwellMode === 'editSeries' && selectedSeriesId) {
        return (
          <EditSeries
            seriesId={selectedSeriesId}
            currentUserUid={currentUserUid}
            onSuccess={() => {
              // selectedSeriesId 유지 → 수정 후 SeriesDetail로 자동 복귀
              setInkwellMode('list');
            }}
            onCancel={() => setInkwellMode('list')}
          />
        );
      }
      // 2순위: 회차 작성 폼 (작품 상세에서 진입, selectedSeriesId 필수)
      if (inkwellMode === 'createEpisode' && selectedSeriesId) {
        return (
          <CreateEpisode
            seriesId={selectedSeriesId}
            currentUserUid={currentUserUid}
            currentUserNickname={currentUserNickname}
            onSuccess={(newPostId) => {
              setInkwellMode('list');
              setSelectedEpisodeId(newPostId);
            }}
            onCancel={() => setInkwellMode('list')}
          />
        );
      }
      // 2.5순위: 회차 수정 폼 (selectedEpisodeId 필수)
      if (inkwellMode === 'editEpisode' && selectedEpisodeId) {
        return (
          <EditEpisode
            postId={selectedEpisodeId}
            currentUserUid={currentUserUid}
            currentUserNickname={currentUserNickname}
            onSuccess={() => {
              // selectedEpisodeId 유지 → 수정 후 EpisodeReader로 자동 복귀
              setInkwellMode('list');
            }}
            onCancel={() => setInkwellMode('list')}
          />
        );
      }
      // 3순위: 본문 뷰어
      if (selectedEpisodeId) {
        return (
          <EpisodeReader
            postId={selectedEpisodeId}
            currentUserUid={currentUserUid}
            currentUserNickname={currentUserNickname}
            onBack={() => setSelectedEpisodeId(null)}
            onNavigateEpisode={(postId) => setSelectedEpisodeId(postId)}
            onEditEpisode={() => setInkwellMode('editEpisode')}
            onDeleteSuccess={() => {
              // selectedSeriesId 유지 → 삭제 후 SeriesDetail로 자동 복귀
              setSelectedEpisodeId(null);
            }}
            onGoToSeries={(seriesId) => {
              // 🖋️ 하단 "목차" 버튼 — 작품 SeriesDetail로 이동
              setSelectedSeriesId(seriesId);
              setSelectedEpisodeId(null);
            }}
            onAuthorClick={setPublicProfileNick}
          />
        );
      }
      // 4순위: 작품 상세
      if (selectedSeriesId) {
        return (
          <SeriesDetail
            seriesId={selectedSeriesId}
            currentUserUid={currentUserUid}
            onBack={() => setSelectedSeriesId(null)}
            onSelectEpisode={(postId) => setSelectedEpisodeId(postId)}
            onCreateEpisode={() => setInkwellMode('createEpisode')}
            onEditSeries={() => setInkwellMode('editSeries')}
            onDeleteSuccess={() => {
              // 삭제/비공개 전환 후 그리드로 복귀
              setSelectedSeriesId(null);
              setInkwellMode('list');
            }}
          />
        );
      }
      // 5순위: 잉크병 메뉴 진입 화면 — [📖 회차] 등록글 그리드 + [📚 작품] 카탈로그 2탭
      return (
        <InkwellHomeView
          allRootPosts={allRootPosts}
          // 🖋️ 잉크병 메뉴 내부에서 회차 카드 클릭 → selectedEpisodeId로 직접 전환 (EpisodeReader 분기 진입)
          // selectedTopic 분기는 이 함수 뒤에 있어서 activeMenu === 'inkwell' 조건이 먼저 매칭되기 때문
          onTopicClick={(post) => setSelectedEpisodeId(post.id)}
          onLikeClick={handleLike}
          commentCounts={commentCounts}
          currentNickname={userData?.nickname}
          currentUserData={userData}
          allUsers={allUsers}
          followerCounts={followerCounts}
          onShareCount={handleShareCount}
          onAuthorClick={setPublicProfileNick}
          onSelectSeries={(id) => setSelectedSeriesId(id)}
          onCreateSeries={() => setInkwellMode('createSeries')}
          activeTab={inkwellTab}
          onTabChange={setInkwellTab}
        />
      );
    }

    // 🚀 selectedTopic 체크: ranking 등 다른 메뉴에서 글 클릭 시 상세보기 진입 가능하도록 먼저 판단
    if (selectedTopic) {
      const livePost = allRootPosts.find(p => p.id === selectedTopic.id) || selectedTopic;
      // 🖋️ 잉크병 회차: DiscussionView 대신 EpisodeReader로 전환 (유료 페이월/private_data 처리 필요)
      if (livePost.category === 'magic_inkwell') {
        const currentUserUid = userData?.uid || null;
        const currentUserNickname = userData?.nickname || '익명';
        return (
          <EpisodeReader
            postId={livePost.id}
            currentUserUid={currentUserUid}
            currentUserNickname={currentUserNickname}
            onBack={() => { setSelectedTopic(null); setReplyTarget(null); setEditingPost(null); }}
            onNavigateEpisode={(postId) => {
              const target = allRootPosts.find(p => p.id === postId);
              if (target) setSelectedTopic(target);
            }}
            onEditEpisode={() => {
              setActiveMenu('inkwell');
              if (livePost.seriesId) setSelectedSeriesId(livePost.seriesId);
              setSelectedEpisodeId(livePost.id);
              setInkwellMode('editEpisode');
              setSelectedTopic(null);
            }}
            onDeleteSuccess={() => { setSelectedTopic(null); }}
            onGoToSeries={(seriesId) => {
              // 🖋️ 홈/등록글에서 진입 시에도 하단 "목차" 버튼은 작품 SeriesDetail로 이동
              setActiveMenu('inkwell');
              setSelectedSeriesId(seriesId);
              setSelectedEpisodeId(null);
              setInkwellMode('list');
              setSelectedTopic(null);
            }}
            onAuthorClick={setPublicProfileNick}
          />
        );
      }
      // 🚀 한컷 판정 로직 강화: isOneCut 플래그 또는 카테고리명이 "한컷"인 경우
      if (livePost.isOneCut || livePost.category === "한컷") {
        return <OneCutDetailView rootPost={livePost} allPosts={allChildPosts.filter(p => p.rootId === livePost.id)} otherTopics={allRootPosts} onTopicChange={handleViewPost} userData={userData!} onInlineReply={handleInlineReply} onLikeClick={handleLike} currentNickname={userData?.nickname} allUsers={allUsers} followerCounts={followerCounts} commentCounts={commentCounts} onEditPost={(post) => { setEditingPost(post); setIsCreateOpen(true); }} onBack={() => { setSelectedTopic(null); setReplyTarget(null); setEditingPost(null); }} isFriend={friends.includes(livePost.author)} onToggleFriend={() => toggleFriend(livePost.author)} onAuthorClick={setPublicProfileNick} />;
      }
      return <DiscussionView rootPost={livePost} allPosts={allChildPosts.filter(p => p.rootId === livePost.id)} otherTopics={allRootPosts.filter(p => {
          if (p.id === livePost.id) return false;
          const myStory = ['너와 나의 이야기'];
          const liveIsMyStory = !livePost.category || myStory.includes(livePost.category);
          if (liveIsMyStory) return !p.category || myStory.includes(p.category || '');
          return p.category === livePost.category;
        })} onTopicChange={handleViewPost} userData={userData!} friends={friends} onToggleFriend={toggleFriend} onPostClick={() => {}} replyTarget={replyTarget} setReplyTarget={setReplyTarget} handleSubmit={handleCommentSubmit} selectedSide={selectedSide} setSelectedSide={setSelectedSide} selectedType={selectedType} setSelectedType={setSelectedType} newTitle={newTitle} setNewTitle={setNewTitle} newContent={newContent} setNewContent={setNewContent} isSubmitting={isSubmitting} commentCounts={commentCounts} onLikeClick={handleLike} currentNickname={userData?.nickname} allUsers={allUsers} followerCounts={followerCounts} toggleBlock={toggleBlock} onEditPost={(post) => { setEditingPost(post); setIsCreateOpen(true); }} onInlineReply={handleInlineReply} onOpenLinkedPost={(side) => { setLinkedPostSide(side); setIsCreateOpen(true); }} onNavigateToPost={(postId) => { const target = allRootPosts.find(p => p.id === postId); if (target) handleViewPost(target); }} onBack={() => { setSelectedTopic(null); setReplyTarget(null); setEditingPost(null); }} onAuthorClick={setPublicProfileNick} />;
    }

    if (activeMenu === 'ranking') {
      return <RankingView allRootPosts={allRootPosts.filter(p => !p.isOneCut)} allUsers={allUsers} onPostClick={handleViewPost} />;
    }

    if (activeMenu === 'onecut') {
      // 🚀 한컷 메뉴: 일반 홈 피드와 동일한 탭 필터 적용 (새글=2시간 이내, 등록글=2시간+좋아요3, 인기=좋아요10, 최고=좋아요30)
      const onecutAll = allRootPosts.filter(p => p.isOneCut || p.category === '한컷');
      const onecutCutoff = new Date(Date.now() - POST_FILTER.NEW_POST_WINDOW_MS);
      let onecutPosts: Post[];
      if (activeTab === 'any') {
        onecutPosts = onecutAll.filter(p => { const ca = p.createdAt?.toDate ? p.createdAt.toDate() : (p.createdAt?.seconds ? new Date(p.createdAt.seconds * 1000) : null); return ca && ca > onecutCutoff; });
      } else if (activeTab === 'recent') {
        onecutPosts = onecutAll.filter(p => { const ca = p.createdAt?.toDate ? p.createdAt.toDate() : (p.createdAt?.seconds ? new Date(p.createdAt.seconds * 1000) : null); return (p.likes || 0) >= POST_FILTER.REGISTERED_MIN_LIKES && (!ca || ca <= onecutCutoff); });
      } else if (activeTab === 'best') {
        onecutPosts = onecutAll.filter(p => (p.likes || 0) >= POST_FILTER.BEST_MIN_LIKES);
      } else if (activeTab === 'rank') {
        onecutPosts = onecutAll.filter(p => (p.likes || 0) >= POST_FILTER.RANK_MIN_LIKES);
      } else if (activeTab === 'friend') {
        onecutPosts = onecutAll.filter(p => friends.includes(p.author) && (p.likes || 0) >= POST_FILTER.REGISTERED_MIN_LIKES);
      } else {
        onecutPosts = onecutAll;
      }
      return <div className="w-full animate-in fade-in"><OneCutList posts={onecutPosts} allPosts={allRootPosts} onTopicClick={handleViewPost} onLikeClick={handleLike} currentNickname={userData?.nickname} allUsers={allUsers} followerCounts={followerCounts} commentCounts={commentCounts} onShareCount={handleShareCount} onEditClick={(post) => { setEditingPost(post); setIsCreateOpen(true); }} onAuthorClick={setPublicProfileNick} /></div>;
    }

    // 🚀 포스트 필터링 및 탭 처리
    // 🚀 홈 피드: 마라톤의 전령 속보도 포함 (속보 키워드 있는 글만 Firestore에 저장되므로 전체 허용)
    // 🖋️ 기본 피드에서 잉크병 회차 제외 (잉크병은 자체 인라인 스트립 + 사이드 메뉴에서만 노출)
    let basePosts = allRootPosts.filter(p => !p.isOneCut && p.category !== 'magic_inkwell');

    if (activeMenu !== 'home' && MENU_MESSAGES[activeMenu]) {
      const menuInfo = MENU_MESSAGES[activeMenu];
      const categoryKey = menuInfo.title;
      basePosts = allRootPosts.filter(p => !p.isOneCut && ( // 카테고리 뷰: 마라톤 포함 전체에서 필터
        // 🚀 참새들의 방앗간(구 너와 나의 이야기): DB category는 "너와 나의 이야기" 유지
        activeMenu === 'my_story'
          ? (p.category === "너와 나의 이야기" || p.category === undefined)
          : (p.category === categoryKey)
      ));
      // 🚀 카테고리별 보기: 살아남은 글(좋아요 3개 이상)만 노출
      // 단, 마라톤의 전령(뉴스 봇 게시글)은 좋아요 임계값 없이 즉시 전체 노출
      const categoryPosts = activeMenu === 'marathon_herald'
        ? basePosts
        : basePosts.filter(p => (p.likes || 0) >= 3);
      const searchedPosts = filterBySearch(categoryPosts);
      return (
        <div className="w-full animate-in fade-in">
          <AnyTalkList posts={searchedPosts} onTopicClick={handleViewPost} onLikeClick={handleLike} commentCounts={commentCounts} currentNickname={userData?.nickname} currentUserData={userData} allUsers={allUsers} followerCounts={followerCounts} onShareCount={handleShareCount} />
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
    } else if (activeTab === 'subscribed') {
      // 🖋️ 구독글: 내가 구독한 작품의 모든 잉크병 회차 (임계값 없음, 시간 제한 없음, 비공개 제외)
      filteredPosts = allRootPosts
        .filter(p =>
          p.category === 'magic_inkwell'
          && !p.isHidden
          && p.seriesId
          && mySubscribedSeriesIds.has(p.seriesId)
        )
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    }

    // 🚀 한컷 인라인 섹션: 탭 기준과 동일한 필터 → 최신순 정렬 후 4개 표시
    const onecutAllPosts = allRootPosts.filter(p => p.isOneCut || p.category === '한컷');
    let onecutTabPosts: Post[] = [];
    if (activeTab === 'any') {
      onecutTabPosts = onecutAllPosts.filter(p => {
        const createdAt = p.createdAt?.toDate ? p.createdAt.toDate() : (p.createdAt?.seconds ? new Date(p.createdAt.seconds * 1000) : null);
        return createdAt && createdAt > newPostCutoff;
      });
    } else if (activeTab === 'recent') {
      onecutTabPosts = onecutAllPosts.filter(p => {
        const createdAt = p.createdAt?.toDate ? p.createdAt.toDate() : (p.createdAt?.seconds ? new Date(p.createdAt.seconds * 1000) : null);
        return (p.likes || 0) >= POST_FILTER.REGISTERED_MIN_LIKES && (!createdAt || createdAt <= newPostCutoff);
      });
    } else if (activeTab === 'best') {
      onecutTabPosts = onecutAllPosts.filter(p => (p.likes || 0) >= POST_FILTER.BEST_MIN_LIKES);
    } else if (activeTab === 'rank') {
      onecutTabPosts = onecutAllPosts.filter(p => (p.likes || 0) >= POST_FILTER.RANK_MIN_LIKES);
    } else if (activeTab === 'friend') {
      onecutTabPosts = onecutAllPosts.filter(p =>
        friends.includes(p.author) && (p.likes || 0) >= POST_FILTER.REGISTERED_MIN_LIKES
      );
    }
    onecutTabPosts = onecutTabPosts.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

    // 🖋️ 잉크병 인라인 섹션: 탭 기준과 동일한 필터 → 최신순 정렬
    const inkwellAllPosts = allRootPosts.filter(p => p.category === 'magic_inkwell' && !p.isHidden);
    let inkwellTabPosts: Post[] = [];
    if (activeTab === 'any') {
      inkwellTabPosts = inkwellAllPosts.filter(p => {
        const createdAt = p.createdAt?.toDate ? p.createdAt.toDate() : (p.createdAt?.seconds ? new Date(p.createdAt.seconds * 1000) : null);
        return createdAt && createdAt > newPostCutoff;
      });
    } else if (activeTab === 'recent') {
      inkwellTabPosts = inkwellAllPosts.filter(p => {
        const createdAt = p.createdAt?.toDate ? p.createdAt.toDate() : (p.createdAt?.seconds ? new Date(p.createdAt.seconds * 1000) : null);
        return (p.likes || 0) >= POST_FILTER.REGISTERED_MIN_LIKES && (!createdAt || createdAt <= newPostCutoff);
      });
    } else if (activeTab === 'best') {
      inkwellTabPosts = inkwellAllPosts.filter(p => (p.likes || 0) >= POST_FILTER.BEST_MIN_LIKES);
    } else if (activeTab === 'rank') {
      inkwellTabPosts = inkwellAllPosts.filter(p => (p.likes || 0) >= POST_FILTER.RANK_MIN_LIKES);
    } else if (activeTab === 'friend') {
      inkwellTabPosts = inkwellAllPosts.filter(p =>
        friends.includes(p.author) && (p.likes || 0) >= POST_FILTER.REGISTERED_MIN_LIKES
      );
    }
    inkwellTabPosts = inkwellTabPosts.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

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
          <AnyTalkList posts={authorPosts} onTopicClick={handleViewPost} onLikeClick={handleLike} commentCounts={commentCounts} currentNickname={userData?.nickname} currentUserData={userData} allUsers={allUsers} followerCounts={followerCounts} tab={activeTab} onAuthorClick={setPublicProfileNick} onShareCount={handleShareCount} />
        </div>
      );
    }

    const searchedPosts = filterBySearch(filteredPosts);

    // 🖋️ 구독글 탭 빈 상태 — AnyTalkList의 일반 빈 메시지 대신 친절 안내
    if (activeTab === 'subscribed' && searchedPosts.length === 0) {
      return (
        <div className="w-full animate-in fade-in">
          <div className="py-32 flex flex-col items-center justify-center text-center">
            <div className="text-5xl mb-4 opacity-40">📚</div>
            <p className="text-sm text-slate-500 font-bold mb-1">아직 구독한 작품이 없어요</p>
            <p className="text-[12px] text-slate-500 font-bold">잉크병에서 마음에 드는 작품을 구독해보세요</p>
            <button
              onClick={() => { setActiveMenu('inkwell'); setSelectedSeriesId(null); setSelectedEpisodeId(null); setInkwellMode('list'); setInkwellTab('series'); }}
              className="mt-5 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-[1000] transition-colors"
            >
              🖋️ 작품 둘러보기
            </button>
          </div>
        </div>
      );
    }

    // 🤝 깐부글 탭 빈 상태 — 친절 안내 + 깐부맺기 메뉴 이동 버튼
    if (activeTab === 'friend' && searchedPosts.length === 0) {
      return (
        <div className="w-full animate-in fade-in">
          <div className="py-32 flex flex-col items-center justify-center text-center">
            <div className="text-5xl mb-4 opacity-40">🤝</div>
            <p className="text-sm text-slate-500 font-bold mb-1">
              {friends.length === 0 ? '아직 맺은 깐부가 없어요' : '깐부가 작성한 등록글이 아직 없어요'}
            </p>
            <p className="text-[12px] text-slate-500 font-bold">
              {friends.length === 0 ? '마음에 드는 깐부를 맺어보세요' : '깐부가 새 글을 올리길 기다려보세요'}
            </p>
            <button
              onClick={() => { setActiveMenu('friends'); setSelectedTopic(null); setIsCreateOpen(false); }}
              className="mt-5 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-[1000] transition-colors"
            >
              🤝 깐부 맺기
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="w-full animate-in fade-in">
        {/* 깐부글 탭: 깐부 아바타 칩 가로 스크롤 */}
        {activeTab === 'friend' && friends.length > 0 && (
          <div className="flex items-center gap-2 px-1 pb-3 overflow-x-auto">
            <button
              onClick={() => setSelectedFriend(null)}
              className={`flex items-center px-3 py-1.5 rounded-full text-[11px] font-[1000] transition-all shrink-0 ${!selectedFriend ? 'bg-violet-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
            >전체</button>
            {friends.map(nick => (
              <button
                key={nick}
                onClick={() => setSelectedFriend(selectedFriend === nick ? null : nick)}
                className={`flex items-center gap-1.5 pl-1.5 pr-3 py-1 rounded-full text-[11px] font-[1000] transition-all shrink-0 ${selectedFriend === nick ? 'bg-violet-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
              >
                <img src={`${EXTERNAL_URLS.AVATAR_BASE}${nick}`} className="w-5 h-5 rounded-full bg-white" alt="" />
                {nick}
              </button>
            ))}
          </div>
        )}
        <AnyTalkList posts={searchedPosts} onTopicClick={handleViewPost} onLikeClick={handleLike} commentCounts={commentCounts} currentNickname={userData?.nickname} currentUserData={userData} allUsers={allUsers} followerCounts={followerCounts} tab={activeTab} onAuthorClick={setPublicProfileNick} onShareCount={handleShareCount} allPosts={allRootPosts} oneCutPosts={onecutTabPosts} onOneCutMoreClick={() => setActiveMenu('onecut')} onFriendsMoreClick={() => setActiveMenu('friends')} friends={friends} onToggleFriend={toggleFriend} inkwellPosts={inkwellTabPosts} onInkwellMoreClick={() => { setActiveMenu('inkwell'); setSelectedSeriesId(null); setSelectedEpisodeId(null); setInkwellMode('list'); }} />
      </div>
    );
  };

  return (
    <div className="bg-[#F8FAFC] text-slate-900 font-sans h-screen flex flex-col overflow-hidden">
      <header className="bg-white border-b border-slate-300 h-[56px] md:h-[64px] flex items-center justify-between px-4 md:px-6 shrink-0 z-50 shadow-sm">
        <div className="flex items-center gap-4">
          {/* 데스크톱: ≡+글러브 함께 클릭 → 홈 */}
          <div className="hidden md:flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity shrink-0" onClick={goHome}>
            <svg className="w-3 h-5 shrink-0" fill="none" strokeWidth="2" strokeLinecap="round" viewBox="0 4 12 16">
              <line x1="1" y1="6"  x2="11" y2="6"  stroke="#7c3aed" />
              <line x1="1" y1="12" x2="11" y2="12" stroke="#7c3aed" />
              <line x1="1" y1="18" x2="11" y2="18" stroke="#7c3aed" />
            </svg>
            <h1 className="text-[26px] font-[1000] italic tracking-tighter shrink-0">
              <span className="text-red-500">G</span><span className="text-blue-600">L</span><span className="text-slate-900">ove</span>
            </h1>
          </div>
          {/* 모바일: GLove 로고만 (터치 시 홈 이동, ≡ 버튼은 하단 탭바로 이동) */}
          <h1 className="flex md:hidden text-[26px] font-[1000] italic tracking-tighter cursor-pointer shrink-0" onClick={goHome}>
            <span className="text-red-500">G</span><span className="text-blue-600">L</span><span className="text-slate-900">ove</span>
          </h1>
          <div className="hidden md:flex gap-1.5 items-center px-4 border-l border-slate-100" onClick={(e) => e.stopPropagation()}>
            <span className="text-[9px] font-black text-slate-300 uppercase tracking-tighter mr-1">Dev:</span>
            {TEST_ACCOUNTS.map((acc, i) => (
              <button key={i} onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleTestLogin(acc); }} className={`text-[10px] font-bold px-1.5 py-1 rounded border transition-all ${userData?.nickname === acc.nickname ? 'bg-violet-600 text-white border-violet-600' : 'bg-slate-50 text-slate-500 hover:text-violet-600 border-slate-100 hover:bg-white'}`}>{acc.nickname.replace('깐부', '').replace('호', '')}</button>
            ))}
          </div>
        </div>
        <div className="hidden md:flex flex-1 justify-center h-full items-center px-4"><div className="relative flex items-center bg-slate-50/80 rounded-full px-4 h-[42px] border border-slate-100 focus-within:border-violet-500 focus-within:bg-white transition-all w-full max-w-sm"><svg className="w-4 h-4 text-slate-400 mr-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg><input type="text" placeholder="검색어를 입력해 주세요." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="bg-transparent outline-none w-full text-[13px] font-bold text-slate-700" /></div></div>
        {/* 🚀 데스크톱 우측 액션 — 모바일에서 숨김 */}
        <div className="hidden md:flex items-center gap-4 ml-auto shrink-0">{isLoading ? <div className="w-8 h-8 border-2 border-violet-600 border-t-transparent rounded-full animate-spin"></div> : userData ? <>{!['giant_tree', 'glove', 'ranking'].includes(activeMenu) && <button onClick={() => setIsCreateOpen(true)} className="bg-violet-600 hover:bg-violet-700 text-white px-5 h-[40px] rounded-xl text-[13px] font-black shadow-sm">+ 새 글</button>}<NotificationBell currentUid={userData.uid} currentNickname={userData.nickname} onNavigate={(postId) => { const post = allRootPosts.find(p => p.id === postId); if (post) { setSelectedTopic(post); setActiveMenu('home'); } }} onNavigateToEpisode={(postId, seriesId) => { setActiveMenu('inkwell'); if (seriesId) setSelectedSeriesId(seriesId); setSelectedEpisodeId(postId); setInkwellMode('list'); }} /><div className="flex items-center gap-3"><div className="w-[42px] h-[42px] rounded-full border-2 border-slate-100 overflow-hidden cursor-pointer bg-slate-50" onClick={() => { setPublicProfileNick(userData.nickname); setSelectedTopic(null); setIsCreateOpen(false); }}><img src={userData.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${userData.nickname}`} alt="avatar" /></div><button onClick={handleLogout} className="text-[11px] font-black text-slate-300 hover:text-rose-500 transition-colors uppercase tracking-widest">Logout</button></div></> : <button onClick={handleLogin} className="flex items-center gap-2 bg-white border border-slate-200 hover:border-slate-900 px-5 h-[42px] rounded-xl text-[13px] font-black transition-all shadow-sm group"><svg className="w-4 h-4 group-hover:scale-110 transition-transform" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>구글 계정으로 시작하기</button>}</div>
        {/* 🚀 모바일 우측 — 알림 + 내정보/로그인 버튼 */}
        <div className="flex md:hidden items-center gap-1.5 ml-auto shrink-0">
          {userData ? (
            <>
              <NotificationBell
                currentUid={userData.uid}
                currentNickname={userData.nickname}
                onNavigate={(postId) => { const post = allRootPosts.find(p => p.id === postId); if (post) { setSelectedTopic(post); setActiveMenu('home'); } }}
                onNavigateToEpisode={(postId, seriesId) => {
                  // 🖋️ Phase 5: 잉크병 알림 → EpisodeReader 직접 라우팅
                  setActiveMenu('inkwell');
                  if (seriesId) setSelectedSeriesId(seriesId);
                  setSelectedEpisodeId(postId);
                  setInkwellMode('list');
                }}
              />
              <button onClick={() => { setPublicProfileNick(userData.nickname); setSelectedTopic(null); setIsCreateOpen(false); }} className={`w-9 h-9 rounded-full overflow-hidden border-2 transition-all ${publicProfileNick ? 'border-violet-400' : 'border-slate-200'}`}>
                <img src={userData.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${userData.nickname}`} alt="프로필" className="w-full h-full object-cover" />
              </button>
            </>
          ) : (
            <button onClick={handleLogin} className="flex items-center gap-1.5 bg-violet-600 text-white px-3 h-8 rounded-xl text-[12px] font-black shadow-sm">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              로그인
            </button>
          )}
        </div>
      </header>
      <div className="flex flex-1 overflow-hidden">{!(selectedTopic || isCreateOpen) && <Sidebar activeMenu={activeMenu} setActiveMenu={(menu) => { setActiveMenu(menu); setSelectedTopic(null); setIsCreateOpen(false); setSelectedRoom(null); setSelectedSeriesId(null); setSelectedEpisodeId(null); setInkwellMode('list'); }} kanbuRoomCount={accessibleRooms.length} currentNickname={userData?.nickname} />}<main className={`flex-1 overflow-y-auto bg-[#F8FAFC] transition-all duration-500 ${(selectedTopic || isCreateOpen) ? 'px-4 md:px-6 pt-4' : 'pt-0'}`}><div className={(selectedTopic || isCreateOpen) ? "max-w-[1600px] mx-auto pb-20 md:pb-20 pb-28" : "pb-20 md:pb-20 pb-28"}>
        {!(selectedTopic || isCreateOpen) && (
          (activeMenu === 'home' || activeMenu === 'onecut') ? (
            <SubNavbar activeTab={activeTab} onTabClick={setActiveTab} showTabs={true} />
          ) : (MENU_MESSAGES[activeMenu] && activeMenu !== 'giant_tree' && activeMenu !== 'kanbu_room' && activeMenu !== 'friends' && activeMenu !== 'inkwell' && activeMenu !== 'market') ? (
            <CategoryHeader menuInfo={MENU_MESSAGES[activeMenu]} />
          ) : null
        )}
        <div className={(selectedTopic || isCreateOpen) ? "w-full" : "w-full px-4"}>
          <Suspense fallback={<div className="w-full flex items-center justify-center py-20"><div className="w-6 h-6 border-2 border-violet-600 border-t-transparent rounded-full animate-spin"></div></div>}>
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
                setSelectedSeriesId(null);
                setSelectedEpisodeId(null);
                setInkwellMode('list');
                setIsMobileMenuOpen(false);
              }}
              kanbuRoomCount={accessibleRooms.length}
              currentNickname={userData?.nickname}
              mobile={true}
              onClose={() => setIsMobileMenuOpen(false)}
            />
          </div>
        </div>
      )}

      {/* 🚀 모바일 하단 탭바 — 텍스트 없음, 5탭, 중앙 새글 버튼 돌출 */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white/95 backdrop-blur-md border-t border-slate-100 flex items-end h-16 pb-1 safe-area-inset-bottom">
        {/* ≡ 메뉴 (드로어 열기) — 왼손 접근 최적 */}
        <button onClick={() => setIsMobileMenuOpen(true)} className="flex-1 flex flex-col items-center justify-center h-full active:opacity-70 transition-opacity">
          <svg className="w-[24px] h-[24px]" fill="none" strokeWidth="2.5" strokeLinecap="round" viewBox="0 0 24 24">
            <line x1="4" y1="7" x2="20" y2="7" stroke="#7c3aed" />
            <line x1="4" y1="12" x2="20" y2="12" stroke="#7c3aed" />
            <line x1="4" y1="17" x2="20" y2="17" stroke="#7c3aed" />
          </svg>
        </button>
        {/* 한컷 */}
        <button onClick={() => { setActiveMenu('onecut'); setSelectedTopic(null); setIsCreateOpen(false); }} className={`flex-1 flex flex-col items-center justify-center h-full transition-colors ${activeMenu === 'onecut' && !selectedTopic && !isCreateOpen ? 'text-violet-600' : 'text-slate-400'}`}>
          {activeMenu === 'onecut' && !selectedTopic && !isCreateOpen ? (
            <svg className="w-[24px] h-[24px]" fill="currentColor" viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>
          ) : (
            <svg className="w-[24px] h-[24px]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          )}
        </button>
        {/* 🚀 새글 — 중앙 돌출 원형 버튼 (월드와이드 패턴) */}
        <button
          onClick={() => { setActiveMenu('home'); setIsCreateOpen(true); setSelectedTopic(null); }}
          className="flex-1 flex flex-col items-center justify-start"
        >
          <div className={`w-13 h-13 w-[52px] h-[52px] rounded-full flex items-center justify-center shadow-lg transition-all -mt-5 border-4 border-white ${isCreateOpen ? 'bg-violet-700 scale-95' : 'bg-violet-600'}`}>
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth="2.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" d="M12 5v14M5 12h14"/>
            </svg>
          </div>
        </button>
        {/* 장갑 */}
        <button onClick={() => { setActiveMenu('glove'); setSelectedTopic(null); setIsCreateOpen(false); }} className={`flex-1 flex flex-col items-center justify-center h-full transition-colors ${activeMenu === 'glove' && !selectedTopic && !isCreateOpen ? 'text-violet-600' : 'text-slate-400'}`}>
          {activeMenu === 'glove' && !selectedTopic && !isCreateOpen ? (
            <svg className="w-[24px] h-[24px]" fill="currentColor" viewBox="0 0 24 24"><path d="M21 7.5C21 6.1 19.9 5 18.5 5S16 6.1 16 7.5V12h-.5V4.5C15.5 3.1 14.4 2 13 2s-2.5 1.1-2.5 2.5V12H10V5.5C10 4.1 8.9 3 7.5 3S5 4.1 5 5.5V13h-.5C3.7 13 3 13.7 3 14.5v1C3 18.6 5.4 21 8.5 21h6c2.8 0 5.1-1.9 5.8-4.5L21 11V7.5z"/></svg>
          ) : (
            <svg className="w-[24px] h-[24px]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M18.5 5C19.9 5 21 6.1 21 7.5V11l-.7 5.5C19.6 19.1 17.3 21 14.5 21h-6C5.4 21 3 18.6 3 15.5v-1C3 13.7 3.7 13 4.5 13H5V5.5C5 4.1 6.1 3 7.5 3S10 4.1 10 5.5V12h.5V4.5C10.5 3.1 11.6 2 13 2s2.5 1.1 2.5 2.5V12h.5V7.5C16 6.1 17.1 5 18.5 5z"/></svg>
          )}
        </button>
        {/* 랭킹 */}
        <button onClick={() => { setActiveMenu('ranking'); setSelectedTopic(null); setIsCreateOpen(false); }} className={`flex-1 flex flex-col items-center justify-center h-full transition-colors ${activeMenu === 'ranking' && !selectedTopic && !isCreateOpen ? 'text-violet-600' : 'text-slate-400'}`}>
          {activeMenu === 'ranking' && !selectedTopic && !isCreateOpen ? (
            <svg className="w-[24px] h-[24px]" fill="currentColor" viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zm4.24 16L12 15.45 7.77 18l1.12-4.81-3.73-3.23 4.92-.42L12 5l1.92 4.53 4.92.42-3.73 3.23L16.23 18z"/></svg>
          ) : (
            <svg className="w-[24px] h-[24px]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>
          )}
        </button>
      </nav>

      {/* 🚀 인앱 브라우저 로그인 차단 모달 */}
      {inAppModal && (
        <InAppBrowserModal
          appName={inAppModal.appName}
          isIOS={inAppModal.isIOS}
          isAndroid={inAppModal.isAndroid}
          currentUrl={inAppModal.currentUrl}
          onOpenExternal={() => { openExternalBrowser(); closeInAppModal(); }}
          onClose={closeInAppModal}
        />
      )}
    </div>
  );
}

export default App;
