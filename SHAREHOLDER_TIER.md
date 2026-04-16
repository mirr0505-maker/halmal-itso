# 🛡️ 주주방 인증 체계 (SHAREHOLDER_TIER) — 설계서 v1.0

> **주주방(`community.category === '주식'`) 전용** 주식 보유수 기반 등급 인증 시스템.
> 기존 장갑(GLOVE.md) 시스템의 특화 기능으로, 수동 인증 + (미래) 마이데이터 자동 인증 2트랙.

- 최종 갱신: 2026-04-16
- 연계: `GLOVE.md` §12 정보봇, `blueprint.md` §8
- 미룬 작업: `SHAREHOLDER_BACKLOG.md`

---

## 목차

1. [개요 & 3대 원칙](#1-개요--3대-원칙)
2. [등급 체계](#2-등급-체계)
3. [2-트랙 인증 구조](#3-2-트랙-인증-구조)
4. [Phase 실행 로드맵](#4-phase-실행-로드맵)
5. [Phase A — 타입 정의](#5-phase-a--타입-정의)
6. [Phase B — 방장 인증 관리 화면](#6-phase-b--방장-인증-관리-화면)
7. [Phase C — 배지 전파](#7-phase-c--배지-전파)
8. [Phase H — 게시글/댓글 tier 스냅샷](#8-phase-h--게시글댓글-tier-스냅샷)
9. [Firestore 데이터 모델](#9-firestore-데이터-모델)
10. [보안 설계](#10-보안-설계)
11. [비용](#11-비용)

---

## 1. 개요 & 3대 원칙

기존 커뮤니티 시스템(GLOVE.md)은 "장갑"으로 일반화되어 있고, 그중 `category === '주식'`인 **주주방**은 다음 특성을 가집니다:

- 논의 주제가 실제 주식 보유 여부에 따라 신뢰도가 크게 달라짐
- "목소리의 무게" — 1주 보유자의 의견과 10만주 보유자의 의견을 동일하게 취급하면 왜곡 발생
- 그렇다고 실제 보유수를 공개·저장하면 개인정보·해킹 리스크 폭증

**3대 원칙:**

1. **주주방 한정** — `community.category === '주식'` 일 때만 활성. 다른 커뮤니티엔 영향 0.
2. **Stateless 보유수** — 실제 주식 보유 수량은 DB에 **절대 저장하지 않음**. `tier`(등급 라벨)만 저장.
3. **최소 비용 진화** — Phase A~C는 수동 인증(비용 0), Phase E~F는 Codef 데모(무료) 시작 → 서비스 성장 후 정식 전환.

---

## 2. 등급 체계

| 등급 | 코드 | 보유 범위 | 의미 |
|:---:|:---:|:---|:---|
| 🐟 새우 | `shrimp` | 1 ~ 999주 | 소액 개인 투자자 |
| 🦈 상어 | `shark` | 1,000 ~ 9,999주 | 적극 개인 투자자 |
| 🐋 고래 | `whale` | 10,000 ~ 99,999주 | 자산가·기관 규모 |
| 🐳 대왕고래 | `megawhale` | 100,000주 이상 | 대주주 규모 |

### TypeScript 정의

```typescript
export type ShareholderTier = 'shrimp' | 'shark' | 'whale' | 'megawhale';

export const TIER_CONFIG = {
  shrimp:    { emoji: '🐟', label: '새우',    min: 1,      max: 999 },
  shark:     { emoji: '🦈', label: '상어',    min: 1000,   max: 9999 },
  whale:     { emoji: '🐋', label: '고래',    min: 10000,  max: 99999 },
  megawhale: { emoji: '🐳', label: '대왕고래', min: 100000, max: Infinity },
} as const;

// 보유수 → tier 산정 헬퍼
export const getTierFromQuantity = (qty: number): ShareholderTier => {
  if (qty >= 100000) return 'megawhale';
  if (qty >= 10000)  return 'whale';
  if (qty >= 1000)   return 'shark';
  return 'shrimp';
};
```

---

## 3. 2-트랙 인증 구조

```
┌─────────────────────────────────────────────────────────────┐
│                      주주방 인증 체계                        │
│                                                             │
│  [트랙 A] 수동 인증 (지금 당장 — Phase A~C + H)              │
│    가입 신청 → joinAnswers에 종목/수량 자기신고               │
│    → 방장이 VerifyShareholderPanel에서 확인                  │
│    → tier 수동 부여 (source: 'manual')                       │
│                                                             │
│  [트랙 B] 마이데이터 자동 인증 (Phase E~F — 미룸)            │
│    멤버가 Codef 인증 → Worker가 API 호출                     │
│    → 보유수 메모리에만 로드 → tier 자동 산정                  │
│    → 방장에게 결과 표시 → 방장이 최종 승인                    │
│    → verified.source = 'mydata' 또는 'manual_override'       │
│                                                             │
│  두 트랙 모두 최종 결과는 동일:                               │
│    verified.tier 필드에 등급만 저장 (보유수 저장 안 함)        │
└─────────────────────────────────────────────────────────────┘
```

> Phase E/F 관련은 `SHAREHOLDER_BACKLOG.md`에 숙제로 등록. 이 문서는 **트랙 A(수동 인증)** 중심.

---

## 4. Phase 실행 로드맵

| Phase | 작업 | 상태 | 의존성 |
|:-:|:--|:-:|:--|
| **A** | types.ts — `ShareholderTier` + `TIER_CONFIG` + `VerifiedBadge.tier/source` + `Community.shareholderSettings` | 이번 구현 | 없음 |
| **B** | `VerifyShareholderPanel.tsx` 신규 + `CommunityAdminPanel`에 "주주 인증" 탭 + `TierSelector` 컴포넌트 | 이번 구현 | A |
| **C** | 닉네임 배지 4지점(채팅·멤버·글·댓글)에 tier emoji 전파 — `category === '주식'`일 때만 | 이번 구현 | B |
| **H** | 게시글/댓글 작성 시점의 tier 스냅샷 표시 — 실제 보유수 비노출, tier 범위만 | 이번 구현 | C |
| ~~D~~ | ~~가중치 투표 표시~~ | **제거됨** | — |
| **E** | Worker `/api/verify-shares` + Codef 연동 | [BACKLOG](./SHAREHOLDER_BACKLOG.md) | A, B |
| **F** | 클라이언트 마이데이터 UI (증권사 선택 + Codef 인증서 팝업) | [BACKLOG](./SHAREHOLDER_BACKLOG.md) | E |

---

## 5. Phase A — 타입 정의

### 변경 파일
`src/types.ts` 한 파일만.

### 추가 내용

```typescript
// ═══════════════════════════════════════════════════════
// 🛡️ 주주방 인증 체계 (SHAREHOLDER_TIER.md 참조)
// ═══════════════════════════════════════════════════════

export type ShareholderTier = 'shrimp' | 'shark' | 'whale' | 'megawhale';

export const TIER_CONFIG = {
  shrimp:    { emoji: '🐟', label: '새우',    min: 1,      max: 999 },
  shark:     { emoji: '🦈', label: '상어',    min: 1000,   max: 9999 },
  whale:     { emoji: '🐋', label: '고래',    min: 10000,  max: 99999 },
  megawhale: { emoji: '🐳', label: '대왕고래', min: 100000, max: Infinity },
} as const;

export const getTierFromQuantity = (qty: number): ShareholderTier => {
  if (qty >= 100000) return 'megawhale';
  if (qty >= 10000)  return 'whale';
  if (qty >= 1000)   return 'shark';
  return 'shrimp';
};
```

### 기존 인터페이스 확장

```typescript
// 기존 VerifiedBadge (types.ts ~330행)에 2필드 추가
interface VerifiedBadge {
  verifiedAt: FirestoreTimestamp;
  verifiedBy: string;
  verifiedByNickname: string;
  label: string;
  tier?: ShareholderTier;                                          // 🆕
  source?: 'manual' | 'mydata' | 'manual_override';                // 🆕
}

// 기존 Community (types.ts ~415행)에 1필드 추가
interface Community {
  // ...기존 필드...
  shareholderSettings?: {                                          // 🆕
    stockCode: string;       // 종목코드 (예: "005930")
    stockName: string;       // 종목명 (예: "삼성전자")
    enableMydata: boolean;   // Phase E~F 활성화 여부 (기본 false)
  };
}
```

**투표 관련 필드(`enableWeightedVote`, `TIER_VOTE_WEIGHT`) 및 `mydataRequest` 필드는 이 문서에서 제외.** (Phase D 제거, Phase E/F는 BACKLOG에서 별도 관리)

---

## 6. Phase B — 방장 인증 관리 화면

### 신규 컴포넌트

`src/components/VerifyShareholderPanel.tsx` — 주주방 전용 인증 관리

### 진입점
`CommunityAdminPanel` 내부. 조건: `community.category === '주식'`.

섹션 순서(기존):
1. 승인 대기
2. 장갑 설정
3. 닉네임 배지
4. 멤버 승급 조건
5. 정보봇 (주식 전용)
6. **🆕 주주 인증 (주식 전용)** ← 신설
7. 장갑 폐쇄

### 레이아웃

```
┌────────────────────────────────────────────────────────────┐
│ 🛡️ 주주 인증 관리                                          │
│                                                            │
│ 📌 종목 설정                                                │
│   종목코드: [005930      ]  종목명: [삼성전자       ]        │
│   [저장]                                                    │
│                                                            │
│ ┌─ 인증 대기 목록 (verified 없는 ring 멤버) ───────────────┐ │
│ │ [아바타] 홍길동  ring · 가입일 4/8                       │ │
│ │   📋 가입 답변 (JoinAnswersDisplay compact):             │ │
│ │     종목/수량/기타 — 방장이 수동 확인                     │ │
│ │   등급 선택 (TierSelector):                              │ │
│ │     ○ 🐟 새우  ○ 🦈 상어  ● 🐋 고래  ○ 🐳 대왕고래       │ │
│ │   [인증 부여]  [거절]                                    │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                            │
│ ┌─ 인증 완료 목록 (verified 있는 ring 멤버) ───────────────┐ │
│ │ [아바타] 김철수  🐋 고래  인증일 4/10  source: manual    │ │
│ │   [등급 변경]  [인증 해제]                                │ │
│ └──────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

### 핵심 동작

- **종목 설정:** `communities/{id}.shareholderSettings.stockCode/stockName` 저장. 방장만 수정 가능
- **인증 부여:** `community_memberships/{id}_{uid}.verified` 객체 신규 저장
  ```js
  {
    verifiedAt: serverTimestamp(),
    verifiedBy: currentUid,
    verifiedByNickname: currentNickname,
    label: '🛡️ 주주 인증',
    tier: 'whale',
    source: 'manual',
  }
  ```
- **등급 변경:** 기존 verified 유지하되 tier만 변경, `source: 'manual_override'`로 기록
- **인증 해제:** `verified` 필드 delete (FieldValue.delete())

### 재사용 컴포넌트

- **`JoinAnswersDisplay`** (기존 완성) — compact 모드로 가입 답변 표시
- **`VerifiedBadge`** (기존 완성) — tier emoji 포함하도록 확장 (Phase C에서)

### 신규 컴포넌트

`TierSelector` — 4개 등급 라디오 버튼. TIER_CONFIG 순회 렌더링. 선택 시 emoji + label + min/max 범위 미리보기.

---

## 7. Phase C — 배지 전파

### 배지 표시 4지점

주주방(`community.category === '주식'`) 내에서만 표시:

1. **소곤소곤 피드** (`CommunityFeed` 글 카드 닉네임 옆)
2. **채팅 메시지** (`CommunityChatPanel` 메시지 닉네임 옆)
3. **커뮤니티 글 상세** (`CommunityPostDetail` 작성자 · 댓글 작성자)
4. **멤버 목록** (`CommunityView` 멤버 탭)

### 표시 형태

```
홍길동  🐋 🛡️ 주주 인증 (26.4.8)
```

- `tier.emoji` 먼저 (🐟/🦈/🐋/🐳)
- `VerifiedBadge.label` + 인증일
- 다른 카테고리 커뮤니티에서는 tier emoji **표시 안 함**

### 구현 방식

`VerifiedBadge` 렌더링 컴포넌트에 `tier` prop 추가:

```tsx
<VerifiedBadge
  verified={membership.verified}
  showTier={community.category === '주식'}
/>
```

내부 로직:
```tsx
const tierEmoji = showTier && verified.tier
  ? TIER_CONFIG[verified.tier].emoji
  : '';
```

---

## 8. Phase H — 게시글/댓글 tier 스냅샷

### 목적
주주방 내 게시글·댓글 작성 시점의 작성자 tier를 글 카드에 명시 → "이 의견의 무게" 직관적 전달.

### 표시

```
[아바타] 홍길동  🐋 고래  🛡️ 주주 인증 (26.4.8)

"삼성전자 자사주 매입은 주가에 긍정적이라고
 봅니다. 작년 같은 시기에도..."

💡 이 의견은 고래(1만주+) 주주가 작성했습니다
```

### 원칙

- **닉네임은 표시**하되 실제 보유수는 **절대 비노출**
- `tier` 범위만 텍스트로 ("1만주 이상")
- `community.category !== '주식'` 커뮤니티에서는 표시 안 함

### 구현

`CommunityPostDetail` · `CommunityPostCard` · `CommunityPostComment` 컴포넌트에서:

```tsx
{community.category === '주식' && membership?.verified?.tier && (
  <div className="text-[10px] text-slate-500 font-bold italic mt-1">
    💡 이 의견은 {TIER_CONFIG[verified.tier].label}({tierRangeLabel(verified.tier)}주) 주주가 작성했습니다
  </div>
)}
```

`tierRangeLabel`:
```ts
const tierRangeLabel = (tier: ShareholderTier) => ({
  shrimp: '1~999',
  shark: '1천~1만',
  whale: '1만~10만',
  megawhale: '10만+',
}[tier]);
```

---

## 9. Firestore 데이터 모델

### `communities/{communityId}` 확장

```js
{
  // ...기존 필드...
  category: '주식',
  shareholderSettings: {
    stockCode: '005930',
    stockName: '삼성전자',
    enableMydata: false,   // Phase E~F 활성화 시 true
  }
}
```

### `community_memberships/{communityId}_{userId}` 확장

```js
{
  // ...기존 필드...
  role: 'ring',
  verified: {
    verifiedAt: Timestamp,
    verifiedBy: '방장 UID',
    verifiedByNickname: '방장 닉네임',
    label: '🛡️ 주주 인증',
    tier: 'whale',                                   // 🆕
    source: 'manual',                                // 🆕 'manual' | 'mydata' | 'manual_override'
  },
}
```

### Firestore Rules

**변경 불필요** — `verified` 필드는 이미 관리자 업데이트 hasOnly 목록에 포함되어 있음(GLOVE.md §9 참조).

---

## 10. 보안 설계

| 항목 | 결정 | 이유 |
|:--|:--|:--|
| 실제 보유수 | **DB 저장 금지** | 개인정보보호·해킹 리스크 |
| `tier` (등급) | DB 저장 허용 | 무해한 범주 데이터 |
| `joinAnswers.shares` (자기신고) | 영구 보존 (기존) | 방장 인증 확인용 |
| 증거 이미지 (R2) | 현재 공개 URL → **presigned 5분 만료로 강화 예정** | [BACKLOG](./SHAREHOLDER_BACKLOG.md) |
| Codef API 키 | Worker에만 보관 (Phase E) | 클라이언트 노출 0 |
| Connected ID | 저장 안 함 (Phase E) | 매번 인증서로 재발급 |

---

## 11. 비용

| 단계 | 비용 | 비고 |
|:--|:--|:--|
| Phase A~C + H (이번) | **0원** | 코드 변경만 |
| Phase E~F 개발/테스트 | 0원 | Codef 샌드박스 무료 |
| 초기 운영 | 0원 | Codef 데모 일 100회 무료 |
| 서비스 성장 후 | 월 구독 | Codef 정식 전환, 사업자 등록 필요 |

---

## 부록: 제거된 항목

다음 항목은 초기 기획에서 **완전 제거**되었습니다:

- ~~Phase D — 가중치 투표 표시~~
- ~~`TIER_VOTE_WEIGHT` 상수~~
- ~~1인 1표 vs 가중치 반영 병렬 표시 UI~~
- ~~투표(poll) 기능 자체~~

이 결정은 서비스 단순성과 MVP 범위 집중을 위한 것입니다. 추후 필요 시 별도 기획으로 재도입 가능.
