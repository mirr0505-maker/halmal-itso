# 🖋️ 마르지 않는 잉크병 (Magic Inkwell) — 연재 시스템 설계 문서

> 최종 갱신: 2026-04-11 | 범위: Phase 1 ~ Phase 5 전체
> 관련 문서: [blueprint.md](./blueprint.md) 섹션 11 요약 링크

---

## 0. 개요

**마르지 않는 잉크병** = "시 · 소설 · 수필 · 웹툰 · 만화 — 작가의 이야기가 마르지 않는 곳"

일반 게시판과 달리 **작품(Series) 단위** 로 묶이는 연재 시스템. 각 작품은 여러 회차(Episode)를 가지며, 회차는 부분 유료화·구독 알림·댓글 답글 등을 지원한다.

| 구분 | 일반 게시판 | 잉크병 |
|---|---|---|
| 노출 단위 | 게시글 1개 | 작품 → 회차 |
| 결제 | 없음 | 회차별 부분 유료화 (땡스볼 결제) |
| 구독 | 깐부(팔로우) 유저 단위 | **작품 단위** (같은 작가의 다른 작품은 별도 구독) |
| 댓글 | 평평한 리스트 | 1단계 답글 지원 (depth 1, soft delete) |
| 알림 | 땡스볼·커뮤니티 등 | 새 회차 발행 → 구독자에게 `new_episode` |

---

## 1. 데이터 모델

### 1.1 `Series` (작품 메타) — `src/types.ts`

```typescript
interface Series {
  id: string;                      // series_{timestamp}_{uid}
  title: string;
  synopsis: string;                // 500자 제한
  coverImageUrl: string;           // R2 URL
  genre: SeriesGenre;              // novel | poem | essay | webtoon | comic
  tags?: string[];                 // 최대 5개

  authorId: string;
  authorNickname: string;
  authorProfileImage?: string;

  totalEpisodes: number;           // 자동 증가 (onEpisodeCreate 트리거)
  totalViews: number;
  totalLikes: number;
  subscriberCount: number;

  isCompleted: boolean;
  status: 'serializing' | 'completed' | 'hiatus' | 'deleted';

  // 부분 유료화 설정
  freeEpisodeLimit: number;        // 무료 회차 수 (예: 10)
  defaultPrice: number;            // 기본 회차 가격 (땡스볼)

  lastEpisodeAt: FirestoreTimestamp;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}
```

### 1.2 Episode (회차) — `posts` 컬렉션 재사용

잉크병 회차는 **별도 컬렉션이 아니라 `posts` 컬렉션에 `category: 'magic_inkwell'`로 저장**. 이유:
- 기존 댓글/좋아요/땡스볼/공유 등 모든 인프라 재사용
- 홈 피드에 섞일 수 있으나, 필터링으로 분리 노출 (잉크병 인라인 섹션만)

`Post` 인터페이스에 잉크병 전용 옵셔널 필드 추가:

```typescript
// Post 확장 (잉크병 전용, category === 'magic_inkwell'일 때만 사용)
seriesId?: string;           // 소속 작품 ID
episodeNumber?: number;      // 회차 번호 (1부터)
episodeTitle?: string;       // 회차 제목
authorNote?: string;         // 작가의 말 (300자)
isPaid?: boolean;            // 유료 회차 여부
price?: number;              // 회차 가격 (땡스볼)
previewContent?: string;     // 유료 회차 미리보기 (평문 200자)
isHidden?: boolean;          // 비공개 전환 플래그 (soft delete 대체)
isDeleted?: boolean;         // 잉크병 회차 댓글 soft delete
parentCommentId?: string;    // 1단계 답글 — 원댓글 ID (댓글 전용)
```

### 1.3 `UnlockedEpisode` (구매 영수증)

```typescript
interface UnlockedEpisode {
  userId: string;              // 구매자 UID
  postId: string;              // 회차 ID
  seriesId: string;            // 작품 ID
  authorId: string;            // 작가 UID (Rules 검증용)
  paidAmount: number;          // 결제한 땡스볼 수
  unlockedAt: FirestoreTimestamp;
}
```

