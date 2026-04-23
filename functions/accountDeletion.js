// functions/accountDeletion.js — 🗑️ Sprint 7.5 회원탈퇴 (소프트 딜리트 30일 유예)
//
// 🚀 구성:
//   requestAccountDeletion  — onCall (isDeleted=true + deletedAt 기록)
//   cancelAccountDeletion   — onCall (30일 내 재로그인 유저 부활)
//   purgeDeletedAccounts    — 매일 04:15 KST 스케줄 (30일 초과 hard delete)
//
// 🔒 정책:
//   - 사약(banned) 유저 탈퇴 차단 (회피 방지)
//   - 유배(exiled) 중에도 탈퇴 허용 but banned_phones 영구 보존 (재가입 차단)
//   - ballBalance 소각 (환불 없음 — 약관)
//   - 작성글 hard 삭제 시점: "탈퇴한 유저" 익명화 (author + author_id 난수 해시)
//   - 깐부 관계 hard 삭제 시점: friendList에서 제거 (양방향 카스케이드)

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const crypto = require("crypto");

const db = getFirestore();

// ⚠️ src/constants.ts ACCOUNT_DELETION_CONFIG와 동기화 필수
const GRACE_PERIOD_DAYS = 30;
const ANONYMIZED_AUTHOR = "탈퇴한 유저";
const ANONYMIZED_AUTHOR_ID_PREFIX = "DELETED_";

