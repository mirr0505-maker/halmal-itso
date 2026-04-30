// src/components/ads/AdMarketplaceModal.tsx — 광고 경매시장 모달
// 🚀 2026-04-26: 작성자가 글 작성 시 슬롯에 직접 광고를 매칭하는 갤러리 모달
// 🔧 2026-04-26 리팩터: 좌(그리드 2열 컴팩트 카드) + 우(미리보기 sticky 패널) 하이브리드.
//   기존 1줄 풀카드+미리보기 중복 제거 — 좌 카드 = 메타만, 우 패널 = AdBanner 풀.
// 🔧 2026-04-26 v2: hover 갱신 제거(떨림 차단) → 클릭 = preview만 갱신, 우측 [✓ 선택] = 최종 적용.
//   - 활성(status=active) 광고만 노출
//   - 검색(헤드라인·광고주) + 필터(메뉴 일치만) + 정렬
//   - 무한 스크롤 (IntersectionObserver, 20개 단위)
//   - 모바일: 1열 + 우측 패널 숨김, 인라인 펼침에 [✓ 선택] 버튼
import { useEffect, useState, useMemo, useRef } from 'react';
import { db } from '../../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import type { Ad } from '../../types';
import AdBanner from './AdBanner';
import { getViewerRegion } from '../../utils/getViewerRegion';

interface Props {
  slot: 'top' | 'middle' | 'bottom';
  currentSelectedAdId?: string;
  postCategory?: string;
  onSelect: (adId: string | null) => void;
  onClose: () => void;
}

const SLOT_LABEL: Record<string, string> = { top: '본문 상단', middle: '본문 하단', bottom: '댓글 끝' };
const PAGE_SIZE = 20;

// preview 상태 — 'auto'(자동 매칭) | string(광고 ID) | null(아직 아무것도 선택 안 함)
type PreviewState = 'auto' | string | null;

