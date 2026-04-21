# 🌟 글러브(GeuLove) 평판 시스템 설계서 (REPUTATION_V2.md)

> **작성일**: 2026-04-20
> **버전**: v1.0 (Step 1 종합기획)
> **상태**: 설계 확정, 구현 대기
> **의존**: GLOVE_SYSTEM_REDESIGN_v2.md §3, §3.5, §6 · LEVEL_V2.md §0.3, §5 · ANTI_ABUSE.md §3.2, §5 · PRICING.md §1 · TUNING_SCHEDULE.md §5.2 · KANBU_V2.md §4
> **후속 의존**: CREATOR_SCORE.md (§10에서 공개 API 정의)

---

## 📋 목차

- §0. 개요 & 원칙
- §1. 현재 상태 진단
- §2. 문제점 분석
- §3. 평판 공식 재설계 (v2-R)
- §4. Tier 시스템 (본 5단계 + Prestige 3단계)
- §5. 평판 저장 방식 결정 (3-옵션 비교)
- §6. 아바타 이중 링 (v2 §3.5 상세화)
- §7. 데이터 모델
- §8. 구현 변경 범위
- §9. 어뷰징 방어 연계 (ANTI_ABUSE와 경계)
- §10. Creator Score 연결 인터페이스
- §11. Phase별 로드맵 (감쇠 도입 시점 대안 비교)
- §12. 테스트 시나리오
- §13. 결정 요약 & 다음 단계

---

## 0. 개요 & 원칙

### 0.1 문서 범위

**REPUTATION_V2는 평판(Reputation) 시스템의 단일 진실 소스**다. 다음 범위를 커버한다:

- **평판 공식**: `getReputationScore()` 재설계 (v2-R)
- **Tier 시스템**: 본 게임 5단계 + Prestige 3단계 (전설/경외/신화)
- **시간 감쇠**: `decayFactor(lastActiveAt)` 설계
- **어뷰징 감점**: `abusePenalty` 설계
- **저장 방식**: 실시간 계산 vs 캐시 (§5에서 3-옵션 비교)
- **아바타 이중 링**: 평판(바깥) × 레벨(안쪽) 시각화
- **Phase별 로드맵**: A(Rules 강화) → B(감쇠 도입) → C(Prestige 발동)

**다음 범위는 다른 문서가 담당**:

| 범위 | 담당 문서 |
|------|-----------|
| 레벨·EXP 공식 | `LEVEL_V2.md` |
| 깐부 관계 집계 | `KANBU_V2.md` |
| 통합 크리에이터 점수 | `CREATOR_SCORE.md` (후속) |
| 마패 5단계 · 칭호 14개 | `MAPAE_AND_TITLES_V1.md` (후속) |
| 어뷰징 탐지 CF | `ANTI_ABUSE.md` (감점 트리거만 §9에서 언급) |
| 화폐·수수료 | `PRICING.md` |
| 경계값 조정 주기 | `TUNING_SCHEDULE.md` §5.2 |

### 0.2 3대 원칙

본 문서의 모든 설계 결정은 다음 3원칙을 따른다.

**① 질(質) 측정 — 양(量)과 분리**

평판은 "받은 반응의 질"을 측정한다. "활동량"은 레벨(`LEVEL_V2`)의 책임이다.

```
레벨  = 내가 한 활동의 양 (글 쓴 만큼, 댓글 단 만큼)
평판  = 내가 받은 반응의 질 (좋아요, 공유, 땡스볼)
```

이 원칙은 **수익 게이트가 레벨에만 달리는 이유**이기도 하다. 평판은 "이 사람의 영향력"을 나타내지만, 영향력이 높다고 봇 필터링을 면제해서는 안 된다 (Lv1 유저가 한 방 터져 평판 확고 달성해도 Lv3 수익 게이트는 유지).

**② 시간성 — "어제의 영웅"에 머무르지 않기**

평판은 **시간 감쇠(time decay)**를 적용한다. 과거 바이럴 유저가 현재 비활성이라면 점수가 서서히 줄어든다. 이유:

- 신규 유저에게 기회 배분
- "현재 활발한 크리에이터"가 우선순위
- 플랫폼 건전성 (죽은 계정이 상단 점유 방지)

감쇠 계수는 최소 0.5로 한다 (완전 소멸 방지). 유튜브의 "최근 90일 구독자 증가량" 로직에서 영감.

**③ 어뷰징 방어 — 공식 내부에 내장**

어뷰징 탐지 결과를 **평판 공식에 직접 반영**한다. 별도 시스템으로 분리하지 않는다. 이유:

- 탐지만 있고 반영이 없으면 의미 없음
- 감점 방식이 계정 차단보다 유연 (false positive 시 복구 가능)
- 평판이 "신뢰 지표" 역할 수행

### 0.3 평판의 역할 (레벨과의 구분)

`LEVEL_V2.md §0.3`에서 레벨의 3대 기능을 정의했다. 평판은 그와 **완전히 다른** 3대 기능을 가진다.

| 기능 | 레벨 | 평판 |
|------|------|------|
| **① 진입 장벽** | ✅ (봇 차단, 수익 게이트) | ❌ (관여하지 않음) |
| **② 활동 측정** | ✅ (양 측정) | ❌ (활동 아님) |
| **③ UX 게임화** | ✅ (프로그레스 바) | ✅ (색/애니메이션) |
| **④ 영향력 표현** | ❌ | ✅ (이 문서의 본질) |
| **⑤ 품질 시그널** | ❌ | ✅ (추천·검색 가중치) |
| **⑥ 신뢰 지표** | ❌ | ✅ (어뷰징 감점 반영) |

**결과**: 평판이 낮아도 레벨은 높을 수 있고, 그 반대도 가능하다. 이는 **의도된 설계**다.

### 0.4 개발 수칙 (CLAUDE.md 준수)

이 문서의 구현은 다음을 반드시 따른다 (`CLAUDE.md`에서 발췌):

- **최소 변경 원칙**: 요청받지 않은 파일 건드리지 않기
- **Rules 우선**: 서버 측 검증 없는 클라이언트 감소 로직 금지
- **CF 경유**: 민감 필드(`reputationCached`, `prestigeTier` 등) 클라이언트 직접 쓰기 금지
- **Phase별 배포**: A → B → C 순서 준수, 건너뛰기 금지
- **롤백 경로 확보**: 모든 변경은 `git revert` 가능 상태로

---

## 1. 현재 상태 진단

### 1.1 두 공식 공존 (🟠 정리 필요)

현재 평판 계산 공식이 **두 개 공존**한다.

#### 1.1.1 공식 1 — 메인 (전체 사용)

**출처**: `src/utils.ts:101-103`

```typescript
export const getReputationScore = (userData: UserData): number => {
  return (userData.likes || 0) * 2
       + (userData.totalShares || 0) * 3
       + (userData.ballReceived || 0) * 5;
};
```

**사용 지점** (실측):
- `PublicProfile.tsx` — 공개 프로필 상단 배지
- `PostCard.tsx` — 작성자 배지
- `getReputationStyle()` — 색상 분기 함수
- `RootPostCard.tsx` — 상세 뷰 작성자 정보
- 기타 8곳 이상

#### 1.1.2 공식 2 — 활동 기반 (ActivityMilestones 전용)

**출처**: `src/utils.ts:135-142`

```typescript
export const calculateReputation = (
  rootCount: number,
  formalCount: number,
  commentCount: number,
  totalLikesReceived: number,
  totalSharesReceived: number
): number => {
  return (rootCount * 5)
       + (formalCount * 2)
       + (commentCount * 1)
       + (totalLikesReceived * 3)
       + (totalSharesReceived * 2);
};
```

**사용 지점**:
- `ActivityMilestones.tsx` 1곳만 (주석: "향후 전체 반영 예정")

**실제 영향도**: ❌ 거의 없음 (상용 UI에 노출 안 됨)

#### 1.1.3 두 공식의 차이

| 항목 | 공식 1 (메인) | 공식 2 (미사용) |
|------|:-------------:|:---------------:|
| 입력 | UserData 필드 기반 | 카운트 인자 |
| likes 가중치 | ×2 | ×3 |
| shares 가중치 | ×3 | ×2 |
| balls 가중치 | ×5 | 없음 |
| rootCount 가중치 | 없음 | ×5 |
| 특성 | "받은 반응" | "한 활동" |

**진단**: 공식 2는 사실상 **레벨/EXP 역할**을 중복한다 (rootCount, commentCount는 활동량). 평판 본질은 "받은 반응"이므로 **공식 1로 단일화**가 옳다.

### 1.2 현재 Tier 테이블

**출처**: `src/utils.ts` `getReputationStyle()` 함수 (실측)

| Tier | 점수 구간 | 색상 | 현재 시각 |
|------|:---------:|------|----------|
| 중립 | < 300 | slate | 무채색 배지 |
| 약간 우호 | 300 – 999 | emerald-50 | 연녹색 |
| 우호 | 1,000 – 1,999 | emerald-500 | 짙은 녹색 |
| 매우 우호 | 2,000 – 2,999 | violet-500 | 보라 |
| 확고 | 3,000 – 9,999 | purple-600 | 진보라 |
| (10,000+) | Phase C 전까지 "확고"로 캡 | 동일 | `§4.3` 참조 |

**Prestige 3단계(전설/경외/신화)는 미구현** (v2 §3에서 설계만).

### 1.3 가중치 실효 분석

```
1회 좋아요 받음 → +2 평판
1회 공유됨     → +3 평판
1볼 땡스볼 받음 → +5 평판
```

**시나리오별 필요 활동량** (평판 "확고" = 3,000점 달성):

| 수단 | 필요량 | 환산 |
|------|:------:|------|
| 좋아요만 | 1,500회 | 매우 많음 |
| 공유만 | 1,000회 | 많음 |
| 땡스볼만 | **600볼** | **60,000원** |
| 혼합 (일반적) | — | 수개월 활동 |

**관찰**: 땡스볼이 가장 빠른 경로. 이는 §2에서 다룰 "돈으로 평판 구매" 문제.

### 1.4 저장 방식 (실시간 계산)

현재는 **저장된 필드 없음**. 렌더 시점마다 함수 호출:

```typescript
// PostCard.tsx 렌더 내부
const reputation = getReputationScore(author);
const style = getReputationStyle(reputation);
```

**장점**: 항상 최신
**단점**: N명 렌더 시 N번 계산, Creator Score(§10)에서 N×M 비용 발생 가능

### 1.5 관련 기능 전수

**평판을 직접 읽는 기능**:
- 프로필 배지 (공개/본인)
- 글 카드 작성자 배지
- 채팅 아바타 (현재 레벨만, §6에서 평판 추가 예정)
- 댓글 작성자 배지
- 깐부방 멤버 리스트

