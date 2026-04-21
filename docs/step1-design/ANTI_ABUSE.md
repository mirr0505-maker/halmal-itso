# 🛡️ 글러브(GeuLove) 어뷰징 방지 설계서 (ANTI_ABUSE.md)

> **문서 목적**: 글러브 플랫폼의 **어뷰징 방지 전담 설계서**. Rules·클라이언트·Cloud Function·인증 4계층 방어 체계를 Phase별로 정의.
>
> 작성일: 2026-04-19 v1.0 | 기준: **Step 1 최우선 원칙** (v2.md §0 3대 원칙 중 하나)
>
> **핵심 철학**: 수익 모델이 발동되는 순간 어뷰저가 반드시 나타난다. 정식 출시 전에 **방어 체계를 먼저 완성**해야 한다.
>
> **참조 문서**: `GLOVE_SYSTEM_REDESIGN_v2.md`, `TUNING_SCHEDULE.md`, `PRICING.md`, `ADMIN.md`(예정), `STOREHOUSE.md`

---

## 📋 목차

- [0. 개요 & 3대 원칙](#0-개요--3대-원칙)
- [1. 현재 방어 상태 진단](#1-현재-방어-상태-진단)
- [2. 4계층 방어 아키텍처](#2-4계층-방어-아키텍처)
- [3. 위협 모델 (어뷰징 시나리오)](#3-위협-모델-어뷰징-시나리오)
- [4. Layer 1: Firestore Rules 강화](#4-layer-1-firestore-rules-강화)
- [5. Layer 2: 클라이언트 로직 보강](#5-layer-2-클라이언트-로직-보강)
- [6. Layer 3: Cloud Function 탐지 체계](#6-layer-3-cloud-function-탐지-체계)
- [7. Layer 4: 휴대폰 인증 로드맵](#7-layer-4-휴대폰-인증-로드맵)
- [8. 닉네임 변경 정책 구현](#8-닉네임-변경-정책-구현)
- [9. 감사·모니터링 체계](#9-감사모니터링-체계)
- [10. 관리자 대응 요구사항 (→ ADMIN.md)](#10-관리자-대응-요구사항--admin-md)
- [11. 데이터 모델 (types.ts 추가분)](#11-데이터-모델-typests-추가분)
- [12. 테스트 시나리오](#12-테스트-시나리오)
- [13. Step별 구현 우선순위](#13-step별-구현-우선순위)

---

## 0. 개요 & 3대 원칙

### 0.1 문서 위치

본 문서는 `GLOVE_SYSTEM_REDESIGN_v2.md`의 **§5 어뷰징 방지 시스템**을 상세 전개한 실무 설계서. Step 1의 **최우선 설계서**.

### 0.2 3대 원칙

| 원칙 | 내용 | 근거 |
|------|------|------|
| **조기 방어** | 정식 출시 **전**에 방어 완성 | 수익 발동 시점의 어뷰징 폭증 대비 |
| **계층 방어** | Rules·클라·CF·인증 4계층 조합 | 단일 방어 뚫려도 다음 계층이 막음 |
| **Phase별 강도** | Phase A/B/C에 따라 방어 강도 조정 | 유저 규모·위협 크기에 비례 대응 |

### 0.3 Phase별 방어 강도 요약

| Phase | Rules | 클라 | CF 탐지 | 인증 |
|:-----:|:-----:|:---:|:------:|:----:|
| **A (현재 베타)** | ✅ 강화 | ✅ 보강 | ⚠️ 최소 | ❌ 없음 |
| **B (베타 종료)** | ✅ 유지 | ✅ 유지 | ✅ 확장 | 📢 예고 |
| **C (정식 출시 + PG)** | ✅ 최종 | ✅ 최종 | ✅ 완전 | ✅ **필수** |

### 0.4 개발 수칙 (CLAUDE.md 준수)

- **Strict Focus**: 방어 로직 추가 외 기존 코드 건드리지 않음
- **Surgical Edit**: Rules·CF 필요 부분만 정밀 수술
- **선보고 후실행**: Rules 변경 시 반드시 AS-IS/TO-BE 보고 후 배포
- **Human Readable**: 모든 방어 로직에 주석으로 "왜 필요한지" 설명

---

## 1. 현재 방어 상태 진단

### 1.1 이미 견고한 영역 (✅)

#### 1.1.1 땡스볼 송금 (모범 사례)

**출처**: `functions/thanksball.js`

```javascript
// 다층 방어 완비
const MIN_INTERVAL_MS = 3000;        // 서버 쿨다운
const MAX_AMOUNT_PER_TX = 10000;     // 1회 상한
const MAX_MESSAGE_LENGTH = 100;      // 메시지 공격 차단
const ALLOWED_TARGET_COLLECTIONS = [ // 화이트리스트
  'posts', 'comments', 'community_posts'
];
```

- `clientRequestId` 멱등키 (재시도 이중 차감 차단)
- 유배자 송금 차단 + 사약자 수신 차단
- 자기 송금 이중 검증 (클라 UID + 트랜잭션 내부 `author_id` 재확인)
- 발신/수신 `balanceBefore`/`balanceAfter` 감사 필드 기록

**→ 이 패턴을 다른 CF 설계의 모범으로 활용**

#### 1.1.2 볼 잔액 관리

- Firestore Rules에서 `ballBalance` 필드 수정 차단 (CF Admin SDK만 허용)
- `ball_transactions` 멱등 원장 (sourceType별 고유키)
- `snapshotBallBalance` (매일 04:00) + `auditBallBalance` (04:30) 일일 교차 검증
- `audit_anomalies` 컬렉션에 이상치 자동 기록

#### 1.1.3 유배 시스템

- `sanctionStatus` CF 전용 수정 (Rules 차단)
- `phoneHash` 블랙리스트 (`banned_phones` 컬렉션)
- 90일 미납 자동 사약 (`checkAutoSayak`)

#### 1.1.4 잉크병 유료 회차

- 본문 `private_data` 분리 (Rules로 구매자/작가만 read)
- `unlocked_episodes` 영수증 CF만 쓰기
- 구매자 존재 시 삭제 불가, 비공개 전환만

#### 1.1.5 광고 이벤트

- `adEvents` 컬렉션 클라 쓰기 차단, CF만
- `detectFraud` CF로 부정 클릭 탐지 (노출/클릭 비율 이상)

### 1.2 공백 영역 (🔴/🟠/🟢)

#### 🔴 Critical 공백 3개

**1. EXP 필드 가드 부재**

현재 `firestore.rules:270-303` 본인 `exp` 수정 미차단:

```javascript
// 브라우저 콘솔 (F12) 한 줄
updateDoc(doc(db, 'users', currentUid), { exp: 99999 });
// → Lv10 즉시 달성
```

Lv5(광고 슬롯), Lv7(광고 수수료 20%) 등 수익 게이트가 모두 뚫림.

**2. `likes` / `totalShares` 타인 수정 무제한**

현재 Rules (`firestore.rules:294-298`):
```javascript
allow update: if request.auth.uid != id
  && request.resource.data.diff(resource.data).affectedKeys()
      .hasOnly(['likes', 'totalShares', 'promoViewCount']);
```

필드는 막았지만 **증감 방향·크기 제한 없음**:
```javascript
// 평판 펌핑 공격
for (let i = 0; i < 1000; i++) {
  await updateDoc(doc(db,'users',victimUid), { likes: increment(3) });
}
// 1000회 × 3 = likes +3000 → 평판 +6000 (중립→확고)

// 평판 파괴 공격
await updateDoc(doc(db,'users',rivalUid), { likes: increment(-3000) });
```

**3. 클라이언트 쿨다운 무력화**

현재 (`src/hooks/useFirestoreActions.ts:13-16`):
```typescript
let lastPostTime = 0;
let lastCommentTime = 0;
const RATE_LIMIT = { POST_COOLDOWN_MS: 60_000, COMMENT_COOLDOWN_MS: 15_000 };
```

- 새로고침·멀티탭·다기기 시 초기화
- F12 콘솔 `lastPostTime = 0`으로 리셋
- Puppeteer 자동화로 10자 글 300개 작성 → +600 EXP → Lv5 (30분 내)

#### 🟠 Major 공백 4개

**1. 깐부 맺기 EXP 루프**
- 맺기 +10 / 해제 -15 (Net -5)
- 다계정 100개로 메인 계정 맺기 → +1,000 EXP
- 해제 안 하면 Lv5 달성 가능

**2. 짧은 글 스팸**
- 10자 글 → +2 EXP 획득 가능
- 품질 가중치 없음 (v2 §2.3.2에서 개선 예정)

**3. 맞땡스볼 담합 탐지 부재**
- 3초 쿨다운만 있어 A↔B 왕복 분당 20회 가능
- 24시간 = 28,800회 왕복 → ballReceived 288만 가능
- 자기 송금은 차단, 다계정 담합은 미차단

**4. 닉네임 무제한 변경**
- 30일 쿨다운만 존재
- 어뷰저가 `악플왕` → `새사람` 세탁 가능

#### 🟢 Minor 공백 2개

**1. totalShares 클라 증가 (실제 공유 미검증)**
```javascript
await updateDoc(doc(db,'users',myUid), { totalShares: increment(1) });
// 실제 공유 없이 평판 +3
```

**2. 세션당 1회 조회 EXP, 재마운트로 중복**
- `src/hooks/useFirestoreActions.ts` 세션 변수 기반
- 컴포넌트 언마운트/재마운트 시 다시 +1 가능

### 1.3 진단 결론

**4계층 중 Rules가 가장 시급** — Rules 강화만으로 Critical 3개 중 2개 즉시 차단 가능 (F12 exp 공격, 평판 펌핑/파괴).

나머지 Major/Minor는 **우선순위 분산**:
- 클라 로직 보강: Step 2
- CF 탐지: Phase B~C
- 휴대폰 인증: Phase C (정식 출시 + PG 연동 시점)

---

## 2. 4계층 방어 아키텍처

### 2.1 전체 아키텍처

```
┌──────────────────────────────────────────────────────────────┐
│  유저 요청 (글 작성, 좋아요, 공유, 땡스볼, 닉네임 변경 등)    │
└──────────────────────────┬───────────────────────────────────┘
                           ↓
┌─ Layer 4: 휴대폰 인증 (Phase C 필수) ──────────────────────┐
│  - 회원가입 시 SMS 인증 필수                                │
│  - phoneHash 블랙리스트 매칭 (유배자 재가입 차단)           │
│  - 1 휴대폰 = 1 계정 원칙                                   │
└──────────────────────────┬───────────────────────────────────┘
                           ↓ 인증 통과한 유저만
┌─ Layer 1: Firestore Rules (즉시 차단) ─────────────────────┐
│  - 본인 필드 가드 (exp 1회 +100 이하, 음수 불가)             │
│  - 타인 필드 가드 (likes/shares 증가만, 1회 상한)            │
│  - sanctionStatus·ballBalance CF 전용                       │
│  - reserved_nicknames 체크                                  │
└──────────────────────────┬───────────────────────────────────┘
                           ↓ Rules 통과한 요청만
┌─ Layer 2: 클라이언트 로직 (의도 검증) ────────────────────┐
│  - 글·댓글 쿨다운 (60s / 15s)                               │
│  - 깐부 맺기 EXP 완화 (+2 / 0)                              │
│  - 삭제 시 EXP 음수 방지                                     │
│  - 10자 미만 글 차단                                         │
└──────────────────────────┬───────────────────────────────────┘
                           ↓ 정상 사용자 요청만
┌─ Layer 3: Cloud Function 탐지 (배후 분석) ────────────────┐
│  - detectCircularThanksball (매일 04:30)                    │
│  - auditReputationAnomalies (매일 05:00)                    │
│  - detectRapidExpGain (Phase B~C)                           │
│  - detectDuplicateAccounts (Phase C, 휴대폰 인증 우회 대비) │
└──────────────────────────┬───────────────────────────────────┘
                           ↓ 이상치 감지 시
┌─ 감사·대응 ─────────────────────────────────────────────┐
│  - audit_anomalies 기록                                    │
│  - 관리자 알림                                              │
│  - 자동 감점 (평판 -300~-1000)                              │
│  - 수동 검토 큐 (ADMIN.md)                                  │
└────────────────────────────────────────────────────────────┘
```

### 2.2 계층별 특성

| 계층 | 시점 | 비용 | 뚫림 시 영향 | 핵심 도구 |
|------|:----:|:----:|:-----------:|----------|
| Layer 4 인증 | 가입 순간 | 중 (SMS 비용) | **Layer 1~3 부담 증가** | Firebase Auth + SMS |
| Layer 1 Rules | 요청 순간 | 0 | 즉시 어뷰징 | firestore.rules |
| Layer 2 클라 | UI 순간 | 0 | F12로 우회 가능 | React 훅 |
| Layer 3 CF | 사후 (일일) | 중 (CF 비용) | 탐지 지연 | Cloud Functions |

### 2.3 설계 철학

**Rules는 "벽"**, CF는 "경찰":
- Rules = 선제 차단 (뚫리면 안 되는 마지막 방어선)
- CF = 사후 수사 (뚫렸을 때 탐지 + 되돌리기)

**인증은 "시민권"**:
- 휴대폰 인증 = 플랫폼의 "주민등록"
- 다계정 생성 비용을 **경제적으로 비합리하게** 만듦 (유심·알뜰폰 구매 비용)

---

## 3. 위협 모델 (어뷰징 시나리오)

### 3.1 시나리오 1: 봇 대량 가입 + EXP 조작

**공격자 목표**: 100개 계정 모두 Lv10 → 광고 슬롯 100개 획득 → 광고 수익 극대화

**공격 방식**:
```javascript
// 1. 자동화 스크립트로 이메일+패스워드 가입 100회
// 2. 각 계정 F12 콘솔
updateDoc(doc(db, 'users', uid), { exp: 99999 });
// 3. 100개 모두 Lv10 달성
```

**피해 규모**:
- 광고 슬롯 100개 × 월 광고 수익 = 매월 수백만원
- 플랫폼 수익 게이트 무력화 + 광고주 이탈

**방어 (Phase별)**:
| Phase | 주 방어 | 보조 방어 |
|:-----:|---------|----------|
| A | Rules (exp +100 상한) | — |
| B | Rules | + 예고 (C로 전환 준비) |
| C | **휴대폰 인증 (가입 시점 차단)** | Rules 유지 |

### 3.2 시나리오 2: 맞땡스볼 담합 (평판 세탁)

**공격자 목표**: 친구 A, B 각자 평판 "확고" 달성

**공격 방식**:
```
각자 1,000볼 보유
A → B 100볼 (3초 대기)
B → A 100볼 (3초 대기)
반복 ×1만 회
결과: 각자 ballReceived +100만, 평판 +500만 (확고)
실제 잔액: ±0
```

**현재 방어**:
- 3초 쿨다운 → 분당 20회
- 24시간 = 28,800회 왕복 가능
- 자기 송금만 차단, 다계정 담합 미차단

**방어 (Phase별)**:
| Phase | 주 방어 | 보조 방어 |
|:-----:|---------|----------|
| A | `detectCircularThanksball` CF (최소 버전) | — |
| B | 탐지 임계값 조정 | — |
| C | **휴대폰 인증으로 다계정 차단** + CF 유지 | — |

### 3.3 시나리오 3: 좋아요 펌핑/파괴

**공격 방식 A (펌핑)**:
```javascript
// 본인 또는 다계정으로 타인(본인) 평판 끌어올림
for (let i = 0; i < 10000; i++) {
  await updateDoc(doc(db,'users',myUid), { likes: increment(3) });
}
```

**공격 방식 B (파괴)**:
```javascript
// 경쟁자 평판 파괴 (increment 음수 가능)
for (let i = 0; i < 10000; i++) {
  await updateDoc(doc(db,'users',rivalUid), { likes: increment(-3) });
}
```

**방어**:
- Layer 1 Rules: 증가만 허용 + 1회 상한 (§4.2)
- Layer 3 CF: `auditReputationAnomalies` 일일 이상치 탐지

### 3.4 시나리오 4: 깐부 EXP 루프

**공격 방식**:
1. 다계정 100개 준비
2. 메인 계정이 100개 모두 깐부 맺기 → +10 × 100 = +1,000 EXP
3. Lv5 도달
4. 해제 안 함 (EXP 유지)

**방어**:
- v2 §4.3.4 결정: 맺기 +10 → +2 완화
- 일일 맺기 한도 (하루 10명 초과 시 EXP 미지급)
- Phase C 휴대폰 인증으로 근본 차단

### 3.5 시나리오 5: 닉네임 세탁

**공격 방식**:
- 불량깐부1호가 악플 10회 + 신고 3회 누적
- 닉네임 `악플왕` → `좋은사람` 변경
- 30일 쿨다운만 지나면 또 변경 가능
- 과거 행적 완전 세탁

**방어** (§8 상세):
- 평생 1회 유료 변경 (100볼 = 10,000원)
- 이전 닉네임 영구 예약 (사칭 차단)
- 공개 프로필에 변경 이력 영구 표시

### 3.6 시나리오 6: 🆕 자동화 봇 조회수 펌핑

**공격 방식**:
```javascript
// Puppeteer로 여러 IP에서 자동 조회
// 세션당 +1 EXP 획득 반복
// 하루 1,000 세션 × +1 = +1,000 EXP
```

**현재 방어**: 세션 변수만, 취약

**방어**:
- 조회 EXP → Firestore `viewed_posts/{uid}_{postId}` 마커로 전환 (1회 보장)
- 봇 User-Agent 필터링 (Cloudflare Worker 레벨)
- Phase C 휴대폰 인증으로 다계정 봇 방지

### 3.7 시나리오 7: 🆕 잉크병 유료 회차 무단 복제

**공격 시도**:
- 구매 후 본문 복사 → 공유
- 스크린샷 대량 캡처 후 재배포

**현재 방어**:
- `private_data` 분리 (Rules로 구매자만 read)
- 이미지 아닌 텍스트라 **완전 차단 불가**

**대응**:
- 가시적 **구매자 표시** (워터마크 형태, Step 3+)
- **신고 시스템 강화**: 유배 사유에 "무단 복제" 추가
- 법적 대응 경고 문구 (Terms of Service)

**결론**: 텍스트는 복제 완전 차단 불가 → **커뮤니티 규범 + 사후 처벌**로 대응

---

## 4. Layer 1: Firestore Rules 강화

### 4.1 결정: **즉시 적용** (v2 §8.3 ⑧ 확정)

Rules 수정은:
- **비용 0** (CF 배포 불필요, Firebase Console 바로 반영)
- **정상 사용자에게 영향 0** (한 번에 exp +100을 넘는 경우 없음)
- **롤백 5분** (원본 Rules 재배포만)
- **즉시 발효** (Firebase가 바로 적용)

→ **지금 당장 적용**하는 것이 합리적.

### 4.2 변경 상세 — users 컬렉션

#### 4.2.1 AS-IS (현재)

**출처**: `firestore.rules:270-303`

```javascript
match /users/{id} {
  allow read: if true;
  
  // 본인 수정
  allow update: if request.auth != null
    && request.auth.uid == id
    && !request.resource.data.diff(resource.data).affectedKeys()
        .hasAny([
          'ballBalance',
          'promoEnabled', 'promoExpireAt', 'promoPlan', 'promoUpdatedAt'
        ]);
  
  // 타인 수정 (화이트리스트 필드만)
  allow update: if request.auth != null
    && request.auth.uid != id
    && !id.matches('nickname_.*')
    && request.resource.data.diff(resource.data).affectedKeys()
        .hasOnly(['likes', 'totalShares', 'promoViewCount']);
  
  allow create: if request.auth != null && request.auth.uid == id;
  allow delete: if false;
}
```

**문제**:
- 본인 `exp` 수정 상한 없음 → F12로 Lv10 가능
- 타인 `likes`/`totalShares` 증가 크기·방향 제한 없음 → 펌핑/파괴 가능

#### 4.2.2 TO-BE (강화)

```javascript
match /users/{id} {
  allow read: if true;
  
  // 🆕 본인 수정 강화: exp +100 이하, 음수 불가
  allow update: if request.auth != null
    && request.auth.uid == id
    && !request.resource.data.diff(resource.data).affectedKeys()
        .hasAny([
          'ballBalance',
          'promoEnabled', 'promoExpireAt', 'promoPlan', 'promoUpdatedAt',
          // 🆕 닉네임 변경은 CF 전용 (§8 상세)
          'nickname', 'nicknameChangedAt', 'nicknameChangeCount',
          'previousNicknames',
          // 🆕 기득권 필드 CF 전용 (Phase C)
          'grandfatheredLevel', 'grandfatheredAt'
        ])
    // 🆕 exp 가드: 증가만 허용, 1회 +100 이하, 음수 불가
    && (
      !('exp' in request.resource.data.diff(resource.data).affectedKeys())
      || (
        request.resource.data.exp is int
        && request.resource.data.exp >= 0
        && request.resource.data.exp >= resource.data.exp
        && request.resource.data.exp - resource.data.exp <= 100
      )
    );
  
  // 🆕 타인 수정 강화: 증가만, 1회 상한
  allow update: if request.auth != null
    && request.auth.uid != id
    && !id.matches('nickname_.*')
    && request.resource.data.diff(resource.data).affectedKeys()
        .hasOnly(['likes', 'totalShares', 'promoViewCount'])
    // 🆕 감소 차단 (평판 공격 방지)
    && request.resource.data.likes >= resource.data.likes
    && request.resource.data.totalShares >= resource.data.totalShares
    && request.resource.data.promoViewCount >= resource.data.promoViewCount
    // 🆕 1회 증가 한도 (대량 펌핑 차단)
    && request.resource.data.likes - resource.data.likes <= 3
    && request.resource.data.totalShares - resource.data.totalShares <= 1
    && request.resource.data.promoViewCount - resource.data.promoViewCount <= 1;
  
  allow create: if request.auth != null && request.auth.uid == id;
  allow delete: if false;
}
```

### 4.3 변경 효과 시뮬레이션

#### 정상 사용자 영향 — **0**

| 상황 | 현재 동작 | TO-BE 동작 |
|------|----------|-----------|
| 글 작성 (+2 EXP) | 허용 | 허용 (100 이하) |
| 좋아요 3개 부스트 (+5) | 허용 | 허용 |
| 땡스볼 송금 (+1) | 허용 (CF) | 허용 (CF, Rules 우회) |
| 타인 좋아요 클릭 (+3) | 허용 | 허용 (3 이하) |
| 공유 (+1) | 허용 | 허용 (1 이하) |

#### 어뷰저 영향 — **대폭 차단**

| 공격 | 현재 가능성 | TO-BE 차단 |
|------|:---------:|:---------:|
| F12 `exp: 99999` | ✅ 성공 | 🔴 차단 (음수/초과) |
| F12 `exp: increment(1000)` | ✅ 성공 | 🔴 차단 (+100 초과) |
| 좋아요 펌핑 `increment(3000)` | ✅ 성공 | 🔴 차단 (+3 초과) |
| 좋아요 파괴 `increment(-3)` | ✅ 성공 | 🔴 차단 (감소 금지) |
| 반복 호출 (Firestore 500/s 제한) | ⚠️ 느림 | ⚠️ 느림 (변화 없음) |

### 4.4 엣지 케이스 대응

#### 케이스 1: 정상 EXP +100 초과 시나리오

**상황**: 반응 역류 EXP 공식 적용 시 (§2.3.2), 바이럴된 글에서 한 번에 +50 이상 가능?

**답변**: 
- 반응 역류는 **좋아요당 +1, 공유당 +2** 단위로 나뉘어 적립
- 단일 updateDoc에 +100을 초과 적립하는 경로 없음
- 만약 CF에서 배치로 +500을 한 번에 주는 경우 → **CF Admin SDK는 Rules 우회** (문제 없음)

**결론**: Rules +100 상한은 **클라이언트 직접 수정**에만 적용. CF는 무제한.

#### 케이스 2: Math.max 기반 삭제 시 EXP 감소

**상황**: 글 삭제 시 `exp: Math.max(0, currentExp - 2)` 업데이트

**현재 Rules**: `request.resource.data.exp >= resource.data.exp` 때문에 **감소 차단** → 삭제 기능 깨짐

**해결**: 삭제 시에도 CF 경유 (Phase B 2단계) OR Rules 예외 조건 추가:

```javascript
// 🆕 exp 감소 허용 (글/댓글 삭제 시만, 최대 -2)
|| (
  request.resource.data.exp >= 0
  && resource.data.exp - request.resource.data.exp <= 2
  && resource.data.exp - request.resource.data.exp > 0
)
```

**권장**: 당장은 "감소 금지" 엄격 적용 → 삭제 시 EXP 감소 기능 **Step 2 이후 CF로 이관**.

#### 케이스 3: 깐부 맺기 시 동시 업데이트

**상황**: `toggleFriend`가 `friendList`와 `exp`를 동시 업데이트

```typescript
await updateDoc(doc(db, 'users', userData.uid), {
  friendList: arrayUnion(author),
  exp: increment(isFriend ? -15 : 10),
});
```

**Rules 영향**:
- 맺기: +10 → Rules 통과 (100 이하)
- 해제: -15 → Rules **차단** (감소 금지)

**해결**: v2-14 결정에 따라 `exp: increment(0)` 해제 페널티 제거:

```typescript
await updateDoc(doc(db, 'users', userData.uid), {
  friendList: arrayUnion(author),
  exp: increment(isFriend ? 0 : 2),  // v2-14: +2 / 0
});
```

Rules 차단 문제 자동 해결.

### 4.5 배포 절차

#### Step 1: 개발 환경 테스트

```bash
# Firestore 에뮬레이터에서 테스트
firebase emulators:start --only firestore

# 테스트 스크립트 실행
# - 정상 update (+2 exp) → 통과
# - 공격 update (+99999 exp) → 거부
# - 음수 update (-10 exp) → 거부
```

#### Step 2: 프로덕션 배포

```bash
# Rules만 배포 (CF 영향 없음)
firebase deploy --only firestore:rules
```

**배포 후 모니터링**:
- 즉시: Firebase Console → Firestore → Rules → "게임 분석" 탭
- 1시간 후: `permission-denied` 오류 로그 확인
- 24시간 후: 정상 사용자 불편 신고 여부 체크

#### Step 3: 롤백 절차 (이상 시)

```bash
# Git에서 이전 firestore.rules 복원
git checkout HEAD~1 firestore.rules
firebase deploy --only firestore:rules
```

**총 롤백 시간**: 3~5분

### 4.6 기타 컬렉션 Rules 검토

이번 패치는 **users 컬렉션만** 대상. 다른 컬렉션은 현재 상태 유지:

| 컬렉션 | 상태 | 비고 |
|--------|:---:|------|
| `posts` | ✅ 견고 | 작성자 외 수정 차단 |
| `comments` | ✅ 견고 | 동일 |
| `ball_transactions` | ✅ 견고 | CF만 쓰기 |
| `reserved_nicknames` | 🆕 신규 (§8) | CF만 쓰기 |
| `audit_anomalies` | ✅ 견고 | Admin만 read |

---

## 5. Layer 2: 클라이언트 로직 보강

### 5.1 개요

Layer 2는 **정상 사용자의 의도된 동작**을 보장하고, 실수로 인한 비의도적 어뷰징을 방지하는 레이어. F12 공격은 Layer 1(Rules)에서 차단되므로 여기서는 **정책 구현**에 집중.

### 5.2 변경 사항 5가지

#### 5.2.1 깐부 맺기 EXP 완화

**출처**: `src/hooks/useFirestoreActions.ts:215-226`

**AS-IS**:
```typescript
const toggleFriend = async (author: string) => {
  await updateDoc(doc(db, 'users', userData.uid), {
    friendList: isFriend ? arrayRemove(author) : arrayUnion(author),
    exp: increment(isFriend ? -15 : 10),
  });
};
```

**TO-BE** (v2-14 결정):
```typescript
const toggleFriend = async (author: string) => {
  await updateDoc(doc(db, 'users', userData.uid), {
    friendList: isFriend ? arrayRemove(author) : arrayUnion(author),
    // v2-14: 맺기 +2 / 해제 0 (관계 실험 장려)
    exp: increment(isFriend ? 0 : 2),
  });
};
```

**효과**:
- 맺기 보상 축소 (+10 → +2)
- 해제 페널티 제거 (-15 → 0)
- 다계정 EXP 루프 인센티브 감소 (1,000 EXP → 200 EXP)

#### 5.2.2 EXP 음수 방지

**출처**: `src/hooks/useFirestoreActions.ts` 글/댓글 삭제 핸들러

**AS-IS**:
```typescript
await updateDoc(userRef, { exp: increment(-2) });
// 음수 방지 없음
```

**TO-BE**:
```typescript
// Step 2 구현 (현재는 Rules가 감소 차단, 삭제 시 exp 변동 없음)
// 장기적으로 CF 이관 (Phase B 2단계)
const userSnap = await getDoc(userRef);
const currentExp = userSnap.data()?.exp || 0;
const newExp = Math.max(0, currentExp - 2);
await updateDoc(userRef, { exp: newExp });
```

**당장 조치**: Rules가 감소 차단하므로 삭제 시 exp 변동 제거 (no-op):
```typescript
// Phase A 임시 조치: 삭제 시 exp 미변동
await deleteDoc(postRef);
// exp decrement 제거
```

#### 5.2.3 10자 미만 글 EXP 차단 (현재 이미 구현)

**출처**: `src/hooks/useFirestoreActions.ts` `isEligibleForExp` 함수

현재 이미 10자 미만 글은 EXP +2 미지급. 유지.

**Step 2 확장 제안**: 품질 가중치 공식 (v2 §2.3.2)
```typescript
const calculateExpForPost = (content: string, hasImage: boolean, hasLink: boolean): number => {
  const length = content.replace(/<[^>]*>/g, '').length;  // HTML 제거
  let exp = 0;
  
  if (length >= 1000) exp += 6;
  else if (length >= 300) exp += 4;
  else if (length >= 100) exp += 2;
  else if (length >= 10) exp += 1;
  else return 0;  // 10자 미만 미지급
  
  if (hasImage) exp += 1;
  if (hasLink) exp += 1;
  
  return exp;
};
```

#### 5.2.4 세션 조회 EXP → 영구 마커

**AS-IS**: 컴포넌트 세션 변수로 중복 방지 (재마운트 시 우회 가능)

**TO-BE**: Firestore 마커 문서
```typescript
// viewed_posts/{uid}_{postId}
interface ViewedPost {
  uid: string;
  postId: string;
  viewedAt: FirestoreTimestamp;
}

const viewPost = async (postId: string) => {
  const markerId = `${userData.uid}_${postId}`;
  const markerRef = doc(db, 'viewed_posts', markerId);
  const markerSnap = await getDoc(markerRef);
  
  if (!markerSnap.exists()) {
    await Promise.all([
      setDoc(markerRef, {
        uid: userData.uid,
        postId,
        viewedAt: serverTimestamp(),
      }),
      updateDoc(doc(db, 'users', userData.uid), { exp: increment(1) }),
    ]);
  }
};
```

**비용 고려**:
- `viewed_posts` 문서 수: 유저 × 글 (최대 100만 문서 예상)
- 쓰기 비용: 유저당 초당 1개 상한
- **권장**: Step 2 이후 구현, Phase A에서는 현재 세션 방식 유지

#### 5.2.5 totalShares 검증 강화 (Step 2)

**AS-IS**: 클라가 `totalShares: increment(1)` 호출

**TO-BE**: CF 경유
```typescript
// functions/sharePost.js (신규)
exports.sharePost = onCall(
  { region: 'asia-northeast3' },
  async (request) => {
    const { postId, method } = request.data;  // method: 'kakao'|'facebook'|'link'
    const uid = request.auth.uid;
    
    // 멱등성 체크 (같은 postId+uid+시간대에 중복 금지)
    const shareKey = `${uid}_${postId}_${Math.floor(Date.now() / 3600000)}`;
    const shareRef = db.collection('post_shares').doc(shareKey);
    const shareSnap = await shareRef.get();
    
    if (shareSnap.exists) {
      throw new HttpsError('already-exists', '1시간 내 중복 공유 불가');
    }
    
    await db.runTransaction(async (tx) => {
      const postRef = db.collection('posts').doc(postId);
      const postSnap = await tx.get(postRef);
      const author = postSnap.data().author;
      const authorUid = postSnap.data().author_id;
      
      // 자기 글 공유는 EXP 미지급
      if (authorUid === uid) {
        tx.set(shareRef, { uid, postId, method, timestamp: Timestamp.now() });
        return;
      }
      
      // 작성자 totalShares +1 (CF 경유)
      tx.update(db.collection('users').doc(authorUid), {
        totalShares: FieldValue.increment(1),
      });
      
      // 공유자에게 EXP +2 (반응 역류 공식, Phase B 2단계)
      // tx.update(db.collection('users').doc(uid), {
      //   exp: FieldValue.increment(2),
      // });
      
      tx.set(shareRef, { uid, postId, method, timestamp: Timestamp.now() });
    });
    
    return { success: true };
  }
);
```

### 5.3 변경 우선순위

| 변경 | Phase | 난이도 | 효과 |
|------|:-----:|:------:|:---:|
| 깐부 EXP +2/0 완화 | A | 🟢 하 | 🔴 상 |
| 삭제 시 exp 미변동 | A | 🟢 하 | 🟡 중 |
| 품질 가중치 EXP 공식 | B | 🟡 중 | 🔴 상 |
| 세션 조회 → Firestore 마커 | B~C | 🔴 상 | 🟡 중 |
| totalShares CF 이관 | C | 🔴 상 | 🟡 중 |

---

## 6. Layer 3: Cloud Function 탐지 체계

### 6.1 개요

Layer 3는 **사후 탐지**. Rules/클라이언트 방어를 뚫고 들어온 어뷰징을 **배후에서 분석**하고 **관리자에게 알림**.

설계 원칙:
- **매일 배치 실행** (실시간 불필요, 비용 최적화)
- **자동 감점 + 수동 검토 큐** (false positive 대비)
- **audit_anomalies에 기록** (감사 추적)

### 6.2 CF 4개 설계

#### 6.2.1 `detectCircularThanksball` (맞땡스볼 담합 탐지)

**목적**: A↔B 왕복 송금 패턴 탐지

**실행 주기**: 매일 04:30 (스케줄)

**설계**:
```javascript
// functions/detectCircularThanksball.js
exports.detectCircularThanksball = onSchedule(
  { schedule: '30 4 * * *', timeZone: 'Asia/Seoul', region: 'asia-northeast3' },
  async () => {
    const CIRCULAR_THRESHOLD = 10;  // 24h 내 왕복 10회 초과 시 의심
    const PENALTY_REPUTATION = -300;
    const SINCE = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    // 1. 최근 24시간 땡스볼 거래 로드
    const transactions = await db.collection('ball_transactions')
      .where('sourceType', '==', 'thanksball_send')
      .where('timestamp', '>', SINCE)
      .get();
    
    // 2. 유저 쌍(pair) 카운트 집계
    const pairCounts = {};  // { "A_B": { AtoB: N, BtoA: M }, ... }
    
    transactions.forEach(doc => {
      const data = doc.data();
      const sender = data.sender_id;
      const receiver = data.receiver_id;
      const pair = [sender, receiver].sort().join('_');
      
      if (!pairCounts[pair]) pairCounts[pair] = {};
      const direction = sender < receiver ? 'AtoB' : 'BtoA';
      pairCounts[pair][direction] = (pairCounts[pair][direction] || 0) + 1;
    });
    
    // 3. 양방향 교류 + 임계값 초과 쌍 필터링
    const suspiciousPairs = [];
    Object.entries(pairCounts).forEach(([pair, counts]) => {
      const minDirection = Math.min(counts.AtoB || 0, counts.BtoA || 0);
      if (minDirection >= CIRCULAR_THRESHOLD) {
        suspiciousPairs.push({ pair, counts });
      }
    });
    
    // 4. 감점 + 기록
    for (const { pair, counts } of suspiciousPairs) {
      const [uid1, uid2] = pair.split('_');
      
      // 양쪽 평판 감점
      await Promise.all([
        db.collection('users').doc(uid1).update({
          likes: FieldValue.increment(Math.floor(PENALTY_REPUTATION / 2)),  // 평판 × 2 역산
        }),
        db.collection('users').doc(uid2).update({
          likes: FieldValue.increment(Math.floor(PENALTY_REPUTATION / 2)),
        }),
        // 이상치 기록
        db.collection('audit_anomalies').add({
          type: 'circular_thanksball',
          involvedUids: [uid1, uid2],
          detectedAt: FieldValue.serverTimestamp(),
          details: counts,
          autoAction: 'reputation_penalty',
          reviewStatus: 'pending',
        }),
      ]);
    }
    
    console.log(`[detectCircularThanksball] ${suspiciousPairs.length} pairs detected`);
  }
);
```

**임계값 설정**:
- Phase A: 10회 (느슨) — 데이터 축적용
- Phase B: 실제 데이터 보고 조정
- Phase C: 5회 (엄격) + 자동 감점 활성

**false positive 대비**:
- 진짜 친한 관계도 24h 10회 왕복 가능
- → 자동 감점 대신 **관리자 검토 큐**로 먼저 쌓기 (Phase A)
- 관리자가 개별 판단 후 감점 확정

#### 6.2.2 `auditReputationAnomalies` (평판 이상치 탐지)

**목적**: `likes`/`totalShares` 1일 변화량 통계 기반 이상치 감지

**실행 주기**: 매일 05:00

**설계**:
```javascript
// functions/auditReputationAnomalies.js
exports.auditReputationAnomalies = onSchedule(
  { schedule: '0 5 * * *', timeZone: 'Asia/Seoul', region: 'asia-northeast3' },
  async () => {
    // 1. 어제 daily_stats 로드
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const yesterdayKey = yesterday.toISOString().slice(0, 10).replace(/-/g, '');
    
    // 2. 모든 유저의 24h likes/totalShares 변화량 계산
    const users = await db.collection('users').get();
    const deltas = [];
    
    for (const userDoc of users.docs) {
      const uid = userDoc.id;
      if (uid.startsWith('nickname_')) continue;
      
      const current = userDoc.data();
      const snapshotRef = db.collection('user_daily_snapshots')
        .doc(`${uid}_${yesterdayKey}`);
      const snapshot = await snapshotRef.get();
      
      if (!snapshot.exists) continue;
      
      const prev = snapshot.data();
      const deltaLikes = (current.likes || 0) - (prev.likes || 0);
      const deltaShares = (current.totalShares || 0) - (prev.totalShares || 0);
      
      deltas.push({ uid, deltaLikes, deltaShares });
    }
    
    // 3. 99 percentile 계산 (이상치 기준)
    const likesDeltas = deltas.map(d => d.deltaLikes).sort((a, b) => a - b);
    const threshold99 = likesDeltas[Math.floor(likesDeltas.length * 0.99)];
    
    // 4. 임계값 초과 유저 기록
    const anomalies = deltas.filter(d => 
      d.deltaLikes > Math.max(threshold99, 100)  // 최소 100 이상
    );
    
    for (const { uid, deltaLikes, deltaShares } of anomalies) {
      await db.collection('audit_anomalies').add({
        type: 'reputation_spike',
        uid,
        detectedAt: FieldValue.serverTimestamp(),
        details: { deltaLikes, deltaShares, threshold: threshold99 },
        autoAction: 'review_required',
        reviewStatus: 'pending',
      });
    }
    
    console.log(`[auditReputationAnomalies] ${anomalies.length} anomalies detected`);
  }
);
```

**주의**:
- 정상 바이럴 유저도 24h +500 likes 가능 (false positive 위험)
- → 자동 감점 금지, **관리자 검토 큐에만 적재**
- 관리자가 실제 글 내용 보고 "자연 바이럴 vs 펌핑" 판단

#### 6.2.3 `detectRapidExpGain` (Phase B~C)

**목적**: 비정상 EXP 증가 탐지 (봇 의심)

**실행 주기**: 매일 05:30

**설계 요약**:
```javascript
// 1일 EXP 증가량 > 200 (= 글 100개 수준) 유저 탐지
// 품질 가중치 공식 기준 정상 유저 일일 최대 ~100 EXP
// 200+ 증가 시 봇 의심
```

**Phase A에서는 구현 연기** — 품질 가중치 공식(v2 §2.3.2)이 Step 2 이후 적용되므로 기준 불명확.

#### 6.2.4 `detectDuplicateAccounts` (Phase C)

**목적**: 휴대폰 인증 우회 다계정 탐지

**실행 주기**: 매일 06:00

**탐지 신호**:
- 동일 IP에서 10분 내 3+ 계정 생성
- 유사한 행동 패턴 (가입 직후 같은 사용자 팔로우 등)
- 동일 `phoneHash` (이미 blocked)
- 디바이스 fingerprint 유사도

**Phase A/B**: 구현 연기 — Phase C 휴대폰 인증 없이는 탐지 신호 부족.

### 6.3 false positive 대응 원칙

**핵심**: 자동 처벌은 **명확한 패턴**에만. 애매하면 **관리자 검토 큐**.

| 상황 | 자동 감점 | 검토 큐 |
|------|:--------:|:------:|
| 맞땡스볼 24h 20회+ | ✅ (Phase C) | ✅ |
| 평판 1일 +1,000 급증 | ❌ | ✅ |
| EXP 1일 +500 급증 | ❌ | ✅ |
| `ballBalance` 불일치 | ✅ (기존) | ✅ |
| Rules 거부 반복 | ❌ | ✅ |

### 6.4 CF 비용 추산

**Firebase Pricing (Blaze 플랜)**:
- 호출당 $0.0000004 (Node.js)
- 컴퓨팅 시간당 과금

**추산** (유저 1만 명 기준):
- `detectCircularThanksball`: 1일 1회 × 1분 = $0.01/월
- `auditReputationAnomalies`: 1일 1회 × 5분 = $0.05/월
- **총 CF 비용**: **월 $1 이하**

→ 매우 저렴, 부담 없음.

---

## 7. Layer 4: 휴대폰 인증 로드맵

### 7.1 결정: **Phase C (정식 출시 + PG 연동)**에 회원가입 필수

**결정 근거** (2026-04-19):
- Phase A (베타): 가입 간편화 우선, 테스트 우호 환경
- Phase B (베타 종료): "곧 필수화" 예고
- Phase C: PG 연동 = 돈 움직임 시작 → 어뷰징 인센티브 급증 → 인증 필수

### 7.2 Phase별 인증 정책

| Phase | 가입 시 | 유배 해제 시 | Lv5 진입 시 |
|:-----:|:------:|:----------:|:---------:|
| A | ❌ 불요 | ✅ 필수 (기존) | ❌ 불요 |
| B | 📢 예고 | ✅ 필수 | 📢 예고 |
| C | ✅ **필수** | ✅ 필수 | (자동 충족) |

### 7.3 Phase C 구현 설계

#### 7.3.1 회원가입 UX 변경

**AS-IS (Phase A)**:
```
이메일 + 패스워드 + 닉네임 → 가입 완료
```

**TO-BE (Phase C)**:
```
이메일 + 패스워드 + 닉네임
         ↓
SMS 인증 (필수)
         ↓
phoneHash 블랙리스트 체크
         ↓
가입 완료
```

#### 7.3.2 Firebase Auth 통합

```typescript
// src/hooks/useAuth.ts (Phase C 확장)
import { 
  PhoneAuthProvider, 
  signInWithCredential,
  linkWithCredential,
} from 'firebase/auth';

const signUpWithPhone = async (
  email: string,
  password: string,
  nickname: string,
  phoneNumber: string,
  verificationCode: string,
) => {
  // 1. 이메일 가입
  const { user } = await createUserWithEmailAndPassword(auth, email, password);
  
  // 2. 휴대폰 인증
  const phoneCredential = PhoneAuthProvider.credential(
    verificationId,  // SMS 발송 시 받은 ID
    verificationCode,
  );
  await linkWithCredential(user, phoneCredential);
  
  // 3. CF로 phoneHash 체크 + users 문서 생성
  const result = await callCF('completeSignup', {
    uid: user.uid,
    nickname,
    phoneNumber,
  });
  
  if (!result.success) {
    // 블랙리스트 매칭 시 계정 삭제 + 에러
    await deleteUser(user);
    throw new Error(result.reason);
  }
};
```

#### 7.3.3 CF `completeSignup` (Phase C 신규)

```javascript
// functions/completeSignup.js (Phase C)
const crypto = require('crypto');
const PHONE_SALT = process.env.PHONE_HASH_SALT;

exports.completeSignup = onCall(
  { region: 'asia-northeast3' },
  async (request) => {
    const { nickname, phoneNumber } = request.data;
    const uid = request.auth.uid;
    
    // 1. phoneHash 생성
    const phoneHash = crypto.createHmac('sha256', PHONE_SALT)
      .update(phoneNumber)
      .digest('hex');
    
    // 2. 블랙리스트 체크
    const bannedDoc = await db.collection('banned_phones').doc(phoneHash).get();
    if (bannedDoc.exists) {
      return {
        success: false,
        reason: '이 휴대폰 번호로는 가입할 수 없습니다. (과거 사약 이력)',
      };
    }
    
    // 3. 중복 계정 체크 (1 휴대폰 = 1 계정)
    const existingUser = await db.collection('users')
      .where('phoneHash', '==', phoneHash)
      .limit(1)
      .get();
    
    if (!existingUser.empty) {
      return {
        success: false,
        reason: '이 휴대폰 번호로 이미 가입된 계정이 있습니다.',
      };
    }
    
    // 4. 닉네임 중복 체크 + 예약 체크
    const nicknameDoc = await db.collection('users').doc(`nickname_${nickname}`).get();
    if (nicknameDoc.exists) {
      return { success: false, reason: '이미 사용 중인 닉네임입니다.' };
    }
    const reservedDoc = await db.collection('reserved_nicknames').doc(nickname).get();
    if (reservedDoc.exists) {
      return { success: false, reason: '예약된 닉네임입니다.' };
    }
    
    // 5. users 문서 생성
    await db.collection('users').doc(uid).set({
      uid,
      nickname,
      phoneHash,  // 저장 (평문 전화번호는 저장 안 함)
      createdAt: FieldValue.serverTimestamp(),
      exp: 0,
      ballBalance: 0,
      sanctionStatus: 'clean',
      // ...
    });
    
    // 6. nickname_* 문서 생성 (중복 방지)
    await db.collection('users').doc(`nickname_${nickname}`).set({
      uid,
      reservedAt: FieldValue.serverTimestamp(),
    });
    
    return { success: true, uid };
  }
);
```

#### 7.3.4 베타 유저 마이그레이션

**이슈**: Phase A/B에 가입한 유저는 휴대폰 미인증 → Phase C 전환 시 어떻게?

**해결책 3가지**:

**옵션 A: 강제 인증 기간 제공** (권장)
- Phase B 공지: "정식 출시 후 3개월 내 휴대폰 인증 필수, 미인증 시 기능 제한"
- 기능 제한: 수익 창출 차단, 땡스볼 송수신 차단
- 완전 미인증 유저는 6개월 후 휴면 처리

**옵션 B: 기존 유저 면제**
- Phase C 이전 가입자는 영구 면제
- 단점: 어뷰징 경로 유지

**옵션 C: 단계적 강제**
- Phase C 시작 시: 로그인마다 "인증 권장" 알림
- Phase C+3개월: Lv5 이상 수익 활동 시 강제
- Phase C+6개월: 모든 활동 강제

**권장**: **옵션 A** — 명확한 기한 + 유저 대응 시간 제공 + 수익 보호.

### 7.4 SMS 비용 검토

**Firebase Phone Auth 비용** (2026년 기준 추정):
- 한국 SMS: 1건당 약 $0.05
- 월 1,000 가입자: 월 $50

**대안**: 자체 SMS (NHN Cloud, CoolSMS 등)
- 건당 약 ₩8~15
- 월 1,000 가입 × ₩10 = ₩10,000/월 (훨씬 저렴)

**Step 3 설계 시 결정**: 회원가입 재설계와 함께 SMS 공급자 선정.

---

## 8. 닉네임 변경 정책 구현

> **결정 확정** (v2-5~7):
> - 평생 1회 유료 변경 (100볼 = 10,000원)
> - 이전 닉네임 영구 예약 (사칭 차단)
> - 공개 프로필에 변경 이력 영구 표시

### 8.1 구현 범위

| 항목 | 위치 | Phase |
|------|------|:-----:|
| 데이터 모델 확장 | `types.ts` | A |
| `reserved_nicknames` 컬렉션 | Firestore | A |
| Firestore Rules | `firestore.rules` | A |
| `changeNickname` CF | `functions/nickname.js` | B |
| UI 변경 (`ProfileEditForm`) | React | B |
| 공개 프로필 이력 표시 | `PublicProfile.tsx` | B |

### 8.2 데이터 모델

**`users/{uid}` 확장**:
```typescript
// src/types.ts
export interface UserData {
  // ... 기존 필드
  
  // 🆕 닉네임 정책 필드
  nickname: string;
  previousNicknames?: string[];    // 변경 이력 (최대 1개)
  nicknameChangedAt?: FirestoreTimestamp;
  nicknameChangeCount?: number;    // 0 or 1 (평생 1회 제한)
}
```

**`reserved_nicknames/{oldNickname}`** (신규 컬렉션):
```typescript
export interface ReservedNickname {
  originalUid: string;
  reservedAt: FirestoreTimestamp;
  reservedReason: 'user_change' | 'admin_lock';
}
```

### 8.3 Firestore Rules

```javascript
// 🆕 reserved_nicknames
match /reserved_nicknames/{oldNick} {
  allow read: if request.auth != null;  // 사용 가능 여부 확인
  allow write: if false;  // CF 전용
}

// 🆕 users 닉네임 필드는 CF 경유만 (§4.2 이미 반영)
// - nickname, nicknameChangedAt, nicknameChangeCount, previousNicknames
```

### 8.4 Cloud Function: `changeNickname`

```javascript
// functions/nickname.js (신규)
const { Timestamp, FieldValue } = require('firebase-admin/firestore');

const FEE_BALLS = 100;  // 100볼 = 10,000원

exports.changeNickname = onCall(
  { region: 'asia-northeast3' },
  async (request) => {
    const { newNickname } = request.data;
    const uid = request.auth.uid;
    
    if (!uid) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    
    // 닉네임 형식 검증
    if (!newNickname || typeof newNickname !== 'string') {
      throw new HttpsError('invalid-argument', '닉네임이 유효하지 않습니다.');
    }
    
    const trimmed = newNickname.trim();
    if (trimmed.length < 2 || trimmed.length > 10) {
      throw new HttpsError('invalid-argument', '닉네임은 2~10자여야 합니다.');
    }
    
    // 특수문자 제한 (한글/영문/숫자/밑줄만)
    if (!/^[가-힣a-zA-Z0-9_]+$/.test(trimmed)) {
      throw new HttpsError('invalid-argument', '한글/영문/숫자/밑줄만 허용됩니다.');
    }
    
    return await db.runTransaction(async (tx) => {
      const userRef = db.collection('users').doc(uid);
      const userSnap = await tx.get(userRef);
      
      if (!userSnap.exists) {
        throw new HttpsError('not-found', '사용자를 찾을 수 없습니다.');
      }
      
      const userData = userSnap.data();
      const oldNickname = userData.nickname;
      
      // 1. 이미 변경했는지 체크 (평생 1회)
      if ((userData.nicknameChangeCount || 0) >= 1) {
        throw new HttpsError(
          'permission-denied',
          '닉네임 변경은 평생 1회만 가능합니다.'
        );
      }
      
      // 2. 동일 닉네임 체크
      if (oldNickname === trimmed) {
        throw new HttpsError(
          'invalid-argument',
          '현재 닉네임과 동일합니다.'
        );
      }
      
      // 3. 잔액 체크 (100볼)
      if ((userData.ballBalance || 0) < FEE_BALLS) {
        throw new HttpsError(
          'failed-precondition',
          `${FEE_BALLS}볼(${FEE_BALLS * 100}원)이 필요합니다. 현재 잔액: ${userData.ballBalance || 0}볼`
        );
      }
      
      // 4. 새 닉네임 중복 체크
      const newNicknameDocRef = db.collection('users').doc(`nickname_${trimmed}`);
      const newNicknameDoc = await tx.get(newNicknameDocRef);
      if (newNicknameDoc.exists) {
        throw new HttpsError('already-exists', '이미 사용 중인 닉네임입니다.');
      }
      
      // 5. 예약된 닉네임 체크
      const reservedDocRef = db.collection('reserved_nicknames').doc(trimmed);
      const reservedDoc = await tx.get(reservedDocRef);
      if (reservedDoc.exists) {
        throw new HttpsError(
          'already-exists',
          '예약된 닉네임입니다. (과거 사용자가 변경 시 예약됨)'
        );
      }
      
      // 6. 이전 닉네임 영구 예약 (reserved_nicknames 최상위 컬렉션에 oldNickname 문서 생성)
      const oldNicknameReservedRef = db.collection('reserved_nicknames').doc(oldNickname);
      tx.set(oldNicknameReservedRef, {
        originalUid: uid,
        reservedAt: Timestamp.now(),
        reservedReason: 'user_change',
      });
      
      // 7. 기존 nickname_* 문서 삭제
      const oldNicknameDocRef = db.collection('users').doc(`nickname_${oldNickname}`);
      tx.delete(oldNicknameDocRef);
      
      // 8. 새 nickname_* 문서 생성
      tx.set(newNicknameDocRef, {
        uid,
        reservedAt: Timestamp.now(),
      });
      
      // 9. users 문서 업데이트
      tx.update(userRef, {
        nickname: trimmed,
        ballBalance: FieldValue.increment(-FEE_BALLS),
        ballSpent: FieldValue.increment(FEE_BALLS),
        previousNicknames: FieldValue.arrayUnion(oldNickname),
        nicknameChangeCount: FieldValue.increment(1),
        nicknameChangedAt: Timestamp.now(),
      });
      
      // 10. ball_transactions 기록
      const txId = `nickname_change_${uid}_${Date.now()}`;
      tx.set(db.collection('ball_transactions').doc(txId), {
        uid,
        amount: -FEE_BALLS,
        sourceType: 'nickname_change',
        balanceBefore: userData.ballBalance,
        balanceAfter: userData.ballBalance - FEE_BALLS,
        timestamp: Timestamp.now(),
        details: {
          oldNickname,
          newNickname: trimmed,
        },
      });
      
      // 11. 플랫폼 수익 기록
      tx.set(
        db.collection('platform_revenue').doc('nickname_change'),
        {
          totalAmount: FieldValue.increment(FEE_BALLS),
          totalCount: FieldValue.increment(1),
          lastChangedAt: Timestamp.now(),
        },
        { merge: true }
      );
      
      return {
        success: true,
        oldNickname,
        newNickname: trimmed,
        feeCharged: FEE_BALLS,
      };
    });
  }
);
```

### 8.5 UI 변경

#### 8.5.1 `ProfileEditForm.tsx` (Step 2)

**AS-IS**: 닉네임 무제한 변경 가능 (30일 쿨다운)

**TO-BE**:
```tsx
function NicknameChangeSection({ user }) {
  const canChange = (user.nicknameChangeCount || 0) === 0;
  const fee = 100;
  const feeKRW = fee * 100;
  
  if (!canChange) {
    return (
      <div className="p-4 bg-slate-50 rounded-lg">
        <p className="text-slate-500">
          ❌ 닉네임 변경 기회를 이미 사용하셨습니다.
        </p>
        <p className="text-xs text-slate-400 mt-1">
          이전 닉네임: {user.previousNicknames?.join(', ')}
        </p>
      </div>
    );
  }
  
  return (
    <div className="p-4 bg-amber-50 rounded-lg">
      <h3 className="font-bold">🔒 닉네임 변경 (평생 1회)</h3>
      <p className="text-sm mt-2">
        닉네임은 <strong>평생 1회만 변경</strong>할 수 있습니다.
      </p>
      <p className="text-sm">
        수수료: <strong>{fee}볼 ({feeKRW.toLocaleString()}원)</strong>
      </p>
      <p className="text-xs text-red-600 mt-2">
        ⚠️ 변경 후 이전 닉네임은 영구 예약되어 다시 사용할 수 없습니다.
      </p>
      <p className="text-xs text-red-600">
        ⚠️ 공개 프로필에 변경 이력이 영구 표시됩니다.
      </p>
      
      <button
        onClick={openChangeModal}
        className="mt-3 px-4 py-2 bg-amber-600 text-white rounded"
      >
        닉네임 변경하기
      </button>
    </div>
  );
}
```

#### 8.5.2 `PublicProfile.tsx` — 변경 이력 표시

```tsx
{user.previousNicknames?.length > 0 && (
  <div className="text-xs text-slate-500 mt-1">
    이전 닉네임: {user.previousNicknames.join(', ')}
  </div>
)}
```

### 8.6 예외 처리 — 관리자 수동 변경

**신변 위협 등 특수 상황**:
- 관리자가 `adminChangeNickname` CF로 변경
- `nicknameChangeCount` 미증가 (기득권 재활용 가능)
- `sanction_log`에 사유 기록

**상세**: `ADMIN.md` 참조.

### 8.7 테스트 시나리오

| # | 행위자 | 상황 | 기대 결과 |
|:-:|-------|------|----------|
| 1 | 깐부1호 | 100볼 보유, `깐부1호` → `새로운나` 변경 | ✅ 성공, 잔액 -100, 카운트 1 |
| 2 | 깐부1호 | 2회째 변경 시도 | 🔴 `permission-denied` |
| 3 | 깐부2호 | `깐부1호`로 변경 시도 (예약됨) | 🔴 `already-exists` |
| 4 | 깐부3호 | 50볼 보유 → 변경 시도 | 🔴 `failed-precondition` |
| 5 | 불량깐부1호 | 악플 후 변경 시도 | 🟢 성공, 하지만 공개 프로필에 이전 닉 노출 |
| 6 | 깐부4호 | 특수문자 포함 닉네임 시도 | 🔴 `invalid-argument` |
| 7 | 깐부5호 | 1자 닉네임 시도 | 🔴 `invalid-argument` |

---

## 9. 감사·모니터링 체계

### 9.1 이미 존재하는 감사 시스템

#### 9.1.1 볼 잔액 일일 교차 검증

- `snapshotBallBalance` (매일 04:00): 전 유저 `ballBalance` 스냅샷
- `auditBallBalance` (매일 04:30): 스냅샷 + `ball_transactions` 기준 재계산 → 불일치 시 `audit_anomalies` 기록

**상태**: ✅ 견고 (`CLAUDE.md` 참조, 별도 스프린트 최우선 과제)

### 9.2 확장 — Phase B~C 추가 감사

#### 9.2.1 `snapshotUserDaily` (매일 03:30)

**목적**: 유저별 핵심 필드 일일 스냅샷 (평판·EXP 이상치 탐지의 기준값)

**저장 위치**: `user_daily_snapshots/{uid}_{YYYYMMDD}`

```typescript
interface UserDailySnapshot {
  uid: string;
  date: string;           // '20260419'
  exp: number;
  likes: number;
  totalShares: number;
  ballReceived: number;
  ballBalance: number;
  followerCount: number;  // 실시간 계산된 값
  reputationScore: number;
  creatorScore?: number;  // Phase C
  timestamp: FirestoreTimestamp;
}
```

**비용 추산** (유저 1만 명 기준):
- 1일 10,000 문서 × 365일 = 365만 문서/년
- Firestore 쓰기: 10,000/일 = $0.006/일 = $2.2/년
- Firestore 저장: 약 2GB → $0.55/년
- **총 비용**: 약 **$3/년** (매우 저렴)

#### 9.2.2 `audit_anomalies` 확장

기존 `audit_anomalies`에 새 `type` 추가:

| type | 탐지 CF | 설명 |
|------|---------|------|
| `ball_mismatch` | `auditBallBalance` | 볼 잔액 불일치 (기존) |
| `circular_thanksball` | `detectCircularThanksball` | 맞땡스볼 담합 |
| `reputation_spike` | `auditReputationAnomalies` | 평판 급증 |
| `rapid_exp_gain` | `detectRapidExpGain` | EXP 급증 (Phase B~C) |
| `duplicate_account` | `detectDuplicateAccounts` | 다계정 의심 (Phase C) |
| `nickname_change_suspicious` | 수동 | 닉네임 세탁 의심 |

### 9.3 Firestore 스키마

```typescript
// audit_anomalies/{docId}
export interface AuditAnomaly {
  type: string;  // 위 테이블
  uid?: string;
  involvedUids?: string[];
  detectedAt: FirestoreTimestamp;
  details: Record<string, any>;
  autoAction: 'none' | 'reputation_penalty' | 'review_required' | 'exile';
  reviewStatus: 'pending' | 'reviewed' | 'action_taken' | 'dismissed';
  reviewedBy?: string;  // admin uid
  reviewedAt?: FirestoreTimestamp;
  reviewNote?: string;
}
```

### 9.4 보존 기간

- `audit_anomalies`: **영구 보존** (감사 추적)
- `user_daily_snapshots`: **1년 보존** (이후 자동 삭제)
- `ball_balance_snapshots`: **영구 보존**

---

## 10. 관리자 대응 요구사항 (→ ADMIN.md)

> **원칙**: 본 섹션은 **요구사항 나열만**. 실제 UI/UX는 `ADMIN.md`(후속 작성) 통합.

### 10.1 어뷰저 대응 UI 요구사항

#### 10.1.1 이상치 검토 큐 (`audit_anomalies` reviewStatus = 'pending')

- 목록 페이지: 최근 24h 이상치 리스트
- 정렬: 심각도 높은 순 (type별 가중치)
- 필터: type, reviewStatus
- 개별 상세: 관련 유저 프로필 링크, 상세 증거

#### 10.1.2 일괄 조치 버튼

- "무시" (`reviewStatus = 'dismissed'`)
- "평판 감점" (선택 가능 -100/-300/-500/-1000)
- "유배 시작" (`sendToExile` CF 호출)
- "직권 사약" (`executeSayak` CF 호출)

#### 10.1.3 닉네임 수동 변경

- 신변 위협 등 예외 케이스
- 사유 필수 입력
- `nicknameChangeCount` 미증가
- `sanction_log` 자동 기록

### 10.2 어뷰징 통계 대시보드 요구사항

- 최근 30일 type별 건수 추이
- 자동 감점 vs 수동 검토 비율
- 평균 검토 처리 시간
- false positive 비율 (dismiss 비율)

### 10.3 위험 유저 프로필 뷰

유저 상세 페이지에 추가할 섹션:
- 평판 변동 그래프 (30일)
- 땡스볼 송수신 대상 분포 (pie chart)
- 유배 이력
- `audit_anomalies` 연관 건수

**상세**: `ADMIN.md` §N.N에서 통합 설계.

---

## 11. 데이터 모델 (types.ts 추가분)

### 11.1 신규/변경 타입 정의

```typescript
// src/types.ts

// ============================================
// 기존 UserData 확장
// ============================================
export interface UserData {
  // ... 기존 필드 ...
  
  // 🆕 닉네임 정책 (§8)
  nickname: string;
  previousNicknames?: string[];
  nicknameChangedAt?: FirestoreTimestamp;
  nicknameChangeCount?: number;
  
  // 🆕 휴대폰 인증 (Phase C, §7)
  phoneHash?: string;  // 평문 X, HMAC-SHA256
  phoneVerifiedAt?: FirestoreTimestamp;
  
  // 🆕 기득권 필드 (Phase C, TUNING_SCHEDULE.md §4)
  grandfatheredLevel?: number;
  grandfatheredAt?: FirestoreTimestamp;
}

// ============================================
// 🆕 예약 닉네임
// ============================================
export interface ReservedNickname {
  originalUid: string;
  reservedAt: FirestoreTimestamp;
  reservedReason: 'user_change' | 'admin_lock';
}

// ============================================
// 🆕 감사 이상치
// ============================================
export type AuditAnomalyType =
  | 'ball_mismatch'
  | 'circular_thanksball'
  | 'reputation_spike'
  | 'rapid_exp_gain'
  | 'duplicate_account'
  | 'nickname_change_suspicious';

export type AuditAnomalyAction =
  | 'none'
  | 'reputation_penalty'
  | 'review_required'
  | 'exile';

export type AuditAnomalyReviewStatus =
  | 'pending'
  | 'reviewed'
  | 'action_taken'
  | 'dismissed';

export interface AuditAnomaly {
  type: AuditAnomalyType;
  uid?: string;
  involvedUids?: string[];
  detectedAt: FirestoreTimestamp;
  details: Record<string, any>;
  autoAction: AuditAnomalyAction;
  reviewStatus: AuditAnomalyReviewStatus;
  reviewedBy?: string;
  reviewedAt?: FirestoreTimestamp;
  reviewNote?: string;
}

// ============================================
// 🆕 유저 일일 스냅샷
// ============================================
export interface UserDailySnapshot {
  uid: string;
  date: string;  // '20260419'
  exp: number;
  likes: number;
  totalShares: number;
  ballReceived: number;
  ballBalance: number;
  followerCount: number;
  reputationScore: number;
  creatorScore?: number;
  timestamp: FirestoreTimestamp;
}

// ============================================
// 🆕 공유 기록 (totalShares CF 이관 시)
// ============================================
export interface PostShare {
  uid: string;
  postId: string;
  method: 'kakao' | 'facebook' | 'link' | 'other';
  timestamp: FirestoreTimestamp;
}
```

### 11.2 Firestore 컬렉션 추가

| 컬렉션 | 용도 | Rules | Phase |
|--------|------|-------|:-----:|
| `reserved_nicknames` | 예약 닉네임 | CF 전용 write, auth read | A |
| `user_daily_snapshots` | 유저 일일 스냅샷 | admin/CF only | B |
| `post_shares` | 공유 멱등 기록 | CF 전용 | C |

---

## 12. 테스트 시나리오

### 12.1 테스트 계정 활용

**출처**: `CLAUDE.md` — 테스트 계정 14개
- 깐부1~10호 (Lv1~10, 일반 유저 시뮬)
- 불량깐부1~3호 (Lv3/4/5, 어뷰저 시뮬)

### 12.2 Layer 1 Rules 테스트

| # | 행위자 | 행위 | 기대 결과 |
|:-:|-------|------|----------|
| 1 | 깐부1호 | 정상 글 작성 (+2 exp) | ✅ 통과 |
| 2 | 깐부1호 (F12) | `exp: 99999` 직접 수정 | 🔴 `permission-denied` |
| 3 | 깐부1호 (F12) | `exp: increment(1000)` | 🔴 `permission-denied` |
| 4 | 깐부1호 (F12) | `exp: increment(-10)` | 🔴 `permission-denied` |
| 5 | 깐부2호 (F12) | 깐부3호 `likes: increment(3000)` | 🔴 `permission-denied` |
| 6 | 깐부2호 (F12) | 깐부3호 `likes: increment(-3)` | 🔴 `permission-denied` |
| 7 | 깐부2호 | 깐부3호 글 좋아요 클릭 (+3) | ✅ 통과 |

### 12.3 Layer 2 클라 로직 테스트

| # | 행위자 | 행위 | 기대 결과 |
|:-:|-------|------|----------|
| 8 | 깐부1호 | 깐부2호 맺기 | exp +2, 해제 시 변동 없음 |
| 9 | 깐부1호 | 글 삭제 | exp 변동 없음 (Phase A) |
| 10 | 깐부1호 | 9자 글 작성 | EXP 미지급 (`isEligibleForExp=false`) |

### 12.4 Layer 3 CF 탐지 테스트

| # | 시나리오 | 기대 결과 |
|:-:|---------|----------|
| 11 | 깐부2호 ↔ 깐부3호 하루 50회 왕복 송금 | `detectCircularThanksball`에서 탐지, `audit_anomalies` 기록 |
| 12 | 깐부4호 24h likes +500 | `auditReputationAnomalies` 탐지 |
| 13 | 불량깐부1호 유배 중 EXP/평판 증가 시도 | 🔴 Rules 차단 |

### 12.5 §8 닉네임 정책 테스트

§8.7 참조 (7개 시나리오)

### 12.6 통합 시나리오

**시나리오 A: 어뷰저 종합 대응**
- 불량깐부1호 악플 10회 → 신고 3회 누적
- Rules가 평판 펌핑 차단
- `auditReputationAnomalies`가 이상치 기록
- 관리자 검토 큐 확인 → 유배 1차 조치
- 불량깐부1호 속죄금 10볼 미납 → 90일 후 사약

**시나리오 B: 정상 크리에이터 바이럴**
- 깐부10호 글 하나가 좋아요 500개 달성
- `auditReputationAnomalies`가 pending으로 분류
- 관리자 검토 → 실제 글 내용 확인 → 자연 바이럴 판정 → dismiss
- 평판 감점 없음

**시나리오 C: 닉네임 세탁 시도**
- 불량깐부2호 악플로 유명해짐
- 닉네임 변경 시도 → 100볼 지불 후 성공
- 공개 프로필에 "이전 닉네임: 불량깐부2호" 영구 표시
- 타 유저가 이력 보고 경계

---

## 13. Step별 구현 우선순위

### 13.1 Step 1 범위 (지금 ~ 투자 유치 기획서)

**산출물**: 본 설계서 완성 + Rules 즉시 적용

| 순서 | 작업 | 파일 | 난이도 | 효과 |
|:----:|------|------|:------:|:---:|
| 1 | 본 문서 승인 | `ANTI_ABUSE.md` | — | — |
| 2 | **🔴 Rules 즉시 패치** | `firestore.rules` | 🟢 하 | 🔴 상 |
| 3 | 깐부 EXP 완화 (+2/0) | `useFirestoreActions.ts` | 🟢 하 | 🟡 중 |
| 4 | 삭제 시 exp 변동 제거 (Phase A 임시) | `useFirestoreActions.ts` | 🟢 하 | 🟢 하 |
| 5 | `types.ts` 신규 타입 추가 | `types.ts` | 🟢 하 | — |
| 6 | `reserved_nicknames` Rules | `firestore.rules` | 🟢 하 | — |

### 13.2 Step 2 범위 (기능 보완)

| 작업 | 관련 섹션 | 비고 |
|------|----------|------|
| `changeNickname` CF 구현 | §8.4 | 평생 1회 유료 변경 |
| `ProfileEditForm` 닉네임 변경 UI | §8.5 | |
| `PublicProfile` 이력 표시 | §8.5 | |
| 품질 가중치 EXP 공식 구현 | §5.2.3 | v2 §2.3.2 |
| `detectCircularThanksball` CF (최소 버전) | §6.2.1 | 검토 큐만, 자동 감점 X |
| `auditReputationAnomalies` CF | §6.2.2 | 검토 큐만 |
| `snapshotUserDaily` CF | §9.2.1 | 이상치 탐지 기준값 |

### 13.3 Step 3 범위 (로그인/회원가입 재설계)

| 작업 | 비고 |
|------|------|
| Firebase Phone Auth 통합 | §7.3.2 |
| `completeSignup` CF (Phase C 설계, 구현만) | §7.3.3, 플래그로 비활성 |
| 베타 유저 마이그레이션 플랜 확정 | §7.3.4 |
| SMS 공급자 선정 | §7.4 |

### 13.4 Phase C 발동 작업 (정식 출시 + PG 연동)

- 휴대폰 인증 회원가입 필수화 플래그 활성
- 베타 유저 3개월 마이그레이션 기간 시작
- `detectDuplicateAccounts` CF 활성
- `detectCircularThanksball` 자동 감점 활성 (pending → reputation_penalty)
- `detectRapidExpGain` CF 활성

### 13.5 금지 작업 (Step 1 범위 밖)

- ❌ Phase C 휴대폰 인증 강제 구현 (베타 유저 이탈 우려)
- ❌ AI 기반 어뷰징 탐지 (데이터 부족)
- ❌ 실시간 스트림 탐지 (배치 충분)
- ❌ 자동 유배 CF (false positive 위험, 관리자 수동만)

---

## 📝 결론

글러브의 어뷰징 방지는 **4계층 방어 체계**로 Phase별 강도를 달리해 대응합니다.

**Phase A (현재)에서 즉시 해야 할 것**:
1. 🔴 **Rules 긴급 패치** — F12 공격 및 평판 펌핑/파괴 차단
2. 🟡 깐부 EXP 완화 — 다계정 루프 인센티브 감소
3. 🟢 데이터 모델 확장 — Step 2 이후 기능 대비

**Phase B (베타 종료)에서 할 것**:
- 품질 가중치 EXP 공식 + CF 탐지 체계 활성
- 닉네임 유료 변경 CF 구현
- 휴대폰 인증 필수화 예고

**Phase C (정식 출시 + PG 연동)에서 할 것**:
- 🔴 휴대폰 인증 회원가입 필수 — **어뷰징의 근본 차단**
- 다계정 탐지 CF 활성
- 자동 감점 시스템 활성

**핵심 통찰**:
- Rules = 비용 0, 효과 즉시 → Step 1 최우선
- 휴대폰 인증 = PG 연동 타이밍에 맞춰 → Phase C
- CF 탐지 = 배후 분석, 관리자 검토 중심 → 자동 처벌 신중

Step 1 완료 시 **"방어 선언서"** 확보 → 투자 유치 기획서에서 **"플랫폼 신뢰성"** 강력한 증거.

---

**문서 버전**: v1.0
**기준 환율**: 1볼 = 100원 (`PRICING.md`)
**다음 업데이트**: Rules 실제 배포 후 동작 검증 결과 반영 + ADMIN.md 작성 시 §10 상세 구현 링크