**문서 ID**: `{postId}_{userId}` (복합 ID — 한 유저가 같은 회차 중복 결제 방지)

### 1.4 `SeriesSubscription` (작품 구독)

```typescript
interface SeriesSubscription {
  userId: string;              // 구독자 UID
  seriesId: string;            // 구독 대상 작품 ID
  subscribedAt: FirestoreTimestamp;
  notifyOnNewEpisode: boolean; // 새 회차 알림 opt-in (기본 true)
}
```

**문서 ID**: `{seriesId}_{userId}`

### 1.5 유료 회차 본문 분리 저장 — `private_data` 서브컬렉션

유료 회차의 본문은 `posts.content`에 저장하지 않고 **`posts/{postId}/private_data/content` 서브문서**에 분리:

```typescript
interface EpisodePrivateContent {
  body: string;                // 유료 본문 HTML
  images?: string[];           // 웹툰/만화 이미지 URL 목록
}
```

- `posts.content = ""` (빈 문자열)
- `posts.previewContent` = 본문 앞 200자 평문 (카드/페이월 미리보기용)
- 실제 본문은 `private_data/content.body`에서 로드 → Firestore Rules로 구매자·작가만 read 허용

---

## 2. Firestore 컬렉션 & 인덱스

### 2.1 신규 컬렉션

| 컬렉션 | 용도 | ID 규칙 |
|---|---|---|
| `series` | 작품 메타 | `series_{timestamp}_{uid}` |
| `unlocked_episodes` | 회차 구매 영수증 (Cloud Function만 write) | `{postId}_{uid}` |
| `series_subscriptions` | 작품 구독 | `{seriesId}_{uid}` |
| `posts/{postId}/private_data/content` | 유료 회차 본문 분리 | 고정 `content` |

### 2.2 복합 인덱스 ([firestore.indexes.json](./firestore.indexes.json))

- `posts (category ASC, seriesId ASC, episodeNumber ASC)` — 작품 상세 목차
- `posts (category ASC, seriesId ASC, episodeNumber DESC)` — CreateEpisode 다음 회차 번호 조회
- `comments (rootId ASC, createdAt ASC)` — 회차 댓글 목록
- `unlocked_episodes (postId ASC, authorId ASC)` — 작가의 특정 회차 판매 여부 조회
- `series (authorId ASC, createdAt DESC)` — 마이페이지 나의 연재작
- `series_subscriptions (userId ASC, subscribedAt DESC)` — 구독 라이브러리

### 2.3 Firestore Rules 핵심 정책 ([firestore.rules](./firestore.rules))

**series**:
- `read: if true`
- `create`: 로그인 + `authorId == auth.uid`
- `update`: 작가 본인(전체) OR 누구나 카운터(`totalViews`/`totalLikes`/`subscriberCount`)만
- `delete`: 작가 본인

**unlocked_episodes**:
- `get`: **docId 패턴 매칭** (`.*_{uid}$`) — 문서 미존재 상태에서도 평가 가능 (SubscribeButton과 동일 패턴)
- `list`: `resource.data.userId == auth.uid OR resource.data.authorId == auth.uid`
- `write: if false` — Cloud Function만 (Admin SDK가 Rules 우회)

**series_subscriptions**:
- `get`: **docId 패턴 매칭** (`.*_{uid}$`)
- `list`: `resource.data.userId == auth.uid`
- `create/delete`: 본인만
- `update: if false`

**comments** (잉크병 회차 댓글 권한 확장):
- `delete`: 작성자 본인 OR 잉크병 회차 작품 작가 (중첩 get으로 검증)
- `update`: 작성자 본인 OR 카운터 필드(`likes`/`likedBy`/`thanksballTotal`) OR **잉크병 작가의 `isDeleted: true` soft delete** (isDeleted 필드만 변경, true만 가능)

