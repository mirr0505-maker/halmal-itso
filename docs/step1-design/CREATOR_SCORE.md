# 🏆 글러브(GeuLove) 크리에이터 점수 설계서 (CREATOR_SCORE.md)

> **작성일**: 2026-04-20
> **버전**: v1.0 (Step 1 종합기획)
> **상태**: 신규 시스템 설계, 구현 대기
> **의존**: GLOVE_SYSTEM_REDESIGN_v2.md §6 · REPUTATION_V2.md §10 (공개 API) · LEVEL_V2.md §4 · ANTI_ABUSE.md · PRICING.md §2 (유배)
> **후속 의존**: MAPAE_AND_TITLES_V1.md (§10에서 공개 API 정의)

---

## 📋 목차

- §0. 개요 & 원칙
- §1. 현재 상태 진단 (부재)
- §2. 설계 요구사항
- §3. 공식 재설계 (v2 §6.3 확장)
- §4. 활동성 상세 설계
- §5. 신뢰도 상세 설계
- §6. 저장 방식 결정 (3-옵션 비교)
- §7. 데이터 모델
- §8. 구현 변경 범위
- §9. Phase별 로드맵
- §10. 마패·추천·경매 연결 인터페이스
- §11. 테스트 시나리오
- §12. 결정 요약 & 다음 단계

---

## 0. 개요 & 원칙

### 0.1 문서 범위

**CREATOR_SCORE는 글러브의 "크리에이터로서의 종합 가치"를 단일 숫자로 표현하는 지표 시스템의 단일 진실 소스**다.

커버 범위:
- **종합 공식**: `Creator Score = (평판 × 활동성 × 신뢰도) / 1000`
- **활동성 (Activity)**: 최근 30일 활동량 / Lv별 중위값
- **신뢰도 (Trust)**: 어뷰징/유배/신고 감산 기반
- **저장 방식**: 캐시 + 함수 폴백 (LEVEL/REPUTATION과 동일 전략)
- **마패·추천·경매에 공급할 공개 API**
- **Phase별 도입 로드맵**

**다음 범위는 다른 문서가 담당**:

| 범위 | 담당 문서 |
|------|-----------|
| 평판 공식·감쇠·감점 | `REPUTATION_V2.md` |
| 레벨·EXP 공식 | `LEVEL_V2.md` |
| 깐부 관계 집계 | `KANBU_V2.md` |
| 마패 5단계 시각·획득 표기 | `MAPAE_AND_TITLES_V1.md` (후속) |
| 칭호 14개 | `MAPAE_AND_TITLES_V1.md` (후속) |
| 어뷰징 탐지 CF | `ANTI_ABUSE.md` |
| 유배 속죄금 | `PRICING.md §2` |
| 관리자 수동 Creator Score 조정 | `ADMIN.md` (후속) |

### 0.2 3대 원칙

**① 종합성 — 단일 지표의 힘**

평판·레벨·신뢰도를 따로 보면 혼란스럽다. "이 크리에이터는 얼마나 가치 있는가?"의 **단일 답**이 필요하다.

```
레벨   = 활동의 양
평판   = 받은 반응의 질
신뢰도 = 어뷰징·규정 준수
──────────────────────
Creator Score = 이 셋의 종합
```

유저에게 보이는 것은 **마패 5단계**(§10.1)지만, 내부적으로는 Creator Score가 모든 랭킹·추천·경매의 입력.

**② 곱셈 — 약점이 치명적이게**

덧셈이 아닌 **곱셈** 사용:
- 평판이 높아도 **어뷰저는 0에 가까워짐** (신뢰도 ≈ 0.5)
- 평판이 높아도 **비활성은 내려감** (활동성 ≈ 0.2)
- 세 축 모두 충족해야 높은 점수

```
3,000 × 1.0 × 1.0 / 1000 = 3.0  (모범 크리에이터)
3,000 × 1.0 × 0.5 / 1000 = 1.5  (어뷰저, 평판만 높음)
3,000 × 0.2 × 1.0 / 1000 = 0.6  (과거 스타, 현재 잠수)
```

**③ 캐시 우선 — 성능과 일관성**

Creator Score는 대시보드·추천·리더보드 전반에서 N명 단위로 조회된다. **실시간 계산 비용이 크다.**

→ **옵션 B (캐시 + 함수 폴백)** 채택 (§6).

### 0.3 Creator Score의 역할 (4대 기능)

**① 마패 티어 판정** (`MAPAE_AND_TITLES_V1.md`와 연계)
- 동마패: 0.5 ~ 1.0
- 은마패: 1.0 ~ 2.0
- 금마패: 2.0 ~ 3.5
- 백금: 3.5 ~ 5.0
- 다이아: 5.0+

**② 추천 알고리즘 가중치**
- 홈 피드, 깐부 추천, 주제별 추천 등
- 평판 단독보다 정확 (어뷰저 필터링 내장)

**③ 광고 경매 품질 스코어** (ADSMARKET)
- 작성자 Creator Score가 광고 타겟팅 품질에 영향
- 낮은 Score → 광고 노출 페널티

**④ 경계선 규정 판정 입력**
- 광고 수익 출금 자격: Creator Score ≥ 1.0 (예시)
- 라이브 방송 호스트 권한: Creator Score ≥ 0.5
- 정책 위반 시 즉시 Score 하락 → 권한 회수

### 0.4 평판과의 명확한 구분

| 질문 | 평판 | Creator Score |
|------|:----:|:-------------:|
| 유저에게 **보이는** 숫자인가? | ✅ (배지·아바타 링) | ❌ (내부) |
| 단일 축 지표인가? | ✅ (받은 반응) | ❌ (3축 종합) |
| 마패 판정의 **직접** 입력? | ❌ | ✅ |
| 어뷰징 플래그 반영? | 감점 적용 | 신뢰도에 반영 |
| 시간 감쇠 반영? | ✅ (공식 내부) | 간접 (평판 경유) |

**원칙**: 유저는 **평판 Tier**를 보고, 시스템은 **Creator Score**를 본다.

### 0.5 개발 수칙 (CLAUDE.md 준수)

- **최소 변경 원칙**: 요청받지 않은 파일 건드리지 않기
- **Rules 우선**: `creatorScoreCached` 등 민감 필드 클라이언트 쓰기 금지
- **CF 경유**: 모든 Score 계산은 CF에서
- **Phase별 배포**: B → C 순서 (Phase A는 미도입)
- **롤백 경로 확보**: 모든 변경은 `git revert` 가능 상태로

---

## 1. 현재 상태 진단 (부재)

### 1.1 핵심 관찰: Creator Score는 신규 시스템

**현재 코드베이스에 존재하지 않음**. `src/utils.ts`, `functions/`, Firestore 어디에도 `creatorScore` 관련 함수·필드·컬렉션 없음.

**현재 글러브의 종합 지표 공백**:

| 지표 | 저장 위치 | 현재 역할 |
|------|-----------|----------|
| `level` | `users.level` | 수익 게이트 |
| `exp` | `users.exp` | 레벨 입력 |
| `likes` | `users.likes` | 평판 입력 |
| `totalShares` | `users.totalShares` | 평판 입력 |
| `ballReceived` | `users.ballReceived` | 평판 입력 |
| `getReputationScore()` | 계산 함수 | 공개 프로필 배지 |
| `followerCount` | 실시간 집계 | 깐부수 표시 |
| `pendingRevenue` | `users.pendingRevenue` | 수익 표시 |

**문제**: 여러 지표가 분산되어 있어, 다음 결정에서 "어느 지표 기준?"이 불명확.

- 광고 경매 품질: `level`? `reputation`? 혼합?
- 추천 랭킹: `likes`? `ballReceived`? 혼합?
- 마패 판정 (향후): ???
- 호스트 권한 (라이브): ???

### 1.2 현재 대체 로직

**추천**: 대부분 시간순(`createdAt DESC`) + 일부 좋아요순(`likes DESC`).

**광고 경매**: `bidAmount` 단독 (품질 평가 없음).

**권한 게이트**: 레벨 기반 (Lv3 → 땡스볼 수신, Lv5 → 광고 등).

**문제점**:
- 봇이 레벨 기준을 통과하면 권한 획득 가능
- 어뷰저가 "평판 확고" 달성해도 계속 활동
- 신규 유저의 양질 글이 상단 노출 어려움

### 1.3 v2 §6.3에서 이미 확정된 골격

현재 상태는 "부재"지만, v2 §6.3에서 **공식 틀**은 이미 확정:

```
Creator Score = (평판 × 활동성 × 신뢰도) / 1000

평판    = getReputationScore (v2-R 개선 공식)
활동성  = min(1.0, 최근_30일_활동량 / 평균)
신뢰도  = 1.0 - 어뷰징_감점
```

본 문서는 이 골격을 **실제 구현 가능 수준**으로 상세화.

---

## 2. 설계 요구사항

### 2.1 왜 Creator Score가 필요한가

**문제 상황**:

```
상황 A (현재):
  봇 어카운트 → 레벨 10 달성 → 광고 수익 출금 자격
  → 플랫폼 신뢰 훼손

상황 B (현재):
  어뷰저 → 평판 "확고" 달성 (맞땡스볼 담합)
  → 추천 상단 노출 → 실제 봇이 시청
  → 광고주 피해
```

**해결책**:

```
Creator Score < 0.5 → 수익 출금 차단
Creator Score < 0.3 → 추천 상단 배제
Creator Score 실시간 반영 → 어뷰징 즉시 권한 회수
```

### 2.2 왜 단일 지표로 통합해야 하는가

**대안 1 (현재)**: 각 권한마다 다른 게이트

```typescript
if (user.level >= 5 && user.reputation >= 1000) { ... }
if (user.level >= 7 && !user.hasAbuseFlag && user.activityRecent > 30) { ... }
```

**문제**:
- 각 지점마다 중복 조건문
- 조건 변경 시 여러 파일 수정
- 정책 일관성 부재

**대안 2 (제안)**: Creator Score 단일 게이트

```typescript
if (user.creatorScore >= 0.5) { ... }
if (user.creatorScore >= 1.0) { ... }
```

**장점**:
- 단일 필드 참조
- 정책 중앙 관리
- 캐시 O(1) 읽기

### 2.3 v2 §6.3 공식의 타당성 검토

**공식**:
```
Creator Score = (평판 × 활동성 × 신뢰도) / 1000
```

**왜 1000으로 나누는가?**

평판이 수천 단위 (예: 확고 3,000) → 곱한 결과가 수천 단위가 됨. 읽기 쉽도록 1000으로 나눠 "한 자릿수 + 소수점" 범위로 축소.

**예시**:
- 평판 3,000 × 활동성 1.0 × 신뢰도 1.0 = 3,000
- / 1000 = **3.0** ← 금마패 구간

**왜 곱셈인가?**

덧셈이면 한 축의 약점을 다른 축이 가려준다:

```
덧셈 (비추천):  평판 5,000 + 활동성 0 + 신뢰도 0 = 5,000 (여전히 높음)
곱셈 (채택):    평판 5,000 × 활동성 0 × 신뢰도 0 = 0 ← 명확한 배제
```

곱셈이 **세 축 모두 충족**을 강제.

### 2.4 Step 1 기획에서 결정할 세부사항

v2 §6.3은 공식 틀만 제시. 실제 구현을 위해 다음이 결정되어야 함:

1. **Lv1~4, Lv6~9의 중위값** (v2는 Lv5=30, Lv10=100만 명시) — §4.2
2. **"보낸 좋아요" 집계 방식** (현재 저장 안 됨) — §4.3
3. **유배 단계별 신뢰도 감산 차등** (v2는 "1회 -0.1"만) — §5.3
4. **신고 누적 감산 방식** (v2는 "5회 -0.05"만) — §5.4
   - ⚠️ **신고 시스템은 Phase C 이후 개발 예정** (Phase A/B에서 `reportsUniqueReporters = 0` 고정 취급, 관리자 수동 제재만 운영 — 상세: `ADMIN.md §5`)
5. **저장 방식** (3-옵션 비교) — §6
6. **배치 스케줄** (평판 04:45 이후 → 05:00 제안)

---

## 3. 공식 재설계 (v2 §6.3 확장)

### 3.1 최종 공식

```typescript
/**
 * Creator Score — 크리에이터 종합 지표
 *
 * 평판 × 활동성 × 신뢰도 / 1000
 */
export const calculateCreatorScore = (user: UserData): number => {
  const reputation = useReputation(user);      // REPUTATION_V2.§10
  const activity   = calculateActivityFactor(user);
  const trust      = calculateTrustFactor(user);

  const raw = (reputation * activity * trust) / 1000;

  // 소수점 2자리까지 반올림
  return Math.round(raw * 100) / 100;
};
```

**출력 범위**: `0.00` ~ 무제한 (이론상)

**실전 분포 예상**:
- 신규·저활동: 0 ~ 0.5
- 일반 크리에이터: 0.5 ~ 2.0
- 인기 크리에이터: 2.0 ~ 5.0
- 톱 크리에이터: 5.0+

### 3.2 평판 컴포넌트 (REPUTATION_V2 인터페이스 소비)

