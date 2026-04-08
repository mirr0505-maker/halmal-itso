// src/components/CommunityChatPanel.tsx — 🚀 Phase 7 Step 1: 채팅방 placeholder + 가드
import type { Community, UserData, CommunityMember } from '../types';
import { CHAT_MEMBER_LIMIT } from '../types';

interface Props {
  community: Community;
  currentUser: UserData | null;
  members: CommunityMember[];
}

const CommunityChatPanel = ({ community, currentUser, members }: Props) => {
  const isAvailable = (community.memberCount ?? 0) <= CHAT_MEMBER_LIMIT;

  // 🚀 50명 초과 — 비활성 안내
  if (!isAvailable) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <p className="text-[40px] mb-3">💭</p>
        <p className="text-[15px] font-[1000] text-slate-700 mb-1">채팅은 50명 이하 장갑에서만 사용할 수 있어요</p>
        <p className="text-[12px] font-bold text-slate-400">
          현재 멤버 <strong className="text-slate-600">{community.memberCount}명</strong> · 소규모 장갑의 깊이 있는 소통을 위해 인원 제한을 두고 있습니다.
        </p>
        <p className="text-[10px] font-bold text-slate-300 mt-4">💡 큰 장갑은 글(소곤소곤)을 활용해주세요</p>
      </div>
    );
  }

  // 🚀 비멤버 차단
  const myMembership = currentUser ? members.find(m => m.userId === currentUser.uid) : null;
  const isMember = myMembership && (myMembership.joinStatus ?? 'active') === 'active';

  if (!isMember) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <p className="text-[40px] mb-3">🔒</p>
        <p className="text-[15px] font-[1000] text-slate-700 mb-1">장갑 멤버만 채팅에 참여할 수 있어요</p>
        <p className="text-[12px] font-bold text-slate-400">먼저 가입 신청을 해주세요</p>
      </div>
    );
  }

  // 🚀 정상 진입 — Step 2에서 실제 채팅 UI 구현
  return (
    <div className="flex flex-col h-[600px] items-center justify-center text-slate-300">
      <p className="text-[40px] mb-2">🚧</p>
      <p className="text-[13px] font-[1000]">채팅 UI 준비 중입니다</p>
      <p className="text-[10px] font-bold text-slate-300 mt-1">현재 멤버 {community.memberCount}/{CHAT_MEMBER_LIMIT}명</p>
    </div>
  );
};

export default CommunityChatPanel;
