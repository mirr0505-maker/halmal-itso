# 📋 TODO — 할말있소 백로그·튜닝·정리 단일 소스

> **목적**: 메모리 폴더에 분산된 18개 백로그/튜닝 메모리를 단일 파일로 통합. 새 백로그가 생기면 이 파일에만 추가.
> **범위**: 완료 아카이브·운영 가이드(feedback)·배포 이력은 메모리 폴더에 별도 유지. 본 파일은 "앞으로 할 일"만.
> 최종 갱신: 2026-05-16 (ADSMARKET v3.4 피드 광고 빈 공백 fix v5 + AdFeedCard fallback 카드 + legacy fetch 제거 + auction.js excludeAdIds 처리 / Perf Phase B+C functions deploy 완료)

---

## 📅 시간 박힘 (D+N 측정·검증)

| 날짜 | 작업 | 무엇을 |
|------|------|--------|
| **2026-05-01 04:30 KST 이후** | S-14 byRegion 재검증 (D+1, fix 후) | `ad_stats_daily/{adId}_20260430.byRegion`에 모든 어제 적재 광고가 `{서울: N, ...}` 채워졌는지 확인. AdSlot ref→await fix(커밋 fa76fd1) 배포 후 첫 사이클. ✅ 시 AdsTestScenarios.md S-14 종결 + 본 항목 제거. ❌ 시 viewer 세션별 `adEvents.viewerRegion` 직접 점검 |
| **2026-05-03** | ADSMARKET v2 안정성 검증 (D+7) | viewableRate 분포 + 빈도 캡 도달률 + 일예산 자동 정지 빈도 + Brand Safety 차단 비율. **이후 P1-6 A/B 다중 소재 착수 가능**. |
| **2026-05-06** | Phase C 일괄 튜닝 (D+14) — 분포 실측 + 튜닝 동시 | `users.creatorScoreCached` P50/P75/P90 + `creatorScoreTier` 분포 + `reportsUniqueReporters` + Gate 4종 통과율 + `adEvents.winnerScoreWeight` 히스토그램 측정 → Gate / consumer / REPORT_PENALTIES 3건 동일 사이클 재조정 (개별 조정 금지) |
| **2026-05-07** | 추천코드 임계 재조정 (배포 2주 후) | 활성 기준 "글 1+ OR 댓글 3+" / 악용 방어 device_fp · /24 3+ same_ip · 1h 5+ rapid_redeem |
| **2026-05-07** | ADSMARKET v3 D+7 안정성 검증 | 피드 광고 viewableRate 분포 + click-through rate + 광고주 만족도(피드 vs 본문 단가 비교) + 4:1 밀도 조정(P3-17) 검토. ad_stats_daily.bySlot.feed 누적치 확인. ✅ 시 P3-15(피드 빈도 캡 별도)·P3-16(피드 단가) 착수 |
| **2026-05-17 04:00 KST 이후** | purgeBotPosts 첫 실행 검증 | Firebase Console → Cloud Functions → purgeBotPosts 실행 로그 + Firestore `posts`(전령 30일 초과) + `community_posts`(isBot=true 30일 초과) + `glove_bot_dedup` 삭제 카운트 확인. ❌ 시 권한·쿼리·collectionGroup 가드 점검 |
| **2026-05-23** | ADSMARKET v3.4 D+7 안정성 검증 | (1) 피드 광고 매칭률 변화 — `ad_stats_daily.bySlot.feed.impressions` 5/16 이전/이후 비교 (excludeAdIds 처리 효과). (2) AdFeedCard fallback 카드 노출 빈도 — production 사용자 등록글 탭 스크린샷 또는 광고 풀 status='active' + targetSlots includes 'feed' 광고 수 확인. (3) 매칭률 60% 미만이면 광고 풀 확장(D 옵션) 또는 fallback 카드 디자인 강화 검토 |
| **2026-05-08** | FLAGGING 7항목 직접 쿼리 (D+13) | reportsUniqueReporters · reportState · creatorScoreCached · Gate 통과율 · audit_anomalies · 이의제기 처리율. Firebase Console 직접 |
| **2026-05-10** | ADSMARKET v2 재구매 가설 검증 (D+14) | 광고주 카드 통계 사용 비율 + AdStatsModal 도달률 + 재등록률(P0-3 효과 측정) |
| **Phase B 진입 시 (베타 종료 + 정식 출시 D-90)** | 대규모 경계값 재조정 절차 | D-90 공지 / D-60 데이터 분석 / D-45 새 경계값 설계 / D-Day 일괄 배포. 상세 절차는 [TUNING_SCHEDULE.md §3.3](./docs/step1-design/TUNING_SCHEDULE.md) |

