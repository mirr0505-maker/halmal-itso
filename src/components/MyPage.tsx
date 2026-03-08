// src/components/MyPage.tsx
import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { s3Client, BUCKET_NAME, PUBLIC_URL } from '../s3Client';
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { doc, updateDoc } from 'firebase/firestore';
import type { Post } from '../types';
import { calculateReputation, getReputationLabel } from '../utils';

import ProfileHeader from './ProfileHeader';
import ActivityStats from './ActivityStats';
import AvatarCollection from './AvatarCollection';
import ActivityMilestones from './ActivityMilestones';
import MyContentTabs from './MyContentTabs';

interface MyPageProps {
  allUserChildPosts: Post[];
  allUserRootPosts: Post[];
  userData: any;
  friends: string[];
  friendCount: number;
  onPostClick: (post: Post) => void;
  onToggleFriend: (author: string) => void;
  allUsers: Record<string, any>;
  followerCounts: Record<string, number>;
  toggleBlock: (author: string) => Promise<void>;
  blocks: string[];
}

const MyPage = ({ 
  allUserChildPosts = [], allUserRootPosts = [], userData, 
  friends = [], friendCount = 0, onPostClick, onToggleFriend,
  toggleBlock, blocks = []
}: MyPageProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    nickname: userData.nickname || "",
    bio: userData.bio || "",
    avatarUrl: userData.avatarUrl || ""
  });

  useEffect(() => {
    const syncReputation = async () => {
      if (!userData?.uid) return;
      const rootCount = allUserRootPosts.length;
      const formalCount = allUserChildPosts.filter(p => p.type === 'formal').length;
      const commentCount = allUserChildPosts.filter(p => p.type === 'comment').length;
      const totalLikesReceived = [...allUserRootPosts, ...allUserChildPosts]
        .reduce((acc, post) => acc + (post.likes || 0), 0);
      const realScore = calculateReputation(rootCount, formalCount, commentCount, totalLikesReceived);
      if (Math.abs(userData.likes - realScore) > 0) {
        try { await updateDoc(doc(db, "users", userData.uid), { likes: realScore }); } catch (e) { console.error(e); }
      }
    };
    if (allUserRootPosts.length > 0 || allUserChildPosts.length > 0) syncReputation();
  }, [userData?.uid, allUserRootPosts.length, allUserChildPosts.length, userData.likes]);

  if (!userData || !userData.nickname) return null;

  const handleLogout = async () => {
    if (window.confirm("정말 로그아웃 하시겠소?")) {
      try { await signOut(auth); window.location.href = '/'; } catch (e) { console.error(e); }
    }
  };

  const handleSaveProfile = async () => {
    if (!editData.nickname.trim()) { alert("닉네임을 입력해주시오!"); return; }
    try {
      await updateDoc(doc(db, "users", userData.uid), { nickname: editData.nickname, bio: editData.bio, avatarUrl: editData.avatarUrl });
      setIsEditing(false);
      alert("프로필이 변경되었소!");
    } catch (e) { console.error(e); alert("저장에 실패했소."); }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userData.uid) return;
    if (file.size > 2 * 1024 * 1024) { alert("2MB 이하만 가능하오."); return; }
    setIsUploading(true);
    try {
      const fileName = `avatars/${userData.uid}_${Date.now()}`;
      await s3Client.send(new PutObjectCommand({ Bucket: BUCKET_NAME, Key: fileName, Body: file, ContentType: file.type }));
      const newUrl = `${PUBLIC_URL}/${fileName}`;
      setEditData(prev => ({ ...prev, avatarUrl: newUrl }));
    } catch (error) { console.error(error); alert("이미지 업로드 실패했소."); }
    finally { setIsUploading(false); }
  };

  const reputationLabel = getReputationLabel(userData.likes);

  return (
    <div className="w-full max-w-[1000px] mx-auto py-6 px-4 animate-in fade-in duration-500 bg-[#F8FAFC]">
      <section className="bg-white rounded-2xl p-6 shadow-lg mb-8 relative overflow-hidden border border-slate-100/50">
        <ProfileHeader userData={userData} isEditing={isEditing} editData={editData} isUploading={isUploading} setEditData={setEditData} setIsEditing={setIsEditing} onAvatarUpload={handleAvatarUpload} onSave={handleSaveProfile} />
        {!isEditing && <ActivityStats userData={userData} friendCount={friendCount} reputationLabel={reputationLabel} />}
        {!isEditing && (
          <button onClick={handleLogout} className="absolute top-4 right-6 p-2 text-slate-300 hover:text-rose-500 transition-all z-20" title="로그아웃">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
          </button>
        )}
      </section>
      <AvatarCollection cards={[
        { id: 1, imageUrl: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=300&q=80" },
        { id: 2, imageUrl: "https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=300&q=80" },
        { id: 3, isLocked: true, lockLevel: 5 },
        { id: 4, isLocked: true, lockLevel: 5 },
        { id: 5, isLocked: true, lockLevel: 5 },
      ]} />
      <ActivityMilestones userData={userData} friendCount={friendCount} reputationLabel={reputationLabel} />
      <div className="border-t border-slate-100 pt-8">
        <h3 className="text-sm font-[1000] text-slate-900 tracking-tight mb-4 px-1">기록 관리</h3>
        <div className="bg-white rounded-2xl p-1 shadow-md border border-slate-50/50">
          <MyContentTabs 
            myFormalPosts={allUserRootPosts} 
            myComments={allUserChildPosts.filter(p => p.type === 'comment')} 
            friends={friends} 
            onPostClick={onPostClick} 
            onToggleFriend={onToggleFriend}
            blocks={blocks}
            toggleBlock={toggleBlock}
          />
        </div>
      </div>
    </div>
  );
};

export default MyPage;