**소스**: `REPUTATION_V2.md §10.1` 공개 API

```typescript
import { useReputation } from './utils';

const reputation = useReputation(user);
// 내부적으로 user.reputationCached ?? getReputationScoreV2(user)
```

**특성**:
- 이미 시간 감쇠 적용 (`decay`)
- 이미 어뷰징 감점 적용 (`penalty`)
- 0 ~ 100,000+ 범위 (Prestige 포함)
- Phase A에서는 decay/penalty 모두 비활성 상태로 작동

**주의**: 평판 이미 `abuseFlags`를 반영하므로, 신뢰도에서 **이중 감점 주의**. §5.2에서 구분.

### 3.3 활동성 컴포넌트 (신규 설계)

**최종 공식**:

```typescript
/**
 * 활동성 계수
 *
 * 최근 30일 활동량 / Lv별 중위값
 * 최대 1.0, 최소 0.0
 */
export const calculateActivityFactor = (user: UserData): number => {
  const recentActivity = calculateRecent30dActivity(user);
  const levelMedian    = getLevelMedianActivity(user.level ?? 1);

  if (levelMedian === 0) return 0;

  const factor = recentActivity / levelMedian;
  return Math.min(1.0, Math.max(0.0, factor));
};

/**
 * 최근 30일 활동량 (가중 합산)
 */
export const calculateRecent30dActivity = (user: UserData): number => {
  return (user.recent30d_posts     || 0) * 3
       + (user.recent30d_comments  || 0) * 1
       + (user.recent30d_likesSent || 0) * 0.5;
};
```

**v2 §6.3의 근거**:
```
최근 30일 활동 = (신규 글×3) + (댓글×1) + (보낸 좋아요×0.5)
```

**가중치 해석**:
- **글 ×3**: 가장 의미 있는 활동, 플랫폼 콘텐츠 공급
- **댓글 ×1**: 참여, 대화 유발
- **보낸 좋아요 ×0.5**: 소비 활동, 반응 표시

**Lv별 중위값 (v2 §6.3)**: Lv5=30, Lv10=100. **Lv1~4, Lv6~9는 §4.2에서 3개 대안 비교**.

### 3.4 신뢰도 컴포넌트 (신규 설계)

**최종 공식**:

```typescript
/**
 * 신뢰도 계수
 *
 * 기본 1.0에서 어뷰징/유배/신고 기반 감산
 * 최소 0.3
 */
export const calculateTrustFactor = (user: UserData): number => {
  let trust = 1.0;

  // ① 어뷰징 감지 (플래그당 -0.05)
  const abuseCount = countActiveAbuseFlags(user.abuseFlags);
  trust -= abuseCount * 0.05;

  // ② 유배 이력 (단계별 차등 — §5.3 결정)
  trust -= calculateExilePenalty(user.exileHistory);

  // ③ 신고 누적 (방식 — §5.4 결정)
  trust -= calculateReportPenalty(user.reportsReceived || 0);

  return Math.max(0.3, trust);
};
```

**최소값 0.3**:
- 0.0이면 Creator Score가 0 → 모든 권한 박탈 (너무 강함)
- 0.3 = "매우 낮은 신뢰" 시그널, 권한 축소하되 복구 여지

**최대값 1.0**:
- 보너스 없음 (`= 1.0`이 기본값)
- Trust는 "감점만 있는" 축

### 3.5 Before/After 시뮬레이션

**8개 시나리오로 공식 타당성 검증**:

#### 시나리오 A: 모범 크리에이터

```
입력:
  평판: 2,500 (매우 우호 상단)
  Lv: 7
  최근 30일: 글 10 + 댓글 40 + 좋아요 80 = 30 + 40 + 40 = 110
  Lv7 중위값: 60 (§4.2 추천값)
  활동성: min(1.0, 110/60) = 1.0
  abuseFlags: 없음, 유배: 없음, 신고: 0
  신뢰도: 1.0

Creator Score = 2,500 × 1.0 × 1.0 / 1000 = 2.50
→ 금마패 (2.0 ~ 3.5)
```

✅ 의도 일치: 활발 + 깨끗 → 금마패.

#### 시나리오 B: 한 방 터진 신규

```
입력:
  평판: 1,800 (우호 상단, 시간 감쇠 없음)
  Lv: 3
  최근 30일: 글 2 + 댓글 10 + 좋아요 20 = 6 + 10 + 10 = 26
  Lv3 중위값: 15
  활동성: min(1.0, 26/15) = 1.0
  신뢰도: 1.0

Creator Score = 1,800 × 1.0 × 1.0 / 1000 = 1.80
→ 은마패 (1.0 ~ 2.0)
```

✅ 신규 유저도 활발하면 은마패. 격려.

#### 시나리오 C: 과거 스타, 현재 비활성

```
입력:
  평판: 4,000 (확고, 시간 감쇠 적용됨)
  Lv: 10
  최근 30일: 글 0 + 댓글 2 + 좋아요 5 = 0 + 2 + 2.5 = 4.5
  Lv10 중위값: 100
  활동성: min(1.0, 4.5/100) = 0.045 (≈ 0.05)
  신뢰도: 1.0

Creator Score = 4,000 × 0.05 × 1.0 / 1000 = 0.20
→ 마패 미달 (<0.5)
```

⚠️ 평판만으로는 "확고"인데 Creator Score는 마패 미달.
**의도 일치**: "지금" 활동하지 않으면 Creator Score 낮아져야.
하지만 평판 배지는 "확고" 유지 (유저 UX는 평판 배지 중심).

#### 시나리오 D: 맞땡스볼 어뷰저

```
입력:
  평판: 3,500 (담합으로 확고)
  Lv: 5
  최근 30일: 활발 (활동성 1.0)
  abuseFlags: { circularThanksball: true }  → 어뷰징 1건
  유배: 없음, 신고: 0
  신뢰도: 1.0 - 0.05 = 0.95

Creator Score = 3,500 × 1.0 × 0.95 / 1000 = 3.33
→ 금마패 (2.0 ~ 3.5)
```

❌ 감점이 약함! 금마패 유지. **의도 불일치**.

**원인 분석**:
- REPUTATION_V2에서 이미 `circularThanksball` → `-300` 감점 적용됨
- 평판에서 이미 반영된 것을 Creator Score에서 또 감산 = 이중 계산
- **해결**: 신뢰도는 "평판에 없는 다른 맥락의 감점"만 담당 (§5.2 상세)

**보정 후** (§5.2 해결 후):
```
평판 3,500이 이미 감점 반영됨
신뢰도는 유배/신고만 차감 → 1.0 유지
Score = 3,500 × 1.0 × 1.0 / 1000 = 3.50
```

하지만 `circularThanksball`은 **심각**한 어뷰징 → 추가 감점이 필요. §5.2에서 설계 조정.

#### 시나리오 E: 어뷰징 + 유배 이력

```
입력:
  평판: 2,000 (어뷰징 플래그 + 감쇠로 하락)
  Lv: 5
  최근 30일: 활발 (활동성 1.0)
  abuseFlags: { shortPostSpam: true }
  exileHistory: [{ level: 1, releasedAt: ... }] (1차 유배 1회)
  reports: 3 (Phase A/B에서는 집계 안 됨)

신뢰도 (§5.3 D3-γ, 속죄금 정합):
  - 어뷰징 1건: -0.05
  - 유배 1차 1회: -0.05
  - 신고 (Phase A/B 미적용): 감산 없음
  trust = 1.0 - 0.05 - 0.05 = 0.90

Creator Score = 2,000 × 1.0 × 0.90 / 1000 = 1.80
→ 은마패 (1.0 ~ 2.0)
```

✅ 의도 일치: 1차 유배자는 복귀 시 은마패 가능 (관대함).

#### 시나리오 F: 다중 어뷰징 + 유배 3차

```
입력:
  평판: 1,200 (감쇠 + 감점 누적)
  Lv: 6
  최근 30일: 적당 (활동성 0.7)
  abuseFlags: { shortPostSpam: true, multiAccount: true (Phase C) }
  exileHistory: [{ level: 1 }, { level: 2 }, { level: 3 }]
  reports: 12 (Phase A/B 미적용)

신뢰도 (§5.3 D3-γ, 속죄금 정합):
  - 어뷰징 2건 (Phase C): -0.10 (shortPostSpam 0.05 + multiAccount 0.15 예시)
    * Phase A/B에서는 shortPostSpam만 -0.05
  - 유배 (1+2+3차): -0.05 - 0.25 - 1.50 = -1.80
  - 신고: Phase A/B 미적용 (0)
  trust = 1.0 - 0.10 - 1.80 = -0.90 → max(0.3, -0.90) = 0.30 (MIN_TRUST 캡)

Creator Score = 1,200 × 0.7 × 0.30 / 1000 = 0.252
→ 마패 미달 (< 0.5)
```

✅ 심각 위반자: 마패 박탈. 속죄금 정합으로 3차 유배만으로도 즉시 캡 도달.

#### 시나리오 G: 깨끗하지만 저활동 · 저평판

```
입력:
  평판: 500 (약간 우호)
  Lv: 2
  최근 30일: 글 1 + 댓글 3 + 좋아요 5 = 3 + 3 + 2.5 = 8.5
  Lv2 중위값: 10
  활동성: min(1.0, 8.5/10) = 0.85
  신뢰도: 1.0

Creator Score = 500 × 0.85 × 1.0 / 1000 = 0.43
→ 마패 미달 (<0.5)
```

⚠️ 성장 중인 신규: 아직 마패 없음. **의도 일치**.

#### 시나리오 H: Prestige 달성자 (Phase C)

```
입력:
  평판: 15,000 (전설)
  Lv: 10
  최근 30일: 글 15 + 댓글 80 + 좋아요 200 = 45 + 80 + 100 = 225
  Lv10 중위값: 100
  활동성: min(1.0, 225/100) = 1.0
  신뢰도: 1.0

Creator Score = 15,000 × 1.0 × 1.0 / 1000 = 15.0
→ 다이아마패 훨씬 초과
```

✅ Prestige 달성자는 다이아마패 자동. **의도 일치**.

### 3.6 시뮬레이션 종합 해석

| 시나리오 | Score | 마패 티어 | 의도 일치? |
|:---------:|:-----:|:---------:|:----------:|
| A 모범 | 2.50 | 🥇 금 | ✅ |
| B 신규 한방 | 1.80 | 🥈 은 | ✅ |
| C 과거 스타 잠수 | 0.20 | ❌ | ✅ |
| D 맞땡스볼 (보정 전) | 3.33 | 🥇 금 | ❌ → §5.2 보정 |
| E 어뷰징+유배 | 1.70 | 🥈 은 | ✅ |
| F 다중 위반 | 0.25 | ❌ | ✅ |
| G 저활동 성장 | 0.43 | ❌ | ✅ |
| H Prestige | 15.0 | 👑 다이아 | ✅ |

**핵심 발견**:
- 시나리오 D (맞땡스볼)가 신뢰도 감산이 약함
- §5.2에서 "평판의 감점이 약한 경우 신뢰도로 보완" 설계
- 실제 구현 시 시나리오 D 테스트 케이스 반드시 포함

---
## 4. 활동성 상세 설계

### 4.1 활동 정의 (무엇이 "활동"인가)

**활동으로 인정되는 항목**:

| 항목 | 가중치 | 근거 |
|------|:------:|------|
| 글 작성 | ×3 | 콘텐츠 공급, 플랫폼 가치 |
| 댓글 작성 | ×1 | 참여, 대화 유발 |
| 보낸 좋아요 | ×0.5 | 소비 활동, 반응 표시 |

**활동에서 제외되는 항목**:
- 단순 조회 (passive)
- 로그인·앱 실행
- 프로필 수정
- 깐부 추가/해제 (관계는 `KANBU_V2` 담당)
- 땡스볼 송금 (돈으로 활동 구매 방지)

**품질 기준** (ANTI_ABUSE와 정합):
- 글은 10자 이상만 카운트 (`LEVEL_V2.md §3.2.1` 기준)
- 댓글도 10자 이상만 카운트
- 10자 미만 스팸은 제외

### 4.2 🔑 결정 D1: Lv별 중위값 보간

v2 §6.3은 **Lv5=30, Lv10=100**만 명시. **Lv1~4, Lv6~9 보간 방식** 3개 대안 비교.

#### 4.2.1 대안 D1-α: 선형 보간

```
Lv1 → Lv5 구간: 0 → 30 (Lv당 +7.5)
Lv5 → Lv10 구간: 30 → 100 (Lv당 +14)
```

| Lv | 중위값 |
|:--:|:------:|
| 1 | 0 |
| 2 | 7.5 → 7 (반올림) |
| 3 | 15 |
| 4 | 22.5 → 22 |
| 5 | 30 |
| 6 | 44 |
| 7 | 58 |
| 8 | 72 |
| 9 | 86 |
| 10 | 100 |

**장점**:
- 단순, 직관적
- 구현·유지보수 용이

**단점**:
- Lv1 = 0 문제: 0으로 나누기 방지 필요
- 선형이라 초반 레벨 달성 쉬움 vs 후반 어려움을 반영 못 함

