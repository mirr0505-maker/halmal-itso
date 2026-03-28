// src/components/MyPage.tsx
import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, where, orderBy, limit, onSnapshot, doc, updateDoc, increment } from 'firebase/firestore';
import type { Post, Community, CommunityPost } from '../types';
import ActivityStats from './ActivityStats';
import MyContentTabs from './MyContentTabs';
import ProfileHeader from './ProfileHeader';
import ProfileEditForm from './ProfileEditForm';
import ActivityMilestones from './ActivityMilestones';
import AvatarCollection from './AvatarCollection';
import OneCutList from './OneCutList';
import { s3Client, BUCKET_NAME, PUBLIC_URL } from '../s3Client';
import { PutObjectCommand } from '@aws-sdk/client-s3';

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
  // 🚀 우리들의 따뜻한 장갑 관련
  communities?: Community[];
  joinedCommunityIds?: string[];
  onGloveClick?: (communityId?: string) => void;
  onLeaveGlove?: (communityId: string) => void;
  onLogout?: () => void;
}

const MyPage = ({
  userData, allUserRootPosts, allUserChildPosts, friends, friendCount, onPostClick, onEditPost, onToggleFriend, allUsers, followerCounts,
  communities = [], joinedCommunityIds = [], onGloveClick, onLeaveGlove, onLogout
}: Props) => {
  const [activeTab, setActiveTab] = useState<'posts' | 'onecuts' | 'comments' | 'avatars' | 'friends' | 'thanksball' | 'sentball' | 'glove' | 'gloveposts'>('posts');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [sentBalls, setSentBalls] = useState<SentBall[]>([]);
  // 🚀 프로필 수정: editData + 업로드 상태
  const [editData, setEditData] = useState({ nickname: userData.nickname, bio: userData.bio || '', avatarUrl: userData.avatarUrl || '' });
  const [isUploading, setIsUploading] = useState(false);
  // 🚀 커뮤니티 글 구독 (장갑 속 글 탭)
  const [glovePosts, setGlovePosts] = useState<CommunityPost[]>([]);

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

  // 🚀 내가 쓴 커뮤니티 글 구독
  useEffect(() => {
    if (!userData?.uid) return;
    const q = query(
      collection(db, 'community_posts'),
      where('author_id', '==', userData.uid),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    return onSnapshot(q, snap => {
      setGlovePosts(snap.docs.map(d => ({ id: d.id, ...d.data() } as CommunityPost)));
    }, err => console.error('[MyPage glovePosts]', err));
  }, [userData?.uid]);

  // 게시글 분리
  const standardPosts = allUserRootPosts.filter(p => !p.isOneCut);
  const onecutPosts = allUserRootPosts.filter(p => p.isOneCut);

  // 🚀 프로필 사진 업로드 — Cloudflare R2
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert('이미지가 너무 큽니다. 2MB 이하만 가능해요.'); return; }
    setIsUploading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const fileName = `avatars/${userData.nickname}_${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
      await s3Client.send(new PutObjectCommand({ Bucket: BUCKET_NAME, Key: fileName, Body: new Uint8Array(arrayBuffer), ContentType: file.type }));
      setEditData(prev => ({ ...prev, avatarUrl: `${PUBLIC_URL}/${fileName}` }));
    } catch (err: any) {
      console.error('[프로필 사진 업로드 실패]', err);
      alert(`사진 업로드에 실패했습니다: ${err.message || '원인 불명'}`);
    } finally { setIsUploading(false); }
  };

  // 🚀 프로필 저장 — auth.currentUser.uid 기준으로 Firestore 업데이트
  const handleProfileUpdate = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) { alert('로그인 상태를 확인해주세요.'); return; }
    if (!editData.nickname.trim()) { alert('닉네임을 입력해주세요.'); return; }
    try {
      // UID 문서 + nickname_ 문서 양쪽 동기화 (users 컬렉션 이중 키 구조)
      await updateDoc(doc(db, 'users', uid), {
        nickname: editData.nickname.trim(),
        bio: editData.bio.trim(),
        avatarUrl: editData.avatarUrl,
      });
      await updateDoc(doc(db, 'users', `nickname_${userData.nickname}`), {
        nickname: editData.nickname.trim(),
        bio: editData.bio.trim(),
        avatarUrl: editData.avatarUrl,
      }).catch(() => {}); // nickname_ 문서 없을 경우 무시
      setIsEditingProfile(false);
    } catch (err) {
      console.error('[프로필 저장 실패]', err);
      alert('저장에 실패했습니다. 다시 시도해주세요.');
    }
  };

  const [charging, setCharging] = useState(false);

  const handleTestCharge = async (amount: number) => {
    const uid = auth.currentUser?.uid;
    if (!uid || charging) return;
    setCharging(true);
    try {
      await updateDoc(doc(db, 'users', uid), {
        ballBalance: increment(amount),
      });
    } finally {
      setCharging(false);
    }
  };

  // 땡스볼 집계
  const totalThanksball = allUserRootPosts.reduce((sum, p) => sum + (p.thanksballTotal || 0), 0);
  const thanksballPosts = [...allUserRootPosts]
    .filter(p => (p.thanksballTotal || 0) > 0)
    .sort((a, b) => (b.thanksballTotal || 0) - (a.thanksballTotal || 0));

  return (
    <div className="w-full max-w-6xl mx-auto py-10 px-4 md:px-6 animate-in fade-in duration-700">
      <div className="flex flex-col gap-8">
        {/* 🚀 상단 프로필 영역 */}
        <ProfileHeader userData={userData} isEditing={isEditingProfile} setIsEditing={(val) => {
          if (val) setEditData({ nickname: userData.nickname, bio: userData.bio || '', avatarUrl: userData.avatarUrl || '' });
          setIsEditingProfile(val);
        }} friendCount={friendCount} totalThanksball={totalThanksball} />

        {/* 🚀 프로필 수정 폼 — isEditingProfile=true 시 노출 */}
        {isEditingProfile && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-6 py-5 -mt-4">
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4">프로필 수정</p>
            {/* 사진 미리보기 */}
            <div className="flex items-center gap-4 mb-4">
              <img
                src={editData.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${userData.nickname}`}
                alt="preview"
                className={`w-16 h-16 rounded-full object-cover border-2 border-slate-200 ${isUploading ? 'opacity-40' : ''}`}
              />
              {isUploading && <span className="text-[12px] font-bold text-blue-500 animate-pulse">업로드 중...</span>}
            </div>
            <ProfileEditForm
              editData={editData}
              setEditData={setEditData}
              originalData={{ nickname: userData.nickname, bio: userData.bio || '', avatarUrl: userData.avatarUrl || '' }}
              isUploading={isUploading}
              handleImageUpload={handleImageUpload}
              handleUpdate={handleProfileUpdate}
              onCancel={() => setIsEditingProfile(false)}
            />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 🚀 좌측: 활동 통계 및 마일스톤 */}
          <div className="lg:col-span-1 flex flex-col gap-6">
            <ActivityStats userData={userData} rootCount={allUserRootPosts.length} totalThanksball={totalThanksball} joinedGloveCount={joinedCommunityIds.length} glovePostCount={glovePosts.length} />

            {/* 땡스볼 지갑 */}
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">내 땡스볼 지갑</span>
                <span className="text-[10px] font-bold text-slate-300">1볼 = $1</span>
              </div>
              <div className="flex items-baseline gap-1.5 mb-4">
                <span className="text-3xl font-[1000] text-amber-500">⚾ {userData.ballBalance || 0}</span>
                <span className="text-[12px] font-black text-slate-400">볼 보유</span>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-2">
                {[5, 10].map(n => (
                  <button
                    key={n}
                    onClick={() => handleTestCharge(n)}
                    disabled={charging}
                    className="py-2 rounded-xl text-[12px] font-[1000] bg-amber-50 text-amber-600 border border-amber-100 hover:bg-amber-100 transition-all disabled:opacity-50"
                  >
                    +{n}볼 충전
                  </button>
                ))}
              </div>
              <p className="text-[9px] font-bold text-slate-300 text-center">※ 현재 테스트 무료 충전 (향후 결제 연동)</p>
              {(userData.ballSpent || 0) > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-50 flex justify-between text-[10px] font-bold text-slate-400">
                  <span>총 보낸 볼</span>
                  <span className="text-blue-400 font-[1000]">{userData.ballSpent}볼</span>
                </div>
              )}
              {(userData.ballReceived || 0) > 0 && (
                <div className="flex justify-between text-[10px] font-bold text-slate-400 mt-1">
                  <span>총 받은 볼</span>
                  <span className="text-emerald-400 font-[1000]">{userData.ballReceived}볼</span>
                </div>
              )}
            </div>

            <ActivityMilestones
              userData={userData}
              rootCount={allUserRootPosts.length}
              formalCount={allUserChildPosts.filter(p => p.type === 'formal').length}
              commentCount={allUserChildPosts.filter(p => p.type === 'comment').length}
              totalThanksball={totalThanksball}
            />

            {/* 🚀 로그아웃 버튼 — 모바일에서도 내정보에서 로그아웃 가능 */}
            {onLogout && (
              <button
                onClick={onLogout}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-slate-100 bg-white text-slate-400 hover:text-rose-500 hover:border-rose-100 hover:bg-rose-50/40 transition-all text-[13px] font-[1000] shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                로그아웃
              </button>
            )}
          </div>

          {/* 🚀 우측: 게시글/댓글/아바타 탭 콘텐츠 */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            <div className="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-blue-900/5 border border-slate-100 min-h-[600px] flex flex-col relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-600 to-indigo-500" />
              
              <div className="flex items-center gap-6 mb-10 border-b border-slate-50 pb-2 overflow-x-auto no-scrollbar">
                {(['posts', 'onecuts', 'comments', 'avatars', 'friends', 'thanksball', 'sentball', 'glove', 'gloveposts'] as const).map(tab => (
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
                    {tab === 'glove' && (
                      <span className="flex items-center gap-1">
                        🧤 내 장갑
                        {joinedCommunityIds.length > 0 && (
                          <span className="text-[10px] font-[1000] text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded-full border border-teal-100">
                            {joinedCommunityIds.length}개
                          </span>
                        )}
                      </span>
                    )}
                    {tab === 'gloveposts' && (
                      <span className="flex items-center gap-1">
                        📝 장갑 속 글
                        {glovePosts.length > 0 && (
                          <span className="text-[10px] font-[1000] text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded-full border border-teal-100">
                            {glovePosts.length}개
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

                {/* 🚀 내 장갑 탭: 가입한 커뮤니티 카드 목록 */}
                {activeTab === 'glove' && (() => {
                  const joinedCommunities = communities.filter(c => joinedCommunityIds.includes(c.id));
                  return (
                    <div className="flex flex-col gap-4">
                      <p className="text-[12px] font-bold text-slate-400">내가 가입한 커뮤니티 장갑 목록</p>
                      {joinedCommunities.length === 0 ? (
                        <div className="py-20 text-center text-slate-300 font-bold italic">아직 가입한 장갑이 없어요.</div>
                      ) : (
                        joinedCommunities.map(c => {
                          const isOwner = c.creatorId === userData?.uid;
                          return (
                            <div
                              key={c.id}
                              onClick={() => onGloveClick?.(c.id)}
                              className="flex items-center justify-between gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 cursor-pointer hover:border-teal-200 hover:bg-teal-50/30 transition-all group"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className="text-[13px] font-[1000] text-slate-800 group-hover:text-teal-700 transition-colors truncate">🧤 {c.name}</span>
                                  {isOwner && (
                                    <span className="text-[9px] font-[1000] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200 shrink-0">👑 개설자</span>
                                  )}
                                  {c.isPrivate && (
                                    <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full border border-slate-200 shrink-0">비밀</span>
                                  )}
                                </div>
                                {c.description && (
                                  <p className="text-[11px] font-bold text-slate-400 truncate">{c.description}</p>
                                )}
                                <p className="text-[10px] font-bold text-slate-300 mt-0.5">{c.category} · 멤버 {c.memberCount}명 · 글 {c.postCount}개</p>
                              </div>
                              {/* 탈퇴 버튼 (개설자는 탈퇴 불가) */}
                              {!isOwner && (
                                <button
                                  onClick={e => { e.stopPropagation(); onLeaveGlove?.(c.id); }}
                                  className="text-[10px] font-black text-rose-500 bg-white px-3 py-1.5 rounded-lg border border-rose-100 shadow-sm hover:bg-rose-50 transition-all shrink-0"
                                >
                                  탈퇴
                                </button>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  );
                })()}

                {/* 🚀 장갑 속 글 탭: 내가 community_posts에 쓴 글 목록 */}
                {activeTab === 'gloveposts' && (
                  <div className="flex flex-col gap-4">
                    <p className="text-[12px] font-bold text-slate-400">내가 커뮤니티 장갑에 쓴 글 목록</p>
                    {glovePosts.length === 0 ? (
                      <div className="py-20 text-center text-slate-300 font-bold italic">아직 쓴 장갑 글이 없어요.</div>
                    ) : (
                      glovePosts.map(post => {
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
                          <div
                            key={post.id}
                            onClick={() => onGloveClick?.(post.communityId)}
                            className="flex items-start gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 cursor-pointer hover:border-teal-200 hover:bg-teal-50/30 transition-all group"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[9px] font-[1000] text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-100 shrink-0">🧤 {post.communityName}</span>
                              </div>
                              <p className="text-[13px] font-[1000] text-slate-800 group-hover:text-teal-700 transition-colors line-clamp-1">
                                {post.title || post.content.replace(/<[^>]+>/g, '').slice(0, 50)}
                              </p>
                              <div className="flex items-center gap-3 mt-1">
                                <span className="text-[10px] font-bold text-slate-400">👍 {post.likes || 0}</span>
                                <span className="text-[10px] font-bold text-slate-300">{formatTime(post.createdAt)}</span>
                              </div>
                            </div>
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
