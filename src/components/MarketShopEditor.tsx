// src/components/MarketShopEditor.tsx — 강변 시장: 단골장부 상점 개설
import { useState } from 'react';
import { db } from '../firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { uploadToR2 } from '../uploadToR2';
import { calculateLevel } from '../utils';
import type { UserData } from '../types';

interface Props {
  currentUserData: UserData;
  onSuccess: (shopId: string) => void;
  onCancel: () => void;
}

const MarketShopEditor = ({ currentUserData, onSuccess, onCancel }: Props) => {
  const [shopName, setShopName] = useState('');
  const [shopDescription, setShopDescription] = useState('');
  const [subscriptionPrice, setSubscriptionPrice] = useState(30);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userLevel = calculateLevel(currentUserData.exp || 0);

  const handleSubmit = async () => {
    if (!shopName.trim()) { setError('상점 이름을 입력해주세요.'); return; }
    if (!shopDescription.trim()) { setError('상점 소개를 입력해주세요.'); return; }
    if (subscriptionPrice < 10 || subscriptionPrice > 200) { setError('가격은 10~200볼 사이로 설정해주세요.'); return; }
    if (userLevel < 5) { setError('Lv5 이상만 단골장부를 개설할 수 있습니다.'); return; }

    setSubmitting(true);
    setError(null);

    try {
      let coverImageUrl: string | undefined;
      if (coverFile) {
        const ext = coverFile.name.split('.').pop() || 'jpg';
        const filePath = `uploads/${currentUserData.uid}/market_shop_cover_${Date.now()}.${ext}`;
        const url = await uploadToR2(coverFile, filePath);
        if (url) coverImageUrl = url;
      }

      const shopId = `creator_${currentUserData.uid}`;

      await setDoc(doc(db, 'market_shops', shopId), {
        id: shopId,
        creatorId: currentUserData.uid,
        creatorNickname: currentUserData.nickname,
        creatorLevel: userLevel,
        shopName: shopName.trim(),
        shopDescription: shopDescription.trim(),
        coverImageUrl: coverImageUrl || null,
        subscriptionPrice,
        subscriberCount: 0,
        totalRevenue: 0,
        status: 'active',
        createdAt: serverTimestamp(),
      });

      onSuccess(shopId);
    } catch (err) {
      console.error('[MarketShopEditor] 개설 실패:', err);
      setError('상점 개설 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-[800px] mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6 pb-3 border-b border-slate-200">
        <button onClick={onCancel} className="text-[12px] text-slate-500 hover:text-slate-900 font-bold transition-colors">← 취소</button>
        <h1 className="text-[14px] font-[1000] text-slate-700">단골장부 개설</h1>
        <div className="w-12" />
      </div>

      <div className="space-y-5">
        {/* 상점 이름 */}
        <div>
          <label className="block text-[12px] font-[1000] text-slate-600 mb-1.5">상점 이름 <span className="text-red-500">*</span></label>
          <input type="text" value={shopName} onChange={(e) => setShopName(e.target.value)} maxLength={30}
            placeholder="예: 주식고수의 시장 분석실"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-slate-500" />
        </div>

        {/* 상점 소개 */}
        <div>
          <label className="block text-[12px] font-[1000] text-slate-600 mb-1.5">상점 소개 <span className="text-red-500">*</span></label>
          <textarea value={shopDescription} onChange={(e) => setShopDescription(e.target.value)} maxLength={200} rows={3}
            placeholder="어떤 콘텐츠를 제공하는 상점인지 소개해주세요"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-slate-500 resize-none" />
          <p className="text-[10px] text-slate-300 text-right mt-0.5">{shopDescription.length}/200</p>
        </div>

        {/* 구독 가격 */}
        <div>
          <label className="block text-[12px] font-[1000] text-slate-600 mb-1.5">30일 구독 가격 (땡스볼)</label>
          <div className="flex items-center gap-3">
            <input type="range" min={10} max={200} step={5} value={subscriptionPrice} onChange={(e) => setSubscriptionPrice(Number(e.target.value))}
              className="flex-1 accent-slate-700" />
            <span className="text-[14px] font-[1000] text-slate-800 w-20 text-right">{subscriptionPrice}볼/월</span>
          </div>
        </div>

        {/* 표지 이미지 */}
        <div>
          <label className="block text-[12px] font-[1000] text-slate-600 mb-1.5">상점 표지 (선택)</label>
          <input type="file" accept="image/*" className="hidden" id="shop-cover-input"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 5 * 1024 * 1024) { alert('5MB 이하만 업로드 가능합니다.'); return; }
              setCoverFile(file);
              setCoverPreview(URL.createObjectURL(file));
            }} />
          {coverPreview ? (
            <div className="relative w-2/3 aspect-[16/9] rounded-lg overflow-hidden border border-slate-200">
              <img src={coverPreview} alt="" className="w-full h-full object-cover" />
              <button type="button" onClick={() => { setCoverFile(null); setCoverPreview(null); }}
                className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/50 text-white rounded-full text-[13px] flex items-center justify-center hover:bg-black/70">×</button>
            </div>
          ) : (
            <label htmlFor="shop-cover-input"
              className="w-2/3 aspect-[16/9] border-2 border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center gap-1 hover:border-slate-400 transition-all cursor-pointer">
              <span className="text-[11px] font-bold text-slate-400">클릭하여 표지 선택</span>
              <span className="text-[9px] text-slate-300">5MB 이하</span>
            </label>
          )}
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-[12px] text-red-700 font-bold">{error}</div>
        )}

        <div className="flex gap-2 pt-3">
          <button type="button" onClick={onCancel}
            className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[12px] font-[1000] transition-colors">취소</button>
          <button type="button" onClick={handleSubmit} disabled={submitting}
            className="flex-1 px-4 py-2.5 bg-slate-900 hover:bg-slate-700 disabled:opacity-50 text-white rounded-lg text-[12px] font-[1000] transition-colors">
            {submitting ? '개설 중...' : '단골장부 개설'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MarketShopEditor;
