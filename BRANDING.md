# 🎨 BRANDING.md — 브랜드 전환 이력 + 미치환 항목 레지스트리

> 최종 갱신: 2026-04-19 | 현재 표기: **글러브 GeuLove** (도메인 `geulove.com`)

이 문서는 프로젝트 브랜드 변천사와, "글러브(Geulove) 일괄 치환" 작업 중 **의도적으로 남겨둔** 식별자 목록을 기록합니다. 향후 브랜드 재조정 시 이 문서가 단일 진실 소스가 되어야 합니다.

---

## 1. 브랜드 전환 타임라인

| 시점 | 브랜드 | 도메인 | 비고 |
|------|--------|--------|------|
| 초기 | 할말있소 (HALMAL-ITSO) | `halmal-itso.web.app` | 프로젝트 공식명 — 저장소·Firebase 프로젝트에 보존 |
| 중기 | GLove (글러브) | `halmal-itso.web.app` | 2글자 로고 (G빨강, L파랑) + 한글 병기 |
| 2026-04-15 | 글러브 beta | `halmal-itso.web.app` | 헤더 로고 한글화 (Pretendard, 글=red 러브=blue + beta 이탤릭) |
| 2026-04-17 | **글러브 GeuLove** | **`geulove.com`** | 도메인 전환 + OG/SNS 브랜딩 전면 교체 (현재 상태) |

### 현재 표기 규칙

| 용도 | 표기 |
|------|------|
| 도메인 | `geulove.com` |
| SNS / OG / 공식 문서 | `글러브 GeuLove` |
| 헤더 로고 (앱 UI) | `글러브 beta` (Pretendard Variable) |
| 본문 설명체 | `글러브(Geulove)` |
| 프로젝트 공식명 (레거시) | `할말있소 (HALMAL-ITSO)` — 저장소·Firebase 프로젝트 ID 등 시스템 계층 보존 |

---

## 2. 일괄 치환된 항목 (문서 레이어)

2026-04-19 일괄 치환 대상: **사용자 노출 문서 텍스트의 "GLove"** → `글러브(Geulove)`

| 파일 | 치환 수 |
|------|---------|
| `changelog.md` | 8 |
| `GLOVE.md` | 2 |
| `STOREHOUSE.md` | 1 (`Halmal-itso / Glove` → `Halmal-itso / 글러브(Geulove)`) |
| `storehouse-dev-plan.md` | 1 (동일 패턴) |

관련 커밋: `525105c`, `bfefb5c`

---

## 3. 🚫 의도적으로 치환하지 않은 항목 (9 카테고리)

"GLove/Glove/glove"를 포함하지만 **치환 금지**인 식별자들. 각각의 이유는 아래에.

### 3.1 Firestore 컬렉션 / 문서 ID

| 식별자 | 사용처 | 치환 불가 이유 |
|--------|--------|---------------|
| `glove_bot_payments` | 정보봇 결제 이력 컬렉션 | 기존 문서 수천 건 + Rules + 클라이언트 쿼리 경로 |
| `glove_bot_dedup` | 정보봇 중복 방지 서브컬렉션 | 30분 스케줄러가 실시간 참조 중 |
| `platform_revenue/glove_bot` | 플랫폼 수익 문서 ID | 누적 집계 문서 — 이름 바꾸면 누적 통계 단절 |

**이유 요약:** Firestore 컬렉션명은 한 번 정하면 **리네임 불가**. 복사-삭제로 마이그레이션해도 기존 문서 참조 링크가 전부 깨짐. 운영 DB 무결성 우선.

### 3.2 Cloud Function 모듈 파일명

| 파일 | 위치 | 치환 불가 이유 |
|------|------|---------------|
| `functions/gloveBot.js` | CF 진입점 require | `index.js`의 `require("./gloveBot")` 깨지면 배포 실패 |
| `functions/gloveBotFetcher.js` | onSchedule 함수 모듈 | 배포된 함수와 이름 연결 끊김 시 스케줄러 중단 |

### 3.3 TypeScript 타입 / 인터페이스

