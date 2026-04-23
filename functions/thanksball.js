// functions/thanksball.js — 땡스볼 전송 (서버사이드 트랜잭션)
// 🚀 클라이언트에서 ballBalance 직접 수정 차단됨 → Admin SDK로 처리
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const { buildExpLevelUpdate } = require("./utils/levelSync");
const { upgradeTitle } = require("./utils/titleAwarder");

const db = getFirestore();

// 🏷️ sponsor 칭호 누적 땡스볼 경계 (src/constants.ts TITLE_THRESHOLDS.sponsor 동기화)
const SPONSOR_THRESHOLDS = { I: 1000, II: 10000, III: 100000 };
function pickSponsorTier(total) {
  if (total >= SPONSOR_THRESHOLDS.III) return "III";
  if (total >= SPONSOR_THRESHOLDS.II) return "II";
  if (total >= SPONSOR_THRESHOLDS.I) return "I";
  return null;
}

// 🔒 1회 송금 상한 — 평판 펌핑/대량 이체 방지
const MAX_AMOUNT_PER_TX = 10000;
// 🔒 연속 송금 최소 간격(ms) — 봇 스팸·평판 펌핑 방지
const MIN_INTERVAL_MS = 3000;
// 🔒 message 최대 길이 — notifications/sentBalls DB 용량 공격 방지 (클라는 50자 제한)
const MAX_MESSAGE_LENGTH = 100;
// 🔒 targetCollection 화이트리스트 — 임의 컬렉션 경유 recipient 변조 방지
const ALLOWED_TARGET_COLLECTIONS = new Set([
  "posts", "comments", "community_posts", "community_post_comments",
]);

