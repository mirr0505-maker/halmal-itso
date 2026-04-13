// src/components/MyCommunityList.tsx — 나의 아늑한 장갑: 내가 가입한 커뮤니티 목록
import type { Community } from '../types';

interface Props {
  communities: Community[];
  joinedCommunityIds: string[];
  onCommunityClick: (community: Community) => void;
  onLeave: (community: Community) => Promise<void>;
  // 🚀 compact=true: 우측 사이드바용 소형 레이아웃
  compact?: boolean;
}

const MyCommunityList = ({ communities, joinedCommunityIds, onCommunityClick, onLeave, compact = false }: Props) => {
  const myCommunities = communities.filter(c => joinedCommunityIds.includes(c.id));

  if (myCommunities.length === 0) {
    return (
      <div className={compact ? 'py-6 px-4 text-center' : 'py-40 text-center'}>
        <p className="text-slate-400 font-bold text-[12px] italic">아직 가입한 장갑이 없어요.</p>
        {!compact && <p className="text-slate-300 font-bold text-[12px] mt-1">장갑 찾기 탭에서 마음에 드는 장갑에 가입해보세요!</p>}
      </div>
    );
  }

  // 🚀 사이드바 compact 모드: 컬러 도트 + 이름만 표시하는 리스트
  if (compact) {
    return (
      <div className="py-2">
        {myCommunities.map(community => (
          <button
            key={community.id}
            onClick={() => onCommunityClick(community)}
            className="w-full flex items-center gap-2.5 px-4 py-2 hover:bg-slate-50 transition-colors text-left group"
          >
            {community.thumbnailUrl ? (
              <img src={community.thumbnailUrl} alt="" className="w-6 h-6 rounded-md object-cover shrink-0" />
            ) : (
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: community.coverColor || '#3b82f6' }} />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-[1000] text-slate-700 group-hover:text-blue-600 truncate">{community.name}</p>
              <p className="text-[10px] font-bold text-slate-300 leading-none mt-0.5">멤버 {community.memberCount}명</p>
            </div>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="w-full pb-20">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
        {myCommunities.map(community => {
          const isOwner = joinedCommunityIds.includes(community.id); // owner 판별은 creatorId로
          return (
            <div
              key={community.id}
              onClick={() => onCommunityClick(community)}
              className="border border-slate-100 rounded-xl overflow-hidden cursor-pointer hover:border-blue-300 hover:shadow-lg transition-all group bg-white"
            >
              {community.thumbnailUrl ? (
                <div className="aspect-[16/9] w-full bg-slate-100 overflow-hidden">
                  <img src={community.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="h-2 w-full" style={{ backgroundColor: community.coverColor || '#3b82f6' }} />
              )}
              <div className="px-4 py-3">
                <div className="flex items-start gap-2 mb-1">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-[14px] font-[1000] text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                        {community.name}
                      </h3>
                      {community.isPrivate && (
                        <span className="text-[9px] font-black text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">🔒 비밀</span>
                      )}
                    </div>
                    {community.description && (
                      <p className="text-[12px] font-bold text-slate-400 mt-0.5 line-clamp-1">{community.description}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-[1000] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{community.category}</span>
                    <span className="text-[10px] font-bold text-slate-400">멤버 {community.memberCount}명</span>
                  </div>
                  {/* owner는 탈퇴 버튼 숨김 — 커뮤니티 삭제는 추후 설정에서 */}
                  {isOwner && community.creatorId !== undefined ? null : (
                    <button
                      onClick={(e) => { e.stopPropagation(); onLeave(community); }}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-slate-400 border border-slate-200 hover:bg-rose-50 hover:text-rose-500 hover:border-rose-200 transition-colors"
                    >
                      탈퇴
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MyCommunityList;
