# 🏅 크리에이터 점수 (Creator Score) — 구현 레퍼런스

> **프로젝트**: 할말있소 / 글러브(GeuLove)
> **최종 갱신**: 2026-04-22 (Sprint 4 Phase A+B 배포, 커밋 `b44b36a`)
> **상태**: Phase A+B 배포 완료 · Phase C 대기 (1주 관찰 후)

이 문서는 **배포된 코드의 단일 진실 소스(Single Source of Truth)**다. 수식·상수·파이프라인·Rules를 수정할 때 반드시 이 문서도 함께 갱신한다.

---

## 1. 개요

**정의**: `Creator Score = (reputation × activity × trust) / 1000`

**3축**:
| 축 | 의미 | 입력 | 범위 |
|----|------|------|------|
| **reputation** | 신뢰도 — 남들이 본 나 | `users.reputationCached` (Sprint 3 V2 캐시) | 0 ~ 수천 |
| **activity** | 활동성 — 최근 30일 기여 | `activity_logs` 30일 집계 | 0 ~ 1.0 (레벨별 중위값 정규화) |
| **trust** | 신뢰도 — 제재 이력 감산 | `abuseFlags` + `exileHistory` + `reportsUniqueReporters`(Phase C) | 0.3 ~ 1.0 |

**용도** (공통 입력):
- 홈 피드 정렬 가중치 — Phase C
- ADSMARKET 광고 경매 품질 점수 — Phase C
- Gate 함수 (출금·라이브 개설·잉크병 유료화 등) — Phase C
- 마패 뱃지(bronze/silver/gold/platinum/diamond) — Phase C

---

## 2. 데이터 모델

### 2.1 `UserData` 확장 필드 (Sprint 4)

`src/types.ts`에 정의된 12개 필드 — 모두 Firestore Rules로 **클라이언트 쓰기 차단** (CF Admin SDK 전용).

```typescript
interface UserData {
  // Creator Score 캐시 (05:00 일일 배치 + 이벤트 즉시)
  creatorScoreCached?: number;            // 0.00 ~ 5.00+ (소수 2자리)
  creatorScoreTier?: MapaeKey | null;     // 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | null
  creatorScoreUpdatedAt?: Timestamp;

  // 30일 윈도우 집계 (05:00 일일 배치만)
  recent30d_posts?: number;
  recent30d_comments?: number;
  recent30d_likesSent?: number;
  recent30dUpdatedAt?: Timestamp;

  // 신고 집계 (Phase C — 현재는 미기록)
  reportsUniqueReporters?: number;
  reportsUpdatedAt?: Timestamp;

  // 기타 누적 카운터
  likesSent?: number;                     // 좋아요 송신 누적 (increment로만 변경)
  exileHistory?: ExileRecord[];           // 유배 이력 배열 (CF만 push)
}

type MapaeKey = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

interface ExileRecord {
  level: 1 | 2 | 3;
  enteredAt: Timestamp;
  releasedAt?: Timestamp;                 // 미해금이면 undefined
  reason?: string;
  bailPaid?: number;                      // 속죄금 납부액
}
```

### 2.2 `activity_logs` 컬렉션 (Sprint 4)

Creator Score 30일 윈도우의 원천 로그. **Firestore TTL 필수 설정** (expiresAt 필드, 30일 후 자동 삭제).

```typescript
interface ActivityLog {
  uid: string;
  type: 'post' | 'comment' | 'likeSent';
  refId: string;                          // 원본 postId / commentId
  createdAt: Timestamp;
  expiresAt: Timestamp;                   // createdAt + 30d (TTL 키)
}
```

**기록 규칙**:
- `post` — 10자 이상 본문만 (`isEligibleContent()`)
- `comment` — 10자 이상 댓글만
- `likeSent` — 좋아요 추가 시마다 (나에게 온 `likedBy`의 증가분을 nickname 색인으로 역조회)

---

## 3. 공식 & 상수

**공식 구현**: [functions/utils/creatorScore.js](./functions/utils/creatorScore.js) (서버) · [src/constants.ts](./src/constants.ts) (클라 상수)

