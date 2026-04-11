// functions/inkwell.js — 마르지 않는 잉크병 (연재 시스템)
// 🚀 unlockEpisode: 유료 회차 결제 (땡스볼 차감 → 작가 지급 → 영수증 생성)
// 🚀 onEpisodeCreate: 새 회차 발행 시 series 카운터 + 구독자 알림
// 🔒 클라이언트에서 ballBalance·unlocked_episodes 직접 수정 차단됨 → Admin SDK로 처리
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated, onDocumentDeleted } = require("firebase-functions/v2/firestore");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");

const db = getFirestore();

// ════════════════════════════════════════════════════════════
// 🚀 unlockEpisode — 유료 회차 결제 (onCall v2)
// ════════════════════════════════════════════════════════════
exports.unlockEpisode = onCall(
  { region: "asia-northeast3" },
  async (request) => {
    // 1. 인증 확인
    if (!request.auth) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
    const buyerUid = request.auth.uid;
    const { postId } = request.data || {};

    // 2. postId 검증
    if (typeof postId !== "string" || !postId.trim()) {
      throw new HttpsError("invalid-argument", "postId가 필요합니다.");
    }

    // 3. 게시글 조회
    const postRef = db.collection("posts").doc(postId);
    const postSnap = await postRef.get();
    if (!postSnap.exists) throw new HttpsError("not-found", "게시글을 찾을 수 없습니다.");
    const post = postSnap.data();

    // 4. 에피소드 검증
    if (post.category !== "magic_inkwell") {
      throw new HttpsError("failed-precondition", "연재 회차가 아닙니다.");
    }
    if (post.isPaid !== true) {
      throw new HttpsError("failed-precondition", "유료 회차가 아닙니다.");
    }

    // 5. 작가 본인 결제 차단
    if (post.author_id === buyerUid) {
      throw new HttpsError("failed-precondition", "작가는 자신의 회차를 결제할 수 없습니다.");
    }

    // 6. 가격 결정
    const price = typeof post.price === "number" ? post.price : 0;
    if (price <= 0) {
      throw new HttpsError("failed-precondition", "유효한 가격이 설정되지 않았습니다.");
    }

    // 🚀 구매자 닉네임 조회 (트랜잭션 외부에서 미리 조회 — thanksball.js와 동일 패턴)
    const buyerRef = db.collection("users").doc(buyerUid);
    const buyerSnapForName = await buyerRef.get();
    const buyerNickname = buyerSnapForName.data()?.nickname || request.auth.token?.name || "익명";

    const unlockedRef = db.collection("unlocked_episodes").doc(`${postId}_${buyerUid}`);
    const authorRef = db.collection("users").doc(post.author_id);

    // 7. 🔒 트랜잭션: 중복 결제 체크 + 잔액 차감 + 작가 지급 + 영수증 생성
    let alreadyUnlocked = false;

    await db.runTransaction(async (tx) => {
      // 중복 결제 체크 — 멱등성 유지 (throw 금지, 마커로 처리)
      const unlockedSnap = await tx.get(unlockedRef);
      if (unlockedSnap.exists) {
        alreadyUnlocked = true;
        return;
      }

      // 구매자 user 문서 조회
      const buyerSnap = await tx.get(buyerRef);
      if (!buyerSnap.exists) throw new HttpsError("not-found", "사용자를 찾을 수 없습니다.");

      const currentBalance = buyerSnap.data().ballBalance || 0;
      if (currentBalance < price) {
        throw new HttpsError("failed-precondition", "땡스볼이 부족합니다.");
      }

      // 구매자: 잔액 차감 + 누적 지출 + EXP +2
      tx.update(buyerRef, {
        ballBalance: currentBalance - price,
        ballSpent: FieldValue.increment(price),
        exp: FieldValue.increment(2),
      });

      // 작가: ballReceived 누적 (set merge — thanksball.js와 동일 패턴)
      tx.set(authorRef, {
        ballReceived: FieldValue.increment(price),
      }, { merge: true });

      // 영수증 생성
      tx.set(unlockedRef, {
        userId: buyerUid,
        postId: postId,
        seriesId: post.seriesId,
        authorId: post.author_id,
        paidAmount: price,
        unlockedAt: Timestamp.now(),
      });
    });

    // 8. 트랜잭션 외 처리
    if (alreadyUnlocked) {
      return { success: true, alreadyUnlocked: true };
    }

    // 작가 알림 — 유료 회차 결제 발생
    await db.collection("notifications").doc(post.author_id).collection("items").add({
      type: "episode_unlocked",
      fromNickname: buyerNickname,
      amount: price,
      postId,
      postTitle: post.episodeTitle || post.title || null,
      seriesId: post.seriesId,
      createdAt: Timestamp.now(),
      read: false,
    });

    // 발신자(구매자) sentBalls 기록
    await db.collection("sentBalls").doc(buyerUid).collection("items").add({
      type: "episode_unlock",
      postId,
      seriesId: post.seriesId,
      postTitle: post.episodeTitle || null,
      postAuthor: post.author || null,
      amount: price,
      createdAt: Timestamp.now(),
    });

    // 9. 반환
    return { success: true, amount: price, alreadyUnlocked: false };
  }
);

