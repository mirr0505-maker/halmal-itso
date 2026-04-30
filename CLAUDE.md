# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

할말있소(HALMAL-ITSO) — Firebase 기반 한국어 커뮤니티 플랫폼. 이 파일은 Claude Code가 작업할 때 반드시 따라야 하는 지침입니다.

**서비스 브랜드**: 글러브 GeuLove (도메인 `geulove.com`, 헤더 표기 `글러브 beta`). 프로젝트 공식명 `할말있소(HALMAL-ITSO)`는 시스템 계층(저장소·Firebase 프로젝트 ID)에 보존. 브랜드 전환 이력 및 치환 금지 식별자는 [BRANDING.md](./BRANDING.md) 참조.

---

## 빅 픽처 아키텍처

- **프론트**: React 19 + Vite 7 + TypeScript 5.9 + Tailwind v4 + Tiptap 3 에디터
- **백엔드**: Firebase (Firestore + Auth + Cloud Functions `asia-northeast3`) + Cloudflare Workers 2개(`halmal-link-preview`, `halmal-upload-worker`) + Cloudflare R2 오브젝트 스토리지
- **데이터 흐름**: 클라이언트 `onSnapshot` 실시간 구독 → `App.tsx` 전역 상태 → props drilling. 민감 필드(볼 잔액·플랫폼 수익·유배 sanction·에피소드 결제 등)는 Firestore Rules가 클라이언트 쓰기를 차단하므로 **반드시 Cloud Function callable 경유**.
- **이미지 업로드 경로**: 브라우저 → `halmal-upload-worker`(Firebase Auth ID Token 검증) → R2 바인딩 직접 저장. 클라이언트에 R2 API 키 없음.
- **주요 서브시스템**: 깐부방 / 장갑(커뮤니티) / 잉크병(연재) / 강변시장 / 거대나무 / 유배귀양지 — 각각 독립 설계서 있음(아래 참조).

---

## 프로젝트 핵심 파악

- **blueprint.md** — 설계 계약서 (아키텍처·규칙·가이드라인). 모든 작업 전 반드시 참조.
- **changelog.md** — 구현 완료 기능 이력 (blueprint.md 섹션 8 분리). 과거 구현 확인 시 참조.
- **GIANTTREE.md** — 거대 나무 상세 설계서 (blueprint.md 섹션 10 분리). 전파 시스템·잎사귀·시든 가지 등.
- **INKWELL.md** — 🖋️ 마르지 않는 잉크병 상세 설계서 (blueprint.md 섹션 11 분리). 연재 시스템·부분 유료화·구독·답글·안전 정책 등.
- **GLOVE.md** — 우리들의 장갑(커뮨니티) 상세 설계서.
- **KANBU.md** — 🏠 깐부방 상세 설계서. 깐부맺기 홍보 + 5탭 구조 + 유료 A/B + 🔴 라이브 + 수수료·정산·세무 + 홈 피드 격리 + 호스트 공백 처리.
- **MARKET.md** — 🏪 강변 시장 설계서. 가판대(단건 판매) + 단골장부(구독 상점) + 광고 수익 쉐어.
- **STOREHOUSE.md** — 🏚️ 놀부의 텅 빈 곳간(유배귀양지) 설계서. 4진 아웃 + 속죄금 + 깐부 리셋 + 사약 시스템.
- **LevelSystem.md** — 📈 레벨/EXP 구현 레퍼런스 (Sprint 2). LEVEL_TABLE·calculateExpForPost·옵션 B 동기화·Lv별 해금·수수료.
- **Reputation.md** — 🌟 평판 V2 구현 레퍼런스 (Sprint 3). V2-R 공식·티어 8단계·시간 감쇠·어뷰징 감점·캐시 파이프라인.
- **CreatorScore.md** — 🏅 크리에이터 점수 구현 레퍼런스 (Sprint 4). 공식·상수·파이프라인·Rules·연계 시스템.
- **FLAGGING.md** — 🚨 신고 시스템 설계서 (Phase A+B). 9 카테고리 × 3단계 state(review/preview_warning/hidden) 차등 threshold + 작성자 이의제기 + 관리자 조치·복구.
- **ADSMARKET.md** — ADSMARKET 광고 시스템 상세 설계서.
- **SHAREHOLDER_TIER.md** — 🛡️ 주주방 인증 체계 설계서. 등급(새우/상어/고래/대왕고래) + 방장 인증 패널 + 배지 전파.
- **SHAREHOLDER_BACKLOG.md** — 주주방 인증 미룬 작업 레지스트리 (Phase E~F Codef 연동, 증거 이미지 presigned URL 등).
- **GEMINI.md** — 범용 AI 개발 원칙 (코드 품질, Firebase 규칙 등).
- **src/types.ts** — TypeScript 인터페이스 전체. 새 타입 추가 시 여기에만 작성.

---

## 절대 수칙

0. **Human Readable 원칙 (대전제)**: 모든 코드는 훗날 휴먼이 혼자 읽고 이해하고 유지보수할 수 있어야 한다.
   - 변수명·함수명은 역할이 명확하게 드러나는 한국어 주석 또는 영어 명칭 사용.
   - 복잡한 로직에는 **왜(Why)** 이렇게 작성했는지 한 줄 주석 필수.
   - 마법 숫자(magic number), 약어, 축약 변수명 금지. 의미 없는 `a`, `b`, `tmp` 사용 금지.
   - 새 기능 추가 시 해당 블록 상단에 `// 🚀 기능명: 설명` 형식으로 목적 명시.

1. **코드 보호**: 요구사항과 무관한 기존 코드를 절대 수정하지 않는다. Tailwind 클래스, 마진, 패딩 1픽셀도 임의 변경 금지.
2. **선 보고 후 실행**: 코드 수정 전 AS-IS → TO-BE를 한국어로 설명하고 사용자 확인 후 실행.
3. **Surgical Edit**: 파일 전체 재작성 대신 필요한 부분만 Edit 도구로 정밀하게 수정.
4. **200라인 규칙**: 파일이 200라인 초과 시 기능별 분리 제안.

---

## 기술 규칙

### Firebase / Firestore
- Firestore 자동 생성 ID 금지 → `topic_timestamp_uid` / `comment_timestamp_uid` 형식 사용
  - **예외**: `notifications/{uid}/items`, `sentBalls/{uid}/items`, `giant_trees/{id}/leaves` — 보조 데이터는 `addDoc` 자동 ID 허용