**조기 튜닝 트리거** (위 일정 무시): 피드 역전 민원 월 3건+ / Gate 통과율 0% or 100% / REPORT_PENALTIES 5명 도달 zero / `audit_anomalies` critical 1건+

---

## 🔒 코드 품질 후속 (2026-07-02 감사 잔여)

> [CODE_QUALITY_AUDIT_2026-07-02.md](./CODE_QUALITY_AUDIT_2026-07-02.md) 기반. P0/P1/P2 대부분 완료(changelog 2026-07-02). 아래는 리스크·설계가 필요해 미룬 항목.

| 우선 | 항목 | 무엇을 / 왜 미뤘나 |
|------|------|--------------------|
| **P0** | upload-worker `/api/screenshot` IDOR | 방장이 멤버 주주인증 스크린샷을 여는 것이 정상 기능이라 경로만으론 권한 판별 불가. Worker 내 Firestore 조회(요청자가 해당 커뮤니티 thumb/index인지)로 host 인증 or 서명 URL 설계 필요 |
| **P0** | `testChargeBall` 무제한 충전 | 현재 "정식 PG 도입 전" 라이브 볼 충전 경로(AdvertiserCenter/MyPage)라 admin 게이트 시 충전 UX 파손. 일일 상한 + `ball_transactions` 원장 기록 or PG 연동 시 폐기 — 제품 결정 필요 |
| **P1** | 사약 자산 몰수 트랜잭션화 | [functions/storehouse.js](functions/storehouse.js) `runSayakLogic` 비트랜잭션 read-modify-write(몰수 직전 볼 은닉 레이스). status 전환+잔액 0화+platform_revenue 적립을 단일 runTransaction으로 — 자산 몰수 경로라 신중 리팩터 |
| **P1** | ad_stats_daily read 소유권 | AdStatsModal이 `adId`로만 쿼리 → owner 제한하려면 `advertiserId` 필터 추가 + 복합 인덱스 필요(클라 변경 동반) |
| **P1** | 유배/사약 글 일괄 숨김 배치 청크 | storehouse/fraud 단일 batch 500 ops 초과 시 조용히 실패 → 400건 청크(ballSnapshot 패턴) |
| **P1** | 신고 일일 상한 원자화 | reportSubmit check-then-set 병렬 우회 → runTransaction |
| **P1** | RSS/DART 저장형 XSS | gloveBotFetcher link/corp_name 미이스케이프 → stripHtml + encodeURI + 프로토콜 화이트리스트 |
| **P1** | 링크프리뷰 SSRF | workers redirect follow 재검증 없음 → redirect:manual + IP/메타데이터 차단 |
| **P2** | 중복 코드 추출 | PostCardFooter / `ads/adShared.ts`(ensureProtocol·UTM·viewable IO·AD_AUCTION_URL·AuctionResult) / `utils/time.ts`(formatRelativeTime 5중) / `utils/memoCompare.ts` |
| **P2** | 미사용 deps 제거 | `firebase-admin`(클라!)·`@google/generative-ai`·`@editorjs/*` 7종 — src 미참조 확인됨. lockfile 대량 변경이라 별도 커밋 |
| **P2** | lint 게이트화 | ESLint 39 error 방치(build 미차단). `lint:ci --max-warnings 0` 신설 + 에러 소진 |
| **P2** | 타입 정리 | FirestoreTimestamp `toMillis` 누락(~10 캐스트) / `any` 8곳 / types.ts 런타임 값 분리 / Kakao Window 타입 3중복 통합 / AdSlot `{} as any` |
| **P2** | 상수 동기화 자동화 | client↔functions 8쌍 주석 의존 → `scripts/check-constant-sync.mjs` |
| **P2** | 번들 코드스플릿 | index 877kB → firebase/tiptap manualChunks |
| **P2** | 프론트 성능 | App.tsx renderContent useMemo화(전 유저 리스너 렌더 결합 = 전령 잼) |
| **P2** | SettlementQueue 낙관적 실패 | await 전 UI 제거 + catch 누락 → AdReviewQueue 패턴 |

