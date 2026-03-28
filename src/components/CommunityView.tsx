// src/components/CommunityView.tsx — 개별 커뮤니티 상세: 글 목록 + 글 작성
import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, where, orderBy, doc, setDoc, updateDoc, deleteDoc, increment, arrayUnion, arrayRemove, serverTimestamp } from 'firebase/firestore';
import type { Community, CommunityPost, CommunityMember, FingerRole } from '../types';
import TiptapEditor from './TiptapEditor';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, BUCKET_NAME, PUBLIC_URL } from '../s3Client';

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
  currentUserData: any;
  allUsers: Record<string, any>;
  onBack: () => void;
}

const CommunityView = ({ community, currentUserData, allUsers, onBack }: Props) => {
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [isWriting, setIsWriting] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedPost, setSelectedPost] = useState<CommunityPost | null>(null);
  // 🚀 다섯 손가락 Phase 2 — 탭 + 멤버 상태
  const [activeTab, setActiveTab] = useState<'posts' | 'members' | 'admin'>('posts');
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [currentMembership, setCurrentMembership] = useState<CommunityMember | null>(null);

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

  // 🚀 다섯 손가락 Phase 2 — 멤버 승인 (pending → active, finger: pinky→ring)
  const handleApprove = async (member: CommunityMember) => {
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
    await deleteDoc(doc(db, 'community_memberships', `${community.id}_${member.userId}`));
  };

  // 🚀 다섯 손가락 Phase 2 — 손가락 역할 변경 (thumb/index만 가능)
  const handleChangeFinger = async (member: CommunityMember, newFinger: FingerRole) => {
    if (!isAdmin) return;
    const membershipId = `${community.id}_${member.userId}`;
    await updateDoc(doc(db, 'community_memberships', membershipId), { finger: newFinger });
  };

  // 🚀 다섯 손가락 Phase 2 — 멤버 강퇴
  const handleBan = async (member: CommunityMember) => {
    if (!isAdmin) return;
    if (!window.confirm(`${member.nickname}님을 강퇴하시겠습니까?`)) return;
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
      const arrayBuffer = await file.arrayBuffer();
      await s3Client.send(new PutObjectCommand({ Bucket: BUCKET_NAME, Key: filePath, Body: new Uint8Array(arrayBuffer), ContentType: file.type }));
      return `${PUBLIC_URL}/${filePath}`;
    } catch { alert('이미지 업로드에 실패했습니다.'); return null; }
    finally { setIsUploading(false); }
  };

  const handleSubmit = async () => {
    if (!currentUserData || !newContent.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const postId = `cpost_${Date.now()}_${currentUserData.uid}`;
      await setDoc(doc(db, 'community_posts', postId), {
        communityId: community.id,
        communityName: community.name,
        author: currentUserData.nickname,
        author_id: currentUserData.uid,
        title: newTitle.trim() || null,
        content: newContent,
        likes: 0,
        likedBy: [],
        commentCount: 0,
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'communities', community.id), { postCount: increment(1) });
      setNewTitle(''); setNewContent(''); setIsWriting(false);
    } finally { setIsSubmitting(false); }
  };

  const handleLike = async (e: React.MouseEvent, post: CommunityPost) => {
    e.stopPropagation();
    if (!currentUserData) { alert('로그인이 필요합니다.'); return; }
    const isLiked = post.likedBy?.includes(currentUserData.nickname);
    await updateDoc(doc(db, 'community_posts', post.id), {
      likes: Math.max(0, (post.likes || 0) + (isLiked ? -1 : 1)),
      likedBy: isLiked ? arrayRemove(currentUserData.nickname) : arrayUnion(currentUserData.nickname),
    });
  };

  const formatTime = (ts: any) => {
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
            {currentUserData && (
              <button
                onClick={() => setIsWriting(true)}
                className="px-4 h-7 rounded-lg text-[12px] font-bold bg-slate-900 text-white hover:bg-blue-600 transition-colors"
              >
                + 글 쓰기
              </button>
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
          {/* 🚀 다섯 손가락 Phase 2 — 탭 바 */}
          <div className="flex gap-0 mt-3 border-b border-slate-100">
            {(['posts', 'members', ...(isAdmin ? ['admin'] : [])] as Array<'posts' | 'members' | 'admin'>).map((tab) => {
              const labels: Record<string, string> = { posts: '💬 소곤소곤', members: `🤝 멤버 ${activeMembers.length}`, admin: `⚙️ 관리${pendingMembers.length > 0 ? ` (${pendingMembers.length})` : ''}` };
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
          </div>
        </div>
      </div>

      {/* 🚀 다섯 손가락 Phase 2 — 멤버 탭 */}
      {activeTab === 'members' && (
        <div className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm">
          <div className="px-5 py-3 border-b border-slate-50">
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">활성 멤버 {activeMembers.length}명</p>
          </div>
          {activeMembers.map(m => {
            const finger: FingerRole = m.finger ?? (m.role === 'owner' ? 'thumb' : 'ring');
            const meta = FINGER_META[finger];
            return (
              <div key={m.userId} className="flex items-center justify-between px-5 py-3 border-b border-slate-50 last:border-0">
                <div className="flex items-center gap-3">
                  <img src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${m.nickname}`} className="w-8 h-8 rounded-full bg-slate-50" alt="" />
                  <div>
                    <span className="text-[13px] font-bold text-slate-800">{m.nickname}</span>
                    <span className={`ml-2 text-[10px] font-black px-1.5 py-0.5 rounded ${meta.colorCls}`}>{meta.emoji} {meta.label}</span>
                  </div>
                </div>
                {/* 역할 변경 (thumb/index만, 본인 제외) */}
                {isAdmin && m.userId !== currentUserData?.uid && finger !== 'thumb' && (
                  <div className="flex items-center gap-1">
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
            );
          })}
        </div>
      )}

      {/* 🚀 다섯 손가락 Phase 2 — 관리 탭 (thumb/index만) */}
      {activeTab === 'admin' && isAdmin && (
        <div className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm">
          {pendingMembers.length === 0 ? (
            <div className="py-16 text-center text-slate-400 font-bold text-sm">승인 대기 중인 멤버가 없어요</div>
          ) : (
            <>
              <div className="px-5 py-3 border-b border-slate-50">
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">승인 대기 {pendingMembers.length}명</p>
              </div>
              {pendingMembers.map(m => (
                <div key={m.userId} className="flex items-center justify-between px-5 py-4 border-b border-slate-50 last:border-0">
                  <div className="flex items-center gap-3">
                    <img src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${m.nickname}`} className="w-9 h-9 rounded-full bg-slate-50" alt="" />
                    <div>
                      <p className="text-[13px] font-bold text-slate-800">{m.nickname}</p>
                      {m.joinMessage && <p className="text-[11px] font-medium text-slate-400 mt-0.5">"{m.joinMessage}"</p>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleApprove(m)} className="px-3 py-1.5 rounded-lg text-[12px] font-black bg-blue-600 text-white hover:bg-blue-700 transition-colors">승인</button>
                    <button onClick={() => handleReject(m)} className="px-3 py-1.5 rounded-lg text-[12px] font-black bg-slate-100 text-slate-500 hover:bg-red-50 hover:text-red-500 transition-colors">거절</button>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* 글 작성 폼 */}
      {activeTab === 'posts' && isWriting && (
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
      {activeTab === 'posts' && (
        posts.length === 0 ? (
          <div className="py-32 text-center text-slate-400 font-bold text-sm italic">
            첫 번째 이야기를 남겨보세요!
          </div>
        ) : (
          <div className="flex flex-col gap-2 mt-4">
            {posts.map(post => {
              const isLiked = currentUserData && post.likedBy?.includes(currentUserData.nickname);
              const authorData = allUsers[`nickname_${post.author}`];
              return (
                <div
                  key={post.id}
                  onClick={() => setSelectedPost(post)}
                  className="bg-white border border-slate-100 rounded-xl px-5 py-4 cursor-pointer hover:border-blue-300 hover:shadow-md transition-all group"
                >
                  {post.title && (
                    <h3 className="text-[15px] font-[1000] text-slate-900 group-hover:text-blue-600 transition-colors mb-1">{post.title}</h3>
                  )}
                  <div
                    className="text-[13px] font-medium text-slate-500 line-clamp-3 leading-relaxed [&_img]:hidden [&_p]:mb-1"
                    dangerouslySetInnerHTML={{ __html: post.content }}
                  />
                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-50">
                    <div className="flex items-center gap-2">
                      <img src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${post.author}`} className="w-5 h-5 rounded-full bg-slate-50" alt="" />
                      <span className="text-[11px] font-bold text-slate-500">{post.author}</span>
                      {authorData && <span className="text-[10px] font-bold text-slate-300">Lv{authorData.level || 1}</span>}
                      <span className="text-[10px] font-bold text-slate-300">{formatTime(post.createdAt)}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] font-black text-slate-300">
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
          post={selectedPost}
          currentUserData={currentUserData}
          allUsers={allUsers}
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
  currentUserData: any;
  allUsers: Record<string, any>;
  onClose: () => void;
  onLike: (e: React.MouseEvent, post: CommunityPost) => void;
}

const CommunityPostDetail = ({ post, currentUserData, allUsers: _allUsers, onClose, onLike }: DetailProps) => {
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, 'community_post_comments'),
      where('postId', '==', post.id),
      orderBy('createdAt', 'asc')
    );
    const unsub = onSnapshot(q, snap => setComments(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
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
      setNewComment('');
    } finally { setIsSubmitting(false); }
  };

  const formatTime = (ts: any) => {
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
            <span className="text-[11px] font-bold text-slate-300">{formatTime(post.createdAt)}</span>
          </div>
          <div
            className="text-[14px] font-medium text-slate-700 leading-[1.8] [&_p]:mb-3 [&_strong]:font-bold [&_em]:italic [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_img]:rounded-lg [&_img]:max-w-full [&_a]:text-blue-400 [&_a]:underline"
            dangerouslySetInnerHTML={{ __html: post.content }}
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
