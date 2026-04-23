# 🎟️ 추천코드 시스템 (REFERRAL V1) — 설계서

> **프로젝트**: 할말있소 / 글러브(GeuLove)
> **최종 갱신**: 2026-04-22 (Sprint 7 설계 초안)
> **상태**: 📐 설계 단계 (미배포) — Sprint 7 배포 시 이 문서를 "구현 레퍼런스"로 승격

이 문서는 **Sprint 7 추천코드 + 휴대폰 인증 기능의 단일 진실 소스**다. 추천 보상·악용 방어·휴대폰 인증 정책을 수정할 때 반드시 이 문서와 함께 갱신한다.

**관련 메모리**:
- `project_sprint7_scope.md` — Sprint 7 스코프 확정
- `project_referral_lv20_roadmap.md` — 장기 로드맵 (Lv20 확장 포함)
- `project_sprint8_backlog.md` — 이월 항목 (SNS·카드·Admin Phase C)

---

## 1. 개요

**목적**: 영상→글 전환 유저(유튜버/블로거) 유치를 위한 인플루언서 도구. 추천코드 공유로 신규 유저가 가입하면 추천자에게 EXP 보상.

**3대 축**:
1. **추천코드 발급·검증·보상** — 6자리 영숫자 코드, 가입 시 입력, 7일 활성화 대기 후 +10 EXP/명 확정
2. **휴대폰 인증 인프라** — Firebase PhoneAuthProvider + reCAPTCHA, `phoneHash` 저장, `banned_phones` 재진입 차단
3. **악용 방어** — 동일 기기 차단, Lv2+ 추천자 Gate, 월 10명 Rate Limit, 담합 탐지

**개발 단계 원칙**: 기존 유저 백필 없음. 전체 유저에게 휴대폰 인증 필수 게이트 즉시 적용.

**보상 구조** (양방향):
| 대상 | 보상 | Gate |
|------|-----:|------|
| 추천자 (referrer) | +10 EXP / 명 | Lv2+ 필수 |
| 피추천자 (referee) Welcome | +5 EXP / 1회 | 휴대폰 인증 완료 필수 |
| 자동 맞깐부 | 양쪽 friendList 동시 추가 + 각 +2 EXP (`toggleKanbu` 표준 delta) | redeem 즉시 성립 |

**추천자 상한 차등**:
| 단계 | 상한 |
|------|-----:|
| 베타 (Sprint 7 배포 시) | 30명 / 300 EXP |
| 정식 (Sprint 7 + 1개월 관찰 후) | 50명 / 500 EXP |

**지급 시점**: 양쪽 모두 7일 활성화 확정 후 동시 지급 (피추천자 허수 계정 차단 위해). 미활성화 → 양쪽 모두 미지급.

---

## 2. 데이터 모델

### 2.1 `UserData` 신규 필드

```typescript
interface UserData {
  // --- 휴대폰 인증 ---
  phoneVerified?: boolean;       // 기존 정의 존재 (types.ts) — 실배포는 Sprint 7
  phoneHash?: string;            // SHA-256(E.164 + salt), banned_phones 매치용
  phoneVerifiedAt?: Timestamp;

  // --- 추천코드 ---
  referralCode?: string;         // 본인 코드 (발급 시 생성, 변경 불가)
  referredByCode?: string;       // 가입 시 사용한 타인 코드 (변경 불가)
  referredByUid?: string;        // redeemerUid 역조회 편의
  referralPendingCount?: number; // 대기 중 추천 수 (7일 미경과)
  referralConfirmedCount?: number; // 확정 추천 수 (보상 지급됨)
  referralMonthKey?: string;     // "2026-04" 월 Rate Limit 키
  referralMonthlyCount?: number; // 이번 달 redeem된 횟수
}
```

### 2.2 `referral_codes/{code}` 컬렉션

```typescript
interface ReferralCodeDoc {
  code: string;              // 문서 ID와 동일 (6자리 UPPER, 0/O/I/1 제외)
  ownerUid: string;
  ownerNickname: string;     // 비정규화 (changeNickname 시 갱신 대상 추가)
  createdAt: Timestamp;
  totalRedemptions: number;  // 누적 사용 수 (confirmed 기준)
  lastRedeemedAt?: Timestamp;
  isDisabled?: boolean;      // 관리자 무효화 시 true
  disabledReason?: string;
}
```