- 실시간 리스너: `onSnapshot` (App.tsx 또는 개별 컴포넌트에서 관리)
- 컬렉션: `posts`, `comments`, `users`, `kanbu_rooms`, `notifications`, `sentBalls`, `communities`, `community_posts`, `community_memberships`, `community_post_comments`, `giant_trees`, `marathon_dedup`, `series`, `unlocked_episodes`, `series_subscriptions`, `platform_revenue`, `glove_bot_payments`, `glove_bot_dedup`, `dart_corp_map`, `market_items`, `market_purchases`, `market_shops`, `market_subscriptions`, `market_ad_revenues`, `bail_history`, `release_history`, `banned_phones`, `sanction_log`, `exile_posts`, `exile_comments`, `kanbu_paid_subs`, `ball_transactions`, `ball_balance_snapshots`, `audit_anomalies`, `user_snapshots`(Sprint 3 일일 평판 스냅샷), `activity_logs`(Sprint 4 Creator Score 30일 윈도우, TTL expiresAt), `admin_actions`(🛡️ Sprint 6 관리자 행위 감사 로그, Admin SDK 전용 write), `ads`/`adEvents`/`advertiserAccounts`(ADSMARKET 광고 시스템), `ad_stats_daily`(📊 ADSMARKET v2 광고주 통계 일별 집계 — 2026-04-26)
- **Firestore Security Rules 차단 필드**: `ballBalance`, `thanksballTotal`(Phase B — CF Admin SDK 전용), `promoEnabled`, `promoExpireAt`, `promoPlan`, `promoUpdatedAt`, `reputationCached`, `reputationTierCached`, `reputationUpdatedAt`(Sprint 3 REPUTATION V2 캐시), `creatorScoreCached`, `creatorScoreTier`, `creatorScoreUpdatedAt`, `recent30d_posts`, `recent30d_comments`, `recent30d_likesSent`, `recent30dUpdatedAt`, `reportsUniqueReporters`, `reportsUpdatedAt`, `likesSent`, `exileHistory`(Sprint 4 Creator Score 10필드), `creatorScoreOverride`(Sprint 4 Phase C — `adminAdjustCreatorScore` CF 전용), `ads.{pausedReason, todaySpent, lastSpentResetAt, viewableImpressions, totalSpent, totalImpressions, totalClicks}`(📊 ADSMARKET v2 — 광고주 본인이라도 직접 수정 불가, `adAuction`/`budgetEnforcer` 전용, 2026-04-26) — 클라이언트 직접 수정 불가, 반드시 Cloud Function 경유
- **Rules read/write 전면 차단 컬렉션**: `platform_revenue`, `glove_bot_payments`(대장 본인 read만 허용), `glove_bot_dedup`, `banned_phones`, `sanction_log`(관리자만 read), `bail_history`/`release_history`(본인만 read), `ball_transactions`(땡스볼 멱등키·원장 — read/write 전면 차단), `ball_balance_snapshots`(일일 잔액 스냅샷), `audit_anomalies`(관리자만 read), `sentBalls/*`(읽기는 본인만, write false), `reports`(🚨 신고 원장 — read=isAdmin 2026-04-24, write=false — submit/resolve/reject/restore CF 전용), `reporter_daily_quota`(🚨 신고자 일일 10건 상한 추적 — submitReport CF 전용, 2026-04-24), `admin_actions`(🛡️ Sprint 6 — read=isAdmin, write=false, Admin SDK 전용), `kanbu_promo_history`(📜 깐부 홍보 결제 영수증 — registerKanbuPromo CF 전용, ballAudit 크로스체크 권위, 2026-04-23), `adEvents`(📊 ADSMARKET 노출/가시/클릭 이벤트 — auction.js CF 전용 write), `ad_stats_daily`(📊 ADSMARKET v2 일별 통계 — aggregateAdStats CF 전용, 2026-04-26) — Admin SDK / Cloud Function 전용
- **🏚️ sanction 필드**: `sanctionStatus`, `strikeCount`, `requiredBail`, `sanctionExpiresAt`, `phoneVerified`, `phoneHash` — 클라이언트 직접 수정 불가, 반드시 Cloud Function(`sendToExile`/`releaseFromExile`) 경유
- **🚪 Creator Gates (Sprint 4 Phase C Task 4, 2026-04-22)**: `kanbu_rooms` create는 Lv6+ · `creatorScoreCached >= 0.5`, `live_sessions` create는 Lv6+ · `creatorScoreCached >= 2.0` (Firestore Rules `get()` 검증). 잉크병 유료 회차는 CF `createEpisode`에서 `assertPassesGate(inkwellPaid)` (Score ≥ 1.0). 상수 소스: `src/constants.ts CREATOR_GATES` ↔ `functions/utils/gateCheck.js`. 잠정 수치 — 배포 1주 후 튜닝 예정 (`project_creator_gates_tuning.md`)

