// functions/kakaoAuth.js — 🥥 Sprint 8 카카오 OAuth Custom Token 브릿지
//
// 🚀 기능명: kakaoAuthCustomToken (Authorization Code Flow)
//   Firebase Auth는 카카오를 네이티브 지원하지 않음 → Custom Token 루트.
//   Kakao JS SDK v2.x는 팝업 방식을 지원하지 않으므로 redirect flow 전용.
//
// 플로우:
//   클라가 Kakao.Auth.authorize()로 kakao 로그인 페이지 redirect →
//   유저 로그인 후 우리 사이트 /?code=AUTHCODE 로 복귀 →
//   App.tsx가 code 감지 → 이 CF 호출 →
//     1) POST https://kauth.kakao.com/oauth/token (code → access_token 교환)
//     2) GET  https://kapi.kakao.com/v2/user/me (access_token → kakao_id)
//     3) 결정적 Firebase UID `kakao_{kakao_id}` 생성
//     4) users/{uid} 존재 여부로 isNewUser 판정
//     5) intent 불일치 시 HttpsError 차단 (Google 경로와 동형)
//     6) 신규면 users/{uid} 생성 (client listener 경쟁 방지 — signIn 전에 doc 선생성)
//     7) admin.auth().createCustomToken(uid) 발급 → 클라 signInWithCustomToken
//
// 🔒 보안:
//   - KAKAO_REST_KEY: Firebase Secret Manager (배포 시 firebase functions:secrets:set KAKAO_REST_KEY)
//   - KAKAO_CLIENT_SECRET: 선택 (카카오 앱의 Client Secret 활성화 시에만 제공)
//   - code는 1회성 (재사용 차단) + Kakao 서버 발급 (위조 불가)
//   - users/{uid} 생성은 Admin SDK → Rules 우회 (스키마는 useFirebaseListeners initialData와 동일)
//
// 📝 UID 전략:
//   kakao_{kakao_id} — Google 유저(랜덤 UID)와 충돌 없음. 같은 사람이 둘 다 쓰면 별 계정 (Sprint 9+ linking 이월).

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");

const db = getFirestore();

// 🔐 Secret Manager 파라미터
//   KAKAO_REST_KEY: 카카오 개발자 센터 > 앱 설정 > 일반 > REST API 키 (필수)
//   KAKAO_CLIENT_SECRET: 카카오 로그인 > 보안 > Client Secret (선택, 비활성 시 빈 문자열)
const KAKAO_REST_KEY = defineSecret("KAKAO_REST_KEY");
const KAKAO_CLIENT_SECRET = defineSecret("KAKAO_CLIENT_SECRET");

// Kakao OAuth 엔드포인트
const KAKAO_TOKEN_URL = "https://kauth.kakao.com/oauth/token";
const KAKAO_USER_ME_URL = "https://kapi.kakao.com/v2/user/me";