---

## 🚀 Sprint 백로그

### Sprint 8 — 인증·결제·관리자 보강
- **Apple OAuth** (Developer Services ID + 서명키) — 해외 진출 + iOS 30%+. X·FB는 검토 반려.
- **개인사업자 / 법인 로그인** — 사업자등록번호 인증으로 광고주 가입·로그인. 홈택스 진위확인 API 또는 Codef 연동. 자동 승인 흐름(현재는 수동만). 광고비 부가세 처리 위해 사업자 정보 정확도 필수. **카드 PG 도입과 묶음**.
- **카드 PG 결제** (토스/아임포트/KG이니시스) — 정기결제 토큰 PCI-DSS 준수. **사용자 결정으로 가장 마지막에 진행**.
- **광고주 카드 결제 옵션** — 개인/사업자/법인 모두 카드 결제 가능 (현재 ⚾ 볼만). 카드 PG 도입 시 함께 작업.
- **광고주 사업자번호 자동 검증** — 홈택스 진위확인 또는 Codef API. 카드 PG 도입 시 함께 작업.
- **광고비 세금계산서 자동 발행** — 사업자/법인 광고비 결제 시. 카드 PG 도입 시 함께 작업.
- **광고주 type 변경 신청·심사** — personal → individual_business 또는 corporate 승급. 별도 신청 폼 + 관리자 심사 후 type 변경. 1uid:1type 제약 유지.
- **Admin Phase C CF 3종**: `adminAdjustReputation` / `detectCircularThanksball` / `auditReputationAnomalies`
- **Admin role 4단계 활성** — 현재 단일 admin → Owner / Admin / Moderator / Viewer 분리. Custom Claims `role` 필드 + Rules `isOwner`/`isModerator` 헬퍼 + UI 권한 분기. [ADMIN.md §2 D2-γ](./docs/step1-design/ADMIN.md).
- **수수료 조정 UI (Owner 전용)** — `MARKET_FEE_RATES` / `INKWELL_FEE_RATE` / `KANBU_FEE_RATES` 변경 + 3개월 예고 자동 공지 발송. ADMIN.md §10.7.
- **`contact_requests` 컬렉션** — 외부 채널(DM·이메일) 제보 접수 → 관리자 검토 큐. Phase A/B 보조 신고 채널. ADMIN.md §5.4·§5.6.
- **콘텐츠 블라인드 ↔ 삭제 분리** — 현재 신고 시스템과 통합. 블라인드(복원 가능) vs 영구 삭제 명확 구분 + 블라인드 해제 UI. ADMIN.md §7.
- **Google ↔ Kakao 계정 병합** — `linkWithCredential` 또는 데이터 마이그레이션. 정책 결정 필요(볼/EXP/평판/깐부 어느 쪽 기준)
- ✅ 카카오 OAuth 완료 (2026-04-23) / ✅ 네이버 OAuth 완료 (2026-04-24~25)

### Sprint 9 — 볼 원장 통일 (Batch 진행)
- ✅ Batch 1 완료 (2026-04-24): `nickname_change` / `infobot_activation`
- ✅ Batch 2 첫 타자 완료 (2026-04-25): `unlockEpisode` (수수료 11%)
- ⏳ Batch 2 잔여: `purchaseMarketItem` (Lv별 30/25/20%) / `subscribeMarketShop`
- ⏳ Batch 3: `joinPaidKanbuRoom` (Lv별 20~30%) / `releaseFromExile` (소각/이전)
- ⏳ Batch 4: `executeSayak` (자산 몰수, 복잡) / `kanbuPromo` 재정비 + `ballAudit` 3-bis 특례 제거 (마지막)
- 표준 스키마: `senderUid/senderNickname/resolvedRecipientUid/amount/balanceBefore-After/platformFee/sourceType/details`. 트랜잭션 내부 기록 필수.

### Sprint 10 — 주가 변동 봇 Phase 1
- 네이버 금융(임시) + 안C(API 라이선스) 하이브리드. KIS 교체는 정식 서비스 시.
- 독립 트랙 — 다른 Sprint와 분리.

