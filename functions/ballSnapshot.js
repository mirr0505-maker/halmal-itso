// functions/ballSnapshot.js — 🔒 일일 땡스볼 잔액 스냅샷
// 매일 04:00 KST: 모든 유저의 ballBalance/ballReceived/ballSpent를 스냅샷으로 저장
// Why: 장부(ball_transactions) ↔ 잔액(users.ballBalance) 정합성 검증의 기준점
// Output: ball_balance_snapshots/{yyyyMMdd}_{uid}
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");

const db = getFirestore();

// yyyyMMdd in Asia/Seoul
function seoulDateKey(date = new Date()) {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(kst.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

exports.snapshotBallBalance = onSchedule(
  { schedule: "0 4 * * *", timeZone: "Asia/Seoul", region: "asia-northeast3" },
  async () => {
    const dateKey = seoulDateKey();
    const usersSnap = await db.collection("users").get();

    // Firestore 배치는 최대 500 operations — 여유 있게 400씩 끊기
    let batch = db.batch();
    let count = 0;
    let written = 0;
    for (const userDoc of usersSnap.docs) {
      if (userDoc.id.startsWith("nickname_")) continue; // 닉네임 색인 문서 제외
      const data = userDoc.data();
      const snapRef = db.collection("ball_balance_snapshots").doc(`${dateKey}_${userDoc.id}`);
      batch.set(snapRef, {
        uid: userDoc.id,
        dateKey,
        ballBalance: data.ballBalance || 0,
        ballReceived: data.ballReceived || 0,
        ballSpent: data.ballSpent || 0,
        capturedAt: Timestamp.now(),
      });
      count++;
      written++;
      if (count >= 400) {
        await batch.commit();
        batch = db.batch();
        count = 0;
      }
    }
    if (count > 0) await batch.commit();
    console.log(`[snapshotBallBalance] ${dateKey}: ${written} users snapshotted`);
    return null;
  },
);
