// src/components/KanbuRoomList.tsx — 깐부방 찾기 (카드 그리드, CommunityList 패턴)
// 🚀 업그레이드: 단순 리스트 → 카드 그리드 + 가입/입장 분기
import { useState } from 'react';
import { db } from '../firebase';
import { doc, updateDoc, arrayUnion, increment } from 'firebase/firestore';
import type { KanbuRoom, UserData } from '../types';

interface Props {
  rooms: KanbuRoom[];
  onRoomClick: (room: KanbuRoom) => void;
  onCreateRoom: () => void;
  currentUserLevel: number;
  allUsers: Record<string, UserData>;
  currentUserData?: UserData | null;
  friends?: string[];
}

const KanbuRoomList = ({ rooms, onRoomClick, currentUserData, friends = [] }: Props) => {
  const [joiningId, setJoiningId] = useState<string | null>(null);

  // 깐부 관계 확인 (방 개설자가 내 깐부인지)
  const isKanbuOf = (room: KanbuRoom) =>
    room.creatorId === currentUserData?.uid || friends.includes(room.creatorNickname);

  // 가입 처리 — memberIds에 추가
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

  return (
    <div className="w-full pb-20">
      {rooms.length === 0 ? (
        <div className="py-40 text-center text-slate-400 font-bold text-sm italic">
          새로운 깐부방이 아직 없어요.
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
          {rooms.map(room => {
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
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-400">
                        {room.creatorNickname} · 멤버 {room.memberCount || 1}명
                      </span>
                    </div>
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
          })}
        </div>
      )}
    </div>
  );
};

export default KanbuRoomList;
