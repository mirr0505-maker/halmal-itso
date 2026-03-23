# 📜 HALMAL-ITSO 프로젝트 블루프린트 (설계 계약서)

이 문서는 **할말있소(HALMAL-ITSO)** 프로젝트의 설계 원칙, 현재 구현 상태, 그리고 AI 개발자의 **절대적 행동 지침**을 담은 단일 진실 소스(Single Source of Truth)입니다.

> 최종 갱신: 2026-03-24 v4 (코드 실측 기준)  |  현재 브랜치: `main`

---

## 0. AI 개발자 절대 수칙

1. **Strict Focus**: 요구사항과 무관한 기존 코드(특히 Tailwind 레이아웃, 마진, 패딩)는 단 1픽셀도 임의로 수정·삭제하지 않는다.
2. **Surgical Edit**: 파일 전체를 덮어쓰는 방식을 원칙적으로 금지. 오직 필요한 라인만 정밀하게 수술한다.
3. **Strategy Approval (선 보고 후 실행)**: 코드 수정 전 반드시 **AS-IS / TO-BE**를 한국어로 보고하고 승인을 받은 후 실행한다.
4. **Component Decomposition**: 단일 파일이 200라인을 초과하면 UI / 로직 / 타입별로 파일을 분리한다. (과거 거대 파일 리팩토링 완료, 지속적인 모니터링 필요)
5. **No Auto-Generated IDs**: Firestore 자동 ID 사용 금지. `topic_timestamp_uid` 또는 `comment_timestamp_uid` 형태의 맥락 ID를 직접 생성한다.
   - **예외**: `notifications/{nick}/items`, `sentBalls/{nick}/items` — 알림·내역 보조 데이터는 `addDoc` 자동 ID 허용.

---

## 1. 프로젝트 개요

