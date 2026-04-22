// functions/snapshotUserDaily.js — 🏅 일일 유저 활동 스냅샷
// 매일 03:30 KST: 모든 유저의 평판·EXP·좋아요 등 일일 값을 스냅샷
// Why: V2 평판 변화량·맞땡스볼 루프 탐지·audit 역추적을 위한 diff 기준점
// Output: user_snapshots/{yyyyMMdd}_{uid}
// 보관: 90일 (feedback_reputation_avatar_scope / Sprint 3 §8 결정)
// 검색어: snapshotUserDaily

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

exports.snapshotUserDaily = onSchedule(
  { schedule: "30 3 * * *", timeZone: "Asia/Seoul", region: "asia-northeast3" },
  async () => {
    const dateKey = seoulDateKey();
    const usersSnap = await db.collection("users").get();

    let batch = db.batch();
    let count = 0;
    let written = 0;
    for (const userDoc of usersSnap.docs) {
      if (userDoc.id.startsWith("nickname_")) continue; // 닉네임 색인 문서 제외
      const data = userDoc.data();
      const snapRef = db.collection("user_snapshots").doc(`${dateKey}_${userDoc.id}`);
      batch.set(snapRef, {
        uid: userDoc.id,
        nickname: data.nickname || "",
        dateKey,
        exp: data.exp || 0,
        level: data.level || 1,
        likes: data.likes || 0,
        totalShares: data.totalShares || 0,
        ballReceived: data.ballReceived || 0,
        ballBalance: data.ballBalance || 0,
        ballSpent: data.ballSpent || 0,
        reputationCached: data.reputationCached ?? null, // 미계산 유저는 null
        reputationTierCached: data.reputationTierCached ?? null,
        friendListLength: Array.isArray(data.friendList) ? data.friendList.length : 0,
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
    console.log(`[snapshotUserDaily] ${dateKey}: ${written} users snapshotted`);
    return null;
  },
);
