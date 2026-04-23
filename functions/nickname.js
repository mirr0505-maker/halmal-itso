// functions/nickname.js — 닉네임 변경 (평생 1회, 100볼)
// 🛡️ ANTI_ABUSE.md §8.4 — 사칭 억제 + 수수료 과금
//   (1) 트랜잭션: users/{uid} + users/nickname_{new} + reserved_nicknames/{old}
//       + ball_transactions + platform_revenue
//   (2) 트랜잭션 이후: community_memberships + communities 비정규화 nickname 연쇄 갱신
//       Why: 트랜잭션 500 ops 한도 고려 — 검색 결과가 큰 경우 batch로 분리 처리
//
// 🔰 Sprint 7.5 — 최초 1회 무료 분기
//   Why: 회원가입 온보딩에서 Google displayName을 정식 닉네임으로 확정하는 순간은
//        "변경"이 아닌 "최초 설정" → 과금·평생카운트 차감 없이 통과.
//        판별 기준: users.nicknameSet !== true (generateUserCode 시 기본 false 상태).
//        통과 시 nicknameSet=true 마킹하여 이후 변경부터 정식 규칙 적용.
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
// 🛡️ Sprint 6 A-1: 관리자 권한 헬퍼 + 감사 로그
const { assertAdmin } = require("./utils/adminAuth");
const { logAdminAction } = require("./adminAudit");

const db = getFirestore();

const FEE_BALLS = 100;            // 100볼 = 10,000원 (PRICING.md §8)
const MIN_LEN = 2;
const MAX_LEN = 10;
const NICKNAME_REGEX = /^[가-힣a-zA-Z0-9_]+$/;

