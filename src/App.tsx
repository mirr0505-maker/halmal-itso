// src/App.tsx
import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, onSnapshot, addDoc, serverTimestamp, doc, setDoc, updateDoc } from 'firebase/firestore';
import type { Post } from './types';
import MyPage from './components/MyPage';
import PostDetailModal from './components/PostDetailModal';
import DiscussionView from './components/DiscussionView'; 
import AnyTalkList from './components/AnyTalkList'; 
import LatestTalkList from './components/LatestTalkList';
import CreatePostBox from './components/CreatePostBox';

function App() {
  const [selectedTopic, setSelectedTopic] = useState<Post | null>(null);
  const [allRootPosts, setAllRootPosts] = useState<Post[]>([]);
  const [allChildPosts, setAllChildPosts] = useState<Post[]>([]);
  const [friends, setFriends] = useState<string[]>([]);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);

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
  
  const [activeTab, setActiveTab] = useState<'any' | 'recent' | 'best' | 'friends' | 'rank' | 'mypage'>('any');

  useEffect(() => { if (replyTarget) { setSelectedType('comment'); setNewTitle(""); } }, [replyTarget]);

  useEffect(() => {
    const unsubPosts = onSnapshot(collection(db, "posts"), (snapshot) => {
      const posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));
      posts.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setAllRootPosts(posts.filter(p => !p.parentId || p.id === "root_post_01"));
      setAllChildPosts(posts.filter(p => p.parentId && p.id !== "root_post_01"));
    });

    const unsubUser = onSnapshot(doc(db, "users", "user_heukmooyoung"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUserData(prev => ({ ...prev, ...data }));
        if (data.friendList) setFriends(data.friendList);
      }
    });

    return () => { unsubPosts(); unsubUser(); };
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

  // 🚀 아무말: 6시간 이내의 최신 글들만 노출 (도전 진행 중인 글)
  const anyTopics = filterBySearch(allRootPosts.filter(p => {
    const createdAt = p.createdAt?.toDate();
    return createdAt && createdAt > sixHoursAgo;
  })); 

  // 🚀 주목말: 1시간 이내에 좋아요 3개 이상 달성
  const recentTopics = filterBySearch(allRootPosts.filter(p => {
    const createdAt = p.createdAt?.toDate();
    return createdAt && createdAt > oneHourAgo && (p.likes || 0) >= 3;
  }));

  // 🚀 대세말: 6시간 이내에 좋아요 30개 이상 달성
  const bestTopics = filterBySearch(allRootPosts.filter(p => {
    const createdAt = p.createdAt?.toDate();
    return createdAt && createdAt > sixHoursAgo && (p.likes || 0) >= 30;
  }));

  const friendTopics = filterBySearch(allRootPosts.filter(p => friends.includes(p.author)));

  const handleCreateTopic = async (title: string, content: string, imageUrl?: string, linkUrl?: string) => {
    try {
      await addDoc(collection(db, "posts"), { 
        author: userData.nickname, title, content, 
        imageUrl: imageUrl || null, linkUrl: linkUrl || null,
        authorInfo: {
          level: userData.level,
          friendCount: friends.length,
          totalLikes: userData.likes
        },
        parentId: "", side: 'left', type: 'formal', 
        createdAt: serverTimestamp(), likes: 0, dislikes: 0 
      });
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

  // 🚀 실시간 추천(좋아요) 처리 함수
  const handleLike = async (e: React.MouseEvent, postId: string) => {
    e.stopPropagation(); // 카드 클릭 이벤트 전파 방지
    try {
      const postRef = doc(db, "posts", postId);
      // 추천수 1 증가 (Firestore updateDoc 활용)
      const targetPost = [...allRootPosts, ...allChildPosts].find(p => p.id === postId);
      if (targetPost) {
        await updateDoc(postRef, { likes: (targetPost.likes || 0) + 1 });
      }
    } catch (error) {
      console.error("추천 실패:", error);
    }
  };

  const renderTabContent = () => {
    if (selectedTopic) {
      return (
        <div className="max-w-2xl mx-auto w-full">
          <button onClick={() => setSelectedTopic(null)} className="mb-6 text-sm font-black text-slate-400 hover:text-slate-900 flex items-center gap-2">← 목록으로 돌아가기</button>
          <DiscussionView 
            rootPost={selectedTopic}
            allPosts={allChildPosts.filter(p => p.parentId === selectedTopic.id)}
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

    switch (activeTab) {
      case 'any': return (
        <>
          <CreatePostBox userData={userData} onSubmit={handleCreateTopic} />
          <AnyTalkList posts={anyTopics} onTopicClick={setSelectedTopic} onLikeClick={handleLike} />
        </>
      );
      case 'recent': return <LatestTalkList rootPosts={recentTopics} onTopicClick={setSelectedTopic} />;
      case 'best': return <LatestTalkList rootPosts={bestTopics} onTopicClick={setSelectedTopic} />;
      case 'friends': return <LatestTalkList rootPosts={friendTopics} onTopicClick={setSelectedTopic} />;
      case 'rank': return <div className="py-40 text-center italic text-slate-300 font-[1000] text-2xl">🏆 명예말 준비 중...</div>;
      case 'mypage': return (
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

  if (allRootPosts.length === 0 && !selectedTopic) return <div className="flex justify-center items-center h-screen bg-slate-50 font-black text-slate-300 text-2xl animate-pulse">전국 팔도 할말 모으는 중...</div>;

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-900 pb-24 md:pb-28">
      <header className="bg-white/80 backdrop-blur-md border-b sticky top-0 z-40 p-4 flex justify-center">
        <div className="w-full max-w-2xl flex justify-between items-center px-2">
          {!isSearchOpen && (
            <h1 
              className="text-2xl font-[1000] italic text-slate-800 cursor-pointer animate-in fade-in duration-300" 
              onClick={() => {setActiveTab('any'); setSelectedTopic(null);}}
            >
              HALMAL<span className="text-emerald-500">-ITSO</span>
            </h1>
          )}
          
          <div className={`flex items-center gap-2 transition-all duration-300 ${isSearchOpen ? 'flex-1' : 'w-fit'}`}>
            {isSearchOpen ? (
              <div className="flex-1 flex items-center gap-2 bg-slate-100 rounded-full px-4 py-2 animate-in slide-in-from-right-4 duration-300">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input 
                  type="text" 
                  placeholder="한 말 찾기" 
                  className="flex-1 bg-transparent outline-none text-sm font-bold text-slate-700"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                />
                <button onClick={() => {setIsSearchOpen(false); setSearchQuery("");}} className="text-slate-400 hover:text-slate-600 text-xs font-black">닫기</button>
              </div>
            ) : (
              <button 
                onClick={() => setIsSearchOpen(true)}
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-50 transition-colors"
              >
                <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            )}

            {!isSearchOpen && (
              <div 
                className={`w-9 h-9 rounded-full border-2 transition-all cursor-pointer overflow-hidden hover:scale-110 active:scale-95 ${activeTab === 'mypage' ? 'border-emerald-500 shadow-md shadow-emerald-100' : 'border-slate-200'}`}
                onClick={() => {setActiveTab('mypage'); setSelectedTopic(null);}}
              >
                <img 
                  src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${userData.nickname}`} 
                  alt="MyProfile" 
                  className="w-full h-full object-cover bg-slate-50"
                />
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-8">
        <div className="w-full">{renderTabContent()}</div>
      </main>

      {selectedPost && <PostDetailModal post={selectedPost} onClose={() => setSelectedPost(null)} />}

      <nav className="fixed bottom-0 left-0 w-full bg-white/95 backdrop-blur-2xl border-t-[1.5px] border-slate-200 z-50 h-24 flex justify-center shadow-[0_-10px_25px_-5px_rgba(0,0,0,0.05)]">
        <div className="max-w-2xl w-full flex justify-around items-center px-2">
          {[
            { id: 'any', label: '아무말', icon: '🌈' },
            { id: 'recent', label: '주목말', icon: '📣' },
            { id: 'best', label: '대세말', icon: '🌟' },
            { id: 'friends', label: '깐부말', icon: '🤝' },
            { id: 'rank', label: '명예말', icon: '🏆' }
          ].map(tab => (
            <button 
              key={tab.id} 
              onClick={() => {setActiveTab(tab.id as any); setSelectedTopic(null);}} 
              className={`flex flex-col items-center justify-center py-2 px-1 min-w-[64px] transition-all duration-300 relative ${
                activeTab === tab.id 
                  ? 'text-emerald-600 scale-110 -translate-y-1' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span className={`text-3xl mb-1 transition-transform ${activeTab === tab.id ? 'drop-shadow-md' : 'grayscale-[0.3]'}`}>
                {tab.icon}
              </span>
              <span className={`text-[11px] font-[1000] tracking-tighter ${activeTab === tab.id ? 'opacity-100' : 'opacity-80'}`}>
                {tab.label}
              </span>
              {activeTab === tab.id && (
                <div className="absolute -bottom-1 w-1 h-1 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
              )}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

export default App;