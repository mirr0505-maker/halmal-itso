// src/components/advertiser/AdvertiserCenter.tsx — 광고주 센터 메인 (탭 기반)
// 🚀 대시보드 · 내 광고 · 충전 · 설정 4탭
import { useState, useEffect } from 'react';
import { db, auth } from '../../firebase';
import { doc, onSnapshot, collection, query, where, orderBy } from 'firebase/firestore';
import type { AdvertiserAccount, Ad } from '../../types';
import { formatKoreanNumber } from '../../utils';
import AdCampaignList from './AdCampaignList';
import AdCampaignForm from './AdCampaignForm';

interface Props {
  onBack: () => void;
}

const AdvertiserCenter = ({ onBack }: Props) => {
  const [tab, setTab] = useState<'dashboard' | 'campaigns' | 'billing' | 'settings'>('dashboard');
  const [account, setAccount] = useState<AdvertiserAccount | null>(null);
  const [ads, setAds] = useState<Ad[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const uid = auth.currentUser?.uid;

  // 광고주 계정 실시간 구독
  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(doc(db, 'advertiserAccounts', uid), snap => {
      if (snap.exists()) setAccount({ id: snap.id, ...snap.data() } as AdvertiserAccount);
    });
    return () => unsub();
  }, [uid]);

  // 내 광고 목록 구독
  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db, 'ads'), where('advertiserId', '==', uid), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      setAds(snap.docs.map(d => ({ id: d.id, ...d.data() } as Ad)));
    });
    return () => unsub();
  }, [uid]);

  if (!account) return (
    <div className="py-20 text-center text-slate-300 font-bold">광고주 계정을 불러오는 중...</div>
  );

  if (showCreateForm) {
    return <AdCampaignForm advertiserId={uid!} advertiserName={account.businessName} onBack={() => setShowCreateForm(false)} />;
  }

  const totalImpressions = ads.reduce((s, a) => s + a.totalImpressions, 0);
  const totalClicks = ads.reduce((s, a) => s + a.totalClicks, 0);
  const avgCtr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : '0.00';

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6 animate-in fade-in">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-[11px] font-black text-slate-400 hover:text-slate-700 transition-colors">← 돌아가기</button>
          <h2 className="text-[18px] font-[1000] text-slate-900">📢 광고주 센터</h2>
          <span className="text-[10px] font-bold text-slate-400">{account.businessName}</span>
        </div>
        <button onClick={() => setShowCreateForm(true)}
          className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-[12px] font-[1000] rounded-xl transition-colors">
          + 새 광고
        </button>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 mb-6 border-b border-slate-100 pb-0">
        {(['dashboard', 'campaigns', 'billing', 'settings'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-[12px] font-[1000] rounded-t-lg border-b-2 -mb-px transition-colors ${tab === t ? 'text-violet-700 border-violet-500' : 'text-slate-400 border-transparent hover:text-slate-600'}`}>
            {t === 'dashboard' ? '대시보드' : t === 'campaigns' ? '내 광고' : t === 'billing' ? '충전/결제' : '설정'}
          </button>
        ))}
      </div>

      {/* 대시보드 */}
      {tab === 'dashboard' && (
        <div className="flex flex-col gap-4">
          {/* 요약 카드 */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            <div className="bg-violet-50 rounded-2xl p-4 border border-violet-100 text-center">
              <p className="text-[9px] font-black text-violet-400 uppercase">잔액</p>
              <p className="text-[16px] font-[1000] text-violet-700">₩{formatKoreanNumber(account.balance)}</p>
            </div>
            <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100 text-center">
              <p className="text-[9px] font-black text-blue-400 uppercase">오늘 소진</p>
              <p className="text-[16px] font-[1000] text-blue-600">₩0</p>
            </div>
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 text-center">
              <p className="text-[9px] font-black text-slate-400 uppercase">총 소진</p>
              <p className="text-[16px] font-[1000] text-slate-700">₩{formatKoreanNumber(account.totalSpent)}</p>
            </div>
            <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100 text-center">
              <p className="text-[9px] font-black text-emerald-400 uppercase">총 노출</p>
              <p className="text-[16px] font-[1000] text-emerald-600">{formatKoreanNumber(totalImpressions)}</p>
            </div>
            <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100 text-center">
              <p className="text-[9px] font-black text-amber-400 uppercase">총 클릭</p>
              <p className="text-[16px] font-[1000] text-amber-600">{formatKoreanNumber(totalClicks)}</p>
            </div>
            <div className="bg-rose-50 rounded-2xl p-4 border border-rose-100 text-center">
              <p className="text-[9px] font-black text-rose-400 uppercase">평균 CTR</p>
              <p className="text-[16px] font-[1000] text-rose-600">{avgCtr}%</p>
            </div>
          </div>

          {/* 내 광고 요약 */}
          <div className="bg-white rounded-2xl border border-slate-100 p-4">
            <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">내 광고 ({ads.length}개)</h3>
            {ads.length === 0 ? (
              <p className="text-center text-slate-300 font-bold text-[12px] py-6">첫 번째 광고를 등록해보세요!</p>
            ) : (
              <div className="flex flex-col gap-2">
                {ads.slice(0, 5).map(ad => (
                  <div key={ad.id} className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-[1000] text-slate-800 truncate">{ad.title}</p>
                      <p className="text-[9px] font-bold text-slate-400">{ad.headline}</p>
                    </div>
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-md ${
                      ad.status === 'active' ? 'text-emerald-600 bg-emerald-50 border border-emerald-200' :
                      ad.status === 'paused' ? 'text-amber-600 bg-amber-50 border border-amber-200' :
                      'text-slate-400 bg-slate-50 border border-slate-200'
                    }`}>
                      {ad.status === 'active' ? '활성' : ad.status === 'paused' ? '일시정지' : ad.status === 'pending_review' ? '검수중' : ad.status === 'draft' ? '임시저장' : ad.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 내 광고 */}
      {tab === 'campaigns' && <AdCampaignList ads={ads} onCreateNew={() => setShowCreateForm(true)} />}

      {/* 충전/결제 */}
      {tab === 'billing' && (
        <div className="bg-white rounded-2xl border border-slate-100 p-6 text-center">
          <p className="text-[14px] font-[1000] text-slate-800 mb-2">현재 잔액: ₩{formatKoreanNumber(account.balance)}</p>
          <p className="text-[12px] font-bold text-slate-400 mb-4">PG사 연동 후 충전 기능이 활성화됩니다.</p>
          <button disabled className="px-6 py-2.5 bg-slate-100 text-slate-300 rounded-xl text-[12px] font-[1000] cursor-not-allowed">
            잔액 충전 (준비 중)
          </button>
        </div>
      )}

      {/* 설정 */}
      {tab === 'settings' && (
        <div className="bg-white rounded-2xl border border-slate-100 p-6">
          <h3 className="text-[14px] font-[1000] text-slate-800 mb-4">사업자 정보</h3>
          <div className="grid grid-cols-2 gap-4 text-[12px]">
            <div><span className="font-bold text-slate-400">상호명:</span> <span className="font-[1000] text-slate-800">{account.businessName}</span></div>
            <div><span className="font-bold text-slate-400">대표자:</span> <span className="font-[1000] text-slate-800">{account.representativeName}</span></div>
            <div><span className="font-bold text-slate-400">사업자번호:</span> <span className="font-[1000] text-slate-800">{account.businessNumber || '미입력'}</span></div>
            <div><span className="font-bold text-slate-400">이메일:</span> <span className="font-[1000] text-slate-800">{account.email}</span></div>
            <div className="col-span-2"><span className="font-bold text-slate-400">주소:</span> <span className="font-[1000] text-slate-800">{account.businessAddress || '미입력'}</span></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvertiserCenter;
