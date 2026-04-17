# KANBU.md — 🏠 깐부방 상세 설계서

> 이 문서는 blueprint.md 에서 분리된 깐부방(Kanbu Room) 단독 설계서다.
> 깐부 맺기 홍보 · 깐부방 5탭 구조 · 유료 게시판 A/B · 라이브 이코노미 · 수수료·정산·세무 통합 · 홈 피드 격리 · 호스트 공백 처리를 모두 포함한다.

---

## 1. 개요 & 원칙

### 1.1 정의
- **깐부 맺기** (`friends`): Lv2+ 유저가 이미지·키워드·공약을 등록해 자신을 홍보하는 카드. 클릭 시 공개 프로필 + 깐부맺기 팝업.
- **깐부방** (`kanbu_room`): 깐부 관계인 유저들이 모이는 사적 공간. 5탭 구조(자유/유료1회/유료구독/채팅/멤버 + 관리).

### 1.2 분리 원칙 (2026-04-17)
- 깐부방 게시판 3종에 올린 글은 **참새들의 방앗간(홈)·카테고리·랭킹·한컷 피드에서 완전 격리**된다.
- 격리 키: `posts.kanbuRoomId` 필드 존재 여부.
- 홈 피드 필터(`App.tsx`): `!p.kanbuRoomId` 조건 필수.
- 이유: 깐부방은 사적 공간이며 오픈 피드의 신선도·품질 기준과 다른 맥락.

### 1.3 홍보 인터리브 (2026-04-17)
- 깐부방 찾기 화면: **방 카드 6개(2줄) → 🤝 깐부맺기 홍보 카드 4명(1줄) → 나머지 방 카드** 순.
- 홈 피드의 "새글·한컷 인터리브" 패턴과 동일하게 홍보 인터리브 공간 확보.
- 홍보 카드 클릭 → 공개 프로필 모달(홈 패턴 동일). 우상단 "깐부맺기 →" 헤더는 `friends` 메뉴로 이동.

---

## 2. 데이터 모델

### 2.1 `KanbuRoom` (`src/types.ts`)

```typescript
interface KanbuRoom {
  id: string;
  title: string;
  description?: string;
  creatorNickname: string;
  creatorId: string;
  creatorLevel: number;
  createdAt: any;

  // 🚀 2026-04-16 업그레이드
  memberIds?: string[];                // 자유 게시판·채팅 접근용
  memberCount?: number;
  paidBoards?: {                       // 유료 A/B 설정 (관리 탭)
    once?:    { enabled: boolean; price: number; title: string };
    monthly?: { enabled: boolean; price: number; title: string };
  };
  paidOnceMembers?: string[];          // 유료 1회 결제 멤버
  paidMonthlyMembers?: string[];       // 유료 구독 멤버

  // 🔴 2026-04-16 라이브
  liveSessionId?: string;              // 진행 중인 live_sessions 문서 ID
}
```

### 2.2 `Post` 확장 필드

```typescript
interface Post {
  kanbuRoomId?: string;                // 소속 깐부방 ID — 홈 피드 격리 키
  kanbuBoardType?: 'free' | 'paid_once' | 'paid_monthly';
  // ... 기타 Post 필드
}
```

### 2.3 Firestore 컬렉션

| 컬렉션 | 용도 | ID 규칙 |
|--------|------|---------|
| `kanbu_rooms` | 깐부방 메타 | 자동 ID |
| `kanbu_rooms/{id}/chats` | 실시간 채팅 | 자동 ID |
| `kanbu_paid_subs` | 월 구독 만료 추적 | `{roomId}_{uid}` |
| `live_sessions` | 🔴 라이브 세션 메타 (깐부방 전용) | 자동 ID |
| `live_sessions/{id}/live_chats` | 라이브 채팅 | 자동 ID |
| `live_sessions/{id}/live_board` | 텍스트 라이브 보드 라인 | 자동 ID |
| `live_sessions/{id}/presence` | 참가자 하트비트 | UID 키 |

### 2.4 Firestore Rules 요지