### 3.1 최종 점수

```
score = (reputation × activity × trust) / SCALING_DIVISOR
      = (reputation × activity × trust) / 1000
      → 소수점 2자리 반올림
```

### 3.2 Activity 축

```
recent30d = posts × 3  +  comments × 1  +  likesSent × 0.5
activity  = min(1.0, recent30d / LEVEL_MEDIAN_ACTIVITY[level])
```

**ACTIVITY_WEIGHTS**:
| 이벤트 | 가중치 |
|--------|-------:|
| post | 3 |
| comment | 1 |
| likeSent | 0.5 |

**LEVEL_MEDIAN_ACTIVITY** (레벨별 중위값 — 이 값 도달 시 activity=1.0):
| Lv | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---:|--:|--:|--:|--:|--:|--:|--:|--:|--:|---:|
| 중위값 | 5 | 10 | 15 | 22 | 30 | 45 | 60 | 75 | 87 | 100 |

### 3.3 Trust 축

```
trust = 1.0  -  Σ abuse감산  -  Σ (exile감산 × 재범배수 × 발생횟수)  -  Σ report감산(Phase C)
      → max(0.3, min(1.0, trust))   // 하한 MIN_TRUST=0.3, 상한 1.0
```

**TRUST_CONFIG**:

```typescript
ABUSE_PENALTIES = {
  shortPostSpam: 0.05,      // 10자 이하 글 반복
  circularThanksball: 0.10, // 땡스볼 순환 송금
  multiAccount: 0.15,       // 멀티계정 적발
  massFollowUnfollow: 0.05, // 깐부 맺기/해제 루프
}

EXILE_PENALTIES  = { 1: 0.05,  2: 0.25,  3: 1.50 }   // 단계별 1회 감산
REPEAT_MULTIPLIER = { 2회: 1.5,  3회+: 2.0 }          // 같은 단계 재범

// 🚨 Phase C 활성 (Sprint 4, 2026-04-22) — threshold 내림차순, 첫 매치만 적용
// Why: 담합 신고(동일 신고자 다수)는 고유 수로 집계되지 않아 자연 방어
REPORT_PENALTIES = [
  { threshold: 20, penalty: 0.15 },
  { threshold: 10, penalty: 0.10 },
  { threshold: 5,  penalty: 0.05 },
]
```

**신고 파이프라인** (Phase C 활성):
- `submitReport` CF → `reports/{targetType}_{targetId}_{reporterUid}` 멱등 생성
- `reportAggregator` CF (매일 05:15 KST) → 고유 신고자 수 집계 → `users.reportsUniqueReporters` 갱신
- 다음날 `creatorScoreCache` (05:00) → `calculateTrustScore`에서 REPORT_PENALTIES 구간 감산 적용
- 잠정 수치 — `project_report_penalties_tuning.md` 참조
- **2026-04-24 FLAGGING Phase A+B 확장**: 9 카테고리 차등 threshold + 3단계 state + 작성자 이의제기. 상세 flow·상태 머신·관리자 UI는 [FLAGGING.md](./FLAGGING.md) 참조. Trust 감산 로직(5/10/20 threshold)은 본 문서 그대로 유지 — FLAGGING이 고유 신고자 집계 부분만 보강

**예시**:
- 1차 유배 1회 → `trust = 1.0 - 0.05 = 0.95`
- 2차 유배 2회 → `trust = 1.0 - (0.25 × 1.5 × 2) = 0.25 → max(0.3, 0.25) = 0.3`
- 3차 유배 1회 → `trust = 1.0 - 1.50 = -0.50 → max(0.3, -0.50) = 0.3` (하한 직행)
- shortPostSpam + multiAccount → `trust = 1.0 - 0.05 - 0.15 = 0.80`

### 3.4 마패 티어 경계

**MAPAE_THRESHOLDS** (`functions/utils/creatorScore.js` `getMapaeTier()`):

