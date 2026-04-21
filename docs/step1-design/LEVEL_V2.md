# 📈 글러브(GeuLove) 레벨 시스템 설계서 (LEVEL_V2.md)

> **문서 목적**: 글러브의 **레벨 시스템** 전담 설계서. EXP 획득 공식, 경계값, 해금 기능, 저장 방식을 통합 관리.
>
> 작성일: 2026-04-20 v1.0
>
> **⚠️ 주의**: 본 문서는 **"레벨"** 시스템 전담. 평판(REPUTATION_V2), 창작자 지표(CREATOR_SCORE)는 별도 문서.
>
> **참조 문서**: `GLOVE_SYSTEM_REDESIGN_v2.md` §2, `ANTI_ABUSE.md` §5.2.3, `TUNING_SCHEDULE.md` §3, `REPUTATION_V2.md`(예정), `CREATOR_SCORE.md`(예정)

---

## 📋 목차

- [0. 개요 & 원칙](#0-개요--원칙)
- [1. 현재 상태 진단](#1-현재-상태-진단)
- [2. 문제점 분석](#2-문제점-분석)
- [3. EXP 공식 재설계 (v2-13)](#3-exp-공식-재설계-v2-13)
- [4. 레벨 경계값 & 해금 기능](#4-레벨-경계값--해금-기능)
- [5. 레벨 저장 방식 결정 (v2 §2.5 재검토)](#5-레벨-저장-방식-결정-v2-§25-재검토)
- [6. 데이터 모델](#6-데이터-모델)
- [7. 구현 변경 범위](#7-구현-변경-범위)
- [8. 테스트 시나리오](#8-테스트-시나리오)
- [9. Step별 구현 우선순위](#9-step별-구현-우선순위)
- [10. 다른 설계서와의 참조 관계](#10-다른-설계서와의-참조-관계)
- [11. 장기 로드맵 (출시 후 작업)](#11-장기-로드맵-출시-후-작업)

---

## 0. 개요 & 원칙

### 0.1 문서 범위

본 문서는 **레벨 시스템** 전담:
- EXP 획득 공식 (글/댓글/좋아요/조회/공유/깐부 등)
- 레벨 경계값 (Lv1 ~ Lv10)
- 레벨별 해금 기능 맵
- 레벨 저장·계산 방식
- 레벨 어뷰징 방지 (ANTI_ABUSE 연동)

**범위 외**:
- 평판 점수 공식 → `REPUTATION_V2.md`
- 크리에이터 통합 지표 → `CREATOR_SCORE.md`
- 마패·칭호 → `MAPAE_AND_TITLES_V1.md`
- Prestige (Lv10 초과 성장) → `REPUTATION_V2.md` §6 (평판 기반이므로)

### 0.2 3대 원칙

| 원칙 | 내용 | 근거 |
|------|------|------|
| **품질 가중치** | 글자 수·이미지·링크에 따라 EXP 차등 지급 | v2-13, ANTI_ABUSE §5.2.3 |
| **레벨은 "활동량" 지표** | 지속적으로 활동하면 자연스럽게 상승 | v2 §2, 평판·Creator Score와 구분 |
| **Phase별 조정** | 경계값·해금 기능은 유저 규모에 따라 조정 | `TUNING_SCHEDULE.md` §3 |

### 0.3 레벨의 역할 (3대 기능)

**① 진입 장벽** — 봇·신규 유저가 수익 모델에 바로 접근 못 하게 게이팅
- Lv3: 땡스볼 수신 가능
- Lv5: 광고 슬롯 1개
- Lv7: 광고 수익 + 20%

**② 활동량 증명** — "이 유저가 얼마나 열심히 활동했나"
- 평판과 무관 (평판은 "질", 레벨은 "양")
- 신입 유저가 수익 모델 접근까지의 명확한 경로

**③ UX 게임화** — 다음 레벨까지 몇 EXP 남았는지, 성취감
- 프로그레스 바 표시
- 레벨업 알림

### 0.4 개발 수칙 (CLAUDE.md 준수)

- **Strict Focus**: 레벨 관련 외 코드 변경 금지
- **Surgical Edit**: EXP 획득 지점만 수술 수정
- **선보고 후실행**: 경계값 변경 시 반드시 AS-IS/TO-BE 보고
- **Human Readable**: 공식 변경 시 주석에 "왜 이 숫자인지" 명시

---

## 1. 현재 상태 진단

### 1.1 EXP 획득 공식 (실측)

**출처**: `src/hooks/useFirestoreActions.ts`

#### 1.1.1 EXP 획득 지점 전수 (7개 트리거)

| # | 트리거 | 현재 EXP | 조건 | 출처 |
|:-:|--------|:--------:|------|------|
| 1 | 신규 글 작성 | **+2** | 10자 이상 (`isEligibleForExp`) | 라인 67-69 |
| 2 | 연계글 작성 | **+2** | 10자 이상 | 라인 94-96 |
| 3 | 인라인 댓글 | **+2** | 10자 이상 | 라인 131-133 |
| 4 | 폼 댓글 | **+2** | 10자 이상 | 라인 167-169 |
| 5 | 좋아요 3개 달성 | **+5** (작성자) | 1회만, 2→3 순간 | 라인 210-212 |
| 6 | 글 조회 | **+1** | 타인 글, 세션당 1회 | 라인 222-223 |
| 7 | 깐부 맺기 | **+10** | 관계 시작 | 라인 184-186 |

#### 1.1.2 글자수 필터 함수

**출처**: `src/utils.ts` (예상)

```typescript
export const isEligibleForExp = (content: string): boolean => {
  const plainText = content.replace(/<[^>]*>/g, '').replace(/\s/g, '');
  return plainText.length >= 10;
};
```

- HTML 태그 제거
- 공백 제거
- 10자 이상일 때만 `true`

> **용어 구분** (타 문서와의 정합성):
>
> | 개념 | 정의 | 판정 시점 | 사용 문서 |
> |------|------|:---------:|:---------:|
> | **EXP 지급 대상** | 10자+ (즉시 판정) | 글 작성 즉시 | LEVEL_V2 (본 섹션) |
> | **유효 글** | 10자+ **OR** 고유 반응 5+ (소급 판정 가능) | 반응 누적 후 | MAPAE §6.2 D3-γ |
>
> **차이 이유**: EXP는 즉시 지급되어야 하므로 즉시 판정 가능한 기준(10자)만 사용. 반면 칭호(예: `writer_diligent`)는 소급 판정 가능하므로 반응 기반 보완 가능.
>
> **공통점**: 10자+ 글은 두 기준 모두 통과 (대부분의 경우 결과 동일).

### 1.2 레벨 계산 함수 (추정)

**출처**: `src/utils.ts` (실제 확인 필요)

```typescript
// 예상 공식 (변경 가능)
export const calculateLevel = (exp: number): number => {
  if (exp >= 3000) return 10;
  if (exp >= 2000) return 9;
  if (exp >= 1500) return 8;
  if (exp >= 1000) return 7;
  if (exp >= 700)  return 6;
  if (exp >= 500)  return 5;
  if (exp >= 300)  return 4;
  if (exp >= 150)  return 3;
  if (exp >= 50)   return 2;
  return 1;
};
```

**Phase A 경계값 추정** (TUNING_SCHEDULE.md 참조).

### 1.3 레벨 저장 현황 (실측)

#### 1.3.1 `types.ts` 선언

```typescript
export interface UserData {
  uid: string;
  nickname: string;
  level: number;  // 🔴 필수 필드 (옵셔널 아님)
  exp?: number;   // 🟡 옵셔널
  // ...
}
```

**관찰**: 
- `level`이 **필수**로 선언 → **DB에 저장 중**일 가능성 매우 높음
- `exp`는 옵셔널 → 초기값 0으로 처리 가능성

#### 1.3.2 코드 내 `level` 사용 지점

**useFirestoreActions.ts**:
```typescript
// 라인 62 (글 작성 시 작성자 정보 스냅샷)
authorInfo: { 
  level: userData.level,  // 직접 참조
  friendCount: friends.length, 
  totalLikes: userData.likes 
},
```

여러 곳에서 `userData.level` 직접 참조 중. **실시간 계산이 아니라 DB 저장값을 쓰는** 상황.

#### 1.3.3 v2 §2.5 결정과의 불일치

**v2에서 결정했다고 기록된 내용**:
> 옵션 A — DB 미저장, `calculateLevel(exp)`로 실시간 계산

**현실**:
- `types.ts`는 필수 필드로 선언
- 코드는 `userData.level` 직접 참조
- 즉 **DB에 저장되고 있음**

→ 이 모순을 §5에서 해결.

### 1.4 레벨별 해금 기능 (실측)

#### 1.4.1 현재 적용된 해금 게이트

| 레벨 | 해금 기능 | 코드 위치 | 근거 |
|:---:|----------|----------|------|
| Lv1 | 글 작성, 댓글, 좋아요 | 기본 | 모든 로그인 유저 |
| Lv2+ | 깐부 홍보 카드 등록 | `kanbuPromo.js` | 코드 확인됨 |
| Lv3+ | 단골장부/가판대 상품 등록 | `market_items` | 최소 레벨 조건 |
| Lv3+ | 땡스볼 수신 | `thanksball.js` | CF 내부 조건 |
| Lv5+ | 광고 슬롯 1개 | `adAuction` | ADSMARKET 설계 |
| Lv7+ | 광고 수익 + 20% | `adAuction` | ADSMARKET 설계 |
| Lv10 | 최대 레벨 | 경계값 | Prestige 이후 연계 |

#### 1.4.2 해금 게이트 로직 (산재됨)

현재는 각 기능이 **자체적으로 레벨 체크**:

```typescript
// 예시 1: 홍보 카드
if (userData.level < 2) { /* 차단 */ }

// 예시 2: 광고 슬롯
if (currentUserLevel < 5) { /* 차단 */ }

// 예시 3: 커뮤니티 가입 (일부 커뮤니티)
if (userData.level < community.minLevel) { /* 차단 */ }
```

**문제**: 게이트 로직이 **산재** → 정책 변경 시 여러 곳 수정 필요.

---

## 2. 문제점 분석

### 2.1 🟠 Major-1: 단조 EXP 공식 (10자 글 스팸 가능)

**현재**: 10자 이상이면 **무조건 +2 EXP**

**공격 시나리오**:
```
"안녕하세요!!!"  (10자 정확히) → +2 EXP
"안녕하세요!!!"  (반복) → +2 × N
```

**계산**: 분당 1개 작성(쿨다운 60초) → 시간당 60 × +2 = **+120 EXP**
- Lv3(300 EXP 가정) 도달: **2.5시간**
- Lv5(500 EXP) 도달: **4시간**
- Lv10(3000 EXP) 도달: **25시간**

**실제 리스크**:
- 봇으로 "안녕" 10자 글 자동 생성 → 24시간이면 Lv10 달성
- 품질 무관하게 레벨업 → Lv5 광고 슬롯 대량 획득
- 플랫폼 피드 품질 저하

### 2.2 🟠 Major-2: 단조 공식의 역효과 (장문 작성 의욕 저하)

**현재**: 10자 글 +2 = 2,000자 글 +2

**사용자 심리**:
- "짧은 글이나 긴 글이나 똑같이 +2?" → 짧은 글만 쓰기
- 블로그형 장문 작성자의 성장 경로 없음
- **Lv7 광고 수익 + 20%의 본래 의도 (고품질 콘텐츠 장려)와 배치**

### 2.3 🟠 Major-3: 레벨 저장 방식 혼란 (v2 결정 미반영)

**v2 §2.5 결정**: DB 미저장, 실시간 계산

**현실**: 
- DB 저장됨 (필드 정의 + 코드 참조)
- 실시간 계산 미구현

**문제**:
- EXP 업데이트 시 레벨도 함께 업데이트 필요 → **로직 중복**
- 작성자 정보 스냅샷(`authorInfo.level`) 시 오래된 레벨 저장 가능
- v2 문서와 실제 코드 불일치 → **미래 혼란**

### 2.4 🟠 Major-4: 레벨 해금 게이트 산재

**현재**: 기능별로 `if (userData.level < N) ...` 체크 코드 10+ 곳

**문제**:
- 경계값 조정 시 10+ 곳 수정 필요
- 조정 실수 → 버그 발생 가능성
- 레벨 정책 변경 비용 높음

### 2.5 🟢 Minor-1: 깐부 맺기 +10 과다

**현재**: 깐부 맺기 +10 (해제 -15)

**문제**:
- 다계정 100개 맺기 → +1,000 EXP = Lv5
- 해제 안 하면 EXP 유지 → 어뷰징 인센티브

**해결**: v2-14 결정 — 맺기 **+2** / 해제 **0**
- 다계정 100개 맺기 → +200 EXP (Lv3 수준)
- ANTI_ABUSE.md §5.2.1에서 상세

### 2.6 🟢 Minor-2: 조회 EXP 세션 기반 (재마운트 우회)

**현재**: `sessionStorage`로 중복 방지

**문제**:
- 컴포넌트 재마운트 시 `sessionStorage` 유지되지만, **새 탭**에서는 초기화
- 봇이 Puppeteer로 1,000 탭 → +1,000 EXP

**해결**: `viewed_posts/{uid}_{postId}` Firestore 마커 (Step 2~3)

---

## 3. EXP 공식 재설계 (v2-13)

### 3.1 현재 EXP 공식 요약

| 활동 | EXP | 조건 |
|------|:---:|------|
| 글 작성 | +2 | 10자 이상 |
| 댓글 | +2 | 10자 이상 |
| 조회 | +1 | 타인 글, 세션 1회 |
| 좋아요 3개 달성 | +5 (작성자) | 1회만 |
| 깐부 맺기 | +10 | — |

### 3.2 TO-BE 공식 (v2-13 품질 가중치)

#### 3.2.1 글·댓글 EXP 재설계

```typescript
// src/utils.ts
export const calculateExpForPost = (
  content: string,
  hasImage: boolean = false,
  hasLink: boolean = false,
): number => {
  const plainText = content.replace(/<[^>]*>/g, '').replace(/\s/g, '');
  const length = plainText.length;
  
  // 기본 EXP (글자 수 구간별)
  let baseExp = 0;
  if (length >= 1000)      baseExp = 6;  // 장문
  else if (length >= 300)  baseExp = 4;  // 중문
  else if (length >= 100)  baseExp = 2;  // 단문
  else if (length >= 10)   baseExp = 1;  // 최소 (반토막)
  else                     return 0;     // 미달 → 지급 없음
  
  // 가산 EXP
  if (hasImage) baseExp += 1;
  if (hasLink)  baseExp += 1;
  
  return baseExp;
};
```

**핵심 변화**:
- 10~99자 → **+1** (기존 +2에서 반토막)
- 100~299자 → **+2** (기존과 동일)
- 300~999자 → **+4** (2배)
- 1,000자+ → **+6** (3배)
- 이미지 포함 → **+1**
- 링크 포함 → **+1**

**최대 EXP/글**: 1,000자 + 이미지 + 링크 = **+8 EXP** (기존 +2 대비 4배)

#### 3.2.2 조회 EXP (유지)

```typescript
// 변경 없음
viewExp = 1;  // 타인 글, 세션당 1회
```

**이유**: 복잡화 비용 > 효과. Phase A는 유지.

#### 3.2.3 좋아요 3개 달성 EXP (유지)

```typescript
// 변경 없음
milestoneExp = 5;  // 작성자에게, 1회만
```

**이유**: 이미 충분히 의미 있는 보상. 과한 조정 불필요.

#### 3.2.4 깐부 맺기 EXP (v2-14 완화)

```typescript
// AS-IS
friendExp = isFriend ? -15 : 10;

// TO-BE
friendExp = isFriend ? 0 : 2;
```

**ANTI_ABUSE.md §5.2.1과 동일**.

### 3.3 Before/After 시뮬레이션

#### 3.3.1 정상 사용자 시나리오

**페르소나 1: "블로거"** (1일 1개 장문 + 이미지 1개)

| 항목 | AS-IS | TO-BE |
|------|:----:|:-----:|
| 글 작성 | +2 | **+7** (1,000자 6 + 이미지 1) |
| 1개월 (30일) | +60 EXP | **+210 EXP** |
| Lv2 도달 | 1개월 | **1주** |
| Lv5 도달 | 9개월 | **3개월** |

→ 장문 작성자에게 **보상 3.5배 증가**, 성장 경로 확실

**페르소나 2: "일상 공유러"** (1일 3개 단문 + 댓글 5개)

| 항목 | AS-IS | TO-BE |
|------|:----:|:-----:|
| 단문 3개 | +6 | **+6** (100~299자 +2 × 3) |
| 댓글 5개 | +10 | **+5** (10~99자 +1 × 5) |
| 1일 합계 | +16 | **+11** |
| 1개월 | +480 | +330 |
| Lv3 도달 | 1개월 | **1.5개월** |

→ 짧은 댓글 위주 사용자는 **감소**, 하지만 실용적 수준 유지

**페르소나 3: "한줄 댓글러"** (1일 댓글 20개, 10자짜리)

| 항목 | AS-IS | TO-BE |
|------|:----:|:-----:|
| 댓글 20개 | +40 | **+20** (10~99자 +1 × 20) |
| 1개월 | +1,200 | +600 |
| Lv5 도달 | 2주 | **4주** |

→ **반토막**. 짧은 댓글만으로 Lv5 달성이 어려워짐 (의도된 결과)

#### 3.3.2 어뷰저 시나리오

**공격 A: 10자 스팸봇**

```
공격자: 봇으로 "안녕하세요" (10자) 글 1분마다 작성
```

| 항목 | AS-IS | TO-BE |
|------|:----:|:-----:|
| 글당 EXP | +2 | **+1** |
| 시간당 (분당 1개) | +120 | +60 |
| Lv10 (3,000 EXP) | 25시간 | **50시간** |

→ **2배 지연**. 하지만 여전히 어뷰징 가능 → ANTI_ABUSE §5.2.3의 추가 방어 필요

**공격 B: 다계정 깐부 루프**

```
공격자: 다계정 100개로 메인 맺기
```

| 항목 | AS-IS | TO-BE |
|------|:----:|:-----:|
| 맺기당 EXP | +10 | **+2** |
| 100개 맺기 | +1,000 | +200 |
| 도달 레벨 | Lv5 | Lv3 |

→ **Lv5 광고 슬롯 어뷰징 원천 차단**

### 3.4 어뷰징 대비 추가 방어 (§9 연계)

공식 변경만으로 부족하므로, 다음 방어 조치 **병행 필요** (ANTI_ABUSE 연동):

| 방어 | 설명 | 구현 위치 |
|------|------|----------|
| Rules exp 가드 | 1회 +100 이하, 음수 불가 | ANTI_ABUSE §4.2 |
| 글 작성 쿨다운 | 60초 | 이미 존재 |
| 댓글 쿨다운 | 15초 | 이미 존재 |
| 일일 EXP 상한 (Phase B) | 하루 +200 이상 감지 | `detectRapidExpGain` CF |
| 세션 조회 → Firestore 마커 (Phase B) | `viewed_posts/{uid}_{postId}` | LEVEL_V2 §7.3 |

---

## 4. 레벨 경계값 & 해금 기능

### 4.1 현재 경계값 (Phase A, 베타)

```typescript
// src/utils.ts (현재)
export const calculateLevel = (exp: number): number => {
  if (exp >= 3000) return 10;
  if (exp >= 2000) return 9;
  if (exp >= 1500) return 8;
  if (exp >= 1000) return 7;
  if (exp >= 700)  return 6;
  if (exp >= 500)  return 5;
  if (exp >= 300)  return 4;
  if (exp >= 150)  return 3;
  if (exp >= 50)   return 2;
  return 1;
};
```

### 4.2 Phase별 경계값 (TUNING_SCHEDULE 연동)

**Phase A (현재 베타)**: 현재 값 유지 — 유저 적어 조정 무의미
**Phase B (베타 종료)**: 실데이터 분석 후 미세 조정
**Phase C (정식 출시)**: 기득권 보장 원칙으로 **상향 조정**

#### 4.2.1 Phase C 예상 경계값

품질 가중치 도입 + 1,000자 글 +7~8 EXP 고려:

```typescript
// Phase C 예상 (TUNING_SCHEDULE 참조)
Lv10: 5000 → 유지 여부 검토
Lv7:  2000 → 상향 (광고 수익 + 20% 신중)
Lv5:  1000 → 상향 (광고 슬롯 신중)
Lv3:  300  → 유지 또는 소폭 상향
```

**상세**: `TUNING_SCHEDULE.md` §3 참조.

### 4.3 레벨별 해금 기능 맵

#### 4.3.1 현재 + Phase C 목표

| 레벨 | 현재 해금 | Phase C 목표 | 수익 관련 |
|:---:|----------|-------------|:--------:|
| Lv1 | 글/댓글/좋아요 | 동일 | — |
| Lv2 | 깐부 홍보 | 동일 | — |
| Lv3 | **땡스볼 수신** | 동일 | 💰 |
| Lv3 | 단골장부/가판대 | 동일 | 💰 |
| Lv5 | **광고 슬롯 1개** | 동일 | 💰 |
| Lv7 | **광고 수익 + 20%** | 동일 | 💰 |
| Lv10 | Prestige 진입 자격 | 동일 | — |

#### 4.3.2 통합 게이트 함수 (신규, Step 2)

**목적**: 산재된 레벨 체크 통합

```typescript
// src/utils/levelGate.ts (신규)
export type Feature = 
  | 'write_post'
  | 'comment'
  | 'like'
  | 'kanbu_promo'
  | 'thanksball_receive'
  | 'market_sell'
  | 'ad_slot'
  | 'ad_revenue_bonus'
  | 'prestige';

export const REQUIRED_LEVEL: Record<Feature, number> = {
  write_post:         1,
  comment:            1,
  like:               1,
  kanbu_promo:        2,
  thanksball_receive: 3,
  market_sell:        3,
  ad_slot:            5,
  ad_revenue_bonus:   7,
  prestige:           10,
};

export const canUseFeature = (
  userLevel: number,
  feature: Feature
): boolean => {
  return userLevel >= REQUIRED_LEVEL[feature];
};

// 사용 예시
if (canUseFeature(userData.level, 'ad_slot')) {
  // 광고 슬롯 UI 노출
}
```

**효과**:
- 레벨 정책 변경 시 **1곳만 수정**
- 코드 가독성 향상
- 테스트 용이

---

## 5. 레벨 저장 방식 결정 (v2 §2.5 재검토)

### 5.1 배경

v2 §2.5는 "옵션 A — DB 미저장, 실시간 계산"으로 결정했으나:
- `types.ts`에 `level: number` 필수 선언
- 코드 곳곳에서 `userData.level` 직접 참조

→ 실제로는 **DB 저장** 상태. 이 모순을 이 섹션에서 정리.

### 5.2 세 가지 옵션 상세 분석

#### 5.2.1 옵션 A: DB 미저장, 실시간 계산

**구조**:
```typescript
// types.ts
interface UserData {
  exp: number;  // DB 저장
  // level 필드 없음
}

// 사용 시
const level = calculateLevel(user.exp);
```

**장점**:
- 🟢 **단일 진실 소스**: `exp`만 업데이트하면 레벨 자동 반영
- 🟢 **저장 공간 절약**: 문서당 1 필드 감소
- 🟢 **불일치 불가능**: `exp`와 `level` 어긋날 수 없음
- 🟢 **경계값 변경 시**: 코드만 수정, DB 마이그레이션 불필요

**단점**:
- 🔴 **매번 계산 비용**: `calculateLevel(exp)` 호출 (미미하지만)
- 🔴 **쿼리에서 "Lv5 이상 유저"** 같은 질의 불가 (클라에서 필터링만)
- 🔴 **기존 코드 대량 수정**: `userData.level` 직접 참조하는 모든 곳
- 🔴 **`authorInfo` 스냅샷 문제**: 글 작성 시 당시 레벨 보존 필요하면?

**기존 코드 영향**:
```typescript
// AS-IS
authorInfo: { level: userData.level, ... }

// TO-BE
authorInfo: { level: calculateLevel(userData.exp), ... }
```

→ 10+ 곳 수정 필요

#### 5.2.2 옵션 B: DB 저장, EXP 업데이트 시 함께 저장

**구조**:
```typescript
// types.ts
interface UserData {
  exp: number;
  level: number;  // EXP 변화 시 재계산하여 함께 저장
}

// 업데이트 시
const newExp = user.exp + gainedExp;
const newLevel = calculateLevel(newExp);
await updateDoc(userRef, { exp: newExp, level: newLevel });
```

**장점**:
- 🟢 **쿼리 가능**: `where('level', '>=', 5)` 직접 사용
- 🟢 **기존 코드 호환**: `userData.level` 그대로 참조
- 🟢 **성능**: 매번 계산 불필요
- 🟢 **authorInfo 스냅샷 자연스러움**: 작성 당시 레벨 고정

**단점**:
- 🔴 **경계값 변경 시 마이그레이션**: 전 유저 `level` 재계산 CF 필요
- 🔴 **불일치 위험**: `exp` 업데이트하고 `level` 깜빡하면 오류
- 🔴 **트랜잭션 필요**: 동시 업데이트 보장
- 🔴 **저장 공간**: 문서당 1 필드 추가 (미미)

**추가 고려사항**:
- 레벨다운은 가능? (감쇠 도입 시) → Phase A에서는 레벨다운 없음, Phase B 이후 검토

#### 5.2.3 옵션 C: 하이브리드 (비정규화 + 주기적 재계산)

**구조**:
```typescript
// types.ts
interface UserData {
  exp: number;
  level: number;         // 비정규화 (쿼리 효율)
  levelUpdatedAt: Timestamp;  // 마지막 재계산 시각
}

// EXP 업데이트 시
await updateDoc(userRef, { exp: increment(gainedExp) });
// level은 별도 CF에서 주기적으로 업데이트

// CF (매일 또는 실시간 트리거)
exports.recalculateLevel = onDocumentUpdated('users/{uid}', async (event) => {
  const newExp = event.data.after.data().exp;
  const newLevel = calculateLevel(newExp);
  if (newLevel !== event.data.before.data().level) {
    await event.data.after.ref.update({ 
      level: newLevel, 
      levelUpdatedAt: FieldValue.serverTimestamp() 
    });
  }
});
```

**장점**:
- 🟢 **쿼리 가능**
- 🟢 **EXP 업데이트 단순** (increment만)
- 🟢 **CF에서 레벨업 알림 트리거 가능**

**단점**:
- 🔴 **CF 비용**: `onDocumentUpdated`가 모든 user 문서 변경 시 호출
- 🔴 **지연**: CF 실행까지 레벨 업데이트 지연 (수초~분)
- 🔴 **복잡도 증가**
- 🔴 **Phase A에서 과투자**: 유저 적어 이익 미미

### 5.3 비교 매트릭스

| 기준 | 옵션 A | 옵션 B | 옵션 C |
|------|:-----:|:-----:|:-----:|
| 구현 난이도 | 🟡 중 (코드 수정 多) | 🟢 하 (기존 유지) | 🔴 상 (CF 필요) |
| 쿼리 효율 | 🔴 불가 | 🟢 최상 | 🟢 최상 |
| 저장 공간 | 🟢 최소 | 🟡 소폭 | 🟡 소폭 |
| 불일치 위험 | 🟢 불가능 | 🟡 있음 | 🟢 CF가 보정 |
| 경계값 변경 | 🟢 쉬움 | 🔴 마이그레이션 필요 | 🟡 CF 재실행 |
| Phase A 적합성 | 🟡 | 🟢 | 🔴 |
| Phase C 적합성 | 🔴 (쿼리 한계) | 🟢 | 🟢 |

### 5.4 최종 결정: **옵션 B 유지** (v2 §2.5 번복)

**결정**: v2 §2.5의 "옵션 A" 결정을 **옵션 B로 번복**.

**근거**:

1. **현실 수용**: 이미 `types.ts`·코드가 옵션 B 상태 → 옵션 A 전환 비용 과다
2. **쿼리 필요성**: `authorInfo` 스냅샷, 랭킹, 관리자 "Lv5 이상 유저 조회" 등
3. **Phase A 단순성**: CF 트리거(옵션 C) 과투자, 직접 저장이 깔끔
4. **경계값 안정성**: Phase A/B는 경계값 변경 드묾, 마이그레이션 리스크 수용 가능
5. **성능**: 매 조회마다 `calculateLevel` 호출 비용 회피

### 5.5 옵션 B의 구현 원칙

#### 원칙 1: EXP 업데이트는 항상 레벨 함께

```typescript
// 금지 (불일치 위험)
await updateDoc(userRef, { exp: increment(2) });

// 권장 (함께 업데이트)
const currentExp = userData.exp || 0;
const newExp = currentExp + 2;
const newLevel = calculateLevel(newExp);
await updateDoc(userRef, { 
  exp: newExp,  // increment 대신 절대값
  level: newLevel 
});
```

**단, Rules가 exp 증가 상한 +100 가드 적용 중** (ANTI_ABUSE §4.2) → `increment` 병행 가능하되 레벨도 재계산 필요.

#### 원칙 2: 레벨 변경 감지 시 알림

```typescript
// 클라 훅 or CF에서
if (oldLevel < newLevel) {
  // 레벨업 축하 토스트
  // 알림 생성 (notifications 컬렉션)
}
```

#### 원칙 3: 경계값 변경 시 마이그레이션 CF

```javascript
// functions/recalcLevels.js (Phase B 경계값 변경 시)
exports.recalcLevels = onCall(
  { region: 'asia-northeast3' },
  async () => {
    if (!isAdmin(request.auth.uid)) {
      throw new HttpsError('permission-denied', 'Admin only');
    }
    const users = await db.collection('users').get();
    const batch = db.batch();
    users.forEach(doc => {
      const exp = doc.data().exp || 0;
      const newLevel = calculateLevel(exp);
      if (newLevel !== doc.data().level) {
        batch.update(doc.ref, { level: newLevel });
      }
    });
    await batch.commit();
    return { updated: users.size };
  }
);
```

**특징**:
- Admin 전용
- 경계값 변경 후 수동 트리거
- 배치 처리 (500건씩 분할)

---

## 6. 데이터 모델

### 6.1 UserData 타입 (옵션 B 확정)

```typescript
// src/types.ts
export interface UserData {
  uid: string;
  nickname: string;
  email?: string;
  
  /**
   * 레벨 (1~10)
   * - 저장 방식: DB 저장 (옵션 B 확정, LEVEL_V2 §5.4)
   * - 쓰기: EXP 변경 시 calculateLevel(exp)와 함께 업데이트
   * - 불일치 발생 시: 관리자 recalcLevels CF 실행
   */
  level: number;
  
  /**
   * 경험치 (누적)
   * - 시간 감쇠 없음 (평판과 구분)
   * - Phase A: Rules 가드로 1회 +100 이하만 허용
   */
  exp?: number;
  
  // ... (기존 필드)
  likes: number;
  totalShares?: number;
  friendList?: string[];
  blockList?: string[];
  
  // 기타
  ballBalance?: number;
  nicknameChangedAt?: FirestoreTimestamp;
}
```

### 6.2 NEW: LevelChangeEvent (알림 용, Phase B)

```typescript
// 알림 종류 확장
export interface LevelUpNotification {
  type: 'level_up';
  oldLevel: number;
  newLevel: number;
  newExp: number;
  unlockedFeatures?: string[];  // "Lv3 땡스볼 수신 해제"
  createdAt: FirestoreTimestamp;
}
```

### 6.3 레벨 경계값 상수

```typescript
// src/constants/level.ts (신규)

/**
 * 레벨 경계값 (Phase A)
 * Phase B/C 조정 시 TUNING_SCHEDULE.md §3 준수
 */
export const LEVEL_THRESHOLDS = [
  { level: 1,  minExp: 0 },
  { level: 2,  minExp: 50 },
  { level: 3,  minExp: 150 },
  { level: 4,  minExp: 300 },
  { level: 5,  minExp: 500 },
  { level: 6,  minExp: 700 },
  { level: 7,  minExp: 1000 },
  { level: 8,  minExp: 1500 },
  { level: 9,  minExp: 2000 },
  { level: 10, minExp: 3000 },
] as const;

export const calculateLevel = (exp: number): number => {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (exp >= LEVEL_THRESHOLDS[i].minExp) {
      return LEVEL_THRESHOLDS[i].level;
    }
  }
  return 1;
};

export const getExpToNextLevel = (exp: number): number | null => {
  const currentLevel = calculateLevel(exp);
  if (currentLevel >= 10) return null;  // 최대 레벨
  const nextThreshold = LEVEL_THRESHOLDS[currentLevel].minExp;
  return nextThreshold - exp;
};
```

### 6.4 EXP 공식 상수

```typescript
// src/constants/exp.ts (신규)

/**
 * EXP 획득 규칙 (LEVEL_V2 §3)
 */
export const EXP_RULES = {
  // 글자 수 기반 (글·댓글)
  POST_LENGTH: {
    MIN: 10,      // 10자 미만 지급 없음
    SHORT: 100,   // 10~99자
    MEDIUM: 300,  // 100~299자
    LONG: 1000,   // 300~999자
    // 1000자 이상은 LONG+
  },
  
  POST_BASE_EXP: {
    SHORT: 1,      // 10~99자
    MEDIUM: 2,     // 100~299자
    LONG: 4,       // 300~999자
    VERY_LONG: 6,  // 1000자+
  },
  
  POST_BONUS: {
    IMAGE: 1,    // 이미지 첨부
    LINK: 1,     // 링크 첨부
  },
  
  // 기타 활동
  VIEW_POST: 1,            // 조회 (세션당 1회)
  LIKE_MILESTONE: 5,       // 좋아요 3개 달성 (작성자에게, 1회)
  FRIEND_ADD: 2,           // 깐부 맺기 (v2-14)
  FRIEND_REMOVE: 0,        // 깐부 해제 (v2-14)
  
  // 어뷰징 방어
  MAX_EXP_PER_UPDATE: 100, // Rules 가드 상한
} as const;
```

---

## 7. 구현 변경 범위

### 7.1 EXP 획득 지점 수정 (7개 → 품질 가중치 공식)

#### 7.1.1 글·댓글 EXP 계산 함수로 통합

```typescript
// src/utils.ts (확장)
import { EXP_RULES } from '@/constants/exp';

export const calculateExpForPost = (
  content: string,
  hasImage: boolean = false,
  hasLink: boolean = false,
): number => {
  const plainText = content.replace(/<[^>]*>/g, '').replace(/\s/g, '');
  const length = plainText.length;
  
  if (length < EXP_RULES.POST_LENGTH.MIN) return 0;
  
  let baseExp: number;
  if (length >= EXP_RULES.POST_LENGTH.LONG)        baseExp = EXP_RULES.POST_BASE_EXP.VERY_LONG;
  else if (length >= EXP_RULES.POST_LENGTH.MEDIUM) baseExp = EXP_RULES.POST_BASE_EXP.LONG;
  else if (length >= EXP_RULES.POST_LENGTH.SHORT)  baseExp = EXP_RULES.POST_BASE_EXP.MEDIUM;
  else                                              baseExp = EXP_RULES.POST_BASE_EXP.SHORT;
  
  if (hasImage) baseExp += EXP_RULES.POST_BONUS.IMAGE;
  if (hasLink)  baseExp += EXP_RULES.POST_BONUS.LINK;
  
  return baseExp;
};
```

#### 7.1.2 useFirestoreActions.ts 수정

**AS-IS (7개 지점 각각)**:
```typescript
if (isEligibleForExp(postData.content || '')) {
  await updateDoc(doc(db, 'users', userData.uid), { exp: increment(2) });
}
```

**TO-BE (7개 지점 통일)**:
```typescript
const gainedExp = calculateExpForPost(
  postData.content || '',
  !!postData.imageUrl,
  !!postData.linkUrl,
);
if (gainedExp > 0) {
  const currentExp = userData.exp || 0;
  const newExp = currentExp + gainedExp;
  const newLevel = calculateLevel(newExp);
  await updateDoc(doc(db, 'users', userData.uid), {
    exp: newExp,
    level: newLevel,
  });
}
```

**수정 대상 지점** (7개 → 실제로는 글/댓글이 주, 공유 등 별개):
- 신규 글 (`handlePostSubmit`)
- 연계글 (`handleLinkedPostSubmit`)
- 인라인 댓글 (`handleInlineReply`)
- 폼 댓글 (`handleCommentSubmit`)
- 깐부 맺기 (`toggleFriend`) — +2로 변경 + `level` 함께 업데이트
- 좋아요 3개 달성 (`handleLike`) — `level` 함께 업데이트
- 글 조회 (`handleViewPost`) — `level` 함께 업데이트

### 7.2 레벨 해금 게이트 통합

#### 7.2.1 levelGate.ts 신규 파일 (§4.3.2)

#### 7.2.2 기능별 기존 체크 → `canUseFeature` 호출로 변경

```typescript
// AS-IS (예시: 홍보 카드)
if (userData.level < 2) {
  alert('Lv2 이상만 등록 가능합니다');
  return;
}

// TO-BE
import { canUseFeature } from '@/utils/levelGate';

if (!canUseFeature(userData.level, 'kanbu_promo')) {
  alert('Lv2 이상만 등록 가능합니다');
  return;
}
```

**수정 대상**:
- 깐부 홍보 등록
- 땡스볼 수신 (CF 내부)
- 가판대/단골장부 등록
- 광고 슬롯 표시
- 광고 수익 + 20% 적용 (정산 CF)

### 7.3 Phase B: 조회 EXP → Firestore 마커

```typescript
// AS-IS
const sessionKey = `viewed_${post.id}`;
if (sessionStorage.getItem(sessionKey)) return;
sessionStorage.setItem(sessionKey, '1');
updateDoc(doc(db, 'users', userData.uid), { exp: increment(1) });

// TO-BE (Phase B)
const markerId = `${userData.uid}_${post.id}`;
const markerRef = doc(db, 'viewed_posts', markerId);
const markerSnap = await getDoc(markerRef);
if (markerSnap.exists()) return;

await Promise.all([
  setDoc(markerRef, {
    uid: userData.uid,
    postId: post.id,
    viewedAt: serverTimestamp(),
  }),
  (async () => {
    const newExp = (userData.exp || 0) + 1;
    const newLevel = calculateLevel(newExp);
    await updateDoc(doc(db, 'users', userData.uid), {
      exp: newExp,
      level: newLevel,
    });
  })(),
]);
```

**비용 고려**:
- 유저 1,000 × 평균 조회 100글 = 10만 문서/월
- Firestore 쓰기 10만 × $0.18/100k = $0.18/월
- **현실적 비용**, Phase B 도입 가능

---

## 8. 테스트 시나리오

### 8.1 EXP 공식 검증

| # | 시나리오 | 조건 | 기대 EXP |
|:-:|---------|------|:--------:|
| 1 | 9자 글 | 글자수 부족 | 0 |
| 2 | 10자 글 | 최소 조건 | +1 |
| 3 | 50자 글 | SHORT | +1 |
| 4 | 99자 글 | SHORT 경계 | +1 |
| 5 | 100자 글 | MEDIUM | +2 |
| 6 | 299자 글 | MEDIUM 경계 | +2 |
| 7 | 300자 글 | LONG | +4 |
| 8 | 999자 글 | LONG 경계 | +4 |
| 9 | 1000자 글 | VERY_LONG | +6 |
| 10 | 2000자 글 + 이미지 | VERY_LONG + 이미지 | +7 |
| 11 | 1500자 글 + 이미지 + 링크 | VERY_LONG + 양 보너스 | +8 |
| 12 | 100자 글 + 이미지 | MEDIUM + 이미지 | +3 |

### 8.2 레벨 변경 검증

| # | 시나리오 | 이전 EXP | 추가 EXP | 기대 결과 |
|:-:|---------|:-------:|:-------:|----------|
| 13 | Lv1 → Lv2 경계 | 48 | +2 | exp=50, level=2 |
| 14 | Lv1 유지 | 48 | +1 | exp=49, level=1 |
| 15 | Lv4 → Lv5 | 498 | +2 | exp=500, level=5 |
| 16 | Lv9 → Lv10 | 2998 | +2 | exp=3000, level=10 |
| 17 | Lv10 유지 (최대) | 4000 | +6 | exp=4006, level=10 |

### 8.3 해금 기능 검증

| # | 유저 레벨 | 기능 | 기대 결과 |
|:-:|:--------:|------|----------|
| 18 | Lv1 | `kanbu_promo` | 🔴 차단 |
| 19 | Lv2 | `kanbu_promo` | ✅ 허용 |
| 20 | Lv2 | `thanksball_receive` | 🔴 차단 |
| 21 | Lv3 | `thanksball_receive` | ✅ 허용 |
| 22 | Lv4 | `ad_slot` | 🔴 차단 |
| 23 | Lv5 | `ad_slot` | ✅ 허용 |
| 24 | Lv6 | `ad_revenue_bonus` | 🔴 차단 |
| 25 | Lv7 | `ad_revenue_bonus` | ✅ 허용 |

### 8.4 어뷰징 방어 검증

| # | 시나리오 | 기대 결과 |
|:-:|---------|----------|
| 26 | F12로 `exp: 99999` 직접 설정 | 🔴 Rules 차단 (ANTI_ABUSE §4) |
| 27 | F12로 `exp: increment(1000)` | 🔴 Rules 차단 (+100 초과) |
| 28 | 10자 봇 스팸 24시간 | Lv5 도달 불가 (EXP 반토막) |
| 29 | 다계정 100개 깐부 맺기 | +200 EXP만 (Lv3 수준) |

### 8.5 통합 시나리오

**시나리오 A: 정상 크리에이터 성장**

1. 깐부1호 가입, exp=0, level=1
2. 300자 글 3개 작성 (각 +4) → exp=12, level=1
3. 1,000자 글 1개 (+6) + 이미지 (+1) → exp=19, level=1
4. 1주 동안 비슷한 패턴 → exp=150, level=3 도달
5. 땡스볼 수신 기능 해금 확인 (`canUseFeature`)

**시나리오 B: Rules가 막는 공격**

1. 불량깐부1호 F12 콘솔 접속
2. `updateDoc(doc(db, 'users', uid), { exp: 99999, level: 10 })` 시도
3. **PERMISSION_DENIED** (Rules가 exp ≤ resource+100 체크)
4. `audit_anomalies` 로그 기록 (Phase B CF)

---

## 9. Step별 구현 우선순위

### 9.1 Step 1 범위 (지금 ~ 투자 유치 기획서)

| 순서 | 작업 | 파일 | 난이도 |
|:----:|------|------|:------:|
| 1 | 본 문서 승인 | `LEVEL_V2.md` | — |
| 2 | `constants/level.ts` + `constants/exp.ts` 설계 확정 | 신규 파일 | 🟢 하 |
| 3 | `types.ts` UserData 주석 보강 | `types.ts` | 🟢 하 |

**이 단계의 핵심**: 설계만, 코드 변경은 다음 Step.

### 9.2 Step 2 범위 (기능 보완)

| 작업 | 관련 섹션 | 비고 |
|------|----------|------|
| `calculateExpForPost` 함수 구현 | §3.2.1 | v2-13 품질 가중치 |
| `useFirestoreActions.ts` EXP 지점 7곳 수정 | §7.1 | 품질 공식 + level 동시 업데이트 |
| `levelGate.ts` 신규 + 기능별 교체 | §7.2 | 해금 게이트 통합 |
| 깐부 EXP 완화 (+2/0) | v2-14 | ANTI_ABUSE §5.2.1 |

### 9.3 Step 3 범위 (로그인/회원가입 재설계)

| 작업 | 비고 |
|------|------|
| 신규 가입자 초기 EXP 설정 (현재 0) | 유지 |
| 첫 글 작성 가이드 (품질 공식 설명) | UX 개선 |

### 9.4 Phase B 작업

| 작업 | 트리거 |
|------|--------|
| `viewed_posts` Firestore 마커 | 유저 1,000명 도달 |
| `detectRapidExpGain` CF | 위와 동시 |
| 경계값 조정 + `recalcLevels` CF | TUNING_SCHEDULE B단계 |
| 레벨업 알림 시스템 | UX 개선 |

### 9.5 Phase C (정식 출시)

| 작업 | 근거 |
|------|------|
| 경계값 상향 조정 + 기득권 보장 | TUNING_SCHEDULE §4 |
| Prestige 시스템 연계 | REPUTATION_V2 §6 |

### 9.6 금지 작업

- ❌ 레벨 저장 방식 옵션 C(하이브리드) 조기 도입 (유저 규모 부족)
- ❌ 복잡한 EXP 보너스 시스템 (로그인 스트릭 등) — Phase C 이후
- ❌ 레벨다운 로직 (감쇠) — Phase B 이후 검토 대상

---

## 10. 다른 설계서와의 참조 관계

```
LEVEL_V2.md (본 문서)
    ↓ 기반 제공
    ├─→ REPUTATION_V2.md (평판 공식, 레벨과 독립)
    │    └─→ 아바타 이중 링 (안: 레벨, 밖: 평판)
    ├─→ CREATOR_SCORE.md (통합 지표 = 평판 × 활동성 × 신뢰도)
    │    └─→ 활동성 ≈ EXP 관련
    ├─→ MAPAE_AND_TITLES_V1.md (레벨별 특정 칭호)
    │    └─→ Lv10 이상 칭호는 Prestige 기반
    └─→ ADMIN.md (레벨 관리 UI)
         ├─→ 수동 레벨 조정
         ├─→ `recalcLevels` CF 트리거
         └─→ 레벨 통계 대시보드

ANTI_ABUSE.md §5.2.3 ← LEVEL_V2 §3.4 어뷰징 방어
TUNING_SCHEDULE.md §3 ← LEVEL_V2 §4.2 경계값 Phase별 조정
PRICING.md (독립)
GLOVE_SYSTEM_REDESIGN_v2.md §2 ← LEVEL_V2 전체 상세화
```

### 10.1 REPUTATION_V2와의 구분

| 항목 | LEVEL (본 문서) | REPUTATION (별도) |
|------|----------------|-------------------|
| 본질 | **활동량** | **콘텐츠 품질** |
| 공식 입력 | EXP (글/댓글/조회/좋아요) | likes, totalShares, ballReceived |
| 시간 감쇠 | **없음** | 월 0.5% (Phase B~) |
| 상한 | Lv10 (고정) | 없음 (Prestige로 연결) |
| UI 표시 | 아바타 안쪽 링 | 아바타 바깥 링 |

### 10.2 ADMIN.md의 레벨 관련 요구사항

ADMIN.md 작성 시 포함될 내용:
- 수동 레벨 부여/회수 UI (신변 위협 등 예외)
- 경계값 변경 시 `recalcLevels` 트리거 버튼
- 레벨 분포 통계 (1~10 히스토그램)
- 어뷰징 의심 유저 조사 (EXP 급증)

---

## 📝 결론

글러브의 레벨 시스템은 **활동량의 누적 지표**로, 품질 가중치로 어뷰징을 방지하고 해금 기능으로 성장 동기를 제공합니다.

**Phase A (현재)에서 할 것**:
- 설계 확정 (본 문서)
- 경계값 유지
- Step 2에서 품질 가중치 공식 구현

**Phase B 이후**:
- 경계값 조정 (TUNING_SCHEDULE)
- Firestore 조회 마커 도입
- 어뷰징 탐지 CF

**핵심 결정**:
- **옵션 B 채택** (DB 저장, v2 §2.5 번복)
- **품질 가중치 공식** (10/100/300/1000자 구간 + 이미지·링크 가산)
- **levelGate.ts 통합** (해금 게이트 단일 진실 소스)

**다른 문서와의 관계**:
- REPUTATION과 독립 (양 vs 질)
- CREATOR_SCORE의 입력 중 하나 (활동성)
- 마패·칭호의 기반

---

## 11. 장기 로드맵 (출시 후 작업)

> 작성일: 2026-04-21 — Sprint 1 LEVEL_TABLE 결정 과정에서 논의된 장기 방향성 기록.

### 11.1 Phase A (베타, 현재) LEVEL_TABLE 확정

**결정**: `[0, 30, 100, 250, 500, 1000, 2000, 4000, 7000, 10000]` 유지 (src/utils.ts:48)

**근거**:
- 적극 유저(27 EXP/일) 기준 Lv10 도달 = **약 1년** → 네이버 파워블로거/브런치 작가 수준의 희소성
- §4.1의 베타 경계값(최고 3000)은 "유저 적을 때 빠른 성장 피드백" 의도였으나, 플랫폼 포지셔닝("내 글이 돈이 된다")엔 너무 느슨
- 특히 **Lv7 광고 수익 2배**가 LEVEL_V2 §4.1로는 적극 유저 기준 1.2개월 만에 풀림 → 광고 수익 게이트 신뢰 저하 우려
- Phase C에서 **상향 조정은 유저 신뢰에 치명적**이므로 처음부터 빡세게 시작

**Lv5 = 500, Lv7 = 2000 게이트 유지** → 광고 슬롯/수수료 차등의 의미 보존

### 11.2 추천코드 보상제 (Phase B, 출시 후)

**전략 배경**: 글러브는 "내가 쓴 글이 돈이 된다" 포지셔닝. **영상→글 전환 유저**(유튜버/블로거) 유치가 활성화 가속 핵심. 기존 SNS 구독자를 보유한 크리에이터가 들어와야 플랫폼이 빠르게 성장.

**설계 (추후 별도 문서 `REFERRAL_V1.md`에서 확정)**:

| 단계 | 추천자 EXP | 상한 | 도달 레벨 | 비고 |
|:--|:--:|:--:|:--:|:--|
| **Phase B1 (베타 한정)** | +10/명 | **300 EXP (30명)** | Lv4까지 | Lv5(광고 진입)는 실제 활동 필요 |
| **Phase B2 (정식 출시 직후)** | +10/명 | **500 EXP (50명)** | Lv5까지 | 추천만으로 광고 진입 가능 |
| **Phase C (성숙기)** | 다단계 | **1000 EXP+ (100명)** | — | 1~10명 +10, 11~30명 +5, 31+명 +1 등 체감 감쇠 |

**필수 안전장치 (모두 필수)**:
- 휴대폰 SMS 인증 (banned_phones 재사용) — 멀티계정 원천 차단
- 추천자 Lv2+ 조건 — 파밍 계정 차단
- 신규 유저 7일 활성화 + 글 1개 작성해야 추천자 EXP 잠금 해제
- 동일 IP/디바이스 24h 내 중복 추천 차단
- 월 10명 Rate Limit

**자동 깐부 맺기**: 추천코드 입력 시 자동으로 쌍방 깐부 관계 형성. 기존 toggleKanbu의 EXP 보상(+2)은 적용 안 함 (추천 EXP와 중복 방지).

### 11.3 Lv20 확장 (Phase C, 성숙기)

**목적**: 先발 유저와 후발 유저 간 **상대 격차 희석**.

| 상황 | 현재 Lv10 체계 | Lv20 확장 체계 |
|:--|:--:|:--:|
| 先발(Lv10) vs 후발(Lv5) | 9500 EXP 격차 = 전체의 **95%** | 같은 9500 EXP = 전체의 **9.5%** |
| 후발 유저 체감 | "절대 못 따라잡는다" | "금방 따라잡을 수 있다" |

**전제 조건** (중요):
- 단순 상한 확장은 **허영 뱃지**일 뿐 — Lv20 확장 시 **보상체계 전체를 완전 새롭게 재설계**해야 함
- 재설계 대상 (단순 추가가 아닌 전면 개편):
  - **수수료 체계**: 현재 Lv1~4(30%) / Lv5~6(25%) / Lv7+(20%) 3구간 → Lv20 구간별 세분화
  - **광고 수익 분배**: 현재 Lv5(30%) / Lv7(50%) / Lv9(70%) 3단계 → Lv20까지 6~10단계 정교화
  - **광고 슬롯 수**: 현재 0/1/2/3개 → 레벨별 차등 재구성
  - **땡스볼 정책**: 레벨별 수신 한도/수수료 여부 등 새 정책 도입 가능
  - **프리미엄 기능**: Lv13+ 커스텀 배경, Lv17+ 추천 피드, Lv20 명예전당 등
  - **수익 지분(Revenue Share)**: Lv20 유저에 플랫폼 수익 일부 분배 구조 (선택)
- **⚠️ 현재 Lv10 체계의 혜택 구조를 Lv20에 그대로 늘리기만 하면 Lv11~20 구간이 의미 상실** → 반드시 보상체계 전면 재설계 병행

**별도 설계서 `LEVEL_V3.md`에서 확정 예정**. 현재 Phase A~B에서는 Lv10 체계 유지.

### 11.4 Sprint 1 이후 우선순위

1. Sprint 1~N 완료 (기존 로드맵)
2. 베타 피드백 수집 (3~6개월)
3. 정식 출시 전 `REFERRAL_V1.md` 작성 + 구현
4. 출시 후 6개월+ 운영 데이터 기반 `LEVEL_V3.md` (Lv20 확장) 검토

---

**문서 버전**: v1.1 (2026-04-21 §11 장기 로드맵 추가)
**기준**: 옵션 B (DB 저장) + 품질 가중치 공식 + 통합 게이트 + Phase A LEVEL_TABLE 확정
**다음 업데이트**: Step 2 구현 후 실제 데이터 기반 경계값 조정 제안