exports.changeNickname = onCall(
  { region: "asia-northeast3" },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
    const uid = request.auth.uid;

    const raw = request.data?.newNickname;
    if (typeof raw !== "string") {
      throw new HttpsError("invalid-argument", "닉네임이 유효하지 않습니다.");
    }
    const trimmed = raw.trim();
    if (trimmed.length < MIN_LEN || trimmed.length > MAX_LEN) {
      throw new HttpsError("invalid-argument", `닉네임은 ${MIN_LEN}~${MAX_LEN}자여야 합니다.`);
    }
    if (!NICKNAME_REGEX.test(trimmed)) {
      throw new HttpsError("invalid-argument", "한글/영문/숫자/밑줄만 허용됩니다.");
    }
    if (trimmed.startsWith("nickname_")) {
      throw new HttpsError("invalid-argument", "예약된 접두사입니다.");
    }

    const result = await db.runTransaction(async (tx) => {
      const userRef = db.collection("users").doc(uid);
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists) throw new HttpsError("not-found", "사용자를 찾을 수 없습니다.");

      const u = userSnap.data();
      const oldNickname = u.nickname;
      const balanceBefore = u.ballBalance || 0;
      // 🔰 최초 설정 여부 — 온보딩 첫 닉네임 확정은 과금·카운트 면제
      const isInitialSetup = u.nicknameSet !== true;

      // 🔰 Sprint 7.5 마이그레이션 fast-path — 기존 유저가 온보딩 게이트에서 본인 닉네임을 재확정하는 경우
      // Why: Sprint 7.5 배포 전 기입된 users는 nicknameSet 필드가 없음(undefined → isInitialSetup=true).
      //      이들이 본인 기존 닉네임을 다시 입력하면 아래 "동일 닉네임" 체크에 막혀 온보딩 탈출 불가.
      //      이 경로는 과금·카운트·중복체크 전부 우회하고 nicknameSet=true만 마킹.
      if (isInitialSetup && oldNickname === trimmed) {
        tx.update(userRef, {
          nicknameSet: true,
          nicknameSetAt: Timestamp.now(),
        });
        return {
          oldNickname,
          newNickname: trimmed,
          feeCharged: 0,
          isInitialSetup: true,
          migrated: true,
        };
      }

      // 1. 평생 1회 체크 (최초 설정은 면제)
      if (!isInitialSetup && (u.nicknameChangeCount || 0) >= 1) {
        throw new HttpsError("permission-denied", "닉네임 변경은 평생 1회만 가능합니다.");
      }

      // 2. 동일 닉네임
      if (oldNickname === trimmed) {
        throw new HttpsError("invalid-argument", "현재 닉네임과 동일합니다.");
      }

      // 3. 잔액 체크 (최초 설정은 면제)
      if (!isInitialSetup && balanceBefore < FEE_BALLS) {
        throw new HttpsError(
          "failed-precondition",
          `${FEE_BALLS}볼이 필요합니다. 현재 잔액: ${balanceBefore}볼`
        );
      }

      // 4. 새 닉네임 중복 체크 (users/nickname_{new})
      const newNicknameDocRef = db.collection("users").doc(`nickname_${trimmed}`);
      const newNicknameDoc = await tx.get(newNicknameDocRef);
      if (newNicknameDoc.exists) {
        throw new HttpsError("already-exists", "이미 사용 중인 닉네임입니다.");
      }

      // 5. 예약된 닉네임 체크 (reserved_nicknames/{new})
      //   - 운영 예약(seed: 흑무영, admin 등)
      //   - 과거 타 유저가 변경하며 잠근 oldNickname
      const newReservedRef = db.collection("reserved_nicknames").doc(trimmed);
      const newReservedDoc = await tx.get(newReservedRef);
      if (newReservedDoc.exists) {
        throw new HttpsError("already-exists", "예약된 닉네임입니다.");
      }

      // 6. 이전 닉네임 영구 예약 (reserved_nicknames/{old}) — 최초 설정은 기존 닉이 임시값이므로 skip
      if (!isInitialSetup && oldNickname) {
        const oldReservedRef = db.collection("reserved_nicknames").doc(oldNickname);
        tx.set(oldReservedRef, {
          originalUid: uid,
          reservedAt: Timestamp.now(),
          reservedReason: "user_change",
        });
      }

      // 7. 기존 users/nickname_{old} 문서 삭제 (이전 닉네임 존재 시)
      if (oldNickname) {
        const oldNicknameDocRef = db.collection("users").doc(`nickname_${oldNickname}`);
        tx.delete(oldNicknameDocRef);
      }

      // 8. 새 users/nickname_{new} 문서 생성 (검색용)
      tx.set(newNicknameDocRef, {
        uid,
        nickname: trimmed,
        reservedAt: Timestamp.now(),
      });

      // 9. users 문서 업데이트 (nickname + 이력 + 과금)
      //    최초 설정: 과금·카운트 skip, nicknameSet=true 마킹만.
      //    정식 변경: 100볼 차감 + 평생카운트 +1.
      if (isInitialSetup) {
        tx.update(userRef, {
          nickname: trimmed,
          nicknameSet: true,
          nicknameSetAt: Timestamp.now(),
        });
        return { oldNickname: oldNickname || null, newNickname: trimmed, feeCharged: 0, isInitialSetup: true };
      }

      const balanceAfter = balanceBefore - FEE_BALLS;
      tx.update(userRef, {
        nickname: trimmed,
        ballBalance: FieldValue.increment(-FEE_BALLS),
        ballSpent: FieldValue.increment(FEE_BALLS),
        previousNicknames: FieldValue.arrayUnion(oldNickname),
        nicknameChangeCount: FieldValue.increment(1),
        nicknameChangedAt: Timestamp.now(),
      });

      // 10. ball_transactions 기록 (감사 원장)
      const txId = `nickname_change_${uid}_${Date.now()}`;
      tx.set(db.collection("ball_transactions").doc(txId), {
        uid,
        amount: -FEE_BALLS,
        sourceType: "nickname_change",
        balanceBefore,
        balanceAfter,
        timestamp: Timestamp.now(),
        details: { oldNickname, newNickname: trimmed },
        schemaVersion: 1,
      });

      // 11. 플랫폼 수익 누적
      tx.set(
        db.collection("platform_revenue").doc("nickname_change"),
        {
          totalAmount: FieldValue.increment(FEE_BALLS),
          totalCount: FieldValue.increment(1),
          lastChangedAt: Timestamp.now(),
        },
        { merge: true }
      );

      return { oldNickname, newNickname: trimmed, feeCharged: FEE_BALLS, isInitialSetup: false };
    });

    // 12. 비정규화된 nickname 연쇄 갱신 (트랜잭션 외부, batch 500 ops 청크)
    //   Why: 트랜잭션 안에 넣으면 가입 장갑 많은 유저는 500 ops 한도 초과 가능
    //        사용자 표시용 비정규화 문자열 → eventually consistent로 충분
    //   최초 설정: 이전 닉네임이 없거나 임시값이고 연쇄 대상(장갑·가입)도 없음 → skip
    if (!result.isInitialSetup && result.oldNickname) {
      await cascadeNicknameUpdate(uid, result.oldNickname, result.newNickname);
    }

    return { success: true, ...result };
  }
);

