// src/components/CommunityFeed.tsx — 장갑 속 소곤소곤: 가입한 커뮤니티의 최신 글 피드
// 🚀 Firestore 'in' 쿼리 최대 30개 제한 — 초과 시 첫 30개 커뮤니티만 구독
import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, getDocs } from 'firebase/firestore';
import type { CommunityPost, Community, UserData, CommunityMember } from '../types';
import { sanitizeHtml } from '../sanitize';
import { calculateLevel, getReputationLabel, getReputationScore, formatKoreanNumber } from '../utils';
import CommunityPostDetail from './CommunityPostDetail';

interface Props {
  currentUserData: UserData | null;
  joinedCommunityIds: string[];
  allUsers: Record<string, UserData>;
  communities?: Community[];
  followerCounts?: Record<string, number>;
  onCommunityClick: (community: Community) => void;
}

const CommunityFeed = ({ currentUserData, joinedCommunityIds, allUsers, communities: _communities = [], followerCounts = {}, onCommunityClick: _onCommunityClick }: Props) => {
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  // 🚀 글 상세 모달 + 멤버 lazy load
  const [selectedPost, setSelectedPost] = useState<CommunityPost | null>(null);
  const [modalMembers, setModalMembers] = useState<CommunityMember[]>([]);

  useEffect(() => {
    if (joinedCommunityIds.length === 0) { setPosts([]); return; }
    const ids = joinedCommunityIds.slice(0, 30);
    const q = query(
      collection(db, 'community_posts'),
      where('communityId', 'in', ids),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, snap => {
      setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() } as CommunityPost)));
    }, (err) => console.error('[CommunityFeed onSnapshot]', err));
    return () => unsub();
  }, [joinedCommunityIds]);

  // 🚀 글 클릭 → 모달 열기 + 해당 커뮤니티 멤버 lazy load
  const handlePostClick = async (post: CommunityPost) => {
    setSelectedPost(post);
    setModalMembers([]);
    try {
      const q = query(collection(db, 'community_memberships'), where('communityId', '==', post.communityId));
      const snap = await getDocs(q);
      setModalMembers(snap.docs.map(d => d.data() as CommunityMember));
    } catch (e) { console.error('[feed member load]', e); }
  };

  const formatTime = (ts: { seconds: number } | null | undefined) => {
    if (!ts) return '';
    const d = new Date(ts.seconds * 1000);
    const diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return '방금 전';
    if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
    return d.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' });
  };

  if (!currentUserData) {
    return (
      <div className="py-40 text-center">
        <p className="text-slate-400 font-bold text-sm">로그인 후 이용할 수 있어요.</p>
      </div>
    );
  }

  if (joinedCommunityIds.length === 0) {
    return (
      <div className="py-40 text-center">
        <p className="text-slate-400 font-bold text-sm italic mb-2">지금 장갑 안에서 들려오는 이야기가 없어요.</p>
        <p className="text-slate-300 font-bold text-[12px]">장갑 속 친구들 탭에서 커뮤니티에 가입해보세요!</p>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="py-40 text-center text-slate-400 font-bold text-sm italic">
        가입한 커뮤니티에 아직 글이 없어요. 첫 번째 이야기를 남겨보세요!
      </div>
    );
  }

  return (
    <div className="w-full pb-20 flex flex-col gap-2">
      {posts.map(post => {
        const authorData = allUsers[`nickname_${post.author}`];
        return (
          <div key={post.id}
            onClick={() => handlePostClick(post)}
            className="bg-white border border-slate-100 rounded-xl px-5 py-4 hover:border-blue-200 hover:shadow-md transition-all group cursor-pointer">
            {/* 커뮤니티명 배지 + 봇 뱃지 */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-[1000] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">🧤 {post.communityName}</span>
              {(post as CommunityPost & { isBot?: boolean; botSource?: string }).isBot && (
                <span className="text-[9px] font-[1000] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                  🤖 {(post as CommunityPost & { botSource?: string }).botSource === 'news' ? '뉴스' :
                      (post as CommunityPost & { botSource?: string }).botSource === 'dart' ? '공시' :
                      (post as CommunityPost & { botSource?: string }).botSource === 'price' ? '주가' : '정보봇'}
                </span>
              )}
              <span className="text-[10px] font-bold text-slate-300">{formatTime(post.createdAt)}</span>
            </div>
            {post.title && (
              <h3 className="text-[14px] font-[1000] text-slate-900 group-hover:text-blue-600 transition-colors mb-1">{post.title}</h3>
            )}
            <div
              className="text-[13px] font-medium text-slate-500 line-clamp-2 leading-relaxed [&_img]:hidden [&_p]:mb-0.5"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.content) }}
            />
            {/* 🚀 하단: AnyTalkList 글카드와 동일 구조 (공유 제외) */}
            <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-50">
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="w-6 h-6 rounded-full bg-slate-50 overflow-hidden shrink-0 border border-white shadow-sm ring-1 ring-slate-100">
                  <img src={authorData?.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${post.author}`} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[11px] font-[1000] text-slate-900 truncate leading-none mb-0.5">{post.author}</span>
                  <span className="text-[9px] font-bold text-slate-400 truncate tracking-tight">
                    Lv {calculateLevel(authorData?.exp || 0)} · {getReputationLabel(authorData ? getReputationScore(authorData) : 0)} · 깐부수 {formatKoreanNumber(followerCounts[post.author] || 0)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-black shrink-0 text-slate-300">
                <span className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                  {formatKoreanNumber(post.commentCount || 0)}
                </span>
                {(post.thanksballTotal || 0) > 0 && (
                  <span className="flex items-center gap-0.5 text-amber-400">
                    <span className="text-[13px]">⚾</span> {post.thanksballTotal}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5 fill-none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
                  {formatKoreanNumber(post.likes || 0)}
                </span>
              </div>
            </div>
          </div>
        );
      })}

      {/* 🚀 글 상세 모달 */}
      {selectedPost && (
        <CommunityPostDetail
          post={selectedPost}
          currentUserData={currentUserData}
          allUsers={allUsers}
          followerCounts={followerCounts}
          members={modalMembers}
          onClose={() => { setSelectedPost(null); setModalMembers([]); }}
        />
      )}
    </div>
  );
};

export default CommunityFeed;
