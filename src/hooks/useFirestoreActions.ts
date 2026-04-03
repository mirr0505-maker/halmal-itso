// src/hooks/useFirestoreActions.ts — 게시글·댓글·좋아요·깐부·차단 Firestore 핸들러
import { db } from '../firebase';
import {
  doc, setDoc, updateDoc, increment,
  arrayUnion, arrayRemove, serverTimestamp,
} from 'firebase/firestore';
import type { Dispatch, SetStateAction, FormEvent } from 'react';
import type { Post, UserData } from '../types';
import type { MenuId } from '../components/Sidebar';

interface FirestoreActionDeps {
  userData: UserData | null;
  friends: string[];
  blocks: string[];
  allRootPosts: Post[];
  allChildPosts: Post[];
  selectedTopic: Post | null;
  // 게시글 폼 상태
  replyTarget: Post | null;
  setReplyTarget: Dispatch<SetStateAction<Post | null>>;
  newTitle: string;
  newContent: string;
  setNewTitle: Dispatch<SetStateAction<string>>;
  setNewContent: Dispatch<SetStateAction<string>>;
  selectedSide: 'left' | 'right';
  selectedType: 'comment' | 'formal';
  setIsSubmitting: Dispatch<SetStateAction<boolean>>;
  // 라우팅 상태
  setAllRootPosts: Dispatch<SetStateAction<Post[]>>;
  setSelectedTopic: Dispatch<SetStateAction<Post | null>>;
  setIsCreateOpen: Dispatch<SetStateAction<boolean>>;
  setEditingPost: Dispatch<SetStateAction<Post | null>>;
  setCreateMenuKey: Dispatch<SetStateAction<string | null>>;
  setActiveMenu: Dispatch<SetStateAction<MenuId>>;
  setActiveTab: Dispatch<SetStateAction<'any' | 'recent' | 'best' | 'rank' | 'friend'>>;
  setLinkedPostSide: Dispatch<SetStateAction<'left' | 'right' | null>>;
}

