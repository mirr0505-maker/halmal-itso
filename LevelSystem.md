# 📈 레벨 시스템 (LEVEL V2) — 구현 레퍼런스

> **프로젝트**: 할말있소 / 글러브(GeuLove)
> **최종 갱신**: 2026-04-22 (Sprint 2 배포)
> **상태**: Phase A (LEVEL_TABLE 확정) + 옵션 B (exp/level 동시 쓰기) 적용 완료

이 문서는 **배포된 레벨 시스템의 단일 진실 소스**다. LEVEL_TABLE·공식·EXP 지급 규칙을 수정할 때 반드시 이 문서와 함께 갱신한다.

---

## 1. 개요

**정의**: 레벨(Level 1~10) = 유저의 **성실도 지표**. 누적 EXP가 경계값을 넘을 때마다 승급.

**3대 기능**:
1. **기능 해금 게이트** — Lv3+ 가판대·Lv5+ 단골장부·Lv6+ 깐부방 개설 등
2. **수수료 차등** — 잉크병·가판대·깐부방 유료에서 레벨별 수수료 (20~30%)
3. **Creator Score activity 축** — `LEVEL_MEDIAN_ACTIVITY[level]`이 활동량 정규화 키

**평판(Reputation)과의 구분**: 레벨은 "얼마나 성실했나"(누적 EXP), 평판은 "남들이 얼마나 신뢰하나"(좋아요/공유/땡스볼). 두 축은 독립 → [Reputation.md](./Reputation.md) 참조.

---

## 2. 데이터 모델

### 2.1 `UserData` 필드

```typescript
interface UserData {
  exp?: number;       // 누적 EXP (Increment만, 감산은 delete/cancel 시)
  level?: number;     // 현재 레벨 (옵션 B — exp 변경 시 동시 쓰기)
  // ...
}
```

### 2.2 옵션 B 규약 (Sprint 2 확정)

`exp`와 `level`을 **항상 같이 갱신**한다. 옛 코드는 `exp`만 쓰고 프론트에서 `calculateLevel()` 재계산했으나, 읽기 폭주·서버 비교·랭킹 compute 비용 이슈로 옵션 B로 전환.

**원칙 1**: EXP 변경 write에 `level: calculateLevel(newExp)` 동시 포함
**원칙 2**: 본인 현재 exp를 모르는 경우(다른 유저 EXP 지급)는 exp만 Increment → 별도 동기화 CF (Phase C 예정)
**원칙 3**: 프론트 표시는 항상 `calculateLevel(userData.exp)` 헬퍼로 재계산 가능 (DB 값과 일치 보증)

**적용 경로**:
- `useFirestoreActions.ts` — 글·댓글 작성 시 `buildExpLevelUpdate()`
- `functions/adminAdjust.js` — 관리자 EXP 조정
- `functions/kanbuPromo.js` — 홍보 카드 EXP
- 기타 모든 EXP 변경 경로

**서버 헬퍼**: [functions/utils/levelSync.js](./functions/utils/levelSync.js) `buildExpLevelUpdate()`

---

## 3. LEVEL_TABLE (경계값)

**위치**: [src/constants.ts](./src/constants.ts) L125 · [functions/revenue.js](./functions/revenue.js) L42 (동기화 필수)

```typescript
export const LEVEL_TABLE = [0, 30, 100, 250, 500, 1000, 2000, 4000, 7000, 10000] as const;
```

| Lv | 누적 EXP |
|---:|--------:|
| 1 | 0 |
| 2 | 30 |
| 3 | 100 |
| 4 | 250 |
| 5 | 500 |
| 6 | 1,000 |
| 7 | 2,000 |
| 8 | 4,000 |
| 9 | 7,000 |
| 10 | 10,000 |

**Phase A 확정값** (2026-04-21). Lv20 확장은 추천코드 로드맵과 묶어서 별도 설계 (메모리: `project_referral_lv20_roadmap.md`).

---

## 4. EXP 지급 공식

### 4.1 본문 길이·자료 기반 차등 (`calculateExpForPost`)

**위치**: [src/utils.ts](./src/utils.ts) L124

```typescript
isEligibleForExp(content): content 10자 미만 → EXP 0 (등록은 허용)

base = 1                   // 10~99자
     | 2  (100~299자)
     | 4  (300~999자)
     | 6  (1000자 이상)
bonus = (hasImage ? 1 : 0) + (hasLink ? 1 : 0)
exp = base + bonus          // 최대 8
```

### 4.2 이벤트별 EXP 적용 (useFirestoreActions 실측)

