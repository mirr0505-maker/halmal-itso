// functions/adTriggers.js — ADSMARKET Phase 5 Step 2: Firestore Trigger 2개
// 🚀 syncAdBids: ads 변경 시 adBids 자동 동기화
// 🚀 updateAdMetrics: adEvents 생성 시 ads 누적 지표 갱신
const { onDocumentUpdated, onDocumentCreated } = require("firebase-functions/v2/firestore");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const db = getFirestore();

// 🚀 품질 점수 산정 (0~100) — ADSMARKET.md §3.5
// qualityScore = (CTR × 1000 × 0.6) + (adRelevanceScore × 0.3) + (landingPageScore × 0.1)
function calculateQualityScore(ctr, adData) {
  // CTR 가중치 60% — 신규 광고(노출 100회 미만)는 기본 0.5%
  const effectiveCtr = (adData.totalImpressions || 0) >= 100 ? ctr : 0.005;
  const ctrScore = Math.min(effectiveCtr * 1000, 100) * 0.6;

  // 카테고리 관련도 30% — 초기에는 무조건 100
  const adRelevanceScore = 100 * 0.3;

  // 랜딩 페이지 존재 여부 10%
  const landingPageScore = (adData.landingUrl && adData.landingUrl.startsWith("http")) ? 100 * 0.1 : 0;

  return Math.min(Math.max(Math.round(ctrScore + adRelevanceScore + landingPageScore), 0), 100);
}

// ════════════════════════════════════════════════════════════
// 1️⃣ syncAdBids — ads 문서 변경 시 adBids 동기화
// ════════════════════════════════════════════════════════════
exports.syncAdBids = onDocumentUpdated(
  { document: "ads/{adId}", region: "asia-northeast3" },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return null;
    const adId = event.params.adId;

    // 경매 관련 필드만 변경 감지
    const relevantFields = [
      "bidAmount", "bidType", "targetCategories", "targetRegions",
      "targetSlots", "status", "dailyBudget", "totalBudget",
      "totalImpressions", "totalClicks", "totalSpent",
    ];
    const hasRelevantChange = relevantFields.some(
      (field) => JSON.stringify(before[field]) !== JSON.stringify(after[field])
    );
    if (!hasRelevantChange) {
      console.log(`[syncAdBids] No relevant changes for ${adId}, skipping`);
      return null;
    }

    // 품질 점수 + 유효 입찰가
    const ctr = (after.totalImpressions || 0) > 0
      ? (after.totalClicks || 0) / after.totalImpressions
      : 0;
    const qualityScore = calculateQualityScore(ctr, after);
    const effectiveBid = (after.bidAmount || 0) * (qualityScore / 100);

    // 예산 잔액
    const totalBudgetRemaining = Math.max(0, (after.totalBudget || 0) - (after.totalSpent || 0));
    const dailyBudgetRemaining = Math.max(0, (after.dailyBudget || 0) - (after.totalSpent || 0));

    // 상태 결정
    let bidStatus = "active";
    if (after.status !== "active") bidStatus = "paused";
    if (totalBudgetRemaining <= 0) bidStatus = "exhausted";

    const bidId = `bid_${adId}`;
    const bidRef = db.collection("adBids").doc(bidId);
    const bidSnap = await bidRef.get();

    const bidData = {
      adId,
      advertiserId: after.advertiserId,
      bidType: after.bidType,
      bidAmount: after.bidAmount,
      targetCategories: after.targetCategories || [],
      targetRegions: after.targetRegions || [],
      targetSlots: after.targetSlots || [],
      dailyBudgetRemaining,
      totalBudgetRemaining,
      status: bidStatus,
      qualityScore,
      effectiveBid,
      updatedAt: FieldValue.serverTimestamp(),
    };

    // 첫 생성 시 createdAt 추가
    if (!bidSnap.exists) {
      bidData.createdAt = FieldValue.serverTimestamp();
    }

    await bidRef.set(bidData, { merge: true });
    console.log(`[syncAdBids] ${bidId} updated, effectiveBid=${effectiveBid.toFixed(2)}, status=${bidStatus}`);
    return null;
  }
);

// ════════════════════════════════════════════════════════════
// 2️⃣ updateAdMetrics — adEvents 생성 시 ads 누적 지표 갱신
// ════════════════════════════════════════════════════════════
exports.updateAdMetrics = onDocumentCreated(
  { document: "adEvents/{eventId}", region: "asia-northeast3" },
  async (event) => {
    const eventData = event.data?.data();
    if (!eventData) return null;
    const { adId, eventType, bidType, bidAmount, isSuspicious } = eventData;

    // 의심 이벤트는 지표에 미반영
    if (isSuspicious) {
      console.log(`[updateAdMetrics] Suspicious event ${event.params.eventId}, skipping`);
      return null;
    }

    if (!adId) return null;
    const adRef = db.collection("ads").doc(adId);

    // 1. ads 누적 지표 update (increment 원자적)
    const adUpdate = { updatedAt: FieldValue.serverTimestamp() };
    if (eventType === "impression") {
      adUpdate.totalImpressions = FieldValue.increment(1);
      // CPM 과금 (1000 노출당 bidAmount원)
      if (bidType === "cpm") {
        adUpdate.totalSpent = FieldValue.increment(bidAmount / 1000);
      }
    } else if (eventType === "click") {
      adUpdate.totalClicks = FieldValue.increment(1);
      // CPC 과금
      if (bidType === "cpc") {
        adUpdate.totalSpent = FieldValue.increment(bidAmount);
      }
    }

    await adRef.update(adUpdate);

    // 2. CTR 재계산 (increment 반영된 최신 값 read)
    const adSnap = await adRef.get();
    const adData = adSnap.data();
    if (!adData) return null;

    const newCtr = (adData.totalImpressions || 0) > 0
      ? (adData.totalClicks || 0) / adData.totalImpressions
      : 0;
    await adRef.update({ ctr: Math.round(newCtr * 10000) / 10000 });

    // 3. adBids 품질 점수 재계산 + 예산 잔액 갱신
    const qualityScore = calculateQualityScore(newCtr, adData);
    const effectiveBid = (adData.bidAmount || 0) * (qualityScore / 100);
    const totalBudgetRemaining = Math.max(0, (adData.totalBudget || 0) - (adData.totalSpent || 0));

    let bidStatus = "active";
    if (adData.status !== "active") bidStatus = "paused";
    if (totalBudgetRemaining <= 0) bidStatus = "exhausted";

    try {
      await db.collection("adBids").doc(`bid_${adId}`).update({
        qualityScore,
        effectiveBid,
        totalBudgetRemaining,
        status: bidStatus,
        updatedAt: FieldValue.serverTimestamp(),
      });
    } catch (err) {
      // adBids 문서가 아직 없으면 syncAdBids가 만들 때까지 대기
      console.warn(`[updateAdMetrics] adBids bid_${adId} 미존재, syncAdBids 대기`);
    }

    // 4. 예산 소진 시 광고 상태 'exhausted'
    if (totalBudgetRemaining <= 0 && adData.status === "active") {
      await adRef.update({ status: "exhausted" });
      console.log(`[updateAdMetrics] Ad ${adId} budget exhausted`);
    }

    console.log(`[updateAdMetrics] ${eventType} recorded for ${adId}, ctr=${newCtr.toFixed(4)}`);
    return null;
  }
);