// uid를 8자리 해시로 변환 (작성글 author_id 익명화 — 동일 유저 글끼리는 동일 ID로 묶임)
function hashUid(uid) {
  return crypto.createHash("sha256").update(uid).digest("hex").slice(0, 8).toUpperCase();
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. requestAccountDeletion — onCall 유저 본인 탈퇴 요청 (소프트 딜리트)
//    조건:
//      - 로그인 필수
//      - sanctionStatus !== 'banned' (사약 유저 회피 차단)
//    처리:
//      - users.isDeleted=true, deletedAt=now, deletionReason 기록
//      - Auth 계정은 30일 뒤 purge에서 삭제 (여기선 유지 — 재로그인 부활 여지)
// ─────────────────────────────────────────────────────────────────────────────
exports.requestAccountDeletion = onCall(
  { region: "asia-northeast3" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
    }
    const uid = request.auth.uid;
    const rawReason = request.data?.reason;
    const deletionReason = typeof rawReason === "string" ? rawReason.trim().slice(0, 200) : "";

    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      throw new HttpsError("not-found", "사용자 문서가 없습니다.");
    }
    const user = userSnap.data();

    if (user.sanctionStatus === "banned") {
      throw new HttpsError(
        "failed-precondition",
        "사약 처분 중인 계정은 탈퇴할 수 없습니다. 관리자에게 문의하세요."
      );
    }
    if (user.isDeleted === true) {
      throw new HttpsError("already-exists", "이미 탈퇴 처리된 계정입니다.");
    }

    await userRef.update({
      isDeleted: true,
      deletedAt: Timestamp.now(),
      deletionReason,
    });

    console.log(`[requestAccountDeletion] uid=${uid} reason="${deletionReason}"`);
    return {
      success: true,
      graceEndsAt: Timestamp.fromMillis(Date.now() + GRACE_PERIOD_DAYS * 24 * 3600 * 1000),
    };
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// 2. cancelAccountDeletion — onCall 유저 본인 탈퇴 취소 (30일 내 부활)
//    30일 경과 후 호출은 purge에서 이미 Auth 삭제됐을 가능성 → 호출 자체가 실패
// ─────────────────────────────────────────────────────────────────────────────
exports.cancelAccountDeletion = onCall(
  { region: "asia-northeast3" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
    }
    const uid = request.auth.uid;
    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      throw new HttpsError("not-found", "사용자 문서가 없습니다.");
    }
    const user = userSnap.data();
    if (user.isDeleted !== true) {
      throw new HttpsError("failed-precondition", "탈퇴 처리된 계정이 아닙니다.");
    }

    await userRef.update({
      isDeleted: false,
      deletedAt: null,
      deletionReason: FieldValue.delete(),
    });

    console.log(`[cancelAccountDeletion] uid=${uid} revived`);
    return { success: true };
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// 3. purgeDeletedAccounts — 매일 04:15 KST 스케줄 (30일 초과 hard delete)
//    처리 순서 (유저당):
//      1. 작성 posts 익명화 (author → '탈퇴한 유저', author_id → 'DELETED_{hash8}')
//      2. 작성 comments 익명화 (동일)
//      3. friendList 양방향 해제 (닉네임 기준 — userCode 참조 전환은 Sprint 8+)
//      4. referral_codes.isDisabled=true (pending uses는 expired 자연 처리)
//      5. user_codes/{userCode} 문서 삭제
//      6. users/{uid} 문서 삭제
//      7. Firebase Auth 계정 삭제
//    banned_phones는 보존 (재가입 차단 목적) — 사약 경로와 동일
// ─────────────────────────────────────────────────────────────────────────────
exports.purgeDeletedAccounts = onSchedule(
  {
    schedule: "15 4 * * *",
    timeZone: "Asia/Seoul",
    region: "asia-northeast3",
    timeoutSeconds: 540,
    memory: "512MiB",
  },
  async () => {
    const graceCutoff = Timestamp.fromMillis(Date.now() - GRACE_PERIOD_DAYS * 24 * 3600 * 1000);
    const snap = await db
      .collection("users")
      .where("isDeleted", "==", true)
      .where("deletedAt", "<=", graceCutoff)
      .get();

    console.log(`[purgeDeletedAccounts] targets=${snap.size}`);
    let purged = 0;
    let errored = 0;

    for (const userDoc of snap.docs) {
      const uid = userDoc.id;
      try {
        await purgeOneUser(uid, userDoc.data());
        purged++;
      } catch (e) {
        errored++;
        console.error(`[purgeDeletedAccounts] fail uid=${uid}: ${e.message}`);
      }
    }

    console.log(`[purgeDeletedAccounts] done purged=${purged} errored=${errored}`);
  }
);

async function purgeOneUser(uid, user) {
  const nickname = user.nickname || "";
  const userCode = user.userCode || null;
  const anonAuthorId = ANONYMIZED_AUTHOR_ID_PREFIX + hashUid(uid);

  // 1. 작성 posts 익명화 — 400건 배치
  //    Why: Firestore 쿼리 페이징 없이 where로 전체 가져오면 메모리 폭증 가능 → cursor 페이징
  let lastDoc = null;
  while (true) {
    let q = db.collection("posts").where("author_id", "==", uid).limit(400);
    if (lastDoc) q = q.startAfter(lastDoc);
    const postsSnap = await q.get();
    if (postsSnap.empty) break;
    const batch = db.batch();
    postsSnap.docs.forEach((d) => {
      batch.update(d.ref, { author: ANONYMIZED_AUTHOR, author_id: anonAuthorId });
    });
    await batch.commit();
    lastDoc = postsSnap.docs[postsSnap.docs.length - 1];
    if (postsSnap.size < 400) break;
  }

  // 2. 작성 comments 익명화 — 동일 패턴
  lastDoc = null;
  while (true) {
    let q = db.collection("comments").where("author_id", "==", uid).limit(400);
    if (lastDoc) q = q.startAfter(lastDoc);
    const cSnap = await q.get();
    if (cSnap.empty) break;
    const batch = db.batch();
    cSnap.docs.forEach((d) => {
      batch.update(d.ref, { author: ANONYMIZED_AUTHOR, author_id: anonAuthorId });
    });
    await batch.commit();
    lastDoc = cSnap.docs[cSnap.docs.length - 1];
    if (cSnap.size < 400) break;
  }

  // 3. friendList 양방향 해제 — 닉네임 기준 (userCode 참조 전환은 Sprint 8+)
  //    Why: 이 유저를 친구로 갖고 있는 모든 users 문서에서 내 닉네임 제거
  if (nickname) {
    const friendSnap = await db.collection("users").where("friendList", "array-contains", nickname).get();
    for (let i = 0; i < friendSnap.size; i += 400) {
      const slice = friendSnap.docs.slice(i, i + 400);
      const batch = db.batch();
      slice.forEach((d) => {
        batch.update(d.ref, { friendList: FieldValue.arrayRemove(nickname) });
      });
      await batch.commit();
    }
  }

  // 4. referral_codes 비활성화 (코드는 남겨둠 — 과거 추천 이력 추적용, ownerUid로 해당 유저 식별 가능)
  if (user.referralCode) {
    await db.collection("referral_codes").doc(user.referralCode).update({ isDisabled: true }).catch(() => {});
  }

  // 5. user_codes 역조회 문서 삭제
  if (userCode) {
    await db.collection("user_codes").doc(userCode).delete().catch(() => {});
  }

  // 6. users 문서 삭제
  await db.collection("users").doc(uid).delete();

  // 7. Firebase Auth 삭제
  try {
    await getAuth().deleteUser(uid);
  } catch (e) {
    // 이미 Auth에서 삭제된 케이스 등은 무시
    if (e.code !== "auth/user-not-found") {
      console.warn(`[purgeDeletedAccounts] auth delete fail uid=${uid}: ${e.message}`);
    }
  }

  console.log(`[purgeDeletedAccounts] purged uid=${uid} nickname=${nickname}`);
}
