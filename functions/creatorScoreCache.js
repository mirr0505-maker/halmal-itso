// functions/creatorScoreCache.js — 🏅 일일 Creator Score 전체 재계산
// 매일 05:00 KST: 모든 유저의 recent30d 집계 → Creator Score 산출 → users 캐시 갱신
// Why: reputationCache(04:45)보다 15분 뒤에 실행 — reputationCached 의존성
//      activity_logs 30일 윈도우를 group by uid, type으로 집계
// 검색어: creatorScoreCache

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { getFirestore, Timestamp, FieldValue } = require("firebase-admin/firestore");
const { resolveScore } = require("./utils/creatorScore");

const db = getFirestore();

exports.creatorScoreCache = onSchedule(
  { schedule: "0 5 * * *", timeZone: "Asia/Seoul", region: "asia-northeast3", timeoutSeconds: 540, memory: "1GiB" },
  async () => {
    // 1) 30일 윈도우 집계 — activity_logs 전체 스캔 (TTL로 30일 이내 문서만 존재)
    const windowStart = Timestamp.fromMillis(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const logsSnap = await db.collection("activity_logs")
      .where("createdAt", ">=", windowStart)
      .get();

    const counts = {}; // { [uid]: { posts, comments, likesSent } }
    for (const doc of logsSnap.docs) {
      const { uid, type } = doc.data();
      if (!uid || !type) continue;
      if (!counts[uid]) counts[uid] = { posts: 0, comments: 0, likesSent: 0 };
      if (type === "post") counts[uid].posts++;
      else if (type === "comment") counts[uid].comments++;
      else if (type === "likeSent") counts[uid].likesSent++;
    }
    console.log(`[creatorScoreCache] activity_logs aggregated: ${Object.keys(counts).length} users`);

    // 2) 전체 유저 순회 — recent30d 갱신 + creatorScore 재계산 + 변화 있으면 쓰기
    const usersSnap = await db.collection("users").get();
    let batch = db.batch();
    let count = 0;
    let updated = 0;
    let skipped = 0;
    const now = Timestamp.now();

    for (const userDoc of usersSnap.docs) {
      if (userDoc.id.startsWith("nickname_")) continue;
      const data = userDoc.data();

      const c = counts[userDoc.id] || { posts: 0, comments: 0, likesSent: 0 };
      // recent30d 집계값을 유저 문서에 병합 → resolveScore 입력
      const userWithRecent = {
        ...data,
        recent30d_posts: c.posts,
        recent30d_comments: c.comments,
        recent30d_likesSent: c.likesSent,
      };
      // 🔧 resolveScore: creatorScoreOverride 우선 적용. 만료 시 수식 fallback + 제거 신호
      const { value: newScore, tier: newTier, overrideExpired } = resolveScore(userWithRecent, now.toMillis());

      // 변화 없으면 쓰기 생략 (단, 만료된 override 정리는 강제 쓰기 유발)
      const prevScore = data.creatorScoreCached ?? null;
      const prevTier = data.creatorScoreTier ?? null;
      const prevPosts = data.recent30d_posts ?? null;
      const prevComments = data.recent30d_comments ?? null;
      const prevLikesSent = data.recent30d_likesSent ?? null;
      if (
        !overrideExpired
        && prevScore === newScore
        && prevTier === newTier
        && prevPosts === c.posts
        && prevComments === c.comments
        && prevLikesSent === c.likesSent
      ) {
        skipped++;
        continue;
      }

      const updatePayload = {
        creatorScoreCached: newScore,
        creatorScoreTier: newTier,
        creatorScoreUpdatedAt: now,
        recent30d_posts: c.posts,
        recent30d_comments: c.comments,
        recent30d_likesSent: c.likesSent,
        recent30dUpdatedAt: now,
      };
      // 만료된 override는 자동 제거 (수식 값으로 전환)
      if (overrideExpired) updatePayload.creatorScoreOverride = FieldValue.delete();
      batch.update(userDoc.ref, updatePayload);
      count++;
      updated++;
      if (count >= 400) {
        await batch.commit();
        batch = db.batch();
        count = 0;
      }
    }
    if (count > 0) await batch.commit();

    console.log(`[creatorScoreCache] updated=${updated}, skipped=${skipped}`);
    return null;
  }
);