### Sprint 3 Phase C 보류 — 어뷰징 탐지 CF 2종
- `detectCircularThanksball` (A→B→A 주고받기 탐지)
- `auditReputationAnomalies` (급증 패턴 → audit_anomalies 기록)
- Sprint 8 Admin Phase C와 묶어 진행 권장

### Sprint 12 (신설) — 어뷰징 방어 레이어 2/3차 강화
- 출처: [ANTI_ABUSE.md §4·§5·§6](./docs/step1-design/ANTI_ABUSE.md). Sprint 3 Phase C 탐지 CF와는 별개 — Rules·클라 보강 위주.
- **Layer 1 Rules 강화 (즉시 적용 가능, 비용 0)**:
  - `users.exp` 증가만 허용 + 1회 +100 상한 + 음수 차단 (F12 콘솔 직접 수정 차단)
  - `users.{likes, totalShares, promoViewCount}` 증가만 허용 + 1회 상한 (각 +3 / +1 / +1) — 평판 펌핑·파괴 차단
- **Layer 2 클라 보강 5종**:
  - 깐부 EXP +2/0 완화 (현재 +10/-15) — 다계정 루프 인센티브 차단 (ANTI_ABUSE §5.2.1)
  - 글/댓글 삭제 시 EXP 음수 방지 — CF 이관 또는 `Math.max(0, …)` (§5.2.2)
  - 품질 가중치 EXP 공식 — 10/100/300/1000자 + 이미지·링크 가중치 (§5.2.3)
  - `viewed_posts/{uid}_{postId}` 영구 마커 — 세션 조회 → Firestore 1회 보장 (§5.2.4)
  - `sharePost` CF 이관 — `totalShares` 클라 직접 증가 차단 + 1시간 내 동일 글 중복 방지 (§5.2.5)
- **Layer 3 CF 탐지 추가 2종**:
  - `detectRapidExpGain` — 1일 EXP +200 초과 봇 의심 (§6.2.3)
  - `detectDuplicateAccounts` — Phase C 휴대폰 인증 우회 다계정 (§6.2.4)
- **위협 모델 7종 참조** — 봇 대량 가입 / 맞땡스볼 담합 / 좋아요 펌핑·파괴 / 깐부 EXP 루프 / 닉네임 세탁(✅ 완료) / 자동화 봇 조회수 / 잉크병 무단 복제 (ANTI_ABUSE §3)

### Sprint 13 (신설) — 마패 칭호 시스템 14개
- 출처: [MAPAE_AND_TITLES_V1.md §4~§9](./docs/step1-design/MAPAE_AND_TITLES_V1.md). 마패 5단계는 Sprint 4 완료, B축 칭호 14개는 통째 미구현 이월.
- **마스터 데이터** — `titles` 컬렉션 + 14개 seed (크리에이터 5 / 커뮤니티 5 / 플랫폼 로열티 4). §4.6.
- **CF 5종**: `titleChecker` (공통 체크) / `titleAwarder` (부여) / `titleRevocation` (유배 박탈) / `titleSeed` (초기화) / `dailyTitleRollup` (시간 기반 칭호 일일 배치 05:30 KST). §9.2.
- **UI 컴포넌트 5종**: `TitleBadge` / `TitleCollection` (프로필 14개) / `PrimaryTitleSelector` (대표 3개) / `TitleAchievementToast` / `TitleAchievementModal`. §9.3.
- **대표 칭호 3개 노출 (D2-β)** — 닉네임 옆 이모지 3개. PostCard·CommentItem·ProfileHeader 통합.
- **유배 박탈 매트릭스 (D5-β)** — 1차 무인도(클린 보존) / 2차 절해고도(크리에이터 박탈) / 3차 놀부곳간(컬렉션 박탈) / 사약(전체 박탈). §7.1.
- **이력 컬렉션 3종**: `title_achievements` / `title_revocations` / `mapae_history`. §8.3.
- **유효 활동 정의 (D3-γ)** — 어뷰징 방지 위해 칭호 카운트 시 "10자+ OR 반응 1+" 이중 기준. §6.2.

---

## 🔧 기능 보완

