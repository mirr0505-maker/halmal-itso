// src/components/RankingView.tsx — 랭킹 리더보드 (월드와이드 수준 UI)
// MainTab: 좋아요·땡스볼·조회수·공유수  SubTab: 유저·글
// viewMode: top20(Hero 1-3 + compact 4-20) | all(전체 compact)
import { useState } from 'react';
import type { Post, UserData } from '../types';
import { getCategoryDisplayName, formatKoreanNumber, calculateLevel } from '../utils';

interface Props {
  allRootPosts: Post[];
  allUsers: Record<string, UserData>;
  onPostClick: (post: Post) => void;
}

type MainTab = 'likes' | 'thanksball' | 'views' | 'shares';
type SubTab = 'users' | 'posts';
type ViewMode = 'top20' | 'all';

// 탭별 accent 색상 설정
const TAB_CONFIG: Record<MainTab, { label: string; icon: string; accent: string; bar: string; activeBg: string; hero: string }> = {
  likes:      { label: '좋아요',  icon: '♥',  accent: 'text-rose-500',    bar: 'bg-rose-400',    activeBg: 'bg-rose-500',    hero: 'from-rose-50 to-pink-50 border-rose-200' },
  thanksball: { label: '땡스볼',  icon: '⚾',  accent: 'text-amber-500',   bar: 'bg-amber-400',   activeBg: 'bg-amber-500',   hero: 'from-amber-50 to-yellow-50 border-amber-200' },
  views:      { label: '조회수',  icon: '👁',  accent: 'text-blue-500',    bar: 'bg-blue-400',    activeBg: 'bg-blue-500',    hero: 'from-blue-50 to-sky-50 border-blue-200' },
  shares:     { label: '공유수',  icon: '🔗',  accent: 'text-emerald-500', bar: 'bg-emerald-400', activeBg: 'bg-emerald-500', hero: 'from-emerald-50 to-teal-50 border-emerald-200' },
};

// Top 3 카드 스타일 — 배경 그라디언트 + 순위 숫자 색상
const TOP3_STYLES = [
  { bg: 'from-amber-50 to-yellow-50 border-amber-200',  rankColor: 'text-amber-400' },
  { bg: 'from-slate-50 to-gray-100 border-slate-200',   rankColor: 'text-slate-400' },
  { bg: 'from-orange-50 to-amber-50 border-orange-200', rankColor: 'text-orange-400' },
];

