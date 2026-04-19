# Phase 4 — 깐부방 라이브 이코노미

> **HALMAL-ITSO** · Product Technical Specification
> Live Economy · Text Live · Thanks Ball VFX · Knowledge Archive

> "얼굴 없이도 불이 붙는 라이브 — 텍스트와 목소리, 땡스볼로 만드는 I형 전용 실시간 경제."

| 항목 | 내용 |
|------|------|
| 프로젝트 | 할말있소 (halmal-itso) |
| 단계 | Phase 4 — Live Economy (깐부방 라이브 확장) |
| 기반 스택 | React · Firebase (Firestore/Auth/Hosting) · Cloudflare R2 · Cloudflare Worker |
| 선행 작업 | 보안 원팩(DOMPurify/Rules/R2 Worker 마이그레이션) 완료 · 깐부방 기본 설계 완료 |
| 문서 버전 | **v1.1** · 2026-04-17 |

### v1.1 변경 이력

| 항목 | 변경 내용 |
|------|-----------|
| **[신규] 2.4** | 결제·충전·정산·환불 플로우 전체 추가 |
| **[신규] 2.5** | 신고/차단/긴급 중단(Kill Switch) 시스템 추가 |
| **[신규] 2.6** | 호스트 대시보드(수익·통계·피드백) 추가 |
| **[신규] 2.7** | 아카이브 검색·디스커버리 추가 |
| **[수정] 3.x** | 스키마에 결제/정산/신고/검색 관련 컬렉션 추가 |
| **[수정] 5.2** | Firestore 비용 시뮬레이션 현실적 수치로 재산정, presence 주기 60초로 변경 |
| **[수정] 5.5** | Cloud Functions Cold Start 대응 전략 추가 |
| **[수정] 5.6** | 모바일 브라우저 백그라운드 이슈 대응 추가 |
| **[신규] 6장** | 접근성(a11y) 설계 가이드 추가 |
| **[신규] 7.3** | 세금 처리(원천징수·부가세·사업자등록) 추가 |
| **[신규] 11장** | 이용약관·프라이버시 정책 업데이트 체크리스트 추가 |
| **[수정] 9장** | 리스크 테이블에 결제·세금·접근성 리스크 추가 |

---

## 1. 개요 및 철학

### 1.1 프로젝트 배경

할말있소는 현재 Phase 3까지 핵심 인프라(글/댓글/알림/감사볼/커뮤니티/이미지 업로드)와 보안 원팩, 깐부방 기본 구조(호스트 기반 공간·실시간 채팅·리액션·자료 공유·티어드 땡스볼·제재 시스템)를 확보했다. Phase 4는 이 위에 '라이브'라는 시간축을 올려, 깐부방을 비동기 커뮤니티에서 동기 경제권으로 확장하는 단계다.

### 1.2 핵심 철학: "I형을 위한 실시간 경제"

> **Persona-First** — 얼굴 노출 없는 아바타·텍스트 기반 라이브로 심리적 장벽 제거.

> **Visual Power** — 땡스볼 금액에 따른 시각적 권력 부여(VFX)로 도파민 루프 형성.

> **Knowledge Loop** — [자료 공유 → 라이브 강의 → 질의응답 → 유료 아카이빙]의 수익 파이프라인.

### 1.3 Phase 4 목표 지표 (출시 3개월 기준)

| 지표 | 1차 목표 | 도전 목표 |
|------|:--------:|:---------:|
| 주간 라이브 세션 수 | 50+ | 200+ |
| 세션당 평균 동접 | 15명 | 80명 |
| 세션당 평균 땡스볼 수익 | 100볼 | 800볼+ |
| 아카이브 전환율 | 20% | 50% |
| 호스트 정산 완료율 (월) | 95%+ | 99%+ |

---

## 2. 기능 명세

### 2.1 라이브 모드

#### 2.1.1 텍스트 라이브 (Phase 4-A, 최우선 구현)

- 호스트가 전용 에디터에 텍스트를 입력하면, 접속자 화면 상단 "라이브 보드"에 실시간으로 강조 렌더링.
- Firestore onSnapshot 기반 — 별도 스트리밍 인프라 불필요.
- 입력 단위는 '문장' (Enter 또는 2초 idle 시 commit). 버퍼링 중인 글자는 호스트에게만 회색으로 표시.
- 과거 라인은 하단에 스크롤되며 유지 → 라이브 종료 시 그대로 아카이브 본문이 됨.

> **구현 난이도 ★☆☆ · 인프라 비용 거의 0원 · MVP로 가장 먼저 출시.**

#### 2.1.2 할말 라디오 (Phase 4-B, 후속 구현)

- Agora SDK 오디오 전용 모드(월 10,000분 무료 티어 활용).
- 호스트 아바타가 음성 볼륨에 반응해 말풍선·파동 애니메이션.
- 청취자는 기본 음소거. 호스트가 "마이크 패스" 토글로 특정 유저에게 발언권 이양.

#### 2.1.3 온라인 강의 (On-Lab)

- 사전 배포된 PDF/이미지를 세션 중 슬라이드처럼 넘기며 진행.
- 자료는 R2(halmal-itso-bucket)에 저장, 세션 참여자에게만 presigned URL 발급.
- 현재 페이지 인덱스는 `live_sessions.currentSlideIndex`로 동기화.

### 2.2 땡스볼 슈퍼챗 (VFX Tier)

기존 감사볼 시스템을 확장해, 라이브 세션 중 투척 시 등급별 VFX를 발생시킨다. 세션 밖 땡스볼은 기존 동작 유지.

| 등급 | 범위 | VFX 연출 | 특권 |
|:----:|:----:|----------|------|
| **브론즈** | 1~9볼 | 채팅 말풍선 강조 + 별가루 파티클 2초 | 없음 |
| **실버** | 10~49볼 | 호스트 아바타 옆 말풍선 5초 고정 | 골든벨 Q&A 큐 진입 |
| **골드** | 50~99볼 | 중앙 전광판 배너 10초 + 효과음 | Q&A 우선순위 상승 |
| **레전드** | 100볼+ | 전체 배경 반전 + 전용 BGM + 호스트 왕관 15초 | 즉시 답변 권한 + 아카이브 상단 고정 |

#### VFX 구현 레이어

- `<LiveVfxOverlay />` 전역 포털 컴포넌트로 `live_chats`의 최신 thanksball 이벤트를 구독.
- 브론즈·실버는 CSS Animation (저비용). 골드·레전드는 Lottie JSON (R2 정적 호스팅).
- 동시 투척 대비 Queue 기반 순차 재생 (레전드 재생 중이면 하위 티어는 2초 지연).

#### VFX 접근성 (a11y) — 6장 참조

