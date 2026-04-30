// src/components/ads/AdFeedCard.tsx — 글 목록 그리드 인라인 광고 카드
// 🚀 ADSMARKET v3 (2026-04-30): 피드 인라인 광고 (Native In-feed Ad)
//   - 일반 PostCard와 시각적 일관성 (rounded-xl border, 280px+, hover 효과)
//   - violet 톤으로 광고 구분 + 좌상단 📢 광고 배지 (Brand Safety 정책)
//   - postId='feed-{categoryKey}' 합성 (글 작성자 무관, 100% 플랫폼 수익)
//   - 매칭: slotPosition='feed' + postCategory + viewerRegion + viewerUid
//   - 이벤트: viewable(IO 50%·1초+) + click(window.open + UTM)
//   - 광고 없으면 null 반환 → grid auto-fill로 자연스럽게 다른 카드가 채움

import { useState, useEffect, useRef } from 'react';
import { auth } from '../../firebase';
import { getViewerRegion } from '../../utils/getViewerRegion';

const AD_AUCTION_URL = 'https://adauction-uqukvdmr2q-du.a.run.app';
const VIEWABLE_VISIBILITY_RATIO = 0.5;
const VIEWABLE_DURATION_MS = 1000;

interface AuctionResult {
  adId: string;
  headline: string;
  description: string;
  imageUrl: string;
  landingUrl: string;
  ctaText: string;
  bidType: 'cpm' | 'cpc';
  chargeAmount: number;
  advertiserName: string;
}

interface Props {
  // 카테고리 키 — 홈 피드는 빈 문자열, 카테고리 뷰는 카테고리명 (예: '너와 나의 이야기')
  postCategory?: string;
  // postId 합성용 식별자 — 'home' 또는 카테고리명
  feedKey: string;
  // 🚀 ADSMARKET v3 (2026-04-30): 광고주 작성 폼 미리보기용 정적 광고 — 매칭 fetch + 이벤트 모두 skip
  previewAd?: {
    headline: string;
    description: string;
    imageUrl: string;
    ctaText: string;
    advertiserName?: string;
  };
}

// 광고주 landingUrl protocol 자동 부착 + UTM 자동 부착 (AdBanner와 동일 정책)
function ensureProtocol(url: string): string {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('//')) return 'https:' + url;
  return 'https://' + url;
}

function appendUTM(landingUrl: string, adId: string): string {
  const safeUrl = ensureProtocol(landingUrl);
  if (!safeUrl) return '#';
  try {
    const u = new URL(safeUrl);
    if (!u.searchParams.has('utm_source')) u.searchParams.set('utm_source', 'geulove');
    if (!u.searchParams.has('utm_medium')) u.searchParams.set('utm_medium', 'feed');
    if (!u.searchParams.has('utm_campaign')) u.searchParams.set('utm_campaign', adId);
    return u.toString();
  } catch {
    return safeUrl;
  }
}