| 항목 | 핵심 |
|------|------|
| **REPUTATION Prestige 3단계** | legend / awe / mythic 토글 조건·경계값·grandfathered 로직. 현재 미활성. Creator Score와 독립 트랙. |
| **ADSMARKET v2 잔여 항목** | P1-6 A/B 다중 소재(다음 우선) + P2-9~13(Smart Bidding/리타게팅/후불 정산/작성자 floor/부정 클릭 ML). 진행 트래커 [AdsRoadmap.md](./AdsRoadmap.md) — 13항목 중 7건 완료(2026-04-26). |
| **ADSMARKET v3 잔여 항목** | P3-15 피드 빈도 캡 별도 limit (default 24h 5회 등) / P3-16 피드 단가 책정 (D+7 후 본문 대비 ±N%) / P3-17 ~~4:1 밀도 조정 (8:1)~~ → **2026-05-16 v3.4 chunk 동적화로 columnCount 기반 자동(4-col=7:1·5-col=9:1·3-col=5:1) 적용. P3-17 종결.** / P3-18 AdStatsModal 본문·피드 분해 + `aggregateDailyRevenue`에 피드 이벤트 가드 추가 (postAuthorId 빈 문자열 영수증 노이즈 제거). 2026-04-30 P3-14(피드 인라인) + P3-14b(본문/피드 진입 분리) 도입 완료. 2026-05-16 v3.4 빈 공백 fix v5 + fallback 카드 + legacy fetch 제거 + auction excludeAdIds 도입. |
| **ADSMARKET 광고 풀 'feed' 슬롯 호환 확장** | v3.1(2026-04-30) 신규 매체라 기존 광고는 `targetSlots: ['top','middle','bottom']`만 있는 경우 다수. 매칭 실패 시 AdFeedCard fallback 카드 표시되지만 실제 광고 노출률 저조. 옵션: ① admin SystemPanel에 "기존 광고 일괄 feed 슬롯 추가" 도구 + 광고주 사전 동의 절차 / ② AdCampaignForm 신규 등록 시 'feed' 슬롯 기본 ON / ③ 광고주 대상 v3 피드 인라인 안내 캠페인. D+7 매칭률 검증(2026-05-23) 후 결정. |
| **광고 출금(환급) 시스템** | 작성자가 누적된 `users.pendingRevenue` / `dailyAdRevenue` 정산 영수증을 실제 ⚾볼 → 원화 환급 신청. 카드 PG 도입과 묶음(Sprint 8). 전자금융업 등록 검토 필요. 현재 ballBalance 즉시 환원만 — 플랫폼 내 사용 가능, 외부 인출 불가. |
| **users.region 자동 채움** | 광고 region 매칭 + 마이페이지 표시용. SMS 인증만으론 불가 — PASS 본인인증(NICE/KCB) 도입 시 자동 또는 IP 기반(Cloudflare cf.region) + 마이페이지 수동 수정 조합. Sprint 7 휴대폰 인증 후속 또는 카드 PG와 묶음. |
| **카카오 가입 시 이메일 미수집** | 카카오 OAuth scope 'account_email'은 비즈 앱 전환(사업자 검수) 후 가능. 임시: 카카오 가입자 한정 회원가입 후 이메일 입력 폼 또는 광고주 등록 시 직접 입력. 정식 오픈 시 비즈 앱 전환 진행. |
| **userCode 참조 전환** | `friendList`/`likedBy`/`author`의 uid → userCode 무중단 4단계. Sprint 8+ 이월. |
| **추천코드 + Lv20 로드맵** | LEVEL_TABLE은 현재 코드(10000) 확정. Sprint 1 이후 별도 설계. |
| **syncUserLevel CF 후속** | 옵션 B 부분 커버리지. Phase C Gate blocker 해제 완료 — 추가 보강 필요 시 검토. |
| **`daily_stats` + `collectDailyStats` CF** | 매일 02:00 KST 전체 유저 순회 → Lv/평판/Score 분포 + 어뷰저 탐지 건수 + 수익 전환율 집계 → `daily_stats/{YYYYMMDD}` 저장. 4대 트리거·분포 대시보드 데이터 소스. [TUNING_SCHEDULE.md §6](./docs/step1-design/TUNING_SCHEDULE.md) / ANTI_ABUSE §9.2.1. |
| **분포 대시보드** | Lv/평판/Score/마패/칭호 5종 분포 시각화 (히스토그램 + 4대 트리거 상태 ON/OFF). ADMIN.md §11.3 / TUNING_SCHEDULE.md §6.1. |
| **어뷰저 통계 대시보드** | `audit_anomalies` type별 30일 추이 + 자동 감점/수동 검토 비율 + false positive(dismiss) 비율. ADMIN.md §11.4. |
| **경계값 시뮬레이션 도구** | "Lv5 = 700 EXP면?" 가상 적용 → 강등 대상자 N명 + 분포 변화 미리보기. 조정 확정 전 필수. ADMIN.md §12.2. |
| **일괄 조정 도구** | 다수 유저 한 번에 EXP/평판/Score/abuseFlags 조정 + 사유 입력 + admin_actions 일괄 기록. ADMIN.md §6.8. |
| **4대 튜닝 트리거 모니터링** | Lv 분포·수익 전환율·어뷰저 비율·정성 피드백 4종 임계치 자동 알림. 트리거 1~3 중 2개 이상 🔴일 때 조정 검토 시작. TUNING_SCHEDULE.md §2. |
| **grandfathered 관리 UI** | Phase C 진입 시 `grandfatheredLevel` / `grandfatheredMapae` / `grandfatheredPrestigeTier` 스냅샷 + 수동 부여/회수. ADMIN.md §6.7·§12.4. |
| **감사 로그 외부 백업** | `admin_actions` 영구 보존분 외부 스토리지(R2·BigQuery) 백업 — Firestore 비용·법적 요구 대비. ADMIN.md §15.4 Phase C. |

