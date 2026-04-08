# 📜 HALMAL-ITSO 프로젝트 블루프린트 (설계 계약서)

이 문서는 **할말있소(HALMAL-ITSO)** 프로젝트의 설계 원칙, 현재 구현 상태, 그리고 AI 개발자의 **절대적 행동 지침**을 담은 단일 진실 소스(Single Source of Truth)입니다.

> 최종 갱신: 2026-04-07 v37 (코드 실측 기준)  |  현재 브랜치: `main`

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
| **파일 스토리지** | Cloudflare R2 (Worker 프록시 업로드) | — |
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
├── index.js                 # 진입점 — 모든 함수 re-export (fetchMarathonNews + 분리 모듈)
├── thanksball.js            # sendThanksball — 땡스볼 전송 (잔액 차감·수신자 누적·알림, posts.author_id 우선 조회)
├── auction.js               # adAuction — 광고 슬롯 입찰 처리
├── revenue.js               # aggregateDailyRevenue — 일별 광고 수익 집계
├── fraud.js                 # detectFraud — 부정 클릭 감지
├── settlement.js            # processSettlements — 정산 처리
├── kanbuPromo.js            # registerKanbuPromo — 깐부 홍보 카드 등록 (Lv2+, 기간제 과금)
├── testCharge.js            # testChargeBall — 테스트용 땡스볼 충전
├── contentLength.js         # validateContentLength — 신포도와 여우 100자 제한 검증
└── package.json             # 의존성: firebase-admin, firebase-functions, fast-xml-parser

/src
├── App.tsx                  # 루트 컴포넌트 (전역 상태 관리, 라우팅 레이아웃) ~711줄
├── main.tsx                 # 진입점
├── types.ts                 # 공용 인터페이스
├── constants.ts             # 앱 전역 설정 (MENU_MESSAGES, TEST_ACCOUNTS)
├── firebase.ts              # Firebase 초기화
├── uploadToR2.ts            # R2 업로드 프록시 (Worker 경유, Firebase Auth 토큰 인증)
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
| `onecut` | 한컷 | (isOneCut 플래그) | 16:9 가로형 이미지 전용 |
| `my_story` | 너와 나의 이야기 | 너와 나의 이야기 | 일상, 공감 위주 |
| `naked_king` | 판도라의 상자 | 판도라의 상자 | 지그재그 댓글 보드 (동의/반박 인라인 입력, 핀 고정, boardType: pandora) |
| `donkey_ears` | 솔로몬의 재판 | 솔로몬의 재판 | 동의/비동의 지그재그 pandora 댓글 보드 + 연계글 팝업(CreateDebate). boardType: pandora |
| `knowledge_seller` | 황금알을 낳는 거위 | 황금알을 낳는 거위 | Q&A 보드 (구: 지식 소매상 → migrate 완료) |
| `bone_hitting` | 신포도와 여우 | 신포도와 여우 | 명언, 짧은 글 (구: 뼈때리는 글 → migrate 완료) |
| `local_news` | 마법 수정 구슬 | 마법 수정 구슬 | 정보 공유 보드 (구: 현지 소식 → migrate 완료) |
| `friends` | 깐부 맺기 | (UI 전용) | 홍보 카드 기반 깐부 매칭. Lv2+ 유저가 이미지·키워드·공약을 등록하면 카드 노출. 클릭 시 팝업 상세(공개프로필+깐부맺기). `users/{uid}.promoEnabled/promoImageUrl/promoKeywords/promoMessage` |
| `kanbu_room` | 깐부방 | (subcollection) | 깐부가 개설한 방 목록, 방별 게시판+실시간 채팅. Lv3 이상 개설. Firestore: `kanbu_rooms/{roomId}/chats` |
| `glove` | 우리들의 장갑 | (커뮤니티) | 다섯 손가락 운영 체제 (thumb·index·middle·ring·pinky). 가입방식 3종(open·approval·password), minLevel 제한, 공지 고정, 알림 opt-in, 중지 자동 산정. 자세한 내용 → `GLOVE.md` |
| `marathon_herald` | 마라톤의 전령 | 마라톤의 전령 | 뉴스 속보 봇 전용 채널. 속보 키워드(속보·단독·지진·폭발·테러·비상계엄 6개) 포함 기사만 Firestore 저장. `newsType: 'breaking'`→🚨 속보(빨간 pulse 배지). 좋아요 임계값 없이 즉시 노출. 홈 새글 피드에도 포함. 댓글: pandora 공감/의심 2컬럼. 원본 기사 `linkUrl` → RootPostCard [🔗 바로가기] 버튼. Cloud Functions 매 10분 자동 등록, 분대별 1개 언론사 순차 수집(MBC·연합뉴스TV·연합뉴스·경향신문·동아일보·뉴시스). |
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
- **미등록**: 2시간 경과 + 좋아요 3 미만. 홈 피드 어디에도 노출되지 않음. 내정보 나의 기록·나의 한컷에서만 접근 가능.

