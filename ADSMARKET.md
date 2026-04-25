# 📢 ADSMARKET — 할말있소 광고 경매 시장 종합 기획서

> **문서 목적**: VS Code에서 AI(Claude) 또는 휴먼 개발자가 코딩 작업을 수행할 때 **단일 진실 소스(Single Source of Truth)**로 사용하는 기획서.
> 모든 컬렉션 · 인터페이스 · 비즈니스 로직 · UI 컴포넌트를 이 문서 하나로 확정한다.
>
> 최종 갱신: 2026-04-25 v1.2 | 기술 스택: React 19 + TS + Vite · Tailwind 4 · Firebase (Firestore + Auth + Cloud Functions) · Cloudflare R2/Workers
>
> **v1.2 (2026-04-25) 변경 요약** — 광고 스타일 2종(`imageStyle: 'horizontal' | 'vertical'`, `imagePosition`), 카테고리 매칭 재설계(`targetCategories` 업종 통계용 분리 + `targetMenuCategories` 매칭 핵심), 단위 ⚾ 통일(원→볼), 광고 수정 기능, 임시 충전(testChargeBall), AdReviewQueue try/catch, 인덱스 보강. 광고주 노출당 차감은 베타 보류(`memory/project_ad_billing_advertiser_charge.md`).

---

## 목차