| 티어 | 경계 | 상징 |
|------|-----:|------|
| 🏆 diamond | ≥ 5.00 | 최상위 |
| 💎 platinum | ≥ 3.50 | 상위 |
| 🥇 gold | ≥ 2.00 | 중상위 |
| 🥈 silver | ≥ 1.00 | 중위 |
| 🥉 bronze | ≥ 0.50 | 입문 |
| (null) | < 0.50 | 미티어 |

---

## 4. 파이프라인

```
[유저 활동] ─────→ posts/comments onCreate/onUpdate 트리거
                  │
                  ↓
            activityLogger.logActivity(uid, type, refId)
                  │
                  ↓
      activity_logs/{autoId} (expiresAt=+30d, TTL 자동 삭제)
                  │
                  ↓ (매일 05:00 KST)
    creatorScoreCache 스케줄러
                  │
                  ├─ 30일 윈도우 group by (uid, type)
                  ├─ 전체 users 순회 → calculateCreatorScore()
                  └─ 변화 있으면 users 갱신 (recent30d + Score + Tier)
                  │
                  ↓ users onUpdate
      creatorScoreEvents (sanctionStatus / exileHistory / reputationCached / abuseFlags 감지)
                  │
                  ↓ 즉시 재계산
           users.creatorScoreCached / Tier / UpdatedAt
```

### 4.1 트리거 테이블

| 파일 | 함수 | 시점 | 역할 |
|------|------|------|------|
| [onActivityTriggers.js](./functions/onActivityTriggers.js) | `onPostCreatedForActivity` | posts onCreate | logActivity + users.lastActiveAt |
| | `onCommentCreatedForActivity` | comments onCreate | logActivity + users.lastActiveAt |
| | `onPostLikeChangedForActivity` | posts onUpdate | likedBy 증가분을 nickname 색인으로 역조회 → logActivity + users.likesSent increment |
| | `onCommentLikeChangedForActivity` | comments onUpdate | 동일 패턴 |
| [creatorScoreCache.js](./functions/creatorScoreCache.js) | `creatorScoreCache` | 매일 05:00 KST | 30일 윈도우 집계 + 전체 유저 재계산 (400건 배치) |
| [creatorScoreEvents.js](./functions/creatorScoreEvents.js) | `onUserChangedForCreatorScore` | users onUpdate | 4개 트리거 필드 변경 시 즉시 재계산 |

### 4.2 스케줄 의존성

`reputationCache` (04:45) → **15분 후** → `creatorScoreCache` (05:00)

`creatorScoreCache`는 `users.reputationCached`를 곱셈 입력으로 사용하므로 반드시 **reputationCache 이후** 실행되어야 한다.

### 4.3 무한 루프 방지

`onUserChangedForCreatorScore`는 `users.creatorScoreCached`를 쓰는데, 이 쓰기가 다시 트리거를 발동시키면 무한 루프. **2중 가드**:

1. 변경된 필드가 모두 `creatorScoreFields` 리스트 소속이면 skip
2. 재계산 결과가 기존 캐시와 동일하면 쓰기 생략

---

## 5. 파일 매트릭스

| 역할 | 클라이언트 (TS) | 서버 (CF / JS) |
|------|-----------------|-----------------|
| 타입 정의 | [src/types.ts](./src/types.ts) `UserData`/`MapaeKey`/`ExileRecord` | — |
| 상수 | [src/constants.ts](./src/constants.ts) `CREATOR_SCORE_CONFIG`/`ACTIVITY_WEIGHTS`/`LEVEL_MEDIAN_ACTIVITY`/`TRUST_CONFIG` | [functions/utils/creatorScore.js](./functions/utils/creatorScore.js) (동일 값) |
| 공식 | (Phase C에 클라 캐시 리더 추가 예정) | [functions/utils/creatorScore.js](./functions/utils/creatorScore.js) `calculateCreatorScore` 외 |
| 로그 기록 | — | [functions/activityLogger.js](./functions/activityLogger.js) |
| 트리거 | — | [functions/onActivityTriggers.js](./functions/onActivityTriggers.js) (4종) |
| 배치 | — | [functions/creatorScoreCache.js](./functions/creatorScoreCache.js) |
| 이벤트 | — | [functions/creatorScoreEvents.js](./functions/creatorScoreEvents.js) |
| Rules | [firestore.rules](./firestore.rules) 차단 블록 | — |

