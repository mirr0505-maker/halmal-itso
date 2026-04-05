// src/hooks/useFirebaseListeners.ts — Firestore 실시간 리스너 및 인증 상태 관리 훅
import { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { onAuthStateChanged, getRedirectResult } from 'firebase/auth';
import { collection, onSnapshot, doc, setDoc, updateDoc, increment, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import type { Post, KanbuRoom, Community, UserData } from '../types';

export function useFirebaseListeners() {
  const [allRootPosts, setAllRootPosts] = useState<Post[]>([]);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [allUsers, setAllUsers] = useState<Record<string, UserData>>({});
  const [followerCounts, setFollowerCounts] = useState<Record<string, number>>({});
  const [friends, setFriends] = useState<string[]>([]);
  const [blocks, setBlocks] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [kanbuRooms, setKanbuRooms] = useState<KanbuRoom[]>([]);
  // 🚀 우리들의 따뜻한 장갑: 커뮤니티 상태
  const [communities, setCommunities] = useState<Community[]>([]);
  const [joinedCommunityIds, setJoinedCommunityIds] = useState<string[]>([]);

  useEffect(() => {
    let unsubUsers: (() => void) | null = null;
    let unsubUserDoc: (() => void) | null = null;

    // 🚀 iOS Safari signInWithRedirect 결과 처리
    // Why: redirect 복귀 시 onAuthStateChanged보다 먼저 결과를 확인해야 iOS에서 로그인 누락 방지
    getRedirectResult(auth).catch(err => {
      // auth/popup-closed-by-user 등은 정상 케이스 — 무시
      if ((err as { code?: string })?.code !== 'auth/popup-closed-by-user') {
        console.warn('[getRedirectResult]', err);
      }
    });

    // 🚀 공개 컬렉션 구독 — 비로그인도 읽기 가능 (Firestore rules: allow read: if true)
    // posts, kanbu_rooms, communities는 인증 없이 바로 구독 시작
    const unsubCommunities = onSnapshot(collection(db, 'communities'), (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Community));
      list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setCommunities(list);
    }, (err) => console.error('[communities onSnapshot]', err));

    const unsubRooms = onSnapshot(collection(db, "kanbu_rooms"), (snapshot) => {
      const rooms = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as KanbuRoom));
      rooms.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setKanbuRooms(rooms);
    }, (err) => console.error('[kanbu_rooms onSnapshot]', err));

    const unsubPosts = onSnapshot(collection(db, "posts"), (snapshot) => {
      const posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));
      posts.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setAllRootPosts(posts);
    }, (err) => console.error('[posts onSnapshot]', err));

    // 🚀 인증 전용 구독 — users 컬렉션은 로그인 사용자만 읽기 가능 (개인정보 보호)
    // 로그인 시: users 전체 + 내 유저 문서 구독 시작
    // 로그아웃 시: 구독 해제, userData 초기화
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        // users 컬렉션 — 닉네임·레벨·평판 표시에 필요, 인증 후에만 구독
        if (!unsubUsers) {
          unsubUsers = onSnapshot(collection(db, "users"), (snapshot) => {
            const users: Record<string, UserData> = {};
            const fCounts: Record<string, number> = {};
            snapshot.docs.forEach(docSnap => {
              const data = docSnap.data();
              const userObj = { ...data, uid: docSnap.id } as UserData;
              users[docSnap.id] = userObj;
              if (data.nickname) users[`nickname_${data.nickname}`] = userObj;
              if (data.friendList) {
                data.friendList.forEach((nickname: string) => {
                  fCounts[nickname] = (fCounts[nickname] || 0) + 1;
                });
              }
            });
            setAllUsers(users);
            setFollowerCounts(fCounts);
          }, (err) => console.error('[users onSnapshot]', err));
        }

        // 🚀 내가 가입한 커뮤니티 ID 목록 — 로그인 시 1회 로드 (실시간 구독 불필요)
        // communities/{id}/members/{uid} 서브컬렉션은 collectionGroup 쿼리로 통합 조회
        getDocs(query(collection(db, 'community_memberships'), where('userId', '==', user.uid)))
          .then(snap => setJoinedCommunityIds(snap.docs.map(d => d.data().communityId as string)))
          .catch(() => {});

        if (unsubUserDoc) unsubUserDoc();
        unsubUserDoc = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setUserData({ ...data, uid: user.uid } as UserData);
            setFriends(data.friendList || []);
            setBlocks(data.blockList || []);
            // 🚀 EXP 마이그레이션: 기존 유저의 likes 기반 활동량을 exp 초기값으로 반영 (1회만)
            // Why: likes→exp 전환 후 기존 유저의 exp가 0이면 레벨이 Lv1로 리셋됨
            if (!data.exp && (data.likes || 0) > 0) {
              updateDoc(doc(db, 'users', user.uid), { exp: data.likes }).catch(() => {});
            }
            // 🚀 출석 EXP: 1일 1회 +5 — lastLoginDate와 오늘 비교
            const today = new Date().toISOString().slice(0, 10);
            if (data.lastLoginDate !== today) {
              updateDoc(doc(db, 'users', user.uid), { exp: increment(5), lastLoginDate: today }).catch(() => {});
            }
          } else {
            const initialData = {
              nickname: user.displayName || "익명",
              email: user.email || "", bio: "안녕하세요.",
              level: 1, exp: 0, likes: 0, points: 0,
              subscriberCount: 0, isPhoneVerified: false,
              friendList: [], blockList: [], avatarUrl: user.photoURL || "",
              createdAt: serverTimestamp()
            };
            setDoc(doc(db, "users", user.uid), initialData);
            setUserData({ ...initialData, uid: user.uid } as unknown as UserData);
          }
          setIsLoading(false);
        });
      } else {
        // 비로그인: users 구독 불필요, userData만 초기화
        if (unsubUsers) { unsubUsers(); unsubUsers = null; }
        if (unsubUserDoc) { unsubUserDoc(); unsubUserDoc = null; }
        setUserData(null);
        setJoinedCommunityIds([]);
        setIsLoading(false);
      }
    });

    return () => {
      unsubCommunities();
      unsubRooms();
      unsubPosts();
      if (unsubUsers) unsubUsers();
      if (unsubUserDoc) unsubUserDoc();
      unsubAuth();
    };
  }, []);

  return {
    allRootPosts, setAllRootPosts,
    userData, setUserData,
    allUsers,
    followerCounts,
    friends, setFriends,
    blocks, setBlocks,
    isLoading,
    kanbuRooms,
    communities,
    joinedCommunityIds,
    setJoinedCommunityIds,
  };
}
