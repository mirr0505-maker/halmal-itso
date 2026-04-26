// functions/budgetEnforcer.js — 광고 예산 자동 정지·재개
// 🚀 v2 P0-1 (2026-04-26)
//   - enforceBudgetLimits: 매시간 — 일/총 예산 도달 ad 자동 정지
//   - releaseDailyBudgetPause: 매일 04:00 KST — 일예산 정지 ad 재개 + todaySpent 리셋
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const { logger } = require("firebase-functions");

const db = getFirestore();

// 매시간 — 예산 도달 광고 자동 정지
exports.enforceBudgetLimits = onSchedule(
  { schedule: "0 * * * *", timeZone: "Asia/Seoul", region: "asia-northeast3", memory: "256MiB" },
  async () => {
    const now = Timestamp.now();
    const snap = await db.collection('ads').where('status', '==', 'active').get();
    let pausedDaily = 0, completedTotal = 0;

    for (const docSnap of snap.docs) {
      const ad = docSnap.data();
      const todaySpent = ad.todaySpent || 0;
      const totalSpent = ad.totalSpent || 0;
      const updates = {};

      // 총예산 도달 → 종료 (재개 안 됨)
      if (ad.totalBudget && totalSpent >= ad.totalBudget) {
        updates.status = 'completed';
        updates.pausedReason = 'budget_total';
        updates.updatedAt = now;
        await docSnap.ref.update(updates);
        await notifyAdvertiser(ad.advertiserId, ad.id, ad.title, 'budget_total');
        completedTotal++;
        continue;
      }

      // 일예산 도달 → 일시정지 (다음날 04:00 자동 재개)
      if (ad.dailyBudget && todaySpent >= ad.dailyBudget) {
        updates.status = 'paused';
        updates.pausedReason = 'budget_daily';
        updates.updatedAt = now;
        await docSnap.ref.update(updates);
        await notifyAdvertiser(ad.advertiserId, ad.id, ad.title, 'budget_daily');
        pausedDaily++;
      }
    }

    logger.info(`[enforceBudgetLimits] paused_daily=${pausedDaily} completed_total=${completedTotal}`);
  }
);

// 매일 04:00 KST — 일예산 정지 ad 재개 + todaySpent 리셋
exports.releaseDailyBudgetPause = onSchedule(
  { schedule: "0 4 * * *", timeZone: "Asia/Seoul", region: "asia-northeast3", memory: "256MiB" },
  async () => {
    const now = Timestamp.now();
    const snap = await db.collection('ads')
      .where('status', '==', 'paused')
      .where('pausedReason', '==', 'budget_daily')
      .get();
    let resumed = 0;
    for (const docSnap of snap.docs) {
      await docSnap.ref.update({
        status: 'active',
        pausedReason: FieldValue.delete(),
        todaySpent: 0,
        lastSpentResetAt: now,
        updatedAt: now,
      });
      resumed++;
    }
    // 모든 active 광고 todaySpent 리셋 (정지 안 됐어도 자정 리셋)
    const activeSnap = await db.collection('ads').where('status', '==', 'active').get();
    for (const docSnap of activeSnap.docs) {
      const ad = docSnap.data();
      if ((ad.todaySpent || 0) > 0) {
        await docSnap.ref.update({ todaySpent: 0, lastSpentResetAt: now });
      }
    }
    logger.info(`[releaseDailyBudgetPause] resumed=${resumed} total_active=${activeSnap.size}`);
  }
);

async function notifyAdvertiser(advertiserId, adId, adTitle, reason) {
  if (!advertiserId) return;
  const messages = {
    budget_daily: `📊 일예산 소진으로 광고가 일시정지됐어요. 내일 04:00에 자동 재개됩니다.`,
    budget_total: `🎯 총예산 도달로 광고가 종료됐어요. 광고주센터에서 확인 가능합니다.`,
  };
  try {
    await db.collection('notifications').doc(advertiserId).collection('items').add({
      type: 'ad_budget_paused',
      message: `[${adTitle}] ${messages[reason]}`,
      adId,
      reason,
      read: false,
      isRead: false,
      createdAt: Timestamp.now(),
    });
  } catch (err) {
    logger.error('[notifyAdvertiser]', err);
  }
}