### Cloud Functions (서울 리전, `functions/` 디렉토리)
- `index.js` — 진입점 (fetchMarathonNews + 분리 모듈 re-export)
- `thanksball.js` — `sendThanksball`: 땡스볼 전송 (잔액 차감·수신자 누적·알림). posts.author_id 우선 조회로 수신자 UID 확보. 수신자 `ballReceived`(평판 누적) + `ballBalance`(실사용 잔액) **동시 증가** — 받은 땡스볼은 되쓰기/유배 속죄금으로 사용 가능. 🔒 단일 트랜잭션 멱등 처리: `ball_transactions/{clientRequestId}` 마커로 재시도 이중 차감 차단. `MAX_AMOUNT_PER_TX=10000` 1회 상한, 정수·자기송금 검증(트랜잭션 내부 재확인). 원장 필드: schemaVersion/balanceBefore/balanceAfter/receiverBalanceBefore/receiverBalanceAfter/platformFee/sourceType/chatRef.
- `ballSnapshot.js` — `snapshotBallBalance`: 매일 04:00 KST 모든 유저의 ballBalance/ballReceived/ballSpent를 `ball_balance_snapshots/{yyyyMMdd}_{uid}`에 저장 (400건 배치).
- `ballAudit.js` — `auditBallBalance`: 매일 04:30 KST 전일·금일 스냅샷 + 24h `ball_transactions` 집계로 `expected = yesterday - outflow + inflow` 교차 검증. `diff < 0`이면 `audit_anomalies/{yyyyMMdd}_{uid}`에 critical 기록. 3-bis 단계에서 `kanbu_promo_history` 24h 조회해 `outflow`에 합산 — `ball_transactions` 원장 미보유 경로 false critical 차단(2026-04-23). 잔여 7경로(잉크병/마켓/유배 등)는 Sprint 9 볼 원장 통일에서 일괄 정리 예정.
- `snapshotUserDaily.js` — `snapshotUserDaily`: 매일 03:30 KST 전체 유저 스냅샷 → `user_snapshots/{yyyyMMdd}_{uid}` 기록 (likes/totalShares/ballReceived/reputation 고정값 보존). Sprint 3 REPUTATION V2.
- `reputationCache.js` — `reputationCache`: 매일 04:45 KST → users 문서에 `reputationCached/reputationTierCached/reputationUpdatedAt` 갱신 (기존값 동일 시 skip, 400건 배치). `utils/reputationV2.js` 수식 사용. Sprint 3 REPUTATION V2.
- `activityLogger.js` — `logActivity(uid, type, refId)` 공용 헬퍼: `activity_logs/{autoId}`에 `expiresAt=+30d` 포함 기록. `isEligibleContent()` (HTML strip + 10자 이상). Sprint 4 Creator Score.
- `onActivityTriggers.js` — 4종 Firestore 트리거: `onPostCreatedForActivity` / `onCommentCreatedForActivity` (onCreate, logActivity + users.lastActiveAt), `onPostLikeChangedForActivity` / `onCommentLikeChangedForActivity` (onUpdate, likedBy 증가분을 nickname_{X} 색인으로 UID 역조회 → logActivity + users.likesSent increment). Sprint 4 Creator Score.
- `creatorScoreCache.js` — `creatorScoreCache`: 매일 05:00 KST (reputationCache 04:45 뒤 15분 지연) → `activity_logs` 30일 윈도우 집계 → 전체 유저 순회 → users 갱신 (5필드 + tier). 400건 배치, timeoutSeconds 540, memory 1GiB. Sprint 4 Creator Score.
- `creatorScoreEvents.js` — `onUserChangedForCreatorScore`: users/{uid} onUpdate. `sanctionStatus/exileHistory/reputationCached/abuseFlags/creatorScoreOverride` 변경 시 즉시 재계산. 무한 루프 2중 가드 (creatorScoreFields만 변경 시 skip + 결과값 동일 시 skip). Sprint 4 Creator Score + Phase C override.
- `adminAdjust.js` — `adminAdjustCreatorScore`(override 설정/해제: users.creatorScoreOverride { value, reason, setBy, setAt, expiresAt? }). `adminToggleAbuseFlag`(users.abuseFlags.{flag} 토글, 4종: shortPostSpam/circularThanksball/multiAccount/massFollowUnfollow). 🛡️ Sprint 6 A-1 전환 — `assertAdmin` 사용 + `logAdminAction`으로 admin_actions 기록 (audit_anomalies에서 이관).
- `utils/adminAuth.js` — 🛡️ Sprint 6 A-3 (2026-04-25 완료): Custom Claims 단일 체크. `assertAdmin(auth)` → `{adminUid, adminName, viaClaims=true}`. `request.auth.token.admin === true`만 통과. 닉네임 fallback 제거됨 (`ADMIN_NICKNAMES = []`, `isAdminByUid` 항상 false). 락아웃 복구 경로: Firebase Console → Auth → 해당 uid → 맞춤 클레임 `{"admin":true}` 수동 주입.
- `adminAudit.js` — 🛡️ Sprint 6 A-1: 관리자 행위 감사 로그. `logAdminAction({action, adminUid, adminName, viaClaims, targetUid, payload, reason})` 공용 헬퍼 → `admin_actions/{yyyyMMdd}_{adminUid}_{ts}_{rand}` 기록. `rollbackAdminAction` CF(화이트리스트 4종: grant/revoke_admin_role, toggle_abuse_flag, adjust_creator_score). 롤백 자체도 admin_actions 기록(action: `rollback_admin_action`). audit_anomalies(이상 징후 전용)와 분리.
- `adminGrant.js` — 🛡️ Sprint 6 A-1: `grantAdminRole`/`revokeAdminRole`. Custom Claims { admin: true } 부여/제거 (`setCustomUserClaims`). 사유 2자 이상 필수. 자기 자신 회수 차단(`targetUid === adminUid` HttpsError) — 락아웃 방지. 클라이언트는 부여 후 `auth.currentUser.getIdToken(true)` 필요(SystemPanel에 "내 토큰 갱신" 버튼).
- `syncUserLevel.js` — `syncUserLevel`: 매일 06:00 KST → 전체 유저 순회 → `calculateLevel(exp)` vs `user.level` 불일치 시 보정. 400건 배치, timeoutSeconds 540. Why: 타인 EXP 지급 경로(좋아요 마일스톤)는 `exp: increment()`만 날려 level 갱신 못 함 — 옵션 B 원칙 2 교정. Phase C Gate 함수(Lv5+ 권위 읽기) 선행 blocker 해제.
- `reportSubmit.js` — `submitReport`: 🚨 사용자 신고 제출 (onCall). 9 카테고리(`reasonKey`: spam_flooding/severe_abuse/life_threat/discrimination/unethical/anti_state/obscene/illegal_fraud_ad/other). `reports/{targetType_targetId_reporterUid}` 멱등 생성. 자기 신고 차단. **3단계 차등 threshold** (FLAGGING.md §2) — 카테고리별 `review`/`preview_warning`/`hidden` 임계치 다름. 지배적 reasonKey(최빈)로 state 승격. 일일 상한 10건(`reporter_daily_quota`). 상태 승격 시 작성자 `notifications` 자동 발송.
- `reportAggregator.js` — `reportAggregator`: 매일 05:15 KST → `reports` 전체 순회 → targetUid별 고유 reporterUid Set 집계 → `users.{uid}.reportsUniqueReporters` + `reportsUpdatedAt` 갱신 (400건 배치). Why: 담합 신고(동일 신고자 다수)는 고유 수로 집계되지 않아 자연 방어. `creatorScoreCache`(05:00) 뒤 15분 실행 — 반영은 다음날 배치에서.
- `reportResolve.js` — 🚨 관리자 신고 조치 3종: `resolveReport`(action: hide_content/delete_content/warn_user/none + 사유 + notifyParticipants — 같은 targetId pending 신고 일괄 resolved) / `rejectReport`(기각 + reporter `reportsSubmittedRejected` 증가) / `restoreHiddenPost`(자동 숨김 복구 + appealStatus=resolved + 작성자 `appeal_accepted` 또는 `report_restored` 알림). 모두 `assertAdmin` + `logAdminAction`. 2026-04-24.
- `reportAppeal.js` — `submitContentAppeal`: 🚨 작성자 이의제기 제출 (onCall). 작성자 본인 + 신고 상태 + 중복 방지 검증 + 5~500자 사유 → target 문서에 `appealStatus='pending'` + `appealNote` + `appealAt`. 관리자 ReportManagement UI의 **⚡ 이의제기 우선큐**에 실시간 노출. 2026-04-24.
- `backfillReferralCodes.js` — `backfillReferralCodes`: 🎁 Sprint 7 백필 (2026-04-24 신설). onCreate 트리거 이전 가입자 전원에게 6자리 referralCode 일괄 발급. assertAdmin + admin_actions 로깅. 멱등 — 이미 있는 유저 skip. SystemPanel 🔧 시스템 탭 버튼.
- `utils/creatorScore.js` `calculateTrustScore` — 🚨 Phase C REPORT_PENALTIES 활성화 (2026-04-22). `reportsUniqueReporters` 기준 threshold 내림차순 (20→10→5) 중 첫 매치만 감산(0.15/0.10/0.05). 잠정 수치 — `project_report_penalties_tuning.md`. 클라 `src/constants.ts TRUST_CONFIG.REPORT_PENALTIES`와 동기화.
- `utils/reputationV2.js` — 서버 전용 평판 V2 공식 (클라 `utils.ts getReputationScoreV2`와 수식 동기화)
- `utils/creatorScore.js` — 서버 Creator Score 수식 포트 (`calculateCreatorScore`, `calculateActivityScore`, `calculateTrustScore`, `calculateRecent30dTotal`, `getMapaeTier`, `resolveScore`(override 우선 적용 헬퍼)). 클라이언트 `src/constants.ts` `CREATOR_SCORE_CONFIG`/`ACTIVITY_WEIGHTS`/`LEVEL_MEDIAN_ACTIVITY`/`TRUST_CONFIG`와 상수 동기화
- `utils/levelSync.js` — 옵션 B 레벨 동기화 헬퍼 (EXP 변경 시 `level: calculateLevel(newExp)` 동시 쓰기)
- `utils/gateCheck.js` — 🚪 Creator Gate 서버 assert (`assertPassesGate`, `CREATOR_GATES`). 4종 Gate: 출금/라이브/잉크병유료/깐부방개설. Lv × Creator Score 동시 충족. Sprint 4 Phase C Task 4. 클라이언트 `src/constants.ts` `CREATOR_GATES`와 상수 동기화. 잠정 수치 — 배포 1주 후 분포 실측 튜닝 예정 (`project_creator_gates_tuning.md`)
- `inkwell.js createEpisode` — `willBePaid=true` 시 `assertPassesGate(authorData, 'inkwellPaid')` 최종 차단 (Lv 무관 · Score ≥ 1.0)
- `testCharge.js` — `testChargeBall`: 테스트용 볼 충전
- `kanbuPromo.js` — `registerKanbuPromo`: 깐부 홍보 카드 등록 (Lv2+, 기간제). 차감 트랜잭션 내부에 `kanbu_promo_history/{uid}_{ts}` 영수증 동시 기록(`uid/cost/plan/days/paidAt`) — ballAudit 크로스체크용(2026-04-23).
- `kanbuPaid.js` — `joinPaidKanbuRoom`: 깐부방 유료 게시판 결제(1회/구독, 수수료 Lv별 20~30%, pendingRevenue 누적). `checkKanbuSubscriptionExpiry`: 매일 09:00 월 구독 만료 처리
- `auction.js` / `revenue.js` / `fraud.js` / `settlement.js` — ADSMARKET 광고 시스템
- `auction.js` v2.1 (2026-04-26): eventType 분기 — `impression`(매칭+카운트), `directMatch impression`(selectedAdId 광고 카운트만), `viewable`(IAB 50%·1초+ → CPM 차감), `click`(CPC 차감). 매칭 단계에 빈도 캡(viewerUid+adId 24h N회) + 일/총 예산 가드 + Brand Safety(blockedCategories) 적용. 카운터는 단일 진실원(트리거 중복 증가 제거).
- `budgetEnforcer.js` (신설 v2) — `enforceBudgetLimits`(매시간) 일/총 예산 도달 시 자동 일시정지(pausedReason='budget_daily'/'budget_total') + 알림. `releaseDailyBudgetPause`(매일 04:00 KST) 일예산 정지 ad 재개 + todaySpent=0 리셋
- `aggregateAdStats.js` (신설 v2) — 매일 04:30 KST 전일 adEvents 광고별 집계 → `ad_stats_daily/{adId}_{yyyymmdd}` 작성 (impressions/viewableImpressions/clicks/spent/uniqueViewers + bySlot/byMenu/byRegion/byHour 분해)
- `estimateAdReach.js` (신설 v2) — `estimateAdReach` callable: 7일 ad_stats_daily 평균 + 단가 가중으로 일 예상 노출 추정. AdCampaignForm 슬라이더 실시간 표시
- `reviewNotify.js` (신설 v2.1) — `onAdPendingReview`(ads.status='pending_review' 진입 시) + `onAdvertiserPendingReview`(advertiserAccounts.status='pending_review' 진입 시): Auth Admin SDK listUsers로 admin Custom Claims 보유자 자동 조회 → notifications/{adminUid}/items에 알림 발송
- `adTriggers.js` v2.1 (2026-04-26): `updateAdMetrics` — 카운터 증가 코드 제거(이중 합산 방지). ctr 재계산(0~1 clamp) + adBids 동기화 + 예산 소진 처리만 담당
- `contentLength.js` — `validateContentLength`: 신포도와 여우 100자 제한
- `inkwell.js` — `unlockEpisode`(유료 회차 결제, 수수료 11%), `createEpisode`(서버측 episodeNumber), `onEpisodeCreate`(구독자 알림), `onInkwellPostDelete`(고아 알림+영수증 cleanup)
- `gloveBot.js` — `activateInfoBot`/`deactivateInfoBot`/`updateInfoBot`: 정보봇 활성화·중지·수정 (주식 장갑 전용, 대장 월 20볼)
- `gloveBotFetcher.js` — `fetchBotNews`(Google News RSS), `fetchBotDart`(DART 공시): 매 1시간 스케줄 (2026-04-23 베타 완화 — 정식 서비스 시 30분 복원 예정, `memory/project_info_bot_schedule.md`)
- `dartCorpMap.js` — `syncDartCorpMap`(월 1회)/`triggerSyncDartCorpMap`(수동): DART 종목코드→고유번호 매핑. `lookupCorpCode`: 조회
- `adTriggers.js` — `syncAdBids`/`updateAdMetrics`: ADSMARKET 광고 트리거
- `market.js` — `purchaseMarketItem`(가판대 구매, 레벨별 수수료 30/25/20%), `subscribeMarketShop`(단골장부 구독), `checkSubscriptionExpiry`(매일 09:00 만료 체크+알림+차감)
- `storehouse.js` — `sendToExile`(관리자 전용, strikeCount +1 + 단계 자동 판정, 4차 자동 사약 + postId 지정 시 글 숨김), `releaseFromExile`(본인, 속죄금 차감/소각 + 깐부 리셋), `executeSayak`(직권 사약, 자산 몰수 + 모든 글 숨김 + banned_phones), `checkAutoSayak`(매일 04:00 스케줄, 90일 미납 자동 사약). 🛡️ Sprint 6 A-1 전환 — 관리자 CF는 `assertAdmin` + `logAdminAction`(action: `send_to_exile`/`execute_sayak`/`execute_sayak_via_exile`/`execute_sayak_auto`). 스케줄 경로는 adminUid=`"AUTO"`.
- `nickname.js` — `changeNickname`(평생 1회·100볼·연쇄 비정규화 갱신), `seedReservedNicknames`(예약어 9종 주입, 🛡️ Sprint 6 A-1 `assertAdmin` + `logAdminAction`).
- 배포: `firebase deploy --only functions`

