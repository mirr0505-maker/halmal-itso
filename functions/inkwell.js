// functions/inkwell.js — 마르지 않는 잉크병 (연재 시스템)
// 🚀 unlockEpisode: 유료 회차 결제 (땡스볼 차감 → 작가 지급 → 영수증 생성)
// 🚀 createEpisode: 회차 생성 (서버측 episodeNumber 결정 — 레이스 컨디션 방지)
// 🚀 onEpisodeCreate: 새 회차 발행 시 구독자 알림 (카운터 증가는 createEpisode 트랜잭션이 담당)
// 🚀 onInkwellPostDelete: 회차 삭제 시 관련 알림 + unlocked_episodes cleanup
// 🔒 클라이언트에서 ballBalance·unlocked_episodes 직접 수정 차단됨 → Admin SDK로 처리
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated, onDocumentDeleted } = require("firebase-functions/v2/firestore");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const { buildExpLevelUpdate } = require("./utils/levelSync");

const db = getFirestore();

// 🚀 플랫폼 수수료율 — 유료 회차 결제 시 작가 지급액에서 차감
// 변경 시 이 값만 수정 후 재배포 (예: 0.15 = 15%). Math.floor 내림 적용으로 작가 손실 최소화.
const PLATFORM_FEE_RATE = 0.11;

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

      const buyerData = buyerSnap.data();
      const currentBalance = buyerData.ballBalance || 0;
      if (currentBalance < price) {
        throw new HttpsError("failed-precondition", "땡스볼이 부족합니다.");
      }

      // 🚀 플랫폼 수수료 분배 계산 — 작가 손실 최소화를 위해 수수료는 내림 처리
      const platformFee = Math.floor(price * PLATFORM_FEE_RATE);
      const authorRevenue = price - platformFee;

      // 구매자: 잔액 차감 + 누적 지출 + EXP +2 (level 동시 쓰기 — 옵션 B)
      tx.update(buyerRef, {
        ballBalance: currentBalance - price,
        ballSpent: FieldValue.increment(price),
        ...buildExpLevelUpdate(FieldValue, buyerData.exp, 2),
      });

      // 작가: ballReceived 누적 (수수료 차감 후 순수익)
      tx.set(authorRef, {
        ballReceived: FieldValue.increment(authorRevenue),
      }, { merge: true });

      // 플랫폼 수수료 누적 — 추후 정산·세무 대비 (단일 문서)
      const platformRevenueRef = db.collection("platform_revenue").doc("inkwell");
      tx.set(platformRevenueRef, {
        totalFee: FieldValue.increment(platformFee),
        totalGross: FieldValue.increment(price),
        lastUpdatedAt: Timestamp.now(),
      }, { merge: true });

      // 영수증 생성 — paidAmount는 총액, 수수료 분배 내역 함께 기록 (감사 추적)
      tx.set(unlockedRef, {
        userId: buyerUid,
        postId: postId,
        seriesId: post.seriesId,
        authorId: post.author_id,
        paidAmount: price,
        platformFee,
        authorRevenue,
        feeRate: PLATFORM_FEE_RATE,
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

      // 3. series 문서 조회 (알림 메시지용 — 카운터 증가는 createEpisode 트랜잭션이 담당)
      const seriesRef = db.collection("series").doc(seriesId);
      const seriesSnap = await seriesRef.get();
      if (!seriesSnap.exists) {
        console.warn(`[잉크병] series 문서 없음: ${seriesId} (postId=${postId})`);
        return;
      }
      const series = seriesSnap.data();
      const episodeNumber = postData.episodeNumber;

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

    // 🖋️ series.totalEpisodes 차감 — 작품 정보에 표시되는 회차 수 동기화
    if (postData.seriesId) {
      try {
        await db.collection("series").doc(postData.seriesId).update({
          totalEpisodes: FieldValue.increment(-1),
        });
      } catch (err) {
        console.error(`[잉크병] ${postId} totalEpisodes 차감 실패:`, err);
      }
    }

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

      if (deletedCount > 0) {
        await batch.commit();
        console.log(`[잉크병] ${postId}: 고아 알림 ${deletedCount}개 정리 완료`);
      } else {
        console.log(`[잉크병] ${postId}: 잉크병 관련 알림 없음 (다른 타입은 보존)`);
      }

      // 🖋️ 추가 cleanup: unlocked_episodes 영수증 (해당 회차 구매 내역)
      // 작품 자체가 삭제되거나 회차가 영구 삭제되는 경우 구매자 영수증도 함께 정리
      // ⚠️ where('postId') 단일 필드 — 자동 인덱스 사용
      try {
        const unlockedSnap = await db
          .collection("unlocked_episodes")
          .where("postId", "==", postId)
          .get();
        if (!unlockedSnap.empty) {
          const unlockedBatch = db.batch();
          unlockedSnap.docs.forEach((doc) => unlockedBatch.delete(doc.ref));
          await unlockedBatch.commit();
          console.log(`[잉크병] ${postId}: 구매 영수증 ${unlockedSnap.size}건 정리 완료`);
        }
      } catch (err) {
        console.error(`[잉크병] ${postId} unlocked_episodes cleanup 실패:`, err);
      }
    } catch (err) {
      // ⚠️ throw 금지 — 무한 재시도 방지
      console.error(`[잉크병] ${postId} 알림 cleanup 실패:`, err);
    }
  }
);

