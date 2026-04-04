# 📜 HALMAL-ITSO 프로젝트 블루프린트 (설계 계약서)

이 문서는 **할말있소(HALMAL-ITSO)** 프로젝트의 설계 원칙, 현재 구현 상태, 그리고 AI 개발자의 **절대적 행동 지침**을 담은 단일 진실 소스(Single Source of Truth)입니다.

> 최종 갱신: 2026-04-04 v31 (코드 실측 기준)  |  현재 브랜치: `main`

---

## 0. AI 개발자 절대 수칙

1. **Strict Focus**: 요구사항과 무관한 기존 코드(특히 Tailwind 레이아웃, 마진, 패딩)는 단 1픽셀도 임의로 수정·삭제하지 않는다.
2. **Surgical Edit**: 파일 전체를 덮어쓰는 방식을 원칙적으로 금지. 오직 필요한 라인만 정밀하게 수술한다.
3. **Strategy Approval (선 보고 후 실행)**: 코드 수정 전 반드시 **AS-IS / TO-BE**를 한국어로 보고하고 승인을 받은 후 실행한다.
4. **Component Decomposition**: 단일 파일이 200라인을 초과하면 UI / 로직 / 타입별로 파일을 분리한다. (과거 거대 파일 리팩토링 완료, 지속적인 모니터링 필요)
5. **No Auto-Generated IDs**: Firestore 자동 ID 사용 금지. `topic_timestamp_uid` 또는 `comment_timestamp_uid` 형태의 맥락 ID를 직접 생성한다.
   - **예외**: `notifications/{uid}/items`, `sentBalls/{uid}/items` — 알림·내역 보조 데이터는 `addDoc` 자동 ID 허용. (UID 기반 경로 — 닉네임 변경에도 안전)

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
| **링크 미리보기** | Cloudflare Workers (자체 OG 파싱) | wrangler 4.76.0 |

### Tiptap 익스텐션 목록
- `@tiptap/starter-kit` — 기본 세트 (bold, italic, strike, heading, list, blockquote, code 등)
- `@tiptap/extension-underline` — 밑줄
- `@tiptap/extension-image` — 이미지 삽입 (R2 업로드 연동)
- `@tiptap/extension-link` — 링크
- `@tiptap/extension-placeholder` — 플레이스홀더
- `@tiptap/extension-text-style` — 인라인 스타일 기반 (Color 등 사용 전제)
- `@tiptap/extension-color` — 글자색 (10색 팔레트, `setColor` / `unsetColor`)
- `@tiptap/extension-highlight` — 배경 하이라이트 (6색, `multicolor: true`)
- `@tiptap/extension-text-align` — 텍스트 정렬 (left/center/right, heading+paragraph)
- *(설치됨/미적용)*: `bubble-menu`, `floating-menu`

---

## 3. 아키텍처

### 3.1 파일 구조

```
/workers                     # Cloudflare Workers 프로젝트 (별도 배포)
├── src/index.ts             # OG 태그 파싱 엔드포인트 (내부 IP 차단, CORS, 100KB 제한)
└── wrangler.toml            # Workers 설정 (name: halmal-link-preview)

/functions                   # Firebase Cloud Functions (Blaze 플랜, Node.js 20, 서울 리전)
├── index.js                 # 마라톤의 전령 뉴스 봇 — 매 30분 스케줄 실행
└── package.json             # 의존성: firebase-admin, firebase-functions, fast-xml-parser

/src
├── App.tsx                  # 루트 컴포넌트 (전역 상태 관리, 라우팅 레이아웃) ~711줄
├── main.tsx                 # 진입점
├── types.ts                 # 공용 인터페이스
├── constants.ts             # 앱 전역 설정 (MENU_MESSAGES, TEST_ACCOUNTS)
├── firebase.ts              # Firebase 초기화
├── s3Client.ts              # R2 S3Client 설정
├── utils.ts                 # 유틸리티 (포맷팅, 라벨링 등)
├── index.css                # 전역 스타일 & 애니메이션
├── hooks/
│   ├── useFirebaseListeners.ts  # Firestore onSnapshot 리스너 전담 custom hook
│   ├── useAuthActions.ts    # 로그인·로그아웃·테스트 계정 전환 핸들러
│   ├── useGloveActions.ts   # 깐부방·커뮤니티 생성/가입/탈퇴 핸들러
│   └── useFirestoreActions.ts   # 게시글·댓글·좋아요·깐부맺기·조회수 핸들러
└── components/              # 핵심 컴포넌트
    ├── Sidebar.tsx          # 좌측 네비게이션
    ├── SubNavbar.tsx        # 홈 전용 탭 필터
    ├── CategoryHeader.tsx   # 카테고리별 헤더
    ├── AnyTalkList.tsx      # 메인 그리드 목록 (이미지 추출 로직 포함)
    ├── PostCard.tsx         # 공통 포스트 카드 컴포넌트
    ├── PostDetailModal.tsx  # 포스트 오버레이 상세 모달
    ├── DiscussionView.tsx   # 일반글 상세 뷰 (2컬럼 레이아웃, CATEGORY_RULES 정의)
    ├── FormalBoard.tsx      # 동의/비동의 정식 연계글 2컬럼 보드 (deprecated — 현재 활성 카테고리 미사용)
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
    ├── OneCutCommentBoard.tsx # 한컷 댓글 보드 — 작성자(좌) ↔ 독자(우) 지그재그, 핀·땡스볼 독자댓글에만
    ├── OneCutListSidebar.tsx # OneCutDetailView 우측 한컷 목록 사이드바
    ├── EditorToolbar.tsx    # TiptapEditor 툴바 버튼 UI
    ├── TiptapEditor.tsx     # 리치 에디터 (스티키 툴바)
    ├── CreateMyStory.tsx    # 너와 나의 이야기 작성 폼 (mood 선택)
    ├── CreateNakedKing.tsx  # 판도라의 상자 작성 폼 (2단 구조: 검증 대상 + 팩트체크 결과, verdict 배지, claimSource/claimLinkUrl/factCheckSources[])
    ├── CreateDebate.tsx     # 솔로몬의 재판 작성 폼 (debatePosition 찬/반/중립, 연계글 모드: [연계글] prefix + 원본글 표시)
    ├── CreateKnowledge.tsx  # 황금알을 낳는 거위 작성 폼 (infoFields 분야 칩 최대 2개, tags[0]/[1] 자동 동기화)
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
    ├── RankingView.tsx      # 랭킹 페이지 (좋아요·땡스볼·조회수 × 유저·글 6개 뷰)
    ├── LinkPreviewCard.tsx  # 링크 OG 미리보기 카드 (EditorToolbar에서 사용, OgData 타입 export)
    ├── GloveNavBar.tsx      # 우리들의 장갑 서브 탭 [소곤소곤|장갑찾기] + 장갑만들기 버튼 (헤더 바에 통합됨, 현재 미사용)
    ├── CommunityList.tsx    # 장갑 찾기: 전체 커뮤니티 목록 (카테고리 필터 13종, 가입 버튼)
    ├── MyCommunityList.tsx  # 나의 아늑한 장갑: 가입한 커뮤니티 목록 (탈퇴 버튼) / compact=true 시 사이드바용 소형 리스트
    ├── CommunityFeed.tsx    # 소곤소곤: 가입 커뮤니티 통합 최신글 피드
    ├── CommunityView.tsx    # 개별 커뮤니티 상세 (소곤소곤·멤버·관리 3탭, 공지 고정, 블라인드, 알림 토글) + CommunityPostDetail 인라인 컴포넌트
    ├── CommunityAdminPanel.tsx # 관리 탭 패널 (설정 수정·공지 고정 해제·장갑 폐쇄, thumb/index 전용)
    └── CreateCommunityModal.tsx # 장갑 만들기: 커뮤니티 개설 폼 (Lv3 이상, 가입방식 3종, minLevel, 분야 13종, 색상)
```

### 3.2 상태 관리 (`App.tsx`)

- **실시간 구독**: `onSnapshot`을 통해 `posts`, `comments`, `users` 컬렉션을 실시간으로 감시.
- **Lazy Loading**: `Suspense`와 `lazy`를 사용하여 주요 뷰 컴포넌트를 분리, 초기 로딩 최적화.

### 3.3 Firestore 컬렉션 구조 (C안 — 2026-03-24 마이그레이션 완료)

| 컬렉션 | 용도 | ID 규칙 |
|--------|------|---------|
| `posts` | 루트 글 전용 (카테고리별 게시글) | `topic_timestamp_uid` |
| `comments` | 댓글 전용 (모든 카테고리 통합) | `comment_timestamp_uid` |
| `users` | 사용자 프로필, 레벨, 팔로우 등 | UID 키 + `nickname_닉네임` 키 이중 저장 |
| `kanbu_rooms` | 깐부방 메타데이터 | 자동 ID |
| `kanbu_rooms/{id}/chats` | 깐부방 실시간 채팅 | 자동 ID |
| `communities` | 커뮤니티 메타데이터 (장갑) | `community_timestamp_uid` |
| `community_memberships` | 커뮤니티 멤버십 플랫 컬렉션 (userId 역조회용) | `{communityId}_{userId}` |
| `community_posts` | 커뮤니티 게시글 (크로스-커뮤니티 피드 쿼리 가능) | `cpost_timestamp_uid` |
| `community_post_comments` | 커뮤니티 글 댓글 | `cpcomment_timestamp_uid` |
| `notifications/{uid}/items` | 땡스볼·알림 수신 내역 (UID 기반) | `addDoc` 자동 ID |
| `sentBalls/{uid}/items` | 땡스볼 발신 내역 (UID 기반) | `addDoc` 자동 ID |

