// functions/naverAuth.js — 🟢 Sprint 8 네이버 OAuth Custom Token 브릿지
//
// 🚀 기능명: naverAuthCustomToken (Authorization Code Flow + state)
//   Firebase Auth는 네이버 비지원 → Custom Token 루트.
//   네이버는 JS SDK 없이 window.location.href로 OAuth 페이지 이동 → ?code= 복귀.
//
// 플로우:
//   클라가 nid.naver.com/oauth2.0/authorize로 redirect (state 생성·저장) →
//   유저 로그인 후 우리 사이트 /?code=AUTHCODE&state=STATE 로 복귀 →
//   App.tsx가 state 일치 검증 후 이 CF 호출 →
//     1) POST https://nid.naver.com/oauth2.0/token (code+state → access_token)
//     2) GET  https://openapi.naver.com/v1/nid/me (access_token → 유저 정보)
//     3) 결정적 Firebase UID `naver_{naver_id}` 생성
//     4) users/{uid} 존재 여부로 isNewUser 판정
//     5) intent 불일치 시 HttpsError 차단 (Google·Kakao 경로와 동형)
//     6) 신규면 users/{uid} 생성 (client listener 경쟁 방지)
//     7) admin.auth().createCustomToken(uid) 발급 → 클라 signInWithCustomToken
//
// 🔒 보안:
//   - NAVER_CLIENT_ID / NAVER_CLIENT_SECRET: Firebase Secret Manager
//   - state: CSRF 방어용 랜덤 문자열. 클라가 세션에 저장하고 복귀 시 대조. CF도 네이버 요청에 state 동봉.
//   - code는 1회성·위조 불가
//
// 📝 UID 전략:
//   naver_{naver_id} — Google·Kakao와 충돌 없음. 같은 사람이 여럿 쓰면 별 계정 (Sprint 9+ linking 이월).

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");

const db = getFirestore();

// 🔐 Secret Manager 파라미터
//   NAVER_CLIENT_ID: 네이버 개발자 센터 > 애플리케이션 > 내 애플리케이션 > 개요 > Client ID
//   NAVER_CLIENT_SECRET: 같은 페이지 > Client Secret
const NAVER_CLIENT_ID = defineSecret("NAVER_CLIENT_ID");
const NAVER_CLIENT_SECRET = defineSecret("NAVER_CLIENT_SECRET");

// 네이버 OAuth 엔드포인트
const NAVER_TOKEN_URL = "https://nid.naver.com/oauth2.0/token";
const NAVER_USER_ME_URL = "https://openapi.naver.com/v1/nid/me";