**posts/{postId}/private_data/content**:
- `read`: 본인이 구매한 영수증 존재(`unlocked_episodes/{postId}_{uid}`) OR 작가 본인
- `write: if false` — Cloud Function만

---

## 3. Cloud Functions ([functions/inkwell.js](./functions/inkwell.js))

모두 서울 리전(`asia-northeast3`).

### 3.1 `unlockEpisode` (onCall v2)

**역할**: 유료 회차 결제 트랜잭션 (땡스볼 차감 → 작가 지급 → 영수증 생성)

**입력**: `{ postId, seriesId }`

**처리 순서**:
1. 인증·post 검증 (`category === 'magic_inkwell'`, `isPaid`, 작가 본인 차단, 가격 > 0)
2. 트랜잭션 내부:
   - 중복 결제 체크 (`unlocked_episodes/{postId_uid}` 존재 여부 → 존재 시 `alreadyUnlocked: true` 반환)
   - 구매자 `ballBalance` 차감 + `ballSpent`/`exp` 증가
   - 작가 `ballReceived` 증가 (set merge)
   - 영수증 문서 생성
3. 트랜잭션 외 알림·발신 기록:
   - 작가 `notifications/{authorUid}/items` 에 `episode_unlocked` 알림
   - 구매자 `sentBalls/{buyerUid}/items` 기록

**에러 코드**: `unauthenticated` / `invalid-argument` / `not-found` / `failed-precondition` (잔액 부족 등)

**중요**: `alreadyUnlocked` 마커 변수로 중복 결제 멱등성 보장 (throw 없이 정상 return).

### 3.2 `onEpisodeCreate` (Firestore Trigger v2)

**역할**: `posts/{postId}` 생성 시 `category === 'magic_inkwell'` 필터 → 작품 카운터 증가 + 구독자 알림 발송

**처리**:
1. `series.totalEpisodes` +1 + `lastEpisodeAt` 업데이트
2. 자동 유료화 (작가가 `isPaid` 빠뜨려도 `episodeNumber > freeEpisodeLimit`이면 자동 설정)
3. `series_subscriptions where seriesId` 조회 → 각 구독자에게 `new_episode` 알림 (`notifyOnNewEpisode: false` 구독자 제외)
4. 100명씩 batch 병렬 처리

### 3.3 `onInkwellPostDelete` (Firestore Trigger v2)

**역할**: `posts/{postId}` 삭제 시 `category === 'magic_inkwell'` 확인 → 고아 알림 cleanup

**처리**:
- `collectionGroup('items').where('postId', '==', postId)` 로 모든 사용자의 알림 검색
- `type: new_episode | episode_unlocked` 알림만 batch 삭제

**인덱스**: `notifications/*/items` collection group single-field index `postId` — Firebase Console 단일 필드 index 수동 활성화 필요 (composite index JSON에는 등록 불가)

---

## 4. 주요 컴포넌트

### 4.1 작품·회차 CRUD

| 컴포넌트 | 역할 |
|---|---|
| **SeriesGrid.tsx** | 작품 카탈로그 (장르 필터 + 작품 만들기 버튼) |
| **SeriesCard.tsx** | 작품 카드 (표지/제목/장르 뱃지/메타) |
| **SeriesDetail.tsx** | 작품 상세 (표지·시놉시스·태그·구독·목차·작가 통계) |
| **EpisodeListItem.tsx** | 회차 목록 1줄 (번호·제목·메타·잠금 뱃지) |
| **EpisodeReader.tsx** | 회차 본문 뷰어 (페이월·댓글·인터랙션·공유·점세개) |
| **CreateSeries.tsx** | 작품 개설 폼 (표지 R2 업로드·장르·부분유료화) |
| **EditSeries.tsx** | 작품 수정 폼 (제목/장르 수정 불가 — 브랜드 일관성) |
| **CreateEpisode.tsx** | 회차 작성 폼 (Tiptap·자동 회차번호·무료/유료 토글) |
| **EditEpisode.tsx** | 회차 수정 폼 (가격 수정 불가 — 결제 형평성) |

