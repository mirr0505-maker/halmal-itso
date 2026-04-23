// functions/userCode.js — 🆔 Sprint 7.5 고유번호 발급 시스템
//
// 🚀 구성:
//   generateUserCode — users/{uid} onCreate 트리거 (8자리 영숫자 난수, 충돌 재시도)
//
// 🆔 UserCode vs ReferralCode
//   referralCode (6자리): 타인이 나를 초대할 때 사용 (1회성 redeem)
//   userCode     (8자리): 타인이 언제든 나를 참조하는 영구 불변 ID (친구 추가·소환·신고 등)
//
// 역조회 컬렉션: `user_codes/{code}` → { uid, assignedAt } — O(1) 유저 검색 지원

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");

const db = getFirestore();

// ⚠️ src/constants.ts USER_CODE_CONFIG와 동기화 필수
const CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // 32자 (0/O/I/1 제외)
const LENGTH = 8;
const COLLISION_RETRY = 5;
const LENGTH_FALLBACK = 10;

function randomCode(length) {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += CHARSET.charAt(Math.floor(Math.random() * CHARSET.length));
  }
  return code;
}

// ─────────────────────────────────────────────────────────────────────────────
// generateUserCode — users/{uid} onCreate 트리거
//   충돌 재시도 5회 후 10자리로 확장. users 문서의 userCode 이미 있으면 skip(수동 주입 테스트 허용).
//   referral_codes의 generateReferralCode와 독립 병렬 실행 (서로 경합 없음 — 서로 다른 필드).
// ─────────────────────────────────────────────────────────────────────────────
exports.generateUserCode = onDocumentCreated(
  {
    document: "users/{uid}",
    region: "asia-northeast3",
  },
  async (event) => {
    const uid = event.params.uid;
    const userData = event.data?.data();
    if (!userData) {
      console.warn(`[generateUserCode] no data for ${uid}`);
      return;
    }
    if (userData.userCode) {
      return; // 이미 발급됨 (수동 주입 또는 재트리거)
    }

    let assignedCode = null;
    for (let attempt = 0; attempt < COLLISION_RETRY + 1; attempt++) {
      const length = attempt < COLLISION_RETRY ? LENGTH : LENGTH_FALLBACK;
      const candidate = randomCode(length);
      const ref = db.collection("user_codes").doc(candidate);
      try {
        await db.runTransaction(async (tx) => {
          const snap = await tx.get(ref);
          if (snap.exists) {
            throw new Error("COLLISION");
          }
          tx.set(ref, {
            code: candidate,
            uid,
            assignedAt: Timestamp.now(),
          });
        });
        assignedCode = candidate;
        break;
      } catch (e) {
        if (e.message !== "COLLISION") {
          console.error(`[generateUserCode] tx error for ${uid}:`, e.message);
        }
      }
    }

    if (!assignedCode) {
      console.error(`[generateUserCode] failed to assign code for ${uid} after retries`);
      return;
    }

    await db.collection("users").doc(uid).update({
      userCode: assignedCode,
    });
    console.log(`[generateUserCode] uid=${uid} userCode=${assignedCode}`);
  }
);
