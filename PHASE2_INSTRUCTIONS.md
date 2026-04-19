# Phase 2 작업 지시서 — 마르지 않는 잉크병 Cloud Functions

## 작업 개요

halmal-itso 프로젝트에 연재 시스템(마르지 않는 잉크병)의 Cloud Functions 2개를 추가한다.

1. `unlockEpisode` — 유료 회차 결제 (땡스볼 차감 → 작가 지급 → 구매 영수증 생성)
2. `onEpisodeCreate` — 새 회차 발행 시 series 카운터 증가 + 구독자 알림

## 사전 조건 (이미 완료됨)

- Firestore Rules에 `series`, `unlocked_episodes`, `series_subscriptions`, `posts/{id}/private_data` 규칙 배포 완료
- Firestore 복합 인덱스 배포 완료
- `unlocked_episodes` 컬렉션은 `allow write: if false` 상태 — Admin SDK만 쓰기 가능

## DB 스키마 참고

### series 컬렉션
```
/series/{seriesId}
- seriesId: string (커스텀 ID)
- title, synopsis, coverImageUrl, genre, tags
- authorId, authorNickname, authorProfileImage
- totalEpisodes, totalViews, totalLikes, subscriberCount (number)
- isCompleted (boolean), status ("serializing"|"completed"|"hiatus")
- freeEpisodeLimit (number, 예: 10)
- defaultPrice (number, 예: 3)
- lastEpisodeAt, createdAt, updatedAt (timestamp)
```

### posts 컬렉션 (에피소드)
```
/posts/{postId}
- category: "magic_inkwell" (필수, 트리거 조건)
- seriesId, episodeNumber, episodeTitle
- isPaid (boolean), price (number)
- previewContent (string, 200자)
- content (string, 무료 회차만 본문 저장)
- author_id, author (기존 필드)
```

### posts/{postId}/private_data/content (서브문서)
```
- body: string (유료 회차 실제 본문)
- images: string[] (웹툰 이미지 URL 목록)
```

### unlocked_episodes 컬렉션
```
/unlocked_episodes/{postId}_{userId}
- userId, postId, seriesId, authorId
- paidAmount (number)
- unlockedAt (timestamp)
```

### series_subscriptions 컬렉션
```
/series_subscriptions/{seriesId}_{userId}
- userId, seriesId
- subscribedAt (timestamp)
- notifyOnNewEpisode (boolean)
```

---

## 작업 1: 신규 파일 생성 — `functions/inkwell.js`

기존 `functions/thanksball.js`의 패턴을 그대로 따라 작성한다. 동일 스타일 유지:
- `onCall` import 방식
- `getFirestore()` 사용
- 한국어 주석 + 🚀/🔒 이모지 표시
- HttpsError 에러 코드

### `unlockEpisode` 함수 요구사항

**입력**: `{ postId, seriesId }`

**처리 순서**:

1. **인증 확인** — `request.auth` 없으면 `unauthenticated` throw
2. **postId 검증** — string 타입, 비어있지 않음. 없으면 `invalid-argument` throw
3. **게시글 조회** — `posts/{postId}` 문서 가져오기. 없으면 `not-found` throw
4. **에피소드 검증**:
   - `category === 'magic_inkwell'` 아니면 `failed-precondition` throw ("연재 회차가 아닙니다")
   - `isPaid === true` 아니면 `failed-precondition` throw ("유료 회차가 아닙니다")
5. **작가 본인 결제 차단** — `post.author_id === buyerUid`이면 `failed-precondition` throw ("작가는 자신의 회차를 결제할 수 없습니다")
6. **가격 결정** — `post.price` 사용. 없거나 0 이하면 `failed-precondition` throw
7. **트랜잭션 시작** (`db.runTransaction`):
   - **중복 결제 체크**: `unlocked_episodes/{postId}_{buyerUid}` 문서 get. 이미 존재하면 트랜잭션 내에서 `{ alreadyUnlocked: true }` 마커를 변수에 저장하고 트랜잭션 종료 (에러 throw 금지 — 멱등성 유지)
   - 구매자 user 문서 get. 없으면 `not-found` throw
   - `ballBalance < price`이면 `failed-precondition` throw ("땡스볼이 부족합니다")
   - 구매자: `ballBalance` 차감, `ballSpent` increment(price), `exp` increment(2)
   - 작가: `users/{authorId}` 문서에 `ballReceived` increment(price) — `set merge: true` 사용 (thanksball.js와 동일 패턴)
   - `unlocked_episodes/{postId}_{buyerUid}` 문서 set:
     ```
     {
       userId: buyerUid,
       postId: postId,
       seriesId: post.seriesId,
       authorId: post.author_id,
       paidAmount: price,
       unlockedAt: Timestamp.now()
     }
     ```
8. **트랜잭션 외 처리**:
   - 만약 `alreadyUnlocked`였으면 `{ success: true, alreadyUnlocked: true }` 반환하고 종료
   - 그렇지 않으면 작가에게 알림 발송:
     ```
     db.collection("notifications").doc(post.author_id).collection("items").add({
       type: "episode_unlocked",
       fromNickname: 구매자 닉네임,
       amount: price,
       postId,
       postTitle: post.episodeTitle || post.title || null,
       seriesId: post.seriesId,
       createdAt: Timestamp.now(),
       read: false
     })
     ```
   - 발신자(구매자) sentBalls 기록:
     ```
     db.collection("sentBalls").doc(buyerUid).collection("items").add({
       type: "episode_unlock",
       postId,
       seriesId: post.seriesId,
       postTitle: post.episodeTitle || null,
       postAuthor: post.author || null,
       amount: price,
       createdAt: Timestamp.now()
     })
     ```
