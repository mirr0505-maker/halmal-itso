// src/components/ads/AdSlot.tsx — 광고 슬롯 컴포넌트
// 🚀 2종 광고: 플랫폼 광고(Lv2+, 자체 프로모션) + 작성자 광고(Lv5+, 경매/애드센스)
// 🚀 2026-04-26: selectedAdId 우선 매칭 — 작성자가 광고 경매시장에서 직접 선택한 광고 노출
// 🔧 2026-04-26 hooks fix: 모든 useState/useEffect를 early return 앞으로 이동.
//   기존 — 두 번째 useEffect가 early return 뒤에 있어 React "Rendered fewer hooks than expected"
//   에러 발생 → ErrorBoundary 재마운트 무한 루프 → 페이지 새로고침 반복 현상
import { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { getCreatorAdSlots, PLATFORM_AD_MIN_LEVEL } from '../../constants';
import type { Ad } from '../../types';
import AdBanner from './AdBanner';
import AdFallback from './AdFallback';
import { getViewerRegion } from '../../utils/getViewerRegion';

const AD_AUCTION_URL = 'https://adauction-uqukvdmr2q-du.a.run.app';

interface Props {
  position: 'top' | 'middle' | 'bottom';
  postCategory?: string;
  postId?: string;
  postAuthorId?: string;
  postAuthorLevel: number;
  type?: 'platform' | 'creator';
  adSlotEnabled?: boolean;
  selectedAdId?: string;
}

interface AuctionResult {
  adId: string; headline: string; description: string;
  imageUrl: string; landingUrl: string; ctaText: string;
  imageStyle?: 'horizontal' | 'vertical';
  imagePosition?: 'left' | 'right';
  bidType: 'cpm' | 'cpc'; chargeAmount: number;
}

const AdSlot = ({ position, postCategory, postId, postAuthorId, postAuthorLevel, type = 'platform', adSlotEnabled = false, selectedAdId }: Props) => {
  const [auctionAd, setAuctionAd] = useState<AuctionResult | null>(null);
  const [_fallback, setFallback] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [directAd, setDirectAd] = useState<Ad | null>(null);

  // ──────────────────────────────────────────────────
  // ⚠️ 모든 hook은 early return 앞에서 호출 (React Hooks 규칙)
  // ──────────────────────────────────────────────────

  // selectedAdId 직접 fetch — 작성자가 광고 경매시장에서 선택한 광고
  //   status=active + 해당 슬롯 통과 시에만 노출. 검수 거절·만료된 광고는 fallback (자동 매칭으로 회귀).
  //   'auto' = 사용자가 자동 매칭으로 명시 결정 (UI 표지) — 노출 동작은 default와 동일하게 자동 매칭으로 회귀
  useEffect(() => {
    if (!selectedAdId || selectedAdId === 'auto') { setDirectAd(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'ads', selectedAdId));
        if (cancelled) return;
        if (snap.exists()) {
          const data = snap.data() as Ad;
          if (data.status === 'active' && data.targetSlots?.includes(position)) {
            setDirectAd({ ...data, id: snap.id });
          } else {
            setDirectAd(null);
          }
        } else {
          setDirectAd(null);
        }
      } catch (err) { console.warn('[AdSlot direct fetch]', err); }
    })();
    return () => { cancelled = true; };
  }, [selectedAdId, position]);

  // 경매 엔진 호출 — creator 타입 + 활성화 + selectedAdId 미적용일 때만 실행
  //   조건 분기는 useEffect 내부에서 처리해 hook 호출 순서 일관성 보장
  useEffect(() => {
    if (type !== 'creator') return;
    if (!adSlotEnabled) return;
    if (selectedAdId && directAd) return; // 직접 선택 광고 우선
    if (!postId) { setFallback('promo'); setLoaded(true); return; }
    let cancelled = false;
    (async () => {
      const viewerRegion = await getViewerRegion();
      try {
        const r = await fetch(AD_AUCTION_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slotPosition: position, postCategory, postId, postAuthorId, postAuthorLevel, viewerRegion }),
        });
        const data = await r.json();
        if (cancelled) return;
        if (data.ad) setAuctionAd(data.ad); else setFallback(data.fallback || 'promo');
      } catch {
        if (!cancelled) setFallback('promo');
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [postId, position, type, adSlotEnabled, selectedAdId, directAd, postCategory, postAuthorId, postAuthorLevel]);

  // ──────────────────────────────────────────────────
  // ✅ 여기부터 early return 가능 (모든 hook 등록 완료)
  // ──────────────────────────────────────────────────

  // 🚀 플랫폼 광고: Lv2+ 모든 글
  //   AdFallback이 position별 고정 프로모션 — top:거대나무 / middle:땡스볼 / bottom:깐부맺기
  if (type === 'platform') {
    if (postAuthorLevel < PLATFORM_AD_MIN_LEVEL) return null;
    return (
      <div className="my-4">
        <AdFallback position={position} />
      </div>
    );
  }

  // 🚀 작성자 광고: Lv5+, 작성자가 활성화한 경우만
  const rs = getCreatorAdSlots(postAuthorLevel);
  if (!rs.positions.includes(position)) return null;
  if (!adSlotEnabled) return null;

  // 🚀 selectedAdId 우선 매칭 — 작성자가 광고 경매시장에서 직접 선택한 광고 노출
  if (directAd) {
    return (
      <div className="my-4">
        <AdBanner ad={directAd} position={position} onClick={() => {}} />
      </div>
    );
  }

  if (!loaded) return null;

  const handleAdClick = (adId: string) => {
    if (!postId) return;
    fetch(AD_AUCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventType: 'click', adId, postId, postAuthorId }),
    }).catch(() => {});
  };

  return (
    <div className="my-4">
      {auctionAd ? (
        <AdBanner
          ad={{ ...auctionAd, id: auctionAd.adId, advertiserId: '', advertiserName: '', title: auctionAd.headline, targetCategories: [], targetRegions: [], targetSlots: [], bidAmount: auctionAd.chargeAmount, dailyBudget: 0, totalBudget: 0, startDate: {} as any, endDate: {} as any, status: 'active', totalImpressions: 0, totalClicks: 0, totalSpent: 0, ctr: 0, createdAt: {} as any, updatedAt: {} as any } as Ad}
          position={position}
          onClick={handleAdClick}
        />
      ) : (
        <div className="w-full rounded-xl border border-dashed border-violet-200 bg-violet-50/30 px-4 py-3 text-center">
          <p className="text-[10px] font-bold text-violet-400">광고 슬롯 활성 — 경매 대기 중</p>
        </div>
      )}
    </div>
  );
};

export default AdSlot;
