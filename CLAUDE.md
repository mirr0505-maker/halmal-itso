# CLAUDE.md — Claude Code 전용 지침

이 파일은 Claude Code가 **할말있소(HALMAL-ITSO)** 프로젝트에서 작업할 때 반드시 따라야 하는 지침입니다.

---

## 프로젝트 핵심 파악

- **blueprint.md** — 설계 계약서. 모든 작업 전 반드시 참조.
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
  - **예외**: `notifications/{nick}/items`, `sentBalls/{nick}/items` — 알림·내역 데이터는 `addDoc` 자동 ID 허용
- 실시간 리스너: `onSnapshot` (App.tsx 또는 개별 컴포넌트에서 관리)
- 컬렉션: `posts`, `users`, `kanbu_rooms`, `notifications`, `sentBalls`

### Cloudflare R2 이미지 업로드
- `File` → `ArrayBuffer` → `Uint8Array` → `PutObjectCommand`
- 메타데이터에 한국어(비ASCII) 금지
- 업로드 경로: `uploads/{userId}/{filename}`
- 공개 URL 베이스: `https://pub-9e6af273cd034aa6b7857343d0745224.r2.dev`

### Cloudflare Workers (링크 미리보기)
- 엔드포인트: `https://halmal-link-preview.mirr0505.workers.dev`
- 소스: `workers/src/index.ts` — OG 태그 파싱, 내부 IP 차단, CORS 제한
- 배포: `workers/` 디렉토리에서 `npx wrangler deploy` (wrangler 로그인 필요)
- CORS 허용: `halmal-itso.web.app` + `localhost:5173/4173`
- **Workers 코드 수정 시**: `npm run build` 후 `npx wrangler deploy` 별도 실행 필요 (Firebase deploy와 별개)

### HTML 렌더링
- 에디터 출력은 `dangerouslySetInnerHTML={{ __html: post.content }}` 사용
- `@tailwindcss/typography` 미설치 → `prose` 클래스 무효. Tailwind arbitrary selector 사용 (`[&_p]:mb-4` 등)
- 목록 뷰에서 이미지는 `[&_img]:hidden` (line-clamp 적용)

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
| `OneCutDetailView.tsx` | 3컬럼 레이아웃 유지. |
| `DebateBoard.tsx` | 너와 나의 이야기 댓글 IME 처리 — InlineForm 컴포넌트 금지, 인라인 JSX 유지. `isComposing` 체크 보호. |
| `RootPostCard.tsx` | 하단 통계 바 3컬럼 구조(댓글\|땡스볼\|동의) 유지. `onBack` prop 체인 보호. |
| `ThanksballModal.tsx` | `sentBalls` + `notifications` + `thanksballTotal` 3곳 동시 쓰기 — 하나라도 누락 금지. |
| `NotificationBell.tsx` | `notifications/{nick}/items` 실시간 구독. `writeBatch`로 일괄 읽음 처리. |
| `EditorToolbar.tsx` | 링크 삽입 후 Workers 호출 → `LinkPreviewCard` 표시. `fetchPreview` 내부 상태 보호. |
| `LinkPreviewCard.tsx` | OgData 타입 export — EditorToolbar에서 import해 사용. |

---

## 개발·테스트 환경

- 테스트 계정: 깐부1호, 깐부2호, 깐부3호 (헤더 Dev 버튼으로 전환)
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
