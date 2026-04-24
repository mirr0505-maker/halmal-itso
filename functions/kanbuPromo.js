// functions/kanbuPromo.js — 깐부 홍보 등록 (서버사이드 과금 검증)
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");

const db = getFirestore();

const PROMO_PLANS = [
  { label: '1일', days: 1, cost: 1 },
  { label: '1주일', days: 7, cost: 6 },
  { label: '1달', days: 30, cost: 25 },
];

exports.registerKanbuPromo = onCall(
  { region: "asia-northeast3" },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
    const uid = request.auth.uid;
    const { planIndex, imageUrl, keywords, message } = request.data;

    if (typeof planIndex !== "number" || planIndex < 0 || planIndex >= PROMO_PLANS.length) {
      throw new HttpsError("invalid-argument", "유효하지 않은 홍보 플랜입니다.");
    }

    const plan = PROMO_PLANS[planIndex];
    const userRef = db.collection("users").doc(uid);

    await db.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists) throw new HttpsError("not-found", "사용자를 찾을 수 없습니다.");
      const userData = userSnap.data();
      const currentBalance = userData.ballBalance || 0;

      if (currentBalance < plan.cost) {
        throw new HttpsError("failed-precondition", `볼이 부족합니다. (필요: ${plan.cost}볼, 보유: ${currentBalance}볼)`);
      }

      const expireAt = new Date();
      expireAt.setDate(expireAt.getDate() + plan.days);

      tx.update(userRef, {
        promoImageUrl: imageUrl || "",
        promoKeywords: Array.isArray(keywords) ? keywords.filter(k => typeof k === "string" && k.trim()) : [],
        promoMessage: typeof message === "string" ? message.trim().slice(0, 100) : "",
        promoEnabled: true,
        promoExpireAt: Timestamp.fromDate(expireAt),
        promoPlan: plan.label,
        promoUpdatedAt: FieldValue.serverTimestamp(),
        ballBalance: currentBalance - plan.cost,
      });

      // 📜 영수증 — audit_anomalies false critical 방지 + 정산·분쟁 추적
      // Why: ball_transactions 원장이 없는 차감 경로라 ballAudit가 유출로 오인하던 이슈 해결
      const historyId = `${uid}_${Date.now()}`;
      tx.set(db.collection("kanbu_promo_history").doc(historyId), {
        uid,
        cost: plan.cost,
        plan: plan.label,
        days: plan.days,
        paidAt: Timestamp.now(),
      });
    });

    return { success: true, plan: plan.label, cost: plan.cost };
  }
);