### 4.2 결제·구독·인터랙션

| 컴포넌트 | 역할 |
|---|---|
| **PaywallOverlay.tsx** | 미리보기 + 그라데이션 페이드 + 결제 박스 (잔액 체크) |
| **SubscribeButton.tsx** | 구독 토글 + 구독자 수 (작가 본인은 비활성 표시) |
| **EpisodeCommentBoard.tsx** | 회차 댓글 목록 (답글·soft delete·작가 뱃지·수정/삭제) |
| **EpisodeCommentForm.tsx** | 댓글/답글 작성 폼 (parentCommentId 지원) |
| **InkwellSummaryCards.tsx** | 작가 KPI 카드 (작품/회차/구독자/조회/좋아요/받은 응원) |

### 4.3 진입 화면

| 컴포넌트 | 역할 |
|---|---|
| **InkwellHomeView.tsx** | 사이드 메뉴 진입 시 2탭 (📖 회차 / 📚 작품) — 회차 탭은 등록글 임계값, 작품 탭은 SeriesGrid |

---

## 5. 라우팅 구조 (App.tsx `activeMenu === 'inkwell'`)

잉크병 메뉴 내부는 **5단계 우선순위** 로 분기:

```
잉크병 메뉴 분기 (App.tsx)
├─ 1순위:   inkwellMode === 'createSeries'   → CreateSeries
├─ 1.5순위: inkwellMode === 'editSeries'     → EditSeries
├─ 2순위:   inkwellMode === 'createEpisode'  → CreateEpisode
├─ 2.5순위: inkwellMode === 'editEpisode'    → EditEpisode
├─ 3순위:   selectedEpisodeId                → EpisodeReader
├─ 4순위:   selectedSeriesId                 → SeriesDetail
└─ 5순위:   (기본)                            → InkwellHomeView [📖/📚] 2탭
```

**inkwellMode 상태**: `'list' | 'createSeries' | 'createEpisode' | 'editEpisode' | 'editSeries'`
**inkwellTab 상태**: `'episodes' | 'series'` (InkwellHomeView 탭, 부모에서 관리 — 재마운트 시 탭 유지)

### 5.1 selectedTopic 분기에도 잉크병 케이스

홈/등록글/랭킹 등에서 잉크병 글카드 클릭 시 `setSelectedTopic(post)` 호출 → selectedTopic 분기에서 `category === 'magic_inkwell'`이면 EpisodeReader 렌더 (DiscussionView 대신).

### 5.2 잉크병 메뉴 내부 카드 클릭

잉크병 [📖 회차] 탭의 카드 클릭은 `setSelectedTopic` 대신 **직접 `setSelectedEpisodeId`** 호출 — 라우팅 순서 이슈(`activeMenu === 'inkwell'`이 selectedTopic 분기보다 먼저 평가됨) 우회.

---

## 6. 홈 화면 통합

### 6.1 인라인 스트립 ([AnyTalkList.tsx](./src/components/AnyTalkList.tsx))

새글/등록글/인기글/최고글/깐부글 탭에 **한컷 · 잉크병 · 깐부맺기** 3개 인라인 섹션이 8개 청크마다 반복 노출:
- 잉크병 카드: 일반 글카드와 동일 구조 (시간 좌상단, 하단 메타/통계)
- 카테고리 뱃지 옆에 `📖 N화` + `🔒 유료 🏀N` 또는 `🆓 무료` 뱃지
- 탭별 임계값 일관 (any=2시간, recent=좋아요 3+, best=10+, rank=30+, friend=좋아요 3+)
- 더보기 → 잉크병 메뉴 `[📖 회차]` 탭으로 이동

### 6.2 구독글 탭 (신규, 깐부글 옆)

- `activeTab === 'subscribed'`
- 내가 구독한 작품의 **모든 회차** 임계값 없이 최신순
- 빈 상태: `📚 아직 구독한 작품이 없어요 + [🖋️ 작품 둘러보기]` (잉크병 작품 카탈로그로 이동)

