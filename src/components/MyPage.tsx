// src/components/MyPage.tsx
import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, where, orderBy, limit, onSnapshot, doc, updateDoc, getDocs, writeBatch, arrayUnion, arrayRemove } from 'firebase/firestore';
import type { Post, Community, CommunityPost, CommunityMember, UserData, FirestoreTimestamp } from '../types';
import ActivityStats from './ActivityStats';
import MyContentTabs from './MyContentTabs';
import ProfileHeader from './ProfileHeader';
import ProfileEditForm from './ProfileEditForm';
import ActivityMilestones from './ActivityMilestones';
import MyPromotion from './MyPromotion';
import RevenueDashboard from './revenue/RevenueDashboard';
import { uploadToR2 } from '../uploadToR2';
import { calculateLevel } from '../utils';

// 🚀 받은볼 카드 — 글별 땡스볼 서브컬렉션에서 발신자 목록 로드
const ReceivedBallCard = ({ post, onPostClick }: { post: Post; onPostClick: (p: Post) => void }) => {
  const [senders, setSenders] = useState<{ sender: string; amount: number }[]>([]);
  useEffect(() => {
    getDocs(collection(db, 'posts', post.id, 'thanksBalls')).then(snap => {
      setSenders(snap.docs.map(d => ({ sender: d.data().sender, amount: d.data().amount })));
    }).catch(() => {});
  }, [post.id]);

  return (
    <div onClick={() => onPostClick(post)}
      className="flex flex-col gap-2 p-4 bg-slate-50 rounded-2xl border border-slate-100 cursor-pointer hover:border-amber-200 hover:bg-amber-50/30 transition-all group">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-[1000] text-slate-800 truncate group-hover:text-amber-600 transition-colors">{post.title || post.content.replace(/<[^>]+>/g, '').slice(0, 40)}</p>
          <p className="text-[10px] font-bold text-slate-400 mt-0.5">{post.category}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0 bg-amber-100 text-amber-600 px-3 py-1.5 rounded-xl font-[1000] text-[13px]">
          ⚾ {post.thanksballTotal}볼
        </div>
      </div>
      {senders.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {senders.map((s, i) => (
            <span key={i} className="text-[9px] font-bold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded-md border border-violet-100">
              {s.sender} {s.amount}볼
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

interface SentBall {
  id: string;
  postId: string;
  postTitle?: string;
  postAuthor: string;
  amount: number;
  message?: string;
  createdAt?: { seconds: number };
}

interface Props {
  userData: UserData;
  allUserRootPosts: Post[];
  allUserChildPosts: Post[];
  friends: string[];
  friendCount: number;    // 내가 맺은 깐부 수 (팔로잉)
  followerCount?: number; // 나를 맺은 깐부 수 (팔로워)
  onPostClick: (post: Post) => void;
  onEditPost?: (post: Post) => void;
  onToggleFriend: (author: string) => void;
  allUsers: Record<string, UserData>;
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
  userData, allUserRootPosts, allUserChildPosts, friends, friendCount, followerCount = 0, onPostClick, onEditPost, onToggleFriend, allUsers, followerCounts,
  communities = [], joinedCommunityIds = [], onGloveClick, onLeaveGlove, onLogout
}: Props) => {
  const [activeTab, setActiveTab] = useState<'posts' | 'onecuts' | 'comments' | 'friends' | 'thanksball' | 'sentball' | 'glove' | 'revenue'>('posts');
  // 🚀 깐부 목록 서브탭: 내가 맺은 깐부(팔로잉) vs 나를 맺은 깐부수(팔로워)
  const [friendSubTab, setFriendSubTab] = useState<'following' | 'followers'>('following');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [sentBalls, setSentBalls] = useState<SentBall[]>([]);
  // 🚀 프로필 수정: editData + 업로드 상태
  const [editData, setEditData] = useState({ nickname: userData.nickname, bio: userData.bio || '', avatarUrl: userData.avatarUrl || '' });
  const [isUploading, setIsUploading] = useState(false);
  // 🚀 커뮤니티 글 구독 (활동 통계 + 나의 기록 병합용)
  const [glovePosts, setGlovePosts] = useState<CommunityPost[]>([]);
  // 🚀 커뮤니티 댓글 구독 (참여한 토론 병합용)
  const [gloveComments, setGloveComments] = useState<{id: string; author: string; content: string; communityId: string; communityName: string; createdAt?: FirestoreTimestamp}[]>([]);
  // 🚀 내 멤버십 구독 — 손가락 역할·가입 상태 실시간 반영
  const [myMemberships, setMyMemberships] = useState<CommunityMember[]>([]);

  useEffect(() => {
    if (!userData?.nickname) return;
    const q = query(
      // 🚀 sentBalls 경로: 닉네임 → UID
      collection(db, 'sentBalls', userData.uid, 'items'),
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

  // 🚀 내 멤버십 구독 — 손가락 역할·가입 상태를 실시간으로 가져옴
  useEffect(() => {
    if (!userData?.uid) return;
    const q = query(
      collection(db, 'community_memberships'),
      where('userId', '==', userData.uid)
    );
    return onSnapshot(q, snap => {
      setMyMemberships(snap.docs.map(d => ({ ...d.data() } as CommunityMember)));
    });
  }, [userData?.uid]);

  // 🚀 내가 쓴 커뮤니티 댓글 구독 (community_post_comments 컬렉션)
  useEffect(() => {
    if (!userData?.uid) return;
    const q = query(
      collection(db, 'community_post_comments'),
      where('author_id', '==', userData.uid),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    return onSnapshot(q, snap => {
      setGloveComments(snap.docs.map(d => ({ id: d.id, ...d.data() } as { id: string; author: string; content: string; communityId: string; communityName: string; createdAt?: FirestoreTimestamp })));
    }, err => console.error('[MyPage gloveComments]', err));
  }, [userData?.uid]);

  // 게시글 분리
  const standardPosts = allUserRootPosts.filter(p => !p.isOneCut);
  const onecutPosts = allUserRootPosts.filter(p => p.isOneCut);

  // 🚀 나의 기록: 일반글(posts) + 장갑글(community_posts) 시간순 병합
  // Why: 두 컬렉션이 분리되어 있으나 사용자 관점에서는 하나의 활동 내역이어야 함
  const allMyPosts = [
    ...standardPosts.map(p => ({ ...p, _source: 'post' as const })),
    ...glovePosts.map(p => ({ ...p, _source: 'glove' as const })),
  ].sort((a, b) => {
    const aMs = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0;
    const bMs = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0;
    return bMs - aMs;
  });

  // 🚀 참여한 토론: 일반 댓글(posts child) + 장갑 댓글(community_post_comments) 시간순 병합
  const allMyComments = [
    ...allUserChildPosts.map(p => ({ ...p, _source: 'post' as const })),
    ...gloveComments,
  ].sort((a, b) => {
    const aMs = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0;
    const bMs = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0;
    return bMs - aMs;
  });

  // 🚀 프로필 사진 업로드 — Cloudflare R2
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert('이미지가 너무 큽니다. 2MB 이하만 가능해요.'); return; }
    setIsUploading(true);
    try {
      const fileName = `avatars/${userData.uid}/${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
      const avatarUrl = await uploadToR2(file, fileName);
      setEditData(prev => ({ ...prev, avatarUrl }));
    } catch (err: unknown) {
      console.error('[프로필 사진 업로드 실패]', err);
      alert(`사진 업로드에 실패했습니다: ${(err as Error).message || '원인 불명'}`);
    } finally { setIsUploading(false); }
  };

  // 🚀 프로필 저장 — auth.currentUser.uid 기준으로 Firestore 업데이트
  const handleProfileUpdate = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) { alert('로그인 상태를 확인해주세요.'); return; }
    if (!editData.nickname.trim()) { alert('닉네임을 입력해주세요.'); return; }
    const newNickname = editData.nickname.trim();
    const nicknameChanged = newNickname !== userData.nickname;
    try {
      // 🚀 3단계: 닉네임 변경 30일 쿨다운 체크
      // Why: 닉네임 파편화로 인한 데이터 정합성 문제와 사칭 방지를 위해 변경 빈도 제한
      if (nicknameChanged) {
        const lastChangedAt = userData.nicknameChangedAt;
        if (lastChangedAt) {
          const lastChangedMs = lastChangedAt.seconds * 1000;
          const daysSinceChange = (Date.now() - lastChangedMs) / (1000 * 60 * 60 * 24);
          if (daysSinceChange < 30) {
            const remainingDays = Math.ceil(30 - daysSinceChange);
            alert(`닉네임은 30일에 한 번만 변경할 수 있어요.\n${remainingDays}일 후에 다시 시도해주세요.`);
            return;
          }
        }
      }

      // UID 문서 + nickname_ 문서 양쪽 동기화 (users 컬렉션 이중 키 구조)
      await updateDoc(doc(db, 'users', uid), {
        nickname: newNickname,
        bio: editData.bio.trim(),
        avatarUrl: editData.avatarUrl,
        // 닉네임 변경 시에만 타임스탬프 기록
        ...(nicknameChanged ? { nicknameChangedAt: new Date() } : {}),
      });
      await updateDoc(doc(db, 'users', `nickname_${userData.nickname}`), {
        nickname: newNickname,
        bio: editData.bio.trim(),
        avatarUrl: editData.avatarUrl,
      }).catch((err) => console.warn('nickname_ 문서 업데이트 실패 (문서 미존재 가능):', err));

      // 🚀 2단계: 닉네임 변경 시 community_memberships + communities 일괄 업데이트
      // Why: nickname이 비정규화되어 있으므로 변경 즉시 모든 관련 문서에 반영해야 파편화 방지
      if (nicknameChanged) {
        const batch = writeBatch(db);

        // 내가 가입한 장갑의 멤버십 문서
        const membershipsSnap = await getDocs(
          query(collection(db, 'community_memberships'), where('userId', '==', uid))
        );
        membershipsSnap.docs.forEach(d => batch.update(d.ref, { nickname: newNickname }));

        // 내가 만든 장갑 문서 (creatorNickname 필드)
        const communitiesSnap = await getDocs(
          query(collection(db, 'communities'), where('creatorId', '==', uid))
        );
        communitiesSnap.docs.forEach(d => batch.update(d.ref, { creatorNickname: newNickname }));

        await batch.commit();
      }

      setIsEditingProfile(false);
    } catch (err) {
      console.error('[프로필 저장 실패]', err);
      alert('저장에 실패했습니다. 다시 시도해주세요.');
    }
  };

  // 🚀 장갑 알림 ON/OFF 토글 — CommunityView.handleToggleNotify와 동일 로직
  const handleToggleCommunityNotify = async (communityId: string, currentlyNotifying: boolean) => {
    if (!userData?.uid) return;
    await updateDoc(doc(db, 'communities', communityId), {
      notifyMembers: currentlyNotifying ? arrayRemove(userData.uid) : arrayUnion(userData.uid),
    });
  };

  const [charging, setCharging] = useState(false);

  const handleTestCharge = async (amount: number) => {
    if (!auth.currentUser || charging) return;
    setCharging(true);
    try {
      // 🚀 Cloud Function 호출 — Firestore Rules에서 ballBalance 직접 수정 차단됨
      const { httpsCallable } = await import('firebase/functions');
      const { functions } = await import('../firebase');
      const chargeFn = httpsCallable(functions, 'testChargeBall');
      await chargeFn({ amount });
    } catch (err) {
      alert('충전 실패: ' + ((err as Error).message || ''));
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
        }} friendCount={friendCount} followerCount={followerCount} totalThanksball={totalThanksball} />

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

        {/* 🚀 내 홍보: 나를 PR하는 이미지 6칸, 레벨별 해금 */}
        <MyPromotion userData={userData} currentLevel={calculateLevel(userData?.exp || 0)} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 🚀 좌측: 활동 통계 및 마일스톤 */}
          <div className="lg:col-span-1 flex flex-col gap-6">
            {/* 🚀 rootCount: 일반 글 + 장갑 글 합산 — 전체 작성 활동을 통합 표시 */}
            <ActivityStats userData={userData} rootCount={standardPosts.length + glovePosts.length} totalThanksball={totalThanksball} joinedGloveCount={joinedCommunityIds.length} />

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

            {/* 🚀 rootCount: 일반 글 + 장갑 글 합산 / commentCount: 일반 댓글 + 장갑 댓글 합산 */}
            <ActivityMilestones
              userData={userData}
              rootCount={standardPosts.length + glovePosts.length}
              formalCount={allUserChildPosts.filter(p => p.type === 'formal').length}
              commentCount={allUserChildPosts.filter(p => p.type === 'comment').length + gloveComments.length}
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
                {(['posts', 'onecuts', 'comments', 'friends', 'thanksball', 'sentball', 'glove', 'revenue'] as const).map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)} className={`pb-4 px-2 text-[15px] font-[1000] tracking-tight transition-all relative whitespace-nowrap ${activeTab === tab ? 'text-blue-600' : 'text-slate-300 hover:text-slate-500'}`}>
                    {tab === 'posts' && (
                      <span className="flex items-center gap-1">
                        나의 기록
                        {allMyPosts.length > 0 && (
                          <span className="text-[10px] font-[1000] text-blue-400 bg-blue-50 px-1.5 py-0.5 rounded-full border border-blue-100">
                            {allMyPosts.length}
                          </span>
                        )}
                      </span>
                    )}
                    {tab === 'onecuts' && '나의 한컷'}
                    {tab === 'comments' && (
                      <span className="flex items-center gap-1">
                        참여한 토론
                        {allMyComments.length > 0 && (
                          <span className="text-[10px] font-[1000] text-emerald-500 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-100">
                            {allMyComments.length}
                          </span>
                        )}
                      </span>
                    )}
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
                    {tab === 'revenue' && '💰 수익'}
                    {activeTab === tab && <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-600 rounded-full" />}
                  </button>
                ))}
              </div>

              <div className="flex-1">
                {activeTab === 'posts' && <MyContentTabs posts={allMyPosts} onPostClick={onEditPost || onPostClick} onGloveClick={onGloveClick} type="posts" />}
                {activeTab === 'onecuts' && <MyContentTabs posts={onecutPosts.map(p => ({ ...p, _source: 'post' as const }))} onPostClick={onEditPost || onPostClick} type="posts" />}
                {activeTab === 'comments' && <MyContentTabs posts={allMyComments} onPostClick={onPostClick} onGloveClick={onGloveClick} type="comments" />}
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
                        <ReceivedBallCard key={post.id} post={post} onPostClick={onPostClick} />
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
                        const formatTime = (ts: { seconds: number } | null | undefined) => {
                          if (!ts) return '';
                          const d = new Date(ts.seconds * 1000);
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

                {activeTab === 'friends' && (() => {
                  // 🚀 나를 깐부로 맺은 사람(팔로워) 목록 역산: allUsers 전체에서 friendList에 내 닉네임 포함된 유저 추출
                  const myNickname = userData.nickname;
                  const followerNicknames = Object.values(allUsers)
                    .filter(u => u.uid && u.nickname && u.nickname !== myNickname && (u.friendList || []).includes(myNickname))
                    .reduce((acc, u) => { if (!acc.includes(u.nickname)) acc.push(u.nickname); return acc; }, [] as string[]);

                  return (
                    <div>
                      {/* 서브탭: 깐부 목록 / 깐부수 목록 */}
                      <div className="flex gap-2 mb-4">
                        <button
                          onClick={() => setFriendSubTab('following')}
                          className={`px-4 py-2 rounded-xl text-[12px] font-[1000] transition-all ${friendSubTab === 'following' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                        >
                          깐부 목록 ({friends.length})
                        </button>
                        <button
                          onClick={() => setFriendSubTab('followers')}
                          className={`px-4 py-2 rounded-xl text-[12px] font-[1000] transition-all ${friendSubTab === 'followers' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                        >
                          깐부수 목록 ({followerNicknames.length})
                        </button>
                      </div>

                      {friendSubTab === 'following' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {friends.length === 0 ? (
                            <div className="col-span-full py-20 text-center text-slate-300 font-bold italic">아직 맺은 깐부가 없어요.</div>
                          ) : (
                            friends.map(fname => {
                              const fData = allUsers[`nickname_${fname}`] || allUsers[fname];
                              return (
                                <div key={fname} className="bg-slate-50 p-4 rounded-2xl flex items-center justify-between border border-slate-100">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-white overflow-hidden border border-slate-200 shadow-sm"><img src={fData?.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${fname}`} alt="" className="w-full h-full object-cover" /></div>
                                    <div className="flex flex-col">
                                      <span className="font-black text-[13px] text-slate-900">{fname}</span>
                                      <span className="text-[10px] font-bold text-slate-400">Lv {calculateLevel(fData?.exp || 0)} · 깐부수 {followerCounts[fname] || 0}</span>
                                    </div>
                                  </div>
                                  <button onClick={() => onToggleFriend(fname)} className="text-[10px] font-black text-rose-500 bg-white px-3 py-1.5 rounded-lg border border-rose-100 shadow-sm hover:bg-rose-50 transition-all">깐부해제</button>
                                </div>
                              );
                            })
                          )}
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {followerNicknames.length === 0 ? (
                            <div className="col-span-full py-20 text-center text-slate-300 font-bold italic">아직 나를 깐부로 맺은 사람이 없어요.</div>
                          ) : (
                            followerNicknames.map(fname => {
                              const fData = allUsers[`nickname_${fname}`] || allUsers[fname];
                              const isMutual = friends.includes(fname);
                              return (
                                <div key={fname} className="bg-slate-50 p-4 rounded-2xl flex items-center justify-between border border-slate-100">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-white overflow-hidden border border-slate-200 shadow-sm"><img src={fData?.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${fname}`} alt="" className="w-full h-full object-cover" /></div>
                                    <div className="flex flex-col">
                                      <span className="font-black text-[13px] text-slate-900">{fname}</span>
                                      <span className="text-[10px] font-bold text-slate-400">Lv {calculateLevel(fData?.exp || 0)} · 깐부수 {followerCounts[fname] || 0}</span>
                                    </div>
                                  </div>
                                  {isMutual ? (
                                    <span className="text-[10px] font-black text-emerald-500 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">서로 깐부</span>
                                  ) : (
                                    <button onClick={() => onToggleFriend(fname)} className="text-[10px] font-black text-blue-500 bg-white px-3 py-1.5 rounded-lg border border-blue-100 shadow-sm hover:bg-blue-50 transition-all">+ 깐부맺기</button>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* 🚀 내 장갑 탭: 가입한 커뮤니티 관리 (역할·알림·통계·탈퇴) */}
                {activeTab === 'glove' && (() => {
                  // 손가락 역할 표시 메타
                  const FINGER_LABEL: Record<string, { label: string; color: string }> = {
                    thumb:  { label: '👍 엄지 (개설자)',  color: 'text-amber-600 bg-amber-50 border-amber-200' },
                    index:  { label: '☝️ 검지 (부관리자)', color: 'text-violet-600 bg-violet-50 border-violet-200' },
                    middle: { label: '🖕 중지 (핵심)',    color: 'text-blue-600 bg-blue-50 border-blue-200' },
                    ring:   { label: '💍 약지 (일반)',    color: 'text-slate-600 bg-slate-50 border-slate-200' },
                    pinky:  { label: '🤙 새끼 (신입)',    color: 'text-slate-400 bg-slate-50 border-slate-200' },
                  };

                  const joinedCommunities = communities.filter(c => joinedCommunityIds.includes(c.id));

                  // communityId별 내 글 수·받은 좋아요 합산
                  const gloveStatsByCommunity = glovePosts.reduce<Record<string, { postCount: number; likeCount: number }>>((acc, p) => {
                    const cid = p.communityId;
                    if (!acc[cid]) acc[cid] = { postCount: 0, likeCount: 0 };
                    acc[cid].postCount += 1;
                    acc[cid].likeCount += p.likes || 0;
                    return acc;
                  }, {});

                  return (
                    <div className="flex flex-col gap-3">
                      <p className="text-[12px] font-bold text-slate-400">내가 가입한 커뮤니티 장갑 관리</p>
                      {joinedCommunities.length === 0 ? (
                        <div className="py-20 text-center text-slate-300 font-bold italic">아직 가입한 장갑이 없어요.</div>
                      ) : (
                        joinedCommunities.map(c => {
                          const isOwner = c.creatorId === userData?.uid;
                          // 내 멤버십 정보 (손가락 역할·가입 상태)
                          const membership = myMemberships.find(m => m.communityId === c.id);
                          const finger = membership?.finger || (isOwner ? 'thumb' : 'ring');
                          const fingerMeta = FINGER_LABEL[finger] || FINGER_LABEL.ring;
                          const isPending = membership?.joinStatus === 'pending';
                          const isBanned = membership?.joinStatus === 'banned';
                          // 알림 구독 여부
                          const isNotifying = (c.notifyMembers ?? []).includes(userData?.uid);
                          // 내 활동 통계
                          const myStats = gloveStatsByCommunity[c.id] || { postCount: 0, likeCount: 0 };

                          return (
                            <div
                              key={c.id}
                              className={`rounded-2xl border overflow-hidden transition-all ${isBanned ? 'border-rose-200 bg-rose-50/30' : 'border-slate-100 bg-white hover:border-teal-200 hover:shadow-sm'}`}
                            >
                              {/* 상단 컬러바 */}
                              <div className="h-1 w-full" style={{ backgroundColor: c.coverColor || '#14b8a6' }} />

                              <div className="p-4">
                                {/* 헤더 행: 이름 + 역할 배지 */}
                                <div className="flex items-start justify-between gap-2 mb-2">
                                  <div
                                    className="flex-1 min-w-0 cursor-pointer"
                                    onClick={() => onGloveClick?.(c.id)}
                                  >
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="text-[14px] font-[1000] text-slate-900 hover:text-teal-700 transition-colors truncate">🧤 {c.name}</span>
                                      {isPending && (
                                        <span className="text-[9px] font-[1000] text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-full border border-orange-200 shrink-0">⏳ 승인 대기</span>
                                      )}
                                      {isBanned && (
                                        <span className="text-[9px] font-[1000] text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded-full border border-rose-200 shrink-0">🚫 강퇴됨</span>
                                      )}
                                    </div>
                                    {c.description && (
                                      <p className="text-[11px] font-bold text-slate-400 truncate mt-0.5">{c.description}</p>
                                    )}
                                  </div>

                                  {/* 알림 토글 버튼 (강퇴·대기 상태엔 숨김) */}
                                  {!isPending && !isBanned && (
                                    <button
                                      onClick={() => handleToggleCommunityNotify(c.id, isNotifying)}
                                      className={`shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-[1000] border transition-all ${
                                        isNotifying
                                          ? 'bg-teal-500 text-white border-teal-400 hover:bg-teal-600'
                                          : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'
                                      }`}
                                    >
                                      {isNotifying ? '🔔 알림 ON' : '🔕 알림 OFF'}
                                    </button>
                                  )}
                                </div>

                                {/* 중간 행: 카테고리 + 역할 + 멤버 수 */}
                                <div className="flex items-center gap-1.5 flex-wrap mb-3">
                                  <span className="text-[9px] font-[1000] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full border border-blue-100">{c.category}</span>
                                  <span className={`text-[9px] font-[1000] px-1.5 py-0.5 rounded-full border ${fingerMeta.color}`}>{fingerMeta.label}</span>
                                  <span className="text-[10px] font-bold text-slate-300">멤버 {c.memberCount}명 · 글 {c.postCount}개</span>
                                </div>

                                {/* 내 활동 통계 */}
                                {myStats.postCount > 0 && (
                                  <div className="flex items-center gap-3 mb-3 px-3 py-2 bg-teal-50/50 rounded-xl border border-teal-100">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">내 활동</span>
                                    <span className="text-[11px] font-[1000] text-teal-700">글 {myStats.postCount}개</span>
                                    <span className="text-[11px] font-[1000] text-rose-500">❤️ {myStats.likeCount}</span>
                                  </div>
                                )}

                                {/* 하단 버튼 행 */}
                                <div className="flex items-center justify-between gap-2">
                                  <button
                                    onClick={() => onGloveClick?.(c.id)}
                                    className="flex-1 py-1.5 rounded-xl text-[11px] font-[1000] text-teal-700 bg-teal-50 border border-teal-100 hover:bg-teal-100 transition-all"
                                  >
                                    {isOwner ? '🔧 관리하기' : '👉 입장하기'}
                                  </button>
                                  {/* 탈퇴 버튼: 개설자(엄지) 제외 */}
                                  {!isOwner && (
                                    <button
                                      onClick={() => onLeaveGlove?.(c.id)}
                                      className="px-3 py-1.5 rounded-xl text-[11px] font-[1000] text-rose-500 bg-white border border-rose-100 hover:bg-rose-50 transition-all"
                                    >
                                      탈퇴
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  );
                })()}

                {/* 🚀 ADSMARKET: 수익 대시보드 탭 */}
                {activeTab === 'revenue' && (
                  <RevenueDashboard
                    pendingRevenue={(userData as unknown as { pendingRevenue?: number }).pendingRevenue || 0}
                    pendingThanksBall={(userData as unknown as { pendingThanksBall?: number }).pendingThanksBall || 0}
                    totalSettled={(userData as unknown as { totalSettled?: number }).totalSettled || 0}
                    userLevel={calculateLevel(userData?.exp || 0)}
                  />
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
