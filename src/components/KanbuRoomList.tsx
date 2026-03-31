// src/components/KanbuRoomList.tsx — 입장 가능한 깐부방 목록
import { useState } from 'react';
import type { KanbuRoom, UserData } from '../types';

interface Props {
  rooms: KanbuRoom[];
  onRoomClick: (room: KanbuRoom) => void;
  onCreateRoom: () => void;
  currentUserLevel: number;
  allUsers: Record<string, UserData>;
}

const KanbuRoomList = ({ rooms, onRoomClick, onCreateRoom, currentUserLevel }: Props) => {
  const [showLevelAlert, setShowLevelAlert] = useState(false);

  const handleCreateClick = () => {
    if (currentUserLevel < 3) {
      setShowLevelAlert(true);
      return;
    }
    onCreateRoom();
  };

  const getTimeAgo = (timestamp: { seconds: number } | null | undefined) => {
    if (!timestamp) return '';
    const diff = Math.floor((Date.now() - timestamp.seconds * 1000) / 1000);
    if (diff < 60) return '방금 전';
    if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
    return new Date(timestamp.seconds * 1000).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="w-full max-w-2xl mx-auto py-6 animate-in fade-in duration-300">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6 px-1">
        <div>
          <h2 className="text-[20px] font-[1000] text-slate-900 tracking-tight">깐부방</h2>
          <p className="text-[12px] font-bold text-slate-400 mt-0.5">내 깐부가 개설한 방에 입장할 수 있어요</p>
        </div>
        <button
          onClick={handleCreateClick}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-[12px] font-[1000] transition-colors shadow-sm"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
          </svg>
          새 깐부방
        </button>
      </div>

      {/* 레벨 부족 알림 */}
      {showLevelAlert && (
        <div className="mb-4 flex items-center gap-3 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">
          <svg className="w-4 h-4 text-rose-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <span className="text-[12px] font-bold text-rose-700 flex-1">깐부방을 개설 할 수 있는 레벨이 충족되지 못하였습니다</span>
          <button onClick={() => setShowLevelAlert(false)} className="text-rose-300 hover:text-rose-500 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* 방 목록 */}
      {rooms.length === 0 ? (
        <div className="py-24 text-center">
          <p className="text-slate-300 font-bold text-[13px]">아직 입장 가능한 깐부방이 없습니다.</p>
          <p className="text-slate-200 font-bold text-[11px] mt-1">깐부를 더 맺거나 직접 방을 개설해보세요.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {rooms.map(room => {
            return (
              <div
                key={room.id}
                onClick={() => onRoomClick(room)}
                className="bg-white border border-slate-100 rounded-2xl px-5 py-4 cursor-pointer hover:border-blue-200 hover:shadow-sm transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-slate-100 overflow-hidden border border-slate-200 shrink-0">
                    <img src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${room.creatorNickname}`} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h4 className="text-[14px] font-[1000] text-slate-900 group-hover:text-blue-600 transition-colors truncate tracking-tight">
                        {room.title}
                      </h4>
                      <span className="text-[9px] font-black text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded-md shrink-0">Lv{room.creatorLevel}</span>
                    </div>
                    {room.description && (
                      <p className="text-[11px] font-bold text-slate-400 truncate">{room.description}</p>
                    )}
                    <p className="text-[10px] font-bold text-slate-300 mt-0.5">
                      {room.creatorNickname} · {getTimeAgo(room.createdAt)}
                    </p>
                  </div>
                  <svg className="w-4 h-4 text-slate-200 group-hover:text-blue-400 transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                  </svg>
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
