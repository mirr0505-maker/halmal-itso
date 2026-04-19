// functions/ballAudit.js — 🔒 땡스볼 장부 ↔ 잔액 정합성 감사
// 매일 04:30 KST: 전일 스냅샷 + 24h 트랜잭션 inflow/outflow → 오늘 스냅샷 교차 검증
// Why: 재난복구·분쟁 대응 시 "이 시점에 잔액이 올바랐는가" 증명 필요
// 불일치 감지 시 audit_anomalies/{yyyyMMdd}_{uid}에 기록 (관리자 read only)
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");

const db = getFirestore();

function seoulDateOffsetKey(offsetDays = 0) {
  const now = new Date();
  now.setUTCDate(now.getUTCDate() + offsetDays);
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(kst.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

exports.auditBallBalance = onSchedule(
  { schedule: "30 4 * * *", timeZone: "Asia/Seoul", region: "asia-northeast3" },
  async () => {
    const today = seoulDateOffsetKey(0);
    const yesterday = seoulDateOffsetKey(-1);

    // 1. 어제·오늘 스냅샷 로드 → uid 기준 Map
    const yesterdaySnap = await db.collection("ball_balance_snapshots")
      .where("dateKey", "==", yesterday).get();
    const todaySnap = await db.collection("ball_balance_snapshots")
      .where("dateKey", "==", today).get();
    const yesterdayMap = new Map();
    yesterdaySnap.docs.forEach(d => yesterdayMap.set(d.data().uid, d.data()));
    const todayMap = new Map();
    todaySnap.docs.forEach(d => todayMap.set(d.data().uid, d.data()));

    // 2. 24h 트랜잭션 조회 — 어제 스냅샷(04:00 KST) 이후 생성된 건
    //    어제 04:00 KST = UTC로 전일 19:00
    const cutoffUtc = new Date();
    cutoffUtc.setUTCHours(cutoffUtc.getUTCHours() - 24, 30, 0, 0);
    const txSnap = await db.collection("ball_transactions")
      .where("createdAt", ">=", Timestamp.fromDate(cutoffUtc)).get();

    // 3. uid별 inflow/outflow 집계
    const inflow = new Map();  // 수신액 합
    const outflow = new Map(); // 송신액 합
    for (const txDoc of txSnap.docs) {
      const tx = txDoc.data();
      if (typeof tx.amount !== "number") continue;
      outflow.set(tx.senderUid, (outflow.get(tx.senderUid) || 0) + tx.amount);
      if (tx.resolvedRecipientUid) {
        inflow.set(tx.resolvedRecipientUid, (inflow.get(tx.resolvedRecipientUid) || 0) + tx.amount);
      }
    }

    // 4. 교차 검증: todayBalance == yesterdayBalance - outflow + inflow
    //    diff < 0이면 장부보다 잔액이 적음 → 누락·유출 의심
    //    diff > 0이면 장부 외 충전 경로(testChargeBall 등) — 경고만, 에러 아님
    let anomalies = 0;
    let batch = db.batch();
    let count = 0;
    for (const [uid, todayData] of todayMap) {
      const y = yesterdayMap.get(uid);
      if (!y) continue; // 신규 유저
      const expected = (y.ballBalance || 0) - (outflow.get(uid) || 0) + (inflow.get(uid) || 0);
      const actual = todayData.ballBalance || 0;
      const diff = actual - expected;
      if (diff < 0) {
        const anomalyRef = db.collection("audit_anomalies").doc(`${today}_${uid}`);
        batch.set(anomalyRef, {
          uid, dateKey: today,
          expected, actual, diff,
          yesterdayBalance: y.ballBalance || 0,
          inflow: inflow.get(uid) || 0,
          outflow: outflow.get(uid) || 0,
          severity: "critical",
          detectedAt: Timestamp.now(),
        });
        anomalies++;
        count++;
        if (count >= 400) { await batch.commit(); batch = db.batch(); count = 0; }
      }
    }
    if (count > 0) await batch.commit();
    console.log(`[auditBallBalance] ${today}: ${anomalies} anomalies detected (users=${todayMap.size}, tx=${txSnap.size})`);
    return null;
  },
);
