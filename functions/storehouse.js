// functions/storehouse.js — 🏚️ 놀부의 텅 빈 곳간 (유배귀양지)
// 🚀 sendToExile: 관리자가 대상 유저를 유배 — strikeCount +1, 단계 자동 판정
// 🚀 releaseFromExile: 본인이 속죄금 지불하고 해금 — 속죄금 소각 + 깐부 리셋 + 깐부방 탈퇴
// 🔒 users.sanctionStatus/strikeCount는 Cloud Function 전용 (Rules로 클라이언트 수정 차단)
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
// 🛡️ Sprint 6 A-1: 관리자 권한 헬퍼 + 감사 로그
const { assertAdmin, isAdminByUid } = require("./utils/adminAuth");
const { logAdminAction } = require("./adminAudit");

const db = getFirestore();

// 🏚️ 단계별 정책 — STOREHOUSE.md §1.1 기준
// ⚠️ src/constants.ts SANCTION_POLICIES와 반드시 동기화 (CF는 Node 런타임이라 TS import 불가)
const SANCTION_POLICIES = [
  { level: 1, status: "exiled_lv1", reflectionDays: 3,  bailAmount: 10 },
  { level: 2, status: "exiled_lv2", reflectionDays: 7,  bailAmount: 50 },
  { level: 3, status: "exiled_lv3", reflectionDays: 30, bailAmount: 300 },
];