// ════════════════════════════════════════════════════════════
// 🚀 createEpisode — 회차 생성 (onCall v2, 서버측 episodeNumber 결정)
// ════════════════════════════════════════════════════════════
// 역할: 클라이언트가 episodeNumber를 직접 계산할 때 발생하는 레이스 컨디션·중복 생성 방지
// 트랜잭션 순서:
//   ① series 문서 read + 작가 본인 검증
//   ② episodeNumber = (series.totalEpisodes || 0) + 1 로 결정
//   ③ isPaid/price 자동 판정 (freeEpisodeLimit + defaultPrice 기준) — 클라이언트 override도 허용
//   ④ posts 문서 생성 (content = 유료면 빈 문자열, 무료면 전체 HTML)
//   ⑤ 유료면 posts/{id}/private_data/content 서브문서에 본문 분리 저장
//   ⑥ series.totalEpisodes +1 + lastEpisodeAt/updatedAt 갱신
// ⚠️ onEpisodeCreate 트리거는 이 함수가 완료된 후 자동 실행되어 구독자 알림만 발송 (카운터 중복 증가 안 함)
exports.createEpisode = onCall(
  { region: "asia-northeast3" },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
    const authorUid = request.auth.uid;
    // 닉네임 조회 — users/{uid}.nickname 우선, Auth token.name 폴백
    // (Auth display name이 비어있으면 "익명"으로 저장되던 버그 수정)
    const authorSnapForName = await db.collection("users").doc(authorUid).get();
    const authorNickname = authorSnapForName.data()?.nickname || request.auth.token?.name || "익명";

    const {
      seriesId,
      episodeTitle,
      content,
      authorNote,
      isPaidOverride, // null/undefined면 자동 판정
      customPrice,    // null/undefined면 series.defaultPrice
    } = request.data || {};

    // 입력 검증
    if (typeof seriesId !== "string" || !seriesId.trim()) {
      throw new HttpsError("invalid-argument", "seriesId가 필요합니다.");
    }
    if (typeof episodeTitle !== "string" || !episodeTitle.trim()) {
      throw new HttpsError("invalid-argument", "회차 제목이 필요합니다.");
    }
    if (typeof content !== "string" || !content.trim() || content === "<p></p>") {
      throw new HttpsError("invalid-argument", "본문이 필요합니다.");
    }

    // 미리보기 텍스트 평문 200자 추출 (HTML 태그 제거)
    const previewText = content.replace(/<[^>]+>/g, "").trim().slice(0, 200);

    // 🔒 트랜잭션: series 읽기 → episodeNumber 결정 → post 생성 → 카운터 증가 (원자적)
    // 실제 posts에서 max(episodeNumber) 조회 — 삭제된 회차 번호는 건너뛰기
    // (totalEpisodes 카운터만 사용하면 삭제 시 카운터 차감 후 번호 재사용으로 영수증 충돌 발생 가능)
    const existingSnap = await db.collection("posts")
      .where("category", "==", "magic_inkwell")
      .where("seriesId", "==", seriesId)
      .orderBy("episodeNumber", "desc")
      .limit(1)
      .get();
    const maxEpisodeNumber = existingSnap.empty ? 0 : (existingSnap.docs[0].data().episodeNumber || 0);
    const episodeNumberFromPosts = maxEpisodeNumber + 1;

    const newPostId = await db.runTransaction(async (tx) => {
      const seriesRef = db.collection("series").doc(seriesId);
      const seriesSnap = await tx.get(seriesRef);
      if (!seriesSnap.exists) {
        throw new HttpsError("not-found", "작품을 찾을 수 없습니다.");
      }
      const series = seriesSnap.data();

      // 작가 본인 검증
      if (series.authorId !== authorUid) {
        throw new HttpsError("permission-denied", "작품의 작가만 회차를 작성할 수 있습니다.");
      }

      // episodeNumber — 트랜잭션 밖 조회값 사용 (max+1)
      const episodeNumber = episodeNumberFromPosts;

      // 유료/무료 자동 판정
      const freeLimit = series.freeEpisodeLimit || 0;
      const defaultPrice = series.defaultPrice || 0;
      let willBePaid;
      if (isPaidOverride === true || isPaidOverride === false) {
        willBePaid = isPaidOverride;
      } else {
        willBePaid = episodeNumber > freeLimit && defaultPrice > 0;
      }
      const finalPrice = willBePaid
        ? (typeof customPrice === "number" && customPrice > 0 ? customPrice : defaultPrice)
        : 0;

      if (willBePaid && finalPrice <= 0) {
        throw new HttpsError("invalid-argument", "유료 회차의 가격은 1볼 이상이어야 합니다.");
      }

      // 🚀 postId 생성 (클라이언트 규칙과 동일)
      const timestamp = Date.now();
      const postId = `topic_${timestamp}_${authorUid}`;
      const postRef = db.collection("posts").doc(postId);

      // posts 문서 생성 — 유료는 content 빈 문자열, 무료는 HTML 그대로
      tx.set(postRef, {
        id: postId,
        author: authorNickname,
        author_id: authorUid,
        category: "magic_inkwell",
        title: `${series.title} - ${episodeNumber}화`,
        episodeTitle: episodeTitle.trim(),
        episodeNumber,
        seriesId,
        isPaid: willBePaid,
        price: finalPrice,
        previewContent: willBePaid ? previewText : null,
        content: willBePaid ? "" : content,
        authorNote: (authorNote || "").trim() || null,
        likes: 0,
        likedBy: [],
        commentCount: 0,
        viewCount: 0,
        thanksballTotal: 0,
        side: "left",
        type: "comment",
        parentId: null,
        rootId: null,
        createdAt: FieldValue.serverTimestamp(),
      });

      // 유료 회차: private_data/content 서브문서에 본문 분리 저장
      if (willBePaid) {
        const privateRef = postRef.collection("private_data").doc("content");
        tx.set(privateRef, { body: content, images: [] });
      }

      // series 카운터 증가 — 트랜잭션 원자적 처리
      tx.update(seriesRef, {
        totalEpisodes: FieldValue.increment(1),
        lastEpisodeAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      return postId;
    });

    return { success: true, postId: newPostId };
  }
);
