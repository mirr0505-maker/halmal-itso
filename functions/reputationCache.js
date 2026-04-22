// functions/reputationCache.js — 🏅 일일 전체 평판 재계산 캐시
// 매일 04:45 KST: 모든 유저 V2 공식 서버 계산 → users.reputationCached 필드 갱신
// Why: 클라이언트 getReputation()이 fallback 없이 DB 캐시값만 읽게 해 O(1) 조회 보장
//      Sprint 3 §8 결정 — 일일 전체 재계산(단순·정합성 우선, 1만 명 비용 ~$0.3/월)
// 검색어: reputationCache

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const { getReputationScoreV2Server, getReputationTierServer } = require("./utils/reputationV2");

const db = getFirestore();

exports.reputationCache = onSchedule(
  { schedule: "45 4 * * *", timeZone: "Asia/Seoul", region: "asia-northeast3", timeoutSeconds: 540 },
  async () => {
    const usersSnap = await db.collection("users").get();

    let batch = db.batch();
    let count = 0;
    let updated = 0;
    let skipped = 0;
    for (const userDoc of usersSnap.docs) {
      if (userDoc.id.startsWith("nickname_")) continue;
      const data = userDoc.data();

      const newScore = getReputationScoreV2Server(data);
      const newTier = getReputationTierServer(newScore);

      // 🚀 변동 없으면 write 생략 — 유저 대부분은 24h 내 지표 변화 없음 (비용 절감)
      const prevScore = data.reputationCached ?? null;
      const prevTier = data.reputationTierCached ?? null;
      if (prevScore === newScore && prevTier === newTier) {
        skipped++;
        continue;
      }

      batch.update(userDoc.ref, {
        reputationCached: newScore,
        reputationTierCached: newTier,
        reputationUpdatedAt: Timestamp.now(),
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
    console.log(`[reputationCache] updated=${updated}, skipped=${skipped}`);
    return null;
  },
);
