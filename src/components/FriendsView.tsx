// src/components/FriendsView.tsx — 깐부맺기 메인 화면
// 🚀 헤더 + 내 홍보 등록 + 홍보 카드 그리드 + 팝업 상세
import { useState } from 'react';
import type { Post, UserData } from '../types';
import { calculateLevel } from '../utils';
import KanbuPromoCard from './KanbuPromoCard';
import KanbuPromoModal from './KanbuPromoModal';
import KanbuPromoForm from './KanbuPromoForm';

interface Props {
  currentNickname?: string;
  currentUserData?: UserData | null;
  allUsers: Record<string, UserData>;
  allRootPosts: Post[];
  friends: string[];
  followerCounts: Record<string, number>;
  onToggleFriend: (author: string) => void;
}

const FriendsView = ({ currentNickname, currentUserData, allUsers, allRootPosts, friends, followerCounts, onToggleFriend }: Props) => {
  const [selectedUser, setSelectedUser] = useState<(UserData & { promoImageUrl?: string; promoKeywords?: string[]; promoMessage?: string }) | null>(null);
  const [showPromoForm, setShowPromoForm] = useState(false);

  // 홍보 활성화된 유저 목록 (promoEnabled === true)
  const promoUsers = Object.values(allUsers)
    .filter(u => u.uid && u.nickname && (u as unknown as { promoEnabled?: boolean }).promoEnabled && u.nickname !== currentNickname)
    // 중복 제거 (uid 키 + nickname 키 양쪽 등록)
    .reduce((acc, u) => { if (!acc.find(x => x.uid === u.uid)) acc.push(u); return acc; }, [] as UserData[]);

  const myLevel = calculateLevel(currentUserData?.exp || 0);
  const myPromo = currentUserData as unknown as { promoImageUrl?: string; promoKeywords?: string[]; promoMessage?: string; promoEnabled?: boolean } | null;

  return (
    <div className="w-full animate-in fade-in duration-500">
      {/* 🚀 헤더: CategoryHeader 스타일 */}
      <div className="sticky top-0 z-30 bg-[#F8FAFC]/80 backdrop-blur-md pt-2">
        <div className="flex items-center border-b border-slate-200 h-[36px] px-4">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-blue-600 font-black text-[15px]">#</span>
              <h2 className="text-[14px] font-[1000] text-slate-900 tracking-tighter whitespace-nowrap">깐부 맺기</h2>
            </div>
            <div className="w-px h-3 bg-slate-200 shrink-0 mx-1" />
            <p className="text-[12px] font-bold text-slate-500 truncate tracking-tight break-keep">
              당신의 깐부를 찾아 인연을 이어 보세요
            </p>
            {currentNickname && myLevel >= 2 && (
              <>
                <div className="w-px h-3 bg-slate-200 shrink-0 mx-1" />
                <button onClick={() => setShowPromoForm(true)}
                  className="flex items-center gap-0.5 text-[11px] font-bold text-slate-400 hover:text-violet-500 transition-colors shrink-0 whitespace-nowrap">
                  <span className="text-[10px]">+</span>{myPromo?.promoEnabled ? '홍보 수정' : '나를 홍보'}
                </button>
              </>
            )}
          </div>
        </div>
        <div className="h-3" />
      </div>

      <div className="max-w-4xl mx-auto px-4 pb-6">
        {/* 비로그인 안내 */}
        {!currentNickname && (
          <div className="mb-4 flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
            <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
            <span className="text-[12px] font-bold text-slate-500">로그인하면 깐부를 맺고 소통할 수 있어요.</span>
          </div>
        )}

        {/* 🚀 좌우 레이아웃: 좌측(깐부 홍보 목록) + 우측(내 홍보 사이드바) */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
          {/* 좌측: 다른 깐부들 홍보 목록 */}
          <div className="col-span-1 md:col-span-8">
            {promoUsers.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-slate-300 font-[1000] text-[16px] mb-2">깐부를 기다리고 있어요!</p>
                <p className="text-slate-300 font-bold text-[12px]">나를 홍보하고 깐부를 맺어보세요.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {promoUsers.map(user => (
                  <KanbuPromoCard
                    key={user.uid}
                    userData={user as UserData & { promoImageUrl?: string; promoKeywords?: string[]; promoMessage?: string }}
                    onClick={() => setSelectedUser(user as UserData & { promoImageUrl?: string; promoKeywords?: string[]; promoMessage?: string })}
                  />
                ))}
              </div>
            )}
          </div>

          {/* 우측: 내 홍보 사이드바 */}
          {currentNickname && (
            <aside className="hidden md:block md:col-span-4 sticky top-12">
              <div className="bg-slate-50 rounded-xl border-l-2 border-violet-200 p-4">
                <h4 className="text-[11px] font-black text-violet-500 uppercase tracking-widest mb-3">📌 나의 홍보</h4>
                {myPromo?.promoEnabled ? (
                  <KanbuPromoCard
                    userData={currentUserData as UserData & { promoImageUrl?: string; promoKeywords?: string[]; promoMessage?: string }}
                    onClick={() => setShowPromoForm(true)}
                  />
                ) : (
                  <div className="py-6 text-center">
                    <p className="text-slate-300 font-bold text-[12px] mb-2">나를 홍보하고 깐부를 맺어보세요</p>
                    {myLevel >= 2 ? (
                      <button onClick={() => setShowPromoForm(true)}
                        className="text-[11px] font-[1000] text-violet-500 hover:text-violet-700 transition-colors">+ 홍보 등록하기</button>
                    ) : (
                      <p className="text-[10px] font-bold text-slate-300">Lv2 이상이면 홍보할 수 있어요</p>
                    )}
                  </div>
                )}
              </div>
            </aside>
          )}

          {/* 모바일: 내 홍보 하단 표시 */}
          {currentNickname && (
            <div className="col-span-1 md:hidden border-t border-slate-200 pt-4">
              <h4 className="text-[11px] font-black text-violet-500 uppercase tracking-widest mb-3">📌 나의 홍보</h4>
              {myPromo?.promoEnabled ? (
                <KanbuPromoCard
                  userData={currentUserData as UserData & { promoImageUrl?: string; promoKeywords?: string[]; promoMessage?: string }}
                  onClick={() => setShowPromoForm(true)}
                />
              ) : (
                <div className="py-6 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <p className="text-slate-300 font-bold text-[12px] mb-1">나를 홍보하고 깐부를 맺어보세요</p>
                  {myLevel >= 2 ? (
                    <button onClick={() => setShowPromoForm(true)}
                      className="text-[11px] font-[1000] text-violet-500 hover:text-violet-700 transition-colors">+ 홍보 등록하기</button>
                  ) : (
                    <p className="text-[10px] font-bold text-slate-300">Lv2 이상이면 홍보할 수 있어요</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 팝업 상세 */}
      {selectedUser && currentNickname && (
        <KanbuPromoModal
          userData={selectedUser}
          isFriend={friends.includes(selectedUser.nickname)}
          isMutual={friends.includes(selectedUser.nickname) && !!(selectedUser.friendList && selectedUser.friendList.includes(currentNickname))}
          followerCount={followerCounts[selectedUser.nickname] || 0}
          postCount={allRootPosts.filter(p => p.author === selectedUser.nickname).length}
          onToggleFriend={() => { onToggleFriend(selectedUser.nickname); setSelectedUser(null); }}
          onClose={() => setSelectedUser(null)}
        />
      )}

      {/* 홍보 등록 폼 */}
      {showPromoForm && currentUserData && (
        <KanbuPromoForm
          currentPromo={{
            promoImageUrl: myPromo?.promoImageUrl,
            promoKeywords: myPromo?.promoKeywords,
            promoMessage: myPromo?.promoMessage,
            promoEnabled: myPromo?.promoEnabled,
          }}
          onClose={() => setShowPromoForm(false)}
        />
      )}
    </div>
  );
};

export default FriendsView;