- 레전드 배경 반전은 `prefers-reduced-motion` 미디어쿼리 시 정적 배너로 대체.
- 모든 VFX는 CSS `@media (prefers-reduced-motion: reduce)` 분기 필수.

### 2.3 지식 크리에이터 도구

#### 2.3.1 유료 자료함 (Paid Vault)

- 깐부방별 / 세션별로 범위 지정 가능한 자료 저장소.
- R2의 별도 prefix(`paid-vault/{roomId}/`)로 분리, Worker에서 세션 참여 이력 검증 후 presigned URL 발급.
- 자료 접근은 '땡스볼 N개 지불' 또는 '세션 참여자 전원 무료' 중 호스트가 선택.

#### 2.3.2 골든벨 Q&A

- 실버 이상 땡스볼이 붙은 메시지는 별도 Queue 컬렉션(`live_qna_queue`)으로 복제.
- 호스트 화면에서 금액 순 정렬 → '답변 완료' 토글로 처리.
- 답변 완료된 Q&A는 아카이브 챕터로 자동 세그먼트화.

#### 2.3.3 라이브 아카이브 → 잉크병 자동 전환

- 라이브 종료 시 `live_chats`와 텍스트 보드 전체 로그를 묶어 `archive_session` 문서로 생성.
- 호스트가 '잉크병으로 발행' 선택 시 기존 `inkbottle` 컬렉션 구조에 맞춰 변환 · 가격 설정.
- 수수료: 라이브 당시 땡스볼 수수료 15~20% / 아카이브 재판매 수수료 11% (이중 과금 아님 — 각 매출에 1회만).
- **아카이브 내 참여자 채팅 로그 포함 동의**: 라이브 입장 시 "채팅 내용이 아카이브 상품에 포함될 수 있습니다" 명시적 동의 체크. 미동의 시 해당 유저 채팅은 아카이브에서 `[익명 참여자]`로 치환.

### 2.4 결제·충전·정산·환불 [v1.1 신규]

#### 2.4.1 땡스볼 충전 (구매)

- **결제 게이트웨이**: 포트원(PortOne) v2 SDK → 토스페이먼츠 / 카카오페이 / 네이버페이 연동.
- **충전 단위**: 10볼(1,000원) / 50볼(4,500원) / 100볼(8,000원) / 500볼(35,000원) — 대량 구매 할인 적용.
- **결제 플로우**:
  1. 클라이언트에서 포트원 SDK로 결제 요청
  2. 포트원 → PG사 결제 승인
  3. **포트원 웹훅 → Cloud Function(`onPaymentComplete`)** 에서만 감사볼 적립 (클라이언트 신뢰 불가)
  4. `payment_transactions` 컬렉션에 결제 기록 저장 (영수증 번호·금액·PG 응답)
  5. 적립 완료 후 클라이언트에 결과 반환
- **미성년자 결제 제한**: 가입 시 생년월일 수집 → 만 19세 미만은 월 7만원 한도, 법정대리인 동의 UI 제공. (전자상거래법 제21조, 청소년보호법 제16조)

#### 2.4.2 호스트 정산 (출금)

- **정산 주기**: 월 1회 (매월 15일 마감 → 25일 지급).
- **최소 출금 금액**: 10,000원 (미만 잔액은 이월).
- **정산 플로우**:
  1. Cloud Scheduler (매월 16일 0시) → 호스트별 전월 수익 집계 (`settlement_ledger` 생성)
  2. 관리자 검수 후 승인 → 토스페이먼츠 대량 이체 API 또는 직접 송금
  3. 세금계산서/원천징수 영수증 자동 발행 (7.3 참조)
  4. 정산 완료 시 `settlement_ledger.status = 'paid'` 업데이트
- **정산 계좌 등록**: 호스트 설정 > 계좌 관리에서 본인 명의 계좌 1개 등록 (본인 인증 필수)

#### 2.4.3 환불 정책

| 구매 유형 | 환불 가능 여부 | 근거 |
|-----------|:--------------:|------|
| 땡스볼 충전 (미사용) | 7일 이내 전액 환불 | 전자상거래법 제17조 (청약철회) |
| 땡스볼 충전 (일부 사용) | 미사용분 비례 환불 | 동법, 일부 소비 간주 |
| 라이브 입장료 | 환불 불가 (서비스 시작 후) | 용역 제공 완료 (약관 명시) |
| 라이브 중 후원 | 환불 불가 | 증여 성격, 약관 명시 |
| 아카이브 구매 | 7일 이내, 미열람 시 환불 | 디지털 콘텐츠 청약철회 |
| 유료 자료함 | 다운로드 전 환불 가능 | 디지털 콘텐츠 특성 |

- **환불 처리**: Cloud Function(`processRefund`) → 포트원 취소 API 호출 → 감사볼 원복 or 원결제 수단 환불.
- **환불 악용 방지**: 월 3건 초과 환불 시 수동 검수 전환, 동일 IP 반복 충전/환불 패턴 감지.

### 2.5 신고·차단·긴급 중단 시스템 [v1.1 신규]

#### 2.5.1 실시간 신고

- 채팅 메시지 롱프레스/우클릭 → "신고" 메뉴 → 사유 선택 (욕설/도배/혐오/성적/기타).
- `live_reports` 컬렉션에 즉시 기록 (sessionId, targetUid, reporterUid, reason, chatRef, createdAt).
- 동일 세션 내 동일 유저 신고 3건 이상 시 → **자동 임시 뮤트 (10분)** + 호스트에게 알림.

#### 2.5.2 호스트 즉시 제재

- 기존 깐부방 제재 시스템(mute/kick/ban)을 라이브 세션에 그대로 적용.
- 호스트 전용 채팅 컨트롤: 유저별 "뮤트" / "추방" / "영구차단" 버튼.
- 추방 시 해당 유저 onSnapshot 리스너 해제 + "추방되었습니다" 모달 + 세션 재진입 차단.

#### 2.5.3 운영자 Kill Switch (긴급 중단)

- 관리자 콘솔에서 특정 `live_sessions` 강제 종료 가능 (`status = 'killed'`).
- Kill 시 전 참여자에게 "운영 정책에 의해 세션이 종료되었습니다" 시스템 메시지.
- 호스트에게는 사유 안내 + 이의 제기 절차 링크 제공.
- 반복 Kill 대상 호스트는 라이브 권한 정지 (단계별: 1일 → 7일 → 30일 → 영구).

#### 2.5.4 법적 분쟁 대응 창구

- 서비스 하단 "신고·문의" 페이지에 명예훼손·저작권 침해·개인정보 침해 접수 양식.
- 저작권 침해 접수 시 DMCA 절차 준용: 통보 → 해당 아카이브 비공개 전환 → 호스트 반론 → 판단.
- 접수 기록은 `legal_reports` 컬렉션에 저장, 처리 기한 72시간 목표.