- `kanbu_rooms`: 전체 read, 개설자만 write. `paidOnceMembers`/`paidMonthlyMembers` 직접 수정 차단 (Cloud Function 경유).
- `live_sessions.totalThanksball`: `hasOnly(['totalThanksball'])` 조건으로 참가자의 땡스볼 누적 허용.
- 복합 인덱스: `live_chats` `type + createdAt`.

---

## 3. 컴포넌트 구조

```
/src/components
├── KanbuPromoCard.tsx         # 깐부 홍보 카드 (아바타·키워드·이미지·공약·조회수·게시종료)
├── KanbuPromoModal.tsx        # 홍보 상세 모달 (공개프로필 + 깐부맺기 버튼)
├── KanbuRoomList.tsx          # 깐부방 찾기 — 방 6개 → 홍보 4명 → 나머지 방 인터리브
├── MyKanbuRoomList.tsx        # 내가 가입한 방 (compact=true: 사이드바 소형)
├── CreateKanbuRoomModal.tsx   # 방 개설 (Lv3+)
├── KanbuRoomView.tsx          # 방 상세 5탭 라우팅 + 유료 페이월 + 라이브 진입
├── KanbuBoardView.tsx         # 게시판 1종 뷰 (자유/유료1회/유료구독 공통, AnyTalkList 카드 포맷)
├── CreateKanbuPost.tsx        # 게시판 글 작성 폼 (참새방 스타일 + kanbuRoomId/kanbuBoardType 자동 기입)
├── LiveBoard.tsx              # 🔴 텍스트 라이브 (호스트·참가자, 3스타일)
└── LiveVfxOverlay.tsx         # 🔴 땡스볼 VFX 오버레이 (bronze·silver·gold·legend)
```

### 3.1 깐부방 찾기 레이아웃 (`KanbuRoomList.tsx`)
- 그리드 `[repeat(auto-fill,minmax(260px,1fr))]`.
- `firstSegment = rooms.slice(0, 6)` → 홍보 1줄 → `restSegment = rooms.slice(6)`.
- 비깐부 방은 `🔒 깐부만` 표시 + opacity-70.
- 홍보 필터: `promoEnabled && !expired && uid !== 본인 && !friends.includes(nickname)`.

### 3.2 깐부방 5탭 (`KanbuRoomView.tsx`)
| 탭 ID | 표시명 | 접근 조건 |
|------|-------|---------|
| `free_board` | 📋 자유 게시판 | 멤버(memberIds) |
| `paid_once` | 🔒 유료 게시판 (1회) | paidOnceMembers + 개설자. 미결제 시 페이월. `paidBoards.once.enabled`만 노출. |
| `paid_monthly` | 🔒 유료 게시판 (구독) | paidMonthlyMembers + 개설자. 미구독 시 페이월. `paidBoards.monthly.enabled`만 노출. |
| `chat` | 💬 실시간 채팅 | 멤버 |
| `members` | 👥 멤버 | 멤버 (유료/구독 배지 구분) |
| `live` | 🔴 텍스트 라이브 | 개설자 생성 시 활성, 참가는 전체 |
| `admin` | ⚙️ 관리 | 개설자 |

### 3.3 게시판 1종 뷰 (`KanbuBoardView.tsx`)
- 2026-04-17 개편: 긴 바 목록 → **홈 새글 동일 그리드 카드**로 통일 (`[repeat(auto-fill,minmax(280px,1fr))]`).
- 카드 구조: 시간 → 제목 → 본문 프리뷰(이미지 숨김) → 이미지 → 아바타/Lv/평판/깐부수 → 댓글/땡스볼/좋아요.
- boardType prop으로 free/paid_once/paid_monthly 필터. allUsers/followerCounts/commentCounts 주입으로 실시간 바인딩.

### 3.4 관리 탭 (`KanbuRoomView` admin 섹션)
- 방 제목·설명 수정.
- 유료 A/B 설정: enabled 토글 + price (볼) + title.
- 멤버 강퇴 (`memberIds` arrayRemove + `paidOnceMembers`/`paidMonthlyMembers`에서도 제거).
- 방 삭제 (`deleteDoc`).

---

## 4. Cloud Functions