- **commentCount 비정규화**: 댓글 작성 시 `posts/{postId}` 문서에 `increment(1)` 누적 → 홈 피드 쿼리에서 Firestore 읽기 비용 절감.
- **per-topic 구독**: `selectedTopic` 변경 시에만 `comments` where `rootId == selectedTopic.id` 구독 (전체 구독 비용 절감).
- **MyPage 댓글 조회**: `comments` where `author_id == userData.uid` 별도 구독.

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
  factChecked?: boolean;      // 판도라의 상자: 사실 확인 여부 (레거시)
  debatePosition?: 'pro' | 'con' | 'neutral'; // 솔로몬의 재판: 초기 입장
  location?: string;          // 마법 수정 구슬: 발생 지역
  infoPrice?: number;         // 황금알을 낳는 거위: 정보 가치(포인트, 레거시)
  infoFields?: string[];      // 황금알을 낳는 거위: 정보 분야 최대 2개 (주식·코인·부동산 등)
  bgColor?: string;           // 신포도와 여우: 배경색

  // 판도라의 상자 전용 필드 (2026-03-24 추가)
  claimSource?: string;       // 주장 출처: 언론사/인물/단체명
  claimLinkUrl?: string;      // 주장 출처 링크 URL
  verdict?: 'fact' | 'false' | 'uncertain'; // 작성자 판정 (사실/허위/미정)
  factCheckResult?: string;   // 팩트체크 결과 내용
  factCheckSources?: string[]; // 팩트체크 출처 링크 목록 (복수)
  commentsLocked?: boolean;   // 작성자가 댓글 기능 잠금

  // 한컷 / 연계글 관련 필드
  isOneCut?: boolean;         // 한컷 게시물 여부
  linkedPostId?: string;      // 연계된 원본 게시글 ID
  linkedPostTitle?: string;   // 연계된 원본 게시글 제목 (솔로몬 연계글 작성 시 저장, 상세글 바로가기에 사용)

  // 깐부방 관련 필드
  kanbuRoomId?: string;       // 소속 깐부방 ID

  // 댓글 고정 (너와 나의 이야기 등)
  pinnedCommentId?: string;   // 작성자가 고정한 댓글 ID

  // 땡스볼
  thanksballTotal?: number;   // 받은 총 볼 수 (누적, Firestore increment)

  // 조회수
  viewCount?: number;         // 타인이 열람한 횟수 (자기 글 제외, 세션 내 중복 방지)
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
| `naked_king` | 판도라의 상자 | 판도라의 상자 | 지그재그 댓글 보드 (동의/반박 인라인 입력, 핀 고정, boardType: pandora) |
| `donkey_ears` | 솔로몬의 재판 | 솔로몬의 재판 | 동의/비동의 지그재그 pandora 댓글 보드 + 연계글 팝업(CreateDebate). boardType: pandora |
| `knowledge_seller` | 황금알을 낳는 거위 | 황금알을 낳는 거위 | Q&A 보드 (구: 지식 소매상 → migrate 완료) |
| `bone_hitting` | 신포도와 여우 | 신포도와 여우 | 명언, 짧은 글 (구: 뼈때리는 글 → migrate 완료) |
| `local_news` | 마법 수정 구슬 | 마법 수정 구슬 | 정보 공유 보드 (구: 현지 소식 → migrate 완료) |
| `friends` | 깐부 맺기 | (UI 전용) | 팔로우 추천 목록 (허용 닉네임 필터 적용) |
| `kanbu_room` | 깐부방 | (subcollection) | 깐부가 개설한 방 목록, 방별 게시판+실시간 채팅. Lv3 이상 개설. Firestore: `kanbu_rooms/{roomId}/chats` |
| `glove` | 우리들의 장갑 | (커뮤니티) | 다섯 손가락 운영 체제 (thumb·index·middle·ring·pinky). 가입방식 3종(open·approval·password), minLevel 제한, 공지 고정, 알림 opt-in, 중지 자동 산정. 자세한 내용 → `GLOVE.md` |
| `marathon_herald` | 마라톤의 전령 | 마라톤의 전령 | 뉴스 속보 봇 전용 채널. 속보 키워드(속보·긴급·단독·사망·화재·폭발·지진 등 29개) 포함 기사만 Firestore 저장. `newsType: 'breaking'`→🚨 속보(빨간 pulse 배지). 좋아요 임계값 없이 즉시 노출. 홈 새글 피드에도 포함. 댓글: pandora 공감/의심 2컬럼. 원본 기사 `linkUrl` → RootPostCard [🔗 바로가기] 버튼. Cloud Functions 매 30분 자동 등록. |
| `market` | 마켓 | 마켓 | OneCutList 그리드 레이아웃, 게시글 없을 시 "기록된 글이 없어요" |
| `exile_place` | 유배·귀양지 | 유배·귀양지 | 제재 유저 전용 소통 공간, 주제 없음 |
| `ranking` | 랭킹 | (UI 전용) | 좋아요·땡스볼·조회수 × 유저·글 6개 뷰. `RankingView.tsx`. 사이드바 내정보 위 배치. |

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
- **OneCutDetailView 내부 구조**: ① 상단 헤더(← 한컷/경과시간/공유/수정) → ② 제목 → ③ 원본글 바로가기(linkedPostId or linkUrl) → ④ 이미지(2/3 너비) → ⑤ 본문 텍스트 → ⑥ 태그 → ⑦ 작성자 인터랙션 바(RootPostCard 스타일: 좋아요/땡스볼/깐부) → ⑧ 댓글 목록(pandora 좌우 지그재그) → ⑨ 댓글 입력(pandora 버튼 클릭 → 입력창).

### 7.2 리스트 뷰 (`AnyTalkList`)
- **가변 그리드**: `minmax(280px, 1fr)` 기반 `auto-fill`, 카드 간격 `gap-2`.
- **이미지 자동 추출**: 본문 HTML 내 첫 번째 `<img>` 태그를 찾아 썸네일로 활용.
- **카드 디자인**: `rounded-xl px-3.5 py-2.5`, 호버 시 `border-blue-400` 및 그림자 효과.
- **본문 렌더링**: `dangerouslySetInnerHTML`로 HTML 원본 그대로 렌더링 (줄바꿈·굵기·기울임 유지). 카드 내 이미지는 `[&_img]:hidden`으로 숨김. 3가지 케이스:
  - 글만 있음: `line-clamp-7`
  - 이미지 + 글: `line-clamp-3` + 썸네일
  - 내용 없음: 본문 영역 미렌더링
- **카드 우측 상단 지표**:
  - `tab === 'any'` (새글 탭): 하트 3개 표시. `promoLevel = Math.min(post.likes, 3)` 기준으로 채워진 하트 수 결정 (0개이면 전부 빈 하트). `text-rose-400 fill-current` (채움) vs `text-slate-100 fill-none` (빈 하트).
  - 그 외 탭 / 카테고리 뷰: Lv5 이상 유저가 좋아요를 누른 수(`goldStarCount`) > 0 일 때만 금색 별(⭐) + 숫자 표시. `text-amber-400 fill-current`. 0이면 아무것도 표시하지 않음.

### 7.3 한컷 시스템 (`OneCut`)
- **비율**: 9:16 세로형 이미지 최적화 (`aspect-[9/16]`).
- **연결**: 일반 게시글과 한컷을 `linkedPostId`로 상호 연결하여 이동 지원.

---

## 8. 현재 구현 상태 (2026-03-24 기준, 코드 실측)

### ✅ 완료된 핵심 기능 (2026-03-25 갱신)
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
    - `notifications/{recipientUid}/items/{id}`: 수신자 알림 (UID 기반 경로, `type: 'thanksball'`, `fromNickname`, `amount`, `message`, `postId`, `postTitle`, `read: false`)
    - `sentBalls/{senderUid}/items/{id}`: 발신자 전송 내역 (UID 기반 경로, `postId`, `postTitle`, `postAuthor`, `amount`, `message`, `createdAt`)
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

- [x] **비로그인 댓글 가드**: 로그인하지 않은 상태에서 댓글 입력창에 접근 시 "댓글을 작성하려면 로그인이 필요합니다." 안내 표시. 처리 위치 2곳:
  - `DiscussionView.tsx`: `currentNickname` 없으면 CommentForm 대신 자물쇠 아이콘 + 안내 배너 렌더링.
  - `DebateBoard.tsx`: `allowInlineReply` 카테고리(너와 나의 이야기 등)에서 비로그인 시 하단 입력 영역을 안내 텍스트로 대체. `openInline()` 함수 진입 시 `!currentNickname` 이면 즉시 리턴(답글 버튼 클릭 무반응).
- [x] **에디터 기능 확장 (EditorToolbar / TiptapEditor)**:
  - 신규 패키지: `@tiptap/extension-color`, `@tiptap/extension-text-style`, `@tiptap/extension-highlight`, `@tiptap/extension-text-align`.
  - **글자색**: 10색 팔레트 드롭다운. 현재 적용 색상이 'A' 아이콘 하단 컬러바로 실시간 표시. "색 제거" 버튼 포함.
  - **배경 하이라이트**: 6색 팔레트 드롭다운. "제거" 버튼 포함. `multicolor: true` 설정으로 중복 적용 지원.
  - **텍스트 정렬**: 왼쪽 / 가운데 / 오른쪽 3버튼. `TextAlign.configure({ types: ['heading', 'paragraph'] })`.
  - **링크 삽입**: 클릭 시 URL 입력 프롬프트. 빈 값 입력 시 링크 해제.
  - 외부 클릭 시 색상 팔레트 자동 닫힘 (`useEffect` + `mousedown` 이벤트).
- [x] **상세글 본문 HTML 렌더링 수정**: `prose prose-slate` 클래스 제거 (`@tailwindcss/typography` 미설치로 무효). Tailwind arbitrary selector(`[&_p]:mb-4`, `[&_strong]:font-bold`, `[&_em]:italic`, `[&_ul]:list-disc` 등)로 교체. 줄바꿈·굵기·기울임·목록·인용구·제목 정상 표시. 적용 위치: `RootPostCard.tsx`, `PostDetailModal.tsx`.
- [x] **상세글 섹션 간격 축소**: 본문↔댓글폼↔댓글목록 간 여백 대폭 축소. `PostCommentForm` `py-8→py-3`, `DebateBoard` `mt-4→mt-0 py-4→py-3`, `RootPostCard` `mb-4→mb-0`.
- [x] **AnyTalkList 카드 UI 개선**: 모서리 `rounded-[2rem]→rounded-xl`, 패딩 축소, 카드 간격 `gap-4→gap-2`. 본문 `stripHtml` 제거 → `dangerouslySetInnerHTML`로 교체 (서식 보존).
- [x] **메뉴 설명문 전면 개정** (constants.ts): 너와 나의 이야기, 솔로몬의 재판, 황금알을 낳는 거위, 신포도와 여우, 유배·귀양지, 한컷 설명 문구 업데이트. 마켓 메뉴 추가.
- [x] **너와 나의 이야기 새글 작성 폼 개선 (CreateMyStory.tsx)**:
  - 헤더 타이틀: "새 글 기록" → "새 글 작성".
  - 오늘의 기분 선택 시 `tags[0]`에 자동 반영 (예: `😊행복`). 기분 해제 시 auto-set 태그도 함께 제거. 사용자가 직접 수정한 tags[0]은 보호.
  - 오늘의 기분 이모지 제거 (행복/슬픔 등 단어만 표시).
