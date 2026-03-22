// src/components/MyPage.tsx
import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import type { Post } from '../types';
import ActivityStats from './ActivityStats';
import MyContentTabs from './MyContentTabs';
import ProfileHeader from './ProfileHeader';
import ActivityMilestones from './ActivityMilestones';
import AvatarCollection from './AvatarCollection';
import OneCutList from './OneCutList';

interface SentBall {
  id: string;
  postId: string;
  postTitle?: string;
  postAuthor: string;
  amount: number;
  message?: string;
  createdAt: any;
}

interface Props {
  userData: any;
  allUserRootPosts: Post[];
  allUserChildPosts: Post[];
  friends: string[];
  friendCount: number;
  onPostClick: (post: Post) => void;
  onEditPost?: (post: Post) => void; 
  onToggleFriend: (author: string) => void;
  allUsers: Record<string, any>;
  followerCounts: Record<string, number>;
  toggleBlock: (author: string) => void;
  blocks: string[];
}

const MyPage = ({
  userData, allUserRootPosts, allUserChildPosts, friends, friendCount, onPostClick, onEditPost, onToggleFriend, allUsers, followerCounts
}: Props) => {
  const [activeTab, setActiveTab] = useState<'posts' | 'onecuts' | 'comments' | 'avatars' | 'friends' | 'thanksball' | 'sentball'>('posts');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [sentBalls, setSentBalls] = useState<SentBall[]>([]);

  useEffect(() => {
    if (!userData?.nickname) return;
    const q = query(
      collection(db, 'sentBalls', userData.nickname, 'items'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    return onSnapshot(q, snap => {
      setSentBalls(snap.docs.map(d => ({ id: d.id, ...d.data() } as SentBall)));
    });
  }, [userData?.nickname]);

  // 게시글 분리
  const standardPosts = allUserRootPosts.filter(p => !p.isOneCut);
  const onecutPosts = allUserRootPosts.filter(p => p.isOneCut);

  // 땡스볼 집계
  const totalThanksball = allUserRootPosts.reduce((sum, p) => sum + (p.thanksballTotal || 0), 0);
  const thanksballPosts = [...allUserRootPosts]
    .filter(p => (p.thanksballTotal || 0) > 0)
    .sort((a, b) => (b.thanksballTotal || 0) - (a.thanksballTotal || 0));

  return (
    <div className="w-full max-w-6xl mx-auto py-10 px-4 md:px-6 animate-in fade-in duration-700">
      <div className="flex flex-col gap-8">
        {/* 🚀 상단 프로필 영역 */}
        <ProfileHeader userData={userData} isEditing={isEditingProfile} setIsEditing={setIsEditingProfile} friendCount={friendCount} totalThanksball={totalThanksball} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 🚀 좌측: 활동 통계 및 마일스톤 */}
          <div className="lg:col-span-1 flex flex-col gap-6">
            <ActivityStats userData={userData} rootCount={allUserRootPosts.length} totalThanksball={totalThanksball} />
            <ActivityMilestones
              userData={userData}
              rootCount={allUserRootPosts.length}
              formalCount={allUserChildPosts.filter(p => p.type === 'formal').length}
              commentCount={allUserChildPosts.filter(p => p.type === 'comment').length}
              totalThanksball={totalThanksball}
            />
          </div>

          {/* 🚀 우측: 게시글/댓글/아바타 탭 콘텐츠 */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            <div className="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-blue-900/5 border border-slate-100 min-h-[600px] flex flex-col relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-600 to-indigo-500" />
              
              <div className="flex items-center gap-6 mb-10 border-b border-slate-50 pb-2 overflow-x-auto no-scrollbar">
                {(['posts', 'onecuts', 'comments', 'avatars', 'friends', 'thanksball', 'sentball'] as const).map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)} className={`pb-4 px-2 text-[15px] font-[1000] tracking-tight transition-all relative whitespace-nowrap ${activeTab === tab ? 'text-blue-600' : 'text-slate-300 hover:text-slate-500'}`}>
                    {tab === 'posts' && '나의 기록'}
                    {tab === 'onecuts' && '나의 한컷'}
                    {tab === 'comments' && '참여한 토론'}
                    {tab === 'avatars' && '아바타 수집'}
                    {tab === 'friends' && '깐부 목록'}
                    {tab === 'thanksball' && (
                      <span className="flex items-center gap-1">
                        받은볼
                        {totalThanksball > 0 && (
                          <span className="text-[10px] font-[1000] text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-100">
                            {totalThanksball}볼
                          </span>
                        )}
                      </span>
                    )}
                    {tab === 'sentball' && (
                      <span className="flex items-center gap-1">
                        보낸볼
                        {sentBalls.length > 0 && (
                          <span className="text-[10px] font-[1000] text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded-full border border-blue-100">
                            {sentBalls.reduce((s, b) => s + b.amount, 0)}볼
                          </span>
                        )}
                      </span>
                    )}
                    {activeTab === tab && <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-600 rounded-full" />}
                  </button>
                ))}
              </div>

              <div className="flex-1">
                {activeTab === 'posts' && <MyContentTabs posts={standardPosts} onPostClick={onEditPost || onPostClick} type="posts" />}
                {activeTab === 'onecuts' && (
                  <div className="pt-4">
                    <OneCutList posts={onecutPosts} allPosts={allUserRootPosts} onTopicClick={onEditPost || onPostClick} allUsers={allUsers} followerCounts={followerCounts} />
                  </div>
                )}
                {activeTab === 'comments' && <MyContentTabs posts={allUserChildPosts} onPostClick={onPostClick} type="comments" />}
                {activeTab === 'avatars' && <AvatarCollection currentLevel={userData.level} />}
                {activeTab === 'thanksball' && (
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[12px] font-bold text-slate-400">내 글이 받은 땡스볼 (글 단위)</p>
                      <span className="text-[13px] font-[1000] text-amber-500">⚾ 총 {totalThanksball}볼</span>
                    </div>
                    {thanksballPosts.length === 0 ? (
                      <div className="py-20 text-center text-slate-300 font-bold italic">아직 받은 땡스볼이 없어요.</div>
                    ) : (
                      thanksballPosts.map(post => (
                        <div
                          key={post.id}
                          onClick={() => onPostClick(post)}
                          className="flex items-center justify-between gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 cursor-pointer hover:border-amber-200 hover:bg-amber-50/30 transition-all group"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-[1000] text-slate-800 truncate group-hover:text-amber-600 transition-colors">{post.title || post.content.replace(/<[^>]+>/g, '').slice(0, 40)}</p>
                            <p className="text-[10px] font-bold text-slate-400 mt-0.5">{post.category}</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0 bg-amber-100 text-amber-600 px-3 py-1.5 rounded-xl font-[1000] text-[13px]">
                            ⚾ {post.thanksballTotal}볼
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeTab === 'sentball' && (
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[12px] font-bold text-slate-400">내가 보낸 땡스볼 내역</p>
                      <span className="text-[13px] font-[1000] text-blue-500">
                        ⚾ 총 {sentBalls.reduce((s, b) => s + b.amount, 0)}볼 전송
                      </span>
                    </div>
                    {sentBalls.length === 0 ? (
                      <div className="py-20 text-center text-slate-300 font-bold italic">아직 보낸 땡스볼이 없어요.</div>
                    ) : (
                      sentBalls.map(ball => {
                        const formatTime = (ts: any) => {
                          if (!ts) return '';
                          const d = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
                          const diff = Math.floor((Date.now() - d.getTime()) / 1000);
                          if (diff < 60) return '방금 전';
                          if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
                          if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
                          return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
                        };
                        return (
                          <div key={ball.id} className="flex items-start gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <span className="text-lg shrink-0 mt-0.5">⚾</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2 mb-0.5">
                                <p className="text-[13px] font-[1000] text-slate-800 truncate">
                                  {ball.postTitle || '(제목 없음)'}
                                </p>
                                <span className="text-[12px] font-[1000] text-blue-500 shrink-0">{ball.amount}볼</span>
                              </div>
                              <p className="text-[11px] font-bold text-slate-400">
                                → <span className="text-slate-600">{ball.postAuthor}</span>님
                                {ball.message && <span className="ml-1 text-slate-400">· "{ball.message}"</span>}
                              </p>
                              <p className="text-[10px] font-bold text-slate-300 mt-1">{formatTime(ball.createdAt)}</p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {activeTab === 'friends' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {friends.length === 0 ? (
                      <div className="col-span-full py-20 text-center text-slate-300 font-bold italic">아직 맺은 깐부가 없어요.</div>
                    ) : (
                      friends.map(fname => {
                        const fData = allUsers[`nickname_${fname}`] || allUsers[fname];
                        return (
                          <div key={fname} className="bg-slate-50 p-4 rounded-2xl flex items-center justify-between border border-slate-100">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-white overflow-hidden border border-slate-200 shadow-sm"><img src={fData?.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${fname}`} alt="" /></div>
                              <div className="flex flex-col">
                                <span className="font-black text-[13px] text-slate-900">{fname}</span>
                                <span className="text-[10px] font-bold text-slate-400">Lv {fData?.level || 1} · 깐부 {followerCounts[fname] || 0}</span>
                              </div>
                            </div>
                            <button onClick={() => onToggleFriend(fname)} className="text-[10px] font-black text-rose-500 bg-white px-3 py-1.5 rounded-lg border border-rose-100 shadow-sm hover:bg-rose-50 transition-all">깐부해제</button>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyPage;
