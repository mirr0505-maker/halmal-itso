// src/App.tsx — 루트 컴포넌트 (전역 상태, 실시간 리스너, 라우팅)
import { useState, useEffect, lazy, Suspense } from 'react';
import { db, auth, googleProvider } from './firebase';
import { signInWithPopup, signOut, setPersistence, browserLocalPersistence, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { serverTimestamp, doc, setDoc, updateDoc, increment, arrayUnion, arrayRemove } from 'firebase/firestore';
import type { Post, KanbuRoom } from './types';
import { useFirebaseListeners } from './hooks/useFirebaseListeners';
// 항상 초기 화면에 필요한 컴포넌트 — 정적 import 유지
import AnyTalkList from './components/AnyTalkList';
import NotificationBell from './components/NotificationBell';
import Sidebar from './components/Sidebar';
import type { MenuId } from './components/Sidebar';
import SubNavbar from './components/SubNavbar';
import CategoryHeader from './components/CategoryHeader';
import { TEST_ACCOUNTS, MENU_MESSAGES } from './constants';
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
const CREATE_MENU_COMPONENTS: Record<string, ReturnType<typeof lazy>> = {
  my_story:        lazy(() => import('./components/CreateMyStory')),
  naked_king:      lazy(() => import('./components/CreateNakedKing')),
  donkey_ears:     lazy(() => import('./components/CreateDebate')),
  knowledge_seller:lazy(() => import('./components/CreateKnowledge')),
  bone_hitting:    lazy(() => import('./components/CreateBoneHitting')),
  local_news:      lazy(() => import('./components/CreateLocalNews')),
  exile_place:     lazy(() => import('./components/CreateExile')),
  market:          lazy(() => import('./components/CreateMarket')),
};

function App() {
  // Firebase 실시간 데이터 — useFirebaseListeners 훅에서 관리
  const {
    allRootPosts, setAllRootPosts,
    allChildPosts,
    userData, setUserData,
    allUsers,
    followerCounts,
    friends,
    blocks,
    isLoading,
    kanbuRooms,
  } = useFirebaseListeners();

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
  const [selectedRoom, setSelectedRoom] = useState<KanbuRoom | null>(null);
  const [isCreateRoomOpen, setIsCreateRoomOpen] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<string | null>(null);
  const [viewingAuthor, setViewingAuthor] = useState<string | null>(null);

  const accessibleRooms = kanbuRooms.filter(r =>
    r.creatorNickname === userData?.nickname || friends.includes(r.creatorNickname)
  );

  useEffect(() => { if (replyTarget) { setSelectedType('comment'); setNewTitle(""); } }, [replyTarget]);
  useEffect(() => { setSelectedFriend(null); setViewingAuthor(null); }, [activeMenu, activeTab]);

  const goHome = () => {
    setActiveMenu('home'); setSelectedTopic(null); setIsCreateOpen(false); setReplyTarget(null); setEditingPost(null);
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

  const handleLogin = async () => {
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
    acc[post.id] = allChildPosts.filter(child => child.rootId === post.id).length;
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
      await updateDoc(doc(db, "posts", postId), { likes: Math.max(0, (targetPost.likes || 0) + diff), likedBy: isLiked ? arrayRemove(userData.nickname) : arrayUnion(userData.nickname) });
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
      if (CREATE_MENU_COMPONENTS[activeMenu]) {
        const CreateComponent = CREATE_MENU_COMPONENTS[activeMenu];
        return <CreateComponent userData={userData} editingPost={editingPost} onSubmit={handlePostSubmit} onClose={() => { setIsCreateOpen(false); setEditingPost(null); }} />;
      }
      return <CreatePostBox userData={userData} editingPost={editingPost} activeMenu={activeMenu} menuMessages={MENU_MESSAGES} onSubmit={handlePostSubmit} onClose={() => { setIsCreateOpen(false); setEditingPost(null); }} />;
    }
    
    if (activeMenu === 'mypage') {
      if (userData) {
        const userPosts = allRootPosts.filter(p => p.author_id === userData.uid || p.author === userData.nickname);
        const userComments = allChildPosts.filter(p => p.author_id === userData.uid || p.author === userData.nickname);
        return <MyPage userData={userData} allUserRootPosts={userPosts} allUserChildPosts={userComments} friends={friends} friendCount={followerCounts[userData.nickname] || 0} onPostClick={handleViewPost} onEditPost={(post) => { setEditingPost(post); setIsCreateOpen(true); }} onToggleFriend={toggleFriend} allUsers={allUsers} followerCounts={followerCounts} toggleBlock={toggleBlock} blocks={blocks} />;
      }
      return <div className="w-full py-40 text-center"><button onClick={handleLogin} className="bg-slate-900 text-white px-8 py-3 rounded-xl font-black shadow-lg">로그인하기</button></div>;
    }

    if (activeMenu === 'friends') {
      const allowedNicknames = ["깐부1호", "깐부2호", "깐부3호", "깐부4호", "흑무영"];
      const others = Object.values(allUsers).filter(u => u.nickname && u.nickname !== userData?.nickname && !u.uid.startsWith('nickname_') && allowedNicknames.includes(u.nickname));
      return (
        <div className="w-full max-w-4xl mx-auto py-10 px-4 animate-in fade-in">
          <div className="text-center mb-12"><h2 className="text-3xl font-[1000] text-slate-900 mb-2">🤝 깐부 맺기 홍보</h2><p className="text-slate-500 font-bold">새로운 인연을 맺고 깊은 토론을 나눠보세요.</p></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{others.map(u => (
            <div key={u.uid} className="bg-white border border-slate-100 p-6 rounded-2xl flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-4"><div className="w-14 h-14 rounded-full overflow-hidden bg-slate-50 shrink-0"><img src={u.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${u.nickname}`} alt="" className="w-full h-full object-cover" /></div><div><h3 className="font-[1000] text-slate-900">{u.nickname}</h3><p className="text-xs text-slate-400 font-bold">깐부 {followerCounts[u.nickname] || 0} · 좋아요 {u.likes?.toLocaleString() || 0}</p></div></div>
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
          const myStory = ['너와 나의 이야기', '나의 이야기'];
          const liveIsMyStory = !livePost.category || myStory.includes(livePost.category);
          if (liveIsMyStory) return !p.category || myStory.includes(p.category || '');
          return p.category === livePost.category;
        })} onTopicChange={handleViewPost} userData={userData} friends={friends} onToggleFriend={toggleFriend} onPostClick={() => {}} replyTarget={replyTarget} setReplyTarget={setReplyTarget} handleSubmit={handleCommentSubmit} selectedSide={selectedSide} setSelectedSide={setSelectedSide} selectedType={selectedType} setSelectedType={setSelectedType} newTitle={newTitle} setNewTitle={setNewTitle} newContent={newContent} setNewContent={setNewContent} isSubmitting={isSubmitting} commentCounts={commentCounts} onLikeClick={handleLike} currentNickname={userData?.nickname} allUsers={allUsers} followerCounts={followerCounts} toggleBlock={toggleBlock} onEditPost={(post) => { setEditingPost(post); setIsCreateOpen(true); }} onInlineReply={handleInlineReply} onBack={() => { setSelectedTopic(null); setReplyTarget(null); setEditingPost(null); }} />;
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
          ? (p.category === "너와 나의 이야기" || p.category === "나의 이야기" || p.category === undefined)
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
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

    let filteredPosts = basePosts;
    if (activeTab === 'any') {
      filteredPosts = basePosts.filter(p => {
        const createdAt = p.createdAt?.toDate ? p.createdAt.toDate() : (p.createdAt?.seconds ? new Date(p.createdAt.seconds * 1000) : null);
        return createdAt && createdAt > twoHoursAgo;
      });
    } else if (activeTab === 'recent') {
      // 등록글: 새글(2시간) 심사를 통과한 글 — 2시간 경과 + 좋아요 3개 이상
      filteredPosts = basePosts.filter(p => {
        const createdAt = p.createdAt?.toDate ? p.createdAt.toDate() : (p.createdAt?.seconds ? new Date(p.createdAt.seconds * 1000) : null);
        return (p.likes || 0) >= 3 && (!createdAt || createdAt <= twoHoursAgo);
      });
    } else if (activeTab === 'best') {
      filteredPosts = basePosts.filter(p => (p.likes || 0) >= 10);
    } else if (activeTab === 'rank') {
      filteredPosts = basePosts.filter(p => (p.likes || 0) >= 30);
    } else if (activeTab === 'friend') {
      // 깐부글: 좋아요 3개 이상 + 팔로우 유저 (시간 제한 없음 — 친구들의 좋은 글 모아보기)
      filteredPosts = basePosts.filter(p =>
        friends.includes(p.author) && (p.likes || 0) >= 3
      );
      // 특정 깐부 선택 시 추가 필터
      if (selectedFriend) filteredPosts = filteredPosts.filter(p => p.author === selectedFriend);
    }

    // 특정 작가 피드 보기 (A 탭 칩 또는 글카드 작가 클릭)
    if (viewingAuthor) {
      const authorPosts = filterBySearch(basePosts.filter(p => p.author === viewingAuthor));
      const avatarSrc = `https://api.dicebear.com/7.x/adventurer/svg?seed=${viewingAuthor}`;
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
                <img src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${nick}`} className="w-5 h-5 rounded-full bg-white" alt="" />
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
    setIsCreateOpen(false); setEditingPost(null);
  };

  const handleInlineReply = async (content: string, parentPost: Post | null) => {
    if (!userData || !content.trim() || !selectedTopic) return;
    const customId = `comment_${Date.now()}_${userData.uid}`;
    await setDoc(doc(db, "posts", customId), { author: userData.nickname, author_id: userData.uid, title: null, content, parentId: parentPost ? parentPost.id : selectedTopic.id, rootId: selectedTopic.id, side: 'left', type: 'comment', authorInfo: { level: userData.level, friendCount: friends.length, totalLikes: userData.likes }, createdAt: serverTimestamp(), likes: 0, dislikes: 0 });
    await updateDoc(doc(db, "users", userData.uid), { likes: increment(1) });
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!userData || !newContent.trim() || !selectedTopic) return;
    setIsSubmitting(true);
    const customId = `comment_${Date.now()}_${userData.uid}`;
    await setDoc(doc(db, "posts", customId), { author: userData.nickname, author_id: userData.uid, title: selectedType === 'formal' ? newTitle : null, content: newContent, parentId: replyTarget ? replyTarget.id : selectedTopic.id, rootId: selectedTopic.id, side: selectedSide, type: selectedType, authorInfo: { level: userData.level, friendCount: friends.length, totalLikes: userData.likes }, createdAt: serverTimestamp(), likes: 0, dislikes: 0 });
    await updateDoc(doc(db, "users", userData.uid), { likes: increment(selectedType === 'formal' ? 2 : 1) });
    setNewTitle(""); setNewContent(""); setReplyTarget(null); setIsSubmitting(false);
  };

  return (
    <div className="bg-[#F8FAFC] text-slate-900 font-sans h-screen flex flex-col overflow-hidden">
      <header className="bg-white border-b border-slate-100 h-[64px] flex items-center justify-between px-6 shrink-0 z-50 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-40 flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity shrink-0" onClick={goHome}><h1 className="text-[22px] font-[1000] italic tracking-tighter shrink-0"><span className="text-blue-600">GL</span><span className="text-slate-900">ove</span></h1><div className="flex flex-col"><span className="text-[11px] font-[1000] text-slate-500 tracking-tight leading-tight">글러브</span><span className="text-[9px] font-black text-slate-300 tracking-tight leading-tight">집단지성의 힘</span></div></div>
          <div className="flex gap-1.5 items-center px-4 border-l border-slate-100" onClick={(e) => e.stopPropagation()}>
            <span className="text-[9px] font-black text-slate-300 uppercase tracking-tighter mr-1">Dev:</span>
            {TEST_ACCOUNTS.map((acc, i) => (
              <button key={i} onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleTestLogin(acc); }} className={`text-[10px] font-bold px-2 py-1 rounded border transition-all ${userData?.nickname === acc.nickname ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-500 hover:text-blue-600 border-slate-100 hover:bg-white'}`}>{acc.nickname}</button>
            ))}
          </div>
        </div>
        <div className="flex-1 flex justify-center h-full items-center px-4"><div className="relative flex items-center bg-slate-50/80 rounded-full px-4 h-[42px] border border-slate-100 focus-within:border-blue-500 focus-within:bg-white transition-all w-full max-w-sm"><svg className="w-4 h-4 text-slate-400 mr-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg><input type="text" placeholder="검색어를 입력해 주세요." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="bg-transparent outline-none w-full text-[13px] font-bold text-slate-700" /></div></div>
        <div className="flex items-center gap-4 ml-auto shrink-0">{isLoading ? <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div> : userData ? <><button onClick={() => setIsCreateOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-5 h-[40px] rounded-xl text-[13px] font-black shadow-sm">+ 새 글</button><NotificationBell currentNickname={userData.nickname} onNavigate={(postId) => { const post = allRootPosts.find(p => p.id === postId); if (post) { setSelectedTopic(post); setActiveMenu('home'); } }} /><div className="flex items-center gap-3"><div className="w-[42px] h-[42px] rounded-full border-2 border-slate-100 overflow-hidden cursor-pointer bg-slate-50" onClick={() => setActiveMenu('mypage')}><img src={userData.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${userData.nickname}`} alt="avatar" /></div><button onClick={handleLogout} className="text-[11px] font-black text-slate-300 hover:text-rose-500 transition-colors uppercase tracking-widest">Logout</button></div></> : <button onClick={handleLogin} className="flex items-center gap-2 bg-white border border-slate-200 hover:border-slate-900 px-5 h-[42px] rounded-xl text-[13px] font-black transition-all shadow-sm group"><svg className="w-4 h-4 group-hover:scale-110 transition-transform" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>구글 계정으로 시작하기</button>}</div>
      </header>
      <div className="flex flex-1 overflow-hidden">{!(selectedTopic || isCreateOpen) && <Sidebar activeMenu={activeMenu} setActiveMenu={(menu) => { setActiveMenu(menu); setSelectedTopic(null); setIsCreateOpen(false); setSelectedRoom(null); }} kanbuRoomCount={accessibleRooms.length} />}<main className={`flex-1 overflow-y-auto bg-[#F8FAFC] transition-all duration-500 ${(selectedTopic || isCreateOpen) ? 'px-4 md:px-6 pt-4' : 'pt-0'}`}><div className={(selectedTopic || isCreateOpen) ? "max-w-[1600px] mx-auto pb-20" : "pb-20"}>
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
    </div>
  );
}

export default App;
