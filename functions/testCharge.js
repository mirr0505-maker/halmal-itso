// functions/testCharge.js — 테스트 땡스볼 충전 (개발 기간 전용)
// 🚀 Admin SDK로 ballBalance를 변경 — Firestore Rules에서 클라이언트 직접 수정 차단됨
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const db = getFirestore();

exports.testChargeBall = onCall(
  { region: "asia-northeast3" },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
    const uid = request.auth.uid;
    const { amount } = request.data;

    if (typeof amount !== "number" || amount <= 0 || amount > 1000) {
      throw new HttpsError("invalid-argument", "1~1000 범위의 충전 금액을 입력하세요.");
    }

    await db.collection("users").doc(uid).update({
      ballBalance: FieldValue.increment(amount),
    });

    return { success: true, charged: amount };
  }
);
