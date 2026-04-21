# 🏅 글러브(GeuLove) 마패 · 칭호 통합 설계서 (MAPAE_AND_TITLES_V1.md)

> **작성일**: 2026-04-20
> **버전**: v1.0 (Step 1 종합기획)
> **상태**: 신규 시스템 설계, 구현 대기
> **의존**: GLOVE_SYSTEM_REDESIGN_v2.md §6.4, §6.5 · CREATOR_SCORE.md §10.1 (마패 공개 API) · REPUTATION_V2.md · LEVEL_V2.md · KANBU_V2.md · ANTI_ABUSE.md · PRICING.md §2 (유배)
> **후속 의존**: ADMIN.md (관리자 UI)

---

## 📋 목차

- §0. 개요 & 원칙
- §1. 현재 상태 진단 (부재)
- §2. 설계 요구사항
- §3. 마패 시스템 상세
- §4. 칭호 시스템 상세 (14개)
- §5. 대표 칭호 시스템
- §6. 획득 로직 (CF 설계)
- §7. 유배·제재 연동
- §8. 데이터 모델
- §9. 구현 변경 범위
- §10. Phase별 로드맵
- §11. 테스트 시나리오
- §12. 결정 요약 & 다음 단계

---

## 0. 개요 & 원칙

### 0.1 문서 범위

**MAPAE_AND_TITLES_V1은 마패(5단계)와 칭호(14개)를 통합한 인정(recognition) 시스템의 단일 진실 소스**다.

**두 시스템의 본질적 차이**:

| 구분 | 마패 | 칭호 |
|------|:----:|:----:|
| 타입 | 단일 티어 (5개 중 1개) | 배지 컬렉션 (14개 중 N개) |
| 지표 성격 | **현재 상태** | **과거 업적** |
| 변동성 | 실시간 (Creator Score 변동) | 영구 보유 (유배 시 일부 박탈) |
| 입력 | Creator Score 단일 | 다양한 조건 (글/깐부/땡스볼/시간 등) |
| 수량 | 1인당 1개 | 1인당 0 ~ 14개 |
| 표시 | 아바타 주변 (상시) | 닉네임 옆 1개 + 프로필 컬렉션 |

**포괄 범위**:
- **마패 5단계**: 동/은/금/백금/다이아 시각 + 티어 변화 알림
- **칭호 14개**: 크리에이터 5 + 커뮤니티 5 + 플랫폼 로열티 4
- **대표 칭호**: 닉네임 옆 노출 시스템
- **획득 로직**: CF `checkTitleAchievement` 공통 구조
- **유배 연동**: 단계별 박탈 정책
- **어뷰징 방지**: "유효 활동" 정의

**다음 범위는 다른 문서가 담당**:

| 범위 | 담당 문서 |
|------|-----------|
| Creator Score 계산 | `CREATOR_SCORE.md` |
| 평판 공식·감쇠 | `REPUTATION_V2.md` |
| 레벨·EXP 공식 | `LEVEL_V2.md` |
| 관리자 수동 칭호 부여/박탈 | `ADMIN.md` (후속) |
| 유배 속죄금 구조 | `PRICING.md §2` |
| 어뷰징 탐지 CF | `ANTI_ABUSE.md` |

### 0.2 3대 원칙

**① 마패 = "지금"의 가치, 칭호 = "기록"의 업적**

두 시스템은 **의도적으로 서로를 대체하지 않는다**.

```
예시 1:
  2년 전 "초대박" 칭호 획득 (글 1,000 좋아요)
  → 현재 비활성 (Creator Score 0.3)
  → 마패: 없음 / 칭호: [🔰 새싹, 💎 초대박] 유지

예시 2:
  신규 유저, 가입 2주차
  → 일주일 연속 활발 활동 → Creator Score 1.2
  → 마패: 은마패 / 칭호: [🔰 새싹] 단 1개
```

**② 곱셈이 아닌 병렬**

Creator Score처럼 축들이 곱해지지 않는다. 마패와 칭호는 **독립 병렬 지표**.

**③ 영구성과 변동성의 분리**

- 마패: Creator Score 하락 시 **즉시 강등**
- 칭호: 유배급 제재 아니면 **영구 보유**

"한 번 받으면 내 것"이라는 안정감 + "현재 내가 얼마나 기여하는가"의 실시간성을 동시 제공.

### 0.3 마패와 칭호의 역할

**마패의 3대 기능**:

**① 현재 기여도의 즉각적 피드백**
- 오늘 열심히 활동 → 내일 마패 상승 가능
- 활동 멈춤 → 마패 하락

**② 권한 게이트와 시각적 매칭**
- 광고 수익 출금 자격 (Creator Score ≥ 1.0 = 은마패)
- 라이브 호스트 자격 (Creator Score ≥ 0.5 = 동마패)
- 마패 = 유저가 볼 수 있는 권한 시그널

**③ 유튜브 크리에이터 버튼과 유사한 열망 장치**
- 🥉 동마패 ≈ "크리에이터 시작"
- 🥈 은마패 ≈ 실버버튼 (10만 구독)
- 🥇 금마패 ≈ 골드버튼 (100만)
- 💎 백금마패 ≈ 서브스크라이버 1백만
- 👑 다이아마패 ≈ 다이아몬드버튼 (1천만)

**칭호의 3대 기능**:

**① 업적 아카이브**
- "나는 글러브에서 X를 했다"의 기록
- 프로필에 컬렉션으로 전시

**② 다양한 경로의 인정**
- Creator Score는 단일 숫자
- 칭호는 3축 14개로 다양한 플레이스타일 인정
- "나는 글을 쓰진 않지만 후원을 많이 했어" → 🎁 후원자 칭호

**③ 플랫폼 로열티 보상**
- 초기 개척자 (한정) — 한 번 놓치면 영구 불가
- 1년 개근, 2년 베테랑 — 장기 유저 예우
- 마패·평판과 별개로 "오래 있었다"는 가치 인정

### 0.4 개발 수칙 (CLAUDE.md 준수)

- **최소 변경 원칙**: 요청받지 않은 파일 건드리지 않기
- **Rules 우선**: `titles`, `primaryTitle` 필드는 CF만 쓰기
- **CF 경유**: 모든 칭호 획득은 `checkTitleAchievement` CF에서
- **마스터 데이터 분리**: 칭호 정의는 `titles/{titleId}` 컬렉션
- **Phase별 배포**: B → C 순서

---

## 1. 현재 상태 진단 (부재)

### 1.1 핵심 관찰: 마패·칭호 모두 신규 시스템

**현재 코드베이스에 존재하지 않음**:
- `users.titles` 필드 없음
- `users.primaryTitle` 필드 없음
- `titles/{titleId}` 컬렉션 없음
- `checkTitleAchievement` CF 없음
- `mapaeTier` 필드 없음 (단, CREATOR_SCORE에서 `creatorScoreTier` 도입 예정)

### 1.2 현재 대체 수단

**유저 가치 표현**:
- 레벨 배지 (Lv1~10)
- 평판 배지 (중립/우호/확고)
- 깐부수 (팔로워 카운트)

**문제**:
- 단기 기여자와 장기 기여자 구분 불가
- 업적 기반 동기 부여 부재
- 유튜브식 "마일스톤" 경험 부재

### 1.3 v2 §6.4, §6.5 골격 확인

v2에서 이미 확정된 설계:

**마패 (§6.4)**:
```
동마패:     0.5 ~ 1.0  — 구리색 링
은마패:     1.0 ~ 2.0  — 은색 링
금마패:     2.0 ~ 3.5  — 금색 링
백금마패:   3.5 ~ 5.0  — 백금색 링
다이아마패: 5.0+      — 보라+무지개 애니메이션
```

**칭호 (§6.5)**:
- **v2 문서 표기**: "3축 × 4단계 = 12개 기본 칭호"
- **실제 나열된 칭호 수**: **14개** (A:5 + B:5 + C:4)

**→ v2 §6.5의 "12개" 표기는 오기**. 본 문서에서 정정하여 **14개 기준**으로 진행.

---

## 2. 설계 요구사항

### 2.1 왜 마패·칭호가 필요한가

**현 상황의 공백**:

```
가정:
  유저 A: Lv10, 평판 3,500, 깐부 500명, 가입 2년
  유저 B: Lv3, 평판 500, 깐부 10명, 가입 1주

문제:
  UI에 두 사람 구분할 표시 부족
  → A의 "2년 간 플랫폼 기여"가 시각화 안 됨
  → 신규 유저가 A를 존중할 이유 부족
```

**해결**:

```
유저 A:
  마패: 🥇 금마패 (현재 활발)
  대표 칭호: [🏛️ 베테랑]
  컬렉션: 10개 / 14개

유저 B:
  마패: 없음 (Score 0.3)
  대표 칭호: [🔰 새싹 작가]
  컬렉션: 1개 / 14개
```

### 2.2 왜 두 시스템을 분리하는가

**대안 1 (기각)**: 마패 하나로 통합
- 문제: Creator Score 하락 시 모든 인정 사라짐 → 심리적 박탈감
- 문제: 단일 지표로는 다양한 기여 인정 불가

**대안 2 (기각)**: 칭호 하나로 통합
- 문제: "현재 얼마나 기여하는가" 실시간 시그널 부재
- 문제: 14개 배지 나열은 UX 복잡도 증가

**채택**: 마패(상태) + 칭호(업적) 병렬
- 유튜브의 "실버/골드 버튼" + "크리에이터 인사이트 배지" 모델

### 2.3 Step 1 기획에서 결정할 사항

v2 §6.4, §6.5는 **골격만 제시**. 본 문서에서 결정:

1. **D1**: 칭호 내부에 "등급" 체계 둘지 (예: 새싹→중견→거장)
2. **D2**: 대표 칭호 노출 개수 (1개 vs 3개)
3. **D3**: "유효 글"의 정확한 정의 (10자+ or 반응 1개+)
4. **D4**: 칭호 획득 알림 방식 (Toast / 모달 / 정적)
5. **D5**: 유배 단계별 박탈 정책 상세 규칙

---

## 3. 마패 시스템 상세

### 3.1 5단계 테이블 (v2 §6.4 재확인)

| 티어 | Creator Score | 구리/은/금/보석 | 획득 알림 |
|:----:|:-------------:|:---------------:|-----------|
| 🥉 동마패 | 0.5 ~ 1.0 | 구리색 `#B87333` | "🥉 동마패 달성!" |
| 🥈 은마패 | 1.0 ~ 2.0 | 은색 `#C0C0C0` | "🥈 은마패 달성!" |
| 🥇 금마패 | 2.0 ~ 3.5 | 금색 `#FFD700` | "🥇 금마패 달성!" |
| 💎 백금마패 | 3.5 ~ 5.0 | 백금색 `#E5E4E2` | "💎 백금마패 달성!" |
| 👑 다이아마패 | 5.0+ | 보라+무지개 | "👑 다이아마패!" |