- [x] **등록글 더보기 서식 표시 수정 (RelatedPostsSidebar.tsx)**: `stripHtml` 제거 → `dangerouslySetInnerHTML` + `[&_img]:hidden`으로 교체. 줄바꿈·굵기·기울임 정상 표시.
- [x] **랭킹 유저 중복 표시 수정 (RankingView.tsx)**: `allUsers`가 UID 키·닉네임 키 양쪽으로 동일 유저 등록되는 구조로 인해 같은 유저가 2회 표시되던 버그 수정. `Set<string>`으로 닉네임 기준 중복 제거 후 정렬.
- [x] **땡스볼 글작성자→댓글작성자 전송 기능 확장**:
  - `ThanksballModal`: `recipientNickname?`, `targetDocId?`, `targetCollection?` props 추가. `docCollection = targetCollection || 'posts'`, `docId = targetDocId || postId` 로 comments/posts 자동 분기. `isCommentMode` 판별 후 `sentBalls·notifications` 기록에 `commentId` 필드 추가.
  - `thanksballTotal` 카운터 업데이트: 트랜잭션 내 `tx.set({merge:true})` 대신 트랜잭션 외 `updateDoc()` 분리 호출 (onSnapshot 반영 안정성 확보).
  - `PostCard`: `onThanksball?: (post: Post) => void` prop 추가. 카운트(`⚾ N`)는 모든 사용자에게 표시 (기존: 글작성자만). 전송 버튼은 `isRootAuthor && !isMyPost && onThanksball` 조건.
  - `DebateBoard`: `thanksballTarget` 상태 추가. `renderThreadMyStory` PostCard에 `onThanksball` 콜백 전달. single·pandora 레이아웃 하단에 `ThanksballModal` 렌더링. **버그 수정**: single 레이아웃 ThanksballModal에 `targetCollection={thanksballTarget.col}` prop 누락 → 댓글 카운트 미반영 문제 해결.
  - `DebateBoard` pandora 레이아웃: 지그재그 카드에 땡스볼 카운트·전송 버튼 인라인 표시.
- [x] **Firestore Security Rules 구축 및 보안 정책 수립** (`firestore.rules` + `firebase.json`):
  - 기존: `firestore.rules` 파일 없음 → 모든 `comments` 쓰기 권한 없어 댓글·좋아요 전부 차단.
  - 현재 규칙: posts·comments·kanbu_rooms·communities·community_posts는 `allow read: if true` (공개), `allow write: if request.auth != null`. community_memberships는 `allow read, write: if request.auth != null`. users·notifications·sentBalls는 `allow read, write: if request.auth != null` (보호).
  - **2026-03-28 추가**: communities·community_memberships·community_posts 규칙 누락으로 기본 deny 적용 → 커뮤니티 생성/가입/읽기 전체 차단 버그 수정.
- [x] **Firebase Auth 타이밍 버그 수정** (`useFirebaseListeners.ts`):
  - 문제: 앱 마운트 시 `onAuthStateChanged` 해결 전에 onSnapshot 구독 시작 → `request.auth = null` → "Missing or insufficient permissions" 에러로 posts·users·kanbu_rooms 구독 전체 침묵 실패.
  - 해결: kanbu_rooms·posts·users 구독을 `setupCollectionSubs()` 함수로 묶어 `onAuthStateChanged(user)` 콜백 내부에서만 1회 호출. `if (unsubRooms) return` 가드로 중복 구독 방지.
- [x] **에러 가시성 강화**:
  - `handleInlineReply`, `handleCommentSubmit` (App.tsx): try-catch 추가, 실패 시 `alert()`로 에러 메시지 표시. `handleCommentSubmit`은 `finally`로 `setIsSubmitting(false)` 보장.
  - `submitInline` (DebateBoard.tsx): try-catch + finally 추가.
  - 모든 `onSnapshot` 호출에 에러 콜백(`(err) => console.error(...)`) 추가.
- [x] **조회수(viewCount) 시스템 추가**:
  - `Post.viewCount?: number` 타입 추가 (`types.ts`).
  - `App.tsx` `handleViewPost()`: 게시글 열람 시 자기 글 제외 + `sessionStorage` 세션 내 중복 방지 후 Firestore `increment(1)`.
  - `RankingView.tsx` 조회수 탭(`👁 조회수`) 추가: 메인탭 3개(좋아요·땡스볼·조회수) × 서브탭 2개(유저·글) = 6개 뷰. 유저 랭킹은 글쓴이별 `viewCount` 합산. 표시: `👁 N회` (파란색).
  - 향후 레벨·평판 로직에 활용 가능한 확장 설계.

- [x] **링크 미리보기 (Cloudflare Workers)**:
  - Firebase Spark 플랜(무료) 제약으로 Cloud Functions 대신 Cloudflare Workers 사용.
  - 엔드포인트: `https://halmal-link-preview.mirr0505.workers.dev?url=<URL>`
  - OG 태그(`og:title`, `og:description`, `og:image`, `og:site_name`) + Twitter Card + `<title>` 파싱. 외부 라이브러리 없음.
  - 보안: http/https 프로토콜 검증, 내부 IP 대역 차단, 6초 타임아웃, 응답 100KB 제한, CORS 허용 도메인 화이트리스트.
  - 무료 한도: 10만 회/일.
  - `TiptapEditor.tsx`: 미리보기 상태(`preview`, `previewLoading`) 및 `fetchPreview` 관리. `LinkPreviewCard` 렌더링 담당.
  - `TiptapEditor.tsx` `handlePaste`: URL 패턴(`/^https?:\/\/[^\s]{4,}$/`) 감지 → `fetchPreview` 자동 호출. 링크 버튼 + 붙여넣기 두 가지 트리거 지원.
  - `EditorToolbar.tsx`: `onLinkInserted?(url)` 콜백 prop — 링크 삽입 후 부모(`TiptapEditor`)에 URL 전달.
  - `LinkPreviewCard.tsx`: 로딩 스켈레톤 + 이미지/제목/설명/사이트명 카드 UI. X 버튼으로 닫기.

- [x] **특정 깐부 글 필터 + 작가 피드 보기**:
  - **A — 깐부글 탭 아바타 칩**: `activeTab === 'friend'` 진입 시 탭 목록 상단에 깐부 아바타 칩 가로 스크롤 표시. "전체" 칩 + 팔로우 중인 깐부별 칩. 선택 시 해당 깐부 글만 필터(기존 좋아요 3개 이상 조건 유지). 재클릭 시 전체 해제.
  - **C — 글카드 작가 클릭 피드**: 글카드 하단 아바타·닉네임 클릭 시 해당 유저의 모든 글 피드 표시. 상단에 "닉네임의 글 (N)" 헤더 + X 닫기. X 또는 탭/메뉴 전환 시 자동 해제.
  - App.tsx: `selectedFriend`(string|null), `viewingAuthor`(string|null) 상태 추가. `useEffect`로 activeMenu/activeTab 변경 시 자동 초기화.
  - AnyTalkList.tsx: `onAuthorClick?: (author: string) => void` prop 추가. 작가 영역에 `e.stopPropagation()` 적용(카드 클릭과 분리).

- [x] **판도라의 상자 댓글 구조 전면 개편**:
  - `CATEGORY_RULES`: boardType `'factcheck'` → `'pandora'` 신규 타입. 탭 레이블 진실/거짓 → **동의/반박** 통일.
  - **지그재그 레이아웃**: 시간순(오름차순) 정렬, 동의(left)=왼쪽 정렬 파란색 계열(`bg-blue-50`), 반박(right)=오른쪽 정렬 붉은색 계열(`bg-rose-50`). 카드 폭 84%, 대댓글 없는 단층 구조.
  - **인라인 입력**: `[동의 의견 달기...]` `[반박 의견 달기...]` 버튼 클릭 → 진영 색상 인라인 input → Enter 제출. CommentNakedKing 폼 미렌더링(DiscussionView 조건 추가).
  - **작성자 고정 댓글**: 글 작성자에게만 핀 버튼 노출. 고정 시 상단 정렬 + 앰버색 하이라이트 + "작성자가 고정한 댓글" 배지.
  - `App.tsx` `handleInlineReply`: `side?: 'left' | 'right'` 파라미터 추가 (기본값 'left').
  - `DebateBoard.tsx` Props `onInlineReply` 시그니처도 동일하게 업데이트.

- [x] **판도라의 상자 댓글 카드 UX 고도화 (2026-03-24)**:
  - **카드 헤더**: 아바타(w-7 h-7) + 작성자명 + 시간(작성자 옆) + Lv/평판/깐부 — PostCard 스타일로 통일.
  - **이미지/링크 첨부**: 동의·반박 입력 폼에 📷(R2 이미지 업로드) + 🔗(링크 입력) 버튼 추가. 클립보드 이미지 붙여넣기(`onPaste`) 지원. 첨부 이미지 미리보기(52px 정사각형). 링크는 `normUrl()`으로 프로토콜 자동 추가(`https://`).
  - **링크 클릭 이동**: 댓글 카드 내 링크에 `stopPropagation` 적용하여 카드 클릭 이벤트와 분리. `target="_blank" rel="noopener noreferrer"` 처리.
  - **댓글 잠금**: 글 작성자에게 헤더 우측 잠금 버튼 노출. 잠금 시 동의/반박 입력 영역 대신 "작성자가 댓글 기능을 잠궜습니다" 표시. `Post.commentsLocked` Firestore 필드 활용. `handleToggleLock()` → `updateDoc` 토글.
  - **통계 중복 제거**: `RootPostCard` 하단 통계 바에서 `boardType === 'pandora'`인 경우 동의/반박 수 숨김 (DebateBoard 헤더에서 이미 표시).
  - **댓글 데이터 라우팅**: `handleLike`, `PostCard.handleDelete` — `rootId` 유무로 `comments` vs `posts` 컬렉션 자동 분기.

- [x] **판도라의 상자 새글 폼 전면 개편 — CreateNakedKing.tsx (2026-03-24)**:
  - **2단 구조**:
    - 섹션 1 "검증 대상": TiptapEditor(리치 에디터) + 출처(claimSource) + 출처 링크(claimLinkUrl).
    - 섹션 2 "팩트체크 결과" (선택 사항): 판정 배지(✅사실/❌허위/🔍미정) + 결과 textarea(rows=10) + 복수 출처 링크(factCheckSources[]).
  - **판정 배지 토글**: 선택 시 색상 강조(emerald/rose/slate). 재클릭 시 해제.
  - **복수 출처 링크**: `addFactCheckSource` / `removeFactCheckSource` / `updateFactCheckSource` 함수. "링크 추가" 버튼으로 항목 추가, × 버튼으로 개별 삭제(2개 이상일 때).
  - **TiptapEditor `placeholder` prop**: 에디터 컴포넌트에 `placeholder?: string` prop 추가. 판도라 폼에서 "검증하고 싶은 대상 내용을 입력하세요" 전달. 미전달 시 기본 placeholder 유지.
  - **가독성 개선**: 레이블·힌트·placeholder 색상 `slate-300→400`, `slate-200→300` 한 단계 진하게.
  - **기존 데이터 정리**: `scripts/cleanup-pandora.mjs` 스크립트로 구 판도라/벌거벗은임금님 루트 글 및 posts 컬렉션 내 구 댓글 일괄 삭제(writeBatch 500건 chunk 분할).