0. [용어 정의](#0-용어-정의)
1. [시스템 개요 & 아키텍처](#1-시스템-개요--아키텍처)
2. [Firestore 데이터 모델 (전체 컬렉션)](#2-firestore-데이터-모델)
3. [광고 경매 시스템](#3-광고-경매-시스템)
4. [글 작성자 수익 시스템](#4-글-작성자-수익-시스템)
5. [광고주 센터](#5-광고주-센터)
6. [세무 · 정산 시스템](#6-세무--정산-시스템)
7. [부정행위 방지 (Fraud Detection)](#7-부정행위-방지)
8. [UI 컴포넌트 목록 & 파일 구조](#8-ui-컴포넌트-목록--파일-구조)
9. [Cloud Functions 명세](#9-cloud-functions-명세)
10. [구현 로드맵 (Phase 1 → 4)](#10-구현-로드맵)
11. [보안 · 개인정보 체크리스트](#11-보안--개인정보-체크리스트)

---

## 0. 용어 정의

| 용어 | 정의 |
|------|------|
| **광고주(Advertiser)** | 플랫폼에 돈을 내고 광고를 게재하는 소상공인 · 기업 · 개인. |
| **글 작성자(Creator)** | 할말있소에 게시글을 작성하는 일반 유저. 레벨에 따라 광고 수익을 배분받음. |
| **광고 슬롯(Ad Slot)** | 게시글 상세 뷰(PostDetailModal / DiscussionView / OneCutDetailView) 내 광고가 삽입되는 위치. `top` · `middle` · `bottom` 3종. |
| **경매(Auction)** | 광고주가 특정 카테고리 · 지역 · 시간대에 대해 입찰가(CPM/CPC)를 제시하고, 가장 높은 입찰가의 광고가 노출되는 방식. |
| **CPM** | Cost Per Mille — 1,000회 노출당 비용. |
| **CPC** | Cost Per Click — 클릭 1회당 비용. |
| **RS (Revenue Share)** | 광고 수익 배분 비율. 레벨별로 작성자 : 플랫폼 비율이 달라짐. |
| **Waterfall** | 1순위(직거래) → 2순위(애드센스) → 3순위(자체 프로모션) 순으로 광고를 채우는 계단식 로직. |
| **정산(Settlement)** | 누적 수익이 출금 기준액 이상일 때 원천세를 공제하고 실지급하는 프로세스. |
| **땡스볼(Thanksball)** | 독자가 작성자에게 보내는 후원 포인트. 1볼 = ₩1,000 (향후 실결제 연동). |

---

## 1. 시스템 개요 & 아키텍처

### 1.1 전체 흐름도

```
광고주                          플랫폼(할말있소)                       글 작성자
──────                         ────────────────                      ──────────
① 광고 등록 & 입찰  ─────▶   ② 경매 엔진이 낙찰 결정
                               ③ 게시글에 AdSlot 렌더링  ──────▶   ④ 본인 글에 광고 노출
⑤ 노출/클릭 이벤트  ◀──────   ⑥ 이벤트 로깅 (adEvents)
                               ⑦ 수익 집계 (dailyAdRevenue)
                               ⑧ 정산 주기 도래 시                   ⑨ MyPage에서 출금 신청
⑩ 세금계산서 발행   ◀──────   ⑪ 원천세 공제 & 이체  ─────────▶   ⑫ 실지급액 수령
```

### 1.2 기술 스택 매핑

| 레이어 | 기술 | 역할 |
|--------|------|------|
| 프론트엔드 | React 19 + TS + Vite + Tailwind 4 | AdSlot 컴포넌트, 광고주 센터 UI, 수익 대시보드 |
| DB | Firestore (Blaze) | 광고 · 경매 · 이벤트 · 정산 전체 데이터 |
| Auth | Firebase Auth | 광고주/작성자 역할 구분 (커스텀 클레임) |
| 서버 함수 | Cloud Functions (Node.js 20, asia-northeast3) | 경매 엔진, 일일 정산 배치, 부정클릭 검수 |
| 이미지 | Cloudflare R2 + Worker | 광고 배너 이미지 업로드 (`ad-banners/` 경로) |
| 호스팅 | Firebase Hosting | SPA 전체 |

### 1.3 기존 시스템과의 관계

- 기존 `posts`, `comments`, `users` 컬렉션은 **일절 수정하지 않음**.
- 광고 시스템은 **새로운 컬렉션**(`ads`, `adBids`, `adEvents`, `dailyAdRevenue`, `settlements`, `advertiserAccounts`)을 추가하여 독립적으로 운영.
- 기존 `Post.viewCount`와 `Post.likes`는 광고 노출 우선순위 참고 데이터로 **읽기만** 수행.

---

## 2. Firestore 데이터 모델

> **ID 규칙**: 블루프린트 수칙 5번 준수 — `{prefix}_{timestamp}_{uid}` 형태의 맥락 ID 직접 생성.
> **예외**: `adEvents`는 초당 수백 건 발생 가능하므로 `addDoc` 자동 ID 허용.

### 2.1 `ads` — 광고 소재 (광고주가 등록한 광고 단위)

```typescript
interface Ad {
  id: string;                    // ad_{timestamp}_{advertiserId}
  advertiserId: string;          // 광고주 UID
  advertiserName: string;        // 광고주 표시명 (상호명)

  // ── 소재 정보 ──
  title: string;                 // 광고 제목 (관리용, 유저에게 미노출)
  headline: string;              // 배너 헤드라인 (최대 30자)
  description: string;           // 설명 문구 (최대 60자)
  imageUrl: string;              // 배너 이미지 URL (R2: ad-banners/{advertiserId}/{filename})
  landingUrl: string;            // 클릭 시 이동할 외부 URL
  ctaText: string;               // CTA 버튼 텍스트 (예: "자세히 보기", "지금 구매")

  // ── 타겟팅 ──
  targetCategories: string[];    // 노출 대상 카테고리 (빈 배열 = 전체)
                                 // 값: '너와 나의 이야기' | '판도라의 상자' | '솔로몬의 재판' | ...
  targetRegions: string[];       // 노출 대상 지역 (빈 배열 = 전국)
                                 // 값: '서울' | '부산' | '대구' | ... (시/도 단위)
  targetSlots: ('top' | 'middle' | 'bottom')[]; // 희망 슬롯 위치

  // ── 경매 설정 ──
  bidType: 'cpm' | 'cpc';       // 입찰 방식
  bidAmount: number;             // 입찰가 (원) — CPM이면 1,000노출당, CPC이면 클릭당
  dailyBudget: number;           // 일일 예산 한도 (원)
  totalBudget: number;           // 총 예산 한도 (원)

  // ── 기간 ──
  startDate: Timestamp;          // 광고 시작일
  endDate: Timestamp;            // 광고 종료일

  // ── 상태 ──
  status: 'draft' | 'pending_review' | 'active' | 'paused' | 'rejected' | 'completed' | 'exhausted';
  // draft: 임시저장 | pending_review: 관리자 검수 대기 | active: 노출 중
  // paused: 광고주가 일시정지 | rejected: 관리자 거절 | completed: 기간 만료
  // exhausted: 예산 소진

  rejectionReason?: string;      // 거절 사유 (rejected 상태일 때)

  // ── 누적 지표 (비정규화, Cloud Function이 업데이트) ──
  totalImpressions: number;      // 누적 노출수
  totalClicks: number;           // 누적 클릭수
  totalSpent: number;            // 누적 소진 금액 (원)
  ctr: number;                   // CTR = clicks / impressions (소수점 4자리)

  // ── 메타 ──
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### 2.2 `adBids` — 경매 입찰 스냅샷

> 경매 엔진이 매 시간(또는 실시간) 슬롯별 낙찰을 결정할 때 참조하는 입찰 레코드.
> `ads` 문서의 경매 관련 필드가 변경될 때 트리거로 동기화.

```typescript
interface AdBid {
  id: string;                    // bid_{timestamp}_{adId}
  adId: string;                  // 광고 소재 ID (ads 컬렉션 참조)
  advertiserId: string;          // 광고주 UID
  bidType: 'cpm' | 'cpc';
  bidAmount: number;             // 입찰가
  targetCategories: string[];
  targetRegions: string[];
  targetSlots: ('top' | 'middle' | 'bottom')[];
  dailyBudgetRemaining: number;  // 오늘 남은 예산
  totalBudgetRemaining: number;  // 전체 남은 예산
  status: 'active' | 'paused' | 'exhausted';
  qualityScore: number;          // 품질 점수 (0~100) — CTR 기반 자동 산정
  effectiveBid: number;          // 실효 입찰가 = bidAmount × (qualityScore / 100)
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### 2.3 `adEvents` — 광고 이벤트 로그 (노출/클릭)

> **고빈도 쓰기** — `addDoc` 자동 ID 허용 (블루프린트 수칙 5번 예외).
> 일별 집계 후 30일 경과 건은 Cloud Function으로 아카이브/삭제.

```typescript
interface AdEvent {
  id: string;                    // addDoc 자동 생성
  adId: string;                  // 광고 소재 ID
  advertiserId: string;          // 광고주 UID
  postId: string;                // 노출된 게시글 ID
  postAuthorId: string;          // 게시글 작성자 UID
  postCategory: string;          // 게시글 카테고리
  slotPosition: 'top' | 'middle' | 'bottom';

  eventType: 'impression' | 'click'; // 이벤트 유형
  bidType: 'cpm' | 'cpc';
  bidAmount: number;             // 해당 이벤트 시점의 입찰가

  // ── 부정행위 감지용 ──
  viewerUid: string;             // 열람자 UID (비로그인이면 'anonymous')
  viewerIp: string;              // 열람자 IP (해시값 저장, 원본 미저장)
  viewerRegion: string;          // 열람자 추정 지역
  sessionId: string;             // 세션 ID (세션당 중복 노출 방지)
  userAgent: string;             // UA 문자열 (봇 탐지)
  isSuspicious: boolean;         // 부정행위 의심 플래그 (기본 false)

  createdAt: Timestamp;
}
```

### 2.4 `dailyAdRevenue` — 일일 광고 수익 집계

> Cloud Function `aggregateDailyRevenue`가 매일 자정(KST) 실행하여 `adEvents`를 집계.
> 이 컬렉션이 정산의 기초 데이터.

```typescript
interface DailyAdRevenue {
  id: string;                    // rev_{YYYYMMDD}_{postAuthorId}
  date: string;                  // 'YYYY-MM-DD' (KST 기준)
  postAuthorId: string;          // 글 작성자 UID
  postAuthorNickname: string;    // 닉네임 (표시용)

  // ── 글별 소계 (배열) ──
  postBreakdown: {
    postId: string;
    postTitle: string;
    category: string;
    impressions: number;
    clicks: number;
    grossRevenue: number;        // 세전 총 수익 (원)
  }[];

  // ── 일일 합계 ──
  totalImpressions: number;
  totalClicks: number;
  grossRevenue: number;          // 세전 총 수익 (원)
  creatorShare: number;          // 작성자 몫 (RS 적용 후)
  platformShare: number;         // 플랫폼 몫

  // ── 적용된 RS ──
  revenueShareRate: number;      // 작성자 배분율 (0.0 ~ 1.0)
  creatorLevel: number;          // 해당 일자 기준 작성자 레벨

  // ── 상태 ──
  status: 'provisional' | 'confirmed' | 'adjusted';
  // provisional: 자동 집계 직후 | confirmed: 부정행위 검수 완료 | adjusted: 수동 보정

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### 2.5 `advertiserAccounts` — 광고주 계정 & 잔액

> 광고주의 충전 잔액, 프로필, 세금계산서 정보를 관리.
> ID = 광고주 UID (Firebase Auth UID 그대로 사용).

```typescript
interface AdvertiserAccount {
  id: string;                    // = advertiserId (UID)
  uid: string;                   // Firebase Auth UID

  // ── 사업자 정보 ──
  businessName: string;          // 상호명
  businessNumber: string;        // 사업자등록번호 (000-00-00000)
  representativeName: string;    // 대표자명
  businessAddress: string;       // 사업장 주소
  businessType: string;          // 업태 (예: '소매업')
  businessCategory: string;      // 종목 (예: '음식점')
  email: string;                 // 세금계산서 수신 이메일
  phone: string;                 // 연락처

  // ── 잔액 ──
  balance: number;               // 충전 잔액 (원)
  totalCharged: number;          // 누적 충전액
  totalSpent: number;            // 누적 소진액

  // ── 상태 ──
  status: 'active' | 'suspended' | 'dormant';
  isVerified: boolean;           // 사업자등록 인증 여부

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### 2.6 `chargeHistory` — 광고주 충전 내역

```typescript
interface ChargeHistory {
  id: string;                    // charge_{timestamp}_{advertiserId}
  advertiserId: string;
  amount: number;                // 충전 금액 (원)
  paymentMethod: 'card' | 'bank_transfer' | 'virtual_account';
  paymentGateway: string;        // 결제 대행사 (예: 'portone', 'nicepay')
  transactionId: string;         // PG사 거래 ID
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  taxInvoiceIssued: boolean;     // 세금계산서 발행 여부
  taxInvoiceId?: string;         // 세금계산서 번호
  createdAt: Timestamp;
}
```

### 2.7 `settlements` — 글 작성자 정산 내역

```typescript
interface Settlement {
  id: string;                    // st_{timestamp}_{creatorId}
  creatorId: string;             // 정산 대상자 UID
  creatorNickname: string;       // 닉네임

  // ── 정산 기간 ──
  periodStart: string;           // 'YYYY-MM-DD'
  periodEnd: string;             // 'YYYY-MM-DD'

  // ── 수익 내역 ──
  adRevenue: number;             // 광고 수익 (작성자 몫 합산)
  thanksBallRevenue: number;     // 땡스볼 수익 (해당 기간 수령분)
  grossTotal: number;            // 세전 총액 = adRevenue + thanksBallRevenue

  // ── 세금 ──
  incomeType: 'business' | 'other'; // 사업소득 vs 기타소득
  taxRate: number;               // 원천세율 (0.033 or 0.088)
  taxAmount: number;             // 원천세 = grossTotal × taxRate
  netAmount: number;             // 실지급액 = grossTotal - taxAmount

  // ── 지급 정보 (암호화 저장) ──
  realName: string;              // 실명 (AES-256 암호화)
  idNumberHash: string;          // 주민등록번호 해시 (SHA-256, 원본 미저장)
  bankCode: string;              // 은행 코드 (예: '004' = KB국민)
  bankAccountNumber: string;     // 계좌번호 (AES-256 암호화)

  // ── 상태 ──
  status: 'pending' | 'processing' | 'completed' | 'rejected' | 'cancelled';
  // pending: 출금 신청 | processing: 관리자 승인 후 이체 진행 중
  // completed: 입금 완료 | rejected: 검수 실패 | cancelled: 유저 취소

  rejectionReason?: string;
  completedAt?: Timestamp;

  // ── 세무 신고 ──
  taxReportGenerated: boolean;   // 원천징수영수증 데이터 생성 여부
  taxReportId?: string;          // 세무 신고 참조 번호

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### 2.8 `users` 컬렉션 확장 필드 (기존 문서에 필드 추가)

> 기존 `users/{uid}` 문서에 아래 필드를 **추가**만 한다. 기존 필드는 건드리지 않음.

```typescript
// users/{uid} 추가 필드
interface UserAdFields {
  // ── 광고 수익 ──
  pendingRevenue: number;         // 미정산 광고 수익 (원, increment)
  pendingThanksBall: number;      // 미정산 땡스볼 수익 (원, increment)
  totalSettled: number;           // 누적 정산 완료액 (원)
  lifetimeAdRevenue: number;      // 평생 광고 수익 (통계용)
  lifetimeThanksBallRevenue: number; // 평생 땡스볼 수익 (통계용)

  // ── 정산 정보 (최초 출금 시 1회 입력) ──
  settlementInfo?: {
    realName: string;             // 암호화
    idNumberHash: string;         // 해시
    bankCode: string;
    bankAccountNumber: string;    // 암호화
    isVerified: boolean;          // 본인인증 완료 여부
    verifiedAt?: Timestamp;
  };

  // ── 광고주 여부 ──
  isAdvertiser: boolean;          // true면 광고주 센터 접근 가능
  advertiserAccountId?: string;   // advertiserAccounts 컬렉션 ID
}
```

### 2.9 컬렉션 관계도 (ERD 요약)

```
users ──────────────── 1:N ──── posts (기존)
  │                                │
  │ (pendingRevenue)               │ (postId)
  │                                │
  ├── 1:N ── settlements           ├── 1:N ── adEvents
  │            (creatorId)         │            (postId, postAuthorId)
  │                                │
  ├── 1:1 ── advertiserAccounts    ├── N:1 ── ads
  │            (uid)               │            (adId)
  │                                │
  │                                └── N:1 ── adBids
  │                                            (adId)
  │
  └── 1:N ── dailyAdRevenue
               (postAuthorId)

advertiserAccounts ── 1:N ── chargeHistory
                       │
                       └── 1:N ── ads ── 1:N ── adBids
```

---

## 3. 광고 경매 시스템

### 3.1 2종 광고 슬롯 체계

> 광고 슬롯은 **플랫폼 광고**와 **작성자 광고** 2종류로 분리 운영.

#### 플랫폼 광고 (글러브팀 자체 프로모션)
| 유저 레벨 | 슬롯 | 위치 | 수익 | 설명 |
|-----------|------|------|------|------|
| Lv 2+ | 1 | bottom | 0% | 깐부찾기·나무심기 등 앱 내 기능 홍보. 클릭 시 새 창 열기. |
| Lv 1 | 0 | — | — | 광고 없음 |

#### 작성자 광고 (경매/애드센스 — 수익 배분)
| 유저 레벨 | 슬롯 | 위치 | 작성자 RS | 플랫폼 RS | 설정 |
|-----------|------|------|-----------|-----------|------|
| Lv 1~4 | 0 | — | 0% | — | 없음 |
| Lv 5~6 | 1 | bottom | 30% | 70% | 새글 작성 시 ON/OFF 선택 |
| Lv 7~8 | 2 | top, bottom | 50% | 50% | 새글 작성 시 ON/OFF 선택 |
| Lv 9~10 | 3 | top, middle, bottom | 70% | 30% | 새글 작성 시 ON/OFF 선택 |

- 작성자는 새글 작성 시 **광고마켓(경매)** 또는 **구글 애드센스** 중 선택 가능.
- `posts/{id}.adSlotEnabled: boolean`, `adSlotType: 'auction' | 'adsense'` 필드 저장.
- 작성자 광고 OFF 시 해당 글에는 플랫폼 광고만 표시.

#### 지역 타겟팅 (경매 통합)

지역광고는 별도 옵션이 아니라 **기존 경매 시스템에 통합**되어 자동 처리된다.

- 광고주가 `targetRegions: ["서울", "경기"]`로 설정하면 해당 지역 열람자에게 우선 매칭
- 열람자 지역은 **IP 기반 자동 추정** (`getViewerRegion()` — ipapi.co 무료 API)
- 영문 지역명 → 한글 시/도 매핑 후 `viewerRegion` 파라미터로 경매 엔진에 전달
- 30분 sessionStorage 캐시 (API 호출 최소화)
- 추정 실패 시 빈 문자열 → 전국 타겟 광고만 매칭 (graceful fallback)

| 광고주 targetRegions | 열람자 viewerRegion | 결과 |
|---------------------|-------------------|------|
| `["경기"]` | `"경기"` | 매칭 |
| `["경기"]` | `"서울"` | 미매칭 (스킵) |
| `["경기"]` | `""` (미추정) | 통과 (일단 노출) |
| `[]` (전국) | 아무 값 | 항상 통과 |

### 3.2 경매 엔진 로직 (Cloud Function: `runAdAuction`)

```
입력: slotPosition, postCategory, viewerRegion
출력: 낙찰된 Ad 또는 Waterfall 결과

1. adBids 쿼리:
   WHERE status == 'active'
   AND targetSlots array-contains slotPosition
   AND (targetCategories == [] OR targetCategories array-contains postCategory)
   AND (targetRegions == [] OR targetRegions array-contains viewerRegion)
   AND dailyBudgetRemaining > 0
   AND totalBudgetRemaining > 0

2. effectiveBid(실효 입찰가) 내림차순 정렬
   effectiveBid = bidAmount × (qualityScore / 100)

3. 1위 낙찰 — 실제 과금은 2위 입찰가 + 1원 (Second-Price Auction)
   chargeAmount = secondPlaceBid + 1

4. 낙찰 광고 없으면 → Waterfall:
   (a) 구글 애드센스 네트워크 광고 요청
   (b) 애드센스도 없으면 → 자체 프로모션 배너 (수익 0)
```

> ✅ **실제 구현 (functions/auction.js — Phase 5)**
> - viewerRegion 파라미터 수신 (클라이언트에서 IP 추정 후 전달)
> - 필터 조건: `ad.targetRegions.length > 0 && viewerRegion && !ad.targetRegions.includes(viewerRegion)` → 스킵
> - viewerRegion이 빈 문자열이면 지역 필터 무시 (전국 매칭)

### 3.3 Waterfall 우선순위 상세

| 순위 | 소스 | 단가 | 구현 방식 |
|------|------|------|-----------|
| 1순위 | 할말있소 직거래 광고 | 최상 | Firestore `adBids` 경매 |
| 2순위 | 구글 애드센스 | 중간 | `<ins class="adsbygoogle">` 스니펫 삽입 |
| 3순위 | 자체 프로모션 | 0 | 하드코딩된 프로모션 배너 컴포넌트 |

### 3.4 실시간 vs 배치 경매

| 항목 | Phase 1~2 (초기) | Phase 3+ (확장) |
|------|-----------------|-----------------|
| 경매 시점 | 클라이언트 요청 시 실시간 | 매 시간 배치 + 캐시 |
| 구현 | Cloud Function HTTP | Scheduled Function + Firestore 캐시 |
| 낙찰 결과 저장 | 없음 (매번 계산) | `adAuctionResults/{slotKey}` 캐시 1시간 TTL |

### 3.5 품질 점수 (Quality Score) 산정

```
qualityScore = clamp(
  (CTR × 1000) × 0.6         // CTR 가중치 60%
  + adRelevanceScore × 0.3    // 카테고리 관련도 30% (0~100)
  + landingPageScore × 0.1,   // 랜딩 페이지 존재 여부 10% (0 or 100)
  0,
  100
)
```

- **CTR**: 최근 7일간 `clicks / impressions`. 신규 광고는 기본값 50.
- **adRelevanceScore**: 광고 키워드와 카테고리 매칭도 (초기에는 수동 100, 추후 자동화).
- **landingPageScore**: `landingUrl`이 유효한 URL이면 100, 아니면 0.

---

## 4. 글 작성자 수익 시스템

### 4.1 수익 발생 경로

```
A. 광고 노출 수익 (CPM)
   adEvent(impression) → dailyAdRevenue 집계 → pendingRevenue 누적

B. 광고 클릭 수익 (CPC)
   adEvent(click) → dailyAdRevenue 집계 → pendingRevenue 누적

C. 땡스볼 수익
   thanksball 수신 → pendingThanksBall 누적 (기존 로직 유지)
```

### 4.2 수익 계산 공식

```
일일 광고 수익(작성자 몫) = Σ(글별 수익)

글별 수익 = (
  (impressions / 1000 × CPM단가)     // 노출 수익
  + (clicks × CPC단가)               // 클릭 수익
) × revenueShareRate(레벨)           // RS 배분율

예시: Lv 7 유저, 특정 글에 CPM 1,000원 광고가 노출
- 노출 10,000회 → (10,000 / 1,000) × 1,000 = 10,000원
- 클릭 100회 × CPC 200원 = 20,000원
- 총 수익 = 30,000원
- 작성자 몫 = 30,000 × 0.5 = 15,000원
```

### 4.3 MyPage 수익 대시보드 UI 명세

```
┌─────────────────────────────────────────────────┐
│  💰 내 수익                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ 광고수익  │  │ 땡스볼   │  │ 합계     │       │
│  │ ₩12,500  │  │ ₩ 5,000  │  │ ₩17,500  │       │
│  └──────────┘  └──────────┘  └──────────┘       │
│                                                  │
│  📊 최근 7일 수익 추이 (미니 차트)                │
│  ├─ 4/1: ₩2,100                                 │
│  ├─ 4/2: ₩1,800                                 │
│  └─ ...                                          │
│                                                  │
│  📋 글별 수익 상세                                │
│  ┌───────────────────────────────────────────┐   │
│  │ 글 제목          │ 노출  │ 클릭 │ 수익   │   │
│  │ "AI 시대의..."   │ 5,200 │  45  │ ₩6,300│   │
│  │ "부산 맛집..."   │ 3,100 │  28  │ ₩4,100│   │
│  └───────────────────────────────────────────┘   │
│                                                  │
│  [출금 신청] (₩30,000 이상 시 활성화)             │
│  누적 정산 완료: ₩ 85,000                         │
└─────────────────────────────────────────────────┘
```

### 4.4 출금 신청 플로우

```
1. 유저가 MyPage에서 [출금 신청] 클릭
2. 미정산 잔액 ≥ 30,000원 확인
3. 최초 신청 시: 정산 정보 입력 모달 표시
   - 실명, 주민등록번호, 은행 선택, 계좌번호
   - 본인인증 (휴대폰 인증 — 향후 연동)
4. settlementInfo 저장 (암호화)
5. settlements 컬렉션에 새 문서 생성 (status: 'pending')
6. users/{uid}.pendingRevenue 차감, pendingThanksBall 차감
7. 관리자에게 알림 → 검수 → 승인/거절
8. 승인 시: 이체 실행 → status: 'completed'
```

### 4.5 Lv 7+ 광고 선택 기능

```
Lv 7 이상 유저는 본인 글에 노출될 광고 카테고리를 선택 가능.
- PostDetailModal 또는 CreateXxx 폼에 "광고 설정" 섹션 추가
- 선택 가능한 광고 카테고리: 음식점 | IT/테크 | 교육 | 패션 | 뷰티 | 금융 | 기타
- 선택하지 않으면 시스템 자동 할당 (기본값)
- 선택 결과는 posts/{postId}.preferredAdCategories 필드에 저장
```

---

## 5. 광고주 센터

### 5.1 접근 경로

```
사이드바 메뉴: "광고주 센터" (isAdvertiser === true 일 때만 표시)
URL: /adsmarket (React Router lazy load)
```

### 5.2 광고주 등록 플로우

```
1. 일반 유저가 사이드바 → "광고주 되기" 클릭
2. 사업자 정보 입력 폼:
   - 상호명, 사업자등록번호, 대표자명, 주소, 업태, 종목
   - 세금계산서 수신 이메일, 연락처
3. 사업자등록 인증 (API 검증 — 향후 연동, 초기에는 수동 승인)
4. advertiserAccounts 문서 생성
5. users/{uid}.isAdvertiser = true 설정
6. 관리자 승인 후 status: 'active'
```

### 5.3 광고주 센터 UI 구조

```
/adsmarket
├── /dashboard        ─ 광고 성과 대시보드 (전체 요약)
├── /campaigns        ─ 내 광고 목록 (CRUD)
│   ├── /new          ─ 새 광고 등록
│   └── /:adId        ─ 광고 상세/수정
├── /billing          ─ 충전 & 결제 내역
│   ├── /charge       ─ 잔액 충전
│   └── /invoices     ─ 세금계산서 목록
└── /settings         ─ 사업자 정보 수정
```

### 5.4 광고 등록(캠페인 생성) 폼 명세

```
┌─────────────────────────────────────────────────┐
│  📢 새 광고 등록                                  │
│                                                  │
│  광고 제목 (관리용)  [________________________]   │
│  헤드라인 (30자)     [________________________]   │
│  설명 (60자)         [________________________]   │
│  CTA 버튼 텍스트     [________________________]   │
│  랜딩 URL            [________________________]   │
│                                                  │
│  배너 이미지 (720×90 또는 300×250)               │
│  [이미지 업로드] ← R2 ad-banners/ 경로           │
│                                                  │
│  ── 타겟팅 ──                                    │
│  카테고리 (다중 선택)  □ 전체  □ 너와 나의 이야기  │
│                       □ 솔로몬의 재판  □ ...      │
│  지역 (다중 선택)     □ 전국  □ 서울  □ 부산 ...  │
│  슬롯 위치            □ 상단  □ 중단  □ 하단      │
│                                                  │
│  ── 입찰 ──                                      │
│  입찰 방식  ○ CPM (노출당)  ○ CPC (클릭당)       │
│  입찰가 (원)         [________]                   │
│  일일 예산 (원)      [________]                   │
│  총 예산 (원)        [________]                   │
│                                                  │
│  ── 기간 ──                                      │
│  시작일  [____-__-__]  종료일  [____-__-__]       │
│                                                  │
│  [임시저장]  [검수 요청]                          │
└─────────────────────────────────────────────────┘
```

### 5.5 광고주 대시보드 UI 명세

```
┌─────────────────────────────────────────────────┐
│  📊 광고 성과 대시보드                            │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ 잔액     │  │ 오늘 소진│  │ 총 소진  │       │
│  │ ₩150,000│  │ ₩ 3,200 │  │ ₩47,800 │       │
│  └──────────┘  └──────────┘  └──────────┘       │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ 총 노출  │  │ 총 클릭  │  │ 평균 CTR │       │
│  │ 125,400 │  │   892    │  │  0.71%   │       │
│  └──────────┘  └──────────┘  └──────────┘       │
│                                                  │
│  📈 최근 7일 노출/클릭 추이 (차트)               │
│                                                  │
│  📋 내 광고 목록                                  │
│  ┌─────────────────────────────────────────┐     │
│  │ 광고명      │ 상태   │ 노출  │ CTR   │ 소진  │
│  │ "봄 세일"   │ 활성   │ 45K  │ 0.8% │ ₩12K │
│  │ "신메뉴"    │ 일시정지│ 12K  │ 0.3% │ ₩ 4K │
│  └─────────────────────────────────────────┘     │
│                                                  │
│  [+ 새 광고 등록]  [잔액 충전]                    │
└─────────────────────────────────────────────────┘
```

### 5.6 충전 & 결제

```
1. 광고주가 [잔액 충전] 클릭
2. 충전 금액 입력 (최소 10,000원, 최대 5,000,000원)
3. 결제 수단 선택: 신용카드 / 실시간 계좌이체 / 가상계좌
4. PG사(포트원 또는 나이스페이) 결제창 호출
5. 결제 완료 → chargeHistory 문서 생성 + advertiserAccounts.balance increment
6. 세금계산서 자동 발행 요청 (별도 API or 수동)
```

---

## 6. 세무 · 정산 시스템

### 6.1 세무 분류 기준

| 수익 항목 | 세무 분류 | 세율 | 판단 기준 |
|-----------|----------|------|-----------|
| 광고 수익 (지속적) | 사업소득 | 3.3% | 월 3회 이상 정산 or 연 100만원 초과 |
| 광고 수익 (일시적) | 기타소득 | 8.8% | 위 기준 미달 |
| 땡스볼 (후원) | 기타소득 | 8.8% | 건당 5만원 이하 비과세 적용 가능 |

> **초기 구현**: 모든 정산을 **기타소득 8.8%**로 일괄 처리.
> 유저가 사업자등록을 했으면 **사업소득 3.3%** 선택 가능하도록 옵션 제공.

### 6.2 정산 프로세스 상세

```
┌─────────────────────────────────────────────────────────────┐
│  정산 프로세스 흐름도                                         │
│                                                              │
│  [매일 자정]                                                  │
│  Cloud Function: aggregateDailyRevenue                       │
│  → adEvents 집계 → dailyAdRevenue 생성                       │
│  → users/{uid}.pendingRevenue increment                      │
│                                                              │
│  [유저 액션]                                                  │
│  MyPage → [출금 신청] → settlements(pending) 생성             │
│  → pendingRevenue 차감                                       │
│                                                              │
│  [매주 월요일 or 관리자 수동]                                  │
│  Cloud Function: processSettlements                          │
│  → pending 건 조회 → 부정행위 검수 → 원천세 계산              │
│  → 이체 API 호출 → status: 'completed'                       │
│  → taxReportGenerated: true                                  │
│                                                              │
│  [매년 3월]                                                   │
│  Admin → [연간 지급명세서 다운로드]                            │
│  → settlements에서 연간 합산 → 국세청 양식 CSV 생성           │
└─────────────────────────────────────────────────────────────┘
```

### 6.3 원천세 자동 계산 로직

```typescript
// utils.ts에 추가할 정산 유틸리티 함수

/**
 * 원천세 계산
 * @param grossAmount 세전 총액
 * @param incomeType 소득 유형
 * @returns { taxAmount, netAmount, taxRate }
 */
function calculateWithholdingTax(
  grossAmount: number,
  incomeType: 'business' | 'other'
): { taxAmount: number; netAmount: number; taxRate: number } {
  const taxRate = incomeType === 'business' ? 0.033 : 0.088;
  const taxAmount = Math.floor(grossAmount * taxRate);
  const netAmount = grossAmount - taxAmount;
  return { taxAmount, netAmount, taxRate };
}

/**
 * 땡스볼 과세 계산 (건당 5만원 이하 비과세)
 * @param balls 해당 기간 수신 땡스볼 목록
 * @returns 과세 대상 총액
 */
function calculateThanksBallTax(
  balls: { amount: number; isPaid: boolean }[]
): number {
  return balls
    .filter(b => b.isPaid && b.amount > 50) // 50볼 = ₩50,000 초과분만 과세
    .reduce((sum, b) => sum + (b.amount - 50) * 1000, 0);
}
```

### 6.4 세무 신고 데이터 Export (Admin 전용)

```
Admin 페이지 → [세무 데이터 다운로드]

출력 파일: halmal_tax_report_2026.csv

컬럼:
순번, 소득자성명, 주민등록번호, 소득구분코드, 지급액, 세율, 원천징수세액,
지급일자, 귀속연월, 비고

→ 국세청 홈택스 '거주자 사업소득/기타소득 원천징수영수증' 업로드 양식에 맞춤
```

### 6.5 광고주 세금계산서

```
광고주가 충전할 때:
1. chargeHistory에 결제 내역 기록
2. 세금계산서 발행 대상 = VAT 10% 포함 금액
3. 발행 방식:
   (a) 포트원/나이스페이 PG 연동 시: PG사가 자동 발행
   (b) 수동: 관리자가 국세청 홈택스에서 전자세금계산서 직접 발행
4. chargeHistory.taxInvoiceIssued = true 업데이트
```

---

## 7. 부정행위 방지

### 7.1 감지 규칙 (Cloud Function: `detectFraud`)

| 규칙 ID | 감지 대상 | 조건 | 조치 |
|---------|----------|------|------|
| F001 | 자기 글 자기 클릭 | `viewerUid === postAuthorId` | 이벤트 무효화 (`isSuspicious: true`) |
| F002 | 동일 IP 반복 클릭 | 같은 IP에서 동일 광고 5분 내 2회 이상 | 2회차부터 무효화 |
| F003 | 동일 세션 반복 노출 | 같은 `sessionId`에서 동일 슬롯 재노출 | 2회차부터 과금 제외 |
| F004 | 봇 트래픽 | `userAgent`가 알려진 봇 패턴 매칭 | 이벤트 전체 무효화 |
| F005 | 비정상 CTR | 특정 광고의 일일 CTR > 10% | 해당 광고 일시정지 + 관리자 알림 |
| F006 | 클릭팜 의심 | 동일 IP 대역(C클래스)에서 10분 내 10회 이상 클릭 | 해당 IP 대역 24시간 차단 |

### 7.2 검수 프로세스

```
1. adEvent 생성 시 기본 규칙(F001~F003) 즉시 적용 → isSuspicious 플래그
2. 매일 자정 aggregateDailyRevenue 실행 전:
   - detectFraud 함수가 전일 adEvents 스캔
   - F004~F006 규칙 적용 → 추가 isSuspicious 마킹
3. dailyAdRevenue 집계 시 isSuspicious === true 이벤트 제외
4. 심각한 부정행위 발견 시:
   - 해당 유저의 settlements 전체 보류
   - 관리자 알림 → 수동 검토
```

---

## 8. UI 컴포넌트 목록 & 파일 구조

### 8.1 신규 추가 파일 목록

```
/src
├── types.ts                     # AdEvent, Ad, Settlement 등 인터페이스 추가
├── constants.ts                 # AD_CATEGORIES, BANK_CODES, TAX_RATES 추가
├── utils.ts                     # calculateWithholdingTax, calculateThanksBallTax 추가
│
├── components/
│   ├── ads/                     # ★ 광고 시스템 컴포넌트 (신규 디렉토리)
│   │   ├── AdSlot.tsx           # 광고 슬롯 컴포넌트 (position, userLevel, postCategory 기반)
│   │   ├── AdBanner.tsx         # 단일 광고 배너 렌더링 (이미지 + 헤드라인 + CTA)
│   │   └── AdFallback.tsx       # Waterfall 폴백 (애드센스 or 자체 프로모션)
│   │
│   ├── revenue/                 # ★ 수익 대시보드 컴포넌트 (MyPage 내 탭)
│   │   ├── RevenueDashboard.tsx # 수익 종합 대시보드 (메인)
│   │   ├── RevenueChart.tsx     # 7일 수익 추이 미니 차트
│   │   ├── RevenueByPost.tsx    # 글별 수익 상세 테이블
│   │   ├── WithdrawModal.tsx    # 출금 신청 모달
│   │   └── SettlementInfo.tsx   # 정산 정보 입력/수정 폼
│   │
│   ├── advertiser/              # ★ 광고주 센터 컴포넌트 (신규 라우트)
│   │   ├── AdvertiserLayout.tsx # 광고주 센터 레이아웃 (사이드바 + 콘텐츠)
│   │   ├── AdDashboard.tsx      # 광고 성과 대시보드
│   │   ├── AdCampaignList.tsx   # 내 광고 목록
│   │   ├── AdCampaignForm.tsx   # 광고 등록/수정 폼
│   │   ├── AdCampaignDetail.tsx # 광고 상세 (성과 차트 포함)
│   │   ├── BillingPage.tsx      # 충전 & 결제 내역
│   │   ├── ChargeModal.tsx      # 잔액 충전 모달 (PG 연동)
│   │   ├── InvoiceList.tsx      # 세금계산서 목록
│   │   ├── AdvertiserRegister.tsx # 광고주 등록 폼
│   │   └── AdvertiserSettings.tsx # 사업자 정보 수정
│   │
│   ├── admin/                   # ★ 관리자 기능 (Phase 5 구현 완료)
│   │   ├── AdAdminPage.tsx      # 관리자 4탭 컨테이너 + 권한 체크
│   │   ├── AdReviewQueue.tsx    # 광고 검수 대기열 (승인/거절)
│   │   ├── SettlementQueue.tsx  # 정산 승인 대기열 (승인/거절/보류 + 잔액 원복)
│   │   ├── FraudAlerts.tsx      # 부정행위 의심 이벤트 목록
│   │   └── TaxReportExport.tsx  # 세무 데이터 CSV 내보내기
│   │
│   └── MyContentTabs.tsx        # 기존 파일에 '수익' 탭 추가
│
├── utils/
│   └── getViewerRegion.ts       # ★ IP 기반 열람자 지역 추정 (ipapi.co + sessionStorage 캐시)
│
├── hooks/
│   ├── useAdSlot.ts             # AdSlot 경매 요청 & 결과 캐싱 hook
│   ├── useRevenue.ts            # 수익 데이터 구독 hook
│   ├── useAdvertiser.ts         # 광고주 계정 & 광고 CRUD hook
│   └── useSettlement.ts         # 정산 신청 & 상태 조회 hook
│
└── firebase.ts                  # Firestore 컬렉션 레퍼런스 추가

/functions
├── index.js                     # 기존 마라톤의 전령 뉴스봇
├── adAuction.js                 # ★ 경매 엔진 (HTTP Function)
├── aggregateDailyRevenue.js     # ★ 일일 수익 집계 (Scheduled: 매일 00:05 KST)
├── detectFraud.js               # ★ 부정행위 탐지 (Scheduled: 매일 00:00 KST)
├── processSettlements.js        # ★ 정산 처리 (Scheduled: 매주 월 09:00 KST)
├── adTriggers.js                # ★ syncAdBids + updateAdMetrics (Firestore v2 Trigger, Phase 5 구현)
└── package.json                 # 의존성 추가

/upload-worker
└── src/index.ts                 # 기존 + ad-banners/ 경로 추가
```

### 8.2 기존 파일 수정 사항 (Surgical Edit 원칙)

| 파일 | 수정 내용 | 영향 범위 |
|------|----------|----------|
| `App.tsx` | 광고주 센터 라우트 추가 (`/adsmarket/*`), `Suspense + lazy` | 라우팅 섹션만 |
| `Sidebar.tsx` | "광고주 센터" 메뉴 항목 추가 (isAdvertiser 조건부) | 메뉴 리스트 끝부분 |
| `MyContentTabs.tsx` | '수익' 탭 추가 → `RevenueDashboard` 렌더 | 탭 배열에 1개 항목 추가 |
| `PostDetailModal.tsx` | `<AdSlot>` 컴포넌트 3개소 삽입 (top/middle/bottom) | 본문 영역 사이 |
| `DiscussionView.tsx` | `<AdSlot>` 컴포넌트 삽입 | 본문과 댓글 사이 |
| `OneCutDetailView.tsx` | `<AdSlot>` 컴포넌트 삽입 | 이미지 아래 |
| `types.ts` | 신규 인터페이스 추가 | 파일 끝에 append |
| `constants.ts` | 상수 추가 | 파일 끝에 append |
| `utils.ts` | 세금 계산 함수 추가 | 파일 끝에 append |
| `firebase.ts` | 컬렉션 레퍼런스 추가 | export 섹션 |
| `upload-worker/src/index.ts` | `ad-banners/` 경로 허용 추가 | 경로 검증 로직 |
| `CreateNakedKing.tsx` | AdSlotSetting 삽입 (Phase 5) | 폼 하단 |
| `CreateGiantTree.tsx` | AdSlotSetting 삽입 (Phase 5) | 폼 하단 |
| `Sidebar.tsx` | '광고 관리' 메뉴 추가 (관리자 전용, Phase 5) | 메뉴 리스트 |
| `App.tsx` | `ad_admin` 라우팅 + AdAdminPage lazy load (Phase 5) | 라우팅 섹션 |
| `constants.ts` | `PLATFORM_ADMIN_NICKNAMES` 화이트리스트 (Phase 5) | 상수 추가 |
| `firestore.rules` | `isAdmin()` 함수 + 관리자 update 허용 (Phase 5) | Rules 섹션 |
| `functions/index.js` | adTriggers re-export 추가 (Phase 5) | export 섹션 |
| `AdSlot.tsx` | viewerRegion 파라미터 추가 (getViewerRegion 호출, Phase 5) | fetch 요청 부분 |
| `functions/auction.js` | viewerRegion 수신 + targetRegions 필터 로직 추가 (Phase 5) | 경매 필터 섹션 |

---

## 9. Cloud Functions 명세

### 9.1 `adAuction` (HTTP Function)

```
엔드포인트: POST /adAuction
입력 (JSON Body):
{
  slotPosition: 'top' | 'middle' | 'bottom',
  postCategory: string,
  postId: string,
  postAuthorId: string,
  postAuthorLevel: number,
  viewerRegion: string     // 클라이언트에서 추정 (IP 기반)
}

출력:
{
  success: true,
  ad: {
    adId: string,
    headline: string,
    description: string,
    imageUrl: string,
    landingUrl: string,
    ctaText: string,
    bidType: 'cpm' | 'cpc',
    chargeAmount: number    // Second-Price 과금액
  } | null,
  fallback: 'adsense' | 'promo' | null  // 낙찰 광고 없을 때
}

로직:
1. postAuthorLevel에 따라 해당 슬롯 허용 여부 확인
2. adBids에서 매칭 입찰 조회
3. effectiveBid 정렬 → 1위 낙찰
4. 낙찰 시: adEvents에 impression 기록, ads.totalImpressions increment
5. 미낙찰 시: fallback 반환
```

### 9.2 `aggregateDailyRevenue` (Scheduled Function)

```
스케줄: 매일 00:05 KST (every day 15:05 UTC)
리전: asia-northeast3

로직:
1. 어제 날짜의 adEvents 전체 조회 (isSuspicious === false만)
2. postAuthorId별 그룹핑
3. 각 작성자의 레벨 조회 → RS 비율 결정
4. dailyAdRevenue 문서 생성
5. users/{uid}.pendingRevenue increment (작성자 몫)
6. 광고주별 소진 금액 집계 → advertiserAccounts.balance decrement
7. ads.totalSpent, ads.totalImpressions, ads.totalClicks 업데이트
```

### 9.3 `detectFraud` (Scheduled Function)

```
스케줄: 매일 00:00 KST (every day 15:00 UTC)
리전: asia-northeast3

로직:
1. 어제 날짜의 adEvents 전체 스캔
2. 규칙 F004~F006 적용
3. isSuspicious 플래그 업데이트 (batch write)
4. 심각 건 발견 시 관리자 알림 (notifications 컬렉션 활용)
```

### 9.4 `processSettlements` (Scheduled Function)

```
스케줄: 매주 월요일 09:00 KST (every monday 00:00 UTC)
리전: asia-northeast3

로직:
1. settlements WHERE status === 'pending' 조회
2. 각 건에 대해:
   a. 해당 유저의 isSuspicious 이벤트 비율 확인 (>20%이면 보류)
   b. 원천세 계산 (calculateWithholdingTax)
   c. 이체 API 호출 (Phase 1에서는 수동 → 관리자에게 알림만)
   d. status → 'processing' → 'completed'
   e. taxReportGenerated = true
3. 완료 건 유저에게 알림 발송
```

### 9.5 `syncAdBids` (Firestore Trigger)

```
트리거: onUpdate ads/{adId}

로직:
1. ads 문서의 bidAmount, targetCategories, targetRegions, targetSlots, status 변경 감지
2. 대응하는 adBids 문서 업데이트 (없으면 생성)
3. status가 'active' 아니면 adBids.status도 동기화
```

> ✅ Phase 5에서 구현 완료 (2026-04-10). `functions/adTriggers.js`에 통합.
> v2 API 사용: `onDocumentUpdated`. 리전: asia-northeast3.
> 첫 생성 시 createdAt 추가, 이후 merge update. 품질 점수 + effectiveBid 자동 계산.

### 9.6 `updateAdMetrics` (Firestore Trigger)

```
트리거: onCreate adEvents/{eventId}

로직:
1. 이벤트가 impression이면: ads/{adId}.totalImpressions increment
2. 이벤트가 click이면: ads/{adId}.totalClicks increment
3. ads/{adId}.ctr 재계산
4. adBids/{bidId}.qualityScore 재계산 (최근 7일 CTR 기반)
5. adBids/{bidId}.dailyBudgetRemaining 차감
```

> ✅ Phase 5에서 구현 완료 (2026-04-10). `functions/adTriggers.js`에 통합.
> v2 API 사용: `onDocumentCreated`. 리전: asia-northeast3.
> isSuspicious 이벤트는 지표에 미반영. CPM/CPC 자동 과금. 예산 소진 시 ads.status='exhausted' 자동 변경.

---

## 10. 구현 로드맵

> 최종 갱신: 2026-04-10 | Phase 1, 3, 4, 5 완료. Phase 2는 애드센스 승인 대기.

### Phase 1: 기반 구축 — ✅ 완료 (2026-04-06)

```
✅ types.ts에 Ad, AdEvent, DailyAdRevenue, AdvertiserAccount, Settlement 인터페이스 추가
✅ constants.ts에 AD_REVENUE_SHARE, AD_CATEGORIES, BANK_CODES, TAX_RATES, SETTLEMENT_MIN_AMOUNT 추가
✅ Firestore Security Rules 작성 (ads, adEvents, dailyAdRevenue, settlements 등 6개 컬렉션)
✅ AdSlot + AdBanner + AdFallback 컴포넌트 (ads/ 디렉토리)
✅ DiscussionView, OneCutDetailView에 AdSlot 삽입
✅ MyPage에 💰 수익 탭 + RevenueDashboard 스켈레톤
```

### Phase 2: 구글 애드센스 연동 — ⏳ 대기 중

```
선행 조건: 구글 애드센스 승인 필요 (https://www.google.com/adsense)
- 게시글 20~30개 + 양질의 콘텐츠 + 개인정보처리방침 페이지 필요
- 승인 후 ads.txt 파일 추가 + AdFallback에 애드센스 스니펫 삽입

작업 (승인 후):
□ AdFallback 컴포넌트에 애드센스 스니펫 삽입
□ AdSlot에 Waterfall 로직 강화 (1순위 경매 없으면 → 애드센스)
□ RevenueDashboard에 실제 수익 데이터 바인딩
```

### Phase 3: 직거래 경매 시스템 — ✅ 완료 (2026-04-06)

```
✅ 광고주 등록 플로우 (AdvertiserRegister.tsx)
✅ 광고주 센터 전체 UI (AdvertiserCenter.tsx — 대시보드·내 광고·충전·설정 4탭)
✅ 광고 등록/수정 폼 (AdCampaignForm.tsx — 소재·타겟팅·입찰·기간)
✅ 광고 목록 (AdCampaignList.tsx — 상태 배지·성과 지표)
✅ 광고 배너 이미지 R2 업로드 (ad-banners/ 경로, Worker UID 검증)
✅ Sidebar 광고주 센터 메뉴 + App.tsx adsmarket 라우팅
✅ Cloud Function: adAuction (HTTP 경매 엔진, Second-Price)
✅ Cloud Function: detectFraud (매일 자정 부정행위 탐지)
✅ AdSlot에서 adAuction 호출 연동 (낙찰 광고 or 프로모션 Waterfall)

미구현 (향후):
□ Cloud Function: syncAdBids (ads 변경 시 adBids 동기화 — Firestore Trigger)
□ Cloud Function: updateAdMetrics (adEvents 생성 시 누적 지표 업데이트 — Firestore Trigger)
□ 충전 시스템 PG사 연동 (포트원 권장) — 현재 충전 UI는 준비 중 표시
□ 관리자: AdReviewQueue (광고 검수 대기열)
□ 품질 점수(Quality Score) 자동 산정 (CTR 기반)
```

### Phase 4: 정산 & 세무 자동화 — ✅ 완료 (2026-04-06)

```
✅ 출금 신청 모달 (WithdrawModal.tsx — 소득 유형·실명·은행·계좌·원천세 자동 계산)
✅ utils.ts: calculateWithholdingTax 함수 (사업소득 3.3% / 기타소득 8.8%)
✅ RevenueDashboard에서 출금 모달 연동 (₩30,000 이상 시 활성화)
✅ Cloud Function: processSettlements (매주 월 09:00 KST 자동 처리)
✅ Cloud Function: aggregateDailyRevenue (매일 00:05 KST 일일 수익 집계)

미구현 (향후):
□ 이체 API 연동 (수동 승인 → 은행 API 자동 이체)
□ 정산 정보 AES-256 암호화 (현재는 평문 저장 → 실서비스 전 암호화 필수)
□ 광고주 세금계산서 관리 (InvoiceList)
```

### Phase 5: AdSlotSetting 전체 적용 + 지역 타겟팅 + 관리자 UI — ✅ 완료 (2026-04-10)

```
✅ AdSlotSetting 12개 글 작성 폼 전체 적용 (CreateNakedKing, CreateGiantTree 포함)
✅ viewerRegion IP 기반 추정 (getViewerRegion.ts — ipapi.co + sessionStorage 캐시)
✅ 경매 엔진 targetRegions 필터 구현 (auction.js)
✅ syncAdBids Firestore Trigger (ads 변경 → adBids 동기화)
✅ updateAdMetrics Firestore Trigger (adEvents → ads 누적 지표 + 품질 점수 + 예산 소진 자동 처리)
✅ calculateQualityScore 공통 함수 (CTR 60% + 관련도 30% + 랜딩 10%)
✅ 관리자 페이지 4탭 (AdAdminPage — 검수/정산/부정행위/세무)
✅ AdReviewQueue (광고 승인/거절 + 사유 입력)
✅ SettlementQueue (정산 승인/거절/보류 + pendingRevenue 원복)
✅ FraudAlerts (isSuspicious 이벤트 100건 + 일/주 카운트)
✅ TaxReportExport (기간 선택 + CSV 다운로드 + BOM 한글 지원)
✅ isAdmin() Rules 함수 + 관리자 전용 update 허용
✅ PLATFORM_ADMIN_NICKNAMES 화이트리스트 (MVP — 정식 출시 전 Custom Claims 전환 필요)
✅ Firestore Rules 보강 (ads/settlements/users 관리자 권한)
```

### 앞으로 해야 할 일 (수동 작업 + 미구현)

```
[외부 진행 필요]
□ 구글 애드센스 승인 신청 → 승인 후 AdFallback에 스니펫 삽입
□ PG사 계약 (포트원) → 광고주 잔액 충전 기능 활성화
□ 사업자등록 → 세금계산서 발행 전제
□ 개인정보처리방침 페이지 → 애드센스 + 정산 정보 수집에 필요

[코드 작업 — 선행 조건 필요]
□ 애드센스 스니펫 삽입 (AdFallback — 승인 후)
□ PG 충전 연동 (ChargeModal + 포트원 SDK — 계약 후)
□ 이체 API 자동화 (processSettlements — 은행 API 연동)
□ 정산 정보 AES-256 암호화 (실서비스 전 필수)
□ 광고주 세금계산서 관리 (InvoiceList — 사업자등록 후)

[코드 작업 — 언제든 가능]
□ 관리자 권한을 Firebase Custom Claims로 전환 (현재 닉네임 기반)
□ viewerRegion을 유저 프로필 지역(A안)과 하이브리드로 확장
□ 품질 점수 adRelevanceScore 자동화 (키워드 매칭)
□ 광고 배너 사이즈 검증 (이미지 업로드 시 가로/세로 체크)
□ 광고주 세금계산서 자동 발행 (홈택스 API or PG 연동)
```

---

## 11. 보안 · 개인정보 체크리스트

### 11.1 개인정보 보호

| 항목 | 처리 방식 | 구현 위치 |
|------|----------|----------|
| 주민등록번호 | SHA-256 해시 저장 (원본 절대 미저장) | Cloud Function |
| 실명 · 계좌번호 | AES-256 암호화 후 Firestore 저장 | Cloud Function |
| 암호화 키 관리 | Firebase Secret Manager (환경변수) | functions config |
| 접근 제한 | 정산 관련 필드는 본인 + 관리자만 읽기 | Security Rules |
| 데이터 보존 | 정산 완료 후 3년 보관 → 자동 삭제 | Scheduled Function |

### 11.2 Firestore Security Rules (광고 관련)

```javascript
// ads: 누구나 읽기 (노출용), 광고주 본인만 쓰기
match /ads/{adId} {
  allow read: if true;
  allow create: if request.auth != null
    && request.resource.data.advertiserId == request.auth.uid;
  allow update: if request.auth != null
    && (resource.data.advertiserId == request.auth.uid
        || isAdmin(request.auth.uid));
}

// adEvents: Cloud Function만 쓰기 (클라이언트 직접 쓰기 금지)
match /adEvents/{eventId} {
  allow read: if isAdmin(request.auth.uid);
  allow write: if false; // Cloud Function에서 Admin SDK로만 쓰기
}

// settlements: 본인만 읽기, Cloud Function만 쓰기
match /settlements/{stId} {
  allow read: if request.auth != null
    && resource.data.creatorId == request.auth.uid;
  allow write: if false; // Cloud Function에서만
}

// advertiserAccounts: 본인만 읽기/쓰기
match /advertiserAccounts/{advId} {
  allow read, write: if request.auth != null
    && request.auth.uid == advId;
}

// dailyAdRevenue: 본인만 읽기
match /dailyAdRevenue/{revId} {
  allow read: if request.auth != null
    && resource.data.postAuthorId == request.auth.uid;
  allow write: if false; // Cloud Function에서만
}
```

### 11.3 R2 업로드 보안 (upload-worker 확장)

```
ad-banners/ 경로 추가 규칙:
- Firebase Auth ID Token 검증 필수 (기존 로직 동일)
- advertiserId 폴더만 허용: ad-banners/{advertiserId}/{filename}
- 파일 크기 제한: 최대 500KB (배너 이미지)
- 허용 MIME: image/jpeg, image/png, image/gif, image/webp
- 파일명: 비ASCII 금지 (기존 규칙 동일)
```

### 11.4 Phase 5 추가 보안 사항

- [x] 관리자 권한 체크 (AdAdminPage — PLATFORM_ADMIN_NICKNAMES 화이트리스트)
- [ ] 관리자 권한을 Custom Claims로 전환 (닉네임 기반은 위변조 가능 — 정식 출시 전 필수)
- [x] 정산 거절 시 pendingRevenue 원복 (SettlementQueue)
- [x] 계좌번호 마스킹 표시 (SettlementQueue — `***-***-1234`)
- [x] CSV Export 시 이름 마스킹 + 주민번호 `***` 처리 (TaxReportExport)
- [x] viewerRegion sessionStorage만 사용 (프라이버시 친화 — localStorage 미사용)
- [x] ipapi.co API 실패 시 graceful fallback (빈 문자열 → 전국 매칭)
- [x] Firestore Rules: ads/settlements update는 isAdmin()만 허용
- [x] users 타인 update는 화이트리스트 필드만 (likes·totalShares·ballReceived·ballSpent·promoViewCount + 관리자 pendingRevenue/pendingThanksBall)

---

## 부록 A: 상수 정의 (`constants.ts` 추가분)

```typescript
/** 레벨별 광고 슬롯 & 수익 배분 테이블 */
export const AD_REVENUE_SHARE_TABLE: Record<number, {
  slots: ('top' | 'middle' | 'bottom')[];
  creatorRate: number;
  canSelectAd: boolean;
}> = {
  1:  { slots: [],                          creatorRate: 0,    canSelectAd: false },
  2:  { slots: [],                          creatorRate: 0,    canSelectAd: false },
  3:  { slots: [],                          creatorRate: 0,    canSelectAd: false },
  4:  { slots: [],                          creatorRate: 0,    canSelectAd: false },
  5:  { slots: ['bottom'],                  creatorRate: 0.3,  canSelectAd: false },
  6:  { slots: ['bottom'],                  creatorRate: 0.3,  canSelectAd: false },
  7:  { slots: ['top', 'bottom'],           creatorRate: 0.5,  canSelectAd: true  },
  8:  { slots: ['top', 'bottom'],           creatorRate: 0.5,  canSelectAd: true  },
  9:  { slots: ['top', 'middle', 'bottom'], creatorRate: 0.7,  canSelectAd: true  },
  10: { slots: ['top', 'middle', 'bottom'], creatorRate: 0.7,  canSelectAd: true  },
};

/** 광고 카테고리 (타겟팅용) */
export const AD_TARGET_CATEGORIES = [
  '음식점', 'IT/테크', '교육', '패션', '뷰티',
  '금융', '부동산', '여행', '건강', '자동차',
  '엔터테인먼트', '생활서비스', '기타',
] as const;

/** 타겟 지역 (시/도 단위) */
export const AD_TARGET_REGIONS = [
  '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
  '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
] as const;

/** 은행 코드 (정산용) */
export const BANK_CODES: Record<string, string> = {
  '004': 'KB국민', '011': 'NH농협', '020': '우리', '023': 'SC제일',
  '027': '씨티', '032': '대구', '034': '광주', '035': '제주',
  '037': '전북', '039': '경남', '045': '새마을금고', '048': '신협',
  '071': '우체국', '081': '하나', '088': '신한', '089': 'K뱅크',
  '090': '카카오뱅크', '092': '토스뱅크',
};

/** 세율 */
export const TAX_RATES = {
  BUSINESS_INCOME: 0.033,  // 사업소득 3.3%
  OTHER_INCOME: 0.088,     // 기타소득 8.8%
  VAT: 0.1,                // 부가가치세 10%
} as const;

/** 출금 최소 금액 */
export const MIN_WITHDRAWAL_AMOUNT = 30_000; // 3만원

/** 광고 배너 사이즈 (px) */
export const AD_BANNER_SIZES = {
  horizontal: { width: 720, height: 90 },   // 가로형 (상단/하단)
  rectangle: { width: 300, height: 250 },   // 사각형 (중단)
} as const;
```

---

## 부록 B: AdSlot 컴포넌트 핵심 로직

```typescript
// components/ads/AdSlot.tsx — 핵심 로직 스케치

interface AdSlotProps {
  position: 'top' | 'middle' | 'bottom';
  postId: string;
  postCategory: string;
  postAuthorId: string;
  postAuthorLevel: number;
}

function AdSlot({ position, postId, postCategory, postAuthorId, postAuthorLevel }: AdSlotProps) {
  // 1. 레벨별 슬롯 허용 체크
  const config = AD_REVENUE_SHARE_TABLE[postAuthorLevel];
  if (!config.slots.includes(position)) return null; // 이 레벨에서 이 슬롯은 미노출

  // 2. 경매 요청 (useAdSlot hook)
  const { ad, fallback, loading } = useAdSlot({
    slotPosition: position,
    postCategory,
    postId,
    postAuthorId,
    postAuthorLevel,
  });

  // 3. 렌더링
  if (loading) return <AdSkeleton />;

  if (ad) return <AdBanner ad={ad} postId={postId} position={position} />;
  if (fallback === 'adsense') return <AdFallback type="adsense" position={position} />;
  if (fallback === 'promo') return <AdFallback type="promo" position={position} />;

  return null;
}
```

---

## 부록 C: 휴먼 검수 체크리스트

> 이 기획서를 바탕으로 코드가 구현된 후, 휴먼 개발자가 아래 항목을 검수합니다.

### 데이터 모델 검수
- [ ] 모든 인터페이스가 `types.ts`에 정확히 반영되었는가
- [ ] ID 규칙이 블루프린트 수칙 5번을 준수하는가 (`addDoc` 예외 = adEvents만)
- [ ] 기존 컬렉션(`posts`, `comments`, `users`)에 영향이 없는가
- [ ] `users` 확장 필드가 기존 필드와 충돌하지 않는가

### UI 검수
- [ ] AdSlot이 기존 레이아웃(Tailwind 마진/패딩)을 변경하지 않는가
- [ ] 광고 배너가 모바일 반응형으로 정상 렌더되는가
- [ ] 수익 대시보드 금액 표시가 원(₩) 단위로 정확한가
- [ ] 광고주 센터 라우팅이 기존 라우트와 충돌하지 않는가

### Cloud Functions 검수
- [ ] 스케줄 시간이 KST 기준으로 정확한가 (UTC 변환 확인)
- [ ] aggregateDailyRevenue가 isSuspicious 이벤트를 정확히 제외하는가
- [ ] processSettlements의 원천세 계산이 정확한가 (`Math.floor` 처리)
- [ ] 모든 금액 연산에 부동소수점 오류가 없는가 (정수 원 단위 사용)

### 보안 검수
- [ ] adEvents에 클라이언트 직접 쓰기가 차단되어 있는가 (Security Rules)
- [ ] 주민등록번호가 해시로만 저장되는가 (원본 로그 포함 절대 미저장)
- [ ] 계좌번호/실명 암호화가 AES-256으로 구현되었는가
- [ ] 광고주 잔액 차감이 race condition 없이 transaction으로 처리되는가

### 세무 검수
- [ ] 원천세 계산 공식이 현행 세법과 일치하는가 (3.3% / 8.8%)
- [ ] 세무 CSV Export 양식이 국세청 양식과 호환되는가
- [ ] 땡스볼 비과세 기준(건당 5만원)이 정확히 적용되는가

---

> **이 문서는 ADSMARKET 시스템의 단일 진실 소스입니다.**
> 코드 구현 시 이 문서와 상충하는 결정을 내려야 할 경우, 반드시 이 문서를 먼저 갱신한 후 구현합니다.
>
> 문서 갱신 규칙: `AS-IS / TO-BE` 보고 → 승인 → 문서 수정 → 코드 반영
