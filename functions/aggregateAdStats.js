// functions/aggregateAdStats.js — 광고 일별 통계 집계
// 🚀 v2 P0-3 (2026-04-26): 매일 04:30 KST 전일 adEvents 광고별 집계 → ad_stats_daily
//   집계 결과: impressions / viewableImpressions / clicks / spent / uniqueViewers
//             + bySlot / byMenu / byRegion / byHour 분해
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const { logger } = require("firebase-functions");

const db = getFirestore();

function ymdKST(date) {
  const kst = new Date(date.getTime() + 9 * 3600 * 1000);
  return kst.toISOString().slice(0, 10).replace(/-/g, '');
}

exports.aggregateAdStats = onSchedule(
  { schedule: "30 4 * * *", timeZone: "Asia/Seoul", region: "asia-northeast3", memory: "512MiB", timeoutSeconds: 540 },
  async () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 86400 * 1000);
    const yesterdayKST = new Date(yesterday.getTime() + 9 * 3600 * 1000);
    yesterdayKST.setUTCHours(0, 0, 0, 0);
    const startKST = new Date(yesterdayKST.getTime() - 9 * 3600 * 1000); // KST 자정 → UTC
    const endKST = new Date(startKST.getTime() + 86400 * 1000);
    const dateStr = ymdKST(yesterday);

    // adEvents 전일 분 모두 (광고별 집계는 메모리에서)
    const snap = await db.collection('adEvents')
      .where('createdAt', '>=', Timestamp.fromDate(startKST))
      .where('createdAt', '<', Timestamp.fromDate(endKST))
      .get();

    // 광고별 누적 객체
    const stats = {}; // adId -> { impressions, viewableImpressions, clicks, spent, viewers: Set, bySlot, byMenu, byRegion, byHour }

    for (const docSnap of snap.docs) {
      const e = docSnap.data();
      const adId = e.adId;
      if (!adId) continue;
      if (!stats[adId]) {
        stats[adId] = {
          impressions: 0, viewableImpressions: 0, clicks: 0, spent: 0,
          viewers: new Set(),
          bySlot: { top: 0, middle: 0, bottom: 0, feed: 0 },
          byMenu: {}, byRegion: {},
          byHour: new Array(24).fill(0),
        };
      }
      const s = stats[adId];

      if (e.eventType === 'impression') {
        s.impressions++;
        if (e.slotPosition && s.bySlot[e.slotPosition] !== undefined) s.bySlot[e.slotPosition]++;
        if (e.postCategory) s.byMenu[e.postCategory] = (s.byMenu[e.postCategory] || 0) + 1;
        if (e.viewerRegion) s.byRegion[e.viewerRegion] = (s.byRegion[e.viewerRegion] || 0) + 1;
        if (e.viewerUid && e.viewerUid !== 'anonymous') s.viewers.add(e.viewerUid);
        const hr = e.createdAt?.toDate ? new Date(e.createdAt.toDate().getTime() + 9 * 3600 * 1000).getUTCHours() : 0;
        s.byHour[hr]++;
      } else if (e.eventType === 'viewable') {
        s.viewableImpressions++;
        s.spent += e.bidAmount || 0;
      } else if (e.eventType === 'click') {
        s.clicks++;
        s.spent += e.bidAmount || 0;
      }
    }

    // ad_stats_daily 문서 작성 (배치 400)
    const adIds = Object.keys(stats);
    let batch = db.batch();
    let count = 0;
    for (const adId of adIds) {
      const s = stats[adId];
      const docRef = db.collection('ad_stats_daily').doc(`${adId}_${dateStr}`);
      batch.set(docRef, {
        adId, date: dateStr.slice(0,4)+'-'+dateStr.slice(4,6)+'-'+dateStr.slice(6,8),
        impressions: s.impressions,
        viewableImpressions: s.viewableImpressions,
        clicks: s.clicks,
        spent: s.spent,
        uniqueViewers: s.viewers.size,
        bySlot: s.bySlot,
        byMenu: s.byMenu,
        byRegion: s.byRegion,
        byHour: s.byHour,
        createdAt: Timestamp.now(),
      });
      count++;
      if (count % 400 === 0) {
        await batch.commit();
        batch = db.batch();
      }
    }
    if (count % 400 !== 0) await batch.commit();
    logger.info(`[aggregateAdStats] date=${dateStr} ads=${adIds.length} events=${snap.size}`);
  }
);
