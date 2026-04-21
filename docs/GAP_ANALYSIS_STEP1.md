# 🔍 글러브 Step1 설계서 Gap 분석 — 통합 체크리스트

> **작성일**: 2026-04-21
> **대상 문서**: `docs/step1-design/` 11개 MD 파일
> **목적**: Step1 설계서들이 지정한 TO-BE 대비 **현재 코드베이스에 구현되지 않은 기능·메뉴·변경 사항**을 항목별로 정리.
> **근거**: `src/`, `functions/`, `firestore.rules` 실측. 추측 배제.

---

## 📋 목차

- [0. Executive Summary](#0-executive-summary)
- [1. 🚨 즉시 조치 필요 (블로킹 이슈)](#1--즉시-조치-필요-블로킹-이슈)
- [2. 의존성 그래프](#2-의존성-그래프)
- [3. 문서별 Gap 상세](#3-문서별-gap-상세)
  - [3.1 GLOVE_SYSTEM_REDESIGN_v2 (마스터)](#31-glove_system_redesign_v2-마스터)
  - [3.2 LEVEL_V2](#32-level_v2)
  - [3.3 REPUTATION_V2](#33-reputation_v2)
  - [3.4 KANBU_V2](#34-kanbu_v2)
  - [3.5 CREATOR_SCORE](#35-creator_score)
  - [3.6 MAPAE_AND_TITLES_V1](#36-mapae_and_titles_v1)
  - [3.7 ANTI_ABUSE](#37-anti_abuse)
  - [3.8 PRICING](#38-pricing)
  - [3.9 TUNING_SCHEDULE](#39-tuning_schedule)
  - [3.10 ADMIN](#310-admin)
- [4. 신규 산출물 총정리](#4-신규-산출물-총정리)
- [5. Firestore Rules 변경 요약](#5-firestore-rules-변경-요약)
- [6. 문서 간 모순·애매 사항](#6-문서-간-모순애매-사항)
- [7. 권장 작업 순서 (Roadmap 제안)](#7-권장-작업-순서-roadmap-제안)

---

## 0. Executive Summary

### 0.1 시스템별 구현도

| 시스템 | 설계서 | 구현도 | 비고 |
|--------|--------|:------:|------|
| **LEVEL·EXP** | LEVEL_V2 | 🟡 40% | Rules 가드(Commit 6) 완료, 공식·CF 미이관 |
| **평판** | REPUTATION_V2 | 🟡 30% | Rules 가드 완료, 이중 링·감쇠·Prestige 전무 |
| **깐부** | KANBU_V2 | 🟢 75% | UI 네이밍 대부분 반영, EXP +10 완화 미적용 |
| **Creator Score** | CREATOR_SCORE | 🔴 0% | 전체 미구현, LEVEL·REPUTATION 선행 |
| **마패·칭호** | MAPAE_AND_TITLES_V1 | 🔴 0% | 전체 미구현, Creator Score 선행 |
| **어뷰징 방지** | ANTI_ABUSE | 🟡 35% | Rules 가드·유배 CF는 견고, 감지 CF·닉네임 CF 전무 |
| **가격** | PRICING | 🟢 85% | 대부분 일치, 닉네임 수수료·환율 상수만 미구현 |
| **튜닝 스케줄** | TUNING_SCHEDULE | 🔴 5% | Phase 플래그·상수 분리 미완 |
| **관리자** | ADMIN | 🟡 25% | ExileManagement·AppealReview·PlatformRevenue 존재, 권한 체계·감사 로그·수동 조정 전무 |

### 0.2 핵심 발견 5가지

1. **🚨 닉네임 변경 기능이 Rules 선반영으로 깨진 상태** — [firestore.rules:292-294](../firestore.rules)가 `nickname`/`nicknameChangedAt`을 클라이언트 쓰기 차단하지만 [src/components/MyPage.tsx:274-280](../src/components/MyPage.tsx)는 여전히 `updateDoc`으로 씀. `changeNickname` CF가 즉시 필요.
2. **레벨 테이블 불일치** — 현재 `[0,30,100,250,500,1000,2000,4000,7000,10000]` ([src/utils.ts:48](../src/utils.ts)), LEVEL_V2 §4.1은 `[0,50,150,300,500,700,1000,1500,2000,3000]`. 어느 쪽 기준인지 확정 필요.
3. ~~**두 개의 평판 공식 공존** — [src/utils.ts:144-152](../src/utils.ts)에 `calculateReputation`(공식 2) 폐지 대상이 여전히 존재하며 [ActivityMilestones.tsx:3](../src/components/ActivityMilestones.tsx)에서 import되나, 실제 사용은 `getReputationScore`. **dead code**.~~ **→ 2026-04-21 해소**: `calculateReputation` 정의 제거 완료 (전체 src에서 import 0곳 검증 후 삭제).
4. **Creator Score → 마패·칭호 → ADMIN 수동 조정** 체인이 순차 의존 — 상위 3개가 모두 미구현이므로 관리자 수동 조정 기능도 빈 상태.
5. **Phase 플래그·상수 분리 미완** — `FEATURE_FLAGS.PRESTIGE_REPUTATION_ENABLED`, `REPUTATION_TIERS`, `MAPAE_THRESHOLDS` 상수가 전부 부재. Phase C 자연 발동 감지 루프 불가.

### 0.3 작업량 추산

| 카테고리 | 개수 |
|----------|-----|
| 🔴 Critical 항목 | **12개** |
| 🟠 Major 항목 | **40+개** |
| 🟢 Minor/장기 항목 | **30+개** |
| 신규 Cloud Function | **35+개** |
| 신규 컬렉션 | **11개** |
| 신규 UI 컴포넌트 | **40+개** |
| Firestore Rules 추가 조항 | **15+개** |

---

## 1. 🚨 즉시 조치 필요 (블로킹 이슈)

현재 서비스 안정성에 직접적 영향이 있는 항목.

| # | 이슈 | 근거 | 영향 | 해결 경로 |
|:-:|-----|------|------|----------|
| 1 | **닉네임 변경 깨짐** | [rules:292-294](../firestore.rules) vs [MyPage.tsx:274-280](../src/components/MyPage.tsx) | 유저 닉네임 변경 시 `permission-denied` | `changeNickname` CF 구현 OR Rules 한시 롤백 |
| 2 | **깐부 맺기 EXP +10 유지** | [useFirestoreActions.ts:225](../src/hooks/useFirestoreActions.ts) | 다계정 100개 루프 시 Lv5 도달 | `increment(2)` 변경 (ANTI_ABUSE §5.2.1) |
| 3 | **Rules 본인 차단 키 미확장** | [rules:288-295](../firestore.rules) 의 `hasAny([...])` | REPUTATION/CREATOR_SCORE 캐시 필드 본인 덮어쓰기 가능 | 신규 필드 7종 추가(§5 참조) |
| 4 | **`platform_revenue` Rules 느슨** | [rules:397](../firestore.rules) `auth != null` | 모든 로그인 유저가 플랫폼 수익 열람 가능 | `isAdmin()`으로 수축 |
| 5 | **`calculateReputation` dead code** | [src/utils.ts:144-152](../src/utils.ts) | 공식 혼란·문서 드리프트 | 함수 폐지 + ActivityMilestones import 제거 |

---

## 2. 의존성 그래프

```
                    [ANTI_ABUSE]
                    ├─ 닉네임 CF  ← Rules 선반영으로 🚨 즉시 필요
                    ├─ reserved_nicknames 컬렉션
                    └─ 어뷰징 감지 CF 5종
                          │
                          ▼
  [LEVEL_V2] ──┬────▶ [REPUTATION_V2] ──┬──▶ [CREATOR_SCORE] ──▶ [MAPAE_AND_TITLES_V1]
  (EXP 공식)   │    (시간 감쇠·Prestige) │    (평판×활동×신뢰)   (마패+칭호 UI)
               │                        │            │
               └──[TUNING_SCHEDULE]────┘            │
                   (경계값·Phase 플래그)             │
                                                    ▼
                                              [ADMIN]
                                              (감사·수동 조정·경계값 튜닝)
                                                    ▲
                                                    │
                                              [PRICING]
                                              (수수료·가격 단일 출처)
```

**핵심 교훈**:
- ANTI_ABUSE 닉네임 CF는 Rules가 이미 선반영되어 **즉시 블로킹**
- LEVEL_V2 → REPUTATION_V2 → CREATOR_SCORE는 강한 직선 의존
- ADMIN은 최종 소비자 — 상위 시스템 없이는 "껍데기"만 구현 가능
- TUNING_SCHEDULE은 경계값·Phase 플래그 인프라이므로 모든 시스템과 교차

---

## 3. 문서별 Gap 상세

### 3.1 GLOVE_SYSTEM_REDESIGN_v2 (마스터)

마스터 문서는 개별 설계서들을 종합하므로, 실제 Gap은 하위 문서 섹션에 분산 기록.

**v2 확정사항 중 구현 중단 / 연기 항목**:

| 결정 | 상태 | 관련 하위 문서 |
|------|:----:|---------------|
| v2-1 1볼=100원 공식 | 🔴 `BALL_TO_KRW` 상수 없음 | PRICING §0.3 |
| v2-2 아바타 이중 링 | 🔴 `ReputationAvatar` 컴포넌트 없음 | REPUTATION_V2 §6.4 |
| v2-3/4 칭호 시스템 14개 | 🔴 전무 | MAPAE_AND_TITLES §4.1 |
| v2-5/6/7 닉네임 정책 | 🔴 CF·컬렉션·UI 없음, Rules만 선반영 | ANTI_ABUSE §8 |
| v2-13 EXP 품질 가중치 | 🔴 `calculateExpForPost` 없음 | LEVEL_V2 §3.2.1 |
| v2-14 깐부 맺기 +10→+2 | 🔴 미반영 | ANTI_ABUSE §5.2.1 |
| v2-15 평판 시간 감쇠 | 🔴 배치 CF 없음 | REPUTATION_V2 §8.2.1 |
| v2-16 Creator Score 공식 | 🔴 전체 미구현 | CREATOR_SCORE |
| v2-17 마패 5단계 경계값 | 🔴 전무 | MAPAE_AND_TITLES §2 |
| v2-18 Rules 긴급 패치 | ✅ Commit 6 반영 | firestore.rules |
| v2-19 Prestige 3단계 | 🔴 `PRESTIGE_REPUTATION_ENABLED` 플래그 없음 | REPUTATION_V2 §4.1-4.3 |
| v2-20 용어 UI 한국어 고정 | 🟡 대부분 반영, 일부 불일치 | KANBU_V2 §3.4 |

---

### 3.2 LEVEL_V2

#### 🔴 Critical

- [ ] **EXP 일률 +2** — 글/댓글 4개 지점에서 [useFirestoreActions.ts:88,120,163,201](../src/hooks/useFirestoreActions.ts) `exp: increment(2)` 하드코딩. LEVEL_V2 §3.2.1 품질 가중치(10~99자 +1 / 100~299자 +2 / 300~999자 +4 / 1000자+ +6 + 이미지·링크 보너스) 미반영.
- [ ] **깐부 맺기 +10 유지** — [useFirestoreActions.ts:225](../src/hooks/useFirestoreActions.ts). LEVEL_V2 §3.2.4 +2 완화 미적용 (ANTI_ABUSE §5.2.1과 중복).
- [ ] **`calculateExpForPost` 유틸 부재** — [src/utils.ts:91-94](../src/utils.ts)에 `isEligibleForExp`만 존재. LEVEL_V2 §7.1.1.
- [ ] **레벨 테이블 불일치** — 현재 `[0,30,100,250,500,1000,2000,4000,7000,10000]` ([utils.ts:48](../src/utils.ts)), LEVEL_V2 §4.1 Phase A는 `[0,50,150,300,500,700,1000,1500,2000,3000]`. **기준 확정 필요**.

#### 🟠 Major

- [ ] **`level` DB 저장 원칙(옵션 B) 모순** — [types.ts:42](../src/types.ts) `level: number` 필수, [utils.ts:45 주석](../src/utils.ts) "DB 미저장". EXP 업데이트 4곳 모두 `level` 동시 업데이트 없음. LEVEL_V2 §5.4/§5.5.
- [ ] **해금 게이트 분산** — `userLevel < 5` / `level >= N` 체크가 `MarketShopEditor`, `MarketHomeView`, `RevenueDashboard`, `constants.ts:149-151` 등 10+ 곳 산재. `utils/levelGate.ts`·`canUseFeature` 미존재.
- [ ] **`constants/level.ts` + `constants/exp.ts` 미생성** — 경계값·공식 상수가 utils.ts 내부 로컬 상수로만 존재. LEVEL_V2 §6.3/§6.4.
- [ ] **서버측 EXP CF 이관 미완** — `awardExpForPost`/`awardExpForReaction` 부재. [functions/index.js](../functions/index.js). 현재 Rules 가드(+100/증가만)로 방어 중. LEVEL_V2 §7.1.

#### 🟢 Minor / 장기 (Phase B)

- [ ] `viewed_posts` 마커 컬렉션 부재, 조회 EXP가 여전히 `sessionStorage` 기반 ([useFirestoreActions.ts:277-282](../src/hooks/useFirestoreActions.ts))
- [ ] `detectRapidExpGain` CF 부재
- [ ] 레벨업 알림(`level_up` notification type) 부재
- [ ] `recalcLevels` 마이그레이션 CF 부재

#### 📐 데이터 모델 변경

- `users.level`: 현재 필수 타입 → **옵션 B 확정** (EXP 변경 시 `calculateLevel(exp)`로 함께 업데이트)
- `users.exp`: `increment(2)` → `calculateExpForPost()` 결과값
- 신규 컬렉션 `viewed_posts/{uid}_{postId}` (Phase B)
- 신규 알림 타입 `level_up`

#### ☁️ Cloud Function

- `awardExpForPost` — 미구현
- `awardExpForReaction` — 미구현
- `recalcLevels` — 미구현
- `detectRapidExpGain` — 미구현
- 기존 `thanksball.js:156`·`inkwell.js:94`·`market.js:101` 의 `increment(1/2)` 하드코딩을 서버측 `calculateExpFor*`로 통합

---

### 3.3 REPUTATION_V2

#### 🔴 Critical

- [x] ~~**공식 2 `calculateReputation` 폐지 미이행** — [src/utils.ts:144-152](../src/utils.ts)에 존재, `ActivityMilestones.tsx:3` import 유지. REPUTATION_V2 §3.4.~~ **→ 2026-04-21 완료**: 정의 제거. import 0곳 사전 검증 (기존 기재 "ActivityMilestones import"는 오기재였음).
- [ ] **CF 전용 필드 Rules 차단 미반영** — [rules:286-295](../firestore.rules) `hasAny([...])` 본인 차단 키에 `reputationCached`, `reputationTierCached`, `reputationUpdatedAt`, `lastActiveAt`, `abuseFlags`, `grandfatheredPrestigeTier`, `grandfatheredAt` 미포함.

#### 🟠 Major

- [ ] **`getReputationScoreV2` (감쇠·감점 공식) 미구현** — [utils.ts:101-103](../src/utils.ts)은 평문 누적만. §3.2.4.
- [ ] **유틸 6종 미구현**: `calculateDecayFactor` / `calculateAbusePenalty` / `getReputationTier` / `getDisplayTier` / `useReputation` / `getTierLabel`. §3/§6.4/§10.1.
- [ ] **`ReputationAvatar` 컴포넌트 없음** — [src/components/](../src/components/) 전수 조회 0건. 현재는 `getLevelStyle` 단일 링만 사용.
- [ ] **`getReputationRingColor` / `getLevelBorderColor` 미구현** — utils.ts grep 0건. §6.4.
- [ ] **Prestige 3단계 Tier 부재** — `getReputationLabel`·`getReputationStyle`이 5단계까지만, 10,000+ 캡 로직 없음 ([utils.ts:108-125](../src/utils.ts)).
- [ ] **`PRESTIGE_REPUTATION_ENABLED` 플래그 부재** — [src/constants.ts](../src/constants.ts) grep 0건, `src/constants/` 디렉토리도 없음.

#### 🟢 Minor / 장기

- [ ] 시간 감쇠 배치 CF `updateReputationCache` 미구현 ([functions/](../functions/) 에 `reputation*.js` 0건)
- [ ] 이벤트 트리거 `onAbuseFlagChanged` 없음
- [ ] `touchLastActive` 훅 미삽입
- [ ] 복합 인덱스 3종 미생성 (`reputationTierCached DESC`, `abuseFlags.*`, `lastActiveAt`)

#### 📐 데이터 모델 변경

[src/types.ts:42-74](../src/types.ts) `UserData`에 추가:
- `reputationCached?: number`
- `reputationTierCached?: TierKey`
- `reputationUpdatedAt?: FirestoreTimestamp`
- `lastActiveAt?: FirestoreTimestamp`
- `abuseFlags?: AbuseFlags` (+ 인터페이스 신규)
- `grandfatheredPrestigeTier?: 'legend' | 'awe' | 'mythic'`
- `grandfatheredAt?: FirestoreTimestamp`
- `TierKey` 타입 alias 신설

#### ☁️ Cloud Function

- `functions/reputationCache.js` 신설 (04:45 스케줄, 400건 배치)
- `functions/reputationEvents.js` 신설 (`onDocumentUpdated` users/{uid} — abuseFlags 변경 감지)
- `functions/activityTracker.js` 신설 — `createPost`/`createComment`/`sendThanksball`/`toggleLike`/`toggleFriend`에 `touchLastActive(uid)` 호출

#### 🎨 UI 변경 — `ReputationAvatar` 적용 대상

현재 `getReputationLabel + Lv 텍스트 배지 + getLevelStyle 단일 링`을 사용하는 **20+ 컴포넌트**:

- [PostCard.tsx:96](../src/components/PostCard.tsx)
- [RootPostCard.tsx:272](../src/components/RootPostCard.tsx)
- [PublicProfile.tsx:35-37](../src/components/PublicProfile.tsx) (유일한 `getReputationStyle` 호출)
- [DebateBoard.tsx:300](../src/components/DebateBoard.tsx)
- CommunityChatPanel, AnyTalkList, CommunityFeed, CommunityPostDetail, CommunityView
- [EpisodeReader.tsx:624](../src/components/EpisodeReader.tsx)
- KanbuBoardView, KanbuRoomList
- OneCutList / OneCutDetailView / OneCutSidebar / OneCutCommentBoard
- PostDetailModal, RelatedPostsSidebar
- ActivityStats, ActivityMilestones
- CreateGiantTree, GiantTreeView
- [KanbuPromoCard.tsx:21](../src/components/KanbuPromoCard.tsx), [KanbuPromoModal.tsx:23-24](../src/components/KanbuPromoModal.tsx)

⚠️ 설계서 §6.6이 언급한 `ProfileHeader.tsx`는 **파일 부재** — 대체 대상 명시 필요.

#### 🚩 Feature Flag / 상수

- `PRESTIGE_REPUTATION_ENABLED`
- `REPUTATION_TIERS: Record<TierKey, {min, max, label, ringClass, isPrestige}>`
- `DECAY_CONFIG` (GRACE_PERIOD_DAYS=30, MONTHLY_DECAY_RATE=0.005, MIN_DECAY_FACTOR=0.7)
- `ABUSE_PENALTIES` (shortPostSpam=500, circularThanksball=300, multiAccount=1000, massFollowUnfollow=200)
- `TIER_ORDER` 매핑 (Prestige grandfathered 비교용)

---

### 3.4 KANBU_V2

#### 🔴 Critical

- [ ] **깐부 맺기 EXP +10 유지** — [useFirestoreActions.ts:225](../src/hooks/useFirestoreActions.ts). KANBU_V2 §4.2.1/§7.2·1번 위반. LEVEL_V2·ANTI_ABUSE와 중복 항목.

#### 🟠 Major

- [ ] **"🤝 맞깐부" 이모지 배지 미표기**
  - [PublicProfile.tsx:128](../src/components/PublicProfile.tsx): "서로 깐부 ✓"
  - [MyPage.tsx:684](../src/components/MyPage.tsx): "서로 깐부"
  - KANBU_V2 §3.4/§4.5.3: "🤝 맞깐부" 지정
- [ ] **[FormalBoard.tsx:43](../src/components/FormalBoard.tsx)의 "깐부수 {friendCount}" 의미 역전** — `friendCount`는 "내가 맺은 수"지 "나를 맺은 수"가 아님. "깐부 {friendCount}명"으로 정정.
- [ ] 피드 탭 / `kanbuPromo` 알림에 "구독" 잔존 여부 점검 (KANBU_V2 §4.1.1)

#### 🟢 Minor / 장기

- [ ] UID 마이그레이션 (Phase D) — `friendListUids` 병행 필드 미도입. 현재 모두 닉네임 기반.
- [ ] 일일 맺기 한도 (`DAILY_FRIEND_LIMIT=10`) CF 부재 (§4.2.3 Phase B)
- [ ] 닉네임 변경 시 `friendList` 백필 CF 부재 (§6.5)

#### 📐 데이터 모델

- [types.ts:53](../src/types.ts) `friendList` JSDoc 주석 강화 (§3.3/§5.1)
- `followerCount?: number` 필드 — 타입 주석만 먼저 추가 (Phase 중기 비정규화 대비)
- `mutualKanbu` 비정규화 필드는 선택사항 (현재 양쪽 friendList 조회로 판정)

#### ☁️ Cloud Function

- `updateFollowerCountOnFriendChange` 부재 — §4.4.1 중기 (유저 1,000명+)
- `checkDailyFriendLimit` 부재 — §4.2.3 Phase B
- 닉네임 변경 백필 CF 부재 — §6.5

#### 🛡️ Firestore Rules

- `friendList` 배열 길이 한도·본인 문서 쓰기 가드 부재 — KANBU_V2 §4.2.3과 함께 도입 권장

---

### 3.5 CREATOR_SCORE

#### 🔴 Critical

- [ ] **시스템 전체 미구현** — [src/](../src/), [functions/](../functions/) 전수 조회 결과 `creatorScore*`·`mapae*`·`activity_logs` 관련 코드 0건.
- [ ] **선행 의존성 미충족** — §3.2 `useReputation`·`reputationCached` 부재, §3.4 `abuseFlags`·`calculateAbusePenaltyForTrust` 부재 → 3축 중 2축 입력 불가.

#### 🟠 Major

- [ ] **활동 집계 파이프라인 부재** (§4.3, §8.2.3)
  - `activity_logs` 컬렉션 스키마·TTL 정책 없음
  - `functions/activityLogger.js` 없음
  - 기존 CF에 `logActivity(uid, 'post'|'comment'|'likeSent', refId)` 훅 미삽입
  - `users.likesSent` 필드 없음
- [ ] **일일 배치 CF 부재** (§8.2.1) — `functions/creatorScoreCache.js` 미존재. 현재 스케줄은 ballSnapshot(04:00)·ballAudit(04:30)만.
- [ ] **이벤트 트리거 CF 부재** (§8.2.2) — `onSanctionChanged`·`onReputationChanged` 없음. [functions/storehouse.js](../functions/storehouse.js)가 `strikeCount`만 갱신, `exileHistory` 배열 미생성.
- [ ] **유배 이력 자료구조 불일치** (§5.3, §7.1) — [types.ts](../src/types.ts)에 `exileHistory: ExileRecord[]`·`sanctionPaidAt`·`sanctionAmount` 누락. 속죄금 정합 감산(1:5:30) 계산 불가.
- [ ] **광고 경매 품질 가중치 미적용** (§10.3) — [functions/auction.js:33](../functions/auction.js) `bidAmount` 단독 정렬.
- [ ] **추천/피드 정렬 미적용** (§10.2) — 홈 피드 점수식에 `authorScore` 반영 없음. `RecommendationFeed.tsx` 파일 부재.

#### 🟢 Minor / 장기

- [ ] 게이트 함수 부재 (§10.4) — `canWithdrawRevenue`·`canHostLiveBroadcast`·`canPublishInkbottle`·`canOpenShareholderRoom`
- [ ] 관리자 수동 조정 CF (§10.5) — `adminAdjustCreatorScore` + `creatorScoreFrozen`·`creatorScoreManualBoost`
- [ ] UI 컴포넌트 (§8.3) — `MapaeBadge.tsx`·`CreatorScoreInfo.tsx`

#### 📐 데이터 모델

[src/types.ts](../src/types.ts) `UserData`에 추가:
- `creatorScoreCached`, `creatorScoreTier`, `creatorScoreUpdatedAt`
- `recent30d_posts`, `recent30d_comments`, `recent30d_likesSent`, `recent30dUpdatedAt`
- `reportsReceived`, `reportsUniqueReporters`, `reportsUpdatedAt`
- `exileHistory: ExileRecord[]`
- `creatorScoreFrozen`, `creatorScoreManualBoost`

신규 타입: `MapaeKey`, `ExileRecord`
신규 상수: `LEVEL_MEDIAN_ACTIVITY`, `ACTIVITY_WEIGHTS`, `TRUST_CONFIG`, `CREATOR_SCORE_CONFIG`, `MAPAE_THRESHOLDS`
신규 컬렉션: `activity_logs/{docId}` + TTL + `(uid ASC, createdAt DESC)` 복합 인덱스

#### ☁️ Cloud Function

신설:
- `functions/activityLogger.js`
- `functions/creatorScoreCache.js` (05:00 KST)
- `functions/creatorScoreEvents.js` (`onSanctionChanged` + `onReputationChanged`, 무한 루프 가드)
- `functions/adminCreatorScore.js`

변경:
- 글 작성/댓글/좋아요 CF — `logActivity` 훅 삽입
- [functions/storehouse.js](../functions/storehouse.js) `sendToExile`/`releaseFromExile` — `exileHistory` 배열 push + `sanctionPaidAt`·`sanctionAmount` 기록

---

### 3.6 MAPAE_AND_TITLES_V1

#### 🔴 Critical

- [ ] **마패·칭호 시스템 전체 미구현**
  - 마패 필드·시각 컴포넌트 0건
  - `titles` 컬렉션 + 14개 마스터 데이터 seed 없음
  - `users.titles` / `users.primaryTitles` 필드 미정의 ([types.ts:42-74](../src/types.ts))
  - `checkTitleAchievement` / `titleAwarder` / `titleRevocation` CF 없음
  - 유틸 `getMapaeTier`, `hasTitleId`, `useTitles` 없음
- [ ] **Rules 가드 부재** — [rules:286-304](../firestore.rules)의 `hasAny` 차단 리스트에 `titles`, `primaryTitles` 미포함 → **유저가 직접 `titles` 배열 주입 가능한 상태**.

#### 🟠 Major

- [ ] Creator Score 시스템 자체 미구현 → 마패 티어 산출 입력값 부재
- [ ] 카운터 필드 전무 — `followerCount`, `ballSentTotal`, `validCommentCount`, `consecutivePostDays`, `bestConsecutive`
- [ ] 획득 알림 컴포넌트 3종 없음 — `TitleAchievementToast` / `TitleAchievementModal` / Celebration
- [ ] 대표 칭호 선택 UI (`PrimaryTitleSelector`) 없음

#### 🟢 Minor / 장기

- [ ] `mapae_history`, `title_achievements`, `title_revocations` 감사 컬렉션 미설계
- [ ] 다이아마패 전용 `animate-spin-slow`, `bg-gradient-conic` Tailwind 확장 필요
- [ ] `pioneer_2026` 마감 공지(2026-12) 운영 이벤트 미등록
- [ ] Phase C 관리자 UI (분포 대시보드, 수동 부여/박탈)

#### 🏆 칭호 14개 마스터 목록

**A. 크리에이터 (5)**:
- `writer_seed` 🔰 — 첫 글 작성
- `writer_diligent` ✍️ — I:30일 연속 / II:100일 / III:365일 (유효 글 기준)
- `viral_first` 🔥 — 단일 글 좋아요 30+
- `popular_writer` ⭐ — 단일 글 좋아요 100+
- `super_hit` 💎 — 단일 글 좋아요 1,000+

**B. 커뮤니티 (5)**:
- `social_master` 🤝 — 맞깐부 30명+
- `chat_master` 💬 — I:1,000 / II:5,000 / III:20,000 댓글
- `sponsor` 🎁 — I:1,000볼 / II:10,000볼 / III:100,000볼 보낸 누적
- `kanbu_star` 🌟 — 깐부수 100+
- `influencer` 👑 — 깐부수 1,000+

**C. 로열티 (4)**:
- `pioneer_2026` 🌱 — 한정판, 2026년 내 가입
- `loyal_1year` 🎖️ — 가입 365일 + 월 1회+ 활동
- `veteran_2year` 🏛️ — 가입 2년+
- `dedication` ⚡ — 누적 EXP 10,000+ (Lv10)

#### 📐 데이터 모델

- `UserTitle`, `TitleMaster`, `MapaeKey` 타입 신설
- `users.titles?: UserTitle[]`, `users.primaryTitles?: string[]` (최대 3개, D2-β)
- `users.creatorScoreTier?: MapaeKey`, `users.creatorScoreCached?`, `users.reputationCached?`
- `users.validCommentCount`, `ballSentTotal`, `consecutivePostDays`, `lastPostDate`, `bestConsecutive`
- `SanctionStatus` enum 정합 조정 필요 — 현재 [types.ts:77](../src/types.ts) `'active'` vs 문서 `'clean'`

#### ☁️ Cloud Function

신설:
- `functions/titleChecker.js` (14개 체커 + `TRIGGER_TO_TITLES` 매핑)
- `functions/titleAwarder.js` (`awardTitle`, `upgradeTitle`, 자동 대표칭호 설정)
- `functions/titleRevocation.js` (`onSanctionApplied` 트리거)
- `functions/titleRestoration.js` (`onSanctionReleased`)
- `functions/titleSeed.js` (admin-only 14개 seed)
- `functions/dailyTitleRollup.js` (05:30 KST)
- `functions/mapaeEvents.js` (`onMapaeTierChanged`)

#### 🎨 UI 변경 — 닉네임 옆 대표 칭호 + 아바타 마패 배지 통합

신설: `MapaeBadge.tsx`, `TitleBadge.tsx`, `TitleCollection.tsx`, `PrimaryTitleSelector.tsx`, `TitleAchievementToast.tsx`, `TitleAchievementModal.tsx`, `FullAvatar.tsx`(= ReputationAvatar + MapaeBadge 합성)

수정 대상 (10+개): PostCard, RootPostCard, PublicProfile, CommunityPostDetail, CommunityChatPanel, OneCutCommentBoard, DebateBoard, EpisodeReader, MyPage

---

### 3.7 ANTI_ABUSE

#### 🔴 Critical

- [ ] **닉네임 변경 기능 깨짐** (블로킹)
  - [rules:292-293](../firestore.rules): `nickname`/`nicknameChangedAt`/`nicknameChangeCount`/`previousNicknames` 차단
  - [MyPage.tsx:274-280](../src/components/MyPage.tsx): 여전히 클라에서 `updateDoc`
  - **Rules 배포 직후 닉네임 변경 시 `permission-denied`**
  - 해결: `changeNickname` CF 즉시 구현 OR Rules에서 `nicknameChangedAt` 한시 허용
- [ ] **§5.2.1 깐부 맺기 EXP 완화 미적용** ([useFirestoreActions.ts:225](../src/hooks/useFirestoreActions.ts)) — 다른 문서와 중복

#### 🟠 Major

- [ ] **어뷰징 감지 CF 5종 전무** — [functions/](../functions/)에 모두 부재:
  - `detectCircularThanksball` (§6.2.1, 매일 04:30)
  - `auditReputationAnomalies` (§6.2.2, 매일 05:00)
  - `detectRapidExpGain` (§6.2.3, Phase B~C)
  - `detectDuplicateAccounts` (§6.2.4, Phase C)
  - `snapshotUserDaily` (§9.2.1, 매일 03:30, 상위 CF의 기준값)
- [ ] **`reserved_nicknames` 컬렉션·Rules 미존재** — [rules](../firestore.rules)에 `match /reserved_nicknames` 블록 전무. §4.6/§8.3.
- [ ] **품질 가중치 EXP 공식(§5.2.3) 미적용** — [utils.ts:92](../src/utils.ts) 10자 이분법만. 300/1000자 구간·이미지·링크 가중치 없음.
- [ ] **휴대폰 인증 게이트(Lv5+) 부재** — [types.ts:71](../src/types.ts) `phoneVerified` 필드는 있으나 Lv5 수익 진입 시 검증 로직 없음.

#### 🟢 Minor / 장기

- [ ] `totalShares` 실제 공유 검증 CF 부재 (`sharePost` CF 미구현, §5.2.5 Phase C)
- [ ] 세션 조회 EXP 중복 이슈 — `viewed_posts` 마커 미도입
- [ ] 관리자 검토 큐 UI — `audit_anomalies` Rules만 있고 대시보드 없음 (ADMIN 연계)

#### 📐 데이터 모델

[src/types.ts](../src/types.ts) 신규:
- `UserData.previousNicknames?: string[]`, `nicknameChangeCount?: number`, `grandfatheredLevel?`, `grandfatheredAt?`
- 인터페이스 신설: `ReservedNickname`, `AuditAnomaly` (+ `AuditAnomalyType`/`Action`/`ReviewStatus`), `UserDailySnapshot`, `PostShare`

#### ☁️ Cloud Function (정리)

| CF | 파일 | Phase | 상태 |
|----|------|:-----:|:----:|
| `changeNickname` | functions/nickname.js | B (🚨즉시) | 미구현 |
| `detectCircularThanksball` | functions/detectCircularThanksball.js | B | 미구현 |
| `auditReputationAnomalies` | functions/auditReputationAnomalies.js | B | 미구현 |
| `snapshotUserDaily` | functions/snapshotUserDaily.js | B | 미구현 |
| `detectRapidExpGain` | functions/detectRapidExpGain.js | B~C | 미구현 |
| `detectDuplicateAccounts` | functions/detectDuplicateAccounts.js | C | 미구현 |
| `sharePost` | functions/sharePost.js | C | 미구현 |
| `completeSignup` | functions/completeSignup.js | C | 미구현 (phoneHash 블랙리스트 체크) |

#### 🎨 UI 변경

- [ProfileEditForm.tsx](../src/components/ProfileEditForm.tsx) — 30일 쿨다운 자유 변경 UI → "평생 1회 · 100볼 · 이력 영구 표시" 경고 박스 + `changeNickname` CF 호출
- [MyPage.tsx:260-285](../src/components/MyPage.tsx) 30일 체크 블록 제거
- [PublicProfile.tsx](../src/components/PublicProfile.tsx) — `previousNicknames` 렌더링 추가
- 휴대폰 인증 상태 표시 + Phase B 예고 문구

---

### 3.8 PRICING

#### 📊 대조표 결과: **대부분 일치** (85% 구현)

| 항목 | 설계서 | 현재 | 상태 |
|------|:------:|:----:|:----:|
| 땡스볼 1회 상한 | 10,000볼 | 10,000 | ✅ |
| 송금 최소 간격 | 3,000ms | 3,000 | ✅ |
| 잉크병 수수료 | 11% | 0.11 | ✅ |
| 시장 수수료 Lv별 | 30/25/20% | 일치 | ✅ |
| 깐부방 수수료 | 30/25/20% | 일치 (매직넘버) | ⚠️ 상수화 |
| 정보봇 월 구독 | 20볼 | 20 | ✅ |
| 속죄금 1/2/3차 | 10/50/300볼 | 일치 (중복 정의) | ⚠️ SSOT |
| 광고 쉐어 Lv별 | 30/50/70% | 일치 | ✅ |
| 최소 출금액 | 30,000원 | 30,000 | ⚠️ 변수명 |
| 원천세율 | 3.3/8.8% | 일치 | ✅ |
| **닉네임 변경 수수료** | **100볼** | **무료+30일쿨다운** | 🔴 미구현 |
| **`changeNickname` CF** | 필수 | **없음** | 🔴 미구현 |
| **1볼=100원 환율 상수** | `BALL_TO_KRW` | **없음** | 🔴 미구현 |

#### 🔴 조정 필요

1. **닉네임 변경 수수료 체계 전면 미구현** — PRICING §8, ANTI_ABUSE §8 (중복)
2. **`MIN_WITHDRAWAL_AMOUNT` 이름 미스매치** — 실제 `SETTLEMENT_MIN_AMOUNT` ([constants.ts:168](../src/constants.ts))
3. **깐부방 수수료 상수 미추출** — [kanbuPaid.js:9-13](../functions/kanbuPaid.js) 매직넘버. `KANBU_FEE_RATES` 상수 권장
4. **`SANCTION_POLICIES` 중복 정의** — [types.ts:87-91](../src/types.ts) + [storehouse.js:15-19](../functions/storehouse.js) 양쪽에 동일 배열

#### 📐 누락된 가격·상수

- `BALL_TO_KRW = 100` 환율 상수
- `VFX_TIERS` (땡스볼 티어 경계 1/10/50/100볼)
- 가판대 가격 상한 100볼 / 단골장부 200볼 **서버 가드**
- 잉크병 최소 가격 (수수료 0 이슈 방어)
- `NICKNAME_CHANGE_FEE = 100`

#### 🎨 UI 표기

- PRICING §0.3 "모든 볼 금액에 원화 병기 권장" 미적용
- [kanbuPaid.js:50](../functions/kanbuPaid.js), [storehouse.js:202](../functions/storehouse.js), [gloveBot.js:66](../functions/gloveBot.js) 등 에러 메시지에 "10볼" 단독 표기
- 헬퍼 제안: `formatBallWithKrw(10) → "10볼(1,000원)"`

---

### 3.9 TUNING_SCHEDULE

#### 🔴 Critical

- [ ] **상수 분리 미완료** — [utils.ts:48](../src/utils.ts) `LEVEL_TABLE`, `REPUTATION_THRESHOLDS`(utils.ts:79), 하드코딩된 `getReputationLabel`(utils.ts:108)이 여전히 utils.ts에 산재. §8.1.1 TO-BE `constants.ts` 이동 미이행.
- [ ] **FEATURE_FLAGS 객체 부재** — [constants.ts](../src/constants.ts) 전체에 `FEATURE_FLAGS`, `PRESTIGE_REPUTATION_ENABLED`, `PRESTIGE_LAUNCH_DATE` 없음. Phase C 토글 스위치 미존재.
- [ ] **`REPUTATION_TIERS`, `MAPAE_THRESHOLDS` 상수 미정의** — `getReputationTier` 함수 자체가 코드베이스에 없음 (`getReputationLabel`만 존재).

#### 🟠 Major

- [ ] Phase A/B/C 식별 상수 없음 — 현재 Phase를 선언하는 enum/flag 부재
- [ ] `daily_stats` 컬렉션·`collectDailyStats` CF 미존재 (grep 0건). §6.2/§2 데이터 소스 부재
- [ ] 경계값 시뮬레이션 도구 없음 — §6.3

#### 🟢 Minor / 장기

- [ ] `LEVEL_REQUIREMENTS_SCHEDULE` 점진 램프 스캐폴딩 없음
- [ ] `tuning_history.md` 이력 파일 미생성
- [ ] ADMIN 대시보드 UI 부재 (후속 작성 예정)

#### 📐 데이터 모델 (기득권 필드)

[src/types.ts](../src/types.ts)에 미정의 (grep 0건):
- `grandfatheredLevel`, `grandfatheredAt`
- `grandfatheredPrestigeTier`, `grandfatheredMapae`, `grandfatheredMapaeAt`
- `mapaeTier`, `reputationTier`

⚠️ §8.1.3 "Step 1에서는 타입 정의도 미추가(과잉 설계 회피)" — **Phase B 공지 시점까지 의도된 공백**.

#### ☁️ 재조정 CF (누락)

현재 `onSchedule` CF 13개 존재. **누락**:
- `collectDailyStats` (§6.2)
- `snapshotGrandfatheredLevel` (§3.4 D-Day 배치)
- `detectFirstPrestigeAchiever` (§3.4 Phase C 자동 발동 트리거)
- `runBoundaryAdjustmentSimulation` (§6.3)

#### 🚩 Feature Flag / 버전 상수

- `FEATURE_FLAGS.PRESTIGE_REPUTATION_ENABLED` — 없음
- `LEVEL_REQUIREMENTS_VERSION` (v1/v2) — 없음
- 거래 스냅샷용 `feeRate`는 존재하나 (§4.3, [market.js](../functions/market.js)) 레벨/평판 버전 키는 전무

#### 🎨 공지·UI

- §3.3 Step 1 D-90 공지 템플릿 없음
- §4.1.B 경계값 조정 공지 없음
- §3.4 첫 전설 달성자 공지 템플릿 없음
- "🌱 초기 개척자" 베타 참여 칭호 정의·배지 에셋 부재

---

### 3.10 ADMIN

#### 🔴 Critical

1. **관리자 권한 체계 전체 공백** (§2)
   - [firestore.rules:7-10](../firestore.rules) `isAdmin()`이 `nickname == '흑무영'` 화이트리스트
   - [constants.ts:45](../src/constants.ts) `PLATFORM_ADMIN_NICKNAMES` 방식
   - Custom Claims 전환 로드맵(D1-β A1~A3), `grantAdminRole` CF, Owner/Admin/Moderator/Viewer 4단계(D2-γ) 전무
   - `hasRole/isOwner/isAdmin/isModerator` 헬퍼·`AdminGuard` 라우팅 가드 없음
2. **`admin_actions` 감사 로그 시스템 전무** (§3)
   - 컬렉션·Rules·TTL 정책·`logAdminAction`·`rollbackAdminAction` CF 없음
   - 기존 [sendToExile/releaseFromExile/executeSayak](../functions/storehouse.js)은 로그 미기록
3. **수동 조정 도구 0% 구현** (§6, 14개 서브영역)
   - `adjustExp`, `adjustReputation`, `adjustCreatorScore`, `awardTitle`/`revokeTitle`, `setAbuseFlag`, `setGrandfathered`, `batchAdjust` — CF·UI 모두 없음
4. **관리자 유배 UI의 로그/이중확인 부재** ([ExileManagement.tsx](../src/components/admin/ExileManagement.tsx))
   - 현재 strikeCount +1 기반, §4.2의 단계 직접 선택·증거 ID 배열·연관 댓글 자동 블라인드 옵션 없음
   - 사약 집행 시 "닉네임 정확 입력" 이중 확인(§4.4) 미구현
   - **`releaseFromExile`은 유저 자발 납부 CF** — 관리자 직권 해제 CF 별도 필요
5. **닉네임 관리자 수동 변경** (§8) — `adminChangeNickname` CF, `reserved_nicknames` 컬렉션, `previousNicknames` arrayUnion, `sanction_log` `nickname_change_admin` 기록 전무
6. **`platform_revenue` Rules 느슨** — [rules:397](../firestore.rules) `auth != null` → `hasAdminRole()`로 수축 필요

#### 🟠 Major

- [ ] **콘텐츠 블라인드 시스템 부재** (§7) — `blindedAt/blindedBy/blindReason/blindCategory` 필드 스킴 없음. `blindContent`/`unblindContent`/`blindAllUserContent`/`unblindAllUserContent` CF 없음
- [ ] **경고 시스템** (§5.3) — `issueWarning` CF·누적 카운트·3회 누적 Admin 알림 없음
- [ ] **제보 접수 채널** (§5.6) — `contact_requests` 컬렉션·UI 부재
- [ ] **Tier T1/T2/T3 & 회원가입 재설계** (§9) — `users.tier`, `verifications.phone/payment`, `verification_waitlist`, `adminSetTier` 없음
- [ ] **플랫폼 수익 대시보드 확장** ([PlatformRevenueDashboard.tsx](../src/components/admin/PlatformRevenueDashboard.tsx)) — §10.5의 8카테고리 종합 뷰, 전월비, CSV export, 일별 추이 점검
- [ ] **어뷰저 이상치 검토 큐** (§11.4) — `audit_anomalies` Rules만 있고 전용 UI·일괄 조치 버튼 전무
- [ ] **분포 대시보드** (§11.3) — Level/평판/Creator Score/칭호 분포 화면 전무
- [ ] **경계값 튜닝 시뮬레이션/적용** (§12) — `simulateThresholdChange`/`applyThresholdWithGrandfathering` CF, `platform_config`/`platform_config_history` 컬렉션 전무

#### 🟢 Minor / 장기

- [ ] AppealReview는 구현됨 ([AppealReview.tsx](../src/components/admin/AppealReview.tsx)) — ADMIN.md 정의 없음, `admin_actions` 통합만 필요
- [ ] 실시간 알림 판넬 (§11.8) — 500볼+ 고액 땡스볼/부정클릭/이상치 onSnapshot 판넬 없음
- [ ] 관리자 활동 감사 UI + 롤백 (§3.3-3.4)
- [ ] 라이브 긴급 종료 UI (§10.4.1), 환불 처리 UI (§10.3.1)
- [ ] 광고주 관리 — [AdAdminPage](../src/components/admin/AdAdminPage.tsx)/[AdReviewQueue](../src/components/admin/AdReviewQueue.tsx)/[FraudAlerts](../src/components/admin/FraudAlerts.tsx)/[TaxReportExport](../src/components/admin/TaxReportExport.tsx) 존재 → 예치금/캠페인 상세만 확장

#### 📐 신규 컬렉션 (11개)

| 컬렉션 | 용도 | Rules |
|--------|------|-------|
| `admin_actions/{actionId}` | 감사 로그 | read: hasAdminRole, write: false, TTL |
| `admin_role_history/{docId}` | 역할 이력 | Owner read, CF write |
| `pending_actions/{docId}` | Moderator 제안 큐 | Admin read, CF write |
| `reserved_nicknames/{nickname}` | 예약 닉네임 | read: true, write: false |
| `platform_config/{docId}` | 수수료·경계값 | read: true, write: hasOwnerRole |
| `platform_config_history/{docId}` | 변경 이력 | Admin read, CF write |
| `contact_requests/{docId}` | 제보 접수 | user write, Admin read |
| `verification_waitlist/{docId}` | T2/T3 대기 | self read, CF write |
| `title_achievements/{docId}` | 칭호 획득 이력 | self read, CF write |
| `title_revocations/{docId}` | 칭호 박탈 이력 | Admin read, CF write |
| `mapae_history/{docId}` | 마패 이력 | self + Admin read |
| `activity_logs/{docId}` | CREATOR_SCORE 연계 | CF 전용 + TTL |

#### 🎨 신규 UI 컴포넌트 ([src/components/admin/](../src/components/admin/))

- `AdminGuard.tsx`, `AdminApp.tsx`, `AdminDashboard.tsx`
- `UserManagement.tsx`, `UserDetailPanel.tsx`
- `ManualSanctionForm.tsx`, `WarningIssuer.tsx`
- `NicknameChangePanel.tsx`, `ReservedNicknamesPanel.tsx`
- `ExpAdjustPanel.tsx`, `ReputationAdjustPanel.tsx`, `CreatorScoreAdjustPanel.tsx`
- `AbuseFlagsPanel.tsx`, `GrandfatherPanel.tsx`
- `TitleAwardPanel.tsx`, `TitleRevokePanel.tsx`
- `BatchAdjustTool.tsx` (Owner)
- `ContentBlindModal.tsx`, `BlindedContentDashboard.tsx`
- `AuditLogViewer.tsx`, `ActionDetailDrawer.tsx`, `RollbackButton.tsx`
- `RoleManagement.tsx` (Owner)
- `AnomalyReviewQueue.tsx`
- `DistributionDashboard.tsx`
- `ThresholdSimulator.tsx`, `ThresholdApplyDialog.tsx`
- `PlatformFeeAdjuster.tsx` (Owner)
- `LiveForceEndPanel.tsx`, `RefundRequestPanel.tsx`
- `VerificationWaitlistPanel.tsx`, `TierForceSetPanel.tsx` (Owner)

**기존 확장**:
- [ExileManagement.tsx](../src/components/admin/ExileManagement.tsx): 단계 직접 선택 + 증거 배열 + 자동 블라인드 + 사약 이중 확인 + 감사 로그
- [PlatformRevenueDashboard.tsx](../src/components/admin/PlatformRevenueDashboard.tsx): 8카테고리 + 전월비 + CSV + 일별 추이
- [AdReviewQueue.tsx](../src/components/admin/AdReviewQueue.tsx): 광고주 예치금/캠페인 상세

---

## 4. 신규 산출물 총정리

### 4.1 Cloud Function (35+개)

#### LEVEL_V2 (4개)
1. `awardExpForPost` — Phase B
2. `awardExpForReaction` — Phase B
3. `recalcLevels` — 마이그레이션
4. `detectRapidExpGain` — Phase B

#### REPUTATION_V2 (3개)
5. `functions/reputationCache.js` — 04:45 스케줄
6. `functions/reputationEvents.js` — onDocumentUpdated
7. `functions/activityTracker.js` — `touchLastActive` 헬퍼 허브

#### KANBU_V2 (3개)
8. `updateFollowerCountOnFriendChange` — 중기
9. `checkDailyFriendLimit` — Phase B
10. 닉네임 변경 `friendList` 백필 CF

#### CREATOR_SCORE (4개)
11. `functions/activityLogger.js`
12. `functions/creatorScoreCache.js` — 05:00 KST
13. `functions/creatorScoreEvents.js` — onSanction/onReputation 트리거
14. `functions/adminCreatorScore.js`

#### MAPAE_AND_TITLES (7개)
15. `functions/titleChecker.js`
16. `functions/titleAwarder.js`
17. `functions/titleRevocation.js` — onSanctionApplied
18. `functions/titleRestoration.js` — onSanctionReleased
19. `functions/titleSeed.js` — 14개 마스터 seed
20. `functions/dailyTitleRollup.js` — 05:30 KST
21. `functions/mapaeEvents.js` — onMapaeTierChanged

#### ANTI_ABUSE (8개)
22. `functions/nickname.js` — `changeNickname` 🚨
23. `detectCircularThanksball` — 04:30 스케줄
24. `auditReputationAnomalies` — 05:00 스케줄
25. `snapshotUserDaily` — 03:30 스케줄
26. `detectRapidExpGain` (중복, #4와 동일)
27. `detectDuplicateAccounts` — Phase C
28. `sharePost` — Phase C
29. `completeSignup` — Phase C (phoneHash 블랙리스트)

#### TUNING_SCHEDULE (4개)
30. `collectDailyStats` — 02:00 배치
31. `snapshotGrandfatheredLevel` — D-Day 배치
32. `detectFirstPrestigeAchiever` — Phase C 트리거
33. `runBoundaryAdjustmentSimulation`

#### ADMIN (10+개)
34. `grantAdminRole`, `revokeAdminRole`
35. `logAdminAction`, `rollbackAdminAction`
36. `adminSendToExile`, `adminReleaseExile`, `adminExecuteSayak`
37. `issueWarning`
38. `adjustExp`, `adjustReputation`, `adjustCreatorScore`, `adjustPlatformFee` (Owner)
39. `awardTitle`, `revokeTitle`
40. `setAbuseFlag`, `setGrandfathered`
41. `batchAdjust` (Owner)
42. `blindContent`, `unblindContent`, `blindAllUserContent`, `unblindAllUserContent`
43. `adminChangeNickname`, `reserveNickname`, `unreserveNickname`
44. `adminSetTier` (Owner), `joinVerificationWaitlist`
45. `simulateThresholdChange`, `applyThresholdWithGrandfathering` (Owner)
46. `approveAd`, `rejectAd`, `approvePayout`, `rejectPayout`

### 4.2 신규 컬렉션 (11+개)

| # | 컬렉션 | 소유 문서 |
|:-:|--------|----------|
| 1 | `reserved_nicknames/{nickname}` | ANTI_ABUSE |
| 2 | `viewed_posts/{uid}_{postId}` | LEVEL_V2 |
| 3 | `activity_logs/{docId}` | CREATOR_SCORE |
| 4 | `titles/{titleId}` (14개 seed) | MAPAE |
| 5 | `title_achievements/{docId}` | MAPAE |
| 6 | `title_revocations/{docId}` | MAPAE |
| 7 | `mapae_history/{docId}` | MAPAE |
| 8 | `user_daily_snapshots/{docId}` | ANTI_ABUSE |
| 9 | `post_shares/{docId}` | ANTI_ABUSE |
| 10 | `daily_stats/{docId}` | TUNING_SCHEDULE |
| 11 | `admin_actions/{actionId}` | ADMIN |
| 12 | `admin_role_history/{docId}` | ADMIN |
| 13 | `pending_actions/{docId}` | ADMIN |
| 14 | `platform_config/{docId}` | ADMIN |
| 15 | `platform_config_history/{docId}` | ADMIN |
| 16 | `contact_requests/{docId}` | ADMIN |
| 17 | `verification_waitlist/{docId}` | ADMIN |

### 4.3 신규 UI 컴포넌트 (40+개)

**공통 (아바타·칭호·마패)**:
- `ReputationAvatar.tsx` (이중 링) — REPUTATION_V2
- `MapaeBadge.tsx`, `TitleBadge.tsx`, `TitleCollection.tsx`, `PrimaryTitleSelector.tsx`
- `TitleAchievementToast.tsx`, `TitleAchievementModal.tsx`, `FullAvatar.tsx`
- `CreatorScoreInfo.tsx` (본인 전용)

**관리자 (30+개)** — [ADMIN 섹션](#310-admin) 참조

**닉네임/어뷰징**:
- `NicknameChangePanel.tsx` (ANTI_ABUSE §8.5.1) — 평생 1회·100볼 UI

### 4.4 신규 상수·Feature Flag

```typescript
// src/constants.ts 또는 src/constants/ 분리
export const FEATURE_FLAGS = {
  PRESTIGE_REPUTATION_ENABLED: false,
  PRESTIGE_LAUNCH_DATE: null,
} as const;

export const BALL_TO_KRW = 100;

export const REPUTATION_TIERS = {
  neutral: 0, mild: 300, friendly: 1_000,
  veryFriendly: 2_000, firm: 3_000,
  legend: 10_000, awe: 50_000, mythic: 100_000,
} as const;

export const MAPAE_THRESHOLDS = {
  bronze: 0.5, silver: 1.0, gold: 2.0,
  platinum: 3.5, diamond: 5.0,
} as const;

export const DECAY_CONFIG = {
  GRACE_PERIOD_DAYS: 30,
  MONTHLY_DECAY_RATE: 0.005,
  MIN_DECAY_FACTOR: 0.7,
};

export const ABUSE_PENALTIES = {
  shortPostSpam: 500,
  circularThanksball: 300,
  multiAccount: 1000,
  massFollowUnfollow: 200,
};

export const NICKNAME_CHANGE_FEE = 100; // 볼
export const DAILY_FRIEND_LIMIT = 10;

export const KANBU_FEE_RATES = { // kanbuPaid.js 매직넘버 추출
  low: 0.30, mid: 0.25, high: 0.20,
};

export const VFX_TIERS = { // thanksball VFX 경계
  small: 1, medium: 10, large: 50, legendary: 100,
};
```

---

## 5. Firestore Rules 변경 요약

### 5.1 이미 반영됨 (Commit 6)

- ✅ users 본인 `exp` 가드 (증가만, ≤100, 음수 불가) — [rules:286-304](../firestore.rules)
- ✅ users 타인 `likes`/`totalShares`/`promoViewCount` 증가-only + 1회 상한 — [rules:319-329](../firestore.rules)
- ✅ 닉네임·기득권 필드 클라 쓰기 차단 — [rules:292-294](../firestore.rules)

### 5.2 남은 변경 (우선순위 순)

**🚨 즉시**:
1. `platform_revenue` 읽기 범위 수축 — `auth != null` → `isAdmin()` ([rules:397](../firestore.rules))
2. `match /reserved_nicknames/{oldNick}` 블록 신설 (ANTI_ABUSE §8.3)

**Step 2**:
3. users 본인 `hasAny([...])` 차단 키 확장:
   - `reputationCached`, `reputationTierCached`, `reputationUpdatedAt`, `lastActiveAt`, `abuseFlags` (REPUTATION_V2)
   - `creatorScoreCached`, `creatorScoreTier`, `creatorScoreUpdatedAt`, `recent30d_*`, `reportsUniqueReporters`, `exileHistory`, `creatorScoreFrozen`, `creatorScoreManualBoost` (CREATOR_SCORE)
   - `titles`, `validCommentCount`, `ballSentTotal`, `consecutivePostDays`, `bestConsecutive`, `mapaeTier` (MAPAE)
   - `grandfatheredPrestigeTier`, `grandfatheredAt`, `grandfatheredMapae` (TUNING)
4. `primaryTitles` 쓰기 허용하되 `is list && size() <= 3` 검증 (MAPAE D2-β)
5. `match /titles/{id}` 블록 (read: true, write: false)
6. `match /activity_logs/{docId}` 블록 (read/write: false — CF 전용)
7. `match /user_daily_snapshots/{doc}` 블록 (admin·CF 전용)
8. `match /post_shares/{doc}` 블록 (CF 전용)

**Step 3 (ADMIN)**:
9. `isAdmin()` 재작성 — Custom Claims 기반 `hasRole('admin')` + Phase A-1 이중 체크
10. `hasOwnerRole` / `hasAdminRole` / `hasModeratorRole` / `hasViewerRole` 4종 헬퍼 도입
11. ADMIN 신규 컬렉션 6종 Rules 신설 (admin_actions, admin_role_history, pending_actions, platform_config, platform_config_history, contact_requests, verification_waitlist)
12. `users` update 경로를 `hasOnly` 화이트리스트 기반으로 재작성

---

## 6. 문서 간 모순·애매 사항

### 6.1 LEVEL_V2

- **레벨 테이블 값**: §1.2/§4.1은 `[0,50,150,300,500,700,1000,1500,2000,3000]`, 코드는 `[0,30,100,250,500,1000,2000,4000,7000,10000]`. 어느 쪽 확정인지 불명.
- **`utils.ts:45` 주석** "DB에 level 저장 안 함" vs LEVEL_V2 §5.4 "옵션 B (DB 저장)" 정반대.
- **`types.ts:46` `level: number` 필수** + `functions/revenue.js:47` `userData.exp || 0` 참조 → CF가 `level`을 업데이트하는 곳 없으므로 stale 위험.

### 6.2 REPUTATION_V2

- `ProfileHeader.tsx` 설계서 §6.6·§8.3 반복 언급되나 **실제 파일 부재**. 대체 대상 명시 필요.
- §1.1.2 "`calculateReputation`이 `ActivityMilestones.tsx`의 유일한 사용처" — 실제는 **src 전체에서 import 0곳**의 완전 dead code였음. 2026-04-21 정의 제거로 해소.
- §11 감쇠 도입 "Phase B 추천" vs §8.2.3 "Phase B 시작 시 단계 3 일괄 도입" 타이밍 애매.

### 6.3 KANBU_V2

- [useFirestoreActions.ts:222-225](../src/hooks/useFirestoreActions.ts) 주석 "+10→+2 완화는 별도 커밋"이라 예고 → 미진행. ANTI_ABUSE §5.2.1과 작업 주체 불명확.
- [storehouse.js:267-272](../functions/storehouse.js) 유배 시 타인 `friendList` 역방향 제거 → 닉네임 기반 역쿼리 동작 중. UID 마이그레이션(§4.3) 시 동시 전환 필요가 KANBU_V2에 명시 안 됨.
- §4.4 "유저 1,000명" 기준이 DAU인지 총 가입자인지 불명확.

### 6.4 CREATOR_SCORE

- `useReputation` 정의 위치: §3.2 `'./utils'` import 기술, REPUTATION_V2 미구현 시 fallback 미명시.
- `exileHistory` 마이그레이션: 기존 `strikeCount` 누적자의 이력 소급 기록 방법 문서에 없음.
- §8.2.2 `creatorScoreFieldsOnlyChanged` 헬퍼 구현 예시 불완전 — `updatedAt`이 매번 바뀌면 루프 발생 위험.
- §3.3 `factor = recentActivity / levelMedian`에서 `levelMedian=0`(Lv1=0인 D1-α) 조기 반환 vs Lv1=5(D1-β) 결정 미확정.
- §10.4 게이트 임계 "예시"와 확정값 혼재.

### 6.5 MAPAE_AND_TITLES_V1

- v2 §6.5는 "12개", 본 문서가 "14개"로 정정 — v2 원문 수정 필요.
- `sanctionStatus` 값: 문서 `'clean'` 기준, [types.ts:77](../src/types.ts) `'active'` 사용 → 통일 필요.
- D1~D5 5개 결정 모두 "추천"만 표기, 사용자 최종 확정 대기 (§12.2).
- `checkWriterDiligent` 재달성 규칙 §11.5 "최고 기록 기준", `bestConsecutive` 분리 저장 여부 미확정.

### 6.6 ANTI_ABUSE

- **닉네임 정책 상충**: §8 "평생 1회 유료 100볼" vs [MyPage.tsx](../src/components/MyPage.tsx) "30일 쿨다운 무제한 무료". 마이그레이션 계획 미기재.
- `abuseFlags`: 배경 컨텍스트 거론하나 **본문에 식별자 없음** — 별도 문서 기반이거나 용어 재확인 필요.
- §8.4 CF 코드 오타: 첫 번째 `tx.set` 블록의 `reservedDocRef.collection(...)` 경로 오류 → 두 번째 블록만 사용.
- [useFirestoreActions.ts:225](../src/hooks/useFirestoreActions.ts) 주석 "+10→+2 완화는 이번 커밋 범위 밖" — 의도적 미스매치.

### 6.7 PRICING

- §11.1 `MAX_AMOUNT_PER_TX` 10,000볼 → 500볼 "PG 연동 시점" 명시, §1.2는 "MVP 단계 유지" → 공식 입장 명확화 필요.
- 깐부 홍보 가격 §5.3 "registerKanbuPromo 참조"만 언급, 실제 [kanbuPromo.js:7-11](../functions/kanbuPromo.js) 1/7/30일 = 1/6/25볼 값 설계서에 흡수 필요.
- 라이브 땡스볼 수수료 §9.1 "별도 검토" → [thanksball.js:204](../functions/thanksball.js) `platformFee: 0` 고정. 11% 적용 여부 미결.
- 사약 몰수 `seizedAmount` 원장 정합(ballTransactions `sourceType`) 미검증.

### 6.8 TUNING_SCHEDULE

- §8.1.3 "Step 1에서 `grandfatheredLevel` 타입 미추가" vs §8.1.4 "Step 1에 `FEATURE_FLAGS` 기록" — 우선순위 모호 (실제는 플래그 먼저, 기득권은 Phase C 직전).
- §3.2 "Lv10 유저 100명 돌파 OR 정식 서비스 6개월 전" — OR인지 AND인지, 자동/수동 검출 미지정.

### 6.9 ADMIN

- **컬렉션명 충돌**: §7.1 `carousels`/`tree_posts`/`inkwells`/`market_stalls`/`live_sessions` 가정, 실제는 `posts`(카테고리 한컷+`isOneCut`)/`giant_trees/leaves`/`series`+`posts`(잉크병)/`market_items`+`market_shops` 사용. `blindAllUserContent` CF 작성 전 매핑표 확정 필요.
- `nicknameChangeCount` 의미: §8.4 관리자 변경 시 증가 금지 vs 필드 자체 부재.
- `releaseFromExile` 이름 충돌: 현재 CF는 유저 자발 납부 vs §4.3 관리자 직권 해제. **별도 `adminReleaseExile`로 분리** 권장.
- `platform_revenue` Rules `auth != null` vs §2.7.4 `hasAdminRole`. Phase A-1 전환 시 [PlatformRevenueDashboard](../src/components/admin/PlatformRevenueDashboard.tsx) 회귀 테스트 필요.
- `isAdmin` 오버로드: Rules(닉네임) vs §2.5 헬퍼(Claims) 동명 → TS 쪽 `isAdminByClaims` 등 리네이밍 권장.
- AppealReview 위치: 유배 이의 제기 전용이나 §5는 외부 제보 중심. 설계서상 신고 큐(Phase C `reports`)와의 관계 정리 필요.

---

## 7. 권장 작업 순서 (Roadmap 제안)

> 의존성 그래프 + 블로킹 이슈 + 문서 합의 상태를 종합한 **제안**. 최종 결정은 사용자 승인 후.

### Sprint 0 (즉시) — 블로킹 해소

| # | 작업 | 파일 | 예상 난이도 |
|:-:|-----|------|:----------:|
| 1 | `changeNickname` CF + `reserved_nicknames` Rules | functions/nickname.js | 🟡 중 |
| 2 | [MyPage.tsx](../src/components/MyPage.tsx) 닉네임 UI 전환 (100볼 · 평생 1회) | ProfileEditForm, MyPage | 🟡 중 |
| 3 | 깐부 맺기 EXP +10 → +2 | [useFirestoreActions.ts:225](../src/hooks/useFirestoreActions.ts) | 🟢 하 |
| 4 | `platform_revenue` Rules 수축 | firestore.rules | 🟢 하 |
| 5 | ~~`calculateReputation` dead code 제거 + ActivityMilestones import 정리~~ **✅ 2026-04-21 완료** (utils.ts 정의만 삭제, import는 애초에 0곳) | utils.ts | 🟢 하 |

### Sprint 1 — 기반 상수·플래그

| 작업 | 파일 |
|------|------|
| `FEATURE_FLAGS` 객체 + `BALL_TO_KRW` 환율 상수 | src/constants.ts |
| `REPUTATION_TIERS`, `MAPAE_THRESHOLDS`, `DECAY_CONFIG`, `ABUSE_PENALTIES` 상수 | src/constants.ts |
| `LEVEL_TABLE` 기준 확정 + constants 이동 | src/constants.ts (이동) |
| `utils.ts:45` 주석 정정 (옵션 B 일관) | utils.ts |
| `KANBU_FEE_RATES` 상수화 | constants.ts, kanbuPaid.js |
| `SANCTION_POLICIES` 단일 출처 | types.ts OR storehouse.js 선택 |
| 레벨 테이블 값 확정 (사용자 결정) | — |

### Sprint 2 — LEVEL·REPUTATION·KANBU UI·상수

| 작업 | 파일 |
|------|------|
| `calculateExpForPost` 유틸 | utils.ts |
| 글·댓글·땡스볼 EXP 공식 적용 | useFirestoreActions.ts, thanksball.js, inkwell.js, market.js |
| `ReputationAvatar` 컴포넌트 신설 | src/components/ReputationAvatar.tsx |
| 20+ 컴포넌트 아바타 교체 | PostCard, RootPostCard, PublicProfile, ... |
| `getReputationTier`, `getDisplayTier`, `getReputationRingColor`, `getLevelBorderColor` | utils.ts |
| "🤝 맞깐부" 이모지 반영 | PublicProfile, MyPage |
| [FormalBoard.tsx:43](../src/components/FormalBoard.tsx) 의미 역전 수정 | FormalBoard.tsx |
| `useReputation` 훅 + `reputationCached` 필드 허가 | types.ts |

### Sprint 3 — 어뷰징 감지 CF + 휴대폰 게이트

| 작업 | 파일 |
|------|------|
| `snapshotUserDaily` (03:30) | functions/snapshotUserDaily.js |
| `detectCircularThanksball` (04:30) | functions/detectCircularThanksball.js |
| `reputationCache` (04:45) | functions/reputationCache.js |
| `auditReputationAnomalies` (05:00) | functions/auditReputationAnomalies.js |
| Rules — 본인 차단 키 확장 (REPUTATION 필드 7종) | firestore.rules |
| 휴대폰 인증 UX Phase B 예고 | ProfileEditForm |

### Sprint 4 — Creator Score

| 작업 | 파일 |
|------|------|
| `activity_logs` 컬렉션 + `activityLogger.js` | functions/activityLogger.js |
| 글·댓글·좋아요·송금 CF에 `logActivity` 훅 삽입 | 기존 CF 수정 |
| `creatorScoreCache.js` (05:00) | functions/creatorScoreCache.js |
| `creatorScoreEvents.js` (onSanction/onReputation) | functions/creatorScoreEvents.js |
| [auction.js](../functions/auction.js) 품질 가중치 반영 | auction.js |
| 홈 피드 정렬 점수식에 `authorScore` 반영 | App.tsx 또는 피드 컴포넌트 |

### Sprint 5 — 마패·칭호

| 작업 | 파일 |
|------|------|
| `titles` 컬렉션 14개 seed | functions/titleSeed.js |
| `titleChecker.js` 14개 체커 | functions/titleChecker.js |
| `titleAwarder.js` + `TRIGGER_TO_TITLES` 매핑 | functions/titleAwarder.js |
| `titleRevocation.js` / `titleRestoration.js` | functions/ |
| `MapaeBadge`, `TitleBadge`, `TitleCollection`, `PrimaryTitleSelector`, `FullAvatar` | src/components/ |
| 10+ 컴포넌트 통합 아바타 교체 | — |
| 획득 알림 Toast·Modal | TitleAchievementToast/Modal |

### Sprint 6 — ADMIN 권한 체계

| 작업 | 파일 |
|------|------|
| Custom Claims 전환 (Phase A-1 이중 체크) | firestore.rules |
| `grantAdminRole` / `revokeAdminRole` CF | functions/adminGrant.js |
| `admin_actions` 컬렉션 + `logAdminAction` / `rollbackAdminAction` | functions/adminAudit.js |
| `AdminGuard`·`AdminApp` 라우터 | src/components/admin/ |
| 기존 관리자 CF (`sendToExile` 등)에 `admin_actions` 로그 삽입 | storehouse.js |

### Sprint 7 — ADMIN 확장 기능

| 작업 | 파일 |
|------|------|
| 수동 조정 CF 8종 (`adjustExp/Reputation/CreatorScore`, `awardTitle`/`revokeTitle`, `setAbuseFlag`, `setGrandfathered`, `batchAdjust`) | functions/adminAdjust.js |
| 콘텐츠 블라인드 CF 4종 + 필드 | functions/adminContent.js |
| `adminChangeNickname` | functions/adminNickname.js |
| 분포 대시보드, 이상치 검토 큐 UI | src/components/admin/ |
| 경계값 시뮬레이션·적용 CF+UI | functions/adminConfig.js, ThresholdSimulator.tsx |

### Sprint 8 — TUNING·Phase B 준비

| 작업 | 파일 |
|------|------|
| `daily_stats` + `collectDailyStats` CF (02:00) | functions/dailyStats.js |
| `snapshotGrandfatheredLevel` D-Day 배치 | functions/ |
| `detectFirstPrestigeAchiever` (Phase C 트리거) | functions/ |
| 공지 템플릿 3종 작성 (D-90, 경계값 조정, 전설 달성) | docs/announcements/ |

### Sprint 9+ (Phase C 이후)

- `sharePost` CF
- `detectDuplicateAccounts`
- `completeSignup` + phoneHash 블랙리스트
- Tier T1/T2/T3 회원가입 재설계
- Prestige 시각 CSS 구현
- 명예의 전당 페이지
- UID 마이그레이션 (friendList)

---

**문서 버전**: v1.0 (2026-04-21 초안)
**다음 단계**: 사용자 검토 → Sprint 0 우선순위 확정 → 실행
