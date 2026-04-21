// src/components/KanbuRoomList.tsx — 깐부방 찾기 (카드 그리드 + 깐부맺기 홍보 인터리브)
// 구조: [방 카드 6개 (2줄)] → [🤝 깐부맺기 홍보 4명 (1줄)] → [나머지 방 카드]
// 🚀 2026-04-17: 카드 대형화 (16:9 표지·호스트·유료스니펫·멤버·땡스볼·LIVE 배지)
import { useState } from 'react';
import { db } from '../firebase';
import { doc, updateDoc, arrayUnion, increment } from 'firebase/firestore';
import type { KanbuRoom, Post, UserData } from '../types';
import { calculateLevel, formatKoreanNumber, getReputationLabel, getReputation } from '../utils';
import KanbuPromoCard from './KanbuPromoCard';

interface Props {
  rooms: KanbuRoom[];
  onRoomClick: (room: KanbuRoom) => void;
  onCreateRoom: () => void;
  currentUserLevel: number;
  allUsers: Record<string, UserData>;
  currentUserData?: UserData | null;
  friends?: string[];
  onFriendsClick?: () => void;                    // 🤝 깐부맺기 메뉴로 이동
  onPromoUserClick?: (user: UserData) => void;    // 홍보 카드 클릭 → 프로필 or 모달
  followerCounts?: Record<string, number>;
  allRootPosts?: Post[];                          // 🚀 유료/구독 최신글 프리뷰 + 땡스볼 합계 계산용
}