#### 4.2.2 대안 D1-β: 지수 보간 (**추천**)

```
활동 중위값 = 5 × level^1.3 (대략)

Lv1: 5 × 1 = 5
Lv2: 5 × 2.46 = 12
Lv3: 5 × 4.17 = 21
Lv4: 5 × 6.06 = 30
Lv5: 5 × 8.10 = 40 → 조정해서 30으로 맞춤
```

**실용 테이블** (수동 튜닝):

| Lv | 중위값 | 근거 |
|:--:|:------:|------|
| 1 | 5 | 매우 낮음 (0 방지) |
| 2 | 10 | — |
| 3 | 15 | — |
| 4 | 22 | — |
| 5 | **30** | ✅ v2 고정값 |
| 6 | 45 | — |
| 7 | **60** | 바이럴 시작 |
| 8 | 75 | — |
| 9 | 87 | — |
| 10 | **100** | ✅ v2 고정값 |

**장점**:
- 레벨 후반부로 갈수록 "중위값"도 가속 증가
- Lv10 유저의 기대 활동량이 Lv5보다 훨씬 높은 현실 반영
- 0 방지 (Lv1=5)

**단점**:
- 수동 튜닝 값 → 근거 설명 다소 복잡
- 조정 시 TUNING_SCHEDULE.md 업데이트 필요

#### 4.2.3 대안 D1-γ: 계단형 (3구간)

```
Lv1~3 (초보): 중위값 10
Lv4~7 (중급): 중위값 30
Lv8~10 (상급): 중위값 100
```

**장점**:
- 극단적 단순
- 유저 커뮤니케이션 쉬움 ("나는 중급 구간")

**단점**:
- Lv5 = 30 (v2 고정값)과는 맞지만, Lv10 경계에서 활동성 급감
- "Lv3 → Lv4" 전환 시 갑자기 어려워짐 (UX 불연속)

#### 4.2.4 비교 매트릭스

| 기준 | α 선형 | **β 지수 (추천)** | γ 계단 |
|------|:------:|:-----------------:|:------:|
| 구현 복잡도 | ⭐ | ⭐⭐ | ⭐ |
| v2 고정값 준수 | ✅ | ✅ | ⚠️ 일부 |
| 현실 반영 | ⭐⭐ | ⭐⭐⭐ | ⭐ |
| UX 연속성 | ⭐⭐⭐ | ⭐⭐⭐ | ⭐ |
| Lv1 = 0 문제 | ❌ | ✅ | ✅ |
| 튜닝 여지 | 제한적 | 유연 | 3개만 |

#### 4.2.5 추천 — 대안 D1-β (지수 보간)

**근거**:
1. v2 고정값 (Lv5=30, Lv10=100) 준수
2. 현실 반영 (레벨 후반 활동량 가속)
3. Lv1=5로 0 방지
4. 표 내 수치는 `TUNING_SCHEDULE.md §6`에 따라 조정 가능

**최종 사용자 결정 필요**. 위 3개 중 선택.

### 4.3 🔑 결정 D2: "보낸 좋아요" 집계 방식

**문제**: 현재 `users.likesSent` 필드 **존재 안 함**. 좋아요 CF가 수신자의 `likes`만 증가시킴.

**필요**: Creator Score의 활동성 계산에 "최근 30일 보낸 좋아요"가 입력.

#### 4.3.1 대안 D2-α: 신규 필드 + CF 증분

**방식**:

```typescript
// 좋아요 CF 수정
export const toggleLike = onCall({...}, async (req) => {
  // 기존 로직
  await db.collection('users').doc(authorUid).update({
    likes: FieldValue.increment(1),
  });

  // 🆕 추가
  await db.collection('users').doc(senderUid).update({
    likesSent: FieldValue.increment(1),
    likesSentRecentWindow: FieldValue.arrayUnion({
      ts: FieldValue.serverTimestamp(),
    }),
  });
});
```

**장점**:
- 단순, 즉시 반영
- 기존 CF 소폭 수정

**단점**:
- `likesSentRecentWindow`가 배열로 무한 증가 → 성능 문제
- 30일 경과 항목 제거 필요 (별도 청소 CF)

#### 4.3.2 대안 D2-β: 별도 컬렉션 (활동 로그, **추천**)

**방식**:

```typescript
// 🆕 activity_logs 컬렉션
// id: `${uid}_${type}_${postId}` (중복 방지 키)
interface ActivityLog {
  uid: string;
  type: 'post' | 'comment' | 'likeSent';
  refId?: string;       // 글 ID 등
  createdAt: FirestoreTimestamp;
}

// 좋아요 CF 수정
await db.collection('activity_logs').doc(`${senderUid}_likeSent_${postId}`).set({
  uid: senderUid,
  type: 'likeSent',
  refId: postId,
  createdAt: FieldValue.serverTimestamp(),
});

// 글/댓글 CF에도 동일하게 로그 기록
```

**Creator Score 배치에서**:

```typescript
// 최근 30일 집계
const thirtyDaysAgo = Timestamp.fromMillis(Date.now() - 30 * 24 * 60 * 60 * 1000);
const logs = await db.collection('activity_logs')
  .where('uid', '==', uid)
  .where('createdAt', '>=', thirtyDaysAgo)
  .get();

const counts = logs.docs.reduce((acc, doc) => {
  const type = doc.data().type;
  acc[type] = (acc[type] || 0) + 1;
  return acc;
}, {});

const recent30d = (counts.post || 0) * 3
                + (counts.comment || 0) * 1
                + (counts.likeSent || 0) * 0.5;
```

**TTL 정책** (30일 자동 삭제):
- Firestore TTL 기능 사용 (공식 지원)
- `createdAt` 필드에 TTL 설정 (30일)
- 자동 청소, 별도 CF 불필요

**장점**:
- 확장성 ↑ (다른 활동 추적도 가능)
- TTL 자동 청소
- 쿼리 유연
- 향후 분석·감사 용도

**단점**:
- 컬렉션 신설 비용
- 좋아요 1회 = Firestore write 2회 (users + activity_logs)
- 스토리지: 유저당 평균 100건/월 × 100만 유저 = 1억 document

#### 4.3.3 대안 D2-γ: 세션 기반 카운터 (경량)

**방식**: UserData에 **카운터 5개** 저장

```typescript
interface UserData {
  // 최근 30일 (매일 자정 배치가 갱신)
  recent30d_posts?: number;
  recent30d_comments?: number;
  recent30d_likesSent?: number;

  // 오늘 카운트 (클라이언트 최소, CF 기록)
  today_posts?: number;
  today_comments?: number;
  today_likesSent?: number;

  lastActivityRollup?: FirestoreTimestamp;
}
```

**배치 동작** (매일 04:30):
- `recent30d_posts` -= (30일 전 `today_posts`)
- `recent30d_posts` += (오늘 `today_posts`)
- `today_*` 초기화

**문제**:
- 30일 전 값을 어떻게 알 것인가? → 별도 히스토리 필요
- 결국 activity_logs로 귀결 → D2-β와 수렴

#### 4.3.4 비교 매트릭스

| 기준 | α 배열 | **β 컬렉션 (추천)** | γ 카운터 |
|------|:------:|:-------------------:|:--------:|
| 구현 복잡도 | ⭐ | ⭐⭐ | ⭐⭐⭐ |
| 확장성 | ❌ | ✅ | ⭐⭐ |
| TTL 자동화 | ❌ | ✅ | ❌ |
| 쿼리 유연성 | ❌ | ⭐⭐⭐ | ❌ |
| 쓰기 비용 | 낮음 | 중간 | 높음 |
| 스토리지 | 낮음 | 높음 | 낮음 |
| 다른 활동 추적 | ❌ | ✅ | 제한적 |

#### 4.3.5 추천 — 대안 D2-β (별도 컬렉션)

**근거**:
1. Firestore TTL 기능으로 자동 청소
2. 확장성 (다른 활동 추적에도 활용 가능)
3. 쿼리 유연성 (대시보드·감사 용도)
4. 업계 표준 패턴 (activity stream)

**스토리지 비용**:
- 10만 유저 × 100건/월 × $0.18/GB = 월 $1~2 (수용 가능)

**최종 사용자 결정 필요**.

### 4.4 최근 30일 집계 방식 (선택된 D2 기준)

**D2-β 기준 구현**:

```typescript
// functions/activityTracker.js

exports.logActivity = async (uid, type, refId) => {
  const docId = `${uid}_${type}_${refId || Date.now()}`;
  await db.collection('activity_logs').doc(docId).set({
    uid,
    type,
    refId,
    createdAt: FieldValue.serverTimestamp(),
    // TTL: 30일 후 자동 삭제
    expiresAt: Timestamp.fromMillis(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });
};

// 호출 지점:
// createPost CF:      await logActivity(uid, 'post', postId)
// createComment CF:   await logActivity(uid, 'comment', commentId)
// toggleLike CF:      await logActivity(uid, 'likeSent', postId)
```

**Firestore TTL 설정**:
- Console: Firestore → TTL 정책 → 추가 → `activity_logs.expiresAt`
- 30일 경과 document 자동 삭제

### 4.5 신규 유저·비활성 유저 처리

**신규 유저** (가입 ≤ 7일):
- `activity_logs`에 기록 거의 없음
- 활동성 = 0.0 ~ 0.3 예상
- Creator Score ≈ 0 → 마패 없음 (정상)

**비활성 유저** (30일 이상 무활동):
- `activity_logs` 없음
- 활동성 = 0.0
- Creator Score = 0 (마패 박탈)

**부재 중 배려**:
- Creator Score 0이어도 평판은 서서히 감쇠만 (급락 없음)
- 복귀 시 30일 지나야 활동성 복원

**2주 부재 같은 경우**:
- 활동 절반 감소 → 활동성 약 0.5
- Creator Score 50% 감소 → 마패 강등
- 평판은 그대로 (감쇠 유예 기간 30일)

---

## 5. 신뢰도 상세 설계

### 5.1 기본 공식

```typescript
export const calculateTrustFactor = (user: UserData): number => {
  let trust = 1.0;

  trust -= calculateAbusePenalty(user.abuseFlags);
  trust -= calculateExilePenalty(user.exileHistory);
  trust -= calculateReportPenalty(user.reportsReceived || 0);

  return Math.max(0.3, Math.min(1.0, trust));
};
```

**원칙**:
- 기본값 1.0 (보너스 없음)
- 감산만 있음
- 최소 0.3 (완전 박탈 방지)

### 5.2 어뷰징 감산 (REPUTATION의 abuseFlags 재사용)

**문제 재확인** (§3.5 시나리오 D):
- REPUTATION_V2에서 `circularThanksball` → 평판 `-300` 적용
- 신뢰도에서 또 감산 = 이중 계산 위험

**해결**:

REPUTATION_V2 감점은 **점수 수치** 감소 (예: 3,500 → 3,200)
Creator Score 신뢰도 감산은 **배율** 감소 (예: 1.0 → 0.95)

→ **역할 분리**: 같은 플래그지만 **다른 축**에서 반영.

**구체 설계**:

```typescript
export const calculateAbusePenaltyForTrust = (flags?: AbuseFlags): number => {
  if (!flags) return 0;

  let penalty = 0;

  // REPUTATION_V2와 동일 플래그지만, 신뢰도에서는 배율로 감산
  if (flags.shortPostSpam)      penalty += 0.05;
  if (flags.circularThanksball) penalty += 0.10; // 더 엄격
  if (flags.multiAccount)       penalty += 0.15; // 훨씬 엄격
  if (flags.massFollowUnfollow) penalty += 0.05;

  return penalty;
};
```

**왜 Creator Score에서 더 엄격한가?**
- 평판 감점 (-300)은 고정값 → 평판 10,000인 Prestige에게는 미미
- 신뢰도 감산 (-0.10)은 **배율** → 모든 점수에 동일 영향

**시나리오 D 재검증** (보정 후):

```
평판 3,500 (감점 반영됨)
활동성 1.0
신뢰도: 1.0 - 0.10 (circularThanksball) = 0.90

Creator Score = 3,500 × 1.0 × 0.90 / 1000 = 3.15
→ 금마패 (2.0~3.5 상단) — 이전 3.33보다 낮지만 여전히 금마패

추가 보정 (휴대폰 인증 Phase C 이후):
  multiAccount도 감지됨 → 0.90 - 0.15 = 0.75
  Score = 3,500 × 1.0 × 0.75 = 2.63 → 여전히 금마패
```

**여전히 아쉬움 → ANTI_ABUSE의 거래 차단이 본질**적 해결. Creator Score는 보조.

### 5.3 🔑 결정 D3: 유배 단계별 신뢰도 감산 차등

**배경**: v2 §6.3은 "유배 이력 1회 -0.1"만 명시. **유배 1차/2차/3차 차등** 필요.

**유배 시스템 소스**: `PRICING.md §2.1`
- 1차: `exiled_lv1` (속죄금 10볼, 1,000원)
- 2차: `exiled_lv2` (속죄금 50볼, 5,000원)
- 3차: `exiled_lv3` (속죄금 300볼, 30,000원)
- 사약: `banned` (영구)

