// src/App.tsx
import { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, onSnapshot, addDoc, serverTimestamp, doc, setDoc, updateDoc } from 'firebase/firestore';
import type { Post } from './types';
import MyPage from './components/MyPage';
import PostDetailModal from './components/PostDetailModal';
import DiscussionView from './components/DiscussionView'; 
import AnyTalkList from './components/AnyTalkList'; 
import LatestTalkList from './components/LatestTalkList';
import CreatePostBox from './components/CreatePostBox';
import Sidebar from './components/Sidebar';
import TopNavbar from './components/TopNavbar';
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
        setAllRootPosts(posts.filter(p => !p.parentId || p.id === "root_post_01"));
        setAllChildPosts(posts.filter(p => p.parentId && p.id !== "root_post_01"));
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
  const sixHoursAgo = new Date(nowTime.getTime() - 6 * 60 * 60 * 1000);
  const oneHourAgo = new Date(nowTime.getTime() - 60 * 60 * 1000);

  const anyTopics = filterBySearch(allRootPosts.filter(p => {
    const createdAt = p.createdAt?.toDate();
    return createdAt && createdAt > sixHoursAgo;
  })); 

  const recentTopics = filterBySearch(allRootPosts.filter(p => {
    const createdAt = p.createdAt?.toDate();
    return createdAt && createdAt > oneHourAgo && (p.likes || 0) >= 3;
  }));

  const bestTopics = filterBySearch(allRootPosts.filter(p => {
    const createdAt = p.createdAt?.toDate();
    return createdAt && createdAt > sixHoursAgo && (p.likes || 0) >= 30;
  }));

  const friendTopics = filterBySearch(allRootPosts.filter(p => friends.includes(p.author)));

  const handleCreateTopic = async (title: string, content: string, imageUrl?: string, linkUrl?: string, tags?: string[]) => {
    try {
      await addDoc(collection(db, "posts"), { 
        author: userData.nickname, title, content, 
        imageUrl: imageUrl || null, linkUrl: linkUrl || null,
        tags: tags || [], // 🚀 태그 데이터 추가
        authorInfo: {
          level: userData.level,
          friendCount: friends.length,
          totalLikes: userData.likes
        },
        parentId: "", side: 'left', type: 'formal', 
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
      const parentId = replyTarget ? replyTarget.id : (selectedTopic?.id || "");
      await addDoc(collection(db, "posts"), { 
        author: userData.nickname, title: selectedType === 'formal' ? newTitle : null, content: newContent, 
        parentId: parentId, side: selectedSide, type: selectedType, 
        authorInfo: {
          level: userData.level,
          friendCount: friends.length,
          totalLikes: userData.likes
        },
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

  const handleLike = async (e: React.MouseEvent, postId: string) => {
    e.stopPropagation();
    try {
      const postRef = doc(db, "posts", postId);
      const targetPost = [...allRootPosts, ...allChildPosts].find(p => p.id === postId);
      if (targetPost) {
        await updateDoc(postRef, { likes: (targetPost.likes || 0) + 1 });
      }
    } catch (error) {
      console.error("추천 실패:", error);
    }
  };

  const renderContent = () => {
    // 🚀 1. 글쓰기 모드 (최우선순위)
    if (isCreateOpen) {
      return (
        <div className="w-full animate-in fade-in zoom-in-95 duration-300">
          <CreatePostBox 
            userData={userData} 
            onSubmit={handleCreateTopic} 
            onClose={() => setIsCreateOpen(false)} 
          />
        </div>
      );
    }

    // 🚀 2. 상세 보기 모드
    if (selectedTopic) {
      return (
        <div className="w-full animate-in fade-in slide-in-from-bottom-4">
          <DiscussionView 
            rootPost={selectedTopic}
            allPosts={allChildPosts.filter(p => p.parentId === selectedTopic.id)}
            otherTopics={allRootPosts.filter(p => p.id !== selectedTopic.id)}
            onTopicChange={setSelectedTopic}
            userData={userData} friends={friends} onToggleFriend={toggleFriend}
            onPostClick={(p) => setSelectedPost(p)} replyTarget={replyTarget} setReplyTarget={setReplyTarget}
            handleSubmit={handleSubmit} selectedSide={selectedSide} setSelectedSide={setSelectedSide}
            selectedType={selectedType} setSelectedType={setSelectedType}
            newTitle={newTitle} setNewTitle={setNewTitle} newContent={newContent} setNewContent={setNewContent}
            isSubmitting={isSubmitting}
          />
        </div>
      );
    }

    // 🚀 3. 메뉴별 모드
    if (activeMenu === 'home') {
      return (
        <div className="w-full animate-in fade-in">
          {activeTab === 'any' && <AnyTalkList posts={anyTopics} onTopicClick={setSelectedTopic} onLikeClick={handleLike} />}
          {activeTab === 'recent' && <LatestTalkList rootPosts={recentTopics} onTopicClick={setSelectedTopic} />}
          {activeTab === 'best' && <LatestTalkList rootPosts={bestTopics} onTopicClick={setSelectedTopic} />}
          {activeTab === 'rank' && <div className="py-40 text-center italic text-slate-300 font-[1000] text-2xl animate-pulse">🏆 명예말 랭킹 시스템 준비 중...</div>}
        </div>
      );
    }

    if (activeMenu === 'onecut') {
      return (
        <div className="w-full py-20 text-center animate-in fade-in">
          <div className="text-6xl mb-6">📸</div>
          <h2 className="text-3xl font-[1000] text-slate-800 mb-4 tracking-tighter">한컷 (스카이타워)</h2>
          <p className="font-bold text-slate-400">이미지 중심의 인기 게시물 피드를 준비 중입니다.</p>
        </div>
      );
    }

    if (activeMenu === 'friends') {
      return (
        <div className="w-full animate-in fade-in">
          <h2 className="text-2xl font-[1000] mb-6 flex items-center gap-2 tracking-tighter text-slate-800">🤝 깐부 소식</h2>
          <LatestTalkList rootPosts={friendTopics} onTopicClick={setSelectedTopic} />
        </div>
      );
    }

    if (activeMenu === 'mypage') {
      return (
        <MyPage 
          allUserChildPosts={allChildPosts.filter(p => p.author === userData.nickname)} 
          allUserRootPosts={allRootPosts.filter(p => p.author === userData.nickname)} 
          userData={userData} 
          friends={friends} 
          friendCount={friends.length} 
          onPostClick={(p) => setSelectedPost(p)} 
          onToggleFriend={toggleFriend}
        />
      );
    }
  };

  if (allRootPosts.length === 0 && !selectedTopic) return (
    <div className="flex flex-col justify-center items-center h-screen bg-[#F8FAFC] p-10 text-center">
      <div className="text-4xl mb-6 animate-bounce">🐎</div>
      <div className="text-2xl font-[1000] text-slate-800 tracking-tighter mb-2">팔도 할말 모으는 중...</div>
      <p className="text-slate-400 font-bold mb-10">잠시만 기다려 주시오.</p>
      
      <div className="text-left bg-white p-6 rounded-[2rem] border border-slate-200 shadow-xl max-w-sm w-full font-mono text-[11px] space-y-2">
        <p className="flex justify-between border-b pb-1"><span>📡 Firebase</span> <span className={db ? "text-emerald-500 font-black" : "text-rose-500"}>{db ? "ON" : "OFF"}</span></p>
        <p className="flex justify-between border-b pb-1"><span>🔑 API Key</span> <span className={import.meta.env.VITE_FIREBASE_API_KEY ? "text-emerald-500 font-black" : "text-rose-500"}>{import.meta.env.VITE_FIREBASE_API_KEY ? "LOADED" : "MISSING"}</span></p>
        <p className="flex justify-between border-b pb-1"><span>📦 Posts</span> <span className="font-black">{allRootPosts.length} 개</span></p>
      </div>
      <button onClick={() => window.location.reload()} className="mt-8 bg-slate-900 text-white px-6 py-3 rounded-2xl font-black text-sm shadow-lg hover:scale-105 transition-all active:scale-95">다시 시도하기</button>
    </div>
  );

  return (
    <div className="flex h-screen bg-[#F8FAFC] font-sans text-slate-900 overflow-hidden pt-1.5 md:pt-2">
      
      <Sidebar activeMenu={activeMenu} setActiveMenu={(menu) => { setActiveMenu(menu); setSelectedTopic(null); setIsCreateOpen(false); }} />

      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        <TopNavbar 
          searchQuery={searchQuery} 
          setSearchQuery={setSearchQuery} 
          userData={userData} 
          onCreateClick={() => { setSelectedTopic(null); setIsCreateOpen(!isCreateOpen); }}
        />

        {activeMenu === 'home' && !selectedTopic && !isCreateOpen && (
          <SubNavbar activeTab={activeTab} setActiveTab={setActiveTab} />
        )}

        <main className="flex-1 overflow-y-auto p-3 md:p-4 relative no-scrollbar">
          <div className="max-w-[1600px] mx-auto h-full">
            {renderContent()}
          </div>
        </main>
      </div>

      {selectedPost && <PostDetailModal post={selectedPost} onClose={() => setSelectedPost(null)} />}

      <nav className="md:hidden fixed bottom-0 left-0 w-full bg-white/95 backdrop-blur-md border-t border-slate-200 z-50 h-16 flex justify-around items-center px-2 pb-safe shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.05)]">
        {[
          { id: 'home', icon: '🏠', label: '홈' },
          { id: 'onecut', icon: '📸', label: '한컷' },
          { id: 'friends', icon: '🤝', label: '깐부' },
          { id: 'mypage', icon: '👤', label: '내정보' }
        ].map(menu => (
          <button 
            key={menu.id} 
            onClick={() => {setActiveMenu(menu.id as any); setSelectedTopic(null); setIsCreateOpen(false);}} 
            className={`flex flex-col items-center justify-center p-2 min-w-[60px] transition-all ${
              activeMenu === menu.id ? 'text-blue-600 scale-110' : 'text-slate-400'
            }`}
          >
            <span className={`text-xl mb-1 ${activeMenu === menu.id ? 'opacity-100' : 'grayscale-[0.5] opacity-70'}`}>{menu.icon}</span>
            <span className="text-[10px] font-black">{menu.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

export default App;
