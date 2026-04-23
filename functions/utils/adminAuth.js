// functions/utils/adminAuth.js — 🛡️ Sprint 6 A-1: 관리자 권한 이중 체크 헬퍼
//
// Sprint 6 ADMIN 권한 체계 (docs/step1-design/ADMIN.md §2.1.2 D1-β 점진 전환)
//   Phase A-1: Custom Claims OR 닉네임 화이트리스트 (이중 체크) ← 현재
//   Phase A-2: 관리자 Custom Claims 부여 후 2~3일 검증
//   Phase A-3: 닉네임 화이트리스트 제거, Claims 단일 체크로 전환
//
// 사용법:
//   const { assertAdmin, ADMIN_NICKNAMES } = require("./utils/adminAuth");
//   const { adminUid, adminName, viaClaims } = await assertAdmin(request.auth);
//
// Why: 기존에 각 CF마다 중복 작성된 `ADMIN_NICKNAMES = ["흑무영", "Admin"]` +
//      `assertAdmin` / `verifyAdmin` 로직을 한 곳으로 통합. 화이트리스트 제거 시
//      이 파일만 수정하면 끝 (Phase A-3 전환 단일 포인트).

const { HttpsError } = require("firebase-functions/v2/https");
const { getFirestore } = require("firebase-admin/firestore");

const db = getFirestore();

// 🏷️ A-1 단계 화이트리스트 (Phase A-3에서 제거 예정)
// 📌 project_admin_account.md — 흑무영(개인용) + Admin(geulove.admin@gmail.com) 병행 단계
const ADMIN_NICKNAMES = ["흑무영", "Admin"];

/**
 * 관리자 권한 확인 (Claims OR 닉네임 이중 체크)
 *
 * @param {object|undefined} auth - request.auth (Firebase onCall 컨텍스트)
 * @returns {Promise<{adminUid: string, adminName: string, viaClaims: boolean}>}
 *   viaClaims=true 시 Custom Claims 경로로 통과(권장), false 시 닉네임 fallback
 * @throws HttpsError("unauthenticated") — 로그인 없음
 * @throws HttpsError("permission-denied") — 둘 다 불통
 */
async function assertAdmin(auth) {
  if (!auth) {
    throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
  }

  // 1순위: Custom Claims (Phase A-2 이후 주 경로)
  // onCall의 auth.token에는 ID Token decoded claims가 들어있음 (Firebase Functions v2)
  if (auth.token && auth.token.admin === true) {
    // 닉네임은 별도 조회 (감사 로그에 기록하기 위해)
    let nickname = null;
    try {
      const snap = await db.collection("users").doc(auth.uid).get();
      if (snap.exists) nickname = snap.data().nickname || null;
    } catch {
      // 닉네임 조회 실패해도 Claims 통과는 유지
    }
    return {
      adminUid: auth.uid,
      adminName: nickname || `(claims:${auth.uid.slice(0, 8)})`,
      viaClaims: true,
    };
  }

  // 2순위: 닉네임 화이트리스트 (Phase A-3에서 제거)
  const snap = await db.collection("users").doc(auth.uid).get();
  if (!snap.exists) {
    throw new HttpsError("permission-denied", "관리자만 호출 가능합니다.");
  }
  const nickname = snap.data().nickname;
  if (!nickname || !ADMIN_NICKNAMES.includes(nickname)) {
    throw new HttpsError("permission-denied", "관리자만 호출 가능합니다.");
  }
  return {
    adminUid: auth.uid,
    adminName: nickname,
    viaClaims: false,
  };
}

/**
 * uid 단독 관리자 체크 (storehouse.js verifyAdmin 호환용)
 * onSchedule 등 auth 컨텍스트 없이 uid만으로 확인해야 할 때 사용.
 * Claims 경로 불가 (ID Token 없음) → 닉네임만 체크.
 */
async function isAdminByUid(uid) {
  if (!uid) return false;
  const snap = await db.collection("users").doc(uid).get();
  if (!snap.exists) return false;
  const nickname = snap.data().nickname;
  return !!nickname && ADMIN_NICKNAMES.includes(nickname);
}

module.exports = {
  assertAdmin,
  isAdminByUid,
  ADMIN_NICKNAMES,
};