// ════════════════════════════════════════════════════════════
// 🚀 sendToExile — 관리자 전용: 대상 유저를 유배
// ════════════════════════════════════════════════════════════
exports.sendToExile = onCall(
  { region: "asia-northeast3" },
  async (request) => {
    // 🛡️ Sprint 6: Claims OR 닉네임 이중 체크
    const { adminUid, adminName, viaClaims } = await assertAdmin(request.auth);
    // 🏚️ postId: 문제 된 글 ID (선택) — 해당 글을 soft delete
    // targetCollection: 'posts' | 'community_posts' 등 (기본 'posts')
    const { targetUid, reason, postId, targetCollection } = request.data || {};

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

    // 🏚️ 문제 된 글 soft delete — isHiddenByExile: true
    // 트랜잭션 밖에서 처리 (Firestore 트랜잭션 문서 제한 완화)
    let hiddenPostsCount = 0;
    if (postId && typeof postId === "string" && postId.trim()) {
      try {
        const col = targetCollection || "posts";
        await db.collection(col).doc(postId.trim()).update({
          isHiddenByExile: true,
          hiddenByExileAt: Timestamp.now(),
        });
        hiddenPostsCount = 1;
      } catch (err) {
        console.error("[sendToExile] 문제 글 숨김 처리 실패:", err);
        // 글 숨김 실패해도 유배는 유지
      }
    }

    // 🩸 사약 시: 해당 유저의 모든 글 일괄 soft delete
    if (sayakTriggered) {
      try {
        for (const col of ["posts", "community_posts"]) {
          const snap = await db.collection(col).where("author_id", "==", targetUid).get();
          const batch = db.batch();
          snap.docs.forEach(d => batch.update(d.ref, { isHiddenByExile: true, hiddenByExileAt: Timestamp.now() }));
          if (!snap.empty) await batch.commit();
          hiddenPostsCount += snap.size;
        }
      } catch (err) {
        console.error("[sendToExile] 사약 글 일괄 숨김 실패:", err);
      }
    }

    // 대상 유저에게 알림
    await db.collection("notifications").doc(targetUid).collection("items").add({
      type: sayakTriggered ? "sayak_sentenced" : "exile_sentenced",
      reason: reason.trim(),
      strikeCount: newStrikeCount,
      status: newStatus,
      createdAt: Timestamp.now(),
      read: false,
    });

    // 🛡️ Sprint 6: admin_actions 감사 로그
    await logAdminAction({
      action: sayakTriggered ? "execute_sayak_via_exile" : "send_to_exile",
      adminUid,
      adminName,
      viaClaims,
      targetUid,
      payload: {
        newStrikeCount,
        newStatus,
        sayakTriggered,
        hiddenPostsCount,
        postId: postId || null,
        targetCollection: targetCollection || null,
      },
      reason: reason.trim(),
    });

    return { success: true, strikeCount: newStrikeCount, status: newStatus, sayakTriggered, hiddenPostsCount };
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

// ════════════════════════════════════════════════════════════
// 🩸 executeSayak — 사약 처분 (관리자 직권 or 자동 사약에서 호출)
// ════════════════════════════════════════════════════════════
// 처리:
//   ① sanctionStatus = 'banned'
//   ② 자산 전액 → platform_revenue/sayak_seized로 회수
//   ③ 보유 phoneHash → banned_phones 블랙리스트 등록
//   ④ 모든 게시물/커뮤니티글 soft delete (isHiddenByExile)
//   ⑤ 깐부 관계 양방향 제거
//   ⑥ sanction_log 감사 기록
exports.executeSayak = onCall(
  { region: "asia-northeast3", timeoutSeconds: 120 },
  async (request) => {
    // 🛡️ Sprint 6: Claims OR 닉네임 이중 체크
    const { adminUid, adminName, viaClaims } = await assertAdmin(request.auth);
    const { targetUid, reason } = request.data || {};

    if (typeof targetUid !== "string" || !targetUid.trim()) {
      throw new HttpsError("invalid-argument", "targetUid가 필요합니다.");
    }

    const finalReason = reason || "관리자 직권 사약";
    const result = await runSayakLogic(targetUid, finalReason, adminUid);

    // 🛡️ Sprint 6: admin_actions 감사 로그
    await logAdminAction({
      action: "execute_sayak",
      adminUid,
      adminName,
      viaClaims,
      targetUid,
      payload: {
        seizedAmount: result.seizedAmount,
        hiddenPostsCount: result.hiddenCount,
      },
      reason: finalReason,
    });

    return { success: true };
  }
);

// 재사용 가능한 사약 로직 — checkAutoSayak에서도 호출
async function runSayakLogic(targetUid, reason, adminUid) {
  const targetRef = db.collection("users").doc(targetUid);
  const targetSnap = await targetRef.get();
  if (!targetSnap.exists) throw new Error(`user not found: ${targetUid}`);
  const target = targetSnap.data();
  const now = Timestamp.now();

  // 1. sanctionStatus → banned + 자산 몰수 준비
  const seizedAmount = target.ballBalance || 0;
  await targetRef.update({
    sanctionStatus: "banned",
    sanctionReason: reason,
    sanctionedAt: now,
    sanctionedBy: adminUid || null,
    sanctionExpiresAt: null,
    requiredBail: 0,
    ballBalance: 0,
    friendList: [],
    subscriberCount: 0,
  });

  // 2. 몰수된 자산 → platform_revenue/sayak_seized
  if (seizedAmount > 0) {
    await db.collection("platform_revenue").doc("sayak_seized").set({
      totalAmount: FieldValue.increment(seizedAmount),
      totalSayakCount: FieldValue.increment(1),
      lastUpdatedAt: now,
    }, { merge: true });
  }

  // 3. phoneHash → banned_phones 등록
  if (target.phoneHash) {
    await db.collection("banned_phones").doc(target.phoneHash).set({
      phoneHash: target.phoneHash,
      bannedAt: now,
      originalUid: targetUid,
      reason: "sayak",
    });
  }

  // 📱 Sprint 7 Step 7-C — 사약자의 referral_codes 비활성화
  // Why: 코드 자체는 DB에 남아 타인이 redeem 시도 가능 → isDisabled로 차단
  //      기존 confirmed 피추천자 관계는 보존(증거 보존), 깐부는 friendList arrayRemove에서 자연 정리
  if (target.referralCode) {
    await db.collection("referral_codes").doc(target.referralCode).update({
      isDisabled: true,
      disabledReason: "sayak",
      disabledAt: now,
    }).catch(e => console.warn(`[executeSayak] referral_codes disable skip: ${e.message}`));
  }

  // 4. 모든 글 soft delete
  let hiddenCount = 0;
  for (const col of ["posts", "community_posts"]) {
    const snap = await db.collection(col).where("author_id", "==", targetUid).get();
    const batch = db.batch();
    snap.docs.forEach(d => batch.update(d.ref, { isHiddenByExile: true, hiddenByExileAt: now }));
    if (!snap.empty) await batch.commit();
    hiddenCount += snap.size;
  }

  // 5. 깐부 관계 양방향 제거
  if (target.nickname) {
    const reverseQuery = await db.collection("users").where("friendList", "array-contains", target.nickname).get();
    const batch = db.batch();
    reverseQuery.docs.forEach(d => batch.update(d.ref, { friendList: FieldValue.arrayRemove(target.nickname) }));
    if (!reverseQuery.empty) await batch.commit();
  }

  // 6. 감사 로그
  await db.collection("sanction_log").doc(`sayak_${Date.now()}_${targetUid}`).set({
    type: "sayak",
    targetUid,
    targetNickname: target.nickname || null,
    adminUid: adminUid || "AUTO",
    reason,
    seizedAmount,
    hiddenPostsCount: hiddenCount,
    createdAt: now,
  });

  // 7. 대상자 알림
  await db.collection("notifications").doc(targetUid).collection("items").add({
    type: "sayak_sentenced",
    reason,
    status: "banned",
    createdAt: now,
    read: false,
  });

  console.log(`[executeSayak] ${targetUid} (${target.nickname}) — 몰수 ${seizedAmount}볼, 숨김 ${hiddenCount}건`);
  return { seizedAmount, hiddenCount };
}

// ════════════════════════════════════════════════════════════
// 🩸 checkAutoSayak — 매일 새벽 4시: 무기한 유배 90일 경과 자동 사약
// ════════════════════════════════════════════════════════════
exports.checkAutoSayak = onSchedule(
  { schedule: "every day 04:00", region: "asia-northeast3", timeoutSeconds: 300 },
  async () => {
    const now = Timestamp.now();
    const ninetyDaysAgo = Timestamp.fromMillis(now.toMillis() - 90 * 24 * 60 * 60 * 1000);

    // 90일 전에 유배 처분된 유저 중 아직 해금 안 한 유저
    const candidates = await db.collection("users")
      .where("sanctionStatus", "in", ["exiled_lv1", "exiled_lv2", "exiled_lv3"])
      .where("sanctionedAt", "<=", ninetyDaysAgo)
      .get();

    if (candidates.empty) {
      console.log("[checkAutoSayak] 자동 사약 대상 없음");
      return;
    }

    let processed = 0;
    for (const doc of candidates.docs) {
      try {
        const result = await runSayakLogic(doc.id, "AUTO_SAYAK_90D_UNPAID", null);
        // 🛡️ Sprint 6: 자동 사약도 admin_actions 기록 (adminUid=null, adminName='AUTO')
        await logAdminAction({
          action: "execute_sayak_auto",
          adminUid: "AUTO",
          adminName: "AUTO (checkAutoSayak)",
          viaClaims: false,
          targetUid: doc.id,
          payload: {
            seizedAmount: result.seizedAmount,
            hiddenPostsCount: result.hiddenCount,
            trigger: "90d_unpaid",
          },
          reason: "AUTO_SAYAK_90D_UNPAID",
        });
        processed++;
      } catch (err) {
        console.error(`[checkAutoSayak] ${doc.id} 실패:`, err);
      }
    }
    console.log(`[checkAutoSayak] ${processed}/${candidates.size}건 자동 사약 처리`);
  }
);