exports.sendThanksball = onCall(
  { region: "asia-northeast3" },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
    const senderUid = request.auth.uid;
    // 🔒 postTitle/postAuthor는 클라이언트에서 받지 않음 — 서버가 원본 문서에서 직접 조회
    // Why: 이전엔 클라가 보낸 문자열을 그대로 notifications/sentBalls에 저장 → 사칭 알림 생성 가능
    const {
      clientRequestId, recipientUid, amount, message,
      postId, commentId, targetCollection,
      chatCommunityId, chatMessageId,
      liveSessionId,
    } = request.data;

    // 🔒 amount 검증 — 타입·정수·하한·상한 모두 검증
    // Why: 이전에는 하한만 체크해 amount=1.5(소수점 오염)·amount=999999(대량 이체)·Infinity/NaN이 통과 가능
    if (typeof amount !== "number" || !Number.isInteger(amount) || amount < 1 || amount > MAX_AMOUNT_PER_TX) {
      throw new HttpsError("invalid-argument", `1~${MAX_AMOUNT_PER_TX}볼 사이의 정수만 가능합니다.`);
    }
    // 🔒 자기 자신에게 송금 차단 (클라이언트 폴백 UID) — 트랜잭션 내부에서 resolvedRecipientUid 재검증
    if (recipientUid && recipientUid === senderUid) {
      throw new HttpsError("invalid-argument", "자기 자신에게 보낼 수 없습니다.");
    }
    // 🔒 멱등키 필수 — 재시도 이중 차감 방지
    if (!clientRequestId || typeof clientRequestId !== "string") {
      throw new HttpsError("invalid-argument", "clientRequestId가 필요합니다.");
    }
    // 🔒 message 길이 검증 — 서버 사이드 용량 공격 차단
    if (message != null && (typeof message !== "string" || message.length > MAX_MESSAGE_LENGTH)) {
      throw new HttpsError("invalid-argument", `메시지는 ${MAX_MESSAGE_LENGTH}자 이내여야 합니다.`);
    }
    // 🔒 targetCollection 화이트리스트
    if (targetCollection && !ALLOWED_TARGET_COLLECTIONS.has(targetCollection)) {
      throw new HttpsError("invalid-argument", "지원하지 않는 targetCollection.");
    }

    const senderRef = db.collection("users").doc(senderUid);
    const txRef = db.collection("ball_transactions").doc(clientRequestId);
    const docCollection = targetCollection || "posts";
    const docId = commentId || postId;

    // 🔒 트랜잭션: 멱등 체크 → 발신자·수신자 pre-fetch → 잔액 차감 → 수신자 누적 → thanksballTotal → 멱등 마커
    // Why: 이전에는 pre-fetch·thanksballTotal이 트랜잭션 밖에 있어서 재시도 시 중복 증가·stale 리스크가 있었음
    const result = await db.runTransaction(async (tx) => {
      // 1. 멱등 체크 — 같은 clientRequestId가 이미 처리됐으면 즉시 종료 (no-op)
      const txSnap = await tx.get(txRef);
      if (txSnap.exists) {
        const prior = txSnap.data();
        return {
          idempotent: true,
          senderNickname: prior.senderNickname || "익명",
          resolvedRecipientUid: prior.resolvedRecipientUid || null,
          resolvedPostTitle: prior.postTitle || null,
          resolvedPostAuthorNickname: prior.postAuthorNickname || null,
        };
      }

      // 2. 발신자 조회 (트랜잭션 내부 — 재시도 시 stale 방지)
      const senderSnap = await tx.get(senderRef);
      if (!senderSnap.exists) throw new HttpsError("not-found", "사용자를 찾을 수 없습니다.");
      const senderData = senderSnap.data();
      const nickname = senderData.nickname || request.auth.token?.name || "익명";

      // 🏚️ 유배자/사약 유저는 송금 차단 (수신은 허용 — 응원 문화)
      const senderStatus = senderData.sanctionStatus;
      if (senderStatus && (senderStatus.startsWith("exiled_") || senderStatus === "banned")) {
        throw new HttpsError("permission-denied", "유배 중에는 땡스볼을 보낼 수 없습니다.");
      }

      // 🔒 Rate Limit — 연속 송금 최소 3초 간격 (봇 스팸·평판 펌핑 차단)
      // Why: 자기송금은 막혔어도 A→B 연타로 B의 ballReceived(평판 +5×)를 분당 수백 회 펌핑 가능했음
      const lastSentAt = senderData.lastThanksballSentAt;
      if (lastSentAt && Timestamp.now().toMillis() - lastSentAt.toMillis() < MIN_INTERVAL_MS) {
        throw new HttpsError("resource-exhausted", "잠시 후 다시 시도해주세요.");
      }

      const currentBalance = senderData.ballBalance || 0;
      if (currentBalance < amount) {
        throw new HttpsError("failed-precondition", "잔액 부족");
      }

      // 3. 수신자 UID 확보 + 🔒 postTitle 서버 권위화
      //    우선순위: live 호스트 > posts/comments.author_id > recipientUid 폴백
      let recipient = null;
      let resolvedPostTitle = null;
      if (liveSessionId) {
        // 🔴 live 경로: 라이브 세션 호스트가 수신자
        const liveSnap = await tx.get(db.collection("live_sessions").doc(liveSessionId));
        if (!liveSnap.exists) throw new HttpsError("not-found", "라이브 세션을 찾을 수 없습니다.");
        const liveData = liveSnap.data();
        if (liveData.status !== "live") {
          throw new HttpsError("failed-precondition", "진행 중인 라이브가 아닙니다.");
        }
        recipient = liveData.hostUid || null;
        resolvedPostTitle = liveData.title || null;
      } else if (postId) {
        const col = commentId ? (targetCollection || "comments") : "posts";
        const targetSnap = await tx.get(db.collection(col).doc(commentId || postId));
        if (targetSnap.exists) recipient = targetSnap.data().author_id;
        // postTitle은 항상 상위 posts 문서에서 조회 (댓글 땡스볼도 상위 글 제목을 표시)
        if (!commentId && targetSnap.exists) {
          resolvedPostTitle = targetSnap.data().title || null;
        } else if (commentId) {
          const parentPostSnap = await tx.get(db.collection("posts").doc(postId));
          if (parentPostSnap.exists) resolvedPostTitle = parentPostSnap.data().title || null;
        }
      }
      if (!recipient) recipient = recipientUid || null;

      // 🔒 수신자 필수 — null이면 발신자만 차감되고 볼이 증발함 (기존 허점)
      if (!recipient) {
        throw new HttpsError("not-found", "수신자를 찾을 수 없습니다.");
      }
      // 🔒 트랜잭션 내부 자기송금 재검증 — posts.author_id가 본인인 케이스 차단
      if (recipient === senderUid) {
        throw new HttpsError("invalid-argument", "자기 자신에게 보낼 수 없습니다.");
      }

      // 4. 수신자 pre-read — 존재·제재 검증 + 감사용 balanceBefore/After 기록
      // Why: tx.set+merge 방식은 존재하지 않는 uid에 ghost 유저 문서를 생성함 → tx.update로 전환
      //      사약(banned) 수신자에게 보내는 것도 차단 (회수 불가 → 볼 사실상 소각)
      const receiverRef = db.collection("users").doc(recipient);
      const receiverSnap = await tx.get(receiverRef);
      if (!receiverSnap.exists) {
        throw new HttpsError("not-found", "수신자 계정이 존재하지 않습니다.");
      }
      const receiverData = receiverSnap.data();
      if (receiverData.sanctionStatus === "banned") {
        throw new HttpsError("failed-precondition", "사약 처분된 사용자에게는 보낼 수 없습니다.");
      }
      const receiverBalanceBefore = receiverData.ballBalance || 0;
      const receiverBalanceAfter = receiverBalanceBefore + amount;

      // 5. 발신자 차감 + 최근 송금 시각 갱신 (EXP +1, level 동시 쓰기 — 옵션 B)
      tx.update(senderRef, {
        ballBalance: currentBalance - amount,
        ballSpent: FieldValue.increment(amount),
        ...buildExpLevelUpdate(FieldValue, senderData.exp, 1),
        lastThanksballSentAt: Timestamp.now(),
      });

      // 6. 수신자 누적 (update — 문서 존재 보장됨)
      // ballReceived: 평판 점수용 누적 카운터(영구 보존)
      // ballBalance: 실사용 가능 잔액 — 수신자가 땡스볼을 되쓰거나 유배 속죄금으로 소진 가능
      tx.update(receiverRef, {
        ballReceived: FieldValue.increment(amount),
        ballBalance: FieldValue.increment(amount),
      });

      // 7. thanksballTotal 누적
      //    - live: live_sessions.totalThanksball (CF Admin SDK가 Rules 우회해서 증가)
      //    - post/comment: 대상 문서 thanksballTotal
      //    - chat: 외부 처리(thanksballSenders 배열 merge 필요해 트랜잭션 후 처리)
      if (liveSessionId) {
        tx.update(db.collection("live_sessions").doc(liveSessionId), {
          totalThanksball: FieldValue.increment(amount),
        });
      } else if (!chatCommunityId && docId) {
        tx.update(db.collection(docCollection).doc(docId), {
          thanksballTotal: FieldValue.increment(amount),
        });
      }

      // 8. 멱등 마커 저장 (다음 재호출에서 txSnap.exists 분기로 차단됨)
      // 🔒 감사·분쟁 필드 확장 — balanceBefore/After·sourceType·platformFee·chatRef·liveRef
      // Why: 기존 마커는 금액·당사자만 기록해 분쟁 시 "당시 잔액이 얼마였나"를 재구성 불가했음
      const sourceType = liveSessionId
        ? "live"
        : chatCommunityId
          ? "chat"
          : commentId
            ? "comment"
            : "post";
      // 🔒 postAuthorNickname: 수신자 nickname — 사전 로드된 receiverData 재사용
      const resolvedPostAuthorNickname = receiverData.nickname || null;
      tx.set(txRef, {
        schemaVersion: 1,
        senderUid,
        senderNickname: nickname,
        resolvedRecipientUid: recipient,
        amount,
        balanceBefore: currentBalance,
        balanceAfter: currentBalance - amount,
        receiverBalanceBefore,
        receiverBalanceAfter,
        platformFee: 0,
        sourceType,
        postId: postId || null,
        postTitle: resolvedPostTitle,
        postAuthorNickname: resolvedPostAuthorNickname,
        commentId: commentId || null,
        chatCommunityId: chatCommunityId || null,
        chatMessageId: chatMessageId || null,
        liveSessionId: liveSessionId || null,
        createdAt: Timestamp.now(),
      });

      return {
        idempotent: false,
        senderNickname: nickname,
        resolvedRecipientUid: recipient,
        resolvedPostTitle,
        resolvedPostAuthorNickname,
      };
    });

    const {
      idempotent, senderNickname, resolvedRecipientUid,
      resolvedPostTitle, resolvedPostAuthorNickname,
    } = result;

    // 멱등 히트: 같은 요청이 이미 처리 완료된 상태 → 기록·알림도 이미 있으므로 즉시 반환
    if (idempotent) {
      return { success: true, amount, idempotent: true };
    }

    // 트랜잭션 외: 경로별 추가 기록 + 알림
    // ⚠️ 재시도 중복은 멱등 마커가 선행 차단 — 이 경로까지 오면 새 요청이 보장됨
    if (liveSessionId) {
      // 🔴 live 경로: live_chats 기록(VFX 오버레이 트리거) — CF Admin SDK가 Rules 우회해서 기록
      const vfxTier = amount >= 100 ? "legend" : amount >= 50 ? "gold" : amount >= 10 ? "silver" : "bronze";
      await db.collection("live_sessions").doc(liveSessionId)
        .collection("live_chats").add({
          uid: senderUid,
          nickname: senderNickname,
          type: "thanksball",
          text: message || "",
          amount,
          vfxTier,
          createdAt: Timestamp.now(),
        });
    } else if (chatCommunityId && chatMessageId) {
      // 채팅 메시지: community_chats/{communityId}/messages/{messageId}
      const chatMsgRef = db.collection("community_chats").doc(chatCommunityId).collection("messages").doc(chatMessageId);
      const currentSenders = (await chatMsgRef.get()).data()?.thanksballSenders ?? [];
      const newSenders = [senderNickname, ...currentSenders.filter((n) => n !== senderNickname)].slice(0, 5);
      await chatMsgRef.update({
        thanksballTotal: FieldValue.increment(amount),
        thanksballSenders: newSenders,
      });
    } else if (docId) {
      // thanksballTotal은 트랜잭션 내부에서 처리됨 — 여기서는 서브컬렉션 기록만
      await db.collection(docCollection).doc(docId).collection("thanksBalls").add({
        sender: senderNickname, senderId: senderUid,
        amount, message: message || null,
        createdAt: Timestamp.now(), isPaid: false,
      });
    }

    // sentBalls 기록 — 모든 경로(live 포함) 감사 추적
    // 🔒 postTitle/postAuthor는 서버가 트랜잭션에서 조회한 원본 값 사용 (클라 위조 차단)
    await db.collection("sentBalls").doc(senderUid).collection("items").add({
      postId: postId || null,
      postTitle: resolvedPostTitle,
      postAuthor: resolvedPostAuthorNickname,
      ...(commentId ? { commentId } : {}),
      ...(liveSessionId ? { liveSessionId } : {}),
      amount, message: message || null, createdAt: Timestamp.now(),
    });

    // 수신자 알림 — live는 VFX가 실시간 전달하므로 제외
    if (resolvedRecipientUid && !liveSessionId) {
      await db.collection("notifications").doc(resolvedRecipientUid).collection("items").add({
        type: "thanksball", fromNickname: senderNickname,
        amount, message: message || null,
        postId: postId || null, postTitle: resolvedPostTitle,
        ...(commentId ? { commentId } : {}),
        createdAt: Timestamp.now(), read: false,
      });
    }

    // 🏷️ sponsor 칭호 — 누적 보낸 땡스볼 갱신 + tier 재계산
    // Why: ballSpent는 기존 집계이지만 '누적(환불·소각 제외)' 의미의 ballSentTotal을 별도 관리해
    //      향후 어뷰징 패턴(대량 순환 송금 후 취소) 대응 여지를 남김. 현재는 amount만큼 단순 누적.
    //      실패해도 송금 본 흐름에 영향 없도록 try-catch로 격리.
    try {
      const sponsorRef = db.collection("users").doc(senderUid);
      const newTotal = await db.runTransaction(async (tx) => {
        const snap = await tx.get(sponsorRef);
        if (!snap.exists) return 0;
        const next = (snap.data().ballSentTotal || 0) + amount;
        tx.update(sponsorRef, { ballSentTotal: next });
        return next;
      });
      const tier = pickSponsorTier(newTotal);
      if (tier) {
        await upgradeTitle(senderUid, "sponsor", tier, {
          context: { ballSentTotal: newTotal },
        });
      }
    } catch (err) {
      console.error("[sendThanksball] sponsor hook 실패(무시하고 진행)", err);
    }

    return { success: true, amount };
  }
);
