// functions/activityLogger.js — 🏅 활동 로그 기록 헬퍼
// Sprint 4 Phase B — Creator Score recent30d 집계용 activity_logs 쓰기
// Why: 글·댓글·좋아요 이벤트를 30일 윈도우로 집계해 activity 점수 계산
//      TTL은 Firestore 콘솔에서 expiresAt 필드 기준 자동 삭제 정책 설정 필요
// 검색어: activityLogger
//
// 활동 유형:
//   - post:       본문 10자 이상 글 작성
//   - comment:    본문 10자 이상 댓글 작성
//   - likeSent:   내가 타인 글·댓글에 좋아요 추가 (해제 시 로그 안 함)
//
// 스키마: activity_logs/{autoId}
//   uid:       활동자 UID
//   type:      'post' | 'comment' | 'likeSent'
//   refId:     대상 게시물·댓글 ID (likeSent는 대상 postId)
//   createdAt: Timestamp
//   expiresAt: Timestamp (createdAt + 30일, TTL 삭제 기준)

const { getFirestore, Timestamp } = require("firebase-admin/firestore");

const db = getFirestore();
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

// 10자 이상 판정 — HTML 태그 제거 + 공백 제거 후 글자 수
// Why: isEligibleForExp()와 동일 기준. 스팸 글·댓글은 활동 로그 기록 안 함
function isEligibleContent(content) {
  if (!content) return false;
  const plain = String(content).replace(/<[^>]+>/g, "").replace(/\s/g, "");
  return plain.length >= 10;
}

// activity_logs 문서 1건 쓰기
async function logActivity(uid, type, refId) {
  if (!uid || !type) return;
  const now = Timestamp.now();
  const expiresAt = Timestamp.fromMillis(now.toMillis() + RETENTION_MS);
  await db.collection("activity_logs").add({
    uid,
    type,
    refId: refId || null,
    createdAt: now,
    expiresAt,
  });
}

module.exports = { logActivity, isEligibleContent };