- [x] **판도라의 상자 목록 카드 verdict 배지 (2026-03-24)**:
  - `AnyTalkList.tsx` 카드 하단 카테고리 배지 옆에 판정 배지 추가.
  - `verdict === 'fact'` → `✅ 사실` (emerald), `'false'` → `❌ 허위` (rose), `'uncertain'` → `🔍 미정` (slate).
  - verdict 없는 글(다른 카테고리 포함)에는 표시 안 함.

- [x] **C안 아키텍처 — posts + comments 컬렉션 분리 (2026-03-24)**:
  - **Before**: 단일 `posts` 컬렉션 (루트 글 + 댓글 혼재, `rootId` 유무로 구분).
  - **After**: `posts`(루트 글 전용) + `comments`(댓글 전용) 컬렉션 분리.
  - `commentCount` 비정규화: 댓글 작성/삭제 시 `posts/{id}.commentCount` `increment(±1)`.
  - App.tsx: per-topic useEffect — `selectedTopic` 변경 시에만 comments 구독. MyPage용 별도 comments useEffect (`author_id` 기준).
  - `useFirebaseListeners.ts`: posts 리스너만 유지 (allRootPosts). allChildPosts 전역 리스너 제거.
  - `handleLike`, `PostCard.handleDelete`: `rootId` 유무로 컬렉션 자동 분기.

- [x] **SNS 공유 OG 태그 및 브랜딩 (2026-03-25)**:
  - `index.html`: 타이틀·og:title·og:site_name·twitter:title 전면 변경 → **"GLove - 글러브, 집단지성의 힘"** (기존: "할말있소 — 집단지성의 힘")
  - og:image: GLove 로고 이미지(`og-image.jpg`, 243KB)를 `public/` 폴더에 배치 → Firebase Hosting에서 직접 서빙(`https://halmal-itso.web.app/og-image.jpg`). R2 경유 시 카카오 크롤러 접근 불가 이슈 해결.
  - 카카오톡 OG 캐시 초기화 후 이미지·타이틀 정상 표시 확인.

- [x] **게시글 URL OG 미리보기 개선 (2026-03-25)**:
  - `RootPostCard.tsx`: `post.linkUrl`이 없는 기존 게시글도 본문 HTML에서 첫 번째 `<a href="http...">` 추출(`DOMParser`)해 OG fetch → 미리보기 카드 표시. `contentLinkUrl` 상태로 관리.
  - OG fetch 트리거: `post.linkUrl` 우선 → 없으면 `contentLinkUrl` fallback (두 useEffect 분리).
  - 본문 `<a>` 태그 스타일: 이미 `[&_a]:text-blue-400 [&_a]:underline` 적용 중 (기존 구현 확인).
  - `TiptapEditor.tsx`: 글 작성 시 URL 붙여넣기 미리보기 카드 위치 변경 — 툴바 아래(에디터 위) → **에디터 본문 아래**로 이동.

- [x] **솔로몬의 재판 pandora 전환 + 연계글 팝업 (2026-03-25)**:
  - `CATEGORY_RULES`: boardType `'debate'` → `'pandora'`, tab2 "반대" → "비동의", `allowInlineReply: true`, `hintAgree/hintRefute/placeholderAgree/placeholderRefute` 추가.
  - `DebateBoard.tsx`: pandora 레이아웃 하단에 **연계글 버튼** 추가 (솔로몬 카테고리 한정). "동의 연계글 작성..." / "비동의 연계글 작성..." 버튼 → `onOpenLinkedPost(side)` 호출.
  - `CreateDebate.tsx`: `linkedTitle?: string`, `linkedSide?: 'left'|'right'` prop 추가. 제목 readOnly + 입장 자동설정(left→pro, right→con). 헤더 "연계글 작성" 라벨.
  - `App.tsx`: `linkedPostSide` 상태 + `handleLinkedPostSubmit` (연계글 등록 후 원글로 복귀, 홈 이동 안 함) + `CreateDebate` lazy import 추가.
  - `DiscussionView.tsx`: `onOpenLinkedPost` prop 체인 추가 → `DebateBoard`에 전달.

- [x] **구버전 backward compat 용어 전면 제거 (2026-03-25)**:
  - `CATEGORY_COMMENT_MAP` / `CATEGORY_RULES`에서 삭제: `나의 이야기`, `임금님 귀는 당나귀 귀`, `벌거벗은 임금님`, `뼈때리는 글`, `지식 소매상`, `현지 소식`.
  - 기본값 fallback `"나의 이야기"` → `"너와 나의 이야기"` (DiscussionView, DebateBoard).
  - App.tsx myStory 배열 / 카테고리 필터에서 `나의 이야기` 제거.
  - DebateBoard `'뼈때리는 글'` 조건 제거.
  - CommentForm 제외 목록에서 `나의 이야기`, `뼈때리는 글` 제거.

- [x] **판도라의 상자 CategoryHeader 설명 업데이트 (2026-03-25)**:
  - `constants.ts` `naked_king.description`: "사회 전반 퍼져 있는...사실 확인" → **"정치, 역사, 사회, 문화, 종교, 교육, 군사, 체육 등 사회 전반 이슈에 대한 거침없는 진실 공개 및 사실 확인"**.

- [x] **황금알을 낳는 거위 분야 선택 시스템 (2026-03-25)**:
  - `CreateKnowledge.tsx`: 정보 가치(🪙 포인트 입력) 섹션 제거 → **분야 칩 선택** UI로 교체.
  - `INFO_FIELDS` 상수: `['주식', '코인', '부동산', '경제', '경영', '정책', '세금', '창업', '재테크', '글로벌']` 10개.
  - 최대 2개 선택 가능. 선택된 분야는 `tags[0]`/`tags[1]`에 자동 입력 (나머지 `tags[2]~[4]`는 직접 입력).
  - `Post.infoFields?: string[]` 신규 필드 (`types.ts` 추가).
  - **배지 표시**: `AnyTalkList` 카드 하단 카테고리 배지 옆 + `RootPostCard` 제목 아래에 `🪙 분야명` 배지 표시.

- [x] **솔로몬의 재판 연계글 원본글 바로가기 (2026-03-25)**:
  - `Post.linkedPostTitle?: string` 신규 필드 — 연계글 작성 시 원본글 제목 저장.
  - `CreateDebate.tsx`: 연계글 모드에서 `[연계글]` **고정 prefix** + 사용자가 제목 직접 입력 가능. 제출 시 `"[연계글] " + 입력값`으로 합산. 입장 선택 아래 원본글 제목 표시 섹션 추가.
  - `App.tsx`: `CreateDebate` 연계글 모드에 `originalPost={selectedTopic}` 전달 → `linkedPostId` / `linkedPostTitle` Firestore 저장.
  - `RootPostCard.tsx`: `onNavigateToPost?: (postId: string) => void` prop 추가. `linkedPostId && linkedPostTitle` 있으면 **"🔗 원본글: [제목]"** 버튼 + `debatePosition` 배지(`👍 동의` / `👎 비동의` / `🤝 중립`) 표시.
  - `DiscussionView.tsx`: `onNavigateToPost` prop 체인 추가 → RootPostCard로 전달.
  - `App.tsx`: `onNavigateToPost` 핸들러 — `allRootPosts`에서 postId로 글 찾아 `handleViewPost` 호출.

- [x] **연계글 동의/비동의 배지 — 게시글 목록 카드 (2026-03-25)**:
  - `AnyTalkList.tsx`: `post.linkedPostId && post.debatePosition`이 있는 연계글에 카테고리 배지 옆에 `👍 동의` / `👎 비동의` / `🤝 중립` 배지 표시.

- [x] **한컷 댓글 구조 업그레이드 — 작성자(좌) ↔ 독자(우) 지그재그 (2026-03-25)**:
  - **신규 컴포넌트 `OneCutCommentBoard.tsx`**: DebateBoard 대체. 한컷 전용 채팅형 지그재그 레이아웃.
  - **side 자동 결정**: `currentNickname === rootPost.author` → `'left'`(작성자), 그 외 → `'right'`(독자). 투표 선택 UI 제거.
  - **좌측 (작성자)**: 파란 배경(`bg-blue-50`), "작성자" 배지, 왼쪽 정렬 텍스트.
  - **우측 (독자)**: 슬레이트 배경(`bg-slate-50`), 오른쪽 정렬 텍스트.
  - **핀 고정**: 작성자만 가능 + **독자 댓글(우)에만** 핀 버튼 노출. 고정 시 앰버 하이라이트.
  - **땡스볼**: 작성자만 발송 가능 + **독자 댓글(우)에만** ⚾ 버튼 노출. `ThanksballModal` `targetCollection="comments"` 연동.
  - **대댓글**: **독자 → 작성자 댓글**에만 "답글" 버튼. 인라인 input + Enter 제출(IME isComposing 체크). 대댓글은 우측 정렬 서브카드로 표시.
  - **입력 폼**: 작성자는 좌측 textarea + "✍ 작성자 코멘트", 독자는 우측 textarea + "💬 독자 댓글". Enter(Shift+Enter 제외) 단축 제출.
  - `OneCutDetailView.tsx`: Props에서 `handleSubmit`/`selectedSide`/`setSelectedSide`/`newContent`/`setNewContent`/`isSubmitting` 제거 → `onInlineReply` 추가.
  - `App.tsx`: OneCutDetailView 호출부 props 정리 — `handleInlineReply` 연결.

- [x] **우리들의 장갑 — 커뮤니티 시스템 (2026-03-25 초기, 2026-03-28 UI개편, 다섯 손가락 Phase 1~5 완료)**:
  > 📌 상세 설계 문서 → `GLOVE.md` (별도 추출)
  - **핵심 변경 요약**: Firestore 컬렉션 4종, 다섯 손가락 역할 체계(thumb·index·middle·ring·pinky), 가입방식 3종(open·approval·password), minLevel 제한, 공지 고정, 블라인드, 알림 opt-in, 중지 자동 산정 구현 완료.
  - **CommunityView 3탭**: 💬 소곤소곤 (글 목록+작성) · 🤝 멤버 (활성 멤버+역할 변경+강퇴) · ⚙️ 관리 (thumb/index 전용, CommunityAdminPanel)
  - **Firestore Rules**: `community_memberships` 쓰기 — 본인 문서 + `finger·joinStatus·banReason` 필드 허용 (역할 기반 세분화)

