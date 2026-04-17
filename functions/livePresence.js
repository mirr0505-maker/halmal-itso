// functions/livePresence.js — 🔴 라이브 세션 presence 좀비 정리 + activeUsers 집계
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");

const db = getFirestore();

// 매 1분마다: 모든 활성 live_sessions의 presence 서브컬렉션 정리 + activeUsers 카운트
exports.cleanupLivePresence = onSchedule(
  { schedule: "* * * * *", timeZone: "Asia/Seoul", region: "asia-northeast3" },
  async () => {
    const activeSnap = await db.collection("live_sessions")
      .where("status", "in", ["ready", "live"])
      .get();

    const staleCutoff = Timestamp.fromDate(new Date(Date.now() - 120_000)); // 120초 경과

    for (const sessionDoc of activeSnap.docs) {
      const presenceSnap = await sessionDoc.ref.collection("presence").get();
      let active = 0;
      const staleDeletes = [];

      for (const p of presenceSnap.docs) {
        const lastPing = p.data().lastPing;
        if (lastPing && lastPing.toMillis() < staleCutoff.toMillis()) {
          staleDeletes.push(p.ref.delete());
        } else {
          active++;
        }
      }

      await Promise.all(staleDeletes);
      await sessionDoc.ref.update({ activeUsers: active });
    }
  }
);
