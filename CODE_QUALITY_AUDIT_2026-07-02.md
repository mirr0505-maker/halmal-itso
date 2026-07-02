# 코드 품질 감사 리포트 (2026-07-02)

> fable 모델 5개 병렬 감사(프론트 코어 / UI 컴포넌트 / Cloud Functions / TypeScript·빌드 / 보안설정) + 핵심 Critical 항목 소스 직접 검증.
> 빌드: `npm run build` ✅ PASS (번들 877kB 경고) · ESLint: ❌ 44 problems(39 errors) · 커밋된 시크릿 없음.

---

## P0 — 즉시 조치 (배포 상태라면 금전·보안 사고 진행형)

| # | 파일 | 문제 | 검증 |
|---|------|------|------|
| 1 | `functions/testCharge.js:8-27` | 로그인만 하면 누구나 1~1000볼 **무제한** 자기 충전 (admin/env 게이트·원장 없음). ballAudit도 diff>0은 무시 → 경제 붕괴 | ✅ 확인 |
| 2 | `functions/auction.js:44-137` | `onRequest cors:true` **완전 무인증** HTTP. 클라 body의 `bidAmount`·`postAuthorId`를 검증 없이 adEvents에 기록 → `revenue.js`가 그 근거로 ballBalance에 실지급 = **무한 볼 발행 + 경쟁사 예산 소진** | ✅ 확인 |
| 3 | `firestore.rules:123,164` | `kanbu_rooms`/`communities` `update,delete: if request.auth != null` — 아무 로그인 유저나 **타인 방·커뮤니티 삭제/변조** 가능 (Creator Gate 무력화) | ✅ 확인 |
| 4 | `firestore.rules:713,719,674-690` | `chargeHistory`·`settlements`·`adEvents`·`dailyAdRevenue` read가 `auth != null` — 주석은 "본인만"인데 **전 유저 충전·정산·수익 원장 열람** | ✅ 확인 |
| 5 | `upload-worker/src/index.ts:158-190` | DELETE·`/api/screenshot`에 소유권 체크 없음 → **타인 아바타/업로드/주주인증 스크린샷(금융 증빙) IDOR 삭제·열람** | (감사) |
| 6 | `src/components/CommunityFeed.tsx:85-110` | `useState`/`useCallback` 6개가 early return(67·75) **뒤** 호출 — 로그인/가입수 전환 시 "Rendered more hooks" 런타임 크래시. 현재 워킹트리 수정본 = 신규 회귀 | ✅ 확인 |

## P1 — High (데이터 정합성 / 보안 / UX 사고)

| # | 파일 | 문제 |
|---|------|------|
| 7 | `useFirestoreActions.ts:279`, `CommunityView.tsx:457`, `EpisodeReader.tsx:325`, `CommunityFeed.tsx:98`, `GiantTreeDetail.tsx:201` | 좋아요/투표 카운트를 클라 스냅샷 기반 **절대값**으로 write → 동시 좋아요 유실. `increment(diff)`로 교체. likes는 필터 표(3/10/30개) 게이트라 drift가 제품에 노출 |
| 8 | `AnyTalkList.tsx:316` 외 5곳, `useFirestoreActions.ts:169` | `post.linkUrl`을 스킴 검증 없이 href/`window.open` — `javascript:` 저장형 XSS (DOMPurify는 content만 방어). 광고쪽 `ensureProtocol` 이미 존재 |
| 9 | `market.js:93`, `kanbuPaid.js:60` | 수수료율을 클라가 쓰는 `item.authorLevel`/`room.creatorLevel`로 산정 → 판매자가 수수료 자체 인하. 이미 fetch한 authorSnap.level 사용해야 |
| 10 | `kanbuPaid.js:37-74` | 깐부방 유료 게시판 **자기결제 미차단** → 평판·정산매출 세탁 (market/inkwell은 차단) |
| 11 | `revenue.js:65`, `market.js:417` | 광고수익 배치가 비멱등 increment → 스케줄러 재시도 시 이중 지급 (원장 없어 audit도 못 잡음) |
| 12 | `storehouse.js:336-355` | 사약 자산 몰수가 비트랜잭션 read-modify-write → 대상이 몰수 직전 볼 은닉 레이스 |
| 13 | `firestore.rules:25,74,216,255,263` | posts/comments/community_posts 등 create가 `author_id == auth.uid` 미검증 → 타인 명의 글 위조(사칭·평판조작) |
| 14 | `CommunityView.tsx:386-443`, `DebateBoard.tsx:216-222` | 글/댓글 제출에 catch 누락 → 실패 시 조용히 사라지거나 버튼 영구 비활성 |
| 15 | `CommunityFeed.tsx` (신규) | 위 #6과 별개로 lint에서 rules-of-hooks 6건 — build는 통과하나 lint는 실패 |

