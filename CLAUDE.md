# CLAUDE.md — Claude Code 전용 지침

이 파일은 Claude Code가 **할말있소(HALMAL-ITSO)** 프로젝트에서 작업할 때 반드시 따라야 하는 지침입니다.

---

## 프로젝트 핵심 파악

- **blueprint.md** — 설계 계약서 (아키텍처·규칙·가이드라인). 모든 작업 전 반드시 참조.
- **changelog.md** — 구현 완료 기능 이력 (blueprint.md 섹션 8 분리). 과거 구현 확인 시 참조.
- **GIANTTREE.md** — 거대 나무 상세 설계서 (blueprint.md 섹션 10 분리). 전파 시스템·잎사귀·시든 가지 등.
- **GEMINI.md** — 범용 AI 개발 원칙 (코드 품질, Firebase 규칙 등).
- **src/types.ts** — TypeScript 인터페이스 전체. 새 타입 추가 시 여기에만 작성.

---

## 절대 수칙

0. **Human Readable 원칙 (대전제)**: 모든 코드는 훗날 휴먼이 혼자 읽고 이해하고 유지보수할 수 있어야 한다.
   - 변수명·함수명은 역할이 명확하게 드러나는 한국어 주석 또는 영어 명칭 사용.
   - 복잡한 로직에는 **왜(Why)** 이렇게 작성했는지 한 줄 주석 필수.
   - 마법 숫자(magic number), 약어, 축약 변수명 금지. 의미 없는 `a`, `b`, `tmp` 사용 금지.
   - 새 기능 추가 시 해당 블록 상단에 `// 🚀 기능명: 설명` 형식으로 목적 명시.

1. **코드 보호**: 요구사항과 무관한 기존 코드를 절대 수정하지 않는다. Tailwind 클래스, 마진, 패딩 1픽셀도 임의 변경 금지.
2. **선 보고 후 실행**: 코드 수정 전 AS-IS → TO-BE를 한국어로 설명하고 사용자 확인 후 실행.
3. **Surgical Edit**: 파일 전체 재작성 대신 필요한 부분만 Edit 도구로 정밀하게 수정.
4. **200라인 규칙**: 파일이 200라인 초과 시 기능별 분리 제안.

---

## 기술 규칙

### Firebase / Firestore
- Firestore 자동 생성 ID 금지 → `topic_timestamp_uid` / `comment_timestamp_uid` 형식 사용
  - **예외**: `notifications/{uid}/items`, `sentBalls/{uid}/items`, `giant_trees/{id}/leaves` — 보조 데이터는 `addDoc` 자동 ID 허용
- 실시간 리스너: `onSnapshot` (App.tsx 또는 개별 컴포넌트에서 관리)
- 컬렉션: `posts`, `comments`, `users`, `kanbu_rooms`, `notifications`, `sentBalls`, `communities`, `community_posts`, `community_memberships`, `community_post_comments`, `giant_trees`, `marathon_dedup`
- **Firestore Security Rules 차단 필드**: `ballBalance`, `promoEnabled`, `promoExpireAt`, `promoPlan`, `promoUpdatedAt` — 클라이언트 직접 수정 불가, 반드시 Cloud Function 경유

### Cloud Functions (서울 리전, `functions/` 디렉토리)
- `index.js` — 진입점 (fetchMarathonNews + 분리 모듈 re-export)
- `thanksball.js` — `sendThanksball`: 땡스볼 전송 (잔액 차감·수신자 누적·알림). posts.author_id 우선 조회로 수신자 UID 확보.
- `testCharge.js` — `testChargeBall`: 테스트용 볼 충전
- `kanbuPromo.js` — `registerKanbuPromo`: 깐부 홍보 카드 등록 (Lv2+, 기간제)
- `auction.js` / `revenue.js` / `fraud.js` / `settlement.js` — ADSMARKET 광고 시스템
- `contentLength.js` — `validateContentLength`: 신포도와 여우 100자 제한
- 배포: `firebase deploy --only functions`

### Cloudflare R2 이미지 업로드
- **Worker 프록시 방식**: 클라이언트 → `halmal-upload-worker` (Firebase Auth ID Token 인증) → R2 바인딩 직접 저장
- 클라이언트 함수: `src/uploadToR2.ts` — `uploadToR2(file, filePath)` 
- 메타데이터에 한국어(비ASCII) 금지
- 업로드 경로: `uploads/{userId}/{filename}`, `avatars/{nickname}_{timestamp}`
- 공개 URL 베이스: `https://pub-9e6af273cd034aa6b7857343d0745224.r2.dev`
- **클라이언트에 R2 API 키 없음** — Worker가 R2 바인딩으로 직접 접근

### Cloudflare Workers
- **halmal-link-preview** (링크 미리보기): `workers/src/index.ts` | 배포: `cd workers && npx wrangler deploy`
- **halmal-upload-worker** (R2 업로드 프록시): `upload-worker/src/index.ts` | 배포: `cd upload-worker && npx wrangler deploy`
- CORS 허용: `halmal-itso.web.app` + `localhost:5173/4173`
- **Workers 코드 수정 시**: Firebase deploy와 별개로 각 디렉토리에서 `npx wrangler deploy` 별도 실행 필요