exports.kakaoAuthCustomToken = onCall(
  {
    region: "asia-northeast3",
    timeoutSeconds: 30,
    memory: "256MiB",
    secrets: [KAKAO_REST_KEY, KAKAO_CLIENT_SECRET],
  },
  async (request) => {
    const { code, redirectUri, intent } = request.data || {};

    // 입력 검증
    if (typeof code !== "string" || code.length < 10) {
      throw new HttpsError("invalid-argument", "유효한 authorization code가 필요합니다.");
    }
    if (typeof redirectUri !== "string" || !redirectUri.startsWith("http")) {
      throw new HttpsError("invalid-argument", "유효한 redirect URI가 필요합니다.");
    }
    // 🔒 2026-04-24 intent 유실 시 보수적 기본값 'login' 적용 (naverAuth와 동일 패턴)
    // Why: sessionStorage 유실 등으로 'either'가 되면 CF가 신규 계정을 말없이 생성하는 보안 루프홀
    const safeIntent = intent === "login" || intent === "signup" ? intent : "login";

    const restKey = KAKAO_REST_KEY.value();
    const clientSecret = KAKAO_CLIENT_SECRET.value(); // 비활성 시 빈 문자열

    // 1) code → access_token 교환
    let accessToken;
    try {
      const body = new URLSearchParams({
        grant_type: "authorization_code",
        client_id: restKey,
        redirect_uri: redirectUri,
        code,
      });
      // Client Secret 활성화된 경우에만 포함 — 빈 문자열/공백은 스킵 (카카오가 거부)
      if (clientSecret && clientSecret.trim().length > 0) {
        body.append("client_secret", clientSecret.trim());
      }

      const tokenResp = await fetch(KAKAO_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
        body: body.toString(),
        signal: AbortSignal.timeout(10_000),
      });

      if (!tokenResp.ok) {
        const errText = await tokenResp.text().catch(() => "");
        console.warn(`[kakaoAuth] /oauth/token HTTP ${tokenResp.status}: ${errText.slice(0, 300)}`);
        throw new HttpsError(
          "unauthenticated",
          "카카오 토큰 발급에 실패했습니다. 다시 로그인해 주세요."
        );
      }
      const tokenJson = await tokenResp.json();
      accessToken = tokenJson?.access_token;
      if (typeof accessToken !== "string" || accessToken.length < 10) {
        throw new HttpsError("internal", "카카오 토큰 응답이 비어있습니다.");
      }
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      console.error("[kakaoAuth] 토큰 교환 실패:", err);
      throw new HttpsError("unavailable", "카카오 서버 통신에 실패했습니다.");
    }

    // 2) access_token → Kakao 사용자 정보 조회
    let kakaoUser;
    try {
      const meResp = await fetch(KAKAO_USER_ME_URL, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
        },
        signal: AbortSignal.timeout(10_000),
      });
      if (!meResp.ok) {
        const errText = await meResp.text().catch(() => "");
        console.warn(`[kakaoAuth] /v2/user/me HTTP ${meResp.status}: ${errText.slice(0, 200)}`);
        throw new HttpsError("unauthenticated", "카카오 계정 확인에 실패했습니다.");
      }
      kakaoUser = await meResp.json();
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      console.error("[kakaoAuth] 사용자 정보 조회 실패:", err);
      throw new HttpsError("unavailable", "카카오 서버 통신에 실패했습니다.");
    }

    const kakaoId = kakaoUser?.id;
    if (typeof kakaoId !== "number" && typeof kakaoId !== "string") {
      throw new HttpsError("internal", "카카오 응답에서 사용자 ID를 찾지 못했습니다.");
    }

    const uid = `kakao_${kakaoId}`;
    // 이메일은 비즈 앱 전환 전까지 scope 불가 — 빈 문자열 기본값
    const kakaoEmail = kakaoUser?.kakao_account?.email || "";
    const kakaoNickname =
      kakaoUser?.kakao_account?.profile?.nickname ||
      kakaoUser?.properties?.nickname ||
      "";

    // 3) users/{uid} 조회 → isNewUser 판정
    const userRef = db.collection("users").doc(uid);
    const snap = await userRef.get();
    const exists = snap.exists;

    // 4) intent 검증 (Google 경로와 동형 — useAuthActions.handleLogin 참조)
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
    //    스키마는 useFirebaseListeners.ts의 initialData와 동일 (displayName 대신 kakaoNickname 임시값)
    if (!exists) {
      const initialData = {
        nickname: kakaoNickname || "",
        email: kakaoEmail,
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
        avatarUrl: "", // 프로필 이미지 scope 미요청 (최소 수집)
        // 🚪 Sprint 7.5 — 가입 직후 온보딩 게이트 전부 통과 필요
        onboardingCompleted: false,
        // 🥥 Kakao 제공자 흔적 — 향후 account linking·지표 분석용
        provider: "kakao",
        kakaoId: String(kakaoId),
        createdAt: FieldValue.serverTimestamp(),
      };
      await userRef.set(initialData);
    }

    // 6) Custom Token 발급
    let customToken;
    try {
      customToken = await getAuth().createCustomToken(uid);
    } catch (err) {
      console.error("[kakaoAuth] createCustomToken 실패:", err);
      throw new HttpsError("internal", "인증 토큰 발급에 실패했습니다.");
    }

    return {
      customToken,
      isNewUser: !exists,
      uid,
    };
  }
);
