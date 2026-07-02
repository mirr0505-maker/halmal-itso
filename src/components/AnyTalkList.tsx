// src/components/AnyTalkList.tsx
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { Post, UserData } from '../types';
import { formatKoreanNumber, getReputationLabel, getReputation, getCategoryDisplayName, calculateLevel } from '../utils';
import { sanitizeHtml, extractText, extractFirstImage } from '../sanitize';
import KanbuPromoCard from './KanbuPromoCard';
import KanbuPromoModal from './KanbuPromoModal';
// 🚀 ADSMARKET v3 (2026-04-30): 피드 인라인 광고 카드 (청크 4번째 다음에 인서트, 4:1 비율)
import AdFeedCard from './ads/AdFeedCard';
// ⚡ 2026-05-13 Perf Phase E-light: 그리드 카드를 분리·메모화한 컴포넌트로 위임 (한컷/잉크병 strip은 아직 inline)
import PostCardItem from './PostCardItem';
// 🚀 ADSMARKET v3.2 (per-page de-dup): 슬롯 수만큼 순차 prefetch — 페이지 내 광고 중복 차단
import { auth } from '../firebase';
import { getViewerRegion } from '../utils/getViewerRegion';
// 🔒 P1 2026-07-02: linkUrl 스킴 검증 (javascript: 등 저장형 XSS 차단)
import { safeExternalUrl, safeHostname } from '../utils/safeUrl';

const AD_AUCTION_URL = 'https://adauction-uqukvdmr2q-du.a.run.app';

interface PrefetchedAd {
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
  posts: Post[];
  onTopicClick: (post: Post) => void;
  onLikeClick?: (e: React.MouseEvent, postId: string) => void;
  commentCounts?: Record<string, number>;
  currentNickname?: string;
  currentUserData?: UserData | null;
  allUsers?: Record<string, UserData>;
  followerCounts?: Record<string, number>;
  tab?: string;
  onAuthorClick?: (author: string) => void;
  // 🚀 한컷 인라인 섹션: 탭별 필터된 한컷 목록 + 더보기 콜백
  allPosts?: Post[];
  oneCutPosts?: Post[];
  onOneCutMoreClick?: () => void;
  // 🚀 깐부맺기 인라인 섹션
  onFriendsMoreClick?: () => void;
  friends?: string[];
  onToggleFriend?: (nickname: string) => void;
  // 🖋️ 잉크병 인라인 섹션: 탭별 필터된 회차 목록 + 더보기 콜백
  inkwellPosts?: Post[];
  onInkwellMoreClick?: () => void;
  // 🚀 공유수 카운트: URL 복사 버튼 클릭 시 호출 → posts.shareCount + users.totalShares +1
  onShareCount?: (postId: string, authorId?: string) => void;
  // 🚀 ADSMARKET v3 (2026-04-30): 피드 인라인 광고 — 카테고리 뷰·홈 등록글 탭에만 ON
  showAds?: boolean;
  feedKey?: string;          // postId 합성용 ('home-recent' / 카테고리명 등)
  feedCategory?: string;     // 광고 매칭 postCategory (홈 mixed=빈문자열, 카테고리 뷰=카테고리명)
  // ⚡ 2026-05-13 Perf Phase 1.5: 렌더 상한 (default 200). 누적 글 폭증 시 DOMParser × 카드 수 폭발 차단.
  //   호출부별 다른 cap 필요하면 prop으로 오버라이드. 전령 카테고리는 App.tsx에서 이미 slice(0,200) — 이중 안전망.
  maxPosts?: number;
}