**MapaeKey 타입**:
```typescript
type MapaeKey = 'none' | 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
```

**없음(`none`)**: Creator Score < 0.5 → 마패 미획득 상태.

### 3.2 시각 디자인 (CSS 매트릭스)

**마패는 아바타 **외곽에 원형 배지** 형태로 표시**. 평판 이중 링(§3.4)과 **공존**.

#### 3.2.1 기본 배지 (외곽 원형)

```tsx
// src/components/MapaeBadge.tsx
interface MapaeBadgeProps {
  tier: MapaeKey;
  size?: 'sm' | 'md' | 'lg';
  position?: 'top-right' | 'bottom-right';
}

export const MapaeBadge: React.FC<MapaeBadgeProps> = ({ tier, size = 'md', position = 'top-right' }) => {
  if (tier === 'none') return null;

  const config = MAPAE_VISUAL_CONFIG[tier];
  const sizeMap = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' };

  return (
    <div className={`
      absolute ${position === 'top-right' ? 'top-0 right-0' : 'bottom-0 right-0'}
      ${sizeMap[size]}
      rounded-full
      ${config.bgClass}
      ${config.borderClass}
      ${config.animationClass}
      flex items-center justify-center
      shadow-md
    `}>
      <span className="text-xs">{config.emoji}</span>
    </div>
  );
};
```

#### 3.2.2 CSS 매트릭스

```typescript
// src/constants/mapae.ts

export const MAPAE_VISUAL_CONFIG: Record<Exclude<MapaeKey, 'none'>, {
  emoji: string;
  label: string;
  bgClass: string;
  borderClass: string;
  animationClass: string;
  color: string;
  glow: string;
}> = {
  bronze: {
    emoji: '🥉',
    label: '동마패',
    bgClass: 'bg-gradient-to-br from-amber-700 to-amber-900',
    borderClass: 'border-2 border-amber-600',
    animationClass: '',
    color: '#B87333',
    glow: 'shadow-amber-500/30',
  },
  silver: {
    emoji: '🥈',
    label: '은마패',
    bgClass: 'bg-gradient-to-br from-slate-300 to-slate-500',
    borderClass: 'border-2 border-slate-400',
    animationClass: '',
    color: '#C0C0C0',
    glow: 'shadow-slate-400/40',
  },
  gold: {
    emoji: '🥇',
    label: '금마패',
    bgClass: 'bg-gradient-to-br from-yellow-400 to-yellow-600',
    borderClass: 'border-2 border-yellow-500',
    animationClass: 'animate-pulse-slow',
    color: '#FFD700',
    glow: 'shadow-yellow-500/50',
  },
  platinum: {
    emoji: '💎',
    label: '백금마패',
    bgClass: 'bg-gradient-to-br from-cyan-200 to-cyan-500',
    borderClass: 'border-2 border-cyan-300',
    animationClass: 'animate-pulse',
    color: '#E5E4E2',
    glow: 'shadow-cyan-400/50',
  },
  diamond: {
    emoji: '👑',
    label: '다이아마패',
    bgClass: 'bg-gradient-conic from-violet-500 via-pink-500 to-violet-500',
    borderClass: 'border-2 border-purple-500',
    animationClass: 'animate-spin-slow',
    color: 'rainbow',
    glow: 'shadow-purple-500/60',
  },
};
```

**주의**:
- `animate-spin-slow`, `animate-pulse-slow`는 Tailwind 확장 필요 (`tailwind.config.js`)
- `bg-gradient-conic`도 확장 (기본 radial/linear만 지원)

#### 3.2.3 크기 정책

| 컨텍스트 | 마패 크기 | 위치 |
|----------|:---------:|------|
| 글 카드 작성자 | `sm` (16px) | 아바타 top-right |
| 상세 뷰 작성자 | `md` (24px) | 아바타 top-right |
| 공개 프로필 헤더 | `lg` (32px) | 아바타 bottom-right |
| 채팅 아바타 | `sm` (16px) | top-right |
| 댓글 작성자 | `sm` (16px) | top-right |

### 3.3 티어 변화 감지 및 알림

#### 3.3.1 CF 이벤트 트리거

```javascript
// functions/mapaeEvents.js

exports.onMapaeTierChanged = onDocumentUpdated({
  document: 'users/{uid}',
  region: 'asia-northeast3',
}, async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();

  const oldTier = before.creatorScoreTier || 'none';
  const newTier = after.creatorScoreTier || 'none';

  if (oldTier === newTier) return;

  const direction = MAPAE_RANK[newTier] > MAPAE_RANK[oldTier] ? 'up' : 'down';

  // 알림 생성 (승급만 알림, 강등은 조용히)
  if (direction === 'up' && newTier !== 'none') {
    await db.collection('notifications').add({
      uid: event.params.uid,
      type: 'mapae_achieved',
      data: {
        newTier,
        oldTier,
        creatorScore: after.creatorScoreCached,
      },
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    });

    // 감사 로그
    await db.collection('mapae_history').add({
      uid: event.params.uid,
      fromTier: oldTier,
      toTier: newTier,
      creatorScore: after.creatorScoreCached,
      direction,
      timestamp: FieldValue.serverTimestamp(),
    });
  }
});

const MAPAE_RANK: Record<MapaeKey, number> = {
  none: 0, bronze: 1, silver: 2, gold: 3, platinum: 4, diamond: 5,
};
```

**원칙**:
- 승급은 축하 (알림 + 히스토리)
- **강등은 조용히** (알림 없음, 히스토리만)
- 이유: 심리적 박탈감 최소화, "복귀 부담" 감소

#### 3.3.2 UI 알림 표시

**Toast 방식** (단순):
```tsx
<Toast>
  🥇 축하합니다! 금마패를 달성하셨습니다.
  Creator Score: 2.35
</Toast>
```

**모달 방식** (강조, 백금·다이아만):
```tsx
<Modal>
  <div className="text-6xl">👑</div>
  <h2>다이아마패 달성!</h2>
  <p>글러브 최고 등급에 오르셨습니다.</p>
  <button>프로필로 이동</button>
</Modal>
```

**정책**:
- 동/은/금: Toast 알림
- 백금: Toast + 프로필 헤더 pulse 1시간
- 다이아: 전체 화면 모달 (1회성, 재진입 시 Toast)

### 3.4 아바타 통합 (평판 이중 링과의 공존)

**REPUTATION_V2 §6에서 이미 설계된 이중 링**:
```
바깥 링: 평판 색
안쪽 링: 레벨 색
```

**마패 배지 추가 시**:
```
┌─── 바깥 링 (평판) ───┐
│ ┌─ 안쪽 링 (레벨) ─┐ │
│ │                   │ │
│ │   [아바타]        │ │
│ │                   │ │   ← 외곽 원형 배지
│ └───────────────────┘ │     (top-right)
└───────────────────────┘
         🥇 ← 마패 (외곽 오버레이)
```

**통합 컴포넌트 확장**:

```tsx
// REPUTATION_V2의 ReputationAvatar를 확장
export const FullAvatar: React.FC<FullAvatarProps> = ({ user, size = 'md', showMapae = true }) => {
  return (
    <div className="relative inline-block">
      {/* 기존 REPUTATION_V2 이중 링 */}
      <ReputationAvatar user={user} size={size} />

      {/* 🆕 마패 배지 (옵션) */}
      {showMapae && user.creatorScoreTier && user.creatorScoreTier !== 'none' && (
        <MapaeBadge tier={user.creatorScoreTier} size={size} position="top-right" />
      )}
    </div>
  );
};
```

**표시 정책**:
- 상세 뷰 (프로필, 글 상세): 전체 표시 (마패 포함)
- 리스트/피드: 성능 고려 → 평판 링만, 마패는 생략
- 채팅/댓글: 닉네임 옆 텍스트로 축약 (`깐부5호 🥇`)

---
## 4. 칭호 시스템 상세 (14개)

### 4.1 칭호 수 정정 (v2 §6.5 오기 해소)

**v2 §6.5 헤더**: "3축 × 4단계 = 12개 기본 칭호"

**실제 나열**:
- A 크리에이터 축: 5개
- B 커뮤니티 축: 5개
- C 플랫폼 로열티 축: 4개
- **총 14개**

**본 문서 기준**: **3축, 총 14개** (5 + 5 + 4).

향후 `GLOVE_SYSTEM_REDESIGN_v2.md §6.5` 헤더 표현도 "3축 14개"로 수정 권장.

### 4.2 A축 — 크리에이터 (5개)

**성격**: 바이럴·영향력·콘텐츠 생산 중심.

| ID | 이모지 | 라벨 | 조건 | 등급 |
|-----|:-----:|------|------|:----:|
| `writer_seed` | 🔰 | 새싹 작가 | 첫 **유효 글** 작성 | 입문 |
| `writer_diligent` | ✍️ | 근면한 작가 | **30일 연속** 유효 글 (각 일 1개+) | 성실 |
| `viral_first` | 🔥 | 첫 화제 | 단일 글 좋아요 **30개+** | 중급 |
| `popular_writer` | ⭐ | 인기 작가 | 단일 글 좋아요 **100개+** | 상급 |
| `super_hit` | 💎 | 초대박 | 단일 글 좋아요 **1,000개+** | 최상급 |

**조건 상세**:

`writer_seed`:
- 첫 글 작성 시 **즉시 획득**
- 유효 글 정의는 §6.2 (결정 D3)

`writer_diligent`:
- 연속 카운트는 "한국 시간 자정 기준"
- 1일이라도 건너뛰면 카운트 리셋
- 유효 글 기준 적용 (10자 미만 제외)

`viral_first`, `popular_writer`, `super_hit`:
- 단일 글 좋아요 기준 (누적 아님)
- 좋아요 어뷰징 방지: 고유 계정 수 기준 권장 (§6.3)

### 4.3 B축 — 커뮤니티 (5개)

**성격**: 관계·참여·상호작용 중심.

| ID | 이모지 | 라벨 | 조건 | 등급 |
|-----|:-----:|------|------|:----:|
| `social_master` | 🤝 | 사교의 달인 | 맞깐부 **30명+** | 중급 |
| `chat_master` | 💬 | 대화의 명수 | 누적 댓글 **1,000개+** (유효) | 성실 |
| `sponsor` | 🎁 | 후원자 | 땡스볼 보낸 누적 **1,000볼+** (10만원) | 중급 |
| `kanbu_star` | 🌟 | 인기인 | 깐부수 **100명+** | 상급 |
| `influencer` | 👑 | 영향력자 | 깐부수 **1,000명+** | 최상급 |