### 2.6 호스트 대시보드 [v1.1 신규]

#### 2.6.1 수익 현황

- **총 수익 / 이번 달 수익 / 정산 대기금 / 정산 완료 누적** 4개 카드.
- 세션별 수익 breakdown: 입장료 / 땡스볼 / 아카이브 재판매 (각각 수수료 차감 후).
- 월별 수익 추이 차트 (최근 6개월).

#### 2.6.2 세션 통계

- 세션별: 동접 피크 / 총 참여자 / 땡스볼 총액 / 평균 시청 시간 / Q&A 처리율.
- 시계열: 일별 라이브 횟수 / 주간 참여자 트렌드.

#### 2.6.3 시청자 피드백

- 라이브 종료 시 참여자에게 선택적 1~5점 별점 + 한줄 피드백 모달 표시.
- 호스트 대시보드에 평균 별점·최근 피드백 목록 표시.
- Firestore: `live_sessions/{sessionId}/feedbacks/{uid}` sub-collection.

### 2.7 아카이브 검색·디스커버리 [v1.1 신규]

#### 2.7.1 검색 기능

- `archive_sessions`에 `tags: string[]`, `category: string` 필드 추가.
- 호스트가 아카이브 발행 시 태그·카테고리 입력 (자동 추천 지원).
- **검색 구현**: Phase 4 초기엔 Firestore `where` + `array-contains` 기반 태그 검색. 규모 확대 시 Algolia/Meilisearch 외부 인덱서로 전환.

#### 2.7.2 디스커버리 UI

- 아카이브 탐색 페이지: 인기순(판매량) / 최신순 / 카테고리별 필터.
- 깐부방 상세 화면에 "지난 라이브" 섹션 추가 — 해당 방의 아카이브 리스트.
- 홈 화면에 "인기 아카이브 TOP 10" 영역 (주간 판매량 기준).

---

## 3. 데이터 모델 (Firestore 스키마)

기존 halmal-itso 컬렉션과의 일관성을 위해 모든 신규 컬렉션은 snake_case로 통일하고, 서버 타임스탬프(`serverTimestamp`)와 UID 기반 보안 룰을 동일한 패턴으로 적용한다.

### 3.1 `live_sessions` (Root Collection)

```
live_sessions/{sessionId}
  id: 'live_{timestamp}_{hostUid}'   // 문서 ID와 동일
  roomId: string                     // 소속 깐부방
  hostUid: string
  title: string
  type: 'text' | 'audio' | 'onlab'
  status: 'ready' | 'live' | 'ended' | 'killed'   // [v1.1] killed 추가
  startedAt: Timestamp | null
  endedAt: Timestamp | null
  killedReason: string | null        // [v1.1] 운영자 강제 종료 사유
  activeUsers: number                // FieldValue.increment(±1)
  totalThanksball: number            // 누적 후원
  currentSlideUrl: string | null     // On-Lab 전용
  currentSlideIndex: number
  settings: {
    entryFee: number                 // 땡스볼 단위, 0이면 무료
    qnaMinTier: 'silver' | 'gold' | 'legend'
    archiveAutoPublish: boolean
    archiveChatConsent: boolean      // [v1.1] 채팅 아카이브 포함 동의 요구 여부
  }
  avgRating: number | null           // [v1.1] 세션 평균 별점
  feedbackCount: number              // [v1.1]
  createdAt, updatedAt: Timestamp
```

### 3.2 `live_chats` (Sub-collection)

```
live_sessions/{sessionId}/live_chats/{chatId}
  uid: string
  nickname: string                   // 스냅샷 저장 (탈퇴 대비)
  avatarUrl: string | null
  type: 'chat' | 'thanksball' | 'system' | 'board'
  text: string                       // DOMPurify 적용 후 저장
  amount: number | null              // thanksball 타입만
  vfxTier: 'bronze' | 'silver' | 'gold' | 'legend' | null
  vfxPlayedAt: Timestamp | null      // 클라이언트 중복 재생 방지
  reported: boolean                  // [v1.1] 신고 접수 여부
  hidden: boolean                    // [v1.1] 호스트가 숨김 처리
  createdAt: Timestamp (serverTimestamp)
```

### 3.3 `live_board` (Sub-collection, 텍스트 라이브용)

```
live_sessions/{sessionId}/live_board/{lineId}
  order: number                      // 표시 순서
  text: string                       // 한 문장 단위
  style: 'normal' | 'highlight' | 'title'
  committedAt: Timestamp
```

### 3.4 `live_qna_queue` (Sub-collection)

```
live_sessions/{sessionId}/live_qna_queue/{qnaId}
  sourceChatId: string               // live_chats 참조
  uid, nickname, avatarUrl
  question: string
  amount: number
  vfxTier: string
  status: 'pending' | 'answered' | 'skipped'
  answeredAt: Timestamp | null
  answerRefs: string[]               // 답변 메시지의 chatId 배열
```

### 3.5 `archive_sessions` (Root Collection)

```
archive_sessions/{archiveId}
  sessionId: string                  // 원본 live_session 참조
  roomId, hostUid, title, type
  boardSnapshot: string              // 보드 전체 텍스트 (마크다운)
  chatLogCount: number
  qnaSegments: [{ q, a, amount }]    // 골든벨 Q&A 정리본
  totalRevenue: number
  inkbottleId: string | null         // 잉크병 발행 시 연결
  publishStatus: 'draft' | 'published' | 'private'
  price: number                      // 0이면 무료 공개
  tags: string[]                     // [v1.1] 검색용 태그
  category: string                   // [v1.1] 카테고리
  salesCount: number                 // [v1.1] 판매 횟수 (인기순 정렬)
  createdAt: Timestamp
```

### 3.6 `payment_transactions` (Root Collection) [v1.1 신규]

```
payment_transactions/{txId}
  uid: string                        // 결제자
  type: 'charge' | 'refund'
  amount: number                     // 원화 (KRW)
  ballAmount: number                 // 적립/차감된 감사볼 수
  pgProvider: 'tosspayments' | 'kakaopay' | 'naverpay'
  pgTransactionId: string            // PG사 거래 고유번호
  portonePaymentId: string           // 포트원 결제 ID
  status: 'pending' | 'completed' | 'failed' | 'refunded'
  receiptUrl: string | null          // 영수증 URL
  refundReason: string | null
  refundedAt: Timestamp | null
  createdAt: Timestamp
```

### 3.7 `settlement_ledger` (Root Collection) [v1.1 신규]

