// src/components/ads/AdSlot.tsx — 광고 슬롯 컴포넌트
// 🚀 Waterfall: 경매 낙찰 광고 → 애드센스(향후) → 자체 프로모션
import { useState, useEffect } from 'react';
import { getAdRevenueShare } from '../../constants';
import type { Ad } from '../../types';
import AdBanner from './AdBanner';
import AdFallback from './AdFallback';

// 🚀 경매 엔진 Cloud Function URL — 배포 후 실제 URL로 교체
const AD_AUCTION_URL = 'https://adauction-uqukvdmr2q-du.a.run.app';

interface Props {
  position: 'top' | 'middle' | 'bottom';
  postCategory?: string;
  postId?: string;
  postAuthorId?: string;
  postAuthorLevel: number;
}

interface AuctionResult {
  adId: string;
  headline: string;
  description: string;
  imageUrl: string;
  landingUrl: string;
  ctaText: string;
  bidType: 'cpm' | 'cpc';
  chargeAmount: number;
}

const AdSlot = ({ position, postCategory, postId, postAuthorId, postAuthorLevel }: Props) => {
  const rs = getAdRevenueShare(postAuthorLevel);
  const [auctionAd, setAuctionAd] = useState<AuctionResult | null>(null);
  const [_fallback, setFallback] = useState<'adsense' | 'promo' | null>(null);
  const [loaded, setLoaded] = useState(false);

  // 해당 레벨에서 이 슬롯 위치가 허용되지 않으면 렌더링 안 함
  if (!rs.positions.includes(position)) return null;

  // 🚀 경매 엔진 호출
  useEffect(() => {
    if (!postId) { setFallback('promo'); setLoaded(true); return; }

    fetch(AD_AUCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slotPosition: position, postCategory, postId, postAuthorId, postAuthorLevel }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.ad) setAuctionAd(data.ad);
        else setFallback(data.fallback || 'promo');
      })
      .catch(() => setFallback('promo'))
      .finally(() => setLoaded(true));
  }, [postId, position]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!loaded) return null; // 로딩 중 빈 공간

  // 클릭 이벤트 기록 (CPC 과금)
  const handleAdClick = (adId: string) => {
    if (!postId) return;
    // 비동기 — 클릭 이벤트는 백그라운드 기록 (UX 차단 안 함)
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
        <AdFallback position={position} />
      )}
    </div>
  );
};

export default AdSlot;