- [x] **모바일 반응형 UI (2026-03-28)**:
  - **헤더**: `h-[56px] md:h-[64px]`. Dev 버튼·검색창 `hidden md:flex`. 모바일 우측 햄버거 버튼(☰) 추가.
  - **모바일 드로어 메뉴**: 햄버거 클릭 시 `fixed inset-0 z-[60] md:hidden` 오버레이 + 좌측 슬라이드 Sidebar(`mobile=true`). Sidebar에 `mobile`, `onClose` prop 추가, 모바일 전용 헤더(GLove 로고 + × 닫기버튼) 포함.
  - **하단 네비게이션 바**: `fixed bottom-0 md:hidden h-14` — 홈·새글·알림·내정보·메뉴 5탭. 메인 컨텐츠 하단 여백 `pb-28` 추가.
  - **내정보 로그아웃 버튼**: MyPage 하단에 `onLogout` prop 버튼 추가 → 모바일에서 내정보 탭에서 로그아웃 가능.

- [x] **홈 새 글 2단계 UX (2026-03-28)**:
  - 홈 화면에서 새 글 클릭 → ①카테고리 선택 카드 화면(8개: 너와나의이야기/판도라의상자/솔로몬의재판/황금알/신포도와여우/마법수정구슬/양치기소년/한컷) → ②해당 카테고리 전용 폼.
  - `createMenuKey` 상태(string|null) 추가. `null`이면 카드 선택 UI, 설정되면 `CREATE_MENU_COMPONENTS[createMenuKey]` 전용 폼.
  - 카테고리 메뉴에서 직접 새 글 클릭 시 기존처럼 해당 전용 폼 바로 열림.
  - `goHome()` 및 `handlePostSubmit()` 완료 시 `setCreateMenuKey(null)` 함께 초기화.

- [x] **카카오톡 인앱 브라우저 구글 로그인 차단 대응 (2026-03-28)**:
  - `detectInAppBrowser()`: UA로 카카오톡·인스타그램·페이스북·라인 감지.
  - `openExternalBrowser()`: Android → Chrome intent URL(`intent://...#Intent;scheme=https;package=com.android.chrome;end;`), iOS → 클립보드 복사 + Safari 안내.
  - `handleLogin()` 진입 시 인앱 브라우저 감지 → Android는 confirm 후 Chrome 이동, iOS는 URL 복사 안내 → `signInWithPopup` 시도 전 차단.

- [x] **SNS 공유 OG 설명 문구 변경 (2026-03-28)**:
  - `index.html`: `<meta name="description">`, `og:description`, `twitter:description` 3곳 → **"지금 공유드리는 글을 확인해 보세요. 커뮤니티 플랫폼 글러브에서 다양한 주제글들을 확인하실 수 있습니다."**

- [x] **황금알을 낳는 거위 댓글 2컬럼 구조 (2026-03-28)**:
  - `OneCutCommentBoard.tsx` 기반. 좌=정보취득자(독자, blue), 우=정보제공자(작성자, rose) 2컬럼 지그재그.
  - 세로 구분선(`absolute left-1/2`). 각 컬럼 별도 입력란("정보에 대한 당신의 생각..." / "정보에 대한 부연 설명..."). 버튼: "댓글 입력".
  - 댓글 아바타 헤더: `Lv · 평판 · 깐부 N` (DebateBoard 스타일 통일). 액션버튼(핀·땡스볼) 반대편 끝.

- [x] **상세글 하단 액션 버튼 크기 축소 (2026-03-28)**:
  - `RootPostCard.tsx` 좋아요·땡스볼·깐부맺기 버튼: `px-6 py-2.5 text-[13px]` → `px-3 py-2 text-[12px]` + `whitespace-nowrap`. 모바일에서 "땡스볼" 두 줄 표시 방지.

- [x] **우리들의 장갑 상단 바 헤더 중복 제거 (2026-03-28)**:
  - App.tsx sticky 헤더 + GloveNavBar 내부 타이틀 이중 표시 → GloveNavBar 내부 타이틀 제거.
  - 표시명: "우리들의 따뜻한 장갑" → **"우리들의 장갑"** (GloveNavBar, App.tsx 헤더 바, Sidebar 모두).

- [x] **장갑 카테고리 주식·부동산·코인 추가 (2026-03-28)**:
  - `CommunityList.tsx` `ALL_CATEGORIES`, `CreateCommunityModal.tsx` `CATEGORIES` 모두 앞에 `['주식', '부동산', '코인']` 추가.

- [x] **사이드바 장갑 이모지 opacity 조정 (2026-03-28)**:
  - `Sidebar.tsx`: 비활성 `opacity: 0.35` → `0.20` (SVG 아이콘 `text-slate-300` 명도에 맞춤).

- [x] **다섯 손가락 Phase 1 — 데이터 구조 + 가입 조건 (2026-03-28)**:
  - `types.ts`: `FingerRole`, `JoinType`, `JoinStatus` 타입 추가. `Community`에 `joinType·minLevel·password·joinQuestion·pinnedPostId·notifyMembers` 필드. `CommunityMember`에 `finger·joinStatus·joinMessage·banReason` 필드. `CommunityPost`에 `isPinned·isBlinded` 필드.
  - `CreateCommunityModal`: 공개/비밀 토글 → **가입방식 3종 라디오**(🟢자동승인·🔵승인제·🔒초대코드) + 조건부 입력(초대코드/안내문구) + **Lv1~5 minLevel 셀렉터** + 미리보기 배지.
  - `App.tsx handleCreateCommunity`: `joinType·minLevel·password·joinQuestion` 저장, 멤버십 `finger: 'thumb', joinStatus: 'active'`.
  - `App.tsx handleJoinCommunity`: minLevel 체크, joinType별 분기 (open→즉시가입, approval→pending/pinky, password→코드 확인).
  - `firestore.rules`: `community_memberships` 쓰기 — 본인 문서 OR `finger·joinStatus·banReason` 필드 포함 업데이트 허용.

- [x] **다섯 손가락 Phase 2 — 멤버·관리 탭 + 손가락 배지 (2026-03-28)**:
  - `CommunityView` 탭 3개 구조: 소곤소곤(글 목록) · 멤버 · 관리(thumb/index만).
  - **멤버 탭**: 활성 멤버 목록 + 손가락 배지(FINGER_META 상수) + thumb/index는 역할 변경 드롭다운 + 강퇴 버튼.
  - **관리 탭**: 승인 대기 목록 + 승인/거절 버튼. 탭 레이블에 대기 수 실시간 표시.
  - `handleApprove`: pending→active, finger pinky→ring, memberCount+1. `handleReject`: 멤버십 문서 삭제. `handleBan`: joinStatus: 'banned', memberCount-1.

- [x] **다섯 손가락 Phase 3 — 공지 고정·설정 수정·블라인드·장갑 폐쇄 (2026-03-28)**:
  - `CommunityAdminPanel.tsx` 신규: 승인 대기 처리 + 장갑 설정 수정(이름/설명/색상/분야) + 공지 고정 해제 + 장갑 폐쇄(thumb 전용, 2단계 confirm + writeBatch 멤버십 일괄 삭제).
  - `CommunityView`: 공지 고정 글(pinnedPostId) → 피드 최상단 amber 하이라이트 카드. 글 카드에 📌 핀 버튼 + 🚫 블라인드 버튼(admin만 표시). `isBlinded: true` 글 피드에서 자동 필터.
  - `App.tsx`: `CommunityView`에 `onClosed` prop 전달.

- [x] **다섯 손가락 Phase 4 — 커뮤니티 알림 Opt-in (2026-03-28)**:
  - `Community.notifyMembers?: string[]` 타입 추가 — 알림 구독 동의 userId 배열.
  - `CommunityView` 헤더: 🔔 알림 ON/OFF 토글 버튼 (가입 멤버만, `arrayUnion/arrayRemove`).
  - 새 글 작성 시 `pushCommunityNotify()` — 구독자(≤50명) 순회하며 `notifications/{nick}/items` 자동 push. 51명 이상 장갑은 write 비용 절감 목적으로 알림 스킵.

- [x] **다섯 손가락 Phase 5 — 중지(middle) 자동 산정 (2026-03-28)**:
  - 글 작성 시 `checkMiddlePromotion()` 호출 — 커뮤니티 내 내 글 수 ≥5 OR 수신 좋아요 합계 ≥20 달성 시 `finger: 'middle'` 자동 승격.
  - 이미 middle/index/thumb이면 스킵. 승격 시 `notifications`에 "🖐 핵심멤버 승급" 알림 push.

- [x] **알림·발신 경로 UID 마이그레이션 (2026-03-28)**:
  - `notifications/{nickname}/items` → `notifications/{uid}/items` 로 경로 변경. 닉네임 변경 시 알림 유실 문제 근본 해결.
  - `sentBalls/{nickname}/items` → `sentBalls/{uid}/items` 동일 적용.
  - 적용 대상: `ThanksballModal.tsx`, `NotificationBell.tsx`, `CommunityView.tsx`, `MyPage.tsx` 전체 일괄 변경.

- [x] **닉네임 변경 30일 쿨다운 + 배치 동기화 (2026-03-28)**:
  - `MyPage.tsx handleProfileUpdate`: 닉네임 변경 시 `users.nicknameChangedAt` 확인 → 30일 미경과 시 차단 (잔여일 안내).
  - 닉네임 변경 성공 시 `nicknameChangedAt: new Date()` 저장.
  - `writeBatch`로 해당 유저의 `community_memberships.nickname` 전체 + 자신이 만든 `communities.creatorNickname` 일괄 동기화 (최대 25개 커뮤니티 동시 처리).

- [x] **마이페이지 활동 기록 통합 (2026-03-28)**:
  - '나의 기록' 탭: `posts` + `community_posts` 병합 후 시간 역순 정렬. 장갑 글에 🧤 배지 표시.
  - '참여한 토론' 탭: `comments` + `community_post_comments` 병합. 장갑 댓글에 🧤 배지 표시.
  - '장갑 속 글' 탭 제거 (통합됨).
  - `MyContentTabs.tsx`: `_source: 'post' | 'glove'` 런타임 태그로 라우팅 분기.

- [x] **마이페이지 '내 장갑' 탭 추가 (2026-03-28)**:
  - 가입한 커뮤니티 목록을 MyPage 내 탭으로 관리 (모바일 대응).
  - 역할 배지(다섯 손가락 FINGER_META), 🔔 알림 ON/OFF 토글 버튼, 커뮤니티별 내 글/댓글 통계, 입장·탈퇴 버튼 포함.
  - `handleToggleCommunityNotify`: `communities.notifyMembers` `arrayUnion/arrayRemove`.

