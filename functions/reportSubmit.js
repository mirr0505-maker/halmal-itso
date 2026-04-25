// functions/reportSubmit.js — 🚨 사용자 신고 제출 (Sprint 4 Phase C + 2026-04-24 Phase 2/4 확장)
// onCall: 클라이언트 신고 버튼 → reports/{targetType_targetId_reporterUid} 멱등 생성
// Why: reports 원장을 바탕으로 reportAggregator가 users.reportsUniqueReporters 갱신
//      → Trust Score의 REPORT_PENALTIES 감산 → 최종 Creator Score 품질 반영
//      2026-04-24 추가:
//        Phase 2: 3명+ 고유 신고자 → 대상 문서 isHiddenByReport=true 즉시 자동 임시 숨김
//        Phase 4: 일일 신고 횟수 상한 10건 (reporter_daily_quota 서브컬렉션)
// 검색어: reportSubmit

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const { getReasonLabel, getTargetTitle } = require("./utils/reportLabels");

const db = getFirestore();

const MAX_REASON_LENGTH = 300; // 서버 저장 상한 (기타 상세는 50자지만 "[레이블] 상세" 묶음이므로 여유)
// 🔒 reasonKey 화이트리스트 — ReportModal.tsx REPORT_REASON_META와 동기화 (2026-04-24 9종 개편)
const ALLOWED_REASON_KEYS = new Set([
  "spam_flooding", "severe_abuse", "life_threat", "discrimination",
  "unethical", "anti_state", "obscene", "illegal_fraud_ad", "other",
]);
// 🚨 2026-04-24 카테고리별 3단계 threshold — 편향 담합 공격 방어 + 객관적 위반은 빠른 대응
//    2026-04-25 사용자 운영 판단으로 전체 10배 강화 — 기존 수치는 너무 루즈 (소수 담합으로 글 침묵 우려)
// state 단계: null → review (검토 배지만) → preview_warning (경고 + 계속 열람) → hidden (완전 숨김)
// 숫자는 "고유 신고자 수" — 한번 올라가면 내려오지 않음 (관리자 restore만 가능)
const CATEGORY_THRESHOLDS = {
  // 🔴 즉시 대응 — 노출 자체가 해악, 편향 악용 가능성 낮음
  obscene:          { review: 10, preview: 20, hidden: 20 },
  life_threat:      { review: 10, preview: 20, hidden: 20 },
  illegal_fraud_ad: { review: 20, preview: 20, hidden: 30 },
  // 🟡 표준 — 일반적인 가이드라인 위반
  spam_flooding:    { review: 30, preview: 50, hidden: 70 },
  severe_abuse:     { review: 30, preview: 50, hidden: 70 },
  discrimination:   { review: 30, preview: 50, hidden: 70 },
  // 🟢 엄격 — 편향 공격 자주 발생, 높은 합의 필요
  unethical:   { review: 50, preview: 80, hidden: 120 },
  anti_state:  { review: 50, preview: 80, hidden: 120 },
  other:       { review: 30, preview: 50, hidden: 70 }, // 기타는 표준과 동일
};
// 기본값 (알 수 없는 reasonKey 들어올 경우)
const DEFAULT_THRESHOLD = { review: 30, preview: 50, hidden: 70 };

// 🔒 일일 신고 횟수 상한 — 악성 스팸 신고 방어 (1인 1일 10건)
const DAILY_REPORT_LIMIT = 10;

// state 순서 매핑 — 승격만 허용 (내려오지 않음)
const STATE_ORDER = { null: 0, review: 1, preview_warning: 2, hidden: 3 };

const ALLOWED_TARGET_TYPES = new Set([
  "post", "comment", "community_post", "community_post_comment", "episode",
]);

const COLLECTION_BY_TYPE = {
  post: "posts",
  comment: "comments",
  community_post: "community_posts",
  community_post_comment: "community_post_comments",
  episode: "posts",
};

// YYYY-MM-DD (UTC 기준 — 일일 상한 리셋용, 한국 새벽 00시 차이는 운영상 무시)
function todayKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