### 4.1 `joinPaidKanbuRoom` (`functions/kanbuPaid.js`)
- 호출자: 멤버(1회 또는 구독 결제).
- 트랜잭션:
  1. `users.ballBalance` 차감 (부족 시 실패).
  2. 레벨별 수수료 계산: Lv3-4 30% / Lv5-6 25% / Lv7+ 20% (강변 시장 동일).
  3. 개설자 `users.pendingRevenue`에 (price - fee) 누적 → WithdrawModal/SettlementQueue/calculateWithholdingTax 자동 연결.
  4. `platform_revenue/kanbu_room` 플랫폼 수수료 누적.
  5. `kanbu_rooms.{paidOnceMembers|paidMonthlyMembers}` arrayUnion.
  6. 월 구독 시 `kanbu_paid_subs/{roomId}_{uid}.expiresAt` 기록.
  7. 개설자에게 알림.

### 4.2 `checkKanbuSubscriptionExpiry` (스케줄러, `functions/kanbuPaid.js`)
- 매일 09:00 (서울).
- `kanbu_paid_subs` 에서 `expiresAt < now` 문서 조회 → `kanbu_rooms.paidMonthlyMembers` arrayRemove + 구독자 알림.

### 4.3 `registerKanbuPromo` (`functions/kanbuPromo.js`)
- Lv2+ 깐부 맺기 홍보 카드 등록 (기간제 과금).
- `users.{promoEnabled, promoImageUrl, promoKeywords, promoMessage, promoExpireAt, promoPlan}` Rules 차단 필드 → CF 전용.

### 4.4 `cleanupLivePresence` (스케줄러, `functions/livePresence.js`)
- 매 1분, 120초 이상 ping 없는 presence 문서 삭제 (좀비 참가자 정리).

---

## 5. 🔴 라이브 이코노미 Phase 4-A (2026-04-16)

> 상세 설계: [halmal-itso-live-economy.md](./halmal-itso-live-economy.md)

### 5.1 구현 범위 (Sprint A+B 완료)
- **텍스트 라이브 MVP**: 호스트가 3스타일(normal/highlight/title) 라인 추가 → 참가자 실시간 열람.
- **Presence 하트비트**: 클라이언트 60초 ping, 서버 120초 stale cutoff, unmount 시 즉시 삭제.
- **VFX 오버레이**: 땡스볼 티어별 애니메이션 (bronze 2s · silver 5s · gold 10s · legend 15s). `prefers-reduced-motion` 지원.
- **라이브 땡스볼**: 참가자 ⚾ 버튼 → 티어 선택 → `live_sessions.totalThanksball` 누적 + VFX 재생.

### 5.2 데이터 흐름
- `live_sessions.status`: `live` → `ended` → `killed`(관리자 강제종료).
- `live_sessions.totalThanksball`: Firestore Rules 에서 참가자 update 허용 (`hasOnly(['totalThanksball'])`).

### 5.3 관련 훅/컴포넌트
- `src/hooks/useLivePresence.ts` — 60s heartbeat + unmount cleanup.
- `LiveBoard.tsx` — 보드 + 상태바 + 티어 선택 버튼.
- `LiveVfxOverlay.tsx` — 큐 기반 순차 재생.

---

## 6. 수수료 · 정산 · 세무

### 6.1 레벨별 수수료율 (강변 시장과 통일)
| 레벨 | 수수료율 |
|------|---------|
| Lv3-4 | 30% |
| Lv5-6 | 25% |
| Lv7+ | 20% |

### 6.2 자동 통합 체인
`joinPaidKanbuRoom` → `users.pendingRevenue` 증가 → `WithdrawModal` 인출 요청 → `SettlementQueue` 집계 → `calculateWithholdingTax`(3.3% 사업자 / 8.8% 종합) → 지급.

### 6.3 플랫폼 대시보드
- `admin/PlatformRevenueDashboard.tsx` 에 **깐부방 수익 카드** 추가.
- `platform_revenue/kanbu_room` 문서 실시간 구독.
- "광고 수익" 라벨은 크리에이터 측에서 "크리에이터 수익"으로 범용화.

---

## 7. 홍보 카드 (KanbuPromoCard) 규격