### 2.3 `referral_uses/{codeId}_{redeemerUid}` 컬렉션 (멱등 마커)

```typescript
interface ReferralUseDoc {
  codeId: string;              // 사용된 추천코드
  codeOwnerUid: string;
  redeemerUid: string;         // 피추천자
  redeemedAt: Timestamp;
  status: 'pending' | 'confirmed' | 'expired' | 'revoked';
  confirmTargetAt: Timestamp;  // +7d, 이 시점까지 활동 조건 충족 필요
  confirmedAt?: Timestamp;
  expiredAt?: Timestamp;
  revokedAt?: Timestamp;
  revokedReason?: string;

  // 악용 방어 시그널
  redeemerPhoneHash: string;   // 피추천자 phoneHash 사본 — 동일 번호 다계정 재사용 차단 쿼리 전용 (redeemerUid 역조회 대신 O(1) where 매치). users.phoneHash 변경은 설계상 없음(Sprint 7 단방향 저장) → 사본 유효.
  redeemerIpHash: string;      // SHA-256(IP + salt) — Step 7-E에서 활성
  redeemerDeviceFingerprint: string; // Firebase Installation ID — Step 7-E에서 활성
  suspicionFlags?: string[];   // ['same_ip_cluster', 'rapid_redeem', ...] — Step 7-E
}
```

### 2.4 `banned_phones/{phoneHash}` 컬렉션 (기존 — Sprint 7에서 실활용)

```typescript
interface BannedPhoneDoc {
  phoneHash: string;        // 문서 ID와 동일
  bannedAt: Timestamp;
  reason: 'sayak' | 'manual' | 'abuse';
  sanctionId?: string;      // 연결된 sanction_log 참조
}
```

---

## 3. 추천코드 플로우

### 3.1 발급 (자동)

모든 신규 유저는 가입 직후 `generateReferralCode` CF가 6자리 코드 자동 발급.
- 형식: `[A-HJ-KM-NP-Z2-9]{6}` (모호문자 0/O/I/1 제외 → 32개 후보)
- 충돌 체크: Firestore `referral_codes/{candidate}` exists 체크 5회 재시도, 실패 시 8자리로 확장
- users.referralCode 동시 쓰기

### 3.2 사용 (가입 시 입력)

신규 유저 가입 플로우:
```
1. Google OAuth 완료
2. 휴대폰 인증 (필수 Gate — phoneVerified=true까지 서비스 진입 차단)
3. 닉네임 설정
4. [선택] 추천코드 입력 (6자리)
5. redeemReferralCode CF 호출
   - referral_codes/{code} 존재 + isDisabled=false + ownerUid.level >= 2 검증
   - self-redeem 차단 (ownerUid === redeemerUid)
   - 이미 referredByCode 있으면 차단 (1인 1회)
   - 동일 phoneHash가 이미 redeem 했으면 차단
   - 추천자의 referralMonthlyCount < 10 (Rate Limit)
   - 추천자의 referralConfirmedCount < 30 (상한, 베타 기준)
   - ReferralUseDoc 생성 (status='pending', confirmTargetAt=+7d)
   - users.referralPendingCount increment(1) (추천자)
   - users.referredByCode / referredByUid 저장 (피추천자)
   - **자동 맞깐부 즉시 성립** (§3.6 참조) — 양쪽 friendList 동시 추가 + 각 +2 EXP
6. 서비스 진입
```

### 3.3 활성화 확인 (7일 대기)

스케줄 CF `confirmReferralActivations` (매일 03:00 KST):
- `referral_uses` where `status=='pending' AND confirmTargetAt <= now()` 순회
- 피추천자의 7일간 활동 조회:
  - `activity_logs` 30일 윈도우에서 redeemerUid의 post/comment 수 집계
  - **활성 기준**: 글 1개+ OR 댓글 3개+ (잠정, 튜닝 대기 → `project_referral_activation_tuning.md` 신설)
