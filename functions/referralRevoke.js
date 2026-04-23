// functions/referralRevoke.js — 🛡️ Sprint 7 Step 7-F 관리자 추천 무효화 (단독 파일)
//
// 🚀 분리 이유 (방법 2):
//   referral.js의 redeemReferralCode가 secrets: [PHONE_HASH_SALT]를 선언 → 해당 파일 분석 시
//   Firebase CLI가 Secret Manager API 활성화를 요구. revokeReferralUse는 PHONE_HASH_SALT
//   의존이 없으므로 파일 분리로 독립 배포 경로 확보 + 관리자 관심사(admin) 격리.
//
// 참조 설계: REFERRAL_V1.md §3.4
// 감사 로그: admin_actions 기록 + rollbackAdminAction 화이트리스트 5종째

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const { buildExpLevelUpdate } = require("./utils/levelSync");
const { assertAdmin } = require("./utils/adminAuth");
const { logAdminAction } = require("./adminAudit");

const db = getFirestore();

// ─────────────────────────────────────────────────────────────────────────────
// 상수 — ⚠️ functions/referral.js 및 src/constants.ts REFERRAL_CONFIG와 동기화 필수
//        (revoke 시 역산 EXP delta 계산에 사용)
// ─────────────────────────────────────────────────────────────────────────────
const MUTUAL_KANBU_EXP_DELTA = 2; // toggleKanbu 표준 delta (LevelSystem.md §4.2)
const WELCOME_EXP_REFEREE = 5;
const REWARD_EXP_REFERRER = 10;

