// functions/reportSubmit.js — 🚨 사용자 신고 제출 (Sprint 4 Phase C)
// onCall: 클라이언트 신고 버튼 → reports/{targetId}_{reporterUid} 멱등 생성
// Why: reports 원장을 바탕으로 reportAggregator가 users.reportsUniqueReporters 갱신
//      → Trust Score의 REPORT_PENALTIES 감산 → 최종 Creator Score 품질 반영
// 검색어: reportSubmit

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");

const db = getFirestore();

// 🔒 신고 사유 최대 길이 — DB 용량 공격 방지
const MAX_REASON_LENGTH = 300;

// 🔒 허용 대상 타입 — 임의 컬렉션 신고 차단
const ALLOWED_TARGET_TYPES = new Set([
  "post", "comment", "community_post", "community_post_comment", "episode",
]);

// targetType → Firestore 컬렉션명 매핑
const COLLECTION_BY_TYPE = {
  post: "posts",
  comment: "comments",
  community_post: "community_posts",
  community_post_comment: "community_post_comments",
  episode: "posts", // 잉크병 회차는 posts 컬렉션에 category='magic_inkwell'
};

exports.submitReport = onCall(
  { region: "asia-northeast3" },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
    const reporterUid = request.auth.uid;
    const { targetType, targetId, reason } = request.data || {};

    // 🔒 입력 검증
    if (!targetType || !ALLOWED_TARGET_TYPES.has(targetType)) {
      throw new HttpsError("invalid-argument", "지원하지 않는 targetType.");
    }
    if (!targetId || typeof targetId !== "string") {
      throw new HttpsError("invalid-argument", "targetId가 필요합니다.");
    }
    if (reason != null && (typeof reason !== "string" || reason.length > MAX_REASON_LENGTH)) {
      throw new HttpsError("invalid-argument", `사유는 ${MAX_REASON_LENGTH}자 이내여야 합니다.`);
    }

    // 🔒 대상 글/댓글 조회 → targetUid(작성자) 해석
    const collName = COLLECTION_BY_TYPE[targetType];
    const targetSnap = await db.collection(collName).doc(targetId).get();
    if (!targetSnap.exists) {
      throw new HttpsError("not-found", "신고 대상이 존재하지 않습니다.");
    }
    const targetData = targetSnap.data() || {};
    const targetUid = targetData.author_id || targetData.authorId;
    if (!targetUid) {
      throw new HttpsError("failed-precondition", "대상 작성자를 확인할 수 없습니다.");
    }

    // 🔒 자기 신고 차단
    if (targetUid === reporterUid) {
      throw new HttpsError("invalid-argument", "자기 자신을 신고할 수 없습니다.");
    }

    // 🔒 멱등 키 — 동일 신고자가 같은 타겟 중복 신고 차단
    //    docId: {targetType}_{targetId}_{reporterUid}
    const reportId = `${targetType}_${targetId}_${reporterUid}`;
    const reportRef = db.collection("reports").doc(reportId);
    const existing = await reportRef.get();
    if (existing.exists) {
      return { success: true, alreadyReported: true };
    }

    await reportRef.set({
      id: reportId,
      targetType,
      targetId,
      targetUid,
      reporterUid,
      reason: reason || "",
      status: "pending",
      createdAt: Timestamp.now(),
    });

    return { success: true, alreadyReported: false };
  }
);