---

## 6. Firestore Rules

`users/{uid}` update에서 **다음 11필드를 클라이언트 쓰기 차단**:

```
creatorScoreCached, creatorScoreTier, creatorScoreUpdatedAt,
recent30d_posts, recent30d_comments, recent30d_likesSent,
recent30dUpdatedAt,
reportsUniqueReporters, reportsUpdatedAt,
likesSent, exileHistory
```

`activity_logs` 컬렉션: 클라이언트 read/write 전면 차단 (Admin SDK 전용).

**TTL 정책**: Firestore 콘솔 → `activity_logs` → TTL → 필드 `expiresAt` 수동 활성화 필요. 미설정 시 1년 후 수천만 건 누적되어 비용 폭증.

---

## 7. 구현 상태

### ✅ Phase A (2026-04-22) — 타입·Rules 기반 작업
- [x] `CREATOR_SCORE_CONFIG` / `ACTIVITY_WEIGHTS` / `LEVEL_MEDIAN_ACTIVITY` / `TRUST_CONFIG` 상수 정의
- [x] `UserData` 12필드 + `MapaeKey` + `ExileRecord` 타입 확장
- [x] Firestore Rules 11필드 차단

### ✅ Phase B (2026-04-22) — 파이프라인 구축
- [x] `activityLogger.logActivity()` 공용 헬퍼
- [x] 4종 Firestore onCreate/onUpdate 트리거
- [x] `functions/utils/creatorScore.js` 수식 포트
- [x] `creatorScoreCache` 일일 05:00 배치
- [x] `creatorScoreEvents` 이벤트 기반 즉시 재계산

### ⏳ Phase C (진행 중) — 소비 측 통합
- [x] 홈 피드 정렬 가중치 공식 (2026-04-22) — `best`/`rank` 탭만 `likes × clamp(creatorScoreCached ?? 1.0)` (§14.1)
- [x] ADSMARKET 광고 경매 품질 가중치 (2026-04-22) — `effectiveBid = bidAmount × clamp(creatorScoreCached ?? 1.0, 0.3, 3.0)` (§14.2)
- [x] Gate 함수 4종 (출금·라이브·잉크병·깐부방 개설) — 2026-04-22 구현, 잠정 수치 (§13 참조)
- [x] `adminAdjustCreatorScore` CF + Admin UI 버튼 (2026-04-22 배포, §11 참조)
- [x] `MapaeBadge.tsx` / `CreatorScoreInfo.tsx` 컴포넌트 (2026-04-22 배포, PublicProfile 5-1 섹션)
- [x] `REPORT_PENALTIES` 활성화 (2026-04-22) — `submitReport` CF + `reportAggregator` 05:15 KST + `calculateTrustScore` 구간 감산. 잠정 수치 (§3.3 REPORT_PENALTIES 표 + `project_report_penalties_tuning.md`)

---

## 8. 연계 시스템

| 시스템 | 연결점 | 문서 |
|--------|--------|------|
| 🏚️ 유배 시스템 | `exileHistory` → trust 감산 (1차 0.05 / 2차 0.25 / 3차 1.50 + 재범 배수) | [STOREHOUSE.md §1.4](./STOREHOUSE.md) |
| 🌟 평판 V2 | `reputationCached` → Creator Score 곱셈 입력 | [Reputation.md](./Reputation.md) |
| 📈 레벨 V2 | `level` → `LEVEL_MEDIAN_ACTIVITY` 조회 키 | [LevelSystem.md](./LevelSystem.md) |
| 🛡️ 어뷰징 플래그 | `abuseFlags` 4종 → trust 감산 | `docs/step1-design/ANTI_ABUSE.md` |
| 💰 ADSMARKET | Phase C — 광고 경매 품질 가중치 | [ADSMARKET.md](./ADSMARKET.md) |
| 🏆 마패·칭호 | `creatorScoreTier` → 뱃지 UI | `docs/step1-design/MAPAE_AND_TITLES_V1.md` |
| 🎛️ 관리자 | Phase C — `adminAdjustCreatorScore` CF | `docs/step1-design/ADMIN.md` |

