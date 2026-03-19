# 📜 HALMAL-ITSO 프로젝트 블루프린트 (설계 계약서)

이 문서는 **할말있소(HALMAL-ITSO)** 프로젝트의 설계 원칙, 현재 구현 상태, 그리고 AI 개발자의 **절대적 행동 지침**을 담은 단일 진실 소스(Single Source of Truth)입니다.

> 최종 갱신: 2026-03-19  |  현재 브랜치: `main`

---

## 0. AI 개발자 절대 수칙

1. **Strict Focus**: 요구사항과 무관한 기존 코드(특히 Tailwind 레이아웃, 마진, 패딩)는 단 1픽셀도 임의로 수정·삭제하지 않는다.
2. **Surgical Edit**: 파일 전체를 덮어쓰는 방식을 원칙적으로 금지. 오직 필요한 라인만 정밀하게 수술한다.
3. **Strategy Approval (선 보고 후 실행)**: 코드 수정 전 반드시 **AS-IS / TO-BE**를 한국어로 보고하고 승인을 받은 후 실행한다.
4. **Component Decomposition**: 단일 파일이 200라인을 초과하면 UI / 로직 / 타입별로 파일을 분리한다. (현재 `App.tsx`, `DiscussionView.tsx` 등 일부 파일이 임계점에 도달함)
5. **No Auto-Generated IDs**: Firestore 자동 ID 사용 금지. `topic_timestamp_uid` 또는 `comment_timestamp_uid` 형태의 맥락 ID를 직접 생성한다.

---

## 1. 프로젝트 개요

| 항목 | 내용 |
|------|------|
| **프로젝트명** | 할말있소 (HALMAL-ITSO) |
| **의미** | "I have something to say" — 자유 토론 커뮤니티 |
| **대상** | 한국어 사용자 |
| **유형** | 소셜 토론 플랫폼 (멀티 카테고리) |
| **배포** | Firebase Hosting |
| **저장소** | `/home/user/halmal-itso` |

---

## 2. 기술 스택

| 분류 | 기술 | 버전 |
|------|------|------|
| **UI 프레임워크** | React | 19.2.0 (Suspense/Lazy 적용) |
| **언어** | TypeScript | ~5.9.3 |
| **빌드** | Vite | 7.3.1 |
| **스타일** | Tailwind CSS (@tailwindcss/vite) | 4.2.1 |
| **에디터** | Tiptap | 3.20.1 |
| **DB / Auth** | Firebase (Firestore + Auth) | 12.10.0 |
| **파일 스토리지** | Cloudflare R2 (AWS SDK S3) | 3.1000.0 |

### Tiptap 익스텐션 목록
- `@tiptap/starter-kit` — 기본 세트
- `@tiptap/extension-underline` — 밑줄
- `@tiptap/extension-image` — 이미지 삽입 (R2 업로드 연동)
- `@tiptap/extension-link` — 링크
- `@tiptap/extension-placeholder` — 플레이스홀더
- *(설치됨/미적용)*: `bubble-menu`, `floating-menu`

---

## 3. 아키텍처

### 3.1 파일 구조

```
/src
├── App.tsx                  # 루트 컴포넌트 (전역 상태 관리, 실시간 리스너, 라우팅 레이아웃)
├── main.tsx                 # 진입점
├── types.ts                 # 공용 인터페이스
├── firebase.ts              # Firebase 초기화
├── s3Client.ts              # R2 S3Client 설정
├── utils.ts                 # 유틸리티 (포맷팅, 라벨링 등)
├── index.css                # 전역 스타일 & 애니메이션
└── components/              # 핵심 컴포넌트
    ├── Sidebar.tsx          # 좌측 네비게이션
    ├── SubNavbar.tsx        # 홈 전용 탭 필터
    ├── CategoryHeader.tsx   # 카테고리별 헤더
    ├── AnyTalkList.tsx      # 메인 그리드 목록 (이미지 추출 로직 포함)
    ├── DiscussionView.tsx   # 일반글 상세 뷰 (2컬럼, 콤팩트 레이아웃)
    ├── RootPostCard.tsx     # 상세 뷰 상단 포스트 카드
    ├── DebateBoard.tsx      # 댓글/연계글 목록 & 스레드
    ├── OneCutList.tsx       # 한컷 목록 (9:16 그리드)
    ├── OneCutDetailView.tsx # 한컷 상세 뷰 (2컬럼, 연결된 할말 지원)
    ├── TiptapEditor.tsx     # 리치 에디터 (스티키 툴바)
    ├── CreatePostBox.tsx    # 일반글 작성 폼
    ├── CreateOneCutBox.tsx  # 한컷 작성 폼
    └── ...
```

### 3.2 상태 관리 (`App.tsx`)

- **실시간 구독**: `onSnapshot`을 통해 `posts`와 `users` 컬렉션을 실시간으로 감시.
- **Lazy Loading**: `Suspense`와 `lazy`를 사용하여 주요 뷰 컴포넌트를 분리, 초기 로딩 최적화.

---

## 4. 데이터 모델 (`Post`)

