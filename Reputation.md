# 🌟 평판 시스템 (REPUTATION V2) — 구현 레퍼런스

> **프로젝트**: 할말있소 / 글러브(GeuLove)
> **최종 갱신**: 2026-04-22 (Sprint 3 Phase A+B 배포, 커밋 `fd35203`·`5e3d078`)
> **상태**: Phase A+B 배포 완료 (Rules 차단 + 일일 캐시 파이프라인) · Phase C 대기 (Prestige 3단계)

이 문서는 **배포된 평판 시스템의 단일 진실 소스**다. 공식·티어·감쇠·어뷰징 감점을 수정할 때 반드시 이 문서와 함께 갱신한다.

---

## 1. 개요

**정의**: 평판(Reputation) = **신뢰도 지표**. "남들이 나를 얼마나 인정했나" (좋아요·공유·받은 땡스볼) - 감쇠·어뷰징.

**3대 기능**:
1. **Tier 표시** — ReputationAvatar 이중 링의 바깥 색 (상세 뷰 전용)
2. **Creator Score 곱셈 입력** — `creatorScoreCached`의 reputation 축
3. **Prestige 해금** (Phase C) — legend/awe/mythic 3단계 (PRESTIGE_REPUTATION_ENABLED 플래그)

**레벨(EXP)과의 구분**: 레벨 = "얼마나 성실했나"(자체 행동), 평판 = "남들이 얼마나 인정했나"(타인 반응). [LevelSystem.md](./LevelSystem.md) 참조.

---

## 2. 데이터 모델

### 2.1 입력 필드 (`UserData`)

```typescript
interface UserData {
  // 원천 데이터 (증가만, 감소는 이벤트 취소 시)
  likes?: number;               // 내가 쓴 글·댓글이 받은 좋아요 누적
  totalShares?: number;         // 내 글이 공유된 횟수 누적
  ballReceived?: number;        // 받은 땡스볼 누적 (평판 입력)

  // 감쇠·어뷰징 입력
  lastActiveAt?: Timestamp;     // 시간 감쇠 기준
  abuseFlags?: AbuseFlags;      // 어뷰징 감점 플래그 (CF 전용)

  // V2 캐시 (Sprint 3 Phase B — CF 전용 쓰기)
  reputationCached?: number;
  reputationTierCached?: TierKey;
  reputationUpdatedAt?: Timestamp;

  // Grandfathered 보호 (Phase C Prestige 조정 시)
  grandfatheredPrestigeTier?: TierKey;
  grandfatheredAt?: Timestamp;
}

interface AbuseFlags {
  shortPostSpam?: boolean;        // 10자 이하 글 반복
  circularThanksball?: boolean;   // 땡스볼 순환 송금
  multiAccount?: boolean;         // 멀티계정 적발
  massFollowUnfollow?: boolean;   // 깐부 맺기/해제 루프
}

type TierKey = 'neutral' | 'slightlyFriendly' | 'friendly' | 'veryFriendly' | 'firm'
             | 'legend' | 'awe' | 'mythic';  // 뒤 3개는 Prestige (Phase C)
```

### 2.2 Firestore Rules 차단 필드

CF Admin SDK 전용 (Sprint 3 Phase A 적용):

- `reputationCached`, `reputationTierCached`, `reputationUpdatedAt`

`likes`·`totalShares`·`ballReceived`는 Rules 카운터 화이트리스트(increment만 허용)에서 관리.

---

## 3. 공식 (V2-R)

**공식 구현**: [src/utils.ts](./src/utils.ts) `getReputationScoreV2` · [functions/utils/reputationV2.js](./functions/utils/reputationV2.js) `getReputationScoreV2Server`

```
base    = likes × 2  +  totalShares × 3  +  ballReceived × 5
decay   = calculateDecayFactor(lastActiveAt)       // 0.7 ~ 1.0
penalty = Σ ABUSE_PENALTIES[flag]                  // 감점 합산

score   = max(0, floor(base × decay  -  penalty))
```

### 3.1 시간 감쇠 (`DECAY_CONFIG`)

```typescript
DECAY_CONFIG = {
  GRACE_PERIOD_DAYS: 30,         // 가입/활동 30일 내는 감쇠 면제 (1.0)
  MONTHLY_DECAY_RATE: 0.005,     // 이후 월 0.5% 감쇠
  MIN_DECAY_FACTOR: 0.7,         // 최대 30%까지만 감쇠 (하한)
}
```

예시:
- 활동 15일 전 → decay 1.0 (유예 기간)
- 활동 60일 전 → `1.0 - (30/30 × 0.005) = 0.995`
- 활동 6년 전 → `max(0.7, 1.0 - 71.6 × 0.005) = max(0.7, 0.642) = 0.7` (하한)

### 3.2 어뷰징 감점 (`ABUSE_PENALTIES`)

```typescript
ABUSE_PENALTIES = {
  shortPostSpam: 500,
  circularThanksball: 300,
  multiAccount: 1_000,
  massFollowUnfollow: 200,
}
```

