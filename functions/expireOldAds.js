// functions/expireOldAds.js — 만료된 광고 자동 처리 (2026-04-25)
// 🚀 매일 04:10 KST: ads.endDate < now AND status in ['active', 'paused'] → status='completed'
//   광고주에게 ad_expired 알림 발송. syncAdBids 트리거가 adBids.status도 자동 동기화.
// Why: 등록 시 endDate=startDate로 저장되던 버그 + 자동 만료 처리 부재 → 만료된 광고 무한 노출 위험
// 검색어: expireOldAds

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");

const db = getFirestore();

exports.expireOldAds = onSchedule(
  // 🔧 timeZone 명시 — onSchedule default는 UTC. KST 04:10 정확히 맞추려면 필수.
  { schedule: "10 4 * * *", timeZone: "Asia/Seoul", region: "asia-northeast3", timeoutSeconds: 120, memory: "256MiB" },
  async () => {
    const now = Timestamp.now();
    const snap = await db.collection("ads").get();
    let expiredCount = 0;
    const batch = db.batch();
    const notifyTargets = [];

    snap.docs.forEach((d) => {
      const data = d.data();
      if (!data.endDate || typeof data.endDate.toMillis !== "function") return;
      if (data.endDate.toMillis() >= now.toMillis()) return;
      if (!["active", "paused"].includes(data.status)) return;

      batch.update(d.ref, {
        status: "completed",
        updatedAt: FieldValue.serverTimestamp(),
      });
      expiredCount++;
      if (data.advertiserId && data.id) {
        notifyTargets.push({ advertiserId: data.advertiserId, adId: data.id, headline: data.headline || "(제목 없음)" });
      }
    });

    if (expiredCount > 0) await batch.commit();

    // 광고주 알림 (트랜잭션 외부, 배치 후 일괄)
    for (const t of notifyTargets) {
      await db.collection("notifications").doc(t.advertiserId).collection("items").add({
        type: "ad_expired",
        fromNickname: "운영진",
        adId: t.adId,
        body: `⌛ 광고 게재 기간이 종료되었어요.\n📌 광고: 「${t.headline}」\n계속 노출하려면 새 광고로 등록해 주세요.`,
        read: false,
        createdAt: Timestamp.now(),
      });
    }

    console.log(`[expireOldAds] ${expiredCount}개 광고 만료 처리 + 알림 ${notifyTargets.length}건`);
    return null;
  }
);