### HTML 렌더링
- 에디터 출력은 `dangerouslySetInnerHTML={{ __html: post.content }}` 사용
- `@tailwindcss/typography` 미설치 → `prose` 클래스 무효. Tailwind arbitrary selector 사용 (`[&_p]:mb-4` 등)
- 목록 뷰에서 이미지는 `[&_img]:hidden` (line-clamp 적용)

### 레벨·평판 시스템
- **레벨(EXP)** = 성실도. DB에 `exp` 필드만 `increment()` 누적. `level` 필드 DB 저장 금지.
- 프론트에서 `calculateLevel(exp)` 함수로 실시간 계산 (`utils.ts`)
- **평판(Reputation)** = 신뢰도 5단계. `(likes×2) + (totalShares×3) + (ballReceived×5)`. 중립(0~299)→약간 우호(300)→우호(1000)→매우 우호(2000)→확고(3000).
- EXP 지급 조건: 본문 10자 이상 (`isEligibleForExp()`). Rate Limit: 글 60초, 댓글 15초 쿨다운.
- 삭제 시 EXP 차감: 글 -2, 댓글 -2, 깐부 해제 -15.
- **공개 프로필**: 아바타 클릭 → `PublicProfile` (7영역). 사이드바 내정보 → `MyPage` (관리).

### TypeScript
- 빌드 에러 0 유지 (`npm run build` 확인)
- 미사용 변수 `_` 접두사 또는 즉시 제거

---

## 컴포넌트별 주의사항

| 파일 | 주의 |
|------|------|
| `App.tsx` | 전역 상태·리스너 중심. props drilling이 많으므로 함부로 리팩터링 금지. |
| `TiptapEditor.tsx` | 스티키 툴바 + 버블 메뉴 로직 손대지 않기. 커서 위치 유지 로직 보호. |
| `CreatePostBox.tsx` | 카테고리 목록에서 "한컷" 제외 유지. |
| `DiscussionView.tsx` | `CATEGORY_RULES` 객체 — 카테고리별 댓글 규칙 정의. 임의 변경 금지. |
| `OneCutDetailView.tsx` | 2컬럼 레이아웃(8:4 그리드) 유지. tree 문서 실시간 구독(`onSnapshot`). |
| `DebateBoard.tsx` | 너와 나의 이야기 댓글 IME 처리 — InlineForm 컴포넌트 금지, 인라인 JSX 유지. `isComposing` 체크 보호. |
| `RootPostCard.tsx` | 하단 통계 바 3컬럼 구조(댓글\|땡스볼\|동의) 유지. `onBack` prop 체인 보호. |
| `ThanksballModal.tsx` | `sendThanksball` Cloud Function(`functions/thanksball.js`)으로 서버 처리. ballBalance 직접 수정 금지(Rules 차단). 서버에서 잔액 차감·수신자 누적·sentBalls·notifications·thanksballTotal 5곳 동시 처리. |
| `OneCutList.tsx` | 카드 하단은 AnyTalkList 일반 글카드와 완전 동일 구조 유지(아바타w-6+프로필클릭+공유버튼). 원본글 영역 `min-h-[22px]` 높이 확보 필수(카드 세로 통일). |
| `NotificationBell.tsx` | `notifications/{uid}/items` 실시간 구독. `writeBatch`로 일괄 읽음 처리. 타입: `thanksball·community_post·finger_promoted·giant_tree_spread·giant_tree_wilt`. `isUnread()` 헬퍼로 `read`/`isRead` 두 필드 통합 판단. |
| `EditorToolbar.tsx` | 링크 삽입 후 Workers 호출 → `LinkPreviewCard` 표시. `fetchPreview` 내부 상태 보호. |
| `LinkPreviewCard.tsx` | OgData 타입 export — EditorToolbar에서 import해 사용. |

---

## 개발·테스트 환경

- 테스트 계정: 깐부1호, 깐부2호, 깐부3호, 깐부4호, 깐부5호 (헤더 Dev 버튼으로 전환)
- 빌드: `npm run build`
- 배포: `firebase deploy --only hosting`
- 린트: `npx eslint . --fix`

---

## 필터링 로직 (절대 불변)

| 탭 | 조건 |
|----|------|
| any (새글) | 게시 후 **2시간** 이내 |
| recent (등록글) | **2시간 경과** + 좋아요 **3개** 이상 |
| best (인기글) | 좋아요 10개 이상 |
| rank (최고글) | 좋아요 30개 이상 |
| friend (깐부글) | 좋아요 3개 이상 + 팔로우 유저 (시간 제한 없음) |
| 카테고리 뷰 | 좋아요 3개 이상 |
| RelatedPostsSidebar | 2시간 경과 + 좋아요 3개 이상 (등록글 기준 동일) |

---

## 금지 사항

- `write_file` / `Write` 도구로 기존 파일 전체 덮어쓰기 (신규 파일 제외)
- 요청 없는 리팩터링, 불필요한 주석·docstring 추가
- `firebase deploy` 자동 실행 (사용자 명시 요청 시에만)
- Git push 자동 실행 (사용자 명시 요청 시에만)