**조건 상세**:

`social_master`:
- "맞깐부" = KANBU_V2 §3.2 정의 (상호 팔로우)
- 30명 고유 맞깐부
- 해제 후 재추가는 카운트 증가 안 함 (어뷰징 방지)

`chat_master`:
- 유효 댓글: 10자 이상
- 삭제된 댓글 카운트 제외
- 본인 글에 단 댓글도 카운트 (자기 대화 허용)

`sponsor`:
- 땡스볼 송금자 누적 (받은 게 아님)
- 자기 송금 제외 (ANTI_ABUSE §1.1.2에서 차단)
- 단위: 볼 (1볼 = 100원)

`kanbu_star`, `influencer`:
- **깐부수**: 나를 팔로우한 사람 수 (followerCount)
- KANBU_V2 §3.2의 "크리에이터 지표"
- 실시간 집계

### 4.4 C축 — 플랫폼 로열티 (4개)

**성격**: 시간·지속성·플랫폼 기여 중심.

| ID | 이모지 | 라벨 | 조건 | 등급 |
|-----|:-----:|------|------|:----:|
| `pioneer_2026` | 🌱 | 초기 개척자 | **2026년 내 가입** (한정) | 한정판 |
| `loyal_1year` | 🎖️ | 1년 개근 | 가입 **365일** + 월 1회+ 활동 | 성실 |
| `veteran_2year` | 🏛️ | 베테랑 | 가입 **2년+** | 장기 |
| `dedication` | ⚡ | 헌신 | 누적 EXP **10,000+** (Lv10 도달) | 활동량 |

**조건 상세**:

`pioneer_2026`:
- **한정판** (`isLimited: true`)
- 2026-01-01 ~ 2026-12-31 가입자만
- 2027년부터는 신규 획득 불가
- **가입 즉시 자동 부여** (CF)
- Phase C 시점에서 다이아마패에 근접한 상징성

`loyal_1year`:
- 가입 후 365일 + 월 1회 이상 활동 (12개월 모두)
- "활동"의 정의: §6.2 결정 D3 기준
- 365일차 자정에 CF 배치로 체크

`veteran_2year`:
- 가입 후 2년 경과 시 자동 부여
- 활동 요구 없음 (장기 체류 자체가 조건)
- 단, 사약당한 경우 부여 안 함

`dedication`:
- 누적 EXP 10,000 달성 = Lv10 도달 시점
- LEVEL_V2 §4.3 참조
- EXP 어뷰징 방지: ANTI_ABUSE §4 Rules로 보장됨

### 4.5 🔑 결정 D1: 칭호 내 등급 구조

**문제**: 현재 14개 칭호는 각각 **단일 달성 이벤트**. 반복 달성 시 변화 없음.

**예시**:
```
10자 글 1개 쓴 유저: 🔰 새싹 작가 획득
10,000자 대하소설 쓴 유저: 🔰 새싹 작가 (동일)
```

이를 해결하기 위해 "칭호 내부 등급"을 도입할지 결정.

#### 4.5.1 대안 D1-α: 단일 달성 (v2 원안 그대로)

**방식**: 조건 1회 충족 시 획득, 이후 변화 없음.

**장점**:
- 단순. UI 명확.
- 14개만 관리
- 어뷰징 리스크 낮음

**단점**:
- "더 열심히" 유도 부재
- 중견 유저에게 지루함

#### 4.5.2 대안 D1-β: 축소 등급 (핵심 3~4개 칭호만 등급화)

**방식**: 가장 "양"이 의미 있는 칭호에만 등급 추가.

**등급화 대상**:
- `writer_diligent` (30일 / 100일 / 365일)
- `chat_master` (1,000 / 5,000 / 20,000)
- `sponsor` (1,000볼 / 10,000볼 / 100,000볼)
- `dedication` (Lv10 / Lv15 가상 / Lv20 가상) — Phase C 레벨 확장 시

**데이터 구조**:
```typescript
interface UserData {
  titles?: Array<{
    id: string;
    tier?: 'I' | 'II' | 'III';  // 선택적 등급
    achievedAt: FirestoreTimestamp;
    upgradedAt?: FirestoreTimestamp;
  }>;
}
```

**장점**:
- 장기 유저에게 추가 목표
- "근면 III" = 1년 개근 → 실질적 가치

**단점**:
- 복잡도 증가
- 14개가 아니라 최대 20개 칭호 관리
- UI에 등급 표기 추가 필요

#### 4.5.3 대안 D1-γ: 전체 등급화 (4단계 × 14개 = 56개)

**방식**: 모든 칭호에 I/II/III/Master 등급.

**장점**:
- 완전한 게이미피케이션
- 모든 칭호에 진행도

**단점**:
- **과도한 복잡도** (56개 칭호 관리)
- 한정판(`pioneer_2026`) 같은 일회성 조건과 맞지 않음
- 마패와 역할 충돌 (마패가 "양"을 이미 표현)

#### 4.5.4 비교 매트릭스

| 기준 | α 단일 | **β 축소 등급 (추천)** | γ 전체 등급 |
|------|:------:|:----------------------:|:-----------:|
| 구현 복잡도 | ⭐ | ⭐⭐ | ⭐⭐⭐⭐ |
| 장기 유저 동기 | ❌ | ⭐⭐⭐ | ⭐⭐⭐ |
| UI 복잡도 | 낮음 | 중간 | 높음 |
| 마패와의 역할 분리 | ✅ | ✅ | ⚠️ 중복 |
| v2 원안 준수 | ✅ | 부분 확장 | 전면 재설계 |
| 어뷰징 리스크 | 낮음 | 중간 | 높음 |

#### 4.5.5 추천 — 대안 D1-β (축소 등급)

**근거**:
1. "양"이 의미 있는 4개 칭호에만 적용 → 과복잡 방지
2. 장기 유저에게 추가 목표 제공
3. 마패와 역할 분리 유지 (마패는 현재, 칭호 등급은 누적)

**축소 대상 정의**:

| 칭호 | I (기본) | II | III |
|------|:--------:|:--:|:---:|
| `writer_diligent` | 30일 연속 | 100일 연속 | 365일 연속 |
| `chat_master` | 1,000개 | 5,000개 | 20,000개 |
| `sponsor` | 1,000볼 | 10,000볼 | 100,000볼 |
| `dedication` | Lv10 달성 | (Phase C 예약) | (Phase C 예약) |

**UI 표기**:
```
[✍️ 근면한 작가] → [✍️ 근면한 작가 II]
[💬 대화의 명수] → [💬 대화의 명수 III]
```

**사용자 최종 결정 필요**. α/β/γ 중 선택.

### 4.6 칭호 마스터 데이터 (titles 컬렉션)

```typescript
// Firestore: titles/{titleId}

interface TitleMaster {
  id: string;                   // 'writer_seed', 'viral_first' 등
  category: 'creator' | 'community' | 'loyalty';
  emoji: string;
  label: string;
  description: string;
  condition: string;             // 사용자에게 보여주는 조건 문구
  isLimited?: boolean;            // 한정판 여부
  color?: string;                 // 시각 강조 색상
  order: number;                  // UI 정렬 순서

  // 🆕 D1-β 채택 시
  hasTiers?: boolean;
  tierConditions?: {
    I: string;
    II?: string;
    III?: string;
  };
}
```

**마스터 데이터 초기화** (CF `seedTitles`):

```javascript
// 일회성 실행 (배포 시)
const titles: TitleMaster[] = [
  {
    id: 'writer_seed',
    category: 'creator',
    emoji: '🔰',
    label: '새싹 작가',
    description: '첫 유효 글을 작성하면 획득',
    condition: '첫 유효 글 작성',
    order: 1,
  },
  {
    id: 'writer_diligent',
    category: 'creator',
    emoji: '✍️',
    label: '근면한 작가',
    description: '연속으로 매일 글을 쓴 기록',
    condition: '30일 연속 유효 글',
    hasTiers: true, // D1-β 채택 시
    tierConditions: {
      I: '30일 연속 유효 글',
      II: '100일 연속 유효 글',
      III: '365일 연속 유효 글',
    },
    order: 2,
  },
  // ... 12개 더
];

async function seedTitles() {
  for (const t of titles) {
    await db.collection('titles').doc(t.id).set(t);
  }
}
```

---

## 5. 대표 칭호 시스템

### 5.1 🔑 결정 D2: 대표 칭호 노출 개수

v2 §6.5: "대표 칭호 (아바타 옆 표시용)" — **개수 미명시**.

#### 5.1.1 대안 D2-α: 단일 (1개만)

**방식**: `primaryTitle` 필드에 1개 ID만 저장.

```typescript
interface UserData {
  primaryTitle?: string;  // 1개 칭호 ID
}
```

**UI**:
```
깐부5호 [🔥 첫 화제] Lv.5 · 우호
```

**장점**:
- 심플
- 닉네임 주변 공간 절약
- 모바일 UX 우수

**단점**:
- 표현력 제한 (14개 중 1개)
- 조합 불가 (창작자+후원자 동시 어필 어려움)

#### 5.1.2 대안 D2-β: 최대 3개 (**추천**)

**방식**: `primaryTitles` 배열, 최대 3개.

```typescript
interface UserData {
  primaryTitles?: string[];  // 최대 3개, 순서 = 우선순위
}
```

**UI**:
```
깐부5호 🔥⭐🎁 Lv.5 · 우호     (호버 시 라벨 툴팁)
```

호버 시:
```
깐부5호 [🔥 첫 화제] [⭐ 인기 작가] [🎁 후원자] Lv.5 · 우호
```

**장점**:
- 3축을 각각 어필 가능 (크리에이터 + 커뮤니티 + 로열티)
- 유저의 "다면성" 표현
- 공간 효율 (이모지 3개는 5~6글자 정도)

**단점**:
- 기본값 설정 복잡
- 호버 지원 없는 환경(모바일 탭)에서 아이덴티티 약화

#### 5.1.3 대안 D2-γ: 제한 없음 (획득한 모두 노출)

**방식**: 획득한 모든 칭호를 `titles` 배열에 저장, 노출도 전체.

**UI**:
```
깐부5호 🔰✍️🔥⭐🤝💬🎁🌱 Lv.5 · 우호   (8개, 매우 길어짐)
```

**단점**:
- **과도한 노출 → 개성 상실**
- 닉네임 라인 길이 폭증
- 모바일에서 말줄임 발생

→ **기각**.

#### 5.1.4 비교 매트릭스

