// src/hooks/useFirebaseListeners.ts — Firestore 실시간 리스너 및 인증 상태 관리 훅
import { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import type { Post, KanbuRoom } from '../types';

export function useFirebaseListeners() {
  const [allRootPosts, setAllRootPosts] = useState<Post[]>([]);
  const [userData, setUserData] = useState<any | null>(null);
  const [allUsers, setAllUsers] = useState<Record<string, any>>({});
  const [followerCounts, setFollowerCounts] = useState<Record<string, number>>({});
  const [friends, setFriends] = useState<string[]>([]);
  const [blocks, setBlocks] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [kanbuRooms, setKanbuRooms] = useState<KanbuRoom[]>([]);

  useEffect(() => {
    let unsubUsers: (() => void) | null = null;
    let unsubUserDoc: (() => void) | null = null;

    // 🚀 공개 컬렉션 구독 — 비로그인도 읽기 가능 (Firestore rules: allow read: if true)
    // posts, kanbu_rooms은 인증 없이 바로 구독 시작 → 비로그인 사용자도 글 목록 열람 가능
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
            const users: Record<string, any> = {};
            const fCounts: Record<string, number> = {};
            snapshot.docs.forEach(docSnap => {
              const data = docSnap.data();
              const userObj = { ...data, uid: docSnap.id };
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

        if (unsubUserDoc) unsubUserDoc();
        unsubUserDoc = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setUserData({ ...data, uid: user.uid });
            setFriends(data.friendList || []);
            setBlocks(data.blockList || []);
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
            setUserData({ ...initialData, uid: user.uid });
          }
          setIsLoading(false);
        });
      } else {
        // 비로그인: users 구독 불필요, userData만 초기화
        if (unsubUsers) { unsubUsers(); unsubUsers = null; }
        if (unsubUserDoc) { unsubUserDoc(); unsubUserDoc = null; }
        setUserData(null);
        setIsLoading(false);
      }
    });

    return () => {
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
  };
}
