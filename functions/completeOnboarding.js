// functions/completeOnboarding.js — 🚪 Sprint 7.5 핫픽스 온보딩 완결 기록
//
// 🚀 구성:
//   completeOnboarding — onCall (유저 본인이 가입 온보딩 마지막 단계에서 호출)
//
// 🔒 정책:
//   - 이미 onboardingCompleted=true면 멱등 no-op (재호출 안전)
//   - nicknameSet=true 필수 (닉네임 미설정 상태로는 완결 불가)
//   - onboardingCompleted / onboardingCompletedAt 두 필드만 기록
//     (추천코드 redeem·전화 인증은 각자 CF에서 분기, 이 CF는 "완결" 시그널만)

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const db = getFirestore();

exports.completeOnboarding = onCall(
  { region: "asia-northeast3" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
    }
    const uid = request.auth.uid;

    const userRef = db.collection("users").doc(uid);
    const snap = await userRef.get();
    if (!snap.exists) {
      throw new HttpsError("not-found", "유저 문서가 없습니다.");
    }
    const user = snap.data();

    // 이미 완결된 유저는 멱등 no-op
    if (user.onboardingCompleted === true) {
      return { ok: true, alreadyCompleted: true };
    }

    // 닉네임 미설정 유저가 게이트 건너뛰는 사고 차단
    if (user.nicknameSet !== true) {
      throw new HttpsError(
        "failed-precondition",
        "닉네임 설정이 완료되지 않았습니다."
      );
    }

    await userRef.update({
      onboardingCompleted: true,
      onboardingCompletedAt: FieldValue.serverTimestamp(),
    });

    return { ok: true, alreadyCompleted: false };
  }
);