### Cloudflare R2 이미지 업로드
- **Worker 프록시 방식**: 클라이언트 → `halmal-upload-worker` (Firebase Auth ID Token 인증) → R2 바인딩 직접 저장
- 클라이언트 함수: `src/uploadToR2.ts` — `uploadToR2(file, filePath)` 
- 메타데이터에 한국어(비ASCII) 금지
- 업로드 경로: `uploads/{userId}/{filename}`, `avatars/{nickname}_{timestamp}`
- 공개 URL 베이스: `https://pub-9e6af273cd034aa6b7857343d0745224.r2.dev`
- **클라이언트에 R2 API 키 없음** — Worker가 R2 바인딩으로 직접 접근

### Cloudflare Workers
- **halmal-link-preview** (링크 미리보기): `workers/src/index.ts` | 배포: `cd workers && npx wrangler deploy`
- **halmal-upload-worker** (R2 업로드 프록시): `upload-worker/src/index.ts` | 배포: `cd upload-worker && npx wrangler deploy`
- CORS 허용: `geulove.com` + `halmal-itso.web.app` + `localhost:5173/4173` (2개 Worker 코드 내 `allowedOrigins` 배열 동기화 필수)
- **Workers 코드 수정 시**: Firebase deploy와 별개로 각 디렉토리에서 `npx wrangler deploy` 별도 실행 필요

