// functions/gloveBot.js — 🤖 장갑 정보봇 (주식 장갑 전용)
// 🚀 activateInfoBot: 대장(thumb)이 월 20볼 결제 → 30일간 봇 활성화
// 🚀 deactivateInfoBot: 대장이 즉시 중지 (환불 없음)
// 🚀 updateInfoBot: 활성 중 키워드/소스/임계값 수정 (무료)
// 🔒 category === '주식' 장갑에서만 사용 가능 (서버 가드)
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");

const db = getFirestore();

// 🤖 정보봇 월간 이용료 (변경 시 이 값만 수정 후 재배포)
const BOT_MONTHLY_PRICE = 20;
// 🤖 30일 밀리초
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

// ════════════════════════════════════════════════════════════
// 🚀 activateInfoBot — 정보봇 활성화 / 갱신 (대장 전용)
// ════════════════════════════════════════════════════════════
exports.activateInfoBot = onCall(
  { region: "asia-northeast3" },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
    const uid = request.auth.uid;
    // 🔧 nickname 해석은 트랜잭션 내부 userSnap 조회 후로 이동 (token.name은 OAuth 공급자만 자동 채움 — email/pw 계정은 "익명" 폴백 문제)
    const { communityId, keywords, sources, stockCode, corpCode, priceAlertThresholds } = request.data || {};

    // 입력 검증
    if (typeof communityId !== "string" || !communityId.trim()) {
      throw new HttpsError("invalid-argument", "communityId가 필요합니다.");
    }
    if (!Array.isArray(keywords) || keywords.length === 0 || keywords.length > 5) {
      throw new HttpsError("invalid-argument", "키워드는 1~5개 필요합니다.");
    }
    if (!Array.isArray(sources) || sources.length === 0) {
      throw new HttpsError("invalid-argument", "최소 1개 소스를 선택해주세요.");
    }

    const now = Timestamp.now();
    const expiresAt = Timestamp.fromMillis(now.toMillis() + THIRTY_DAYS_MS);

    await db.runTransaction(async (tx) => {
      // 1. 커뮤니티 조회 + 검증
      const communityRef = db.collection("communities").doc(communityId);
      const communitySnap = await tx.get(communityRef);
      if (!communitySnap.exists) {
        throw new HttpsError("not-found", "커뮤니티를 찾을 수 없습니다.");
      }
      const community = communitySnap.data();

      // 주식 카테고리 가드
      if (community.category !== "주식") {
        throw new HttpsError("failed-precondition", "정보봇은 주식 장갑에서만 사용할 수 있습니다.");
      }
      // 대장(개설자) 검증
      if (community.creatorId !== uid) {
        throw new HttpsError("permission-denied", "장갑 대장만 정보봇을 설정할 수 있습니다.");
      }

      // 2. 대장 잔액 확인 + 차감
      const userRef = db.collection("users").doc(uid);
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists) throw new HttpsError("not-found", "사용자를 찾을 수 없습니다.");

      const userData = userSnap.data();
      const balance = userData.ballBalance || 0;
      // 🔧 thanksball 표준 패턴 — users.nickname 우선, token.name 폴백, 최종 "익명"
      const resolvedNickname = userData.nickname || request.auth.token?.name || "익명";
      if (balance < BOT_MONTHLY_PRICE) {
        throw new HttpsError("failed-precondition", `땡스볼이 부족합니다. (필요: ${BOT_MONTHLY_PRICE}볼, 보유: ${balance}볼)`);
      }

      tx.update(userRef, {
        ballBalance: balance - BOT_MONTHLY_PRICE,
        ballSpent: FieldValue.increment(BOT_MONTHLY_PRICE),
      });

      // 2-bis. 감사 원장 — thanksball 표준 스키마 (Sprint 9 Batch 1 2026-04-24)
      // Why: 이전엔 glove_bot_payments 영수증만 있고 ball_transactions 레코드 없어 ballAudit outflow 집계 누락 → false critical 유발
      const txId = `infobot_activation_${communityId}_${Date.now()}`;
      tx.set(db.collection("ball_transactions").doc(txId), {
        schemaVersion: 1,
        senderUid: uid,
        senderNickname: resolvedNickname,
        resolvedRecipientUid: null,  // 플랫폼 sink — outflow만 집계
        amount: BOT_MONTHLY_PRICE,
        balanceBefore: balance,
        balanceAfter: balance - BOT_MONTHLY_PRICE,
        receiverBalanceBefore: null,
        receiverBalanceAfter: null,
        platformFee: BOT_MONTHLY_PRICE,  // 전액 플랫폼 수익 (platform_revenue/glove_bot와 동일 금액)
        sourceType: "infobot_activation",
        details: { communityId, sources, keywords: keywords.map(k => k.trim()).filter(Boolean) },
        createdAt: now,
      });

      // 3. 플랫폼 수익 100% 적립
      const platformRef = db.collection("platform_revenue").doc("glove_bot");
      tx.set(platformRef, {
        totalFee: FieldValue.increment(BOT_MONTHLY_PRICE),
        lastUpdatedAt: now,
      }, { merge: true });

      // 4. 커뮤니티 infoBot 활성화
      const existingTotalPaid = community.infoBot?.totalPaid || 0;
      tx.update(communityRef, {
        infoBot: {
          enabled: true,
          keywords: keywords.map(k => k.trim()).filter(Boolean),
          sources,
          stockCode: stockCode || null,
          corpCode: corpCode || null,
          priceAlertThresholds: priceAlertThresholds || [5, 10, 15, 20, 25, 30],
          activatedAt: now,
          expiresAt,
          activatedBy: uid,
          totalPaid: existingTotalPaid + BOT_MONTHLY_PRICE,
        },
      });

      // 5. 결제 이력 저장
      const paymentId = `${communityId}_${Date.now()}`;
      tx.set(db.collection("glove_bot_payments").doc(paymentId), {
        communityId,
        payerUid: uid,
        payerNickname: resolvedNickname,
        amount: BOT_MONTHLY_PRICE,
        activatedAt: now,
        expiresAt,
        sources,
        keywords: keywords.map(k => k.trim()).filter(Boolean),
      });
    });

    return { success: true, expiresAt: expiresAt.toMillis(), amount: BOT_MONTHLY_PRICE };
  }
);