```
settlement_ledger/{ledgerId}
  hostUid: string
  period: '2026-04'                  // 정산 대상 월
  grossRevenue: number               // 총 수익 (원화)
  platformFee: number                // 플랫폼 수수료
  tax: number                        // 원천징수 세액
  netPayout: number                  // 실 지급액
  breakdown: {
    entryFees: number
    thanksball: number
    archiveSales: number
    vaultSales: number
  }
  bankAccount: {                     // 스냅샷 저장 (계좌 변경 대비)
    bankCode: string
    accountNumber: string (마스킹)
    holderName: string
  }
  status: 'pending' | 'approved' | 'paid' | 'failed'
  paidAt: Timestamp | null
  invoiceUrl: string | null          // 세금계산서/원천징수영수증
  createdAt: Timestamp
```

### 3.8 `live_reports` (Root Collection) [v1.1 신규]

```
live_reports/{reportId}
  sessionId: string
  targetUid: string                  // 피신고자
  reporterUid: string
  reason: 'abuse' | 'spam' | 'hate' | 'sexual' | 'copyright' | 'other'
  detail: string | null
  chatRef: string | null             // live_chats 문서 참조
  status: 'pending' | 'reviewed' | 'actioned' | 'dismissed'
  action: 'mute' | 'kick' | 'ban' | null
  reviewedBy: string | null          // 관리자 UID
  reviewedAt: Timestamp | null
  createdAt: Timestamp
```

### 3.9 `legal_reports` (Root Collection) [v1.1 신규]

```
legal_reports/{reportId}
  type: 'defamation' | 'copyright' | 'privacy' | 'other'
  reporterContact: string            // 이메일
  targetType: 'archive' | 'live_session' | 'chat'
  targetRef: string                  // 대상 문서 ID
  description: string
  attachments: string[]              // R2 URL
  status: 'received' | 'investigating' | 'resolved' | 'dismissed'
  resolution: string | null
  deadline: Timestamp                // 접수 + 72시간
  createdAt: Timestamp
```

---

## 4. 보안 & Firestore Rules

기존 보안 원팩(UID 기반 접근 제어)과 동일한 원칙을 적용한다. 핵심은 다음 세 가지 — 쓰기 권한은 호스트/본인으로 제한, 금액·티어는 클라이언트 신뢰 불가(Cloud Function 경유), 세션 참여자 검증은 파생 문서로 처리.

### 4.1 `live_sessions` 룰

```javascript
match /live_sessions/{sessionId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null
                && request.resource.data.hostUid == request.auth.uid
                && request.resource.data.status == 'ready';
  allow update: if request.auth != null
                && resource.data.hostUid == request.auth.uid
                // activeUsers는 세션 참여자도 increment 가능 (별도 함수로 제어)
                || onlyChanged(['activeUsers']);
  allow delete: if false;            // 종료는 update(status='ended')로만
  // [v1.1] status='killed'는 Admin SDK(Cloud Function)에서만 가능
}
```

### 4.2 `live_chats` 룰

```javascript
match /live_sessions/{sessionId}/live_chats/{chatId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null
                && request.resource.data.uid == request.auth.uid
                && request.resource.data.type in ['chat']     // ← 핵심
                && request.resource.data.amount == null        // ← 핵심
                && request.resource.data.reported == false     // [v1.1]
                && request.resource.data.hidden == false;      // [v1.1]
  // type == 'thanksball' 은 Cloud Function에서만 생성
  // [v1.1] hidden은 호스트가 Cloud Function으로만 변경 가능
  allow update, delete: if false;
}
```

> ⚠️ **땡스볼 메시지는 반드시 Cloud Function(Callable)을 통해서만 생성된다. 클라이언트가 직접 amount/vfxTier를 쓸 수 없게 하는 것이 Phase 4 보안의 핵심.**

### 4.3 Cloud Function: `sendThanksballToLive`

- 입력: `sessionId`, `amount`, `message`
- Firestore 트랜잭션으로 처리:
  1. 발송자 감사볼 차감
  2. 호스트 감사볼 적립(수수료 차감)
  3. `live_chats` 생성
  4. `live_sessions.totalThanksball` 증가
  5. 실버 이상이면 `live_qna_queue` 자동 복제
- 수수료율(15~20%)은 Firestore `system_config/live_economy` 문서에서 동적으로 읽어옴 (하드코딩 금지)
- 실패 시 전체 롤백 — 이 부분은 테스트 케이스로 반드시 검증

### 4.4 Cloud Function: `onPaymentComplete` [v1.1 신규]

- **포트원 웹훅**으로만 호출 — 웹훅 시그니처 검증 필수.
- 플로우: 웹훅 수신 → 시그니처 검증 → 포트원 API로 결제 상태 이중 확인 → `payment_transactions` 생성 → 감사볼 적립.
- 클라이언트가 직접 감사볼을 적립할 수 없음 (충전도 Cloud Function 경유).

### 4.5 유료 자료함 접근 제어

- 기존 `halmal-upload-worker`에 `/paid-vault/{roomId}/{file}` 경로 추가
- Worker는 Firestore Admin으로 (1) 유저가 해당 세션 참여 이력 보유 또는 (2) 자료 구매 이력 보유 검증 후 R2 presigned URL 5분 TTL 반환
- CORS 허용 오리진은 기존과 동일하게 `halmal-itso.web.app` / `firebaseapp.com` 로 제한

### 4.6 `payment_transactions` / `settlement_ledger` 룰 [v1.1 신규]

```javascript
match /payment_transactions/{txId} {
  allow read: if request.auth != null
              && resource.data.uid == request.auth.uid;
  allow create, update, delete: if false;  // Cloud Function(Admin SDK)에서만
}

match /settlement_ledger/{ledgerId} {
  allow read: if request.auth != null
              && resource.data.hostUid == request.auth.uid;
  allow create, update, delete: if false;  // Cloud Function(Admin SDK)에서만
}
```

---

## 5. 아키텍처 & 인프라

### 5.1 컴포넌트 트리 (React)

```
/live
  /LiveSessionPage.jsx          // 라우트 엔트리, status 분기
    <LiveHeader />              // 제목·동접·타이머
    <LiveBoard />               // 상단 강조 텍스트 (board sub 구독)
    <LiveChatPanel />           // live_chats 구독·입력
      <ChatReportMenu />        // [v1.1] 신고 메뉴
    <LiveVfxOverlay />          // 최상위 포털, VFX 큐잉
    <ThanksballLauncher />      // 투척 모달, Callable 호출
    <QnaQueuePanel />           // 호스트 전용
    <SessionFeedbackModal />    // [v1.1] 종료 시 별점 피드백
  /HostConsole.jsx              // type='text' 전용 에디터
    <ModeratorToolbar />        // [v1.1] 뮤트/추방/차단 컨트롤
  /HostDashboard.jsx            // [v1.1] 수익·통계·피드백
  /PaymentPage.jsx              // [v1.1] 땡스볼 충전
  /hooks
    useLiveSession(sessionId)   // 세션 문서 구독
    useLiveBoard(sessionId)     // 보드 구독
    useLiveChats(sessionId)     // 채팅 구독 + VFX 큐 dispatch
    useActiveUsersHeartbeat()   // [v1.1] 60초마다 presence 갱신 (30초→60초 변경)
    usePageVisibility()         // [v1.1] 백그라운드 복귀 시 즉시 재연결
/archive
  /ArchiveExplorePage.jsx       // [v1.1] 검색·디스커버리
  /ArchiveDetailPage.jsx        // [v1.1] 아카이브 상세
```