---

## 9. 운영·관찰

### 9.1 24h 관찰 포인트 (배포 직후)

| 시각 | 확인 |
|------|------|
| 03:30 | `snapshotUserDaily` 로그 (Sprint 3) |
| 04:45 | `reputationCache` 로그 — `reputationCached` 채워지는지 |
| **05:00** | **`creatorScoreCache` 로그 — `updated=N, skipped=M`** |
| 배포 당일 | `activity_logs` 컬렉션 생성 확인 + TTL 수동 설정 |
| 상시 | `onUserChangedForCreatorScore` 실행 횟수 — 10~100회/일 정상, 수천 회/일이면 무한 루프 의심 |

### 9.2 배포 당일 제약

- 전 유저 `creatorScoreCached = 0` — `activity_logs` 30일 윈도우가 비어있어 `activity = 0` 산출
- 따라서 **Phase C의 피드 정렬 반영은 1주 관찰 후 결정** (0으로 가득 찬 상태에서 정렬 공식 도입 시 전체 품질 저하)

### 9.3 상수 변경 체크리스트

수식·상수·티어 경계를 수정할 때 **3곳을 동시에 맞춰야** 한다:

1. [src/constants.ts](./src/constants.ts) — 클라이언트 상수
2. [functions/utils/creatorScore.js](./functions/utils/creatorScore.js) — 서버 상수 (파일 상단 const 블록)
3. [CreatorScore.md](./CreatorScore.md) — 이 문서의 §3 공식·상수 블록

그 후:
- `npm run build` — 타입 에러 0 확인
- `firebase deploy --only functions` (사용자 명시 요청 시)
- `creatorScoreCache` 수동 트리거로 기존 캐시 재계산 (Phase C에서 Admin UI 제공 예정)

---

## 10. 참고

- **Sprint 이력**: [changelog.md](./changelog.md) Sprint 4 Phase A+B
- **관측 체크리스트**: `~/.claude/projects/e--halmal-itso/memory/project_2026-04-23_check.md`

---

## 11. 관리자 수동 조정 (Phase C)

**목적**: 자동 탐지 CF가 놓친 케이스의 긴급 보정. 수식 결과를 **해제 전까지** 덮어쓴다.

### 11.1 두 가지 조정 경로

| 경로 | 대상 필드 | 효과 | CF | UI |
|------|----------|------|-----|-----|
| **override (강제 값 지정)** | `users.creatorScoreOverride` | 수식 무시하고 고정 값 | `adminAdjustCreatorScore` | AdAdminPage → 🔧 시스템 → Creator Score 수동 조정 |
| **Abuse Flag (Trust 감산)** | `users.abuseFlags.{flag}` | Trust 공식에서 감산 → creatorScore 자연 하락 | `adminToggleAbuseFlag` | AdAdminPage → 🔧 시스템 → Abuse Flag 토글 |

### 11.2 override 필드 구조

```typescript
interface CreatorScoreOverride {
  value: number;                       // 0~10 (직접 고정)
  reason: string;                      // 관리자 사유
  setBy: string;                       // 관리자 닉네임
  setAt: Timestamp;                    // 설정 시각
  expiresAt: Timestamp | null;         // null이면 무기한
}
```

- **적용 우선순위**: `resolveScore()` 헬퍼가 override 존재 + 미만료 시 수식 대신 override.value 채택
- **만료 자동 제거**: `creatorScoreCache` 배치 또는 `onUserChangedForCreatorScore` 이벤트가 expiresAt 경과 감지 시 `FieldValue.delete()`로 자동 정리 후 수식 값으로 fallback
- **Rules 차단**: `creatorScoreOverride`는 [firestore.rules](./firestore.rules) `users/{id}` update 차단 필드에 포함 — CF 전용

### 11.3 Abuse Flag 4종 (Trust 감산값 고정)

```
shortPostSpam       −0.05   단문 스팸
circularThanksball  −0.10   맞땡스볼
multiAccount        −0.15   다계정
massFollowUnfollow  −0.05   깐부 펌프
```