// ─────────────────────────────────────────────────────────────────────────────
// revokeReferralUse — 🛡️ Step 7-F 관리자 무효화 onCall
//   처리:
//     - pending: pendingCount-1 (보상 미지급 상태라 EXP 회수 없음)
//     - confirmed: confirmedCount-1 + 추천자 -10 EXP · 피추천자 -5 EXP
//     - 맞깐부: 양쪽 friendList에서 상대 닉네임 제거 + 각 -2 EXP (이미 해제된 쪽은 skip)
//     - referral_uses 문서: status='revoked' + snapshotBeforeRevoke(롤백용)
//   감사:
//     - admin_actions/{...} action='revoke_referral_use' payload에 snapshot + delta 기록
//     - rollbackAdminAction이 이 snapshot으로 원상 복구
//   제외: pending이 이미 expired로 전이됐으면 failed-precondition (중복 처리 방지)
// ─────────────────────────────────────────────────────────────────────────────
exports.revokeReferralUse = onCall(
  { region: "asia-northeast3" },
  async (request) => {
    const { adminUid, adminName, viaClaims } = await assertAdmin(request.auth);
    const { useId, reason } = request.data || {};

    if (typeof useId !== "string" || useId.length === 0) {
      throw new HttpsError("invalid-argument", "useId가 필요합니다.");
    }
    if (typeof reason !== "string" || reason.trim().length < 2) {
      throw new HttpsError("invalid-argument", "사유(reason)를 2자 이상 입력하세요.");
    }

    const useRef = db.collection("referral_uses").doc(useId);

    // 트랜잭션 결과 → 감사 로그 payload로 전달
    let txResult = null;

    await db.runTransaction(async (tx) => {
      const useSnap = await tx.get(useRef);
      if (!useSnap.exists) {
        throw new HttpsError("not-found", "해당 추천 사용 기록을 찾을 수 없습니다.");
      }
      const use = useSnap.data();
      const prevStatus = use.status;
      if (prevStatus !== "pending" && prevStatus !== "confirmed") {
        throw new HttpsError(
          "failed-precondition",
          `status='${prevStatus}'은 무효화 대상이 아닙니다 (pending/confirmed만 가능).`
        );
      }

      const ownerUid = use.codeOwnerUid;
      const redeemerUid = use.redeemerUid;
      const ownerRef = db.collection("users").doc(ownerUid);
      const redeemerRef = db.collection("users").doc(redeemerUid);

      const [ownerSnap, redeemerSnap] = await Promise.all([tx.get(ownerRef), tx.get(redeemerRef)]);
      if (!ownerSnap.exists || !redeemerSnap.exists) {
        throw new HttpsError("not-found", "추천자 또는 피추천자 계정이 소실되었습니다.");
      }
      const owner = ownerSnap.data();
      const redeemer = redeemerSnap.data();

      // ── 1. 맞깐부 해제 snapshot — 롤백 시 재구성 기준
      //    friendList 양방향 확인 (한쪽만 남은 비정합 상태도 그대로 기록)
      const ownerFriends = Array.isArray(owner.friendList) ? owner.friendList : [];
      const redeemerFriends = Array.isArray(redeemer.friendList) ? redeemer.friendList : [];
      const wasFriendOwner = !!(redeemer.nickname && ownerFriends.includes(redeemer.nickname));
      const wasFriendRedeemer = !!(owner.nickname && redeemerFriends.includes(owner.nickname));

      // ── 2. 추천자 업데이트 — pending/confirmed 분기 + 맞깐부 해제 delta
      const ownerUpdate = {};
      let ownerExpDelta = 0;
      if (prevStatus === "pending") {
        ownerUpdate.referralPendingCount = FieldValue.increment(-1);
      } else {
        // confirmed — 이미 confirmReferralActivations에서 pending-1/confirmed+1 반영됨
        ownerUpdate.referralConfirmedCount = FieldValue.increment(-1);
        ownerExpDelta -= REWARD_EXP_REFERRER; // -10
      }
      if (wasFriendOwner) {
        ownerUpdate.friendList = ownerFriends.filter((n) => n !== redeemer.nickname);
        ownerExpDelta -= MUTUAL_KANBU_EXP_DELTA; // -2
      }
      if (ownerExpDelta !== 0) {
        Object.assign(ownerUpdate, buildExpLevelUpdate(FieldValue, owner.exp || 0, ownerExpDelta));
      }
      tx.update(ownerRef, ownerUpdate);

      // ── 3. 피추천자 업데이트 — confirmed 시 Welcome -5 + 맞깐부 해제 delta
      const redeemerUpdate = {};
      let redeemerExpDelta = 0;
      if (prevStatus === "confirmed") {
        redeemerExpDelta -= WELCOME_EXP_REFEREE; // -5
      }
      if (wasFriendRedeemer) {
        redeemerUpdate.friendList = redeemerFriends.filter((n) => n !== owner.nickname);
        redeemerExpDelta -= MUTUAL_KANBU_EXP_DELTA; // -2
      }
      if (redeemerExpDelta !== 0) {
        Object.assign(redeemerUpdate, buildExpLevelUpdate(FieldValue, redeemer.exp || 0, redeemerExpDelta));
      }
      // 🛡️ referredByCode는 revoke 후에도 보존 (1인 1회 원칙 + 롤백 여지)
      if (Object.keys(redeemerUpdate).length > 0) {
        tx.update(redeemerRef, redeemerUpdate);
      }

      // ── 4. use 문서 revoked 전이 + snapshot
      tx.update(useRef, {
        status: "revoked",
        revokedAt: Timestamp.now(),
        revokedBy: adminUid,
        revokedReason: reason.trim(),
        snapshotBeforeRevoke: {
          prevStatus,
          wasFriendOwner,
          wasFriendRedeemer,
          ownerExpDelta,
          redeemerExpDelta,
        },
      });

      txResult = {
        useId,
        prevStatus,
        ownerUid,
        redeemerUid,
        ownerNickname: owner.nickname || "",
        redeemerNickname: redeemer.nickname || "",
        ownerExpDelta,
        redeemerExpDelta,
        mutualKanbuDissolved: wasFriendOwner || wasFriendRedeemer,
        snapshotBeforeRevoke: { prevStatus, wasFriendOwner, wasFriendRedeemer, ownerExpDelta, redeemerExpDelta },
      };
    });

    // 🛡️ admin_actions 기록 — rollbackAdminAction이 이 payload로 복원 처리
    await logAdminAction({
      action: "revoke_referral_use",
      adminUid,
      adminName,
      viaClaims,
      targetUid: txResult.redeemerUid, // 타겟은 피추천자 기준 (추천자는 payload에)
      payload: {
        useId: txResult.useId,
        codeId: useId.split("_")[0] || null,
        codeOwnerUid: txResult.ownerUid,
        codeOwnerNickname: txResult.ownerNickname,
        redeemerNickname: txResult.redeemerNickname,
        prevStatus: txResult.prevStatus,
        ownerExpDelta: txResult.ownerExpDelta,
        redeemerExpDelta: txResult.redeemerExpDelta,
        mutualKanbuDissolved: txResult.mutualKanbuDissolved,
        snapshotBeforeRevoke: txResult.snapshotBeforeRevoke,
      },
      reason: reason.trim(),
    });

    console.log(
      `[revokeReferralUse] ok admin=${adminUid} useId=${useId} prev=${txResult.prevStatus} ownerΔ=${txResult.ownerExpDelta} redeemerΔ=${txResult.redeemerExpDelta} mutualDissolved=${txResult.mutualKanbuDissolved}`
    );
    return { success: true, ...txResult };
  }
);