const AdFeedCard = ({ postCategory = '', feedKey, previewAd }: Props) => {
  const [auctionAd, setAuctionAd] = useState<AuctionResult | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewableFiredRef = useRef<Set<string>>(new Set());

  // 🚀 매칭 — slotPosition='feed' 분기로 auction.js 호출
  //   previewAd 있으면 fetch 없이 정적 광고로 즉시 set (광고주 작성 폼 미리보기 전용)
  useEffect(() => {
    if (previewAd) {
      setAuctionAd({
        adId: 'preview',
        headline: previewAd.headline,
        description: previewAd.description,
        imageUrl: previewAd.imageUrl,
        landingUrl: '#',
        ctaText: previewAd.ctaText,
        bidType: 'cpm',
        chargeAmount: 0,
        advertiserName: previewAd.advertiserName || '',
      });
      return;
    }
    let cancelled = false;
    (async () => {
      const viewerRegion = await getViewerRegion();
      const viewerUid = auth.currentUser?.uid || 'anonymous';
      const postId = `feed-${feedKey}`;
      try {
        const r = await fetch(AD_AUCTION_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slotPosition: 'feed',
            postCategory,
            postId,
            postAuthorId: '',
            postAuthorLevel: 0,
            viewerRegion,
            viewerUid,
          }),
        });
        const data = await r.json();
        if (cancelled) return;
        if (data.ad) setAuctionAd(data.ad);
      } catch {
        // 광고 매칭 실패 — null 유지 (그리드 셀 자연 비움)
      }
    })();
    return () => { cancelled = true; };
  }, [postCategory, feedKey, previewAd]);

  // 🚀 IntersectionObserver — 50% 가시성 1초+ → viewable 이벤트 (광고당 1회)
  //   previewAd 있으면 미리보기 모드 — IO 등록 skip (이벤트 발사 차단)
  useEffect(() => {
    const adId = auctionAd?.adId;
    if (!adId || !containerRef.current || previewAd) return;
    if (viewableFiredRef.current.has(adId)) return;

    const target = containerRef.current;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const fireViewable = async () => {
      if (viewableFiredRef.current.has(adId)) return;
      viewableFiredRef.current.add(adId);
      const viewerRegion = await getViewerRegion();
      const viewerUid = auth.currentUser?.uid || 'anonymous';
      fetch(AD_AUCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: 'viewable',
          adId,
          postId: `feed-${feedKey}`,
          postAuthorId: '',
          postCategory,
          slotPosition: 'feed',
          bidAmount: auctionAd.chargeAmount,
          bidType: auctionAd.bidType,
          viewerUid,
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
  }, [auctionAd, postCategory, feedKey, previewAd]);

  if (!auctionAd) return null;

  const handleClick = async () => {
    const viewerRegion = await getViewerRegion();
    const viewerUid = auth.currentUser?.uid || 'anonymous';
    fetch(AD_AUCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventType: 'click',
        adId: auctionAd.adId,
        postId: `feed-${feedKey}`,
        postAuthorId: '',
        postCategory,
        slotPosition: 'feed',
        bidAmount: auctionAd.chargeAmount,
        bidType: auctionAd.bidType,
        viewerUid,
        viewerRegion,
      }),
    }).catch(() => {});
    const finalUrl = appendUTM(auctionAd.landingUrl, auctionAd.adId);
    if (finalUrl === '#') return;
    window.open(finalUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      className="border border-violet-200 rounded-xl px-3.5 py-2 cursor-pointer hover:border-violet-400 hover:shadow-xl transition-all group flex flex-col shadow-sm bg-white"
    >
      {/* 1. 최상단 — 📢 광고 배지 (시간 자리) + 헤드라인 (제목 자리) */}
      <div className="flex justify-between items-start mb-1 shrink-0">
        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
          <span className="text-[9px] font-black uppercase tracking-tighter text-violet-500">📢 광고</span>
          <h3 className="text-[15px] font-[1000] line-clamp-2 leading-tight tracking-tight text-slate-900 group-hover:text-violet-600 transition-colors">
            {auctionAd.headline}
          </h3>
        </div>
      </div>

      {/* 2. 본문 — description (광고주 설명 문구) */}
      {auctionAd.description && (
        <div className={`overflow-hidden mb-1 text-[13px] leading-relaxed font-medium text-slate-500 ${auctionAd.imageUrl ? 'line-clamp-2' : 'line-clamp-5'}`}>
          {auctionAd.description}
        </div>
      )}

      {/* 3. 이미지 — 광고주 imageUrl (있을 때만) */}
      {auctionAd.imageUrl && (
        <div className="w-full aspect-video rounded-lg overflow-hidden shrink-0 bg-slate-50 border border-violet-100 mb-1">
          <img src={auctionAd.imageUrl} alt="" className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500" />
        </div>
      )}

      {/* 4. 하단 — 광고주명 + CTA 버튼 (카테고리 자리 + 작성자 자리) */}
      <div className="pt-1 border-t mt-auto flex flex-col gap-0.5 shrink-0 border-violet-100">
        <div className="flex items-center justify-between gap-1.5">
          <span className="text-[9px] font-bold truncate tracking-tight text-slate-500 min-w-0">
            {auctionAd.advertiserName ? `광고주 · ${auctionAd.advertiserName}` : '스폰서 광고'}
          </span>
          <span className="text-[10px] font-black text-violet-600 bg-violet-50 px-2 py-0.5 rounded-lg border border-violet-200 shrink-0">
            {auctionAd.ctaText || '자세히 보기'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default AdFeedCard;