const AnyTalkList = ({
  posts: rawPosts, onTopicClick, onLikeClick, commentCounts = {}, currentNickname, currentUserData, allUsers = {}, followerCounts = {}, tab, onAuthorClick, onShareCount,
  allPosts = [], oneCutPosts, onOneCutMoreClick, onFriendsMoreClick, friends = [], onToggleFriend,
  inkwellPosts, onInkwellMoreClick,
  showAds = false, feedKey = 'home', feedCategory = '',
  maxPosts = 200,
}: Props) => {
  const isNewTab = tab === 'any';
  // ⚡ 2026-05-13 Perf Phase 1.5: 입력 posts를 maxPosts(default 200)로 상한.
  //   호출부 변경 없이 모든 페이지(홈/카테고리/작가/공개프로필) 일괄 보호. 200건 이후는 잘림(검색/랭킹은 별 경로라 무관).
  const posts = rawPosts.length > maxPosts ? rawPosts.slice(0, maxPosts) : rawPosts;

  // 🚀 목록 카드 공유 버튼: 복사된 카드 ID를 추적해 해당 카드에만 피드백 표시
  const [copiedPostId, setCopiedPostId] = useState<string | null>(null);
  // 🚀 깐부맺기 홍보 모달
  const [selectedPromoUser, setSelectedPromoUser] = useState<UserData | null>(null);

  // ✨ 2026-05-16 빈 공간 fix v5: chunk 크기를 columnCount 정수배로 동적 고정
  //   v4 한계: chunk 8개 + 광고 1개 = 9 cell → 4-col grid에서 9%4=1, 마지막 row에 invisible placeholder 3개
  //     placeholder는 visibility:hidden이라 자리만 차지 → 시각적 빈 3 cell이 반복 노출됨 (사용자 보고)
  //   v5: showAds=true면 chunk = columnCount * 2 - 1 (광고 1개 포함 시 정확히 columnCount * 2 = 2 row)
  //       showAds=false면 chunk = columnCount * 2 (자체로 2 row 채움)
  //       광고 위치 idx === columnCount - 1 (첫 row 끝 = 5번째 카드 위치 유지)
  //       → placeholder 루프 자체 불필요 → 빈 공간 시각 완전 제거
  const gridRef = useRef<HTMLDivElement>(null);
  const [columnCount, setColumnCount] = useState(4); // 초기 4 가정 (ResizeObserver로 즉시 보정)
  useEffect(() => {
    const update = () => {
      const el = gridRef.current;
      if (!el) return;
      const cs = window.getComputedStyle(el);
      const tracks = cs.gridTemplateColumns.split(' ').filter(s => s && s !== '0px').length;
      if (tracks > 0 && tracks !== columnCount) setColumnCount(tracks);
    };
    update();
    const ro = new ResizeObserver(update);
    const el = gridRef.current;
    if (el) ro.observe(el);
    return () => ro.disconnect();
  }, [columnCount]);

  // ✨ v5: chunk 크기·광고 위치를 columnCount에 맞춰 동적으로 계산
  //   showAds면 광고 1개 포함해서 정확히 2 row, 광고는 첫 row 끝(columnCount번째 글 다음)
  const POST_CHUNK = showAds ? Math.max(columnCount * 2 - 1, columnCount) : columnCount * 2;
  const adInsertIdx = columnCount - 1;

  // 🚀 ADSMARKET v3.2 (per-page de-dup): 슬롯 수만큼 순차 prefetch — 페이지 내 광고 중복 차단
  //   각 슬롯이 직전 winner를 excludeAdIds로 누적 전달 → N슬롯이면 N종 광고 (또는 풀 부족 시 빈 슬롯)
  const adSlotCount = (() => {
    if (!showAds) return 0;
    let count = 0;
    for (let i = 0; i < posts.length; i += POST_CHUNK) {
      if (posts.length - i > adInsertIdx) count += 1; // chunk가 첫 row를 채울 만큼일 때만 광고 슬롯
    }
    return count;
  })();
  const [feedAds, setFeedAds] = useState<(PrefetchedAd | null)[]>([]);
  // ⚡ 성능(스켈레톤) 2026-07-02: 경매 prefetch 진행 중 여부 — true면 AdFeedCard에 undefined를 전달해 스켈레톤 렌더.
  //   fetch 완료 후 false로 내려 실제 광고(또는 null=fallback 카드)로 교체 → 로딩과 "광고 없음"을 시각적으로 구분.
  const [adsLoading, setAdsLoading] = useState(false);
  useEffect(() => {
    if (!showAds || adSlotCount === 0) {
      setFeedAds([]);
      setAdsLoading(false);
      return;
    }
    // ⚡ 성능(스켈레톤) 2026-07-02: async prefetch 루프 시작 직전에 로딩 플래그 ON
    setAdsLoading(true);
    let cancelled = false;
    (async () => {
      const viewerRegion = await getViewerRegion();
      const viewerUid = auth.currentUser?.uid || 'anonymous';
      const exclude: string[] = [];
      const ads: (PrefetchedAd | null)[] = [];
      for (let i = 0; i < adSlotCount; i++) {
        if (cancelled) return;
        const postId = `feed-${feedKey}-${i}`;
        try {
          const r = await fetch(AD_AUCTION_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              slotPosition: 'feed',
              postCategory: feedCategory,
              postId,
              postAuthorId: '',
              postAuthorLevel: 0,
              viewerRegion,
              viewerUid,
              excludeAdIds: exclude,
            }),
          });
          const data = await r.json();
          const ad: PrefetchedAd | null = data?.ad ? data.ad : null;
          ads.push(ad);
          if (ad?.adId) exclude.push(ad.adId);
        } catch {
          ads.push(null); // 매칭 실패 시 빈 슬롯
        }
      }
      // ⚡ 성능(스켈레톤) 2026-07-02: 성공 완료 경로 — 결과 반영과 동시에 로딩 플래그 OFF
      if (!cancelled) { setFeedAds(ads); setAdsLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [showAds, adSlotCount, feedKey, feedCategory]);

  // ⚡ Phase E-light: useCallback로 stable 참조 — PostCardItem React.memo 적중률 향상
  //   onShareCount/posts 의존성: 클릭 시점 posts.find를 통해 author_id를 즉시 조회 (post.find 자체는 카드별 1회)
  const handleCopyUrl = useCallback((e: React.MouseEvent, postId: string) => {
    e.stopPropagation();
    const shareToken = postId.split('_').slice(0, 2).join('_');
    const shareUrl = `${window.location.origin}/p/${shareToken}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopiedPostId(postId);
      setTimeout(() => setCopiedPostId(null), 2000);
      const postObj = posts.find(p => p.id === postId);
      onShareCount?.(postId, postObj?.author_id);
    });
  }, [posts, onShareCount]);

  // ⚡ 성능 2026-07-02: goldHeartCount(좋아요 유저 레벨 스캔)를 렌더 루프 안에서 카드마다 재계산하면
  //   PostCardItem memo가 감싸기 전 단계라 O(likedBy)×카드수 비용이 매 렌더 발생 → posts/allUsers 변할 때만 집계하는 맵으로 캐시
  const goldHeartMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const post of posts) {
      map[post.id] = (post.likedBy || []).filter(nickname => {
        const ud = allUsers[`nickname_${nickname}`];
        return ud && calculateLevel(ud.exp || 0) >= 5;
      }).length;
    }
    return map;
  }, [posts, allUsers]);

  // ⚡ 성능 2026-07-02: 깐부맺기 홍보 대상(promoEnabled + 미만료) 스캔을 매 렌더마다 Object.entries(allUsers) 순회하지 않도록 useMemo 캐시
  const promoUsers = useMemo(() => {
    const now = Date.now();
    // 🚀 nickname_ 접두사 문서 제외 (UID 키 문서만 사용) + 중복 방지
    const seen = new Set<string>();
    return Object.entries(allUsers).filter(([key, u]) => {
      if (key.startsWith('nickname_')) return false;
      const p = u as unknown as { promoEnabled?: boolean; promoExpireAt?: { seconds: number } };
      if (!p.promoEnabled) return false;
      if (p.promoExpireAt && p.promoExpireAt.seconds * 1000 < now) return false;
      if (seen.has(u.nickname)) return false;
      seen.add(u.nickname);
      return true;
    }).map(([, u]) => u).slice(0, 4);
  }, [allUsers]);

  // 본문 텍스트 존재 확인 (한컷/잉크병 인라인 strip 카드 — PostCardItem 외부 영역에서 사용)
  const hasText = (html: string) => !!extractText(html).trim();

  // 상대 시간 포맷 (인라인 strip 카드용)
  const formatRelativeTime = (timestamp: { seconds: number } | null | undefined) => {
    if (!timestamp) return "방금 전";
    const now = new Date();
    const createdAt = new Date(timestamp.seconds * 1000);
    const diffInHours = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60));
    if (diffInHours < 1) return "방금 전";
    if (diffInHours < 24) return `${diffInHours}시간 전`;
    return createdAt.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' });
  };

  // 🚀 인터리브 레이아웃: 일반글 chunk마다 한컷·잉크병 스트립 삽입
  //   ✨ v5(2026-05-16): POST_CHUNK는 위에서 columnCount 기반 동적 결정 (showAds면 광고 1개 포함 2 row)
  const postChunks: Post[][] = [];
  for (let i = 0; i < posts.length; i += POST_CHUNK) postChunks.push(posts.slice(i, i + POST_CHUNK));
  if (postChunks.length === 0) postChunks.push([]); // 일반글 없어도 한컷 표시용

  return (
    // ✨ 2026-05-15 빈 공간 fix v4: dense 제거 + sparse 복원 + chunk별 invisible placeholder
    //   v3 한계: dense flow가 chunk별 element 수 따라 동적 packing → 빈 공간 발생/소실 비일관
    //   v4: sparse 동작 + 각 chunk 끝에 columnCount 정수배 맞춤 placeholder → 빈 공간 항상 없음
    <div ref={gridRef} className="w-full pb-20 grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-2">
      {postChunks.map((chunk, ci) => {
        const stripCuts = (oneCutPosts || []).slice(ci * 4, ci * 4 + 4);
        // 🖋️ 잉크병 스트립도 한컷과 동일한 슬라이싱 패턴 (청크당 4개씩 반복)
        const stripInkwell = (inkwellPosts || []).slice(ci * 4, ci * 4 + 4);
        return (
          <React.Fragment key={ci}>
            {chunk.length === 0 && ci === 0 ? (
              <div className={`col-span-full text-center text-slate-500 font-bold text-sm italic ${oneCutPosts && oneCutPosts.length > 0 ? 'py-10' : 'py-40'}`}>첫 번째 이야기를 기다리고 있어요!</div>
            ) : (
              chunk.map((post, idx) => {
          const commentCount = commentCounts[post.id] || 0;
          const isLikedByMe = !!(currentNickname && post.likedBy?.includes(currentNickname));
          // 실시간 사용자 데이터 바인딩 — 카드 내부 표시용
          const authorData = (post.author_id && allUsers[post.author_id]) || allUsers[`nickname_${post.author}`];
          const realFollowers = followerCounts[post.author] || 0;
          // ⚡ 성능 2026-07-02: 상단 goldHeartMap useMemo에서 사전 집계된 값 조회 (렌더 루프 내 재스캔 제거)
          const goldHeartCount = goldHeartMap[post.id] || 0;

          return (
            <React.Fragment key={post.id}>
            <PostCardItem
              post={post}
              isNewTab={isNewTab}
              commentCount={commentCount}
              isLikedByMe={isLikedByMe}
              authorData={authorData}
              realFollowers={realFollowers}
              goldHeartCount={goldHeartCount}
              isCopied={copiedPostId === post.id}
              onTopicClick={onTopicClick}
              onLikeClick={onLikeClick}
              onAuthorClick={onAuthorClick}
              onCopyUrl={handleCopyUrl}
            />
            {/* 🚀 ADSMARKET v3 (2026-04-30): 첫 row 끝(columnCount번째 글 다음)에 피드 인라인 광고 카드 */}
            {/* 🚀 v3.2 (per-page de-dup): AnyTalkList가 prefetch한 광고를 슬롯 인덱스 = chunk 인덱스(ci)로 주입 */}
            {/* ✨ v5 (2026-05-16): chunk 크기를 columnCount*2-1로 맞춰 광고 1개 포함 정확히 2 row → 빈 공간 0 */}
            {showAds && idx === adInsertIdx && chunk.length > adInsertIdx && (
              <AdFeedCard
                postCategory={feedCategory}
                feedKey={`${feedKey}-${ci}`}
                prefetchedAd={adsLoading ? undefined : (feedAds[ci] !== undefined ? feedAds[ci] : null)}
              />
            )}
            </React.Fragment>
          );
              })
            )}

            {/* 🚀 한컷 인터리브 스트립: 일반글 2줄(8개)마다 한컷 4개 삽입, 더보기→한컷 메뉴 — col-span-full로 전체 행 차지 */}
            {stripCuts.length > 0 && (
              <div className="col-span-full my-2 py-2">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[13px] font-[1000] text-slate-700 flex items-center gap-1.5">
                    🍞 빵부스러기
                  </span>
                  <button onClick={onOneCutMoreClick} className="text-[11px] font-bold text-slate-500 hover:text-violet-600 transition-colors flex items-center gap-0.5">
                    빵부스러기 <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
                  </button>
                </div>
                {/* 🚀 한컷 인라인 카드: OneCutList.tsx와 동일 형태 (이미지+제목+작성자+좋아요) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {stripCuts.map(post => {
                    const isLikedByMe = currentNickname && post.likedBy?.includes(currentNickname);
                    const authorData = (post.author_id && allUsers[post.author_id]) || allUsers[`nickname_${post.author}`];
                    const realFollowers = followerCounts[post.author] || 0;
                    const displayLevel = calculateLevel(authorData?.exp || 0);
                    const displayLikes = authorData ? authorData.likes : (post.authorInfo?.totalLikes || 0);
                    // 연결된 원본글 찾기 (OneCutList와 동일)
                    const linkedPost = post.linkedPostId ? allPosts.find(p => p.id === post.linkedPostId) : null;
                    return (
                      <div
                        key={post.id}
                        onClick={() => onTopicClick(post)}
                        className="group flex flex-col bg-white rounded-[4px] overflow-hidden cursor-pointer shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-300"
                      >
                        {/* 이미지 */}
                        <div className="relative aspect-[16/9] overflow-hidden bg-slate-900 shrink-0 border-b border-slate-100">
                          {(() => {
                            // 🍞 헨젤의 빵부스러기 — imageUrls[0] 우선, fallback으로 imageUrl
                            const thumb = post.imageUrls?.[0] || post.imageUrl;
                            const cutCount = post.imageUrls?.length ?? (post.imageUrl ? 1 : 0);
                            return (
                              <>
                                {thumb ? (
                                  <img src={thumb} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-700">
                                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                  </div>
                                )}
                                {cutCount > 0 && (
                                  <span className="absolute top-2 left-2 px-2 py-0.5 bg-black/60 backdrop-blur-sm text-white text-[10px] font-black rounded-full">
                                    <span className="grayscale opacity-90">🍞</span> 1/{cutCount}
                                  </span>
                                )}
                              </>
                            );
                          })()}
                        </div>
                        {/* 제목 + 작성자 + 통계 바 */}
                        <div className="flex-1 px-3 pt-2.5 pb-2 flex flex-col gap-1 bg-white">
                          <h3 className="text-[13px] font-[1000] text-slate-900 line-clamp-1 tracking-tighter leading-tight group-hover:text-blue-600 transition-colors">
                            {post.title}
                          </h3>
                          {/* 원본글 링크 — 없어도 높이 확보 (카드 세로 사이즈 통일) */}
                          <div className="pt-1 min-h-[22px]">
                            {linkedPost ? (
                              <div className="flex items-center gap-1 text-blue-600 bg-blue-50/50 px-2 py-0.5 rounded-[2px] border border-blue-100/20">
                                <span className="text-[8px]">🔗</span>
                                <span className="text-[8px] font-black truncate tracking-tighter">{linkedPost.title}</span>
                              </div>
                            ) : post.linkUrl ? (
                              <a href={safeExternalUrl(post.linkUrl) ?? undefined} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                                className="flex items-center gap-1 text-blue-600 bg-blue-50/50 px-2 py-0.5 rounded-[2px] border border-blue-100/20 hover:bg-blue-50 transition-colors">
                                <span className="text-[8px]">🔗</span>
                                <span className="text-[8px] font-black truncate tracking-tighter">{safeHostname(post.linkUrl) || '원본글'}</span>
                              </a>
                            ) : null}
                          </div>
                          {/* 하단: 일반 글카드와 완전 동일 구조 */}
                          <div className="flex-1" />
                          <div className="pt-1 border-t border-slate-100 flex items-center justify-between">
                            <div
                              className="flex items-center gap-1.5 min-w-0 cursor-pointer hover:opacity-70 transition-opacity"
                              onClick={(e) => { e.stopPropagation(); onAuthorClick?.(post.author); }}
                            >
                              <div className="w-6 h-6 rounded-full bg-slate-50 overflow-hidden shrink-0 border border-white shadow-sm ring-1 ring-slate-100">
                                <img src={authorData?.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${post.author}`} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="text-[11px] font-[1000] text-slate-900 truncate leading-none mb-0.5">{post.author}</span>
                                <span className="text-[9px] font-bold text-slate-500 truncate tracking-tight">Lv {displayLevel} · {getReputationLabel(authorData ? getReputation(authorData) : displayLikes)} · 깐부수 {formatKoreanNumber(realFollowers)}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 text-[10px] font-black text-slate-500">
                              <span className="flex items-center gap-1">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                                {formatKoreanNumber(commentCounts[post.id] || 0)}
                              </span>
                              {(post.thanksballTotal || 0) > 0 && (
                                <span className="flex items-center gap-0.5 text-amber-400">
                                  <span className="text-[13px]">⚾</span> {post.thanksballTotal}
                                </span>
                              )}
                              <span
                                onClick={(e) => { e.stopPropagation(); onLikeClick?.(e, post.id); }}
                                className={`flex items-center gap-1 cursor-pointer transition-colors ${isLikedByMe ? 'text-rose-500' : 'hover:text-rose-400'}`}
                              >
                                <svg className={`w-3.5 h-3.5 ${isLikedByMe ? 'fill-current' : 'fill-none'}`} stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
                                {formatKoreanNumber(post.likes || 0)}
                              </span>
                              {/* 공유 버튼 — hover 시 노출, 클릭 시 URL 복사 */}
                              <button
                                onClick={(e) => handleCopyUrl(e, post.id)}
                                className={`flex items-center gap-0.5 transition-all ${copiedPostId === post.id ? 'opacity-100 text-emerald-500' : 'opacity-0 group-hover:opacity-100 text-slate-500 hover:text-blue-400'}`}
                                title="글 링크 복사"
                              >
                                {copiedPostId === post.id
                                  ? <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"/></svg>
                                  : <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
                                }
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 🖋️ 잉크병 인터리브 스트립: 한컷 다음 줄, 4개씩 청크 반복 — col-span-full */}
            {stripInkwell.length > 0 && (
              <div className="col-span-full my-2 py-2">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[13px] font-[1000] text-slate-700 flex items-center gap-1.5">
                    🖋️ 잉크병
                  </span>
                  <button onClick={onInkwellMoreClick} className="text-[11px] font-bold text-slate-500 hover:text-violet-600 transition-colors flex items-center gap-0.5">
                    잉크병 <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {stripInkwell.map(post => {
                    const isLikedByMe = currentNickname && post.likedBy?.includes(currentNickname);
                    const authorData = (post.author_id && allUsers[post.author_id]) || allUsers[`nickname_${post.author}`];
                    const realFollowers = followerCounts[post.author] || 0;
                    const displayLevel = calculateLevel(authorData?.exp || 0);
                    const displayLikes = authorData ? (authorData.likes || 0) : (post.authorInfo?.totalLikes || 0);
                    // 🖋️ 잉크병 유료 회차는 posts.content가 빈 문자열 → previewContent fallback
                    const inkwellCardContent = (post.isPaid && !hasText(post.content) && post.previewContent)
                      ? `<p>${post.previewContent}</p>`
                      : post.content;
                    const hasInkwellContent = hasText(inkwellCardContent);
                    const inkwellImage = post.imageUrl || extractFirstImage(post.content);
                    const commentCount = commentCounts[post.id] || 0;
                    return (
                      <div
                        key={post.id}
                        onClick={() => onTopicClick(post)}
                        className="border border-slate-300 rounded-xl px-3.5 py-2 cursor-pointer hover:border-blue-400 hover:shadow-xl transition-all group flex flex-col shadow-sm bg-white"
                      >
                        {/* 1. 최상단: 시간 + 제목 (일반 글카드 동일 구조) */}
                        <div className="flex justify-between items-start mb-1 shrink-0">
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <span className="text-[9px] font-black uppercase tracking-tighter text-slate-500">{formatRelativeTime(post.createdAt)}</span>
                            <h3 className="text-[15px] font-[1000] line-clamp-2 leading-tight tracking-tight text-slate-900 group-hover:text-blue-600 transition-colors">
                              {post.episodeTitle || post.title}
                            </h3>
                          </div>
                        </div>

                        {/* 2. 중간: 본문 미리보기 — HTML 렌더 (일반 글카드 동일) */}
                        {hasInkwellContent && (
                          <div
                            className={`overflow-hidden mb-1 text-[13px] leading-relaxed font-medium text-slate-500 [&_img]:hidden [&_p]:mb-1 [&_p:last-child]:mb-0 [&_strong]:font-bold [&_em]:italic [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_h1]:text-[14px] [&_h1]:font-bold [&_h2]:text-[13px] [&_h2]:font-bold [&_h3]:text-[13px] [&_h3]:font-semibold ${inkwellImage ? 'line-clamp-3' : 'line-clamp-6'}`}
                            dangerouslySetInnerHTML={{ __html: sanitizeHtml(inkwellCardContent) }}
                          />
                        )}

                        {/* 3. 이미지 — 있는 경우만 */}
                        {inkwellImage && (
                          <div className="w-full aspect-video rounded-lg overflow-hidden shrink-0 bg-slate-50 border border-slate-300 mb-1">
                            <img src={inkwellImage} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                          </div>
                        )}

                        {/* 4. 최하단: 카테고리 + 아바타/유저정보 + 통계(땡스볼/좋아요/댓글) */}
                        <div className="pt-1 border-t mt-auto flex flex-col gap-0.5 shrink-0 border-slate-100">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[8px] font-[1000] text-blue-500 bg-blue-50 px-2 py-0.5 rounded-md uppercase tracking-widest border border-blue-100/30">
                              {getCategoryDisplayName(post.category)}
                            </span>
                            {post.episodeNumber && (
                              <span className="text-[8px] font-[1000] text-purple-600 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-md">
                                📖 {post.episodeNumber}화
                              </span>
                            )}
                            {/* 🖋️ 유료/무료 뱃지 — 붉은색(유료) / 파란색(무료) */}
                            {post.isPaid ? (
                              <span className="text-[8px] font-[1000] text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">
                                🔒 유료 🏀{post.price || 0}
                              </span>
                            ) : (
                              <span className="text-[8px] font-[1000] text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                                🆓 무료
                              </span>
                            )}
                          </div>

                          <div className="flex items-center justify-between">
                            <div
                              className="flex items-center gap-1.5 min-w-0 cursor-pointer hover:opacity-70 transition-opacity"
                              onClick={(e) => { e.stopPropagation(); onAuthorClick?.(post.author); }}
                            >
                              <div className="w-6 h-6 rounded-full bg-slate-50 overflow-hidden shrink-0 border border-white shadow-sm ring-1 ring-slate-100">
                                <img src={authorData?.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${post.author}`} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="text-[11px] font-[1000] text-slate-900 truncate leading-none mb-0.5">{post.author}</span>
                                <span className="text-[9px] font-bold text-slate-500 truncate tracking-tight">
                                  Lv {displayLevel} · {getReputationLabel(authorData ? getReputation(authorData) : displayLikes)} · 깐부수 {formatKoreanNumber(realFollowers)}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 text-[10px] font-black shrink-0 text-slate-500">
                              <span className="flex items-center gap-1">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                                {formatKoreanNumber(commentCount)}
                              </span>
                              {(post.thanksballTotal || 0) > 0 && (
                                <span className="flex items-center gap-0.5 text-amber-400">
                                  <span className="text-[13px]">⚾</span> {post.thanksballTotal}
                                </span>
                              )}
                              <span
                                onClick={(e) => { e.stopPropagation(); onLikeClick?.(e, post.id); }}
                                className={`flex items-center gap-1 cursor-pointer transition-colors ${isLikedByMe ? 'text-rose-500' : 'hover:text-rose-400'}`}
                              >
                                <svg className={`w-3.5 h-3.5 ${isLikedByMe ? 'fill-current' : 'fill-none'}`} stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
                                {formatKoreanNumber(post.likes || 0)}
                              </span>
                              {/* 🖋️ 공유 버튼 — 일반 글카드와 동일 위치 */}
                              <button
                                onClick={(e) => handleCopyUrl(e, post.id)}
                                className={`flex items-center gap-0.5 transition-all ${copiedPostId === post.id ? 'opacity-100 text-emerald-500' : 'opacity-0 group-hover:opacity-100 text-slate-400 hover:text-blue-400'}`}
                                title="글 링크 복사"
                              >
                                {copiedPostId === post.id
                                  ? <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"/></svg>
                                  : <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
                                }
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 🚀 깐부맺기 인터리브 스트립: 등록글/인기글/최고글에서만, 한컷 다음 줄 */}
            {ci === 0 && onFriendsMoreClick && ['any', 'recent', 'best', 'rank'].includes(tab || '') && (() => {
              // ⚡ 성능 2026-07-02: 홍보 대상 스캔은 상단 promoUsers useMemo로 승격 (매 렌더 Object.entries 순회 제거)
              if (promoUsers.length === 0) return null;
              return (
                <div className="col-span-full my-2 py-2">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[13px] font-[1000] text-slate-700 flex items-center gap-1.5">
                      🤝 깐부맺기
                    </span>
                    <button onClick={onFriendsMoreClick} className="text-[11px] font-bold text-slate-500 hover:text-violet-600 transition-colors flex items-center gap-0.5">
                      깐부맺기 <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {promoUsers.map(user => (
                      <KanbuPromoCard
                        key={user.uid}
                        userData={user as UserData & { promoImageUrl?: string; promoKeywords?: string[]; promoMessage?: string; promoExpireAt?: { seconds: number }; promoViewCount?: number }}
                        followerCount={followerCounts[user.nickname] || 0}
                        onClick={() => {
                          setSelectedPromoUser(user);
                          // 🚀 홍보 모달 조회수 카운트 (본인 제외)
                          if (user.uid !== (currentUserData?.uid || '')) {
                            import('firebase/firestore').then(({ doc: fbDoc, updateDoc: fbUpdate, increment: fbInc }) => {
                              import('../firebase').then(({ db: fbDb }) => {
                                fbUpdate(fbDoc(fbDb, 'users', user.uid), { promoViewCount: fbInc(1) }).catch(() => {});
                              });
                            });
                          }
                        }}
                      />
                    ))}
                  </div>
                </div>
              );
            })()}
          </React.Fragment>
        );
      })}
      {/* 🚀 깐부맺기 홍보 모달 */}
      {selectedPromoUser && currentNickname && (
        <KanbuPromoModal
          userData={selectedPromoUser as UserData & { promoImageUrl?: string; promoKeywords?: string[]; promoMessage?: string }}
          isFriend={friends.includes(selectedPromoUser.nickname)}
          isMutual={friends.includes(selectedPromoUser.nickname) && !!(selectedPromoUser.friendList && selectedPromoUser.friendList.includes(currentNickname))}
          onToggleFriend={() => { onToggleFriend?.(selectedPromoUser.nickname); setSelectedPromoUser(null); }}
          onViewProfile={() => { setSelectedPromoUser(null); onAuthorClick?.(selectedPromoUser.nickname); }}
          onClose={() => setSelectedPromoUser(null)}
        />
      )}
    </div>
  );
};

// ⚡ 성능 2026-07-02: 상위(App/useFirestoreActions)에서 posts·콜백 참조가 안정화되면 불필요 리렌더 차단 — React.memo로 감쌈 (props 미안정 상태여도 무해)
export default React.memo(AnyTalkList);