**평판을 간접 읽을 기능** (후속):
- Creator Score (`CREATOR_SCORE.md`, §10)
- 마패 티어 (`MAPAE_AND_TITLES_V1.md`)
- 추천 시스템 가중치
- 광고 경매 품질 스코어

### 1.6 EXP 증감 트리거 연계 (현재)

**평판과 직접 연결된 EXP 트리거 없음**. 평판 필드 증감은 별도 경로:

```
likes:         좋아요 CF (likes +1)
totalShares:   공유 CF (totalShares +1)
ballReceived:  땡스볼 CF (ballReceived +amount)
```

**문제**: 이 중 `likes`와 `totalShares`는 **Rules에서 타인 수정 허용** (다음 §2 Critical 분석).

---

## 2. 문제점 분석

### 2.1 🔴 Critical-1: likes 타인 수정 → 평판 펌핑/공격

**출처**: `firestore.rules:294-298`

```javascript
allow update: if request.auth != null
  && request.auth.uid != id
  && request.resource.data.diff(resource.data).affectedKeys()
      .hasOnly(['likes', 'totalShares', 'promoViewCount']);
```

**문제**: 타인이 `likes` 필드를 **무제한 증감** 가능.

**공격 시나리오 A — 평판 펌핑**:
```javascript
for (let i = 0; i < 1000; i++) {
  await updateDoc(doc(db, 'users', myAccount2), { likes: increment(3) });
}
// 결과: likes +3000, 평판 +6000 (중립 → "확고" 달성)
// 비용: 0원, 시간: 분 단위
```

**공격 시나리오 B — 평판 공격**:
```javascript
await updateDoc(doc(db, 'users', victimUid), { likes: increment(-3000) });
// 결과: 피해자 평판 -6000 (음수 방지 없으면)
```

**현재 방어**:
- ❌ 증감 방향 제약 없음 (증가·감소 모두 가능)
- ❌ 1회 증감 한도 없음
- ❌ CF 경유 아님 (Rules만)

**해결**: ANTI_ABUSE §4.2와 연동하여 Rules 강화 (§3.3.1 단기 대응).

### 2.2 🔴 Critical-2: totalShares 검증 부재

**문제**: `totalShares`도 동일한 Rules 제약 없음. `likes`보다 더 심각 — 공유는 CF를 거치지 않고 클라이언트가 직접 증감.

**공격**:
```javascript
for (let i = 0; i < 1000; i++) {
  await updateDoc(doc(db, 'users', myUid), { totalShares: increment(1) });
}
// 결과: totalShares +1000, 평판 +3000
```

**해결**: 동일하게 §3.3.1에서 Rules 강화.

### 2.3 🟠 Major-1: ballReceived × 5 — 돈으로 평판 구매 (맞땡스볼 담합)

**문제**: 땡스볼 가중치가 높아 "돈으로 평판 구매"가 가능하다. 여기에 **맞땡스볼 담합** 시나리오가 결합되면 실질 비용 없이 평판 세탁 가능.

**공격 시나리오** (`ANTI_ABUSE.md §3.2` 참조):
```
계정 A, B 각각 1,000볼 보유 (10만원씩 충전)

  A → B  100볼 (3초 대기)
  B → A  100볼 (3초 대기)
  반복 10,000회

결과:
  - 각 계정 ballReceived += 100만
  - 각 계정 평판 += 500만 ("확고" 훨씬 초과)
  - 실제 잔액 변동: ±0 (왕복)
```

**현재 방어 공백**:
- 3초 쿨다운 → 분당 20회 가능
- 24시간 = 28,800회 왕복
- 자기 송금만 차단 (A→A), 다계정(A→B) 담합 미차단

**해결**:
- Phase A: `detectCircularThanksball` CF 배치 (`ANTI_ABUSE.md §5.4`)
- 감점 트리거: 의심 감지 시 평판 `-300` (§3.2.3에서 설계)
- Phase C: 휴대폰 인증으로 다계정 원천 차단

### 2.4 🟠 Major-2: 시간 감쇠 없음

**문제**: 2026년에 바이럴 터진 유저가 2030년에도 같은 점수를 보유한다.

**현재 공식**:
```
평판 = (likes × 2) + (shares × 3) + (balls × 5)
```

`likes`, `shares`, `balls`는 **누적값(cumulative)**이며, **감소하지 않는다**. 따라서:

```
시나리오: 2026년 활발 → 2030년 비활성

2026년 평판: 3,500 (확고)
2030년 평판: 3,500 (여전히 확고, 실제로는 4년 무활동)
```

**문제의 본질**:
- 신규 유저가 고점수 획득하기 점점 어려움 (인플레이션)
- 플랫폼 추천 시스템이 "죽은 계정"을 상단 노출
- 2030년 시점의 "진짜 활발한 크리에이터"를 가려냄 어려움

**해결**: 시간 감쇠 도입 (§3.2.2).

### 2.5 🟠 Major-3: 평판-레벨 완전 분리 (의도적, 해결 불필요)

**관찰**: 현재는 평판과 레벨이 **완전히 독립**이다.

- Lv10 + 평판 중립 가능 (활동 많지만 반응 없음)
- 평판 확고 + Lv2 가능 (한 방 터진 신규)

**기존 인식**: 문제로 보임 (일관성 결여)

**결론**: **의도된 설계, 유지**.

근거:
- §0.3 표: 평판과 레벨은 서로 다른 3대 기능
- "양"과 "질"을 따로 측정해야 추천·광고 품질 개선 가능
- `CREATOR_SCORE.md`에서 이 둘을 **곱셈**으로 통합 예정 (§10)

### 2.6 🟠 Major-4: 두 공식 공존 혼란

**문제**: §1.1의 두 공식이 유지되면 `ActivityMilestones`가 "향후 전체 반영"될 때 혼선.

**해결**: `calculateReputation` (공식 2) **폐지**. 메인 공식 1로 단일화 (§3.4).

### 2.7 🟢 Minor-1: 실시간 계산 비용

**문제**: 렌더마다 계산. 아직 유저 수 적어 문제 아님.

**잠재 비용 시나리오** (Phase B 이후):
- Creator Score 도입 → 평판을 입력으로 사용 (§10)
- 리더보드 100명 표시 → 100회 계산
- 추천 알고리즘 → 배치로 수천 번 호출

**해결**: 캐시 필드 도입 (§5에서 3-옵션 비교).

---

## 3. 평판 공식 재설계 (v2-R)

### 3.1 현재 공식 요약

```
현재:  reputation = likes × 2 + totalShares × 3 + ballReceived × 5
```

**특성**:
- 누적값만 반영
- 시간 무관
- 어뷰징 방어 없음
- 가중치 산술 단순

### 3.2 TO-BE 공식 (v2-R)

#### 3.2.1 최종 공식

```
최종 평판 = max(0, 기본 평판 × 시간_감쇠 - 어뷰징_감점)

기본 평판    = likes × 2 + totalShares × 3 + ballReceived × 5
시간_감쇠    = decayFactor(lastActiveAt)
어뷰징_감점  = abusePenalty(uid)
```

**설계 결정**:
- 가중치(×2, ×3, ×5)는 **유지** (현재 균형 수용)
- 시간 감쇠는 **곱셈**으로 적용 (감쇠율이 점수에 비례)
- 어뷰징 감점은 **감산**으로 적용 (고정 페널티)
- `max(0, ...)`로 음수 방지

#### 3.2.2 시간 감쇠 함수 `decayFactor`

**정의**:

```typescript
/**
 * 시간 감쇠 계수
 *
 * lastActiveAt이 최근 30일 이내 → 1.0 (감쇠 없음)
 * 그 이후 → 월 1% 감소
 * 최소 0.5 (완전 소멸 방지)
 */
export const calculateDecayFactor = (
  lastActiveAt: FirestoreTimestamp | null,
  now: FirestoreTimestamp = Timestamp.now()
): number => {
  if (!lastActiveAt) return 1.0; // 최초 가입자 보호

  const daysSinceActive =
    (now.toMillis() - lastActiveAt.toMillis()) / (1000 * 60 * 60 * 24);

  if (daysSinceActive <= 30) return 1.0;

  const monthsInactive = (daysSinceActive - 30) / 30;
  const decay = Math.max(0.5, 1.0 - (monthsInactive * 0.01));

  return decay;
};
```

**`lastActiveAt` 정의**: "의미 있는 활동"의 최근 시각

의미 있는 활동의 정의 (Phase B에서 CF가 갱신):
- 글 작성 (10자+ 유효 글)
- 댓글 작성 (10자+)
- 땡스볼 송금
- 좋아요 누름 (보낸 것)
- 깐부 맺기

**제외**:
- 단순 조회
- 로그인만
- 앱 실행만

**감쇠 시뮬레이션**:

| 마지막 활동 | 경과일 | 감쇠 계수 | 평판 3,000 → |
|-------------|:------:|:---------:|:-------------:|
| 오늘 | 0일 | 1.00 | 3,000 (변화 없음) |
| 2주 전 | 14일 | 1.00 | 3,000 |
| 1개월 전 | 30일 | 1.00 | 3,000 (경계) |
| 2개월 전 | 60일 | 0.99 | 2,970 |
| 6개월 전 | 180일 | 0.95 | 2,850 |
| 1년 전 | 365일 | 0.89 | 2,670 |
| 2년 전 | 730일 | 0.77 | 2,310 |
| 5년 전 | 1,825일 | 0.50 (캡) | 1,500 |
| 10년 전 | 3,650일 | 0.50 (캡) | 1,500 |

**키 포인트**:
- 처음 1개월은 유예 기간 (잠깐 쉰 유저 보호)
- 5년 이상 미활동은 모두 50% 캡 (죽은 계정이 상단 독점 방지, 역사적 기록은 남김)
- 복귀 유저는 **즉시 1.0 복원** (다음 배치 시)

#### 3.2.3 어뷰징 감점 함수 `abusePenalty`

**정의**:

```typescript
/**
 * 어뷰징 감점 (고정값 합산)
 *
 * users/{uid}.abuseFlags에 저장된 플래그 기반
 * CF 'detectAbuse*' 계열이 플래그 설정
 * 감점은 '공식 내부'에서 즉시 반영
 */
export const calculateAbusePenalty = (flags?: AbuseFlags): number => {
  if (!flags) return 0;

  let penalty = 0;

  if (flags.shortPostSpam)      penalty += 500;  // 10자 글 스팸 50%+
  if (flags.circularThanksball) penalty += 300;  // 맞땡스볼 의심
  if (flags.multiAccount)       penalty += 1000; // 다계정 의심 (Phase C 이상)
  if (flags.massFollowUnfollow) penalty += 200;  // 깐부 펌프 (선택)

  return penalty;
};
```

