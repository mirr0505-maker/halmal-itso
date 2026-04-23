// functions/adminGrant.js — 🛡️ Sprint 6 A-1: 관리자 역할 부여/회수 CF
//
// grantAdminRole: 대상 유저에게 Custom Claims { admin: true } 부여
// revokeAdminRole: 대상 유저의 admin Claims 제거 (자기 자신 회수 차단)
//
// Why: 닉네임 화이트리스트 기반 관리자 체크는 운영상 취약 (닉네임 변경 공격 표면).
//      Firebase Auth Custom Claims로 전환 시 토큰 서명 자체에 권한이 박힘.
//      A-1 단계에서는 Claims와 닉네임 이중 체크 — 관리자가 먼저 자신에게 Claims
//      부여 후 실제 동작 확인되면 A-3에서 닉네임 화이트리스트 제거.
//
// 운영 절차:
//   1. 관리자(흑무영 OR Admin)가 SystemPanel에서 grantAdminRole 호출 → 본인 uid
//   2. 브라우저에서 auth.currentUser.getIdToken(true) 강제 갱신 (Claims 즉시 반영)
//   3. 같은 방식으로 Admin 계정에도 부여
//   4. 2~3일 검증 (이중 체크 상태) → Phase A-3 화이트리스트 제거
//
// 감사: 모든 호출은 admin_actions 컬렉션에 기록 (functions/adminAudit.js)

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getAuth } = require("firebase-admin/auth");
const { assertAdmin } = require("./utils/adminAuth");
const { logAdminAction } = require("./adminAudit");

const REGION = "asia-northeast3";

// ═══════════════════════════════════════════════════════
// 1) grantAdminRole — 대상 유저에게 { admin: true } Claims 부여
// ═══════════════════════════════════════════════════════
// 입력: { targetUid: string, reason: string }
// 반환: { success, targetUid, claimsBefore, claimsAfter }
exports.grantAdminRole = onCall(
  { region: REGION },
  async (request) => {
    const { adminUid, adminName, viaClaims } = await assertAdmin(request.auth);
    const { targetUid, reason } = request.data || {};

    if (typeof targetUid !== "string" || !targetUid) {
      throw new HttpsError("invalid-argument", "targetUid가 필요합니다.");
    }
    if (typeof reason !== "string" || reason.trim().length < 2) {
      throw new HttpsError("invalid-argument", "사유(reason)를 2자 이상 입력하세요.");
    }

    // 대상 유저 Auth 존재 확인
    let targetUser;
    try {
      targetUser = await getAuth().getUser(targetUid);
    } catch {
      throw new HttpsError("not-found", "대상 유저를 Firebase Auth에서 찾을 수 없습니다.");
    }

    const claimsBefore = targetUser.customClaims || {};
    const claimsAfter = { ...claimsBefore, admin: true };
    await getAuth().setCustomUserClaims(targetUid, claimsAfter);

    await logAdminAction({
      action: "grant_admin_role",
      adminUid,
      adminName,
      viaClaims,
      targetUid,
      payload: {
        claimsBefore,
        claimsAfter,
      },
      reason: reason.trim(),
    });

    return { success: true, targetUid, claimsBefore, claimsAfter };
  }
);

// ═══════════════════════════════════════════════════════
// 2) revokeAdminRole — 대상 유저의 admin Claims 제거
// ═══════════════════════════════════════════════════════
// 입력: { targetUid: string, reason: string }
// 반환: { success, targetUid, claimsBefore, claimsAfter }
// ⚠️ 자기 자신 회수 차단 (락아웃 방지)
exports.revokeAdminRole = onCall(
  { region: REGION },
  async (request) => {
    const { adminUid, adminName, viaClaims } = await assertAdmin(request.auth);
    const { targetUid, reason } = request.data || {};

    if (typeof targetUid !== "string" || !targetUid) {
      throw new HttpsError("invalid-argument", "targetUid가 필요합니다.");
    }
    if (targetUid === adminUid) {
      throw new HttpsError("failed-precondition", "자기 자신의 admin 권한은 회수할 수 없습니다.");
    }
    if (typeof reason !== "string" || reason.trim().length < 2) {
      throw new HttpsError("invalid-argument", "사유(reason)를 2자 이상 입력하세요.");
    }

    let targetUser;
    try {
      targetUser = await getAuth().getUser(targetUid);
    } catch {
      throw new HttpsError("not-found", "대상 유저를 Firebase Auth에서 찾을 수 없습니다.");
    }

    const claimsBefore = targetUser.customClaims || {};
    const claimsAfter = { ...claimsBefore };
    delete claimsAfter.admin;
    await getAuth().setCustomUserClaims(targetUid, claimsAfter);

    await logAdminAction({
      action: "revoke_admin_role",
      adminUid,
      adminName,
      viaClaims,
      targetUid,
      payload: {
        claimsBefore,
        claimsAfter,
      },
      reason: reason.trim(),
    });

    return { success: true, targetUid, claimsBefore, claimsAfter };
  }
);
