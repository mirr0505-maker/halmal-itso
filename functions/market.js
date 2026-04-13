// functions/market.js — 🏪 강변 시장 (Riverside Market)
// 🚀 purchaseMarketItem: 가판대 단건 구매 (땡스볼 차감 → 크리에이터 지급 → 영수증)
// 🔒 클라이언트에서 ballBalance·market_purchases 직접 수정 차단 → Admin SDK 처리
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");

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
      const currentBalance = buyerSnap.data().ballBalance || 0;
      if (currentBalance < price) {
        throw new HttpsError("failed-precondition", "땡스볼이 부족합니다.");
      }

      // 크리에이터 레벨 조회 → 수수료율 결정
      const authorSnap = await tx.get(authorRef);
      const authorLevel = item.authorLevel || 3;
      const feeRate = getFeeRate(authorLevel);
      const platformFee = Math.floor(price * feeRate);
      const creatorEarned = price - platformFee;

      // 구매자: 잔액 차감
      tx.update(buyerRef, {
        ballBalance: currentBalance - price,
        ballSpent: FieldValue.increment(price),
        exp: FieldValue.increment(2),
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
