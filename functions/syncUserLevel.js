// functions/syncUserLevel.js — 📈 일일 레벨 동기화 배치
// 매일 06:00 KST: 모든 유저의 level vs calculateLevel(exp) 불일치 교정
// Why: 옵션 B 원칙 2 — 타인 EXP 지급 경로(좋아요 마일스톤 +5 등)는 수신자의 exp만 increment하고
//      level은 갱신 못 함(호출자가 타인 current exp 모름). 이 불일치를 매일 한 번 교정.
// 선행: reputationCache(04:45) → creatorScoreCache(05:00) → syncUserLevel(06:00)
// 근거: project_level_sync_cf_backlog.md — Phase C Gate 함수(Lv5+) 권위 읽기 전 반드시 배포
// 검색어: syncUserLevel

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { getFirestore } = require("firebase-admin/firestore");
const { calculateLevel } = require("./utils/levelSync");

const db = getFirestore();

exports.syncUserLevel = onSchedule(
  { schedule: "0 6 * * *", timeZone: "Asia/Seoul", region: "asia-northeast3", timeoutSeconds: 540, memory: "512MiB" },
  async () => {
    const usersSnap = await db.collection("users").get();
    let batch = db.batch();
    let count = 0;
    let updated = 0;
    let skipped = 0;

    for (const userDoc of usersSnap.docs) {
      // 닉네임 인덱스 문서는 스킵 (exp/level 필드 없음)
      if (userDoc.id.startsWith("nickname_")) continue;
      const data = userDoc.data();

      const exp = typeof data.exp === "number" ? data.exp : 0;
      const currentLevel = typeof data.level === "number" ? data.level : 0;
      const expectedLevel = calculateLevel(exp);

      if (currentLevel === expectedLevel) {
        skipped++;
        continue;
      }

      batch.update(userDoc.ref, { level: expectedLevel });
      count++;
      updated++;
      if (count >= 400) {
        await batch.commit();
        batch = db.batch();
        count = 0;
      }
    }
    if (count > 0) await batch.commit();

    console.log(`[syncUserLevel] updated=${updated}, skipped=${skipped}`);
    return null;
  }
);
