// src/components/MyPromotion.tsx — 내 홍보: 나를 PR하는 이미지 6칸 (레벨별 해금)
import React, { useState, useRef } from 'react';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { uploadToR2 } from '../uploadToR2';
import type { UserData } from '../types';

// 🚀 6칸 슬롯별 해금 레벨 — AvatarCollection과 동일 기준
const SLOTS = [
  { index: 0, lockLevel: 1 },
  { index: 1, lockLevel: 2 },
  { index: 2, lockLevel: 4 },
  { index: 3, lockLevel: 6 },
  { index: 4, lockLevel: 8 },
  { index: 5, lockLevel: 10 },
];

interface Props {
  userData: UserData;
  currentLevel: number;
}

const MyPromotion = ({ userData, currentLevel }: Props) => {
  const promoImages: string[] = (userData as unknown as { promoImages?: string[] }).promoImages || [];
  const [uploading, setUploading] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [targetSlot, setTargetSlot] = useState<number>(0);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || uploading !== null) return;
    if (file.size > 5 * 1024 * 1024) { alert('5MB 이하 이미지만 가능합니다.'); return; }

    setUploading(targetSlot);
    try {
      const fileName = `promo/${userData.uid}/${targetSlot}_${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
      const url = await uploadToR2(file, fileName);

      // Firestore 업데이트: promoImages 배열의 해당 슬롯에 URL 저장
      const newImages = [...promoImages];
      while (newImages.length <= targetSlot) newImages.push('');
      newImages[targetSlot] = url;
      await updateDoc(doc(db, 'users', userData.uid), { promoImages: newImages });
    } catch (err) {
      alert('업로드에 실패했습니다: ' + ((err as Error).message || ''));
    } finally {
      setUploading(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleRemove = async (slotIndex: number) => {
    if (!window.confirm('이 이미지를 삭제하시겠습니까?')) return;
    const newImages = [...promoImages];
    newImages[slotIndex] = '';
    await updateDoc(doc(db, 'users', userData.uid), { promoImages: newImages });
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-4 -mt-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[12px] font-[1000] text-slate-600 uppercase tracking-widest">내 홍보</h3>
        <span className="text-[9px] font-bold text-slate-300">나를 PR하는 이미지</span>
      </div>
      <input type="file" accept="image/*" ref={fileRef} className="hidden" onChange={handleUpload} />
      {(() => {
        const topSlots = SLOTS.slice(0, 3);   // Lv1, Lv2, Lv4 — 항상 표시
        const bottomSlots = SLOTS.slice(3);    // Lv6, Lv8, Lv10 — 하나라도 해금 시 펼침
        const showBottom = bottomSlots.some(s => currentLevel >= s.lockLevel);

        const renderSlot = (slot: typeof SLOTS[0]) => {
          const isLocked = currentLevel < slot.lockLevel;
          const imageUrl = promoImages[slot.index] || '';
          const isUploading = uploading === slot.index;

          return (
            <div key={slot.index} className="relative aspect-[16/9] rounded-lg overflow-hidden border border-slate-100 bg-slate-50 group">
              {isLocked ? (
                /* 잠금 상태 */
                <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50/50">
                  <svg className="w-3 h-3 text-slate-300 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  <span className="text-[8px] font-black text-slate-400">Lv{slot.lockLevel}</span>
                </div>
              ) : imageUrl ? (
                /* 이미지 있음 */
                <div className="w-full h-full relative">
                  <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                  {isUploading && (
                    <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                      <div className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                  {/* hover 시 교체·삭제 버튼 */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                    <button
                      onClick={() => { setTargetSlot(slot.index); fileRef.current?.click(); }}
                      className="text-[8px] font-black text-white bg-white/20 px-1.5 py-0.5 rounded hover:bg-white/40 transition-colors"
                    >교체</button>
                    <button
                      onClick={() => handleRemove(slot.index)}
                      className="text-[8px] font-black text-white bg-rose-500/60 px-1.5 py-0.5 rounded hover:bg-rose-500 transition-colors"
                    >삭제</button>
                  </div>
                </div>
              ) : (
                /* 빈 슬롯 — 업로드 가능 */
                <button
                  onClick={() => { setTargetSlot(slot.index); fileRef.current?.click(); }}
                  className="w-full h-full flex flex-col items-center justify-center hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  {isUploading ? (
                    <div className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                      <span className="text-[7px] font-bold text-slate-300 mt-0.5">추가</span>
                    </>
                  )}
                </button>
              )}
            </div>
          );
        };

        return (
          <div className="flex flex-col gap-2">
            {/* 윗줄: 3칸 (항상 표시) */}
            <div className="grid grid-cols-3 gap-2">
              {topSlots.map(renderSlot)}
            </div>
            {/* 아랫줄: 3칸 (Lv6 이상 해금 시 펼침) */}
            {showBottom && (
              <div className="grid grid-cols-3 gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
                {bottomSlots.map(renderSlot)}
              </div>
            )}
            {!showBottom && (
              <p className="text-[9px] font-bold text-slate-300 text-center py-1">Lv6 달성시 아래 라인이 열립니다</p>
            )}
          </div>
        );
      })()}
    </div>
  );
};

export default MyPromotion;
