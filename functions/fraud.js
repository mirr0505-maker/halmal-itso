// functions/fraud.js — 부정행위 탐지
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");

const db = getFirestore();

exports.detectFraud = onSchedule(
  { schedule: "every day 15:00", region: "asia-northeast3", timeoutSeconds: 120, memory: "256MiB" },
  async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().slice(0, 10);
    console.log(`[부정행위] ${dateStr} 스캔 시작`);

    const startOfDay = new Date(dateStr + "T00:00:00+09:00");
    const endOfDay = new Date(dateStr + "T23:59:59+09:00");

    const eventsSnap = await db.collection("adEvents")
      .where("createdAt", ">=", Timestamp.fromDate(startOfDay))
      .where("createdAt", "<=", Timestamp.fromDate(endOfDay))
      .get();

    let flagged = 0;
    const batch = db.batch();

    eventsSnap.docs.forEach(docSnap => {
      const ev = docSnap.data();
      let suspicious = false;
      // F001: 자기 글 자기 클릭
      if (ev.viewerUid === ev.postAuthorId && ev.eventType === "click") suspicious = true;
      if (suspicious && !ev.isSuspicious) { batch.update(docSnap.ref, { isSuspicious: true }); flagged++; }
    });

    if (flagged > 0) await batch.commit();
    console.log(`[부정행위] ${dateStr} 완료 — ${flagged}건 플래그`);
  }
);