- [x] **유저 전체 통계 장갑 활동 합산 (2026-03-28)**:
  - `CommunityView` 글 작성: `users.likes += 5` (기존 루트 글 작성과 동일).
  - `CommunityView` 좋아요: 글 작성자 `users.likes += diff * 3`.
  - `CommunityView` 댓글 작성: `users.likes += 1`.
  - 장갑 활동이 레벨·평판에 반영됨.

- [x] **커뮤니티 글 영구 삭제 UI (2026-03-28)**:
  - `CommunityView.tsx handleDeletePost`: 작성자 또는 thumb/index(관리자)만 삭제 가능. 2단계 confirm → `deleteDoc(community_posts)` + `communities.postCount` -1.
  - 공지 고정 글 삭제 시 `pinnedPostId: null` 동시 초기화.

- [x] **강퇴 유저 재가입 차단 (2026-03-28)**:
  - `App.tsx handleJoinCommunity` 진입 시 기존 멤버십 문서 조회 → `joinStatus: 'banned'` 이면 즉시 차단 + 안내 메시지.

- [x] **커뮤니티 알림 발송 원자성 — writeBatch 통합 (2026-03-28)**:
  - `CommunityView handleSubmit`: 글 작성 + `communities.postCount` + `users.likes` + 구독자 알림 push를 단일 `writeBatch`로 처리. 부분 실패 방지.

- [x] **Firestore Security Rules 서버사이드 권한 강화 (2026-03-28)**:
  - `community_memberships`: 본인 문서 write(탈퇴·닉네임 동기화) + 관리자(thumb/index) write(강퇴·역할변경) 분리. 관리자 여부를 서버사이드 `get()` 으로 검증.
  - `community_posts`: `delete` 규칙을 작성자 본인 OR 관리자(thumb/index)로 서버사이드 검증 강화.

- [x] **한컷 상세글 마법 수정 구슬 스타일 적용 + 댓글 고도화 (2026-03-28)**:
  - `OneCutDetailView.tsx` 전면 재작성.
  - **헤더**: `← 한컷` 뒤로가기 버튼(`onBack` prop), 경과시간 표시, 공유 URL 복사 버튼.
  - **본문 배치**: 이미지(2/3 너비) → 본문 텍스트 순서. 태그 표시.
  - **원본글 바로가기**: `linkedPostId` → 내부 이동 버튼 / `linkUrl` → 외부 링크 버튼. 제목 아래 배치.
  - **작성자 인터랙션 바**: RootPostCard 박스 스타일. 좋아요 / 땡스볼(ThanksballModal) / 깐부맺기·깐부해제 버튼.
  - **댓글 입력 (pandora 패턴)**: `👍 공감해요 댓글...` / `👎 공감하기 힘들어요 댓글...` 버튼 클릭 → 컬러 박스(힌트 + textarea + 취소 + 댓글달기). 댓글 목록 **아래** 배치.
  - **댓글 목록 (pandora 좌우 지그재그)**: 공감해요(left) → 왼쪽·파란 카드, 공감하기 힘들어요(right) → 오른쪽·장미 카드. 84% 너비.
  - **댓글 카드 헤더**: 아바타 + 닉네임 + `Lv N · 평판 · 깐부 N` (side 배지 제거).
  - **댓글 고정(핀)**: 글 작성자만 토글. 고정 시 앰버 하이라이트 + "작성자가 고정한 댓글" 배지.
  - **댓글 땡스볼**: 로그인한 모든 사용자가 타인 댓글에 ⚾ 버튼 → ThanksballModal(`targetCollection="comments"`).
  - **댓글 수정/삭제**: 본인 댓글에만 수정(인라인 textarea + 저장/취소) · 삭제(confirm + commentCount -1) 버튼.

- [x] **App.tsx 핸들러 훅 분리 + TypeScript any 완전 제거 (2026-04-01)**:
  - `useAuthActions.ts`: `handleLogin`, `handleTestLogin`, `handleLogout` 분리.
  - `useGloveActions.ts`: `handleCreateRoom`, `handleCreateCommunity`, `handleJoinCommunity`, `handleLeaveCommunity` 분리.
  - `useFirestoreActions.ts`: `handlePostSubmit`, `handleLinkedPostSubmit`, `handleInlineReply`, `handleCommentSubmit`, `toggleFriend`, `toggleBlock`, `handleLike`, `handleViewPost` 분리.
  - App.tsx 라인 수: 1034줄 → 711줄. `any` 타입 전면 제거 (타입 캐스팅 명시적 처리).

- [x] **깐부/깐부수 용어 정의 적용 + 전수 수정 (2026-04-01)**:
  - **깐부**: 내가 맺은 팔로잉(following). `friendList` 배열 기반. 깐부목록·깐부글 필터·깐부맺기 버튼에 사용.
  - **깐부수**: 나를 맺은 팔로워 수(follower count). `followerCounts` 역산 집계 기반. 숫자로만 표시. 아바타 정보(Lv·평판·깐부수), ProfileHeader, 레벨 로직에 사용.
  - 아바타 정보 줄(댓글 카드·사이드바·상세글 등) 전체 "깐부 N" → "깐부수 N" 변경 (AnyTalkList, PostCard, OneCutList, RootPostCard, OneCutListSidebar, RelatedPostsSidebar, PostDetailModal, OneCutDetailView, DebateBoard, OneCutCommentBoard, FormalBoard).
  - `ProfileHeader.tsx`: `followerCount?: number` prop 추가. "깐부 N명"(팔로잉) + "깐부수 N"(팔로워) 이중 표시.
  - `MyPage.tsx`: `followerCount` prop 추가 → ProfileHeader 전달. 깐부목록 카드에 "깐부수 N" 표시.

- [x] **깐부/팔로워 수치 불일치 버그 수정 (2026-04-01)**:
  - 원인: App.tsx에서 `friendCount={followerCounts[userData.nickname]}` (팔로워 수) 를 ProfileHeader에 전달 → 내정보 깐부 목록(friendList 기반, 팔로잉 수)과 불일치.
  - 해결: `friendCount={friends.length}` (내가 맺은 수) 로 수정. 팔로워 수는 `followerCount={followerCounts[userData.nickname]}` 별도 prop으로 분리 전달.
  - `types.ts` `UserData` 인터페이스에 누락 필드(ballBalance, ballSpent, ballReceived, exp 등) 추가.

- [x] **댓글 영역 전면 UX 개선 (2026-04-03)**:

  **공통 개선**
  - **아바타 일관성**: `AnyTalkList`, `RootPostCard` 전체에서 `authorData?.avatarUrl || seed` 패턴 적용. 실시간 프로필 이미지 변경 즉시 반영.
  - **땡스볼 전면 개방**: 댓글 카드(PostCard, pandora, OneCutCommentBoard) 모두 `isRootAuthor` 조건 제거 → **로그인 유저 누구나** 타인 댓글에 ⚾ 땡스볼 가능 (본인 댓글 제외).
  - **댓글 수정/삭제**: PostCard(너와 나의 이야기·신포도와 여우·양치기 소년·유배귀양지), pandora 카드(판도라의 상자·솔로몬의 재판·마법 수정 구슬·마라톤의 전령), OneCutCommentBoard(황금알을 낳는 거위) — 본인 댓글에 수정(인라인 textarea + 저장/취소) · 삭제(confirm) 버튼 추가. `post.rootId ? 'comments' : 'posts'` 컬렉션 자동 분기.
  - **pandora 헤더 "합계 N" 제거**: `유용해요 N · 별로예요 N · 합계 N` → `유용해요 N · 별로예요 N`. RootPostCard 하단 댓글 수와 중복 표시 제거.
  - **RootPostCard 본문 색상 분리**: 하단 통계 텍스트("댓글 N")를 `<section style={bgColor}>` 영역 **밖**으로 이동 (`</section>` 이후 `bg-white border-t`). 본문 bgColor가 댓글 수 영역까지 오염되던 문제 해결.

  **카테고리별 직접 입력 방식 확대**
  - **너와 나의 이야기**: 버튼 클릭 → 폼 노출 방식 → `input + 댓글달기 버튼` 직접 입력 방식으로 전환.
  - **신포도와 여우**: 동일하게 직접 입력 방식 적용. `allUsers`/`followerCounts` props 추가(아바타·레벨 정보).
  - **양치기 소년의 외침**: 동일하게 직접 입력 방식 적용.
  - **마라톤의 전령**: pandora 입력 영역에 inline input 삽입 → `pandoraSubmit('left')` 호출. 댓글 카드 너비 `w-[84%]` → `w-full`.

  **황금알을 낳는 거위 (OneCutCommentBoard) 개선**
  - 레이블 변경: `정보취득자` → **일반 댓글**, `정보제공자` → **글작성자 댓글**.
  - 입력 레이블 이모지(💬, ✍) 제거.
  - 글작성자 댓글 카드 색상: `rose` → **slate(엷은 회색)** 계열로 변경.
  - 비로그인 메시지: 작은 텍스트 → 전체 너비 자물쇠 아이콘 + "댓글을 작성하려면 로그인이 필요합니다." 표시.

  **솔로몬의 재판 연계글 목록 추가**
  - `DebateBoard` 내 `useEffect` — `where('linkedPostId', '==', rootPost.id)` 실시간 쿼리로 연계글 목록 구독.
  - 댓글 목록 하단(입력창 위)에 연계글 제목·배지 목록 표시. `onNavigateToPost` 클릭 시 해당 글로 이동. 과거 연계글도 포함.

- [x] **양치기 소년의 외침 완전 제거 — 마라톤의 전령으로 통합 (2026-04-03)**:
  - **배경**: 두 카테고리 모두 긴급 속보 성격으로 개념 중복. 마라톤의 전령이 수동 작성도 지원하고 pandora(공감↔의심) 댓글 구조가 더 우수.
  - **DB 삭제**: Firestore `posts` 7건 + `comments` 9건 Admin SDK 스크립트로 영구 삭제.
  - **코드 삭제**: `CreateCryingBoy.tsx` 파일 삭제. `Sidebar.tsx` MenuId 타입·메뉴 항목, `constants.ts` `crying_boy` 객체, `App.tsx` lazy import·카테고리 카드, `DiscussionView.tsx` CATEGORY_RULES·CATEGORY_COMMENT_MAP, `DebateBoard.tsx` 조건문 2곳 전부 제거.
  - **backward compat 불필요**: DB 데이터 자체가 없으므로 기존 글 렌더링 경로 유지 불필요.