- 조건 충족 → status='confirmed', **양방향 지급** (추천자 +10 EXP, 피추천자 +5 EXP Welcome — buildExpLevelUpdate 둘 다 사용), referralConfirmedCount+1, referralPendingCount-1, totalRedemptions+1
- 조건 미충족 → status='expired', referralPendingCount-1 (양쪽 모두 보상 없음)
- **expired 피추천자는 영구 재진입 불가** (1인 1회 원칙, `referredByCode` 영구 보존). Why: 추천자를 바꿔가며 welcome EXP 재시도하는 어뷰징 차단 + 베타 단계 단순성 우선. 피추천자 UX 보정: 클라이언트에서 `referralStatus === 'expired'` 감지 시 "7일 내 활동 부족으로 추천 활성화 실패 — 본인 가입은 유효, 추천코드만 적용 안 됨" 안내 표시. Sprint 8 이후 데이터 보고 재검토 (`project_referral_activation_tuning.md`에 병기).

### 3.4 무효화 (관리자)

`revokeReferralUse` CF (admin):
- 의심 추천 수동 무효화 → status='revoked'
- 이미 confirmed인 경우 양방향 EXP 회수: 추천자 -10 + 피추천자 -5 (buildExpLevelUpdate 둘 다)
- **맞깐부 관계 해제**: 양쪽 friendList에서 상대 닉네임 제거 + EXP 각 -2 (깐부 해제 delta) — 이미 한쪽이 수동 해제한 경우 skip
- assertAdmin + logAdminAction(action='revoke_referral_use', payload에 맞깐부 해제 여부 포함)
- **롤백 화이트리스트 추가 확정**: `functions/adminAudit.js` `rollbackAdminAction`의 허용 action 목록에 `revoke_referral_use` 편입 (Sprint 6 기존 4종 → 5종으로 확장). 롤백 시 status='confirmed' 복원 + EXP 재지급 + 맞깐부 재맺기