| 이벤트 | EXP | 비고 |
|--------|----:|------|
| 글 작성 (10자+) | +1~8 | `calculateExpForPost` 결과 |
| 댓글 작성 (10자+) | +1 | 고정 |
| 좋아요 마일스톤 3·10·30개 | +1 | 작성자에 지급 (`handleLike`) |
| 깐부 맺기 | +2 | 단방향 (toggleKanbu 실행자만) — [functions/toggleKanbu.js:47](functions/toggleKanbu.js#L47) |
| 글 삭제 | -2 | 보상 회수 |
| 댓글 삭제 | -2 | 보상 회수 |
| 깐부 해제 | -2 | 대칭 delta (루프 어뷰징 차단) — [functions/toggleKanbu.js:47](functions/toggleKanbu.js#L47) |

### 4.3 Rate Limit (스팸 방지)

- **글**: 60초 쿨다운 (10자+ 1회 지급 후 해당 카테고리·유저 타임스탬프 체크)
- **댓글**: 15초 쿨다운

---

## 5. 레벨 기반 게이트·수수료

### 5.1 기능 해금

| Lv | 해금 기능 | 소스 |
|---:|----------|------|
| 2 | 깐부 홍보 카드 등록 | [functions/kanbuPromo.js](./functions/kanbuPromo.js) |
| 3 | 🏪 가판대 판매글 작성 | [functions/market.js](./functions/market.js) |
| 5 | 🏪 단골장부 상점 개설 | [functions/market.js](./functions/market.js) |
| 6 | 깐부방 개설 | [KANBU.md](./KANBU.md) |
| 10 | 최고 레벨 (랭킹 캡) | — |

### 5.2 수수료 차등 (pendingRevenue)

| 기능 | Lv3~5 | Lv6~9 | Lv10 |
|------|------:|------:|-----:|
| 🏪 가판대 구매 | 30% | 25% | 20% |
| 🏠 깐부방 유료 A/B | 30% | 25% | 20% |
| 🖋️ 잉크병 회차 해금 | 11% | 11% | 11% |

---

## 6. 파일 매트릭스

| 역할 | 클라이언트 (TS) | 서버 (CF / JS) |
|------|-----------------|----------------|
| LEVEL_TABLE | [src/constants.ts](./src/constants.ts) L125 | [functions/revenue.js](./functions/revenue.js) L42 |
| `calculateLevel()` | [src/utils.ts](./src/utils.ts) L58 | [functions/utils/levelSync.js](./functions/utils/levelSync.js) |
| `calculateExpForPost()` | [src/utils.ts](./src/utils.ts) L124 | — (클라 전용) |
| `buildExpLevelUpdate()` | [src/utils.ts](./src/utils.ts) L74 | [functions/utils/levelSync.js](./functions/utils/levelSync.js) |
| `getLevelProgress()`·`getNextLevelExp()` | [src/utils.ts](./src/utils.ts) L82·L93 | — |

**동기화 필수 2곳**: LEVEL_TABLE은 `src/constants.ts` + `functions/revenue.js` 둘 다 수정해야 한다. CF가 Node 런타임이라 TS import 불가.

---

## 7. 구현 상태

### ✅ Phase A (2026-04-21) — LEVEL_TABLE 확정
- [x] Phase A 경계값 0~10000 확정
- [x] `calculateLevel` · `calculateExpForPost` · `buildExpLevelUpdate` 헬퍼
- [x] 이벤트별 EXP 적용 (글·댓글·좋아요 마일스톤·깐부)

### ✅ 옵션 B (2026-04-22) — exp/level 동시 쓰기
- [x] `useFirestoreActions.ts` 전 경로 `buildExpLevelUpdate` 적용
- [x] `functions/utils/levelSync.js` 서버 헬퍼
- [x] `adminAdjustExp` / `kanbuPromo` 등 CF 경로 통일

### ⏳ 후속 작업
- [x] `syncUserLevel` CF — 타인 EXP 지급(좋아요 마일스톤 등)이 exp만 증가시킨 경우 레벨 보정 (2026-04-22 배포, 매일 06:00 KST, [functions/syncUserLevel.js](./functions/syncUserLevel.js))
- [ ] Lv20 확장 — 추천코드 시스템과 묶어서 설계 (메모리 `project_referral_lv20_roadmap.md`)

---

## 8. 연계 시스템

| 시스템 | 연결점 | 문서 |
|--------|--------|------|
| 🏅 Creator Score | `level` → `LEVEL_MEDIAN_ACTIVITY[level]` activity 정규화 키 | [CreatorScore.md §3.2](./CreatorScore.md) |
| 🌟 평판 시스템 | 독립 축 (레벨과 평판은 서로 영향 없음) | [Reputation.md](./Reputation.md) |
| 🏠 깐부방 | Lv6+ 개설 Gate | [KANBU.md](./KANBU.md) |
| 🏪 강변 시장 | Lv3+ 판매글 · Lv5+ 상점 · Lv별 수수료 | [MARKET.md](./MARKET.md) |
| 🖋️ 잉크병 | (레벨 무관, 모든 유저 연재 가능) | [INKWELL.md](./INKWELL.md) |

---

## 9. 변경 시 체크리스트

LEVEL_TABLE·EXP 공식·이벤트 지급값을 수정할 때:

1. [src/constants.ts](./src/constants.ts) `LEVEL_TABLE` 또는 관련 상수
2. [functions/revenue.js](./functions/revenue.js) `LEVEL_TABLE` (서버 미러)
3. [src/utils.ts](./src/utils.ts) `calculateExpForPost` 등 공식
4. [LevelSystem.md](./LevelSystem.md) — 이 문서의 §3·§4·§5 블록
5. `npm run build` — 타입 에러 0 확인
6. 수수료 테이블 수정 시 [functions/market.js](./functions/market.js) · [functions/kanbuPaid.js](./functions/kanbuPaid.js) · [functions/inkwell.js](./functions/inkwell.js) 동시 확인

---

## 10. 참고

- **Sprint 이력**: [changelog.md](./changelog.md) Sprint 2 (Node 22 + LEVEL/REPUTATION V2)
- **Lv20 확장 로드맵 메모리**: `~/.claude/projects/e--halmal-itso/memory/project_referral_lv20_roadmap.md`
