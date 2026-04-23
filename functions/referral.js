// functions/referral.js — 📱 Sprint 7 추천코드 시스템 (Step 7-C/D/E)
//
// 🚀 구성:
//   generateReferralCode         — users/{uid} onCreate 트리거 (자동 6자리 코드 발급)
//   redeemReferralCode           — onCall (검증 + pending ReferralUseDoc 생성 + 자동 맞깐부 ±2 EXP)
//   confirmReferralActivations   — 매일 03:00 KST (7일 활성 판정 → confirmed/expired)
//
// 🛡️ Step 7-F revokeReferralUse는 PHONE_HASH_SALT 의존 격리를 위해 referralRevoke.js로 분리
//
// 참조 설계: REFERRAL_V1.md §2·§3

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const { calculateLevel, buildExpLevelUpdate } = require("./utils/levelSync");
// 📱 Sprint 7 Step 7-E — IP/Device fingerprint 악용 방어
const { PHONE_HASH_SALT } = require("./utils/phoneHash");
const { extractClientIp, hashSubnet, hashFullIp } = require("./utils/ipHash");

const db = getFirestore();

// ─────────────────────────────────────────────────────────────────────────────
// 상수 — ⚠️ src/constants.ts REFERRAL_CONFIG와 동기화 필수
// ─────────────────────────────────────────────────────────────────────────────
const CODE_CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // 32자 (0/O/I/1 제외)
const CODE_LENGTH = 6;
const CODE_COLLISION_RETRY = 5;
const CODE_LENGTH_FALLBACK = 8; // 충돌 5회 후 확장
const MIN_REFERRER_LEVEL = 2;
const MONTHLY_CAP = 10;
const TOTAL_CAP = 30; // 베타 — pending + confirmed 합산
const PENDING_DAYS = 7;
const MUTUAL_KANBU_EXP_DELTA = 2; // toggleKanbu 표준 delta (LevelSystem.md §4.2)
const WELCOME_EXP_REFEREE = 5; // 피추천자 Welcome (활성화 확정 시)
const REWARD_EXP_REFERRER = 10; // 추천자 보상 (활성화 확정 시)
const ACTIVATION_MIN_POSTS = 1; // 활성 기준 — 글 1개+ OR 댓글 3개+ (잠정, project_referral_activation_tuning.md)
const ACTIVATION_MIN_COMMENTS = 3;
// 🛡️ Step 7-E 악용 방어 임계값 (REFERRAL_V1.md §8, 잠정 — project_referral_abuse_tuning.md)
const SAME_SUBNET_WINDOW_MS = 24 * 60 * 60 * 1000; // 24시간
const SAME_SUBNET_THRESHOLD = 3; // 동일 /24 subnet 3+ redeem → same_ip_cluster
const SAME_SUBNET_EXTRA_DAYS = 14; // 활성화 대기 +14d 연장
const RAPID_REDEEM_WINDOW_MS = 60 * 60 * 1000; // 1시간
const RAPID_REDEEM_THRESHOLD = 5; // 동일 추천자 코드 1h 내 5+ redeem → rapid_redeem (관리자 검토)

// ─────────────────────────────────────────────────────────────────────────────
// 유틸
// ─────────────────────────────────────────────────────────────────────────────
function randomCode(length) {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += CODE_CHARSET.charAt(Math.floor(Math.random() * CODE_CHARSET.length));
  }
  return code;
}