**플래그 소스** (`ANTI_ABUSE.md` 각 시나리오와 연계):

| 플래그 | 설정 CF | 감지 조건 |
|--------|---------|-----------|
| `shortPostSpam` | `detectShortPostSpam` | 최근 50개 글 중 10자 미만 ≥25개 |
| `circularThanksball` | `detectCircularThanksball` | A↔B 왕복 거래 비율 이상 |
| `multiAccount` | `detectMultiAccount` (Phase C) | 휴대폰/결제 정보 중복 |
| `massFollowUnfollow` | `detectKanbuPump` (선택) | 24h 깐부 변경 >50회 |

**플래그 해제**:
- 관리자 판단 시 수동 해제 가능
- 자동 해제 아님 (어뷰저가 "시간 끌기"로 회피 방지)

#### 3.2.4 최종 공식 예시

```typescript
/**
 * v2-R 최종 평판 공식
 */
export const getReputationScoreV2 = (userData: UserData): number => {
  const base =
    (userData.likes || 0) * 2 +
    (userData.totalShares || 0) * 3 +
    (userData.ballReceived || 0) * 5;

  const decay = calculateDecayFactor(userData.lastActiveAt ?? null);
  const penalty = calculateAbusePenalty(userData.abuseFlags);

  return Math.max(0, Math.floor(base * decay - penalty));
};
```

### 3.3 Before/After 시뮬레이션

#### 3.3.1 시나리오 A: 활발한 일반 유저

```
조건:
  - likes: 300
  - totalShares: 100
  - ballReceived: 50
  - lastActiveAt: 오늘
  - abuseFlags: 없음

Before (v1):
  300×2 + 100×3 + 50×5 = 600 + 300 + 250 = 1,150 (우호)

After (v2-R):
  base    = 1,150
  decay   = 1.0
  penalty = 0
  최종    = 1,150 (우호, 변화 없음) ✅
```

**결과**: 일반 활성 유저는 영향 없음. ✅ 의도한 대로.

#### 3.3.2 시나리오 B: 과거 스타, 현재 비활성 (6개월)

```
조건:
  - likes: 1,500
  - totalShares: 300
  - ballReceived: 100
  - lastActiveAt: 180일 전
  - abuseFlags: 없음

Before (v1):
  1,500×2 + 300×3 + 100×5 = 3,000 + 900 + 500 = 4,400 (확고)

After (v2-R):
  base    = 4,400
  decay   = 0.95 (6개월 - 1개월 유예 = 5개월 × 1%)
  penalty = 0
  최종    = 4,400 × 0.95 = 4,180 (확고, 222점 감소)
```

**결과**: 감쇠 적용되지만 "확고" 티어는 유지. 완만한 감쇠 확인. ✅

#### 3.3.3 시나리오 C: 맞땡스볼 담합 의심 계정

```
조건:
  - likes: 100
  - totalShares: 50
  - ballReceived: 1,000 (의심스러움 — 맞땡스볼 루프)
  - lastActiveAt: 오늘
  - abuseFlags: { circularThanksball: true }

Before (v1):
  100×2 + 50×3 + 1000×5 = 200 + 150 + 5,000 = 5,350 (확고 초과)

After (v2-R):
  base    = 5,350
  decay   = 1.0
  penalty = 300 (circularThanksball)
  최종    = 5,350 - 300 = 5,050 (여전히 확고)
```

**결과**: 감점은 적용되지만 티어 변화 없음. **감점이 약함** → `ANTI_ABUSE §3.2`에서 CF 차원의 거래 차단이 필요. 평판 감점은 "경고" 역할. ✅

#### 3.3.4 시나리오 D: 심각한 어뷰저 (다중 플래그)

```
조건:
  - likes: 200 (타인 펌핑 결과)
  - totalShares: 100 (동일)
  - ballReceived: 500
  - lastActiveAt: 오늘
  - abuseFlags: {
      shortPostSpam: true,
      circularThanksball: true,
      multiAccount: true
    }

Before (v1):
  200×2 + 100×3 + 500×5 = 400 + 300 + 2,500 = 3,200 (확고)

After (v2-R):
  base    = 3,200
  decay   = 1.0
  penalty = 500 + 300 + 1,000 = 1,800
  최종    = 3,200 - 1,800 = 1,400 (우호)
```

**결과**: "확고" → "우호"로 강등. 가시적 페널티. ✅

#### 3.3.5 시나리오 E: 10년 전 가입자, 완전 잠수

```
조건:
  - likes: 5,000 (전성기)
  - totalShares: 1,000
  - ballReceived: 500
  - lastActiveAt: 3,650일 전 (10년)

Before (v1):
  5,000×2 + 1,000×3 + 500×5 = 15,500 (Prestige "전설" 구간)

After (v2-R):
  base    = 15,500
  decay   = 0.50 (최소 캡)
  penalty = 0
  최종    = 15,500 × 0.50 = 7,750 (확고)
```

**결과**: "전설" → "확고"로 강등. 10년 간 완전 잠수자는 Prestige 박탈. **공정.** ✅

### 3.4 단일 공식 통합 — `calculateReputation` 폐지

**결정**: `calculateReputation` (공식 2) **폐지**.

**근거**:
- 사용처 1곳 (`ActivityMilestones.tsx`)뿐
- 레벨/EXP와 역할 중복 (`rootCount*5` 등은 활동량)
- v2-R이 단일 공식으로 충분

**마이그레이션**:
```typescript
// AS-IS (삭제)
export const calculateReputation = (...) => { ... };

// TO-BE: ActivityMilestones.tsx에서 getReputationScoreV2 사용
const reputation = getReputationScoreV2(userData);
```

**ActivityMilestones.tsx 내 영향**: UI 숫자 변경 — 사용자에게는 "평판이 더 일관되게 보임"으로 설명 가능.

---
## 4. Tier 시스템 (본 5단계 + Prestige 3단계)

### 4.1 본 게임 5단계 (Phase A/B/C 모두 활성)

| Tier | 점수 구간 | 색상 클래스 | 시각 |
|------|:---------:|:-----------:|------|
| 중립 | < 300 | `slate-400` | 무채색 배지 |
| 약간 우호 | 300 – 999 | `emerald-50` | 연녹색 |
| 우호 | 1,000 – 1,999 | `emerald-500` | 짙은 녹색 |
| 매우 우호 | 2,000 – 2,999 | `violet-500` | 보라 |
| 확고 | 3,000 – 9,999 | `purple-600` | 진보라 + `animate-pulse` |

**경계값 유지 이유**:
- 현재 유저 분포에 이미 맞춤
- `TUNING_SCHEDULE.md §5.2`에 의해 Phase C 이후에만 조정
- 변경 시 기존 유저 충격 큼 → Phase A/B 유지

### 4.2 Prestige 3단계 (Phase C에서만 활성)

| Tier | 점수 구간 | 색상 | 시각 |
|------|:---------:|------|------|
| 🌟 전설 (Legend) | 10,000 – 49,999 | `amber-400` | 금빛 + `animate-spin-slow` 회전 |
| ⚡ 경외 (Awe) | 50,000 – 99,999 | `gradient-rainbow` | 무지개 링 + 빛 발산 |
| 🔮 신화 (Mythic) | 100,000+ | 우주 배경 | 별 파티클 + 은하 배경 |

**로그 스케일** 경계값 선택 이유:
- 10,000 → 50,000 (5배)
- 50,000 → 100,000 (2배)
- 극한의 희소성 추구 (유튜브 다이아몬드 버튼 ≈ 천만 구독)

### 4.3 Phase별 활성화 정책

| Phase | 상태 | 플래그 | 사용자 경험 |
|:-----:|------|--------|-------------|
| **A (현재)** | 🔒 **비활성** | `PRESTIGE_REPUTATION_ENABLED=false` | 10,000+ 달성자 "확고" 시각으로 **캡** |
| **B (베타 종료)** | 📢 **예고** | `=false` 유지 | "정식 출시와 함께 공개 예정" 공지 |
| **C (정식 출시)** | ✅ **발동** | `=true` | 첫 Prestige 달성자 등장, CSS 활성화 |

**Phase A 캡 로직**:

```typescript
export const getReputationTier = (score: number): TierKey => {
  // Phase C 이전에는 'firm'(확고)에서 캡
  const PRESTIGE_ENABLED = process.env.PRESTIGE_REPUTATION_ENABLED === 'true';

  if (score >= 100000 && PRESTIGE_ENABLED) return 'mythic';
  if (score >= 50000 && PRESTIGE_ENABLED)  return 'awe';
  if (score >= 10000 && PRESTIGE_ENABLED)  return 'legend';
  if (score >= 3000)                        return 'firm';
  if (score >= 2000)                        return 'veryFriendly';
  if (score >= 1000)                        return 'friendly';
  if (score >= 300)                         return 'slightlyFriendly';
  return 'neutral';
};
```

**중요**: Phase A/B에서 평판 15,000 달성자라도 **"확고" 시각으로 표시**. 점수는 저장하되 Tier만 캡.

### 4.4 Tier 전환 경계값의 정당화

| 경계 | 점수 | 의미 | 평균 활동 (혼합) |
|------|:----:|------|------------------|
| 중립 → 약간 우호 | 300 | 첫 반응 구간 | 좋아요 100개 or 땡스볼 60볼 |
| 약간 우호 → 우호 | 1,000 | 꾸준한 작성자 | 좋아요 300 + 공유 50 + 땡스볼 50 |
| 우호 → 매우 우호 | 2,000 | 미니 인플루언서 | 좋아요 500 + 공유 100 + 땡스볼 150 |
| 매우 우호 → 확고 | 3,000 | 영향력자 | 좋아요 800 + 공유 200 + 땡스볼 200 |
| 확고 → 전설 | 10,000 | Prestige 진입 | 좋아요 3,000 + 공유 500 + 땡스볼 800 |
| 전설 → 경외 | 50,000 | 플랫폼 톱 | 장기 누적 or 바이럴 연속 |
| 경외 → 신화 | 100,000 | 시대의 아이콘 | 극소수만 도달 |

### 4.5 `grandfatheredPrestigeTier` 보호 필드

**배경**: `TUNING_SCHEDULE.md §5.2`에서 Prestige 경계값 조정 시 기존 달성자 보호 원칙.

**설계**:

```typescript
interface UserData {
  // 현재 Tier (동적 계산)
  // 저장 안 함 (캐시 §5에서 논의)

  // 달성한 최고 Prestige Tier (영구 보존)
  grandfatheredPrestigeTier?: 'legend' | 'awe' | 'mythic';
  grandfatheredAt?: FirestoreTimestamp;
}
```

**활용 로직**:

```typescript
export const getDisplayTier = (userData: UserData): TierKey => {
  const currentTier = getReputationTier(getReputationScoreV2(userData));
  const grandfathered = userData.grandfatheredPrestigeTier;

  // 경계값이 올라가서 현재 점수로는 Prestige 못 도달해도,
  // 과거 달성 이력이 있으면 해당 Tier 유지
  if (grandfathered && getPrestigeLevel(currentTier) < getPrestigeLevel(grandfathered)) {
    return grandfathered;
  }

  return currentTier;
};
```

**기록 시점**: CF `updateReputationCache`가 첫 Prestige 달성 시 기록.

---

## 5. 평판 저장 방식 결정 (3-옵션 비교)

### 5.1 배경

`LEVEL_V2.md §5`에서 레벨 저장 방식을 **옵션 B (캐시 + 함수)**로 결정했다. 평판도 같은 고민이 있다:

**질문**: 평판을 매 렌더마다 `getReputationScoreV2()` 호출할 것인가, 아니면 `UserData.reputationCached` 필드에 저장할 것인가?

**특이점** (레벨과 비교):
- 평판 공식이 v2-R에서 **동적 요소** 포함 (`decay`는 현재 시각에 의존)
- 어뷰징 플래그 변동 시 즉각 반영 필요
- Creator Score가 평판을 입력으로 사용 (§10) → 리더보드 등에서 N명 일괄 조회

### 5.2 세 가지 옵션

#### 5.2.1 옵션 A — 함수만 (현재 유지)

**구조**:
```typescript
// UserData에 평판 필드 없음
// 매 렌더마다 getReputationScoreV2() 호출
```

**장점**:
- 구현 단순 (현재 구조 유지)
- 항상 최신 (`decay` 즉시 반영)
- 롤백 쉬움

**단점**:
- N명 렌더 시 N회 계산
- `lastActiveAt`이 Timestamp이므로 매번 차이 계산
- 리더보드 100명 시 100회 함수 호출 (현재는 성능 문제 없으나 유저 증가 시 대두)
- Creator Score에서 `N × M` 비용 (§10)

**예상 비용**:
- Phase A (1만 유저): 문제 없음
- Phase B (10만 유저): 대시보드 렌더 시 지연 가능
- Phase C (100만+): 병목

#### 5.2.2 옵션 B — 캐시 + 함수 (LEVEL_V2와 동일, **추천**)

**구조**:

```typescript
interface UserData {
  // 캐시 필드 (CF만 쓰기)
  reputationCached?: number;
  reputationTierCached?: TierKey;
  reputationUpdatedAt?: FirestoreTimestamp;

  // Prestige 보호
  grandfatheredPrestigeTier?: 'legend' | 'awe' | 'mythic';
}
```

**갱신 전략**:

```typescript
// Cloud Function: updateReputationCache
// 스케줄: 매일 04:45 (ballSnapshot 04:00 / ballAudit 04:30 다음 슬롯)
// 이벤트: 어뷰징 플래그 변경 시 즉시 갱신

export const updateReputationCache = onSchedule('45 4 * * *', async () => {
  const users = await db.collection('users').get();
  const batch = db.batch();

  for (const doc of users.docs) {
    const data = doc.data() as UserData;
    const newScore = getReputationScoreV2(data);
    const newTier = getReputationTier(newScore);

    // 변화 있을 때만 쓰기
    if (data.reputationCached !== newScore) {
      batch.update(doc.ref, {
        reputationCached: newScore,
        reputationTierCached: newTier,
        reputationUpdatedAt: FieldValue.serverTimestamp(),
      });
    }
  }

  await batch.commit();
});
```

**읽기 전략**:

```typescript
// UI 컴포넌트
export const useReputation = (user: UserData): number => {
  // 캐시 우선
  if (user.reputationCached !== undefined) {
    return user.reputationCached;
  }
  // 폴백 (신규 가입자 등)
  return getReputationScoreV2(user);
};
```

**장점**:
- 읽기는 O(1) (필드 조회만)
- LEVEL_V2와 동일 전략 → 유지보수 일관성
- Creator Score 입력으로 즉시 사용 가능
- Firestore Rules로 쓰기 제한 가능 (CF만 쓰기)

**단점**:
- 최대 24시간 지연 (일일 배치)
- 쓰기 비용 (유저 수 만큼 update/일)
- 초기 구현 공수

**지연 완화**:
- 어뷰징 플래그 설정 시 **이벤트 트리거**로 즉시 재계산
- 관리자 수동 갱신 버튼 (`updateReputationCache` 수동 호출)

**비용 추정** (10만 유저 기준):
- 일일 배치: 10만 reads + 10만 writes
- Firestore 비용 ≈ $0.18/월 (쓰기 위주)
- asia-northeast3 리전 기준

#### 5.2.3 옵션 C — 전면 캐시 (함수 폐지)

**구조**:
```typescript
// UserData.reputationCached만 사용
// getReputationScoreV2 함수는 CF 내부에서만 존재
// 클라이언트는 캐시만 읽음
```

**장점**:
- 최고 성능 (함수 호출 0)
- 가장 단순한 UI 코드

**단점**:
- 신규 유저는 배치 전까지 `reputationCached === undefined`
- 캐시 누락 시 UI가 "0점"으로 표시 (심각한 UX 문제)
- 롤백 어려움 (함수 제거)
- 로컬 테스트 복잡 (에뮬레이터에서 배치 필요)

### 5.3 비교 매트릭스

| 기준 | 옵션 A (함수만) | 옵션 B (캐시+함수) | 옵션 C (전면 캐시) |
|------|:--------------:|:------------------:|:------------------:|
| 구현 복잡도 | ⭐ | ⭐⭐ | ⭐⭐⭐ |
| 읽기 성능 | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| 쓰기 비용 | 0 | 일일 배치 | 일일 배치 |
| 지연 | 없음 | 최대 24h | 최대 24h |
| 신규 유저 UX | ✅ | ✅ (폴백) | ❌ (배치 전 0점) |
| 일관성 | ⭐⭐⭐ | ⭐⭐ | ⭐ |
| LEVEL_V2 일관성 | ❌ | ✅ | ❌ |
| Creator Score 연결 | 비용 큼 | 쉬움 | 쉬움 |
| 롤백 용이성 | ⭐⭐⭐ | ⭐⭐ | ⭐ |

### 5.4 최종 결정 — 옵션 B (추천)

**결정**: **옵션 B — 캐시 + 함수 폴백**

**근거**:

1. **LEVEL_V2 §5.4와 동일 전략** — 시스템 일관성 확보
2. **Creator Score 연결 용이** (§10) — 읽기 O(1)
3. **신규 유저 보호** — 캐시 없으면 함수 폴백
4. **운영 검증된 패턴** — `ballSnapshot`/`ballAudit`가 이미 동일 전략 (04:00 배치)

**구현 원칙**:
- **Phase A**: 현재 유지 (함수만, 옵션 A)
- **Phase B**: 옵션 B 도입 (캐시 + 배치 + 폴백)
- **Phase C**: 옵션 B 유지, 배치 최적화 (incremental update)

**주의사항**:
- `reputationCached` 필드는 **Firestore Rules에서 클라이언트 쓰기 금지**
- CF `updateReputationCache`만 쓰기 가능
- 읽기는 자유 (`allow read` 유지)

---

## 6. 아바타 이중 링 (v2 §3.5 상세화)

### 6.1 설계 원칙

**목표**: 아바타 하나에서 **두 개의 독립 지표**(평판 + 레벨)를 동시에 표현.

**계층 구조**:
```
바깥 링 (ring-4)   → 평판 색 (질, 반응의 크기)
안쪽 링 (border-2) → 레벨 색 (양, 활동의 크기)
중심 (아바타)       → 사용자 이미지/이니셜
```

**원칙**:
- 평판과 레벨은 서로 다른 축 → 색상도 다른 팔레트
- 레벨 색: 차가운 계열 (slate → rose) — 활동량 증가
- 평판 색: 따뜻한 계열 (slate → purple → amber) — 영향력 증가
- 충돌 가능성 회피: 두 색이 같아지지 않도록 팔레트 분리

### 6.2 Tier별 CSS 매트릭스 (Phase A/B/C)

| 평판 Tier | 바깥 링 CSS | Phase |
|-----------|-------------|:-----:|
| 중립 | `ring-slate-200` | A/B/C |
| 약간 우호 | `ring-emerald-200` | A/B/C |
| 우호 | `ring-emerald-400` | A/B/C |
| 매우 우호 | `ring-violet-500` | A/B/C |
| 확고 | `ring-purple-600 animate-pulse` | A/B/C |
| 🌟 전설 | `ring-amber-400 animate-spin-slow` | **C만** |
| ⚡ 경외 | `ring-gradient-rainbow` + 빛 발산 | **C만** |
| 🔮 신화 | 우주 배경 + 별 파티클 | **C만** |

**Phase A/B 캡 동작**:
- 평판 점수 15,000 (이론상 "전설") → `getReputationTier` 내부에서 `'firm'` 반환
- 렌더는 `ring-purple-600 animate-pulse` 사용
- DB에는 점수 그대로 저장 (데이터 손실 없음)

### 6.3 레벨 색상 매트릭스 (변경 없음, 참조용)

| Lv | 안쪽 링 CSS |
|:--:|-------------|
| 1 | `border-slate-400` |
| 2–3 | `border-sky-400` |
| 4–5 | `border-blue-600` |
| 6–7 | `border-indigo-600` |
| 8–9 | `border-purple-600` |
| 10 | `border-rose-500` |

> **출처**: `LEVEL_V2.md §4.3` 레벨별 해금 기능 맵

### 6.4 `ReputationAvatar` 컴포넌트 설계

**목표**: 이중 링 로직을 한 곳에 캡슐화하여 **전체 앱 일괄 적용**.