## P2 — Medium/Low (품질·유지보수)

**중복 코드 (추출 대상)**
- `PostCardItem` 푸터 JSX가 `AnyTalkList` 잉크병/한컷 strip 카드에 ~150줄씩 중복 → `PostCardFooter` 추출
- `ensureProtocol`/`appendUTM`/IntersectionObserver viewable 블록/`AD_AUCTION_URL`/`AuctionResult`가 AdSlot·AdFeedCard·AnyTalkList에 2~3중복 → `src/components/ads/adShared.ts`
- `formatRelativeTime` 5중 구현 → `src/utils/time.ts`
- `authorDataEqual` memo 비교기 2중복, Kakao `Window` 타입 3중복
- `linkUrl` 안전 처리 → `src/utils/safeUrl.ts`

**타입/빌드 헬스**
- ESLint 39 error 미차단 (`lint`가 build 게이트 아님, test 스크립트 없음) → `lint:ci --max-warnings 0` 추가
- 미사용 deps: `firebase-admin`(클라!), `@google/generative-ai`, `@editorjs/*` 7종 → 제거
- 상수 동기화(client↔functions 8쌍)가 주석 의존 → `scripts/check-constant-sync.mjs` 자동 검증
- `any` 8곳, `as unknown as` 다수(FirestoreTimestamp `toMillis` 누락 ~10곳), types.ts에 런타임 값 혼재
- 번들 877kB → firebase/tiptap manualChunks 코드스플릿

**성능**
- `App.tsx renderContent()`가 매 스냅샷마다 feed 필터 전체 재계산 + per-post `isAuthorExiled` 조회 → `useMemo`. 전 유저 리스너가 App 렌더 경로에 결합(전령 페이지 잼 근원)

**기타 Medium**
- `ReportManagement.tsx:637` 동적 Tailwind 클래스(`bg-${color}-50`) JIT 미생성 → 선택 하이라이트 안 보임
- `SettlementQueue.tsx:30` 낙관적 UI가 await 전 제거 + catch 없음 → 실패 시 정산건 UI에서 소실
- `gloveBotFetcher.js:122,263` RSS/DART 외부데이터 미이스케이프 저장형 XSS
- `reportSubmit.js:110` 신고 일일상한 비원자적 check-then-set → 병렬로 우회
- `firestore.indexes.json` market_items `(authorId,createdAt)`/`(authorId,status,createdAt)` 복합인덱스 누락
- `workers/src/index.ts:121` 링크프리뷰 SSRF (redirect follow로 내부 IP 우회)

---

## 개선 로드맵 (권장 순서)

1. **P0 배포 차단 6종** — 금전/보안/크래시. Rules·Functions·Worker 재배포 필요.
2. **P1 정합성·보안 9종** — increment 전환, linkUrl 유틸, 수수료·자기결제·멱등, author_id rules, 에러핸들링.
3. **P2 리팩터링·품질** — 중복 추출 → lint 게이트 → deps 정리 → 타입·성능.

각 단계는 AS-IS→TO-BE 보고 후 surgical edit로 진행 (CLAUDE.md 수칙 2·3). 배포는 사용자 명시 오더 시에만.