| 항목 | 내용 |
|------|------|
| **프로젝트명** | 할말있소 (HALMAL-ITSO) |
| **의미** | "I have something to say" — 자유 토론 커뮤니티 |
| **대상** | 한국어 사용자 |
| **유형** | 소셜 토론 플랫폼 (멀티 카테고리) |
| **배포** | Firebase Hosting |
| **저장소** | `e:\halmal-itso` (Windows) |

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
├── App.tsx                  # 루트 컴포넌트 (전역 상태 관리, 라우팅 레이아웃) ~330줄
├── main.tsx                 # 진입점
├── types.ts                 # 공용 인터페이스
├── constants.ts             # 앱 전역 설정 (MENU_MESSAGES, TEST_ACCOUNTS)
├── firebase.ts              # Firebase 초기화
├── s3Client.ts              # R2 S3Client 설정
├── utils.ts                 # 유틸리티 (포맷팅, 라벨링 등)
├── index.css                # 전역 스타일 & 애니메이션
├── hooks/
│   └── useFirebaseListeners.ts  # Firestore onSnapshot 리스너 전담 custom hook
└── components/              # 핵심 컴포넌트
    ├── Sidebar.tsx          # 좌측 네비게이션
    ├── SubNavbar.tsx        # 홈 전용 탭 필터
    ├── CategoryHeader.tsx   # 카테고리별 헤더
    ├── AnyTalkList.tsx      # 메인 그리드 목록 (이미지 추출 로직 포함)
    ├── PostCard.tsx         # 공통 포스트 카드 컴포넌트
    ├── PostDetailModal.tsx  # 포스트 오버레이 상세 모달
    ├── DiscussionView.tsx   # 일반글 상세 뷰 (2컬럼 레이아웃, CATEGORY_RULES 정의)
    ├── FormalBoard.tsx      # 동의/비동의 정식 연계글 2컬럼 보드 (DiscussionView 내 사용)
    ├── RootPostCard.tsx     # 상세 뷰 상단 포스트 카드
    ├── DebateBoard.tsx      # 댓글 목록 (스레드 구조, 최신순/공감순 정렬)
    ├── CommentMyStory.tsx   # 너와 나의 이야기 댓글 폼 (단순 공감형)
    ├── CommentNakedKing.tsx # 판도라의 상자 댓글 폼 (⭕진실/❌거짓 탭)
    ├── CommentDebate.tsx    # 솔로몬의 재판 댓글 폼 (동의/반대 탭 + 연계글)
    ├── CommentKnowledge.tsx # 황금알을 낳는 거위 댓글 폼 (질문/답변형)
    ├── CommentBoneHitting.tsx# 신포도와 여우 댓글 폼 (단순형)
    ├── CommentLocalNews.tsx # 마법 수정 구슬 댓글 폼 (유용해요/별로예요 탭)
    ├── CommentExile.tsx     # 유배·귀양지 댓글 폼 (동의/반대 탭)
    ├── RelatedPostsSidebar.tsx # DiscussionView 우측 관련글 사이드바
    ├── LinkSearchModal.tsx  # 한컷 작성 시 원본글 검색 팝업
    ├── OneCutList.tsx       # 한컷 목록 (그리드)
    ├── OneCutDetailView.tsx # 한컷 상세 뷰 (3컬럼 레이아웃)
    ├── OneCutListSidebar.tsx # OneCutDetailView 우측 한컷 목록 사이드바
    ├── EditorToolbar.tsx    # TiptapEditor 툴바 버튼 UI
    ├── TiptapEditor.tsx     # 리치 에디터 (스티키 툴바)
    ├── CreateMyStory.tsx    # 너와 나의 이야기 작성 폼 (mood 선택)
    ├── CreateNakedKing.tsx  # 판도라의 상자 작성 폼 (factChecked 토글)
    ├── CreateDebate.tsx     # 솔로몬의 재판 작성 폼 (debatePosition 찬/반/중립)
    ├── CreateKnowledge.tsx  # 황금알을 낳는 거위 작성 폼 (infoPrice 입력)
    ├── CreateBoneHitting.tsx# 신포도와 여우 작성 폼 (bgColor 선택)
    ├── CreateLocalNews.tsx  # 마법 수정 구슬 작성 폼 (location 입력)
    ├── CreateExile.tsx      # 유배·귀양지 작성 폼 (기본형)
    ├── CreateMarket.tsx     # 마켓 작성 폼 (판매 플로우 미구현)
    ├── CreateOneCutBox.tsx  # 한컷 작성 폼
    ├── MyPage.tsx           # 마이페이지 루트 (하위 컴포넌트 조합)
    ├── ProfileHeader.tsx    # 마이페이지 프로필 헤더
    ├── MyProfileCard.tsx    # 프로필 카드 (레벨/통계)
    ├── ProfileEditForm.tsx  # 프로필 수정 폼
    ├── ActivityStats.tsx    # 활동 통계 (좋아요·게시글·댓글 수)
    ├── ActivityMilestones.tsx # 활동 마일스톤 배지
    ├── MyContentTabs.tsx    # 마이페이지 내 탭 (게시글/한컷/댓글/아바타/깐부)
    ├── AvatarCollection.tsx # 아바타 컬렉션 선택 UI
    ├── KanbuRoomList.tsx    # 깐부방 목록 (Lv3 이상 개설 가능)
    ├── KanbuRoomView.tsx    # 깐부방 상세 (게시판 좌 + 실시간 채팅 우)
    ├── CreateKanbuRoomModal.tsx # 깐부방 개설 모달
    ├── ThanksballModal.tsx  # 땡스볼 전송 모달 (볼 선택·메시지·티어 표시)
    ├── NotificationBell.tsx # 헤더 알림 벨 (땡스볼 수신 알림, 실시간 뱃지)
    └── RankingView.tsx      # 랭킹 페이지 (좋아요·땡스볼 × 유저·글 4개 뷰)
