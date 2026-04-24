// functions/reportAppeal.js — 🚨 작성자 이의제기 CF (2026-04-24 Phase B)
//
// 🚀 submitContentAppeal — 신고 상태 대상글의 작성자가 이의제기 등록
//    대상 문서에 appealStatus='pending' + appealNote + appealAt 기록
//    → 관리자 UI ReportManagement에서 "⚡ 이의제기 대기" 우선큐 섹션으로 노출
//
// 🔒 작성자 본인만 호출 가능. 한 번 제기하면 appealStatus='resolved' 되기 전까지 재제기 불가
// 검색어: reportAppeal

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");

const db = getFirestore();

const COLLECTION_BY_TYPE = {
  post: "posts",
  comment: "comments",
  community_post: "community_posts",
  community_post_comment: "community_post_comments",
  episode: "posts",
};

const MAX_APPEAL_NOTE = 500;

exports.submitContentAppeal = onCall(
  { region: "asia-northeast3" },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
    const authorUid = request.auth.uid;
    const { targetType, targetId, note } = request.data || {};

    if (!COLLECTION_BY_TYPE[targetType]) {
      throw new HttpsError("invalid-argument", "지원하지 않는 targetType");
    }
    if (!targetId || typeof targetId !== "string") {
      throw new HttpsError("invalid-argument", "targetId 필수");
    }
    if (!note || typeof note !== "string" || note.trim().length < 5) {
      throw new HttpsError("invalid-argument", "이의제기 사유 5자 이상 필수");
    }
    if (note.length > MAX_APPEAL_NOTE) {
      throw new HttpsError("invalid-argument", `사유는 ${MAX_APPEAL_NOTE}자 이내여야 합니다.`);
    }

    const collName = COLLECTION_BY_TYPE[targetType];
    const targetRef = db.collection(collName).doc(targetId);
    const targetSnap = await targetRef.get();
    if (!targetSnap.exists) throw new HttpsError("not-found", "대상 글을 찾을 수 없습니다.");
    const data = targetSnap.data() || {};

    // 🔒 작성자 본인만
    const docAuthorUid = data.author_id || data.authorId;
    if (docAuthorUid !== authorUid) {
      throw new HttpsError("permission-denied", "작성자 본인만 이의제기 가능합니다.");
    }

    // 🔒 신고 상태에 있어야만 제기 가능
    if (!data.reportState) {
      throw new HttpsError("failed-precondition", "현재 신고 상태가 아닙니다.");
    }

    // 🔒 이미 pending 상태면 중복 차단
    if (data.appealStatus === "pending") {
      throw new HttpsError("already-exists", "이미 이의제기가 접수되어 검토 중입니다.");
    }

    await targetRef.update({
      appealStatus: "pending",
      appealNote: note.trim(),
      appealAt: Timestamp.now(),
    });

    console.log(`[submitContentAppeal] ${targetType}/${targetId} by ${authorUid} — note=${note.trim().slice(0, 50)}`);

    return { success: true };
  }
);