| 기준 | α 1개 | **β 3개 (추천)** | γ 전체 |
|------|:-----:|:----------------:|:------:|
| 표현력 | ⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| UX 단순성 | ⭐⭐⭐ | ⭐⭐ | ⭐ |
| 모바일 대응 | ⭐⭐⭐ | ⭐⭐ | ❌ |
| 공간 효율 | 좋음 | 중간 | 나쁨 |
| 개성 표현 | 약함 | 강함 | 흐려짐 |
| 조합 가능성 | ❌ | ✅ (3축 커버) | ✅ |

#### 5.1.5 추천 — 대안 D2-β (최대 3개)

**근거**:
1. 3축 체계와 자연스럽게 매칭 (크리에이터/커뮤니티/로열티 각 1개)
2. 이모지 3개는 모바일에서도 공간 수용 가능
3. 호버 없이도 이모지만으로 대략적 인식 가능
4. 유저에게 "어떤 3개로 나를 표현할까"의 선택권

### 5.2 대표 칭호 선택 UI

**설정 경로**: 프로필 → 칭호 컬렉션 → 각 칭호 옆 "대표로 설정" 버튼

**UI 목업**:

```
┌─────────────────────────────────────────────┐
│ 🏆 내 칭호 (5 / 14)                         │
│                                             │
│ 대표 칭호 (3개 선택)                        │
│ [🔥] [⭐] [🎁]    ← 클릭하여 재정렬           │
│                                             │
│ ─────────────────────────────────────────   │
│ 보유 칭호                                   │
│                                             │
│ 크리에이터 (3/5)                            │
│   [🔰 새싹 작가]   ✓ 대표 설정              │
│   [✍️ 근면한 작가] ✓ 대표 설정              │
│   [🔥 첫 화제]     ★ 대표 (1번) [해제]      │
│   🔒 [⭐ 인기 작가]   ← 미획득 (잠금)        │
│   🔒 [💎 초대박]                            │
│                                             │
│ 커뮤니티 (1/5)                              │
│   [⭐ 인기 작가]   ★ 대표 (2번)             │
│   ...                                       │
└─────────────────────────────────────────────┘
```

**동작**:
- 최대 3개 선택
- 순서 = 노출 순서 (1번이 첫 이모지)
- 3개 초과 선택 시 기존 중 하나 자동 해제 (오래된 것)
- 드래그&드롭으로 순서 변경 (선택적, Phase C)

### 5.3 기본값 정책

**신규 칭호 획득 시**:
- 기존 대표 칭호 0개: 자동으로 대표 설정
- 기존 1개: 자동 2번 자리
- 기존 3개: 자동 설정 안 함 (유저가 수동 선택)

**유배로 칭호 박탈 시** (§7):
- 박탈된 칭호가 대표였다면 **자동으로 대표에서 해제**
- 남은 획득 칭호 중 자동 선택 안 함 (유저 선택)

**데이터 정합성**:
- `primaryTitles[i]`는 `titles`에 존재해야 함
- CF가 주기적 검증 (arbitrary drift 방지)

---

## 6. 획득 로직 (CF 설계)

### 6.1 checkTitleAchievement 공통 구조

**핵심 아이디어**: 각 칭호마다 조건 체커 함수를 등록하고, 트리거 이벤트 발생 시 관련 칭호만 체크.

```javascript
// functions/titleChecker.js

const titleCheckers = {
  writer_seed: checkWriterSeed,
  writer_diligent: checkWriterDiligent,
  viral_first: checkViralFirst,
  popular_writer: checkPopularWriter,
  super_hit: checkSuperHit,
  social_master: checkSocialMaster,
  chat_master: checkChatMaster,
  sponsor: checkSponsor,
  kanbu_star: checkKanbuStar,
  influencer: checkInfluencer,
  pioneer_2026: checkPioneer2026,
  loyal_1year: checkLoyal1Year,
  veteran_2year: checkVeteran2Year,
  dedication: checkDedication,
};

/**
 * 메인 체크 함수
 * 다른 CF에서 호출 (예: createPost CF에서 'post_created' 트리거)
 */
exports.checkTitleAchievement = async (uid, triggerType, context = {}) => {
  const relevantTitles = TRIGGER_TO_TITLES[triggerType] || [];

  for (const titleId of relevantTitles) {
    const checker = titleCheckers[titleId];
    if (!checker) continue;

    const result = await checker(uid, context);

    if (result.achieved && !result.alreadyOwned) {
      await awardTitle(uid, titleId, result.tier);
    } else if (result.upgradeTo && result.alreadyOwned) {
      await upgradeTitle(uid, titleId, result.upgradeTo);
    }
  }
};

// 트리거 → 관련 칭호 매핑
const TRIGGER_TO_TITLES = {
  'post_created': ['writer_seed', 'writer_diligent'],
  'like_received': ['viral_first', 'popular_writer', 'super_hit'],
  'comment_created': ['chat_master'],
  'kanbu_added': ['social_master', 'kanbu_star', 'influencer'],
  'thanksball_sent': ['sponsor'],
  'user_registered': ['pioneer_2026'],
  'level_up': ['dedication'],
  'daily_rollup': ['loyal_1year', 'veteran_2year', 'writer_diligent'],
};
```

**호출 지점** (기존 CF에 훅):

```javascript
// createPost CF
exports.createPost = onCall({...}, async (req) => {
  // 기존 로직 (글 작성, 활동 로그)
  const postId = await createPostLogic(req);

  // 🆕 칭호 체크
  await checkTitleAchievement(req.auth.uid, 'post_created', { postId });

  return { success: true, postId };
});

// toggleLike CF
exports.toggleLike = onCall({...}, async (req) => {
  // 기존 로직
  const { authorUid, postId } = await toggleLikeLogic(req);

  // 🆕 작성자 칭호 체크 (좋아요 받은 쪽)
  await checkTitleAchievement(authorUid, 'like_received', { postId });
});

// sendThanksball CF
exports.sendThanksball = onCall({...}, async (req) => {
  // 기존 로직
  const { amount } = await sendThanksballLogic(req);

  // 🆕 송금자 칭호 체크
  await checkTitleAchievement(req.auth.uid, 'thanksball_sent', { amount });
});
```

### 6.2 🔑 결정 D3: "유효 글" 정의

v2 §6.5: "유효 글 = 10자+ 또는 반응(좋아요/댓글) 1개+"
→ "또는" 조건은 정의가 모호. 명확화 필요.

#### 6.2.1 대안 D3-α: 글 작성 시점에만 체크 (10자+만)

**방식**: `content.length >= 10`이면 유효.

**장점**:
- 단순. 작성 즉시 판정.
- `writer_seed` 즉시 획득 가능

**단점**:
- 10자 스팸 글 허용 ("ㅇㅇㅇㅇㅇㅇㅇㅇㅇㅇ")

#### 6.2.2 대안 D3-β: OR 조건 (10자+ OR 반응 1+)

**방식**: v2 원문 그대로.

**장점**:
- 짧지만 의미 있는 글도 인정 (반응이 있으면)
- v2 원안 준수

**단점**:
- **판정 지연**: 반응 없는 짧은 글은 무효 → 반응 생기면 유효
- 구현 복잡 (재검증 필요)
- 어뷰저가 다계정 좋아요로 "유효" 만들 수 있음

#### 6.2.3 대안 D3-γ: 이중 기준 (**추천**)

**방식**:
- **기본**: 10자+ 는 유효
- **특별**: 10자 미만이어도 **고유 반응 5개+** (좋아요/댓글 합산) 시 소급 유효

**구현**:
```javascript
function isValidPost(post: Post): boolean {
  const len = post.content.replace(/<[^>]*>/g, '').replace(/\s/g, '').length;

  // 기본
  if (len >= 10) return true;

  // 특별 (10자 미만인데 반응 충분)
  const uniqueReactionCount = new Set([
    ...post.likedBy,
    ...post.commentAuthors,
  ]).size;

  return uniqueReactionCount >= 5;
}
```

**장점**:
- 10자+는 즉시 유효 (UX 빠름)
- 짧지만 화제성 있는 글도 인정 ("오늘 로또 당첨!" → 반응 많음)
- **고유 반응 5개+** 기준으로 다계정 어뷰징 차단
- `writer_diligent` 연속 일수 체크에서 안정적

**단점**:
- 판정 지연 (반응 대기)
- 구현 복잡도 α보다 높음

#### 6.2.4 비교 매트릭스

| 기준 | α 10자 | β OR | **γ 이중 (추천)** |
|------|:------:|:----:|:-----------------:|
| 구현 복잡도 | ⭐ | ⭐⭐ | ⭐⭐⭐ |
| 스팸 방지 | ❌ | ⭐⭐ | ⭐⭐⭐ |
| UX 즉시성 | ✅ | ❌ | ✅ |
| 다계정 어뷰징 방어 | ❌ | ❌ | ✅ |
| v2 원안 준수 | 부분 | ✅ | 확장 |
| 사용자 이해 | 쉬움 | 중간 | 중간 |

#### 6.2.5 추천 — 대안 D3-γ (이중 기준)

**근거**:
1. 10자+는 즉시 유효 → UX 빠름
2. 짧지만 화제성 있는 글은 소급 인정
3. 고유 반응 5개로 다계정 어뷰징 차단
4. ANTI_ABUSE §4 Rules와 정합 (likes +1/회 한도)

**사용자 최종 결정 필요**.

### 6.3 축별 체크 포인트 (14개 개별 로직)

#### A축 — 크리에이터

**`checkWriterSeed`**:
```javascript
async function checkWriterSeed(uid) {
  const user = await db.collection('users').doc(uid).get();
  if (user.data().titles?.includes('writer_seed')) {
    return { achieved: false, alreadyOwned: true };
  }

  // 첫 유효 글 확인
  const posts = await db.collection('posts')
    .where('authorUid', '==', uid)
    .where('isValid', '==', true)  // 유효 플래그 사전 계산 필요
    .limit(1)
    .get();

  if (!posts.empty) {
    return { achieved: true, alreadyOwned: false };
  }
  return { achieved: false, alreadyOwned: false };
}
```

**`checkWriterDiligent`** (D1-β 적용, 등급화):
```javascript
async function checkWriterDiligent(uid) {
  const consecutiveDays = await calculateConsecutivePostDays(uid);

  if (consecutiveDays >= 365) {
    return { achieved: true, tier: 'III' };
  } else if (consecutiveDays >= 100) {
    return { achieved: true, tier: 'II' };
  } else if (consecutiveDays >= 30) {
    return { achieved: true, tier: 'I' };
  }
  return { achieved: false };
}

async function calculateConsecutivePostDays(uid) {
  const now = new Date();
  const kstOffset = 9 * 60 * 60 * 1000;
  let days = 0;

  for (let i = 0; i < 365; i++) {
    const dayStart = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    const posts = await db.collection('posts')
      .where('authorUid', '==', uid)
      .where('isValid', '==', true)
      .where('createdAt', '>=', dayStart)
      .where('createdAt', '<', dayEnd)
      .limit(1)
      .get();

    if (posts.empty) break;
    days++;
  }

  return days;
}
```