### 6.3 메인 글카드 그리드에서 잉크병 제외

`basePosts = allRootPosts.filter(p => !p.isOneCut && p.category !== 'magic_inkwell')` — 한컷과 동일하게 이중 노출 방지.

---

## 7. 마이페이지 통합

**MyPage 탭 2종 신규**:
- **🖋️ 나의 연재작** — 본인이 작가인 series (authorId == 본인) + 상단 KPI 요약 카드 (InkwellSummaryCards)
- **📚 구독한 작품** — 본인이 구독한 series (onSnapshot on series_subscriptions → 각 series doc fetch)

두 탭 모두 SeriesCard 그리드 + 카드 클릭 시 잉크병 메뉴로 이동(`onNavigateToSeries` 핸들러).

---

## 8. 핵심 정책

### 8.1 권한 / 안전

| 정책 | 내용 |
|---|---|
| **작품 수정 제한** | `title`, `genre`는 수정 불가 (브랜드 일관성). synopsis·tags·freeEpisodeLimit·defaultPrice·cover만 수정. |
| **회차 수정 제한** | `episodeNumber`, `isPaid`, `price`, `seriesId`는 수정 불가 (결제 형평성). episodeTitle·content·authorNote만 수정. |
| **작품 삭제** | 회차가 1개라도 있으면 **비공개 전환** (`status: 'deleted'`)만 가능. 회차 0개일 때만 영구 삭제 가능. |
| **회차 삭제** | 구매자가 1명이라도 있으면 **비공개 전환** (`isHidden: true`)만 가능. 구매자 0명일 때 영구 삭제(댓글 cascade + private_data cleanup + totalEpisodes -1). |
| **댓글 삭제** | 작성자 본인은 `soft delete` (isDeleted: true, placeholder 표시). 작가도 다른 사람의 댓글 soft delete 가능(작가 검열권). content 보존. |
| **댓글 수정** | 작성자 본인만 (작가는 수정 불가). |
| **비공개 ↔ 공개 토글** | 작가가 언제든 복귀 가능 (`isHidden: false` / `status: 'serializing'`). |
| **작가 본인 차단** | 자기 회차 좋아요/땡스볼 불가 (UI + 핸들러 양쪽 가드). |

### 8.2 등록글 / 발견성

| 채널 | 임계값 |
|---|---|
| 작품 목차 (SeriesDetail) | 모든 회차 표시 (임계값 없음, isHidden만 숨김) |
| 마이페이지 나의 연재작 | 작가 본인 전체 (임계값 없음) |
| 알림 (구독자) | 발행 즉시 (임계값 없음) |
| 구독글 탭 | 구독자 본인에게 전체 (임계값 없음) |
| **잉크병 [📖 회차] 탭** | **좋아요 3개 이상 등록글만** (다른 게시판과 일관) |
| **홈 인라인 잉크병 스트립** | 홈 탭별 임계값과 일관 (any/recent/best/rank/friend) |

→ **회차는 작품 안에서 영구히 살아있고**, 다만 "발견 채널"인 잉크병 회차 탭·홈 인라인에서만 등록글 임계값 적용.

### 8.3 유료 회차 본문 유출 방지

- `posts.content = ""` (공개 필드 비움)
- 본문은 `private_data/content.body` 에 분리 저장 (Rules로 구매자·작가만 read)
- EpisodeReader의 댓글 영역은 **잠금 해제된 회차에만 표시** (미구매자 PaywallOverlay에서는 댓글 숨김 — 정보 유출 차단)
- `previewContent` 평문 200자만 카드/페이월에서 노출

---

## 9. 공유 시스템 ([src/utils/share.ts](./src/utils/share.ts))

**공용 헬퍼 `sharePost()`** — 일반 게시판(RootPostCard)과 잉크병(EpisodeReader) 공통:

- **Web Share API 우선** (`navigator.share`) — 모바일 네이티브 공유 시트 (카카오톡/메시지/이메일 선택)
- **Fallback: 클립보드 복사** — 데스크탑 또는 미지원 브라우저
- URL 형식: `/p/{shareToken}` (shareToken = `postId.split('_').slice(0, 2).join('_')`) — Cloud Function `ogRenderer`가 OG 태그 자동 반환 (카카오톡 미리보기)
- 성공 시 `posts.shareCount + users.totalShares +1` 자동 처리
- `AbortError`(사용자 취소) 무시

**EpisodeReader 우측 상단**: 독립 공유 버튼 + 점세개(⋮) 드롭다운
- 👤 공개프로필 보기 (누구나)
- 🚨 신고하기 (disabled — 향후 관리자 기능)
- ✏️ 회차 수정 / 👁 다시 공개 / 🗑️ 회차 삭제 (작가 본인만)

---

## 10. 알림 흐름 (구독 시스템 5단계)

1. **독자가 작품 구독** (SubscribeButton → `series_subscriptions` create + `series.subscriberCount +1`)
2. **작가가 새 회차 발행** (CreateEpisode → `posts` create)
3. **`onEpisodeCreate` 트리거** 자동 실행 → 구독자 `notifications/{uid}/items`에 `new_episode` 알림 batch 발송
4. **독자 NotificationBell**에 `📖 「작품명」 N화가 연재되었어요` 표시
5. **알림 클릭** → `onNavigateToEpisode(postId, seriesId)` → `setActiveMenu('inkwell') + setSelectedEpisodeId + setSelectedSeriesId` → EpisodeReader 직접 진입

**고아 알림 방지**: `onInkwellPostDelete` 트리거가 회차 삭제 시 자동 cleanup + NotificationBell fallback(미존재 게시글 알림 클릭 시 자동 삭제).

---

## 11. 톤 & UI 디자인

잉크병 전 화면은 **일반 게시판과 동일한 차분 톤**:
- **글자 크기**: `text-[11~16px]` 범위 (본문은 `text-[15px] leading-[1.8]` — RootPostCard와 동일)
- **색상**: `slate-500/600/700` 중심 (채도 높은 색 지양)
- **뱃지**: 장르/상태 모두 `slate-100 + slate-200 border` 회색 통일 (작가 뱃지는 `purple`, 유료는 `rose`, 무료는 `blue` 예외)
- **구분선**: 외곽 `slate-300` (선명), 카드 내부 `slate-100` (은은)
- **폼 박스**: `bg-slate-50 border-slate-200` (amber/blue 강조색 지양)

**폰트 typography**:
- 제목: `text-[16px] font-[1000] tracking-tight`
- 메타 라인: `text-[11px] text-slate-500 font-bold`
- 본문 article: `text-[15px] leading-[1.8] font-medium text-slate-700 + HTML 요소별 디테일`

---

## 12. 시드 스크립트 (개발용)

**⚠️ 로그인 정보 포함 — `.gitignore` 처리됨**

- `scripts/seed-inkwell.mjs` — 작품 4개 시드 (달빛 아래 서신·고양이가 사는 골목·별을 삼킨 아이·주말의 디저트 가게)
- `scripts/seed-inkwell-episodes.mjs` — 각 작품에 5개 회차씩(1~3화 무료, 4~5화 유료) 시드

사용: Firebase 프로젝트 설정 + 본인 UID/이메일 입력 후 `node scripts/seed-inkwell.mjs` → `node scripts/seed-inkwell-episodes.mjs`

---

## 13. 구현 이력 (Phase 요약)

| Phase | 범위 | 완료 |
|---|---|---|
| **Phase 1** | Firestore Rules + 인덱스 + 타입 정의 | ✅ |
| **Phase 2** | Cloud Functions (`unlockEpisode`, `onEpisodeCreate`) | ✅ |
| **Phase 3-A~E** | 사이드 메뉴 / 작품 목록 / 상세 / 본문 뷰어 / 생성 폼 | ✅ |
| **Phase 4-A~I** | 구독 / 마이페이지 / 댓글 / 수정·삭제 / 대시보드 / 댓글 인터랙션 | ✅ |
| **Phase 5-A~D** | 공개 복귀 / 고아 알림 cleanup / 댓글 soft delete / 답글 | ✅ |
| **Phase 5** | 알림 라우팅 전파 | ✅ |
| **공유 / 점세개 / 톤다운** | 공용 share 헬퍼 + EpisodeReader 메뉴 확장 + 잉크병 전 화면 차분 톤 | ✅ (2026-04-11) |

