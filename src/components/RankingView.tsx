// src/components/RankingView.tsx
import { useState } from 'react';
import type { Post } from '../types';
import { getCategoryDisplayName, formatKoreanNumber } from '../utils';

interface Props {
  allRootPosts: Post[];
  allUsers: Record<string, any>;
  onPostClick: (post: Post) => void;
}

type MainTab = 'likes' | 'thanksball' | 'views';
type SubTab = 'users' | 'posts';

const MEDAL = ['🥇', '🥈', '🥉'];

const RankingView = ({ allRootPosts, allUsers, onPostClick }: Props) => {
  const [mainTab, setMainTab] = useState<MainTab>('likes');
  const [subTab, setSubTab] = useState<SubTab>('users');

  // 좋아요 유저 랭킹: allUsers 기준 likes 내림차순 (닉네임 중복 제거)
  const seenNicknamesLike = new Set<string>();
  const likeUserRanking = Object.values(allUsers)
    .filter((u: any) => {
      if (!u.nickname || seenNicknamesLike.has(u.nickname)) return false;
      seenNicknamesLike.add(u.nickname);
      return true;
    })
    .sort((a: any, b: any) => (b.likes || 0) - (a.likes || 0))
    .slice(0, 20);

  // 좋아요 글 랭킹: rootPosts 기준 likes 내림차순
  const likePostRanking = [...allRootPosts]
    .filter(p => !p.kanbuRoomId)
    .sort((a, b) => (b.likes || 0) - (a.likes || 0))
    .slice(0, 20);

  // 땡스볼 유저 랭킹: 글쓴이별 thanksballTotal 합산
  const thanksballUserMap: Record<string, number> = {};
  allRootPosts.forEach(p => {
    if ((p.thanksballTotal || 0) > 0) {
      thanksballUserMap[p.author] = (thanksballUserMap[p.author] || 0) + (p.thanksballTotal || 0);
    }
  });
  const thanksballUserRanking = Object.entries(thanksballUserMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 20);

  // 땡스볼 글 랭킹: thanksballTotal 내림차순
  const thanksballPostRanking = [...allRootPosts]
    .filter(p => (p.thanksballTotal || 0) > 0 && !p.kanbuRoomId)
    .sort((a, b) => (b.thanksballTotal || 0) - (a.thanksballTotal || 0))
    .slice(0, 20);

  // 조회수 유저 랭킹: 글쓴이별 viewCount 합산
  const viewUserMap: Record<string, number> = {};
  allRootPosts.forEach(p => {
    if ((p.viewCount || 0) > 0) {
      viewUserMap[p.author] = (viewUserMap[p.author] || 0) + (p.viewCount || 0);
    }
  });
  const viewUserRanking = Object.entries(viewUserMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 20);

  // 조회수 글 랭킹: viewCount 내림차순
  const viewPostRanking = [...allRootPosts]
    .filter(p => (p.viewCount || 0) > 0 && !p.kanbuRoomId)
    .sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0))
    .slice(0, 20);

  const renderRankBadge = (idx: number) => {
    if (idx < 3) return <span className="text-lg leading-none">{MEDAL[idx]}</span>;
    return (
      <span className="w-6 h-6 flex items-center justify-center text-[11px] font-black text-slate-400 bg-slate-50 rounded-full border border-slate-100">
        {idx + 1}
      </span>
    );
  };

  const renderUserRow = (user: any, idx: number, value: number, unit: string) => {
    const avatarUrl = user.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.nickname}`;
    return (
      <div key={user.nickname || idx} className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all ${idx < 3 ? 'bg-amber-50/40 border-amber-100' : 'bg-white border-slate-100 hover:border-blue-100'}`}>
        <div className="w-6 flex items-center justify-center shrink-0">{renderRankBadge(idx)}</div>
        <div className="w-9 h-9 rounded-full overflow-hidden border border-slate-200 shrink-0 bg-slate-50">
          <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-[1000] text-slate-800 truncate">{user.nickname}</p>
          <p className="text-[10px] font-bold text-slate-400">Lv {user.level || 1}</p>
        </div>
        <div className={`text-[13px] font-[1000] shrink-0 ${mainTab === 'thanksball' ? 'text-amber-500' : 'text-rose-400'}`}>
          {unit === 'likes' ? `♥ ${formatKoreanNumber(value)}` : `⚾ ${formatKoreanNumber(value)}볼`}
        </div>
      </div>
    );
  };

  const renderThanksballUserRow = (entry: [string, number], idx: number) => {
    const [nickname, total] = entry;
    const userData = allUsers[`nickname_${nickname}`];
    const avatarUrl = userData?.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${nickname}`;
    return (
      <div key={nickname} className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all ${idx < 3 ? 'bg-amber-50/40 border-amber-100' : 'bg-white border-slate-100 hover:border-amber-100'}`}>
        <div className="w-6 flex items-center justify-center shrink-0">{renderRankBadge(idx)}</div>
        <div className="w-9 h-9 rounded-full overflow-hidden border border-slate-200 shrink-0 bg-slate-50">
          <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-[1000] text-slate-800 truncate">{nickname}</p>
          <p className="text-[10px] font-bold text-slate-400">Lv {userData?.level || 1}</p>
        </div>
        <div className="text-[13px] font-[1000] text-amber-500 shrink-0">
          ⚾ {formatKoreanNumber(total)}볼
        </div>
      </div>
    );
  };

  const renderViewUserRow = (entry: [string, number], idx: number) => {
    const [nickname, total] = entry;
    const userData = allUsers[`nickname_${nickname}`];
    const avatarUrl = userData?.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${nickname}`;
    return (
      <div key={nickname} className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all ${idx < 3 ? 'bg-amber-50/40 border-amber-100' : 'bg-white border-slate-100 hover:border-blue-100'}`}>
        <div className="w-6 flex items-center justify-center shrink-0">{renderRankBadge(idx)}</div>
        <div className="w-9 h-9 rounded-full overflow-hidden border border-slate-200 shrink-0 bg-slate-50">
          <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-[1000] text-slate-800 truncate">{nickname}</p>
          <p className="text-[10px] font-bold text-slate-400">Lv {userData?.level || 1}</p>
        </div>
        <div className="text-[13px] font-[1000] text-blue-400 shrink-0">
          👁 {formatKoreanNumber(total)}
        </div>
      </div>
    );
  };

  const renderPostRow = (post: Post, idx: number) => {
    const value = mainTab === 'likes' ? (post.likes || 0) : mainTab === 'thanksball' ? (post.thanksballTotal || 0) : (post.viewCount || 0);
    const valueDisplay = mainTab === 'likes' ? `♥ ${formatKoreanNumber(value)}` : mainTab === 'thanksball' ? `⚾ ${formatKoreanNumber(value)}볼` : `👁 ${formatKoreanNumber(value)}`;
    const valueColor = mainTab === 'thanksball' ? 'text-amber-500' : mainTab === 'views' ? 'text-blue-400' : 'text-rose-400';
    return (
      <div
        key={post.id}
        onClick={() => onPostClick(post)}
        className={`flex items-center gap-3 px-4 py-3 rounded-2xl border cursor-pointer transition-all hover:shadow-sm ${idx < 3 ? 'bg-amber-50/40 border-amber-100 hover:border-amber-200' : 'bg-white border-slate-100 hover:border-blue-100'}`}
      >
        <div className="w-6 flex items-center justify-center shrink-0">{renderRankBadge(idx)}</div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-[1000] text-slate-800 truncate group-hover:text-blue-600">
            {post.title || post.content.replace(/<[^>]+>/g, '').slice(0, 40)}
          </p>
          <p className="text-[10px] font-bold text-slate-400 mt-0.5">
            {post.author} · {getCategoryDisplayName(post.category)}
          </p>
        </div>
        <div className={`text-[13px] font-[1000] shrink-0 ${valueColor}`}>
          {valueDisplay}
        </div>
      </div>
    );
  };

  const isEmpty =
    (mainTab === 'likes' && subTab === 'users' && likeUserRanking.length === 0) ||
    (mainTab === 'likes' && subTab === 'posts' && likePostRanking.length === 0) ||
    (mainTab === 'thanksball' && subTab === 'users' && thanksballUserRanking.length === 0) ||
    (mainTab === 'thanksball' && subTab === 'posts' && thanksballPostRanking.length === 0) ||
    (mainTab === 'views' && subTab === 'users' && viewUserRanking.length === 0) ||
    (mainTab === 'views' && subTab === 'posts' && viewPostRanking.length === 0);

  return (
    <div className="w-full max-w-2xl mx-auto py-8 px-4 animate-in fade-in duration-500">
      {/* 헤더 */}
      <div className="mb-6">
        <h2 className="text-[22px] font-[1000] text-slate-900 tracking-tight">랭킹</h2>
        <p className="text-[12px] font-bold text-slate-400 mt-1">좋아요 · 땡스볼 기준 상위 유저 및 글</p>
      </div>

      {/* 메인 탭 */}
      <div className="flex gap-2 mb-4">
        {([['likes', '♥ 좋아요'], ['thanksball', '⚾ 땡스볼'], ['views', '👁 조회수']] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setMainTab(id)}
            className={`px-4 py-2 rounded-xl text-[13px] font-[1000] transition-all ${mainTab === id ? 'bg-slate-900 text-white shadow-md' : 'bg-white text-slate-400 border border-slate-100 hover:border-slate-200 hover:text-slate-600'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 서브 탭 */}
      <div className="flex gap-1 mb-5 bg-slate-50 p-1 rounded-xl border border-slate-100">
        {([['users', '유저'], ['posts', '글']] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setSubTab(id)}
            className={`flex-1 py-1.5 rounded-lg text-[12px] font-[1000] transition-all ${subTab === id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 랭킹 목록 */}
      <div className="flex flex-col gap-2">
        {isEmpty ? (
          <div className="py-20 text-center text-slate-300 font-bold italic">
            {mainTab === 'thanksball' ? '아직 받은 땡스볼이 없어요.' : mainTab === 'views' ? '아직 조회 기록이 없어요.' : '데이터가 없어요.'}
          </div>
        ) : (
          <>
            {mainTab === 'likes' && subTab === 'users' &&
              likeUserRanking.map((u: any, idx) => renderUserRow(u, idx, u.likes || 0, 'likes'))}
            {mainTab === 'likes' && subTab === 'posts' &&
              likePostRanking.map((p, idx) => renderPostRow(p, idx))}
            {mainTab === 'thanksball' && subTab === 'users' &&
              thanksballUserRanking.map((entry, idx) => renderThanksballUserRow(entry, idx))}
            {mainTab === 'thanksball' && subTab === 'posts' &&
              thanksballPostRanking.map((p, idx) => renderPostRow(p, idx))}
            {mainTab === 'views' && subTab === 'users' &&
              viewUserRanking.map((entry, idx) => renderViewUserRow(entry, idx))}
            {mainTab === 'views' && subTab === 'posts' &&
              viewPostRanking.map((p, idx) => renderPostRow(p, idx))}
          </>
        )}
      </div>
    </div>
  );
};

export default RankingView;
