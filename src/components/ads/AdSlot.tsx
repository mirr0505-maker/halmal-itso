// src/components/ads/AdSlot.tsx — 광고 슬롯 컴포넌트
// 🚀 2종 광고: 플랫폼 광고(Lv2+, 자체 프로모션) + 작성자 광고(Lv5+, 경매/애드센스)
import { useState, useEffect } from 'react';
import { getCreatorAdSlots, PLATFORM_AD_MIN_LEVEL } from '../../constants';
import type { Ad } from '../../types';
import AdBanner from './AdBanner';
import AdFallback from './AdFallback';

const AD_AUCTION_URL = 'https://adauction-uqukvdmr2q-du.a.run.app';

interface Props {
  position: 'top' | 'middle' | 'bottom';
  postCategory?: string;
  postId?: string;
  postAuthorId?: string;
  postAuthorLevel: number;
  type?: 'platform' | 'creator'; // 플랫폼 광고 vs 작성자 광고
  adSlotEnabled?: boolean;       // 작성자가 광고 슬롯을 활성화했는지 (creator 전용)
}

interface AuctionResult {
  adId: string; headline: string; description: string;
  imageUrl: string; landingUrl: string; ctaText: string;
  bidType: 'cpm' | 'cpc'; chargeAmount: number;
}

const AdSlot = ({ position, postCategory, postId, postAuthorId, postAuthorLevel, type = 'platform', adSlotEnabled = false }: Props) => {
  const [auctionAd, setAuctionAd] = useState<AuctionResult | null>(null);
  const [_fallback, setFallback] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  // 🚀 플랫폼 광고: Lv2+ 모든 글, bottom만
  if (type === 'platform') {
    if (postAuthorLevel < PLATFORM_AD_MIN_LEVEL) return null;
    if (position !== 'bottom') return null;
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

  // 경매 엔진 호출
  useEffect(() => {
    if (!postId) { setFallback('promo'); setLoaded(true); return; }
    fetch(AD_AUCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slotPosition: position, postCategory, postId, postAuthorId, postAuthorLevel }),
    })
      .then(r => r.json())
      .then(data => { if (data.ad) setAuctionAd(data.ad); else setFallback(data.fallback || 'promo'); })
      .catch(() => setFallback('promo'))
      .finally(() => setLoaded(true));
  }, [postId, position]); // eslint-disable-line react-hooks/exhaustive-deps

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