| 식별자 | 파일 | 이유 |
|--------|------|------|
| `GloveBotPayment` | `src/types.ts` | 전역 타입 — 리네임 시 수십 개 파일 연쇄 수정 필요 |
| `GloveTab` | `GloveNavBar.tsx` | 컴포넌트 전용 타입 |
| `GloveActionDeps` | `useGloveActions.ts` | hook 인자 타입 |

### 3.4 React 컴포넌트 파일 / 컴포넌트명

| 식별자 | 이유 |
|--------|------|
| `GloveNavBar` (파일·컴포넌트) | import 경로 변경 시 연쇄 수정 |

### 3.5 React Hook 파일 / 함수명

| 식별자 | 이유 |
|--------|------|
| `useGloveActions` (파일·함수) | import 경로 + `App.tsx` 포함 다수 참조 |

### 3.6 메뉴 키 문자열 (`'glove'`)

- `activeMenu === 'glove'` — App.tsx 라우팅 분기
- `setActiveMenu('glove')` — Sidebar, AdFallback 등
- `_source: 'glove'` — MyContentTabs 런타임 태그
- `activeTab === 'glove'` — MyPage 탭 키

**치환 불가 이유:** 단순 문자열이지만 **앱 전역 동기화 키**. 한 곳에서 바꾸면 나머지 모두 바꿔야 하고, 누락 시 메뉴가 동작 불능.

### 3.7 변수 / 상태명

| 식별자 | 파일 | 이유 |
|--------|------|------|
| `gloveSubTab`, `setGloveSubTab` | App.tsx, useGloveActions.ts | 내부 상태 |
| `onGloveClick`, `onLeaveGlove` | App.tsx, MyContentTabs.tsx, MyPage.tsx | prop 체인 |
| `glovePosts`, `gloveComments`, `gloveStatsByCommunity` | MyPage.tsx | 내부 state |
| `gloveBot`, `setGloveBot` | PlatformRevenueDashboard.tsx | 수익 카드 state |
| `isGlove`, `isGlovePost`, `joinedGloveCount`, `glovePostCount` | ActivityStats.tsx, MyContentTabs.tsx | 구분 플래그 |

**치환 불가 이유:** 파일 내부 일관성. 리팩터링 효과는 없고 diff만 커짐.

### 3.8 BOT_UID 상수

| 식별자 | 파일 | 이유 |
|--------|------|------|
| `"glove-info-bot"` | `functions/gloveBotFetcher.js:16` | 봇 게시글의 `author_id` 필드 값 — 이미 저장된 수천 개 봇 게시글의 작성자 필터링 기준 |

### 3.9 고유명사 / 한영 병기 표현

| 표현 | 위치 | 치환 불가 이유 |
|------|------|---------------|
| `우리들의 장갑(Glove)` | `GLOVE.md:9` | 커뮤니티 서브시스템 정체성 표현 (영문 주석 병기) |
| `우리들의 장갑(glove)` | `GIANTTREE.md:14` | 사이드바 위치 설명의 영문 키값 병기 |
| `glove 패턴 sticky 헤더` | `CLAUDE.md`, `InkwellHomeView.tsx`, `changelog.md` | UI 패턴명 — "장갑 서브시스템의 sticky 헤더 스타일"을 축약 지칭 |

---

## 4. 보류 / 선택적 치환 가능 항목

| 항목 | 위치 | 비고 |
|------|------|------|
| `"GLove - 마라톤의 전령 뉴스 자동화 봇"` | `functions/package.json:3` | npm 패키지 description. 내부 메타데이터로 외부 노출 없음. 향후 원할 시 수정 가능 |

---

## 5. 향후 작업 지침

1. **새 문서 작성 시** — `글러브 GeuLove` (공식) 또는 `글러브(Geulove)` (설명체) 사용
2. **앱 UI 표시** — `글러브 beta` (Pretendard 한글 로고) 유지
3. **내부 식별자** — 본 문서 §3에 나열된 식별자는 **변경 금지**
4. **도메인 참조** — `halmal-itso.web.app`은 Firebase 기본 도메인으로 보존, 공개 주소는 `geulove.com` 우선
5. **브랜드 재조정이 불가피한 경우** — 본 문서 먼저 업데이트 후 코드 작업 시작