9. **반환**: `{ success: true, amount: price, alreadyUnlocked: false }`

**구매자 닉네임 조회** — thanksball.js와 동일 패턴:
```javascript
const buyerSnap = await db.collection("users").doc(buyerUid).get();
const buyerNickname = buyerSnap.data()?.nickname || request.auth.token?.name || "익명";
```

---

### `onEpisodeCreate` 함수 요구사항

**트리거**: `posts/{postId}` 문서 생성 (`onDocumentCreated` v2)

**Region**: `asia-northeast3`

**처리 순서**:

1. 생성된 문서 데이터 추출. `event.data?.data()`로 가져오기
2. **필터링**: `category !== 'magic_inkwell'`이거나 `seriesId`가 없으면 즉시 return (다른 카테고리 글 무시)
3. **series 문서 조회** — `series/{seriesId}`. 없으면 경고 로그 + return
4. **series 카운터 업데이트**:
   ```
   series ref update {
     totalEpisodes: FieldValue.increment(1),
     lastEpisodeAt: FieldValue.serverTimestamp(),
     updatedAt: FieldValue.serverTimestamp()
   }
   ```
5. **자동 유료화 처리** (선택 안전장치):
   - 만약 `episodeNumber > freeEpisodeLimit`이고 클라이언트에서 `isPaid` 설정을 안 했으면 (`isPaid !== true`)
   - 해당 posts 문서를 update하여 `isPaid: true`, `price: series.defaultPrice`로 설정
   - ⚠️ 이미 클라이언트가 명시적으로 설정했으면 덮어쓰지 않음
6. **구독자 알림 발송**:
   - `series_subscriptions` 컬렉션에서 `where("seriesId", "==", seriesId)` 쿼리
   - `notifyOnNewEpisode === false`인 구독자는 제외
   - 각 구독자에게 `notifications/{userId}/items`에 add:
     ```
     {
       type: "new_episode",
       seriesId,
       seriesTitle: series.title,
       postId: event.params.postId,
       episodeNumber: postData.episodeNumber,
       episodeTitle: postData.episodeTitle || null,
       authorNickname: series.authorNickname,
       createdAt: Timestamp.now(),
       read: false
     }
     ```
   - 알림 발송은 `Promise.all`로 병렬 처리. 단, 100명 이상이면 배치로 나눔 (한 번에 100개씩)
7. **로그 출력**: `console.log(`[잉크병] ${series.title} ${episodeNumber}화 발행 — 구독자 ${구독자수}명에게 알림`);`
8. 에러 발생 시 try-catch로 로그만 남기고 throw 금지 (트리거 재실행 방지)

---

## 작업 2: 기존 파일 수정 — `functions/index.js`

파일 맨 끝의 re-export 블록을 찾아서 `inkwell` 함수 2개를 추가한다.

**찾을 위치**: `// 기능별 분리 모듈 re-export` 주석 아래 require 블록

**AS-IS** (현재 마지막 부분):
```javascript
const { syncAdBids, updateAdMetrics } = require("./adTriggers");

exports.registerKanbuPromo = registerKanbuPromo;
// ... 기존 exports
exports.sendThanksball = sendThanksball;
```

**TO-BE** — 마지막 require 라인 다음에 추가:
```javascript
const { syncAdBids, updateAdMetrics } = require("./adTriggers");
const { unlockEpisode, onEpisodeCreate } = require("./inkwell");

// ... 기존 exports 그대로 유지
exports.sendThanksball = sendThanksball;
exports.unlockEpisode = unlockEpisode;
exports.onEpisodeCreate = onEpisodeCreate;
```

⚠️ 기존 코드는 단 1줄도 수정하지 말고, require 1줄 + exports 2줄만 정확히 추가한다.

---

## 작업 3: 배포 전 검증

1. `functions/inkwell.js` 문법 검증:
   ```bash
   cd functions
   node -c inkwell.js
   ```

2. ESLint가 설정되어 있다면:
   ```bash
   npm run lint
   ```

3. 배포:
   ```bash
   firebase deploy --only functions:unlockEpisode,functions:onEpisodeCreate
   ```

   배포 후 Firebase Console에서 두 함수가 `asia-northeast3` 리전에 등록되었는지 확인.

---

## 핵심 주의사항 (필독)

1. **기존 코드 수정 금지** — `index.js`는 require 1줄 + exports 2줄만 추가. 기존 함수 코드는 절대 건드리지 말 것.
2. **트랜잭션 내부에서 throw 사용 가능** — thanksball.js와 동일 패턴. 단, `alreadyUnlocked` 케이스는 throw 대신 마커 변수로 처리.
3. **중복 결제 멱등성** — 동일 유저가 같은 회차를 두 번 결제 요청해도 두 번 차감되지 않아야 함. 트랜잭션 내에서 unlocked 문서 존재 여부 먼저 체크.
4. **`onDocumentCreated`는 v2 import** — `firebase-functions/v2/firestore`에서 가져올 것.
5. **Region 필수** — 두 함수 모두 `region: "asia-northeast3"` 명시.
6. **알림 타입 명명**:
   - `unlockEpisode` 작가 알림: `type: "episode_unlocked"`
   - `onEpisodeCreate` 구독자 알림: `type: "new_episode"`
7. **트랜잭션 외부에서 user 조회 금지** — 발신자 닉네임은 트랜잭션 시작 전 미리 조회 (thanksball.js와 동일).

---

## 작업 완료 후 보고할 것

1. `functions/inkwell.js` 신규 생성 완료 (라인 수)
2. `functions/index.js` 수정 완료 (추가된 라인만 명시)
3. 문법 검증 결과
4. 배포 결과 (성공/실패)
5. Firebase Console에서 두 함수 확인 결과