**`exileHistory` 데이터 구조** (제안):

```typescript
interface ExileRecord {
  level: 1 | 2 | 3;
  startedAt: FirestoreTimestamp;
  releasedAt: FirestoreTimestamp | null; // null = 현재 유배 중
  reason: string;
  sanctionPaidAt?: FirestoreTimestamp;
}

interface UserData {
  exileHistory?: ExileRecord[];
}
```

#### 5.3.1 대안 D3-α: 균일 감산

```
모든 유배 이력 = -0.1/회
```

**예시**:
- 1차 1회: -0.1
- 1차+2차+3차 각 1회: -0.3
- 같은 단계 3회: -0.3

**장점**:
- v2 명시와 정확히 일치
- 단순
- 계산 쉬움

**단점**:
- 심각도 반영 부재 (3차 = 1차)
- 재범 누적 반영 부재

#### 5.3.2 대안 D3-β: 단계별 선형

```
1차: -0.05
2차: -0.10
3차: -0.20
```

**예시**:
- 1차 1회: -0.05
- 1차+2차+3차: -0.35
- 같은 1차 3회: -0.15

**장점**:
- 심각도 반영
- v2 "평균 -0.1" 유지

**단점**:
- 현재 속죄금 비율(10/50/300볼 = 1:5:30)과 불일치

#### 5.3.3 대안 D3-γ: 단계별 계단 (**추천 — 속죄금 비율 정합**)

속죄금 비율(1 : 5 : 30)을 **그대로 반영**한 계단형. `PRICING.md §2.1` 속죄금(10/50/300볼)과 비율 일치.

```
1차: -0.05   (속죄금 10볼  × 0.005)
2차: -0.25   (속죄금 50볼  × 0.005)
3차: -1.50   (속죄금 300볼 × 0.005)
```

**재범 배수 적용**:
```
같은 단계 2회 이상 → 감산 1.5배
같은 단계 3회 이상 → 감산 2배
```

**예시**:
- 1차 1회: -0.05
- 1차+2차+3차 각 1회: -1.80 → `MIN_TRUST = 0.3` 캡 적용 (trust = 0.3)
- 1차 3회: -0.05 × 2 = -0.10
- 3차 2회: -1.50 × 1.5 = -2.25 → 캡 도달 (trust = 0.3)

**동작 해석**:
- 1차 유배 단독: trust = 0.95 → Score 5% 영향 (관대함)
- 2차 유배 단독: trust = 0.75 → Score 25% 영향 (중간 제재)
- 3차 유배 단독: trust = max(0.3, -0.50) = **0.3 (즉시 캡 도달)** → Score 70% 삭감

**핵심 설계 철학**:
- 3차 유배는 **"마지막 경고"** 단계. 다음은 사약(`banned`).
- 속죄금도 3차에서 30,000원으로 급증 (실질적 최후 기회)
- 감산도 동일한 심각도 비율로 3차에서 **즉시 0.3 캡 도달** → 권한 회복 난이도 최대화
- 회복 경로는 여전히 존재 (MIN_TRUST 0.3 유지) → 평판·활동성 극대화 시 복귀 가능

**장점**:
- `PRICING.md §2.1` 속죄금 구조(**1:5:30**)와 **정확히 정합**
- 심각도에 비례한 명확한 시그널
- 재범 누적 반영
- MIN_TRUST 0.3 캡으로 완전 박탈은 방지 (사약과 역할 분리)

**단점**:
- 3차 유배 1회만으로 trust가 MIN_TRUST 즉시 도달
  → 복구 어려움 (하지만 설계 의도)
- 구현 시 MIN_TRUST 캡 동작 명확히 테스트 필요

#### 5.3.4 비교 매트릭스

| 기준 | α 균일 | β 선형 | **γ 계단 (추천)** |
|------|:------:|:------:|:-----------------:|
| 구현 복잡도 | ⭐ | ⭐⭐ | ⭐⭐⭐ |
| 심각도 반영 | ❌ | ⭐⭐ | ⭐⭐⭐ |
| 재범 반영 | ⭐⭐ | ⭐⭐ | ⭐⭐⭐ |
| 속죄금 구조 정합 | ❌ | ❌ | ✅ |
| v2 명시와 일치 | ✅ | 부분 | 부분 |
| 이해 용이성 | ⭐⭐⭐ | ⭐⭐ | ⭐ |

#### 5.3.5 추천 — 대안 D3-γ (계단 + 재범 배수, 속죄금 정합)

**최종 값** (2026-04-20 확정):

| 유배 단계 | 신뢰도 감산 | 속죄금 (볼) | 속죄금 원화 | 비율 |
|:---------:|:-----------:|:-----------:|:-----------:|:----:|
| 1차 | **-0.05** | 10볼 | 1,000원 | 1× |
| 2차 | **-0.25** | 50볼 | 5,000원 | 5× |
| 3차 | **-1.50** | 300볼 | 30,000원 | 30× |

**비율 정합**:
- 감산 비율: **1 : 5 : 30**
- 속죄금 비율: **1 : 5 : 30** (PRICING.md §2.1)

→ **완전 정합**. 심각도가 동일 비율로 Score에 반영됨.

**근거 (2026-04-20 결정)**:

1. **심각도 시그널 일관성**: 플랫폼이 유저에게 전달하는 "유배 단계별 심각도"는 속죄금으로 이미 확정되어 있음. Creator Score 감산도 동일한 비율을 따라야 **유저 인식의 일관성** 확보.

2. **3차 = 최종 경고 단계**:
   - 3차 유배는 사약(`banned`) 직전의 최후 제재
   - 속죄금 30,000원은 이미 큰 금전 부담 (이걸 지불하고도 복귀하는 유저는 강한 의지)
   - Score 감산도 최대 수준이어야 "3차 유배 = 마지막 기회"라는 시그널 명확

3. **재범 누적 반영**: 같은 단계 재범 시 배수 적용 (2회 ×1.5, 3회 ×2.0). 반복 패턴 추가 제재.

4. **MIN_TRUST 0.3 캡 (완전 박탈 방지)**:
   - 3차 유배 1회로도 trust가 0.3 캡 도달
   - 하지만 0은 아님 → 평판과 활동성이 극대화되면 Score 복구 가능
   - **사약과의 역할 분리**: 완전 영구 박탈은 사약, 3차 유배 = 강한 재기 기회

5. **속죄금 정렬 원칙**: 경제 제재(속죄금)와 사회 제재(Score 감산)를 분리하면 시스템이 복잡해짐. 동일 비율 적용으로 **단일 심각도 척도** 유지.

**대안 비교 참고**:

| 옵션 | 1차 | 2차 | 3차 | 특징 |
|------|:----:|:----:|:----:|------|
| **채택 (정합)** | **0.05** | **0.25** | **1.50** | **속죄금 정확 비례, 3차 즉시 캡** |
| 완만 유지 | 0.05 | 0.15 | 0.30 | 단계적 완만, 3차도 30% 감산만 |
| 중간안 | 0.05 | 0.20 | 0.60 | 1차 관용, 3차 엄격하지만 캡 미도달 |

**시뮬레이션 재확인** (§3.5 시나리오 재검증):

```
유배 1차 1회:        penalty = 0.05
  → trust = 0.95, Score 영향 ≈ -5%  (관대함)

유배 2차 1회 (단독): penalty = 0.25
  → trust = 0.75, Score 영향 ≈ -25% (명확한 제재)

유배 3차 1회 (단독): penalty = 1.50
  → trust = max(0.3, -0.50) = 0.30 (즉시 캡)
  → Score 영향 ≈ -70% (강한 제재)

유배 1+2+3차 각 1회: penalty = 1.80
  → trust = 0.30 (캡)
  → Score 영향 ≈ -70%

같은 1차 3회 (재범): penalty = 0.05 × 2.0 = 0.10
  → trust = 0.90, Score 영향 ≈ -10% (경미)

같은 3차 2회 (재범): penalty = 1.50 × 1.5 = 2.25
  → trust = 0.30 (캡 도달)
  → 하지만 재범 유저는 사약 대상으로 관리자 조치 권장
```

- 1차·2차는 복귀 경로 명확 (trust 0.95, 0.75)
- 3차는 즉시 캡 도달 → "최후 경고" 시그널 명확
- 재범 배수는 1~2차 범위에서 의미 (3차는 이미 캡)

**향후 조정 트리거** (Phase B 후 재검토 항목):
- 3차 유배자의 **복귀율이 너무 낮음** (< 10%) → 감산 완화 검토 (예: 3차 0.80으로)
- 1차 유배자의 **재범률이 너무 높음** → 1차 감산 강화 검토
- false positive 유배 비율 > 15% → 전체 감산 완화 + 유배 기준 재검토

**구현**:

```typescript
/**
 * 유배 감산 계산 (D3-γ, 속죄금 정합, 2026-04-20 확정)
 *
 * 비율: 1 : 5 : 30 (속죄금 비율 그대로)
 * 3차는 MIN_TRUST 캡(0.3)에 즉시 도달하도록 설계됨
 */
export const calculateExilePenalty = (history?: ExileRecord[]): number => {
  if (!history || history.length === 0) return 0;

  // PRICING.md §2.1 속죄금 비율(1:5:30)과 정합
  const levelPenalties: Record<number, number> = {
    1: 0.05,
    2: 0.25,
    3: 1.50,
  };

  // 단계별 카운트
  const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
  history.forEach(record => {
    counts[record.level] = (counts[record.level] || 0) + 1;
  });

  let penalty = 0;
  [1, 2, 3].forEach(level => {
    const count = counts[level];
    if (count === 0) return;

    const base = levelPenalties[level];
    const multiplier = count >= 3 ? 2.0 : count >= 2 ? 1.5 : 1.0;
    penalty += base * multiplier * Math.min(1, count); // 최소 1회 적용
  });

  // 주의: 상한 제한을 여기서 두지 않음
  // MIN_TRUST 0.3 캡은 calculateTrustFactor에서 최종 적용
  // (1.50+ 감산도 그대로 반환 → trust가 음수로 가지만 Math.max(0.3, ..)에서 clamp)
  return penalty;
};
```

**주의**: 이전 버전의 `Math.min(0.7, penalty)` 내부 캡은 제거. 이유:
- MIN_TRUST 0.3 적용이 `calculateTrustFactor`에서 일괄 처리됨
- 함수 내부 캡은 재범 배수 계산과 상호작용 시 혼란 야기
- 단일 캡 지점(`Math.max(0.3, trust)`)으로 일원화


### 5.4 🔑 결정 D4: 신고 누적 감산 방식

> ⚠️ **중요 전제**: **신고 시스템은 현재 글러브에 미개발 상태**다. 본 섹션의 설계는 **Phase C 이후 신고 시스템이 개발될 때 적용할 공식**을 미리 확정하는 것이며, **Phase A/B에서는 `calculateReportPenalty` 항상 0 반환**한다.

#### 5.4.0 신고 시스템 현 상태 (2026-04 기준)

**구현 여부**: ❌ **미개발**

| 항목 | 현재 상태 |
|------|-----------|
| `reports/{reportId}` 컬렉션 | ❌ 없음 |
| 유저 → 유저 신고 UI | ❌ 없음 |
| 유저 → 콘텐츠 신고 UI | ❌ 없음 |
| 신고 검토 큐 | ❌ 없음 |
| `users.reportsReceived` 필드 | ❌ 없음 |
| `users.reportsUniqueReporters` 필드 | ❌ 없음 |
| 자동 감산 로직 | ❌ 없음 |

**현재 대체 수단** (`ADMIN.md §5` 상세):
- **관리자 수동 제재**: 관리자가 악성 콘텐츠·유저를 직접 발견 또는 유저 제보(DM/외부 채널)로 받아 직권 조치
- **유배 발동**: 관리자가 `sendToExile` CF 직접 호출 (현재 운영 방식)
- **평판 감점 플래그**: `abuseFlags` 수동 설정 (`ANTI_ABUSE.md §4`)

**→ Phase A/B에서 Creator Score 공식은 신고 감산을 실질적으로 사용하지 않는다.**

```typescript
// Phase A/B: 신고 시스템 미개발 → 항상 0
export const calculateReportPenalty = (uniqueReporters: number = 0): number => {
  // Phase C 이전에는 reportsUniqueReporters 필드 자체가 없거나 0
  // 아래 공식은 Phase C에서 활성화됨
  if (uniqueReporters >= 20) return 0.15;
  if (uniqueReporters >= 10) return 0.10;
  if (uniqueReporters >= 5)  return 0.05;
  return 0;
};
```

**Phase 별 동작**:

| Phase | 신고 시스템 | `reportsUniqueReporters` | 감산 적용 |
|:-----:|:-----------:|:-------------------------:|:---------:|
| A | 미개발 | 필드 없음 (undefined) | 0 고정 |
| B | 미개발 | 필드 없음 (undefined) | 0 고정 |
| **C** | **개발 예정** | **CF 집계값** | **공식 활성** |