**`checkViralFirst`, `checkPopularWriter`, `checkSuperHit`**:
```javascript
async function checkViralMilestone(uid, postId, threshold) {
  const post = await db.collection('posts').doc(postId).get();
  if (!post.exists) return { achieved: false };

  const uniqueLikers = await countUniqueLikers(postId);

  if (uniqueLikers >= threshold) {
    return { achieved: true };
  }
  return { achieved: false };
}

async function countUniqueLikers(postId) {
  const likes = await db.collection('likes')
    .where('postId', '==', postId)
    .get();
  const unique = new Set(likes.docs.map(d => d.data().senderUid));
  return unique.size;
}
```

**임계**:
- `viral_first`: 30 고유 좋아요
- `popular_writer`: 100
- `super_hit`: 1,000

#### B축 — 커뮤니티

**`checkSocialMaster`** (맞깐부 30명+):
```javascript
async function checkSocialMaster(uid) {
  const mutualCount = await countMutualKanbu(uid);
  return { achieved: mutualCount >= 30 };
}

// KANBU_V2 §5에 정의된 양방향 체크
```

**`checkChatMaster`** (D1-β, 등급):
```javascript
async function checkChatMaster(uid) {
  const user = await db.collection('users').doc(uid).get();
  const commentCount = user.data().validCommentCount || 0;

  if (commentCount >= 20000) return { achieved: true, tier: 'III' };
  if (commentCount >= 5000)  return { achieved: true, tier: 'II' };
  if (commentCount >= 1000)  return { achieved: true, tier: 'I' };
  return { achieved: false };
}
```

`validCommentCount`는 댓글 작성 CF에서 증감:
```javascript
// createComment CF
if (isValidComment(content)) {
  await userRef.update({
    validCommentCount: FieldValue.increment(1),
  });
}
```

**`checkSponsor`** (D1-β, 등급):
```javascript
async function checkSponsor(uid) {
  const user = await db.collection('users').doc(uid).get();
  const sentTotal = user.data().ballSentTotal || 0;

  if (sentTotal >= 100000) return { achieved: true, tier: 'III' };
  if (sentTotal >= 10000)  return { achieved: true, tier: 'II' };
  if (sentTotal >= 1000)   return { achieved: true, tier: 'I' };
  return { achieved: false };
}
```

`ballSentTotal`은 `sendThanksball` CF에서 증감.

**`checkKanbuStar`, `checkInfluencer`**:
```javascript
async function checkKanbuLevel(uid, threshold) {
  const user = await db.collection('users').doc(uid).get();
  const followers = user.data().followerCount || 0;
  return { achieved: followers >= threshold };
}
```

- `kanbu_star`: 100
- `influencer`: 1,000

#### C축 — 플랫폼 로열티

**`checkPioneer2026`**:
```javascript
async function checkPioneer2026(uid) {
  const user = await db.collection('users').doc(uid).get();
  const createdAt = user.data().createdAt?.toDate();

  const start = new Date('2026-01-01T00:00:00+09:00');
  const end = new Date('2026-12-31T23:59:59+09:00');

  if (createdAt >= start && createdAt <= end) {
    return { achieved: true };
  }
  return { achieved: false };
}
```

**가입 시 자동 부여**:
```javascript
// registerUser CF
if (isWithinPioneerPeriod(now)) {
  await awardTitle(newUid, 'pioneer_2026');
}
```

**`checkLoyal1Year`**:
```javascript
async function checkLoyal1Year(uid) {
  const user = await db.collection('users').doc(uid).get();
  const createdAt = user.data().createdAt.toDate();
  const daysSinceJoin = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

  if (daysSinceJoin < 365) return { achieved: false };

  // 12개월 각각 1회+ 활동 확인
  const monthlyActivity = await getMonthlyActivity(uid, 12);
  const allMonthsActive = monthlyActivity.every(m => m.activityCount >= 1);

  return { achieved: allMonthsActive };
}
```

**`checkVeteran2Year`**:
```javascript
async function checkVeteran2Year(uid) {
  const user = await db.collection('users').doc(uid).get();
  const createdAt = user.data().createdAt.toDate();
  const years = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24 * 365);

  // 사약 이력 확인
  if (user.data().sanctionStatus === 'banned') return { achieved: false };

  return { achieved: years >= 2 };
}
```

**`checkDedication`**:
```javascript
async function checkDedication(uid) {
  const user = await db.collection('users').doc(uid).get();
  const exp = user.data().exp || 0;
  return { achieved: exp >= 10000 };
}
```

### 6.4 🔑 결정 D4: 칭호 획득 알림 방식

#### 6.4.1 대안 D4-α: Toast만 (단순)

**방식**: 우측 상단 Toast 4초 노출.

```tsx
<Toast icon="🔥" title="첫 화제 달성!" duration={4000} />
```

**장점**: 단순. 방해 최소.
**단점**: 놓치기 쉬움. 특수 순간 축하 부족.

#### 6.4.2 대안 D4-β: 티어별 차등 (**추천**)

**방식**:
- 입문·성실 칭호 (🔰 🎖️ 등): Toast
- 중상급 칭호 (🔥 ⭐ 🤝 🎁): Toast + 짧은 애니메이션
- 최상급 칭호 (💎 👑 ⚡): 전체 화면 모달 1회

**장점**:
- 입문 칭호의 과잉 축하 방지
- 최상급 칭호의 특별한 순간 강조
- 다이아마패(마패)와 초대박(칭호) 각자 모달

**단점**:
- 구현 복잡도 중간
- 모달 연쇄 발생 가능 (마패 승급 + 칭호 획득 동시)

#### 6.4.3 대안 D4-γ: 모두 모달

**방식**: 모든 칭호 획득 시 모달.

**장점**: 모두 축하.
**단점**: 피로감 누적. 신규 유저가 가입 직후 연속 모달 폭주.

#### 6.4.4 추천 — 대안 D4-β (티어별 차등)

**근거**:
1. 입문과 최상급의 심리적 가치 차이 반영
2. 유튜브 "크리에이터 어워즈" 방식 (실버는 조용히, 골드는 시상식)
3. 신규 유저 부담 최소화

**구현**:

```typescript
export const TITLE_NOTIFICATION_LEVELS: Record<string, 'toast' | 'celebration' | 'modal'> = {
  // Toast
  writer_seed: 'toast',
  pioneer_2026: 'toast',  // 한정판이지만 가입 시 자동이라 부담스럽지 않게
  loyal_1year: 'toast',
  veteran_2year: 'toast',

  // Celebration (Toast + 애니메이션)
  writer_diligent: 'celebration',
  viral_first: 'celebration',
  social_master: 'celebration',
  chat_master: 'celebration',
  sponsor: 'celebration',
  kanbu_star: 'celebration',

  // Modal
  popular_writer: 'modal',
  super_hit: 'modal',
  influencer: 'modal',
  dedication: 'modal',
};
```

**모달 연쇄 방지**:
- 한 트랜잭션 내 동시 모달 다수 발생 시 큐잉
- 첫 모달 닫고 3초 후 다음 모달

---
## 7. 유배·제재 연동

### 7.1 🔑 결정 D5: 유배 단계별 박탈 정책

v2 §6.5: "유배 1차: 칭호 유지 / 2차: 대표 칭호 자동 해제 / 3차: 평판 기반 칭호 박탈 / 사약: 모든 칭호 박탈"

**문제**:
- "평판 기반 칭호"의 정확한 목록 불명
- 박탈 후 복구 가능 여부 미정
- 박탈 시점 (유배 시작? 해제 후?) 미정

#### 7.1.1 대안 D5-α: v2 원안 그대로

**방식**:
- 1차: 유지
- 2차: 대표 칭호만 해제 (보유는 유지)
- 3차: 평판 기반 칭호 박탈 (보유 자체 삭제)
- 사약: 전체 박탈

**"평판 기반 칭호"**:
- `viral_first`, `popular_writer`, `super_hit` (좋아요 기반)
- `kanbu_star`, `influencer` (깐부수 기반)
- `sponsor` (땡스볼 기반)

**장점**: v2 원안 준수. 단순.

**단점**:
- "평판 기반"의 모호함 (레벨 칭호는?)
- 복구 조건 불명

#### 7.1.2 대안 D5-β: 명시적 박탈 매트릭스 (**추천**)

**방식**: 칭호별 박탈 정책을 **마스터 데이터에 명시**.

```typescript
interface TitleMaster {
  // 기존 필드...
  revocationPolicy: {
    exile1: 'keep' | 'hide' | 'revoke';
    exile2: 'keep' | 'hide' | 'revoke';
    exile3: 'keep' | 'hide' | 'revoke';
    banned: 'keep' | 'hide' | 'revoke';
  };
}
```

**정책 값 의미**:
- `keep`: 유지 (변화 없음)
- `hide`: 보유는 유지, 대표에서만 해제 (복구 시 자동 복귀)
- `revoke`: 완전 박탈 (재획득해야 함)

**14개 칭호별 정책**:

| 칭호 | exile1 | exile2 | exile3 | banned |
|------|:------:|:------:|:------:|:------:|
| 🔰 writer_seed | keep | keep | keep | revoke |
| ✍️ writer_diligent | keep | hide | revoke | revoke |
| 🔥 viral_first | keep | hide | revoke | revoke |
| ⭐ popular_writer | keep | hide | revoke | revoke |
| 💎 super_hit | keep | hide | revoke | revoke |
| 🤝 social_master | keep | hide | revoke | revoke |
| 💬 chat_master | keep | hide | revoke | revoke |
| 🎁 sponsor | keep | keep | keep | revoke |
| 🌟 kanbu_star | keep | hide | revoke | revoke |
| 👑 influencer | keep | hide | revoke | revoke |
| 🌱 pioneer_2026 | keep | keep | keep | keep |
| 🎖️ loyal_1year | keep | hide | revoke | revoke |
| 🏛️ veteran_2year | keep | keep | keep | revoke |
| ⚡ dedication | keep | hide | revoke | revoke |

**특수 처리**:
- 🌱 `pioneer_2026`: **사약에도 유지** — 한정판, 가입 사실 자체는 박탈 불가
- 🎁 `sponsor`: 사약까지 유지 — 실제로 돈을 썼음 (기록성)
- 🔰 `writer_seed`: 첫 글 썼다는 사실만으로, 거의 영구
- 🏛️ `veteran_2year`: 2년 간 플랫폼 머물렀다는 사실은 존중

**장점**:
- 명시적. 해석 여지 없음.
- 특수 칭호(한정판/기록성) 존중
- 복구 시 자동 복귀 가능 (`hide`)