상수: [functions/utils/creatorScore.js](./functions/utils/creatorScore.js) `TRUST_CONFIG.ABUSE_PENALTIES`

### 11.4 감사 로그

두 CF 모두 `audit_anomalies/{yyyyMMdd}_{uid}_{ts}` 에 기록:
- `type`: `admin_adjust_creator_score` 또는 `admin_toggle_abuse_flag`
- `adminUid`, `adminNickname`, `reason`, 이전/이후 값

관리자 대시보드에서 추적 가능 ([firestore.rules](./firestore.rules) `audit_anomalies` read: isAdmin).

### 11.5 운영 가이드

- **값 조정(override)**: 탐지 미스 케이스에서만 사용. 일반 제재는 Abuse Flag 우선
- **플래그 권장**: 사유가 명확한 경우(단문 스팸, 맞땡스볼 등) 자동 탐지 CF와 필드를 공유하므로 일관성 유지
- **해제 절차**: override는 `action: 'clear'`로 명시 해제 or `expiresAt` 자연 만료. 플래그는 `enabled: false`로 제거
- **권한**: PLATFORM_ADMIN_NICKNAMES (흑무영·Admin) 화이트리스트

---

## 12. 상세 뷰 UI — MapaeBadge / CreatorScoreInfo (Phase C)

### 12.1 적용 범위 규칙

- **상세 뷰 전용** — PublicProfile 등 "1명을 펼쳐 보는" 화면에서만 렌더
- **리스트·피드 금지** — 카드 그리드, 홈 피드, 댓글 목록 등에는 노출하지 않음
- 근거: [`feedback_reputation_avatar_scope`](./memory) — 이중 링 / 마패 등 정체성 뱃지는 상세에서만

### 12.2 MapaeBadge.tsx

- Props: `user: Pick<UserData, 'creatorScoreCached' | 'creatorScoreTier'>` · `size?: 'sm' | 'md' | 'lg'` · `showTooltip?`
- 우선순위: `creatorScoreTier` 캐시 → 없으면 `getMapaeTier(creatorScoreCached)` 재계산
- 티어 없음(`null`) → `null` 렌더(조용히 숨김) — 저활동·신규 유저는 뱃지 미부여
- 사이즈별: sm(px-2 py-0.5 text-10), md(px-2.5 py-1 text-11), lg(px-3 py-1.5 text-13)

### 12.3 CreatorScoreInfo.tsx

PublicProfile §5-1 섹션. 구성 요소:

1. **최종 점수 카드** — Score 숫자(소수점 2) + 마패 라벨 + MapaeBadge(lg)
2. **Override 배지** — `creatorScoreOverride` 존재 시 "🔧 관리자 보정값 적용 중" + 사유 표시
3. **3축 브레이크다운** — 평판 / 30일 활동(posts×3 + comments×1 + likesSent×0.5) / 신뢰(abuse⚠️/유배N회/정상)
4. **활동 세부** — 📝 글 / 💬 댓글 / ♥ 좋아요 (recent30d 원시값)
5. **갱신 시각** — `creatorScoreUpdatedAt` 상대 시간 (방금·N분·N시간·N일 전)

**집계 전 fallback**: `creatorScoreCached`가 `undefined`면 "아직 집계 전이에요. 매일 새벽 05:00 KST에 갱신됩니다." placeholder

### 12.4 util 헬퍼

- `getMapaeTier(score)` — `MapaeKey | null`
- `getMapaeLabel(tier)` — `💠 다이아패` / `🏵️ 백금패` / `🥇 금패` / `🥈 은패` / `🥉 동패` / `— 미부여`
- `getMapaeColor(tier)` — `{ bg, text, border }` Tailwind 클래스 묶음 (slate→amber→violet 그라데이션)
- `getCreatorScore(userData)` — 캐시 없으면 `null` (공식 재계산은 서버 전용)

---

## 13. 🚪 Creator Gates — 기능 진입 품질 Gate (Phase C Task 4)

### 13.1 개요

고가치 기능에 **Lv × Creator Score 동시 충족** Gate를 적용. 평판 낮은 유저의 품질 리스크 차단.

