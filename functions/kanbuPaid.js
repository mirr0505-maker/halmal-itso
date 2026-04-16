// functions/kanbuPaid.js — 🚀 깐부방 유료 게시판 결제 + 구독 만료
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");

const db = getFirestore();

// 레벨별 수수료율 (강변 시장 동일)
function getFeeRate(level) {
  if (level >= 7) return 0.20;
  if (level >= 5) return 0.25;
  return 0.30;
}

// 🚀 유료 깐부방 결제 — 1회 결제 or 월 구독
exports.joinPaidKanbuRoom = onCall(
  { region: "asia-northeast3" },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
    const buyerUid = request.auth.uid;
    const { roomId, type } = request.data; // type: 'once' | 'monthly'

    if (!roomId || !['once', 'monthly'].includes(type)) {
      throw new HttpsError("invalid-argument", "roomId와 type(once/monthly)이 필요합니다.");
    }

    const roomRef = db.collection("kanbu_rooms").doc(roomId);
    const buyerRef = db.collection("users").doc(buyerUid);

    await db.runTransaction(async (tx) => {
      const roomSnap = await tx.get(roomRef);
      if (!roomSnap.exists) throw new HttpsError("not-found", "깐부방을 찾을 수 없습니다.");
      const room = roomSnap.data();

      const board = type === 'once' ? room.paidBoards?.once : room.paidBoards?.monthly;
      if (!board?.enabled) throw new HttpsError("failed-precondition", "유료 게시판이 활성화되지 않았습니다.");

      const price = board.price;
      if (typeof price !== 'number' || price < 1) throw new HttpsError("failed-precondition", "가격 설정이 올바르지 않습니다.");

      // 이미 결제 확인
      const memberField = type === 'once' ? 'paidOnceMembers' : 'paidMonthlyMembers';
      if ((room[memberField] || []).includes(buyerUid)) {
        throw new HttpsError("already-exists", "이미 결제한 게시판입니다.");
      }

      // 구매자 잔액 확인
      const buyerSnap = await tx.get(buyerRef);
      const balance = buyerSnap.data()?.ballBalance || 0;
      if (balance < price) throw new HttpsError("failed-precondition", `잔액 부족 (보유: ${balance}볼, 필요: ${price}볼)`);

      // 수수료 계산
      const creatorLevel = room.creatorLevel || 1;
      const feeRate = getFeeRate(creatorLevel);
      const platformFee = Math.floor(price * feeRate);
      const creatorEarning = price - platformFee;

      // 구매자 차감
      tx.update(buyerRef, { ballBalance: FieldValue.increment(-price) });

      // 개설자 수익
      const creatorRef = db.collection("users").doc(room.creatorId);
      tx.update(creatorRef, {
        ballBalance: FieldValue.increment(creatorEarning),
        ballReceived: FieldValue.increment(creatorEarning),
      });

      // 멤버 추가
      const updateData = { [memberField]: FieldValue.arrayUnion(buyerUid) };

      // 월 구독: 만료일 설정 (30일)
      if (type === 'monthly') {
        // kanbu_paid_subs 컬렉션에 만료 정보 저장
        tx.set(db.collection("kanbu_paid_subs").doc(`${roomId}_${buyerUid}`), {
          roomId,
          userId: buyerUid,
          type: 'monthly',
          paidAt: Timestamp.now(),
          expiresAt: Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
          price,
          creatorEarning,
          platformFee,
        });
      }

      tx.update(roomRef, updateData);

      // 플랫폼 수익 기록
      tx.set(db.collection("platform_revenue").doc("kanbu_room"), {
        totalFee: FieldValue.increment(platformFee),
        totalTransactions: FieldValue.increment(1),
        updatedAt: Timestamp.now(),
      }, { merge: true });
    });

    // 트랜잭션 외: 알림
    const buyerSnap = await buyerRef.get();
    const buyerNickname = buyerSnap.data()?.nickname || "익명";
    const roomSnap = await roomRef.get();
    const creatorId = roomSnap.data()?.creatorId;

    if (creatorId) {
      await db.collection("notifications").doc(creatorId).collection("items").add({
        type: "thanksball",
        fromNickname: buyerNickname,
        amount: roomSnap.data().paidBoards?.[type]?.price || 0,
        message: `${buyerNickname}님이 깐부방 유료 게시판(${type === 'once' ? '1회' : '구독'})에 가입했습니다`,
        createdAt: Timestamp.now(),
        read: false,
      });
    }

    return { success: true, type };
  }
);

// 🚀 깐부방 월 구독 만료 체크 — 매일 09:00 (checkSubscriptionExpiry 패턴)
exports.checkKanbuSubscriptionExpiry = onSchedule(
  { schedule: "0 9 * * *", timeZone: "Asia/Seoul", region: "asia-northeast3" },
  async () => {
    const now = Timestamp.now();
    const expiredSnap = await db.collection("kanbu_paid_subs")
      .where("type", "==", "monthly")
      .where("expiresAt", "<", now)
      .get();

    let removed = 0;
    for (const doc of expiredSnap.docs) {
      const { roomId, userId } = doc.data();
      try {
        await db.collection("kanbu_rooms").doc(roomId).update({
          paidMonthlyMembers: FieldValue.arrayRemove(userId),
        });
        // 만료 알림
        await db.collection("notifications").doc(userId).collection("items").add({
          type: "community_post",
          message: "깐부방 유료 게시판 구독이 만료되었습니다. 재구독하면 다시 이용 가능합니다.",
          createdAt: Timestamp.now(),
          read: false,
        });
        await doc.ref.delete();
        removed++;
      } catch (err) {
        console.error(`[checkKanbuSubscriptionExpiry] ${doc.id} 처리 실패:`, err);
      }
    }
    console.log(`[checkKanbuSubscriptionExpiry] ${removed}건 만료 처리 완료`);
  }
);
