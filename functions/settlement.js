// functions/settlement.js — 정산 처리
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");

const db = getFirestore();

exports.processSettlements = onSchedule(
  { schedule: "every monday 00:00", region: "asia-northeast3", timeoutSeconds: 120, memory: "256MiB" },
  async () => {
    console.log("[정산] 주간 정산 시작");

    const pendingSnap = await db.collection("settlements").where("status", "==", "pending").get();
    if (pendingSnap.empty) { console.log("[정산] 대기 건 없음"); return; }

    let processed = 0;
    for (const docSnap of pendingSnap.docs) {
      const st = docSnap.data();

      await docSnap.ref.update({
        status: "completed", completedAt: Timestamp.now(), updatedAt: Timestamp.now(), taxReportGenerated: true,
      });

      await db.collection("users").doc(st.creatorId).update({
        totalSettled: FieldValue.increment(st.netAmount),
      });

      await db.collection("notifications").doc(st.creatorId).collection("items").add({
        type: "settlement_completed",
        message: `₩${st.netAmount.toLocaleString()} 정산이 완료되었습니다.`,
        isRead: false, createdAt: Timestamp.now(),
      });

      processed++;
    }

    console.log(`[정산] 완료 — ${processed}건 처리`);
  }
);