### HTML 렌더링
- 에디터 출력은 `dangerouslySetInnerHTML={{ __html: post.content }}` 사용
- `@tailwindcss/typography` 미설치 → `prose` 클래스 무효. Tailwind arbitrary selector 사용 (`[&_p]:mb-4` 등)
- 목록 뷰에서 이미지는 `[&_img]:hidden` (line-clamp 적용)

### 레벨·평판 시스템
- **레벨(EXP)** = 성실도. DB에 `exp`(누적) + `level`(동기화) 두 필드. EXP 변경 시 `level: calculateLevel(newExp)` 동시 쓰기 (옵션 B, [LevelSystem.md §2.2](./LevelSystem.md) 확정).
- 프론트 표시 시에도 `calculateLevel(exp)` 헬퍼로 실시간 재계산 가능 (`utils.ts`) — DB 값과 일치 보증.
- **평판(Reputation)** = 신뢰도 5단계. `(likes×2) + (totalShares×3) + (ballReceived×5)`. 중립(0~299)→약간 우호(300)→우호(1000)→매우 우호(2000)→확고(3000).
- EXP 지급 조건: 본문 10자 이상 (`isEligibleForExp()`). Rate Limit: 글 60초, 댓글 15초 쿨다운.
- 삭제 시 EXP 차감: 글 -2, 댓글 -2. 깐부 해제 -2 (대칭 delta, 루프 어뷰징 차단 — [functions/toggleKanbu.js:47](functions/toggleKanbu.js#L47)).
- **공개 프로필**: 아바타 클릭 → `PublicProfile` (7영역). 사이드바 내정보 → `MyPage` (관리).

### TypeScript
- 빌드 에러 0 유지 (`npm run build` 확인)
- 미사용 변수 `_` 접두사 또는 즉시 제거

---

## 컴포넌트별 주의사항

| 파일 | 주의 |
|------|------|
| `App.tsx` | 전역 상태·리스너 중심. props drilling이 많으므로 함부로 리팩터링 금지. 헤더 `+ 새 글` 버튼은 `activeMenu === 'exile_place' && !isExiled`일 때 `setActiveMenu('home')` 선행(비유배자가 유배글 폼 진입 방지). |
| `TiptapEditor.tsx` | 스티키 툴바 + 버블 메뉴 로직 손대지 않기. 커서 위치 유지 로직 보호. |
| `CreatePostBox.tsx` | 카테고리 목록에서 "한컷" 제외 유지. |
| `DiscussionView.tsx` | `CATEGORY_RULES` 객체 — 카테고리별 댓글 규칙 정의. 임의 변경 금지. 🏚️ 유배·귀양지는 `boardType: 'pandora'` (좌/우 지그재그 + 각 컬럼 하단 인라인 입력) + `hideAttachment: true`. |
| `OneCutDetailView.tsx` | 2컬럼 레이아웃(8:4 그리드) 유지. tree 문서 실시간 구독(`onSnapshot`). |
| `DebateBoard.tsx` | 너와 나의 이야기 댓글 IME 처리 — InlineForm 컴포넌트 금지, 인라인 JSX 유지. `isComposing` 체크 보호. |
| `RootPostCard.tsx` | 하단 통계 바 3컬럼 구조(댓글\|땡스볼\|동의) 유지. `onBack` prop 체인 보호. 🏚️ `post.category === '유배·귀양지'`일 때 우상단 공유 버튼 숨김(STOREHOUSE §3 Sandbox Policy). |
| `ThanksballModal.tsx` | `sendThanksball` Cloud Function(`functions/thanksball.js`)으로 서버 처리. ballBalance 직접 수정 금지(Rules 차단). 서버에서 잔액 차감·수신자 누적·sentBalls·notifications·thanksballTotal 5곳 동시 처리. |
| `OneCutList.tsx` | 카드 하단은 AnyTalkList 일반 글카드와 완전 동일 구조 유지(아바타w-6+프로필클릭+공유버튼). 원본글 영역 `min-h-[22px]` 높이 확보 필수(카드 세로 통일). 🍞 썸네일은 `imageUrls[0] ?? imageUrl`, 좌상단 `🍞 1/N` 배지(회색). |
| `CreateOneCutBox.tsx` | 🍞 헨젤의 빵부스러기 — 1~4슬롯 업로드 + 캐러셀 미리보기. `imageUrls` 배열 state, 저장 시 `imageUrl = imageUrls[0]` 동시 저장(하위호환). DB 카테고리 `한컷` + `isOneCut: true` 유지. |
| `OneCutDetailView.tsx` | 1컷: 단일 이미지(기존), 2~4컷: 캐러셀(←/→ 화살표·인디케이터·키보드·스와이프). 마지막 컷 CTA "🔗 숨겨진 자세한 이야기 보러가기" — `linkedPostId` 우선, 없으면 `linkUrl` 새 탭. |
| `NotificationBell.tsx` | `notifications/{uid}/items` 실시간 구독. `writeBatch`로 일괄 읽음 처리. 타입: `thanksball·community_post·finger_promoted·giant_tree_spread·giant_tree_wilt`. `isUnread()` 헬퍼로 `read`/`isRead` 두 필드 통합 판단. |
| `EditorToolbar.tsx` | 링크 삽입 후 Workers 호출 → `LinkPreviewCard` 표시. `fetchPreview` 내부 상태 보호. |
| `LinkPreviewCard.tsx` | OgData 타입 export — EditorToolbar에서 import해 사용. |
| `MyContentTabs.tsx` | 나의 기록·한컷 리스트. 상태 배지(새글/미등록/등록글/인기글/최고글) + 재등록 버튼(1회 한정). `canRepost()` / `getPostStatus()` 로직 보호. |
| `CommunityView.tsx` | 소곤소곤·채팅·멤버·관리 4탭. 인증 부여/해제, 낙관적 업데이트 전체 적용. 비가입자 접근 제한(승인제 차단/open 읽기전용). `selectedCommunity`는 `communities.find()`로 최신값 참조. |
| `CommunityPostDetail.tsx` | 별도 파일(CommunityView에서 추출). 자체 onSnapshot(글+댓글). 댓글: 좋아요/땡스볼/수정/삭제/고정. 작성자 카드 RootPostCard 패턴. CommunityFeed에서도 재사용. 상세글 우상단+댓글 우측 ⋮ 메뉴(공개프로필/신고하기). |
| `CommunityChatPanel.tsx` | 실시간 채팅 (onSnapshot limit 50 + 페이징 30). 답장/이모지 6종/이미지+문서 첨부/땡스볼/soft delete. 50명 한도 가드. 읽지 않은 메시지 카운트(chatLastReadAt). `chatBgUrl` 있으면 배경 이미지 + linear-gradient 75% 흰색 오버레이. 컨테이너 높이 `h-[calc(100vh-380px)] min-h-[420px] max-h-[720px]` (뷰포트 동적, 이중 스크롤 방지). 배경은 `backgroundAttachment` 미지정(기본값) — 메시지 스크롤 누적 시 배경 이미지 세로 늘어남 방지. 2026-04-23 정돈. |
| `CommunityFeed.tsx` | 소곤소곤 피드. 글 클릭 → CommunityPostDetail 모달 직접 오픈 + 멤버 lazy load. 피드 카드 하단 땡스볼 버튼(ThanksballModal). 🤖 봇 게시글 뱃지 표시. |
| `CreateCommunityModal.tsx` | 승인제(approval) 선택 시 가입 폼 빌더 표시. `joinForm` state + 표준 필드 토글 + 커스텀 질문 5개 슬롯 제한. 대표 이미지(`thumbnailUrl`) + 채팅 바탕화면(`chatBgUrl`) R2 업로드 옵션. 주식 카테고리 정보봇 안내. 닉네임 배지(`displayBadgeKey`) 라디오 선택. |
| `CommunityAdminPanel.tsx` | 관리 탭 (설정수정/대표이미지/채팅배경/닉네임배지/승급조건/정보봇/폐쇄). 정보봇 UI는 `category='주식'` + 대장(thumb) 전용. DART 매핑 동기화 버튼. 이미지/버튼 `w-2/3 mx-auto` 중앙 정렬. 🛡️ 주주 인증은 독립 탭으로 분리됨(CommunityView 'verify' 탭). |
| `VerifyShareholderPanel.tsx` | 🛡️ 방장 주주 인증 관리. 종목 설정(1회 잠금) + TierSelector(4등급 라디오) + 인증 대기(스크린샷/마이데이터 구분) + 인증 완료(등급 변경/해제/스크린샷 30일 열람). 개별/일괄 인증 요청 발송. SecureImage 프록시 사용. |
| `ShareholderVerifyScreen.tsx` | 🛡️ 멤버 주주 인증 등록. 2탭(📸 스크린샷 / 📊 마이데이터) + 차분한 slate 톤. 마이데이터 3단계(조회→결과→제출). 등급 기준표 양쪽 탭 노출. 스크린샷 30일 삭제 안내. |
| `SecureImage.tsx` | 🔒 R2 프록시 이미지 로더. 직접 URL 대신 Worker `/api/screenshot`으로 Firebase Auth 인증 후 Blob URL 로드. 주주 인증 스크린샷 열람에 사용. |
| `MyCommunityList.tsx` | 나의 장갑 목록. `compact=true`: 사이드바 소형(컬러도트/썸네일). `compact=false`: 메인 탭 카드 그리드. |
| `JoinCommunityModal.tsx` | joinForm 있으면 폼 빌더 모드, 없으면 레거시 모드. `validateJoinAnswers`로 필수 항목 검증. |
| `InkwellHomeView.tsx` | 🖋️ 잉크병 사이드 메뉴 진입 화면. glove 패턴 sticky 헤더 + 2탭 (📖 회차 / 📚 작품). `activeTab`은 부모(App.tsx `inkwellTab`)에서 관리 — SeriesDetail 진입 후 복귀 시 탭 유지. |
| `SeriesDetail.tsx` | 🖋️ 작품 상세 (표지·시놉시스·구독·목차·작가 통계). 작가 본인만 `[✏️ 작품 수정][🗑️ 작품 삭제]` + 작가 통계 박스(차분 슬레이트). 회차가 있으면 삭제 불가 → 비공개 전환(`status: 'deleted'`)으로 폴백. 목차는 `visibleEpisodes`로 `isHidden` 필터 (작가는 모두 표시). |
| `EpisodeReader.tsx` | 🖋️ 회차 본문 뷰어. 상단 `← 되돌아가기` + 우상단 `[📤 공유][⋮ 더보기]`. 점세개: 누구나 `공개프로필/신고(disabled)` + 작가 본인 `수정/다시공개/삭제`. 공유는 `sharePost()` 헬퍼(Web Share API+클립보드). PaywallOverlay는 미구매자 전용. 하단 `이전/목차/다음` — 목차 버튼은 `onGoToSeries`로 SeriesDetail 직접 이동(onBack과 구분). 본문 typography `text-[15px] leading-[1.8]` (RootPostCard 동일). |
| `EpisodeCommentBoard.tsx` | 🖋️ 회차 댓글 + 1단계 답글 (`parentCommentId`, depth 1). Soft delete(`isDeleted: true`) + placeholder. 작가 본인 댓글 뱃지 강조. 기존 useFirestoreActions.handleLike 패턴 차용(닉네임 likedBy, 평판 ±3, EXP milestone). |
| `EpisodeCommentForm.tsx` | 🖋️ 회차 댓글/답글 작성 폼 (`parentCommentId` prop으로 답글 모드). 기존 handleInlineReply 필드 구조 그대로. |
| `PaywallOverlay.tsx` | 🖋️ 유료 회차 미구매자 전용 페이월 (previewContent 미리보기 + 그라데이션 페이드 + 결제 박스). `sharePost` 무관, `sendThanksball` 아닌 `unlockEpisode` Cloud Function 호출. |
| `CreateSeries.tsx` / `EditSeries.tsx` | 🖋️ 작품 개설/수정. 수정 시 title/genre는 disabled (브랜드 일관성). 표지 교체 선택적 — 변경 안 하면 기존 URL 유지 (불필요한 R2 업로드 방지). |
| `CreateEpisode.tsx` / `EditEpisode.tsx` | 🖋️ 회차 작성/수정. 수정 시 episodeNumber/isPaid/price 수정 불가 (결제 형평성). 유료는 posts.content 빈 문자열 + private_data/content 서브문서 분리 저장 + previewContent 평문 200자. |
| `SubscribeButton.tsx` | 🖋️ 작품 구독 토글 + 구독자 수 표시. `series_subscriptions/{seriesId}_{uid}` 단일 문서 onSnapshot. 작가 본인은 비활성. `subscriberCount`는 Rules 카운터 화이트리스트 포함. |
| `SeriesGrid.tsx` / `SeriesCard.tsx` / `EpisodeListItem.tsx` | 🖋️ 작품 카탈로그 / 작품 카드 / 회차 목록 1줄. 차분 톤 통일. |
| `InkwellSummaryCards.tsx` | 🖋️ 작가 KPI 요약 카드 (마이페이지 나의 연재작 탭 상단). |
| `MarketHomeView.tsx` | 🏪 강변 시장 메인. 가판대/단골장부 2탭 + 카테고리 필터. sticky 헤더(잉크병/장갑 패턴). 탭별 버튼 분기(판매글 작성 Lv3+ / 상점 개설 Lv5+). |
| `MarketItemEditor.tsx` | 🏪 가판대 판매글 작성. 제목/티저/본문(Tiptap)/가격(1~100)/카테고리/태그/표지. 본문은 `private_data/content` 분리 저장. |
| `MarketItemDetail.tsx` | 🏪 가판대 상세뷰. 미구매: 티저+페이월. 구매: 전체 본문+별점+한줄평 리뷰. `purchaseMarketItem` callable. |
| `MarketShopEditor.tsx` | 🏪 단골장부 상점 개설. 이름/소개/가격(10~200)/표지. Lv5+만. |
| `MarketShopDetail.tsx` | 🏪 단골장부 상세. 구독 버튼 + 크리에이터 판매글 목록. `subscribeMarketShop` callable. |
| `MarketDashboard.tsx` | 🏪 크리에이터 대시보드. 수익 현황(판매/광고/총판매) + 판매글 관리(숨김/복귀) + 단골장부 구독자. |
| `KanbuRoomView.tsx` | 깐부방 상세 5탭(📋 자유 게시판 / 🔒 유료×2 / 💬 채팅 / 👥 멤버 / ⚙️ 관리). 유료 게시판 페이월 + 결제(`joinPaidKanbuRoom`). 관리: 유료 A/B 타입 설정 + 멤버 강퇴 + 방 수정/삭제. |
| `KanbuRoomList.tsx` | 깐부방 찾기 카드 그리드. 깐부 관계인 방만 [가입], 비깐부 🔒 표시. memberIds + memberCount 관리. |
| `MyKanbuRoomList.tsx` | 나의 깐부방 목록. `compact=true`: 사이드바 소형(컬러도트), `compact=false`: 메인 카드 그리드. |
| `ExileMainPage.tsx` | 🏚️ 유배자 메인. 3탭(놀부곳간/무인도/절해고도, 내 단계만 활성, 관전자는 3탭 모두 열람) + 상태카드 + 반성기간 카운트다운 + 속죄금 결제(`releaseFromExile`). 헤더 서브타이틀 간결화, 관전자 안내 배너 제거(2026-04-14). |
| `ExileBoard.tsx` | 🏚️ 유배지 게시판. 본인 단계만 글 작성 가능, 닉네임 자동 익명화(`곳간 거주자 #NNNN`), 외부 공유 금지. |
| `utils.ts — anonymizeExileNickname` | 🏚️ uid FNV-1a 해시 → `곳간 거주자 #NNNN` 결정적 변환. `useFirestoreActions`의 `handlePostSubmit`/`handleInlineReply`/`handleCommentSubmit`에서 유배글·유배댓글 저장 시 `author` 필드 치환(`author_id`는 실제 uid 유지). |
| `SayakScreen.tsx` | ☠️ 사약 처분 전용 전체화면. `sanctionStatus === 'banned'` 시 다른 UI 렌더 전에 이 화면만. 10초 카운트다운 → 강제 로그아웃. |
| `admin/ExileManagement.tsx` | 🏚️ 관리자 유배 관리 탭. 신고 목록 + 현재 유배자 목록(단계별 배지/90일 초과 경고) + [유배 보내기] + 수동 UID 입력 + ☠️ 직권 사약. |
| `admin/AppealReview.tsx` | ⚖️ 이의 제기 검토 탭. 대기/전체 필터 + 인용(해제 권고)/기각 + 대상자 알림 발송. |
| `admin/PlatformRevenueDashboard.tsx` | 💵 플랫폼 수익 대시보드. 잉크병/강변시장/정보봇 + 유배 시스템(속죄금 소각 + 사약 몰수) 카드. |
| `admin/SystemPanel.tsx` | 🔧 관리자 시스템 운영 도구 (AdAdminPage 🔧 시스템 탭). 🛡️ Sprint 6 섹션: 관리자 역할 부여/회수(grantAdminRole/revokeAdminRole, 내 토큰 갱신 버튼) + admin_actions 감사 로그 뷰어(onSnapshot limit 30, 롤백 가능 4종 action만 버튼 노출). 기존 섹션: 예약어 시드 + Creator Score 수동 조정(override set/clear) + Abuse Flag 토글(4종 −0.05~−0.15 Trust 감산). `useCallable` 공용 훅 + ResultBlock. 모든 섹션 사유 2자+ 필수. feedback_admin_cf_ui_button 원칙. |
| `admin/AdminGuard.tsx` | 🛡️ Sprint 6 A-3 (2026-04-25 완료): `useAdminAuth(currentUser)` 훅 + `AdminGuard` 래퍼. Custom Claims(`getIdTokenResult`) **단일 체크** — 닉네임 fallback 제거. loading 초기값 true → 비동기 Claims 조회 후 판정. AdAdminPage에서 사용. |
| `ReportModal.tsx` / `ReportModalHost.tsx` | 🚨 2026-04-24 FLAGGING. 9 카테고리 라디오 + 기타 50자 입력. handleReport() 커스텀 이벤트 `halmal:open-report-modal` 기반 전역 모달. App.tsx 루트에 Host 1개 마운트. 기존 8곳 호출부 서명 유지. |
| `ReportStateBanner.tsx` | 🚨 상세뷰 신고 상태 경고 배너 (review=⚠️ 배지 / preview_warning=🚫 "계속 열람" 게이트 / hidden=🙈 작성자만 보이는 복구 안내). 작성자 본인에겐 [⚡ 이의제기] 버튼 + AppealModal 내장. 4개 상세뷰(DiscussionView / OneCutDetailView / CommunityPostDetail / EpisodeReader)에 주입. |
| `admin/ReportManagement.tsx` | 🚨 AdAdminPage 🚨 신고 관리 탭 (신설 2026-04-24). 상단 **⚡ 이의제기 우선큐** 섹션 (posts+community_posts appealStatus=pending 실시간) + 상태 필터 탭(대기/처리됨/기각) + targetId별 그룹화 카드(심각도 색상 rose/amber/slate, 고유 신고자 수 강조) + ResolveModal(4종 action 라디오 + 사유 + 알림 옵션) + 복구/기각 버튼. FLAGGING.md §5 참조. |
| `MapaeBadge.tsx` | 🏅 Creator Score 마패 티어 배지(동/은/금/백금/다이아). sm/md/lg 사이즈. `creatorScoreTier` 캐시 우선, 없으면 `getMapaeTier(creatorScoreCached)` 재계산. **상세 뷰 전용** — 리스트·피드 금지 (feedback_reputation_avatar_scope 동일 규칙). 티어 미부여(null) 시 조용히 숨김. |
| `CreatorScoreInfo.tsx` | 🏅 PublicProfile 상세 박스. 최종 Score + 마패 라벨 + 3축 브레이크다운(평판·30일 활동·신뢰) + 활동 세부(글/댓글/좋아요) + override 배지(🔧 관리자 보정 중). 캐시 없으면 "집계 전" placeholder. |
| `Sidebar.tsx` | `isExiled` prop — 유배자는 유배지+내정보만 노출. `activeMenu` 강제 이동은 App.tsx useEffect 가드. |
| `ads/AdSlot.tsx` | 📢 광고 슬롯. 모든 useState/useEffect를 early return 앞으로 (Hooks 규칙). v2 P0-2: viewerUid prop 전달 / P0-4: IntersectionObserver 50%·1초+ 충족 시 viewable 이벤트 fire (광고당 1회 ref). selectedAdId 'auto'면 directAd fetch skip. 2026-04-30: viewerRegion ref → `await getViewerRegion()` 직접 호출(byRegion race 차단). |
| `ads/AdFeedCard.tsx` | 📢 ADSMARKET v3 (2026-04-30) 피드 인라인 광고 카드 (글 목록 그리드 한 칸). 글카드 형태 + violet 톤 + 좌상단 📢 광고 배지. 매칭: `slotPosition='feed'`, `postId='feed-{categoryKey}'` 합성, `postAuthorLevel=0`(게이팅 무시). 이벤트: IO 50%·1초+ viewable + click(window.open + UTM `utm_medium=feed`). `previewAd` prop으로 광고주 AdCampaignForm 미리보기 정적 렌더 (매칭/이벤트 skip). 광고 매칭 실패 시 null 반환 → 그리드 셀 자연 비움(auto-fill). |
| `ads/AdBanner.tsx` | 📢 단일 광고 배너. imageStyle 2종(horizontal 3:1 / vertical 9:16). v2 P1-5: 클릭 시 UTM 자동 부착 (`?utm_source=geulove&utm_medium={slot}&utm_campaign={adId}`). ctaText 빈 입력 시 '자세히 보기' fallback. |
| `ads/AdMarketplaceModal.tsx` | 📢 광고 경매시장 모달. 좌(2열 그리드) + 우(미리보기 sticky). 검색·메뉴 일치·정렬·무한 스크롤(20개/페이지). 카드 hover 갱신 제거(떨림 차단). 카드 클릭 = preview만, 우측 [✓ 선택] = 최종 적용. 자동 매칭도 동일 패턴(onSelect('auto')). |
| `ads/AdSlotSetting.tsx` | 📢 작성 폼 광고 슬롯 ON/OFF + 슬롯별 광고 직접 선택. picker 라벨 3분기 — undefined: 🎲 자동 매칭(default), 'auto': ✅ 자동 매칭 결정됨, 광고ID: ✅ 광고 선택됨. |
| `advertiser/AdCampaignForm.tsx` | 📢 광고 등록/수정. v2 P0-2 빈도 캡 섹션 + P0-1 노출 추정 카드(debounce 500ms callable) + P1-7 estimateAdReach + P1-8 Brand Safety(blockedCategories default '유배·귀양지'). 17개 시·도 + 6개 빠른 선택 묶음(수도권/영남/호남/충청/강원/제주). |
| `advertiser/AdCampaignList.tsx` | 📢 내 광고 목록. v2 P0-1 예산 게이지(일/총, 80%↑ amber, 95%↑ rose) + P0-4 viewableRate 표시 + P0-3 [📊 통계] 진입 버튼. paused.budget_daily 시 📊 예산소진 배지. |
| `advertiser/AdStatsModal.tsx` | 📢 광고주 통계 대시보드 (v2 P0-3). KPI 4종(노출·가시·클릭·소진) + 일별 SVG 라인(노출 violet · 클릭 amber) + 분해 3종(슬롯·메뉴·지역) + 24h 시간대 히트맵. 라이브러리 없이 SVG 직접. ad_stats_daily onSnapshot. |
| `advertiser/AdvertiserRegister.tsx` | 📢 광고주 등록 폼 (v2.1). 모든 type(personal/individual_business/corporate) status='pending_review' 등록 의무. 글러브 user 정보(닉네임·이메일) 자동 인입 (전번은 Sprint 7 보안상 평문 미저장). |
| `advertiser/AdvertiserCenter.tsx` | 📢 광고주 센터 (v2.1). pending_review/rejected 상태 시 [+ 새 광고] 잠금 + amber/rose 안내 배너 (검수 대기 / 거절 사유 표시). |
| `admin/AdvertiserReviewQueue.tsx` | 🏢 관리자 광고주 검수 큐 (신설 v2.1). advertiserAccounts.status='pending_review' 카드형 큐 + ✅ 승인/❌ 거절(사유 입력) + 광고주 측에 advertiser_approved/advertiser_rejected 알림 발송. AdAdminPage '🏢 광고주 검수' 탭. |

---

## 개발·테스트 환경

- **개발 서버**: `npm run dev` (Vite, 기본 포트 5173)
- **빌드**: `npm run build` (`tsc -b && vite build` — 빌드 에러 0 유지 필수)
- **프리뷰**: `npm run preview` (빌드 결과 로컬 확인, 기본 포트 4173)
- **린트**: `npm run lint` (또는 `npx eslint . --fix`로 자동 수정)
- **테스트 스위트 없음** — `package.json`에 `test` 스크립트 미구성. UI 변경은 개발 서버 실행 후 브라우저 확인.
- **테스트 계정**: 깐부1~10호 (Lv1~10, exp/likes 레벨·평판 초기값 세팅) + 불량깐부1~3호 (Lv3/4/5, 유배 시스템 테스트용). 헤더 Dev 버튼으로 전환. 정의: [src/constants.ts](src/constants.ts) `TEST_ACCOUNTS`.
- **호스팅 배포**: `firebase deploy --only hosting` (사용자 명시 요청 시에만)
- **Functions 배포**: `firebase deploy --only functions` (사용자 명시 요청 시에만)
- **Workers 배포**: `cd workers && npx wrangler deploy` / `cd upload-worker && npx wrangler deploy` (각각 별도 실행)

---

## 필터링 로직 (절대 불변)

| 탭 | 조건 |
|----|------|
| any (새글) | 게시 후 **2시간** 이내 |
| recent (등록글) | **2시간 경과** + 좋아요 **3개** 이상 |
| best (인기글) | 좋아요 10개 이상 |
| rank (최고글) | 좋아요 30개 이상 |
| friend (깐부글) | 좋아요 3개 이상 + 팔로우 유저 (시간 제한 없음) |
| 카테고리 뷰 | 좋아요 3개 이상 |
| RelatedPostsSidebar | 2시간 경과 + 좋아요 3개 이상 (등록글 기준 동일) |
| RelatedPostsSidebar (🏚️ 유배·귀양지) | 좋아요·시간 필터 스킵, `isHiddenByExile`만 제외. 사이드바 제목 "게시글 더보기" |

---

## 금지 사항

- `write_file` / `Write` 도구로 기존 파일 전체 덮어쓰기 (신규 파일 제외)
- 요청 없는 리팩터링, 불필요한 주석·docstring 추가
- `firebase deploy` 자동 실행 (사용자 명시 요청 시에만)
- Git push 자동 실행 (사용자 명시 요청 시에만)