### 5.2 실시간 동기화 전략 [v1.1 비용 재산정]

| 데이터 | 방식 | 주의사항 |
|--------|------|----------|
| 세션 상태 | `onSnapshot` (doc) | 단일 문서 구독 — 비용 거의 0 |
| 보드 텍스트 | `onSnapshot` (orderBy order) | `limit(100)` + `startAfter`로 페이징, 오래된 라인은 클라 메모리에서만 유지 |
| 채팅 | `onSnapshot` (orderBy createdAt desc, limit 50) | 신규 추가분만 DOM 렌더, 초기 로드 시 역순으로 prepend |
| 동접 수 | presence 하트비트 | **[v1.1] 60초 주기** (30초→60초로 비용 절감), tab close 시 beacon API로 decrement. 좀비 카운트 방지를 위해 Cloud Scheduler 1분마다 stale 정리 (lastPing < now-120s). **동접 표시는 구간 근사치** ("~50명", "~100명")로 변경. |
| VFX 트리거 | `live_chats` 구독 필터 | `type=='thanksball' && vfxPlayedAt == null` 조건, 재생 후 로컬에서만 마킹 (쓰기 비용 절약) |

#### [v1.1] 비용 시뮬레이션 보정 (100명 동접 · 1시간 텍스트 라이브)

v1.0에서 ~0.5 USD로 추정했으나, 다음 항목이 과소 집계됐다:

| 항목 | v1.0 추정 | v1.1 보정 | 변경 사유 |
|------|:---------:|:---------:|-----------|
| Firestore 읽기 | 0.3 USD | **1.5 USD** | onSnapshot은 변경 시 구독자 전원에게 read 발생. 채팅 200건 × 100명 = 20,000 reads. 보드·세션 상태 변경분 추가. |
| Firestore 쓰기 | 0.1 USD | **0.5 USD** | presence 60초 × 100명 × 60분 = 6,000 writes + 채팅 200건 + 보드 50건 |
| Cloud Functions | 0.05 USD | 0.1 USD | 땡스볼 + presence 정리 |
| R2 전송 | 0 USD | 0 USD | 이그레스 무료 유지 |
| **합계 (텍스트 모드)** | **~0.5 USD** | **~2.1 USD** | 현실적 추정치 |
| **합계 (오디오 모드)** | +6 USD | **~8 USD** | Agora 초과 과금 포함 |

> 💰 **보정 결론**: 세션당 인프라 비용 ~2 USD. 100볼(약 10,000원) 후원 시 수수료 20% = 2,000원 → 여전히 흑자 구조이나 마진은 v1.0 추정보다 타이트함. 동접 300명 이상 세션에서는 비용 급증 → `limit(30)`으로 채팅 쿼리 축소, 보드 `limit(50)` 적용 등 추가 최적화 필요.

### 5.3 인프라 스택 요약

- **Firestore** — 세션/채팅/보드/아카이브/결제/정산 전체 (onSnapshot 기반 실시간)
- **Cloud Functions** — 땡스볼 트랜잭션, 결제 웹훅, 정산 배치, 아카이브 생성, presence 정리, 신고 자동 처리
- **Cloudflare R2 + Worker** — 강의 자료(`paid-vault/`), 레전드 BGM, Lottie JSON 정적 호스팅
- **Agora SDK (Phase 4-B)** — 오디오 전용 모드, 토큰은 Cloud Function에서 서명
- **포트원(PortOne) v2** — 결제 게이트웨이 (토스페이먼츠/카카오페이/네이버페이)

### 5.4 R2 / Worker 확장 포인트

- 기존 `halmal-upload-worker`에 라우트 추가 — `/lecture-upload` (자료 업로드, 호스트 UID 검증) / `/vault-fetch` (자료 다운로드, 참여자 검증)
- 기존 `halmal-itso-bucket` 재활용, prefix로 분리: `posts/` · `avatars/` · `lecture/` · `paid-vault/`
- API 키는 이미 Worker로 이전 완료 — 신규 기능도 동일 원칙 유지, 클라에서 R2 직접 호출 금지

### 5.5 Cloud Functions Cold Start 대응 [v1.1 신규]

- `sendThanksballToLive`는 5단계 트랜잭션으로 Cold Start 시 **3~5초 지연** 가능.
- **대응 전략**:
  - Cloud Functions **min instances = 1** 설정 (asia-northeast3 리전, 월 ~$5~10).
  - 또는 Gen2(Cloud Run 기반) Functions 사용 — min instances 지원 + 메모리 유연.
  - `onPaymentComplete` 웹훅도 min instances 1 설정 (결제 실패 인상 방지).
- **클라이언트 UX**: 투척 후 2초 내 응답 없으면 "처리 중..." 스피너 표시 (타임아웃 10초).

### 5.6 모바일 브라우저 백그라운드 대응 [v1.1 신규]

- **문제**: iOS Safari는 탭 백그라운드 15초 후 JS 타이머 중단 → presence 하트비트 멈춤 → 살아있는 유저를 좀비로 처리.
- **대응**:
  - `usePageVisibility()` 훅으로 `visibilitychange` 이벤트 감지.
  - 포커스 복귀 시 **즉시** presence 갱신 + onSnapshot 리스너 재확인 (연결 끊겼으면 재구독).
  - 백그라운드 진입 시 `navigator.sendBeacon`으로 마지막 heartbeat 전송 (decrement 아님 — stale timeout에 맡김).
  - 채팅/보드에 gap이 생겼을 경우 복귀 시 **마지막 createdAt 이후** 메시지를 한 번 fetch (onSnapshot이 중간 이벤트를 놓칠 수 있으므로).

---

## 6. 접근성(a11y) 설계 가이드 [v1.1 신규]

### 6.1 VFX 모션 안전

- **뇌전증 유발 방지**: 레전드 등급의 "전체 배경 반전"은 초당 3회 이상 깜빡임 금지 (WCAG 2.3.1 기준).
- `@media (prefers-reduced-motion: reduce)` 활성 시 — 모든 VFX를 정적 배너/텍스트 알림으로 대체.
- 사용자 설정에 "모션 줄이기" 토글 추가 (OS 설정과 별개로 앱 내에서도 제어 가능).

### 6.2 색상 구분

