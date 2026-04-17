// src/components/KanbuRoomList.tsx — 깐부방 찾기 (카드 그리드 + 깐부맺기 홍보 인터리브)
// 구조: [방 카드 6개 (2줄)] → [🤝 깐부맺기 홍보 4명 (1줄)] → [나머지 방 카드]
import { useState } from 'react';
import { db } from '../firebase';
import { doc, updateDoc, arrayUnion, increment } from 'firebase/firestore';
import type { KanbuRoom, UserData } from '../types';
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
}

const KanbuRoomList = ({ rooms, onRoomClick, currentUserData, friends = [], allUsers, onFriendsClick, onPromoUserClick, followerCounts = {} }: Props) => {
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

  const renderRoomCard = (room: KanbuRoom) => {
    const canJoin = isKanbuOf(room);
    return (
      <div
        key={room.id}
        onClick={() => canJoin ? handleJoin({ stopPropagation: () => {} } as React.MouseEvent, room) : undefined}
        className={`border border-slate-100 rounded-xl overflow-hidden transition-all group bg-white ${canJoin ? 'cursor-pointer hover:border-blue-300 hover:shadow-lg' : 'opacity-70'}`}
      >
        <div className="h-2 w-full bg-slate-300" />
        <div className="px-4 py-3">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="min-w-0">
              <h3 className="text-[14px] font-[1000] text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                {room.title}
              </h3>
              {room.description && (
                <p className="text-[12px] font-bold text-slate-400 mt-0.5 line-clamp-1">{room.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-[10px] font-bold text-slate-400">
              {room.creatorNickname} · 멤버 {room.memberCount || 1}명
            </span>
            {canJoin ? (
              <button
                onClick={(e) => handleJoin(e, room)}
                disabled={joiningId === room.id}
                className="px-3 py-1 rounded-lg text-[11px] font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {joiningId === room.id ? '가입 중...' : '가입'}
              </button>
            ) : (
              <span className="text-[10px] font-bold text-slate-300">🔒 깐부만</span>
            )}
          </div>
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
        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
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
        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
          {restSegment.map(renderRoomCard)}
        </div>
      )}
    </div>
  );
};

export default KanbuRoomList;
