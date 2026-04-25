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
const { getReasonLabel, getActionLabel, getTargetTitle } = require("./utils/reportLabels");

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

    // 1) 조치 실행 — 글 데이터 사전 조회 (제목 추출 + 사유 카테고리 알림 메타용)
    const collName = COLLECTION_BY_TYPE[targetType];
    if (!collName) throw new HttpsError("failed-precondition", "지원하지 않는 targetType");
    const targetRef = db.collection(collName).doc(targetId);
    const targetSnap = await targetRef.get();
    const targetData = targetSnap.exists ? targetSnap.data() : {};
    const targetTitle = getTargetTitle(targetData);
    const reasonKey = reportData.reasonKey || "other";
    const reasonLabel = getReasonLabel(reasonKey);
    const actionLabelKo = getActionLabel(action);

    if (action === "hide_content") {
      await targetRef.update({
        isHiddenByReport: true,
        hiddenByReportAt: Timestamp.now(),
        // 🔧 reportState='hidden'도 함께 — ReportStateBanner는 reportState 기준 분기 (이게 빠지면 작성자에게 Banner+이의제기 진입점 안 보임)
        reportState: "hidden",
      });
    } else if (action === "delete_content") {
      // soft delete (isDeleted 표식 — 영구 삭제 원하면 별도 관리자 수동)
      await targetRef.update({
        isHiddenByReport: true,
        isDeleted: true,
        hiddenByReportAt: Timestamp.now(),
        // 🔧 작성자 이의제기 가능하도록 reportState='hidden' 동시 set
        reportState: "hidden",
      });
    }
    // action === "warn_user" / "none" → 컨텐츠 변경 없음 (알림만 발송 — 아래 분기에서 통합)

    // 🔔 작성자에게 조치 결과 알림 (action별 메시지) — 4종 케이스 모두 발송
    //    Why: 기존엔 warn_user만 알림 → hide/delete 시 작성자 깜깜이로 깨진 UX. 모든 조치 통보.
    {
      const actionBody = action === "hide_content"
        ? `🙈 관리자 검토 결과 글이 숨김 처리됐어요.\n복구가 필요하다면 글 상단 [⚡ 이의제기]로 요청할 수 있어요.`
        : action === "delete_content"
          ? `🗑️ 관리자 검토 결과 글이 삭제 처리됐어요 (영구 표식).\n부당하다고 판단되시면 운영진에 문의해 주세요.`
          : action === "warn_user"
            ? `⚠️ 컨텐츠가 커뮤니티 가이드라인 위반으로 판단되어 경고가 발송됐어요.\n동일 사유 반복 시 추가 조치가 있을 수 있어요.`
            : `ℹ️ 신고가 검토되었으나 별도 조치 없이 종료됐어요. 컨텐츠는 그대로 유지됩니다.`;
      await db.collection("notifications").doc(targetUid).collection("items").add({
        type: action === "warn_user" ? "report_warning" : "report_action_taken",
        fromNickname: "운영진",
        // NotificationBell deep link
        postId: targetId,
        postTitle: targetTitle,
        targetType,
        targetId,
        action,
        actionLabel: actionLabelKo,
        reasonKey,
        reasonLabel,
        body: `${actionBody}\n📌 글: 「${targetTitle}」\n사유 카테고리: ${reasonLabel}\n관리자 메모: ${note.trim().slice(0, 200)}`,
        read: false,
        createdAt: Timestamp.now(),
      });
    }

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

    // 4) 신고자들에게 처리 결과 알림 (notifyParticipants=true일 때만)
    //    글 식별 정보 + 사유 카테고리 + 조치 결과를 명확히 전달
    if (notifyParticipants) {
      const reporterSet = new Set(affectedReporters);
      reporterSet.add(reportData.reporterUid);
      for (const reporterUid of reporterSet) {
        await db.collection("notifications").doc(reporterUid).collection("items").add({
          type: "report_resolved",
          fromNickname: "운영진",
          // 신고자에겐 deep link 굳이 노출 안 함 (다시 글로 갈 필요 없음). post는 일반 라우팅 가능하게 postId만.
          postId: targetId,
          postTitle: targetTitle,
          targetType,
          targetId,
          action,
          actionLabel: actionLabelKo,
          reasonKey,
          reasonLabel,
          body: `✅ 신고하신 글이 검토 완료됐어요.\n📌 글: 「${targetTitle}」\n사유 카테고리: ${reasonLabel}\n관리자 조치: ${actionLabelKo}\n신고해주신 덕분에 더 안전한 커뮤니티가 됩니다.`,
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

    // 🔔 신고자에게 기각 알림 — 자기 신고가 어떻게 됐는지 깜깜이 막음
    //    Why: 깜깜이면 같은 글을 반복 신고하거나 "운영진이 안 본다"고 오해함. 사유 알리는 게 정석.
    if (reportData.reporterUid) {
      const collName = COLLECTION_BY_TYPE[reportData.targetType];
      let targetTitle = "(글 없음)";
      if (collName) {
        try {
          const tSnap = await db.collection(collName).doc(reportData.targetId).get();
          if (tSnap.exists) targetTitle = getTargetTitle(tSnap.data());
        } catch (err) {
          console.warn("[rejectReport] targetTitle fetch failed", err);
        }
      }
      const reasonLabel = getReasonLabel(reportData.reasonKey || "other");
      await db.collection("notifications").doc(reportData.reporterUid).collection("items").add({
        type: "report_rejected",
        fromNickname: "운영진",
        postId: reportData.targetId,
        postTitle: targetTitle,
        targetType: reportData.targetType,
        targetId: reportData.targetId,
        reasonKey: reportData.reasonKey || "other",
        reasonLabel,
        body: `🚫 신고하신 내용이 검토 결과 정책 위반으로 판단되지 않아 기각됐어요.\n📌 글: 「${targetTitle}」\n사유 카테고리: ${reasonLabel}\n관리자 메모: ${note.trim().slice(0, 200)}\n반복적인 허위/악성 신고는 신고 권한 제한으로 이어질 수 있어요.`,
        read: false,
        createdAt: Timestamp.now(),
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
      const targetTitle = getTargetTitle(targetData);
      await db.collection("notifications").doc(targetAuthorUid).collection("items").add({
        type: hadAppeal ? "appeal_accepted" : "report_restored",
        fromNickname: "운영진",
        postId: targetId,
        postTitle: targetTitle,
        targetType,
        targetId,
        body: hadAppeal
          ? `⚡ 이의제기가 수용되어 글이 복구됐어요.\n📌 글: 「${targetTitle}」\n관리자 메모: ${note.trim().slice(0, 200)}`
          : `✅ 자동 숨김됐던 글이 복구됐어요 (신고 판정 오탐).\n📌 글: 「${targetTitle}」\n관리자 메모: ${note.trim().slice(0, 200)}`,
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
