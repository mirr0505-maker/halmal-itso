// src/components/KanbuPromoForm.tsx — 깐부 홍보 등록/수정 폼
import React, { useState } from 'react';
import { db, auth } from '../firebase';
import { doc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
import { uploadToR2 } from '../uploadToR2';

// 🚀 홍보 기간별 땡스볼 비용
const PROMO_PLANS = [
  { label: '1일', days: 1, cost: 1 },
  { label: '1주일', days: 7, cost: 6 },
  { label: '1달', days: 30, cost: 25 },
] as const;

interface Props {
  currentPromo: {
    promoImageUrl?: string;
    promoKeywords?: string[];
    promoMessage?: string;
    promoEnabled?: boolean;
  };
  ballBalance: number;
  onClose: () => void;
}

const KanbuPromoForm = ({ currentPromo, ballBalance, onClose }: Props) => {
  const [imageUrl, setImageUrl] = useState(currentPromo.promoImageUrl || '');
  const [keywords, setKeywords] = useState<string[]>(
    currentPromo.promoKeywords?.length ? currentPromo.promoKeywords : ['', '', '']
  );
  const [message, setMessage] = useState(currentPromo.promoMessage || '');
  const [selectedPlan, setSelectedPlan] = useState(0); // PROMO_PLANS 인덱스
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const plan = PROMO_PLANS[selectedPlan];
  const canAfford = ballBalance >= plan.cost;

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
    if (!canAfford) { alert(`볼이 부족합니다. (필요: ${plan.cost}볼, 보유: ${ballBalance}볼)\n내정보에서 충전해주세요.`); return; }
    setIsSaving(true);
    try {
      // 🚀 만료일 계산 + 볼 차감
      const expireAt = new Date();
      expireAt.setDate(expireAt.getDate() + plan.days);

      await updateDoc(doc(db, 'users', uid), {
        promoImageUrl: imageUrl,
        promoKeywords: keywords.filter(k => k.trim()),
        promoMessage: message.trim(),
        promoEnabled: true,
        promoExpireAt: { seconds: Math.floor(expireAt.getTime() / 1000), nanoseconds: 0 },
        promoPlan: plan.label,
        promoUpdatedAt: serverTimestamp(),
        ballBalance: increment(-plan.cost),
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

        {/* 🚀 홍보 기간 선택 + 땡스볼 비용 */}
        <div className="mb-4 bg-violet-50 rounded-xl p-4 border border-violet-100">
          <div className="flex items-center justify-between mb-2">
            <label className="text-[10px] font-black text-violet-500 uppercase tracking-widest">홍보 기간</label>
            <span className={`text-[11px] font-[1000] ${canAfford ? 'text-amber-500' : 'text-rose-500'}`}>⚾ 보유 {ballBalance}볼</span>
          </div>
          <div className="flex gap-2 mb-2">
            {PROMO_PLANS.map((p, i) => (
              <button key={i} onClick={() => setSelectedPlan(i)}
                className={`flex-1 py-2 rounded-xl text-[11px] font-[1000] transition-all ${selectedPlan === i ? 'bg-violet-600 text-white' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}>
                {p.label} · {p.cost}볼
              </button>
            ))}
          </div>
          {!canAfford && (
            <p className="text-[10px] font-bold text-rose-500 bg-rose-50 border border-rose-200 rounded-lg px-3 py-1.5 text-center">
              볼이 부족합니다. 내정보에서 충전해주세요.
            </p>
          )}
        </div>

        {/* 액션 */}
        <div className="flex gap-2 pt-2 clear-both">
          {currentPromo.promoEnabled && (
            <button onClick={handleDisable} className="px-3 py-2.5 rounded-xl text-[11px] font-bold text-rose-400 hover:text-rose-600 transition-colors">홍보 중지</button>
          )}
          <div className="flex-1" />
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-[12px] font-[1000] text-slate-400 bg-slate-50 hover:bg-slate-100">취소</button>
          <button onClick={handleSave} disabled={isSaving || !canAfford}
            className={`px-5 py-2.5 rounded-xl text-[12px] font-[1000] transition-all disabled:opacity-50 ${canAfford ? 'text-white bg-violet-600 hover:bg-violet-700' : 'text-slate-300 bg-slate-100 cursor-not-allowed'}`}>
            {isSaving ? '저장 중...' : `홍보 시작 (${plan.cost}볼)`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default KanbuPromoForm;
