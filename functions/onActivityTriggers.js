// functions/onActivityTriggers.js — 🏅 활동 로그 자동 수집 트리거
// Sprint 4 Phase B — posts / comments / likes 변경을 감지해 activity_logs 기록
// Why: 클라이언트 코드 무변경 방침(B-1안). onDocumentCreated/Updated 트리거로 자동 수집
//      Admin SDK는 Rules를 우회하므로 activity_logs 쓰기 권한 문제 없음
// 검색어: onActivityTriggers

const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const { logActivity, isEligibleContent } = require("./activityLogger");

const db = getFirestore();
const REGION = "asia-northeast3";

// ═══════════════════════════════════════════════════════
// 1) 글 생성 → activity_logs (type: post) + lastActiveAt 갱신
// ═══════════════════════════════════════════════════════
// Why: 본문 10자 이상만 인정 (깐부방·유배·잉크병 전부 동일 기준)
exports.onPostCreatedForActivity = onDocumentCreated(
  { document: "posts/{postId}", region: REGION },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;
    const uid = data.author_id;
    if (!uid) return;
    if (!isEligibleContent(data.content)) return;

    await logActivity(uid, "post", event.params.postId);
    // lastActiveAt은 REPUTATION_V2 decay 입력 — 동일 트리거에서 갱신
    await db.collection("users").doc(uid).update({
      lastActiveAt: Timestamp.now(),
    }).catch(() => {}); // 유저 문서 없어도 트리거 실패 방지 (봇 글 등)
  }
);

// ═══════════════════════════════════════════════════════
// 2) 댓글 생성 → activity_logs (type: comment)
// ═══════════════════════════════════════════════════════
exports.onCommentCreatedForActivity = onDocumentCreated(
  { document: "comments/{commentId}", region: REGION },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;
    const uid = data.author_id;
    if (!uid) return;
    if (!isEligibleContent(data.content)) return;

    await logActivity(uid, "comment", event.params.commentId);
    await db.collection("users").doc(uid).update({
      lastActiveAt: Timestamp.now(),
    }).catch(() => {});
  }
);

// ═══════════════════════════════════════════════════════
// 3) 좋아요 추가 감지 → activity_logs (type: likeSent) + likesSent 누적
// ═══════════════════════════════════════════════════════
// Why: likedBy는 닉네임 배열 → 닉네임 색인(nickname_{X} 문서)로 UID 역조회
//      좋아요 해제(arrayRemove)는 로그 안 함. 추가분(after - before)만 기록.
exports.onPostLikeChangedForActivity = onDocumentUpdated(
  { document: "posts/{postId}", region: REGION },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;

    const beforeLikedBy = Array.isArray(before.likedBy) ? before.likedBy : [];
    const afterLikedBy = Array.isArray(after.likedBy) ? after.likedBy : [];
    if (beforeLikedBy.length >= afterLikedBy.length) return; // 해제 또는 무변화

    const added = afterLikedBy.filter((n) => !beforeLikedBy.includes(n));
    if (added.length === 0) return;

    // 닉네임 → UID 역조회 (nickname_{nickname} 색인 문서)
    await Promise.all(added.map(async (nickname) => {
      const idxDoc = await db.collection("users").doc(`nickname_${nickname}`).get();
      const uid = idxDoc.exists ? idxDoc.data().uid : null;
      if (!uid) return;
      await logActivity(uid, "likeSent", event.params.postId);
      await db.collection("users").doc(uid).update({
        likesSent: FieldValue.increment(1),
      }).catch(() => {});
    }));
  }
);

// ═══════════════════════════════════════════════════════
// 4) 댓글 좋아요 추가 감지 → activity_logs (type: likeSent) + likesSent 누적
// ═══════════════════════════════════════════════════════
exports.onCommentLikeChangedForActivity = onDocumentUpdated(
  { document: "comments/{commentId}", region: REGION },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;

    const beforeLikedBy = Array.isArray(before.likedBy) ? before.likedBy : [];
    const afterLikedBy = Array.isArray(after.likedBy) ? after.likedBy : [];
    if (beforeLikedBy.length >= afterLikedBy.length) return;

    const added = afterLikedBy.filter((n) => !beforeLikedBy.includes(n));
    if (added.length === 0) return;

    await Promise.all(added.map(async (nickname) => {
      const idxDoc = await db.collection("users").doc(`nickname_${nickname}`).get();
      const uid = idxDoc.exists ? idxDoc.data().uid : null;
      if (!uid) return;
      await logActivity(uid, "likeSent", event.params.commentId);
      await db.collection("users").doc(uid).update({
        likesSent: FieldValue.increment(1),
      }).catch(() => {});
    }));
  }
);
