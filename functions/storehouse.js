// functions/storehouse.js — 🏚️ 놀부의 텅 빈 곳간 (유배귀양지)
// 🚀 sendToExile: 관리자가 대상 유저를 유배 — strikeCount +1, 단계 자동 판정
// 🚀 releaseFromExile: 본인이 속죄금 지불하고 해금 — 속죄금 소각 + 깐부 리셋 + 깐부방 탈퇴
// 🔒 users.sanctionStatus/strikeCount는 Cloud Function 전용 (Rules로 클라이언트 수정 차단)
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");

const db = getFirestore();

// 🏚️ 관리자 닉네임 화이트리스트 (클라이언트 PLATFORM_ADMIN_NICKNAMES와 동일)
const ADMIN_NICKNAMES = ["흑무영"];

// 🏚️ 단계별 정책 — storehouse-dev-plan.md §1.1 기준
const SANCTION_POLICIES = [
  { level: 1, status: "exiled_lv1", reflectionDays: 3,  bailAmount: 10 },
  { level: 2, status: "exiled_lv2", reflectionDays: 7,  bailAmount: 50 },
  { level: 3, status: "exiled_lv3", reflectionDays: 30, bailAmount: 300 },
];

// 관리자 검증 — users/{uid}.nickname으로 체크
async function verifyAdmin(uid) {
  const snap = await db.collection("users").doc(uid).get();
  const nickname = snap.data()?.nickname;
  return !!nickname && ADMIN_NICKNAMES.includes(nickname);
}

// ════════════════════════════════════════════════════════════
// 🚀 sendToExile — 관리자 전용: 대상 유저를 유배
// ════════════════════════════════════════════════════════════
exports.sendToExile = onCall(
  { region: "asia-northeast3" },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
    const adminUid = request.auth.uid;
    const { targetUid, reason } = request.data || {};

    // 관리자 권한 검증
    if (!(await verifyAdmin(adminUid))) {
      throw new HttpsError("permission-denied", "관리자만 사용할 수 있습니다.");
    }

    if (typeof targetUid !== "string" || !targetUid.trim()) {
      throw new HttpsError("invalid-argument", "targetUid가 필요합니다.");
    }
    if (typeof reason !== "string" || !reason.trim()) {
      throw new HttpsError("invalid-argument", "사유가 필요합니다.");
    }

    const targetRef = db.collection("users").doc(targetUid);
    let newStrikeCount = 0;
    let newStatus = "";
    let sayakTriggered = false;

    await db.runTransaction(async (tx) => {
      const targetSnap = await tx.get(targetRef);
      if (!targetSnap.exists) throw new HttpsError("not-found", "대상 유저를 찾을 수 없습니다.");
      const target = targetSnap.data();

      // 이미 사약 받은 유저는 재처분 불가
      if (target.sanctionStatus === "banned") {
        throw new HttpsError("failed-precondition", "이미 사약 처분된 유저입니다.");
      }

      // strikeCount +1 (영구 보존)
      const currentStrike = target.strikeCount || 0;
      newStrikeCount = currentStrike + 1;

      const now = Timestamp.now();

      if (newStrikeCount >= 4) {
        // 🩸 4차 도달 → 사약
        sayakTriggered = true;
        newStatus = "banned";
        tx.update(targetRef, {
          strikeCount: newStrikeCount,
          sanctionStatus: "banned",
          sanctionReason: reason.trim(),
          sanctionedAt: now,
          sanctionedBy: adminUid,
          sanctionExpiresAt: null,
          requiredBail: 0,
        });
      } else {
        // 1/2/3차 유배
        const policy = SANCTION_POLICIES[newStrikeCount - 1];
        newStatus = policy.status;
        const expiresAt = Timestamp.fromMillis(now.toMillis() + policy.reflectionDays * 24 * 60 * 60 * 1000);

        tx.update(targetRef, {
          strikeCount: newStrikeCount,
          sanctionStatus: policy.status,
          sanctionExpiresAt: expiresAt,
          requiredBail: policy.bailAmount,
          sanctionReason: reason.trim(),
          sanctionedAt: now,
          sanctionedBy: adminUid,
        });
      }

      // 감사 로그
      const logId = `log_${Date.now()}_${targetUid}`;
      tx.set(db.collection("sanction_log").doc(logId), {
        type: sayakTriggered ? "sayak" : "exile",
        targetUid,
        targetNickname: target.nickname || null,
        adminUid,
        reason: reason.trim(),
        strikeCount: newStrikeCount,
        status: newStatus,
        createdAt: now,
      });
    });

    // 대상 유저에게 알림
    await db.collection("notifications").doc(targetUid).collection("items").add({
      type: sayakTriggered ? "sayak_sentenced" : "exile_sentenced",
      reason: reason.trim(),
      strikeCount: newStrikeCount,
      status: newStatus,
      createdAt: Timestamp.now(),
      read: false,
    });

    return { success: true, strikeCount: newStrikeCount, status: newStatus, sayakTriggered };
  }
);