---

## ⚡ 성능 개선 — 봇 콘텐츠 누적 대응

> 2026-05-13 5종(Phase 1·1.5·A·B·C) 코드 작업 완료. **2026-05-16 B(purgeBotPosts CF 신설) + C(gloveBotFetcher 1h→2h) functions deploy 완료**, hosting 항목 1·1.5·A·E-light는 2026-05-13 hosting deploy로 production 반영 완료. 잔여 3종(Phase 3·D·E-full) 백로그. 상세 [project_herald_perf_phases.md](../../Users/kidoo%20kim/.claude/projects/e--halmal-itso/memory/project_herald_perf_phases.md).

| Phase | 영역 | 작업 | 상태 |
|-------|------|------|------|
| 1 | 전령 카테고리 | App.tsx `basePosts.slice(0, 200)` | ✅ 2026-05-13 hosting |
| 1.5 | AnyTalkList 전반 | `maxPosts` prop default 200 | ✅ 2026-05-13 hosting |
| A | community_posts | CommunityView/Feed query `limit(100)` | ✅ 2026-05-13 hosting |
| B | 서버 TTL | `purgeBotPosts` CF (전령 + 봇 community_posts + dedup, 30일) | ✅ 2026-05-16 functions |
| C | 봇 페이스 | 매 1시간→2시간, 키워드당 5→3건, DART page_count 10→5 | ✅ 2026-05-16 functions |
| E-light | 렌더 비용 | PostCardItem·CommunityFeedCard·MemoizedSanitizedHTML — 카드 분리 + React.memo + sanitize useMemo | ✅ 2026-05-13 hosting |
| ⏳ 3 | listener 분리 | `posts` 전역 onSnapshot 폐기 → 화면별 limit+where (0.5~1일) | 미완 — 모바일 다운 / 비용 압박 시 |
| ⏳ D | 무한 스크롤 | CommunityView/Feed/AnyTalkList `startAfter` 페이지네이션 (반나절) | 미완 — 옛 글 조회 요청 시 |
| ⏳ E-full | 가상 스크롤 | `@tanstack/react-virtual` 도입 — viewport 외 카드 unmount (반나절) | 미완 — E-light 부족 시 |

**판단 트리거** (잔여 Phase 진입 결정용):
- 다른 봇 커뮤니티(코인·부동산) 활성화 + 다운 재발 → Phase E 가속
- 모바일 메모리 부족 / Firestore 읽기 비용 압박 → Phase 3
- 사용자가 100건 너머 옛 봇 글 조회 호소 → Phase D

**검증 일정**:
- 2026-05-17 04:00 KST 이후: `purgeBotPosts` 첫 실행 — Firebase Console에서 30일 초과 봇 글 삭제 로그 확인 (시간 박힘 표에 등재)
- 1주 운영 후: 사용자 다운 보고 0건 / Firestore 읽기 비용 추이 점검

