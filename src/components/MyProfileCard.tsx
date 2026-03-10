// src/components/MyProfileCard.tsx
import React, { useState, useRef, useEffect } from 'react';
import { db } from '../firebase'; // storage 임포트 제거
import { s3Client, BUCKET_NAME, PUBLIC_URL } from '../s3Client'; // R2 클라이언트 도입
import { PutObjectCommand } from "@aws-sdk/client-s3"; // S3 업로드 명령
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
  friendCount: number;
}

const MyProfileCard = ({ userData, friendCount }: Props) => {
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
      alert("이미지 크기가 너무 크오! 2MB 이하의 사진만 허용하오.");
      return;
    }

    setIsUploading(true);
    isUploadingRef.current = true;

    timerRef.current = setTimeout(() => {
      if (isUploadingRef.current) {
        setIsUploading(false);
        isUploadingRef.current = false;
        alert("업로드 시간이 너무 길어 중단했소. [Cloudflare R2]의 CORS 설정 문제일 수 있소!");
      }
    }, 30000);

    try {
      // 🚀 에러 해결: File을 Uint8Array로 변환 (브라우저 호환성 강화)
      const arrayBuffer = await file.arrayBuffer();
      const fileData = new Uint8Array(arrayBuffer);
      const fileName = `avatars/${userData.nickname}_${Date.now()}_${file.name.replace(/\s+/g, '_')}`;

      // 🚀 R2 전송 명령 생성 (PutObject)
      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileName,
        Body: fileData,
        ContentType: file.type, // 파일 타입 명시 (매우 중요)
      });

      // 🚀 실제로 R2에 전송
      await s3Client.send(command);

      // 🚀 R2 이미지 URL 생성 (Public URL 기준)
      const url = `${PUBLIC_URL}/${fileName}`;
      setEditData(prev => ({ ...prev, avatarUrl: url }));

      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    } catch (error: any) {
      console.error("R2 업로드 실패:", error);
      alert(`사진 전송에 실패했소: ${error.message || "원인 불명"}`);
    } finally {
      setIsUploading(false);
      isUploadingRef.current = false;
    }
  };

  const handleUpdate = async () => {
    try {
      await updateDoc(doc(db, "users", "user_heukmooyoung"), {
        nickname: editData.nickname,
        bio: editData.bio,
        avatarUrl: editData.avatarUrl,
        level: calculatedLevel
      });
      setIsEditing(false);
    } catch (e) { 
      console.error("프로필 수정 실패:", e);
      alert("사령부(DB)에 정보가 전달되지 않았소.");
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
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 w-full">
              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">닉네임</label>
                <input 
                  value={editData.nickname} 
                  onChange={e => setEditData({...editData, nickname: e.target.value})} 
                  className="w-full p-2.5 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold outline-none focus:border-slate-900 transition-all"
                />
              </div>

              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">프로필 사진 교체</label>
                <div className="flex gap-2">
                  <input 
                    type="file" accept="image/*" id="avatar-upload" className="hidden" 
                    onChange={handleImageUpload} disabled={isUploading}
                  />
                  <label 
                    htmlFor="avatar-upload" 
                    className={`flex-1 flex items-center justify-center p-2.5 bg-blue-50 border-2 border-dashed border-blue-200 rounded-xl text-xs font-black text-blue-600 cursor-pointer hover:bg-blue-100 transition-all ${isUploading ? 'opacity-50 cursor-not-allowed animate-pulse' : ''}`}
                  >
                    {isUploading ? "사진 전송 중..." : "📸 폴더에서 사진 고르기"}
                  </label>
                  <button 
                    onClick={() => setEditData({...editData, avatarUrl: ""})} 
                    className="px-4 bg-rose-50 text-rose-500 rounded-xl text-[10px] font-black border border-rose-100 hover:bg-rose-500 hover:text-white transition-all shadow-sm"
                  >삭제</button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">나의 철학</label>
                <textarea 
                  value={editData.bio} 
                  onChange={e => setEditData({...editData, bio: e.target.value})} 
                  className="w-full p-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm outline-none focus:border-slate-900 h-20 resize-none font-medium leading-relaxed" 
                  placeholder="당신의 철학을 적어주시오" 
                />
              </div>

              <div className="flex gap-2 justify-center md:justify-start pt-2">
                <button onClick={() => {
                  setEditData({ nickname: userData.nickname, bio: userData.bio, avatarUrl: userData.avatarUrl });
                  setIsEditing(false);
                }} className="px-5 py-2 bg-white border-2 border-slate-100 rounded-xl font-bold text-slate-400 text-sm hover:bg-slate-50 transition-all">취소</button>
                <button 
                  onClick={handleUpdate} 
                  disabled={isUploading}
                  className={`px-6 py-2 bg-slate-900 text-white rounded-xl font-bold text-sm shadow-md transition-all ${isUploading ? 'opacity-50' : 'hover:bg-emerald-600 active:scale-95'}`}
                >저장하기</button>
              </div>
            </div>
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