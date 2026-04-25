// functions/utils/adminAuth.js — 🛡️ Sprint 6 A-3 (2026-04-25 완료): Custom Claims 단일 체크
//
// Sprint 6 ADMIN 권한 체계
//   Phase A-1 (2026-04-22 완료): Custom Claims OR 닉네임 화이트리스트 이중 체크
//   Phase A-3 (2026-04-25 완료): 닉네임 fallback 제거, Claims 단일 체크 — 본 파일 상태
//
// 사용법:
//   const { assertAdmin } = require("./utils/adminAuth");
//   const { adminUid, adminName, viaClaims } = await assertAdmin(request.auth);
//
// Why: 닉네임 변경/도용 공격 표면 완전 제거. 권한은 Firebase Auth Custom Claims 토큰 서명에 박힘.
//      락아웃 복구 경로: Firebase Console → Authentication → Users → 해당 uid → 맞춤 클레임 `{"admin":true}` 수동 주입,
//                       또는 살아있는 다른 admin 계정이 SystemPanel grantAdminRole 호출.

const { HttpsError } = require("firebase-functions/v2/https");
const { getFirestore } = require("firebase-admin/firestore");

const db = getFirestore();

// 🏷️ Phase A-3 이후 비어 있음 — 헬퍼 인터페이스 호환을 위해 빈 배열로 유지
//    절대 다시 채우지 말 것. 닉네임 fallback이 부활하면 공격 표면 재발생.
const ADMIN_NICKNAMES = [];

/**
 * 관리자 권한 확인 (Custom Claims 단일 체크)
 *
 * @param {object|undefined} auth - request.auth (Firebase onCall 컨텍스트)
 * @returns {Promise<{adminUid: string, adminName: string, viaClaims: boolean}>}
 *   viaClaims는 항상 true (Claims 경로 외 통과 불가)
 * @throws HttpsError("unauthenticated") — 로그인 없음
 * @throws HttpsError("permission-denied") — admin claim 없음
 */
async function assertAdmin(auth) {
  if (!auth) {
    throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
  }
  if (!(auth.token && auth.token.admin === true)) {
    throw new HttpsError("permission-denied", "관리자만 호출 가능합니다.");
  }
  // Claims 통과 — 닉네임은 감사 로그용으로 별도 조회 (실패해도 권한 통과는 유지)
  let nickname = null;
  try {
    const snap = await db.collection("users").doc(auth.uid).get();
    if (snap.exists) nickname = snap.data().nickname || null;
  } catch {
    // noop
  }
  return {
    adminUid: auth.uid,
    adminName: nickname || `(claims:${auth.uid.slice(0, 8)})`,
    viaClaims: true,
  };
}

/**
 * uid 단독 관리자 체크 (auth 컨텍스트 없는 onSchedule 호환용)
 * Phase A-3 이후 닉네임 fallback 제거됨 → 항상 false.
 * Why: 시스템 자동 작업(checkAutoSayak 등)은 본디 admin 권한 체크가 필요 없음.
 *      adminUid="AUTO"로 admin_actions 로깅만 하면 충분.
 */
async function isAdminByUid(_uid) {
  return false;
}

module.exports = {
  assertAdmin,
  isAdminByUid,
  ADMIN_NICKNAMES,
};
