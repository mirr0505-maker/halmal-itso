// functions/market.js — 🏪 강변 시장 (Riverside Market)
// 🚀 purchaseMarketItem: 가판대 단건 구매 (땡스볼 차감 → 크리에이터 지급 → 영수증)
// 🔒 클라이언트에서 ballBalance·market_purchases 직접 수정 차단 → Admin SDK 처리
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const { buildExpLevelUpdate } = require("./utils/levelSync");

const db = getFirestore();

// 🏪 레벨별 수수료율 — 높은 레벨일수록 크리에이터 유리
// 변경 시 이 객체만 수정 후 재배포
const MARKET_FEE_RATES = {
  default: 0.30,  // Lv3~4: 30%
  lv5: 0.25,      // Lv5~6: 25%
  lv7: 0.20,      // Lv7+:  20%
};

// 레벨 → 수수료율 결정
function getFeeRate(level) {
  if (level >= 7) return MARKET_FEE_RATES.lv7;
  if (level >= 5) return MARKET_FEE_RATES.lv5;
  return MARKET_FEE_RATES.default;
}

// ════════════════════════════════════════════════════════════
// 🚀 purchaseMarketItem — 가판대 단건 구매 (onCall v2)
// ════════════════════════════════════════════════════════════
exports.purchaseMarketItem = onCall(
  { region: "asia-northeast3" },
  async (request) => {
    // 1. 인증 확인
    if (!request.auth) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
    const buyerUid = request.auth.uid;
    const { itemId } = request.data || {};

    // 2. itemId 검증
    if (typeof itemId !== "string" || !itemId.trim()) {
      throw new HttpsError("invalid-argument", "itemId가 필요합니다.");
    }

    // 3. 아이템 조회
    const itemRef = db.collection("market_items").doc(itemId);
    const itemSnap = await itemRef.get();
    if (!itemSnap.exists) throw new HttpsError("not-found", "아이템을 찾을 수 없습니다.");
    const item = itemSnap.data();

    // 4. 상태 검증
    if (item.status !== "active") {
      throw new HttpsError("failed-precondition", "판매 중인 아이템이 아닙니다.");
    }

    // 5. 본인 구매 차단
    if (item.authorId === buyerUid) {
      throw new HttpsError("failed-precondition", "본인의 판매글은 구매할 수 없습니다.");
    }

    // 6. 가격 검증
    const price = typeof item.price === "number" ? item.price : 0;
    if (price <= 0) {
      throw new HttpsError("failed-precondition", "유효한 가격이 설정되지 않았습니다.");
    }

    // 구매자 닉네임 조회 (트랜잭션 외부)
    const buyerRef = db.collection("users").doc(buyerUid);
    const buyerSnapForName = await buyerRef.get();
    const buyerNickname = buyerSnapForName.data()?.nickname || request.auth.token?.name || "익명";

    const purchaseRef = db.collection("market_purchases").doc(`${itemId}_${buyerUid}`);
    const authorRef = db.collection("users").doc(item.authorId);

    // 7. 트랜잭션: 중복 구매 체크 + 잔액 차감 + 크리에이터 지급 + 영수증
    let alreadyPurchased = false;

    await db.runTransaction(async (tx) => {
      // 중복 구매 체크 — 멱등성 유지
      const purchaseSnap = await tx.get(purchaseRef);
      if (purchaseSnap.exists) {
        alreadyPurchased = true;
        return;
      }

      // 구매자 잔액 확인
      const buyerSnap = await tx.get(buyerRef);
      if (!buyerSnap.exists) throw new HttpsError("not-found", "사용자를 찾을 수 없습니다.");
      const buyerData = buyerSnap.data();
      const currentBalance = buyerData.ballBalance || 0;
      if (currentBalance < price) {
        throw new HttpsError("failed-precondition", "땡스볼이 부족합니다.");
      }

      // 크리에이터 레벨 조회 → 수수료율 결정
      const authorSnap = await tx.get(authorRef);
      const authorLevel = item.authorLevel || 3;
      const feeRate = getFeeRate(authorLevel);
      const platformFee = Math.floor(price * feeRate);
      const creatorEarned = price - platformFee;

      // 구매자: 잔액 차감 + EXP +2 (level 동시 쓰기 — 옵션 B)
      tx.update(buyerRef, {
        ballBalance: currentBalance - price,
        ballSpent: FieldValue.increment(price),
        ...buildExpLevelUpdate(FieldValue, buyerData.exp, 2),
      });

      // 크리에이터: 수익 지급
      tx.set(authorRef, {
        ballReceived: FieldValue.increment(creatorEarned),
        marketTotalEarned: FieldValue.increment(creatorEarned),
        marketTotalSales: FieldValue.increment(1),
      }, { merge: true });

      // 플랫폼 수익 누적
      tx.set(db.collection("platform_revenue").doc("market"), {
        totalFee: FieldValue.increment(platformFee),
        totalGross: FieldValue.increment(price),
        lastUpdatedAt: Timestamp.now(),
      }, { merge: true });

      // 영수증 생성
      tx.set(purchaseRef, {
        itemId,
        userId: buyerUid,
        authorId: item.authorId,
        pricePaid: price,
        platformFee,
        creatorEarned,
        feeRate,
        purchasedAt: Timestamp.now(),
      });

      // 아이템 구매 수 증가
      tx.update(itemRef, {
        purchaseCount: FieldValue.increment(1),
      });
    });

    if (alreadyPurchased) {
      return { success: true, alreadyPurchased: true };
    }

    // 8. 트랜잭션 외: 알림 발송
    // 크리에이터에게 판매 알림
    await db.collection("notifications").doc(item.authorId).collection("items").add({
      type: "market_sale",
      fromNickname: buyerNickname,
      amount: price,
      itemId,
      itemTitle: item.title || null,
      createdAt: Timestamp.now(),
      read: false,
    });

    // 구매자 sentBalls 기록
    await db.collection("sentBalls").doc(buyerUid).collection("items").add({
      type: "market_purchase",
      itemId,
      itemTitle: item.title || null,
      authorNickname: item.authorNickname || null,
      amount: price,
      createdAt: Timestamp.now(),
    });

    return { success: true, amount: price, alreadyPurchased: false };
  }
);