// ════════════════════════════════════════════════════════════
// 🚀 deactivateInfoBot — 정보봇 즉시 중지 (환불 없음)
// ════════════════════════════════════════════════════════════
exports.deactivateInfoBot = onCall(
  { region: "asia-northeast3" },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
    const uid = request.auth.uid;
    const { communityId } = request.data || {};

    if (typeof communityId !== "string" || !communityId.trim()) {
      throw new HttpsError("invalid-argument", "communityId가 필요합니다.");
    }

    const communityRef = db.collection("communities").doc(communityId);
    const communitySnap = await communityRef.get();
    if (!communitySnap.exists) throw new HttpsError("not-found", "커뮤니티를 찾을 수 없습니다.");
    if (communitySnap.data().creatorId !== uid) {
      throw new HttpsError("permission-denied", "장갑 대장만 정보봇을 중지할 수 있습니다.");
    }

    // enabled만 false로 — 나머지 설정은 보존 (재활성화 시 편의)
    await communityRef.update({ "infoBot.enabled": false });

    return { success: true };
  }
);

// ════════════════════════════════════════════════════════════
// 🚀 updateInfoBot — 활성 중 키워드/소스/임계값 수정 (무료)
// ════════════════════════════════════════════════════════════
exports.updateInfoBot = onCall(
  { region: "asia-northeast3" },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
    const uid = request.auth.uid;
    const { communityId, keywords, sources, stockCode, corpCode, priceAlertThresholds } = request.data || {};

    if (typeof communityId !== "string" || !communityId.trim()) {
      throw new HttpsError("invalid-argument", "communityId가 필요합니다.");
    }

    const communityRef = db.collection("communities").doc(communityId);
    const communitySnap = await communityRef.get();
    if (!communitySnap.exists) throw new HttpsError("not-found", "커뮤니티를 찾을 수 없습니다.");

    const community = communitySnap.data();
    if (community.creatorId !== uid) {
      throw new HttpsError("permission-denied", "장갑 대장만 정보봇을 수정할 수 있습니다.");
    }
    if (!community.infoBot?.enabled) {
      throw new HttpsError("failed-precondition", "정보봇이 활성화되지 않았습니다.");
    }

    // 수정 가능 필드만 업데이트 (activatedAt/expiresAt/totalPaid는 변경 불가)
    const updates = {};
    if (Array.isArray(keywords) && keywords.length > 0 && keywords.length <= 5) {
      updates["infoBot.keywords"] = keywords.map(k => k.trim()).filter(Boolean);
    }
    if (Array.isArray(sources) && sources.length > 0) {
      updates["infoBot.sources"] = sources;
    }
    if (stockCode !== undefined) updates["infoBot.stockCode"] = stockCode || null;
    if (corpCode !== undefined) updates["infoBot.corpCode"] = corpCode || null;
    if (Array.isArray(priceAlertThresholds)) {
      updates["infoBot.priceAlertThresholds"] = priceAlertThresholds;
    }

    if (Object.keys(updates).length === 0) {
      throw new HttpsError("invalid-argument", "수정할 항목이 없습니다.");
    }

    await communityRef.update(updates);
    return { success: true };
  }
);
