# 🏪 강변 시장 (Riverside Market) — 기획 설계서

> halmal-itso(글러브) 크리에이터 이코노미 메뉴
> 버전: v1.1 | 최종 갱신: 2026-04-13 (Phase 1~5 완료)

---

## 1. 비전 및 개요

> "글로 밥 벌어먹고 살 수 있는 플랫폼"

글러브(할말있소)는 단순 커뮤니티를 넘어 크리에이터가 지식·감성·정보를 팔아 실제 수익을 창출하는 생태계를 구축한다. 강변 시장은 그 중심 거점이다.

### 개설 자격

| 상점 유형 | 이름 | 개설 조건 | 판매 방식 |
|-----------|------|-----------|-----------|
| 가판대 | 단건 판매 | Lv3 이상 | 글 1개 = 땡스볼 N개 |
| 단골장부 | 구독 상점 | Lv5 이상 | 30일 이용권 |

### 수수료 구조 (레벨별 차등)

| 레벨 | 플랫폼 수수료 | 크리에이터 수령 |
|------|-------------|---------------|
| Lv3~4 | 30% | 70% |
| Lv5~6 | 25% | 75% |
| Lv7+ | 20% | 80% |

수수료율은 `functions/market.js` 상단 `MARKET_FEE_RATES` 상수로 관리 — 변경 시 상수 수정 후 재배포.

---

## 2. 투트랙 판매 모델

### 2-A. 가판대 (단건 판매)

- 단일 게시글을 땡스볼로 잠금 해제
- 심층 분석 리포트, 템플릿, 고가치 정보에 특화
- 가격: 땡스볼 1~100개 (작성자 자율)
- 티저(previewContent): 본문 앞 200자 자동 추출 (별도 작성 불필요) + 페이월 오버레이
- 구매 후: 전체 본문 열람 + 별점(1~5) + 한 줄 평

### 2-B. 단골장부 (월간 구독)

- 크리에이터 구독자 전용 콘텐츠 무제한 열람
- 30일 이용권 (자동 결제 없이 수동 갱신)
- Lv5 이상 크리에이터만 개설 가능
- 만료 3일 전 알림 + 만료 시 잠금 복귀
- VIP 혜택: 단골손님 배지, 깐부방 우선 입장, **구독 크리에이터 글 광고 제거(Ad-free)**
  - Why: 유료 구독자는 광고 제거를 기대함. 크리에이터는 광고 수익 감소보다 고정 구독료(땡스볼)가 단가 훨씬 높아 납득 가능

---

## 3. 광고 수익 쉐어

- 크리에이터 지면에 광고주 입찰 → 낙찰금의 70%를 크리에이터에게 자동 정산
- 기존 adAuction 시스템 확장 (타겟팅 옵션 추가)
- 매일 자정 `processMarketAdRevenue` Cloud Function 실행

---

## 4. Firestore 데이터 모델

### 4-1. market_items (가판대 단건 판매글)
- ID: `mkt_{timestamp}_{uid}`
- 주요 필드: authorId, title, previewContent, category(황금알 INFO_GROUPS 38개 항목), tags, price, purchaseCount, ratingAvg, ratingCount, status
- 서브컬렉션: `private_data/content` (본문 분리 저장, Rules로 미구매자 차단)

### 4-2. market_purchases (구매 내역)
- ID: `{itemId}_{userId}`
- 주요 필드: itemId, userId, authorId, pricePaid, platformFee, creatorEarned, rating, review

### 4-3. market_shops (단골장부 상점)
- ID: `creator_{userId}`
- 주요 필드: creatorId, shopName, shopDescription, subscriptionPrice, subscriberCount

### 4-4. market_subscriptions (구독 상태)
- ID: `{creatorId}_{subscriberId}`
- 주요 필드: creatorId, subscriberId, pricePaid, expiresAt, isActive

### 4-5. market_ad_revenues (광고 수익 일별)
- ID: `{itemId}_{YYYYMMDD}`
- 주요 필드: itemId, creatorId, adRevenueBalls, creatorShare, platformShare, settled

---

## 5. Cloud Functions

| 함수 | 트리거 | 역할 |
|------|--------|------|
| `purchaseMarketItem` | onCall | 가판대 단건 구매 트랜잭션 |
| `subscribeMarketShop` | onCall | 단골장부 구독 트랜잭션 |
| `checkSubscriptionExpiry` | onSchedule (매일 09:00) | 만료 체크 + 알림 발송 + market_shops.subscriberCount 차감 동기화 |
| `processMarketAdRevenue` | onSchedule (매일 00:00) | 광고 수익 일별 정산 |
| `onMarketItemDelete` | onDocumentDeleted | 소프트 딜리트 + 고아 정리 |

---

## 6. 개발 로드맵

| Phase | 목표 | 상태 |
|-------|------|------|
| 1 | 기반 인프라 (타입/Rules/메뉴 변경/기본 UI) | ✅ 완료 |
| 2 | 가판대 CRUD + 구매 + 페이월 + 리뷰 | ✅ 완료 |
| 3 | 단골장부 구독 시스템 + 만료 스케줄러 | ✅ 완료 |
| 4 | 광고 수익 쉐어 + 크리에이터 타겟팅 | ✅ 완료 |
| 5 | 크리에이터 대시보드 + 판매글 수정 | ✅ 완료 |

### 추가 구현 (2026-04-13)
- 카테고리를 황금알 INFO_GROUPS 6그룹 38개 항목으로 통일
- 미리보기 자동 추출 (본문 앞 200자, 별도 작성 불필요)
- 판매글 수정 기능 (MarketItemEditor 수정 모드)
- 광고주 캠페인 폼에 크리에이터 지면 타겟팅 UI (targetCreatorId)
- 관리자 페이지에 플랫폼 수익 대시보드 탭 (platform_revenue 3문서 조회)

---

## 7. 기존 시스템 연계

- 잉크병과 차이: 연재물 vs 단편 정보, 수수료 11% vs 레벨별 차등
- 깐부방 연계: 단골장부 구독자 → 깐부방 우선입장
- 땡스볼: 기존 `ballBalance` 차감 방식 동일, Cloud Function 트랜잭션
- 알림: 기존 notifications에 `market_sale`, `market_purchase`, `market_sub_new`, `market_sub_expiring` 타입 추가

---

## 8. 운영 정책

- Lv3 미만: 판매 불가 (독자는 제한 없음)
- **환불**: 단건 구매 환불 없음 (티저로 사전 판단). **단골장부 구독은 원칙적으로 환불 불가** (결제 후 24시간 이내 + 1회 한정 예외 환불은 운영자 재량)
  - Why: 열람 이력 추적(read_history) 구현은 DB Write 비용 과다 — MVP 단계에서는 심플한 정책이 CS 방어에 유리
- 콘텐츠 신고 3회: 판매 자격 정지
