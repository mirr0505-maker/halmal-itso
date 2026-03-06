// src/App.tsx
import { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, onSnapshot, serverTimestamp, doc, setDoc, updateDoc } from 'firebase/firestore';
import type { Post } from './types';
import MyPage from './components/MyPage';
import PostDetailModal from './components/PostDetailModal';
import DiscussionView from './components/DiscussionView'; 
import AnyTalkList from './components/AnyTalkList'; 
import LatestTalkList from './components/LatestTalkList';
import CreatePostBox from './components/CreatePostBox';
import Sidebar from './components/Sidebar';
import SubNavbar from './components/SubNavbar';

function App() {
  const [selectedTopic, setSelectedTopic] = useState<Post | null>(null);
  const [allRootPosts, setAllRootPosts] = useState<Post[]>([]);
  const [allChildPosts, setAllChildPosts] = useState<Post[]>([]);
  const [friends, setFriends] = useState<string[]>([]);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  
  const [searchQuery, setSearchQuery] = useState("");

  const [userData, setUserData] = useState({ 
    level: 1, likes: 0, bio: "지혜로운 투자자가 되기 위해 노력합니다.",
    nickname: "흑무영", email: "mirr0505@gmail.com",
    isPhoneVerified: true, avatarUrl: ""
  });

  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [selectedSide, setSelectedSide] = useState<'left' | 'right'>('left');
  const [selectedType, setSelectedType] = useState<'comment' | 'formal'>('comment');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [replyTarget, setReplyTarget] = useState<Post | null>(null);
  
  const [activeMenu, setActiveMenu] = useState<'home' | 'onecut' | 'friends' | 'mypage'>('home');
  const [activeTab, setActiveTab] = useState<'any' | 'recent' | 'best' | 'rank'>('any');

  const [isCreateOpen, setIsCreateOpen] = useState(false);

  useEffect(() => { if (replyTarget) { setSelectedType('comment'); setNewTitle(""); } }, [replyTarget]);

  useEffect(() => {
    try {
      const unsubPosts = onSnapshot(collection(db, "posts"), (snapshot) => {
        const posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));
        posts.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setAllRootPosts(posts.filter(p => !p.parentId || p.parentId === "" || p.id === "root_post_01"));
        setAllChildPosts(posts.filter(p => p.parentId && p.parentId !== "" && p.id !== "root_post_01"));
      }, (error) => {
        console.error("Firestore Posts Error:", error);
      });

      const unsubUser = onSnapshot(doc(db, "users", "user_heukmooyoung"), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setUserData(prev => ({ ...prev, ...data }));
          if (data.friendList) setFriends(data.friendList);
        }
      }, (error) => {
        console.error("Firestore User Error:", error);
      });

      return () => { unsubPosts(); unsubUser(); };
    } catch (e) {
      console.error("Firebase Initialization Error:", e);
    }
  }, []);

  const filterBySearch = (posts: Post[]) => {
    if (!searchQuery.trim()) return posts;
    const query = searchQuery.toLowerCase();
    return posts.filter(p => 
      (p.title?.toLowerCase().includes(query)) || 
      (p.content.toLowerCase().includes(query))
    );
  };

  const nowTime = new Date();
  const oneHourAgo = new Date(nowTime.getTime() - 60 * 60 * 1000);
  const sixHoursAgo = new Date(nowTime.getTime() - 6 * 60 * 60 * 1000);

  const anyTopics = filterBySearch(allRootPosts.filter(p => {
    const createdAt = p.createdAt?.toDate();
    const isNew = createdAt && createdAt > oneHourAgo;
    const isPopular = (p.likes || 0) >= 3;
    return isNew || isPopular;
  })); 

  const commentCounts = allRootPosts.reduce((acc, post) => {
    acc[post.id] = allChildPosts.filter(child => child.rootId === post.id).length;
    return acc;
  }, {} as Record<string, number>);

  const recentTopics = filterBySearch(allRootPosts.filter(p => (p.likes || 0) >= 3));
  const bestTopics = filterBySearch(allRootPosts.filter(p => {
    const createdAt = p.createdAt?.toDate();
    return createdAt && createdAt > sixHoursAgo && (p.likes || 0) >= 30;
  }));
  const friendTopics = filterBySearch(allRootPosts.filter(p => friends.includes(p.author)));

  const handleCreateTopic = async (title: string, content: string, imageUrl?: string, linkUrl?: string, tags?: string[]) => {
    try {
      const timestamp = Date.now();
      const customId = `topic_${timestamp}_${userData.nickname}`;
      await setDoc(doc(db, "posts", customId), { 
        author: userData.nickname, title, content, 
        imageUrl: imageUrl || null, linkUrl: linkUrl || null,
        tags: tags || [],
        authorInfo: { level: userData.level, friendCount: friends.length, totalLikes: userData.likes },
        parentId: null, rootId: null, side: 'left', type: 'formal', 
        createdAt: serverTimestamp(), likes: 0, dislikes: 0 
      });
      setIsCreateOpen(false);
    } catch (e) { console.error("주제 생성 실패:", e); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim()) return alert("내용을 입력하시오!");
    setIsSubmitting(true);
    try {
      const timestamp = Date.now();
      const typeLabel = selectedType === 'formal' ? 'formal' : 'reply';
      const customId = `${typeLabel}_${timestamp}_${userData.nickname}`;
      const parentId = replyTarget ? replyTarget.id : (selectedTopic?.id || "");
      const rootId = selectedTopic?.id || "";
      await setDoc(doc(db, "posts", customId), { 
        author: userData.nickname, title: selectedType === 'formal' ? newTitle : null, content: newContent, 
        parentId, rootId, side: selectedSide, type: selectedType, 
        authorInfo: { level: userData.level, friendCount: friends.length, totalLikes: userData.likes },
        createdAt: serverTimestamp(), likes: 0, dislikes: 0 
      });
      setNewTitle(""); setNewContent(""); setReplyTarget(null);
    } catch (e) { console.error(e); } finally { setIsSubmitting(false); }
  };

  const toggleFriend = async (author: string) => {
    if (author === userData.nickname) return alert("나 자신과는 이미 영원한 깐부입니다!");
    const newFriends = friends.includes(author) ? friends.filter(f => f !== author) : [...friends, author];
    setFriends(newFriends);
    try { await setDoc(doc(db, "users", "user_heukmooyoung"), { friendList: newFriends }, { merge: true }); } 
    catch (error) { console.error("깐부 명단 저장 실패:", error); }
  };

  const handleLike = async (e: React.MouseEvent | null, postId: string) => {
    if (e) e.stopPropagation();
    try {
      const postRef = doc(db, "posts", postId);
      const targetPost = [...allRootPosts, ...allChildPosts].find(p => p.id === postId);
      if (!targetPost) return;

      const likedBy = targetPost.likedBy || [];
      const isLiked = likedBy.includes(userData.nickname);
      
      let newLikedBy = [];
      let newLikesCount = 0;

      if (isLiked) {
        // 이미 좋아요를 누른 경우 -> 취소 (토글)
        newLikedBy = likedBy.filter(name => name !== userData.nickname);
        newLikesCount = Math.max(0, (targetPost.likes || 0) - 1);
      } else {
        // 처음 누르는 경우 -> 추가
        newLikedBy = [...likedBy, userData.nickname];
        newLikesCount = (targetPost.likes || 0) + 1;
      }

      await updateDoc(postRef, { 
        likes: newLikesCount,
        likedBy: newLikedBy
      });
    } catch (e) { console.error("좋아요 처리 실패:", e); }
  };

  const renderContent = () => {
    if (activeMenu === 'mypage') return (
      <MyPage 
        userData={userData} 
        allUserRootPosts={allRootPosts.filter(p => p.author === userData.nickname)} 
        allUserChildPosts={allChildPosts.filter(p => p.author === userData.nickname)} 
        friends={friends}
        friendCount={friends.length}
        onPostClick={setSelectedTopic}
        onToggleFriend={toggleFriend}
      />
    );
    if (activeMenu === 'onecut') return (
      <div className="w-full flex flex-col items-center justify-center py-40 gap-4">
        <span className="text-6xl grayscale opacity-50">🖼️</span>
        <p className="text-slate-400 font-black text-xl italic animate-pulse">한컷 시스템 준비 중이오...</p>
      </div>
    );
    if (activeMenu === 'friends') return (
      <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in fade-in">
        {friendTopics.length > 0 ? (
          friendTopics.map(post => <AnyTalkList key={post.id} posts={[post]} onTopicClick={setSelectedTopic} onLikeClick={handleLike} commentCounts={commentCounts} currentNickname={userData.nickname} />)
        ) : (
          <div className="col-span-full py-40 text-center"><p className="text-slate-400 font-black">깐부를 맺어보시오!</p></div>
        )}
      </div>
    );
// src/App.tsx
    if (selectedTopic) {
      const latestTopic = allRootPosts.find(p => p.id === selectedTopic.id) || selectedTopic;
      return (
        <DiscussionView
          rootPost={latestTopic}
          allPosts={allChildPosts.filter(p => p.rootId === selectedTopic.id)}
          otherTopics={allRootPosts.filter(p => p.id !== selectedTopic.id).slice(0, 5)}
          onTopicChange={setSelectedTopic}
          userData={userData} friends={friends} onToggleFriend={toggleFriend}
          onPostClick={() => {}} replyTarget={replyTarget} setReplyTarget={setReplyTarget}
          handleSubmit={handleSubmit} selectedSide={selectedSide} setSelectedSide={setSelectedSide}
          selectedType={selectedType} setSelectedType={setSelectedType}
          newTitle={newTitle} setNewTitle={setNewTitle} newContent={newContent} setNewContent={setNewContent}
          isSubmitting={isSubmitting}
          commentCounts={commentCounts}
          onLikeClick={handleLike}
          currentNickname={userData.nickname}
        />
      );
    }

    return (
      <div className="w-full animate-in fade-in">
        {activeTab === 'any' && <AnyTalkList posts={anyTopics} onTopicClick={setSelectedTopic} onLikeClick={handleLike} commentCounts={commentCounts} currentNickname={userData.nickname} />}
        {activeTab === 'recent' && <LatestTalkList rootPosts={recentTopics} onTopicClick={setSelectedTopic} onLikeClick={handleLike} commentCounts={commentCounts} currentNickname={userData.nickname} />}
        {activeTab === 'best' && <LatestTalkList rootPosts={bestTopics} onTopicClick={setSelectedTopic} onLikeClick={handleLike} commentCounts={commentCounts} currentNickname={userData.nickname} />}
      </div>
    );
  };

  return (
    <div className="bg-[#F8FAFC] text-slate-900 font-sans h-screen flex flex-col overflow-hidden">
      {/* 🚀 1. 상단 바 */}
      <header className="bg-white border-b border-slate-100 h-[64px] flex items-center justify-between px-6 shrink-0 z-50">
        <div 
          className="w-40 flex items-center cursor-pointer hover:opacity-80 transition-opacity shrink-0"
          onClick={() => { setActiveMenu('home'); setSelectedTopic(null); }}
        >
          <h1 className="text-[22px] font-[1000] italic tracking-tighter">
            <span className="text-blue-600">HALMAL</span>
            <span className="text-slate-900">-ITSO</span>
          </h1>
        </div>

        <div className="flex-1 flex justify-center h-full items-center px-4">
          <div className="relative flex items-center bg-slate-50/80 rounded-full px-4 h-[42px] border border-slate-100 focus-within:border-blue-500 focus-within:bg-white transition-all w-full max-w-sm shadow-inner">
            <svg className="w-4 h-4 text-slate-400 mr-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input
              type="text" placeholder="검색어를 입력해 주세요."
              value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent outline-none w-full text-[13px] font-bold text-slate-700 placeholder:text-slate-400 leading-normal h-full"
            />
          </div>
        </div>

        <div className="flex items-center gap-4 ml-auto shrink-0">
          <button onClick={() => setIsCreateOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-5 h-[40px] rounded-xl text-[13px] font-black transition-all shadow-sm">+ 새 포스트</button>
          <button className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-50 text-slate-400 transition-colors">
            <svg className="w-[22px] h-[22px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
          </button>
          <div 
            className="w-[42px] h-[42px] rounded-full border-2 border-slate-100 overflow-hidden cursor-pointer bg-slate-50 shadow-sm"
            onClick={() => setActiveMenu('mypage')}
          >
            <img src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${userData.nickname}`} alt="avatar" className="w-full h-full object-cover" />
          </div>
        </div>
      </header>
      
      {/* 🚀 2. 하단 영역: 사이드바와 본문 */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar activeMenu={activeMenu} setActiveMenu={(menu) => { setActiveMenu(menu); setSelectedTopic(null); }} />
        
        <main className="flex-1 px-8 pt-0 pb-12 overflow-y-auto bg-[#F8FAFC]">
          <div className="max-w-[1500px] mx-auto">
            {/* 🚀 상세글 보기(selectedTopic) 중에는 탭을 숨겨서 본문이 위로 바짝 붙게 함 */}
            <SubNavbar activeTab={activeTab} onTabClick={setActiveTab} showTabs={activeMenu === 'home'} />
            {renderContent()}
          </div>
        </main>
      </div>

      {isCreateOpen && <CreatePostBox userData={userData} onSubmit={handleCreateTopic} onClose={() => setIsCreateOpen(false)} />}
      {selectedPost && (
        <PostDetailModal 
          post={[...allRootPosts, ...allChildPosts].find(p => p.id === selectedPost.id) || selectedPost} 
          onClose={() => setSelectedPost(null)} 
          currentNickname={userData.nickname}
          onLikeClick={handleLike}
          isFriend={friends.includes(selectedPost.author)}
          onToggleFriend={toggleFriend}
        />
      )}
    </div>
  );
}

export default App;