```typescript
interface Post {
  id: string;          // custom ID (topic_... 또는 comment_...)
  author: string;      // 닉네임
  author_id: string;   // UID
  category: string;    // 한국어 카테고리명
  title?: string;      // 제목
  content: string;     // HTML (Tiptap)
  parentId?: string;   // 직계 부모 ID
  rootId?: string;     // 최상위 글 ID
  side?: 'left' | 'right'; // 토론 포지션
  type?: 'comment' | 'formal'; // 댓글 vs 정식 연계글
  likes: number;
  likedBy: string[];
  isOneCut?: boolean;
  imageUrl?: string;   // 한컷용 이미지
  linkedPostId?: string; // 한컷-일반글 연결
  tags?: string[];     // 한컷용 태그
  createdAt: any;      // Timestamp
}
```

---

## 5. 카테고리 시스템 (`MENU_MESSAGES` & `CATEGORY_RULES`)

| 메뉴 ID | 표시명 (Title) | 카테고리 키 (DB) | 특이사항 |
|---------|--------------|-----------------|----------|
| `my_story` | 너와 나의 이야기 | 너와 나의 이야기 | 일상, 공감 위주 |
| `naked_king` | 판도라의 상자 | 벌거벗은 임금님 | 팩트체크 보드 |
| `donkey_ears` | 솔로몬의 재판 | 임금님 귀는 당나귀 귀 | 찬/반 토론, 정식 연계글 허용 |
| `knowledge_seller` | 황금알을 낳는 거위 | 지식 소매상 | Q&A 보드 |
| `bone_hitting` | 신포도와 여우 | 뼈때리는 글 | 명언, 짧은 글 |
| `local_news` | 마법 수정 구슬 | 현지 소식 | 정보 공유 보드 |

---

## 6. 필터링 및 노출 규칙

### 6.1 홈 탭 (`activeTab`)
- **아무말 (any)**: 1시간 이내 모든 글.
- **주목말 (recent)**: 좋아요 3개 이상.
- **대세말 (best)**: 좋아요 10개 이상.
- **명예말 (rank)**: 좋아요 30개 이상.
- **깐부말 (friend)**: 팔로우한 사용자의 글.

### 6.2 카테고리 뷰
- 해당 카테고리 내에서 **좋아요 3개 이상**을 획득한 글만 노출 (품질 필터).

---

## 7. UI / 레이아웃 가이드라인

### 7.1 상세 뷰 공통 (Discussion / OneCut)
- **2컬럼 그리드**: `md:col-span-8` (메인 콘텐츠) + `md:col-span-4` (우측 사이드바).
- **최대 폭**: `max-w-[1600px] mx-auto`.
- **사이드바**: '등록글 더보기' 또는 'Trending OneCuts'를 배치하여 체류 시간 증대.

### 7.2 리스트 뷰 (`AnyTalkList`)
- **가변 그리드**: `minmax(280px, 1fr)` 기반 `auto-fill`.
- **이미지 자동 추출**: 본문 HTML 내 첫 번째 `<img>` 태그를 찾아 썸네일로 활용.
- **카드 디자인**: 라운드 `rounded-[2rem]`, 호버 시 `border-blue-400` 및 그림자 효과.

### 7.3 한컷 시스템 (`OneCut`)
- **비율**: 9:16 세로형 이미지 최적화 (`aspect-[9/16]`).
- **연결**: 일반 게시글과 한컷을 `linkedPostId`로 상호 연결하여 이동 지원.

---

## 8. 현재 구현 상태 (2026-03-19 기준)

### ✅ 완료된 핵심 기능
- [x] **Tiptap 프리미엄 에디터**: 스티키 툴바, 이미지 R2 업로드(드래그&드롭/붙여넣기), 마크다운 호환 스타일.
- [x] **상세 뷰 리뉴얼**: 콤팩트한 2컬럼 레이아웃, 카테고리별 맞춤형 탭 UI(동의/반대/질문 등).
- [x] **한컷 시스템 고도화**: 9:16 상세 뷰, 추천 사이드바, 일반 게시글 연동 버튼.
- [x] **리스트 뷰 최적화**: 본문 내 이미지 자동 추출 및 그리드 레이아웃 개선.
- [x] **실시간 상호작용**: 좋아요, 팔로우, 차단, 실시간 댓글 카운트.

### 🛠️ 진행 중 / 개선 필요 사항
- [ ] **에디터 보완**: `bubble-menu` 활성화 (텍스트 선택 시 서식 도구 노출).
- [ ] **컴포넌트 분리**: 200라인 초과 파일(`App.tsx`, `DiscussionView.tsx`) 리팩토링.
- [ ] **마켓 메뉴**: 기능 정의 및 UI 구현 대기 중.
- [ ] **검색 엔진**: Firestore 텍스트 검색 한계 보완 (현재는 클라이언트 사이드 필터링).

---

## 9. Cloudflare R2 & Firebase 규칙 (동일 유지)
- R2: 비ASCII 파일명 금지, `uploads/{userId}/{filename}` 경로.
- Firebase: `post_timestamp_nickname` ID 규칙 준수.