### 6.1.1 재등록 시스템
- **대상**: 미등록 글 (2시간 경과 + 좋아요 3 미만 + `repostedAt` 필드 없음)
- **동작**: 제목 앞 `[재등록]` 추가 + `createdAt` 리셋(새글 복귀) + `repostedAt` 타임스탬프 기록
- **제한**: 1회만 가능. 재등록 후 다시 2시간 내 좋아요 3개 미달 시 영구 미등록.
- **UI**: 내정보 나의 기록·나의 한컷 탭에서 미등록 글 옆에 [재등록] 버튼 표시. 상단 안내 메시지.

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
- **비율**: 16:9 가로형 이미지 (`aspect-[16/9]`). 업로드 미리보기 · 목록 카드 · 상세 뷰 동일 비율 통일.
- **연결**: 일반 게시글과 한컷을 `linkedPostId`로 상호 연결하여 이동 지원.
- **상세 설명 없음**: 이미지 + 제목만으로 의미 전달. CreateOneCutBox에서 상세 설명 textarea 제거.
- **홈 피드 인라인 섹션**: 새글/등록글/인기글/최고글/깐부글 탭 하단에 탭 기준과 동일한 필터의 한컷 최신 4개를 가로 그리드로 표시. 더보기 → 한컷 메뉴로 이동.
- **카드 하단 구조**: 일반 글카드(AnyTalkList)와 완전 동일 — 아바타(w-6)+닉네임+Lv/평판/깐부수(좌) | 댓글·땡스볼·좋아요·공유(우). 아바타 클릭 → 공개 프로필. 원본글 영역은 없어도 `min-h-[22px]`로 높이 확보 (카드 세로 사이즈 통일).

---

## 8. 구현 이력 (Changelog)

> 📋 완료된 기능 전체 이력은 **[changelog.md](./changelog.md)** 를 참조하세요.
> 최신 버전: v39 (2026-04-08)

## 9. 외부 서비스 규칙

### Cloudflare R2 (이미지 스토리지)
- 비ASCII 파일명 금지, `uploads/{userId}/{filename}` 경로.
- 공개 URL: `https://pub-9e6af273cd034aa6b7857343d0745224.r2.dev`
- 버킷 2개: `halmal-itso-bucket` (게시글 이미지), `avatars` (아바타)
- **업로드 경로**: 클라이언트 → `halmal-upload-worker` (Cloudflare Worker) → R2 바인딩 직접 저장
- **보안**: 클라이언트에 R2 API 키 없음. Worker가 Firebase Auth ID Token 검증 후 업로드 처리. `uploads/` 경로는 본인 UID 폴더만 허용.

### Cloudflare Workers
- **halmal-link-preview** (링크 미리보기): 소스 `workers/src/index.ts` | 배포 `cd workers && npx wrangler deploy`
- **halmal-upload-worker** (R2 업로드 프록시): 소스 `upload-worker/src/index.ts` | 배포 `cd upload-worker && npx wrangler deploy`
- Firebase deploy와 **별개** — 소스 수정 시 wrangler deploy 별도 실행 필요.
- ALLOWED_ORIGIN 환경변수: 각 `wrangler.toml`의 `[vars]` 섹션에서 관리.

### Firebase
- `post_timestamp_nickname` ID 규칙 준수.
- **현재 Blaze 플랜** — Cloud Functions 사용 중 (서울 리전 `asia-northeast3`, Node.js 20).
  - `fetchMarathonNews`: 매 30분 스케줄 뉴스 봇
  - `sendThanksball`: 땡스볼 전송 (ballBalance 직접 수정 차단 → Admin SDK 트랜잭션)
  - `testChargeBall`: 테스트용 볼 충전
  - `registerKanbuPromo`: 깐부 홍보 카드 등록 (promoEnabled 직접 수정 차단)
  - `adAuction` / `aggregateDailyRevenue` / `detectFraud` / `processSettlements`: ADSMARKET 광고 시스템
  - `validateContentLength`: 신포도와 여우 100자 제한
  - 배포: `firebase deploy --only functions`
  - 로그: `firebase functions:log`
- **향후 구현 가능 (Blaze)**:
  - 글별 동적 OG 태그 (카카오톡 공유 시 글 제목·내용 미리보기)
  - 구현 방식: Cloud Function이 `?post=topic_타임스탬프` 요청을 가로채 Firestore에서 글 조회 후 OG 태그가 담긴 HTML 반환
  - 현재 임시 조치: `index.html`에 앱 공통 OG 태그 적용 중 (모든 공유가 동일한 앱 브랜딩으로 표시)

---

## 10. 거대 나무 (자이언트 트리)

> 📋 상세 설계 문서는 **[GIANTTREE.md](./GIANTTREE.md)** 를 참조하세요.
> 하이브리드 성장 시스템 v1 (2026-04-05) — 직계 전파자(Node) + 일반 참여자(Leaf) 분리, 시든 가지 알림, 성장 6단계