**"Phase C에서 신고 시스템 설계"는 본 Step 1 기획 범위를 벗어난다**. 별도 스프린트에서 다룸.

---

아래 대안 비교는 **Phase C에서 신고 시스템 개발 시 적용할 공식**을 미리 확정하는 논의다.

#### 5.4.1 대안 D4-α: 단일 임계 (5회)

```
0~4회: -0.00
5회 이상: -0.05 (최대)
```

**장점**: 극단적 단순
**단점**: 100회 신고 = 5회 신고 (차별 없음)

#### 5.4.2 대안 D4-β: 선형 누적

```
5회당 -0.05 (최대 -0.3)
```

| 신고 | 감산 |
|:----:|:----:|
| 0 | 0 |
| 1~4 | 0 |
| 5 | -0.05 |
| 10 | -0.10 |
| 15 | -0.15 |
| 20 | -0.20 |
| 25+ | -0.25 (캡) |

**장점**:
- 심각도 연속 반영
- v2 "5회 -0.05" 정확 일치

**단점**:
- 악의적 신고 폭격 방어 부족 (5명이 짜고 5회씩 신고 → 25회 → -0.25)

#### 5.4.3 대안 D4-γ: 계단 + 고유 신고자 (**추천**)

"**고유 신고자 수**" 기반 계단형.

```
고유 신고자 수 (중복 제거):
  0~4:  -0.00
  5~9:  -0.05
  10~19: -0.10
  20+:   -0.15 (캡)
```

**왜 "고유 신고자"인가?**
- 같은 사람의 반복 신고는 의미 없음
- 악의적 다계정 폭격 방어 (ANTI_ABUSE와 연계)
- 진짜 많은 사람이 신고 = 진짜 문제 있음

**구현** (Phase C에서 활성화):

```typescript
// Phase C: reports 컬렉션에서 uniqueReporters 집계
// 일일 배치에서 reportsUniqueReporters 필드 갱신

export const calculateReportPenalty = (uniqueReporters: number): number => {
  if (uniqueReporters >= 20) return 0.15;
  if (uniqueReporters >= 10) return 0.10;
  if (uniqueReporters >= 5)  return 0.05;
  return 0;
};
```

#### 5.4.4 비교 매트릭스

| 기준 | α 단일 임계 | β 선형 | **γ 계단+고유 (추천)** |
|------|:-----------:|:------:|:----------------------:|
| 구현 복잡도 | ⭐ | ⭐⭐ | ⭐⭐⭐ |
| 심각도 반영 | ❌ | ⭐⭐⭐ | ⭐⭐ |
| 신고 폭격 방어 | ❌ | ❌ | ✅ |
| v2 명시 일치 | ✅ | ✅ | 부분 |
| 집계 복잡도 | 낮음 | 낮음 | 높음 (고유 집계) |

#### 5.4.5 추천 — 대안 D4-γ (계단 + 고유 신고자)

**근거**:
1. 악의적 폭격 방어 (글러브 규모 작을 때 중요)
2. 진짜 문제 있는 유저만 감점
3. ANTI_ABUSE와 자연스러운 연계
4. Phase C 시점에는 유저 규모가 커져 있어 다계정 어뷰징 방어가 필수

**구현 추가 비용** (Phase C에서):
- `reports` 컬렉션 신설 (Phase C 별도 스프린트)
- `reporterUid` 기반 `DISTINCT` 집계 로직
- 일일 배치 CF에서 `users/{uid}.reportsUniqueReporters` 필드 갱신
- 쓰기 1건/유저/일 (수용 가능)

**Phase B → C 마이그레이션**:
- Phase B: 모든 유저 `reportsUniqueReporters = 0` (자연스럽게)
- Phase C 전환 시 신고 시스템 배포
- 기존 관리자 수동 제재 이력은 `abuseFlags`에 이미 반영되어 있음 (이중 반영 방지)

#### 5.4.6 Phase A/B 동안의 운영 방침

**신고 시스템 미개발 상태에서 악성 행위 대응**:

1. **유저 제보 경로**:
   - 관리자 DM / 이메일 / 외부 채널 (카카오톡 오픈채팅 등)
   - 운영 채널 공지에 제보 방법 안내

2. **관리자 조치 도구** (`ADMIN.md §5` 상세):
   - 유배 발동 (1차/2차/3차)
   - `abuseFlags` 수동 설정
   - 콘텐츠 삭제/블라인드
   - 닉네임 수동 변경 (신변 위협 등)

3. **감사 가시성**:
   - 모든 수동 조치는 `admin_actions` 컬렉션에 기록
   - 유저에게 조치 사유 통지 (유배 알림 등)

**한계**:
- 플랫폼 규모가 커지면 관리자 수동 처리 불가능
- **베타 종료(Phase B 끝) 시점에 신고 시스템 개발 우선순위 평가** 필요
- Phase B 유저 100명 이하 유지 시 수동 운영 가능

### 5.5 최소값 보호 및 복구

**최소 0.3**:

```typescript
return Math.max(0.3, trust);
```

**의미**:
- Creator Score가 최소 30% 유지
- 예: 평판 5,000 × 활동 1.0 × **0.3** / 1000 = **1.5** (은마패)
- 완전 박탈(`= 0`)이 아닌 강등

**복구 경로**:
- 어뷰징 플래그 해제 → 다음 배치에서 즉시 복원
- 유배 이력은 영구 보존 (단, 시간 지날수록 가중치 축소 여부는 Phase C에서 재검토)
- 신고 감산은 새 신고 5회 단위로 갱신

**관리자 수동 조정**:
- `ADMIN.md` (후속)에서 수동 Creator Score 부여/박탈 UI 설계
- 감사 기록 필수

---

## 6. 저장 방식 결정 (3-옵션 비교)

### 6.1 배경

Creator Score는 매 렌더마다 계산하기 **매우 비싸다**:

- 평판 조회 (캐시 O(1)이지만 함수 내 로직 있음)
- 최근 30일 활동 로그 쿼리 (`activity_logs` from 30 days ago)
- 유배 이력 계산
- 신고 집계

실시간 계산은 **대시보드·리더보드에서 병목 확실**.

### 6.2 세 가지 옵션 (LEVEL_V2 §5, REPUTATION_V2 §5 동일 구조)

#### 6.2.1 옵션 A — 함수만 (실시간)

**구조**: `UserData`에 `creatorScore` 필드 없음. 매번 `calculateCreatorScore(user)` 호출.

**장점**:
- 항상 최신
- 필드 증가 없음

**단점**:
- 렌더당 활동 로그 쿼리 (30일치) → **치명적 비용**
- 리더보드 100명 = 100회 쿼리
- Firestore 읽기 폭증

**결론**: Creator Score에서는 **부적합**.

#### 6.2.2 옵션 B — 캐시 + 함수 폴백 (**추천**)

**구조**:

```typescript
interface UserData {
  creatorScoreCached?: number;
  creatorScoreTier?: MapaeKey; // 마패 티어
  creatorScoreUpdatedAt?: FirestoreTimestamp;

  // 집계 필드 (배치 갱신)
  recent30d_posts?: number;
  recent30d_comments?: number;
  recent30d_likesSent?: number;
  reportsUniqueReporters?: number;
}
```

**갱신 전략**:

```typescript
// functions/creatorScoreCache.js
// 스케줄: 매일 05:00 (평판 배치 04:45 이후)

exports.updateCreatorScoreCache = onSchedule({
  schedule: '0 5 * * *',
  timeZone: 'Asia/Seoul',
  region: 'asia-northeast3',
}, async () => {
  const users = await db.collection('users').get();
  const batch = db.batch();

  for (const doc of users.docs) {
    const data = doc.data();

    // 1. 최근 30일 활동 집계
    const activity = await aggregateRecent30dActivity(data.uid);

    // 2. 고유 신고자 수 집계
    const uniqueReporters = await countUniqueReporters(data.uid);

    // 3. Creator Score 계산
    const newScore = calculateCreatorScore({
      ...data,
      ...activity,
      reportsUniqueReporters: uniqueReporters,
    });

    const newTier = getMapaeTier(newScore);

    batch.update(doc.ref, {
      creatorScoreCached: newScore,
      creatorScoreTier: newTier,
      creatorScoreUpdatedAt: FieldValue.serverTimestamp(),
      recent30d_posts: activity.recent30d_posts,
      recent30d_comments: activity.recent30d_comments,
      recent30d_likesSent: activity.recent30d_likesSent,
      reportsUniqueReporters: uniqueReporters,
    });
  }

  await batch.commit();
});
```

**이벤트 트리거**:
- 유배 상태 변경 시 즉시 재계산
- 어뷰징 플래그 변경 시 즉시 재계산 (이미 REPUTATION_V2 `onAbuseFlagChanged`가 처리, 여기서도 후속 트리거)

**장점**:
- 읽기 O(1)
- LEVEL_V2, REPUTATION_V2와 동일 전략
- Rules로 쓰기 제한 가능

**단점**:
- 최대 24시간 지연
- 배치 비용 (10만 유저 × 일일 = $0.18/월)

#### 6.2.3 옵션 C — 전면 캐시 (함수 폐지)

**구조**: `calculateCreatorScore` 함수 폐지, `creatorScoreCached`만 사용.

**단점**:
- 신규 유저는 배치 전 `creatorScoreCached === undefined` → UI가 "마패 없음"으로 자연스럽게 표시되긴 함
- 하지만 테스트·디버깅 어려움
- 롤백 어려움

### 6.3 비교 매트릭스

| 기준 | 옵션 A (함수만) | **옵션 B (캐시+함수, 추천)** | 옵션 C (전면 캐시) |
|------|:--------------:|:----------------------------:|:------------------:|
| 구현 복잡도 | ⭐ | ⭐⭐ | ⭐⭐⭐ |
| 읽기 성능 | ❌ (매우 느림) | ⭐⭐⭐ | ⭐⭐⭐ |
| 읽기 비용 | 매우 큼 | O(1) | O(1) |
| 지연 | 없음 | 최대 24h | 최대 24h |
| 신규 유저 UX | ✅ | ✅ (폴백) | ⚠️ |
| 롤백 용이 | ⭐⭐⭐ | ⭐⭐ | ⭐ |
| LEVEL/REPUTATION 일관성 | ❌ | ✅ | ⚠️ |

### 6.4 최종 결정 — 옵션 B

**결정**: **옵션 B — 캐시 + 함수 폴백**

**근거**:
1. 활동 로그 쿼리 비용 회피 (필수)
2. LEVEL_V2, REPUTATION_V2와 동일 전략
3. 신규 유저는 폴백으로 보호
4. 운영 검증된 패턴

**Phase별 적용**:
- **Phase A**: 시스템 미도입 (함수도 없음)
- **Phase B**: 옵션 B 전면 도입 (CF 배치 + 캐시)
- **Phase C**: 옵션 B 유지, 배치 최적화 (incremental update)

---
## 7. 데이터 모델

### 7.1 UserData 확장

```typescript
// src/types.ts

interface UserData {
  // === 기존 필드 (생략) ===
  uid: string;
  nickname: string;
  level?: number;
  exp?: number;
  likes?: number;
  totalShares?: number;
  ballReceived?: number;

  // === REPUTATION_V2에서 추가된 필드 (참조) ===
  reputationCached?: number;
  reputationTierCached?: TierKey;
  lastActiveAt?: FirestoreTimestamp;
  abuseFlags?: AbuseFlags;

  // === 🆕 Creator Score 캐시 (Phase B 도입) ===
  creatorScoreCached?: number;      // 최종 Score (소수점 2자리)
  creatorScoreTier?: MapaeKey;       // 마패 티어 (MAPAE 문서 정의)
  creatorScoreUpdatedAt?: FirestoreTimestamp;

  // === 🆕 활동성 집계 캐시 (Phase B 도입) ===
  recent30d_posts?: number;
  recent30d_comments?: number;
  recent30d_likesSent?: number;
  recent30dUpdatedAt?: FirestoreTimestamp;

  // === 🆕 신고 집계 (Phase B 도입) ===
  reportsReceived?: number;              // 누적 (기존)
  reportsUniqueReporters?: number;       // 🆕 고유 신고자 수
  reportsUpdatedAt?: FirestoreTimestamp;

  // === 🆕 유배 이력 (Phase A 이미 부분 있음) ===
  exileHistory?: ExileRecord[];
  sanctionStatus?: 'clean' | 'exiled_lv1' | 'exiled_lv2' | 'exiled_lv3' | 'banned';
}

interface ExileRecord {
  level: 1 | 2 | 3;
  startedAt: FirestoreTimestamp;
  releasedAt: FirestoreTimestamp | null;
  reason: string;
  sanctionPaidAt?: FirestoreTimestamp;
  sanctionAmount?: number; // 볼 단위
}

// MapaeKey는 MAPAE_AND_TITLES_V1.md에서 정의 예정
type MapaeKey = 'none' | 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
```

### 7.2 activity_logs 컬렉션