// ════════════════════════════════════════════════════════════
// 🚀 onEpisodeCreate — 새 회차 발행 트리거 (Firestore v2)
// ════════════════════════════════════════════════════════════
exports.onEpisodeCreate = onDocumentCreated(
  { document: "posts/{postId}", region: "asia-northeast3" },
  async (event) => {
    try {
      // 1. 생성된 문서 데이터 추출
      const postData = event.data?.data();
      if (!postData) return;

      // 2. 필터링 — 잉크병 회차만 처리
      if (postData.category !== "magic_inkwell" || !postData.seriesId) return;

      const seriesId = postData.seriesId;
      const postId = event.params.postId;

      // 3. series 문서 조회
      const seriesRef = db.collection("series").doc(seriesId);
      const seriesSnap = await seriesRef.get();
      if (!seriesSnap.exists) {
        console.warn(`[잉크병] series 문서 없음: ${seriesId} (postId=${postId})`);
        return;
      }
      const series = seriesSnap.data();

      // 4. series 카운터 업데이트
      await seriesRef.update({
        totalEpisodes: FieldValue.increment(1),
        lastEpisodeAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      // 5. 자동 유료화 처리 (안전장치)
      // Why: 클라이언트가 isPaid 설정을 빠뜨려도 freeEpisodeLimit 초과분은 자동으로 유료 처리
      const episodeNumber = postData.episodeNumber;
      const freeLimit = series.freeEpisodeLimit || 0;
      if (
        typeof episodeNumber === "number" &&
        episodeNumber > freeLimit &&
        postData.isPaid !== true
      ) {
        await db.collection("posts").doc(postId).update({
          isPaid: true,
          price: series.defaultPrice || 3,
        });
      }

      // 6. 구독자 알림 발송
      const subsSnap = await db.collection("series_subscriptions")
        .where("seriesId", "==", seriesId)
        .get();

      const targets = [];
      subsSnap.forEach((doc) => {
        const sub = doc.data();
        if (sub.notifyOnNewEpisode === false) return;
        if (!sub.userId) return;
        targets.push(sub.userId);
      });

      // 100명씩 배치 병렬 처리 (Promise.all 폭주 방지)
      const BATCH_SIZE = 100;
      for (let i = 0; i < targets.length; i += BATCH_SIZE) {
        const slice = targets.slice(i, i + BATCH_SIZE);
        await Promise.all(slice.map((userId) =>
          db.collection("notifications").doc(userId).collection("items").add({
            type: "new_episode",
            seriesId,
            seriesTitle: series.title,
            postId,
            episodeNumber: postData.episodeNumber,
            episodeTitle: postData.episodeTitle || null,
            authorNickname: series.authorNickname,
            createdAt: Timestamp.now(),
            read: false,
          })
        ));
      }

      // 7. 로그 출력
      console.log(`[잉크병] ${series.title} ${episodeNumber}화 발행 — 구독자 ${targets.length}명에게 알림`);
    } catch (err) {
      // 8. 에러 로그만 남기고 throw 금지 (트리거 재실행 방지)
      console.error("[잉크병] onEpisodeCreate 처리 실패:", err);
    }
  }
);

// ════════════════════════════════════════════════════════════
// 🚀 onInkwellPostDelete — 회차 삭제 시 고아 알림 cleanup (Phase 5-B)
// ════════════════════════════════════════════════════════════
// 트리거: posts/{postId} 삭제
// 처리:
//   ① 삭제 전 데이터에서 category === 'magic_inkwell' 확인
//   ② collectionGroup('items')에서 postId 일치하는 알림 검색
//   ③ new_episode / episode_unlocked 타입만 batch 삭제
//   ④ 에러 발생 시 로그만 남기고 throw 금지 (트리거 무한 재시도 방지)
// ⚠️ Admin SDK는 Rules를 우회하므로 모든 사용자의 notifications cleanup 가능
exports.onInkwellPostDelete = onDocumentDeleted(
  { document: "posts/{postId}", region: "asia-northeast3" },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const postData = snap.data();
    if (!postData) return;

    // 잉크병 회차만 처리
    if (postData.category !== "magic_inkwell") return;

    const postId = event.params.postId;
    console.log(`[잉크병] 회차 삭제 감지: ${postId} (${postData.episodeTitle || postData.title || ""})`);

    try {
      // collectionGroup('items') + where('postId') 쿼리 — COLLECTION_GROUP 인덱스 필요
      const notificationsSnap = await db
        .collectionGroup("items")
        .where("postId", "==", postId)
        .get();

      if (notificationsSnap.empty) {
        console.log(`[잉크병] ${postId}: 관련 알림 없음`);
        return;
      }

      let deletedCount = 0;
      const batch = db.batch();
      notificationsSnap.docs.forEach((doc) => {
        const notifData = doc.data();
        if (notifData.type === "new_episode" || notifData.type === "episode_unlocked") {
          batch.delete(doc.ref);
          deletedCount++;
        }
      });

      if (deletedCount === 0) {
        console.log(`[잉크병] ${postId}: 잉크병 관련 알림 없음 (다른 타입은 보존)`);
        return;
      }

      await batch.commit();
      console.log(`[잉크병] ${postId}: 고아 알림 ${deletedCount}개 정리 완료`);
    } catch (err) {
      // ⚠️ throw 금지 — 무한 재시도 방지
      console.error(`[잉크병] ${postId} 알림 cleanup 실패:`, err);
    }
  }
);
