// src/hooks/useGloveActions.ts — 커뮤니티(장갑) 관련 핸들러 (개설·가입·탈퇴·깐부방 생성)
import { db } from '../firebase';
import { doc, setDoc, updateDoc, increment, getDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import type { Dispatch, SetStateAction } from 'react';
import type { Community, KanbuRoom, UserData } from '../types';
import { calculateLevel } from '../utils';

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
      creatorLevel: calculateLevel(userData.exp || 0),
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
    if ((calculateLevel(userData.exp || 0)) < GLOVE_CREATE_MIN_LEVEL) {
      alert(`커뮤니티 개설은 Lv${GLOVE_CREATE_MIN_LEVEL} 이상만 가능합니다. (현재 Lv${calculateLevel(userData.exp || 0)})`);
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
      creatorLevel: calculateLevel(userData.exp || 0),
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
    // 🚀 로컬 상태 즉시 반영 — onSnapshot 도착 전에 리스트에 표시
    setJoinedCommunityIds(prev => [...prev, communityId]);
    setIsCreateCommunityOpen(false);
    setGloveSubTab('feed');
  };

  // 🚀 커뮤니티 가입 핸들러 — joinType에 따라 즉시가입/대기 분기
  // Phase 6: 승인제일 때 joinAnswers/joinMessage를 CommunityList → JoinCommunityModal에서 받아 전달
  const handleJoinCommunity = async (
    community: Community,
    options?: { joinAnswers?: import('../types').JoinAnswers; joinMessage?: string }
  ) => {
    if (!userData) { alert('로그인이 필요합니다.'); return; }

    // 🚀 강퇴(banned) 유저 재가입 차단
    const banCheckId = `${community.id}_${userData.uid}`;
    const existingSnap = await getDoc(doc(db, 'community_memberships', banCheckId));
    if (existingSnap.exists() && existingSnap.data()?.joinStatus === 'banned') {
      alert('이 커뮤니티에서 강퇴된 계정으로는 재가입할 수 없습니다.');
      return;
    }

    // 최소 레벨 체크
    const minLevel = community.minLevel || 1;
    if ((calculateLevel(userData.exp || 0)) < minLevel) {
      alert(`이 장갑은 Lv${minLevel} 이상만 가입할 수 있습니다. (현재 Lv${calculateLevel(userData.exp || 0)})`);
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

    const isApprovalPending = joinType === 'approval';
    const membershipId = `${community.id}_${userData.uid}`;
    await setDoc(doc(db, 'community_memberships', membershipId), {
      communityId: community.id,
      communityName: community.name,
      userId: userData.uid,
      nickname: userData.nickname,
      role: 'member',
      finger: isApprovalPending ? 'pinky' : 'ring',
      joinStatus: isApprovalPending ? 'pending' : 'active',
      // 🚀 Phase 6 — 가입 폼 답변 저장 (영구 보존)
      ...(options?.joinAnswers ? { joinAnswers: options.joinAnswers } : {}),
      ...(options?.joinMessage?.trim() ? { joinMessage: options.joinMessage.trim() } : {}),
      joinedAt: serverTimestamp(),
    });

    if (!isApprovalPending) {
      await updateDoc(doc(db, 'communities', community.id), { memberCount: increment(1) });
      setJoinedCommunityIds(prev => [...prev, community.id]);
      alert(`'${community.name}' 장갑에 가입되었습니다!`);
    } else {
      // 🚀 Phase 8: 가입 신청 알림 → 개설자에게
      try {
        const { addDoc, collection: col } = await import('firebase/firestore');
        await addDoc(col(db, 'notifications', community.creatorId, 'items'), {
          type: 'community_join_request',
          message: `${userData.nickname}님이 [${community.name}]에 가입 신청했어요`,
          communityId: community.id,
          communityName: community.name,
          applicantNickname: userData.nickname,
          read: false,
          createdAt: serverTimestamp(),
        });
      } catch (e) { console.warn('[가입 신청 알림 실패]', e); }
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