```

### 3.2 상태 관리 (`App.tsx`)

- **실시간 구독**: `onSnapshot`을 통해 `posts`와 `users` 컬렉션을 실시간으로 감시.
- **Lazy Loading**: `Suspense`와 `lazy`를 사용하여 주요 뷰 컴포넌트를 분리, 초기 로딩 최적화.

---

## 4. 데이터 모델

### 4.1 `AuthorInfo` (중첩 객체)

```typescript
interface AuthorInfo {
  level: number;
  friendCount: number;
  totalLikes: number;
}
```

### 4.2 `Post`

```typescript
interface Post {
  id: string;          // custom ID (topic_... 또는 comment_...)
  author: string;      // 닉네임
  author_id?: string;  // UID
  category?: string;   // 한국어 카테고리명
  title?: string;      // 제목
  content: string;     // HTML (Tiptap)
  imageUrl?: string | null;  // 한컷용 이미지
  linkUrl?: string | null;   // 외부 링크
  tags?: string[];     // 한컷용 태그
  authorInfo?: AuthorInfo;
  parentId: string | null;   // 직계 부모 ID
  rootId: string | null;     // 최상위 글 ID
  side: 'left' | 'right';   // 토론 포지션
  type: 'comment' | 'formal'; // 댓글 vs 정식 연계글
  likes: number;
  dislikes: number;
  likedBy?: string[];  // 좋아요 닉네임 목록
  commentCount?: number; // 마이페이지 표시용
  createdAt: any;      // Firestore Timestamp

  // 카테고리별 확장 필드
  mood?: string;              // 너와 나의 이야기: 오늘의 기분
  factChecked?: boolean;      // 벌거벗은 임금님: 사실 확인 여부
  debatePosition?: 'pro' | 'con' | 'neutral'; // 임금님 귀는 당나귀 귀
  location?: string;          // 현지 소식: 발생 지역
  infoPrice?: number;         // 지식 소매상: 정보 가치(포인트)
  bgColor?: string;           // 뼈때리는 글: 배경색

  // 한컷 관련 필드
  isOneCut?: boolean;         // 한컷 게시물 여부
  linkedPostId?: string;      // 연계된 원본 게시글 ID

  // 깐부방 관련 필드
  kanbuRoomId?: string;       // 소속 깐부방 ID

  // 댓글 고정 (너와 나의 이야기 등)
  pinnedCommentId?: string;   // 작성자가 고정한 댓글 ID

  // 땡스볼
  thanksballTotal?: number;   // 받은 총 볼 수 (누적, Firestore increment)
}

interface Thanksball {
  id: string;
  sender: string;      // 보낸 사람 닉네임
  senderId: string;    // 보낸 사람 UID
  amount: number;      // 볼 수 (1볼 = $1, 향후 실결제 연동)
  message?: string;    // 응원 메시지 (최대 50자, 선택)
  createdAt: any;      // Firestore Timestamp
  isPaid: boolean;     // false = 가상볼(현재), true = 실결제(향후)
}

interface KanbuRoom {
  id: string;
  title: string;
  description?: string;
  creatorNickname: string;
  creatorId: string;
  creatorLevel: number;
  createdAt: any;
}