**단점**:
- 마스터 데이터 복잡도 ↑
- 정책 변경 시 마이그레이션 필요

#### 7.1.3 대안 D5-γ: 단일 정책 (사약 시 모두)

**방식**: 유배 단계와 무관. 사약당한 경우만 전체 박탈.

**장점**: 매우 단순.
**단점**:
- 유배 단계별 차등 없음
- v2 §6.5와 불일치

#### 7.1.4 비교 매트릭스

| 기준 | α v2 원안 | **β 명시 매트릭스 (추천)** | γ 사약만 |
|------|:---------:|:--------------------------:|:--------:|
| 구현 복잡도 | ⭐⭐ | ⭐⭐⭐ | ⭐ |
| 명시성 | ⚠️ 모호 | ✅ | ✅ |
| 특수 케이스 대응 | ❌ | ✅ | ❌ |
| 복구 경로 | 불명 | ✅ | N/A |
| v2 원안 준수 | ✅ | 확장 | ❌ |
| 유저 이해 | 중간 | 중간 | 쉬움 |

#### 7.1.5 추천 — 대안 D5-β (명시 매트릭스)

**근거**:
1. "평판 기반 칭호"의 모호함 해소
2. 한정판·기록성 칭호 특수 처리 (핵심)
3. `hide` / `revoke` 구분으로 복구 가능성 명확
4. 마스터 데이터 기반 → 조정 용이

### 7.2 박탈 CF 구현

```javascript
// functions/titleRevocation.js

exports.onSanctionApplied = onDocumentUpdated({
  document: 'users/{uid}',
  region: 'asia-northeast3',
}, async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();

  const oldStatus = before.sanctionStatus || 'clean';
  const newStatus = after.sanctionStatus || 'clean';

  if (oldStatus === newStatus) return;

  // clean → exiled 전환 감지
  const sanctionKey = SANCTION_KEY_MAP[newStatus];
  if (!sanctionKey) return;

  const uid = event.params.uid;
  const titles = after.titles || [];

  const titleMasters = await Promise.all(
    titles.map(t => db.collection('titles').doc(t.id).get())
  );

  const updates = {
    titles: [...titles],
    primaryTitles: [...(after.primaryTitles || [])],
  };

  for (const masterDoc of titleMasters) {
    if (!masterDoc.exists) continue;
    const master = masterDoc.data();
    const policy = master.revocationPolicy?.[sanctionKey] || 'keep';

    if (policy === 'hide') {
      // 대표에서만 해제
      updates.primaryTitles = updates.primaryTitles.filter(id => id !== master.id);
    } else if (policy === 'revoke') {
      // 완전 박탈
      updates.titles = updates.titles.filter(t => t.id !== master.id);
      updates.primaryTitles = updates.primaryTitles.filter(id => id !== master.id);

      // 박탈 로그
      await db.collection('title_revocations').add({
        uid,
        titleId: master.id,
        reason: `sanction_${newStatus}`,
        revokedAt: FieldValue.serverTimestamp(),
      });
    }
  }

  await event.data.after.ref.update(updates);
});

const SANCTION_KEY_MAP = {
  'exiled_lv1': 'exile1',
  'exiled_lv2': 'exile2',
  'exiled_lv3': 'exile3',
  'banned': 'banned',
};
```

### 7.3 유배 해제 시 복구

**`hide` 상태의 칭호**: 유배 해제 시 자동 복귀 가능.

```javascript
// functions/titleRestoration.js

exports.onSanctionReleased = onDocumentUpdated({
  document: 'users/{uid}',
  region: 'asia-northeast3',
}, async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();

  const wasExiled = before.sanctionStatus?.startsWith('exiled_');
  const isClean = after.sanctionStatus === 'clean';

  if (!wasExiled || !isClean) return;

  // 'hide'되었던 칭호는 보유 목록에 이미 있으므로 복구 불필요
  // 대표 칭호만 유저가 수동 재설정 (안내 알림만)

  await db.collection('notifications').add({
    uid: event.params.uid,
    type: 'sanction_released',
    data: {
      message: '유배 기간이 끝났습니다. 대표 칭호를 다시 설정해주세요.',
    },
    read: false,
    createdAt: FieldValue.serverTimestamp(),
  });
});
```

### 7.4 박탈 시나리오

**시나리오 1: 유배 1차 → 유지**
```
상황: writer_diligent II (100일 연속) 보유 유저가 악플로 유배 1차
기대: 칭호 유지, 대표도 유지
```

**시나리오 2: 유배 2차 → hide**
```
상황: viral_first 대표 설정, 다른 칭호 5개 보유 유저가 유배 2차
기대:
  - titles: 모두 유지
  - primaryTitles: 일부 제거 (정책 'hide' 적용 대상)
  - 유배 해제 시 유저가 대표 재설정
```

**시나리오 3: 유배 3차 → 대폭 박탈**
```
상황: 영향력자(1,000명 깐부수) 유저가 유배 3차
기대:
  - influencer, kanbu_star, viral_first, popular_writer 등 revoke
  - writer_seed, pioneer_2026, veteran_2year 유지
  - 재달성 시 칭호 복귀 가능 (revoke는 재획득 필요)
```

**시나리오 4: 사약 → 거의 전체 박탈**
```
상황: 영구 정지
기대:
  - pioneer_2026만 유지 (가입 사실)
  - 나머지 13개 모두 revoke
  - 계정 비활성화 → 공개 프로필 숨김
```

---

## 8. 데이터 모델

### 8.1 UserData 확장

```typescript
// src/types.ts

interface UserData {
  // === 기존 필드 (생략) ===

  // === REPUTATION_V2/CREATOR_SCORE에서 추가된 필드 (참조) ===
  reputationCached?: number;
  creatorScoreCached?: number;
  creatorScoreTier?: MapaeKey;  // 🆕 마패는 여기 재사용
  sanctionStatus?: 'clean' | 'exiled_lv1' | 'exiled_lv2' | 'exiled_lv3' | 'banned';

  // === 🆕 칭호 관련 (Phase B 도입) ===
  titles?: UserTitle[];
  primaryTitles?: string[];  // 최대 3개 (D2-β)

  // === 🆕 칭호 카운터 (증분 쿼리용) ===
  validCommentCount?: number;   // checkChatMaster용
  ballSentTotal?: number;        // checkSponsor용 (누적 송금)
  consecutivePostDays?: number;  // checkWriterDiligent용 (매일 롤업)
  lastPostDate?: FirestoreTimestamp;  // 연속 판정용
}

interface UserTitle {
  id: string;                       // 'writer_seed' 등
  tier?: 'I' | 'II' | 'III';         // D1-β 적용 시
  achievedAt: FirestoreTimestamp;
  upgradedAt?: FirestoreTimestamp;   // tier II/III 승급 시
  context?: Record<string, unknown>; // 획득 컨텍스트 (예: postId)
}
```

### 8.2 titles 마스터 컬렉션

```typescript
// Firestore: titles/{titleId}

interface TitleMaster {
  id: string;
  category: 'creator' | 'community' | 'loyalty';
  emoji: string;
  label: string;
  description: string;
  condition: string;

  isLimited?: boolean;
  color?: string;
  order: number;

  // D1-β 등급 (선택)
  hasTiers?: boolean;
  tierConditions?: {
    I: string;
    II?: string;
    III?: string;
  };

  // D5-β 박탈 정책
  revocationPolicy: {
    exile1: 'keep' | 'hide' | 'revoke';
    exile2: 'keep' | 'hide' | 'revoke';
    exile3: 'keep' | 'hide' | 'revoke';
    banned: 'keep' | 'hide' | 'revoke';
  };

  // D4-β 알림 수준
  notificationLevel: 'toast' | 'celebration' | 'modal';
}
```

### 8.3 이력 컬렉션

#### 8.3.1 title_achievements (획득 이력)

```typescript
// Firestore: title_achievements/{achievementId}

interface TitleAchievement {
  id: string;
  uid: string;
  titleId: string;
  tier?: 'I' | 'II' | 'III';
  achievedAt: FirestoreTimestamp;
  context?: Record<string, unknown>;
}
```

**용도**:
- 감사 로그
- 리더보드 ("오늘 획득한 칭호")
- 어뷰징 조사

**인덱스**:
```
Collection: title_achievements
Fields: uid ASC, achievedAt DESC
Fields: titleId ASC, achievedAt DESC
```

#### 8.3.2 title_revocations (박탈 이력)

```typescript
// Firestore: title_revocations/{revocationId}

interface TitleRevocation {
  id: string;
  uid: string;
  titleId: string;
  reason: string;               // 'sanction_exiled_lv3', 'admin_manual' 등
  revokedAt: FirestoreTimestamp;
  revokedBy?: string;           // adminUid (수동 박탈 시)
  canRestore?: boolean;         // 재획득 가능 여부
}
```

#### 8.3.3 mapae_history (마패 변동)

```typescript
// Firestore: mapae_history/{historyId}

interface MapaeHistory {
  id: string;
  uid: string;
  fromTier: MapaeKey;
  toTier: MapaeKey;
  creatorScore: number;
  direction: 'up' | 'down';
  timestamp: FirestoreTimestamp;
}
```

### 8.4 Firestore Rules

```javascript
// firestore.rules

match /users/{uid} {
  allow read: if true;

  // 🆕 titles, primaryTitles는 CF 전용
  allow update: if request.auth != null
    && request.auth.uid == uid
    && request.resource.data.diff(resource.data).affectedKeys()
        .hasOnly([
          'nickname', 'profileImage', 'bio',
          'primaryTitles',  // 🆕 유저가 대표 칭호 선택 가능
          // titles는 여기 없음 → CF만 쓰기
        ])
    // primaryTitles 최대 3개 (D2-β)
    && request.resource.data.primaryTitles is list
    && request.resource.data.primaryTitles.size() <= 3
    // primaryTitles의 각 ID가 보유 칭호(titles)에 존재해야 함
    // → Firestore Rules로는 완전 검증 어려움, CF로 보완
    ;
}

// titles 마스터 컬렉션
match /titles/{titleId} {
  allow read: if true;   // 마스터 데이터 누구나 조회
  allow write: if false; // CF(Admin SDK)만
}

// title_achievements
match /title_achievements/{docId} {
  allow read: if request.auth != null
    && (request.auth.uid == resource.data.uid
        || isAdmin(request.auth));
  allow write: if false; // CF만
}

// title_revocations
match /title_revocations/{docId} {
  allow read: if isAdmin(request.auth);
  allow write: if false;
}

// mapae_history
match /mapae_history/{docId} {
  allow read: if request.auth != null
    && (request.auth.uid == resource.data.uid
        || isAdmin(request.auth));
  allow write: if false;
}
```