### 7.1 표시 요소 (2026-04-17 기준)
1. 아바타 + 닉네임 + Lv · 평판 · 깐부수
2. 키워드 태그 (#최대 3개)
3. 홍보 이미지 (max-h 200px, `object-contain` + hover scale)
4. 공약 메시지 (2줄 clamp)
5. **조회수 + 게시 종료 표시** — `👀 N회 · 게시 종료 N일|N시간` 같은 줄 표시 (만료 시 slate-400)

### 7.2 만료 처리
- `promoExpireAt.seconds * 1000 < now` → `expired: true` → 카드 클릭 비활성 + opacity 50% + grayscale 30%.

---

## 8. 접근 제어 · 보안

| 항목 | 규칙 |
|------|------|
| 방 개설 | Lv3+ (CreateKanbuRoomModal 가드) |
| 자유 게시판 | `memberIds` 포함 유저 |
| 유료 1회 | `paidOnceMembers` + 개설자 |
| 유료 구독 | `paidMonthlyMembers` + 개설자 |
| 글 작성 | 해당 탭 접근 권한 + ballBalance(유료 진입 시) |
| 글 노출 | 방 내부에서만 (홈/카테고리/랭킹/한컷에서 `kanbuRoomId` 필터로 제외) |
| DiscussionView 진입 | `kanbuRoomId`가 있는 글은 깐부방 내부 상세 라우팅으로 연결 |

---

## 9. 향후 과제 (TODO)

### 9.1 깐부방 호스트 공백 처리 (Host Vacancy Handler) — 🟡 MID
**우선순위**: 유배귀양지 해금 CF (`releaseFromExile`) 출시 전까지 필수.

**배경**: 깐부방 호스트가 자리를 비우는 4가지 사유.
1. 정상 탈퇴
2. 유배귀양지 해금 (유배 시스템에서 자동 호출)
3. 사약(Sayak) 처분 (영구 추방)
4. 계정 장기 미접속 / 휴면

**공통 처리 로직**
1. **방장 위임 (Host Transfer)**: `kanbu_rooms/{roomId}/members` `joinedAt` 오름차순 첫 번째 멤버에게 자동 위임 → 시스템 알림 + 공지 게시.
2. **멤버 0명인 경우**: 방 즉시 해체 (`status: 'dissolved'` soft delete).
3. **유예 기간 (Grace Period)**: 위임 후 7일.

**Firestore 스키마 추가**
- `kanbu_rooms/{roomId}.hostTransferredAt: Timestamp | null`
- `kanbu_rooms/{roomId}.hostTransferReason: 'withdrawal' | 'exile_release' | 'sayak' | 'dormant'`

**구현 위치**: `functions/kanbu/handleHostVacancy.ts` (독립 유틸 — 유배/탈퇴 양쪽에서 호출).

**미결정 사항**
- 위임받은 멤버의 거부 옵션 여부 (사전 동의 vs 사후 알림).
- 유예 기간 7일 적정성 (3일/2주 대안).

### 9.2 라이브 Phase 4-B~E (halmal-itso-live-economy.md)
- 슬라이드 라이브 (currentSlideIndex 동기화)
- Q&A 큐
- 관리자 강제 종료 UI
- 참가 포인트/피드백

### 9.3 홍보 카드 슬롯 할당
- 현재 상위 4명만 표시 — 회전/랜덤/랭킹 기준 정의 필요.

---

## 10. 관련 문서

- [blueprint.md](./blueprint.md) — 깐부방 항목 요약 (§5 카테고리 테이블)
- [halmal-itso-live-economy.md](./halmal-itso-live-economy.md) — 라이브 이코노미 Phase 4 전체 로드맵
- [MARKET.md](./MARKET.md) — 동일 수수료 체계 참조
- [STOREHOUSE.md](./STOREHOUSE.md) — 유배 시 호스트 공백 연동
- [changelog.md](./changelog.md) — 구현 이력

---

*최종 수정: 2026-04-17 — 깐부방 게시글 홈 피드 격리 + 홍보 인터리브 + 게시판 그리드 카드 통일 반영.*