```typescript
// Firestore: activity_logs/{docId}
// docId = `${uid}_${type}_${refId || timestamp}` (중복 방지)

interface ActivityLog {
  uid: string;
  type: 'post' | 'comment' | 'likeSent';
  refId?: string;           // postId, commentId, 등
  createdAt: FirestoreTimestamp;
  expiresAt: FirestoreTimestamp; // 30일 후 TTL
}
```

**TTL 설정**:
- Firestore Console: TTL 정책 → `activity_logs.expiresAt`
- 30일 경과 시 자동 삭제

**인덱스**:
```
Collection: activity_logs
Fields: uid ASC, createdAt DESC
```

**스토리지 추정**:
- 유저당 평균 100건/월
- 10만 유저 = 1,000만 docs/월
- 평균 100 bytes/doc = 1GB/월
- Firestore 비용: 약 $0.18/월 (저장만)

### 7.3 신규 상수

```typescript
// src/constants/creatorScore.ts

export const LEVEL_MEDIAN_ACTIVITY: Record<number, number> = {
  1:  5,
  2:  10,
  3:  15,
  4:  22,
  5:  30,   // v2 고정
  6:  45,
  7:  60,
  8:  75,
  9:  87,
  10: 100,  // v2 고정
};

export const ACTIVITY_WEIGHTS = {
  post: 3,
  comment: 1,
  likeSent: 0.5,
} as const;

export const TRUST_CONFIG = {
  /**
   * 신뢰도 하한 (캡)
   *
   * 3차 유배자도 완전 박탈되지 않고 복구 경로 유지 (평판·활동성 극대화 시)
   * 완전 영구 박탈은 사약(banned)으로 분리 처리
   */
  MIN_TRUST: 0.3,
  MAX_TRUST: 1.0,

  abuseMultipliers: {
    shortPostSpam: 0.05,
    circularThanksball: 0.10,
    multiAccount: 0.15,       // Phase C 휴대폰 인증 후 활성
    massFollowUnfollow: 0.05,
  },

  /**
   * 유배 단계별 감산 (D3-γ, 2026-04-20 확정)
   *
   * 비율: 1 : 5 : 30  ← PRICING.md §2.1 속죄금 비율과 정확히 정합
   *
   * 속죄금 (참고):
   *   1차: 10볼 (1,000원)
   *   2차: 50볼 (5,000원)
   *   3차: 300볼 (30,000원)
   *
   * 감산 동작:
   *   1차 trust = 0.95 (관대)
   *   2차 trust = 0.75 (중간)
   *   3차 trust = 0.30 (MIN_TRUST 즉시 캡, 강한 제재)
   *
   * 의도: 유배 단계별 심각도를 속죄금과 동일 비율로 Score에 반영
   *       3차는 "최후 경고" 단계로 즉시 최대 감산
   *
   * Phase B 후 조정 검토:
   *   - 3차 유배자 복귀율 < 10% → 완화 (예: 3차 0.80)
   *   - 1차 재범률 과다 → 1차 강화
   *   - false positive > 15% → 전체 완화 + 유배 기준 재검토
   *
   * 상세: §5.3.5
   */
  exilePenalties: {
    1: 0.05,
    2: 0.25,
    3: 1.50,
  },

  exileRepeatMultiplier: {
    2: 1.5, // 같은 단계 2회 시
    3: 2.0, // 같은 단계 3회 이상 시
  },

  /**
   * 신고 누적 감산 (D4-γ, Phase C에서 활성화)
   *
   * Phase A/B: reportsUniqueReporters 필드 없음 → calculateReportPenalty 항상 0
   * Phase C: 신고 시스템 개발 완료 시 활성화
   *
   * 상세: §5.4.0
   */
  reportPenalties: {
    5:  0.05,
    10: 0.10,
    20: 0.15,
  },
} as const;

export const CREATOR_SCORE_CONFIG = {
  SCALING_DIVISOR: 1000,
  DECIMAL_PLACES: 2,
  RECENT_WINDOW_DAYS: 30,
} as const;

// 마패 티어 경계 (MAPAE_AND_TITLES_V1.md에서 상세)
export const MAPAE_THRESHOLDS: Record<Exclude<MapaeKey, 'none'>, { min: number; max: number }> = {
  bronze:   { min: 0.5, max: 1.0 },
  silver:   { min: 1.0, max: 2.0 },
  gold:     { min: 2.0, max: 3.5 },
  platinum: { min: 3.5, max: 5.0 },
  diamond:  { min: 5.0, max: Infinity },
};
```

### 7.4 Firestore Rules

```javascript
// firestore.rules

match /users/{uid} {
  allow read: if true;

  // 🆕 creatorScoreCached 등 CF 전용 필드 클라이언트 쓰기 금지
  // 기존 자기 수정 가능 필드 목록에 포함되지 않음 → 자동 차단

  // 자기 수정 규칙 (예시, 기존 필드만)
  allow update: if request.auth != null
    && request.auth.uid == uid
    && request.resource.data.diff(resource.data).affectedKeys()
        .hasOnly([
          'nickname', 'profileImage', 'bio', 'friendList',
          // creatorScoreCached 등은 여기 없음 → 쓰기 차단됨
        ]);
}

// activity_logs 규칙
match /activity_logs/{docId} {
  allow read: if false;  // 관리자·CF만 읽기
  allow write: if false; // CF만 쓰기
  // CF는 Admin SDK 사용, Rules 우회
}

// reports 규칙 (기존)
match /reports/{reportId} {
  allow create: if request.auth != null
    && request.resource.data.reporterUid == request.auth.uid;
  allow read: if request.auth != null
    && request.auth.uid == resource.data.reporterUid; // 본인 신고만
  allow update: if false; // CF만
  allow delete: if false;
}
```

### 7.5 복합 인덱스

**마패 랭킹**:
```
Collection: users
Fields: creatorScoreTier ASC, creatorScoreCached DESC
```

**추천용**:
```
Collection: users
Fields: creatorScoreCached DESC, lastActiveAt DESC
```

**어뷰저 검토용**:
```
Collection: users
Fields: sanctionStatus ASC, creatorScoreCached ASC
```

---

## 8. 구현 변경 범위

### 8.1 유틸 함수 (src/utils.ts)

**추가**:

```typescript
// 핵심 함수
export const calculateCreatorScore = (user: UserData): number;
export const calculateActivityFactor = (user: UserData): number;
export const calculateTrustFactor = (user: UserData): number;

// 보조 함수
export const calculateRecent30dActivity = (user: UserData): number;
export const getLevelMedianActivity = (level: number): number;
export const calculateAbusePenaltyForTrust = (flags?: AbuseFlags): number;
export const calculateExilePenalty = (history?: ExileRecord[]): number;
export const calculateReportPenalty = (uniqueReporters: number): number;

// 편의 함수
export const useCreatorScore = (user: UserData): number;
export const getMapaeTier = (score: number): MapaeKey;
```

**캐시 우선 폴백**:

```typescript
export const useCreatorScore = (user: UserData): number => {
  // 캐시 우선
  if (user.creatorScoreCached !== undefined) {
    return user.creatorScoreCached;
  }

  // 폴백 (신규 유저, 배치 전)
  // Note: 활동 로그 없이 계산하면 활동성 = 0
  return calculateCreatorScore(user);
};
```

### 8.2 Cloud Functions (신설 3개)

#### 8.2.1 `functions/creatorScoreCache.js` — 일일 배치

```javascript
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');

const REGION = 'asia-northeast3';
const WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

exports.updateCreatorScoreCache = onSchedule({
  schedule: '0 5 * * *',           // 매일 05:00
  timeZone: 'Asia/Seoul',
  region: REGION,
  timeoutSeconds: 540,              // 9분 한도
  memory: '1GiB',
}, async (event) => {
  const db = getFirestore();
  const thirtyDaysAgo = Timestamp.fromMillis(Date.now() - WINDOW_MS);

  const usersSnap = await db.collection('users').get();
  let batch = db.batch();
  let counter = 0;
  let updated = 0;

  for (const userDoc of usersSnap.docs) {
    const uid = userDoc.id;
    const data = userDoc.data();

    // 1. 활동 집계 (30일 윈도우)
    const activityCounts = await aggregateActivity(db, uid, thirtyDaysAgo);

    // 2. 고유 신고자 집계
    const uniqueReporters = await countUniqueReporters(db, uid);

    // 3. Creator Score 계산
    const enrichedUser = {
      ...data,
      recent30d_posts:     activityCounts.post,
      recent30d_comments:  activityCounts.comment,
      recent30d_likesSent: activityCounts.likeSent,
      reportsUniqueReporters: uniqueReporters,
    };

    const newScore = calculateCreatorScoreV2(enrichedUser);
    const newTier = getMapaeTier(newScore);

    // 4. 변화 있을 때만 쓰기
    const changed =
      data.creatorScoreCached !== newScore ||
      data.creatorScoreTier !== newTier;

    if (changed || needsRollup(data)) {
      batch.update(userDoc.ref, {
        creatorScoreCached: newScore,
        creatorScoreTier: newTier,
        creatorScoreUpdatedAt: FieldValue.serverTimestamp(),
        recent30d_posts: activityCounts.post,
        recent30d_comments: activityCounts.comment,
        recent30d_likesSent: activityCounts.likeSent,
        recent30dUpdatedAt: FieldValue.serverTimestamp(),
        reportsUniqueReporters: uniqueReporters,
        reportsUpdatedAt: FieldValue.serverTimestamp(),
      });
      counter++;
      if (changed) updated++;

      if (counter >= 400) {
        await batch.commit();
        batch = db.batch();
        counter = 0;
      }
    }
  }

  if (counter > 0) await batch.commit();

  console.log(`[updateCreatorScoreCache] Processed ${usersSnap.size}, updated ${updated}`);
});

async function aggregateActivity(db, uid, since) {
  const snap = await db.collection('activity_logs')
    .where('uid', '==', uid)
    .where('createdAt', '>=', since)
    .get();

  const counts = { post: 0, comment: 0, likeSent: 0 };
  snap.docs.forEach(doc => {
    const type = doc.data().type;
    if (counts[type] !== undefined) counts[type]++;
  });

  return counts;
}

async function countUniqueReporters(db, uid) {
  const snap = await db.collection('reports')
    .where('targetUid', '==', uid)
    .where('status', '!=', 'dismissed')
    .get();

  const uniqueReporters = new Set();
  snap.docs.forEach(doc => {
    uniqueReporters.add(doc.data().reporterUid);
  });

  return uniqueReporters.size;
}

function needsRollup(data) {
  const lastRollup = data.recent30dUpdatedAt;
  if (!lastRollup) return true;
  const hoursSince = (Date.now() - lastRollup.toMillis()) / (1000 * 60 * 60);
  return hoursSince >= 24;
}
```

**스케줄 순서 확인**:

| 시각 | CF | 의존성 |
|------|----|--------|
| 04:00 | `snapshotBallBalance` | — |
| 04:30 | `auditBallBalance` | balance snapshot |
| 04:45 | `updateReputationCache` | abuseFlags, lastActiveAt |
| **05:00** | **`updateCreatorScoreCache`** | **평판 캐시 의존** |
| 05:30 | (여유) | — |

**중요**: Creator Score는 평판 캐시가 먼저 갱신되어야 정확. 05:00 슬롯이 안전.

#### 8.2.2 `functions/creatorScoreEvents.js` — 이벤트 트리거

```javascript
const { onDocumentUpdated } = require('firebase-functions/v2/firestore');

/**
 * 유배 상태 변경 시 Creator Score 즉시 재계산
 */
exports.onSanctionChanged = onDocumentUpdated({
  document: 'users/{uid}',
  region: 'asia-northeast3',
}, async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();

  const sanctionChanged = before.sanctionStatus !== after.sanctionStatus;
  const exileHistoryChanged =
    JSON.stringify(before.exileHistory || []) !==
    JSON.stringify(after.exileHistory || []);

  if (!sanctionChanged && !exileHistoryChanged) return;

  // Creator Score 재계산 (활동 집계는 기존 캐시 사용)
  const newScore = calculateCreatorScoreFromCache(after);
  const newTier = getMapaeTier(newScore);

  await event.data.after.ref.update({
    creatorScoreCached: newScore,
    creatorScoreTier: newTier,
    creatorScoreUpdatedAt: FieldValue.serverTimestamp(),
  });
});

/**
 * 평판 캐시 변경 시 Creator Score도 재계산
 */
exports.onReputationChanged = onDocumentUpdated({
  document: 'users/{uid}',
  region: 'asia-northeast3',
}, async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();

  if (before.reputationCached === after.reputationCached) return;

  const newScore = calculateCreatorScoreFromCache(after);
  const newTier = getMapaeTier(newScore);

  await event.data.after.ref.update({
    creatorScoreCached: newScore,
    creatorScoreTier: newTier,
    creatorScoreUpdatedAt: FieldValue.serverTimestamp(),
  });
});
```

**주의**: 두 트리거가 같은 문서에 쓰므로 무한 루프 방지 필요:
- `creatorScoreCached`, `creatorScoreTier`, `creatorScoreUpdatedAt`만 변경된 경우 재발동 안 함
- `onReputationChanged`에서 자기 쓰기 루프 감지 필요

