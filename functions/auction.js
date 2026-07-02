// functions/auction.js — 광고 경매 엔진
// 🚀 v2 (2026-04-26): 빈도 캡 / 예산 가드 / Brand Safety / Viewable 분리 차감
//   eventType 분기:
//     - 미지정·'impression': 경매 매칭 → adEvents(impression) 기록 (차감 X — viewable에서)
//     - 'viewable': viewableImpressions++ + CPM 차감 (IAB 표준)
//     - 'click': totalClicks++ + CPC 차감
//   차감 로직 viewable 기준 — 광고주 신뢰 (실제 본 사람만 카운트)
const { onRequest } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");

const db = getFirestore();

const SCORE_CLAMP_MIN = 0.3;
const SCORE_CLAMP_MAX = 3.0;
const SCORE_FALLBACK = 1.0;
const DEFAULT_FREQUENCY_CAP = { limit: 3, periodHours: 24 };
const DEFAULT_BLOCKED_CATEGORIES = ['유배·귀양지'];

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

// 🔍 빈도 캡 체크 — viewerUid + adId의 최근 N시간 viewable count
async function checkFrequencyCap(viewerUid, adId, periodHours, limit) {
  if (!viewerUid || viewerUid === 'anonymous') return true; // 비로그인은 캡 미적용 (광고주 우호적)
  const since = Timestamp.fromMillis(Date.now() - periodHours * 3600 * 1000);
  const snap = await db.collection('adEvents')
    .where('viewerUid', '==', viewerUid)
    .where('adId', '==', adId)
    .where('eventType', '==', 'viewable')
    .where('createdAt', '>=', since)
    .limit(limit)
    .get();
  return snap.size < limit;
}

// 🔒 P0-2 2026-07-02: 결제 근거가 되는 postAuthorId를 서버에서만 확정.
//   Why: adEvents의 postAuthorId·bidAmount는 aggregateDailyRevenue가 크리에이터에게 실제 볼을 지급하는 근거다.
//        무인증 엔드포인트라 클라 body 값을 그대로 믿으면 "postAuthorId=내UID, bidAmount=거액" 위조로 무한 볼 발행 가능.
//   실제 posts/{postId} 문서의 author_id만 신뢰. 피드 인라인 광고(합성 postId)는 문서가 없어 '' 반환(크리에이터 미지급 = 플랫폼 인벤토리).
async function resolvePostAuthorId(postId) {
  if (!postId || typeof postId !== 'string') return '';
  try {
    const snap = await db.collection('posts').doc(postId).get();
    return snap.exists ? (snap.data().author_id || '') : '';
  } catch {
    return '';
  }
}

// 💰 예산 가드 — 일/총 예산 도달 시 매칭에서 제외
function isWithinBudget(ad, expectedCharge) {
  const todaySpent = ad.todaySpent || 0;
  const totalSpent = ad.totalSpent || 0;
  if (ad.dailyBudget && todaySpent + expectedCharge > ad.dailyBudget) return false;
  if (ad.totalBudget && totalSpent + expectedCharge >= ad.totalBudget) return false;
  return true;
}