**보호 범위 (2026-05-13 사용자 확정)**: **일반글(홈 6탭 + 6개 카테고리) + 봇글(전령·정보봇)만 보호**. 잉크병 회차·한컷·깐부방·유배지·일반 댓글·내 댓글 listener·RankingView·MyPage 50건 cap·검색 별도 경로는 보호 작업 불필요. 향후 해당 영역에서 다운 보고 발생 시 재검토.

---

## 🧹 정리·청소

| 작업 | 상태 |
|------|------|
| **docs/step1-design 4개 보관** | 핵심 백로그 본 TODO로 통합 완료 (2026-04-29). 본문은 설계 상세·코드 예시·테스트 시나리오·CSS 매트릭스 등 **구현 시 참조용**으로 보관. ADMIN.md(Sprint 8/12/13 의존) / ANTI_ABUSE.md(Sprint 12) / MAPAE_AND_TITLES_V1.md(Sprint 13) / TUNING_SCHEDULE.md(Phase B 진입 시 절차 가이드 + grandfathered 설계). 각 Sprint 착수 시 해당 파일 §섹션 참조. |
| **레거시 메뉴명 일괄 정리** | DB `post.category="너와 나의 이야기"` (구) ↔ 표시명 "참새들의 방앗간" (신) 등 미스매치. 광고/필터 매칭 사고 위험. **베타 테스트 전 등록글 일괄 삭제 후 진행 권장** (마이그레이션 단계 생략 → 5~7h → 3~4h로 단축). 상세는 [📚 레거시 메뉴명 정리 상세 계획](#-레거시-메뉴명-정리-상세-계획) 참조. |
| **정보봇 스케줄 30분~1시간 복원** | 현재 베타 2시간(2026-05-16 Phase C deploy 완료 — 비용 절감 + 글 유입 완화). 키워드당 3건 / DART page_count 5. 정식 서비스 오픈 시 `fetchBotNews`/`fetchBotDart` 30분~1시간 복원 + 키워드 건수·page_count 복원 검토 |
| **refactor_plan.md 등 오래된 메모리** | 2026-04-05 작성. 현재 무관. 삭제 |

---

## 🎯 잠정 수치 튜닝 (실측 후)

각 항목 원본 정의는 코드 (`src/constants.ts`, `functions/utils/*`). 본 표는 튜닝 결정 시 점검 체크리스트.

| 영역 | 잠정 수치 | 동기화 위치 |
|------|----------|------------|
| Creator Gates 4종 | 출금/라이브/잉크병/깐부방 Lv·Score 경계 | `src/constants.ts CREATOR_GATES` ↔ `functions/utils/gateCheck.js` |
| Creator Score 소비측 | 피드 best/rank 가중치 + 광고 effectiveBid clamp 0.3~3.0 + fallback 1.0 | App.tsx 피드 정렬 + auction.js |
| REPORT_PENALTIES | 고유 신고자 5/10/20 → Trust 감산 0.05/0.10/0.15 | `TRUST_CONFIG.REPORT_PENALTIES` ↔ `functions/utils/creatorScore.js` |
| 추천코드 활성 기준 | 7일 "글 1+ OR 댓글 3+" | `functions/confirmReferralActivations` |
| 추천코드 악용 방어 | device_fp 즉시차단 / /24 3+ same_ip / 1h 5+ rapid_redeem | `functions/redeemReferralCode` |

**튜닝 원칙**: Phase C 4건은 서로 영향. 같은 사이클에 일괄 재조정. 변경 후 +7일 재관찰.

---

## 📚 레거시 메뉴명 정리 상세 계획

> 베타 테스트 직전 zero-state cleaning과 결합해 진행. 마이그레이션 단계 생략 → **3~4시간**.

### 0단계 — 베타 직전 데이터 cleaning (1h)

**모든 콘텐츠 삭제** (작성자 무관):
- `posts` / `comments` (모든 글·댓글)
- `ads` / `adEvents` / `ad_stats_daily` (광고 + 통계)
- `notifications` (모든 알림)
- `giant_trees` / `community_posts` / `series` / `unlocked_episodes` / `market_items` (콘텐츠 전부)
- `kanbu_rooms` / `communities` (필요 시)

**테스트 계정만 삭제** (`constants.ts TEST_ACCOUNTS` 닉네임 기준):
- 깐부1~10호 / 불량깐부1~3호 / 봉이(광고주) — `FRIENDS_MENU_ALLOWED_NICKNAMES` 참조
- `users/{uid}` 문서 + Firebase Auth user 둘 다 삭제 (`auth.deleteUsers([uid])`)
- 해당 계정의 `advertiserAccounts/{uid}` (있으면)

**일반 사용자 보존**:
- 베타 중 가입한 실제 사용자 계정·users 문서·advertiserAccounts 유지
- 다만 그들이 작성한 글·댓글·광고는 위 콘텐츠 삭제로 함께 사라짐
  → 사전 안내 권장 ("베타 정식 오픈 전 모든 글 초기화. 글 다시 작성 부탁")

**관리자 보존**:
- ⚠️ **흑무영 admin 계정** — Custom Claims `admin: true` 락아웃 방지. 절대 삭제 X
- 정적 컬렉션 (`dart_corp_map`, `banned_phones` 등 운영 데이터)

**실행 방식**:
- Firebase Console에서 직접 컬렉션 삭제 (가장 단순) 또는 admin onCall CF + assertAdmin
- Firebase Auth users 일괄 삭제 — Auth Admin SDK `auth.deleteUsers(uids)` (1회 1000명까지)

### 1단계 — 코드 하드코드 정리 (2h)

**핵심 치환**:
```
'너와 나의 이야기'  → '참새들의 방앗간'
'한컷'             → '헨젤의 빵부스러기'
```

**영향 파일** (~20개):
- `src/constants.ts` — `AD_MENU_CATEGORIES` value를 label과 동일하게
- `src/components/CreateMyStory.tsx` — `category: '참새들의 방앗간'`
- `src/components/CreateOneCutBox.tsx` — `category: '헨젤의 빵부스러기'`
- `src/components/DiscussionView.tsx` — `CATEGORY_RULES` / `CATEGORY_COMMENT_MAP` 키 변경
- `src/components/DebateBoard.tsx` — 카테고리 분기 조건
- `src/components/CategoryHeader.tsx` — 표시명 매핑 제거
- `src/App.tsx` — 필터/라우팅 분기 (myStory, OneCut 판정 등)
- `src/types.ts` — 주석 갱신
- 그 외 grep `너와 나의 이야기`·`한컷` 결과 100% 정리

### 2단계 — Backward-compat 헬퍼 제거 (30m)

- `src/utils.ts` `CATEGORY_DISPLAY_MAP` 객체 제거
- `getCategoryDisplayName()` 단순 pass-through 또는 함수 자체 제거
- 호출부 일괄 정리 — `getCategoryDisplayName(post.category)` → `post.category`

### 3단계 — 검증 + 배포 (30m)

- `npm run build` 통과
- 모든 카테고리 글 작성/조회 smoke test
- 광고 등록 시 `targetMenuCategories` 신규 이름 확인
- commit + hosting deploy

### 위험 + 대응
- 흑무영 admin 락아웃 → 시작 전 Custom Claims 백업·복구 절차 명시
- 광고주가 광고 다시 등록 — 광고주(봉이/깐부6호 등)에게 미리 알림 (베타 시작 전)
- 코드 누락 — `grep` 결과 0건 확인 후 commit

### 분량 요약
- 0단계 cleaning: 1h
- 1단계 코드: 2h
- 2단계 헬퍼 제거: 30m
- 3단계 검증·배포: 30m
- **총 4h**

### 진행 시점
- 베타 테스트 직전 (날짜 미정)
- 또는 D+7 ADSMARKET 안정성 검증(2026-05-03) 통과 직후

---

## 📝 신규 백로그 추가 규칙

- 본 파일에만 추가. 메모리 폴더에 별도 `*_backlog.md` / `*_tuning.md` 생성 금지.
- 카테고리 5개(시간/Sprint/기능/정리/튜닝) 중 적합한 곳에.
- 완료 시 → 본 파일에서 제거 + `changelog.md`에 한 줄 추가 + 필요 시 `memory/project_2026-XX-XX_*_deploy.md` 신설(이력 보존).