---

## 14. 알려진 미구현 / 다음 단계 후보

### 14.1 일반 개선 사항

- **작품 카탈로그 정렬 옵션** (최근/인기/구독자 기준)
- **회차 댓글 좋아요 milestone EXP** (본문은 있고 댓글도 추가)
- **신고 기능** — 관리자 페이지 설계 후 구현 (현재 EpisodeReader 점세개 메뉴에 disabled 버튼으로 자리 표시)
- **작품별 통계 대시보드** (일일 매출·구독자 트렌드 등 — recharts 도입)
- **댓글 답글 알림** — 원댓글 작성자에게 `new_reply` 알림
- **R2 표지 파일 cleanup** — 작품 삭제/교체 시 이전 R2 파일 자동 삭제 (Cloud Function 또는 cleanup job)
- **비공개 전환 작품의 R2 표지 접근 제어** — 현재 직접 URL로 공개 노출됨

### 14.2 🔖 외부 검토자 진단 — 보류 항목 (2026-04-11)

외부 검토자(Gemini)의 진단 결과 중 즉시 처리하지 못하고 **장기 과제로 남긴 항목**:

#### (1) 결제 구매 보호 / 본문 편집 이력 — 우선순위 🟡 MID
**문제**: 구매자가 회차를 결제한 직후 작가가 본문을 완전히 지우거나 악성 내용으로 교체해도 기록이 없음. Phase 4-D-1의 "구매자 있으면 삭제 차단"만으로는 본문 수정까지는 막지 못함. 분쟁 발생 시 증거 없음.

**해결 옵션**:
- **옵션 A** (24시간 Lock): `posts.lastPurchasedAt` 필드 + EditEpisode/handleDelete에서 `now - lastPurchasedAt < 24h`면 변경 차단. 단점: 구매가 계속 이어지면 영원히 Lock.
- **옵션 B** (스냅샷): 구매 시점의 본문을 `unlocked_episodes/{docId}.snapshotBody`에 저장. 작가가 수정해도 구매자는 원본 유지. 단점: 저장 용량 증가.
- **옵션 C 권장** (버전 관리): `private_data/content` → `private_data/versions/{versionNum}` 배열. `UnlockedEpisode.purchasedVersion: number` 추가. 독자는 산 버전 기준으로 렌더.

**난이도**: 🟡 중~상
**진행 시점**: 수익 모델 확정 + 유료 회차 구매자 증가 후

#### (2) 웹툰/만화 유료 이미지 유출 방지 — 우선순위 🔴 HIGH (웹툰 런칭 전)
**문제**: 현재 R2는 **public bucket** (`pub-9e6af273cd034aa6b7857343d0745224.r2.dev`). 유료 회차 이미지도 Tiptap 업로드 시 공개 URL로 저장됨 → URL 유출 시 비구매자도 접근 가능.

**영향 범위**:
- 텍스트 중심(소설·수필·시): 영향 거의 없음
- **웹툰·만화**: 치명적 — 한 구매자가 URL 덤프하면 전체 유출

**해결 옵션**:
1. **Signed URL** (Cloudflare R2 지원) — Worker가 토큰 발급, 만료 시간
2. **Private bucket + 다운로드 프록시** — `halmal-download-worker` 신설, Firebase Auth ID Token 검증 후 이미지 바이트 릴레이
3. **이미지 컴포넌트 래핑** — 유료 이미지는 `<img src="{worker-url}?token=...">` 형태

**난이도**: 🔴 상 (Worker 추가 + Tiptap 업로드 경로 분기 + 이미지 렌더 래핑)
**진행 시점**: 소설/수필 중심 운영 기간에는 후순위. **웹툰/만화 장르 본격 런칭 전 필수**