```tsx
// src/components/ReputationAvatar.tsx

interface ReputationAvatarProps {
  user: Pick<UserData, 'uid' | 'nickname' | 'profileImage' |
                       'level' | 'reputationCached' |
                       'grandfatheredPrestigeTier'>;
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
  onClick?: () => void;
}

export const ReputationAvatar: React.FC<ReputationAvatarProps> = ({
  user,
  size = 'md',
  showTooltip = true,
  onClick,
}) => {
  const reputation = user.reputationCached ?? 0;
  const displayTier = getDisplayTier(user);
  const ringClass = getReputationRingColor(displayTier);
  const borderClass = getLevelBorderColor(user.level ?? 1);

  const sizeMap = { sm: 'w-8 h-8', md: 'w-12 h-12', lg: 'w-20 h-20' };

  return (
    <div
      className={`relative rounded-full ring-4 ${ringClass} ring-offset-2`}
      onClick={onClick}
      title={showTooltip ? `평판: ${getTierLabel(displayTier)} (${reputation}점) · Lv.${user.level}` : undefined}
    >
      <div className={`${sizeMap[size]} rounded-full border-2 ${borderClass} overflow-hidden`}>
        {user.profileImage ? (
          <img src={user.profileImage} alt={user.nickname} />
        ) : (
          <div className="flex items-center justify-center h-full bg-slate-100">
            {user.nickname?.[0] ?? '?'}
          </div>
        )}
      </div>
    </div>
  );
};
```

**유틸 함수** (`src/utils.ts` 추가):

```typescript
export const getReputationRingColor = (tier: TierKey): string => {
  switch (tier) {
    case 'mythic':           return 'ring-indigo-900 bg-cosmos'; // Phase C
    case 'awe':              return 'ring-rainbow animate-glow'; // Phase C
    case 'legend':           return 'ring-amber-400 animate-spin-slow'; // Phase C
    case 'firm':             return 'ring-purple-600 animate-pulse';
    case 'veryFriendly':     return 'ring-violet-500';
    case 'friendly':         return 'ring-emerald-400';
    case 'slightlyFriendly': return 'ring-emerald-200';
    case 'neutral':          return 'ring-slate-200';
    default:                 return 'ring-slate-200';
  }
};

export const getLevelBorderColor = (level: number): string => {
  if (level >= 10) return 'border-rose-500';
  if (level >= 8)  return 'border-purple-600';
  if (level >= 6)  return 'border-indigo-600';
  if (level >= 4)  return 'border-blue-600';
  if (level >= 2)  return 'border-sky-400';
  return 'border-slate-400';
};

export const getTierLabel = (tier: TierKey): string => {
  const labels: Record<TierKey, string> = {
    neutral: '중립',
    slightlyFriendly: '약간 우호',
    friendly: '우호',
    veryFriendly: '매우 우호',
    firm: '확고',
    legend: '전설',
    awe: '경외',
    mythic: '신화',
  };
  return labels[tier];
};
```

### 6.5 접근성

**색상만으로 등급 구분 ❌** → 다음 중 최소 하나 제공:
- **툴팁**: 호버 시 `"평판: 우호 (1,234점) · Lv.5"` 표시
- **텍스트 병기**: 닉네임 옆에 `[우호]` 배지
- **aria-label**: 스크린 리더용

**색맹 사용자 대응**:
- 밝기 대비 충분히 확보
- 애니메이션(펄스/회전)은 평판 높은 Tier에만 → 움직임으로 구분 가능
- 이모지 병기 (확고 이상: 💎/🌟/⚡/🔮)

**Prestige 주의**:
- `prefers-reduced-motion` 존중 (회전/빛 발산 비활성화)
- 색약 유저 배려 → 별 파티클/금속 질감 등 패턴 활용

### 6.6 적용 위치 전수

현재 아바타가 렌더되는 컴포넌트 (`getLevelStyle(level)` 단일 링 사용 중):

**Phase B 도입 대상**:
- [ ] `PostCard.tsx`
- [ ] `RootPostCard.tsx`
- [ ] `PublicProfile.tsx`
- [ ] `ProfileHeader.tsx`
- [ ] `DebateBoard.tsx` (댓글 아바타)
- [ ] `CommunityChatPanel.tsx` (채팅 아바타)
- [ ] `KanbuPromoCard.tsx`
- [ ] `FriendList.tsx`
- [ ] `FollowerList.tsx`
- [ ] `ThanksBallModal.tsx`

**마이그레이션 전략**:
- 신규 `ReputationAvatar` 컴포넌트 배포
- 각 컴포넌트를 1개씩 교체 (PR 단위 작게 유지)
- 전수 교체 완료 후 `getLevelStyle` 단독 사용처 제거

---

## 7. 데이터 모델

### 7.1 UserData 확장

```typescript
// src/types.ts

interface UserData {
  // === 기존 필드 (평판 관련, 변경 없음) ===
  uid: string;
  nickname: string;
  profileImage?: string;
  level?: number;
  exp?: number;
  likes?: number;
  totalShares?: number;
  ballReceived?: number;

  // === 🆕 평판 캐시 (Phase B 도입) ===
  reputationCached?: number;              // 최종 평판 점수 (v2-R)
  reputationTierCached?: TierKey;         // 현재 Tier
  reputationUpdatedAt?: FirestoreTimestamp; // 캐시 갱신 시각

  // === 🆕 활동 추적 (Phase B 도입) ===
  lastActiveAt?: FirestoreTimestamp; // 의미 있는 활동 시각

  // === 🆕 어뷰징 플래그 (Phase B 도입) ===
  abuseFlags?: AbuseFlags;

  // === 🆕 Prestige 보호 (Phase C 도입) ===
  grandfatheredPrestigeTier?: 'legend' | 'awe' | 'mythic';
  grandfatheredAt?: FirestoreTimestamp;
}

interface AbuseFlags {
  shortPostSpam?: boolean;      // 10자 글 스팸 50%+
  circularThanksball?: boolean; // 맞땡스볼 의심
  multiAccount?: boolean;        // 다계정 (Phase C)
  massFollowUnfollow?: boolean;  // 깐부 펌프 (선택)

  // 탐지 이력 (참고용)
  flaggedAt?: FirestoreTimestamp;
  flaggedReason?: string;
}

type TierKey =
  | 'neutral'
  | 'slightlyFriendly'
  | 'friendly'
  | 'veryFriendly'
  | 'firm'
  | 'legend'    // Phase C
  | 'awe'       // Phase C
  | 'mythic';   // Phase C
```

### 7.2 Tier 상수

```typescript
// src/constants/reputation.ts

export const REPUTATION_TIERS: Record<TierKey, {
  min: number;
  max: number;
  label: string;
  ringClass: string;
  isPrestige: boolean;
}> = {
  neutral:          { min: 0,       max: 299,    label: '중립',      ringClass: 'ring-slate-200',    isPrestige: false },
  slightlyFriendly: { min: 300,     max: 999,    label: '약간 우호', ringClass: 'ring-emerald-200',  isPrestige: false },
  friendly:         { min: 1000,    max: 1999,   label: '우호',      ringClass: 'ring-emerald-400',  isPrestige: false },
  veryFriendly:     { min: 2000,    max: 2999,   label: '매우 우호', ringClass: 'ring-violet-500',   isPrestige: false },
  firm:             { min: 3000,    max: 9999,   label: '확고',      ringClass: 'ring-purple-600 animate-pulse', isPrestige: false },
  legend:           { min: 10000,   max: 49999,  label: '전설',      ringClass: 'ring-amber-400 animate-spin-slow', isPrestige: true },
  awe:              { min: 50000,   max: 99999,  label: '경외',      ringClass: 'ring-rainbow animate-glow', isPrestige: true },
  mythic:           { min: 100000,  max: Infinity, label: '신화',    ringClass: 'ring-indigo-900 bg-cosmos', isPrestige: true },
};

export const PRESTIGE_ENABLED = process.env.NEXT_PUBLIC_PRESTIGE_REPUTATION_ENABLED === 'true';

export const DECAY_CONFIG = {
  GRACE_PERIOD_DAYS: 30, // 1개월 유예
  MONTHLY_DECAY_RATE: 0.01, // 월 1%
  MIN_DECAY_FACTOR: 0.5, // 최소 50%
} as const;

export const ABUSE_PENALTIES = {
  shortPostSpam: 500,
  circularThanksball: 300,
  multiAccount: 1000,
  massFollowUnfollow: 200,
} as const;
```

### 7.3 Firestore Rules

```javascript
// firestore.rules

match /users/{uid} {
  // 기존 읽기 규칙 유지
  allow read: if true;

  // 🆕 자기 자신 업데이트 (제한된 필드)
  allow update: if request.auth != null
    && request.auth.uid == uid
    && request.resource.data.diff(resource.data).affectedKeys()
        .hasOnly([
          'nickname', 'profileImage', 'bio', 'friendList',
          // ... 기존 자기 수정 가능 필드
        ]);

  // 🆕 타인 업데이트 (likes/shares만, 증가만, 한도)
  // ANTI_ABUSE §4.2 참조
  allow update: if request.auth != null
    && request.auth.uid != uid
    && request.resource.data.diff(resource.data).affectedKeys()
        .hasOnly(['likes', 'totalShares', 'promoViewCount'])
    // 증가만 허용
    && request.resource.data.likes >= resource.data.likes
    && request.resource.data.totalShares >= resource.data.totalShares
    // 1회 증가 한도
    && request.resource.data.likes - resource.data.likes <= 3
    && request.resource.data.totalShares - resource.data.totalShares <= 1;

  // 🆕 평판 캐시 필드는 CF만 쓰기 (클라이언트 차단)
  // reputationCached, reputationTierCached, reputationUpdatedAt,
  // lastActiveAt, abuseFlags, grandfatheredPrestigeTier, grandfatheredAt
  // → 위 두 allow update 규칙에 affectedKeys 포함 안 됨 → 자동 차단

  // 쓰기 없음 (클라이언트가 다른 유저 전체 필드 수정 불가)
}
```

**검증 테스트** (`firestore.rules.test.ts`):

```typescript
describe('reputation fields security', () => {
  it('blocks client write to reputationCached', async () => {
    const db = getAuthedFirestore(myUid);
    await assertFails(
      updateDoc(doc(db, 'users', victimUid), {
        reputationCached: 99999,
      })
    );
  });

  it('blocks self-write to reputationCached', async () => {
    const db = getAuthedFirestore(myUid);
    await assertFails(
      updateDoc(doc(db, 'users', myUid), {
        reputationCached: 99999,
      })
    );
  });

  it('blocks client write to abuseFlags', async () => {
    const db = getAuthedFirestore(myUid);
    await assertFails(
      updateDoc(doc(db, 'users', myUid), {
        abuseFlags: { shortPostSpam: false },
      })
    );
  });

  it('allows CF write via admin SDK', async () => {
    const adminDb = getAdminFirestore();
    await assertSucceeds(
      adminDb.collection('users').doc(myUid).update({
        reputationCached: 1500,
      })
    );
  });
});
```

### 7.4 복합 인덱스

**대시보드 · 리더보드용**:

```
Collection: users
Fields: reputationTierCached ASC, reputationCached DESC
```

