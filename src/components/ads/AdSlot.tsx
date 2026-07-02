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
  // ⚡ 성능 2026-07-02: 로드 게이트 플래그 — 슬롯이 뷰포트 200px 이내로 진입하기 전까지 false 유지.
  //   WHY: 글 상세 진입 시 DiscussionView가 4개 AdSlot을 동시 마운트하면 각자 즉시 경매 fetch +
  //        빈도캡 getDocs를 발사(~4-8 동시 Cloud Run+Firestore 요청) → 댓글 구독·OG fetch와 경쟁해 마운트 버벅임.
  //        middle/bottom 슬롯은 대부분 fold 아래라 진입 시점까지 요청을 미뤄도 사용자 체감 손실 없음.
  const [hasEnteredViewport, setHasEnteredViewport] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  // ⚡ 성능 2026-07-02: 로드 게이트 전용 sentinel ref (viewable 회계용 containerRef와 분리) — 회계 이벤트 미발사
  const gateRef = useRef<HTMLDivElement | null>(null);
  const viewableFiredRef = useRef<Set<string>>(new Set());
  // 🔧 v2.1: directAd impression 이벤트 — 광고당 1회 발사 (스크롤 재마운트 중복 차단)
  const impressionFiredRef = useRef<Set<string>>(new Set());
  // 🔧 2026-04-30: viewerRegion ref + mount fetch 제거 — 각 POST 분기에서 await getViewerRegion() 직접 호출
  //   기존 — ref 비동기 set 도착 전에 directMatch impression / viewable / click이 발사되면 viewerRegion=''로 적재
  //   결과 — byRegion 집계 누락 (광고별 일부 viewer 세션 빈 문자열)
  //   수정 — getViewerRegion() in-flight singleton + sessionStorage 30분 캐시라 페이지당 fetch 1회만 발생, race 0
  // selectedAdId 직접 fetch
  // 🔧 v2.1+ (2026-04-28): 빈도 캡 검사 추가 — selectedAd 광고도 사용자 보호 적용
  //   24h 같은 사용자 viewable count >= limit 시 directAd=null → 매칭 분기로 fallthrough
  //   매칭 분기에서도 빈도 캡 통과 못 하면 fallback 'adsense' 또는 빈 슬롯
  useEffect(() => {
    // ⚡ 성능 2026-07-02: 뷰포트 진입 전에는 selectedAd getDoc + 빈도캡 getDocs를 미룸.
    //   off-screen 슬롯은 directAd=null 유지(기본값) → 렌더에 영향 없음. 진입 시 effect 재실행으로 정상 수행.
    if (!hasEnteredViewport) return;
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
        // 🔧 v2.1+ (2026-04-28): 광고주 의도 강제 — Brand Safety + 메뉴 매칭 검사
        //   selectedAd 직접 매칭이라도 광고주가 차단·미허용 카테고리에는 노출 안 됨 (auction.js 매칭과 일관)
        if (data.blockedCategories?.length && postCategory && data.blockedCategories.includes(postCategory)) {
          console.log(`[AdSlot] Brand Safety 차단 — selectedAd ${selectedAdId} (cat=${postCategory})`);
          setDirectAd(null);
          return;
        }
        if (data.targetMenuCategories?.length && postCategory && !data.targetMenuCategories.includes(postCategory)) {
          console.log(`[AdSlot] 메뉴 비매칭 차단 — selectedAd ${selectedAdId} (cat=${postCategory}, target=${data.targetMenuCategories.join(',')})`);
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
  }, [selectedAdId, position, postCategory, hasEnteredViewport]);

  // 경매 엔진 호출
  // 🔧 v2.1+ (2026-04-28): selectedAdId가 광고 ID이면 매칭 분기 자체를 skip
  //   기존 — directAd가 비동기로 set되기 전에 매칭 fetch가 발생해 같은 광고에 impression +1 추가 누적
  //   수정 — selectedAdId 광고 ID면 매칭 안 거침. directAd가 빈도 캡 등으로 null이면 빈 슬롯 표시.
  //   'auto' 또는 undefined일 때만 매칭 fetch 실행.
  useEffect(() => {
    if (type !== 'creator') return;
    if (!adSlotEnabled) return;
    // ⚡ 성능 2026-07-02: 뷰포트 진입 전에는 경매 fetch를 미룸 (loaded=false 유지 → 아래 sentinel 렌더 지속).
    //   진입 시 hasEnteredViewport→true로 effect 재실행되어 정상 매칭. selectedAd/directAd 경로도 동일 게이트로 일관 지연.
    if (!hasEnteredViewport) return;
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
  }, [postId, position, type, adSlotEnabled, selectedAdId, directAd, postCategory, postAuthorId, postAuthorLevel, hasEnteredViewport]);

  // 🔧 v2.1: directAd impression 이벤트 — selectedAdId 직접 매칭은 auction.js 매칭 분기를 안 거치므로
  //   여기서 명시적으로 impression 발사. 광고당 1회.
  useEffect(() => {
    if (!directAd?.id || !postId) return;
    if (impressionFiredRef.current.has(directAd.id)) return;
    impressionFiredRef.current.add(directAd.id);
    // 🔧 2026-04-30: ref 동기 읽기 → await 직접 호출 (byRegion race 차단)
    (async () => {
      const viewerRegion = await getViewerRegion();
      const viewerUid = auth.currentUser?.uid || 'anonymous';
      fetch(AD_AUCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: 'impression', adId: directAd.id, postId, postAuthorId,
          postCategory, slotPosition: position,
          bidAmount: directAd.bidAmount, bidType: directAd.bidType, viewerUid,
          viewerRegion,
          directMatch: true,
        }),
      }).catch(() => {});
    })();
  }, [directAd, postId, postAuthorId, postCategory, position]);

  // 🚀 P0-4: IntersectionObserver — 50% 가시성 1초+ 충족 시 viewable 이벤트
  //   viewableFiredRef로 광고당 1회만 발사 (스크롤 반복 차단)
  useEffect(() => {
    const adId = directAd?.id || auctionAd?.adId;
    if (!adId || !containerRef.current) return;
    if (viewableFiredRef.current.has(adId)) return;

    const target = containerRef.current;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const fireViewable = async () => {
      if (viewableFiredRef.current.has(adId)) return;
      viewableFiredRef.current.add(adId);
      // 🔧 2026-04-30: ref 동기 읽기 → await 직접 호출 (byRegion race 차단)
      const viewerRegion = await getViewerRegion();
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
          viewerRegion,
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

  // ⚡ 성능 2026-07-02: 로드 게이트 IntersectionObserver — sentinel(gateRef)이 뷰포트 200px 이내 진입 시
  //   hasEnteredViewport=true로 승격하고 즉시 disconnect(1회성). 이 관찰자는 회계 이벤트를 발사하지 않으며
  //   viewable 회계용 IO(50%·1초)와 완전히 분리됨 → viewable/impression/click 카운트 의미 불변.
  //   above-fold top 슬롯은 200px 마진으로 마운트 직후 즉시 진입 → 지연 없이 로드.
  useEffect(() => {
    if (hasEnteredViewport) return;
    const sentinel = gateRef.current;
    if (!sentinel) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setHasEnteredViewport(true);
        io.disconnect();
      }
    }, { rootMargin: '200px' });
    io.observe(sentinel);
    return () => io.disconnect();
  }, [hasEnteredViewport]);

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
  const handleAdClick = async (adId: string, bidAmount?: number, bidType?: 'cpm' | 'cpc') => {
    if (!postId) return;
    // 🔧 2026-04-30: ref 동기 읽기 → await 직접 호출 (byRegion race 차단)
    //   AdBanner.handleClick은 onClick?.()을 fire-and-forget으로 호출 후 즉시 window.open — popup blocker 회피 OK
    const viewerRegion = await getViewerRegion();
    const viewerUid = auth.currentUser?.uid || 'anonymous';
    fetch(AD_AUCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventType: 'click', adId, postId, postAuthorId,
        postCategory, slotPosition: position,
        bidAmount, bidType, viewerUid,
        viewerRegion,
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

  // ⚡ 성능 2026-07-02: 뷰포트 진입 전(off-screen)에는 높이 0 sentinel을 렌더 → 로드 게이트 IO가 이 위치를 관찰.
  //   기존 `return null`은 관찰 대상 DOM이 없어 뷰포트 진입 감지가 불가(교착) → 반드시 요소를 마운트해야 함.
  //   클래스 없는 빈 div라 세로 공간 0(기존 null과 레이아웃 동일). off-screen엔 스켈레톤을 그리지 않음(불필요 페인트 방지).
  if (!hasEnteredViewport) return <div ref={gateRef} aria-hidden />;

  // ⚡ 성능(스켈레톤) 2026-07-02: 뷰포트 진입 후 ~ 경매 fetch 완료 전(loaded=false)에는 펄스 스켈레톤 렌더.
  //   AdBanner 높이(h-20) 근사 → 로딩→광고 교체 시 레이아웃 점프 최소화. gateRef 미부착(로드 게이트 IO는 이미 발사됨).
  //   회계 이벤트(impression/viewable/click) 없음 — 순수 시각 placeholder.
  if (!loaded) {
    return (
      <div className="my-4">
        <div className="h-20 w-full rounded-xl bg-slate-100 border border-slate-200 animate-pulse flex items-center px-4">
          <div className="h-10 w-full bg-slate-200/70 rounded-lg" />
        </div>
      </div>
    );
  }

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