- 등급(브론즈/실버/골드/레전드)은 **색상 + 아이콘** 병행 표시 (색맹 대응).
  - 브론즈: 🔶 + 동색, 실버: ⚪ + 은색, 골드: ⭐ + 금색, 레전드: 👑 + 보라.
- 색 대비 비율 WCAG AA 기준(4.5:1) 충족 검증.

### 6.3 스크린리더 지원

- 채팅 영역에 `role="log"`, `aria-live="polite"` 설정.
- VFX 발동 시 `aria-live="assertive"` 영역에 "OO님이 골드 50볼을 투척했습니다" 텍스트 알림.
- 라이브 보드는 `role="feed"` + 각 라인에 `aria-label` 순서 번호.

### 6.4 키보드 네비게이션

- 땡스볼 투척 모달: Tab 키로 금액 선택 → Enter로 확정.
- 호스트 에디터: 일반 텍스트 입력 영역이므로 특별 처리 불필요, 단 단축키(Ctrl+Enter = commit) 문서화.
- Q&A 큐: 방향키로 탐색, Enter로 "답변 완료" 토글.

---

## 7. 경제 모델 & 운영 비용

### 7.1 수수료 구조

| 매출 항목 | 플랫폼 수수료 | PG 수수료 (별도) | 근거 |
|-----------|:-------------:|:----------------:|------|
| 땡스볼 충전 | — | 3.5%~4% | PG 수수료는 구매자 부담 (충전 금액에 포함) |
| 라이브 입장료 | 15% | — | 인프라 부담 있음 |
| 라이브 중 땡스볼 후원 | 20% | — | VFX·QnA 프리미엄 기능 비용 반영 |
| 아카이브 재판매 (잉크병) | 11% | — | 기존 잉크병 수수료 일관성 유지 |
| 유료 자료함 구매 | 15% | — | R2 저장·전송 비용 반영 |

> ※ PG 수수료는 충전 시점에 1회만 발생. 이후 플랫폼 내 땡스볼 유통(후원·입장료·자료 구매)에는 PG 수수료 없음.

### 7.2 운영 비용 시뮬레이션

→ 5.2절 "[v1.1] 비용 시뮬레이션 보정" 참조.

### 7.3 세금 처리 [v1.1 신규]

#### 7.3.1 부가가치세 (VAT)

- 플랫폼 수수료 수익에 대해 부가세 10% 신고·납부 (사업자등록 후).
- 호스트에게 지급하는 정산금은 수수료 차감 후 금액이므로 호스트 측 부가세는 호스트 사업자 여부에 따라 다름.

#### 7.3.2 원천징수 (호스트 정산)

- **호스트가 사업자인 경우**: 세금계산서 수취, 원천징수 불필요.
- **호스트가 개인(비사업자)인 경우**: 기타소득 원천징수 8.8% 적용 (소득세 8% + 지방소득세 0.8%).
- `settlement_ledger.tax` 필드에 원천징수 세액 기록.
- 연 300만원 초과 기타소득 발생 호스트에게 사업자등록 권고 안내 배너 노출.

#### 7.3.3 호스트 사업자 유형 관리

- 호스트 프로필에 `businessType: 'individual' | 'sole_proprietor' | 'corporation'` 필드.
- `sole_proprietor` / `corporation`은 사업자등록번호 입력 → 국세청 API 검증.
- 유형별 세금 처리 분기:
  - `individual`: 기타소득 원천징수 자동 적용.
  - `sole_proprietor`: 세금계산서 자동 발행 (포트원 or 국세청 API).
  - `corporation`: 세금계산서 자동 발행.

#### 7.3.4 미성년자 수익 처리

- 만 19세 미만 호스트의 정산은 법정대리인 계좌로만 가능.
- 법정대리인 동의서 (전자서명) 수집 후 출금 활성화.

---

## 8. 주요 UX 플로우

### 8.1 호스트: 라이브 시작

1. 깐부방 상세 화면에서 "라이브 시작" 버튼 클릭
2. 모드 선택 (텍스트 / 라디오 / 온랩), 제목·입장료·QnA 최소 등급 설정
3. `live_sessions` 생성 (status='ready') → 참여자에게 푸시 알림
4. "지금 시작" 클릭 시 status='live', startedAt 기록
5. HostConsole 진입 — 좌측 에디터, 우측 채팅/QnA Queue

### 8.2 참여자: 라이브 참여 & 투척

1. 알림 또는 깐부방 내 LIVE 배지 클릭
2. (유료 세션이면) 입장료 동의 모달 → 땡스볼 차감
3. **[v1.1]** (아카이브 채팅 포함 설정 시) "채팅 내용이 아카이브에 포함될 수 있습니다" 동의 체크
4. LiveBoard에 호스트 텍스트가 실시간 누적
5. 땡스볼 아이콘 → 금액 선택 → 메시지 입력 → 투척
6. Cloud Function 처리 → `live_chats` 생성 → 전 참여자 VFX 재생
7. 실버 이상이면 QnA Queue에 자동 등록, 호스트 답변 대기

### 8.3 땡스볼 충전 [v1.1 신규]

1. 상단 감사볼 잔액 영역 또는 투척 시 잔액 부족 → "충전" 버튼
2. 충전 금액 선택 (10볼 / 50볼 / 100볼 / 500볼)
3. **[v1.1]** (미성년자면) 월 한도 잔여량 표시 + 법정대리인 동의 미완료 시 차단
4. 포트원 결제 모달 (토스/카카오/네이버) → 결제 완료
5. 포트원 웹훅 → `onPaymentComplete` Cloud Function → 감사볼 적립
6. "충전 완료!" 토스트 + 잔액 갱신

### 8.4 라이브 종료 → 아카이브

1. 호스트가 "종료" 클릭 → 확인 모달
2. status='ended' 업데이트 → Cloud Function 트리거
3. `archive_sessions` 자동 생성 (boardSnapshot, qnaSegments 정리)
4. **[v1.1]** 참여자에게 별점 피드백 모달 표시 (1~5점 + 한줄 코멘트, 선택사항)
5. 호스트에게 "잉크병으로 발행하시겠어요?" 카드 표시
6. 발행 시 기존 inkbottle 생성 플로우로 이관, 가격·태그·카테고리·미리보기 설정

### 8.5 호스트 정산 확인 [v1.1 신규]

1. 호스트 대시보드 → "정산" 탭
2. 이번 달 수익 / 정산 대기 / 지난 달 정산 완료 확인
3. 계좌 미등록 시 → 계좌 등록 (본인 인증 + 실명 계좌)
4. 매월 25일 자동 정산 완료 알림 + 세금계산서/원천징수영수증 다운로드

---

## 9. 리스크 & 대응

