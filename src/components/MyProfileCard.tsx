// src/components/MyProfileCard.tsx — 마이페이지 프로필 카드 (아바타·닉네임·레벨·통계)
import React, { useState, useRef, useEffect } from 'react';
import ProfileEditForm from './ProfileEditForm';
import { db } from '../firebase'; // storage 임포트 제거
import { uploadToR2 } from '../uploadToR2';
import { doc, updateDoc } from 'firebase/firestore';

interface UserData {
  level: number;
  likes: number;
  bio: string;
  nickname: string;
  email: string;
  isPhoneVerified: boolean;
  avatarUrl: string;
}

interface Props {
  userData: UserData;
  uid: string;
  friendCount: number;
}

const MyProfileCard = ({ userData, uid, friendCount }: Props) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const isUploadingRef = useRef(false);
  const [editData, setEditData] = useState({
    nickname: userData.nickname,
    bio: userData.bio,
    avatarUrl: userData.avatarUrl
  });

  const calculatedLevel = Math.max(1, Math.min(friendCount, 10));

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // 🚀 Cloudflare R2 이미지 업로드 핸들러
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("이미지가 너무 큽니다. 2MB 이하만 업로드할 수 있어요.");
      return;
    }

    setIsUploading(true);
    isUploadingRef.current = true;

    timerRef.current = setTimeout(() => {
      if (isUploadingRef.current) {
        setIsUploading(false);
        isUploadingRef.current = false;
        alert("업로드 시간이 초과됐습니다. Cloudflare R2 CORS 설정 문제일 수 있어요.");
      }
    }, 30000);

    try {
      const fileName = `avatars/${userData.nickname}_${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
      const url = await uploadToR2(file, fileName);
      setEditData(prev => ({ ...prev, avatarUrl: url }));

      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    } catch (error: unknown) {
      console.error("R2 업로드 실패:", error);
      alert(`사진 전송에 실패했소: ${(error as Error).message || "원인 불명"}`);
    } finally {
      setIsUploading(false);
      isUploadingRef.current = false;
    }
  };

  const handleUpdate = async () => {
    try {
      // 🔒 보안: 현재 로그인 사용자의 UID로 본인 문서만 수정
      await updateDoc(doc(db, "users", uid), {
        nickname: editData.nickname,
        bio: editData.bio,
        avatarUrl: editData.avatarUrl,
        level: calculatedLevel
      });
      setIsEditing(false);
    } catch (e) { 
      console.error("프로필 수정 실패:", e);
      alert("서버에 저장되지 않았습니다.");
    }
  };

  return (
    <section className="bg-white border-[3px] border-slate-900 rounded-[2.5rem] p-6 md:p-8 shadow-[10px_10px_0px_0px_rgba(15,23,42,1)] mb-10">
      <div className="flex flex-col md:flex-row gap-8 items-center md:items-start">
        <div className="relative group">
          <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-slate-100 border-[3px] border-slate-900 overflow-hidden shadow-inner flex items-center justify-center relative">
            <img 
              src={editData.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${userData.nickname}`} 
              alt="avatar" 
              className={`w-full h-full object-cover transition-opacity ${isUploading ? 'opacity-30' : 'opacity-100'}`}
            />
            {isUploading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
          </div>
          <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-white w-10 h-10 rounded-full border-[3px] border-slate-900 flex items-center justify-center font-black text-sm shadow-md">
            Lv.{calculatedLevel}
          </div>
        </div>

        <div className="flex-1 text-center md:text-left space-y-3 w-full">
          {isEditing ? (
            <ProfileEditForm
              editData={editData}
              setEditData={setEditData}
              originalData={{ nickname: userData.nickname, bio: userData.bio, avatarUrl: userData.avatarUrl }}
              isUploading={isUploading}
              handleImageUpload={handleImageUpload}
              handleUpdate={handleUpdate}
              onCancel={() => setIsEditing(false)}
            />
          ) : (
            <>
              <div className="flex flex-col md:flex-row items-center gap-3">
                <h2 className="text-3xl font-[1000] text-slate-900 tracking-tight">{userData.nickname}</h2>
                <div className="flex gap-2">
                  <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-[10px] font-black border border-blue-100 tracking-tighter">✅ 핸드폰 인증됨</span>
                  <span className="bg-slate-50 text-slate-500 px-3 py-1 rounded-full text-[10px] font-black border border-slate-100 tracking-tighter shadow-sm">📧 {userData.email}</span>
                </div>
              </div>
              <p className="text-slate-500 text-sm font-medium leading-relaxed max-w-md italic">"{userData.bio}"</p>
              <div className="flex justify-center md:justify-start gap-4 pt-2">
                <div className="text-center bg-slate-50 px-5 py-2.5 rounded-2xl border border-slate-100 shadow-sm min-w-[80px]">
                  <span className="block text-[10px] text-slate-400 font-black uppercase tracking-widest mb-0.5">평판</span>
                  <span className="text-xl font-[1000] text-blue-600">중립</span>
                </div>
                <div className="text-center bg-slate-50 px-5 py-2.5 rounded-2xl border border-slate-100 shadow-sm min-w-[80px]">
                  <span className="block text-[10px] text-slate-400 font-black uppercase tracking-widest mb-0.5">깐부</span>
                  <span className="text-xl font-[1000] text-slate-900">{friendCount}</span>
                </div>
                <div className="text-center bg-slate-50 px-5 py-2.5 rounded-2xl border border-slate-100 shadow-sm min-w-[80px]">
                  <span className="block text-[10px] text-slate-400 font-black uppercase tracking-widest mb-0.5">좋아요</span>
                  <span className="text-xl font-[1000] text-slate-900">{userData.likes.toLocaleString()}</span>
                </div>
                <button 
                  onClick={() => {
                    setEditData({ nickname: userData.nickname, bio: userData.bio, avatarUrl: userData.avatarUrl });
                    setIsEditing(true);
                  }} 
                  className="ml-auto self-end p-2 text-slate-400 hover:text-slate-900 transition-colors text-xs font-black underline underline-offset-4 decoration-2 decoration-emerald-300"
                >⚙️ 프로필 수정</button>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
};

export default MyProfileCard;