⚠️ **주의**: 여기 값(500/300/1000/200)은 **평판 점수 감점**. Creator Score trust 축의 `TRUST_CONFIG.ABUSE_PENALTIES`(0.05/0.10/0.15/0.05)와는 별개 필드로 두 시스템이 동일 flag를 다르게 소비한다.

### 3.3 티어 경계 (`REPUTATION_TIERS`)

| 티어 | 경계 | 색상 (링) | Prestige |
|------|----:|-----------|:--------:|
| 🪷 mythic | 100,000 | indigo-900 | ✅ Phase C |
| ✨ awe | 50,000 | amber-300 pulse | ✅ Phase C |
| 🌟 legend | 10,000 | amber-400 pulse | ✅ Phase C |
| 🔥 firm (확고) | 3,000 | purple-600 pulse | — |
| 💜 veryFriendly (매우 우호) | 2,000 | violet-500 | — |
| 💚 friendly (우호) | 1,000 | emerald-400 | — |
| 🌱 slightlyFriendly (약간 우호) | 300 | emerald-200 | — |
| ⚪ neutral (중립) | 0 | slate-200 | — |

**Phase C 토글**: `FEATURE_FLAGS.PRESTIGE_REPUTATION_ENABLED=false`인 동안 legend/awe/mythic 도달 불가 (firm에서 캡). 첫 10,000 평판 달성자 감지 시 자동 ON (`docs/step1-design/TUNING_SCHEDULE.md §3.4`).

### 3.4 Grandfathered 보호

Phase C 경계값 조정 시 과거 달성자가 Tier 하락하지 않도록 `grandfatheredPrestigeTier`에 고정 기록. `getDisplayTier()`가 현재 tier vs grandfathered 중 높은 쪽 표시.

---

## 4. 캐시 파이프라인 (Sprint 3 Phase B)

```
[03:30 KST]  snapshotUserDaily
             │ 전체 유저 likes/totalShares/ballReceived/reputation 스냅샷
             ↓
    user_snapshots/{yyyyMMdd_uid} (고정 값 보존, 회귀 비교용)

[04:45 KST]  reputationCache
             │ 전체 유저 getReputationScoreV2Server() 계산
             │ 기존 cached와 동일하면 skip, 다르면 batch update (400건)
             ↓
    users.{reputationCached, reputationTierCached, reputationUpdatedAt}

[클라이언트] getReputation(userData)
             │ userData.reputationCached ?? getReputationScoreV2(userData)
             └ 캐시값 우선, 없으면 실시간 계산 폴백
```

**CF 위치**:
- [functions/snapshotUserDaily.js](./functions/snapshotUserDaily.js) — 03:30 스냅샷
- [functions/reputationCache.js](./functions/reputationCache.js) — 04:45 캐시 갱신

**효과**: 리더보드·피드 렌더링 시 클라이언트가 N회 공식 계산하지 않고 `reputationCached` 1필드만 읽음 → Firestore compute 비용 0.

---

## 5. 파일 매트릭스

| 역할 | 클라이언트 (TS) | 서버 (CF / JS) |
|------|-----------------|----------------|
| 상수 | [src/constants.ts](./src/constants.ts) `REPUTATION_TIERS`/`DECAY_CONFIG`/`ABUSE_PENALTIES` | [functions/utils/reputationV2.js](./functions/utils/reputationV2.js) 상단 블록 (동일 값) |
| 공식 | [src/utils.ts](./src/utils.ts) `getReputationScoreV2` | [functions/utils/reputationV2.js](./functions/utils/reputationV2.js) `getReputationScoreV2Server` |
| 티어 변환 | `getReputationTier` · `getDisplayTier` | `getReputationTierServer` |
| 감쇠 | `calculateDecayFactor` | `calculateDecayFactor` |
| 어뷰징 감점 | `calculateAbusePenalty` | `calculateAbusePenalty` |
| UI 색상 | `getReputationRingColor` · `getLevelBorderColor` | — |
| 캐시 리더 | `getReputation(userData)` (캐시 우선) | — |
| 스냅샷·캐시 CF | — | `snapshotUserDaily.js` · `reputationCache.js` |

**동기화 필수 2곳**: 상수·공식은 `src/` TS와 `functions/utils/reputationV2.js` JS 둘 다 수정해야 한다. CF가 Node 런타임이라 TS import 불가.

---

## 6. ReputationAvatar UI 규약

**이중 링 구성**:
- 🔴 **바깥 링** = 평판 tier 색상 (`getReputationRingColor(tier)`)
- 🔵 **안쪽 border** = 레벨 색상 (`getLevelBorderColor(level)`)

**적용 범위** (메모리 `feedback_reputation_avatar_scope.md` 피드백):
- ✅ **상세 뷰 전용** — `PublicProfile`, 글 상세 헤더 등
- ❌ **리스트·피드 금지** — AnyTalkList, OneCutList, CommunityFeed 등에는 쓰지 말 것