// 30일 밀리초
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

// ════════════════════════════════════════════════════════════
// 🚀 subscribeMarketShop — 단골장부 구독 (onCall v2)
// ════════════════════════════════════════════════════════════
exports.subscribeMarketShop = onCall(
  { region: "asia-northeast3" },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
    const subscriberUid = request.auth.uid;
    const { shopId } = request.data || {};

    if (typeof shopId !== "string" || !shopId.trim()) {
      throw new HttpsError("invalid-argument", "shopId가 필요합니다.");
    }

    // 상점 조회
    const shopRef = db.collection("market_shops").doc(shopId);
    const shopSnap = await shopRef.get();
    if (!shopSnap.exists) throw new HttpsError("not-found", "상점을 찾을 수 없습니다.");
    const shop = shopSnap.data();

    if (shop.status !== "active") {
      throw new HttpsError("failed-precondition", "운영 중인 상점이 아닙니다.");
    }

    // 본인 구독 차단
    if (shop.creatorId === subscriberUid) {
      throw new HttpsError("failed-precondition", "본인 상점은 구독할 수 없습니다.");
    }

    const price = typeof shop.subscriptionPrice === "number" ? shop.subscriptionPrice : 0;
    if (price <= 0) throw new HttpsError("failed-precondition", "유효한 가격이 아닙니다.");

    const subscriberRef = db.collection("users").doc(subscriberUid);
    const subscriberSnapForName = await subscriberRef.get();
    const subscriberNickname = subscriberSnapForName.data()?.nickname || "익명";

    const subId = `${shop.creatorId}_${subscriberUid}`;
    const subRef = db.collection("market_subscriptions").doc(subId);
    const creatorRef = db.collection("users").doc(shop.creatorId);
    const now = Timestamp.now();
    const expiresAt = Timestamp.fromMillis(now.toMillis() + THIRTY_DAYS_MS);

    let alreadyActive = false;

    await db.runTransaction(async (tx) => {
      // 기존 활성 구독 체크
      const existingSub = await tx.get(subRef);
      if (existingSub.exists && existingSub.data().isActive) {
        // 만료 전이면 기간 연장
        const currentExpiry = existingSub.data().expiresAt;
        if (currentExpiry && currentExpiry.toMillis() > now.toMillis()) {
          alreadyActive = true;
          return;
        }
      }

      // 구독자 잔액 확인
      const subscriberSnap = await tx.get(subscriberRef);
      if (!subscriberSnap.exists) throw new HttpsError("not-found", "사용자를 찾을 수 없습니다.");
      const balance = subscriberSnap.data().ballBalance || 0;
      if (balance < price) throw new HttpsError("failed-precondition", "땡스볼이 부족합니다.");

      // 크리에이터 레벨 → 수수료
      const creatorLevel = shop.creatorLevel || 5;
      const feeRate = getFeeRate(creatorLevel);
      const platformFee = Math.floor(price * feeRate);
      const creatorEarned = price - platformFee;

      // 구독자: 잔액 차감
      tx.update(subscriberRef, {
        ballBalance: balance - price,
        ballSpent: FieldValue.increment(price),
      });

      // 크리에이터: 수익 지급
      tx.set(creatorRef, {
        ballReceived: FieldValue.increment(creatorEarned),
        marketTotalEarned: FieldValue.increment(creatorEarned),
      }, { merge: true });

      // 플랫폼 수익
      tx.set(db.collection("platform_revenue").doc("market"), {
        totalFee: FieldValue.increment(platformFee),
        totalGross: FieldValue.increment(price),
        lastUpdatedAt: now,
      }, { merge: true });

      // 구독 문서 생성/갱신
      const renewCount = existingSub.exists ? (existingSub.data().renewCount || 0) + 1 : 0;
      tx.set(subRef, {
        creatorId: shop.creatorId,
        subscriberId: subscriberUid,
        shopId,
        pricePaid: price,
        startedAt: now,
        expiresAt,
        isActive: true,
        renewCount,
        notified3Days: false,
      });

      // 상점 구독자 수 증가 (신규 구독만)
      if (!existingSub.exists || !existingSub.data().isActive) {
        tx.update(shopRef, { subscriberCount: FieldValue.increment(1) });
      }

      // 상점 누적 수익
      tx.update(shopRef, { totalRevenue: FieldValue.increment(creatorEarned) });
    });

    if (alreadyActive) {
      return { success: true, alreadyActive: true };
    }

    // 알림: 크리에이터에게 새 구독자
    await db.collection("notifications").doc(shop.creatorId).collection("items").add({
      type: "market_sub_new",
      fromNickname: subscriberNickname,
      amount: price,
      shopId,
      shopName: shop.shopName || null,
      createdAt: Timestamp.now(),
      read: false,
    });

    return { success: true, expiresAt: expiresAt.toMillis(), alreadyActive: false };
  }
);

