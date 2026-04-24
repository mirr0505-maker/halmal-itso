// functions/backfillReferralCodes.js — 🎁 Sprint 7 기존 유저 referralCode 일괄 부여 (1회 수동 실행)
//
// 🚀 목적:
//   Sprint 7 배포 시 generateReferralCode는 onCreate 트리거로만 배포됨.
//   트리거 배포 이전에 존재하던 기존 유저(테스트 계정 포함)는 referralCode 미보유 →
//   MyPage 추천 탭 "발급 중입니다" 무한 노출. 이 CF를 1회 수동 실행해 일괄 부여.
//
// 🔒 관리자 전용 — assertAdmin 통과 + admin_actions 감사 로그
// 🎯 멱등 — referralCode 이미 있는 유저는 skip. 중단 재실행 안전.
// 📐 로직 — functions/referral.js generateReferralCode와 동일 (CODE_LENGTH=6, 5회 재시도, 8자리 폴백)

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const { assertAdmin } = require("./utils/adminAuth");
const { logAdminAction } = require("./adminAudit");

const db = getFirestore();

// referral.js와 상수 동기화
const CODE_CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // 32자 (0/O/I/1 제외)
const CODE_LENGTH = 6;
const CODE_COLLISION_RETRY = 5;
const CODE_LENGTH_FALLBACK = 8;
const BATCH_SIZE = 50; // 병렬 처리 단위 (referral_codes 문서 생성 부하 고려, migrateUserCodes보다 작게)

function randomCode(length) {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += CODE_CHARSET.charAt(Math.floor(Math.random() * CODE_CHARSET.length));
  }
  return code;
}

// 단일 유저 referralCode 부여 — generateReferralCode 본체 로직 포트
async function assignOne(uid, nickname) {
  for (let attempt = 0; attempt < CODE_COLLISION_RETRY + 1; attempt++) {
    const length = attempt < CODE_COLLISION_RETRY ? CODE_LENGTH : CODE_LENGTH_FALLBACK;
    const candidate = randomCode(length);
    const ref = db.collection("referral_codes").doc(candidate);
    try {
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (snap.exists) throw new Error("COLLISION");
        tx.set(ref, {
          code: candidate,
          ownerUid: uid,
          ownerNickname: nickname || "",
          createdAt: Timestamp.now(),
          totalRedemptions: 0,
          isDisabled: false,
        });
      });
      await db.collection("users").doc(uid).update({ referralCode: candidate });
      return candidate;
    } catch (e) {
      if (e.message !== "COLLISION") throw e;
    }
  }
  throw new Error(`Failed to assign referralCode for ${uid} after retries`);
}

exports.backfillReferralCodes = onCall(
  {
    region: "asia-northeast3",
    timeoutSeconds: 540,
    memory: "1GiB",
  },
  async (request) => {
    const { adminUid, adminName, viaClaims } = await assertAdmin(request.auth);

    const startTs = Date.now();
    // referralCode 미보유 유저 필터 — Firestore ==null 쿼리 미지원 이유로 전체 조회 후 필터
    const snap = await db.collection("users").get();
    const targets = snap.docs.filter((d) => !d.data().referralCode);

    let assigned = 0;
    let errored = 0;
    const errorUids = [];

    for (let i = 0; i < targets.length; i += BATCH_SIZE) {
      const batch = targets.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((d) => assignOne(d.id, d.data().nickname))
      );
      results.forEach((r, idx) => {
        if (r.status === "fulfilled") {
          assigned++;
        } else {
          errored++;
          errorUids.push(batch[idx].id);
          console.error(
            `[backfillReferralCodes] fail uid=${batch[idx].id}: ${r.reason?.message || r.reason}`
          );
        }
      });
    }

    const durationMs = Date.now() - startTs;
    console.log(
      `[backfillReferralCodes] total=${targets.length} assigned=${assigned} errored=${errored} durationMs=${durationMs}`
    );

    await logAdminAction({
      action: "backfill_referral_codes",
      adminUid,
      adminName,
      viaClaims,
      targetUid: null,
      payload: {
        scannedTotalUsers: snap.size,
        targetMissingReferralCode: targets.length,
        assigned,
        errored,
        errorUids: errorUids.slice(0, 50),
        durationMs,
      },
      reason: "기존 유저 referralCode 일괄 부여 (Sprint 7 백필)",
    });

    return {
      success: true,
      scanned: snap.size,
      target: targets.length,
      assigned,
      errored,
      durationMs,
    };
  }
);
