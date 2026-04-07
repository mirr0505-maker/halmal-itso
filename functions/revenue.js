// functions/revenue.js — 일일 광고 수익 집계
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");

const db = getFirestore();

const RS_TABLE = { 9: 0.7, 7: 0.5, 5: 0.3 };
function getCreatorRate(level) {
  if (level >= 9) return RS_TABLE[9];
  if (level >= 7) return RS_TABLE[7];
  if (level >= 5) return RS_TABLE[5];
  return 0;
}

exports.aggregateDailyRevenue = onSchedule(
  { schedule: "every day 15:05", region: "asia-northeast3", timeoutSeconds: 120, memory: "256MiB" },
  async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().slice(0, 10);
    console.log(`[수익집계] ${dateStr} 집계 시작`);

    const startOfDay = new Date(dateStr + "T00:00:00+09:00");
    const endOfDay = new Date(dateStr + "T23:59:59+09:00");

    const eventsSnap = await db.collection("adEvents")
      .where("createdAt", ">=", Timestamp.fromDate(startOfDay))
      .where("createdAt", "<=", Timestamp.fromDate(endOfDay))
      .where("isSuspicious", "==", false)
      .get();

    if (eventsSnap.empty) { console.log("[수익집계] 이벤트 없음 — 스킵"); return; }

    const authorMap = {};
    eventsSnap.docs.forEach(d => {
      const ev = d.data();
      if (!authorMap[ev.postAuthorId]) authorMap[ev.postAuthorId] = [];
      authorMap[ev.postAuthorId].push(ev);
    });

    let totalRevenue = 0;
    const LEVEL_TABLE = [0, 30, 100, 250, 500, 1000, 2000, 4000, 7000, 10000];

    for (const [authorId, events] of Object.entries(authorMap)) {
      const userSnap = await db.collection("users").doc(authorId).get();
      const userData = userSnap.data() || {};
      const exp = userData.exp || 0;
      let level = 1;
      for (let i = LEVEL_TABLE.length - 1; i >= 0; i--) { if (exp >= LEVEL_TABLE[i]) { level = i + 1; break; } }

      const creatorRate = getCreatorRate(level);
      let impressions = 0, clicks = 0, gross = 0;

      events.forEach(ev => {
        if (ev.eventType === "impression") { impressions++; if (ev.bidType === "cpm") gross += ev.bidAmount / 1000; }
        else if (ev.eventType === "click") { clicks++; if (ev.bidType === "cpc") gross += ev.bidAmount; }
      });

      const creatorShare = Math.floor(gross * creatorRate);
      const revId = `rev_${dateStr.replace(/-/g, "")}_${authorId}`;
      await db.collection("dailyAdRevenue").doc(revId).set({
        id: revId, date: dateStr, postAuthorId: authorId, postAuthorNickname: userData.nickname || "",
        postBreakdown: [], totalImpressions: impressions, totalClicks: clicks,
        grossRevenue: Math.floor(gross), creatorShare, platformShare: Math.floor(gross - creatorShare),
        revenueShareRate: creatorRate, creatorLevel: level, status: "provisional",
        createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
      });

      if (creatorShare > 0) {
        await db.collection("users").doc(authorId).update({ pendingRevenue: FieldValue.increment(creatorShare) });
      }
      totalRevenue += Math.floor(gross);
    }

    console.log(`[수익집계] ${dateStr} 완료 — 작성자 ${Object.keys(authorMap).length}명, 총 수익 ₩${totalRevenue}`);
  }
);
