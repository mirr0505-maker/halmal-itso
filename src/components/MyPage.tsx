// src/components/MyPage.tsx
import React, { useState, useRef, useEffect } from 'react';
import { db } from '../firebase';
import { s3Client, BUCKET_NAME, PUBLIC_URL } from '../s3Client';
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { doc, updateDoc } from 'firebase/firestore';
import type { Post } from '../types';
import MyProfileCard from './MyProfileCard';
import MyContentTabs from './MyContentTabs';

interface Props {
  allUserChildPosts: Post[];
  allUserRootPosts: Post[];
  userData: any;
  friends: string[];
  friendCount: number;
  onPostClick: (post: Post) => void;
  onToggleFriend: (author: string) => void;
}

const MyPage = ({ allUserChildPosts = [], allUserRootPosts = [], userData, friends = [], friendCount = 0, onPostClick, onToggleFriend }: Props) => {
  const [editingCardId, setEditingCardId] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const isUploadingRef = useRef(false);
  const [cardInputs, setCardInputs] = useState({ title: "", desc: "", imageUrl: "" });

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!userData || !userData.nickname) return null;

  const myFormalPosts = allUserRootPosts || [];
  const myComments = (allUserChildPosts || []).filter(p => p.type === 'comment');

  const defaultCards = [
    { id: 1, title: "나의 한 마디", desc: "", imageUrl: "", color: "bg-blue-50" },
    { id: 2, title: "나의 신념", desc: "", imageUrl: "", color: "bg-slate-50" },
    { id: 3, title: "나의 비전", desc: "", imageUrl: "", color: "bg-slate-50" }
  ];

  const currentCards = userData.personalityCards || defaultCards;

  const personalityCards = currentCards.map((card: any) => ({
    ...card,
    isLocked: card.id !== 1
  }));

  // 🚀 Cloudflare R2 카드 전용 이미지 업로드 핸들러
  const handleCardImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
        alert("업로드 시간이 너무 길어 중단했소. [Cloudflare R2] CORS 설정을 확인해 보시오.");
      }
    }, 30000);

    try {
      const fileName = `personality_cards/${userData.nickname}_card_${editingCardId}_${Date.now()}`;
      
      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileName,
        Body: file,
        ContentType: file.type,
      });

      await s3Client.send(command);
      const url = `${PUBLIC_URL}/${fileName}`;
      
      setCardInputs(prev => ({ ...prev, imageUrl: url }));
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    } catch (error) {
      console.error("카드 이미지 R2 업로드 실패:", error);
      alert("사진 전송에 실패했소. [Cloudflare R2] 설정을 확인해 보시오.");
    } finally {
      setIsUploading(false);
      isUploadingRef.current = false;
    }
  };

  const handleSaveCard = async (id: number) => {
    const updatedCards = currentCards.map((c: any) => 
      c.id === id ? { ...c, desc: cardInputs.desc, imageUrl: cardInputs.imageUrl } : c
    );
    try {
      await updateDoc(doc(db, "users", "user_heukmooyoung"), { personalityCards: updatedCards });
      setEditingCardId(null);
    } catch (e) { console.error("카드 저장 실패:", e); }
  };

  const handleDeleteCard = async (id: number) => {
    if (!window.confirm("이 기록을 파기하겠소?")) return;
    const updatedCards = currentCards.map((c: any) => 
      c.id === id ? { ...c, desc: "", imageUrl: "" } : c
    );
    try {
      await updateDoc(doc(db, "users", "user_heukmooyoung"), { personalityCards: updatedCards });
    } catch (e) { console.error("카드 삭제 실패:", e); }
  };

  return (
    <div className="max-w-2xl mx-auto py-4 md:py-8 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full px-2 sm:px-0">
      <MyProfileCard userData={userData} friendCount={friendCount} />

      <section className="mb-10 px-2">
        <h3 className="text-lg font-[1000] text-slate-800 mb-4 flex items-center gap-2 italic">
          🎭 난 이런 사람
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {personalityCards.map((item: any) => (
            <div key={item.id} className={`${item.color} border-2 border-slate-100 rounded-[2rem] p-5 flex flex-col relative group transition-all ${item.isLocked ? 'opacity-60 bg-slate-50' : ''}`}>
              
              {item.isLocked ? (
                <div className="flex flex-col items-center justify-center py-6 text-center select-none">
                  <div className="w-16 h-16 rounded-full bg-slate-200/50 flex items-center justify-center text-2xl mb-3 shadow-inner">🔒</div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Coming Soon</span>
                  <span className="text-xs font-bold text-slate-400">추후 공개 예정</span>
                </div>
              ) : editingCardId === item.id ? (
                <div className="flex flex-col gap-2 animate-in zoom-in-95">
                  <div className="relative aspect-square rounded-2xl bg-white/60 border-2 border-dashed border-slate-200 mb-1 flex items-center justify-center overflow-hidden shadow-inner">
                    {cardInputs.imageUrl ? (
                      <img src={cardInputs.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-3xl opacity-20">📸</span>
                    )}
                    {isUploading && (
                      <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                        <div className="w-6 h-6 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    )}
                  </div>
                  
                  <input 
                    type="file" accept="image/*" id={`card-upload-${item.id}`} className="hidden" 
                    onChange={handleCardImageUpload} disabled={isUploading}
                  />
                  <label 
                    htmlFor={`card-upload-${item.id}`} 
                    className={`w-full py-2 bg-blue-50 border-2 border-dashed border-blue-200 rounded-xl text-[10px] font-black text-blue-600 text-center cursor-pointer hover:bg-blue-100 transition-all ${isUploading ? 'opacity-50 animate-pulse' : ''}`}
                  >
                    {isUploading ? "전송 중..." : "📸 사진 고르기"}
                  </label>

                  <textarea 
                    placeholder="이야기를 들려주소" 
                    className="w-full p-2 text-xs border-2 border-white rounded-xl outline-none focus:border-slate-900 bg-white/50 h-20 resize-none font-bold mt-1"
                    value={cardInputs.desc} onChange={e => setCardInputs({...cardInputs, desc: e.target.value})}
                  />
                  <div className="flex gap-1 mt-1">
                    <button onClick={() => handleSaveCard(item.id)} disabled={isUploading} className={`flex-1 py-1.5 bg-slate-900 text-white text-[10px] font-black rounded-lg shadow-sm ${isUploading ? 'opacity-50' : 'hover:bg-emerald-600'}`}>저장</button>
                    <button onClick={() => setEditingCardId(null)} className="flex-1 py-1.5 bg-white text-slate-400 text-[10px] font-black rounded-lg border border-slate-100">취소</button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center text-center cursor-pointer" onClick={() => {
                  setEditingCardId(item.id);
                  setCardInputs({ title: item.title, desc: item.desc, imageUrl: item.imageUrl });
                }}>
                  <div className="w-full aspect-square rounded-2xl bg-white/60 border-2 border-dashed border-slate-200 mb-3 flex items-center justify-center overflow-hidden relative shadow-inner">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <span className="opacity-20 group-hover:opacity-100 transition-opacity text-3xl">📸</span>
                    )}
                  </div>
                  <span className="text-sm font-[1000] text-slate-800 leading-tight px-1">
                    {item.desc || "첫 번째 이야기를 채워주소"}
                  </span>
                  
                  {item.desc && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDeleteCard(item.id); }}
                      className="absolute top-2 right-2 w-6 h-6 bg-white/80 text-rose-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm text-xs"
                    >✕</button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <MyContentTabs 
        myFormalPosts={myFormalPosts} 
        myComments={myComments} 
        friends={friends} 
        onPostClick={onPostClick} 
        onToggleFriend={onToggleFriend}
      />
      
      <p className="mt-10 text-center text-[10px] font-[1000] text-slate-300 uppercase tracking-[0.2em] italic">
        Strategy & Planning Archive Since 2026
      </p>
    </div>
  );
};

export default MyPage;