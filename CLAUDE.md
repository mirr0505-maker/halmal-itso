# CLAUDE.md — Claude Code 전용 지침

이 파일은 Claude Code가 **할말있소(HALMAL-ITSO)** 프로젝트에서 작업할 때 반드시 따라야 하는 지침입니다.

---

## 프로젝트 핵심 파악

- **blueprint.md** — 설계 계약서 (아키텍처·규칙·가이드라인). 모든 작업 전 반드시 참조.
- **changelog.md** — 구현 완료 기능 이력 (blueprint.md 섹션 8 분리). 과거 구현 확인 시 참조.
- **GIANTTREE.md** — 거대 나무 상세 설계서 (blueprint.md 섹션 10 분리). 전파 시스템·잎사귀·시든 가지 등.
- **INKWELL.md** — 🖋️ 마르지 않는 잉크병 상세 설계서 (blueprint.md 섹션 11 분리). 연재 시스템·부분 유료화·구독·답글·안전 정책 등.
- **GLOVE.md** — 우리들의 장갑(커뮨니티) 상세 설계서.
- **MARKET.md** — 🏪 강변 시장 설계서. 가판대(단건 판매) + 단골장부(구독 상점) + 광고 수익 쉐어.
- **STOREHOUSE.md** — 🏚️ 놀부의 텅 빈 곳간(유배귀양지) 설계서. 4진 아웃 + 속죄금 + 깐부 리셋 + 사약 시스템.
- **ADSMARKET.md** — ADSMARKET 광고 시스템 상세 설계서.
- **SHAREHOLDER_TIER.md** — 🛡️ 주주방 인증 체계 설계서. 등급(새우/상어/고래/대왕고래) + 방장 인증 패널 + 배지 전파.
- **SHAREHOLDER_BACKLOG.md** — 주주방 인증 미룬 작업 레지스트리 (Phase E~F Codef 연동, 증거 이미지 presigned URL 등).
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
- 컬렉션: `posts`, `comments`, `users`, `kanbu_rooms`, `notifications`, `sentBalls`, `communities`, `community_posts`, `community_memberships`, `community_post_comments`, `giant_trees`, `marathon_dedup`, `series`, `unlocked_episodes`, `series_subscriptions`, `platform_revenue`, `glove_bot_payments`, `glove_bot_dedup`, `dart_corp_map`, `market_items`, `market_purchases`, `market_shops`, `market_subscriptions`, `market_ad_revenues`, `bail_history`, `release_history`, `banned_phones`, `sanction_log`, `exile_posts`, `exile_comments`, `kanbu_paid_subs`
- **Firestore Security Rules 차단 필드**: `ballBalance`, `promoEnabled`, `promoExpireAt`, `promoPlan`, `promoUpdatedAt` — 클라이언트 직접 수정 불가, 반드시 Cloud Function 경유
- **Rules read/write 전면 차단 컬렉션**: `platform_revenue`, `glove_bot_payments`(대장 본인 read만 허용), `glove_bot_dedup`, `banned_phones`, `sanction_log`(관리자만 read), `bail_history`/`release_history`(본인만 read) — Admin SDK / Cloud Function 전용
- **🏚️ sanction 필드**: `sanctionStatus`, `strikeCount`, `requiredBail`, `sanctionExpiresAt`, `phoneVerified`, `phoneHash` — 클라이언트 직접 수정 불가, 반드시 Cloud Function(`sendToExile`/`releaseFromExile`) 경유