exports.submitReport = onCall(
  { region: "asia-northeast3" },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
    const reporterUid = request.auth.uid;
    const { targetType, targetId, reason, reasonKey } = request.data || {};

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
    const safeReasonKey = ALLOWED_REASON_KEYS.has(reasonKey) ? reasonKey : "other";

    // 🔒 대상 글/댓글 조회 → targetUid(작성자) 해석
    const collName = COLLECTION_BY_TYPE[targetType];
    const targetRef = db.collection(collName).doc(targetId);
    const targetSnap = await targetRef.get();
    if (!targetSnap.exists) {
      throw new HttpsError("not-found", "신고 대상이 존재하지 않습니다.");
    }
    const targetData = targetSnap.data() || {};
    const targetUid = targetData.author_id || targetData.authorId;
    if (!targetUid) {
      throw new HttpsError("failed-precondition", "대상 작성자를 확인할 수 없습니다.");
    }
    if (targetUid === reporterUid) {
      throw new HttpsError("invalid-argument", "자기 자신을 신고할 수 없습니다.");
    }

    // 🔒 멱등 키 — 동일 신고자가 같은 타겟 중복 신고 차단
    const reportId = `${targetType}_${targetId}_${reporterUid}`;
    const reportRef = db.collection("reports").doc(reportId);
    const existing = await reportRef.get();
    if (existing.exists) {
      return { success: true, alreadyReported: true };
    }

    // 🔒 Phase 4 — 일일 상한 검사 (reporter_daily_quota/{uid}_{YYYY-MM-DD})
    const quotaId = `${reporterUid}_${todayKey()}`;
    const quotaRef = db.collection("reporter_daily_quota").doc(quotaId);
    const quotaSnap = await quotaRef.get();
    const currentCount = quotaSnap.exists ? (quotaSnap.data().count || 0) : 0;
    if (currentCount >= DAILY_REPORT_LIMIT) {
      throw new HttpsError(
        "resource-exhausted",
        `오늘 신고 가능 횟수(${DAILY_REPORT_LIMIT}회)를 초과했습니다. 내일 다시 시도해주세요.`
      );
    }

    // 🚀 reports 문서 생성 + quota 증가
    await reportRef.set({
      id: reportId,
      targetType,
      targetId,
      targetUid,
      reporterUid,
      reasonKey: safeReasonKey,
      reason: reason || "",
      status: "pending",
      createdAt: Timestamp.now(),
    });
    await quotaRef.set({
      reporterUid,
      dateKey: todayKey(),
      count: FieldValue.increment(1),
      lastReportAt: Timestamp.now(),
    }, { merge: true });

    // 🚀 Phase A — 3단계 상태 + 카테고리 차등 threshold
    //    현재 targetId 전체 신고 조회 → 고유 신고자 수 + 지배적 reasonKey 판정 → 해당 카테고리 threshold 적용
    const targetReportsSnap = await db.collection("reports")
      .where("targetId", "==", targetId)
      .get();
    const uniqueReporters = new Set();
    const reasonCount = {};
    targetReportsSnap.docs.forEach(d => {
      const data = d.data();
      if (data.reporterUid) uniqueReporters.add(data.reporterUid);
      const k = data.reasonKey || "other";
      reasonCount[k] = (reasonCount[k] || 0) + 1;
    });
    const reportCount = uniqueReporters.size;

    // 지배적 reasonKey = 최빈값 (동수면 먼저 쌓인 것)
    const dominantReason = Object.keys(reasonCount).reduce(
      (a, b) => (reasonCount[a] >= reasonCount[b] ? a : b),
      safeReasonKey,
    );
    const thr = CATEGORY_THRESHOLDS[dominantReason] || DEFAULT_THRESHOLD;

    // 새로운 상태 판정
    const newState =
      reportCount >= thr.hidden ? "hidden"
      : reportCount >= thr.preview ? "preview_warning"
      : reportCount >= thr.review ? "review"
      : null;
    const currentState = targetData.reportState || null;
    const escalated = STATE_ORDER[newState || "null"] > STATE_ORDER[currentState || "null"];

    const targetUpdate = { reportCount, dominantReason };
    if (escalated) {
      targetUpdate.reportState = newState;
      if (newState === "hidden") {
        targetUpdate.isHiddenByReport = true;
        targetUpdate.hiddenByReportAt = Timestamp.now();
        console.log(`[submitReport] AUTO-HIDE ${targetType}/${targetId} dominant=${dominantReason} reporters=${reportCount}`);
      } else if (newState === "preview_warning") {
        targetUpdate.previewWarningStartedAt = Timestamp.now();
      } else if (newState === "review") {
        targetUpdate.reviewStartedAt = Timestamp.now();
      }
    }
    await targetRef.update(targetUpdate);

    // 🔔 작성자 상태 전환 알림 (escalated 일 때만, 첫 진입)
    //    글 식별(postTitle/postId) + 사유 카테고리 한글화 + 이의제기 안내까지 포함
    if (escalated && newState) {
      const stateLabel = newState === "hidden"
        ? "🙈 글이 자동 숨김 처리됐어요"
        : newState === "preview_warning"
          ? "⚠️ 글이 경고 대상으로 검토 중이에요 (여러 신고 접수)"
          : "⚠️ 글에 신고가 접수되어 검토 중이에요";
      const nextStep = newState === "hidden"
        ? "내용을 다시 살펴봐 주시고, 부당하다고 판단되시면 글 상단의 [⚡ 이의제기] 버튼으로 복구를 요청할 수 있어요."
        : "지금은 다른 사용자에게 정상 노출되지만, 신고 누적 시 자동 숨김될 수 있어요. 본문을 점검해 주세요.";
      const targetTitle = getTargetTitle(targetData);
      const reasonLabel = getReasonLabel(dominantReason);
      await db.collection("notifications").doc(targetUid).collection("items").add({
        type: "report_state_change",
        fromNickname: "운영진",
        // 🚨 NotificationBell이 onNavigate(postId)로 deep link 라우팅하기 위해 필요
        postId: targetId,
        postTitle: targetTitle,
        targetType,
        targetId,
        reportState: newState,
        reportCount,
        reasonKey: dominantReason,
        reasonLabel,
        body: `${stateLabel}\n📌 글: 「${targetTitle}」\n신고자 ${reportCount}명 · 주 사유: ${reasonLabel}\n${nextStep}`,
        read: false,
        createdAt: Timestamp.now(),
      });
    }

    return {
      success: true,
      alreadyReported: false,
      reportCount,
      reportState: newState,
      escalated,
      dominantReason,
    };
  }
);
