// src/components/KanbuPromoForm.tsx — 깐부 홍보 등록/수정 폼
import React, { useState } from 'react';
import { db, auth } from '../firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { uploadToR2 } from '../uploadToR2';

interface Props {
  currentPromo: {
    promoImageUrl?: string;
    promoKeywords?: string[];
    promoMessage?: string;
    promoEnabled?: boolean;
  };
  onClose: () => void;
}

const KanbuPromoForm = ({ currentPromo, onClose }: Props) => {
  const [imageUrl, setImageUrl] = useState(currentPromo.promoImageUrl || '');
  const [keywords, setKeywords] = useState<string[]>(
    currentPromo.promoKeywords?.length ? currentPromo.promoKeywords : ['', '', '']
  );
  const [message, setMessage] = useState(currentPromo.promoMessage || '');
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const uid = auth.currentUser?.uid;

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uid) return;
    if (file.size > 5 * 1024 * 1024) { alert('5MB 이하만 가능합니다.'); return; }
    setIsUploading(true);
    try {
      const fileName = `promo/${uid}/kanbu_${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
      const url = await uploadToR2(file, fileName);
      setImageUrl(url);
    } catch (err) {
      alert('업로드 실패: ' + ((err as Error).message || ''));
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    if (!uid) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'users', uid), {
        promoImageUrl: imageUrl,
        promoKeywords: keywords.filter(k => k.trim()),
        promoMessage: message.trim(),
        promoEnabled: true,
        promoUpdatedAt: serverTimestamp(),
      });
      onClose();
    } catch (err) {
      alert('저장 실패: ' + ((err as Error).message || ''));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisable = async () => {
    if (!uid) return;
    await updateDoc(doc(db, 'users', uid), { promoEnabled: false });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-[420px] shadow-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h3 className="text-[16px] font-[1000] text-slate-900 mb-4">🤝 깐부 홍보 등록</h3>

        {/* 메인 이미지 */}
        <div className="mb-4">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">메인 이미지/사진</label>
          {imageUrl ? (
            <div className="relative aspect-[16/9] rounded-xl overflow-hidden border border-slate-200 mb-2">
              <img src={imageUrl} alt="" className="w-full h-full object-cover" />
              <button onClick={() => setImageUrl('')} className="absolute top-2 right-2 bg-rose-500 text-white text-[9px] font-black px-2 py-0.5 rounded">삭제</button>
            </div>
          ) : null}
          <input type="file" accept="image/*,image/gif" onChange={handleImageUpload} disabled={isUploading}
            id="kanbu-promo-upload" className="hidden" />
          <label htmlFor="kanbu-promo-upload"
            className={`inline-flex items-center gap-1.5 px-4 py-2 bg-violet-50 border border-dashed border-violet-200 rounded-xl text-[12px] font-bold text-violet-600 cursor-pointer hover:bg-violet-100 transition-colors ${isUploading ? 'opacity-50 cursor-not-allowed animate-pulse' : ''}`}>
            {isUploading ? '업로드 중...' : '📸 이미지 파일 선택'}
          </label>
        </div>

        {/* 핵심 키워드 */}
        <div className="mb-4">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">핵심 키워드 (최대 3개)</label>
          <div className="flex gap-2">
            {[0, 1, 2].map(i => (
              <div key={i} className="flex items-center gap-0.5 flex-1">
                <span className="text-violet-400 font-bold text-[12px]">#</span>
                <input value={keywords[i] || ''} onChange={e => { const nk = [...keywords]; nk[i] = e.target.value.slice(0, 10); setKeywords(nk); }}
                  placeholder="키워드" maxLength={10}
                  className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-[12px] font-bold outline-none focus:border-violet-400" />
              </div>
            ))}
          </div>
        </div>

        {/* 깐부 공약 */}
        <div className="mb-4">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">깐부 공약 (100자)</label>
          <textarea value={message} onChange={e => setMessage(e.target.value.slice(0, 100))}
            placeholder="저와 깐부가 되면..."
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-[13px] font-medium outline-none focus:border-violet-400 resize-none h-20" />
          <span className="text-[10px] font-bold text-slate-300 float-right">{message.length}/100</span>
        </div>

        {/* 액션 */}
        <div className="flex gap-2 pt-2 clear-both">
          {currentPromo.promoEnabled && (
            <button onClick={handleDisable} className="px-3 py-2.5 rounded-xl text-[11px] font-bold text-rose-400 hover:text-rose-600 transition-colors">홍보 중지</button>
          )}
          <div className="flex-1" />
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-[12px] font-[1000] text-slate-400 bg-slate-50 hover:bg-slate-100">취소</button>
          <button onClick={handleSave} disabled={isSaving}
            className="px-5 py-2.5 rounded-xl text-[12px] font-[1000] text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-50">
            {isSaving ? '저장 중...' : '홍보 시작'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default KanbuPromoForm;