- [x] **버그·UX 전체 정비 + 모바일 네비게이션 재설계 (2026-04-04 v31)**:

  **버그 수정**
  - **랭킹 글 클릭 → 상세글 진입 불가**: App.tsx 렌더 순서 교정 — `activeMenu === 'ranking'` 분기가 `selectedTopic` 분기보다 앞에 있어 글 클릭이 무시됨. `selectedTopic` 체크를 ranking 분기 앞으로 이동.
  - **알림 오표시 (님이 볼 땡스볼을 보냈어요)**: `giant_tree_spread` 타입이 NotificationBell에 미등록 → thanksball 분기로 낙하. 타입 추가 + `fromNick`(거대나무) vs `fromNickname`(땡스볼), `isRead` vs `read` 필드명 불일치 통합. `isUnread()` 헬퍼 신설.
  - **카드 본문 텍스트 겹침**: `AnyTalkList` 본문 div의 `flex-1`과 `line-clamp` 충돌. `flex-1` 제거 → overflow 정상 클립. 헤딩 태그(h1/h2/h3) 크기 통일 추가.
  - **iOS Safari 로그인 팝업 차단 (auth/popup-blocked)**: `isMobileBrowser()` 헬퍼 추가. 모바일에서 `signInWithPopup` → `signInWithRedirect` 전환. 데스크톱은 기존 유지.

  **모바일 딥링크 복원**
  - `signInWithRedirect` 후 복귀 시 URL 파라미터(`?post=`, `?tree=`) 소실 문제. 리디렉션 전 `sessionStorage('authRedirectUrl')`에 현재 URL 저장. `getDeepLinkParams()` 헬퍼(모듈 레벨 캐싱 IIFE) — 복귀 시 sessionStorage에서 post·tree·node·/p/ 파라미터 복원. 검색어: `getDeepLinkParams`.

  **SNS 공유 OG 미리보기 완성**
  - `AnyTalkList`, `OneCutDetailView` 공유 URL을 `?post=` → `/p/` 형식으로 통일. 모든 공유 버튼이 `ogRenderer` Cloud Function을 거쳐 글 제목·내용·이미지 동적 OG 반환. `RootPostCard`는 이미 `/p/` 형식 사용 중.
  - `ogRenderer` 함수 이미 배포 완료. Firestore 조회 3단계 폴백(직접ID → shareToken → prefix 범위검색).

  **모바일 네비게이션 전면 재설계**
  - **헤더**: 좌측 `≡`(드로어 열기) + GLove 텍스트(홈) 분리. 우측 햄버거 제거 → 알림벨 + 아바타(내정보) / 로그인 버튼.
  - **하단 탭바 5탭 (텍스트 없음)**: 홈·한컷·⊕새글(중앙 돌출 파란 원형 `-mt-5`)·장갑·랭킹. active = filled 아이콘, inactive = outline 아이콘. 장갑 이모지 → SVG outline 아이콘으로 통일.
  - **중복 제거**: 우측상단 햄버거 + 하단 메뉴 버튼 모두 제거 → 좌측 ≡ 하나만 드로어 트리거.

  **기타 개선**
  - 사이드메뉴 레이블 `랭킹` → `실시간 랭킹`. CategoryHeader `tags` 옵션 필드 추가 — `marathon_herald`에 `속보, 단독, 지진, 폭발, 테러, 비상계엄` 키워드 표시 (functions/index.js BREAKING_KEYWORDS 실제값 동기화).
  - `CreateKnowledge` 정보분야 35개로 확장 (금융·투자/경제·경영/사회·정치/지식·학문/엔터·문화/라이프 6그룹). UI: 좌측 그룹 탭 + 우측 항목 선택 2컬럼, 선택 배지 제거.

- [x] **실시간 랭킹 전면 개선 + 공유수 시스템 + 평판 로직 전체정리 (2026-04-03 v30)**:
  - **RankingView 4탭**: 좋아요·땡스볼·조회수·공유수 기준 탭 분리. 상위 3위 Hero 카드(숫자 크게, 메달 제거) + progress bar 목록. TOP 20 / 전체 토글(`ViewMode`).
  - **공유수 시스템 완성**: `types.ts Post.shareCount`, `UserData.totalShares` 필드 추가. `handleShareCount(postId, authorId?)` — `posts.shareCount` + `users.totalShares` 동시 increment(1). AnyTalkList·RootPostCard·OneCutDetailView 3곳 `handleCopyUrl`에서 호출. 검색어: `handleShareCount`.
  - **평판 로직 전체정리**: `getReputationScore(userData)` 함수 신설 (`src/utils.ts`) — 공식: `likes + totalShares × 2`. 기존 `calculateReputation` 함수에 `totalSharesReceived` 파라미터 추가(하위호환). 17개 파일 일괄 적용: AnyTalkList, PostCard, OneCutList, OneCutListSidebar, RelatedPostsSidebar, PostDetailModal, OneCutDetailView, DebateBoard, OneCutCommentBoard, RootPostCard, ActivityMilestones, ActivityStats, CreateGiantTree, GiantTreeView + utils.ts, types.ts, useFirestoreActions.ts.
  - **MENU_MESSAGES ranking 추가**: `constants.ts` — `ranking: { emoji: "🏆", title: "실시간 랭킹", ... }`. CategoryHeader 자동 렌더 적용.
  - **설계 원칙**: 공유수 가중치 2× (좋아요 임계값 300/1000/2000 재사용 가능). 검색어: `getReputationScore`.

- [x] **마라톤의 전령 — Firebase Cloud Functions 뉴스 봇 (2026-04-01)**:
  - **구조**: `functions/index.js` — `onSchedule("every 30 minutes", region: "asia-northeast3")`
  - **RSS 피드**: 연합뉴스TV · KBS뉴스 · 경향신문 · 동아일보 · SBS뉴스 (작동 확인된 5개)
  - **속보 필터**: 29개 키워드(`속보·긴급·단독·사망·폭발·화재·지진·붕괴·테러·사고·충돌·대피·경보·재난·사상·부상·실종·침몰·침수·홍수·태풍·폭우·폭설·쓰나미·산사태·총격·납치·폭탄·비상`) — 하나라도 포함된 기사만 저장, 나머지 전부 스킵
  - **중복 방지**: `marathon_dedup` 컬렉션에 URL 해시(base64url) 저장 → 24시간 이내 동일 URL 재등록 차단. 복합 인덱스 불필요.
  - **Firestore 저장 필드**: `newsType: 'breaking'`, `linkUrl`(원본 기사), `author: "마라톤의 전령"`, `author_id: "marathon-herald-bot"`, `authorInfo.level: 99`
  - **UI**: AnyTalkList 카드 하단 🚨 속보 배지(빨간 pulse). 홈 새글 피드 포함. 상세글 `linkUrl` → RootPostCard [🔗 원본 기사 바로가기] 버튼. 댓글: pandora boardType (공감해요 ↔ 의심스러워요).
  - **보안**: `.gitignore`에 `serviceAccountKey.json` · `*serviceAccount*.json` 패턴 추가.
  - **배포**: `firebase deploy --only functions` (hosting과 별개)
  - **로그 확인**: `등록 N건 / 키워드 미해당 스킵 M건` 형식으로 필터 동작 가시화.

- [x] **거대 나무 (자이언트 트리) Phase 1~4 완료 (2026-04-03)**:
  - **신규 메뉴**: 사이드바 우리들의 장갑↔랭킹 사이 🌳 거대 나무 추가 (MenuId `giant_tree`).
  - **Firestore**: `giant_trees/{treeId}` 루트 컬렉션 + `nodes/{nodeId}` / `participants/{uid}` 서브컬렉션.
  - **전파 규모**: 평판별 maxSpread (약간우호=10, 우호=30, 확고=100, 중립=전파불가). 트리 생성 시점 스냅샷으로 고정.
  - **다단계 depth**: URL `?tree={treeId}&node={parentNodeId}` — App.tsx에서 파라미터 파싱 후 GiantTreeDetail에 전달. 부모 노드 depth 조회 후 +1 산정.
  - **서킷 브레이커**: totalNodes ≥ 10 && 반대 비율 ≥ 70% → `circuitBroken: true` 자동 전파 중단.
  - **트리 시각화**: `GiantTreeMap.tsx` — flat 배열 → 재귀 계층 변환, CSS Flexbox + `transform: scale()` 줌(40~150%), 깊이 배지 + 공감/반대 색상 구분.
  - **카카오톡 공유**: `index.html` Kakao JS SDK v2.7.2 (앱키 `fb5adbff3e7fecc7bcdcfcaa2df36057`), 참여 완료 후 💬 카카오 버튼 → `sendDefault` 피드 공유.
  - **평판 상승**: 공감 참여 시 작성자 `users.likes += 2` (자기 나무 · 반대 제외).
  - **알림**: 참여 시 `notifications/{author_id}/items`에 `giant_tree_spread` 타입 push (자기 나무 제외).
  - **D3.js 고도화**: Phase 5로 별도 분리 (미구현) — 노드 50개 이상 대응, collapse/expand, d3.zoom() 기반.

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
- **boardType 종류**: `single`(단일 리스트 — 너와나의이야기·신포도와여우·유배귀양지), `qa`(Q&A — 황금알을 낳는 거위), `pandora`(지그재그 2컬럼 — 판도라의 상자·솔로몬의 재판·마법 수정 구슬·마라톤의 전령), `onecut`(한컷 반응). (`debate`·`info` 타입 제거 완료. `양치기 소년의 외침` 카테고리 자체 제거됨)
- **깐부 / 깐부수 구분**:
  - **깐부**: 내가 맺은 팔로잉. `users/{uid}.friendList[]` 기반. 깐부목록·깐부글·깐부맺기 버튼에 사용. `friends.length`로 카운트.
  - **깐부수**: 나를 맺은 팔로워 수. 전체 `users.friendList` 역산 집계(`followerCounts: Record<string, number>`). 숫자만 표시. 아바타 정보·ProfileHeader·레벨 로직에 사용.
  - **authorInfo.friendCount**: 글/댓글 작성 시 스냅샷된 작성자의 팔로잉 수(따라서 "깐부수"로 레이블링하되 값은 팔로잉 수). 아바타 정보 카드에 표시.
- **CATEGORY_RULES 확장 속성**: `allowDisagree`, `allowFormal`, `boardType`, `placeholder`, `tab1/2`, `allowInlineReply`, `hideEmptyMessage`, `hintAgree`, `hintRefute`, `placeholderAgree`, `placeholderRefute`, `hideAttachment`.

---

## 9. 외부 서비스 규칙

### Cloudflare R2 (이미지 스토리지)
- 비ASCII 파일명 금지, `uploads/{userId}/{filename}` 경로.
- 공개 URL: `https://pub-9e6af273cd034aa6b7857343d0745224.r2.dev`