| 리스크 | 영향 | 대응 |
|--------|------|------|
| **클라이언트 땡스볼 조작** | 경제 붕괴 — 무한 후원 가능 | Cloud Function Callable 강제 · Rules에서 thanksball 쓰기 완전 차단 |
| **결제 위변조** [v1.1] | 미결제 충전, 금액 조작 | 포트원 웹훅 시그니처 검증 + 포트원 API 이중 확인, 클라에서 직접 적립 불가 |
| **환불 악용** [v1.1] | 충전→투척→환불 반복 | 사용분 비례 환불, 월 3건 초과 시 수동 검수, IP 패턴 감지 |
| **동접 스파이크** | Firestore 읽기 비용 급증 | 채팅 `limit(50)`, 보드 페이징, 로컬 캐시, **[v1.1] 300명+ 시 limit(30) 자동 전환** |
| **VFX 스팸** | 화면 도배 · 시청 방해 | Queue 기반 순차 재생, 레전드 동시 1개 제한, 호스트 수동 차단권 |
| **VFX 뇌전증 유발** [v1.1] | 건강 위험, 법적 리스크 | `prefers-reduced-motion` 지원, 초당 3회 이상 깜빡임 금지, 앱 내 "모션 줄이기" 토글 |
| **부적절 발언** | 호스트 부담·법적 리스크 | 기존 깐부방 제재 시스템(mute/kick/ban) 라이브 세션 적용 + **[v1.1] 자동 뮤트(신고 3건)** + Kill Switch |
| **좀비 presence** | 활성자 수 과다 표시 | Cloud Scheduler 1분 주기 stale 정리, **[v1.1] 60초 주기 + 구간 근사치 표시** |
| **모바일 백그라운드** [v1.1] | iOS에서 살아있는 유저 좀비 처리 | Page Visibility API + 포커스 복귀 시 즉시 재연결 + gap fetch |
| **Cold Start 지연** [v1.1] | 땡스볼 투척 3~5초 대기 | Cloud Functions min instances = 1, UX에 "처리 중..." 스피너 |
| **Agora 비용 폭주 (Phase 4-B)** | 무료 티어 초과 시 과금 | 월 사용량 모니터링 대시보드 + 임계치 도달 시 신규 라디오 세션 일시 차단 |
| **세금 미처리** [v1.1] | 세무 리스크, 과태료 | 원천징수 자동 계산, 사업자 유형별 분기, 사업자등록 권고 안내 |
| **저작권 분쟁** [v1.1] | 아카이브 삭제 요청, 법적 분쟁 | DMCA 준용 절차, 72시간 내 1차 대응, `legal_reports` 이력 관리 |

---

## 10. 개발 로드맵

### 10.1 마일스톤

#### M1 — 텍스트 라이브 MVP (2~3주)

- [ ] `live_sessions` · `live_chats` · `live_board` 스키마 구현
- [ ] HostConsole (에디터), LiveSessionPage (참여자 뷰)
- [ ] 기본 채팅, presence 하트비트 (60초 주기)
- [ ] `usePageVisibility()` 훅 — 백그라운드 복귀 대응
- [ ] Firestore Rules 작성 및 테스트
- [ ] **[v1.1]** 신고 버튼 + `live_reports` 기본 기록
- [ ] **[v1.1]** 호스트 뮤트/추방 컨트롤

#### M2 — 결제·충전 시스템 (2주) [v1.1 신규 — 기존 M2 앞으로 이동]

- [ ] 포트원 v2 SDK 연동 (토스페이먼츠/카카오페이/네이버페이)
- [ ] `onPaymentComplete` Cloud Function (웹훅 시그니처 검증)
- [ ] `payment_transactions` 스키마 + Rules
- [ ] 충전 UI (금액 선택 → 결제 모달 → 완료 토스트)
- [ ] 미성년자 월 한도 체크 로직
- [ ] 환불 처리: `processRefund` Cloud Function + 포트원 취소 API

#### M3 — 땡스볼 VFX & Q&A (2주)

- [ ] `sendThanksballToLive` Cloud Function + 트랜잭션
- [ ] LiveVfxOverlay (브론즈·실버 CSS, 골드·레전드 Lottie)
- [ ] **[v1.1]** `prefers-reduced-motion` 분기 + "모션 줄이기" 설정
- [ ] **[v1.1]** 색맹 대응 아이콘 병행 표시
- [ ] `live_qna_queue` 자동 복제, HostConsole에 Q&A 패널
- [ ] Cloud Functions **min instances = 1** 설정

#### M4 — 아카이브 & 정산 (2주) [v1.1 기존 M3 확장]

- [ ] 라이브 종료 트리거 Cloud Function
- [ ] `archive_sessions` → `inkbottle` 발행 플로우 연결
- [ ] **[v1.1]** 아카이브 태그·카테고리 입력 UI
- [ ] **[v1.1]** 아카이브 탐색 페이지 (인기순/최신순/카테고리 필터)
- [ ] **[v1.1]** 세션 종료 시 별점 피드백 모달
- [ ] **[v1.1]** `settlement_ledger` 월간 배치 생성 (Cloud Scheduler)
- [ ] **[v1.1]** 호스트 대시보드 (수익·통계·피드백)
- [ ] **[v1.1]** 원천징수 자동 계산 + 세금계산서 발행 연동
- [ ] 수수료 분기 로직 (입장료·후원·재판매)

#### M5 — 유료 자료함 & On-Lab (2주)

- [ ] `halmal-upload-worker`에 `/lecture-upload`, `/vault-fetch` 라우트
- [ ] 자료 업로드 UI, 슬라이드 네비게이터
- [ ] R2 prefix 기반 접근 권한 검증

#### M6 — 할말 라디오 (선택, 2~3주)

- [ ] Agora SDK 통합, 토큰 서명 Cloud Function
- [ ] 아바타 음성 리액션 애니메이션
- [ ] 마이크 패스(발언권 이양) UX

### 10.2 단계별 우선순위

> **원칙**: 비용 0에 가까운 텍스트 모드를 먼저 출시해 사용자 패턴을 검증하고, 실제 땡스볼 유통이 확인된 후에 Agora 같은 유료 인프라를 투입한다.

> **[v1.1] 변경**: 결제·충전 시스템(M2)을 VFX(M3)보다 앞으로 이동. 돈이 흐르는 파이프가 없으면 땡스볼 경제 자체가 작동하지 않으므로, 텍스트 라이브 MVP(M1) 직후에 결제를 붙여야 한다.

---

## 11. 이용약관·프라이버시 정책 업데이트 [v1.1 신규]

Phase 4 출시 전에 반드시 업데이트해야 하는 법적 문서 체크리스트.

### 11.1 이용약관 추가 조항

