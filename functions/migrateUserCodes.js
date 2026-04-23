// functions/migrateUserCodes.js — 🆔 Sprint 7.5 기존 유저 userCode 일괄 부여 (1회 수동 실행)
//
// 🚀 목적:
//   Sprint 7.5 배포 직후, generateUserCode 트리거는 신규 가입자에게만 적용됨.
//   기존 유저 전체 userCode 미보유 상태 → 이 CF를 1회 수동 실행해 일괄 부여.
//
// 🔒 관리자 전용 — assertAdmin 통과 + admin_actions 감사 로그
// 🎯 배치: 100명씩 처리, 충돌 재시도 포함. 중단 재실행 시 이미 userCode 있는 유저는 skip (멱등).

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const { assertAdmin } = require("./utils/adminAuth");
const { logAdminAction } = require("./adminAudit");

const db = getFirestore();

const CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const LENGTH = 8;
const COLLISION_RETRY = 5;
const LENGTH_FALLBACK = 10;
const BATCH_SIZE = 100;

function randomCode(length) {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += CHARSET.charAt(Math.floor(Math.random() * CHARSET.length));
  }
  return code;
}

// 단일 유저 userCode 부여 — generateUserCode와 동일 로직
async function assignOne(uid) {
  for (let attempt = 0; attempt < COLLISION_RETRY + 1; attempt++) {
    const length = attempt < COLLISION_RETRY ? LENGTH : LENGTH_FALLBACK;
    const candidate = randomCode(length);
    const ref = db.collection("user_codes").doc(candidate);
    try {
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (snap.exists) throw new Error("COLLISION");
        tx.set(ref, { code: candidate, uid, assignedAt: Timestamp.now() });
      });
      await db.collection("users").doc(uid).update({ userCode: candidate });
      return candidate;
    } catch (e) {
      if (e.message !== "COLLISION") throw e;
    }
  }
  throw new Error(`Failed to assign userCode for ${uid} after retries`);
}

exports.migrateUserCodes = onCall(
  {
    region: "asia-northeast3",
    timeoutSeconds: 540,
    memory: "1GiB",
  },
  async (request) => {
    const { adminUid, adminName, viaClaims } = await assertAdmin(request.auth);

    const startTs = Date.now();
    // userCode 미보유 유저만 쿼리 (==null 필터는 Firestore 미지원 → 전체 조회 후 필터)
    //   대안: 전체 users 조회 + 배치 처리. 유저 규모 ~1만 명 수준까진 안전.
    //   10만+ 스케일이면 cursor 페이징 필요 (이 CF 확장 시)
    const snap = await db.collection("users").get();
    const targets = snap.docs.filter((d) => !d.data().userCode);

    let assigned = 0;
    let errored = 0;
    const errorUids = [];

    for (let i = 0; i < targets.length; i += BATCH_SIZE) {
      const batch = targets.slice(i, i + BATCH_SIZE);
      // 병렬 처리 but 개별 실패는 계속 진행
      const results = await Promise.allSettled(batch.map((d) => assignOne(d.id)));
      results.forEach((r, idx) => {
        if (r.status === "fulfilled") {
          assigned++;
        } else {
          errored++;
          errorUids.push(batch[idx].id);
          console.error(`[migrateUserCodes] fail uid=${batch[idx].id}: ${r.reason?.message || r.reason}`);
        }
      });
    }

    const durationMs = Date.now() - startTs;
    console.log(
      `[migrateUserCodes] total=${targets.length} assigned=${assigned} errored=${errored} durationMs=${durationMs}`
    );

    await logAdminAction({
      action: "migrate_user_codes",
      adminUid,
      adminName,
      viaClaims,
      targetUid: null,
      payload: {
        scannedTotalUsers: snap.size,
        targetMissingUserCode: targets.length,
        assigned,
        errored,
        errorUids: errorUids.slice(0, 50),
        durationMs,
      },
      reason: "기존 유저 userCode 일괄 부여 (Sprint 7.5 마이그레이션)",
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