**어뷰징 조사용**:

```
Collection: users
Fields: abuseFlags.circularThanksball ASC, reputationCached DESC
```

**활동성 조사용**:

```
Collection: users
Fields: lastActiveAt DESC, reputationCached DESC
```

---
## 8. 구현 변경 범위

### 8.1 유틸 함수 (src/utils.ts)

**추가**:

```typescript
// 새 공식
export const getReputationScoreV2 = (userData: UserData): number => { ... };

// 보조 함수
export const calculateDecayFactor = (lastActiveAt, now?) => number;
export const calculateAbusePenalty = (flags?: AbuseFlags) => number;
export const getReputationTier = (score: number) => TierKey;
export const getDisplayTier = (userData: UserData) => TierKey;

// UI 헬퍼
export const getReputationRingColor = (tier: TierKey) => string;
export const getLevelBorderColor = (level: number) => string;
export const getTierLabel = (tier: TierKey) => string;
export const useReputation = (user: UserData) => number; // 캐시 우선 훅
```

**변경**:

```typescript
// getReputationScore → deprecated
// @deprecated Use getReputationScoreV2 instead. Removal in Phase C.
export const getReputationScore = (userData: UserData): number => {
  console.warn('getReputationScore is deprecated. Use getReputationScoreV2.');
  return getReputationScoreV2(userData);
};
```

**폐지** (§3.4):

```typescript
// calculateReputation (공식 2) 삭제
// ActivityMilestones.tsx의 유일한 사용처를 getReputationScoreV2로 교체
```

### 8.2 Cloud Functions (functions/)

**신설**:

#### 8.2.1 `functions/reputationCache.js` — 일일 배치

```javascript
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const REPUTATION_REGION = 'asia-northeast3';

exports.updateReputationCache = onSchedule({
  schedule: '45 4 * * *',  // 04:45 (ballSnapshot 04:00, ballAudit 04:30 다음 슬롯)
  timeZone: 'Asia/Seoul',
  region: REPUTATION_REGION,
}, async (event) => {
  const db = getFirestore();
  const usersSnap = await db.collection('users').get();

  let updated = 0;
  const BATCH_SIZE = 400; // Firestore batch 한계 500 미만
  let batch = db.batch();
  let counter = 0;

  for (const doc of usersSnap.docs) {
    const data = doc.data();
    const newScore = calculateReputationV2(data);
    const newTier = getReputationTier(newScore);

    // Grandfathered Prestige 업데이트 (첫 달성 시)
    let grandfatheredUpdate = {};
    if (TIER_ORDER[newTier] >= TIER_ORDER.legend) {
      const currentGrand = data.grandfatheredPrestigeTier;
      if (!currentGrand || TIER_ORDER[newTier] > TIER_ORDER[currentGrand]) {
        grandfatheredUpdate = {
          grandfatheredPrestigeTier: newTier,
          grandfatheredAt: FieldValue.serverTimestamp(),
        };
      }
    }

    if (data.reputationCached !== newScore || data.reputationTierCached !== newTier) {
      batch.update(doc.ref, {
        reputationCached: newScore,
        reputationTierCached: newTier,
        reputationUpdatedAt: FieldValue.serverTimestamp(),
        ...grandfatheredUpdate,
      });
      counter++;
      updated++;

      if (counter >= BATCH_SIZE) {
        await batch.commit();
        batch = db.batch();
        counter = 0;
      }
    }
  }

  if (counter > 0) await batch.commit();

  console.log(`[updateReputationCache] Updated ${updated} users`);
});
```

**스케줄 충돌 확인**:

| 시각 | CF | 비고 |
|------|----|----|
| 04:00 | `snapshotBallBalance` | 기존 (메모리 확인) |
| 04:30 | `auditBallBalance` | 기존 (메모리 확인) |
| **04:45** | **`updateReputationCache`** | 🆕 제안 |
| 05:00 | (여유) | — |

> **주의**: 04:00과 04:30이 이미 점유되어 있으므로 **04:45**로 배치 제안. 혹은 04:15로 변경 가능 (ballSnapshot과 ballAudit 사이).

**검증된 가정**:
- `ballSnapshot` → `ballAudit` 순서 보장 필요 (재고 검증)
- `updateReputationCache`는 위 두 CF와 **독립** → 순서 무관
- 하지만 안전하게 분리된 시간 슬롯 배치 권장

#### 8.2.2 `functions/reputationEvents.js` — 이벤트 트리거

```javascript
const { onDocumentUpdated } = require('firebase-functions/v2/firestore');

/**
 * 어뷰징 플래그 변경 시 해당 유저 평판 즉시 재계산
 */
exports.onAbuseFlagChanged = onDocumentUpdated({
  document: 'users/{uid}',
  region: REPUTATION_REGION,
}, async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();

  const flagsBefore = JSON.stringify(before.abuseFlags || {});
  const flagsAfter = JSON.stringify(after.abuseFlags || {});

  if (flagsBefore === flagsAfter) return; // 플래그 변동 없음

  const newScore = calculateReputationV2(after);
  const newTier = getReputationTier(newScore);

  await event.data.after.ref.update({
    reputationCached: newScore,
    reputationTierCached: newTier,
    reputationUpdatedAt: FieldValue.serverTimestamp(),
  });

  console.log(`[onAbuseFlagChanged] ${event.params.uid}: ${before.reputationCached} → ${newScore}`);
});
```

#### 8.2.3 `functions/activityTracker.js` — lastActiveAt 갱신

```javascript
/**
 * 의미 있는 활동 발생 시 lastActiveAt 갱신
 * 글/댓글 CF, 땡스볼 CF, 좋아요 CF, 깐부 CF에서 호출
 */
exports.touchLastActive = async (uid) => {
  const db = getFirestore();
  await db.collection('users').doc(uid).update({
    lastActiveAt: FieldValue.serverTimestamp(),
  });
};
```

**호출 지점**:
- `createPost` CF: `await touchLastActive(authorUid)`
- `createComment` CF
- `sendThanksball` CF (송금자만)
- `toggleLike` CF (좋아요 누른 사람만)
- `toggleFriend` CF (깐부 맺은 사람만)

**제외**:
- 조회, 세션 시작, 페이지 이동

### 8.3 UI 컴포넌트

**신설**:
- `src/components/ReputationAvatar.tsx` — 이중 링 아바타
- `src/components/ReputationBadge.tsx` — 텍스트 배지 (닉네임 옆)
- `src/components/TierIcon.tsx` — Prestige 이모지 (Phase C)

**변경** (Phase B, 일괄 교체):
- `PostCard.tsx` → 기존 `getLevelStyle` 제거, `<ReputationAvatar />` 사용
- `RootPostCard.tsx` → 동일
- `PublicProfile.tsx` → 동일
- `ProfileHeader.tsx` → 동일
- `DebateBoard.tsx` → 동일
- `CommunityChatPanel.tsx` → 동일
- `KanbuPromoCard.tsx` → 동일

**폐지** (Phase B 전수 교체 후):
- 개별 컴포넌트의 `getLevelStyle` 직접 호출 제거

### 8.4 단계별 배포 순서

#### 단계 1: Rules 강화 (Phase A 즉시 조치)

- [ ] `firestore.rules` 업데이트 (§7.3)
  - `likes`, `totalShares` 증가만 허용 + 1회 한도
  - `reputationCached` 등 CF 전용 필드 클라이언트 차단
- [ ] 에뮬레이터 테스트
- [ ] 배포

**영향 범위**: Rules만 변경 → 기존 기능 영향 없음

#### 단계 2: `getReputationScoreV2` 함수 배포 (Phase A~B 과도기)

- [ ] `src/utils.ts`에 v2 함수 추가 (기존 함수는 wrapper로 유지)
- [ ] `src/constants/reputation.ts` 신설
- [ ] `src/types.ts`에 필드 추가 (옵셔널, 배포 후 점진 migrate)
- [ ] **구 `calculateReputation` 제거 + `ActivityMilestones.tsx` 교체**
- [ ] 배포

**영향 범위**: 클라이언트 함수만, 캐시 없이도 동작 (폴백)

#### 단계 3: CF 배치 도입 (Phase B 시작)

- [ ] `functions/reputationCache.js` 배포
- [ ] `functions/reputationEvents.js` 배포
- [ ] `functions/activityTracker.js` 배포 + 글/댓글/땡스볼 CF에 훅
- [ ] 스케줄러 04:45 슬롯 등록 확인
- [ ] 첫 배치 모니터링 (로그, 비용, 소요 시간)

**영향 범위**: CF 신설, 클라이언트 영향 최소

#### 단계 4: UI 이중 링 도입 (Phase B)

- [ ] `ReputationAvatar` 컴포넌트 신설
- [ ] 1개 화면부터 교체 (예: `PublicProfile.tsx`)
- [ ] A/B 테스트 또는 내부 베타
- [ ] 나머지 10개 화면 순차 교체
- [ ] `getLevelStyle` 직접 호출 제거

**영향 범위**: UI 전면 교체, 시각 대폭 변화

#### 단계 5: Prestige 활성화 (Phase C)

- [ ] `NEXT_PUBLIC_PRESTIGE_REPUTATION_ENABLED=true` 설정
- [ ] Prestige CSS 패키지 도입 (rainbow ring, cosmos bg, star particle)
- [ ] 첫 달성자 공지 준비
- [ ] `grandfatheredPrestigeTier` 누적 집계

**영향 범위**: 환경 변수 + CSS — 코드 변경 최소

---

## 9. 어뷰징 방어 연계 (ANTI_ABUSE와 경계)

### 9.1 책임 분담 매트릭스

| 영역 | REPUTATION_V2 담당 | ANTI_ABUSE 담당 |
|------|:------------------:|:----------------:|
| 감점 공식 정의 | ✅ (§3.2.3) | — |
| 감점 적용 (평판 공식) | ✅ (§3.2.4) | — |
| 탐지 로직 (CF) | — | ✅ |
| 플래그 설정 (CF → Firestore) | — | ✅ |
| 플래그 읽기 (공식 내부) | ✅ | — |
| Rules 강화 | 참조만 (§7.3) | ✅ 주도 |
| Tier 캡 (Phase A/B Prestige) | ✅ | — |
| 휴대폰 인증 도입 | — | ✅ (Phase C) |

### 9.2 감점 트리거 흐름

```
[어뷰저 행위 발생]
      ↓
[ANTI_ABUSE CF 탐지] (예: detectCircularThanksball)
      ↓
[users/{uid}.abuseFlags 업데이트]
      ↓
[reputationEvents.js 트리거 발동]
      ↓
[reputationCached 즉시 재계산]
      ↓
[다음 렌더에서 감소된 평판 반영]
```