const KanbuRoomList = ({ rooms, onRoomClick, currentUserData, friends = [], allUsers, onFriendsClick, onPromoUserClick, followerCounts = {}, allRootPosts = [] }: Props) => {
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const isKanbuOf = (room: KanbuRoom) =>
    room.creatorId === currentUserData?.uid || friends.includes(room.creatorNickname);

  const handleJoin = async (e: React.MouseEvent, room: KanbuRoom) => {
    e.stopPropagation();
    if (!currentUserData || joiningId) return;
    if (!isKanbuOf(room)) {
      alert('깐부 관계인 사람의 방에만 가입할 수 있습니다.');
      return;
    }
    setJoiningId(room.id);
    try {
      await updateDoc(doc(db, 'kanbu_rooms', room.id), {
        memberIds: arrayUnion(currentUserData.uid),
        memberCount: increment(1),
      });
      onRoomClick(room);
    } finally {
      setJoiningId(null);
    }
  };

  // 🤝 깐부맺기 홍보 유저 — 본인·기존 깐부 제외, promoEnabled + 만료 안 됨
  const now = Date.now();
  const seen = new Set<string>();
  const promoUsers = Object.entries(allUsers).filter(([key, u]) => {
    if (key.startsWith('nickname_')) return false;
    const p = u as unknown as { promoEnabled?: boolean; promoExpireAt?: { seconds: number } };
    if (!p.promoEnabled) return false;
    if (p.promoExpireAt && p.promoExpireAt.seconds * 1000 < now) return false;
    if (u.uid === currentUserData?.uid) return false;
    if (friends.includes(u.nickname)) return false;
    if (seen.has(u.nickname)) return false;
    seen.add(u.nickname);
    return true;
  }).map(([, u]) => u).slice(0, 4);

  // 🏠 방 2줄 분할 — 앞 6개 / 나머지
  const firstSegment = rooms.slice(0, 6);
  const restSegment = rooms.slice(6);

  // 🚀 방별 유료/구독 최신글 1건 + 땡스볼 합계 캐시 (렌더 중 반복 계산 방지)
  const roomMeta = (room: KanbuRoom) => {
    const roomPosts = allRootPosts.filter(p => p.kanbuRoomId === room.id);
    const sortedDesc = [...roomPosts].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    const latestOnce = sortedDesc.find(p => p.kanbuBoardType === 'paid_once');
    const latestMonthly = sortedDesc.find(p => p.kanbuBoardType === 'paid_monthly');
    const totalThanksball = roomPosts.reduce((sum, p) => sum + (p.thanksballTotal || 0), 0);
    return { latestOnce, latestMonthly, totalThanksball };
  };

  const renderRoomCard = (room: KanbuRoom) => {
    const canJoin = isKanbuOf(room);
    const settings = room.cardSettings || {};  // 미정의 시 모두 true 해석
    const showHost = settings.showHostInfo !== false;
    const showMember = settings.showMember !== false;
    const showBall = settings.showThanksball !== false;
    const showPaid = settings.showPaidPreview !== false;

    const hostData = allUsers[room.creatorId] || allUsers[`nickname_${room.creatorNickname}`];
    const hostLevel = calculateLevel(hostData?.exp || 0);
    const hostRepLabel = getReputationLabel(hostData ? getReputation(hostData) : 0);
    const isLive = !!room.liveSessionId;
    const { latestOnce, latestMonthly, totalThanksball } = showPaid || showBall ? roomMeta(room) : { latestOnce: undefined, latestMonthly: undefined, totalThanksball: 0 };

    return (
      <div
        key={room.id}
        onClick={() => canJoin ? handleJoin({ stopPropagation: () => {} } as React.MouseEvent, room) : undefined}
        className={`border border-slate-100 rounded-2xl overflow-hidden transition-all group bg-white flex flex-col ${canJoin ? 'cursor-pointer hover:border-blue-300 hover:shadow-lg' : 'opacity-70'}`}
      >
        {/* 1. 16:9 표지 이미지 + LIVE 배지 */}
        <div className="relative aspect-[16/9] bg-gradient-to-br from-slate-100 via-slate-50 to-blue-50 overflow-hidden">
          {room.thumbnailUrl ? (
            <img src={room.thumbnailUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-300">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
          {isLive && (
            <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500 text-white text-[9px] font-[1000] tracking-wider shadow-md">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              LIVE
            </div>
          )}
          {!canJoin && (
            <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-white/90 text-slate-500 text-[9px] font-[1000]">🔒 깐부만</div>
          )}
        </div>

        {/* 2. 호스트 라인 */}
        {showHost && (
          <div className="flex items-center gap-2 px-4 pt-3 pb-2 border-b border-slate-50">
            <div className="w-7 h-7 rounded-full overflow-hidden bg-slate-50 border border-slate-100 shrink-0">
              <img src={hostData?.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${room.creatorNickname}`} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="min-w-0 flex items-baseline gap-1.5">
              <span className="text-[12px] font-[1000] text-slate-900 truncate">{room.creatorNickname}</span>
              <span className="text-[10px] font-bold text-slate-400 shrink-0">Lv.{hostLevel} · {hostRepLabel}</span>
            </div>
          </div>
        )}

        {/* 3. 제목 + 소개 */}
        <div className="px-4 py-3">
          <h3 className="text-[15px] font-[1000] text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1">
            {room.title}
          </h3>
          {room.description && (
            <p className="text-[12px] font-bold text-slate-500 mt-1 line-clamp-2 leading-relaxed">{room.description}</p>
          )}
        </div>

        {/* 4. 유료/구독 최신글 스니펫 */}
        {showPaid && (latestOnce || latestMonthly) && (
          <div className="px-4 pb-2 flex flex-col gap-1">
            {latestOnce && (
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-2 py-1.5">
                <span className="text-amber-500 shrink-0">🔒</span>
                <span className="text-slate-400 shrink-0 text-[10px]">유료글</span>
                <span className="truncate text-slate-700">{latestOnce.title || '(제목 없음)'}</span>
              </div>
            )}
            {latestMonthly && (
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-2 py-1.5">
                <span className="text-violet-500 shrink-0">🔒</span>
                <span className="text-slate-400 shrink-0 text-[10px]">구독글</span>
                <span className="truncate text-slate-700">{latestMonthly.title || '(제목 없음)'}</span>
              </div>
            )}
          </div>
        )}

        {/* 5. 하단 통계 띠 + 가입 버튼 */}
        <div className="mt-auto px-4 py-3 border-t border-slate-100 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 flex-wrap min-w-0">
            {showMember && (
              <span className="flex items-center gap-0.5">👥 <span className="text-slate-700 font-[1000]">{formatKoreanNumber(room.memberCount || 1)}</span>명</span>
            )}
            {showBall && totalThanksball > 0 && (
              <span className="flex items-center gap-0.5">⚾ <span className="text-amber-500 font-[1000]">{formatKoreanNumber(totalThanksball)}</span></span>
            )}
            <span className="text-slate-300">🤝 깐부 전용</span>
          </div>
          {canJoin && (
            <button
              onClick={(e) => handleJoin(e, room)}
              disabled={joiningId === room.id}
              className="px-3 py-1 rounded-lg text-[11px] font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 shrink-0"
            >
              {joiningId === room.id ? '가입 중...' : '가입'}
            </button>
          )}
        </div>
      </div>
    );
  };

  if (rooms.length === 0 && promoUsers.length === 0) {
    return (
      <div className="w-full py-40 text-center text-slate-400 font-bold text-sm italic">
        새로운 깐부방이 아직 없어요.
      </div>
    );
  }

  return (
    <div className="w-full pb-20 space-y-4">
      {/* 1️⃣ 앞 2줄 방 카드 */}
      {firstSegment.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-3">
          {firstSegment.map(renderRoomCard)}
        </div>
      )}

      {/* 2️⃣ 🤝 깐부맺기 홍보 1줄 (홈 패턴 동일) */}
      {promoUsers.length > 0 && (
        <div className="my-2 py-2">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[13px] font-[1000] text-slate-700 flex items-center gap-1.5">
              🤝 깐부맺기
            </span>
            {onFriendsClick && (
              <button onClick={onFriendsClick}
                className="text-[11px] font-bold text-slate-500 hover:text-violet-600 transition-colors flex items-center gap-0.5">
                깐부맺기 <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {promoUsers.map(user => (
              <KanbuPromoCard
                key={user.uid}
                userData={user as UserData & { promoImageUrl?: string; promoKeywords?: string[]; promoMessage?: string; promoExpireAt?: { seconds: number }; promoViewCount?: number }}
                followerCount={followerCounts[user.nickname] || 0}
                onClick={() => onPromoUserClick?.(user)}
              />
            ))}
          </div>
        </div>
      )}

      {/* 3️⃣ 나머지 방 카드 */}
      {restSegment.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-3">
          {restSegment.map(renderRoomCard)}
        </div>
      )}
    </div>
  );
};

export default KanbuRoomList;