- [ ] 라이브 서비스 이용 규칙 (금지 행위, 제재 기준, 운영자 Kill Switch 권한)
- [ ] 땡스볼 충전·후원·환불 정책 (2.4.3 환불 정책 테이블 반영)
- [ ] 호스트 정산 조건 (최소 출금액, 정산 주기, 계좌 변경 절차)
- [ ] 아카이브 상품 관련 권리 (호스트 저작권, 참여자 초상권/채팅 포함 동의)
- [ ] 분쟁 해결 절차 (저작권 침해 DMCA 준용, 명예훼손 접수 절차)
- [ ] 미성년자 결제 제한 및 법정대리인 동의

### 11.2 프라이버시 정책 추가 조항

- [ ] 라이브 채팅 데이터 수집·보관 기간 (아카이브 전환 시 보관 기간 명시)
- [ ] 결제 정보 처리 방침 (PG사 위탁 처리, 카드 정보 미보관)
- [ ] 호스트 계좌 정보 수집·이용 목적·보관 기간
- [ ] 참여자 채팅 로그의 아카이브 상품 포함 동의 수집 근거
- [ ] 탈퇴 시 데이터 삭제 범위 (아카이브에 남은 채팅은 익명화 처리)
- [ ] **[향후 글로벌]** GDPR/CCPA 대응 준비 (현 단계에선 "한국 거주자 한정 서비스" 명시)

### 11.3 동의 수집 UI

- [ ] 회원가입 시: 이용약관 + 프라이버시 정책 동의 (기존에 있으면 개정 동의 배너)
- [ ] 라이브 입장 시: "채팅 내용이 아카이브에 포함될 수 있습니다" 동의 체크
- [ ] 땡스볼 최초 충전 시: 결제 이용약관 동의
- [ ] 호스트 정산 등록 시: 정산 약관 + 개인정보 제3자 제공 동의 (PG사)

---

## 12. 구현 체크리스트

### 12.1 Firestore 준비

- [ ] `live_sessions`, `live_chats`, `live_board`, `live_qna_queue`, `archive_sessions` 컬렉션 Rules 작성
- [ ] **[v1.1]** `payment_transactions`, `settlement_ledger`, `live_reports`, `legal_reports` Rules 작성
- [ ] 복합 인덱스 생성: `live_chats` (type + createdAt), `live_qna_queue` (status + amount desc)
- [ ] **[v1.1]** 복합 인덱스 추가: `archive_sessions` (category + salesCount desc), `live_reports` (sessionId + status)
- [ ] `system_config/live_economy` 문서 생성 (수수료율·VFX 설정)

### 12.2 Cloud Functions

- [ ] `sendThanksballToLive` (callable, 트랜잭션)
- [ ] **[v1.1]** `onPaymentComplete` (포트원 웹훅, 시그니처 검증)
- [ ] **[v1.1]** `processRefund` (callable, 포트원 취소 API)
- [ ] **[v1.1]** `generateSettlement` (pubsub schedule, 매월 16일)
- [ ] `onLiveSessionEnd` (firestore trigger, 아카이브 생성)
- [ ] `cleanupStalePresence` (pubsub schedule, 1분)
- [ ] **[v1.1]** `autoMuteOnReports` (firestore trigger, 신고 3건 자동 뮤트)
- [ ] **[v1.1]** `killLiveSession` (callable, 관리자 전용)
- [ ] `generateAgoraToken` (callable, Phase 4-B)

### 12.3 Worker 확장

- [ ] `/lecture-upload` — 호스트 UID 검증, R2 `lecture/` prefix
- [ ] `/vault-fetch` — 참여 이력 검증, presigned URL 5분 TTL
- [ ] CORS 허용 오리진은 기존 설정 재사용

### 12.4 프런트엔드

- [ ] 라우트: `/live/:sessionId`, `/host/live/:sessionId`
- [ ] **[v1.1]** 라우트 추가: `/host/dashboard`, `/payment/charge`, `/archive/explore`
- [ ] 전역 상태: `useLiveSession` 훅, VFX 큐 Context
- [ ] 기존 감사볼 UI에 "라이브로 투척" 모드 토글 추가
- [ ] 깐부방 상세 화면에 LIVE 배지 + 진입 버튼
- [ ] DOMPurify 기존 설정 그대로 재사용 (채팅/보드 모두 적용)
- [ ] **[v1.1]** `usePageVisibility()` 훅 (모바일 백그라운드 대응)
- [ ] **[v1.1]** 충전 페이지 + 포트원 SDK 연동
- [ ] **[v1.1]** 호스트 대시보드 (수익/통계/피드백/정산)
- [ ] **[v1.1]** 신고 버튼 + 호스트 제재 컨트롤
- [ ] **[v1.1]** 아카이브 탐색 페이지 (검색/필터)
- [ ] **[v1.1]** `prefers-reduced-motion` CSS 분기 + 모션 줄이기 설정
- [ ] **[v1.1]** 스크린리더용 `aria-live` 속성 (채팅/VFX)

### 12.5 QA 체크

- [ ] **보안**: 클라이언트에서 직접 `live_chats`에 thanksball 타입 쓰기 시도 → Rules 거부 확인
- [ ] **보안**: 클라이언트에서 직접 감사볼 적립 시도 → Rules 거부 확인 [v1.1]
- [ ] **결제**: 포트원 웹훅 시그니처 위변조 시 적립 거부 확인 [v1.1]
- [ ] **경제**: 발송자 감사볼 < amount일 때 트랜잭션 실패 및 전체 롤백 확인
- [ ] **환불**: 미사용분 비례 환불 정확도 확인, 사용 완료 건 환불 거부 확인 [v1.1]
- [ ] **동시성**: 3명이 동시에 레전드 투척 시 Queue 순차 재생 확인
- [ ] **아카이브**: 라이브 종료 후 30초 내 `archive_sessions` 생성 확인
- [ ] **presence**: 탭 강제 종료 시 2분 내 `activeUsers` 감소 확인 (60초+120초 stale)
- [ ] **모바일**: iOS Safari 백그라운드 → 포커스 복귀 시 채팅/presence 정상 복구 확인 [v1.1]
- [ ] **접근성**: `prefers-reduced-motion` 활성 시 모든 VFX 정적 대체 확인 [v1.1]
- [ ] **접근성**: 스크린리더(VoiceOver/TalkBack)로 채팅 읽기·투척·신고 플로우 완주 확인 [v1.1]
- [ ] **신고**: 동일 세션 신고 3건 누적 시 자동 뮤트 동작 확인 [v1.1]
- [ ] **Kill Switch**: 관리자 강제 종료 시 전 참여자 즉시 세션 종료 확인 [v1.1]
- [ ] **정산**: 매월 배치 정산 생성 → 원천징수 계산 → 정산 완료 플로우 E2E [v1.1]

---

*— 할말있소 Phase 4 Live Economy 기획서 v1.1 끝 —*
