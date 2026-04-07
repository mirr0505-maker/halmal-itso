// functions/thanksball.js — 땡스볼 전송 (서버사이드 트랜잭션)
// 🚀 클라이언트에서 ballBalance 직접 수정 차단됨 → Admin SDK로 처리
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");

const db = getFirestore();

exports.sendThanksball = onCall(
  { region: "asia-northeast3" },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
    const senderUid = request.auth.uid;
    const { recipientUid, amount, message, postId, postTitle, postAuthor, commentId, targetCollection } = request.data;

    if (typeof amount !== "number" || amount < 1) {
      throw new HttpsError("invalid-argument", "1볼 이상 보내야 합니다.");
    }

    const senderRef = db.collection("users").doc(senderUid);
    const docCollection = targetCollection || "posts";
    const docId = commentId || postId;

    // 🔒 트랜잭션: 잔액 확인 + 차감 + 수신자 누적
    await db.runTransaction(async (tx) => {
      const senderSnap = await tx.get(senderRef);
      if (!senderSnap.exists) throw new HttpsError("not-found", "사용자를 찾을 수 없습니다.");
      const currentBalance = senderSnap.data().ballBalance || 0;
      if (currentBalance < amount) {
        throw new HttpsError("failed-precondition", "잔액 부족");
      }

      tx.update(senderRef, {
        ballBalance: currentBalance - amount,
        ballSpent: FieldValue.increment(amount),
        exp: FieldValue.increment(1),
      });

      if (recipientUid) {
        tx.set(db.collection("users").doc(recipientUid), {
          ballReceived: FieldValue.increment(amount),
        }, { merge: true });
      }
    });

    // 트랜잭션 외: 땡스볼 카운터 + 기록 + 알림
    if (docId) {
      await db.collection(docCollection).doc(docId).update({
        thanksballTotal: FieldValue.increment(amount),
      });

      await db.collection(docCollection).doc(docId).collection("thanksBalls").add({
        sender: request.auth.token.name || "", senderId: senderUid,
        amount, message: message || null,
        createdAt: Timestamp.now(), isPaid: false,
      });
    }

    // sentBalls 기록
    await db.collection("sentBalls").doc(senderUid).collection("items").add({
      postId, postTitle: postTitle || null, postAuthor: postAuthor || null,
      ...(commentId ? { commentId } : {}),
      amount, message: message || null, createdAt: Timestamp.now(),
    });

    // 수신자 알림
    if (recipientUid) {
      await db.collection("notifications").doc(recipientUid).collection("items").add({
        type: "thanksball", fromNickname: request.auth.token.name || "",
        amount, message: message || null,
        postId, postTitle: postTitle || null,
        ...(commentId ? { commentId } : {}),
        createdAt: Timestamp.now(), read: false,
      });
    }

    return { success: true, amount };
  }
);