**방어 3중**: 프론트 UI 버튼 차단(UX) → Firestore Rules `get()` 검증(클라이언트 우회 차단) → CF `assertPassesGate` 최종 서버 assert

### 13.2 Gate 4종 (잠정 수치, 2026-04-22 적용)

| Gate Key | Lv | Score | 체크 지점 |
|----------|---:|------:|----------|
| `withdraw` | 5 | 1.0 | `functions/utils/gateCheck.js` 헬퍼만 대기 (출금 기능 미구현) |
| `live` | 6 | 2.0 | `firestore.rules` live_sessions create + `KanbuRoomView.createLiveSession` |
| `inkwellPaid` | — | 1.0 | `functions/inkwell.js createEpisode` (willBePaid=true) + `CreateEpisode` 유료 토글 |
| `kanbuRoom` | 6 | 0.5 | `firestore.rules` kanbu_rooms create + `useGloveActions.handleCreateRoom` |

### 13.3 상수·헬퍼 위치

| 역할 | 클라이언트 | 서버 |
|------|-----------|------|
| `CREATOR_GATES` 상수 | [src/constants.ts](./src/constants.ts) | [functions/utils/gateCheck.js](./functions/utils/gateCheck.js) |
| 통과 검사 헬퍼 | `src/utils.ts` `checkCreatorGate(userData, gateKey)` | `functions/utils/gateCheck.js` `assertPassesGate(userData, gateKey)` |
| 요구 조건 라벨 | `src/utils.ts` `getGateRequirementLabel(gateKey)` | — |

⚠️ 상수 양쪽 동기화 필수 (CF는 TS import 불가)

### 13.4 튜닝 계획

- 배포 1주 후 `creatorScoreCached` 분포 실측 (P50/P75/P90)
- 메모리 참조: `project_creator_gates_tuning.md`
- 단독 Gate 튜닝이 아니라 **레벨·평판·해금·Gate 4축 통합 밸런싱**

---

## 14. 🏅 Creator Score 소비 측 통합 (Phase C Task 5)

### 14.1 홈 피드 정렬 가중치 (App.tsx)

- **대상 탭**: `best` (좋아요 10+), `rank` (좋아요 30+) — **둘만 품질 정렬**
- **제외 탭**: `any` / `recent` / `friend` / `subscribed` — 신선도·관계 우선 (Score 개입 부적절)
- **정렬 키**: `(post.likes ?? 0) × (allUsers[post.author_id].creatorScoreCached ?? 1.0)` 내림차순
- **fallback 1.0**: 집계 전(null) 유저도 원래 좋아요 수만큼 노출 — 신규 봉쇄 방지
- **튜닝 관찰**: 점수 0.5 유저 좋아요 10짜리가 점수 2.0 유저 좋아요 5짜리에 밀리는 역전 발생 시 fallback/weight 재조정

### 14.2 ADSMARKET 광고 경매 effectiveBid (functions/auction.js)

- **기존**: `candidates.sort((a,b) => b.bidAmount - a.bidAmount)` — 단순 입찰가
- **신규**: `effectiveBid = bidAmount × clamp(creatorScoreCached ?? 1.0, 0.3, 3.0)` 로 정렬
- **clamp 경계**: `MIN=0.3` (MIN_TRUST 철학, 유배 3차도 이 바닥), `MAX=3.0` (다이아 과보정 방지)
- **차순가 결제**: 원본 `bidAmount` 기준 유지 — Creator Score는 ranking에만 사용 (대장 과금 공정성)
- **관찰 필드**: `adEvents`에 `winnerScoreWeight`, `winnerEffectiveBid` 기록 → 분포 분석용

### 14.3 튜닝 실행 트리거

- 피드: `best`/`rank` 품질 역전 민원 월 3건 이상, 또는 평균 좋아요/노출 비율 −20% 이상 하락
- 광고: 특정 광고주가 clamp 상한(3.0) 또는 하한(0.3)에 장기간 고정되어 실제 분포와 괴리
- 메모리 참조: `project_creator_score_consumer_tuning.md`