### Cloudflare Workers (링크 미리보기)
- 소스: `workers/src/index.ts` | 배포: `cd workers && npx wrangler deploy`
- Firebase deploy와 **별개** — 소스 수정 시 wrangler deploy 별도 실행 필요.
- ALLOWED_ORIGIN 환경변수: `wrangler.toml`의 `[vars]` 섹션에서 관리.

### Firebase
- `post_timestamp_nickname` ID 규칙 준수.
- **현재 Blaze 플랜** — Cloud Functions 사용 중.
  - `fetchMarathonNews`: 매 30분 스케줄, 서울 리전(`asia-northeast3`), Node.js 20
  - 배포: `firebase deploy --only functions`
  - 로그: `firebase functions:log --only fetchMarathonNews`
- **향후 구현 가능 (Blaze)**:
  - 글별 동적 OG 태그 (카카오톡 공유 시 글 제목·내용 미리보기)
  - 구현 방식: Cloud Function이 `?post=topic_타임스탬프` 요청을 가로채 Firestore에서 글 조회 후 OG 태그가 담긴 HTML 반환
  - 현재 임시 조치: `index.html`에 앱 공통 OG 태그 적용 중 (모든 공유가 동일한 앱 브랜딩으로 표시)

---

## 10. 거대 나무 (자이언트 트리) — 개발 계획서

> 상태: **Phase 1~4 완료 (2026-04-03)**  |  기획 확정일: 2026-04-03  |  D3.js 고도화: Phase 5 (미구현)

### 10.1 개요

| 항목 | 내용 |
|------|------|
| **메뉴명** | 거대나무 (자이언트 트리) |
| **설명** | 자신의 주장을 버킷리스트 전파 형태(다단계)로 보낼 수 있는 곳 |
| **사이드바 위치** | 우리들의 장갑(glove)과 랭킹(ranking) 사이 별도 영역 (향후 동일 영역에 메뉴 추가 예정) |
| **핵심 가치** | 작성자 중심 — 내 주장의 영향력을 물리적·시각적으로 확장 |

### 10.2 전파 규모 (평판도 기반)

| 평판 등급 | 초기 개발 규모 | 향후 목표 |
|-----------|--------------|----------|
| 약간 우호  | 최대 **10명** | 1천명 |
| 우호       | 최대 **30명** | 1만명 |
| 매우 우호  | 최대 **50명** | 10만명 |
| 확고       | 최대 **100명** | 100만명 |

- `maxSpread` 값은 트리 생성 시점의 작성자 평판 등급으로 고정 (이후 평판 변동 무관)
- 평판 등급 산출 기준: 기존 `getReputationLabel()` 유틸 함수 활용

### 10.3 전파 흐름

```
작성자 글 작성
    ↓
전파 참여자 수신 (카카오톡 / 링크 공유)
    ↓
링크 클릭 → 앱 접속 → 로그인 (신규 유입 경로)
    ↓
공감 or 반대 선택 + 짧은 코멘트 입력
    ↓
3명 선택 → 다음 전파 노드 생성
    ↓
(반복 — maxSpread 도달 또는 서킷 브레이커 발동 시 종료)
```

- 한 노드당 자식 최대 **3개** (각 참여자가 3명에게 전파)
- 참여자 1인당 전파 1회만 허용 (중복 참여 차단)

### 10.4 Firestore 데이터 모델

#### 컬렉션: `giant_trees/{treeId}`
```
treeId          : "tree_{timestamp}_{uid}"
title           : string           // 글 제목
content         : string           // 글 본문 (HTML)
author          : string           // 닉네임
author_id       : string           // UID
authorLevel     : number           // 생성 시점 레벨 스냅샷
authorReputation: string           // 생성 시점 평판 등급 스냅샷
maxSpread       : number           // 전파 가능 최대 인원 (생성 시 고정)
totalNodes      : number           // 현재까지 생성된 노드 수 (실시간 집계)
agreeCount      : number           // 전체 공감 수
opposeCount     : number           // 전체 반대 수
circuitBroken   : boolean          // 서킷 브레이커 발동 여부
createdAt       : Timestamp
```

#### 서브컬렉션: `giant_trees/{treeId}/nodes/{nodeId}`
```
nodeId          : "node_{timestamp}_{uid}"
depth           : number           // 전파 단계 (0 = 작성자, 1 = 1차 전파, ...)
parentNodeId    : string | null    // 부모 노드 ID (루트는 null)
participantNick : string           // 이 노드 참여자 닉네임
participantId   : string           // 이 노드 참여자 UID
side            : 'agree' | 'oppose'
comment         : string           // 짧은 코멘트 (최대 100자)
childCount      : number           // 자식 노드 수 (0~3)
createdAt       : Timestamp
```

#### 중복 참여 차단: `giant_trees/{treeId}/participants/{uid}`
```
uid             : string
joinedAt        : Timestamp
```

### 10.5 서킷 브레이커 (Circuit Breaker)

- 발동 조건: 전체 노드 중 **반대 비율 ≥ 70%** (최소 10노드 이상일 때 판정)
- 발동 시: `circuitBroken: true` 설정 → 신규 노드 생성 차단
- UI: 트리 상세 뷰에 "⚠️ 이 주장은 다수의 반대로 전파가 중단되었습니다" 표시

### 10.6 컴포넌트 설계

| 컴포넌트 | 역할 |
|----------|------|
| `GiantTreeView.tsx` | 목록 뷰 — 진행 중인 트리 카드 목록 (totalNodes·agreeCount 표시) |
| `CreateGiantTree.tsx` | 글 작성 폼 (TiptapEditor 재사용) |
| `GiantTreeDetail.tsx` | 상세 뷰 — 트리 정보 + 전파 참여 폼 + 맵 |
| `GiantTreeMap.tsx` | 트리 시각화 — CSS 기반 줌인/아웃 (초기), D3.js 고도화(후기) |
| `GiantTreeNode.tsx` | 노드 카드 — 참여자 아바타·평판·공감/반대·코멘트 |
| `GiantTreeSpreadForm.tsx` | 전파 참여 폼 — 공감/반대 선택 + 코멘트 + 3인 선택 |

### 10.7 사이드바 배치

```tsx
// Sidebar.tsx — 새 섹션 추가 (glove와 ranking 사이)
{/* 🚀 거대 나무 섹션 */}
<div className="px-3 pt-4 pb-1">
  <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">
    주장 전파
  </span>
</div>
<MenuItem id="giant_tree" label="거대나무" emoji="🌳" description="주장 전파" />

{/* 랭킹 */}
<MenuItem id="ranking" ... />
```

### 10.8 구현 단계 (Phase)

#### Phase 1 — 기반 구조 (완료 2026-04-03)
- [x] `types.ts`: `GiantTree`, `GiantTreeNode` 인터페이스 추가
- [x] `constants.ts`: `giant_tree` 메뉴 항목 추가
- [x] `Sidebar.tsx`: 새 섹션 + `giant_tree` 메뉴 항목 추가 (MenuId 타입 확장)
- [x] `App.tsx`: `giant_tree` activeMenu 처리, `GiantTreeView` lazy import, URL 파라미터 `?tree=` / `?node=` 자동 진입 처리
- [x] `CreateGiantTree.tsx`: 글 작성 폼 (제목 + textarea + 전파 규모 미리보기)
- [x] Firestore `giant_trees` 컬렉션 쓰기/읽기 기본 구현

#### Phase 2 — 전파 참여 UI (완료 2026-04-03)
- [x] `GiantTreeDetail.tsx`: 트리 기본 정보 + 참여 폼 (공감/반대 + 코멘트)
- [x] 중복 참여 차단 (`participants/{uid}` 서브컬렉션 조회)
- [x] `totalNodes` / `agreeCount` / `opposeCount` 실시간 업데이트
- [x] 서킷 브레이커 판정 로직 (10노드 이상 + 반대 70% 이상 시 전파 중단)
- [x] 다단계 depth 산정 — URL `?node=` 파라미터로 부모 노드 depth 조회 후 +1
- [x] 전파 완료 후 공유 URL (`?tree={treeId}&node={myNodeId}`) 복사 블록 표시

#### Phase 3 — 트리 시각화 (완료 2026-04-03)
- [x] `GiantTreeMap.tsx`: CSS Flexbox 기반 세로 트리 렌더링 (flat 배열 → 재귀 계층 변환)
- [x] 노드 카드 인라인 구현 (`NodeCard` / `RootCard` 컴포넌트)
- [x] 줌인/아웃: CSS `transform: scale()` 0.4×~1.5× + 초기화 버튼
- [x] 깊이별 색상 구분 (공감=파랑, 반대=빨강, 작성자=에메랄드)
- [x] 하단 탭 '참여자 목록 / 나무 지도' 전환 (`bottomTab` state)

#### Phase 4 — 고도화 (완료 2026-04-03)
- [x] 카카오톡 공유 API 연동 — `index.html` Kakao JS SDK v2.7.2 초기화, `shareKakao()` 함수 + 💬 카카오 버튼
- [x] 전파 참여 시 작성자 평판 실시간 상승 (`users.likes += 2`, 공감 참여·자기 나무 제외)
- [x] 알림: 내 트리에 새 노드 생성 시 작성자에게 `giant_tree_spread` 타입 알림 push (자기 나무 제외)

#### Phase 5 — D3.js 트리 시각화 고도화 (미구현 — 별도 세션)
- [ ] `GiantTreeMap.tsx` → D3.js 기반으로 교체 (노드 50개 이상 대응)
- [ ] `d3` / `@types/d3` 패키지 설치
- [ ] 노드 클릭 시 하위 접기/펼치기 (collapse/expand)
- [ ] 줌·패닝: `d3.zoom()` + `SVGElement` 기반 (CSS scale 대체)
- [ ] 모바일 핀치 제스처 지원

### 10.9 핵심 기술 고려사항

- **트리 조회 비용**: 노드가 많아지면 전체 서브컬렉션 구독 비용이 큼 → 초기에는 `limit(50)` + 페이지네이션, 시각화는 클라이언트 재구성
- **전파 URL**: `https://halmal-itso.web.app/?tree={treeId}&node={parentNodeId}` — 링크 수신자가 해당 노드의 자식으로 자동 연결
- **카카오 공유 카드**: 작성자 아바타 + 제목 + "전파 {N}번째 주장 — 지금 공감/반대를 선택하세요" 메시지
- **자동 ID 예외**: `nodes/{nodeId}`, `participants/{uid}` 서브컬렉션은 구조 특성상 `addDoc` 자동 ID 허용 (단, `participants`는 `{uid}`를 문서 ID로 직접 사용)