### 9.3 감점과 차단의 경계

**평판 감점**만으로 대응 가능한 경우:
- 플래그 false positive 가능성이 있음
- 행위 반복이 서비스 건전성 훼손 정도가 제한적
- 복구 가능 (관리자가 플래그 해제)

**평판 감점 + 기능 차단** 병행이 필요한 경우:
- `circularThanksball`: 거래 자체도 차단해야 (단순 감점으로는 수익 방어 불가)
- `multiAccount`: 유배 또는 계정 정지 병행

**참조**: `ANTI_ABUSE.md §5` 각 시나리오별 대응

### 9.4 false positive 복구 경로

```
[탐지] → [플래그 설정] → [평판 감소]
                             ↓
       [사용자 이의 제기]
                             ↓
       [관리자 검토]
                             ↓
       [플래그 해제] → [reputationEvents 재계산] → [평판 복구]
```

**복구 시 주의**:
- `abuseFlags.flaggedAt` 기록 유지 (재탐지 시 참고)
- 1회 오탐 허용, 재범 시 더 엄격한 기준 적용
- 관리자 로그 `adminActions/` 컬렉션에 기록

---

## 10. Creator Score 연결 인터페이스

> **주의**: 이 섹션은 `CREATOR_SCORE.md` (후속 문서)의 **선공개 명세**다. Creator Score 작성 시 이 섹션이 **단일 진실 소스**.

### 10.1 공개 API

`REPUTATION_V2`가 제공하는 공개 인터페이스:

```typescript
// 평판 점수 (캐시 우선)
export const useReputation = (user: UserData): number;

// 평판 Tier (캐시 우선)
export const useReputationTier = (user: UserData): TierKey;

// Prestige 표시용 (grandfathered 고려)
export const getDisplayTier = (user: UserData): TierKey;

// 원시 함수 (CF용)
export const getReputationScoreV2 = (userData: UserData): number;

// 상수
export { REPUTATION_TIERS, DECAY_CONFIG, ABUSE_PENALTIES } from './constants/reputation';
```

### 10.2 Creator Score 입력으로서의 평판

`GLOVE_SYSTEM_REDESIGN_v2.md §6.3` 공식:

```
Creator Score = (평판 × 활동성 × 신뢰도) / 1000
```

**평판 값 공급**:

```typescript
// CREATOR_SCORE.md에서 사용 예정
export const calculateCreatorScore = (user: UserData): number => {
  const reputation = useReputation(user);     // ← REPUTATION_V2 제공
  const activity   = calculateActivity(user);  // CREATOR_SCORE 담당
  const trust      = calculateTrust(user);     // CREATOR_SCORE 담당

  return (reputation * activity * trust) / 1000;
};
```

### 10.3 평판 vs Creator Score 역할 분담

| 용도 | 평판 | Creator Score |
|------|:----:|:-------------:|
| 아바타 시각 | ✅ | ❌ |
| 배지 표시 | ✅ | ❌ |
| 마패 티어 판정 | ❌ | ✅ |
| 추천 가중치 | 보조 | 주 |
| 광고 경매 품질 | 보조 | 주 |
| 검색 랭킹 | ✅ | 보조 |
| 칭호 조건 | ✅ (일부) | ❌ |

**원칙**:
- **평판**은 "받은 반응의 질" (단일 지표, 쉽게 설명 가능)
- **Creator Score**는 "크리에이터로서의 종합 가치" (복합 지표, 내부 알고리즘용)
- 유저에게 **보이는 숫자는 평판**, 내부 랭킹은 **Creator Score**

### 10.4 Creator Score 미도입 시 Fallback

Phase B 이전에는 Creator Score가 없다. 그 기간 동안:
- 추천/광고 품질: 평판 단독 사용
- 마패: 이 시점에서는 존재하지 않음 (Phase C 도입)

**Phase A → B 전환 시 시스템 영향**:
- 추천 알고리즘의 "평판 70% + 활동량 30%" 조합 → "Creator Score 100%"로 변경
- 광고 경매 품질 점수 재정의

---

## 11. Phase별 로드맵 (감쇠 도입 시점 대안 비교)

### 11.1 세 가지 대안

감쇠 도입 시점에 대해 세 가지 접근이 가능하다.

#### 11.1.1 대안 α: Phase A에서 즉시 도입

**방식**: 지금 당장 감쇠 공식 적용.

**장점**:
- 조기 문제 해결 (미활동 계정이 점수 누적 방지)
- 어뷰저가 빠르게 퇴장

**단점**:
- `lastActiveAt` 필드 부재 → 마이그레이션 필요 (현재 모든 유저 `null`)
- 데이터 부족 → 감쇠 계수 튜닝 근거 없음
- Phase A는 "데이터 수집 기간" 원칙 (§0.2)과 충돌
- 베타 유저가 "지표가 왜 줄었지?" 불만 제기 가능

**비용**:
- 마이그레이션 CF 1회성 (모든 유저 `lastActiveAt = createdAt`로 초기화)
- 초기 감쇠 적용 → 일부 사용자 점수 갑작스런 변동

#### 11.1.2 대안 β: Phase B에서 도입 (**v2 계획 준수, 추천**)

**방식**: 베타 종료 시점에 감쇠 공식 도입.

**장점**:
- v2 §3.3.2 원안 그대로 준수
- Phase A에서 수집된 활동 데이터로 감쇠 계수 검증
- 캐시 도입(§5)과 동시 → 구현 공수 절약
- 베타 유저 → 정식 유저 전환 시점에 자연스러운 리셋

**단점**:
- Phase A 기간 동안 "시간 무관 평판" 유지 → 단기적 왜곡 가능
- 1개월~수개월 지연

**비용**:
- Phase B 전환 시 일괄 마이그레이션
- 감쇠 시뮬레이션 및 튜닝

#### 11.1.3 대안 γ: Phase C에서 도입

**방식**: 정식 출시와 함께 감쇠 + Prestige 동시 발동.

**장점**:
- 최대한 안정화된 데이터로 도입
- Prestige와 시너지 (전설 달성 후 비활성 → 감쇠로 등급 하락 가능)
- 대규모 유저 검증 후 적용

**단점**:
- 베타 기간 전체가 감쇠 없음 (최대 1년+)
- "오래된 계정 부당 이득" 이슈 장기화
- 일반 유저 불만 (Phase B 요청 → C로 미룸)

**비용**:
- Phase C 전환 복잡도 증가 (감쇠 + Prestige + 기타 동시)

### 11.2 비교 매트릭스

| 기준 | α (Phase A) | β (Phase B, **추천**) | γ (Phase C) |
|------|:-----------:|:---------------------:|:-----------:|
| 구현 시점 | 즉시 | 베타 종료 | 정식 출시 |
| v2 원안 준수 | ❌ | ✅ | ⚠️ (지연) |
| 데이터 기반 튜닝 | ❌ (부족) | ✅ | ✅ (과하게 안정) |
| 유저 불만 | 🔴 | 🟡 | 🔴 (장기화) |
| 구현 공수 | 높음 | 중간 | 매우 높음 (Prestige 동시) |
| 리스크 | 마이그레이션 오류 | 적음 | 장기 왜곡 |

### 11.3 최종 결정 — 대안 β (추천)

**결정**: **대안 β — Phase B(베타 종료)에서 시간 감쇠 도입**

**근거**:

1. **v2 §3.3.2 원안 준수** — 설계 일관성
2. **Phase A의 역할 존중** — 데이터 수집 기간
3. **캐시 도입과 동시** — 구현 공수 최소화
4. **자연스러운 리셋 시점** — 베타 → 정식 전환

**Phase A 보완책**:
- 감쇠 없지만 **Rules 강화는 즉시 시행**
  - `likes`/`totalShares` 타인 수정 차단
  - 이로써 "시간 무관"이라도 펌핑 불가
- `lastActiveAt` 필드는 **Phase A에서부터 기록 시작**
  - 활동 추적 CF 즉시 도입
  - Phase B 전환 시 이미 축적된 데이터 사용 가능

### 11.4 Phase별 요약

#### Phase A (현재 ~ 베타)

**적용**:
- ✅ Rules 강화 (`likes`, `totalShares` 증가만 허용)
- ✅ `lastActiveAt` 필드 기록 시작 (배경)
- ✅ `getReputationScoreV2` 함수 배포 (감쇠 계수 = 1.0 고정)
- ✅ `calculateReputation` (공식 2) 폐지

**적용 안 함**:
- ❌ 감쇠 공식 (공식 상 `decay = 1.0`)
- ❌ 어뷰징 감점 (플래그 시스템 미도입)
- ❌ 캐시 필드 (옵션 A 유지)
- ❌ Prestige (cap 유지)
- ❌ 이중 링 UI

**Phase A 공식** (실제 적용):
```
평판 = likes × 2 + totalShares × 3 + ballReceived × 5
```

#### Phase B (베타 종료)

**추가 적용**:
- ✅ `decayFactor` 활성화 (lastActiveAt 기반)
- ✅ `abusePenalty` 활성화 (CF 플래그 연동)
- ✅ `reputationCached` 캐시 필드 + 04:45 배치 CF
- ✅ `onAbuseFlagChanged` 이벤트 트리거
- ✅ 이중 링 UI 전면 도입 (`ReputationAvatar`)
- ✅ `ActivityMilestones.tsx` 신공식 적용

**적용 안 함**:
- ❌ Prestige 시각 (여전히 "전설 예고" 공지만)
- ❌ `grandfatheredPrestigeTier` (아직 발동 안 됨)

**Phase B 공식** (실제 적용):
```
평판 = max(0, floor((likes×2 + totalShares×3 + balls×5) × decay - penalty))
```

#### Phase C (정식 출시)

**추가 적용**:
- ✅ `PRESTIGE_REPUTATION_ENABLED=true`
- ✅ Prestige 3단계 (전설/경외/신화) 시각 활성화
- ✅ `grandfatheredPrestigeTier` 자동 기록
- ✅ 휴대폰 인증 기반 `multiAccount` 플래그 도입 (`ANTI_ABUSE.md §3.2 Phase C`)

**공식 동일** (`PRESTIGE_ENABLED`만 변경):
```
평판 = max(0, floor((likes×2 + totalShares×3 + balls×5) × decay - penalty))
Tier = Prestige 포함 8단계 판정
```

---

## 12. 테스트 시나리오

### 12.1 정상 유저 (변화 없음)

**입력**:
```
likes: 500
totalShares: 100
ballReceived: 80
lastActiveAt: 오늘
abuseFlags: 없음
```