### Cloud Functions (서울 리전, `functions/` 디렉토리)
- `index.js` — 진입점 (fetchMarathonNews + 분리 모듈 re-export)
- `thanksball.js` — `sendThanksball`: 땡스볼 전송 (잔액 차감·수신자 누적·알림). posts.author_id 우선 조회로 수신자 UID 확보. 수신자 `ballReceived`(평판 누적) + `ballBalance`(실사용 잔액) **동시 증가** — 받은 땡스볼은 되쓰기/유배 속죄금으로 사용 가능.
- `testCharge.js` — `testChargeBall`: 테스트용 볼 충전
- `kanbuPromo.js` — `registerKanbuPromo`: 깐부 홍보 카드 등록 (Lv2+, 기간제)
- `kanbuPaid.js` — `joinPaidKanbuRoom`: 깐부방 유료 게시판 결제(1회/구독, 수수료 Lv별 20~30%, pendingRevenue 누적). `checkKanbuSubscriptionExpiry`: 매일 09:00 월 구독 만료 처리
- `auction.js` / `revenue.js` / `fraud.js` / `settlement.js` — ADSMARKET 광고 시스템
- `contentLength.js` — `validateContentLength`: 신포도와 여우 100자 제한
- `inkwell.js` — `unlockEpisode`(유료 회차 결제, 수수료 11%), `createEpisode`(서버측 episodeNumber), `onEpisodeCreate`(구독자 알림), `onInkwellPostDelete`(고아 알림+영수증 cleanup)
- `gloveBot.js` — `activateInfoBot`/`deactivateInfoBot`/`updateInfoBot`: 정보봇 활성화·중지·수정 (주식 장갑 전용, 대장 월 20볼)
- `gloveBotFetcher.js` — `fetchBotNews`(Google News RSS), `fetchBotDart`(DART 공시): 매 30분 스케줄
- `dartCorpMap.js` — `syncDartCorpMap`(월 1회)/`triggerSyncDartCorpMap`(수동): DART 종목코드→고유번호 매핑. `lookupCorpCode`: 조회
- `adTriggers.js` — `syncAdBids`/`updateAdMetrics`: ADSMARKET 광고 트리거
- `market.js` — `purchaseMarketItem`(가판대 구매, 레벨별 수수료 30/25/20%), `subscribeMarketShop`(단골장부 구독), `checkSubscriptionExpiry`(매일 09:00 만료 체크+알림+차감)
- `storehouse.js` — `sendToExile`(관리자 전용, strikeCount +1 + 단계 자동 판정, 4차 자동 사약 + postId 지정 시 글 숨김), `releaseFromExile`(본인, 속죄금 차감/소각 + 깐부 리셋), `executeSayak`(직권 사약, 자산 몰수 + 모든 글 숨김 + banned_phones), `checkAutoSayak`(매일 04:00 스케줄, 90일 미납 자동 사약)
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
| `App.tsx` | 전역 상태·리스너 중심. props drilling이 많으므로 함부로 리팩터링 금지. 헤더 `+ 새 글` 버튼은 `activeMenu === 'exile_place' && !isExiled`일 때 `setActiveMenu('home')` 선행(비유배자가 유배글 폼 진입 방지). |
| `TiptapEditor.tsx` | 스티키 툴바 + 버블 메뉴 로직 손대지 않기. 커서 위치 유지 로직 보호. |
| `CreatePostBox.tsx` | 카테고리 목록에서 "한컷" 제외 유지. |
| `DiscussionView.tsx` | `CATEGORY_RULES` 객체 — 카테고리별 댓글 규칙 정의. 임의 변경 금지. 🏚️ 유배·귀양지는 `boardType: 'pandora'` (좌/우 지그재그 + 각 컬럼 하단 인라인 입력) + `hideAttachment: true`. |
| `OneCutDetailView.tsx` | 2컬럼 레이아웃(8:4 그리드) 유지. tree 문서 실시간 구독(`onSnapshot`). |
| `DebateBoard.tsx` | 너와 나의 이야기 댓글 IME 처리 — InlineForm 컴포넌트 금지, 인라인 JSX 유지. `isComposing` 체크 보호. |
| `RootPostCard.tsx` | 하단 통계 바 3컬럼 구조(댓글\|땡스볼\|동의) 유지. `onBack` prop 체인 보호. 🏚️ `post.category === '유배·귀양지'`일 때 우상단 공유 버튼 숨김(STOREHOUSE §3 Sandbox Policy). |
| `ThanksballModal.tsx` | `sendThanksball` Cloud Function(`functions/thanksball.js`)으로 서버 처리. ballBalance 직접 수정 금지(Rules 차단). 서버에서 잔액 차감·수신자 누적·sentBalls·notifications·thanksballTotal 5곳 동시 처리. |
| `OneCutList.tsx` | 카드 하단은 AnyTalkList 일반 글카드와 완전 동일 구조 유지(아바타w-6+프로필클릭+공유버튼). 원본글 영역 `min-h-[22px]` 높이 확보 필수(카드 세로 통일). 🍞 썸네일은 `imageUrls[0] ?? imageUrl`, 좌상단 `🍞 1/N` 배지(회색). |
| `CreateOneCutBox.tsx` | 🍞 헨젤의 빵부스러기 — 1~4슬롯 업로드 + 캐러셀 미리보기. `imageUrls` 배열 state, 저장 시 `imageUrl = imageUrls[0]` 동시 저장(하위호환). DB 카테고리 `한컷` + `isOneCut: true` 유지. |
| `OneCutDetailView.tsx` | 1컷: 단일 이미지(기존), 2~4컷: 캐러셀(←/→ 화살표·인디케이터·키보드·스와이프). 마지막 컷 CTA "🔗 숨겨진 자세한 이야기 보러가기" — `linkedPostId` 우선, 없으면 `linkUrl` 새 탭. |
| `NotificationBell.tsx` | `notifications/{uid}/items` 실시간 구독. `writeBatch`로 일괄 읽음 처리. 타입: `thanksball·community_post·finger_promoted·giant_tree_spread·giant_tree_wilt`. `isUnread()` 헬퍼로 `read`/`isRead` 두 필드 통합 판단. |
| `EditorToolbar.tsx` | 링크 삽입 후 Workers 호출 → `LinkPreviewCard` 표시. `fetchPreview` 내부 상태 보호. |
| `LinkPreviewCard.tsx` | OgData 타입 export — EditorToolbar에서 import해 사용. |
| `MyContentTabs.tsx` | 나의 기록·한컷 리스트. 상태 배지(새글/미등록/등록글/인기글/최고글) + 재등록 버튼(1회 한정). `canRepost()` / `getPostStatus()` 로직 보호. |
| `CommunityView.tsx` | 소곤소곤·채팅·멤버·관리 4탭. 인증 부여/해제, 낙관적 업데이트 전체 적용. 비가입자 접근 제한(승인제 차단/open 읽기전용). `selectedCommunity`는 `communities.find()`로 최신값 참조. |
| `CommunityPostDetail.tsx` | 별도 파일(CommunityView에서 추출). 자체 onSnapshot(글+댓글). 댓글: 좋아요/땡스볼/수정/삭제/고정. 작성자 카드 RootPostCard 패턴. CommunityFeed에서도 재사용. 상세글 우상단+댓글 우측 ⋮ 메뉴(공개프로필/신고하기). |
| `CommunityChatPanel.tsx` | 실시간 채팅 (onSnapshot limit 50 + 페이징 30). 답장/이모지 6종/이미지+문서 첨부/땡스볼/soft delete. 50명 한도 가드. 읽지 않은 메시지 카운트(chatLastReadAt). `chatBgUrl` 있으면 배경 이미지 + linear-gradient 60% 흰색 오버레이. |
| `CommunityFeed.tsx` | 소곤소곤 피드. 글 클릭 → CommunityPostDetail 모달 직접 오픈 + 멤버 lazy load. 피드 카드 하단 땡스볼 버튼(ThanksballModal). 🤖 봇 게시글 뱃지 표시. |
| `CreateCommunityModal.tsx` | 승인제(approval) 선택 시 가입 폼 빌더 표시. `joinForm` state + 표준 필드 토글 + 커스텀 질문 5개 슬롯 제한. 대표 이미지(`thumbnailUrl`) + 채팅 바탕화면(`chatBgUrl`) R2 업로드 옵션. 주식 카테고리 정보봇 안내. 닉네임 배지(`displayBadgeKey`) 라디오 선택. |
| `CommunityAdminPanel.tsx` | 관리 탭 (설정수정/대표이미지/채팅배경/닉네임배지/승급조건/정보봇/폐쇄). 정보봇 UI는 `category='주식'` + 대장(thumb) 전용. DART 매핑 동기화 버튼. 이미지/버튼 `w-2/3 mx-auto` 중앙 정렬. 🛡️ 주주 인증은 독립 탭으로 분리됨(CommunityView 'verify' 탭). |
| `VerifyShareholderPanel.tsx` | 🛡️ 방장 주주 인증 관리. 종목 설정(1회 잠금) + TierSelector(4등급 라디오) + 인증 대기(스크린샷/마이데이터 구분) + 인증 완료(등급 변경/해제/스크린샷 30일 열람). 개별/일괄 인증 요청 발송. SecureImage 프록시 사용. |
| `ShareholderVerifyScreen.tsx` | 🛡️ 멤버 주주 인증 등록. 2탭(📸 스크린샷 / 📊 마이데이터) + 차분한 slate 톤. 마이데이터 3단계(조회→결과→제출). 등급 기준표 양쪽 탭 노출. 스크린샷 30일 삭제 안내. |
| `SecureImage.tsx` | 🔒 R2 프록시 이미지 로더. 직접 URL 대신 Worker `/api/screenshot`으로 Firebase Auth 인증 후 Blob URL 로드. 주주 인증 스크린샷 열람에 사용. |
| `MyCommunityList.tsx` | 나의 장갑 목록. `compact=true`: 사이드바 소형(컬러도트/썸네일). `compact=false`: 메인 탭 카드 그리드. |
| `JoinCommunityModal.tsx` | joinForm 있으면 폼 빌더 모드, 없으면 레거시 모드. `validateJoinAnswers`로 필수 항목 검증. |
| `InkwellHomeView.tsx` | 🖋️ 잉크병 사이드 메뉴 진입 화면. glove 패턴 sticky 헤더 + 2탭 (📖 회차 / 📚 작품). `activeTab`은 부모(App.tsx `inkwellTab`)에서 관리 — SeriesDetail 진입 후 복귀 시 탭 유지. |
| `SeriesDetail.tsx` | 🖋️ 작품 상세 (표지·시놉시스·구독·목차·작가 통계). 작가 본인만 `[✏️ 작품 수정][🗑️ 작품 삭제]` + 작가 통계 박스(차분 슬레이트). 회차가 있으면 삭제 불가 → 비공개 전환(`status: 'deleted'`)으로 폴백. 목차는 `visibleEpisodes`로 `isHidden` 필터 (작가는 모두 표시). |
| `EpisodeReader.tsx` | 🖋️ 회차 본문 뷰어. 상단 `← 되돌아가기` + 우상단 `[📤 공유][⋮ 더보기]`. 점세개: 누구나 `공개프로필/신고(disabled)` + 작가 본인 `수정/다시공개/삭제`. 공유는 `sharePost()` 헬퍼(Web Share API+클립보드). PaywallOverlay는 미구매자 전용. 하단 `이전/목차/다음` — 목차 버튼은 `onGoToSeries`로 SeriesDetail 직접 이동(onBack과 구분). 본문 typography `text-[15px] leading-[1.8]` (RootPostCard 동일). |
| `EpisodeCommentBoard.tsx` | 🖋️ 회차 댓글 + 1단계 답글 (`parentCommentId`, depth 1). Soft delete(`isDeleted: true`) + placeholder. 작가 본인 댓글 뱃지 강조. 기존 useFirestoreActions.handleLike 패턴 차용(닉네임 likedBy, 평판 ±3, EXP milestone). |
| `EpisodeCommentForm.tsx` | 🖋️ 회차 댓글/답글 작성 폼 (`parentCommentId` prop으로 답글 모드). 기존 handleInlineReply 필드 구조 그대로. |
| `PaywallOverlay.tsx` | 🖋️ 유료 회차 미구매자 전용 페이월 (previewContent 미리보기 + 그라데이션 페이드 + 결제 박스). `sharePost` 무관, `sendThanksball` 아닌 `unlockEpisode` Cloud Function 호출. |
| `CreateSeries.tsx` / `EditSeries.tsx` | 🖋️ 작품 개설/수정. 수정 시 title/genre는 disabled (브랜드 일관성). 표지 교체 선택적 — 변경 안 하면 기존 URL 유지 (불필요한 R2 업로드 방지). |
| `CreateEpisode.tsx` / `EditEpisode.tsx` | 🖋️ 회차 작성/수정. 수정 시 episodeNumber/isPaid/price 수정 불가 (결제 형평성). 유료는 posts.content 빈 문자열 + private_data/content 서브문서 분리 저장 + previewContent 평문 200자. |
| `SubscribeButton.tsx` | 🖋️ 작품 구독 토글 + 구독자 수 표시. `series_subscriptions/{seriesId}_{uid}` 단일 문서 onSnapshot. 작가 본인은 비활성. `subscriberCount`는 Rules 카운터 화이트리스트 포함. |
| `SeriesGrid.tsx` / `SeriesCard.tsx` / `EpisodeListItem.tsx` | 🖋️ 작품 카탈로그 / 작품 카드 / 회차 목록 1줄. 차분 톤 통일. |
| `InkwellSummaryCards.tsx` | 🖋️ 작가 KPI 요약 카드 (마이페이지 나의 연재작 탭 상단). |
| `MarketHomeView.tsx` | 🏪 강변 시장 메인. 가판대/단골장부 2탭 + 카테고리 필터. sticky 헤더(잉크병/장갑 패턴). 탭별 버튼 분기(판매글 작성 Lv3+ / 상점 개설 Lv5+). |
| `MarketItemEditor.tsx` | 🏪 가판대 판매글 작성. 제목/티저/본문(Tiptap)/가격(1~100)/카테고리/태그/표지. 본문은 `private_data/content` 분리 저장. |
| `MarketItemDetail.tsx` | 🏪 가판대 상세뷰. 미구매: 티저+페이월. 구매: 전체 본문+별점+한줄평 리뷰. `purchaseMarketItem` callable. |
| `MarketShopEditor.tsx` | 🏪 단골장부 상점 개설. 이름/소개/가격(10~200)/표지. Lv5+만. |
| `MarketShopDetail.tsx` | 🏪 단골장부 상세. 구독 버튼 + 크리에이터 판매글 목록. `subscribeMarketShop` callable. |
| `MarketDashboard.tsx` | 🏪 크리에이터 대시보드. 수익 현황(판매/광고/총판매) + 판매글 관리(숨김/복귀) + 단골장부 구독자. |
| `KanbuRoomView.tsx` | 깐부방 상세 5탭(📋 자유 게시판 / 🔒 유료×2 / 💬 채팅 / 👥 멤버 / ⚙️ 관리). 유료 게시판 페이월 + 결제(`joinPaidKanbuRoom`). 관리: 유료 A/B 타입 설정 + 멤버 강퇴 + 방 수정/삭제. |
| `KanbuRoomList.tsx` | 깐부방 찾기 카드 그리드. 깐부 관계인 방만 [가입], 비깐부 🔒 표시. memberIds + memberCount 관리. |
| `MyKanbuRoomList.tsx` | 나의 깐부방 목록. `compact=true`: 사이드바 소형(컬러도트), `compact=false`: 메인 카드 그리드. |
| `ExileMainPage.tsx` | 🏚️ 유배자 메인. 3탭(놀부곳간/무인도/절해고도, 내 단계만 활성, 관전자는 3탭 모두 열람) + 상태카드 + 반성기간 카운트다운 + 속죄금 결제(`releaseFromExile`). 헤더 서브타이틀 간결화, 관전자 안내 배너 제거(2026-04-14). |
| `ExileBoard.tsx` | 🏚️ 유배지 게시판. 본인 단계만 글 작성 가능, 닉네임 자동 익명화(`곳간 거주자 #NNNN`), 외부 공유 금지. |
| `utils.ts — anonymizeExileNickname` | 🏚️ uid FNV-1a 해시 → `곳간 거주자 #NNNN` 결정적 변환. `useFirestoreActions`의 `handlePostSubmit`/`handleInlineReply`/`handleCommentSubmit`에서 유배글·유배댓글 저장 시 `author` 필드 치환(`author_id`는 실제 uid 유지). |
| `SayakScreen.tsx` | ☠️ 사약 처분 전용 전체화면. `sanctionStatus === 'banned'` 시 다른 UI 렌더 전에 이 화면만. 10초 카운트다운 → 강제 로그아웃. |
| `admin/ExileManagement.tsx` | 🏚️ 관리자 유배 관리 탭. 신고 목록 + 현재 유배자 목록(단계별 배지/90일 초과 경고) + [유배 보내기] + 수동 UID 입력 + ☠️ 직권 사약. |
| `admin/AppealReview.tsx` | ⚖️ 이의 제기 검토 탭. 대기/전체 필터 + 인용(해제 권고)/기각 + 대상자 알림 발송. |
| `admin/PlatformRevenueDashboard.tsx` | 💵 플랫폼 수익 대시보드. 잉크병/강변시장/정보봇 + 유배 시스템(속죄금 소각 + 사약 몰수) 카드. |
| `Sidebar.tsx` | `isExiled` prop — 유배자는 유배지+내정보만 노출. `activeMenu` 강제 이동은 App.tsx useEffect 가드. |

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
| RelatedPostsSidebar (🏚️ 유배·귀양지) | 좋아요·시간 필터 스킵, `isHiddenByExile`만 제외. 사이드바 제목 "게시글 더보기" |

---

## 금지 사항

- `write_file` / `Write` 도구로 기존 파일 전체 덮어쓰기 (신규 파일 제외)
- 요청 없는 리팩터링, 불필요한 주석·docstring 추가
- `firebase deploy` 자동 실행 (사용자 명시 요청 시에만)
- Git push 자동 실행 (사용자 명시 요청 시에만)