```javascript
// 개선: 특정 필드만 변경된 경우 트리거 스킵
if (before.reputationCached === after.reputationCached) return;
if (creatorScoreFieldsOnlyChanged(before, after)) return;
```

#### 8.2.3 `functions/activityLogger.js` — 활동 기록

```javascript
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');

const TTL_DAYS = 30;

/**
 * 활동 로그 기록 헬퍼
 * 글/댓글/좋아요 CF에서 호출
 */
exports.logActivity = async (uid, type, refId) => {
  const db = getFirestore();
  const docId = `${uid}_${type}_${refId || Date.now()}`;

  await db.collection('activity_logs').doc(docId).set({
    uid,
    type,
    refId: refId || null,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: Timestamp.fromMillis(Date.now() + TTL_DAYS * 24 * 60 * 60 * 1000),
  });
};
```

**호출 지점** (기존 CF에 훅 추가):

```javascript
// createPost CF
const { logActivity } = require('./activityLogger');

exports.createPost = onCall({...}, async (req) => {
  // 기존 로직
  const postRef = await db.collection('posts').add({...});

  // 🆕 활동 로그
  await logActivity(req.auth.uid, 'post', postRef.id);

  return { success: true, postId: postRef.id };
});

// createComment CF: await logActivity(uid, 'comment', commentId)
// toggleLike CF:    await logActivity(senderUid, 'likeSent', postId)
```

**주의**: 중복 좋아요(토글 해제) 처리:
- `toggleLike`에서 좋아요를 **해제**할 때는 로그 기록 **안 함**
- 기록된 로그는 그대로 (30일 후 자동 삭제)
- 결과적으로 "누른 좋아요"만 카운트

### 8.3 UI 컴포넌트

**신설**:
- `src/components/MapaeBadge.tsx` — 마패 배지 (MAPAE 문서에서 상세)
- `src/components/CreatorScoreInfo.tsx` — 프로필 내 Score 표시 (본인만)

**변경** (Phase B):
- `PublicProfile.tsx` → `MapaeBadge` 추가
- `PostCard.tsx` → 작성자 마패 배지 (선택적 노출)
- `RecommendationFeed.tsx` → Creator Score 기반 정렬 (기존 좋아요 정렬 대체)

**중요**: Creator Score 숫자 자체는 유저에게 **직접 노출 안 함** (마패 티어로 표시).
- 예외: 본인 프로필에서만 "내 Creator Score: 2.5" 같이 보이기

### 8.4 단계별 배포 순서

#### 단계 1: 인프라 준비 (Phase B 시작)

- [ ] `src/constants/creatorScore.ts` 신설
- [ ] `src/types.ts` 필드 추가 (옵셔널)
- [ ] `src/utils.ts`에 공식 함수 추가
- [ ] `activity_logs` 컬렉션 TTL 정책 설정

#### 단계 2: 활동 로그 수집 시작

- [ ] `functions/activityLogger.js` 배포
- [ ] `createPost`, `createComment`, `toggleLike` CF에 훅 추가
- [ ] 30일 수집 (또는 즉시 진행, 신규 유저만 정확)

#### 단계 3: CF 배치 도입

- [ ] `functions/creatorScoreCache.js` 배포
- [ ] `functions/creatorScoreEvents.js` 배포
- [ ] 스케줄러 05:00 슬롯 등록
- [ ] 첫 배치 모니터링

#### 단계 4: UI 도입

- [ ] `MapaeBadge` 컴포넌트 (MAPAE 문서 의존)
- [ ] 본인 프로필에 Creator Score 표시
- [ ] 추천 알고리즘에 Creator Score 연동

#### 단계 5: 경매·수익 게이트 연동

- [ ] 광고 경매 품질 스코어에 Creator Score 반영
- [ ] 수익 출금 게이트: Creator Score ≥ 1.0 (예시)
- [ ] 라이브 호스트 권한: Creator Score ≥ 0.5

---

## 9. Phase별 로드맵

### 9.1 Phase A (현재 ~ 베타): 미도입

**적용**:
- ❌ Creator Score 시스템 없음
- ❌ activity_logs 컬렉션 없음
- ✅ 기존 레벨·평판 기반 운영 유지

**근거**:
- REPUTATION_V2가 Phase B에서 도입됨 → Creator Score도 Phase B 이후만 가능
- Phase A는 데이터 수집 기간

**Phase A 동안 준비 작업**:
- [ ] 이 설계 문서 확정
- [ ] MAPAE_AND_TITLES_V1 문서 작성 (마패 티어 세부)
- [ ] ADMIN 문서에 관리자 수동 조정 UI 설계

### 9.2 Phase B (베타 종료): 전면 도입

**적용**:
- ✅ `activity_logs` 컬렉션 신설 + TTL 설정
- ✅ 글/댓글/좋아요 CF에 `logActivity` 훅
- ✅ `calculateCreatorScore` 함수군 배포
- ✅ `updateCreatorScoreCache` 배치 (05:00)
- ✅ 이벤트 트리거 (`onSanctionChanged`, `onReputationChanged`)
- ✅ 마패 배지 UI (MAPAE 문서 병행)
- ✅ 추천 알고리즘 Creator Score 가중치 도입

**적용 안 함**:
- ❌ 수익 출금 Creator Score 게이트 (Phase C)
- ❌ 라이브 호스트 자격 (Phase C)

### 9.3 Phase C (정식 출시): 완전 활성화

**추가 적용**:
- ✅ 수익 출금 게이트: Creator Score ≥ 1.0
- ✅ 라이브 호스트 자격: Creator Score ≥ 0.5
- ✅ 광고 경매 품질 스코어 반영
- ✅ 마패 다이아 등급 애니메이션 활성화
- ✅ `multiAccount` 감지 (휴대폰 인증 기반) → 신뢰도 반영

### 9.4 Phase별 공식 변화 요약

**Phase A**: 미도입

**Phase B**: 기본 공식 활성화
```
Score = (reputation × activity × trust) / 1000
```

**Phase C**: Phase B와 동일 공식, 다만:
- `multiAccount` 감지 추가 (신뢰도 -0.15)
- 마패 시각 전면 활성화

---

## 10. 마패·추천·경매 연결 인터페이스

> 이 섹션은 후속 `MAPAE_AND_TITLES_V1.md`와 추천/경매 시스템의 **선공개 명세**.

### 10.1 마패 티어 판정 (MAPAE_AND_TITLES_V1.md 입력)

**공개 API**:

```typescript
// Creator Score로부터 마패 티어 도출
export const getMapaeTier = (score: number): MapaeKey => {
  if (score >= MAPAE_THRESHOLDS.diamond.min)  return 'diamond';
  if (score >= MAPAE_THRESHOLDS.platinum.min) return 'platinum';
  if (score >= MAPAE_THRESHOLDS.gold.min)     return 'gold';
  if (score >= MAPAE_THRESHOLDS.silver.min)   return 'silver';
  if (score >= MAPAE_THRESHOLDS.bronze.min)   return 'bronze';
  return 'none';
};

// MAPAE_AND_TITLES에서 사용
export const useMapae = (user: UserData): MapaeKey => {
  return user.creatorScoreTier ?? getMapaeTier(useCreatorScore(user));
};
```

**경계값** (v2 §6.4):

| 티어 | Creator Score 구간 |
|:----:|:------------------:|
| 🥉 동마패 | 0.5 ~ 1.0 |
| 🥈 은마패 | 1.0 ~ 2.0 |
| 🥇 금마패 | 2.0 ~ 3.5 |
| 💎 백금마패 | 3.5 ~ 5.0 |
| 👑 다이아마패 | 5.0+ |

### 10.2 추천 알고리즘 가중치

**홈 피드 정렬** (Phase B):

```typescript
// 기존 (시간 + 좋아요)
const scoreForFeed = (post: Post, author: UserData) => {
  const timeScore = 1 / (Date.now() - post.createdAt.toMillis());
  const popularityScore = post.likes * 0.1;
  return timeScore + popularityScore;
};

// 개선 (Creator Score 가중치 추가)
const scoreForFeed = (post: Post, author: UserData) => {
  const timeScore = 1 / (Date.now() - post.createdAt.toMillis());
  const popularityScore = post.likes * 0.1;
  const authorScore = useCreatorScore(author) * 0.5; // 작성자 가중치
  return timeScore + popularityScore + authorScore;
};
```

**깐부 추천**:
- Creator Score ≥ 0.5인 유저만 "추천" 섹션 노출
- 그 이하는 "비슷한 관심사"에서만 노출

**주제별 추천**:
- 카테고리 내에서 Creator Score 기준 정렬

### 10.3 광고 경매 품질 스코어

**현재**: `bidAmount` 단독 (품질 평가 없음)

**개선** (Phase C):

```typescript
// ADSMARKET 경매 로직
const auctionScore = (bid: AdBid, author: UserData) => {
  const creatorScore = useCreatorScore(author);
  const qualityMultiplier = 0.5 + creatorScore * 0.1; // 0.5 ~ 1.5 범위
  return bid.bidAmount * qualityMultiplier;
};

// 예시:
// Creator Score 0.0 → 입찰액 × 0.5 (절반 가치)
// Creator Score 1.0 → 입찰액 × 0.6
// Creator Score 2.0 → 입찰액 × 0.7
// Creator Score 5.0 → 입찰액 × 1.0
// Creator Score 10.0 → 입찰액 × 1.5 (1.5배 가치)
```

**효과**:
- 양질 크리에이터가 경매에서 우위
- 어뷰저/봇의 광고 경매 효과 감소

### 10.4 수익·권한 게이트

**Phase C 적용**:

```typescript
// 수익 출금 자격
export const canWithdrawRevenue = (user: UserData): boolean => {
  return useCreatorScore(user) >= 1.0;
};

// 라이브 방송 호스트 자격
export const canHostLiveBroadcast = (user: UserData): boolean => {
  return useCreatorScore(user) >= 0.5;
};

// 잉크병 유료 연재 자격
export const canPublishInkbottle = (user: UserData): boolean => {
  return useCreatorScore(user) >= 1.5;
};

// 주주방 개설 자격
export const canOpenShareholderRoom = (user: UserData): boolean => {
  return useCreatorScore(user) >= 2.0;
};
```

**게이트 실패 시 UX**:
- 기능 버튼 비활성화 + 툴팁 ("Creator Score ≥ 1.0 필요")
- 현재 Score 표시
- "어떻게 올리나요?" 링크 → 헬프 센터

### 10.5 관리자 수동 조정 (ADMIN.md 연계)

**수동 조정 CF**:

```typescript
// functions/adminCreatorScore.js
exports.adminAdjustCreatorScore = onCall({...}, async (req) => {
  // 관리자 권한 확인
  if (!isAdmin(req.auth)) throw new Error('Admin only');

  const { targetUid, action, reason } = req.data;
  // action: 'freeze', 'unfreeze', 'boost', 'demote'

  switch (action) {
    case 'freeze':
      // 임시 정지: creatorScoreCached = 0, creatorScoreFrozen = true
      break;
    case 'unfreeze':
      // 재계산 트리거
      break;
    case 'boost':
      // 수동 부여 (특수 사례: 공식 파트너 등)
      break;
    case 'demote':
      // 수동 강등
      break;
  }

  // 감사 로그
  await db.collection('admin_actions').add({
    adminUid: req.auth.uid,
    targetUid,
    action: 'creator_score_adjust',
    details: { action, reason },
    createdAt: FieldValue.serverTimestamp(),
  });
});
```

**데이터 모델 확장**:

```typescript
interface UserData {
  creatorScoreFrozen?: boolean;    // 관리자 동결
  creatorScoreManualBoost?: number; // 관리자 부여 (+배율)
  creatorScoreAdjustedAt?: FirestoreTimestamp;
  creatorScoreAdjustedBy?: string; // adminUid
}
```

---

## 11. 테스트 시나리오

### 11.1 정상 유저 시나리오

**입력**:
```
평판: 1,500 (우호)
Lv: 5
recent30d_posts: 10
recent30d_comments: 30
recent30d_likesSent: 60
abuseFlags: 없음
exileHistory: []
reports: 0
```

**계산**:
```
활동량 = 10×3 + 30×1 + 60×0.5 = 30 + 30 + 30 = 90
Lv5 중위값 = 30
activity = min(1.0, 90/30) = 1.0

trust = 1.0

Score = (1,500 × 1.0 × 1.0) / 1000 = 1.50
Tier: 은마패
```

✅ 정상 유저: 은마패. 명확.

### 11.2 슈퍼 활동자 (활동량 넘침)

**입력**:
```
평판: 2,000
Lv: 5
recent30d_posts: 50 (광적 활동)
recent30d_comments: 100
recent30d_likesSent: 200
```

**계산**:
```
활동량 = 50×3 + 100×1 + 200×0.5 = 150 + 100 + 100 = 350
Lv5 중위값 = 30
activity = min(1.0, 350/30) = 1.0 (캡)

Score = 2,000 × 1.0 × 1.0 / 1000 = 2.0
Tier: 금마패 경계
```

✅ 활동량 초과는 Score 증가에 기여 안 함 (1.0 캡). 평판 중심.

