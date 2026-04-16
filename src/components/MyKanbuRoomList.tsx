// src/components/MyKanbuRoomList.tsx — 나의 깐부방 목록
// compact=true: 사이드바 소형 (컬러 도트 + 방 제목)
// compact=false: 메인 탭 카드 그리드
import type { KanbuRoom } from '../types';

interface Props {
  rooms: KanbuRoom[];
  onRoomClick: (room: KanbuRoom) => void;
  compact?: boolean;
}

const MyKanbuRoomList = ({ rooms, onRoomClick, compact = false }: Props) => {
  if (compact) {
    return (
      <div className="sticky top-[60px]">
        <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <span className="text-[11px] font-[1000] text-slate-700">나의 깐부방</span>
            <span className="text-[10px] font-bold text-slate-400 ml-1.5">{rooms.length}</span>
          </div>
          {rooms.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-[11px] font-bold text-slate-300 italic">가입한 깐부방이 없어요</p>
            </div>
          ) : (
            <div className="max-h-[400px] overflow-y-auto">
              {rooms.map(room => (
                <button
                  key={room.id}
                  onClick={() => onRoomClick(room)}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 text-left"
                >
                  <div className="w-2 h-2 rounded-full bg-slate-400 shrink-0" />
                  <span className="text-[12px] font-bold text-slate-700 truncate">{room.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 메인 영역 — 카드 그리드
  return (
    <div className="w-full pb-20">
      {rooms.length === 0 ? (
        <div className="py-40 text-center text-slate-400 font-bold text-sm italic">
          가입한 깐부방이 없어요. '깐부방 찾기'에서 가입해보세요!
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
          {rooms.map(room => (
            <div
              key={room.id}
              onClick={() => onRoomClick(room)}
              className="border border-slate-100 rounded-xl overflow-hidden cursor-pointer hover:border-blue-300 hover:shadow-lg transition-all group bg-white"
            >
              <div className="h-2 w-full bg-blue-400" />
              <div className="px-4 py-3">
                <h3 className="text-[14px] font-[1000] text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                  {room.title}
                </h3>
                {room.description && (
                  <p className="text-[12px] font-bold text-slate-400 mt-0.5 line-clamp-1">{room.description}</p>
                )}
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[10px] font-bold text-slate-400">
                    {room.creatorNickname} · 멤버 {room.memberCount || 1}명
                  </span>
                  <span className="text-[10px] font-black text-emerald-600">✓ 가입됨</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyKanbuRoomList;