exports.naverAuthCustomToken = onCall(
  {
    region: "asia-northeast3",
    timeoutSeconds: 30,
    memory: "256MiB",
    secrets: [NAVER_CLIENT_ID, NAVER_CLIENT_SECRET],
  },
  async (request) => {
    const { code, state, intent } = request.data || {};

    // 입력 검증
    if (typeof code !== "string" || code.length < 10) {
      throw new HttpsError("invalid-argument", "유효한 authorization code가 필요합니다.");
    }
    if (typeof state !== "string" || state.length < 8) {
      throw new HttpsError("invalid-argument", "유효한 state 값이 필요합니다.");
    }
    // 🔒 2026-04-24 intent 유실 시 보수적 기본값 'login' 적용.
    // Why: sessionStorage 유실로 'either'가 되면 CF가 신규 계정을 말없이 생성하는 버그 있었음.
    //      'login' 기본값 → 계정 없으면 명시적 404, 가입은 반드시 'signup' 클릭 필요.
    const safeIntent = intent === "login" || intent === "signup" ? intent : "login";

    const clientId = NAVER_CLIENT_ID.value();
    const clientSecret = NAVER_CLIENT_SECRET.value();

    // 1) code → access_token 교환
    let accessToken;
    try {
      const body = new URLSearchParams({
        grant_type: "authorization_code",
        client_id: clientId,
        client_secret: clientSecret,
        code,
        state,
      });

      const tokenResp = await fetch(NAVER_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
        body: body.toString(),
        signal: AbortSignal.timeout(10_000),
      });

      if (!tokenResp.ok) {
        const errText = await tokenResp.text().catch(() => "");
        console.warn(`[naverAuth] /oauth2.0/token HTTP ${tokenResp.status}: ${errText.slice(0, 300)}`);
        throw new HttpsError(
          "unauthenticated",
          "네이버 토큰 발급에 실패했습니다. 다시 로그인해 주세요."
        );
      }
      const tokenJson = await tokenResp.json();
      // 네이버는 200 OK여도 body에 error 필드로 실패 반환하는 케이스 있음
      if (tokenJson?.error) {
        console.warn(`[naverAuth] token error: ${tokenJson.error} / ${tokenJson.error_description || ""}`);
        throw new HttpsError("unauthenticated", "네이버 토큰 발급에 실패했습니다.");
      }
      accessToken = tokenJson?.access_token;
      if (typeof accessToken !== "string" || accessToken.length < 10) {
        throw new HttpsError("internal", "네이버 토큰 응답이 비어있습니다.");
      }
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      console.error("[naverAuth] 토큰 교환 실패:", err);
      throw new HttpsError("unavailable", "네이버 서버 통신에 실패했습니다.");
    }

    // 2) access_token → 네이버 사용자 정보 조회
    let naverUser;
    try {
      const meResp = await fetch(NAVER_USER_ME_URL, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        signal: AbortSignal.timeout(10_000),
      });
      if (!meResp.ok) {
        const errText = await meResp.text().catch(() => "");
        console.warn(`[naverAuth] /v1/nid/me HTTP ${meResp.status}: ${errText.slice(0, 200)}`);
        throw new HttpsError("unauthenticated", "네이버 계정 확인에 실패했습니다.");
      }
      const meJson = await meResp.json();
      if (meJson?.resultcode !== "00") {
        console.warn(`[naverAuth] /me resultcode=${meJson?.resultcode} message=${meJson?.message}`);
        throw new HttpsError("unauthenticated", "네이버 계정 확인에 실패했습니다.");
      }
      naverUser = meJson?.response;
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      console.error("[naverAuth] 사용자 정보 조회 실패:", err);
      throw new HttpsError("unavailable", "네이버 서버 통신에 실패했습니다.");
    }

    const naverId = naverUser?.id;
    if (typeof naverId !== "string" || naverId.length < 4) {
      throw new HttpsError("internal", "네이버 응답에서 사용자 ID를 찾지 못했습니다.");
    }

    const uid = `naver_${naverId}`;
    // 동의 항목에 따라 값이 비어 있을 수 있음 — 빈 문자열 기본값
    const naverEmail = typeof naverUser?.email === "string" ? naverUser.email : "";
    const naverNickname =
      (typeof naverUser?.nickname === "string" && naverUser.nickname) ||
      (typeof naverUser?.name === "string" && naverUser.name) ||
      "";

    // 3) users/{uid} 조회 → isNewUser 판정
    const userRef = db.collection("users").doc(uid);
    const snap = await userRef.get();
    const exists = snap.exists;

    // 4) intent 검증 (Google·Kakao 경로와 동형)
    if (safeIntent === "login" && !exists) {
      throw new HttpsError(
        "not-found",
        "등록된 계정이 없어요.\n\n처음이시라면 \"회원가입\" 버튼을 눌러 주세요."
      );
    }
    if (safeIntent === "signup" && exists) {
      throw new HttpsError(
        "already-exists",
        "이미 가입된 계정이에요.\n\n\"로그인\" 버튼을 눌러 주세요."
      );
    }

    // 5) 신규 유저면 users/{uid} 생성 (client listener 경쟁 방지)
    if (!exists) {
      const initialData = {
        nickname: naverNickname || "",
        email: naverEmail,
        bio: "안녕하세요.",
        level: 1,
        exp: 0,
        likes: 0,
        points: 0,
        subscriberCount: 0,
        isPhoneVerified: false,
        phoneVerified: false,
        nicknameSet: false,
        friendList: [],
        blockList: [],
        avatarUrl: "",
        // 🚪 Sprint 7.5 — 가입 직후 온보딩 게이트 전부 통과 필요
        onboardingCompleted: false,
        // 🟢 Naver 제공자 흔적 — 향후 account linking·지표 분석용
        provider: "naver",
        naverId: String(naverId),
        createdAt: FieldValue.serverTimestamp(),
      };
      await userRef.set(initialData);
    }

    // 6) Custom Token 발급
    let customToken;
    try {
      customToken = await getAuth().createCustomToken(uid);
    } catch (err) {
      console.error("[naverAuth] createCustomToken 실패:", err);
      throw new HttpsError("internal", "인증 토큰 발급에 실패했습니다.");
    }

    return {
      customToken,
      isNewUser: !exists,
      uid,
    };
  }
);