### 11.3 저활동 복귀 유저

**시나리오**: 1년 잠수 → 복귀 14일차

**입력**:
```
평판: 2,500 (시간 감쇠 적용된 상태)
Lv: 7
recent30d_posts: 3 (복귀 후 조금씩)
recent30d_comments: 8
recent30d_likesSent: 20
```

**계산**:
```
활동량 = 9 + 8 + 10 = 27
Lv7 중위값 = 60
activity = min(1.0, 27/60) = 0.45

Score = 2,500 × 0.45 × 1.0 / 1000 = 1.13
Tier: 은마패
```

✅ 복귀 중이므로 은마패. 활동 늘리면 Score 상승.

### 11.4 맞땡스볼 어뷰저 (보정 후)

**입력**:
```
평판: 3,500 (감점 -300 반영됨)
Lv: 5
recent30d: 활발 (activity 1.0)
abuseFlags: { circularThanksball: true }
```

**계산**:
```
trust = 1.0 - 0.10 (circularThanksball) = 0.90

Score = 3,500 × 1.0 × 0.90 / 1000 = 3.15
Tier: 금마패 (2.0~3.5 상단)
```

⚠️ 여전히 금마패. 본질적 차단은 ANTI_ABUSE의 거래 차단.

### 11.5 유배 이력자 (1차 + 2차)

**입력**:
```
평판: 1,800
Lv: 4
activity: 1.0
abuseFlags: 없음
exileHistory: [
  { level: 1, releasedAt: ... },
  { level: 2, releasedAt: ... }
]
reports: 3 (Phase A/B 미적용)
```

**계산** (D3-γ 속죄금 정합):
```
trust = 1.0 - 0.05 (1차) - 0.25 (2차) = 0.70

Score = 1,800 × 1.0 × 0.70 / 1000 = 1.26
Tier: 은마패 (1.0 ~ 2.0)
```

✅ 이력 있음, 개선 중 → 은마패. 2차 유배자의 복귀 경로 유지.

### 11.6 반복 유배 (같은 단계 3회)

**입력**:
```
평판: 1,200
Lv: 3
activity: 0.8
exileHistory: [1차, 1차, 1차] (같은 단계 3회)
```

**계산**:
```
1차 penalty = 0.05 × 2.0 (3회 이상 배수) = 0.10
trust = 1.0 - 0.10 = 0.90

Score = 1,200 × 0.8 × 0.90 / 1000 = 0.86
Tier: 동마패
```

✅ 같은 1차 반복은 완만한 증가 (속죄금 정합에서도 1차 비율은 동일).

### 11.6.5 3차 유배 단독 (속죄금 정합 결과 확인)

**입력**:
```
평판: 2,500 (이전 활발 유저)
Lv: 7
activity: 0.9 (복귀 후 적극)
abuseFlags: 없음
exileHistory: [{ level: 3, releasedAt: ... }] (3차 유배 1회)
```

**계산** (D3-γ 속죄금 정합):
```
3차 penalty = 1.50
trust = 1.0 - 1.50 = -0.50 → max(0.3, -0.50) = 0.30 (MIN_TRUST 캡 도달)

Score = 2,500 × 0.9 × 0.30 / 1000 = 0.675
Tier: 동마패 (0.5 ~ 1.0)
```

✅ **의도 일치**: 3차 유배자는 복귀해도 평판·활동성이 매우 높아도 **동마패가 최대**. "최후 경고" 시그널 명확. 속죄금 30,000원 부담만큼 Score 회복도 어려움.

**비교**: 평판 5,000 + activity 1.0 + 3차 1회만
- trust = 0.30 (캡)
- Score = 5,000 × 1.0 × 0.30 / 1000 = **1.5** (은마패 하단)
- 아주 활발한 복귀자라도 은마패가 사실상 최대


### 11.7 신고 폭격 방어

**시나리오**: 안티팬 5명이 각각 10회 신고 (총 50회, 고유 5명)

**입력**:
```
평판: 2,000
Lv: 6
activity: 1.0
reportsReceived: 50 (누적)
reportsUniqueReporters: 5 (고유)
```

**계산**:
```
D4-γ (고유 신고자) 적용:
  uniqueReporters = 5 → penalty = 0.05

trust = 1.0 - 0.05 = 0.95

Score = 2,000 × 1.0 × 0.95 / 1000 = 1.90
Tier: 은마패 (2.0 직전)
```

✅ 고유 신고자 기준으로 5명 정도는 감점 최소. 폭격 방어 작동.

### 11.8 진짜 문제 유저

**시나리오**: 실제로 20명이 신고 (고유)

**입력**:
```
평판: 1,500
Lv: 5
activity: 1.0
reportsUniqueReporters: 20
```

**계산**:
```
penalty = 0.15 (20+ 구간)
trust = 1.0 - 0.15 = 0.85

Score = 1,500 × 1.0 × 0.85 / 1000 = 1.28
Tier: 은마패
```

⚠️ 20명 신고인데 은마패 유지는 약함. 실제로는 어뷰징 플래그도 있을 가능성 높음.

```
추가: abuseFlags: { shortPostSpam: true } 있으면
trust = 1.0 - 0.15 - 0.05 = 0.80
Score = 1,500 × 1.0 × 0.80 / 1000 = 1.20 → 은마패 하단
```

### 11.9 Prestige 달성자 (Phase C)

**입력**:
```
평판: 15,000 (전설)
Lv: 10
activity: 1.0
trust: 1.0
```

**계산**:
```
Score = 15,000 × 1.0 × 1.0 / 1000 = 15.0
Tier: 다이아마패 (5.0+)
```

✅ Prestige 달성자는 자동 다이아.

### 11.10 관리자 수동 조정

**시나리오**: 관리자가 특수 크리에이터에게 수동 Score 부여

**입력**:
```
creatorScoreManualBoost: 2.0 (수동 가산)
기본 Score: 1.5
최종: 1.5 + 2.0 = 3.5 (금마패)
```

**구현**:

```typescript
export const calculateCreatorScore = (user: UserData): number => {
  if (user.creatorScoreFrozen) return 0;

  const raw = (reputation * activity * trust) / 1000;
  const boost = user.creatorScoreManualBoost || 0;

  return Math.round((raw + boost) * 100) / 100;
};
```

✅ 수동 조정 가능.

### 11.11 Rules 방어

**테스트**: 타인이 `creatorScoreCached` 수정 시도

```javascript
await updateDoc(doc(db, 'users', victimUid), {
  creatorScoreCached: 999,
});
```

**기대**: 거부 (`permission-denied`).

**검증**: Firestore Rules에 해당 필드 쓰기 허용 규칙 없음. ✅

### 11.12 신규 유저 폴백

**시나리오**: 가입 직후, activity_logs 없음, 캐시 없음

**입력**:
```
creatorScoreCached: undefined
recent30d_*: 모두 0
```

**기대**:
- `useCreatorScore(user)` → `calculateCreatorScore(user)` 폴백
- activity = 0
- Score = 0
- Tier: 'none' (마패 없음)

✅ 자연스러운 신규 유저 처리.

---

## 12. 결정 요약 & 다음 단계

### 12.1 확정된 결정

1. **공식**: `Score = (reputation × activity × trust) / 1000`

2. **활동성**:
   - `(posts×3) + (comments×1) + (likesSent×0.5)` / Lv별 중위값
   - Lv별 중위값은 **D1-β (지수 보간)** 추천 — 최종 사용자 결정 필요
   - 보낸 좋아요 집계는 **D2-β (activity_logs 컬렉션)** 추천 — 최종 사용자 결정 필요

3. **신뢰도**:
   - 어뷰징 배율 감산 (0.05 ~ 0.15)
   - 유배 **D3-γ (계단 + 재범 배수)** 추천 — 최종 사용자 결정 필요
   - 신고 **D4-γ (계단 + 고유 신고자)** 추천 — 최종 사용자 결정 필요
   - 최소 0.3, 최대 1.0

4. **저장 방식**: **옵션 B (캐시 + 함수 폴백)** 확정

5. **배치 스케줄**: **05:00** (평판 04:45 이후)

6. **Phase별**:
   - A: 미도입
   - B: 전면 도입 (인프라 + 마패 UI + 추천 가중치)
   - C: 게이트 적용 (수익 출금, 라이브 호스트 등)

### 12.2 🔑 사용자 최종 결정 필요 항목

| 결정 | 위치 | 추천 | 대안 |
|------|------|------|------|
| **D1** Lv 중위값 보간 | §4.2 | β (지수) | α (선형), γ (계단) |
| **D2** 보낸 좋아요 집계 | §4.3 | β (activity_logs) | α (배열), γ (카운터) |
| **D3** 유배 감산 차등 ✅ *속죄금 정합* | §5.3 | **γ (0.05/0.25/1.50, 1:5:30 비율)** | α (균일), β (선형) |
| **D4** 신고 감산 방식 ⚠️ *Phase C* | §5.4 | γ (계단+고유자) | α (단일), β (선형) |

**✅ D3 결정 확정 (2026-04-20)**:
- 속죄금 비율(PRICING.md §2.1: 10/50/300볼 = 1:5:30)과 정확히 정합
- 1차 -0.05, 2차 -0.25, 3차 -1.50 (재범 시 ×1.5, ×2.0 배수)
- 3차 유배는 MIN_TRUST 0.3 캡에 즉시 도달 → "최후 경고" 시그널
- 사약(banned)과 역할 분리 (완전 박탈 vs 강한 감산 + 복구 여지)

**⚠️ D4 주의사항**:
- 신고 시스템은 **현재 미개발** 상태
- Phase A/B에서는 `calculateReportPenalty` 항상 0 반환 (`reportsUniqueReporters` 필드 없음)
- Phase C 이전까지는 **관리자 수동 제재**로 대응 (`ADMIN.md §5`)
- D4 결정은 Phase C 신고 시스템 개발 시 적용할 공식을 미리 확정하는 것

### 12.3 검증 필요 항목

- [ ] 활동 로그 스토리지 비용 (10만 유저 기준)
- [ ] 배치 CF 실행 시간 (05:00 슬롯 적절성)
- [ ] 마패 경계값 실측 분포 (Phase B 시작 후 조정)
- [ ] 광고 경매 품질 가중치 0.5~1.5 적절성
- [ ] 수동 조정 API 접근 권한 정책

### 12.4 다음 설계서와의 연결

#### 12.4.1 `MAPAE_AND_TITLES_V1.md` (다음 작업)

Creator Score가 공급하는 명세:
- `useMapae(user)` → 마패 티어 (§10.1)
- `creatorScoreTier` 필드 (O(1) 읽기)

마패 문서는 이를 사용하여:
- 5단계 마패 시각 설계
- 획득 알림 ("금마패 달성!")
- 칭호 14개 (별도 시스템, 평판/레벨 직접 참조 가능)

#### 12.4.2 `ADMIN.md` (최종 통합)

- 관리자 Creator Score 수동 조정 UI
- Creator Score 분포 히스토그램
- 마패 티어별 통계
- 감사 로그 뷰

### 12.5 구현 TODO 체크리스트

**Phase B 도입 전 (Step 1 기획 완료 후)**:
- [ ] 이 문서 최종 승인
- [ ] 4개 결정(D1~D4) 사용자 최종 결정
- [ ] `MAPAE_AND_TITLES_V1.md` 작성 (마패 시각 상세)

**Phase B 시작**:
- [ ] `activity_logs` 컬렉션 + TTL 설정
- [ ] `src/constants/creatorScore.ts` 배포
- [ ] `src/utils.ts` 함수군 배포
- [ ] `functions/activityLogger.js` + 3개 CF에 훅
- [ ] `functions/creatorScoreCache.js` 배포
- [ ] `functions/creatorScoreEvents.js` 배포
- [ ] 첫 배치 모니터링 (05:00)
- [ ] `MapaeBadge` 컴포넌트 배포
- [ ] 추천 알고리즘 가중치 도입

**Phase C 시작**:
- [ ] 수익 출금 Creator Score 게이트 (≥ 1.0)
- [ ] 라이브 호스트 자격 (≥ 0.5)
- [ ] 잉크병 연재 자격 (≥ 1.5)
- [ ] 광고 경매 품질 스코어 연동
- [ ] `multiAccount` 감지 (휴대폰 인증 기반)

### 12.6 진행 상태

**Step 1 종합기획 진행률**: 8/10 (80%)

```
✅ GLOVE_SYSTEM_REDESIGN_v2.md
✅ PRICING.md
✅ TUNING_SCHEDULE.md
✅ ANTI_ABUSE.md
✅ KANBU_V2.md
✅ LEVEL_V2.md
✅ REPUTATION_V2.md
✅ CREATOR_SCORE.md  ← 이 문서
⏳ MAPAE_AND_TITLES_V1.md    (다음)
🎯 ADMIN.md                   (최종)
```

---

**문서 끝.**

> **다음**: `MAPAE_AND_TITLES_V1.md` — Creator Score의 §10 마패 API와 v2 §6.5 칭호 시스템을 기반으로 5단계 마패 시각 + 14개 칭호 통합 설계.

