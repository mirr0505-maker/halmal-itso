// src/components/advertiser/AdCampaignForm.tsx — 광고 등록/수정 폼
import { useState } from 'react';
import { db } from '../../firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { uploadToR2 } from '../../uploadToR2';
import { AD_CATEGORIES } from '../../constants';

interface Props {
  advertiserId: string;
  advertiserName: string;
  onBack: () => void;
}

const SLOT_OPTIONS: { value: 'top' | 'middle' | 'bottom'; label: string }[] = [
  { value: 'top', label: '상단' },
  { value: 'middle', label: '중단' },
  { value: 'bottom', label: '하단' },
];

const AdCampaignForm = ({ advertiserId, advertiserName, onBack }: Props) => {
  const [form, setForm] = useState({
    title: '', headline: '', description: '', ctaText: '자세히 보기',
    landingUrl: '', imageUrl: '',
    targetCategories: [] as string[],
    targetSlots: ['bottom'] as ('top' | 'middle' | 'bottom')[],
    targetCreatorId: '',            // 🏪 크리에이터 지면 타겟팅 (비워두면 전체)
    targetCreatorNickname: '',      // UI 표시용
    bidType: 'cpm' as 'cpm' | 'cpc',
    bidAmount: 1000, dailyBudget: 10000, totalBudget: 100000,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const update = (key: string, value: unknown) => setForm(prev => ({ ...prev, [key]: value }));

  const toggleCategory = (cat: string) => {
    setForm(prev => ({
      ...prev,
      targetCategories: prev.targetCategories.includes(cat)
        ? prev.targetCategories.filter(c => c !== cat)
        : [...prev.targetCategories, cat],
    }));
  };

  const toggleSlot = (slot: 'top' | 'middle' | 'bottom') => {
    setForm(prev => ({
      ...prev,
      targetSlots: prev.targetSlots.includes(slot)
        ? prev.targetSlots.filter(s => s !== slot)
        : [...prev.targetSlots, slot],
    }));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('5MB 이하만 가능합니다.'); return; }
    setIsUploading(true);
    try {
      const fileName = `ad-banners/${advertiserId}/${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
      const url = await uploadToR2(file, fileName);
      update('imageUrl', url);
    } catch (err) {
      alert('이미지 업로드 실패: ' + ((err as Error).message || ''));
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (status: 'draft' | 'pending_review') => {
    if (!form.title.trim() || !form.headline.trim() || !form.landingUrl.trim()) {
      alert('제목, 헤드라인, 랜딩 URL은 필수입니다.');
      return;
    }
    setIsSubmitting(true);
    try {
      const adId = `ad_${Date.now()}_${advertiserId}`;
      await setDoc(doc(db, 'ads', adId), {
        ...form,
        targetCreatorId: form.targetCreatorId || null,
        id: adId,
        advertiserId,
        advertiserName,
        targetRegions: [],
        status,
        totalImpressions: 0,
        totalClicks: 0,
        totalSpent: 0,
        ctr: 0,
        startDate: serverTimestamp(),
        endDate: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      onBack();
    } catch (err) {
      alert('등록 실패: ' + ((err as Error).message || ''));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-6 px-4 animate-in fade-in">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="text-[11px] font-black text-slate-400 hover:text-slate-700">← 돌아가기</button>
        <h2 className="text-[18px] font-[1000] text-slate-900">📢 새 광고 등록</h2>
      </div>

      <div className="flex flex-col gap-5 bg-white rounded-2xl border border-slate-100 p-6">
        {/* 소재 정보 */}
        <div className="flex flex-col gap-3">
          <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">소재 정보</h3>
          <input value={form.title} onChange={e => update('title', e.target.value)} placeholder="광고 제목 (관리용)" maxLength={50}
            className="border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] font-bold outline-none focus:border-violet-400" />
          <input value={form.headline} onChange={e => update('headline', e.target.value)} placeholder="헤드라인 (최대 30자, 유저에게 표시)" maxLength={30}
            className="border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] font-bold outline-none focus:border-violet-400" />
          <input value={form.description} onChange={e => update('description', e.target.value)} placeholder="설명 (최대 60자)" maxLength={60}
            className="border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] font-bold outline-none focus:border-violet-400" />
          <input value={form.ctaText} onChange={e => update('ctaText', e.target.value)} placeholder="CTA 버튼 텍스트" maxLength={10}
            className="border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] font-bold outline-none focus:border-violet-400" />
          <input value={form.landingUrl} onChange={e => update('landingUrl', e.target.value)} placeholder="랜딩 URL (https://...)"
            className="border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] font-bold outline-none focus:border-violet-400" />

          {/* 배너 이미지 */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">배너 이미지</label>
            {form.imageUrl ? (
              <div className="relative rounded-xl overflow-hidden border border-slate-200 mb-2">
                <img src={form.imageUrl} alt="" className="w-full h-auto max-h-[120px] object-cover" />
                <button onClick={() => update('imageUrl', '')} className="absolute top-2 right-2 bg-rose-500 text-white text-[9px] font-black px-2 py-0.5 rounded">삭제</button>
              </div>
            ) : null}
            <input type="file" accept="image/*" onChange={handleImageUpload} disabled={isUploading}
              className="text-[12px] text-slate-500" />
            {isUploading && <span className="text-[11px] font-bold text-violet-500 animate-pulse ml-2">업로드 중...</span>}
          </div>
        </div>

        {/* 타겟팅 */}
        <div className="flex flex-col gap-3">
          <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">타겟팅</h3>
          <div>
            <p className="text-[10px] font-bold text-slate-500 mb-2">카테고리 (미선택 시 전체)</p>
            <div className="flex flex-wrap gap-1.5">
              {AD_CATEGORIES.map(cat => (
                <button key={cat} onClick={() => toggleCategory(cat)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${form.targetCategories.includes(cat) ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                  {cat}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-500 mb-2">슬롯 위치</p>
            <div className="flex gap-2">
              {SLOT_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => toggleSlot(opt.value)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${form.targetSlots.includes(opt.value) ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 🏪 크리에이터 지면 타겟팅 */}
          <div>
            <p className="text-[10px] font-bold text-slate-500 mb-2">크리에이터 타겟팅 (선택)</p>
            <p className="text-[9px] font-bold text-slate-400 mb-1.5">특정 크리에이터의 콘텐츠에만 광고를 노출합니다. 비워두면 전체 노출.</p>
            <div className="flex gap-1.5">
              <input value={form.targetCreatorNickname} onChange={e => update('targetCreatorNickname', e.target.value)}
                placeholder="크리에이터 닉네임 (미입력 시 전체)"
                className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-[12px] font-bold outline-none focus:border-violet-400" />
              <button type="button"
                onClick={async () => {
                  const nickname = form.targetCreatorNickname.trim();
                  if (!nickname) { update('targetCreatorId', ''); return; }
                  // 닉네임으로 유저 조회
                  const { collection: col, query: q, where: w, getDocs } = await import('firebase/firestore');
                  const snap = await getDocs(q(col(db, 'users'), w('nickname', '==', nickname)));
                  if (snap.empty) { alert('해당 닉네임의 크리에이터를 찾을 수 없습니다.'); return; }
                  const uid = snap.docs[0].id;
                  update('targetCreatorId', uid);
                  alert(`크리에이터 확인: ${nickname} (${uid.slice(0, 8)}...)`);
                }}
                className="px-3 py-2 bg-violet-600 text-white rounded-xl text-[11px] font-bold hover:bg-violet-700">
                확인
              </button>
            </div>
            {form.targetCreatorId && (
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[10px] font-bold text-violet-600">타겟: {form.targetCreatorNickname}</span>
                <button onClick={() => { update('targetCreatorId', ''); update('targetCreatorNickname', ''); }}
                  className="text-[9px] font-bold text-slate-400 hover:text-rose-500">해제</button>
              </div>
            )}
          </div>
        </div>

        {/* 입찰 */}
        <div className="flex flex-col gap-3">
          <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">입찰 설정</h3>
          <div className="flex gap-3">
            <button onClick={() => update('bidType', 'cpm')}
              className={`flex-1 py-2 rounded-xl text-[12px] font-[1000] transition-all ${form.bidType === 'cpm' ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
              CPM (노출당)
            </button>
            <button onClick={() => update('bidType', 'cpc')}
              className={`flex-1 py-2 rounded-xl text-[12px] font-[1000] transition-all ${form.bidType === 'cpc' ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
              CPC (클릭당)
            </button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[9px] font-black text-slate-400 block mb-1">입찰가 (원)</label>
              <input type="number" value={form.bidAmount} onChange={e => update('bidAmount', Number(e.target.value))}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-[13px] font-bold outline-none focus:border-violet-400" />
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-400 block mb-1">일일 예산 (원)</label>
              <input type="number" value={form.dailyBudget} onChange={e => update('dailyBudget', Number(e.target.value))}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-[13px] font-bold outline-none focus:border-violet-400" />
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-400 block mb-1">총 예산 (원)</label>
              <input type="number" value={form.totalBudget} onChange={e => update('totalBudget', Number(e.target.value))}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-[13px] font-bold outline-none focus:border-violet-400" />
            </div>
          </div>
        </div>

        {/* 액션 */}
        <div className="flex gap-3 pt-2">
          <button onClick={() => handleSubmit('draft')} disabled={isSubmitting}
            className="flex-1 py-2.5 rounded-xl text-[12px] font-[1000] text-slate-500 bg-slate-50 hover:bg-slate-100 disabled:opacity-50 transition-colors">
            임시저장
          </button>
          <button onClick={() => handleSubmit('pending_review')} disabled={isSubmitting}
            className="flex-1 py-2.5 rounded-xl text-[12px] font-[1000] text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-50 transition-colors">
            {isSubmitting ? '등록 중...' : '검수 요청'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdCampaignForm;