// ════════════════════════════════════════════════════════════
// 🚀 checkSubscriptionExpiry — 만료 체크 + 알림 + subscriberCount 차감
// ════════════════════════════════════════════════════════════
exports.checkSubscriptionExpiry = onSchedule(
  { schedule: "every day 09:00", region: "asia-northeast3", timeoutSeconds: 120 },
  async () => {
    const now = Timestamp.now();
    const threeDaysLater = Timestamp.fromMillis(now.toMillis() + 3 * 24 * 60 * 60 * 1000);

    // 1. 만료 3일 전 알림 (아직 알림 안 보낸 건)
    const soonExpiring = await db.collection("market_subscriptions")
      .where("isActive", "==", true)
      .where("expiresAt", "<=", threeDaysLater)
      .get();

    for (const doc of soonExpiring.docs) {
      const sub = doc.data();
      if (sub.notified3Days) continue;
      if (sub.expiresAt.toMillis() <= now.toMillis()) continue; // 이미 만료된 건 아래에서 처리

      // 만료 예정 알림
      await db.collection("notifications").doc(sub.subscriberId).collection("items").add({
        type: "market_sub_expiring",
        shopId: sub.shopId,
        expiresAt: sub.expiresAt,
        createdAt: Timestamp.now(),
        read: false,
      });
      await doc.ref.update({ notified3Days: true });
    }

    // 2. 만료 처리
    const expired = await db.collection("market_subscriptions")
      .where("isActive", "==", true)
      .where("expiresAt", "<=", now)
      .get();

    let deactivatedCount = 0;
    for (const doc of expired.docs) {
      const sub = doc.data();
      await doc.ref.update({ isActive: false });

      // subscriberCount 차감
      const shopRef = db.collection("market_shops").doc(sub.shopId);
      await shopRef.update({ subscriberCount: FieldValue.increment(-1) });

      deactivatedCount++;
    }

    console.log(`[강변시장] 구독 만료 처리: ${deactivatedCount}건 비활성화, ${soonExpiring.size}건 알림 체크`);
  }
);