exports.adAuction = onRequest(
  { region: "asia-northeast3", cors: true },
  async (req, res) => {
    if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

    const body = req.body || {};
    const eventType = body.eventType || 'impression';

    // ────────────────────────────────────────────────
    // 🔧 v2.1: selectedAdId 직접 매칭 impression — 경매 X, 카운터만
    //   AdSlot directAd 분기에서 광고당 1회 호출 (impressionFiredRef로 중복 차단)
    // ────────────────────────────────────────────────
    if (eventType === 'impression' && body.directMatch) {
      const { adId, postId, viewerUid, postCategory, slotPosition, viewerRegion } = body;
      if (!adId || !postId) return res.status(400).json({ error: 'adId, postId 필수' });
      try {
        // 🔒 P0-2: ad 문서 존재 검증 + bidAmount/bidType/advertiserId를 서버 값으로만 기록 (body 위조 차단)
        const adSnap = await db.collection('ads').doc(adId).get();
        if (!adSnap.exists) return res.json({ success: false });
        const ad = adSnap.data();
        const postAuthorId = await resolvePostAuthorId(postId);
        await db.collection('adEvents').add({
          adId, advertiserId: ad.advertiserId || '', postId,
          postAuthorId,
          postCategory: postCategory || '',
          slotPosition: slotPosition || 'bottom',
          eventType: 'impression',
          bidType: ad.bidType || 'cpm',
          bidAmount: ad.bidAmount || 0,
          viewerUid: viewerUid || 'anonymous',
          viewerRegion: viewerRegion || '',
          sessionId: `session_${Date.now()}`,
          isSuspicious: false,
          createdAt: Timestamp.now(),
        });
        await db.collection('ads').doc(adId).update({
          totalImpressions: FieldValue.increment(1),
        });
        return res.json({ success: true });
      } catch (err) {
        console.error('[adAuction directMatch impression]', err);
        return res.status(500).json({ error: 'directMatch 기록 실패' });
      }
    }

    // ────────────────────────────────────────────────
    // 🔄 viewable / click — 별도 처리 (경매 X, 차감만)
    // ────────────────────────────────────────────────
    if (eventType === 'viewable' || eventType === 'click') {
      const { adId, postId, viewerUid, postCategory, slotPosition, viewerRegion } = body;
      if (!adId || !postId) return res.status(400).json({ error: 'adId, postId 필수' });
      try {
        // 광고 데이터 조회 (차감액 산정)
        const adSnap = await db.collection('ads').doc(adId).get();
        if (!adSnap.exists) return res.json({ success: false });
        const ad = adSnap.data();

        // 🔒 P0-2: 차감액은 오직 ad 문서의 bidAmount로 산정 (body bidAmount 위조 → 예산/수익 조작 차단)
        //   viewable=CPM*1/1000 / click=CPC 1회
        const charge = eventType === 'viewable'
          ? (ad.bidType === 'cpm' ? (ad.bidAmount || 0) / 1000 : 0)
          : (ad.bidType === 'cpc' ? (ad.bidAmount || 0) : 0);
        const postAuthorId = await resolvePostAuthorId(postId);

        await db.collection('adEvents').add({
          adId, advertiserId: ad.advertiserId, postId,
          postAuthorId,
          postCategory: postCategory || '',
          slotPosition: slotPosition || 'bottom',
          eventType,
          bidType: ad.bidType,
          bidAmount: charge,
          viewerUid: viewerUid || 'anonymous',
          viewerRegion: viewerRegion || '',
          sessionId: `session_${Date.now()}`,
          isSuspicious: false,
          createdAt: Timestamp.now(),
        });

        // 누적 카운터 + 차감
        const updates = {};
        if (eventType === 'viewable') {
          updates.viewableImpressions = FieldValue.increment(1);
          if (charge > 0) {
            updates.totalSpent = FieldValue.increment(charge);
            updates.todaySpent = FieldValue.increment(charge);
          }
        } else {
          updates.totalClicks = FieldValue.increment(1);
          if (charge > 0) {
            updates.totalSpent = FieldValue.increment(charge);
            updates.todaySpent = FieldValue.increment(charge);
          }
        }
        await db.collection('ads').doc(adId).update(updates);
        return res.json({ success: true });
      } catch (err) {
        console.error('[adAuction event]', eventType, err);
        return res.status(500).json({ error: '이벤트 기록 실패' });
      }
    }

    // ────────────────────────────────────────────────
    // 🎯 impression 경매 매칭
    // ────────────────────────────────────────────────
    const { slotPosition, postCategory, postId, postAuthorLevel, viewerRegion, viewerUid, excludeAdIds } = body;
    if (!slotPosition || !postId) return res.status(400).json({ error: "slotPosition, postId 필수" });
    // 🚀 ADSMARKET v3 (2026-04-30): feed 슬롯은 글 작성자 무관 (피드 인라인 광고) — postAuthorLevel 게이팅 무시
    //   본문 슬롯(top/middle/bottom)은 작성자 Lv5+ 게이팅 유지 (작성자 RS 발생 조건)
    if (slotPosition !== 'feed' && (postAuthorLevel || 0) < 5) return res.json({ success: true, ad: null, fallback: "promo" });
    // 🔒 P0-2: 결제 귀속 대상은 서버에서 확정한 실제 글 작성자만 사용 (body postAuthorId 위조 → 수익 탈취 차단)
    const postAuthorId = await resolvePostAuthorId(postId);

    try {
      const snap = await db.collection("ads").where("status", "==", "active").get();
      if (snap.empty) return res.json({ success: true, ad: null, fallback: "adsense" });

      // 1차 동기 필터
      const baseFiltered = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(ad => {
          // 🚀 ADSMARKET v3.2 (per-page de-dup): 같은 페이지 내 이미 선택된 광고 제외
          //   AnyTalkList가 슬롯 수만큼 순차 호출하며 누적 exclude 전달 → 페이지 내 광고 중복 차단
          if (Array.isArray(excludeAdIds) && excludeAdIds.includes(ad.id)) return false;
          if (!ad.targetSlots?.includes(slotPosition)) return false;
          if (ad.targetMenuCategories?.length > 0 && !ad.targetMenuCategories.includes(postCategory)) return false;
          if (ad.targetRegions?.length > 0 && viewerRegion && !ad.targetRegions.includes(viewerRegion)) return false;
          if (ad.targetCreatorId && ad.targetCreatorId !== postAuthorId) return false;
          if (ad.totalSpent >= ad.totalBudget) return false;
          // 🛡 P1-8 Brand Safety — 차단 카테고리 매칭 시 제외 (default '유배·귀양지')
          const blocked = ad.blockedCategories?.length ? ad.blockedCategories : DEFAULT_BLOCKED_CATEGORIES;
          if (postCategory && blocked.includes(postCategory)) return false;
          // 💰 P0-1 예산 — 일/총 예산 도달 후보 제외 (예상 차감액 = bidAmount/1000 for CPM, bidAmount for CPC)
          const expectedCharge = ad.bidType === 'cpm' ? (ad.bidAmount || 0) / 1000 : (ad.bidAmount || 0);
          if (!isWithinBudget(ad, expectedCharge)) return false;
          return true;
        });

      if (baseFiltered.length === 0) return res.json({ success: true, ad: null, fallback: "adsense" });

      // 2차 비동기 필터 — 빈도 캡 (P0-2)
      const freqResults = await Promise.all(baseFiltered.map(async ad => {
        const cap = ad.frequencyCap || DEFAULT_FREQUENCY_CAP;
        const ok = await checkFrequencyCap(viewerUid, ad.id, cap.periodHours, cap.limit);
        return ok ? ad : null;
      }));
      const filtered = freqResults.filter(Boolean);
      if (filtered.length === 0) return res.json({ success: true, ad: null, fallback: "adsense" });

      // 광고주 Creator Score 일괄 조회 → effectiveBid 계산
      const advertiserIds = [...new Set(filtered.map(ad => ad.advertiserId).filter(Boolean))];
      const advertiserScores = {};
      if (advertiserIds.length > 0) {
        const userSnaps = await db.getAll(...advertiserIds.map(id => db.collection("users").doc(id)));
        for (const us of userSnaps) {
          const data = us.data() || {};
          const raw = typeof data.creatorScoreCached === "number" ? data.creatorScoreCached : SCORE_FALLBACK;
          advertiserScores[us.id] = clamp(raw, SCORE_CLAMP_MIN, SCORE_CLAMP_MAX);
        }
      }

      const candidates = filtered
        .map(ad => ({
          ...ad,
          _scoreWeight: advertiserScores[ad.advertiserId] || SCORE_FALLBACK,
          _effectiveBid: (ad.bidAmount || 0) * (advertiserScores[ad.advertiserId] || SCORE_FALLBACK),
        }))
        .sort((a, b) => b._effectiveBid - a._effectiveBid);

      const winner = candidates[0];
      const secondPrice = candidates.length > 1 ? candidates[1].bidAmount + 1 : winner.bidAmount;

      // ⚾ impression 기록 — 차감은 viewable 이벤트에서 (광고주 보호)
      await db.collection("adEvents").add({
        adId: winner.id, advertiserId: winner.advertiserId, postId, postAuthorId,
        postCategory: postCategory || "", slotPosition, eventType: "impression",
        bidType: winner.bidType, bidAmount: secondPrice,
        winnerScoreWeight: winner._scoreWeight,
        winnerEffectiveBid: winner._effectiveBid,
        viewerUid: viewerUid || "anonymous",
        viewerRegion: viewerRegion || "",
        sessionId: `session_${Date.now()}`,
        isSuspicious: false, createdAt: Timestamp.now(),
      });

      // totalImpressions만 증가 — 차감은 viewable에서
      await db.collection("ads").doc(winner.id).update({
        totalImpressions: FieldValue.increment(1),
      });

      return res.json({
        success: true,
        ad: {
          adId: winner.id, headline: winner.headline, description: winner.description,
          imageUrl: winner.imageUrl, landingUrl: winner.landingUrl, ctaText: winner.ctaText,
          imageStyle: winner.imageStyle || 'horizontal',
          imagePosition: winner.imagePosition || 'left',
          bidType: winner.bidType, chargeAmount: secondPrice,
          advertiserId: winner.advertiserId, advertiserName: winner.advertiserName || '',
        },
        fallback: null,
      });
    } catch (err) {
      console.error("[adAuction]", err);
      return res.status(500).json({ error: "경매 처리 실패" });
    }
  }
);