/**
 * 가입한 장갑(community_memberships) + 만든 장갑(communities.creatorNickname) 연쇄 갱신.
 * 500 ops 청크로 나눠 커밋.
 */
async function cascadeNicknameUpdate(uid, oldNickname, newNickname) {
  const BATCH_LIMIT = 450; // 여유 50 ops 확보

  // (a) 본인이 가입한 장갑 멤버십
  const memSnap = await db.collection("community_memberships")
    .where("userId", "==", uid)
    .get();

  // (b) 본인이 만든 장갑 (creatorNickname 필드)
  const comSnap = await db.collection("communities")
    .where("creatorId", "==", uid)
    .get();

  const targets = [];
  memSnap.docs.forEach((d) => targets.push({ ref: d.ref, field: "nickname" }));
  comSnap.docs.forEach((d) => targets.push({ ref: d.ref, field: "creatorNickname" }));

  for (let i = 0; i < targets.length; i += BATCH_LIMIT) {
    const chunk = targets.slice(i, i + BATCH_LIMIT);
    const batch = db.batch();
    chunk.forEach(({ ref, field }) => batch.update(ref, { [field]: newNickname }));
    await batch.commit();
  }

  // 로깅용 (실제 운영 모니터링)
  console.log(`[changeNickname] cascade ${uid}: ${oldNickname} → ${newNickname}, ${targets.length} docs updated`);
}

// 🔧 관리자 전용 — reserved_nicknames 초기 seed
// Why: 운영 필수 예약어를 DB에 한 번 주입. 이미 존재하는 문서는 merge.
//      isAdmin 체크(PLATFORM_ADMIN_NICKNAMES 화이트리스트)로 무단 호출 차단.
const SEED_RESERVED_NICKNAMES = [
  "흑무영",
  "Admin",
  "admin",
  "claude",
  "운영자",
  "관리자",
  "system",
  "bot",
  "전령",
];

exports.seedReservedNicknames = onCall(
  { region: "asia-northeast3" },
  async (request) => {
    // 🛡️ Sprint 6: Claims OR 닉네임 이중 체크
    const { adminUid, adminName, viaClaims } = await assertAdmin(request.auth);

    const batch = db.batch();
    for (const name of SEED_RESERVED_NICKNAMES) {
      batch.set(
        db.collection("reserved_nicknames").doc(name),
        {
          originalUid: null,
          reservedAt: Timestamp.now(),
          reservedReason: "system_seed",
        },
        { merge: true }
      );
    }
    await batch.commit();

    // 🛡️ Sprint 6: admin_actions 감사 로그
    await logAdminAction({
      action: "seed_reserved_nicknames",
      adminUid,
      adminName,
      viaClaims,
      targetUid: null,
      payload: {
        count: SEED_RESERVED_NICKNAMES.length,
        names: SEED_RESERVED_NICKNAMES,
      },
      reason: "system_seed",
    });

    return { success: true, count: SEED_RESERVED_NICKNAMES.length, names: SEED_RESERVED_NICKNAMES };
  }
);
