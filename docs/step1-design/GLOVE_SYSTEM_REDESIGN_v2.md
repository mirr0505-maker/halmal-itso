# 🗺️ 글러브(GeuLove) 시스템 진단 & 재설계 로드맵 v2

> **문서 목적**: 레벨·평판·깐부·어뷰징 4대 핵심 시스템 + 아바타 평판 색·칭호·닉네임 정책을 단일 문서로 통합.
>
> 작성일: 2026-04-19 | **v2 변경점**: §3.5 아바타 이중 링 · §5.3 닉네임 정책 · §6 마패+칭호 통합 · §0에 "1볼=100원" 공식 가정 추가
>
> **근거 자료**: 13개 md 설계서 + `LEVEL_REPUTATION_KANBU.md`(실측) + `firestore.rules` + `src/types.ts` + `src/utils.ts` + `functions/thanksball.js`
>
> **관련 문서**: `PRICING.md` (별도, 가격 단일 진실 소스)
>
> **다음 단계**: 본 문서 승인 후 → 6개 상세 설계서 + PRICING.md 작성

---

## 📋 목차

- [0. 확정된 재설계 원칙](#0-확정된-재설계-원칙)
- [1. 전체 시스템 지도](#1-전체-시스템-지도)
- [2. 레벨·EXP 시스템](#2-레벨exp-시스템)
- [3. 평판 시스템](#3-평판-시스템)
- [4. 깐부 관계 시스템](#4-깐부-관계-시스템)
- [5. 어뷰징 방지 시스템](#5-어뷰징-방지-시스템)
- [6. 통합 크리에이터 점수 · 마패 · 칭호](#6-통합-크리에이터-점수--마패--칭호)
- [7. 구현 우선순위 & 로드맵](#7-구현-우선순위--로드맵)
- [8. 다음 설계서 작성 계획](#8-다음-설계서-작성-계획)
- [9. v2 결정사항 요약](#9-v2-결정사항-요약)

---

## 0. 확정된 재설계 원칙

### 0.1 핵심 원칙 4개 (v2에서 1개 추가)

| 원칙 | 내용 | 근거 |
|------|------|------|
| **깐부 방향성** | 단방향 팔로우 유지, 네이밍만 정리 | 유튜브 모델 지향, 크리에이터-팬 비대칭 관계 |
| **EXP 서버 검증** | 옵션 B — 설계만 완성, 이관은 PG 연동 시점 | MVP 과잉 설계 회피 |
| **어뷰징 방지** | Step 1 최우선 | 수익 모델 발동 시 반드시 뚫림 |
| **🆕 화폐 기준** | **1볼 = 100원** (공식 가정) | 모든 가격·수수료·수익 계산의 단일 기준 |

### 0.2 화폐 단위 기준 (1볼 = 100원)

본 문서 이후 **모든 볼 수치는 원화 환산과 병기** 원칙:

| 기준 | 볼 | 원화 |
|------|:---:|:----:|
| 1볼 | 1 | 100원 |
| 10볼 | 10 | 1,000원 |
| 100볼 | 100 | 10,000원 |
| 1,000볼 | 1,000 | 100,000원 |

**왜 100원?**
- 땡스볼 1회 단위 송금이 "100원어치 감사 표현"으로 직관적
- 1,000원짜리 후원 = 10볼 (간결)
- 유배 1차 속죄금 10볼 = 1,000원 = "경미한 벌금" 뉘앙스와 일치

**공식 가격표**: **별도 문서 `PRICING.md`** (가격 단일 진실 소스)에서 관리. 본 문서에서는 각 시스템 설명 시 필요한 수치만 원화 병기.

### 0.3 개발 수칙 (CLAUDE.md 준수)

- **Strict Focus**: 무관한 기존 코드 1픽셀도 변경 금지
- **Surgical Edit**: 파일 전체 덮어쓰기 금지
- **선보고 후실행**: AS-IS / TO-BE 보고 → 승인 → 실행
- **Human Readable**: 혼자 읽고 유지보수 가능하도록

---

## 1. 전체 시스템 지도

### 1.1 글러브 = 글 기반 크리에이터 이코노미 플랫폼

**비전**: "글로 밥 벌어먹고 살 수 있는 플랫폼" — 유튜브식 크리에이터 중심 모델의 글 기반 재해석.

### 1.2 5계층 아키텍처

```
╔═══════════════════════════════════════════════════════════════════╗
║  글러브 GeuLove · geulove.com                                      ║
║  React 19 + Firebase (Firestore/Auth/CF) + Cloudflare (R2+Workers) ║
╚═══════════════════════════════════════════════════════════════════╝

┌─ Layer 1: 콘텐츠 생산 ─────────────────────────────────────────┐
│  일반 글 (8개 카테고리)                                         │
│  🍞 헨젤의 빵부스러기 (1~4컷 캐러셀, Hook → Conversion)         │
│  🌳 거대나무 (주장 전파, 평판 게이트)                           │
│  🖋️ 잉크병 (연재 부분 유료화, 수수료 11%)                       │
│  🏪 강변시장 (가판대 Lv3+ / 단골장부 Lv5+, 수수료 30/25/20%)    │
└────────────────────────────────────────────────────────────────┘
                            ↓
┌─ Layer 2: 커뮤니티/그룹 공간 ──────────────────────────────────┐
│  🧤 장갑 (커뮤니티, 다섯 손가락 역할)                           │
│   ├─ 🛡️ 주주방 (주식 장갑 전용, tier 인증 — 글러브 전체와 격리) │
│   └─ 🤖 정보봇 (주식 장갑, 월 20볼=2,000원)                     │
│  🏠 깐부방 (호스트 사적 공간, 5탭 + 🔴 라이브)                  │
└────────────────────────────────────────────────────────────────┘
                            ↓
┌─ Layer 3: 참여·평판·경제 ──────────────────────────────────────┐
│  👥 깐부수 (나를 팔로우한 사람 수, 크리에이터 지표)              │
│  ❤️ 좋아요  💬 댓글  🤝 공유                                     │
│  ⚾ 땡스볼 (후원 + 라이브 VFX)                                   │
│  📊 레벨 1~10 (EXP 기반 실시간 계산)                             │
│  🎖️ 평판 중립~확고 (본 게임 5단계) + 🌟전설/⚡경외/🔮신화 (Prestige 3단계)│
│  🎨 아바타 이중 링 (안쪽=레벨, 바깥=평판) 🆕v2                  │
│  🏦 ballBalance (실사용) + ballReceived (평판 누적)             │
│  🔒 멱등 ball_transactions + 일일 감사 snapshotBallBalance      │
└────────────────────────────────────────────────────────────────┘
                            ↓
┌─ Layer 4: 수익화 파이프라인 ───────────────────────────────────┐
│  🏪 강변시장 판매       Lv3-4 30% / Lv5-6 25% / Lv7+ 20%        │
│  🖋️ 잉크병 유료 회차     플랫폼 수수료 11%                       │
│  🏠 깐부방 유료게시판    수수료 30/25/20%                        │
│  📢 광고 경매 (Lv5+)     작성자 30/50/70% (Lv5-6/7-8/9-10)      │
│  🔴 라이브 땡스볼        호스트 분배                              │
│  🤖 정보봇               플랫폼 100%                              │
│  🏷️ 닉네임 변경 수수료   100볼/10,000원 (평생 1회) 🆕v2          │
│                                                                 │
│  → pendingRevenue → WithdrawModal → SettlementQueue             │
│  → 원천세(사업자 3.3% / 기타 8.8%) → 지급 (최소 30,000원=300볼) │
└────────────────────────────────────────────────────────────────┘
                            ↓
┌─ Layer 5: 거버넌스/안전장치 ───────────────────────────────────┐
│  🏚️ 유배귀양지 (4진 아웃)                                       │
│   ├─ 1차 곳간(3일/10볼=1,000원) → 2차 무인도(7일/50볼=5,000원)  │
│   ├─ 3차 절해고도(30일/300볼=30,000원) → 4차 ☠️ 사약 (영구밴)   │
│   └─ 속죄금 소각 + 깐부 리셋 + 자산 몰수                         │
│  📊 일일 감사 (04:00 스냅샷 + 04:30 검증)                        │
│  🚨 detectFraud (광고 부정클릭)                                  │
│  🔒 닉네임 변경 이력 공개 + 이전 닉 영구 예약 🆕v2               │
└────────────────────────────────────────────────────────────────┘
```

### 1.3 현재 구현 완성도

| 시스템 | 상태 | 비고 |
|--------|------|------|
| 땡스볼 + 감사 | ✅ 매우 견고 | 멱등성·트랜잭션·감사 완비 |
| 유배귀양지 | ✅ 거의 완성 | Phase 1~3 완료, 휴대폰 인증만 대기 |
| 잉크병 | ✅ 완성 | Phase 1~5 완료 |
| 강변시장 | ✅ 완성 | Phase 1~5 완료 |
| 깐부방 | ✅ 거의 완성 | Phase 4-A(라이브) 완료, Phase 4-B~E 대기 |
| 주주 인증 | ✅ 완성 | Phase A~H + Codef 샌드박스 완료 |
| 광고 경매 | 🟡 80% | 코드 완료, 애드센스·PG 외부 대기 |
| **레벨·EXP** | 🔴 **재설계 필요** | 서버 검증 공백, 어뷰징 취약 |
| **평판 공식** | 🔴 **재설계 필요** | 2개 공식 공존, 가중치 불균형 |
| **깐부 시스템** | 🟡 **네이밍 정리 필요** | 단방향인데 이름은 "깐부" |
| **아바타 평판 색** | ⚪ **신규 (v2)** | 이중 링 제안 |
| **닉네임 정책** | 🟡 **정책 변경 (v2)** | 무제한 → 유료 1회 |
| **통합 크리에이터 점수** | ⚪ **신규 설계** | 존재하지 않음 |
| **마패 + 칭호** | ⚪ **신규 설계 (v2 통합)** | 존재하지 않음 |
| **어뷰징 방지** | 🟡 **부분** | 땡스볼은 견고, EXP/평판/깐부 공백 |

---

## 2. 레벨·EXP 시스템

### 2.1 현재 상태 (실측)

#### 2.1.1 레벨 테이블

**출처**: `src/utils.ts:48-54`

```typescript
const LEVEL_TABLE = [0, 30, 100, 250, 500, 1000, 2000, 4000, 7000, 10000];
```

| 레벨 | 필요 누적 EXP | 차이 |
|:----:|:-------------:|:-----:|
| Lv1  | 0             | —    |
| Lv2  | 30            | +30  |
| Lv3  | 100           | +70  |
| Lv4  | 250           | +150 |
| Lv5  | 500           | +250 |
| Lv6  | 1,000         | +500 |
| Lv7  | 2,000         | +1,000 |
| Lv8  | 4,000         | +2,000 |
| Lv9  | 7,000         | +3,000 |
| Lv10 | 10,000        | +3,000 |

#### 2.1.2 EXP 증감 트리거 전수

| 이벤트 | 증감 | 조건 | 처리 주체 |
|--------|:----:|------|-----------|
| 글 작성 | **+2** | 본문 10자↑ & 클라 60초 쿨다운 | 클라이언트 |
| 댓글 작성 | **+2** | 본문 10자↑ & 클라 15초 쿨다운 | 클라이언트 |
| 내 글 좋아요 3개 달성 | **+5** | 2→3 전환 1회 | 클라이언트 |
| 타인 글 조회 | **+1** | 세션당 1회 | 클라이언트 |
| 깐부 맺기 | **+10** | arrayUnion | 클라이언트 |
| 깐부 해제 | **−15** | arrayRemove | 클라이언트 |
| 글/댓글 삭제 | **−2** | 음수 방지 없음 | 클라이언트 |
| **땡스볼 송금** | **+1** | thanksball.js | **서버 (CF)** |

#### 2.1.3 Rate Limit (쿨다운)

**출처**: `src/hooks/useFirestoreActions.ts:13-16`

```typescript
const RATE_LIMIT = { POST_COOLDOWN_MS: 60_000, COMMENT_COOLDOWN_MS: 15_000 };
let lastPostTime = 0;
```

- 클라이언트 module-scope 변수 — 새로고침·멀티탭·다기기 시 초기화
- Firestore Rules에 서버 가드 없음
- 유일한 서버 쿨다운: 땡스볼 `MIN_INTERVAL_MS=3000`

#### 2.1.4 Firestore Rules 실측 (users 컬렉션)

**차단된 필드 (CF 전용)**:
- `ballBalance` ✅
- `promoEnabled`, `promoExpireAt`, `promoPlan`, `promoUpdatedAt` ✅

**본인 수정 허용**:
- `exp` 🔴 **게이트 없음** — F12로 임의 수정 가능
- `likes`, `totalShares` 🔴 본인도 타인도 수정 가능
- `friendList` 🟡 본인만 (arrayUnion)

#### 2.1.5 UserData 타입 불일치 발견

`src/types.ts:42-47`:
```typescript
export interface UserData {
  level: number;       // 🔴 필수!
  exp?: number;        // 🔴 옵셔널!
```

`LEVEL_REPUTATION_KANBU.md`와 반대. **검증 필요**: 실제 DB에 level 저장되는지.

### 2.2 문제점 분석

#### 🔴 Critical-1: F12 한 줄로 Lv10 달성

```javascript
updateDoc(doc(db, 'users', currentUid), { exp: 99999 });
```

Rules가 본인 exp 수정 미차단. **Lv10 즉시 달성**. 수익 게이트 무력화.

#### 🔴 Critical-2: 클라 쿨다운 무효

```javascript
lastPostTime = 0;  // 콘솔 한 줄
```

Puppeteer로 10자 글 300개 = +600 EXP = Lv5. 30분 내 가능.

#### 🔴 Critical-3: EXP 공식이 품질 미반영

- 10자도 +2, 1만자도 +2
- 아무도 안 보는 글도 +2
- **스팸 생산 친화적** 구조

#### 🟡 Major-1: EXP 삭제 시 음수 허용

#### 🟡 Major-2: 처리 주체 불일치

땡스볼 EXP(+1)는 서버, 글/댓글 EXP(+2)는 클라 — 거꾸로.

### 2.3 변경 방향

#### 2.3.1 레벨 테이블 — **유지**

현재 10단계 곡선은 적정.

#### 2.3.2 EXP 공식 — **품질 가중치 도입**

**AS-IS**: 글 작성 +2 (일률)

**TO-BE**: 본문 길이 계단식 + 반응 가중치

```
기본 EXP:
  10~99자   → +1
  100~299자 → +2
  300~999자 → +4
  1000자+   → +6

품질 보너스 (1회):
  이미지 포함 → +1
  링크 1개+   → +1

반응 역류 (타인 반응 시 작성자에게):
  좋아요 1개        → +1
  땡스볼 수신 1볼당 → +0.2 (누적 → 정수 발행)
  공유 1회          → +2

총 상한: 1개 글당 +50 EXP
```

#### 2.3.3 쿨다운 — 서버 이관 설계 (Phase B)

**Phase B 1단계 (지금)**: Rules 약한 가드

```javascript
// exp 1회 증가 +100 이하, 음수 불가
```

**Phase B 2단계 (PG 연동 시점)**: CF 이관
- `awardExpForPost` (onCreate 트리거)
- `awardExpForReaction` (onCall)

#### 2.3.4 음수 EXP 방지

```typescript
await updateDoc(userRef, { exp: Math.max(0, currentExp - 2) });
```

### 2.4 테스트 시나리오

- **깐부1호 (봇)**: 10자 글 100개 → 변경 후 EXP 감소 확인
- **깐부2호 (정상)**: 500자 + 이미지 → 가산 확인
- **깐부3호 (바이럴)**: 깐부4~10호가 반응 → 역류 확인
- **불량깐부1호**: 유배 중 작성 → EXP 미지급 확인

### 2.5 `level` 필드 정리

**제안**: 옵션 A (DB 미저장, 실시간 계산)

---

## 3. 평판 시스템

### 3.1 현재 상태 (실측)

#### 3.1.1 두 개의 공식 공존

**공식 1 — 메인 (전체 사용)** `src/utils.ts:101-103`:
```typescript
export const getReputationScore = (userData): number => {
  return (userData.likes || 0) * 2
       + (userData.totalShares || 0) * 3
       + (userData.ballReceived || 0) * 5;
};
```

**공식 2 — 활동 기반 (ActivityMilestones 전용, "향후 전체 반영 예정")** `src/utils.ts:135-142`:
```typescript
export const calculateReputation = (...) => {
  return (rootCount * 5) + (formalCount * 2) + (commentCount * 1)
       + (totalLikesReceived * 3) + (totalSharesReceived * 2);
};
```

#### 3.1.2 Tier 테이블 (v2 확장: Prestige 3단계 추가)

| Tier | 점수 | 색상 | 레이어 |
|------|:----:|------|:------:|
| 중립 | < 300 | slate | 본 게임 |
| 약간 우호 | 300–999 | emerald-50 | 본 게임 |
| 우호 | 1,000–1,999 | emerald-500 | 본 게임 |
| 매우 우호 | 2,000–2,999 | violet-500 | 본 게임 |
| 확고 | 3,000–9,999 | purple-600 | 본 게임 |
| 🌟 **전설 (Legend)** | 10,000–49,999 | 금빛 + 회전 애니메이션 | **Prestige** |
| ⚡ **경외 (Awe)** | 50,000–99,999 | 무지개 링 + 빛 발산 | **Prestige** |
| 🔮 **신화 (Mythic)** | 100,000+ | 우주 배경 + 별 파티클 | **Prestige** |

**Prestige 레이어 원칙** (§6.10 상세 설계):

| 단계 | 상태 | 활동 |
|:----:|------|------|
| **Phase A (현재)** | 🔒 **비활성** | 설계·문서화만. 코드 플래그 `PRESTIGE_REPUTATION_ENABLED=false` |
| **Phase B (베타 종료)** | 📢 **예고** | "정식 출시와 함께 공개 예정" 공지만 |
| **Phase C (정식 출시 후)** | ✅ **발동** | 플래그 true, 첫 Prestige 달성자 등장 |

**설계 철학**:
- 본 게임(5단계)의 **천장 돌파자를 위한 추가 단계**
- 극한의 희소성 (로그 스케일 경계값)
- **Phase A에서 활성화 절대 금지** — 데이터 없이 조기 발동 시 의미 상실

#### 3.1.3 가중치 실효

```
1회 좋아요 → +6 평판
1회 공유   → +3 평판
1볼 땡스볼 → +5 평판
```

### 3.2 문제점 분석

#### 🔴 Critical-1: `likes` 타인 수정 허용 → 평판 펌핑

```javascript
for (let i = 0; i < 1000; i++) {
  await updateDoc(doc(db,'users',victimUid), { likes: increment(3) });
}
// 평판 +6000 (중립 → 확고)
```

또한 `increment(-3)`로 **타인 평판 공격** 가능.

#### 🔴 Critical-2: `totalShares` 검증 부재

```javascript
for (let i = 0; i < 1000; i++) {
  await updateDoc(doc(db,'users',myUid), { totalShares: increment(1) });
}
```

#### 🟠 Major-1: ballReceived 가중치 5 — 돈으로 평판 구매

평판 "확고"(3,000점) 달성:
- 좋아요만: 1,500회
- 공유만: 1,000회
- 땡스볼만: **600볼 (60,000원)**

맞땡스볼 담합 가능 (A↔B 왕복 분당 20회).

#### 🟠 Major-2: 시간 감쇠 없음

2026년 바이럴 유저가 2030년에도 점수 보유 → 신규 유저 기회 감소.

#### 🟠 Major-3: 평판과 레벨 완전 분리

Lv10 + 평판 중립 가능 / 평판 확고 + Lv2 가능. 수익 게이트는 레벨에만.

### 3.3 변경 방향

#### 3.3.1 단기 — Rules 보강

**AS-IS** (`firestore.rules:294-298`):
```javascript
allow update: if request.auth != null
  && request.auth.uid != id
  && request.resource.data.diff(resource.data).affectedKeys()
      .hasOnly(['likes', 'totalShares', 'promoViewCount']);
```

**TO-BE**:
```javascript
allow update: if request.auth != null
  && request.auth.uid != id
  && request.resource.data.diff(resource.data).affectedKeys()
      .hasOnly(['likes', 'totalShares', 'promoViewCount'])
  // 🆕 증가만, 감소 차단
  && request.resource.data.likes >= resource.data.likes
  && request.resource.data.totalShares >= resource.data.totalShares
  // 🆕 1회 증가 한도
  && request.resource.data.likes - resource.data.likes <= 3
  && request.resource.data.totalShares - resource.data.totalShares <= 1;
```

#### 3.3.2 중기 — 공식 개선 (시간 감쇠 + 어뷰징 감점)

```
기본 평판 = (likes×2 + totalShares×3 + ballReceived×5) × 시간_감쇠
최종 평판 = 기본 평판 - 어뷰징_감점

시간_감쇠:
  최근 30일 활동 → 1.0
  활동 끊긴 지 30일 초과 시 월 1% 감소
  최소 0.5

어뷰징_감점:
  짧은 글 스팸 비율 50%+ → -500
  맞땡스볼 의심 탐지 → -300
  다계정 의심 → -1000
```

#### 3.3.3 중기 — 단일 공식 통합

`calculateReputation`(공식 2) 폐지. 메인 공식 1로 통일.

### 3.4 테스트 시나리오

- **깐부1호**: likes +3 1000회 → Rules 강화 후 3회만 성공
- **깐부2호 ↔ 깐부3호**: 하루 100볼씩 왕복 → 어뷰징 감점 발동
- **깐부4호**: 과거 2,000점, 60일 미활동 → 1,400점 감소 확인

### 3.5 🆕 v2 추가: 아바타 평판 색 (이중 링)

#### 3.5.1 현재 상태

- `getLevelStyle(level)`: 아바타 배경 레벨 색 ✅ 존재
- `getReputationStyle(score)`: 배지용 평판 색 ✅ 존재
- **아바타에는 레벨 색만** 사용 중
- **평판은 텍스트 배지**로 별도 표시

#### 3.5.2 TO-BE: 이중 링 시각화

**개념도**:
```
┌─ 바깥 링: 평판 색 (ring-4) ─┐
│ ┌─ 안쪽 링: 레벨 색 (border-2) ─┐ │
│ │     [아바타 이미지]           │ │
│ │        또는 이니셜           │ │
│ └─────────────────────────────┘ │
└────────────────────────────────┘
```

**매트릭스** (Prestige 포함 8단계):

| 평판 등급 | 바깥 링 (평판) | 안쪽 링 (레벨) | 활성 Phase |
|-----------|---------------|---------------|:---------:|
| 중립 | `ring-slate-200` | slate-400 ~ purple-600 (기존) | A/B/C |
| 약간 우호 | `ring-emerald-200` | 동일 | A/B/C |
| 우호 | `ring-emerald-400` | 동일 | A/B/C |
| 매우 우호 | `ring-violet-500` | 동일 | A/B/C |
| 확고 | `ring-purple-600` + `animate-pulse` | 동일 | A/B/C |
| 🌟 **전설** | `ring-amber-400` + `animate-spin-slow` (금빛 회전) | 동일 | 🔒 **C만** |
| ⚡ **경외** | `ring-gradient-rainbow` + 빛 발산 효과 | 동일 | 🔒 **C만** |
| 🔮 **신화** | 우주 배경 + 별 파티클 배경 | 동일 | 🔒 **C만** |

**구현 주의**:
- Prestige 3단계 시각은 Phase C 발동 시까지 **CSS 미구현**
- Phase A/B에서 평판이 10,000 초과 시 "확고" 시각 그대로 표시 (`getReputationRingColor` 내부에서 캡)

#### 3.5.3 구현 방식 (CSS 스케치)

```tsx
<div className={`
  relative rounded-full 
  ring-4 ${getReputationRingColor(reputationScore)}
  ring-offset-2
`}>
  <div className={`
    rounded-full border-2 ${getLevelBorderColor(level)}
    ${getLevelStyle(level)}
  `}>
    <img src={avatarUrl} />
  </div>
</div>
```

**신규 유틸 함수** (`src/utils.ts` 추가 예정):
```typescript
export const getReputationRingColor = (score: number): string => {
  if (score >= 3000) return "ring-purple-600 animate-pulse";
  if (score >= 2000) return "ring-violet-500";
  if (score >= 1000) return "ring-emerald-400";
  if (score >= 300) return "ring-emerald-200";
  return "ring-slate-200";
};

export const getLevelBorderColor = (level: number): string => {
  if (level >= 10) return "border-rose-500";
  if (level >= 8) return "border-purple-600";
  if (level >= 6) return "border-indigo-600";
  if (level >= 4) return "border-blue-600";
  if (level >= 2) return "border-sky-400";
  return "border-slate-400";
};
```

#### 3.5.4 적용 위치

**전체 앱 아바타 렌더 지점** (예상 주요 컴포넌트):
- `PostCard.tsx` — 글 카드 아바타
- `RootPostCard.tsx` — 상세 뷰 작성자 아바타
- `PublicProfile.tsx` — 공개 프로필
- `ProfileHeader.tsx` — 내 프로필
- `DebateBoard.tsx` — 댓글 작성자
- `CommunityChatPanel.tsx` — 채팅 아바타
- `KanbuPromoCard.tsx` — 깐부 홍보

**공통 아바타 컴포넌트 신설 제안**: `<ReputationAvatar user={userData} size="md" />` — 위 로직 캡슐화, 일괄 변경 용이.

#### 3.5.5 접근성 고려

- 색상만으로 평판 구분 ❌ → **툴팁 추가**: 호버 시 "평판: 우호 (1,234점)"
- 색맹 사용자 대응: 평판 등급 텍스트 병기

#### 3.5.6 테스트 시나리오

- **깐부1호 (Lv1 · 평판 중립)**: 슬레이트 + 슬레이트 (단조로움)
- **깐부5호 (Lv5 · 평판 우호)**: 파란 테두리 + 녹색 링
- **깐부10호 (Lv10 · 평판 확고)**: 분홍 테두리 + 보라 펄스 링 (가장 화려)

---

## 4. 깐부 관계 시스템

### 4.1 현재 상태 (실측)

#### 4.1.1 데이터 구조

`src/types.ts:53` + `src/hooks/useFirestoreActions.ts:215-226`:
```typescript
interface UserData {
  friendList?: string[];  // 내가 맺은 깐부 닉네임 목록
}
```

- 저장: 본인 `users` 문서 배열
- 키: **닉네임 문자열** (UID 아님)
- 상대 문서 쓰기 없음 → **완전 단방향**

#### 4.1.2 집계 로직

`src/hooks/useFirebaseListeners.ts:61-77`:
```typescript
unsubUsers = onSnapshot(collection(db, "users"), (snapshot) => {
  // 전체 users 구독 → 모든 friendList 순회
  // followerCounts[nickname] 집계
});
```

#### 4.1.3 UI 네이밍

| 변수명 | 실제 의미 | UI 표기 |
|--------|----------|---------|
| `friendCount` | 내가 맺은 깐부 | "깐부 N명" |
| `followerCount` | 나를 맺은 사람 = 깐부수 | "깐부수 N" |

### 4.2 문제점 분석

#### 🟠 Major-1: "깐부"와 단방향의 의미 괴리

"깐부" = 오징어 게임의 "상호 친밀한 관계". 현재는 단방향 팔로우.

#### 🟠 Major-2: 변수명 혼동

"깐부" vs "깐부수" — 한 글자 차이.

#### 🟠 Major-3: 닉네임 키 방식

닉네임 변경 시 관계 깨질 수 있음. 30일 쿨다운으로 부분 완화.

#### 🟠 Major-4: 전체 users 구독 = 확장성 폭탄

유저 1만 명 시점: 앱 진입 시 1만 문서 다운로드, 월 $108 비용.

#### 🟢 Minor-1: 깐부 EXP +10/-15 어뷰징

### 4.3 변경 방향

#### 4.3.1 네이밍 재정립 — **UI는 한국어, 변수명은 기존 유지**

**결정 원칙** (2026-04-19 확정):
- **UI 표기는 한국어 통일**: 깐부 / 깐부수 / 맞깐부
- **변수명은 기존 영문 유지**: 마이그레이션 비용 회피
- **types.ts 주석으로 의미 명시** → 1인 개발자 혼란 방지

**용어 매트릭스**:

| 개념 | UI 표기 | 변수명 (변경 없음) | 크리에이터 관점 |
|------|---------|------------------|----------------|
| 내가 팔로우한 사람 | **"깐부 N명"** | `friendCount` / `friendList` | 내가 구독하는 채널 |
| 나를 팔로우한 사람 | **"깐부수 N"** | `followerCount` / `followerCounts` | **내 팬 = 크리에이터 지표 ⭐** |
| 상호 팔로우 관계 | **"🤝 맞깐부"** | `mutualKanbu` (신규) | 특수 배지 (선택적) |

**핵심 관점**:

> 🎯 **"나는 깐부수를 늘려야 한다"** — 크리에이터 성공 공식
> - 깐부 = 내가 소비하는 축
> - 깐부수 = 내가 생산하는 축 (유튜브 구독자 = 글러브 깐부수)

**types.ts 주석 보강 (Step 2)**:
```typescript
interface UserData {
  /** 내가 맺은 깐부(팔로우 중인 유저)의 닉네임 목록 — UI에서 "깐부 N명" */
  friendList?: string[];
  // followerCount는 별도 실시간 집계, users 문서에 미저장
}
```

#### 4.3.2 UID 마이그레이션 — 설계만, 구현 미룸

```
현재: friendList: string[]  // 닉네임
미래: friendList: string[]  // UID
```

**Step 4 이후** 일괄 마이그레이션.

#### 4.3.3 users 구독 개선 — 단기/중기/장기

- **단기 (Step 2)**: 현상 유지
- **중기 (1,000명)**: `followerCount` 비정규화 + CF 트리거
- **장기 (1만 명)**: `follow_relations` 별도 컬렉션

#### 4.3.4 맺기 EXP 완화

- AS-IS: +10 / -15
- TO-BE: +2 / 0

### 4.4 테스트 시나리오

- **깐부1호 (단방향)**: 깐부2호 팔로우 → 깐부1호만 friendList 등록
- **깐부2호 (맞깐부)**: 상호 팔로우 → "맞깐부" 배지
- **깐부3호 (네이밍)**: 프로필 → "깐부 5명 / 깐부수 120" 표시 확인

---

## 5. 어뷰징 방지 시스템

### 5.1 현재 방어막 실측

#### 5.1.1 견고한 영역

**✅ 땡스볼 (`functions/thanksball.js`)** — 모범 사례:
- `clientRequestId` 멱등키
- `MIN_INTERVAL_MS=3000` 서버 쿨다운
- `MAX_AMOUNT_PER_TX=10000` (100만원) ⚠️ 추후 조정 필요
- 유배자 송금 차단 + 사약자 수신 차단
- 자기 송금 이중 검증

**✅ 볼 잔액**: Rules 차단, CF 전용, 일일 감사

**✅ 유배**: sanctionStatus CF 전용, 휴대폰 블랙리스트

**✅ 잉크병**: private_data 분리, 구매 영수증 CF

**✅ 광고**: adEvents CF 전용, detectFraud

#### 5.1.2 공백 영역

- 🔴 EXP 필드 가드 부재
- 🔴 likes/totalShares 타인 수정 무제한
- 🟠 깐부 맺기/해제 EXP 어뷰징
- 🟠 짧은 글 스팸 (10자+)
- 🟢 닉네임 기반 깐부
- 🟢 totalShares 클라 증가
- 🟠 **닉네임 무제한 변경** (🆕 v2 인식)

### 5.2 어뷰징 시나리오

#### 시나리오 1: 봇 대량 가입 + EXP 조작
#### 시나리오 2: 맞땡스볼 담합 (평판 세탁)
#### 시나리오 3: 좋아요 펌핑
#### 시나리오 4: 깐부 EXP 루프
#### 🆕 시나리오 5: 닉네임 변경 세탁

> 불량깐부2호가 악플 10회 + 신고 3회 누적. 닉네임 `악플왕` → `새사람`으로 바꿔 과거 세탁.

**현재**: 30일 쿨다운만 있어 세탁 가능

**방어**: 닉네임 정책 개편 (§5.3.5)

### 5.3 변경 방향 — 계층별 방어

#### Layer 1: Firestore Rules 강화 (즉시)

```javascript
match /users/{id} {
  // 🆕 본인 exp: +100 이하, 음수 불가
  allow update: if request.auth.uid == id
    && !request.resource.data.diff(resource.data).affectedKeys()
        .hasAny(['ballBalance', 'promoEnabled', /* ... */])
    && (
      !('exp' in request.resource.data.diff(resource.data).affectedKeys())
      || (request.resource.data.exp >= resource.data.exp
          && request.resource.data.exp - resource.data.exp <= 100)
    );

  // 🆕 타인 likes/totalShares: 증가만, 1회 상한
  allow update: if request.auth.uid != id
    && request.resource.data.diff(resource.data).affectedKeys()
        .hasOnly(['likes', 'totalShares', 'promoViewCount'])
    && request.resource.data.likes >= resource.data.likes
    && request.resource.data.totalShares >= resource.data.totalShares
    && request.resource.data.likes - resource.data.likes <= 3
    && request.resource.data.totalShares - resource.data.totalShares <= 1;
}
```

#### Layer 2: 클라이언트 로직 보강 (Step 2)

- `toggleFriend`: +10 → +2
- 삭제 시 `Math.max(0, exp - 2)`
- 조회 EXP → Firestore 마커

#### Layer 3: Cloud Function 이관 (Phase B 2단계)

- `awardExpForPost` (onCreate)
- `awardExpForReaction` (onCall)
- `detectCircularThanksball` (스케줄)
- `auditReputationAnomalies` (스케줄)

#### Layer 4: 휴대폰 인증 게이트 (장기)

- 가입 시 선택, 수익 진입 시 필수 (Lv5+)
- `phoneHash` 블랙리스트

### 5.3.5 🆕 v2 추가: 닉네임 변경 정책 개편

#### 현재 상태

- 30일 쿨다운만 존재
- 무제한 변경 가능 (쿨다운 준수 시)
- `nicknameChangedAt` 필드로 마지막 변경일 추적

#### 문제 5가지 (시나리오 분석)

1. 가입 시 오타 수정 어려움 (쿨다운 30일)
2. 오글오글 닉네임 평생 후회 (장기 서비스 시)
3. 신변 위협 시 대응 느림
4. **평판 세탁 수단 악용**
5. **닉네임 재사용으로 사칭 공격** 가능

#### TO-BE: "옵션 C 변형" 정책

**규칙 5가지**:

1. **가입 후 변경 완전 금지** (쿨다운 아닌 금지)
2. **단, 평생 1회 한정 유료 변경** 허용
3. **변경 수수료: 100볼 (10,000원)** — 플랫폼 소각
4. **이전 닉네임 영구 예약** (본인 포함 누구도 재사용 불가)
5. **공개 프로필에 변경 이력 영구 표시**

#### 데이터 모델 변경

**`users/{uid}`**:
```typescript
interface UserData {
  nickname: string;
  previousNicknames?: string[];     // 🆕 변경 이력 (최대 1개, 평생 1회)
  nicknameChangedAt?: FirestoreTimestamp;  // 🔄 기존 유지 (변경 시점)
  // nicknameChangeCount 🆕 — 1이면 더 변경 불가
  nicknameChangeCount?: number;     // 🆕 0 or 1 (초기값 0)
}
```

**`reserved_nicknames/{oldNickname}`** 🆕 신규 컬렉션:
```typescript
{
  originalUid: string;           // 원래 소유자 UID
  reservedAt: FirestoreTimestamp;
  reservedReason: 'user_change' | 'admin_lock';
}
```

#### Firestore Rules

```javascript
match /users/{id} {
  // 🆕 닉네임 변경 조건
  allow update: if request.auth.uid == id
    && (
      // 닉네임 변경 없으면 기존 로직
      !('nickname' in request.resource.data.diff(resource.data).affectedKeys())
      ||
      // 닉네임 변경 시: CF 경유만 허용 (Rules 단독 불가)
      false  // CF Admin SDK만 변경 가능
    );
}

// 🆕 예약된 닉네임
match /reserved_nicknames/{oldNick} {
  allow read: if request.auth != null;  // 사용 가능 여부 확인
  allow write: if false;  // CF 전용
}
```

#### Cloud Function: `changeNickname`

```javascript
// functions/nickname.js (신규)
exports.changeNickname = onCall(
  { region: "asia-northeast3" },
  async (request) => {
    const { newNickname } = request.data;
    const uid = request.auth.uid;
    const FEE = 100;  // 100볼 = 10,000원

    return await db.runTransaction(async (tx) => {
      const userRef = db.collection('users').doc(uid);
      const userSnap = await tx.get(userRef);
      const userData = userSnap.data();

      // 1. 변경 이력 1회 초과 차단
      if ((userData.nicknameChangeCount || 0) >= 1) {
        throw new HttpsError('permission-denied', '닉네임 변경은 평생 1회만 가능합니다.');
      }

      // 2. 잔액 체크
      if ((userData.ballBalance || 0) < FEE) {
        throw new HttpsError('failed-precondition', `${FEE}볼(${FEE*100}원)이 필요합니다.`);
      }

      // 3. 새 닉네임 중복 체크 + 예약 체크
      const newNickDoc = await tx.get(db.collection('users').doc(`nickname_${newNickname}`));
      if (newNickDoc.exists) {
        throw new HttpsError('already-exists', '이미 사용 중인 닉네임입니다.');
      }
      const reservedDoc = await tx.get(db.collection('reserved_nicknames').doc(newNickname));
      if (reservedDoc.exists) {
        throw new HttpsError('already-exists', '예약된 닉네임입니다.');
      }

      // 4. 이전 닉네임 영구 예약
      const oldNickname = userData.nickname;
      tx.set(db.collection('reserved_nicknames').doc(oldNickname), {
        originalUid: uid,
        reservedAt: Timestamp.now(),
        reservedReason: 'user_change',
      });

      // 5. 볼 차감 (100볼 소각)
      tx.update(userRef, {
        nickname: newNickname,
        ballBalance: FieldValue.increment(-FEE),
        ballSpent: FieldValue.increment(FEE),
        previousNicknames: FieldValue.arrayUnion(oldNickname),
        nicknameChangeCount: FieldValue.increment(1),
        nicknameChangedAt: Timestamp.now(),
      });

      // 6. 플랫폼 수익 기록 (소각)
      tx.update(db.collection('platform_revenue').doc('nickname_change'), {
        totalAmount: FieldValue.increment(FEE),
        totalCount: FieldValue.increment(1),
        lastChangedAt: Timestamp.now(),
      });

      // 7. nickname_* 문서 갱신
      // (기존 nickname_{old} 삭제, nickname_{new} 생성)
      // ⚠️ 배치 처리 주의

      return { success: true, newNickname, feeCharged: FEE };
    });
  }
);
```

#### UI 변경

**공개 프로필 (`PublicProfile.tsx`)**:
```tsx
{user.previousNicknames?.length > 0 && (
  <div className="text-xs text-slate-500 mt-1">
    이전 닉네임: {user.previousNicknames.join(', ')}
  </div>
)}
```

**마이페이지 (`ProfileEditForm.tsx`)**:
```tsx
{user.nicknameChangeCount === 0 ? (
  <button onClick={openChangeNicknameModal}>
    🔒 닉네임 변경 (평생 1회, 100볼 = 10,000원)
  </button>
) : (
  <div className="text-slate-400 text-sm">
    ❌ 닉네임 변경 기회를 이미 사용하셨습니다.
  </div>
)}
```

#### 예외: 관리자 수동 변경

**신변 위협 등 특수 상황**: 관리자(`isAdmin`)가 `sanction_log`에 기록 + 수동 변경. `nicknameChangeCount` 미증가.

#### 테스트 시나리오

- **깐부1호 (정상 변경)**: 100볼 차감하고 `깐부1호` → `새로운나` 성공
- **깐부1호 (재변경 시도)**: 2회째 시도 → `permission-denied`
- **깐부2호 (이전 닉 재사용 시도)**: `깐부1호`로 변경 시도 → `already-exists` (예약됨)
- **깐부3호 (잔액 부족)**: 50볼 보유 → `failed-precondition`
- **불량깐부1호 (세탁 시도)**: 악플 후 변경 → 공개 프로필에 이전 닉 노출됨 ✅

### 5.4 통합 테스트 시나리오

- **깐부1호 (Rules 검증)**: `exp: increment(1000)` → 거부
- **깐부2호 ↔ 깐부3호 (맞땡스볼)**: 하루 50회 왕복 → 감점 발동
- **깐부4~6호 (좋아요 펌핑)**: 1회당 +3만 허용
- **불량깐부1호 (유배 중)**: EXP/평판 증가 차단

---

## 6. 통합 크리에이터 점수 · 마패 · 칭호

> **v2 변경**: 마패와 칭호를 **통합 섹션**으로 재구성. 두 시스템은 각각 "현재 상태 지표"와 "과거 업적 지표"로 보완적 역할.

### 6.1 배경

현재 크리에이터 가치 표현 지표가 여러 개로 분산:

| 지표 | 의미 | 저장 위치 |
|------|------|----------|
| `exp` | 활동량 | users.exp |
| `level` | 활동 티어 (1~10) | calculateLevel(exp) |
| `likes` | 받은 좋아요 | users.likes |
| `totalShares` | 공유된 횟수 | users.totalShares |
| `ballReceived` | 받은 땡스볼 | users.ballReceived |
| `getReputationScore()` | 평판 | 계산 함수 |
| `followerCount` | 깐부수 | 실시간 집계 |
| `pendingRevenue` | 쌓인 수익 | users.pendingRevenue |

**문제**: 광고 경매·추천·마패·칭호 등에서 "어느 지표 기준?"이 불명확.

### 6.2 통합 아키텍처

```
┌─ Creator Score (단일 숫자) ─┐
│                              │
│  평판 × 활동성 × 신뢰도     │
│                              │
└─────────┬──────────────────┘
          │
    ┌─────┴──────┐
    │            │
    ▼            ▼
┌─ 마패 ─┐  ┌─ 칭호 ─┐
│        │  │        │
│ 현재   │  │ 과거   │
│ 상태   │  │ 업적   │
│        │  │        │
│ 1개    │  │ 여러개 │
│ 동적   │  │ 영구   │
└────────┘  └────────┘
```

### 6.3 Creator Score 공식

```
Creator Score = (평판 × 활동성 × 신뢰도) / 1000

평판     = getReputationScore(userData) (개선 공식 적용)
활동성   = min(1.0, 최근_30일_활동량 / 평균)
신뢰도   = 1.0 - 어뷰징_감점
```

#### 세부 정의

**1. 평판**: §3.3.2 개선 공식 (시간 감쇠 포함)

**2. 활동성**:
```
최근 30일 활동 = (신규 글×3) + (댓글×1) + (보낸 좋아요×0.5)
평균 = Lv별 중위값 (Lv5=30, Lv10=100)
activityFactor = min(1.0, 최근 / 평균)
```

**3. 신뢰도**:
```
기본 1.0
  - 어뷰징 감지 1건 → -0.05 (최소 0.5)
  - 유배 이력 1회 → -0.1 (최소 0.3)
  - 신고 누적 5회 → -0.05 (최소 0.5)
```

#### 공식 예시

- **헤비 크리에이터**: 평판 2,500 × 0.9 × 1.0 / 1000 = **2.25**
- **한 방 터진 신규**: 평판 1,800 × 1.0 × 1.0 / 1000 = **1.80**
- **과거 스타, 현재 비활성**: 평판 4,000 × 0.2 × 1.0 / 1000 = **0.80**
- **어뷰저**: 평판 3,500 × 1.0 × 0.5 / 1000 = **1.75**

### 6.4 마패 시스템 (5티어)

**성격**: 현재 상태 지표 — Creator Score 기반 실시간 변동

| 티어 | Creator Score | 시각 | 획득 표기 |
|------|:------------:|------|-----------|
| 🥉 동마패 | 0.5 ~ 1.0 | 구리색 링 | "동마패 달성!" |
| 🥈 은마패 | 1.0 ~ 2.0 | 은색 링 | "은마패 달성!" |
| 🥇 금마패 | 2.0 ~ 3.5 | 금색 링 | "금마패 달성!" |
| 💎 백금마패 | 3.5 ~ 5.0 | 백금색 링 | "백금마패 달성!" |
| 👑 다이아마패 | 5.0+ | 보라+무지개 애니메이션 | "👑 다이아마패!" |

**유튜브 대응**:
- 은마패 ≈ 실버버튼 (10만 구독)
- 금마패 ≈ 골드버튼 (100만)
- 다이아마패 ≈ 다이아몬드버튼 (1천만)

**표시 위치**: 아바타 근처 배지, 공개 프로필 상단

### 6.5 칭호 시스템 (업적 기반)

**성격**: 과거 업적 지표 — 달성 시 영구 보유 (유배 시 박탈 가능)

#### 3축 × 4단계 = 12개 기본 칭호

**A. 크리에이터 축 (바이럴/영향력)**:
| 칭호 | 조건 |
|------|------|
| 🔰 새싹 작가 | 첫 글 작성 |
| ✍️ 근면한 작가 | 30일 연속 글 작성 (각 일 유효 글 1개+) |
| 🔥 첫 화제 | 단일 글 좋아요 30개+ |
| ⭐ 인기 작가 | 단일 글 좋아요 100개+ |
| 💎 초대박 | 단일 글 좋아요 1,000개+ |

**B. 커뮤니티 축 (관계)**:
| 칭호 | 조건 |
|------|------|
| 🤝 사교의 달인 | 맞깐부 30명+ |
| 💬 대화의 명수 | 댓글 1,000개+ 작성 |
| 🎁 후원자 | 땡스볼 보낸 누적 1,000볼+ |
| 🌟 인기인 | 깐부수 100명+ |
| 👑 영향력자 | 깐부수 1,000명+ |

**C. 플랫폼 로열티 축**:
| 칭호 | 조건 |
|------|------|
| 🌱 초기 개척자 | 2026년 내 가입 (한정) |
| 🎖️ 1년 개근 | 가입 365일 + 월 1회+ 활동 |
| 🏛️ 베테랑 | 가입 2년+ |
| ⚡ 헌신 | 누적 EXP 10,000+ (Lv10) |

#### 데이터 모델

**`users/{uid}`**:
```typescript
interface UserData {
  titles?: string[];           // 🆕 획득한 칭호 ID 목록
  primaryTitle?: string;       // 🆕 대표 칭호 (아바타 옆 표시용)
}
```

**`titles/{titleId}` 신규 컬렉션** (마스터 데이터):
```typescript
{
  id: string;              // 'bronze_writer'
  category: 'creator' | 'community' | 'loyalty';
  emoji: string;
  label: string;
  description: string;
  condition: string;       // 조건 설명
  isLimited?: boolean;     // 한정판 (예: 초기 개척자)
  color?: string;          // 시각 색상
}
```

#### 획득 로직

**CF `checkTitleAchievement`** (다른 CF에서 호출):
```javascript
// 글 작성 CF, 좋아요 CF, 맞깐부 달성 등에서 호출
// 조건 체크 → users.titles에 추가 → 알림 발송
```

#### UI

**공개 프로필 — 칭호 컬렉션**:
```
┌─────────────────────────────────────┐
│ 🏆 획득한 칭호 (5/12)               │
│                                     │
│ [🔰 새싹 작가] [✍️ 근면한 작가]     │
│ [🔥 첫 화제]  [🤝 사교의 달인]      │
│ [🌱 초기 개척자]                    │
└─────────────────────────────────────┘
```

**대표 칭호 표시** (닉네임 옆):
```
깐부5호 [🔥 첫 화제] Lv.5 · 우호
```

#### 어뷰징 방지

**"30일 연속 글 작성" 같은 조건**에 **최소 품질 기준** 병기:
- 유효 글 = 10자+ 또는 반응(좋아요/댓글) 1개+
- 10자 미만 스팸 글은 카운트 제외

**유배 시 처리**:
- 유배 1차: 칭호 유지
- 유배 2차: 대표 칭호 자동 해제
- 유배 3차: 평판 기반 칭호 박탈 (예: "초대박" 등)
- 사약: 모든 칭호 박탈

### 6.6 세 시스템 비교

| 구분 | Creator Score | 마패 | 칭호 |
|------|:------------:|:----:|:----:|
| 타입 | 숫자 | 티어 배지 | 배지 컬렉션 |
| 변동 | 실시간 (일일 배치) | Score에 연동 실시간 | 영구 (유배 시 박탈) |
| 표시 위치 | 대시보드 | 아바타 | 닉네임 옆 + 프로필 |
| 시각화 | 그래프 | 5단계 링 | 이모지 + 라벨 |
| 어뷰징 | 신뢰도로 감점 | Score 따라 자동 | 최소 품질 조건 |
| 수 | 1개 | 1개 (현재 티어) | 여러 개 |

### 6.7 활용처

**즉시 활용**:
1. **마패 배지** — 아바타 근처 (Creator Score 기반 자동)
2. **광고 경매 가중치** — Creator Score 높은 쪽 우선
3. **추천 피드 정렬** — Score + 최신성 가중치
4. **칭호 뱃지** — 닉네임 옆 대표 칭호

**장기**:
5. **오프라인 글러브카페 초청** — 다이아마패 or 특정 칭호 보유
6. **플랫폼 홍보 대상** — "이번 달의 금마패"
7. **수수료 등급제** — Creator Score 상위 X% 추가 감면

### 6.8 저장 방식

**옵션 C (권장) — 하이브리드**:
- 기본: `users.creatorScore` 비정규화 저장
- 일일 배치 CF (매일 06:00)
- 중요 변경(유배/해제, 칭호 달성) 시 즉시 재계산

### 6.9 테스트 시나리오

- **깐부10호 (헤비)**: Score 2.5, 금마패, 초대박+영향력자+베테랑 3개 칭호
- **깐부3호 (중견)**: Score 1.2, 은마패, 첫 화제+근면한 작가 2개
- **깐부1호 (신규)**: Score 0.3, 마패 없음, 새싹 작가 1개
- **불량깐부2호 (어뷰저)**: Score 0.8, 동마패, 유배 후 대표 칭호 자동 해제

---

### 6.10 🆕 Prestige 시스템 (설계만, Phase C 발동 예정)

> **핵심 원칙**: Phase A(현재)에서는 **설계 완료·코드 비활성**. Phase B(베타 종료)에서는 **예고만**. Phase C(정식 출시)에서 실제 발동.

#### 6.10.1 도입 배경

**"최상위 달성자" 문제**:
- 유튜브 사례: 2013년 다이아몬드 버튼 신설, 2018년 Custom Award, 2019년 Red Diamond 추가
- 초기 설계한 최상위 티어는 **반드시 돌파**됨 → 돌파 시 TOP 크리에이터 이탈 위험
- 대응: 본 게임 위에 **Prestige 레이어** 미리 설계

**글러브 적용 결정** (2026-04-19):
- 레벨·마패는 **확장하지 않음** (복잡도 최소)
- 평판만 3단계 Prestige 추가 (전설/경외/신화)
- 크리에이터 장기 동기부여 확보

#### 6.10.2 평판 Prestige 3단계 (로그 스케일)

| 단계 | 경계값 | 원화 환산 (땡스볼 기준) | 예상 달성 유저 |
|:----:|:-----:|:-------------------:|:----------:|
| 🌟 전설 (Legend) | 10,000~49,999 | 약 200만~1,000만원 수신 | 현역 크리에이터 1~2년 꾸준 활동 |
| ⚡ 경외 (Awe) | 50,000~99,999 | 약 1,000만~2,000만원 | 플랫폼 핵심 인물 |
| 🔮 신화 (Mythic) | 100,000+ | 2,000만원+ | 플랫폼 역사적 인물 (매우 소수) |

**참고**: 평판 공식 `likes×2 + totalShares×3 + ballReceived×5`에 §3.3.2 시간 감쇠 적용 후 점수. 땡스볼 외 좋아요·공유도 포함되므로 실제 수익과는 다름.

#### 6.10.3 단계별 시각 (아바타 이중 링)

**§3.5.2 매트릭스 참조**.

핵심:
- **전설**: 금빛 회전 링 (`animate-spin-slow`)
- **경외**: 무지개 링 + 빛 발산
- **신화**: 우주 배경 + 별 파티클

Phase C 발동 시까지 **CSS 미구현**, 경계값 초과 시 "확고" 시각으로 캡.

#### 6.10.4 코드 제어 (Phase별 활성/비활성)

**상수 파일 설계** (`src/constants.ts`):

```typescript
// 🔒 Prestige 시스템 플래그 (Phase A: false)
export const FEATURE_FLAGS = {
  PRESTIGE_REPUTATION_ENABLED: false,  // Phase C에서 true로 전환
  PRESTIGE_LAUNCH_DATE: null,           // Phase C 발동 시점
} as const;

// 평판 경계값 (Prestige 포함, 발동은 플래그로 제어)
export const REPUTATION_TIERS = {
  neutral: 0,
  mild: 300,
  friendly: 1_000,
  veryFriendly: 2_000,
  firm: 3_000,
  // 🔒 Prestige 레이어 (Phase C에서만 활성)
  legend: 10_000,
  awe: 50_000,
  mythic: 100_000,
} as const;
```

**Tier 판정 로직** (`src/utils.ts` 확장):

```typescript
export const getReputationTier = (score: number): string => {
  // Phase C 이상에서만 Prestige 활성
  if (FEATURE_FLAGS.PRESTIGE_REPUTATION_ENABLED) {
    if (score >= REPUTATION_TIERS.mythic) return 'mythic';
    if (score >= REPUTATION_TIERS.awe) return 'awe';
    if (score >= REPUTATION_TIERS.legend) return 'legend';
  }
  // Phase A/B: 확고에서 캡
  if (score >= REPUTATION_TIERS.firm) return 'firm';
  if (score >= REPUTATION_TIERS.veryFriendly) return 'veryFriendly';
  if (score >= REPUTATION_TIERS.friendly) return 'friendly';
  if (score >= REPUTATION_TIERS.mild) return 'mild';
  return 'neutral';
};
```

**효과**:
- Phase A/B에서 평판 15,000인 유저 → "확고"로 표시 (전설 미활성)
- Phase C 전환 시 플래그 true → 자동으로 "전설" 인식

#### 6.10.5 Phase별 운영 계획

##### Phase A (현재)

- ✅ 설계 확정 (본 섹션)
- ✅ 경계값 상수 파일 기록 (`REPUTATION_TIERS.legend/awe/mythic`)
- ✅ 플래그 `false` 상태
- ❌ UI 구현 금지
- ❌ 발동 금지

##### Phase B (베타 종료 + 정식 출시 2~3개월 전)

**공지 예시**:
```
📢 글러브 정식 출시 예고 — Prestige 시스템

평판 "확고" 너머의 세계가 열립니다.

🌟 전설 (Legend)
⚡ 경외 (Awe)
🔮 신화 (Mythic)

극한의 크리에이터만이 도달할 수 있는 경지입니다.
정식 출시와 함께 첫 도전자를 기다립니다.
```

- ✅ 공지·예고만
- ❌ 코드 플래그 여전히 `false`
- ✅ Phase B 전면 재조정 시 Prestige 경계값도 재검토 (데이터 기반)

##### Phase C (정식 출시 이후)

**발동 트리거** (둘 중 하나):
1. 첫 유저 평판 10,000 돌파 직후 (자연 발생)
2. 정식 출시 6개월 경과 시 (스케줄 발생)

**발동 시 작업**:
1. `FEATURE_FLAGS.PRESTIGE_REPUTATION_ENABLED = true` 배포
2. Prestige 시각 CSS 구현
3. 첫 전설 달성자 알림 + 공지
4. 명예의 전당 페이지 공개

#### 6.10.6 왜 레벨·마패는 확장하지 않는가

**레벨**:
- 현재 10단계 구조가 이미 충분히 길음 (Lv10 = 10,000 EXP, 3년+ 활동)
- EXP 기반이라 평판과 달리 자연 감쇠 없음 → Prestige 없이도 차별화
- 복잡도 대비 효용 낮음

**마패**:
- 마패는 **Creator Score 기반 실시간 티어**이므로 이미 유동적
- 5단계(동/은/금/백금/다이아)에서 각 단계가 이미 유튜브 버튼 대응 (실버/골드/다이아몬드)
- Score 자체가 무한 증가 가능하므로 다이아마패 내에서도 순위 구분 가능

**결론**: **평판 Prestige만으로 장기 동기부여 충분** + 구현 복잡도 최소

#### 6.10.7 Step 1 체크리스트

- [x] 경계값 결정: 10,000 / 50,000 / 100,000 (로그 스케일)
- [x] 네이밍 결정: 전설 / 경외 / 신화
- [x] 시각 결정: §3.5.2 매트릭스 (Phase C 구현)
- [ ] 상수 파일에 경계값 기록 (Step 2 작업)
- [ ] 플래그 상수 추가 (Step 2 작업)
- [ ] `getReputationTier` 함수 확장 (Step 2 작업)

**Step 2 이후 작업**: MAPAE_AND_TITLES_V1.md 작성 시 Prestige 평판과 마패·칭호 연계 검토.

---

## 7. 구현 우선순위 & 로드맵

### 7.1 Step 1 범위 (지금 ~ 투자 유치 기획서)

**산출물**: 설계 문서 7개 (코드 변경 최소)

| 순서 | 작업 | 파일 | 난이도 |
|:----:|------|------|:------:|
| 1 | 본 문서 v2 승인 | `GLOVE_SYSTEM_REDESIGN_v2.md` | — |
| 2 | 가격 단일 진실 소스 | `PRICING.md` (신규) | 🟢 하 |
| 3 | 어뷰징 방지 (닉네임 정책 포함) | `ANTI_ABUSE.md` | 🔴 상 |
| 4 | 레벨·EXP 상세 설계 | `LEVEL_V2.md` | 🟡 중 |
| 5 | 평판 상세 설계 (아바타 이중 링 포함) | `REPUTATION_V2.md` | 🟡 중 |
| 6 | 깐부 상세 설계 | `KANBU_V2.md` | 🟢 하 |
| 7 | 마패 + 칭호 통합 | `MAPAE_AND_TITLES_V1.md` | 🔴 상 |
| 8 | 통합 크리에이터 점수 | `CREATOR_SCORE.md` | 🔴 상 |

**총 8개 문서** (본 문서 + PRICING + 6개 상세 + Creator Score)

### 7.2 Step 2 범위 (기능 보완)

| 작업 | 관련 문서 | 비고 |
|------|----------|------|
| Firestore Rules 어뷰징 가드 | ANTI_ABUSE | 즉시 적용 |
| 닉네임 변경 CF (`changeNickname`) | ANTI_ABUSE | 신규 CF + UI |
| 클라 EXP 로직 개선 (음수 방지, 깐부 +2) | LEVEL_V2 | |
| 평판 공식 업데이트 (공식 1/2 통합) | REPUTATION_V2 | |
| 아바타 이중 링 컴포넌트 (`ReputationAvatar`) | REPUTATION_V2 | 전체 앱 교체 |
| Creator Score 배치 CF | CREATOR_SCORE | |
| 마패 UI 컴포넌트 | MAPAE_AND_TITLES_V1 | |
| 칭호 시스템 초기 12개 + 획득 CF | MAPAE_AND_TITLES_V1 | |
| 크리에이터 대시보드 확장 | CREATOR_SCORE | |
| 추천 알고리즘 뼈대 | 별도 문서 | |

### 7.3 Step 3 범위 (로그인/회원가입 재설계)

- 회원가입 UX 재설계 (크리에이터 루프 통합)
- 휴대폰 인증 통합
- 첫 깐부 매칭 온보딩
- Creator Score 0→첫 티어 퀘스트
- **닉네임 결정 단계 강조**: "평생 1회만 변경 가능합니다. 신중히 선택하세요."

### 7.4 Step 4 범위 (투자 유치 기획서)

- Step 1~3 산출물 재구성
- 비전·시장·트랙션·로드맵

### 7.5 PG 연동 시점 일괄 처리

- EXP CF 이관
- 서버 쿨다운 전환
- 휴대폰 인증 필수화 (Lv5+)
- `MAX_AMOUNT_PER_TX` 재조정 (현재 10,000볼=100만원 → 500볼=5만원)
- 환급·원천징수 완전 연동

---

## 8. 다음 설계서 작성 계획

### 8.1 설계서 공통 포맷

```
1. 개요 & 3대 원칙
2. 현재 상태 (실측 코드 인용)
3. 문제점 분석 (Critical/Major/Minor)
4. 변경 방향 (AS-IS → TO-BE)
5. 데이터 모델 (types.ts / Firestore)
6. Cloud Function 명세
7. Firestore Rules 변경
8. 테스트 시나리오 (깐부1~10호 + 불량깐부1~3호)
9. 구현 우선순위
10. 미결정 사항 (TODO)
```

### 8.2 작성 순서

1. **`PRICING.md`** (먼저 — 가격 기준이 모든 문서에 영향)
2. **`ANTI_ABUSE.md`** (어뷰징 최우선 + 닉네임 정책)
3. **`LEVEL_V2.md`** (EXP 공식 + 서버 이관)
4. **`REPUTATION_V2.md`** (평판 공식 + 아바타 이중 링)
5. **`KANBU_V2.md`** (네이밍 + 마이그레이션)
6. **`CREATOR_SCORE.md`** (통합 지표)
7. **`MAPAE_AND_TITLES_V1.md`** (마패 + 칭호, 앞 문서 종합)

### 8.3 사용자 확인 필요 사항 (v2 업데이트)

**v1에서 이미 합의된 사항** (재확인 불필요):
- ✅ 깐부 단방향 유지
- ✅ EXP 서버 검증 옵션 B
- ✅ 어뷰징 방지 최우선
- ✅ 아바타 평판 색 (이중 링)
- ✅ 칭호 도입, 마패와 통합
- ✅ 닉네임 정책 (옵션 C 변형, 100볼)
- ✅ 1볼 = 100원

**남은 결정 사항**:
- [ ] **레벨 테이블**: 현재 10단계 유지 vs 재조정?
- [ ] **EXP 공식**: §2.3.2 제안 (품질 가중치) 채택?
- [ ] **깐부 EXP**: 맺기 +10 → +2 완화 채택?
- [ ] **평판 시간 감쇠**: §3.3.2 제안 채택?
- [ ] **Creator Score 공식**: §6.3 제안 채택?
- [ ] **마패 5단계 경계값**: §6.4 초안 적정?
- [ ] **칭호 초기 12개**: §6.5 구성 적정?
- [ ] **Rules 긴급 패치** (§5.3 Layer 1): 즉시 적용? 검토 후?

### 8.4 설계서 작성 중 추가 요청 예정 코드

- `src/hooks/useFirestoreActions.ts` — LEVEL_V2 작성 시
- `src/hooks/useFirebaseListeners.ts` — KANBU_V2 작성 시
- `functions/storehouse.js` — ANTI_ABUSE 작성 시
- `src/components/PublicProfile.tsx`, `ProfileHeader.tsx` — REPUTATION_V2 작성 시
- `src/components/ProfileEditForm.tsx` — 닉네임 정책 UI 설계 시

→ 필요 시점에 개별 요청.

---

## 9. v2 결정사항 요약

v1 → v2 업데이트 과정에서 추가/변경된 결정사항 한눈에 보기:

| 번호 | 결정사항 | 근거 |
|:----:|---------|------|
| v2-1 | **1볼 = 100원** 공식 가정 | 화폐 단위 기준점 확정 |
| v2-2 | **아바타 이중 링** (안쪽 레벨, 바깥 평판) | 시각적 크리에이터 식별 강화 |
| v2-3 | **칭호 시스템 도입**, 마패와 통합 문서 | 과거 업적 + 현재 상태 보완적 |
| v2-4 | **칭호 14개** (크리에이터5 + 커뮤니티5 + 로열티4) | 3축 균형 |
| v2-5 | **닉네임 평생 1회 유료 변경 (100볼)** | 완전 금지의 CS 부담 완화 |
| v2-6 | **이전 닉네임 영구 예약** | 사칭 공격 차단 |
| v2-7 | **공개 프로필 변경 이력 표시** | 평판 세탁 차단 |
| v2-8 | **가격표 별도 문서** (`PRICING.md`) | 단일 진실 소스 원칙 |
| v2-9 | `MAX_AMOUNT_PER_TX` 재조정 TODO (10,000볼 → 500볼) | 1회 100만원은 과다, PG 연동 시점 작업 |
| v2-10 | **설계서 구성**: CREATOR_SCORE + MAPAE_AND_TITLES 분리 | 통합 지표 + 시각 표현 역할 분담 |
| v2-11 | **경계값 조정 전략 문서** (`TUNING_SCHEDULE.md`) 신규 | Phase A/B/C 타임라인 + 기득권 보장 A+B+E 전략 |
| v2-12 | **Admin 기능 별도 문서** (`ADMIN.md`) 신규, **마지막 작성** | 다른 설계서 요구사항 누적 후 통합 |
| v2-13 | **EXP 공식 품질 가중치** 채택 | §8.3 ② 체크리스트 답변 |
| v2-14 | **깐부 맺기 EXP** +2 / 해제 0으로 완화 | §8.3 ③ 체크리스트 답변 |
| v2-15 | **평판 시간 감쇠** 월 0.5%, 최소 0.7 | §8.3 ④ 체크리스트 답변 (더 완만) |
| v2-16 | **Creator Score 공식** 평판 × 활동성 × 신뢰도 채택 | §8.3 ⑤ 체크리스트 답변 |
| v2-17 | **마패 경계값** 0.5/1.0/2.0/3.5/5.0 + 3개월 후 재조정 | §8.3 ⑥ 체크리스트 답변 |
| v2-18 | **Rules 긴급 패치 즉시 적용** (F12 공격 차단) | §8.3 ⑧ 체크리스트 답변 |
| **v2-19** | **🆕 평판 Prestige 3단계** (전설 10K / 경외 50K / 신화 100K) | 최상위 달성자 이탈 방지, Phase C 발동 |
| **v2-20** | **용어 정립**: UI는 깐부/깐부수/맞깐부 (한국어), 변수명은 기존 영문 유지 | 사용자 관점 일관성 + 마이그레이션 비용 회피 |

---

## 📝 결론 요약

v2는 v1의 4대 시스템 진단에 **사용자 피드백 다수 + 화폐 기준 확정 + Prestige 설계**를 통합한 버전입니다.

**v1 대비 주요 추가**:
1. **아바타 평판 색**: 이중 링 시각화 (Prestige 포함 8단계)
2. **칭호 시스템**: 14개 + 3축 구성 + 마패와 통합
3. **닉네임 정책**: "완전 금지" → "유료 1회 + 이력공개 + 예약" 균형점
4. **화폐 기준**: 1볼 = 100원 공식 고정
5. **경계값 조정 전략**: `TUNING_SCHEDULE.md`로 Phase A/B/C 타임라인 확정
6. **가격 단일 진실 소스**: `PRICING.md` 분리
7. **🆕 Prestige 시스템**: 평판 전설/경외/신화 (Phase C 발동 예정)
8. **용어 정립**: UI는 한국어, 변수명은 기존 유지

Step 1 설계 문서 **총 9개 완성** 시(v2 + PRICING + TUNING + ANTI_ABUSE + LEVEL + REPUTATION + KANBU + CREATOR_SCORE + MAPAE_AND_TITLES + ADMIN) Step 2 코드 작업의 청사진 확보.

---

**문서 버전**: v2.0
**이전 버전**: `GLOVE_SYSTEM_REDESIGN_v1.md` (유지, 변경 없음)
**다음 업데이트**: §8.3 남은 결정사항 8개 답변 후 → 각 설계서 링크 추가
