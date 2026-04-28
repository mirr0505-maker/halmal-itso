// src/components/ads/AdSlot.tsx — 광고 슬롯 컴포넌트
// 🚀 2종 광고: 플랫폼 광고(Lv2+, 자체 프로모션) + 작성자 광고(Lv5+, 경매/애드센스)
// 🚀 v2 (2026-04-26):
//   - viewerUid 전달 (P0-2 빈도 캡)
//   - IntersectionObserver 50% × 1초 → viewable 이벤트 (P0-4 IAB 표준)
//   - 클릭 시 viewerUid 포함
import { useState, useEffect, useRef } from 'react';
import { db, auth } from '../../firebase';
import { doc, getDoc, collection, query, where, getDocs, Timestamp, limit as fbLimit } from 'firebase/firestore';
import { getCreatorAdSlots, PLATFORM_AD_MIN_LEVEL } from '../../constants';
import type { Ad } from '../../types';
import AdBanner from './AdBanner';
import AdFallback from './AdFallback';
import { getViewerRegion } from '../../utils/getViewerRegion';

const AD_AUCTION_URL = 'https://adauction-uqukvdmr2q-du.a.run.app';
const VIEWABLE_VISIBILITY_RATIO = 0.5;
const VIEWABLE_DURATION_MS = 1000;

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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewableFiredRef = useRef<Set<string>>(new Set());
  // 🔧 v2.1: directAd impression 이벤트 — 광고당 1회 발사 (스크롤 재마운트 중복 차단)
  const impressionFiredRef = useRef<Set<string>>(new Set());

  // selectedAdId 직접 fetch
  // 🔧 v2.1+ (2026-04-28): 빈도 캡 검사 추가 — selectedAd 광고도 사용자 보호 적용
  //   24h 같은 사용자 viewable count >= limit 시 directAd=null → 매칭 분기로 fallthrough
  //   매칭 분기에서도 빈도 캡 통과 못 하면 fallback 'adsense' 또는 빈 슬롯
  useEffect(() => {
    if (!selectedAdId || selectedAdId === 'auto') { setDirectAd(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'ads', selectedAdId));
        if (cancelled) return;
        if (!snap.exists()) { setDirectAd(null); return; }
        const data = snap.data() as Ad;
        if (data.status !== 'active' || !data.targetSlots?.includes(position)) {
          setDirectAd(null);
          return;
        }
        // 빈도 캡 검사 — viewerUid 있을 때만 (비로그인은 캡 미적용)
        const viewerUid = auth.currentUser?.uid;
        if (viewerUid) {
          const cap = data.frequencyCap || { limit: 3, periodHours: 24 };
          const since = Timestamp.fromMillis(Date.now() - cap.periodHours * 3600 * 1000);
          const evtSnap = await getDocs(query(
            collection(db, 'adEvents'),
            where('adId', '==', selectedAdId),
            where('eventType', '==', 'viewable'),
            where('viewerUid', '==', viewerUid),
            where('createdAt', '>=', since),
            fbLimit(cap.limit),
          ));
          if (cancelled) return;
          if (evtSnap.size >= cap.limit) {
            console.log(`[AdSlot] 빈도 캡 도달 — selectedAd ${selectedAdId} 차단 (count=${evtSnap.size}/${cap.limit})`);
            setDirectAd(null);
            return;
          }
        }
        setDirectAd({ ...data, id: snap.id });
      } catch (err) { console.warn('[AdSlot direct fetch]', err); }
    })();
    return () => { cancelled = true; };
  }, [selectedAdId, position]);

  // 경매 엔진 호출
  // 🔧 v2.1+ (2026-04-28): selectedAdId가 광고 ID이면 매칭 분기 자체를 skip
  //   기존 — directAd가 비동기로 set되기 전에 매칭 fetch가 발생해 같은 광고에 impression +1 추가 누적
  //   수정 — selectedAdId 광고 ID면 매칭 안 거침. directAd가 빈도 캡 등으로 null이면 빈 슬롯 표시.
  //   'auto' 또는 undefined일 때만 매칭 fetch 실행.
  useEffect(() => {
    if (type !== 'creator') return;
    if (!adSlotEnabled) return;
    if (selectedAdId && selectedAdId !== 'auto') {
      // selectedAd 광고가 있으면 매칭 fetch skip + loaded=true (directAd null 시 빈 슬롯 메시지 표시)
      setLoaded(true);
      return;
    }
    if (!postId) { setFallback('promo'); setLoaded(true); return; }
    let cancelled = false;
    (async () => {
      const viewerRegion = await getViewerRegion();
      const viewerUid = auth.currentUser?.uid || 'anonymous';
      try {
        const r = await fetch(AD_AUCTION_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slotPosition: position, postCategory, postId, postAuthorId, postAuthorLevel, viewerRegion, viewerUid }),
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

  // 🔧 v2.1: directAd impression 이벤트 — selectedAdId 직접 매칭은 auction.js 매칭 분기를 안 거치므로
  //   여기서 명시적으로 impression 발사. 광고당 1회.
  useEffect(() => {
    if (!directAd?.id || !postId) return;
    if (impressionFiredRef.current.has(directAd.id)) return;
    impressionFiredRef.current.add(directAd.id);
    const viewerUid = auth.currentUser?.uid || 'anonymous';
    fetch(AD_AUCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventType: 'impression', adId: directAd.id, postId, postAuthorId,
        postCategory, slotPosition: position,
        bidAmount: directAd.bidAmount, bidType: directAd.bidType, viewerUid,
        directMatch: true,
      }),
    }).catch(() => {});
  }, [directAd, postId, postAuthorId, postCategory, position]);

  // 🚀 P0-4: IntersectionObserver — 50% 가시성 1초+ 충족 시 viewable 이벤트
  //   viewableFiredRef로 광고당 1회만 발사 (스크롤 반복 차단)
  useEffect(() => {
    const adId = directAd?.id || auctionAd?.adId;
    if (!adId || !containerRef.current) return;
    if (viewableFiredRef.current.has(adId)) return;

    const target = containerRef.current;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const fireViewable = () => {
      if (viewableFiredRef.current.has(adId)) return;
      viewableFiredRef.current.add(adId);
      const viewerUid = auth.currentUser?.uid || 'anonymous';
      const ad = directAd || auctionAd;
      const bidAmount = directAd ? directAd.bidAmount : auctionAd?.chargeAmount;
      const bidType = ad ? ('bidType' in ad ? ad.bidType : 'cpm') : 'cpm';
      fetch(AD_AUCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: 'viewable', adId, postId, postAuthorId,
          postCategory, slotPosition: position,
          bidAmount, bidType, viewerUid,
        }),
      }).catch(() => {});
    };

    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && entry.intersectionRatio >= VIEWABLE_VISIBILITY_RATIO) {
          if (!timer) timer = setTimeout(fireViewable, VIEWABLE_DURATION_MS);
        } else {
          if (timer) { clearTimeout(timer); timer = null; }
        }
      }
    }, { threshold: [VIEWABLE_VISIBILITY_RATIO] });

    io.observe(target);
    return () => {
      io.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, [directAd, auctionAd, postId, postAuthorId, postCategory, position]);

  // ──────────────────────────────────────────────────

  if (type === 'platform') {
    if (postAuthorLevel < PLATFORM_AD_MIN_LEVEL) return null;
    return (
      <div className="my-4">
        <AdFallback position={position} />
      </div>
    );
  }

  const rs = getCreatorAdSlots(postAuthorLevel);
  if (!rs.positions.includes(position)) return null;
  if (!adSlotEnabled) return null;

  // 🔧 v2.1 (2026-04-26): handleAdClick을 directAd 분기보다 앞으로 이동 — TDZ(Temporal Dead Zone) 회피
  //   기존: const 선언이 directAd 분기 뒤에 있어 minified 빌드에서 'Cannot access _ before initialization' 에러
  const handleAdClick = (adId: string, bidAmount?: number, bidType?: 'cpm' | 'cpc') => {
    if (!postId) return;
    const viewerUid = auth.currentUser?.uid || 'anonymous';
    fetch(AD_AUCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventType: 'click', adId, postId, postAuthorId,
        postCategory, slotPosition: position,
        bidAmount, bidType, viewerUid,
      }),
    }).catch(() => {});
  };

  if (directAd) {
    return (
      <div ref={containerRef} className="my-4">
        <AdBanner ad={directAd} position={position} onClick={() => handleAdClick(directAd.id, directAd.bidAmount, directAd.bidType)} />
      </div>
    );
  }

  if (!loaded) return null;

  return (
    <div ref={containerRef} className="my-4">
      {auctionAd ? (
        <AdBanner
          ad={{ ...auctionAd, id: auctionAd.adId, advertiserId: '', advertiserName: '', title: auctionAd.headline, targetCategories: [], targetRegions: [], targetSlots: [], bidAmount: auctionAd.chargeAmount, dailyBudget: 0, totalBudget: 0, startDate: {} as any, endDate: {} as any, status: 'active', totalImpressions: 0, totalClicks: 0, totalSpent: 0, ctr: 0, createdAt: {} as any, updatedAt: {} as any } as Ad}
          position={position}
          onClick={(adId) => handleAdClick(adId, auctionAd.chargeAmount, auctionAd.bidType)}
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