// ════════════════════════════════════════════════════════════
// 🚀 releaseFromExile — 본인: 속죄금 지불하고 해금
// ════════════════════════════════════════════════════════════
exports.releaseFromExile = onCall(
  { region: "asia-northeast3" },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
    const uid = request.auth.uid;

    const userRef = db.collection("users").doc(uid);

    let atonementFeePaid = 0;
    let kkanbusRemovedCount = 0;
    let strikeLevel = 0;

    await db.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists) throw new HttpsError("not-found", "사용자를 찾을 수 없습니다.");
      const user = userSnap.data();

      const status = user.sanctionStatus;
      if (!status || !status.startsWith("exiled_")) {
        throw new HttpsError("failed-precondition", "유배 중인 상태가 아닙니다.");
      }
      if (status === "banned") {
        throw new HttpsError("failed-precondition", "사약 처분된 유저는 해금할 수 없습니다.");
      }

      // 반성 기간 만료 체크
      const now = Timestamp.now();
      const expiresAt = user.sanctionExpiresAt;
      if (!expiresAt || expiresAt.toMillis() > now.toMillis()) {
        throw new HttpsError("failed-precondition", "반성 기간이 아직 끝나지 않았습니다.");
      }

      // 잔액 확인
      const bail = user.requiredBail || 0;
      const balance = user.ballBalance || 0;
      if (balance < bail) {
        throw new HttpsError("failed-precondition", `속죄금이 부족합니다. (필요: ${bail}볼, 보유: ${balance}볼)`);
      }

      // 단계 파악
      strikeLevel = status === "exiled_lv1" ? 1 : status === "exiled_lv2" ? 2 : 3;
      atonementFeePaid = bail;

      // 1. 속죄금 차감
      tx.update(userRef, {
        ballBalance: balance - bail,
        ballSpent: FieldValue.increment(bail),
      });

      // 2. 속죄금 소각 — platform_revenue/penalty
      tx.set(db.collection("platform_revenue").doc("penalty"), {
        totalAmount: FieldValue.increment(bail),
        totalTransactions: FieldValue.increment(1),
        lastUpdatedAt: now,
      }, { merge: true });

      // 3. 깐부 관계 리셋 — 양방향 제거
      const myFriends = user.friendList || [];
      kkanbusRemovedCount = myFriends.length;

      tx.update(userRef, {
        friendList: [],
        subscriberCount: 0,
      });

      // 4. 유배 상태 해제
      tx.update(userRef, {
        sanctionStatus: "active",
        sanctionExpiresAt: null,
        requiredBail: 0,
      });

      // 5. 이력 적재
      const releaseLogId = `release_${Date.now()}_${uid}`;
      tx.set(db.collection("release_history").doc(releaseLogId), {
        uid,
        strikeLevel,
        atonementFeePaid: bail,
        kkanbusRemovedCount,
        roomsLeftCount: 0, // Phase 1에서는 깐부방 탈퇴 미구현 (Phase 2에서 확장)
        releasedAt: now,
      });

      const bailLogId = `bail_${Date.now()}_${uid}`;
      tx.set(db.collection("bail_history").doc(bailLogId), {
        uid,
        strikeLevel,
        amountPaid: bail,
        paidAt: now,
        releasedAt: now,
      });
    });

    // 트랜잭션 외 — 상대방들의 friendList에서 나를 제거 (비트랜잭션 — 다수 문서 업데이트)
    // 🔸 trx 내 다중 read 제약 때문에 밖에서 처리. Admin SDK이므로 Rules 우회.
    try {
      const mySnap = await userRef.get();
      const myNickname = mySnap.data()?.nickname;
      if (myNickname) {
        // 내 친구들의 nickname 기반으로 역참조 삭제
        const reverseQuery = await db.collection("users")
          .where("friendList", "array-contains", myNickname)
          .get();
        const batch = db.batch();
        reverseQuery.docs.forEach(d => {
          batch.update(d.ref, {
            friendList: FieldValue.arrayRemove(myNickname),
          });
        });
        await batch.commit();
      }
    } catch (err) {
      console.error("[releaseFromExile] 역참조 삭제 실패:", err);
      // 실패해도 해금은 완료 — 이력으로 추적 가능
    }

    return { success: true, strikeLevel, atonementFeePaid, kkanbusRemovedCount };
  }
);