**사약 처분 시 추천자 코드 자동 비활성화**: `functions/storehouse.js executeSayak`에 2줄 추가 —
- 본인 `referral_codes/{target.referralCode}` 문서 `isDisabled: true` + `disabledReason: 'sayak'` + `disabledAt` 세팅 (신규 redeem 차단)
- 🚨 Why: 사약 이후에도 코드 자체는 DB에 남아 타인이 redeem 시도 가능 → `redeemReferralCode` CF의 `isDisabled=false` 검증에서 자연 차단
- 이미 confirmed인 기존 피추천자는 건드리지 않음 (관계 증거 보존). 맞깐부는 `friendList: arrayRemove(target.nickname)` 역참조에서 자연 정리됨 (기존 [storehouse.js:386-392](functions/storehouse.js#L386-L392))
- 피추천자 welcome EXP는 회수하지 않음 (피추천자 귀책 없음, 사약자 제재만으로 충분)

### 3.5 자동 맞깐부 (양방향 friendList 동시 추가)

**배경 근거**: `project_referral_lv20_roadmap.md` "자동 깐부+EXP 보상이 필수". 추천자가 코드를 공유한 행위 = 암묵적 양방향 동의로 간주.

**구현** — `redeemReferralCode` CF의 트랜잭션 내부에서 즉시 실행:
```js
// ⚠️ referrer/referee는 반드시 tx.get() 스냅샷을 써야 함
//    일반 get()로 읽으면 트랜잭션 커밋 사이 다른 writer가 exp를 바꿀 경우
//    calculateLevel(referrer.exp + 2)가 stale 값으로 계산되어 level/exp 불일치
const referrerSnap = await tx.get(referrerRef);
const refereeSnap = await tx.get(refereeRef);
const referrer = referrerSnap.data();
const referee = refereeSnap.data();

// 양쪽 users 문서 동시 업데이트 (tx 내부)
const referrerFriends = Array.isArray(referrer.friendList) ? referrer.friendList : [];
const refereeFriends = Array.isArray(referee.friendList) ? referee.friendList : [];

// 이미 관계 있으면 skip (멱등)
if (!referrerFriends.includes(referee.nickname)) {
  tx.update(referrerRef, {
    friendList: [...referrerFriends, referee.nickname],
    exp: increment(2),  // 표준 toggleKanbu delta
    level: calculateLevel(referrer.exp + 2),
  });
}
if (!refereeFriends.includes(referrer.nickname)) {
  tx.update(refereeRef, {
    friendList: [...refereeFriends, referrer.nickname],
    exp: increment(2),
    level: calculateLevel(referee.exp + 2),
  });
}
```

**정책**:
- **성립 시점**: redeem 즉시 (pending 단계부터). 가입 직후 깐부방·피드에서 만날 수 있어야 UX 생동감
- **expired 시 처리**: 깐부 관계 **유지** (사용자 수동 해제 가능). 자동 해제는 UX 혼란만 유발
- **revoke 시 처리**: 깐부 관계 **해제** — 관리자가 명백한 어뷰징 판정한 경우만 (§3.4 참조). 양쪽 friendList에서 제거 + EXP -2 회수
- **쿨다운 면제**: `toggleKanbu`의 5초 쿨다운은 적용 안 함 (CF 내부 쓰기, 유저 클릭 경로 아님). `lastFriendToggleAt`도 건드리지 않음
- **중복 방지**: 이미 friendList에 있는 경우 skip (피추천자가 가입 전 수동으로 맺은 경우 등)
- **맞깐부 판정**: 양쪽 friendList에 서로 포함 → 기존 `utils.ts:279` 맞깐부 판정 로직 자연 충족 → 🤝 배지 자동 표시

**EXP 지급 합계** (정상 플로우 confirmed 기준):
- 추천자: +2 (깐부 즉시) + +10 (활성화 확정) = **+12 EXP**
- 피추천자: +2 (깐부 즉시) + +5 (Welcome 확정) = **+7 EXP**

### 3.6 공유 링크 패턴 (`/r/:code`)

**선택 배경**: AirBnB·Notion·Dropbox 업계 표준 path 방식. 카카오톡/인스타그램/X 공유 시 OG 카드에 "◯◯님이 초대했어요 - 글러브 GeuLove"가 떠서 수락률 우위.

**구현**:
- URL 포맷: `https://geulove.com/r/{CODE}` (6자리 UPPER)
- ogRenderer CF에 `/r/:code` 라우트 추가 → `referral_codes/{code}` read → OG 메타에 `ownerNickname` 반영
  - 미존재/disabled 코드 → 기본 OG 메타로 폴백 (깨지지 않음)
- 클라 진입 시 `sessionStorage.setItem('pendingReferralCode', code)` → 가입 플로우 4단계에서 자동 채움
- 이미 로그인 된 유저가 `/r/:code` 접근 시 → 홈으로 redirect + "이미 가입된 계정" 토스트 (self-redeem 시도 차단 UX)
- 신규 가입자가 `pendingReferralCode` 를 해제(clear)한 뒤에도 직접 코드 수동 입력 가능

---

## 4. 휴대폰 인증 인프라

### 4.1 클라이언트 플로우

```
PhoneVerifyScreen.tsx
├─ 국가코드 선택 (+82 기본, 확장 대비)
├─ 번호 입력 → E.164 포맷 변환 ('+821012345678')
├─ reCAPTCHA v3 invisible verifier
├─ signInWithPhoneNumber (Firebase) → verificationId
├─ 6자리 SMS 코드 입력
├─ PhoneAuthProvider.credential(verificationId, code)
├─ linkWithCredential (Google 계정과 연결)
└─ verifyPhoneServer CF 호출
    - E.164 번호 → phoneHash 생성 (서버 salt 사용)
    - banned_phones/{phoneHash} exists 체크 → 있으면 HttpsError('permission-denied', '재진입 차단')
    - users.phoneVerified=true, phoneHash, phoneVerifiedAt 저장
```

### 4.2 서버 helper

`functions/utils/phoneHash.js`:
```js
const crypto = require('crypto');
const { defineSecret } = require('firebase-functions/params');
const PHONE_SALT = defineSecret('PHONE_HASH_SALT'); // Secret Manager

function hashPhone(e164Number) {
  return crypto.createHash('sha256')
    .update(e164Number + PHONE_SALT.value())
    .digest('hex');
}
```

### 4.3 banned_phones 기록 경로

- `executeSayak` CF (storehouse.js) — 사약 시 `banned_phones/{phoneHash}` 기록 추가 (**Sprint 7에서 실연결**)
- 관리자 수동 밴 — `adminBanPhone` CF 신설 (Sprint 8 이월 가능)

---

## 5. Firestore Rules

```
// referral_codes: 코드 lookup은 가입 시 필요 → read 공개
match /referral_codes/{code} {
  allow read: if true;
  allow write: if false;  // CF 전용
}

// referral_uses: 본인 관련 문서만 read
match /referral_uses/{useId} {
  allow read: if request.auth.uid == resource.data.codeOwnerUid
              || request.auth.uid == resource.data.redeemerUid;
  allow write: if false;  // CF 전용
}

// banned_phones: 전면 차단 (Admin SDK만)
match /banned_phones/{phoneHash} {
  allow read: if false;
  allow write: if false;
}

// users 신규 필드 차단 추가
match /users/{uid} {
  allow update: if request.auth.uid == uid
    && !request.resource.data.diff(resource.data).affectedKeys()
        .hasAny(['phoneVerified', 'phoneHash', 'phoneVerifiedAt',
                 'referralCode', 'referredByCode', 'referredByUid',
                 'referralPendingCount', 'referralConfirmedCount',
                 'referralMonthKey', 'referralMonthlyCount']);
}
```

---

## 6. 파일 매트릭스 (Sprint 7 배포 대상)

| 역할 | 클라이언트 (TS) | 서버 (CF / JS) |
|------|-----------------|----------------|
| 휴대폰 인증 UI | `src/components/PhoneVerifyScreen.tsx` (신규) | `functions/phoneAuth.js` `verifyPhoneServer` |
| 추천코드 입력 UI | `src/components/ReferralCodeInput.tsx` (신규, 가입 플로우 편입) | `functions/referral.js` `redeemReferralCode` |
| 내 추천 현황 | `src/components/MyReferralPanel.tsx` (신규, MyPage 탭) | `functions/referral.js` `generateReferralCode` |
| 활성화 스케줄 | — | `functions/referral.js` `confirmReferralActivations` (매일 03:00 KST) |
| 관리자 무효화 | `src/components/admin/ReferralAuditPanel.tsx` (신규) | `functions/referral.js` `revokeReferralUse` |
| 롤백 화이트리스트 | — | `functions/adminAudit.js` `rollbackAdminAction` ACTION_WHITELIST에 `revoke_referral_use` 추가 |
| OG 공유 링크 | — | `functions/ogRenderer.js` `/r/:code` 라우트 추가 |
| 해시 유틸 | — | `functions/utils/phoneHash.js` (신규) |
| 상수 | `src/constants.ts` `REFERRAL_CONFIG` (신규) | `functions/utils/referralConfig.js` (동기화 미러) |

**동기화 필수**: `REFERRAL_CONFIG` (상한/1인 보상/활성화 기준) 클라 + 서버 2곳 수정해야 함.

---

## 7. 구현 단계 (Step 7-A ~ 7-F)

| Step | 내용 | 배포 단위 |
|---:|------|----------|
| **7-A** | 휴대폰 인증 인프라 (PhoneAuthProvider + reCAPTCHA + `phoneHash` 유틸 + Rules) | rules + functions |
| **7-B** | 회원가입 플로우에 휴대폰 인증 필수 게이트 편입 | hosting |
| **7-C** | 추천코드 스키마 + `generateReferralCode` / `redeemReferralCode` CF (자동 맞깐부 포함) + Rules | functions + rules |
| **7-D** | 추천코드 UI (가입 시 입력 + MyPage 내 코드 공유/통계) + `confirmReferralActivations` 스케줄 + ogRenderer `/r/:code` 라우트 | hosting + functions |
| **7-E** | 악용 방어 — IP/fingerprint 차단, Lv2+ Gate, 월 10명 Rate Limit, 의심 시그널 플래깅 | functions |
| **7-F** | 관리자 패널 (`referral_uses` 조회 + `revokeReferralUse` CF + admin_actions 감사 로그 + `rollbackAdminAction` 화이트리스트 확장) | hosting + functions |

**배포 순서**: 7-A → 7-B → 7-C → 7-D → 7-E → 7-F. 개발 중이므로 기존 유저 배려 유예 기간 없음.

---

## 8. 악용 방어 정책 (Step 7-E 상세)

| 시그널 | 감지 | 처분 |
|--------|------|------|
| self-redeem | ownerUid === redeemerUid | HttpsError 즉시 차단 |
| 중복 redeem | users.referredByCode 존재 | HttpsError 즉시 차단 |
| 동일 phoneHash 재사용 | `referral_uses` where phoneHash match | HttpsError 즉시 차단 |
| 추천자 Lv1 | 추천자 level < 2 | HttpsError 즉시 차단 |
| 월 10명 초과 | referralMonthlyCount >= 10 | HttpsError 'quota-exceeded' |
| 상한 30명 초과 | referralConfirmedCount >= 30 | HttpsError 'quota-exceeded' (Pending 포함) |
| 동일 IP subnet 클러스터 | 24h 내 동일 /24 subnet 3+ redeem | `suspicionFlags: ['same_ip_cluster']`, 활성화 대기 +14d 연장 |
| 동일 device fingerprint | Firebase Installation ID 매치 | 즉시 차단 |
| 급속 redeem | 동일 추천자 코드 1h 내 5+ redeem | `suspicionFlags: ['rapid_redeem']`, 관리자 검토 큐 |

---

## 9. 연계 시스템

| 시스템 | 연결점 | 문서 |
|--------|--------|------|
| 📈 레벨 | 추천자 Lv2+ Gate, 보상 EXP +10/+5/+2×2 → buildExpLevelUpdate (4회 호출) | [LevelSystem.md](./LevelSystem.md) |
| 🤝 깐부 | 자동 맞깐부 즉시 성립 (friendList 양방향 동시 추가) — `toggleKanbu` 경로 재사용 안 하고 redeem CF 내부 인라인. 쿨다운·클라 토글 모두 면제 | KANBU.md / `functions/toggleKanbu.js` 패턴 참조 |
| 🏚️ 유배·사약 | 사약 시 `banned_phones` 기록 (재가입 차단) | [STOREHOUSE.md](./STOREHOUSE.md) |
| 🏅 Creator Score | 활성화 기준 판정에 `activity_logs` 30일 윈도우 재사용 | [CreatorScore.md](./CreatorScore.md) |
| 🛡️ Admin | `revokeReferralUse`는 assertAdmin + logAdminAction. `rollbackAdminAction` 화이트리스트에 `revoke_referral_use` 편입 (Sprint 6 기존 4종 → 5종) | `project_sprint6_deploy_checklist.md` |

---

## 10. 변경 시 체크리스트

추천코드 정책·활성화 기준·상한·Rate Limit을 수정할 때:

1. `src/constants.ts` `REFERRAL_CONFIG` (상수 소스)
2. `functions/utils/referralConfig.js` (서버 미러)
3. `functions/referral.js` — `redeemReferralCode` 검증 로직, `confirmReferralActivations` 기준
4. `firestore.rules` — users 차단 필드 목록
5. `REFERRAL_V1.md` — 이 문서의 §1·§3·§8 블록
6. `npm run build` — 타입 에러 0 확인
7. 상한 변경 시 project_referral_activation_tuning.md 메모리 갱신
8. 공유 링크 패턴(`/r/:code`) 변경 시 `functions/ogRenderer.js` + 클라 sessionStorage 키 2곳 동시 수정

---

## 11. 잠정 수치 (튜닝 대기)

Sprint 7 배포 1개월 후 분포 실측으로 재조정:

- 활성화 기준 (글 1개+ OR 댓글 3개+) — 너무 빡빡/느슨한지 관찰
- 활성화 대기 7일 — 영상 유입 시차 고려 조정 가능
- 월 10명 Rate Limit — 인플루언서 페르소나 유입량 기반 재산정
- 베타 상한 30명 → 정식 50명 전환 시점

튜닝 메모리: `project_referral_activation_tuning.md` (Sprint 7 배포 시 신설)

---

## 12. 참고

- **Sprint 스코프**: `project_sprint7_scope.md` (추천코드 + 휴대폰 인증 단일 조합)
- **장기 로드맵**: `project_referral_lv20_roadmap.md` (정식 출시 + Lv20 확장)
- **Sprint 8 이월**: `project_sprint8_backlog.md` (SNS 추가 공급자 + 카드 PG + Admin Phase C)
