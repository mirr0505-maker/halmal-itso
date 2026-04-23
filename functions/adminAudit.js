// functions/adminAudit.js — 🛡️ Sprint 6: 관리자 행위 감사 로그
//
// logAdminAction(...) — 관리자 CF 호출 시 admin_actions 컬렉션에 기록
// rollbackAdminAction — 특정 action 취소 (지원 action만)
//
// 컬렉션 스키마: admin_actions/{yyyyMMdd}_{adminUid}_{ts}_{rand}
//   - id: docId 동일
//   - action: string (grant_admin_role / send_to_exile / execute_sayak / adjust_creator_score / toggle_abuse_flag / seed_reserved_nicknames ...)
//   - adminUid: string
//   - adminName: string (닉네임 or "(claims:xxx)" fallback)
//   - viaClaims: boolean (true=Claims 통과, false=닉네임 fallback)
//   - targetUid: string|null
//   - payload: object (action-specific 변경 before/after)
//   - reason: string
//   - status: 'applied' | 'rolled_back'
//   - createdAt: Timestamp
//   - rolledBackAt?: Timestamp
//   - rolledBackBy?: string (uid)
//   - rolledBackReason?: string
//
// Why: `audit_anomalies`는 "이상 징후" (자산 불일치 등) 전용. 관리자의 정상
//      행위 기록은 `admin_actions`로 분리해 운영 이력 추적 명확화.
//
// Rules: read=isAdmin, write=false (Admin SDK 전용)

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const { assertAdmin } = require("./utils/adminAuth");

const db = getFirestore();
const REGION = "asia-northeast3";

// 🚀 rollback 가능한 action 화이트리스트
// sendToExile/executeSayak 같은 유배·사약은 원복 시 strikeCount·자산 상태가 복잡 →
// 별도 release/unban 경로로 처리. 여기서는 가역적 action만 지원.
const ROLLBACKABLE_ACTIONS = new Set([
  "grant_admin_role",      // revokeAdminRole과 동일 처리
  "revoke_admin_role",     // grantAdminRole과 동일 처리
  "toggle_abuse_flag",     // 반대 상태로 토글
  "adjust_creator_score",  // override 해제 or 이전값 복원
  "revoke_referral_use",   // 🛡️ Sprint 7 Step 7-F — revoked → prevStatus 복원 + EXP 재지급 + 맞깐부 재성립
]);

// EXP 계산용 — buildExpLevelUpdate를 rollback 분기에서도 동일하게 사용
const { buildExpLevelUpdate } = require("./utils/levelSync");

/**
 * yyyyMMdd (KST)
 */
