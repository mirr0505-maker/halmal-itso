// functions/phoneAuth.js — 📱 Sprint 7 Step 7-A 휴대폰 인증 서버 검증
//
// 🚀 기능명: verifyPhoneServer
//   클라이언트가 PhoneAuthProvider.linkWithPhoneNumber로 Firebase Auth 계정에 전화번호 연결 완료 후 호출.
//   서버가 Admin SDK로 Auth record에서 phoneNumber를 읽어 E.164 정규화 → SHA-256 해시 → banned_phones
//   매칭 확인 → 통과 시 users 문서에 phoneVerified/phoneHash/phoneVerifiedAt 저장.
//
// Why 서버 검증:
//   클라이언트가 phoneNumber를 임의 문자열로 CF에 보내면 원본 번호 위조 가능 →
//   Admin SDK로 Auth record의 실제 phoneNumber를 읽어야 신뢰 가능.
//   linkWithPhoneNumber는 SMS OTP 확인 후에만 Auth record에 박히므로 실제 소유 보장.

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const { PHONE_HASH_SALT, normalizeE164, hashPhone } = require("./utils/phoneHash");

const db = getFirestore();

exports.verifyPhoneServer = onCall(
  {
    region: "asia-northeast3",
    secrets: [PHONE_HASH_SALT],
  },
  async (request) => {
    // 1. 인증 확인
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
    }
    const uid = request.auth.uid;

    // 2. Auth record에서 실제 전화번호 읽기 (클라 위조 차단)
    let authUser;
    try {
      authUser = await getAuth().getUser(uid);
    } catch (e) {
      console.error(`[verifyPhoneServer] getUser failed for ${uid}:`, e.message);
      throw new HttpsError("not-found", "Auth 계정을 찾을 수 없습니다.");
    }

    const rawPhone = authUser.phoneNumber;
    if (!rawPhone) {
      // linkWithPhoneNumber 미완료 — 클라에서 SMS 인증 플로우 먼저 실행해야 함
      throw new HttpsError(
        "failed-precondition",
        "Firebase Auth 계정에 전화번호가 연결되지 않았습니다. linkWithPhoneNumber를 먼저 완료하세요.",
      );
    }

    // 3. E.164 정규화 + 해시 (Auth record의 phoneNumber는 이미 E.164지만 안전하게 한번 더)
    let e164;
    let phoneHash;
    try {
      e164 = normalizeE164(rawPhone);
      phoneHash = hashPhone(e164);
    } catch (e) {
      console.error(`[verifyPhoneServer] hash failed for ${uid}:`, e.message);
      throw new HttpsError("internal", "전화번호 처리 실패");
    }

    // 4. 🏚️ banned_phones 재진입 차단 — 사약 처분된 휴대폰 재가입 막기
    const bannedSnap = await db.collection("banned_phones").doc(phoneHash).get();
    if (bannedSnap.exists) {
      console.warn(`[verifyPhoneServer] banned phone attempted by ${uid}`);
      throw new HttpsError(
        "permission-denied",
        "이 전화번호는 재진입이 차단되었습니다. 문의가 필요하면 관리자에게 연락 주세요.",
      );
    }

    // 5. 다른 유저가 동일 phoneHash로 이미 인증했는지 확인 (다계정 어뷰징 1차 방어)
    //    추천코드 악용 방어 §8과 연결 — 같은 번호로 2계정 생성 차단
    const dupSnap = await db
      .collection("users")
      .where("phoneHash", "==", phoneHash)
      .limit(1)
      .get();
    if (!dupSnap.empty) {
      const ownerUid = dupSnap.docs[0].id;
      if (ownerUid !== uid) {
        console.warn(
          `[verifyPhoneServer] duplicate phone: ${uid} tried to bind phone owned by ${ownerUid}`,
        );
        throw new HttpsError(
          "already-exists",
          "이 전화번호는 이미 다른 계정에 연결되어 있습니다.",
        );
      }
    }

    // 6. users 문서 갱신 (phoneHash는 Rules 차단 필드 — Admin SDK 전용)
    const userRef = db.collection("users").doc(uid);
    await userRef.set(
      {
        phoneVerified: true,
        phoneHash,
        phoneVerifiedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    console.log(`[verifyPhoneServer] ok uid=${uid}`);
    return { ok: true };
  },
);
