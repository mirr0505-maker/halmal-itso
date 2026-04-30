// src/components/advertiser/AdvertiserCenter.tsx — 박씨 물고오는 제비(광고 경매 시장) 메인 (탭 기반)
// 🚀 대시보드 · 내 광고 · 충전 · 설정 4탭
import { useState, useEffect } from 'react';
import { db, auth } from '../../firebase';
import { doc, onSnapshot, collection, query, where, orderBy, updateDoc, serverTimestamp } from 'firebase/firestore';
import type { AdvertiserAccount, Ad } from '../../types';
import { formatKoreanNumber } from '../../utils';
import AdCampaignList from './AdCampaignList';
import AdCampaignForm from './AdCampaignForm';
// 🚀 ADSMARKET v3 (2026-04-30): 본문/피드 광고 분리 진입
import AdTypeSelector from './AdTypeSelector';

interface Props {
  onBack: () => void;
}

const AdvertiserCenter = ({ onBack }: Props) => {
  const [tab, setTab] = useState<'dashboard' | 'campaigns' | 'billing' | 'settings'>('dashboard');
  const [account, setAccount] = useState<AdvertiserAccount | null>(null);
  const [ads, setAds] = useState<Ad[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingAd, setEditingAd] = useState<Ad | null>(null);  // 🚀 2026-04-25: 수정 모드
  // 🚀 ADSMARKET v3 (2026-04-30): 광고 종류 선택 단계 — 'select' (종류 선택) | 'form' (실제 폼)
  //   신규 등록: select → form 순서, 편집: targetSlots로 자동 추론 후 form 직접
  const [creationStep, setCreationStep] = useState<'select' | 'form'>('select');
  const [adType, setAdType] = useState<'body' | 'feed'>('body');
  // 🚀 임시 땡스볼 충전 — 정식 PG 도입 전까지 운영 (testChargeBall CF 호출)
  const [ballBalance, setBallBalance] = useState(0);
  const [charging, setCharging] = useState(false);

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

  // 🚀 본인 ballBalance 실시간 구독 (광고주 충전/결제 탭에서 잔액 표시)
  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(doc(db, 'users', uid), snap => {
      if (snap.exists()) setBallBalance((snap.data().ballBalance as number) || 0);
    });
    return () => unsub();
  }, [uid]);

  const handleCharge = async (amount: number) => {
    if (!uid || charging) return;
    setCharging(true);
    try {
      const { httpsCallable } = await import('firebase/functions');
      const { functions } = await import('../../firebase');
      const chargeFn = httpsCallable(functions, 'testChargeBall');
      await chargeFn({ amount });
      alert(`✅ +${amount}볼 충전 완료`);
    } catch (err) {
      alert('충전 실패: ' + ((err as Error).message || '알 수 없는 오류'));
    } finally {
      setCharging(false);
    }
  };

  if (!account) return (
    <div className="py-20 text-center text-slate-300 font-bold">광고주 계정을 불러오는 중...</div>
  );

  // 🚀 v2.1 (2026-04-26): 검수 의무 — pending_review / rejected 상태는 광고 등록 잠금
  const isReviewBlocked = account.status === 'pending_review' || account.status === 'rejected';

  if (showCreateForm) {
    if (isReviewBlocked) {
      // 검수 미통과 상태에서 직접 URL이나 버튼 우회로 폼 진입한 경우 차단
      setShowCreateForm(false);
      setCreationStep('select');
      return null;
    }
    // 🚀 ADSMARKET v3 (2026-04-30): 신규 등록 시 종류 선택 단계 먼저
    //   편집 모드는 editingAd.targetSlots로 자동 추론 → form 직접 진입
    if (!editingAd && creationStep === 'select') {
      return <AdTypeSelector
        onSelect={(type) => { setAdType(type); setCreationStep('form'); }}
        onBack={() => { setShowCreateForm(false); setCreationStep('select'); }}
      />;
    }
    // 편집 모드: targetSlots에 'feed' 단독이면 피드 광고, 그 외는 본문 광고
    const inferredAdType: 'body' | 'feed' = editingAd
      ? (editingAd.targetSlots?.length === 1 && editingAd.targetSlots[0] === 'feed' ? 'feed' : 'body')
      : adType;
    return <AdCampaignForm
      advertiserId={uid!}
      advertiserName={account.businessName}
      editingAd={editingAd || undefined}
      adType={inferredAdType}
      onBack={() => { setShowCreateForm(false); setEditingAd(null); setCreationStep('select'); }}
    />;
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
          <h2 className="text-[18px] font-[1000] text-slate-900">📢 박씨 물고오는 제비</h2>
          <span className="text-[10px] font-bold text-slate-500">광고 경매 시장</span>
          <span className="text-[10px] font-bold text-slate-400">{account.businessName}</span>
        </div>
        <button
          onClick={() => { if (!isReviewBlocked) setShowCreateForm(true); }}
          disabled={isReviewBlocked}
          className={`px-4 py-2 text-[12px] font-[1000] rounded-xl transition-colors ${
            isReviewBlocked
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
              : 'bg-violet-600 hover:bg-violet-700 text-white'
          }`}
          title={isReviewBlocked ? '광고주 검수 통과 후 광고 등록 가능' : ''}
        >
          + 새 광고
        </button>
      </div>

      {/* 🚀 v2.1 (2026-04-26): 광고주 검수 상태 안내 배너 */}
      {account.status === 'pending_review' && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 flex items-start gap-3">
          <span className="text-[24px]">🕒</span>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-[1000] text-amber-800">광고주 검수 대기 중</p>
            <p className="text-[11px] font-bold text-amber-700 mt-0.5 leading-relaxed">
              관리자가 등록 정보를 확인하고 있어요. 통상 영업일 1~2일 소요. 검수 완료 알림이 도착하면 광고 등록·운영을 시작할 수 있습니다.
            </p>
          </div>
        </div>
      )}
      {account.status === 'rejected' && (
        <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3.5 flex items-start gap-3">
          <span className="text-[24px]">❌</span>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-[1000] text-rose-800">검수 거절됨</p>
            <p className="text-[11px] font-bold text-rose-700 mt-0.5 leading-relaxed">
              사유: {account.rejectionReason || '관리자가 사유를 기재하지 않았습니다.'}
            </p>
            <p className="text-[10px] font-bold text-rose-600 mt-1">필요한 정보를 보완 후 고객센터에 문의해주세요.</p>
          </div>
        </div>
      )}

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
          {/* 요약 카드 — 단위 ₩ → ⚾ 통일 (2026-04-25) */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100 text-center">
              <p className="text-[9px] font-black text-amber-400 uppercase">내 땡스볼</p>
              <p className="text-[16px] font-[1000] text-amber-600">⚾ {formatKoreanNumber(ballBalance)}</p>
            </div>
            <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100 text-center">
              <p className="text-[9px] font-black text-blue-400 uppercase">오늘 소진</p>
              <p className="text-[16px] font-[1000] text-blue-600">⚾ 0</p>
            </div>
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 text-center">
              <p className="text-[9px] font-black text-slate-400 uppercase">총 소진</p>
              <p className="text-[16px] font-[1000] text-slate-700">⚾ {formatKoreanNumber(account.totalSpent)}</p>
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
      {tab === 'campaigns' && <AdCampaignList
        ads={ads}
        onCreateNew={() => { setEditingAd(null); setShowCreateForm(true); }}
        onEdit={(ad) => { setEditingAd(ad); setShowCreateForm(true); }}
        onToggleStatus={async (ad, newStatus) => {
          const action = newStatus === 'paused' ? '일시정지' : '재개';
          if (!window.confirm(`이 광고를 ${action}하시겠습니까?`)) return;
          try {
            await updateDoc(doc(db, 'ads', ad.id), { status: newStatus, updatedAt: serverTimestamp() });
            alert(`✅ ${action} 처리 완료`);
          } catch (err) {
            console.error('[toggleAdStatus]', err);
            alert(`${action} 실패: ` + ((err as Error).message || '알 수 없는 오류'));
          }
        }}
      />}

      {/* 충전/결제 — 모든 비용 ⚾ 볼 단위 (2026-04-25 정책) */}
      {tab === 'billing' && (
        <div className="flex flex-col gap-4">
          {/* 잔액 카드 — ⚾ 단일 (광고비 결제·정산 모두 볼) */}
          <div className="grid grid-cols-1 gap-3">
            <div className="bg-amber-50 rounded-2xl p-5 border border-amber-100">
              <p className="text-[10px] font-black text-amber-400 uppercase">내 땡스볼 (광고비 잔액)</p>
              <p className="text-[24px] font-[1000] text-amber-600 mt-1">⚾ {formatKoreanNumber(ballBalance)} 볼</p>
              <p className="text-[10px] font-bold text-slate-400 mt-1">광고비 결제와 작성자 정산 모두 ⚾ 볼 단위로 운영</p>
            </div>
          </div>

          {/* 임시 땡스볼 충전 UI */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-[13px] font-[1000] text-slate-800">⚾ 임시 땡스볼 충전</h3>
                <p className="text-[10px] font-bold text-amber-600 mt-0.5">
                  ⚠️ 베타 단계 무료 충전 — 정식 PG 도입 후 광고비 결제와 연동 예정
                </p>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2 mb-2">
              {[100, 200, 500, 1000].map(n => (
                <button
                  key={n}
                  onClick={() => handleCharge(n)}
                  disabled={charging}
                  className="py-2.5 rounded-xl text-[12px] font-[1000] bg-amber-50 text-amber-600 border border-amber-100 hover:bg-amber-100 transition-all disabled:opacity-50"
                >
                  +{n}볼
                </button>
              ))}
            </div>
            <p className="text-[9px] font-bold text-slate-300 text-center">
              {charging ? '충전 처리 중...' : '※ CF testChargeBall 호출 (1~1000 범위 정수)'}
            </p>
          </div>

          {/* 베타 안내 */}
          <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4 text-center">
            <p className="text-[11px] font-bold text-slate-400">베타 단계 — 광고비 결제·작성자 정산 모두 ⚾ 볼 단위. 정식 서비스 시 환전 정책 추가 예정.</p>
          </div>
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
