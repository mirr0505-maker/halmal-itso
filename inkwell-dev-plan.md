# 🖋️ 마르지 않는 잉크병 — 연재 시스템 개발 계획서

> halmal-itso 플랫폼 내 연재형 콘텐츠(시, 소설, 수필, 웹툰, 만화) 메뉴 도입을 위한 단계별 개발 계획

---

## 목차

1. [기존 구조와의 차이점 분석](#1-기존-구조와의-차이점-분석)
2. [Phase 1 — DB 설계 (Firestore 스키마)](#2-phase-1--db-설계)
3. [Phase 2 — 백엔드 (보안 규칙 & Cloud Functions)](#3-phase-2--백엔드)
4. [Phase 3 — 프론트엔드 UI/UX](#4-phase-3--프론트엔드)
5. [Phase 4 — 부분 유료화 (땡스볼 연동)](#5-phase-4--부분-유료화)
6. [Phase 5 — 작가 관리 시스템](#6-phase-5--작가-관리-시스템)
7. [Phase 6 — 테스트 & 배포](#7-phase-6--테스트--배포)
8. [마이그레이션 주의사항](#8-마이그레이션-주의사항)

---

## 1. 기존 구조와의 차이점 분석

### 왜 기존 posts 구조만으로는 안 되는가

| 구분 | 기존 posts (게시판) | 연재 시스템 (잉크병) |
|------|-------------------|-------------------|
| 데이터 구조 | 단발성 글 (flat) | 작품(Series) → 회차(Episode) 2단 계층 |
| 정렬 기준 | 최신순 / 좋아요순 | 회차 번호(episodeNumber) 순서 고정 |
| 네비게이션 | 목록 ↔ 상세 (2뎁스) | 작품목록 → 작품홈(목차) → 뷰어 (3뎁스) |
| 본문 보안 | 전체 공개 (content 필드) | 유료 회차는 서브컬렉션에 본문 분리 |
| 과금 연동 | 없음 (감사볼은 선물용) | 회차 잠금 해제 결제 시스템 |
| 작가 관리 | 없음 | 작품 개설, 회차 추가, 무료/유료 설정 |

### 핵심 결론

기존 `posts` 컬렉션을 억지로 확장하면 기존 게시판 기능에 사이드이펙트가 생깁니다.
따라서 **신규 컬렉션 `series`를 메인 허브로 두고**, 에피소드는 기존 `posts`에 `category: "magic_inkwell"` + 확장 필드로 저장하는 **하이브리드 전략**을 권장합니다.

---

## 2. Phase 1 — DB 설계

### 2-1. 신규 컬렉션: `series` (작품 메타데이터)

```
Firestore 경로: /series/{seriesId}
ID 규칙: series_{timestamp}_{uid}
```

| 필드명 | 타입 | 설명 | 예시 |
|--------|------|------|------|
| `seriesId` | string | 문서 ID (= 커스텀 ID) | `series_1718000000_uid123` |
| `title` | string | 작품명 | `"달빛 아래 서신"` |
| `synopsis` | string | 시놉시스 / 소개글 (500자 제한) | `"조선시대 편지로 시작된..."` |
| `coverImageUrl` | string | 표지 이미지 (R2 URL) | `https://r2.../cover.jpg` |
| `genre` | string | 연재 카테고리 | `"novel"` / `"poem"` / `"essay"` / `"webtoon"` / `"comic"` |
| `tags` | array<string> | 태그 (최대 5개) | `["로맨스", "판타지"]` |
| `authorId` | string | 작가 UID | `uid123` |
| `authorNickname` | string | 작가 닉네임 (비정규화) | `"달빛작가"` |
| `authorProfileImage` | string | 작가 프로필 (비정규화) | URL |
| `totalEpisodes` | number | 총 회차 수 (에피소드 추가 시 increment) | `25` |
| `totalViews` | number | 누적 조회수 | `1500` |
| `totalLikes` | number | 누적 좋아요 | `320` |
| `subscriberCount` | number | 구독자(깐부) 수 | `48` |
| `isCompleted` | boolean | 완결 여부 | `false` |
| `status` | string | 상태 | `"serializing"` / `"completed"` / `"hiatus"` |
| `freeEpisodeLimit` | number | 무료 회차 수 (부분유료화) | `10` |
| `defaultPrice` | number | 기본 회차 가격 (땡스볼) | `3` |
| `lastEpisodeAt` | timestamp | 최신 회차 게시일 | Timestamp |
| `createdAt` | timestamp | 작품 생성일 | Timestamp |
| `updatedAt` | timestamp | 수정일 | Timestamp |

### 2-2. 기존 `posts` 컬렉션 확장 (에피소드용 필드 추가)

```
Firestore 경로: /posts/{postId}
기존 ID 규칙 유지: post_{timestamp}_{uid}
```

연재 에피소드일 때만 추가되는 필드:

| 필드명 | 타입 | 설명 | 예시 |
|--------|------|------|------|
| `category` | string | **고정값** | `"magic_inkwell"` |
| `seriesId` | string | 소속 작품 ID | `series_1718000000_uid123` |
| `episodeNumber` | number | 회차 번호 | `11` |
| `episodeTitle` | string | 회차 제목 | `"제11화 - 비밀의 편지"` |
| `authorNote` | string | 작가의 말 (선택) | `"오늘 글이 좀 늦었..."` |
| `isPaid` | boolean | 유료 여부 | `true` |
| `price` | number | 이 회차 가격 (땡스볼) | `3` |
| `previewContent` | string | 유료 미리보기 (200자) | `"그날 밤, 달빛이..."` |
| `content` | string | **무료 회차만** 본문 저장 | 본문 텍스트 |

> ⚠️ **핵심 보안 규칙**: 유료 회차(`isPaid: true`)의 실제 본문은 `content` 필드에 넣지 않습니다.
> 아래 `private_data` 서브컬렉션에 분리 저장합니다.

### 2-3. 서브컬렉션: `posts/{postId}/private_data` (유료 본문 보안 분리)

```
Firestore 경로: /posts/{postId}/private_data/content
```

| 필드명 | 타입 | 설명 |
|--------|------|------|
| `body` | string | 유료 회차의 실제 본문 전체 |
| `images` | array<string> | 웹툰/만화 이미지 URL 목록 (R2) |

> 이 서브컬렉션은 Firestore Rules로 **결제 완료 유저 + 작가 본인**만 읽기 가능하게 잠급니다.

### 2-4. 신규 컬렉션: `unlocked_episodes` (구매 내역)

```
Firestore 경로: /unlocked_episodes/{postId}_{userId}
ID 규칙: {postId}_{userId} (복합 키로 빠른 조회)
```

| 필드명 | 타입 | 설명 |
|--------|------|------|
| `userId` | string | 구매한 유저 UID |
| `postId` | string | 구매한 에피소드 ID |
| `seriesId` | string | 소속 작품 ID |
| `paidAmount` | number | 지불한 땡스볼 |
| `unlockedAt` | timestamp | 결제 시각 |

### 2-5. 신규 컬렉션: `series_subscriptions` (작품 구독/깐부)

```
Firestore 경로: /series_subscriptions/{seriesId}_{userId}
```

| 필드명 | 타입 | 설명 |
|--------|------|------|
| `userId` | string | 구독자 UID |
| `seriesId` | string | 작품 ID |
| `subscribedAt` | timestamp | 구독 시작일 |
| `notifyOnNewEpisode` | boolean | 새 회차 알림 여부 |

---

## 3. Phase 2 — 백엔드

### 3-1. Firestore 보안 규칙 (핵심)

```javascript
// === series 컬렉션 ===
match /series/{seriesId} {
  // 누구나 읽기 가능 (작품 목록 / 상세)
  allow read: if true;
  
  // 생성: 로그인 유저, authorId가 본인인지 검증
  allow create: if request.auth != null
    && request.resource.data.authorId == request.auth.uid;
  
  // 수정/삭제: 작가 본인만
  allow update, delete: if request.auth != null
    && resource.data.authorId == request.auth.uid;
}

// === posts (에피소드) — 기존 규칙에 추가 ===
match /posts/{postId} {
  // 읽기: 기존과 동일 (공개)
  // 단, content 필드는 무료 회차만 데이터가 있으므로 별도 제어 불필요
  allow read: if true;
  
  // 쓰기: 기존 규칙 유지 + authorId 검증
}

// === ⭐ 유료 본문 보안 (가장 중요) ===
match /posts/{postId}/private_data/{docId} {
  // 읽기: 작가 본인 OR 구매 내역이 있는 유저
  allow read: if request.auth != null
    && (
      // 작가 본인
      get(/databases/$(database)/documents/posts/$(postId)).data.authorId == request.auth.uid
      ||
      // 구매한 유저 (unlocked_episodes 문서 존재 여부 확인)
      exists(/databases/$(database)/documents/unlocked_episodes/$(postId + '_' + request.auth.uid))
    );
  
  // 쓰기: 작가 본인만
  allow write: if request.auth != null
    && get(/databases/$(database)/documents/posts/$(postId)).data.authorId == request.auth.uid;
}

// === 구매 내역 ===
match /unlocked_episodes/{docId} {
  // 읽기: 본인 구매 내역만
  allow read: if request.auth != null
    && resource.data.userId == request.auth.uid;
  
  // 쓰기: Cloud Functions만 (클라이언트 직접 쓰기 금지)
  allow write: if false;
}

// === 구독 ===
match /series_subscriptions/{docId} {
  allow read: if request.auth != null
    && resource.data.userId == request.auth.uid;
  allow create, delete: if request.auth != null
    && request.resource.data.userId == request.auth.uid;
}
```

### 3-2. Cloud Functions 신규/확장

#### (1) `unlockEpisode` — 유료 회차 결제 함수

```
호출: callable function
입력: { postId, seriesId }
```

처리 플로우:

1. 요청 유저의 땡스볼 잔액 조회
2. 해당 에피소드의 `price` 확인
3. 잔액 >= 가격 검증
4. **Firestore 트랜잭션** 내에서:
   - 유저 땡스볼 차감
   - 작가에게 땡스볼 지급 (수수료 정책이 있다면 여기서 적용)
   - `unlocked_episodes` 문서 생성 (구매 영수증)
5. 성공 응답 → 클라이언트에서 잠금 해제 UI 렌더링

#### (2) `onEpisodeCreate` — 새 회차 발행 트리거

```
트리거: posts 문서 생성 시 (category == "magic_inkwell")
```

처리 플로우:

1. 해당 `seriesId`의 series 문서에서 `totalEpisodes` +1 increment
2. `lastEpisodeAt` 업데이트
3. `series_subscriptions`에서 해당 작품 구독자 목록 조회
4. 구독자들에게 **알림(notifications)** 발송: "「달빛 아래 서신」 제12화가 연재되었습니다!"
5. (선택) `episodeNumber > freeEpisodeLimit`이면 자동으로 `isPaid: true` 설정

#### (3) `onEpisodeDelete` — 회차 삭제 트리거

1. series 문서의 `totalEpisodes` -1
2. `private_data` 서브컬렉션 정리
3. 관련 `unlocked_episodes` 정리 (환불 정책에 따라)

---

## 4. Phase 3 — 프론트엔드

### 4-1. 라우팅 구조

```
/inkwell                          → SeriesGrid (작품 목록)
/inkwell/:genre                   → SeriesGrid (장르 필터)
/inkwell/series/:seriesId         → SeriesDetail (작품 홈/목차)
/inkwell/series/:seriesId/:postId → EpisodeReader (뷰어)
/inkwell/create                   → CreateSeries (작품 개설)
/inkwell/series/:seriesId/write   → CreateEpisode (회차 작성)
```

### 4-2. 신규 컴포넌트 목록

| 컴포넌트 | 역할 | 핵심 요소 |
|----------|------|----------|
| `SeriesGrid.tsx` | 작품 목록 (메인) | 표지 카드 갤러리, 장르 탭 필터, 정렬(인기/최신/완결), 무한스크롤 |
| `SeriesCard.tsx` | 작품 카드 1개 | 표지 이미지, 제목, 작가명, 장르 뱃지, 회차 수, 완결 뱃지 |
| `SeriesDetail.tsx` | 작품 홈 (목차) | 표지+소개 영역, 구독 버튼, 에피소드 리스트(오름차순), 유료 자물쇠 표시 |
| `EpisodeListItem.tsx` | 목차 내 회차 1줄 | 회차번호, 제목, 날짜, 🔒/🔓 아이콘, 땡스볼 뱃지 |
| `EpisodeReader.tsx` | 본문 뷰어 | 본문 렌더링, 작가의 말, 댓글, [이전화]/[목차]/[다음화] 네비게이션 |
| `PaywallOverlay.tsx` | 유료 잠금 화면 | 미리보기 + 블러 그라데이션, 결제 버튼, 잔액 표시 |
| `CreateSeries.tsx` | 작품 개설 폼 | 제목, 시놉시스, 표지 업로드, 장르 선택, 무료 회차 수 설정 |
| `CreateEpisode.tsx` | 회차 작성 폼 | 회차번호(자동), 제목, 본문 에디터, 무료/유료 토글, 작가의 말 |
| `SeriesSubscribeButton.tsx` | 구독 버튼 | 구독/구독취소 토글, 구독자 수 표시 |

### 4-3. 핵심 UX 플로우

#### 독자 플로우

```
SeriesGrid에서 표지 클릭
  → SeriesDetail 진입 (작품 소개 + 목차)
    → 무료 회차 클릭 → EpisodeReader (바로 읽기)
    → 유료 회차 클릭 → PaywallOverlay 표시
      → 결제 버튼 클릭 → unlockEpisode 호출
        → 성공 → private_data 로드 → 본문 렌더링
        → 잔액 부족 → 땡스볼 충전 팝업 유도
```

#### 작가 플로우

```
마이페이지 [나의 연재작] 탭
  → [새 작품 개설] → CreateSeries 폼
  → 기존 작품 클릭 → SeriesDetail (관리 모드)
    → [새 회차 작성] → CreateEpisode 폼
      → 무료/유료 선택 → 발행
        → onEpisodeCreate 트리거 → 구독자 알림 발송
```

---

## 5. Phase 4 — 부분 유료화

### 5-1. 과금 모델 정리

```
시나리오: 작품 "달빛 아래 서신" (freeEpisodeLimit: 10, defaultPrice: 3)

1~10화  → 무료 (content 필드에 본문 직접 저장)
11화~   → 유료 (private_data 서브컬렉션에 본문 분리)
         → 독자가 땡스볼 3개 소모하여 잠금 해제
         → 한 번 구매하면 영구 열람 (unlocked_episodes 기록)
```

### 5-2. 수익 분배 구조 (제안)

| 항목 | 비율 | 설명 |
|------|------|------|
| 작가 수취 | 70~90% | 땡스볼 기준 |
| 플랫폼 수수료 | 10~30% | halmal-itso 운영비 |

> 초기에는 수수료 0%로 시작하여 작가 유입을 극대화하고,
> 플랫폼이 안정화되면 10~20% 수수료를 도입하는 것을 권장합니다.

### 5-3. EpisodeReader 유료 콘텐츠 로딩 로직

```javascript
// 의사코드
async function loadEpisodeContent(postId, userId) {
  const post = await getDoc(doc(db, 'posts', postId));
  
  if (!post.data().isPaid) {
    // 무료 회차 → content 필드에서 바로 렌더링
    return post.data().content;
  }
  
  // 유료 회차 → 구매 여부 확인
  const unlockRef = doc(db, 'unlocked_episodes', `${postId}_${userId}`);
  const unlockSnap = await getDoc(unlockRef);
  
  if (unlockSnap.exists() || post.data().authorId === userId) {
    // 구매 완료 또는 작가 본인 → private_data에서 본문 로드
    const privateDoc = await getDoc(
      doc(db, 'posts', postId, 'private_data', 'content')
    );
    return privateDoc.data().body;
  }
  
  // 미구매 → PaywallOverlay 표시
  return { paywall: true, preview: post.data().previewContent };
}
```

---

## 6. Phase 5 — 작가 관리 시스템

### 6-1. 마이페이지 연동

기존 `MyContentTabs.tsx`에 **[나의 연재작]** 탭을 추가합니다.

표시 내용:

- 내가 개설한 작품(series) 목록
- 각 작품별: 총 회차, 구독자 수, 누적 조회수, 누적 수익(땡스볼)
- 작품별 [회차 관리] → 에피소드 리스트 (수정/삭제/순서변경)
- [새 작품 개설] 버튼
- [새 회차 작성] 버튼 (작품 선택 후)

### 6-2. 작가 대시보드 (향후 확장)

- 일별/주별 조회수 그래프
- 회차별 유료 전환율
- 구독자 증감 추이
- 땡스볼 수익 내역

---

## 7. Phase 6 — 테스트 & 배포

### 7-1. 단계별 배포 전략

| 단계 | 범위 | 목표 |
|------|------|------|
| **Step 1** | DB + 보안규칙 배포 | Firestore 스키마 안정성 확인 |
| **Step 2** | SeriesGrid + SeriesDetail | 무료 연재 읽기 가능 |
| **Step 3** | CreateSeries + CreateEpisode | 작가가 작품/회차 생성 가능 |
| **Step 4** | EpisodeReader + 네비게이션 | 독자 뷰어 완성 |
| **Step 5** | 구독(깐부) + 알림 연동 | 팬덤 기능 가동 |
| **Step 6** | 부분유료화 + PaywallOverlay | unlockEpisode 함수 + 결제 UI |
| **Step 7** | 작가 대시보드 | 수익/통계 확인 |

### 7-2. 테스트 체크리스트

- [ ] series 생성/수정/삭제 CRUD
- [ ] 에피소드 생성 시 series.totalEpisodes 자동 증가
- [ ] 무료 회차 → content 직접 읽기 가능
- [ ] 유료 회차 → private_data 미구매 시 접근 불가 (Firestore Rules)
- [ ] 유료 회차 → 결제 후 private_data 접근 가능
- [ ] 결제 트랜잭션 원자성 (땡스볼 차감 + 영수증 생성 동시)
- [ ] 기기 변경/재로그인 후에도 구매 내역 유지
- [ ] 이전화/다음화 네비게이션 정상 동작
- [ ] 구독 알림 발송 정상
- [ ] 기존 게시판(AnyTalk 등) 기능에 영향 없음

---

## 8. 마이그레이션 주의사항

### 기존 시스템과의 공존 원칙

1. **posts 컬렉션 하위호환**: 기존 게시판 글에는 `seriesId`, `episodeNumber` 등의 필드가 없습니다. 프론트엔드에서 `category === "magic_inkwell"`일 때만 연재 관련 필드를 참조하도록 분기 처리해야 합니다.

2. **Firestore Rules 병합**: 기존 posts 규칙을 건드리지 않고, `private_data` 서브컬렉션 규칙만 추가합니다. 기존 read/write 규칙에 영향 없도록 match 경로를 정확히 분리합니다.

3. **인덱스 추가 필요**: Firestore 복합 인덱스를 사전에 생성해야 합니다.

```
// 필요한 복합 인덱스 목록
posts: (category ASC, seriesId ASC, episodeNumber ASC)
posts: (seriesId ASC, episodeNumber ASC)
series: (genre ASC, lastEpisodeAt DESC)
series: (genre ASC, totalViews DESC)
series: (authorId ASC, createdAt DESC)
unlocked_episodes: (userId ASC, seriesId ASC)
series_subscriptions: (seriesId ASC, subscribedAt ASC)
```

4. **R2 버킷 구조**: 연재 이미지(표지, 웹툰 컷)는 기존 버킷 내에 폴더를 분리합니다.

```
halmal-itso-bucket/
  ├── posts/          ← 기존 게시글 이미지
  ├── series/         ← 신규: 작품 표지
  │   └── {seriesId}/cover.jpg
  └── episodes/       ← 신규: 웹툰/만화 이미지
      └── {postId}/
          ├── 001.jpg
          ├── 002.jpg
          └── ...
```

5. **점진적 도입**: 처음에는 "무료 연재"만 오픈하고, 유료화는 콘텐츠가 충분히 쌓인 후 Step 6에서 활성화합니다.

---

## 부록: 기술 스택 정리

| 영역 | 기술 | 비고 |
|------|------|------|
| DB | Firestore | series, posts 확장, unlocked_episodes, series_subscriptions |
| 스토리지 | Cloudflare R2 | 표지/웹툰 이미지 |
| 업로드 | Cloudflare Worker | 기존 halmal-upload-worker 확장 |
| 서버리스 | Firebase Cloud Functions | unlockEpisode, onEpisodeCreate |
| 프론트엔드 | React + TypeScript | 기존 halmal-itso 앱 확장 |
| 호스팅 | Firebase Hosting | 기존 구조 유지 |
| 알림 | 기존 notifications 시스템 | 구독 알림 추가 |