const RankingView = ({ allRootPosts, allUsers, onPostClick }: Props) => {
  const [mainTab, setMainTab] = useState<MainTab>('likes');
  const [subTab, setSubTab] = useState<SubTab>('users');
  const [viewMode, setViewMode] = useState<ViewMode>('top20');

  // ── 유저 랭킹 계산 (전체, slice 없음 — render 시 viewMode에 따라 제한) ─────
  // 좋아요 유저: allUsers.likes 기준 (닉네임 중복 제거)
  const seenNickLike = new Set<string>();
  const likeUserRanking = Object.values(allUsers)
    .filter(u => { if (!u.nickname || seenNickLike.has(u.nickname)) return false; seenNickLike.add(u.nickname); return true; })
    .sort((a, b) => (b.likes || 0) - (a.likes || 0));

  // 땡스볼 유저: 글쓴이별 thanksballTotal 합산
  const thanksballUserMap: Record<string, number> = {};
  allRootPosts.forEach(p => { if ((p.thanksballTotal || 0) > 0) thanksballUserMap[p.author] = (thanksballUserMap[p.author] || 0) + (p.thanksballTotal || 0); });
  const thanksballUserRanking = Object.entries(thanksballUserMap).sort(([, a], [, b]) => b - a);

  // 조회수 유저: 글쓴이별 viewCount 합산
  const viewUserMap: Record<string, number> = {};
  allRootPosts.forEach(p => { if ((p.viewCount || 0) > 0) viewUserMap[p.author] = (viewUserMap[p.author] || 0) + (p.viewCount || 0); });
  const viewUserRanking = Object.entries(viewUserMap).sort(([, a], [, b]) => b - a);

  // 공유수 유저: 글쓴이별 shareCount 합산
  const shareUserMap: Record<string, number> = {};
  allRootPosts.forEach(p => { if ((p.shareCount || 0) > 0) shareUserMap[p.author] = (shareUserMap[p.author] || 0) + (p.shareCount || 0); });
  const shareUserRanking = Object.entries(shareUserMap).sort(([, a], [, b]) => b - a);

  // ── 글 랭킹 계산 (전체) ────────────────────────────────────
  const likePostRanking = [...allRootPosts].filter(p => !p.kanbuRoomId).sort((a, b) => (b.likes || 0) - (a.likes || 0));
  const thanksballPostRanking = [...allRootPosts].filter(p => (p.thanksballTotal || 0) > 0 && !p.kanbuRoomId).sort((a, b) => (b.thanksballTotal || 0) - (a.thanksballTotal || 0));
  const viewPostRanking = [...allRootPosts].filter(p => (p.viewCount || 0) > 0 && !p.kanbuRoomId).sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
  const sharePostRanking = [...allRootPosts].filter(p => (p.shareCount || 0) > 0 && !p.kanbuRoomId).sort((a, b) => (b.shareCount || 0) - (a.shareCount || 0));

  // ── 현재 탭의 데이터 선택 ──────────────────────────────────
  type UserEntry = { nickname: string; avatarUrl: string; level: number; value: number };
  const getCurrentUserList = (): UserEntry[] => {
    const avatarOf = (nick: string) => allUsers[`nickname_${nick}`]?.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${nick}`;
    const levelOf = (nick: string) => calculateLevel(allUsers[`nickname_${nick}`]?.exp || 0);
    if (mainTab === 'likes') return likeUserRanking.map(u => ({ nickname: u.nickname || '', avatarUrl: u.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${u.nickname}`, level: calculateLevel(u.exp || 0), value: u.likes || 0 }));
    if (mainTab === 'thanksball') return thanksballUserRanking.map(([n, v]) => ({ nickname: n, avatarUrl: avatarOf(n), level: levelOf(n), value: v }));
    if (mainTab === 'views')  return viewUserRanking.map(([n, v]) => ({ nickname: n, avatarUrl: avatarOf(n), level: levelOf(n), value: v }));
    return shareUserRanking.map(([n, v]) => ({ nickname: n, avatarUrl: avatarOf(n), level: levelOf(n), value: v }));
  };
  const getCurrentPostList = (): Post[] => {
    if (mainTab === 'likes')      return likePostRanking;
    if (mainTab === 'thanksball') return thanksballPostRanking;
    if (mainTab === 'views')      return viewPostRanking;
    return sharePostRanking;
  };

  const cfg = TAB_CONFIG[mainTab];
  // viewMode에 따라 표시 개수 제한 (top20: 20개, all: 전체)
  const rawUserList = getCurrentUserList();
  const rawPostList = getCurrentPostList();
  const userList = viewMode === 'top20' ? rawUserList.slice(0, 20) : rawUserList;
  const postList = viewMode === 'top20' ? rawPostList.slice(0, 20) : rawPostList;
  const list = subTab === 'users' ? userList : postList;
  // maxValue: 0 방지를 위해 Math.max(1, ...) 처리
  const maxValue = Math.max(1,
    list.length > 0
      ? (subTab === 'users' ? (userList[0]?.value || 0) : getPostValue(postList[0]))
      : 1
  );

  function getPostValue(p: Post | undefined): number {
    if (!p) return 1;
    if (mainTab === 'likes')      return p.likes || 0;
    if (mainTab === 'thanksball') return p.thanksballTotal || 0;
    if (mainTab === 'views')      return p.viewCount || 0;
    return p.shareCount || 0;
  }
  function formatPostValue(p: Post): string {
    const v = getPostValue(p);
    if (mainTab === 'likes')      return `${cfg.icon} ${formatKoreanNumber(v)}`;
    if (mainTab === 'thanksball') return `${cfg.icon} ${formatKoreanNumber(v)}볼`;
    return `${cfg.icon} ${formatKoreanNumber(v)}`;
  }
  function formatUserValue(v: number): string {
    if (mainTab === 'likes')      return `${cfg.icon} ${formatKoreanNumber(v)}`;
    if (mainTab === 'thanksball') return `${cfg.icon} ${formatKoreanNumber(v)}볼`;
    return `${cfg.icon} ${formatKoreanNumber(v)}`;
  }

  // ── Hero 카드 (Top 3) ─────────────────────────────────────
  const renderHeroUserCard = (u: UserEntry, idx: number) => {
    const style = TOP3_STYLES[idx];
    return (
      <div key={u.nickname} className={`flex items-center gap-3.5 px-5 py-4 rounded-2xl border-2 bg-gradient-to-r ${style.bg}`}>
        <span className={`text-[32px] font-[1000] leading-none w-9 text-center shrink-0 ${style.rankColor}`}>{idx + 1}</span>
        <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white shadow-md shrink-0 bg-slate-100">
          <img src={u.avatarUrl} alt="" className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-[1000] text-slate-900 truncate">{u.nickname}</p>
          <p className="text-[11px] font-bold text-slate-400">Lv {u.level}</p>
        </div>
        <span className={`text-[15px] font-[1000] shrink-0 ${cfg.accent}`}>{formatUserValue(u.value)}</span>
      </div>
    );
  };

  const renderHeroPostCard = (p: Post, idx: number) => {
    const style = TOP3_STYLES[idx];
    const title = p.title || (p.content || '').replace(/<[^>]+>/g, '').slice(0, 50);
    return (
      <div key={p.id} onClick={() => onPostClick(p)} className={`flex items-center gap-3.5 px-5 py-4 rounded-2xl border-2 bg-gradient-to-r cursor-pointer ${style.bg}`}>
        <span className={`text-[32px] font-[1000] leading-none w-9 text-center shrink-0 ${style.rankColor}`}>{idx + 1}</span>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-[1000] text-slate-900 truncate">{title}</p>
          <p className="text-[11px] font-bold text-slate-400 mt-0.5">{p.author} · {getCategoryDisplayName(p.category)}</p>
        </div>
        <span className={`text-[15px] font-[1000] shrink-0 ${cfg.accent}`}>{formatPostValue(p)}</span>
      </div>
    );
  };

  // ── Compact row (Rank 4+) ─────────────────────────────────
  const renderCompactUserRow = (u: UserEntry, idx: number) => (
    <div key={u.nickname} className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white border border-slate-100 hover:border-slate-200 transition-all">
      <span className="w-6 h-6 flex items-center justify-center text-[10px] font-black text-slate-400 bg-slate-50 rounded-full border border-slate-100 shrink-0">{idx + 1}</span>
      <div className="w-8 h-8 rounded-full overflow-hidden border border-slate-200 shrink-0 bg-slate-50">
        <img src={u.avatarUrl} alt="" className="w-full h-full object-cover" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-[1000] text-slate-800 truncate">{u.nickname}</p>
        <div className="mt-1 h-1 bg-slate-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${cfg.bar}`} style={{ width: `${Math.max(4, (u.value / maxValue) * 100)}%` }} />
        </div>
      </div>
      <span className={`text-[12px] font-[1000] shrink-0 ${cfg.accent}`}>{formatUserValue(u.value)}</span>
    </div>
  );

  const renderCompactPostRow = (p: Post, idx: number) => {
    const title = p.title || (p.content || '').replace(/<[^>]+>/g, '').slice(0, 40);
    const value = getPostValue(p);
    return (
      <div key={p.id} onClick={() => onPostClick(p)} className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white border border-slate-100 hover:border-slate-200 cursor-pointer transition-all">
        <span className="w-6 h-6 flex items-center justify-center text-[10px] font-black text-slate-400 bg-slate-50 rounded-full border border-slate-100 shrink-0">{idx + 1}</span>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-[1000] text-slate-800 truncate">{title}</p>
          <div className="mt-1 h-1 bg-slate-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${cfg.bar}`} style={{ width: `${Math.max(4, (value / maxValue) * 100)}%` }} />
          </div>
        </div>
        <span className={`text-[12px] font-[1000] shrink-0 ${cfg.accent}`}>{formatPostValue(p)}</span>
      </div>
    );
  };

  const isEmpty = list.length === 0;

  return (
    <div className="w-full max-w-2xl mx-auto py-8 px-4 animate-in fade-in duration-500">
      {/* 메인 탭 — 탭 색상이 현재 탭의 accent로 */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {(Object.entries(TAB_CONFIG) as [MainTab, typeof cfg][]).map(([id, c]) => (
          <button
            key={id}
            onClick={() => setMainTab(id)}
            className={`px-4 py-2 rounded-xl text-[13px] font-[1000] transition-all ${mainTab === id ? `${c.activeBg} text-white shadow-md` : 'bg-white text-slate-400 border border-slate-100 hover:border-slate-200 hover:text-slate-600'}`}
          >
            {c.icon} {c.label}
          </button>
        ))}
      </div>

      {/* 서브 탭 + TOP20/전체 토글 */}
      <div className="flex items-center gap-2 mb-5">
        <div className="flex gap-1 flex-1 bg-slate-50 p-1 rounded-xl border border-slate-100">
          {(['users', 'posts'] as const).map((id) => (
            <button
              key={id}
              onClick={() => setSubTab(id)}
              className={`flex-1 py-1.5 rounded-lg text-[12px] font-[1000] transition-all ${subTab === id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              {id === 'users' ? '유저' : '글'}
            </button>
          ))}
        </div>
        {/* TOP 20 / 전체 토글 */}
        <div className="flex gap-1 bg-slate-50 p-1 rounded-xl border border-slate-100 shrink-0">
          {(['top20', 'all'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-[1000] transition-all ${viewMode === mode ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              {mode === 'top20' ? 'TOP 20' : '전체'}
            </button>
          ))}
        </div>
      </div>

      {/* 랭킹 목록 */}
      {isEmpty ? (
        <div className="py-20 text-center text-slate-300 font-bold italic">
          {mainTab === 'thanksball' ? '아직 받은 땡스볼이 없어요.' : mainTab === 'views' ? '아직 조회 기록이 없어요.' : mainTab === 'shares' ? '아직 공유 기록이 없어요.' : '데이터가 없어요.'}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {/* TOP 20 모드: Top 3 Hero 카드 + 4위 이하 compact */}
          {viewMode === 'top20' && subTab === 'users' && userList.slice(0, 3).map((u, idx) => renderHeroUserCard(u, idx))}
          {viewMode === 'top20' && subTab === 'posts' && postList.slice(0, 3).map((p, idx) => renderHeroPostCard(p, idx))}

          {/* 4위 이하(TOP 20) 또는 전체(all) compact rows */}
          {((viewMode === 'top20' && list.length > 3) || viewMode === 'all') && (
            <div className={`flex flex-col gap-1.5 ${viewMode === 'top20' ? 'mt-2' : ''}`}>
              {/* top20: 4위부터(slice 3), all: 1위부터 전부(slice 0) */}
              {subTab === 'users'
                ? userList.slice(viewMode === 'all' ? 0 : 3).map((u, i) => renderCompactUserRow(u, i + (viewMode === 'all' ? 0 : 3)))
                : postList.slice(viewMode === 'all' ? 0 : 3).map((p, i) => renderCompactPostRow(p, i + (viewMode === 'all' ? 0 : 3)))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RankingView;