**기대 결과**:

| Phase | 점수 | Tier |
|:-----:|:----:|:----:|
| A (v1) | 1,700 | 우호 |
| A (v2-R, decay=1) | 1,700 | 우호 |
| B (decay, 오늘 활동) | 1,700 | 우호 |
| C | 1,700 | 우호 |

**검증**: 모든 Phase에서 정상 유저의 점수 변화 없음. ✅

### 12.2 맞땡스볼 담합 (감점 검증)

**입력**:
```
likes: 100
totalShares: 20
ballReceived: 2,000 (담합 의심)
lastActiveAt: 오늘
abuseFlags: { circularThanksball: true }
```

**기대 결과**:

| Phase | 점수 | Tier |
|:-----:|:----:|:----:|
| A (v1) | 10,260 | 확고 초과 (Prestige cap → 확고 표시) |
| A (v2-R, penalty 비활성) | 10,260 | 확고 |
| B (penalty 활성) | 9,960 | 확고 |
| C (Prestige + penalty) | 9,960 | 확고 (전설 경계 이하) |

**검증**: Phase B부터 감점 가시화 (300점 감소). Tier 유지되지만 `ANTI_ABUSE`의 거래 차단이 병행. ✅

### 12.3 6개월 미활동 (감쇠 검증)

**입력**:
```
likes: 1,800
totalShares: 400
ballReceived: 200
lastActiveAt: 180일 전
abuseFlags: 없음
```

**기대 결과**:

| Phase | 점수 | Tier |
|:-----:|:----:|:----:|
| A (v1) | 5,800 | 확고 |
| A (v2-R, decay=1) | 5,800 | 확고 |
| B (decay=0.95) | 5,510 | 확고 (감쇠 적용) |
| C | 5,510 | 확고 |

**검증**: Phase B에서 290점 감소 확인. ✅

### 12.4 복귀 유저 (감쇠 복원)

**입력 (Phase B 시점)**:
```
Day 0: lastActiveAt = 2년 전 (decay = 0.77)
Day 1: 글 작성 → lastActiveAt = 오늘 (decay = 1.0)
```

**기대 결과**:
- Day 0: 평판 4,400 × 0.77 = 3,388 (확고 경계)
- Day 1: 배치 후 평판 4,400 × 1.0 = 4,400 (확고 안정)

**검증**: 복귀 시 즉시 복원. ✅

### 12.5 Phase C 전환 — 첫 Prestige 달성

**입력 (Phase C 발동 당일)**:
```
likes: 3,000
totalShares: 500
ballReceived: 800
decay: 1.0
penalty: 0
```

**계산**:
```
기본 = 3,000×2 + 500×3 + 800×5 = 11,500
```

**기대 결과**:
- Phase B: "확고" 시각 (10,000+ 캡)
- Phase C 발동 첫 배치 04:45: "전설" 시각 + 금빛 회전 애니메이션
- `grandfatheredPrestigeTier = 'legend'` 기록
- `grandfatheredAt = 발동일` 기록

**검증**: Phase C 전환 시 기존 누적 점수 인정. ✅

### 12.6 Grandfathered 보호 (경계값 조정 후)

**시나리오**: Phase C+1에서 "전설" 경계를 10,000 → 15,000으로 상향.

**입력**:
```
currentScore: 12,000
grandfatheredPrestigeTier: 'legend'
grandfatheredAt: Phase C 발동일
```

**기대 결과**:
- 새 기준: 12,000 < 15,000 → 판정 "확고"
- `getDisplayTier()` → grandfathered 'legend' 반환
- 시각: "전설" 유지 (금빛 회전)

**검증**: 조정 후에도 기존 달성자 보호. ✅

### 12.7 어뷰징 플래그 설정 → 즉시 반영

**시나리오**:
```
T=0: abuseFlags: 없음, reputation: 5,000
T=1: ANTI_ABUSE CF가 circularThanksball 플래그 설정
T=1+δ: onAbuseFlagChanged 트리거
T=1+2δ: reputationCached 갱신
```

**기대 결과**:
- T=0: 5,000 표시
- T=1+2δ: 4,700 표시 (300점 감소, 배치 대기 없음)

**검증**: 이벤트 트리거로 즉시 반영. ✅

### 12.8 플래그 해제 시 복구

**시나리오**:
- 관리자가 `circularThanksball` 플래그 해제
- `abuseFlags: { circularThanksball: false }` (혹은 필드 제거)

**기대 결과**:
- 다음 이벤트 트리거 발동
- 평판 300점 복원

**검증**: 오탐 복구 경로 작동. ✅

### 12.9 Rules 방어 (Critical)

**테스트**: 타인이 `likes` 필드 대량 증가 시도

**시도**:
```javascript
await updateDoc(doc(db, 'users', victimUid), {
  likes: increment(3000)
});
```

**기대 결과**:
- Rules 거부: `permission-denied`
- 한도: 증가 ≤ 3 → `increment(3000)` 거부

**Rules 추가 테스트**: `totalShares` 감소 시도
```javascript
await updateDoc(doc(db, 'users', victimUid), {
  totalShares: increment(-100)
});
```
- 기대: 거부 (`>= resource.data.totalShares` 위반)

**검증**: Phase A에서도 Rules 즉시 작동. ✅

### 12.10 신규 유저 폴백

**시나리오**: 가입 직후, `reputationCached` 아직 없음

**기대 결과**:
- `useReputation(user)` → `getReputationScoreV2(user)` 폴백
- 점수: 0 (모든 누적값 0)
- Tier: 'neutral'
- 시각: 슬레이트 링

**검증**: 캐시 미존재 시 자연스러운 동작. ✅

---

## 13. 결정 요약 & 다음 단계

### 13.1 이 문서에서 확정된 결정

1. **평판 공식 v2-R** 채택:
   ```
   평판 = max(0, floor((likes×2 + totalShares×3 + balls×5) × decay - penalty))
   ```

2. **시간 감쇠**:
   - 1개월 유예, 월 1%, 최소 0.5
   - `lastActiveAt` 필드 기반

3. **어뷰징 감점**:
   - shortPostSpam: -500
   - circularThanksball: -300
   - multiAccount: -1,000 (Phase C)
   - massFollowUnfollow: -200 (선택)

4. **Tier 시스템**:
   - 본 게임 5단계 (중립 → 확고)
   - Prestige 3단계 (전설/경외/신화) Phase C 발동
   - `grandfatheredPrestigeTier` 보호 필드

5. **저장 방식**: **옵션 B (캐시 + 함수 폴백)** 채택 (§5.4)

6. **감쇠 도입 시점**: **대안 β (Phase B)** 채택 (§11.3)

7. **단일 공식 통합**: `calculateReputation` (공식 2) 폐지

8. **아바타 이중 링**: `ReputationAvatar` 컴포넌트로 일괄 캡슐화

9. **CF 배치**: 04:45 슬롯 (기존 ballSnapshot/ballAudit 다음)

10. **Rules 강화**: Phase A 즉시 적용 (`likes`/`totalShares` 증가만, 1회 한도)

### 13.2 검증 필요 항목 (사용자 확인)

- [ ] **CF 스케줄 슬롯**: 04:45가 적절한지 (04:15도 가능)
- [ ] **감점 수치**: 500/300/1,000/200이 적절한지 (튜닝 여지)
- [ ] **decay 계수**: 월 1%가 적절한지 (월 0.5%, 2% 등 대안)
- [ ] **Prestige 경계**: 10k/50k/100k가 적절한지

### 13.3 다음 설계서와의 연결

#### 13.3.1 `CREATOR_SCORE.md` (다음 작업)

REPUTATION_V2가 공급하는 명세:
- `useReputation(user)` → 평판 점수 (§10.1)
- `getDisplayTier(user)` → 표시용 Tier
- `reputationCached` 필드 (O(1) 읽기)

Creator Score는 이를 사용하여:
```
Creator Score = (reputation × activity × trust) / 1000
```

#### 13.3.2 `MAPAE_AND_TITLES_V1.md` (후속)

- 마패 5단계 → Creator Score 기반 (REPUTATION_V2 직접 의존 없음)
- 칭호 14개 중 일부 → 평판 Tier 조건 (예: "인기인" = 확고 이상)

#### 13.3.3 `ADMIN.md` (최종 통합)

- 관리자 대시보드: 평판 분포 히스토그램
- 어뷰징 플래그 수동 설정/해제 UI
- `grandfatheredPrestigeTier` 수동 부여 (특수 사례)

### 13.4 구현 TODO 체크리스트

**Phase A (즉시)**:
- [ ] `firestore.rules` 업데이트 (§7.3)
- [ ] `src/utils.ts`에 `getReputationScoreV2`, 보조 함수 추가
- [ ] `src/constants/reputation.ts` 신설
- [ ] `src/types.ts` 필드 추가 (옵셔널)
- [ ] `calculateReputation` 제거 + `ActivityMilestones.tsx` 교체
- [ ] `touchLastActive` CF 헬퍼 + 주요 CF에 훅 (lastActiveAt 기록 시작)
- [ ] Rules 테스트

**Phase B (베타 종료)**:
- [ ] `functions/reputationCache.js` 배포 (04:45 배치)
- [ ] `functions/reputationEvents.js` 배포
- [ ] ANTI_ABUSE 감지 CF에서 `abuseFlags` 설정 연동
- [ ] `ReputationAvatar` 컴포넌트 신설
- [ ] 10개 UI 화면 일괄 교체
- [ ] 첫 배치 모니터링 (비용, 소요 시간)

**Phase C (정식 출시)**:
- [ ] `NEXT_PUBLIC_PRESTIGE_REPUTATION_ENABLED=true`
- [ ] Prestige CSS 패키지 (rainbow, cosmos, particle)
- [ ] 휴대폰 인증 기반 `multiAccount` 탐지 (ANTI_ABUSE 연계)
- [ ] 첫 달성자 공지

### 13.5 진행 상태

**Step 1 종합기획 진행률**: 7/10 (70%)

```
✅ GLOVE_SYSTEM_REDESIGN_v2.md
✅ PRICING.md
✅ TUNING_SCHEDULE.md
✅ ANTI_ABUSE.md
✅ KANBU_V2.md
✅ LEVEL_V2.md
✅ REPUTATION_V2.md  ← 이 문서
⏳ CREATOR_SCORE.md       (다음)
⏳ MAPAE_AND_TITLES_V1.md
🎯 ADMIN.md               (최종)
```

---

**문서 끝.**

> **다음**: `CREATOR_SCORE.md` — REPUTATION_V2의 §10 인터페이스를 기반으로 "평판 × 활동성 × 신뢰도" 공식 확장.

