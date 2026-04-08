// src/hooks/useGloveActions.ts — 커뮤니티(장갑) 관련 핸들러 (개설·가입·탈퇴·깐부방 생성)
import { db } from '../firebase';
import { doc, setDoc, updateDoc, increment, getDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import type { Dispatch, SetStateAction } from 'react';
import type { Community, KanbuRoom, UserData } from '../types';

interface GloveActionDeps {
  userData: UserData | null;
  setJoinedCommunityIds: Dispatch<SetStateAction<string[]>>;
  setIsCreateCommunityOpen: Dispatch<SetStateAction<boolean>>;
  setGloveSubTab: Dispatch<SetStateAction<'feed' | 'list'>>;
  setIsCreateRoomOpen: Dispatch<SetStateAction<boolean>>;
}

// 커뮤니티 개설 최소 레벨 — 이 값을 바꾸면 조건 일괄 변경
const GLOVE_CREATE_MIN_LEVEL = 3;

export function useGloveActions({
  userData,
  setJoinedCommunityIds,
  setIsCreateCommunityOpen,
  setGloveSubTab,
  setIsCreateRoomOpen,
}: GloveActionDeps) {
  // 깐부방 생성
  const handleCreateRoom = async (data: Pick<KanbuRoom, 'title' | 'description'>) => {
    if (!userData) return;
    const roomId = `room_${Date.now()}_${userData.uid}`;
    await setDoc(doc(db, 'kanbu_rooms', roomId), {
      title: data.title,
      description: data.description || '',
      creatorId: userData.uid,
      creatorNickname: userData.nickname,
      creatorLevel: userData.level,
      createdAt: serverTimestamp(),
    });
    setIsCreateRoomOpen(false);
  };

  // 🚀 커뮤니티 개설 핸들러 — Lv3 이상 확인 후 communities 컬렉션에 문서 생성
  // GLOVE_CREATE_MIN_LEVEL 상수를 바꾸면 개설 레벨 조건 일괄 변경
  const handleCreateCommunity = async (data: {
    name: string; description: string; category: string;
    isPrivate: boolean; coverColor?: string;
    joinType?: string; minLevel?: number; password?: string; joinQuestion?: string;
    joinForm?: import('../types').JoinForm;
  }) => {
    if (!userData) return;
    if ((userData.level || 1) < GLOVE_CREATE_MIN_LEVEL) {
      alert(`커뮤니티 개설은 Lv${GLOVE_CREATE_MIN_LEVEL} 이상만 가능합니다. (현재 Lv${userData.level || 1})`);
      return;
    }
    const communityId = `community_${Date.now()}_${userData.uid}`;
    await setDoc(doc(db, 'communities', communityId), {
      name: data.name,
      description: data.description || '',
      category: data.category,
      isPrivate: data.isPrivate,
      coverColor: data.coverColor || '',
      creatorId: userData.uid,
      creatorNickname: userData.nickname,
      creatorLevel: userData.level || 1,
      memberCount: 1,
      postCount: 0,
      createdAt: serverTimestamp(),
      // 🚀 다섯 손가락 Phase 1 — 가입 조건
      joinType: data.joinType || 'open',
      minLevel: data.minLevel || 1,
      ...(data.password ? { password: data.password } : {}),
      ...(data.joinQuestion ? { joinQuestion: data.joinQuestion } : {}),
      // 🚀 Phase 6 — 가입 폼 (승인제일 때만 저장)
      ...(data.joinForm ? { joinForm: data.joinForm } : {}),
    });
    // 개설자를 community_memberships에 엄지(thumb)로 등록
    const membershipId = `${communityId}_${userData.uid}`;
    await setDoc(doc(db, 'community_memberships', membershipId), {
      communityId,
      communityName: data.name,
      userId: userData.uid,
      nickname: userData.nickname,
      role: 'owner',
      finger: 'thumb',       // 🚀 다섯 손가락: 개설자 = 엄지
      joinStatus: 'active',  // 🚀 가입 상태: 활성
      joinedAt: serverTimestamp(),
    });
    setIsCreateCommunityOpen(false);
    setGloveSubTab('feed');
  };

  // 🚀 커뮤니티 가입 핸들러 — joinType에 따라 즉시가입/대기 분기
  const handleJoinCommunity = async (community: Community) => {
    if (!userData) { alert('로그인이 필요합니다.'); return; }

    // 🚀 강퇴(banned) 유저 재가입 차단
    // Why: 관리자가 강퇴한 유저가 재가입하면 강퇴 제재가 무력화됨
    const banCheckId = `${community.id}_${userData.uid}`;
    const existingSnap = await getDoc(doc(db, 'community_memberships', banCheckId));
    if (existingSnap.exists() && existingSnap.data()?.joinStatus === 'banned') {
      alert('이 커뮤니티에서 강퇴된 계정으로는 재가입할 수 없습니다.');
      return;
    }

    // 최소 레벨 체크
    const minLevel = community.minLevel || 1;
    if ((userData.level || 1) < minLevel) {
      alert(`이 장갑은 Lv${minLevel} 이상만 가입할 수 있습니다. (현재 Lv${userData.level || 1})`);
      return;
    }

    const joinType = community.joinType || 'open';

    // 초대 코드 방식: 비밀번호 입력 확인
    if (joinType === 'password') {
      const input = window.prompt('초대 코드를 입력해주세요:');
      if (!input) return;
      if (input.trim() !== (community.password || '').trim()) {
        alert('초대 코드가 올바르지 않습니다.');
        return;
      }
    }

    // 승인제 방식: 가입 신청 메시지 입력
    let joinMessage = '';
    if (joinType === 'approval') {
      const question = community.joinQuestion || '가입 인사말을 남겨주세요.';
      const input = window.prompt(question);
      if (!input) return;
      joinMessage = input.trim();
    }

    const isApprovalPending = joinType === 'approval';
    const membershipId = `${community.id}_${userData.uid}`;
    await setDoc(doc(db, 'community_memberships', membershipId), {
      communityId: community.id,
      communityName: community.name,
      userId: userData.uid,
      nickname: userData.nickname,
      role: 'member',
      finger: isApprovalPending ? 'pinky' : 'ring',   // 🚀 대기=새끼, 승인=약지
      joinStatus: isApprovalPending ? 'pending' : 'active',
      ...(joinMessage ? { joinMessage } : {}),
      joinedAt: serverTimestamp(),
    });

    if (!isApprovalPending) {
      // 즉시 가입(open/password): memberCount 증가 + 로컬 상태 반영
      await updateDoc(doc(db, 'communities', community.id), { memberCount: increment(1) });
      setJoinedCommunityIds(prev => [...prev, community.id]);
      alert(`'${community.name}' 장갑에 가입되었습니다!`);
    } else {
      // 승인제: memberCount 증가 없음, 대기 안내
      alert(`가입 신청이 완료되었습니다.\n관리자 승인 후 활동할 수 있습니다.`);
    }
  };

  // 🚀 커뮤니티 탈퇴 핸들러 — membership 문서 삭제 + memberCount decrement + 로컬 상태 즉시 반영
  const handleLeaveCommunity = async (community: Community) => {
    if (!userData) return;
    if (!window.confirm(`'${community.name}'에서 탈퇴하시겠소?`)) return;
    const membershipId = `${community.id}_${userData.uid}`;
    await deleteDoc(doc(db, 'community_memberships', membershipId));
    await updateDoc(doc(db, 'communities', community.id), { memberCount: increment(-1) });
    setJoinedCommunityIds(prev => prev.filter(id => id !== community.id));
  };

  return { handleCreateRoom, handleCreateCommunity, handleJoinCommunity, handleLeaveCommunity };
}