interface KanbuChat {
  id: string;
  author: string;
  authorId: string;
  content: string;
  createdAt: any;
}
```

---

## 5. 카테고리 시스템 (`MENU_MESSAGES` & `CATEGORY_RULES`)

| 메뉴 ID | 표시명 (Title) | 카테고리 키 (DB) | 특이사항 |
|---------|--------------|-----------------|----------|
| `onecut` | 한컷 | (isOneCut 플래그) | 9:16 세로형 이미지 전용 |
| `my_story` | 너와 나의 이야기 | 너와 나의 이야기 | 일상, 공감 위주 |
| `naked_king` | 판도라의 상자 | 판도라의 상자 | 팩트체크 보드 (구: 벌거벗은 임금님 → migrate 완료) |
| `donkey_ears` | 솔로몬의 재판 | 솔로몬의 재판 | 찬/반 토론, 정식 연계글 허용 (구: 임금님 귀는 당나귀 귀 → migrate 완료) |
| `knowledge_seller` | 황금알을 낳는 거위 | 황금알을 낳는 거위 | Q&A 보드 (구: 지식 소매상 → migrate 완료) |
| `bone_hitting` | 신포도와 여우 | 신포도와 여우 | 명언, 짧은 글 (구: 뼈때리는 글 → migrate 완료) |
| `local_news` | 마법 수정 구슬 | 마법 수정 구슬 | 정보 공유 보드 (구: 현지 소식 → migrate 완료) |
| `friends` | 깐부 맺기 | (UI 전용) | 팔로우 추천 목록 (허용 닉네임 필터 적용) |
| `kanbu_room` | 깐부방 | (subcollection) | 깐부가 개설한 방 목록, 방별 게시판+실시간 채팅. Lv3 이상 개설. Firestore: `kanbu_rooms/{roomId}/chats` |
| `market` | 마켓 | 마켓 | OneCutList 그리드 레이아웃, 게시글 없을 시 "기록된 글이 없어요" |
| `exile_place` | 유배·귀양지 | 유배·귀양지 | 제재 유저 전용 소통 공간, 주제 없음 |
| `ranking` | 랭킹 | (UI 전용) | 좋아요·땡스볼 × 유저·글 4개 뷰. `RankingView.tsx`. 사이드바 내정보 위 배치. |

---

## 6. 필터링 및 노출 규칙

### 6.1 홈 탭 (`activeTab`)
- **새글 (any)**: 등록 후 2시간 이내 모든 글.
- **등록글 (recent)**: 2시간 경과 + 좋아요 3개 이상 (새글 심사 통과 기준).
- **인기글 (best)**: 좋아요 10개 이상.
- **최고글 (rank)**: 좋아요 30개 이상.
- **깐부글 (friend)**: 좋아요 3개 이상 + 팔로우 유저 작성 (시간 제한 없음 — 친구들의 좋은 글 모아보기).

### 6.2 카테고리 뷰
- 해당 카테고리 내에서 **좋아요 3개 이상**을 획득한 글만 노출 (품질 필터).

### 6.3 등록글 더보기 사이드바 (`RelatedPostsSidebar`)
- **노출 조건**: 등록글 기준과 동일 — **2시간 경과 + 좋아요 3개 이상**.
- 현재 보고 있는 글과 동일 카테고리 + 한컷 제외 + 최대 10개.
- 필터 위치: `DiscussionView.tsx` `relatedPosts` 계산 시 적용.

---

## 7. UI / 레이아웃 가이드라인

### 7.1 상세 뷰 공통 (Discussion / OneCut)
- **2컬럼 그리드**: `md:col-span-8` (메인 콘텐츠) + `md:col-span-4` (우측 사이드바).
- **최대 폭**: `max-w-[1600px] mx-auto`.
- **사이드바 (DiscussionView)**: 동일 카테고리 내 다른 글 목록('등록글 더보기').
- **사이드바 (OneCutDetailView)**: `SideOneCuts` — 다른 한컷 최대 20개 세로 스크롤.
- **OneCutDetailView 내부 구조**: ① 상단 헤더(제목/태그/연결글 버튼) → ② 메인 이미지(aspect-[9/16]) → ③ 텍스트 설명 → ④ 작성자 정보 바 → ⑤ 동의/반대 투표 + 댓글 폼 → ⑥ DebateBoard 댓글 목록.

### 7.2 리스트 뷰 (`AnyTalkList`)
- **가변 그리드**: `minmax(280px, 1fr)` 기반 `auto-fill`.
- **이미지 자동 추출**: 본문 HTML 내 첫 번째 `<img>` 태그를 찾아 썸네일로 활용.
- **카드 디자인**: 라운드 `rounded-[2rem]`, 호버 시 `border-blue-400` 및 그림자 효과.
- **카드 우측 상단 지표**:
  - `tab === 'any'` (새글 탭): 하트 3개 표시. `promoLevel = Math.min(post.likes, 3)` 기준으로 채워진 하트 수 결정 (0개이면 전부 빈 하트). `text-rose-400 fill-current` (채움) vs `text-slate-100 fill-none` (빈 하트).
  - 그 외 탭 / 카테고리 뷰: Lv5 이상 유저가 좋아요를 누른 수(`goldStarCount`) > 0 일 때만 금색 별(⭐) + 숫자 표시. `text-amber-400 fill-current`. 0이면 아무것도 표시하지 않음.

### 7.3 한컷 시스템 (`OneCut`)
- **비율**: 9:16 세로형 이미지 최적화 (`aspect-[9/16]`).
- **연결**: 일반 게시글과 한컷을 `linkedPostId`로 상호 연결하여 이동 지원.

---

## 8. 현재 구현 상태 (2026-03-24 기준, 코드 실측)

### ✅ 완료된 핵심 기능 (2026-03-24 갱신)
- [x] **Tiptap 프리미엄 에디터**: 스티키 툴바, 이미지 R2 업로드(드래그&드롭/붙여넣기), 마크다운 호환 스타일.
- [x] **상세 뷰 리뉴얼**: 콤팩트한 2컬럼 레이아웃, 카테고리별 맞춤형 탭 UI(동의/반대/질문 등).
- [x] **한컷 시스템 고도화**: 그리드 상세 뷰, OneCutListSidebar, 일반 게시글 연동 버튼, 동의/반대 투표.
- [x] **리스트 뷰 최적화**: 본문 내 이미지 자동 추출 및 그리드 레이아웃 개선.
- [x] **실시간 상호작용**: 좋아요, 팔로우/차단, 실시간 댓글 카운트.
- [x] **마이페이지(MyPage)**: ProfileHeader + ActivityStats + ActivityMilestones + MyContentTabs + AvatarCollection 분리 구성. 탭: 나의기록/나의한컷/참여한토론/아바타수집/깐부목록/받은볼/보낸볼 (7개).
- [x] **PostDetailModal**: 글 클릭 시 오버레이 형태로 상세 내용 + 댓글 표시 (App.tsx `selectedPost` 상태 활용).
- [x] **깐부 맺기 메뉴**: `friends` 메뉴에서 허용된 닉네임 목록 대상으로 팔로우 UI 제공.
- [x] **PostCard 공통화**: 여러 목록 뷰에서 재사용 가능한 카드 컴포넌트.
- [x] **App.tsx 경량화**: custom hook(`useFirebaseListeners`)으로 Firestore 리스너 분리, ~330줄로 감소.
- [x] **200줄 분리 완료**: DiscussionView, TiptapEditor, MyProfileCard, CreateOneCutBox, OneCutDetailView 등 분리.
- [x] **새글 작성 폼 메뉴별 분리**: 특정 메뉴(my_story~market) 진입 시 전용 폼 표시. 홈(home)/마이페이지 등 맵에 없는 화면에서는 `CreatePostBox`(카테고리 드롭다운) 유지. App.tsx `CREATE_MENU_COMPONENTS` 맵으로 분기.
- [x] **댓글 폼 메뉴별 분리**: PostCommentForm → 7개 전용 컴포넌트로 분리. DiscussionView에서 `CATEGORY_COMMENT_MAP`으로 `rootPost.category` 기준 분기. 한컷은 OneCutDetailView 내 기존 처리 유지.
- [x] **댓글 스레드 구조**: `parentId === rootId` 기반 트리 렌더링, 최신순/공감순 정렬 (단일 보드형).
- [x] **마켓 메뉴**: OneCutList 그리드 레이아웃 + 빈 상태 메시지 구현.
- [x] **필터링 버그 수정**: 등록글(1시간 경과 조건 누락), 깐부글(좋아요 3개 이상 조건 누락) 수정.
- [x] **등록글 더보기 필터 버그 수정**: `RelatedPostsSidebar`에 노출되는 글이 등록글 조건(1시간 경과 + 좋아요 3개 이상) 없이 전체 노출되던 문제 수정 (`DiscussionView.tsx`).
- [x] **권한 버그 수정**: `RootPostCard`에서 `|| post.author === "흑무영"` 하드코딩으로 인해 모든 유저가 흑무영 게시글을 수정/삭제할 수 있던 문제 수정.
- [x] **카테고리 전면 개편 및 DB 마이그레이션**: 내부 카테고리명을 새 표시명으로 일괄 변경 (벌거벗은 임금님→판도라의 상자, 임금님 귀는 당나귀 귀→솔로몬의 재판, 지식 소매상→황금알을 낳는 거위, 뼈때리는 글→신포도와 여우, 현지 소식→마법 수정 구슬, 나의 이야기→너와 나의 이야기). Firestore 15건 migrate.cjs로 일괄 업데이트. 구 카테고리명 backward-compat 유지.
- [x] **깐부방 기능**: 사이드바 전용 섹션(깐부방+깐부맺기 묶음). 방 목록(KanbuRoomList), 방 상세(KanbuRoomView — 게시판+실시간 채팅), 방 개설 모달(CreateKanbuRoomModal). Lv3 이상 개설 가능. Firestore `kanbu_rooms` 컬렉션 + `chats` 서브컬렉션.
- [x] **골드스타(Gold Star)**: Lv5 이상 유저가 좋아요 시 금색 별(★) 카운트 표시. 새글(any) 탭 제외한 모든 뷰(등록글/인기글/최고글/깐부글/카테고리 뷰)에서 카드 우측 상단에 노출. 카운트 0이면 표시 안 함. (구: 골드하트 → 골드스타로 교체, SVG star path 사용)
- [x] **상세글 뒤로가기**: `RootPostCard` 좌측 상단 파란 카테고리 버튼 클릭 시 `activeMenu` 유지하며 목록으로 복귀. 화살표(←) + hover 효과 추가. `onBack` prop: App→DiscussionView→RootPostCard 체인.
- [x] **댓글 UX 수정**: 너와 나의 이야기(구 나의 이야기 포함) 카테고리에서 댓글 남기기 폼 표시 제거. 동의/비동의 카운트 `allowDisagree=false` 카테고리에서 미표시.
- [x] **헤더 브랜드**: GLove 로고 옆 "집단지성의 힘" 서브텍스트 추가.
- [x] **사이드바 구조 개편**: 깐부방+깐부맺기 동일 섹션(구분선 아래), 내정보 별도 섹션. 깐부방 배지 색상: `bg-blue-100 text-blue-600` (구: rose 계열).
- [x] **로딩 애니메이션 교체**: 말 뛰어가기 이미지 → pulsing GLove 로고 (`@keyframes logo-pulse`: opacity 0→1, scale 0.92→1, 1.4s ease-in-out infinite). `index.css`에 정의, `.animate-logo-pulse` 클래스 적용.
- [x] **너와 나의 이야기 댓글 UX 개선**:
  - 댓글 입력: 단일 라인 `<input>` (구: 여러 줄 textarea).
  - 레이아웃: 입력란 + 바로 아래 "댓글 달기" 버튼.
  - 빈 상태 메시지("첫 번째 글을 남겨보세요.") 숨김.
  - **한글 IME 버그 수정**: `InlineForm` 로컬 컴포넌트 제거 → `DebateBoard` 내 인라인 JSX로 직접 렌더링. (원인: 로컬 컴포넌트는 부모 리렌더 시 unmount/remount되어 IME 조합 파괴). `onKeyDown`에 `!e.nativeEvent.isComposing` 체크 추가.
- [x] **댓글 고정(Pin) 기능**: 너와 나의 이야기 글 작성자가 댓글 하나를 최상단에 고정. `Post.pinnedCommentId` Firestore 필드 활용. `DebateBoard`에서 고정 댓글 항상 최상위 정렬 (최신순/공감순 유지). `PostCard`에 pin 버튼(작성자만 hover 시 노출) + "작성자가 고정한 댓글" 배지 + `bg-amber-50/40 border-l-amber-300` 하이라이트.
- [x] **새글→등록글 로직 변경**: 새글 노출 창: 1시간 → **2시간**. 등록글 심사: 2시간 경과 + 좋아요 **3개** 이상. (`twoHoursAgo` 변수, App.tsx 필터 3곳 수정)
- [x] **땡스볼(ThanksBALL) 시스템**: 글 읽은 사람이 글쓴이에게 감사 볼을 던지는 기능 (유튜브 슈퍼챗 유사). 1볼 = $1 기준, 향후 실결제 연동 전제 설계.
  - **데이터 구조**:
    - `posts/{postId}/thanksBalls/{id}`: 개별 땡스볼 기록 (`sender`, `senderId`, `amount`, `message`, `createdAt`, `isPaid: false`)
    - `posts/{postId}.thanksballTotal`: Firestore `increment`로 누적 합산
    - `notifications/{recipientNickname}/items/{id}`: 수신자 알림 (`type: 'thanksball'`, `fromNickname`, `amount`, `message`, `postId`, `postTitle`, `read: false`)
    - `sentBalls/{senderNickname}/items/{id}`: 발신자 전송 내역 (`postId`, `postTitle`, `postAuthor`, `amount`, `message`, `createdAt`)
  - **UI — ThanksballModal**: 볼 프리셋(1/2/3/5/10) + 직접 입력 + 티어 표시(베이직~프리미엄) + 응원 메시지(50자). 전송 완료 시 바운스 애니메이션.
  - **UI — RootPostCard 하단 통계 바**: 3-컬럼(`댓글수` | `⚾ 땡스볼 버튼` | `동의/비동의`). 본인 글엔 비활성화. 0볼이면 "땡스볼" 텍스트, 수신 시 "N볼" 숫자 표시.
  - **UI — AnyTalkList 카드**: 하단 우측에 `⚾ N` 표시 (thanksballTotal > 0 인 경우만).
  - **UI — NotificationBell**: 헤더 `+ 새 글` 버튼 우측 배치. 미읽음 수 빨간 뱃지. 드롭다운(최근 20개), 클릭 시 해당 글 이동 + 읽음 처리. "모두 읽음" 일괄 처리(`writeBatch`).
  - **UI — 랭킹(RankingView)**: 사이드바 `랭킹` 메뉴 → 메인탭(좋아요/땡스볼) × 서브탭(유저/글) 4개 뷰. 상위 3위 메달(🥇🥈🥉). 땡스볼 유저 랭킹은 글쓴이별 `thanksballTotal` 합산.
  - **UI — 내정보(MyPage)**:
    - `받은볼` 탭: 내 글별 수신 볼 목록 (thanksballTotal 내림차순)
    - `보낸볼` 탭: `sentBalls` 실시간 구독, 보낸 내역 (수신자·볼수·메시지·시간) 표시
    - `ActivityStats`: 땡스볼 > 0 시 `⚾ N볼` 스탯 카드 추가
    - `ActivityMilestones`: 기록 통계 카드 하단에 `⚾ N볼` 항목 추가
    - `ProfileHeader`: 수신량 기반 배지 (1볼~: 땡스볼 수신 / 10볼~: 블루 기여자 / 30볼~: 골드 기여자 / 100볼~: 프리미엄 기여자)
  - **볼 티어 색상**: 1볼(slate) / 2볼(blue) / 3볼(violet) / 5볼(amber) / 10볼+(rose)
  - **자기 글 제한**: 본인 글엔 땡스볼 버튼 비활성 (`isMyPost` 체크)
  - **미구현(향후)**: 실결제 PG사 연동, 작성자 정산 대시보드, 볼→현금 환전

### 🛠️ 진행 중 / 개선 필요 사항
- [ ] **에디터 보완**: `bubble-menu` 활성화 (텍스트 선택 시 서식 도구 노출).
- [ ] **검색 엔진**: Firestore 텍스트 검색 한계 보완 (현재는 클라이언트 사이드 필터링).
- [ ] **유배·귀양지**: 메뉴에 정의되어 있으나 격리 대상 필터링 미구현.
- [ ] **마켓**: category "마켓" 게시글 작성/판매 플로우 미구현.
- [ ] **Post Discriminated Union** (향후): `Post` 인터페이스 내 카테고리별 Optional 필드를 `BasePost + MyStoryPost | NakedKingPost | ...` Discriminated Union으로 전환. 현 단계 비용 > 효과.
- [ ] **땡스볼 실결제** (향후): PG사 연동, 작성자 정산 대시보드, 볼→현금 환전.

### 📐 아키텍처 결정 기록
- **Submit 로직 중복 없음**: Comment 컴포넌트(7개)는 UI 전담, Firestore 쓰기는 App.tsx `handleCommentSubmit` 단일 함수로 집중. Custom hook 추가 불필요.
- **CATEGORY_RULES 확장 방식**: 카테고리별 동작 변경 시 카테고리명 하드코딩 금지 → `CATEGORY_RULES`에 속성 추가 후 컴포넌트에서 `rule.속성명` 참조. 현재 속성: `allowDisagree`, `allowFormal`, `boardType`, `placeholder`, `tab1/2`, `allowInlineReply`, `hideEmptyMessage`.

---

## 9. Cloudflare R2 & Firebase 규칙 (동일 유지)
- R2: 비ASCII 파일명 금지, `uploads/{userId}/{filename}` 경로.
- Firebase: `post_timestamp_nickname` ID 규칙 준수.
