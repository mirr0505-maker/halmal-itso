// functions/reportAggregator.js — 🚨 신고 고유 신고자 집계 (Sprint 4 Phase C)
// 매일 05:15 KST: reports 전체 순회 → targetUid별 고유 reporterUid Set 집계
//                → users.{uid}.reportsUniqueReporters + reportsUpdatedAt 갱신
// Why: creatorScoreCache(05:00)보다 15분 뒤 실행 — 반영 타이밍은 다음날 05:00 배치에서 감산 적용
//      고유 신고자 수만 Trust 감산 입력으로 사용 (담합 신고 1회는 감산 0)
// 검색어: reportAggregator

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");

const db = getFirestore();

exports.reportAggregator = onSchedule(
  {
    schedule: "15 5 * * *",
    timeZone: "Asia/Seoul",
    region: "asia-northeast3",
    timeoutSeconds: 540,
    memory: "1GiB",
  },
  async () => {
    // 1) reports 전체 순회 — status 무관 (pending/reviewed 모두 집계. 기각도 고유 신고자로 카운트)
    //    Why: 운영 판정 전에도 다수 신고가 들어오면 잠정 품질 리스크 신호로 활용
    const reportsSnap = await db.collection("reports").get();

    // targetUid → Set<reporterUid>
    const uniqueReportersByTarget = new Map();
    for (const doc of reportsSnap.docs) {
      const { targetUid, reporterUid } = doc.data() || {};
      if (!targetUid || !reporterUid) continue;
      if (!uniqueReportersByTarget.has(targetUid)) {
        uniqueReportersByTarget.set(targetUid, new Set());
      }
      uniqueReportersByTarget.get(targetUid).add(reporterUid);
    }
    console.log(`[reportAggregator] ${reportsSnap.size} reports → ${uniqueReportersByTarget.size} targets`);

    // 2) 전체 유저 순회 — reports가 있으면 수 갱신, 없으면 0으로 유지
    //    Why: 기존에 신고가 있었던 유저가 신고 문서 삭제 후 0으로 돌아가는 경우도 반영
    const usersSnap = await db.collection("users").get();
    const now = Timestamp.now();
    let batch = db.batch();
    let count = 0;
    let updated = 0;
    let skipped = 0;

    for (const userDoc of usersSnap.docs) {
      if (userDoc.id.startsWith("nickname_")) continue;
      const data = userDoc.data();
      const newCount = (uniqueReportersByTarget.get(userDoc.id) || new Set()).size;
      const prevCount = typeof data.reportsUniqueReporters === "number" ? data.reportsUniqueReporters : 0;

      if (newCount === prevCount) { skipped++; continue; }

      batch.update(userDoc.ref, {
        reportsUniqueReporters: newCount,
        reportsUpdatedAt: now,
      });
      count++;
      updated++;
      if (count >= 400) {
        await batch.commit();
        batch = db.batch();
        count = 0;
      }
    }
    if (count > 0) await batch.commit();

    console.log(`[reportAggregator] updated=${updated}, skipped=${skipped}`);
    return null;
  }
);