// ════════════════════════════════════════════════════════════
// 🚀 processMarketAdRevenue — 강변 시장 광고 수익 일별 정산
// ════════════════════════════════════════════════════════════
// 매일 자정 실행: 어제 adEvents 중 market_items 작성자에 대한 이벤트 집계
// → market_ad_revenues에 아이템별 기록 + 크리에이터 수익 지급
// 수수료: 기존 revenue.js의 creatorRate와 별개 — 강변 시장은 고정 70/30
const MARKET_AD_CREATOR_RATE = 0.70;

exports.processMarketAdRevenue = onSchedule(
  { schedule: "every day 00:05", region: "asia-northeast3", timeoutSeconds: 120 },
  async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().slice(0, 10);
    const yyyymmdd = dateStr.replace(/-/g, "");
    console.log(`[강변시장 광고] ${dateStr} 정산 시작`);

    const startOfDay = new Date(dateStr + "T00:00:00+09:00");
    const endOfDay = new Date(dateStr + "T23:59:59+09:00");

    // 어제 adEvents 중 postId가 mkt_ 로 시작하는 것만 (강변 시장 아이템)
    const eventsSnap = await db.collection("adEvents")
      .where("createdAt", ">=", Timestamp.fromDate(startOfDay))
      .where("createdAt", "<=", Timestamp.fromDate(endOfDay))
      .where("isSuspicious", "==", false)
      .get();

    if (eventsSnap.empty) {
      console.log("[강변시장 광고] 이벤트 없음 — 스킵");
      return;
    }

    // mkt_ 아이템만 필터 → 아이템별 집계
    const itemMap = {};
    eventsSnap.docs.forEach(d => {
      const ev = d.data();
      if (!ev.postId || !ev.postId.startsWith("mkt_")) return;
      if (!itemMap[ev.postId]) {
        itemMap[ev.postId] = { creatorId: ev.postAuthorId, events: [] };
      }
      itemMap[ev.postId].events.push(ev);
    });

    if (Object.keys(itemMap).length === 0) {
      console.log("[강변시장 광고] 강변 시장 관련 이벤트 없음 — 스킵");
      return;
    }

    let totalCreatorPaid = 0;

    for (const [itemId, data] of Object.entries(itemMap)) {
      let gross = 0;
      data.events.forEach(ev => {
        if (ev.eventType === "impression" && ev.bidType === "cpm") gross += ev.bidAmount / 1000;
        else if (ev.eventType === "click" && ev.bidType === "cpc") gross += ev.bidAmount;
      });

      if (gross <= 0) continue;

      const creatorShare = Math.floor(gross * MARKET_AD_CREATOR_RATE);
      const platformShare = Math.floor(gross) - creatorShare;
      const recordId = `${itemId}_${yyyymmdd}`;

      // market_ad_revenues 기록
      await db.collection("market_ad_revenues").doc(recordId).set({
        itemId,
        creatorId: data.creatorId,
        date: yyyymmdd,
        adRevenueBalls: Math.floor(gross),
        creatorShare,
        platformShare,
        settled: true,
        settledAt: Timestamp.now(),
      });

      // 크리에이터에게 수익 지급
      if (creatorShare > 0 && data.creatorId) {
        await db.collection("users").doc(data.creatorId).update({
          ballReceived: FieldValue.increment(creatorShare),
          marketTotalEarned: FieldValue.increment(creatorShare),
        });

        // 아이템 누적 광고 수익 갱신
        await db.collection("market_items").doc(itemId).update({
          adRevenueTotal: FieldValue.increment(creatorShare),
        });

        // 크리에이터에게 정산 알림
        await db.collection("notifications").doc(data.creatorId).collection("items").add({
          type: "market_ad_revenue",
          amount: creatorShare,
          itemId,
          date: dateStr,
          createdAt: Timestamp.now(),
          read: false,
        });

        totalCreatorPaid += creatorShare;
      }
    }

    console.log(`[강변시장 광고] ${dateStr} 정산 완료 — 아이템 ${Object.keys(itemMap).length}개, 크리에이터 지급 ${totalCreatorPaid}볼`);
  }
);
