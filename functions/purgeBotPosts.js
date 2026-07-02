// functions/purgeBotPosts.js — 🧹 봇 글 TTL 자동 삭제 (전령 + 정보봇)
// ⚡ 2026-05-13 Perf Phase B
//   3개 컬렉션 일괄 cleanup. 30일 초과 봇 콘텐츠 + 관련 댓글 + dedup 마커 batch delete.
//   대상:
//     1. posts where category == '마라톤의 전령' && createdAt < now-30d
//        → 해당 글 + comments where (rootId == postId || parentId == postId)
//     2. community_posts where isBot == true && createdAt < now-30d
//        → 해당 글 + community_post_comments where postId == X
//     3. glove_bot_dedup/{communityId}/items/* where postedAt < now-30d
//        → dedup 마커도 함께 정리 (재페치 차단 효과 30일로 한정)
//   유저가 작성한 글은 isBot 플래그 없음 → 자동 제외 (보존).
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const { logger } = require("firebase-functions");

const db = getFirestore();

const RETENTION_DAYS = 30;
const BATCH_SIZE = 400; // Firestore batch 상한 500 - 안전 마진

// 단일 batch commit 헬퍼 (refs 400개 단위)
async function batchDelete(refs) {
  if (refs.length === 0) return 0;
  let deleted = 0;
  for (let i = 0; i < refs.length; i += BATCH_SIZE) {
    const slice = refs.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const ref of slice) batch.delete(ref);
    await batch.commit();
    deleted += slice.length;
  }
  return deleted;
}

// 글 N개의 댓글들을 collectionGroup으로 일괄 조회 (rootId or parentId 매칭)
// Why: 댓글 수 많을 수 있어 글마다 쿼리 N+1 회피 — 글 ID Set으로 한 번에 조회.
async function findRelatedComments(collectionName, fieldName, postIds) {
  if (postIds.length === 0) return [];
  const refs = [];
  // Firestore where in 은 30개 상한 → 청크 분할
  for (let i = 0; i < postIds.length; i += 30) {
    const chunk = postIds.slice(i, i + 30);
    const snap = await db.collection(collectionName).where(fieldName, "in", chunk).get();
    for (const doc of snap.docs) refs.push(doc.ref);
  }
  return refs;
}

exports.purgeBotPosts = onSchedule(
  {
    schedule: "0 4 * * *",
    timeZone: "Asia/Seoul",
    region: "asia-northeast3",
    timeoutSeconds: 540,
    memory: "512MiB",
  },
  async () => {
    const cutoff = Timestamp.fromMillis(Date.now() - RETENTION_DAYS * 86400 * 1000);
    logger.info(`[purgeBotPosts] 시작 — cutoff=${cutoff.toDate().toISOString()} (보존 ${RETENTION_DAYS}일)`);

    let stats = {
      heraldPosts: 0, heraldComments: 0,
      botCommunityPosts: 0, botCommunityComments: 0,
      dedupItems: 0,
    };

    // ── 1. 전령 글 + 댓글 ─────────────────────────────────
    try {
      const heraldSnap = await db.collection("posts")
        .where("category", "==", "마라톤의 전령")
        .where("createdAt", "<", cutoff)
        .get();
      const heraldIds = heraldSnap.docs.map(d => d.id);
      const heraldRefs = heraldSnap.docs.map(d => d.ref);
      // 댓글 — rootId 또는 parentId가 삭제 대상 글 ID에 매칭되는 것 모두 수거
      const commentByRoot = await findRelatedComments("comments", "rootId", heraldIds);
      const commentByParent = await findRelatedComments("comments", "parentId", heraldIds);
      // Set으로 중복 제거 (rootId === parentId인 1단계 댓글 케이스)
      const commentSeen = new Set();
      const commentRefs = [...commentByRoot, ...commentByParent].filter(ref => {
        if (commentSeen.has(ref.path)) return false;
        commentSeen.add(ref.path);
        return true;
      });
      stats.heraldComments = await batchDelete(commentRefs);
      stats.heraldPosts = await batchDelete(heraldRefs);
      logger.info(`[purgeBotPosts] 전령: 글 ${stats.heraldPosts} + 댓글 ${stats.heraldComments} 삭제`);
    } catch (err) {
      logger.error("[purgeBotPosts] 전령 처리 실패", err);
    }

    // ── 2. 봇 community_posts + community_post_comments ─────
    try {
      const botCpSnap = await db.collection("community_posts")
        .where("isBot", "==", true)
        .where("createdAt", "<", cutoff)
        .get();
      const botCpIds = botCpSnap.docs.map(d => d.id);
      const botCpRefs = botCpSnap.docs.map(d => d.ref);
      const cpcRefs = await findRelatedComments("community_post_comments", "postId", botCpIds);
      stats.botCommunityComments = await batchDelete(cpcRefs);
      stats.botCommunityPosts = await batchDelete(botCpRefs);
      logger.info(`[purgeBotPosts] 봇 커뮤니티 글: ${stats.botCommunityPosts} + 댓글 ${stats.botCommunityComments} 삭제`);
    } catch (err) {
      logger.error("[purgeBotPosts] 봇 커뮤니티 글 처리 실패", err);
    }

    // ── 3. glove_bot_dedup 30일 초과 정리 ──────────────────
    // Why: dedup 영구 보존 시 30일 후 동일 URL 재기사화 차단 = 새 글 못 올림.
    //      봇 글 자체가 30일 후 삭제되므로 dedup도 동일 윈도우.
    try {
      const dedupSnap = await db.collectionGroup("items")
        .where("postedAt", "<", cutoff)
        .get();
      // collectionGroup이 다른 컬렉션의 items도 잡을 수 있어 path 가드.
      const dedupRefs = dedupSnap.docs
        .filter(d => d.ref.path.startsWith("glove_bot_dedup/"))
        .map(d => d.ref);
      stats.dedupItems = await batchDelete(dedupRefs);
      logger.info(`[purgeBotPosts] dedup 마커 ${stats.dedupItems} 삭제`);
    } catch (err) {
      logger.error("[purgeBotPosts] dedup 처리 실패", err);
    }

    logger.info(`[purgeBotPosts] 완료 — ${JSON.stringify(stats)}`);
  }
);