**이유**: 이중 링은 시각 정보량이 많아 목록 뷰에서 카드 스캔 가독성을 해침.

---

## 7. 구현 상태

### ✅ Phase A (2026-04-22) — Rules + 공식 V2 확정
- [x] V2-R 공식 (base × decay - penalty)
- [x] `REPUTATION_TIERS` 8단계 상수 (Phase C Prestige 포함)
- [x] `DECAY_CONFIG` · `ABUSE_PENALTIES` 상수
- [x] Firestore Rules — `reputationCached/TierCached/UpdatedAt` 3필드 차단
- [x] 클라 `getReputation()` 캐시 우선 리더

### ✅ Phase B (2026-04-22) — 일일 캐시 파이프라인
- [x] `snapshotUserDaily` (03:30 KST) — `user_snapshots/{yyyyMMdd_uid}` 고정 값 보존
- [x] `reputationCache` (04:45 KST) — 전체 유저 재계산 + 변화 있으면 users 갱신
- [x] 서버 수식 포트 `functions/utils/reputationV2.js`

### ⏳ Phase C (자연 발동 감지 루프) — Prestige 해금
- [ ] `FEATURE_FLAGS.PRESTIGE_REPUTATION_ENABLED=true` 토글 조건 자동 감지
- [ ] `grandfatheredPrestigeTier` 보호 로직 검증
- [ ] `PRESTIGE_LAUNCH_DATE` 설정 + UI 공지

### 📦 레거시
- `getReputationScore()` (V1) — Sprint 2 이후 V2로 점진 마이그레이션 중. Phase C에서 제거 예정.

---

## 8. 연계 시스템

| 시스템 | 연결점 | 문서 |
|--------|--------|------|
| 🏅 Creator Score | `reputationCached` → `(rep × activity × trust) / 1000` 곱셈 입력 | [CreatorScore.md §3.1](./CreatorScore.md) |
| 📈 레벨 시스템 | 독립 축 (레벨과 평판은 서로 영향 없음) | [LevelSystem.md](./LevelSystem.md) |
| 🖼️ ReputationAvatar | 상세 뷰에서 tier → 바깥 링 색상 | `src/components/ReputationAvatar.tsx` |
| 🏚️ 유배 시스템 | `abuseFlags` 일부는 유배 사유와 연동 (중복 소비) | [STOREHOUSE.md](./STOREHOUSE.md) |
| 🎛️ 관리자 | `adminAdjustReputation` CF (Phase C 예정) | `docs/step1-design/ADMIN.md` |

---

## 9. 변경 시 체크리스트

공식·티어·감쇠·어뷰징 감점을 수정할 때:

1. [src/constants.ts](./src/constants.ts) `REPUTATION_TIERS`/`DECAY_CONFIG`/`ABUSE_PENALTIES`
2. [functions/utils/reputationV2.js](./functions/utils/reputationV2.js) 상단 상수 블록 (서버 미러)
3. [src/utils.ts](./src/utils.ts) `getReputationScoreV2` 등 공식
4. [functions/utils/reputationV2.js](./functions/utils/reputationV2.js) `getReputationScoreV2Server` (서버 공식)
5. [Reputation.md](./Reputation.md) — 이 문서의 §3·§5 블록
6. `npm run build` — 타입 에러 0 확인
7. Phase B 파이프라인 수정 시 `firebase deploy --only functions:reputationCache` (사용자 명시 요청 시)
8. 배포 후 다음 04:45 배치에서 전 유저 재계산 수행 여부 확인

---

## 10. 관찰·운영

### 24h 관찰 포인트

| 시각 | 확인 |
|------|------|
| 03:30 | `snapshotUserDaily` 로그 — `user_snapshots` 컬렉션 오늘 날짜 문서 생성 |
| 04:45 | `reputationCache` 로그 — `updated=N, skipped=M` |
| 상시 | 유저 공개 프로필 평판 점수 vs Sprint 2 표시값 일치 (불일치 시 클라·서버 공식 diff) |

### 불일치 디버깅

`reputationCached` vs 클라 `getReputationScoreV2(userData)` 값이 다른 경우:
1. [src/utils.ts](./src/utils.ts) `getReputationScoreV2` vs [functions/utils/reputationV2.js](./functions/utils/reputationV2.js) `getReputationScoreV2Server` 수식 diff
2. `DECAY_CONFIG`·`ABUSE_PENALTIES` 상수 두 파일 값 diff
3. `lastActiveAt` Timestamp 포맷 (클라 Firestore Timestamp vs 서버 Admin Timestamp, 둘 다 `{seconds, nanoseconds}`)

---

## 11. 참고

- **Sprint 이력**: [changelog.md](./changelog.md) Sprint 3 Phase A+B
- **ReputationAvatar 사용 규칙 메모리**: `~/.claude/projects/e--halmal-itso/memory/feedback_reputation_avatar_scope.md`
- **관측 체크리스트**: `~/.claude/projects/e--halmal-itso/memory/project_2026-04-23_check.md`
