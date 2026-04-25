// src/components/advertiser/AdCampaignForm.tsx — 광고 등록/수정 폼
// 🚀 Phase α-2 G (2026-04-25): 슬롯 위치별 + PC/모바일 미리보기 섹션 추가
import { useState } from 'react';
import { db } from '../../firebase';
import { doc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { uploadToR2 } from '../../uploadToR2';
import { AD_CATEGORIES, AD_MENU_CATEGORIES } from '../../constants';
import AdBanner from '../ads/AdBanner';
import type { Ad } from '../../types';

interface Props {
  advertiserId: string;
  advertiserName: string;
  editingAd?: Ad;  // 🚀 2026-04-25: 수정 모드 — 있으면 기존 데이터로 폼 초기화 + update
  onBack: () => void;
}

const SLOT_OPTIONS: { value: 'top' | 'middle' | 'bottom'; label: string }[] = [
  { value: 'top', label: '상단' },
  { value: 'middle', label: '중단' },
  { value: 'bottom', label: '하단' },
];

const AdCampaignForm = ({ advertiserId, advertiserName, editingAd, onBack }: Props) => {
  const isEditMode = !!editingAd;
  // 수정 모드면 기존 광고 값으로 초기화, 신규면 default
  const [form, setForm] = useState(() => editingAd ? {
    title: editingAd.title || '',
    headline: editingAd.headline || '',
    description: editingAd.description || '',
    ctaText: editingAd.ctaText || '자세히 보기',
    landingUrl: editingAd.landingUrl || '',
    imageUrl: editingAd.imageUrl || '',
    imageStyle: (editingAd.imageStyle || 'horizontal') as 'horizontal' | 'vertical',
    imagePosition: (editingAd.imagePosition || 'left') as 'left' | 'right',
    targetCategories: editingAd.targetCategories || [],
    targetMenuCategories: editingAd.targetMenuCategories || [],
    targetSlots: (editingAd.targetSlots || ['bottom']) as ('top' | 'middle' | 'bottom')[],
    targetCreatorId: editingAd.targetCreatorId || '',
    targetCreatorNickname: editingAd.targetCreatorNickname || '',
    bidType: editingAd.bidType || 'cpm' as 'cpm' | 'cpc',
    bidAmount: editingAd.bidAmount || 1000,
    dailyBudget: editingAd.dailyBudget || 10000,
    totalBudget: editingAd.totalBudget || 100000,
  } : {
    title: '', headline: '', description: '', ctaText: '자세히 보기',
    landingUrl: '', imageUrl: '',
    imageStyle: 'horizontal' as 'horizontal' | 'vertical',
    imagePosition: 'left' as 'left' | 'right',
    targetCategories: [] as string[],
    targetMenuCategories: [] as string[],
    targetSlots: ['bottom'] as ('top' | 'middle' | 'bottom')[],
    targetCreatorId: '',
    targetCreatorNickname: '',
    bidType: 'cpm' as 'cpm' | 'cpc',
    // 🚀 2026-04-25 단위 통일: 원(₩) → 볼(⚾). 베타 default값 (CPM 1000노출당 10볼)
    bidAmount: 10, dailyBudget: 1000, totalBudget: 10000,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  // 🚀 미리보기 폭 모드 (PC vs 모바일)
  const [previewMode, setPreviewMode] = useState<'pc' | 'mobile'>('pc');

  const update = (key: string, value: unknown) => setForm(prev => ({ ...prev, [key]: value }));

  const toggleCategory = (cat: string) => {
    setForm(prev => ({
      ...prev,
      targetCategories: prev.targetCategories.includes(cat)
        ? prev.targetCategories.filter(c => c !== cat)
        : [...prev.targetCategories, cat],
    }));
  };

  const toggleMenuCategory = (cat: string) => {
    setForm(prev => ({
      ...prev,
      targetMenuCategories: prev.targetMenuCategories.includes(cat)
        ? prev.targetMenuCategories.filter(c => c !== cat)
        : [...prev.targetMenuCategories, cat],
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
      if (isEditMode && editingAd) {
        // 🔧 수정 모드: 기존 ID 유지, 누적 통계(impressions/clicks/spent)·createdAt·advertiser 정보 보존
        //   소재/타겟팅 변경이 있으면 status='pending_review' 강제 (재검수). draft 그대로 저장은 status 유지.
        const newStatus = status === 'draft' ? 'draft' : 'pending_review';
        await setDoc(doc(db, 'ads', editingAd.id), {
          ...form,
          targetCreatorId: form.targetCreatorId || null,
          id: editingAd.id,
          advertiserId,
          advertiserName,
          targetRegions: editingAd.targetRegions || [],
          status: newStatus,
          // 누적 통계 보존
          totalImpressions: editingAd.totalImpressions || 0,
          totalClicks: editingAd.totalClicks || 0,
          totalSpent: editingAd.totalSpent || 0,
          ctr: editingAd.ctr || 0,
          startDate: editingAd.startDate,
          endDate: editingAd.endDate,
          createdAt: editingAd.createdAt,
          updatedAt: serverTimestamp(),
        });
        alert(newStatus === 'pending_review' ? '✅ 수정 완료 — 재검수 대기 상태로 전환됐어요' : '✅ 임시저장 완료');
      } else {
        // 신규 등록 — endDate default 30일 후 (만료 자동 처리에 사용)
        //   기존 코드는 startDate=endDate라 모든 광고가 즉시 만료된 셈 (버그). 명시 30일.
        const adId = `ad_${Date.now()}_${advertiserId}`;
        const now = Date.now();
        const thirtyDaysLater = new Date(now + 30 * 86400 * 1000);
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
          endDate: Timestamp.fromDate(thirtyDaysLater),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      onBack();
    } catch (err) {
      alert((isEditMode ? '수정' : '등록') + ' 실패: ' + ((err as Error).message || ''));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-6 px-4 animate-in fade-in">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="text-[11px] font-black text-slate-400 hover:text-slate-700">← 돌아가기</button>
        <h2 className="text-[18px] font-[1000] text-slate-900">{isEditMode ? '✏️ 광고 수정' : '📢 새 광고 등록'}</h2>
        {isEditMode && (
          <span className="text-[10px] font-[1000] bg-amber-100 text-amber-700 px-2 py-0.5 rounded">수정 시 재검수 필요</span>
        )}
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

          {/* 🎨 광고 스타일 선택 — 가로 플래카드형 vs 세로형 */}
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">🎨 광고 스타일</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => update('imageStyle', 'horizontal')}
                className={`p-3 rounded-xl border-2 transition-all text-left ${form.imageStyle === 'horizontal' ? 'border-violet-500 bg-violet-50' : 'border-slate-200 bg-white hover:border-violet-300'}`}>
                <p className="text-[12px] font-[1000] text-slate-800 mb-0.5">🟦 가로 플래카드</p>
                <p className="text-[9px] font-bold text-slate-500">3:1 가로 긴 이미지 + 하단 텍스트</p>
              </button>
              <button type="button" onClick={() => update('imageStyle', 'vertical')}
                className={`p-3 rounded-xl border-2 transition-all text-left ${form.imageStyle === 'vertical' ? 'border-violet-500 bg-violet-50' : 'border-slate-200 bg-white hover:border-violet-300'}`}>
                <p className="text-[12px] font-[1000] text-slate-800 mb-0.5">🟥 세로형</p>
                <p className="text-[9px] font-bold text-slate-500">9:16 세로 이미지 + 반대편 텍스트</p>
              </button>
            </div>
            {/* 세로형일 때 좌·우 위치 선택 */}
            {form.imageStyle === 'vertical' && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-500">이미지 위치:</span>
                <button type="button" onClick={() => update('imagePosition', 'left')}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-[1000] transition-all ${form.imagePosition === 'left' ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  ← 왼쪽
                </button>
                <button type="button" onClick={() => update('imagePosition', 'right')}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-[1000] transition-all ${form.imagePosition === 'right' ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  오른쪽 →
                </button>
              </div>
            )}
          </div>

          {/* 📸 배너 이미지 — 스타일별 비율 분기 */}
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">📸 배너 이미지</p>
            <p className="text-[9px] font-bold text-slate-400 mb-2">
              {form.imageStyle === 'horizontal'
                ? '권장 비율 3:1 (1500×500 이상, 플래카드형)'
                : '권장 비율 9:16 (720×1280 이상, 세로형)'}
              · 5MB 이하 · PNG/JPG
            </p>
            {(() => {
              const aspectClass = form.imageStyle === 'horizontal' ? 'aspect-[3/1]' : 'aspect-[9/16] max-w-[240px] mx-auto';
              return form.imageUrl ? (
                <div className={`relative ${aspectClass} rounded-xl overflow-hidden border-2 border-violet-200 bg-slate-50`}>
                  <img src={form.imageUrl} alt="" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => update('imageUrl', '')}
                    className="absolute top-2 right-2 bg-rose-500 text-white text-[10px] font-[1000] px-2.5 py-1 rounded shadow-sm hover:bg-rose-600">
                    ✕ 삭제
                  </button>
                  <label className="absolute bottom-2 right-2 bg-white/90 text-slate-700 text-[10px] font-[1000] px-2.5 py-1 rounded shadow-sm cursor-pointer hover:bg-white">
                    📷 교체
                    <input type="file" accept="image/*" onChange={handleImageUpload} disabled={isUploading} className="hidden" />
                  </label>
                </div>
              ) : (
                <label className={`${aspectClass} rounded-xl border-2 border-dashed border-violet-300 bg-violet-50/30 flex flex-col items-center justify-center cursor-pointer hover:bg-violet-50 transition-colors`}>
                  <input type="file" accept="image/*" onChange={handleImageUpload} disabled={isUploading} className="hidden" />
                  <span className="text-4xl mb-2">📷</span>
                  <span className="text-[12px] font-[1000] text-violet-700">클릭해서 이미지 업로드</span>
                  <span className="text-[10px] font-bold text-slate-400 mt-1">
                    {isUploading ? '⏳ 업로드 중...' : (form.imageStyle === 'horizontal' ? '권장 3:1 비율' : '권장 9:16 비율')}
                  </span>
                </label>
              );
            })()}
          </div>
        </div>

        {/* 타겟팅 */}
        <div className="flex flex-col gap-3">
          <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">타겟팅</h3>
          {/* 📍 노출 위치 글 메뉴 (매칭 핵심) */}
          <div>
            <p className="text-[10px] font-bold text-slate-500 mb-1">📍 노출 위치 (글 메뉴) — 미선택 시 전체</p>
            <p className="text-[9px] font-bold text-slate-400 mb-2">광고가 어떤 메뉴의 글에 표시될지 선택. 빈 배열이면 모든 메뉴 노출.</p>
            <div className="flex flex-wrap gap-1.5">
              {AD_MENU_CATEGORIES.map(opt => (
                <button key={opt.value} type="button" onClick={() => toggleMenuCategory(opt.value)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${form.targetMenuCategories.includes(opt.value) ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 📂 업종 (통계·관리용 — 매칭 미사용) */}
          <div>
            <p className="text-[10px] font-bold text-slate-500 mb-1">📂 업종 분류 (선택사항, 통계용)</p>
            <p className="text-[9px] font-bold text-slate-400 mb-2">광고 분류 라벨. 노출 매칭과 무관 — 관리자/광고주 통계 화면에 활용.</p>
            <div className="flex flex-wrap gap-1.5">
              {AD_CATEGORIES.map(cat => (
                <button key={cat} type="button" onClick={() => toggleCategory(cat)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${form.targetCategories.includes(cat) ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
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

        {/* 📍 미리보기 — 실제 슬롯에 어떻게 노출될지 시각화 */}
        <div className="flex flex-col gap-3 border-t border-slate-100 pt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">📍 미리보기</h3>
            <div className="flex gap-1">
              <button type="button" onClick={() => setPreviewMode('pc')}
                className={`px-2.5 py-1 rounded text-[10px] font-[1000] transition-all ${previewMode === 'pc' ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                💻 PC
              </button>
              <button type="button" onClick={() => setPreviewMode('mobile')}
                className={`px-2.5 py-1 rounded text-[10px] font-[1000] transition-all ${previewMode === 'mobile' ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                📱 모바일
              </button>
            </div>
          </div>
          {form.targetSlots.length === 0 ? (
            <p className="text-[11px] font-bold text-slate-400 text-center py-6 bg-slate-50 rounded-lg">
              위에서 슬롯 위치를 1개 이상 선택하면 미리보기가 표시됩니다
            </p>
          ) : (
            <div className={`mx-auto bg-slate-50 rounded-xl p-3 space-y-3 transition-all ${previewMode === 'mobile' ? 'max-w-[360px]' : 'max-w-[600px]'}`}>
              <p className="text-[9px] font-bold text-slate-400 text-center">실제 글 상세 페이지에 노출되는 모습 ({previewMode === 'mobile' ? '모바일' : 'PC'} 폭)</p>
              {(['top', 'middle', 'bottom'] as const)
                .filter(p => form.targetSlots.includes(p))
                .map(pos => {
                  const previewAd: Ad = {
                    id: 'preview',
                    advertiserId: '',
                    advertiserName: advertiserName || '',
                    title: form.title || '(제목 미입력)',
                    headline: form.headline || '(헤드라인을 입력하세요)',
                    description: form.description || '(설명을 입력하세요)',
                    imageUrl: form.imageUrl,
                    imageStyle: form.imageStyle,
                    imagePosition: form.imagePosition,
                    landingUrl: form.landingUrl || '#',
                    ctaText: form.ctaText || '자세히 보기',
                    targetCategories: [], targetRegions: [], targetSlots: [],
                    bidType: form.bidType, bidAmount: form.bidAmount,
                    dailyBudget: 0, totalBudget: 0,
                    startDate: {} as never, endDate: {} as never,
                    status: 'active' as const,
                    totalImpressions: 0, totalClicks: 0, totalSpent: 0, ctr: 0,
                    createdAt: {} as never, updatedAt: {} as never,
                  };
                  return (
                    <div key={pos}>
                      <p className="text-[9px] font-[1000] text-violet-500 mb-1">
                        📍 {pos === 'top' ? '상단' : pos === 'middle' ? '중단' : '하단'} 슬롯
                      </p>
                      {/* pointer-events-none — 미리보기에서 실제 클릭으로 landing 열리지 않게 */}
                      <div className="pointer-events-none">
                        <AdBanner ad={previewAd} position={pos} />
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
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
              <label className="text-[9px] font-black text-slate-400 block mb-1">입찰가 (⚾ 볼)</label>
              <input type="number" min={1} value={form.bidAmount} onChange={e => update('bidAmount', Number(e.target.value))}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-[13px] font-bold outline-none focus:border-violet-400" />
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-400 block mb-1">일일 예산 (⚾ 볼)</label>
              <input type="number" min={1} value={form.dailyBudget} onChange={e => update('dailyBudget', Number(e.target.value))}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-[13px] font-bold outline-none focus:border-violet-400" />
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-400 block mb-1">총 예산 (⚾ 볼)</label>
              <input type="number" min={1} value={form.totalBudget} onChange={e => update('totalBudget', Number(e.target.value))}
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
            {isSubmitting ? (isEditMode ? '저장 중...' : '등록 중...') : (isEditMode ? '저장 후 재검수 요청' : '검수 요청')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdCampaignForm;