export function useFirestoreActions({
  userData, friends, blocks,
  allRootPosts, allChildPosts, selectedTopic,
  replyTarget, setReplyTarget,
  newTitle, newContent, setNewTitle, setNewContent,
  selectedSide, selectedType, setIsSubmitting,
  setAllRootPosts, setSelectedTopic,
  setIsCreateOpen, setEditingPost, setCreateMenuKey,
  setActiveMenu, setActiveTab, setLinkedPostSide,
}: FirestoreActionDeps) {

  // 게시글 제출/수정 — postId가 있으면 수정, 없으면 신규
  const handlePostSubmit = async (postData: Partial<Post>, postId?: string) => {
    if (!userData) return;
    try {
      if (postId) {
        await updateDoc(doc(db, 'posts', postId), postData);
        // onSnapshot 지연 대비: allRootPosts와 selectedTopic 즉시 갱신
        setAllRootPosts(prev => prev.map(p => p.id === postId ? { ...p, ...postData } : p));
        setSelectedTopic(prev => prev && prev.id === postId ? { ...prev, ...postData } : prev);
      } else {
        const customId = `topic_${Date.now()}_${userData.uid}`;
        const shareToken = customId.split('_').slice(0, 2).join('_'); // "topic_타임스탬프" — ogRenderer 조회용
        await setDoc(doc(db, 'posts', customId), {
          ...postData, author: userData.nickname, author_id: userData.uid,
          authorInfo: { level: userData.level, friendCount: friends.length, totalLikes: userData.likes },
          parentId: null, rootId: null, side: 'left', type: 'formal',
          createdAt: serverTimestamp(), likes: 0, dislikes: 0, shareToken,
        });
        await updateDoc(doc(db, 'users', userData.uid), { likes: increment(5) });
      }
      setIsCreateOpen(false);
      setEditingPost(null);
      setCreateMenuKey(null);
      setActiveMenu('home');
      setActiveTab('any'); // 🚀 글 작성 완료 후 새글 탭으로 이동
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e: unknown) {
      alert(`저장 실패: ${(e as Error)?.message || '알 수 없는 오류'}`);
    }
  };

  // 🚀 솔로몬의 재판 연계글 제출: 새 글 생성 후 현재 솔로몬 글로 돌아옴 (홈으로 이동 안 함)
  const handleLinkedPostSubmit = async (postData: Partial<Post>) => {
    if (!userData) return;
    try {
      const customId = `topic_${Date.now()}_${userData.uid}`;
      const shareToken = customId.split('_').slice(0, 2).join('_'); // "topic_타임스탬프" — ogRenderer 조회용
      await setDoc(doc(db, 'posts', customId), {
        ...postData, author: userData.nickname, author_id: userData.uid,
        authorInfo: { level: userData.level, friendCount: friends.length, totalLikes: userData.likes },
        parentId: null, rootId: null, side: 'left', type: 'formal',
        createdAt: serverTimestamp(), likes: 0, dislikes: 0, shareToken,
      });
      await updateDoc(doc(db, 'users', userData.uid), { likes: increment(5) });
      setIsCreateOpen(false);
      setLinkedPostSide(null);
      // selectedTopic 유지 → 솔로몬의 재판 원글로 돌아감
    } catch (e: unknown) {
      alert(`연계글 저장 실패: ${(e as Error)?.message || '알 수 없는 오류'}`);
    }
  };

  // 인라인 댓글 등록 (DiscussionView / OneCutDetailView 에서 호출)
  const handleInlineReply = async (
    content: string,
    parentPost: Post | null,
    side?: 'left' | 'right',
    imageUrl?: string,
    linkUrl?: string,
  ) => {
    if (!userData || !content.trim() || !selectedTopic) return;
    const customId = `comment_${Date.now()}_${userData.uid}`;
    try {
      await setDoc(doc(db, 'comments', customId), {
        author: userData.nickname, author_id: userData.uid,
        title: null, content,
        parentId: parentPost ? parentPost.id : selectedTopic.id,
        rootId: selectedTopic.id,
        side: side || 'left', type: 'comment',
        authorInfo: { level: userData.level, friendCount: friends.length, totalLikes: userData.likes },
        createdAt: serverTimestamp(), likes: 0, dislikes: 0,
        ...(imageUrl ? { imageUrl } : {}),
        ...(linkUrl ? { linkUrl } : {}),
      });
      await updateDoc(doc(db, 'posts', selectedTopic.id), { commentCount: increment(1) });
      await updateDoc(doc(db, 'users', userData.uid), { likes: increment(1) });
    } catch (e: unknown) {
      console.error('[handleInlineReply]', e);
      alert('댓글 등록에 실패했습니다: ' + (e as Error).message);
      throw e;
    }
  };

  // 폼 기반 댓글 제출 (DiscussionView 하단 댓글 폼)
  const handleCommentSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!userData || !newContent.trim() || !selectedTopic) return;
    setIsSubmitting(true);
    const customId = `comment_${Date.now()}_${userData.uid}`;
    try {
      await setDoc(doc(db, 'comments', customId), {
        author: userData.nickname, author_id: userData.uid,
        title: selectedType === 'formal' ? newTitle : null,
        content: newContent,
        parentId: replyTarget ? replyTarget.id : selectedTopic.id,
        rootId: selectedTopic.id,
        side: selectedSide, type: selectedType,
        authorInfo: { level: userData.level, friendCount: friends.length, totalLikes: userData.likes },
        createdAt: serverTimestamp(), likes: 0, dislikes: 0,
      });
      await updateDoc(doc(db, 'posts', selectedTopic.id), { commentCount: increment(1) });
      await updateDoc(doc(db, 'users', userData.uid), { likes: increment(selectedType === 'formal' ? 2 : 1) });
      setNewTitle('');
      setNewContent('');
      setReplyTarget(null);
    } catch (e: unknown) {
      console.error('[handleCommentSubmit]', e);
      alert('댓글 등록에 실패했습니다: ' + (e as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 깐부(팔로우) 토글
  const toggleFriend = async (author: string) => {
    if (!userData) return;
    const isFriend = friends.includes(author);
    try {
      await updateDoc(doc(db, 'users', userData.uid), {
        friendList: isFriend ? arrayRemove(author) : arrayUnion(author),
      });
    } catch (e) { console.error(e); }
  };

  // 유저 차단 토글
  const toggleBlock = async (author: string) => {
    if (!userData) return;
    if (author === userData.nickname) { alert('본인은 차단할 수 없습니다!'); return; }
    const isBlocked = blocks.includes(author);
    if (!isBlocked && !window.confirm(`${author}님을 차단하시겠소? 모든 게시글이 숨겨집니다.`)) return;
    try {
      await updateDoc(doc(db, 'users', userData.uid), {
        blockList: isBlocked ? arrayRemove(author) : arrayUnion(author),
      });
    } catch (e) { console.error(e); }
  };

  // 게시글/댓글 좋아요 토글 — col(posts|comments) 자동 판별
  const handleLike = async (e: React.MouseEvent | null, postId: string) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (!userData) { alert('로그인이 필요합니다!'); return; }
    try {
      const targetPost = [...allRootPosts, ...allChildPosts].find(p => p.id === postId);
      if (!targetPost) return;
      const isLiked = targetPost.likedBy?.includes(userData.nickname);
      const diff = isLiked ? -1 : 1;
      const col = targetPost.rootId ? 'comments' : 'posts';
      await updateDoc(doc(db, col, postId), {
        likes: Math.max(0, (targetPost.likes || 0) + diff),
        likedBy: isLiked ? arrayRemove(userData.nickname) : arrayUnion(userData.nickname),
      });
      if (targetPost.author_id) {
        await updateDoc(doc(db, 'users', targetPost.author_id), { likes: increment(diff * 3) });
      }
    } catch (e) { console.error(e); }
  };

  // 게시글 상세 열기 + 조회수 증가 (자기 글·세션 중복 방지)
  const handleViewPost = (post: Post) => {
    setSelectedTopic(post);
    if (!userData || userData.nickname === post.author) return;
    const sessionKey = `viewed_${post.id}`;
    if (sessionStorage.getItem(sessionKey)) return;
    sessionStorage.setItem(sessionKey, '1');
    updateDoc(doc(db, 'posts', post.id), { viewCount: increment(1) }).catch(() => {});
  };

  return {
    handlePostSubmit,
    handleLinkedPostSubmit,
    handleInlineReply,
    handleCommentSubmit,
    toggleFriend,
    toggleBlock,
    handleLike,
    handleViewPost,
  };
}