### 8.5 복합 인덱스

**대표 칭호 UI용**:
```
Collection: titles
Fields: category ASC, order ASC
```

**최근 획득 리더보드**:
```
Collection: title_achievements
Fields: titleId ASC, achievedAt DESC
```

**유저별 획득 이력**:
```
Collection: title_achievements
Fields: uid ASC, achievedAt DESC
```

---

## 9. 구현 변경 범위

### 9.1 유틸 함수 (src/utils.ts)

**추가**:

```typescript
// 마패 (CREATOR_SCORE에서 이미 추가됨)
export const useMapae = (user: UserData): MapaeKey;
export const getMapaeTier = (score: number): MapaeKey;

// 칭호
export const useTitles = (user: UserData): UserTitle[];
export const usePrimaryTitles = (user: UserData): UserTitle[];
export const hasTitleId = (user: UserData, titleId: string): boolean;
export const getTitleMaster = (titleId: string): Promise<TitleMaster | null>;

// UI 헬퍼
export const getMapaeLabel = (tier: MapaeKey): string;
export const getMapaeColor = (tier: MapaeKey): string;
export const getTitleBadgeProps = (title: UserTitle, master: TitleMaster): BadgeProps;
```

### 9.2 Cloud Functions (신설)

#### 9.2.1 `functions/titleChecker.js` — 통합 체크

§6.1에서 상세. 14개 개별 체커 + 트리거 매핑.

#### 9.2.2 `functions/titleAwarder.js` — 부여 헬퍼

```javascript
exports.awardTitle = async (uid, titleId, tier = 'I') => {
  const userRef = db.collection('users').doc(uid);

  await db.runTransaction(async (tx) => {
    const userDoc = await tx.get(userRef);
    const data = userDoc.data();
    const existingTitles = data.titles || [];

    // 이미 보유 (승급 아닌 경우)
    const existing = existingTitles.find(t => t.id === titleId);
    if (existing && !tier) return;

    if (existing && tier) {
      // 승급
      const updatedTitles = existingTitles.map(t =>
        t.id === titleId
          ? { ...t, tier, upgradedAt: FieldValue.serverTimestamp() }
          : t
      );
      tx.update(userRef, { titles: updatedTitles });
    } else {
      // 신규 획득
      const newTitle = {
        id: titleId,
        tier,
        achievedAt: FieldValue.serverTimestamp(),
      };
      tx.update(userRef, {
        titles: FieldValue.arrayUnion(newTitle),
      });

      // 기존 대표가 0개이면 자동 설정
      const primaryTitles = data.primaryTitles || [];
      if (primaryTitles.length === 0) {
        tx.update(userRef, {
          primaryTitles: [titleId],
        });
      }
    }
  });

  // 감사 로그
  await db.collection('title_achievements').add({
    uid, titleId, tier,
    achievedAt: FieldValue.serverTimestamp(),
  });

  // 알림
  await sendTitleNotification(uid, titleId, tier);
};

async function sendTitleNotification(uid, titleId, tier) {
  const master = await db.collection('titles').doc(titleId).get();
  const level = master.data()?.notificationLevel || 'toast';

  await db.collection('notifications').add({
    uid,
    type: 'title_achieved',
    data: {
      titleId,
      tier,
      level,
      emoji: master.data()?.emoji,
      label: master.data()?.label,
    },
    read: false,
    createdAt: FieldValue.serverTimestamp(),
  });
}
```

#### 9.2.3 `functions/titleRevocation.js` — 박탈

§7.2에서 상세.

#### 9.2.4 `functions/titleSeed.js` — 마스터 초기화 (일회성)

```javascript
// 배포 시 한 번만 실행
exports.seedTitles = onCall({...}, async (req) => {
  if (!isAdmin(req.auth)) throw new Error('Admin only');

  for (const title of TITLE_MASTERS) {
    await db.collection('titles').doc(title.id).set(title);
  }
  return { success: true, count: TITLE_MASTERS.length };
});
```

#### 9.2.5 `functions/dailyTitleRollup.js` — 일일 배치

```javascript
// 04:30 슬롯 (ballAudit 이후, reputationCache 이전)
// 또는 05:30 (creatorScoreCache 이후)

exports.dailyTitleRollup = onSchedule({
  schedule: '30 5 * * *',  // 05:30
  timeZone: 'Asia/Seoul',
  region: 'asia-northeast3',
}, async () => {
  const users = await db.collection('users').get();

  for (const userDoc of users.docs) {
    const uid = userDoc.id;

    // 시간 기반 칭호만 배치에서 체크
    await checkTitleAchievement(uid, 'daily_rollup', {
      now: Date.now(),
    });

    // consecutivePostDays 업데이트
    await updateConsecutivePostDays(uid);
  }
});
```

**스케줄 전체 통합**:

| 시각 | CF | 의존성 |
|------|----|--------|
| 04:00 | snapshotBallBalance | — |
| 04:30 | auditBallBalance | — |
| 04:45 | updateReputationCache | — |
| 05:00 | updateCreatorScoreCache | 평판 캐시 |
| **05:30** | **dailyTitleRollup** | **Creator Score 캐시** |

### 9.3 UI 컴포넌트

**신설**:
- `src/components/MapaeBadge.tsx` — 마패 외곽 배지
- `src/components/TitleBadge.tsx` — 단일 칭호 배지
- `src/components/TitleCollection.tsx` — 14개 칭호 컬렉션 (프로필)
- `src/components/PrimaryTitleSelector.tsx` — 대표 칭호 선택 UI
- `src/components/TitleAchievementToast.tsx` — 획득 Toast
- `src/components/TitleAchievementModal.tsx` — 획득 모달 (최상급)

**변경**:
- `ReputationAvatar` → `FullAvatar`로 확장 (마패 배지 통합)
- `PublicProfile.tsx` → 칭호 컬렉션 섹션 추가
- `ProfileHeader.tsx` → 대표 칭호 3개 노출
- `PostCard.tsx` → 작성자 닉네임 옆 대표 칭호 (이모지 3개)
- `CommentItem.tsx` → 동일

### 9.4 단계별 배포

#### 단계 1: 마스터 데이터 + 마패 시각

- [ ] `titles` 컬렉션 신설 + 14개 seed
- [ ] `MapaeBadge` 컴포넌트
- [ ] `FullAvatar` 확장 (ReputationAvatar + MapaeBadge)
- [ ] 아바타 사용 10곳 교체

#### 단계 2: 칭호 획득 로직

- [ ] `titleChecker.js` + 14개 체커 배포
- [ ] `titleAwarder.js` 배포
- [ ] 기존 CF에 훅 추가 (createPost, createComment, toggleLike, toggleFriend, sendThanksball, registerUser)
- [ ] `dailyTitleRollup.js` 스케줄 (05:30)

#### 단계 3: UI

- [ ] `TitleBadge`, `TitleCollection`
- [ ] `PrimaryTitleSelector` (프로필 설정)
- [ ] `TitleAchievementToast` / `Modal`
- [ ] 닉네임 옆 대표 칭호 3개 통합

#### 단계 4: 박탈·복구

- [ ] `titleRevocation.js` 배포
- [ ] `titleRestoration.js` 배포
- [ ] 테스트: 유배 → 박탈 → 해제 복구 시나리오

#### 단계 5: 관리자 도구

- [ ] 수동 부여/박탈 API (ADMIN.md에서 상세)
- [ ] 마패 분포 대시보드
- [ ] 칭호 획득 통계

---

## 10. Phase별 로드맵

### 10.1 Phase A (현재 ~ 베타): 미도입

**적용**:
- ❌ 마패 시스템 없음
- ❌ 칭호 시스템 없음

**이유**:
- Creator Score가 Phase B에서 도입됨
- 마패/칭호는 Creator Score 의존

**Phase A 준비 작업**:
- [ ] 이 문서 최종 승인
- [ ] 5개 결정 (D1~D5) 사용자 최종 결정
- [ ] 14개 칭호 마스터 데이터 작성
- [ ] CSS/애니메이션 디자인 시안

### 10.2 Phase B (베타 종료): 전면 도입

**적용**:
- ✅ `titles` 마스터 컬렉션 seed
- ✅ 마패 5단계 시각 (MapaeBadge)
- ✅ 14개 칭호 획득 로직 (titleChecker)
- ✅ 대표 칭호 선택 UI
- ✅ 획득 알림 (Toast/Celebration/Modal)
- ✅ 유배 연동 박탈/복구

**적용 안 함**:
- ❌ 관리자 수동 부여/박탈 (Phase C로 이연)

### 10.3 Phase C (정식 출시)

**추가 적용**:
- ✅ 관리자 수동 조정 (ADMIN.md)
- ✅ 다이아마패 전용 특수 애니메이션 활성
- ✅ 칭호 분포 대시보드
- ✅ Prestige 평판(§REPUTATION_V2 §4.2)과 연계된 특수 칭호 (선택)

---

## 11. 테스트 시나리오

### 11.1 첫 유효 글 작성

**입력**:
```
유저: 깐부1호 (신규, titles 없음)
액션: 글 작성, content = "안녕하세요. 반갑습니다." (12자)
```

**기대**:
- `isValidPost` = true (10자+)
- `checkWriterSeed` → achieved
- `awardTitle(uid, 'writer_seed')` 호출
- `titles` += {id: 'writer_seed', achievedAt}
- `primaryTitles` = ['writer_seed'] (자동 설정)
- Toast 알림: "🔰 새싹 작가 달성!"

### 11.2 짧은 글이지만 반응 많음 (D3-γ 검증)

**입력**:
```
유저: 깐부5호
액션: "로또 1등!" (5자) 작성 → 시간 경과 → 좋아요 8개 (고유 유저)
```

**기대**:
- 작성 직후: `isValidPost` = false (10자 미만, 반응 미달)
- `writer_seed` 미획득, `writer_diligent` 카운트 미포함
- 반응 5+개 누적 후: `isValidPost` = true (반응 기반)
- `checkTitleAchievement('like_received')` 트리거 시 소급 유효 판정
- `writer_seed` 획득 (첫 유효 글)

### 11.3 30일 연속 글 (D1-β 등급 I)

**입력**:
```
유저: 깐부10호
30일 간 매일 1개+ 유효 글 작성
```

**기대**:
- 30일차 자정 `dailyTitleRollup` 실행
- `checkWriterDiligent(uid)` → consecutiveDays = 30 → tier 'I'
- `awardTitle(uid, 'writer_diligent', 'I')`
- `titles` += {id: 'writer_diligent', tier: 'I', achievedAt}
- Toast: "✍️ 근면한 작가 I 달성!"

### 11.4 근면 II 승급 (100일)

**입력**:
```
유저: 깐부10호 (writer_diligent I 보유)
100일차 자정 도달
```