const AdMarketplaceModal = ({ slot, currentSelectedAdId, postCategory, onSelect, onClose }: Props) => {
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortMode, setSortMode] = useState<'price' | 'recent'>('price');
  const [search, setSearch] = useState('');
  const [menuMatchOnly, setMenuMatchOnly] = useState(false);
  // preview 초기값 = 현재 적용된 선택값 (open 시 그 광고가 우측에 보임)
  const [preview, setPreview] = useState<PreviewState>(currentSelectedAdId ?? 'auto');
  const [expandedAdId, setExpandedAdId] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState(1);
  // 🔧 v2.1+ (2026-04-28): 작성자 본인 region — region 비매칭 광고 정보 안내용 (차단 X)
  const [viewerRegion, setViewerRegion] = useState<string>('');
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    getViewerRegion().then(setViewerRegion).catch(() => {});
  }, []);

  useEffect(() => {
    // 🔧 v2.1 (2026-04-26): 슬롯 필터 제거 — 모든 활성 광고 표시
    //   매칭/비매칭은 카드 단계에서 시각 구분 (slotMatch 배지 + 회색 처리)
    //   비매칭 광고 선택 시 안내 후 자동매칭으로 fallback (광고주 슬롯 의도 보호)
    const q = query(collection(db, 'ads'), where('status', '==', 'active'));
    const unsub = onSnapshot(q, snap => {
      // 🚀 ADSMARKET v3 (2026-04-30): 피드 광고는 작성자 picker에서 제외 — 글 작성자 무관 광고이므로
      //   targetSlots = ['feed'] 단독 광고만 제외 (혼합 광고는 향후 차단되지만 과거 데이터 호환)
      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as Ad))
        .filter(ad => !(ad.targetSlots?.length === 1 && ad.targetSlots[0] === 'feed'));
      setAds(list);
      setLoading(false);
    }, err => { console.error('[AdMarketplaceModal]', err); setLoading(false); });
    return () => unsub();
  }, []);

  // 정렬·검색·메뉴 일치 필터
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = [...ads];
    if (q) {
      list = list.filter(ad =>
        (ad.headline || '').toLowerCase().includes(q) ||
        (ad.advertiserName || '').toLowerCase().includes(q) ||
        (ad.description || '').toLowerCase().includes(q)
      );
    }
    if (menuMatchOnly && postCategory) {
      list = list.filter(ad =>
        !ad.targetMenuCategories?.length || ad.targetMenuCategories.includes(postCategory)
      );
    }
    if (sortMode === 'price') list.sort((a, b) => (b.bidAmount || 0) - (a.bidAmount || 0));
    if (sortMode === 'recent') list.sort((a, b) => {
      const ta = (a.createdAt as { seconds?: number })?.seconds || 0;
      const tb = (b.createdAt as { seconds?: number })?.seconds || 0;
      return tb - ta;
    });
    if (postCategory && !menuMatchOnly) {
      list.sort((a, b) => {
        const aMatch = !a.targetMenuCategories?.length || a.targetMenuCategories.includes(postCategory);
        const bMatch = !b.targetMenuCategories?.length || b.targetMenuCategories.includes(postCategory);
        return Number(bMatch) - Number(aMatch);
      });
    }
    // 🔧 v2.1+: 노출 가능 광고(슬롯 매칭 + Brand Safety + 메뉴 허용)를 최우선 정렬
    const usableCheck = (ad: Ad) => {
      const slotOk = !!ad.targetSlots?.includes(slot);
      const safeOk = !ad.blockedCategories?.length || !postCategory || !ad.blockedCategories.includes(postCategory);
      const menuOk = !ad.targetMenuCategories?.length || (postCategory ? ad.targetMenuCategories.includes(postCategory) : true);
      return slotOk && safeOk && menuOk;
    };
    list.sort((a, b) => Number(usableCheck(b)) - Number(usableCheck(a)));
    return list;
  }, [ads, sortMode, postCategory, search, menuMatchOnly, slot]);

  // 🔧 v2.1+: 노출 가능 광고 카운트 (헤더 안내용) — 슬롯 매칭 + Brand Safety + 메뉴 허용
  const slotMatchCount = useMemo(() => ads.filter(a => {
    const slotOk = !!a.targetSlots?.includes(slot);
    const safeOk = !a.blockedCategories?.length || !postCategory || !a.blockedCategories.includes(postCategory);
    const menuOk = !a.targetMenuCategories?.length || (postCategory ? a.targetMenuCategories.includes(postCategory) : true);
    return slotOk && safeOk && menuOk;
  }).length, [ads, slot, postCategory]);

  const displayed = useMemo(() => filtered.slice(0, pageCount * PAGE_SIZE), [filtered, pageCount]);
  const hasMore = displayed.length < filtered.length;

  useEffect(() => {
    if (!hasMore) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) setPageCount(p => p + 1);
    }, { rootMargin: '120px' });
    io.observe(sentinel);
    return () => io.disconnect();
  }, [hasMore]);

  const previewAd = useMemo(() => {
    if (preview === 'auto' || preview === null) return null;
    return ads.find(a => a.id === preview) || null;
  }, [preview, ads]);

  const isMenuMatch = (ad: Ad) =>
    !ad.targetMenuCategories?.length || (postCategory && ad.targetMenuCategories.includes(postCategory));

  // 🔧 v2.1+ (2026-04-28): Brand Safety 차단 검사 — 글 카테고리가 광고의 차단 목록에 있으면 노출 불가
  const isBrandSafe = (ad: Ad) =>
    !ad.blockedCategories?.length || !postCategory || !ad.blockedCategories.includes(postCategory);
  // 🔧 v2.1+ (2026-04-28): 광고주 메뉴 매칭 강제 — 광고주가 특정 메뉴만 타겟팅한 경우 그 외 카테고리는 노출 불가
  const isMenuAllowed = (ad: Ad) =>
    !ad.targetMenuCategories?.length || (postCategory ? ad.targetMenuCategories.includes(postCategory) : true);
  // 🔧 v2.1+ (2026-04-28): region은 viewer IP 기반이라 작성자 본인이 차단되어도 다른 지역 독자에겐 노출 가능
  //   따라서 차단 X — 작성자 본인 region 비매칭 시 정보 안내(confirm)만
  const isRegionMatchForViewer = (ad: Ad) =>
    !ad.targetRegions?.length || !viewerRegion || ad.targetRegions.includes(viewerRegion);

  // 최종 적용 — 우측 [✓ 선택] 버튼 또는 모바일 카드 내부 [✓ 선택] 버튼
  // Why: 자동 매칭 결정 시 'auto' 명시값 저장 (default 미선택과 구분 — picker UI 피드백용)
  const handleConfirm = () => {
    if (preview === 'auto') onSelect('auto');
    else if (preview && previewAd) onSelect(preview);
    onClose();
  };
  const handleConfirmAd = (adId: string) => { onSelect(adId); onClose(); };
  const handleConfirmAuto = () => { onSelect('auto'); onClose(); };
  // 🔧 v2.1: 다른 슬롯 광고 선택 안내 — 광고주가 이 슬롯에 등록 안 했으므로 자동매칭 fallback
  const handleNonMatchClick = (ad: Ad) => {
    alert(
      `📌 안내\n\n"${ad.headline}" 광고는 광고주가 [${ad.targetSlots?.map(s => SLOT_LABEL[s] || s).join(', ') || '미지정'}] 슬롯에 등록한 광고예요.\n\n` +
      `현재 ${SLOT_LABEL[slot]} 슬롯에는 노출되지 않으므로 자동 매칭으로 결정됩니다.\n` +
      `이 광고를 노출하려면 광고주에게 ${SLOT_LABEL[slot]} 슬롯 추가를 요청해주세요.`
    );
  };
  // 🔧 v2.1+ (2026-04-28): Brand Safety 차단 광고 선택 안내
  const handleBlockedClick = (ad: Ad) => {
    alert(
      `🚫 노출 불가\n\n"${ad.headline}" 광고는 광고주가 [${(ad.blockedCategories || []).join(', ')}] 카테고리를 차단했어요.\n\n` +
      `현재 글 카테고리(${postCategory})에는 노출되지 않습니다. 자동 매칭으로 결정됩니다.\n` +
      `이 광고를 노출하려면 광고주가 차단 카테고리에서 제외하도록 요청해주세요.`
    );
  };
  // 🔧 v2.1+ (2026-04-28): 메뉴 비매칭 광고 선택 안내 — 광고주가 특정 메뉴만 타겟팅
  const handleMenuMismatchClick = (ad: Ad) => {
    alert(
      `🚫 노출 불가\n\n"${ad.headline}" 광고는 광고주가 [${(ad.targetMenuCategories || []).join(', ')}] 메뉴에만 노출되도록 설정했어요.\n\n` +
      `현재 글 카테고리(${postCategory})에는 노출되지 않습니다. 자동 매칭으로 결정됩니다.\n` +
      `이 광고를 노출하려면 광고주가 노출 메뉴를 추가하도록 요청해주세요.`
    );
  };
  // 🔧 v2.1+ (2026-04-28): region 비매칭 정보 안내 — 차단 X, 다른 지역 독자엔 정상 노출
  const handleRegionInfoConfirm = (ad: Ad): boolean => {
    return window.confirm(
      `ℹ️ 알림\n\n"${ad.headline}" 광고는 광고주가 [${(ad.targetRegions || []).join(', ')}] 지역만 타겟팅했어요.\n\n` +
      `당신의 IP 지역(${viewerRegion || '미확인'})에선 노출되지 않지만, 해당 지역 독자에게는 정상 노출됩니다.\n` +
      `선택하시겠습니까?`
    );
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center px-2 sm:px-4 animate-in fade-in" onClick={onClose}>
      <div className="w-full max-w-5xl max-h-[90vh] bg-white rounded-2xl overflow-hidden flex flex-col shadow-xl" onClick={(e) => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 shrink-0">
          <div className="min-w-0">
            <h2 className="text-[16px] font-[1000] text-slate-900">📢 광고 경매시장</h2>
            <p className="text-[10px] font-bold text-slate-400 mt-0.5 truncate">
              <span className="text-violet-600">{SLOT_LABEL[slot]}</span> 슬롯 · 카드 클릭 → 우측 미리보기 → [✓ 선택]으로 확정
            </p>
            <p className="text-[9px] font-[1000] mt-0.5">
              <span className="text-emerald-600">📌 이 슬롯 매칭 {slotMatchCount}개</span>
              <span className="text-slate-400"> / 전체 활성 {ads.length}개</span>
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-[18px] font-bold w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 shrink-0">✕</button>
        </div>

        {/* 검색·필터·정렬 바 */}
        <div className="px-5 py-2.5 border-b border-slate-100 flex flex-wrap items-center gap-2 shrink-0">
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPageCount(1); }}
            placeholder="🔍 헤드라인·광고주 검색"
            className="flex-1 min-w-[160px] px-3 py-1.5 rounded-md border border-slate-200 text-[11px] font-bold outline-none focus:border-violet-400"
          />
          {postCategory && (
            <label className="flex items-center gap-1.5 text-[10px] font-[1000] text-slate-600 cursor-pointer select-none">
              <input type="checkbox" checked={menuMatchOnly}
                onChange={(e) => { setMenuMatchOnly(e.target.checked); setPageCount(1); }}
                className="accent-violet-600" />
              📍 메뉴 일치만
            </label>
          )}
          <div className="flex items-center gap-1">
            <button onClick={() => setSortMode('price')}
              className={`px-2.5 py-1 rounded-md text-[10px] font-[1000] ${sortMode === 'price' ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
              💰 단가순
            </button>
            <button onClick={() => setSortMode('recent')}
              className={`px-2.5 py-1 rounded-md text-[10px] font-[1000] ${sortMode === 'recent' ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
              🕒 최근순
            </button>
          </div>
          <span className="text-[10px] font-bold text-slate-400 ml-auto">
            {displayed.length} / {filtered.length}개
          </span>
        </div>

        {/* 본문 — 좌(그리드) + 우(미리보기 sticky) */}
        <div className="flex-1 min-h-0 flex">
          {/* 좌측 그리드 */}
          <div className="flex-1 min-w-0 overflow-y-auto px-4 py-3">
            {/* 자동 매칭 옵션 — 클릭 = preview만 갱신 (확정은 우측 또는 카드 내부 버튼) */}
            <button
              onClick={() => setPreview('auto')}
              className={`w-full mb-3 p-3 rounded-xl border-2 transition-colors text-left ${preview === 'auto' ? 'border-violet-500 bg-violet-50' : 'border-dashed border-slate-200 bg-slate-50/50 hover:border-violet-300 hover:bg-violet-50/30'}`}
            >
              <div className="flex items-center gap-2">
                <span className="text-[18px]">🎲</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-[1000] text-slate-700">선택 안 함 — 자동 매칭</p>
                  <p className="text-[9px] font-bold text-slate-500">시스템이 단가·매칭도 기준으로 자동 선정</p>
                </div>
                {!currentSelectedAdId && <span className="text-[10px] font-[1000] bg-violet-600 text-white px-2 py-0.5 rounded shrink-0">현재 적용</span>}
              </div>
            </button>

            {loading ? (
              <p className="py-12 text-center text-slate-300 font-bold text-[12px]">불러오는 중...</p>
            ) : displayed.length === 0 ? (
              <p className="py-12 text-center text-slate-300 font-bold text-[12px]">
                {search.trim() || menuMatchOnly ? '조건에 맞는 광고가 없습니다' : `등록된 활성 광고가 없습니다`}
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {displayed.map(ad => {
                  const isApplied = ad.id === currentSelectedAdId;
                  const isPreviewing = preview === ad.id;
                  const isExpanded = expandedAdId === ad.id;
                  const menuMatch = isMenuMatch(ad);
                  // 🔧 v2.1: 슬롯 매칭 여부 — 비매칭 카드는 회색 + 클릭 시 안내
                  const slotMatch = !!ad.targetSlots?.includes(slot);
                  // 🔧 v2.1+: Brand Safety 차단 여부 — 차단 카테고리에 글이 들어가면 노출 불가
                  const brandSafe = isBrandSafe(ad);
                  // 🔧 v2.1+: 메뉴 매칭 강제 — 광고주 targetMenuCategories 외 카테고리 차단
                  const menuAllowed = isMenuAllowed(ad);
                  // 🔧 v2.1+: region은 viewer 기반이라 차단 X — 작성자 본인 region 비매칭 정보 안내만
                  const regionMatchSelf = isRegionMatchForViewer(ad);
                  const usable = slotMatch && brandSafe && menuAllowed;
                  return (
                    <div key={ad.id} className="flex flex-col">
                      <button
                        onClick={() => {
                          if (!brandSafe) handleBlockedClick(ad);
                          else if (!menuAllowed) handleMenuMismatchClick(ad);
                          else if (!slotMatch) handleNonMatchClick(ad);
                          else if (!regionMatchSelf) {
                            if (handleRegionInfoConfirm(ad)) setPreview(ad.id);
                          } else setPreview(ad.id);
                        }}
                        className={`w-full p-2.5 rounded-xl border-2 transition-colors text-left ${
                          !usable ? 'border-slate-200 bg-slate-50 opacity-70 hover:opacity-100' :
                          isPreviewing ? 'border-violet-500 bg-violet-50' :
                          'border-slate-200 bg-white hover:border-violet-300'
                        }`}
                      >
                        <div className="flex items-stretch gap-2.5">
                          {ad.imageUrl ? (
                            <div className="w-[72px] h-[72px] rounded-lg overflow-hidden border border-slate-100 bg-slate-50 shrink-0">
                              <img src={ad.imageUrl} alt="" className="w-full h-full object-cover" />
                            </div>
                          ) : (
                            <div className="w-[72px] h-[72px] rounded-lg bg-slate-100 shrink-0 flex items-center justify-center">
                              <span className="text-[9px] font-bold text-slate-300">없음</span>
                            </div>
                          )}
                          <div className="flex-1 min-w-0 flex flex-col justify-between">
                            <div className="min-w-0">
                              <p className="text-[12px] font-[1000] text-slate-800 line-clamp-1 leading-tight">{ad.headline}</p>
                              <p className="text-[10px] font-bold text-slate-500 mt-0.5 truncate">광고주 {ad.advertiserName}</p>
                            </div>
                            <div className="flex items-center gap-1 mt-1 flex-wrap">
                              <span className="text-[10px] font-[1000] text-amber-600">⚾ {ad.bidAmount}볼</span>
                              <span className="text-[8px] font-bold text-slate-400">{(ad.bidType || '').toUpperCase()}</span>
                              {!brandSafe && (
                                <span className="text-[8px] font-[1000] bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded">🚫 카테고리 차단</span>
                              )}
                              {!menuAllowed && brandSafe && (
                                <span className="text-[8px] font-[1000] bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded">🚫 메뉴 비매칭</span>
                              )}
                              {!slotMatch && brandSafe && menuAllowed && (
                                <span className="text-[8px] font-[1000] bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded">🚫 다른 슬롯</span>
                              )}
                              {!regionMatchSelf && usable && (
                                <span className="text-[8px] font-[1000] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded" title="다른 지역 독자에게 노출">ℹ️ 내 지역 미노출</span>
                              )}
                              {menuMatch && menuAllowed && <span className="text-[8px] font-[1000] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">📍 일치</span>}
                              <span className="text-[8px] font-[1000] bg-sky-100 text-sky-700 px-1.5 py-0.5 rounded truncate max-w-[120px]" title={ad.targetRegions?.length ? ad.targetRegions.join(', ') : '전국'}>
                                🌏 {ad.targetRegions?.length ? (ad.targetRegions.length <= 2 ? ad.targetRegions.join('·') : `${ad.targetRegions[0]} 외 ${ad.targetRegions.length - 1}`) : '전국'}
                              </span>
                              {isApplied && <span className="text-[8px] font-[1000] bg-violet-600 text-white px-1.5 py-0.5 rounded">현재 적용</span>}
                            </div>
                          </div>
                        </div>
                      </button>
                      {/* 모바일 — 인라인 펼침 + 펼침 안에 [✓ 선택] */}
                      <button
                        onClick={(e) => { e.stopPropagation(); setExpandedAdId(isExpanded ? null : ad.id); }}
                        className="sm:hidden mt-1 text-[10px] font-bold text-violet-500 hover:text-violet-700 self-start"
                      >
                        {isExpanded ? '▲ 미리보기 닫기' : '▼ 미리보기'}
                      </button>
                      {isExpanded && (
                        <div className="sm:hidden mt-1.5 space-y-2">
                          <div className="pointer-events-none">
                            <AdBanner ad={ad} position={slot} />
                          </div>
                          <button
                            onClick={() => handleConfirmAd(ad.id)}
                            className="w-full px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-[12px] font-[1000]"
                          >
                            ✓ 이 광고 선택
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
                {hasMore && (
                  <div ref={sentinelRef} className="col-span-full py-4 text-center text-[10px] font-bold text-slate-300">
                    더 불러오는 중...
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 우측 미리보기 패널 — sm 이상에서만 */}
          <div className="hidden sm:flex w-[320px] shrink-0 border-l border-slate-100 bg-slate-50/40 flex-col overflow-y-auto">
            {preview === 'auto' ? (
              <div className="p-4 space-y-3">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">📍 자동 매칭 안내</p>
                <div className="bg-white rounded-lg border border-slate-100 p-3 space-y-2">
                  <p className="text-[18px] text-center">🎲</p>
                  <p className="text-[12px] font-[1000] text-slate-700 text-center">선택 안 함 — 자동 매칭</p>
                  <p className="text-[10px] font-bold text-slate-500 leading-relaxed">
                    시스템이 글 게시 시점에 단가·매칭도 기준으로 가장 적합한 광고를 자동 선정합니다.
                    매칭 광고가 없으면 글러브팀 자체 프로모션이 노출됩니다.
                  </p>
                </div>
                <button
                  onClick={handleConfirmAuto}
                  className="w-full px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-[12px] font-[1000] transition-colors"
                >
                  ✓ 자동 매칭으로 결정
                </button>
              </div>
            ) : previewAd ? (
              <div className="p-4 space-y-3">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">📍 실제 노출 모습</p>
                <div className="pointer-events-none">
                  <AdBanner ad={previewAd} position={slot} />
                </div>
                <div className="bg-white rounded-lg border border-slate-100 p-3 space-y-1.5">
                  <p className="text-[13px] font-[1000] text-slate-800 leading-tight">{previewAd.headline}</p>
                  <p className="text-[11px] font-bold text-slate-500 leading-snug">{previewAd.description}</p>
                  <div className="flex items-center gap-1.5 flex-wrap pt-1.5 border-t border-slate-100">
                    <span className="text-[10px] font-[1000] text-amber-600">⚾ {previewAd.bidAmount}볼</span>
                    <span className="text-[9px] font-bold text-slate-400">{(previewAd.bidType || '').toUpperCase()}</span>
                    {isMenuMatch(previewAd) && <span className="text-[9px] font-[1000] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">📍 메뉴 일치</span>}
                  </div>
                  <p className="text-[10px] font-bold text-slate-500 pt-1">광고주 {previewAd.advertiserName}</p>
                  {previewAd.targetMenuCategories?.length ? (
                    <p className="text-[9px] font-bold text-slate-400">타겟 메뉴: {previewAd.targetMenuCategories.join(' · ')}</p>
                  ) : (
                    <p className="text-[9px] font-bold text-slate-400">타겟 메뉴: 전체</p>
                  )}
                  <p className="text-[9px] font-[1000] text-sky-700">
                    🌏 노출 지역: {previewAd.targetRegions?.length ? previewAd.targetRegions.join(' · ') : '전국'}
                  </p>
                </div>
                <button
                  onClick={handleConfirm}
                  className="w-full px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-[12px] font-[1000] transition-colors"
                >
                  ✓ 이 광고 선택
                </button>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center p-6">
                <p className="text-[11px] font-bold text-slate-300 text-center leading-relaxed">
                  좌측 카드를 클릭하면<br />여기에 미리보기가 나타납니다
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 푸터 안내 */}
        <div className="px-5 py-2 border-t border-slate-100 bg-amber-50/50 shrink-0">
          <p className="text-[10px] font-bold text-amber-700">
            💡 단가 높은 광고를 선택하면 작성자 수익이 늘어납니다. 매칭 광고가 없으면 글러브팀 자체 프로모션 노출.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdMarketplaceModal;