#### (3) 구독 알림 요약 (Debounce) — 우선순위 🟡 MID
**문제**: `onEpisodeCreate` 트리거가 매 회차마다 개별 알림 발송. 작가가 10화를 한 번에 올리면 구독자에게 **알림 10개** 동시 발송 → 피로도 ↑

**해결 단계**:
- **Phase A (간단)**: 트리거에서 직전 알림 시간 체크 — 1시간 내 동일 seriesId 알림이 이미 있으면 **기존 알림을 "N화 업데이트됨"으로 update** (발송 수는 같아도 NotificationBell에서 1개로 보임)
- **Phase B (완전)**: Cloud Tasks 기반 진짜 debounce — pending 버퍼 → 1시간 후 묶어서 단일 알림 발송

**난이도**: 🟡 중 (Phase A) / 🔴 상 (Phase B)
**진행 시점**: 인기 작가 실제 등장 관찰 후 Phase A로 먼저 대응

#### (4) 본문 유출 추적 (워터마크) — 우선순위 🟢 LOW (장기)
**문제**: EpisodeReader가 본문 HTML 그대로 렌더 → DevTools로 privateContent 객체 확인 가능. 웹툰/만화 우클릭 저장 차단 없음. `user-select: none`은 접근성 문제.

**해결 방향**: 근본적 차단 대신 **유출 추적** — 각 구매자별 워터마크 ID를 본문에 삽입(사람 눈에는 안 보이는 zero-width space 조합 등)하여 유출본 역추적

**난이도**: 🔴 상
**진행 시점**: 실제 유출 사고 발생 또는 프리미엄 서비스 정식 런칭 후

#### (5) Auto-Next / 작가의 말 위치 — 우선순위 🟢 LOW
**제안**:
- 본문 하단 "다음 화 보기" 고정 CTA (현재는 하단 네비 `[이전/목차/다음]`만)
- 작가의 말을 댓글 영역 바로 위로 재배치 (현재는 본문 직후)

**진행 시점**: A/B 테스트 후 결정. 현재 구조도 타당하므로 측정 불가한 개선은 보류.

---

### 14.3 해결 완료 (2026-04-11 A묶음)

- ✅ **서버측 episodeNumber 결정** — Cloud Function `createEpisode` 신규 (runTransaction 원자 처리). `onEpisodeCreate` 트리거는 카운터 증가 역할 제거 → 구독자 알림만 담당. 클라이언트 CreateEpisode는 callable 호출로 전환 (레이스 컨디션 + 인덱스 fallback 중복 생성 버그 근본 차단)
- ✅ **`UnlockedEpisode.expiryDate` 선제 필드** — 대여 옵션 도입 시 마이그레이션 비용 0
- ✅ **회차 삭제 시 unlocked_episodes cleanup** — `onInkwellPostDelete` 트리거가 해당 postId의 구매 영수증도 batch 삭제 (고아 데이터 방지)

### 14.4 해결 완료 (2026-04-11 플랫폼 수수료)

- ✅ **플랫폼 수수료 11% 도입** — `functions/inkwell.js` 상단 상수 `PLATFORM_FEE_RATE = 0.11`. `unlockEpisode` 트랜잭션에서 `Math.floor(price * 0.11)` 차감, 작가에게는 `authorRevenue = price - platformFee`만 적립.
  - 구매자 차감 금액은 `price` 그대로 (UI 영향 없음)
  - `unlocked_episodes` 영수증에 `platformFee`, `authorRevenue`, `feeRate` 추가 (감사 추적)
  - `platform_revenue/inkwell` 단일 문서에 `totalFee`, `totalGross` 누적 (정산·세무 대비, Rules read/write 모두 차단 — Admin SDK 전용)
  - **수수료율 변경**: `inkwell.js`의 상수 한 줄 수정 → `firebase deploy --only functions:unlockEpisode` 재배포만 필요