**기대**:
- `checkWriterDiligent` → tier 'II'
- 기존 칭호 객체 갱신 (업그레이드)
- `titles[].upgradedAt` = now
- `titles[].tier` = 'II'
- Celebration 알림 (중간 단계)

### 11.5 연속 끊김

**입력**:
```
유저: 깐부10호 (현재 writer_diligent II, 150일차)
151일차에 글 작성 안 함
152일차 재작성
```

**기대**:
- `dailyTitleRollup` at 151일: 글 없음 감지
- `consecutivePostDays` 리셋 (0)
- 하지만 **기존 tier는 유지** (한 번 달성한 등급 영구)
- 152일차 재시작 → 30일 후 I 재달성은 의미 없음 (이미 II)
- 재시작 후 100일 후 → II 유지 (의미 없음)
- **정책**: 등급 승급은 "최고 기록" 기준

→ 구현 시 `consecutivePostDays`와 `bestConsecutive`를 분리 저장 고려.

### 11.6 단일 글 1,000 좋아요 (초대박)

**입력**:
```
유저: 깐부7호
단일 글 좋아요 999 → 1,000번째 (고유 유저) 받음
```

**기대**:
- toggleLike CF에서 `checkTitleAchievement('like_received', {postId})`
- `checkSuperHit(uid, postId)` → uniqueLikers = 1000 → achieved
- `awardTitle(uid, 'super_hit')`
- **Modal 알림** (최상급)

### 11.7 맞깐부 30명 (사교의 달인)

**입력**:
```
유저: 깐부3호 (현재 맞깐부 29명)
새로운 유저와 맞깐부 성립 (30번째)
```

**기대**:
- `toggleFriend` CF에서 상호 팔로우 감지
- `checkTitleAchievement('kanbu_added', {isMutual: true})`
- `checkSocialMaster(uid)` → mutualCount = 30 → achieved
- Celebration 알림: "🤝 사교의 달인 달성!"

### 11.8 초기 개척자 (자동 부여)

**입력**:
```
신규 유저: 2026-06-15 가입
```

**기대**:
- `registerUser` CF 내 `checkTitleAchievement('user_registered', {now})`
- `checkPioneer2026(uid)` → true (2026년 내)
- `awardTitle(uid, 'pioneer_2026')`
- Toast 알림 (한정판이지만 자동이라 부담 최소)

**2027년 가입자**:
- `checkPioneer2026` → false
- 미획득, 영구 획득 불가

### 11.9 유배 3차 → 박탈

**입력**:
```
유저: 깐부9호 (보유 칭호 7개)
  - writer_seed, writer_diligent I, viral_first, popular_writer
  - social_master, sponsor I, pioneer_2026
유배 3차 발동
```

**기대** (D5-β):
- `onSanctionApplied` 트리거 발동
- 정책 조회 (`titles.revocationPolicy.exile3`):
  - writer_seed: keep
  - writer_diligent: revoke
  - viral_first: revoke
  - popular_writer: revoke
  - social_master: revoke
  - sponsor: keep
  - pioneer_2026: keep

- 박탈 후 `titles`:
  - writer_seed, sponsor I, pioneer_2026 (3개)

- 박탈된 4개는 `title_revocations`에 기록

### 11.10 사약 → 거의 전체 박탈

**입력**:
```
유저: 깐부X (14개 모든 칭호 보유)
사약 (banned)
```

**기대**:
- `onSanctionApplied` with banned
- 박탈 매트릭스:
  - 13개 모두 revoke
  - pioneer_2026만 유지 (사약에도 keep)
- 최종 titles: [pioneer_2026]

### 11.11 대표 칭호 선택 (D2-β 검증)

**입력**:
```
유저: 깐부4호 (titles: writer_seed, viral_first, sponsor I, kanbu_star)
액션: 프로필에서 3개 선택 → viral_first, sponsor, kanbu_star
```

**기대**:
- Rules: `primaryTitles.size() <= 3` → 통과
- `primaryTitles` = ['viral_first', 'sponsor', 'kanbu_star']
- 닉네임 옆: 🔥🎁🌟
- 호버 시: [🔥 첫 화제] [🎁 후원자] [🌟 인기인]

**4번째 추가 시도**:
- UI에서 3개 제한 → 에러 토스트
- 또는 기존 1번 자동 제거

### 11.12 대표 칭호 자동 해제 (유배 2차)

**입력**:
```
유저: 깐부5호
primaryTitles: ['viral_first', 'sponsor', 'influencer']
titles: 8개 보유
유배 2차 발동
```

**기대** (D5-β):
- viral_first: exile2 = hide → primaryTitles에서 제거
- sponsor: exile2 = keep → 유지
- influencer: exile2 = hide → 제거

- 박탈 후 `primaryTitles` = ['sponsor']
- `titles`는 그대로 8개 유지

- 유배 해제 시:
  - `onSanctionReleased` 알림: "대표 칭호를 다시 설정해주세요"
  - 유저가 수동으로 viral_first, influencer 재선택 가능 (보유 그대로)

### 11.13 Rules 방어

**테스트**: 타인이 `titles` 필드 직접 수정 시도

```javascript
await updateDoc(doc(db, 'users', victimUid), {
  titles: [{ id: 'super_hit', achievedAt: Timestamp.now() }],
});
```

**기대**: 거부 (`permission-denied`).

**`primaryTitles` 4개 설정 시도**:
```javascript
await updateDoc(doc(db, 'users', myUid), {
  primaryTitles: ['a', 'b', 'c', 'd'],
});
```

**기대**: Rules의 `size() <= 3` 규칙으로 거부.

### 11.14 동시 발동 모달 연쇄 방지

**입력**:
```
유저: 깐부6호
글 1개 작성 → 동시에:
  - 좋아요 100+ 돌파 → popular_writer (Modal)
  - Creator Score 2.0+ 돌파 → 금마패 (Toast)
  - writer_diligent 30일 달성 (Celebration)
```

**기대**:
- 알림 큐잉:
  1. 금마패 Toast (즉시)
  2. writer_diligent Celebration (1초 후)
  3. popular_writer Modal (2초 후)
- 모달 중첩 방지

---

## 12. 결정 요약 & 다음 단계

### 12.1 확정된 결정

1. **마패 5단계** v2 §6.4 그대로 (동/은/금/백금/다이아)
2. **칭호 14개** (3축: 크리에이터 5 + 커뮤니티 5 + 로열티 4) — v2 §6.5의 "12개" 표기는 오기로 정정
3. **통합 아바타**: `FullAvatar` = ReputationAvatar + MapaeBadge 외곽 오버레이
4. **마패 알림**: 승급만 알림, 강등은 조용히
5. **Phase별**: A 미도입 / B 전면 도입 / C 관리자 도구

### 12.2 🔑 사용자 최종 결정 필요 항목

| 결정 | 위치 | 추천 | 대안 |
|------|------|------|------|
| **D1** 칭호 내 등급 구조 | §4.5 | **β 축소 등급** (4개 칭호에만) | α 단일 / γ 전체 56개 |
| **D2** 대표 칭호 노출 개수 | §5.1 | **β 최대 3개** | α 1개 / γ 전체 |
| **D3** "유효 글" 정의 | §6.2 | **γ 이중 기준** (10자+ or 고유반응 5+) | α 10자만 / β v2 OR |
| **D4** 획득 알림 방식 | §6.4 | **β 티어별 차등** | α Toast만 / γ 모두 모달 |
| **D5** 유배 박탈 정책 | §7.1 | **β 명시 매트릭스** (칭호별 정책) | α v2 원안 / γ 사약만 |

### 12.3 검증 필요 항목

- [ ] **CF 스케줄 05:30 슬롯** 적절성 (creatorScoreCache 05:00 이후)
- [ ] **모달 연쇄 방지 큐잉** 구현 세부
- [ ] **writer_diligent 최고 기록 vs 현재 연속** 분리 저장 여부
- [ ] **pioneer_2026 마감** 알림 (2026-12 말일 접근 시 공지)
- [ ] **칭호 조건 임계값** 조정 정책 (TUNING_SCHEDULE 연계)

### 12.4 다음 설계서와의 연결

#### 12.4.1 `ADMIN.md` (다음 작업, 최종)

MAPAE가 공급하는 명세:
- 수동 부여 API: `adminAwardTitle(targetUid, titleId, reason)`
- 수동 박탈 API: `adminRevokeTitle(targetUid, titleId, reason)`
- 분포 대시보드: 마패 티어별 유저 수, 칭호별 획득자 수
- 감사 로그: `title_achievements`, `title_revocations`, `mapae_history` 조회

### 12.5 구현 TODO 체크리스트

**Phase B 도입 전**:
- [ ] 이 문서 최종 승인
- [ ] 5개 결정 (D1~D5) 사용자 최종 결정
- [ ] 14개 칭호 CSS/애니메이션 디자인 시안

**Phase B 시작**:
- [ ] `titles` 컬렉션 seed (14개)
- [ ] `src/constants/mapae.ts`, `src/constants/titles.ts` 배포
- [ ] `src/utils.ts` 함수군 추가
- [ ] `MapaeBadge`, `TitleBadge` 컴포넌트
- [ ] `FullAvatar` 확장
- [ ] 10개 UI 화면 일괄 교체
- [ ] `titleChecker.js` + 14개 체커 배포
- [ ] `titleAwarder.js`, `titleRevocation.js` 배포
- [ ] 기존 CF 6개에 훅 추가
- [ ] `dailyTitleRollup.js` 05:30 스케줄
- [ ] 알림 Toast/Modal UI
- [ ] `PrimaryTitleSelector` UI

**Phase C 시작**:
- [ ] 관리자 수동 부여/박탈 API (ADMIN)
- [ ] 다이아마패 특수 애니메이션
- [ ] 칭호·마패 분포 대시보드
- [ ] pioneer_2026 마감 공지 (2026-12)

### 12.6 진행 상태

**Step 1 종합기획 진행률**: 9/10 (90%)

```
✅ GLOVE_SYSTEM_REDESIGN_v2.md
✅ PRICING.md
✅ TUNING_SCHEDULE.md
✅ ANTI_ABUSE.md
✅ KANBU_V2.md
✅ LEVEL_V2.md
✅ REPUTATION_V2.md
✅ CREATOR_SCORE.md
✅ MAPAE_AND_TITLES_V1.md  ← 이 문서
🎯 ADMIN.md                ← 최종
```

---

**문서 끝.**

> **다음 (최종)**: `ADMIN.md` — 모든 시스템의 관리자 기능 통합. 유배 조작, Creator Score 수동 조정, 마패/칭호 수동 부여/박탈, 분포 대시보드, 감사 로그 뷰.

