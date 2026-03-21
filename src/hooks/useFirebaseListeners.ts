// src/hooks/useFirebaseListeners.ts — Firestore 실시간 리스너 및 인증 상태 관리 훅
import { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import type { Post, KanbuRoom } from '../types';

export function useFirebaseListeners() {
  const [allRootPosts, setAllRootPosts] = useState<Post[]>([]);
  const [allChildPosts, setAllChildPosts] = useState<Post[]>([]);
  const [userData, setUserData] = useState<any | null>(null);
  const [allUsers, setAllUsers] = useState<Record<string, any>>({});
  const [followerCounts, setFollowerCounts] = useState<Record<string, number>>({});
  const [friends, setFriends] = useState<string[]>([]);
  const [blocks, setBlocks] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [kanbuRooms, setKanbuRooms] = useState<KanbuRoom[]>([]);

  useEffect(() => {
    // 깐부방 실시간 구독
    const unsubRooms = onSnapshot(collection(db, "kanbu_rooms"), (snapshot) => {
      const rooms = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as KanbuRoom));
      rooms.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setKanbuRooms(rooms);
    });

    // 게시글 전체 실시간 구독
    const unsubPosts = onSnapshot(collection(db, "posts"), (snapshot) => {
      const posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));
      posts.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setAllRootPosts(posts.filter(p => !p.parentId || p.parentId === "" || p.id === "root_post_01"));
      setAllChildPosts(posts.filter(p => p.parentId && p.parentId !== "" && p.id !== "root_post_01"));
    });

    // 유저 전체 실시간 구독 (닉네임 역색인 포함)
    const unsubUsers = onSnapshot(collection(db, "users"), (snapshot) => {
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
    });

    // 로그인 상태 변경 감지 + 내 유저 문서 실시간 구독
    let unsubUserDoc: (() => void) | null = null;
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
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
        if (unsubUserDoc) unsubUserDoc();
        unsubUserDoc = null;
        setUserData(null);
        setIsLoading(false);
      }
    });

    return () => {
      unsubRooms();
      unsubPosts();
      unsubUsers();
      unsubAuth();
      if (unsubUserDoc) unsubUserDoc();
    };
  }, []);

  return {
    allRootPosts, setAllRootPosts,
    allChildPosts,
    userData, setUserData,
    allUsers,
    followerCounts,
    friends, setFriends,
    blocks, setBlocks,
    isLoading,
    kanbuRooms,
  };
}
