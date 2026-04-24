// functions/reportResolve.js — 🚨 관리자 신고 조치 CF 3종 (2026-04-24 Phase 3)
//
// 🚀 resolveReport  — 관리자가 신고 처리 (조치 실행 + 상태 resolved)
//                     actions: hide_content | delete_content | warn_user | none
// 🚀 rejectReport   — 관리자가 신고 기각 (상태 rejected)
// 🚀 restoreHiddenPost — 자동 숨김된 컨텐츠 복구 (isHiddenByReport=false + 관련 reports rejected)
//
// 🔒 관리자 전용 — assertAdmin + admin_actions 감사 로그
// 📝 결과: reports.{status,resolvedBy,resolvedAt,resolution,resolutionNote} 업데이트
//          + 신고자들에게 알림(Phase 4 — 현재는 skip, notifyParticipants=true일 때만)
// 검색어: reportResolve

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const { assertAdmin } = require("./utils/adminAuth");
const { logAdminAction } = require("./adminAudit");

const db = getFirestore();

const ALLOWED_ACTIONS = new Set(["hide_content", "delete_content", "warn_user", "none"]);

const COLLECTION_BY_TYPE = {
  post: "posts",
  comment: "comments",
  community_post: "community_posts",
  community_post_comment: "community_post_comments",
  episode: "posts",
};

// ═══════════════════════════════════════════════════════════════
// 🚀 resolveReport — 관리자 조치 + 상태 resolved
// ═══════════════════════════════════════════════════════════════
exports.resolveReport = onCall(
  { region: "asia-northeast3" },
  async (request) => {
    const { adminUid, adminName, viaClaims } = await assertAdmin(request.auth);
    const { reportId, action, note, notifyParticipants } = request.data || {};

    if (typeof reportId !== "string" || !reportId) {
      throw new HttpsError("invalid-argument", "reportId가 필요합니다.");
    }
    if (!ALLOWED_ACTIONS.has(action)) {
      throw new HttpsError("invalid-argument", "유효하지 않은 action (hide_content | delete_content | warn_user | none)");
    }
    if (typeof note !== "string" || note.trim().length < 2) {
      throw new HttpsError("invalid-argument", "사유(note) 2자 이상 필수");
    }

    const reportRef = db.collection("reports").doc(reportId);
    const reportSnap = await reportRef.get();
    if (!reportSnap.exists) throw new HttpsError("not-found", "신고 문서를 찾을 수 없습니다.");
    const reportData = reportSnap.data();
    const { targetType, targetId, targetUid } = reportData;

    // 1) 조치 실행
    const collName = COLLECTION_BY_TYPE[targetType];
    if (!collName) throw new HttpsError("failed-precondition", "지원하지 않는 targetType");
    const targetRef = db.collection(collName).doc(targetId);

    if (action === "hide_content") {
      await targetRef.update({
        isHiddenByReport: true,
        hiddenByReportAt: Timestamp.now(),
      });
    } else if (action === "delete_content") {
      // soft delete (isDeleted 표식 — 영구 삭제 원하면 별도 관리자 수동)
      await targetRef.update({
        isHiddenByReport: true,
        isDeleted: true,
        hiddenByReportAt: Timestamp.now(),
      });
    } else if (action === "warn_user") {
      // 피신고자에게 경고 알림
      await db.collection("notifications").doc(targetUid).collection("items").add({
        type: "report_warning",
        fromNickname: "운영진",
        body: `귀하의 컨텐츠가 커뮤니티 가이드라인 위반으로 판단되어 경고가 발송되었습니다.\n사유: ${note.trim().slice(0, 200)}`,
        read: false,
        createdAt: Timestamp.now(),
      });
    }
    // action === "none" → 조치 없음, 상태만 resolved

    // 2) reports 문서 업데이트
    await reportRef.update({
      status: "resolved",
      resolution: action,
      resolutionNote: note.trim(),
      resolvedBy: adminUid,
      resolvedAt: Timestamp.now(),
    });

    // 3) 같은 targetId의 다른 pending reports도 일괄 resolved 처리
    //    (한 번에 일괄 조치 — 관리자 작업 효율)
    const sameTargetSnap = await db.collection("reports")
      .where("targetId", "==", targetId)
      .where("status", "==", "pending")
      .get();
    let batch = db.batch();
    let count = 0;
    const affectedReporters = new Set();
    sameTargetSnap.docs.forEach(d => {
      if (d.id === reportId) return;
      batch.update(d.ref, {
        status: "resolved",
        resolution: action,
        resolutionNote: note.trim(),
        resolvedBy: adminUid,
        resolvedAt: Timestamp.now(),
      });
      count++;
      const reporterUid = d.data().reporterUid;
      if (reporterUid) affectedReporters.add(reporterUid);
    });
    if (count > 0) await batch.commit();

    // 4) 신고자들에게 처리 결과 알림 (Phase 4 요구사항 — notifyParticipants true일 때만)
    if (notifyParticipants) {
      const reporterSet = new Set(affectedReporters);
      reporterSet.add(reportData.reporterUid);
      for (const reporterUid of reporterSet) {
        await db.collection("notifications").doc(reporterUid).collection("items").add({
          type: "report_resolved",
          fromNickname: "운영진",
          body: `신고하신 내용이 검토되어 처리되었습니다.\n조치: ${actionLabel(action)}`,
          read: false,
          createdAt: Timestamp.now(),
        });
      }
    }

    // 5) admin_actions 감사 로그
    await logAdminAction({
      action: "resolve_report",
      adminUid,
      adminName,
      viaClaims,
      targetUid,
      payload: { reportId, targetType, targetId, resolution: action, bulkCount: count },
      reason: note.trim(),
    });

    return {
      success: true,
      bulkResolvedCount: count,
      action,
    };
  }
);

