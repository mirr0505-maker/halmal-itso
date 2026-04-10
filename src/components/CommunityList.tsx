// src/components/CommunityList.tsx — 장갑 속 친구들: 전체 커뮤니티 목록 (카테고리 필터)
import { useState } from 'react';
import type { Community, UserData, JoinAnswers } from '../types';
import JoinCommunityModal from './JoinCommunityModal';

const ALL_CATEGORIES = ['전체', '주식', '부동산', '코인', '취미', '스포츠', '게임', '독서', '요리', '반려동물', '여행', '음악', '개발', '기타'];

interface Props {
  communities: Community[];
  currentUserData: UserData | null;
  joinedCommunityIds: string[];
  onCommunityClick: (community: Community) => void;
  // 🚀 Phase 6: options 파라미터 추가 (승인제 답변 전달)
  onJoin: (community: Community, options?: { joinAnswers?: JoinAnswers; joinMessage?: string }) => Promise<void>;
}

const CommunityList = ({ communities, currentUserData, joinedCommunityIds, onCommunityClick, onJoin }: Props) => {
  const [selectedCategory, setSelectedCategory] = useState('전체');
  const [joiningId, setJoiningId] = useState<string | null>(null);
  // 🚀 Phase 6: 승인제 가입 모달 상태
  const [joinModalTarget, setJoinModalTarget] = useState<Community | null>(null);

  // 🚀 가입된 장갑은 목록에서 제외 (나의 아늑한 장갑에서 접근)
  const notJoined = communities.filter(c => !joinedCommunityIds.includes(c.id) && c.creatorId !== currentUserData?.uid);
  const filtered = selectedCategory === '전체'
    ? notJoined
    : notJoined.filter(c => c.category === selectedCategory);

  const handleJoin = async (e: React.MouseEvent, community: Community) => {
    e.stopPropagation();
    if (joiningId) return;
    // 🚀 Phase 6: 승인제면 모달 띄우기, 아니면 기존 즉시 가입
    if ((community.joinType || 'open') === 'approval') {
      setJoinModalTarget(community);
      return;
    }
    setJoiningId(community.id);
    try { await onJoin(community); }
    finally { setJoiningId(null); }
  };

  return (
    <div className="w-full pb-20">
      {/* 카테고리 필터 칩 */}
      <div className="flex items-center gap-1.5 px-1 pb-4 overflow-x-auto">
        {ALL_CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-[1000] transition-all ${
              selectedCategory === cat
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="py-40 text-center text-slate-400 font-bold text-sm italic">
          {selectedCategory === '전체' ? '아직 장갑이 없어요. 첫 번째 장갑을 만들어보세요!' : `'${selectedCategory}' 장갑이 아직 없어요.`}
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
          {filtered.map(community => {
            const isJoined = joinedCommunityIds.includes(community.id);
            const isOwner = community.creatorId === currentUserData?.uid;
            return (
              <div
                key={community.id}
                onClick={() => onCommunityClick(community)}
                className="border border-slate-100 rounded-xl overflow-hidden cursor-pointer hover:border-blue-300 hover:shadow-lg transition-all group bg-white"
              >
                {/* 색상 바 */}
                <div className="h-2 w-full" style={{ backgroundColor: community.coverColor || '#3b82f6' }} />
                <div className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
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
                      {/* 🚀 가입 방식 + 조건 나열 (모든 장갑 통일 형식) */}
                      {(() => {
                        const jt = community.joinType || 'open';
                        const badge = jt === 'open' ? '🟢 자동 가입' : jt === 'approval' ? '🔵 승인제' : '🔒 초대코드';
                        const badgeColor = jt === 'open' ? 'text-emerald-600' : jt === 'approval' ? 'text-blue-600' : 'text-slate-500';
                        const conditions: string[] = [];
                        if ((community.minLevel || 1) > 1) conditions.push(`Lv${community.minLevel}+`);
                        if (community.joinForm) {
                          const enabled = community.joinForm.standardFields?.filter(f => f.enabled && f.required) || [];
                          const labels: Record<string, string> = { name: '이름', region: '지역', phone: '연락처', email: '이메일', shares: '보유수량' };
                          enabled.forEach(f => conditions.push(labels[f.key] || f.key));
                          const reqCustom = community.joinForm.customQuestions?.filter(q => q.required) || [];
                          if (reqCustom.length > 0) conditions.push(`추가질문 ${reqCustom.length}개`);
                        }
                        return (
                          <p className={`text-[10px] font-bold mt-0.5 truncate ${badgeColor}`}>
                            {badge}{conditions.length > 0 ? ` · ${conditions.join(' · ')}` : ''}
                          </p>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-[1000] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{community.category}</span>
                      <span className="text-[10px] font-bold text-slate-400">멤버 {community.memberCount}명</span>
                    </div>
                    {/* 가입 버튼 — 이미 가입했거나 owner면 숨김 */}
                    {!isJoined && !isOwner && currentUserData && (
                      <button
                        onClick={(e) => handleJoin(e, community)}
                        disabled={joiningId === community.id}
                        className="px-3 py-1 rounded-lg text-[11px] font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
                      >
                        {joiningId === community.id ? '가입 중...' : '가입'}
                      </button>
                    )}
                    {(isJoined || isOwner) && (
                      <span className="text-[10px] font-black text-emerald-600">✓ 가입됨</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {/* 🚀 Phase 6: 승인제 가입 모달 */}
      {joinModalTarget && currentUserData && (
        <JoinCommunityModal
          community={joinModalTarget}
          currentUser={currentUserData}
          onClose={() => setJoinModalTarget(null)}
          onSubmit={async (answers, joinMessage) => {
            setJoiningId(joinModalTarget.id);
            try {
              await onJoin(joinModalTarget, { joinAnswers: answers, joinMessage });
              setJoinModalTarget(null);
            } finally { setJoiningId(null); }
          }}
        />
      )}
    </div>
  );
};

export default CommunityList;