function ymdKST(date = new Date()) {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(kst.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

/**
 * 관리자 행위 로그 기록 — 모든 관리자 CF에서 공용 호출
 *
 * @param {object} input
 * @param {string} input.action - action 식별자 (snake_case)
 * @param {string} input.adminUid
 * @param {string} input.adminName
 * @param {boolean} input.viaClaims
 * @param {string|null} input.targetUid
 * @param {object} input.payload - action별 변경 세부 (before/after 등)
 * @param {string} input.reason
 * @returns {Promise<{actionId: string}>}
 */
async function logAdminAction({ action, adminUid, adminName, viaClaims, targetUid, payload, reason }) {
  if (!action || typeof action !== "string") {
    throw new Error("[logAdminAction] action이 필요합니다.");
  }
  if (!adminUid) {
    throw new Error("[logAdminAction] adminUid가 필요합니다.");
  }
  const now = Timestamp.now();
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  const actionId = `${ymdKST()}_${adminUid}_${ts}_${rand}`;

  await db.collection("admin_actions").doc(actionId).set({
    id: actionId,
    action,
    adminUid,
    adminName: adminName || null,
    viaClaims: !!viaClaims,
    targetUid: targetUid || null,
    payload: payload || {},
    reason: reason || "",
    status: "applied",
    createdAt: now,
  });

  return { actionId };
}

// ═══════════════════════════════════════════════════════
// rollbackAdminAction — 지원되는 action 원복
// ═══════════════════════════════════════════════════════
// 입력: { actionId: string, reason: string }
// 처리: action 타입별 역동작 실행 후 status: 'rolled_back' 갱신
exports.rollbackAdminAction = onCall(
  { region: REGION },
  async (request) => {
    const { adminUid, adminName, viaClaims } = await assertAdmin(request.auth);
    const { actionId, reason } = request.data || {};

    if (typeof actionId !== "string" || !actionId) {
      throw new HttpsError("invalid-argument", "actionId가 필요합니다.");
    }
    if (typeof reason !== "string" || reason.trim().length < 2) {
      throw new HttpsError("invalid-argument", "사유(reason)를 2자 이상 입력하세요.");
    }

    const actionRef = db.collection("admin_actions").doc(actionId);
    const actionSnap = await actionRef.get();
    if (!actionSnap.exists) {
      throw new HttpsError("not-found", "해당 admin_action을 찾을 수 없습니다.");
    }
    const actionDoc = actionSnap.data();
    if (actionDoc.status !== "applied") {
      throw new HttpsError("failed-precondition", `이미 ${actionDoc.status} 상태입니다.`);
    }
    if (!ROLLBACKABLE_ACTIONS.has(actionDoc.action)) {
      throw new HttpsError(
        "failed-precondition",
        `${actionDoc.action}은 롤백 지원 action이 아닙니다. (지원: ${[...ROLLBACKABLE_ACTIONS].join(", ")})`
      );
    }

    // action 타입별 역동작
    const targetUid = actionDoc.targetUid;
    const payload = actionDoc.payload || {};

    if (actionDoc.action === "grant_admin_role" || actionDoc.action === "revoke_admin_role") {
      // Auth Claims를 payload.claimsBefore 상태로 복원
      if (!targetUid) throw new HttpsError("failed-precondition", "targetUid 없음");
      await getAuth().setCustomUserClaims(targetUid, payload.claimsBefore || {});
    } else if (actionDoc.action === "toggle_abuse_flag") {
      // abuseFlags.{flag} prev 상태 복원
      if (!targetUid) throw new HttpsError("failed-precondition", "targetUid 없음");
      const { flag, prevEnabled } = payload;
      if (!flag) throw new HttpsError("failed-precondition", "payload.flag 없음");
      const userRef = db.collection("users").doc(targetUid);
      await userRef.update({
        [`abuseFlags.${flag}`]: prevEnabled ? true : FieldValue.delete(),
      });
    } else if (actionDoc.action === "adjust_creator_score") {
      // override 해제 (이전이 set이든 clear든 동일하게 delete → 다음 배치/이벤트가 수식 값 복원)
      if (!targetUid) throw new HttpsError("failed-precondition", "targetUid 없음");
      const userRef = db.collection("users").doc(targetUid);
      await userRef.update({
        creatorScoreOverride: FieldValue.delete(),
        creatorScoreUpdatedAt: Timestamp.now(),
      });
    } else if (actionDoc.action === "revoke_referral_use") {
      // 🛡️ Sprint 7 Step 7-F — 추천 무효화 롤백
      //   snapshotBeforeRevoke에 저장된 prevStatus/friend 플래그 기반으로 원상 복구.
      //   사약·계정 소실 같은 중간 상태 변화는 failed-precondition으로 거부 (수동 개입 유도).
      const {
        useId,
        codeOwnerUid,
        ownerExpDelta,       // 음수(revoke 시 차감한 값) — 롤백 시 그대로 다시 +가산해서 원복
        redeemerExpDelta,    // 음수
        snapshotBeforeRevoke, // { prevStatus, wasFriendOwner, wasFriendRedeemer }
      } = payload;
      if (!useId || !codeOwnerUid || !targetUid || !snapshotBeforeRevoke) {
        throw new HttpsError("failed-precondition", "payload가 불완전합니다 (useId/codeOwnerUid/snapshot 누락).");
      }
      const useRef = db.collection("referral_uses").doc(useId);
      const ownerRef = db.collection("users").doc(codeOwnerUid);
      const redeemerRef = db.collection("users").doc(targetUid);

      await db.runTransaction(async (tx) => {
        const [useSnap, ownerSnap, redeemerSnap] = await Promise.all([
          tx.get(useRef),
          tx.get(ownerRef),
          tx.get(redeemerRef),
        ]);
        if (!useSnap.exists) {
          throw new HttpsError("not-found", "referral_uses 문서가 없습니다.");
        }
        const cur = useSnap.data();
        if (cur.status !== "revoked") {
          throw new HttpsError("failed-precondition", `status='${cur.status}'은 revoke 롤백 대상이 아닙니다.`);
        }
        if (!ownerSnap.exists || !redeemerSnap.exists) {
          throw new HttpsError("not-found", "추천자 또는 피추천자 계정이 소실되었습니다.");
        }
        const owner = ownerSnap.data();
        const redeemer = redeemerSnap.data();
        // 🏚️ 사약 이후 롤백은 차단 — 자산 상태가 이미 정리됨
        if (owner.sanctionStatus === "banned" || redeemer.sanctionStatus === "banned") {
          throw new HttpsError("failed-precondition", "사약 처분된 계정은 롤백할 수 없습니다.");
        }

        const prevStatus = snapshotBeforeRevoke.prevStatus;
        const ownerUpdate = {};
        if (prevStatus === "pending") {
          ownerUpdate.referralPendingCount = FieldValue.increment(1);
        } else {
          // confirmed — confirmedCount 복원
          ownerUpdate.referralConfirmedCount = FieldValue.increment(1);
        }
        // 맞깐부 복원 (revoke 시점에 해제했던 쪽만 재성립)
        if (snapshotBeforeRevoke.wasFriendOwner && redeemer.nickname) {
          const ownerFriends = Array.isArray(owner.friendList) ? owner.friendList : [];
          if (!ownerFriends.includes(redeemer.nickname)) {
            ownerUpdate.friendList = [...ownerFriends, redeemer.nickname];
          }
        }
        // EXP 재지급 — revoke 시 차감한 만큼 +부호로 원복
        const ownerExpRestore = -(Number(ownerExpDelta) || 0); // 예: -12 → +12
        if (ownerExpRestore !== 0) {
          Object.assign(ownerUpdate, buildExpLevelUpdate(FieldValue, owner.exp || 0, ownerExpRestore));
        }
        tx.update(ownerRef, ownerUpdate);

        const redeemerUpdate = {};
        if (snapshotBeforeRevoke.wasFriendRedeemer && owner.nickname) {
          const redeemerFriends = Array.isArray(redeemer.friendList) ? redeemer.friendList : [];
          if (!redeemerFriends.includes(owner.nickname)) {
            redeemerUpdate.friendList = [...redeemerFriends, owner.nickname];
          }
        }
        const redeemerExpRestore = -(Number(redeemerExpDelta) || 0);
        if (redeemerExpRestore !== 0) {
          Object.assign(redeemerUpdate, buildExpLevelUpdate(FieldValue, redeemer.exp || 0, redeemerExpRestore));
        }
        if (Object.keys(redeemerUpdate).length > 0) {
          tx.update(redeemerRef, redeemerUpdate);
        }

        // use 문서 복원 — status 되돌리고 revoke 흔적 제거
        tx.update(useRef, {
          status: prevStatus,
          revokedAt: FieldValue.delete(),
          revokedBy: FieldValue.delete(),
          revokedReason: FieldValue.delete(),
          snapshotBeforeRevoke: FieldValue.delete(),
        });
      });
    } else {
      // ROLLBACKABLE_ACTIONS에 있지만 분기 누락 — 방어
      throw new HttpsError("internal", `rollback 분기 미구현: ${actionDoc.action}`);
    }

    const now = Timestamp.now();
    await actionRef.update({
      status: "rolled_back",
      rolledBackAt: now,
      rolledBackBy: adminUid,
      rolledBackReason: reason.trim(),
    });

    // 롤백 자체도 admin_actions에 기록
    await logAdminAction({
      action: "rollback_admin_action",
      adminUid,
      adminName,
      viaClaims,
      targetUid,
      payload: {
        originalActionId: actionId,
        originalAction: actionDoc.action,
      },
      reason: reason.trim(),
    });

    return { success: true, actionId, originalAction: actionDoc.action };
  }
);

module.exports.logAdminAction = logAdminAction;
module.exports.ROLLBACKABLE_ACTIONS = [...ROLLBACKABLE_ACTIONS];