function monthKey(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. generateReferralCode — users/{uid} onCreate 트리거
// ─────────────────────────────────────────────────────────────────────────────
exports.generateReferralCode = onDocumentCreated(
  {
    document: "users/{uid}",
    region: "asia-northeast3",
  },
  async (event) => {
    const uid = event.params.uid;
    const userData = event.data?.data();
    if (!userData) {
      console.warn(`[generateReferralCode] no data for ${uid}`);
      return;
    }
    if (userData.referralCode) {
      // 이미 발급됨 (테스트 계정 create 경로 등에서 수동 주입된 경우)
      return;
    }

    // 🔄 충돌 5회 재시도 후 실패 시 8자리로 확장
    let assignedCode = null;
    for (let attempt = 0; attempt < CODE_COLLISION_RETRY + 1; attempt++) {
      const length = attempt < CODE_COLLISION_RETRY ? CODE_LENGTH : CODE_LENGTH_FALLBACK;
      const candidate = randomCode(length);
      const ref = db.collection("referral_codes").doc(candidate);
      try {
        // 트랜잭션으로 exists 검사 + create 동시 수행 (race 차단)
        await db.runTransaction(async (tx) => {
          const snap = await tx.get(ref);
          if (snap.exists) {
            throw new Error("COLLISION");
          }
          tx.set(ref, {
            code: candidate,
            ownerUid: uid,
            ownerNickname: userData.nickname || "",
            createdAt: Timestamp.now(),
            totalRedemptions: 0,
            isDisabled: false,
          });
        });
        assignedCode = candidate;
        break;
      } catch (e) {
        if (e.message !== "COLLISION") {
          console.error(`[generateReferralCode] tx error for ${uid}:`, e.message);
        }
        // 충돌 시 다음 시도
      }
    }

    if (!assignedCode) {
      console.error(`[generateReferralCode] failed to assign code for ${uid} after retries`);
      return;
    }

    // users.referralCode 저장
    await db.collection("users").doc(uid).update({
      referralCode: assignedCode,
    });
    console.log(`[generateReferralCode] uid=${uid} code=${assignedCode}`);
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// 2. redeemReferralCode — onCall
// ─────────────────────────────────────────────────────────────────────────────
exports.redeemReferralCode = onCall(
  { region: "asia-northeast3", secrets: [PHONE_HASH_SALT] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
    }
    const redeemerUid = request.auth.uid;

    const rawCode = request.data?.code;
    if (typeof rawCode !== "string") {
      throw new HttpsError("invalid-argument", "추천코드가 유효하지 않습니다.");
    }
    const code = rawCode.trim().toUpperCase();
    if (code.length < CODE_LENGTH || code.length > CODE_LENGTH_FALLBACK) {
      throw new HttpsError("invalid-argument", "추천코드 길이가 올바르지 않습니다.");
    }
    if (!/^[A-Z0-9]+$/.test(code)) {
      throw new HttpsError("invalid-argument", "추천코드 형식이 올바르지 않습니다.");
    }

    // 🛡️ phoneHash 재사용 차단은 트랜잭션 외부에서 선조회 (쿼리는 tx 내부 금지)
    //    Why: runTransaction 내부에서 get(collection.where()) 불가. 외부 선검사 후 tx 내부 재검증.
    const redeemerUserSnap = await db.collection("users").doc(redeemerUid).get();
    if (!redeemerUserSnap.exists) {
      throw new HttpsError("not-found", "사용자 문서가 없습니다.");
    }
    const redeemerData = redeemerUserSnap.data();
    if (redeemerData.phoneVerified !== true || !redeemerData.phoneHash) {
      throw new HttpsError("failed-precondition", "휴대폰 인증이 먼저 필요합니다.");
    }
    if (redeemerData.referredByCode) {
      throw new HttpsError("already-exists", "이미 추천코드를 사용했습니다 (1인 1회).");
    }
    const redeemerPhoneHash = redeemerData.phoneHash;

    // 동일 phoneHash로 이미 redeem된 use 문서 존재 여부 쿼리
    const dupUseSnap = await db
      .collection("referral_uses")
      .where("redeemerPhoneHash", "==", redeemerPhoneHash)
      .limit(1)
      .get();
    if (!dupUseSnap.empty) {
      throw new HttpsError(
        "already-exists",
        "이 번호로는 이미 추천코드가 사용되었습니다."
      );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 🛡️ Step 7-E — IP/Device fingerprint 악용 방어 시그널 수집 + pre-tx 감지
    //    설계: REFERRAL_V1.md §8
    //    Why pre-tx: Firestore 트랜잭션 내부는 where() 쿼리 금지 → 트랜잭션 밖 선조회 후
    //                tx 내부는 use 문서 set 시 수집 필드만 반영.
    // ─────────────────────────────────────────────────────────────────────────
    const rawIp = extractClientIp(request.rawRequest);
    const redeemerIpHash = hashFullIp(rawIp || "");
    const redeemerSubnetHash = hashSubnet(rawIp || "");
    const rawDeviceFp = request.data?.deviceFingerprint;
    const redeemerDeviceFingerprint =
      typeof rawDeviceFp === "string" && rawDeviceFp.length > 0 && rawDeviceFp.length <= 128
        ? rawDeviceFp
        : "";

    const suspicionFlags = [];

    // 감지 1 — 동일 deviceFingerprint 매치 → 즉시 차단
    //   Firebase Installations ID는 브라우저/앱 단위 고유 → 악용 시 가장 강한 시그널.
    //   빈 문자열 fingerprint는 시그널 무력 (구형 브라우저·SDK 실패 케이스 허용).
    if (redeemerDeviceFingerprint) {
      const deviceDupSnap = await db
        .collection("referral_uses")
        .where("redeemerDeviceFingerprint", "==", redeemerDeviceFingerprint)
        .limit(1)
        .get();
      if (!deviceDupSnap.empty) {
        console.warn(
          `[redeemReferralCode] device_fingerprint_match uid=${redeemerUid} fp=${redeemerDeviceFingerprint.slice(0, 8)}...`
        );
        throw new HttpsError(
          "already-exists",
          "이 기기에서는 이미 추천코드가 사용되었습니다."
        );
      }
    }

    // 감지 2 — 24h 내 동일 /24 subnet 3+ redeem → same_ip_cluster 플래그 + 활성화 +14d 연장
    //   /24 마스킹 = ISP CGNAT·가정망 수준 격리 (같은 사람 여러 계정 vs 공유 네트워크 정상 가입 분리)
    let confirmDaysExtended = 0;
    if (redeemerSubnetHash) {
      const windowStart = Timestamp.fromMillis(Date.now() - SAME_SUBNET_WINDOW_MS);
      const subnetSnap = await db
        .collection("referral_uses")
        .where("redeemerSubnetHash", "==", redeemerSubnetHash)
        .where("redeemedAt", ">=", windowStart)
        .limit(SAME_SUBNET_THRESHOLD)
        .get();
      if (subnetSnap.size >= SAME_SUBNET_THRESHOLD) {
        suspicionFlags.push("same_ip_cluster");
        confirmDaysExtended = SAME_SUBNET_EXTRA_DAYS;
        console.warn(
          `[redeemReferralCode] same_ip_cluster uid=${redeemerUid} count=${subnetSnap.size}`
        );
      }
    }

    // 감지 3 — 1h 내 동일 코드 5+ redeem → rapid_redeem 플래그 + audit_anomalies 기록
    //   자동 차단 안 함 (인플루언서 대량 유입 정상 케이스 보호). 관리자 수동 검토 전제.
    const rapidWindowStart = Timestamp.fromMillis(Date.now() - RAPID_REDEEM_WINDOW_MS);
    const rapidSnap = await db
      .collection("referral_uses")
      .where("codeId", "==", code)
      .where("redeemedAt", ">=", rapidWindowStart)
      .limit(RAPID_REDEEM_THRESHOLD)
      .get();
    let rapidRedeemDetected = false;
    if (rapidSnap.size >= RAPID_REDEEM_THRESHOLD) {
      suspicionFlags.push("rapid_redeem");
      rapidRedeemDetected = true;
      console.warn(
        `[redeemReferralCode] rapid_redeem code=${code} count=${rapidSnap.size}`
      );
    }

    const codeRef = db.collection("referral_codes").doc(code);

    // 🛡️ Step 7-E: tx 내부에서 ownerUid를 외부 클로저에 보존 (클라 응답 노출 차단 + audit 기록용).
    //    응답 객체에 codeOwnerUid를 담으면 임의의 코드로 유저 UID 역추적 가능 → 보안 취약.
    let resolvedOwnerUid = null;

    const result = await db.runTransaction(async (tx) => {
      // ── 1. 코드 검증
      const codeSnap = await tx.get(codeRef);
      if (!codeSnap.exists) {
        throw new HttpsError("not-found", "존재하지 않는 추천코드입니다.");
      }
      const codeData = codeSnap.data();
      if (codeData.isDisabled) {
        throw new HttpsError("permission-denied", "사용할 수 없는 추천코드입니다.");
      }
      const ownerUid = codeData.ownerUid;
      if (ownerUid === redeemerUid) {
        throw new HttpsError("invalid-argument", "본인 코드는 사용할 수 없습니다.");
      }

      // ── 2. 추천자(owner) 문서 tx.get — 레벨 Gate + Rate Limit
      const ownerRef = db.collection("users").doc(ownerUid);
      const ownerSnap = await tx.get(ownerRef);
      if (!ownerSnap.exists) {
        throw new HttpsError("not-found", "추천인 계정이 없습니다.");
      }
      const owner = ownerSnap.data();

      if ((owner.level || 1) < MIN_REFERRER_LEVEL) {
        throw new HttpsError(
          "failed-precondition",
          `추천인이 Lv${MIN_REFERRER_LEVEL} 이상이어야 합니다.`
        );
      }

      // ── 3. 월 롤오버 + Rate Limit (MONTHLY_CAP)
      const now = new Date();
      const currentMonthKey = monthKey(now);
      const sameMonth = owner.referralMonthKey === currentMonthKey;
      const monthlyCount = sameMonth ? (owner.referralMonthlyCount || 0) : 0;
      if (monthlyCount >= MONTHLY_CAP) {
        throw new HttpsError(
          "resource-exhausted",
          `추천인이 이번 달 한도(${MONTHLY_CAP}명)를 초과했습니다.`
        );
      }

      // ── 4. 총 상한 (pending + confirmed)
      const pending = owner.referralPendingCount || 0;
      const confirmed = owner.referralConfirmedCount || 0;
      if (pending + confirmed >= TOTAL_CAP) {
        throw new HttpsError(
          "resource-exhausted",
          `추천인이 상한(${TOTAL_CAP}명)에 도달했습니다.`
        );
      }

      // ── 5. 피추천자 문서 tx.get — 재검증 (선쿼리와 원자성 확보)
      const redeemerRef = db.collection("users").doc(redeemerUid);
      const redeemerSnapTx = await tx.get(redeemerRef);
      const redeemerTx = redeemerSnapTx.data();
      if (redeemerTx.referredByCode) {
        throw new HttpsError("already-exists", "이미 추천코드를 사용했습니다 (tx 재검증).");
      }

      // ── 6. ReferralUseDoc 생성 (status='pending')
      const useId = `${code}_${redeemerUid}`;
      const useRef = db.collection("referral_uses").doc(useId);
      const nowTs = Timestamp.now();
      // 🛡️ Step 7-E: same_ip_cluster 감지 시 활성화 대기 +14d 연장
      const totalPendingDays = PENDING_DAYS + confirmDaysExtended;
      const confirmTargetMs = now.getTime() + totalPendingDays * 24 * 60 * 60 * 1000;
      tx.set(useRef, {
        codeId: code,
        codeOwnerUid: ownerUid,
        redeemerUid,
        redeemedAt: nowTs,
        status: "pending",
        confirmTargetAt: Timestamp.fromMillis(confirmTargetMs),
        redeemerPhoneHash,
        redeemerIpHash, // 🛡️ Step 7-E — 전체 IP 해시 (보조 시그널)
        redeemerSubnetHash, // 🛡️ Step 7-E — /24 subnet 해시 (클러스터 감지)
        redeemerDeviceFingerprint, // 🛡️ Step 7-E — Firebase Installations ID
        suspicionFlags, // 🛡️ Step 7-E — ['same_ip_cluster', 'rapid_redeem'] 감지 결과
      });

      // ── 7. 추천자 갱신 — pending+1, 월 롤오버, lastRedeemedAt
      tx.update(ownerRef, {
        referralPendingCount: FieldValue.increment(1),
        referralMonthKey: currentMonthKey,
        referralMonthlyCount: sameMonth ? FieldValue.increment(1) : 1,
      });
      tx.update(codeRef, {
        lastRedeemedAt: nowTs,
      });

      // ── 8. 피추천자 갱신 — referredByCode/Uid 저장
      tx.update(redeemerRef, {
        referredByCode: code,
        referredByUid: ownerUid,
      });

      // ── 9. 자동 맞깐부 (§3.5) — 양방향 friendList + 각 +2 EXP
      //    이미 한쪽이 맺어두면 skip (멱등)
      const ownerFriends = Array.isArray(owner.friendList) ? owner.friendList : [];
      const redeemerFriends = Array.isArray(redeemerTx.friendList) ? redeemerTx.friendList : [];
      let mutualKanbuEstablished = false;

      if (redeemerTx.nickname && !ownerFriends.includes(redeemerTx.nickname)) {
        tx.update(ownerRef, {
          friendList: [...ownerFriends, redeemerTx.nickname],
          exp: FieldValue.increment(MUTUAL_KANBU_EXP_DELTA),
          level: calculateLevel((owner.exp || 0) + MUTUAL_KANBU_EXP_DELTA),
        });
        mutualKanbuEstablished = true;
      }
      if (owner.nickname && !redeemerFriends.includes(owner.nickname)) {
        tx.update(redeemerRef, {
          friendList: [...redeemerFriends, owner.nickname],
          exp: FieldValue.increment(MUTUAL_KANBU_EXP_DELTA),
          level: calculateLevel((redeemerTx.exp || 0) + MUTUAL_KANBU_EXP_DELTA),
        });
        mutualKanbuEstablished = true;
      }

      // 🛡️ Step 7-E: ownerUid는 외부 클로저에 저장 (클라 응답에는 포함하지 않음 — UID 노출 방지)
      resolvedOwnerUid = ownerUid;

      return {
        ok: true,
        codeOwnerNickname: codeData.ownerNickname || owner.nickname || "",
        mutualKanbuEstablished,
      };
    });

    // 🛡️ Step 7-E: rapid_redeem 감지 시 관리자 검토 큐(audit_anomalies) 기록
    //    Why tx 외부: audit는 실패해도 본 redeem에 영향 없어야 함 (fire-and-forget).
    //    Sprint 4 패턴 재사용 (ballAudit.js) — {yyyyMMdd}_{targetUid}_{ts}_{rand} 문서 ID
    if (rapidRedeemDetected) {
      try {
        const now = new Date();
        const ymd = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}`;
        const rand = Math.random().toString(36).slice(2, 8);
        const auditId = `${ymd}_${result.codeOwnerNickname || "unknown"}_${Date.now()}_${rand}`;
        await db.collection("audit_anomalies").doc(auditId).set({
          type: "referral_rapid_redeem",
          severity: "warning",
          codeId: code,
          codeOwnerUid: resolvedOwnerUid || null,
          codeOwnerNickname: result.codeOwnerNickname || "",
          triggeredByRedeemer: redeemerUid,
          windowMs: RAPID_REDEEM_WINDOW_MS,
          threshold: RAPID_REDEEM_THRESHOLD,
          detectedAt: Timestamp.now(),
          reviewed: false,
        });
      } catch (e) {
        console.error(`[redeemReferralCode] audit write fail: ${e.message}`);
      }
    }

    console.log(
      `[redeemReferralCode] ok redeemer=${redeemerUid} code=${code} mutual=${result.mutualKanbuEstablished} flags=[${suspicionFlags.join(",")}]`
    );
    return result;
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// 3. confirmReferralActivations — 매일 03:00 KST 스케줄
//    pending 상태 referral_uses 중 confirmTargetAt 도래한 것 → 활성 판정 → confirmed/expired
//    활성 기준 (잠정): 7일간 글 1+ OR 댓글 3+
//    Why: activity_logs 30일 TTL 윈도우에서 redeemedAt~now 7일 구간 집계.
//         reputationCache(04:45)·creatorScoreCache(05:00)와 시간대 분리 (03:00).
// ─────────────────────────────────────────────────────────────────────────────
exports.confirmReferralActivations = onSchedule(
  {
    schedule: "0 3 * * *",
    timeZone: "Asia/Seoul",
    region: "asia-northeast3",
    timeoutSeconds: 540,
    memory: "512MiB",
  },
  async () => {
    const now = Timestamp.now();
    const pendingSnap = await db
      .collection("referral_uses")
      .where("status", "==", "pending")
      .where("confirmTargetAt", "<=", now)
      .get();

    console.log(`[confirmReferralActivations] pending due: ${pendingSnap.size}`);

    let confirmed = 0;
    let expired = 0;
    let errored = 0;

    for (const useDoc of pendingSnap.docs) {
      try {
        await processOneReferralUse(useDoc);
        const after = (await useDoc.ref.get()).data();
        if (after?.status === "confirmed") confirmed++;
        else if (after?.status === "expired") expired++;
      } catch (e) {
        errored++;
        console.error(
          `[confirmReferralActivations] error useId=${useDoc.id}: ${e.message}`
        );
      }
    }

    console.log(
      `[confirmReferralActivations] done confirmed=${confirmed} expired=${expired} errored=${errored}`
    );
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// processOneReferralUse — 단일 ReferralUseDoc 활성화 판정 + 상태 전이
//   분리 이유: 트랜잭션 단위를 1건으로 좁혀 부분 실패 격리
// ─────────────────────────────────────────────────────────────────────────────
async function processOneReferralUse(useDoc) {
  const use = useDoc.data();
  const redeemerUid = use.redeemerUid;
  const ownerUid = use.codeOwnerUid;
  const redeemedAtMs = use.redeemedAt?.toMillis?.() || Date.now() - 7 * 24 * 3600 * 1000;
  const windowStart = Timestamp.fromMillis(redeemedAtMs);

  // redeemer의 7일간 활동 집계 — activity_logs에서 post·comment만 카운트
  const activitySnap = await db
    .collection("activity_logs")
    .where("uid", "==", redeemerUid)
    .where("createdAt", ">=", windowStart)
    .get();

  let posts = 0;
  let comments = 0;
  for (const d of activitySnap.docs) {
    const t = d.data().type;
    if (t === "post") posts++;
    else if (t === "comment") comments++;
  }

  const isActive = posts >= ACTIVATION_MIN_POSTS || comments >= ACTIVATION_MIN_COMMENTS;

  const ownerRef = db.collection("users").doc(ownerUid);
  const redeemerRef = db.collection("users").doc(redeemerUid);
  const codeRef = db.collection("referral_codes").doc(use.codeId);

  await db.runTransaction(async (tx) => {
    // tx 내 재검증 — 이미 다른 경로에서 처리됐을 가능성 차단
    const useSnap = await tx.get(useDoc.ref);
    if (!useSnap.exists) return;
    const cur = useSnap.data();
    if (cur.status !== "pending") return;

    const ownerSnap = await tx.get(ownerRef);
    const redeemerSnap = await tx.get(redeemerRef);
    if (!ownerSnap.exists || !redeemerSnap.exists) {
      // 계정 소실 — expired 처리만
      tx.update(useDoc.ref, {
        status: "expired",
        resolvedAt: Timestamp.now(),
        resolveReason: "account_missing",
      });
      return;
    }

    if (isActive) {
      // ── 활성 확정 → 양방향 EXP 지급
      const owner = ownerSnap.data();
      const redeemer = redeemerSnap.data();

      tx.update(ownerRef, {
        ...buildExpLevelUpdate(FieldValue, owner.exp || 0, REWARD_EXP_REFERRER),
        referralPendingCount: FieldValue.increment(-1),
        referralConfirmedCount: FieldValue.increment(1),
      });
      tx.update(redeemerRef, {
        ...buildExpLevelUpdate(FieldValue, redeemer.exp || 0, WELCOME_EXP_REFEREE),
      });
      tx.update(codeRef, {
        totalRedemptions: FieldValue.increment(1),
      });
      tx.update(useDoc.ref, {
        status: "confirmed",
        resolvedAt: Timestamp.now(),
        activityPosts: posts,
        activityComments: comments,
      });
    } else {
      // ── 7일 활성 실패 → expired (보상 없음, pending-1)
      tx.update(ownerRef, {
        referralPendingCount: FieldValue.increment(-1),
      });
      tx.update(useDoc.ref, {
        status: "expired",
        resolvedAt: Timestamp.now(),
        resolveReason: "inactive",
        activityPosts: posts,
        activityComments: comments,
      });
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. revokeReferralUse — 🛡️ Step 7-F 관리자 무효화
//    → functions/referralRevoke.js로 분리 (PHONE_HASH_SALT 의존 격리 · 방법 2)
// ─────────────────────────────────────────────────────────────────────────────
