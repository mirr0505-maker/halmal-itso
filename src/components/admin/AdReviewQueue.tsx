// src/components/admin/AdReviewQueue.tsx — 광고 검수 대기열 (관리자 전용)
import { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, doc, query, where, orderBy, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import type { Ad } from '../../types';
import { formatKoreanNumber } from '../../utils';

const AdReviewQueue = () => {
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'ads'), where('status', '==', 'pending_review'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setAds(snap.docs.map(d => ({ id: d.id, ...d.data() } as Ad)));
      setLoading(false);
    }, (err) => { console.error('[AdReviewQueue]', err); setLoading(false); });
    return () => unsub();
  }, []);

  const handleApprove = async (adId: string) => {
    if (!window.confirm('이 광고를 승인하시겠습니까?')) return;
    setAds(prev => prev.filter(a => a.id !== adId));
    await updateDoc(doc(db, 'ads', adId), { status: 'active', updatedAt: serverTimestamp() });
  };

  const handleReject = async (adId: string) => {
    const reason = prompt('거절 사유를 입력해주세요:');
    if (!reason?.trim()) return;
    setAds(prev => prev.filter(a => a.id !== adId));
    await updateDoc(doc(db, 'ads', adId), {
      status: 'rejected',
      rejectionReason: reason.trim(),
      updatedAt: serverTimestamp(),
    });
  };

  const formatDate = (ts: { seconds: number } | null | undefined) => {
    if (!ts) return '';
    return new Date(ts.seconds * 1000).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  if (loading) return <div className="py-20 text-center text-slate-300 font-bold">불러오는 중...</div>;
  if (ads.length === 0) return <div className="py-20 text-center text-slate-300 font-bold italic">검수 대기 중인 광고가 없어요</div>;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[11px] font-[1000] text-slate-400 uppercase tracking-widest">📋 검수 대기 {ads.length}건</p>
      {ads.map(ad => (
        <div key={ad.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-[10px] font-bold text-slate-400">광고주 {ad.advertiserName} · {ad.advertiserId.slice(0, 12)}...</p>
              <h3 className="text-[16px] font-[1000] text-slate-900 mt-1">{ad.title}</h3>
            </div>
            <span className="text-[10px] font-bold text-slate-300">{formatDate(ad.createdAt)}</span>
          </div>
          {ad.imageUrl && (
            <div className="mb-3 rounded-lg overflow-hidden border border-slate-100 max-w-[400px]">
              <img src={ad.imageUrl} alt="" className="w-full h-auto" />
            </div>
          )}
          <div className="bg-slate-50 rounded-lg p-3 mb-3 space-y-1">
            <p className="text-[13px] font-[1000] text-slate-800">{ad.headline}</p>
            <p className="text-[12px] font-medium text-slate-600">{ad.description}</p>
            <a href={ad.landingUrl} target="_blank" rel="noopener noreferrer"
              className="text-[11px] font-bold text-blue-500 hover:text-blue-700 underline break-all">🔗 {ad.landingUrl}</a>
            <p className="text-[11px] font-bold text-emerald-600">CTA: {ad.ctaText}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px] font-bold text-slate-500 mb-3">
            <p>📂 카테고리: {ad.targetCategories?.length ? ad.targetCategories.join(', ') : '전체'}</p>
            <p>📍 지역: {ad.targetRegions?.length ? ad.targetRegions.join(', ') : '전국'}</p>
            <p>📌 슬롯: {ad.targetSlots?.join(', ') || '-'}</p>
            <p>💰 입찰: {ad.bidType?.toUpperCase()} ₩{formatKoreanNumber(ad.bidAmount || 0)}</p>
            <p>📅 일예산: ₩{formatKoreanNumber(ad.dailyBudget || 0)}</p>
            <p>💼 총예산: ₩{formatKoreanNumber(ad.totalBudget || 0)}</p>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => handleReject(ad.id)}
              className="px-4 py-2 rounded-lg text-[12px] font-[1000] text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200">❌ 거절</button>
            <button onClick={() => handleApprove(ad.id)}
              className="px-4 py-2 rounded-lg text-[12px] font-[1000] text-white bg-emerald-600 hover:bg-emerald-700">✅ 승인</button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default AdReviewQueue;