// ═══════════════════════════════════════════════════════════════
// 🚀 rejectReport — 관리자 기각 (악성·허위 신고로 판단)
// ═══════════════════════════════════════════════════════════════
exports.rejectReport = onCall(
  { region: "asia-northeast3" },
  async (request) => {
    const { adminUid, adminName, viaClaims } = await assertAdmin(request.auth);
    const { reportId, note } = request.data || {};

    if (typeof reportId !== "string" || !reportId) {
      throw new HttpsError("invalid-argument", "reportId가 필요합니다.");
    }
    if (typeof note !== "string" || note.trim().length < 2) {
      throw new HttpsError("invalid-argument", "기각 사유 2자 이상 필수");
    }

    const reportRef = db.collection("reports").doc(reportId);
    const reportSnap = await reportRef.get();
    if (!reportSnap.exists) throw new HttpsError("not-found", "신고 문서를 찾을 수 없습니다.");
    const reportData = reportSnap.data();

    await reportRef.update({
      status: "rejected",
      resolutionNote: note.trim(),
      resolvedBy: adminUid,
      resolvedAt: Timestamp.now(),
    });

    // 🚨 Phase 4 — 신고자 기각 카운트 누적 (악성 신고자 판별 기초 데이터)
    //    관리자가 이 카운트로 수동 판단해 adminToggleAbuseFlag 등 조치 가능
    if (reportData.reporterUid) {
      await db.collection("users").doc(reportData.reporterUid).update({
        reportsSubmittedRejected: FieldValue.increment(1),
        reportsSubmittedRejectedUpdatedAt: Timestamp.now(),
      });
    }

    await logAdminAction({
      action: "reject_report",
      adminUid,
      adminName,
      viaClaims,
      targetUid: reportData.targetUid,
      payload: { reportId, targetType: reportData.targetType, targetId: reportData.targetId, reporterUid: reportData.reporterUid },
      reason: note.trim(),
    });

    return { success: true };
  }
);

// ═══════════════════════════════════════════════════════════════
// 🚀 restoreHiddenPost — 자동 숨김 복구 (오탐으로 판단)
//    isHiddenByReport=false + 관련 pending reports 일괄 rejected
// ═══════════════════════════════════════════════════════════════
exports.restoreHiddenPost = onCall(
  { region: "asia-northeast3" },
  async (request) => {
    const { adminUid, adminName, viaClaims } = await assertAdmin(request.auth);
    const { targetType, targetId, note } = request.data || {};

    if (!COLLECTION_BY_TYPE[targetType]) throw new HttpsError("invalid-argument", "지원하지 않는 targetType");
    if (typeof targetId !== "string" || !targetId) throw new HttpsError("invalid-argument", "targetId 필수");
    if (typeof note !== "string" || note.trim().length < 2) throw new HttpsError("invalid-argument", "복구 사유 2자 이상 필수");

    const collName = COLLECTION_BY_TYPE[targetType];
    const targetRef = db.collection(collName).doc(targetId);
    const targetSnap = await targetRef.get();
    const targetData = targetSnap.exists ? targetSnap.data() : {};
    const targetAuthorUid = targetData.author_id || targetData.authorId;
    const hadAppeal = targetData.appealStatus === "pending";

    // 🚨 복구 — 모든 신고 관련 필드 리셋 (reportState, isHiddenByReport, appeal)
    const updatePayload = {
      isHiddenByReport: false,
      reportState: null,
      hiddenByReportAt: FieldValue.delete(),
      reviewStartedAt: FieldValue.delete(),
      previewWarningStartedAt: FieldValue.delete(),
    };
    if (hadAppeal) {
      updatePayload.appealStatus = "resolved";
    }
    await targetRef.update(updatePayload);

    // 관련 pending reports를 일괄 rejected 처리
    const pendingSnap = await db.collection("reports")
      .where("targetId", "==", targetId)
      .where("status", "==", "pending")
      .get();
    let batch = db.batch();
    let count = 0;
    pendingSnap.docs.forEach(d => {
      batch.update(d.ref, {
        status: "rejected",
        resolutionNote: `[복구] ${note.trim()}`,
        resolvedBy: adminUid,
        resolvedAt: Timestamp.now(),
      });
      count++;
    });
    if (count > 0) await batch.commit();

    // 🔔 작성자 복구 알림 (특히 이의제기했던 경우 피드백 필수)
    if (targetAuthorUid) {
      await db.collection("notifications").doc(targetAuthorUid).collection("items").add({
        type: hadAppeal ? "appeal_accepted" : "report_restored",
        fromNickname: "운영진",
        body: hadAppeal
          ? `⚡ 이의제기가 수용되어 글이 복구되었습니다.\n사유: ${note.trim().slice(0, 200)}`
          : `귀하의 글이 복구되었습니다 (신고 판정 오류).\n사유: ${note.trim().slice(0, 200)}`,
        read: false,
        createdAt: Timestamp.now(),
      });
    }

    await logAdminAction({
      action: "restore_hidden_post",
      adminUid,
      adminName,
      viaClaims,
      targetUid: targetAuthorUid || null,
      payload: { targetType, targetId, bulkRejectedCount: count, hadAppeal },
      reason: note.trim(),
    });

    return { success: true, bulkRejectedCount: count, hadAppeal };
  }
);

function actionLabel(action) {
  switch (action) {
    case "hide_content": return "컨텐츠 숨김";
    case "delete_content": return "컨텐츠 삭제";
    case "warn_user": return "작성자에게 경고 발송";
    default: return "조치 없음";
  }
}
