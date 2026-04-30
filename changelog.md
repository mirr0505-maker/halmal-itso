## 8. 현재 구현 상태 (2026-03-24 기준, 코드 실측)

### 📢 ADSMARKET v3 — 피드 인라인 광고 (Native In-feed Ad) 도입 (2026-04-30)

> 글 목록 그리드에 글카드 형태 광고 인라인 — 글 작성자 RS 0%, 100% 플랫폼 수익. 등록글·카테고리 뷰만 노출 (사적 영역 보호).

**[1] 타입 + 백엔드 'feed' 슬롯 추가**
- [x] `src/types.ts`: `Ad.targetSlots` / `AdEvent.slotPosition`에 `'feed'` 추가
- [x] `functions/auction.js`: feed 슬롯은 `postAuthorLevel < 5` 게이팅 무시 (피드는 글 작성자 무관)
- [x] `functions/aggregateAdStats.js`: `bySlot` 초기화에 `feed: 0` 추가

**[2] AdFeedCard 신규 컴포넌트** ([src/components/ads/AdFeedCard.tsx](src/components/ads/AdFeedCard.tsx))
- [x] 일반 PostCard와 시각적 일관 (rounded-xl border-violet-200, hover 효과) + violet 톤 차별화
- [x] 좌상단 📢 광고 배지 (Brand Safety 정책 — 광고임을 명확 표시)
- [x] 16:9 이미지 + 헤드라인 + 설명 + 하단 광고주명/CTA 버튼
- [x] 매칭: `slotPosition='feed'`, `postId='feed-{categoryKey}'` 합성, `postAuthorId=''`, `postAuthorLevel=0`
- [x] 이벤트: IntersectionObserver 50%·1초+ → viewable / click → window.open + UTM(`utm_medium=feed`)
- [x] `previewAd` prop — 광고주 작성 폼 미리보기용 정적 렌더 (매칭/이벤트 모두 skip)
- [x] 광고 매칭 실패 시 null 반환 → 그리드 셀 자연 비움 (auto-fill로 다른 카드 채움)

**[3] AnyTalkList 청크 인터리브** ([src/components/AnyTalkList.tsx](src/components/AnyTalkList.tsx))
- [x] 청크 4번째 글(idx===3) 다음에 AdFeedCard 1장 인서트 (chunk.length > 4 가드)
- [x] React.Fragment wrapping으로 카드 + 광고를 그리드 셀로 동시 렌더
- [x] feedKey에 청크 인덱스 포함(`{feedKey}-{ci}`) → 청크별 매칭 fetch 분리 → 빈도 캡 자동 적용
- [x] 광고 밀도: 8글당 1광고 (12.5%) — 권장안 4:1보다 보수적, 베타 후 4:1 조정 검토 (P3-17)

**[4] 광고 노출 매트릭스** ([src/App.tsx](src/App.tsx))
- [x] 카테고리 뷰 (line 1218): `showAds={true}` `feedKey={category-${categoryKey}}` `feedCategory={categoryKey}`
- [x] 홈 피드 (line 1409): `showAds={activeTab === 'recent'}` `feedKey={home-${activeTab}}` (등록글 탭만 ON)
- [x] 공개 프로필 (line 1339): default `showAds=false` (특정 작성자 글 모음, 광고 OFF)
- [x] 새글/인기글/최고글/깐부글/구독글 OFF — 신선도/사적 영역 보호

**[5] 광고주 등록 UI 강화** ([src/components/advertiser/AdCampaignForm.tsx](src/components/advertiser/AdCampaignForm.tsx))
- [x] SLOT_OPTIONS에 `'feed'` 추가 + `group: 'body' | 'list'` 분류
- [x] 슬롯 위치 UI 본문/피드 그룹 분리 + 설명 텍스트 강화 ("본문은 작성자 RS, 피드는 100% 플랫폼")
- [x] 미리보기 — 본문 슬롯은 AdBanner / 피드 슬롯은 AdFeedCard 정적 렌더 (max-w 320px, pointer-events-none)
- [x] `targetSlots` 타입 캐스트 4곳 일괄 확장

**[6] 정책 결정 (베타 후 재검토)**
- 광고 밀도 4:1 → 첫 베타엔 8:1 (청크 8글 + 광고 1장)
- 작성자 광고 picker는 본문 슬롯만 (피드는 광고주 직접 광고 전용)
- 노출 화면: (a) 등록글·카테고리 뷰만 — 새글/인기글/최고글 제외

**[7] firestore.rules·indexes 영향**
- Rules 변경 0 (`targetSlots` 값 검증 없음, write 차단 필드 추가 없음)
- indexes 변경 0 (기존 `adEvents` 색인이 'feed' slotPosition 자동 커버)

**다음 P3 잔여**: P3-15 피드 빈도 캡 별도 limit / P3-16 단가 책정 / P3-17 4:1 조정 / P3-18 통계 분해 — D+7 안정성 검증 후 단계 진행. 진행 트래커 [AdsRoadmap.md](./AdsRoadmap.md) §P3.

### 📊 ADSMARKET v2.1++ — S-9~S-15 검증 + 광고주 의도 강제 + byRegion 보강 (2026-04-28, 커밋 1158a06~9a201a2)

> AdsTestScenarios.md 즉시 검증 13/13 + D+1 검증 2/2 통과. 검증 중 발견된 갭 일괄 수정.

**[1] AdMarketplaceModal — 광고주 의도 강제 (S-9, S-10, S-11)**
- [x] **Brand Safety 차단 picker UI**: `isBrandSafe(ad)` 검사 — 글 카테고리가 광고 `blockedCategories` 포함 시 회색 카드 + `🚫 카테고리 차단` 배지 + 안내 alert (커밋 `1158a06`).
- [x] **메뉴 매칭 강제**: `isMenuAllowed(ad)` 검사 — `targetMenuCategories` 외 카테고리 글에서 `🚫 메뉴 비매칭` 배지 + 안내. AdSlot directAd 분기에도 적용 — selectedAd라도 광고주 의도 위반 시 차단 (커밋 `628f684`).
- [x] **다른 슬롯 광고 안내 (S-10)**: S-9 수정 시 함께 검증 통과.
- [x] **region 정보 안내 (S-11)**: region은 viewer IP 기반이라 차단 X — `viewerRegionRef` mount 시 fetch + amber `ℹ️ 내 지역 미노출` 배지 + 클릭 시 confirm 다이얼로그 (커밋 `98a4ab5`).

**[2] adEvents 파이프라인 — viewerRegion 누락 해소 (S-14 후속)**
- [x] AdSlot의 모든 POST(viewable/click/directMatch impression)에 `viewerRegion` 포함 — viewerRegionRef로 mount 시 1회 fetch
- [x] auction.js의 4개 adEvents.add 분기 모두에 viewerRegion 저장
- [x] 효과: 다음 04:30 KST aggregateAdStats 실행 시 byRegion 정상 집계 → AdStatsModal 지역별 분해 표시 (커밋 `9a201a2`)

**[3] TODO 추가**
- [x] `users.region` 자동 채움 — PASS 본인인증 또는 IP 기반 + 마이페이지 수동 수정
- [x] 카카오 가입 시 이메일 미수집 — 비즈 앱 전환 또는 추가 입력 폼 (Sprint 8+)

**[4] 검증 결과 — AdsTestScenarios.md 트래커**
- [x] 즉시 검증 13/13 완료 (S-1~S-13)
- [x] D+1 검증 2/2 완료 (S-14, S-15) — byRegion만 D+2부터 정상화
- [ ] D+7 검증 0/3 (S-16, S-17, S-18) — 2026-05-03 안정성 데이터 누적 후

### 📊 ADSMARKET v2.1+ — S-8 빈도 캡 통과 + 후속 버그 3종 (2026-04-28, 커밋 707b2e2~0f07aee)

> AdsTestScenarios.md S-8 검증 진행 중 발견된 버그 3종 일괄 수정.

- [x] **S-8 빈도 캡 검증 — 옵션 A 적용**: AdSlot directAd useEffect에 24h viewable count 검사 추가 (`adEvents` 쿼리, viewerUid+adId+eventType+createdAt). count >= limit 시 setDirectAd(null) → 매칭 분기 fallthrough → 다른 광고 또는 빈 슬롯 (커밋 `707b2e2`).
- [x] **selectedAd impression 이중 누적 해소**: 매칭 useEffect에서 `selectedAdId && selectedAdId !== 'auto'`이면 매칭 fetch skip + setLoaded(true). 기존 directAd 비동기 set 사이에 매칭 분기가 실행되어 같은 광고가 또 매칭되던 버그 해소 (커밋 `fb96806`).
- [x] **신규 등록 alert 누락 보강**: AdCampaignForm 신규 등록 분기에 검수 대기 안내 alert 추가 (수정 모드와 일관). pending_review/draft별 메시지 분기 (커밋 `0f07aee`).
- [x] **검증 결과 정리**: AdsTestScenarios.md S-8 통과 표시 + 후속 버그 3종 정리 ✅ 2026-04-28.

### 📊 ADSMARKET v2.1 — 광고주 검수 의무화 + 안정화 일괄 (2026-04-26, 커밋 adb67bc~67506c3)

> v2 P0~P1 7항목 도입 직후, 광고주 검수 의무화 + 운영 안정성 보강 + 다수 버그 수정 일괄.

**[1] 광고주 검수 의무화 (커밋 adb67bc / 0f9e3f6)**
- [x] AdvertiserAccount.status 'pending_review' | 'active' | 'rejected' | 'suspended' | 'dormant' (rejectionReason / reviewedAt / reviewedBy)
- [x] AdvertiserRegister: status='pending_review' 의무화 + user 정보(닉네임·이메일) 자동 인입
- [x] AdvertiserCenter: pending_review/rejected 상태 시 [+ 새 광고] 잠금 + amber/rose 안내 배너
- [x] **AdvertiserReviewQueue 신설**: AdAdminPage '🏢 광고주 검수' 탭 + 카드형 큐 + 승인/거절(사유)
- [x] firestore.rules: 검수 필드(status/rejectionReason/reviewedAt/reviewedBy/isVerified) 본인 수정 차단, 관리자만 변경. read는 본인 또는 admin
- [x] firestore.indexes: advertiserAccounts (status, createdAt) 복합 색인

**[2] 검수 요청 알림 + NotificationBell 분기 (커밋 adb67bc / 0f9e3f6)**
- [x] **functions/reviewNotify.js 신설**: onAdPendingReview / onAdvertiserPendingReview Firestore Trigger. Auth Admin SDK listUsers로 admin Custom Claims 자동 조회 → 일괄 알림
- [x] NotificationBell type 5종 추가 + isAdReviewNotif 분기 (이전 fallback "X님이 볼을 보냈어요" 해소): ad_pending_review / advertiser_pending_review / advertiser_approved / advertiser_rejected / ad_budget_paused
- [x] 아이콘 매핑 (📋/🏢/✅/❌/📊)

**[3] 광고 경매시장 모달 개선 (커밋 48c8c2a)**
- [x] 슬롯 필터 제거 — 모든 활성 광고 표시
- [x] 매칭 광고 우선 정렬 → 비매칭 광고는 회색 + 🚫 다른 슬롯 배지 + 클릭 시 안내 alert
- [x] 헤더 카운트: 📌 이 슬롯 매칭 X개 / 전체 활성 Y개

**[4] 슬롯 라벨 + 12개 작성 폼 picker 적용 (커밋 479f4b0)**
- [x] AdSlotSetting SLOT_UNLOCK_LEVEL 매트릭스 일치 (top:7/middle:5/bottom:9 — 이전 middle:9/bottom:5 잘못됨)
- [x] 10개 작성 폼에 selectedAds + onSelectAd + postCategory props 일괄 적용 (CreateBoneHitting / CreateDebate / CreateExile / CreateGiantTree / CreateKnowledge / CreateLocalNews / CreateMarathonHerald / CreateMarket / CreateNakedKing / CreateOneCutBox)

**[5] 작성 폼 입력 영역 확장 + AdSlotSetting 외부 분리 (커밋 827e48f / 1fd4abe)**
- [x] 12개 작성 폼 외곽 패딩 py-8→py-4 + maxHeight calc(100vh-80px)→calc(100vh-32px) — 약 80px 확장
- [x] AdSlotSetting을 폼 카드 외부로 분리 — 광고 슬롯 picker 잘림 완전 해소 (옵션 B)

**[6] 헤더 라벨·가시성 정리 (커밋 c8bf34f / b76c26b)**
- [x] 광고 ON/끄기 토글을 정보 옆(좌측)으로 이동 — 가시성 ↑
- [x] '📢 광고 ON' → '📢 광고 켜기', '▼ 자세히' → '▼ 열기'
- [x] ▼ 열기 버튼: 흰 배경 + 보라 테두리 + 그림자 (강조) / ▲ 닫기는 회색

**[7] 이미지 잘림 수정 (커밋 adb67bc)**
- [x] AdBanner 가로형 + AdCampaignForm 업로드 박스 모두 object-cover → object-contain (1500×500 외 비율도 잘림 0)

**[8] 광고 클릭 랜딩 URL protocol 자동 부착 (커밋 ad1b8f1)**
- [x] AdBanner: ensureProtocol() — http(s):// 없으면 자동 https:// 부착 (런타임 보정)
- [x] AdCampaignForm: 등록·수정 시점에도 safeLandingUrl 저장 (재발 방지)

**[9] 광고 수정 권한 에러 해소 (커밋 ea5ca73)**
- [x] AdCampaignForm 수정 모드 setDoc { merge: true } — Rules 차단 필드(pausedReason/todaySpent 등) 페이로드 누락으로 affectedKeys 거부되던 문제 해소

**[10] TDZ + adEvents 색인 (커밋 8cd911b)**
- [x] AdSlot handleAdClick 호이스팅 fix (Cannot access _ before initialization 해소)
- [x] adEvents 색인 (adId, eventType, viewerUid, createdAt ASC)로 순서 정정 — 빈도 캡 쿼리 500 에러 해소

**[11] 카운터 이중 증가 + selectedAd impression 누락 (커밋 965754e)**
- [x] **updateAdMetrics 트리거 카운터 증가 코드 제거** — auction.js가 단일 진실원 (이전 트리거+auction.js 중복으로 totalClicks +2씩 누적되던 버그 해소)
- [x] AdSlot directAd useEffect에 impression POST 추가 (광고당 1회 impressionFiredRef 중복 차단)
- [x] auction.js directMatch impression 분기 신설 — selectedAdId 광고도 totalImpressions 정상 카운트

**[12] 비율 표시 clamp (커밋 67506c3)**
- [x] AdCampaignList viewableRate / CTR 100% 상한 clamp (비정상 데이터 방어)
- [x] updateAdMetrics 트리거 ctr 0~1 clamp

**[13] 검증 시나리오 정리 (커밋 17d02a7)**
- [x] **AdsTestScenarios.md 신설** — 18 시나리오 self-contained (즉시 검증 13 / D+1 2 / D+7 3) + 진단 명령어 + Firestore 핵심 문서 + 알림 type 5종

### 📊 ADSMARKET v2 — P0~P1 7항목 일괄 도입 (2026-04-26, 커밋 2f47252)

> AdsRoadmap.md 7건 일괄 — 광고주 신뢰·사용자 보호·UX 고도화 패키지.

- [x] **P0-1 일/총 예산 자동 차감·정지**: `ads.{pausedReason, todaySpent, lastSpentResetAt}` 신설 + `functions/budgetEnforcer.js` (enforceBudgetLimits 매시간 + releaseDailyBudgetPause 매일 04:00 KST). AdCampaignList 예산 게이지(일/총, 80%↑ amber, 95%↑ rose) + 📊 예산소진 배지. ad_budget_paused 알림.
- [x] **P0-2 빈도 캡 (Frequency Cap)**: `ads.frequencyCap` (default 24h 3회). auction.js 매칭 직전 viewerUid+adId N시간 viewable count 검증. AdCampaignForm 빈도 제한 섹션 (기간 + 회수). adEvents (viewerUid, adId, eventType, createdAt) 색인.
- [x] **P0-4 Viewable Impressions (IAB 표준)**: `adEvents.eventType` 'viewable' 신설 + `ads.viewableImpressions`. AdSlot IntersectionObserver 50%·1초+ 충족 시 viewable 발사 (광고당 1회 ref). 차감은 viewable 기준 — impression은 카운트만 (광고주 보호).
- [x] **P0-3 광고주 통계 대시보드**: `ad_stats_daily/{adId}_{yyyymmdd}` 신설 + `functions/aggregateAdStats.js` (매일 04:30 KST). AdStatsModal — KPI 4종 + 일별 SVG 라인(노출 violet · 클릭 amber) + 분해 3종(슬롯/메뉴/지역) + 24h 시간대 히트맵. 라이브러리 없이 SVG 직접. AdCampaignList [📊 통계] 진입.
- [x] **P1-5 UTM 자동 부착**: AdBanner 클릭 시 `?utm_source=geulove&utm_medium={slot}&utm_campaign={adId}` 자동 추가. 외부 GA·Naver Analytics 연동 가능.
- [x] **P1-7 예상 일 노출 추정**: `functions/estimateAdReach.js` (callable) — 7일 ad_stats_daily 평균 + 단가 가중. AdCampaignForm 입찰 섹션에 실시간 추정 카드(debounce 500ms · 24px 큰 숫자).
- [x] **P1-8 Brand Safety**: `ads.blockedCategories` (default ['유배·귀양지']). auction.js 차단 카테고리 매칭 시 후보 제외. AdCampaignForm Brand Safety 섹션.
- [x] **firestore.rules**: 7개 신규 필드(pausedReason/todaySpent/lastSpentResetAt/viewableImpressions/totalSpent/totalImpressions/totalClicks) 클라 직접 쓰기 차단. ad_stats_daily read=auth, write=false.
- [x] **firestore.indexes**: adEvents (viewerUid+adId+eventType+createdAt), ads (status+pausedReason), ad_stats_daily (adId+date) 색인 추가.
- [x] **AdsRoadmap.md** 신설 — 13항목 종합 계획서 + 진행 트래커.
- 다음(P1-6 A/B 다중 소재): D+7 안정성 검증 후 착수 권장.

### 🌏 ADSMARKET — 광고 노출 지역 타겟팅 UI + Cloudflare Worker /region (2026-04-26)

- [x] **AdCampaignForm 노출 지역 섹션**: 전국(default) / 특정 지역만 라디오 + 6개 빠른 선택 묶음(수도권·영남·호남·충청·강원·제주) + 17개 시·도 체크박스 그리드 + 선택 카운트. setDoc 하드코드 `[]` 제거 → form.targetRegions 저장.
- [x] **AdMarketplaceModal**: 카드 배지 `🌏 전국`/`🌏 서울·경기` + 미리보기 패널에 `🌏 노출 지역` 행.
- [x] **AdReviewQueue**: 라벨 통일 (`🌍 → 🌏 노출 지역`).
- [x] **halmal-link-preview Worker `/region` endpoint**: `request.cf.{region, country, city}` 직접 반환. CORS·rate limit 0, 무료 무제한.
- [x] **getViewerRegion**: ipapi.co → Worker endpoint 교체. ipapi.co CORS 차단·429 폭주 이슈 해소. in-flight singleton + 30분 negative cache.

### 📢 ADSMARKET — 광고 경매시장 모달 + 작성자 직접 선택 + 본문 내 슬롯 (2026-04-26)

- [x] **AdMarketplaceModal 신설**: 좌(그리드 2열 컴팩트 카드) + 우(미리보기 sticky 패널). 검색·메뉴 일치 필터·정렬·무한 스크롤(20개/페이지). 카드 hover 갱신 제거(떨림 차단). 카드 클릭 = preview 갱신, 우측 [✓ 선택] = 최종 적용. 자동 매칭도 동일 패턴.
- [x] **자동 매칭 명시 결정 vs default 미선택 구분**: `selectedAds[pos] = 'auto'`(명시) / undefined(default) / 광고ID(직접). picker 라벨 3분기.
- [x] **AdSlot React Hooks 규칙 위반 수정**: 두 번째 useEffect를 early return 앞으로 이동. ErrorBoundary 무한 재마운트(페이지 새로고침 반복) 해결.
- [x] **본문 내 광고 슬롯**: top/middle inside RootPostCard (topSlot/middleSlot props), bottom outside. 작성자가 글마다 슬롯별 광고 선택 또는 자동 매칭.
- [x] **ctaText 빈 입력 가드**: AdBanner fallback `'자세히 보기'` + AdCampaignForm safeCtaText.
- [x] **firestore.indexes.json**: notifications/items 컬렉션 (type, createdAt) 인덱스 추가 — pendingTitleModal 쿼리 인덱스 누락 해소.

### 📢 ADSMARKET 전면 개편 — UI·단위·매칭·결제·수정 (2026-04-25)

- [x] **광고 스타일 2종**: `imageStyle: 'horizontal' | 'vertical'`. 가로 플래카드형(3:1 + 하단 텍스트) / 세로형(9:16 + 좌·우 위치 선택 + 반대편 텍스트). 폼·미리보기·실제 노출 모두 분기.
- [x] **카테고리 매칭 재설계**: `targetCategories` 업종 통계용으로 분리, 신규 `targetMenuCategories`만 매칭에 사용. AD_MENU_CATEGORIES label/value 분리 (참새들의 방앗간 ↔ DB "너와 나의 이야기" 등).
- [x] **단위 통일 ₩ → ⚾**: AdCampaignForm 입찰가/일예산/총예산 라벨, AdCampaignList/AdReviewQueue 표시, AdvertiserCenter 광고비 잔액 카드(원) 제거 → 내 땡스볼 단일. revenue.js 작성자 환원도 ballBalance/ballReceived increment (즉시 사용 가능).
- [x] **광고 수정 기능**: `editingAd` prop으로 폼 수정 모드, 누적 통계·createdAt·adId 보존, 저장 시 status pending_review 자동 전환(재검수).
- [x] **이미지 업로드 드롭존**: 16:9/9:16 큰 점선 박스 + 미리보기 + ✕ 삭제 / 📷 교체.
- [x] **AdSlotSetting 가시성 강화**: 한 줄 헤더 + ▼ 자세히 토글, Lv 1~4도 호기심 유발 토글, OFF→[광고 ON] CTA. 11개 작성 폼 max-w 860 → 1024.
- [x] **광고주 임시 충전**: 충전/결제 탭에 testChargeBall 호출 (+100/+200/+500/+1000볼). 정식 PG 도입 전 베타용.
- [x] **AdReviewQueue try/catch**: 승인/거절 실패 시 즉시 alert (낙관적 UI 깜깜이 사고 방지).
- [x] **인덱스**: ads `advertiserId + createdAt`, reports `status + createdAt` / `targetId + status` 추가.
- 보류: 광고주 노출당 ballBalance 차감(`project_ad_billing_advertiser_charge.md`), 레거시 메뉴명 일괄 정리.

### 📒 Sprint 9 Batch 2 — unlockEpisode ball_transactions 표준 원장 (2026-04-25)

- [x] **잉크병 유료 회차 결제(`unlockEpisode`)** 트랜잭션 내부에 `ball_transactions/{unlock_postId_buyerUid}` 표준 스키마 set. resolvedRecipientUid=author, receiverBalanceBefore/After=null(작가 ballBalance 변화 없음 — ballReceived만 누적), platformFee=11%, sourceType="unlock_episode".
- [x] ballAudit이 outflow 집계 시 unlockEpisode 차감을 자동으로 잡을 수 있게 됨. 다음 Batch 2 후보: purchaseMarketItem / subscribeMarketShop.

### 🛡️ Sprint 6 A-3 — 닉네임 fallback 제거 · Custom Claims 단일 체크 (2026-04-25)

- [x] **functions/utils/adminAuth.js**: `ADMIN_NICKNAMES = []`, `assertAdmin`은 `auth.token.admin === true`만 통과, `isAdminByUid` 항상 false.
- [x] **firestore.rules `isAdmin()`**: 닉네임 화이트리스트 조건 제거. Claims 단일.
- [x] **AdminGuard.tsx**: `useAdminAuth` nickname fallback 3곳 제거, loading 초기값 true.
- [x] **사전 절차**: 흑무영 + Admin 백업 계정에 grantAdminRole로 Custom Claims 부여 → "내 토큰 갱신" → admin_actions에 viaClaims=true 첫 통과 확인 후 코드 변경.
- [x] **락아웃 복구 경로**: Firebase Console → Auth → uid → 맞춤 클레임 `{"admin":true}` 수동 주입.
- 닉네임 도용/변경 공격 표면 완전 차단. 권한이 ID Token 서명에 박힘.

### 🚨 신고 시스템 Phase A + B — 3단계 threshold · 카테고리 차등 · 작성자 이의제기 (2026-04-24)

- [x] **9 카테고리 개편**: spam_flooding/severe_abuse/life_threat/discrimination/unethical/anti_state/obscene/illegal_fraud_ad/other. "기타" 선택 시에만 50자 사유 입력 필수
- [x] **3단계 threshold 매트릭스**: `CATEGORY_THRESHOLDS`에 9 카테고리 × 3 state(review/preview_warning/hidden) = 27개 임계값. 지배적 reasonKey로 threshold 선택 → 상태 승격 전용(복구는 관리자만)
  - 즉시 대응: obscene/life_threat(1→2→2), illegal_fraud_ad(2→2→3)
  - 표준: spam_flooding/severe_abuse/discrimination(3→5→7)
  - 엄격: unethical/anti_state(5→8→12) — 편향 공격 방어
- [x] **상태별 UI**: `ReportStateBanner` 컴포넌트 — review=⚠️ 배지 / preview_warning=🚫 "계속 열람" 게이트 / hidden=🙈 작성자만 보이는 복구 안내 배너. 4개 상세뷰(DiscussionView/OneCutDetailView/CommunityPostDetail/EpisodeReader)에 주입
- [x] **작성자 알림**: 상태 전환 시(review/preview/hidden 첫 진입) `notifications` 자동 발송 (type: report_state_change)
- [x] **이의제기 Phase B**: `submitContentAppeal` 신규 CF — 작성자 본인 확인 + 5~500자 사유 + `appealStatus='pending'` 세팅. 배너에 [⚡ 이의제기] 버튼 + 모달 통합
- [x] **관리자 우선큐**: `ReportManagement.tsx` 상단에 "⚡ 이의제기 우선큐" 섹션 — posts + community_posts에서 `appealStatus='pending'` 실시간 구독 (limit 50 각각), 작성자 사유 + 신고 정보 함께 표시
- [x] **복구 Flow 강화**: `restoreHiddenPost` CF가 이의제기 해결 + 작성자 알림(`appeal_accepted` 또는 `report_restored` 타입) + 상태 전체 리셋(reportState=null)
- [x] **types.ts**: Post + CommunityPost에 `reportState`, `reviewStartedAt`, `previewWarningStartedAt`, `dominantReason`, `appealStatus`, `appealNote`, `appealAt` 7필드 추가
- [x] **배포**: functions:submitReport/submitContentAppeal/restoreHiddenPost + hosting 2회 배포
- [x] **문서화**: [FLAGGING.md](./FLAGGING.md) 독립 설계서 신설 (~370 라인). §1 설계 원칙 / §2 9 카테고리 × 3단계 threshold 매트릭스 / §3 State Machine / §4 사용자 flow / §5 관리자 flow / §6 이의제기 flow / §7 CF 인덱스 / §8 Firestore 스키마 / §9 Creator Score 연동 / §10 알림 타입 5종 / §11 보안·악용 방어 / §12 튜닝 이력 / §13 용어 / §14 Phase C~E 로드맵 / §15 파일 인덱스. `CLAUDE.md` 프로젝트 레퍼런스 목록에 추가. 이름은 "REPORT"가 너무 광범위해 업계 표준 "FLAGGING"(신고 행위) 채택

### 🚨 신고 시스템 전면 개편 — 4단계 일괄 (2026-04-24)

- [x] **Phase 1 UX 개선**: `ReportModal` 컴포넌트 신설 (사유 8종 라디오 + 상세 300자) — `window.prompt` 대체. `reportHandler.ts`는 커스텀 이벤트(`halmal:open-report-modal`) 기반 전역 모달로 재설계 → `App.tsx`에 `<ReportModalHost />` 루트 마운트. 기존 8곳 호출부 시그니처 유지. 신고자 본인 localStorage 블라인드(`hiddenByMe`) + App 피드 필터 적용 (`!hiddenByMe.has(p.id) && !p.isHiddenByReport`)
- [x] **Phase 2 자동 임시 숨김 + 일일 상한**: `submitReport` CF 확장 — 제출 직후 `reports.where(targetId)` 집계로 고유 신고자 수 계산, 3명+ 도달 시 대상 문서 `isHiddenByReport=true` + `hiddenByReportAt` 즉시 쓰기. `reporter_daily_quota/{uid}_{date}` 컬렉션으로 1인 1일 10건 상한. `reasonKey` 화이트리스트 8종(spam/abuse/flooding/copyright/misinformation/harassment/privacy/other)
- [x] **Phase 3 관리자 조치 CF 3종 + UI**: 신규 `resolveReport`(action: hide_content/delete_content/warn_user/none + 사유 + notifyParticipants) / `rejectReport`(기각) / `restoreHiddenPost`(오탐 복구). AdAdminPage 신규 탭 `🚨 신고 관리` → `ReportManagement.tsx` — 상태 필터(⏳ 대기/✅ 처리됨/🚫 기각), targetId별 그룹화(고유 신고자 수 강조·심각도 색상), ResolveModal(조치 4종 라디오 + 사유 + 알림 옵션), 자동 숨김된 건 복구 버튼 노출. 같은 타겟 pending 신고 일괄 resolve/reject
- [x] **Phase 4 알림 + 기각 카운트**: `resolveReport` 성공 시 `notifyParticipants=true`이면 신고자들에게 `type: report_resolved` 알림, `action=warn_user` 시 피신고자에게 `type: report_warning` 알림. `rejectReport`는 `users.reportsSubmittedRejected` 증가로 악성 신고자 판별 지표 (관리자 수동 판단용)
- [x] **Rules 보강**: `reports.read: isAdmin`(목록 UI 필수), `reporter_daily_quota` 전면 차단(CF 전용), users 차단 필드에 `reportsSubmittedRejected*` 추가. `isHiddenByReport`는 CF Admin SDK 전용 쓰기(작성자 본인 update 허용 리스트에 없음)
- [x] **types.ts**: Post에 `reportCount`, `isHiddenByReport`, `hiddenByReportAt` 3필드 추가
- [x] **문서화**: 신고 제출 flow · 자동 숨김 · 관리자 조치 · Creator Score 연동 · 알림 경로 · 제재 옵션 · 보안 요소 전 구간 정리. 어디서 신고 볼 수 있는지(AdAdminPage/Firestore/admin_actions)·제재 어떻게 하는지 전체 커버
- [x] **배포**: functions 4종(submitReport/resolveReport/rejectReport/restoreHiddenPost) + rules + hosting 일괄

### 📱 PhoneVerifyScreen provider-already-linked 재시도 내성 (2026-04-24)

- [x] **증상**: 네이버 OAuth 가입 도중 온보딩 미완료 상태에서 재로그인하면 폰 인증 단계에서 `auth/provider-already-linked` 에러 → 재시도 영구 차단 (Firebase Auth 유저를 수동 삭제해야만 진행 가능했음)
- [x] **원인**: `linkWithCredential(auth.currentUser, credential)`이 이미 phone provider 연결된 유저에겐 무조건 실패. Firestore users 문서만 삭제해도 Firebase Auth 레코드는 남아 phone 링크 유지 → 재시도 차단
- [x] **수정**: [PhoneVerifyScreen.tsx:116](src/components/PhoneVerifyScreen.tsx#L116) — `auth.currentUser.providerData.some(p => p.providerId === "phone")`로 사전 체크 후 이미 연결됐으면 `linkWithCredential` 스킵하고 바로 `verifyPhoneServer` CF 호출. OTP 검증은 서버가 phoneNumber 필드 직접 읽어 수행하므로 link 스킵해도 무결성 유지됨
- [x] **검증**: mirr222@naver.com 계정으로 재시도 → phone 스킵 로직 작동 → 닉네임 "판교부엉" 설정 → 온보딩 완료 진입 ✅
- [x] **부가 효과**: 네이버 OAuth의 모든 엣지 케이스 해결 — 신규 회원가입, 완료된 계정 로그인, 미완료 계정 로그인(온보딩 이어가기), phone 중복 연결 재시도

### 🔒 OAuth intent 보안 루프홀 핫픽스 — 'either' → 'login' (2026-04-24)

- [x] **증상**: 유저가 "네이버로 로그인" 클릭 → 미가입 상태였던 네이버 계정이 말없이 신규 생성 + 온보딩(폰·닉네임) 플로우 진입
- [x] **원인**: `naverAuth.js`/`kakaoAuth.js`의 `safeIntent = intent === "login" || "signup" ? intent : "either"` → client redirect 왕복 중 `sessionStorage.naverAuthIntent` 유실 시 CF에 intent='either'로 도달 → CF가 `login && !exists` 체크를 우회(both 분기 skip) → 신규 users 문서 말없이 생성
- [x] **수정**: 기본값을 `"either"` → `"login"`으로 보수적 변경 (functions/naverAuth.js L63, functions/kakaoAuth.js L62). intent 불명이면 명시적 404 "등록된 계정이 없어요" 반환. 회원가입은 명시적 signup intent만 허용
- [x] **관련 UI 개선**: PhoneVerifyScreen에 `auth/account-exists-with-different-credential` 전용 에러 분기 추가 — "이 번호는 이미 다른 계정(다른 SNS)에 등록되어 있습니다" 명확 안내
- [x] **배포**: `firebase deploy --only functions:naverAuthCustomToken,functions:kakaoAuthCustomToken,hosting`
- [x] **박제**: [feedback_oauth_intent_strict.md](memory) — 향후 Apple/기타 OAuth 추가 시 동일 패턴 유지 필수
- [x] **후속 검토**: client 측 intent 유실 방지는 별도 이슈 — 현재는 sessionStorage 의존. redirect state 파라미터에 intent 인코딩 방식으로 강화 가능 (Sprint 8+ 이월)

### 🎁 Sprint 7 백필 핫픽스 — 기존 유저 referralCode 일괄 부여 (2026-04-24)

- [x] **증상**: 테스트 계정 전원이 MyPage 추천 탭에서 "추천코드 발급 중입니다. 잠시 후 새로고침 해주세요" 무한 노출. Firestore 실측 — `users.referralCode` 필드 없음
- [x] **원인**: Sprint 7 `generateReferralCode`는 **onCreate 트리거**로만 배포 → 트리거 배포 이전 가입자(테스트 계정 전부)는 자동 발급 안 탐. `migrateUserCodes`(Sprint 7.5)는 userCode만 처리하고 referralCode 백필 CF 부재
- [x] **신규 CF**: `functions/backfillReferralCodes.js` — generateReferralCode와 동일 로직(6자리, 충돌 5회 재시도, 8자리 폴백), 전체 유저 조회 후 referralCode 없는 유저만 필터. assertAdmin + admin_actions 로깅. 멱등 재실행 안전. BATCH_SIZE=50
- [x] **UI**: `AdAdminPage 🔧 시스템 탭` → "🎁 기존 유저 referralCode 일괄 부여" 버튼 (feedback_admin_cf_ui_button 원칙)
- [x] **배포·실행 결과**: 32명 scanned / 28명 target / 28명 assigned / 0 errored / 544ms. 깐부7호 `TN2E54` 발급 확인 → `https://geulove.com/r/TN2E54` 공유 링크 정상. referral_codes/{code} 문서 전 필드 정상
- [x] **부가 관찰**: Web Share API는 모바일에서만 카톡 등 네이티브 공유 시트 제공. 데스크톱에서 카톡 바로 공유하려면 Kakao JS SDK 연동 필요 — Sprint 8 이월

### 🖋️ EpisodeReader 개선 3종 (2026-04-24)

- [x] **⋮ 드롭다운 렌더 버그 해결**: `<button>` 기본 `display: inline-block` + 래퍼에 flex 지시자 없음 → `whitespace-nowrap`이 4개 버튼을 한 줄 576px로 몰아넣음 + `overflow-hidden`이 첫 버튼만 남기고 3개 잘라냄. `flex flex-col` 1 클래스 추가로 해결. MutationObserver로 DOM 실측해 DOM 자체는 4개 렌더(공개프로필/신고/수정/삭제)됐으나 CSS 클리핑 확정 → 해결 후 배포
- [x] **상단 액션바 재정리**: ⋮ 안에 숨겨있던 수정/삭제를 RootPostCard/DebateBoard 패턴에 맞춰 `[수정][삭제][공유][⋮]` 텍스트 버튼으로 외부 노출. 작가 본인만 수정·삭제 표시, 비작가는 공유·⋮만. ⋮에는 공개프로필/신고(누구나) + 다시공개(작가+비공개 회차) 유지
- [x] **⋮ 교훈 박제**: 드롭다운/메뉴 컨테이너엔 반드시 `flex flex-col` 또는 유사 vertical layout 지시자 필수. 버튼 기본 display 신뢰하지 말 것 → [feedback_dropdown_vertical_layout.md](memory) 신설

### 🟢 Sprint 8 Track — 네이버 OAuth 엔드투엔드 첫 테스트 통과 (2026-04-24)

- [x] **배포 상태 실측**: `naverAuthCustomToken` CF 이미 asia-northeast3 배포 완료(메모리 256MiB) + Secret Manager `NAVER_CLIENT_ID`/`NAVER_CLIENT_SECRET` 주입 + WelcomeScreen 네이버 버튼·useAuthActions Authorization Code Flow 구현 완료 상태. 남은 건 실 가입 테스트.
- [x] **Naver Developer Console 설정**: Callback URL `https://geulove.com/` + 테스터 계정 등록 + 제공 정보(이메일·닉네임) 동의
- [x] **테스터 가입 검증**: `ksgn016@naver.com` (닉네임 "성경책") — `naver.com OAuth 동의` → `/?code=...&state=...` 복귀 → CF 호출 → Firebase Custom Token → 온보딩 3단계(폰 `+82 10-1111-1111`→닉네임→추천코드 건너뛰기) → 가입 완료
- [x] **Firestore 문서 검증**: 문서 ID `naver_yJ93GX4_HHENAM2mvQeUEBGqUFLGG4CFzF2i-XjsPfs` · `provider: "naver"` · `email: "ksgn016@naver.com"` · `phoneVerified: true` + `phoneHash` · `nicknameSet: true` + `nicknameSetAt` · `userCode: "YUEA6RUZ"` · `referralCode: "AKSSK2"` · `titles: [pioneer_2026]` (Sprint 5 자동 부여) · `onboardingCompleted: true`
- [x] **관찰**: `isPhoneVerified: false` / `phoneVerified: true` 이중 필드 공존 — 의도된 상태(useAuthActions L138 주석 "isPhoneVerified는 legacy, 게이트 무관"). userCode 참조 전환 Sprint(Sprint 8+)에서 일괄 정리 예정
- [x] **현 단계**: Naver Developer Console 개발 단계(테스터 목록 등록된 계정만 로그인 가능). 정식 서비스 오픈 전 검수 신청 필요
- [x] **메모리**: [project_sprint8_backlog.md](memory) 업데이트 — 카카오·네이버 ✅ · Apple(원래 계획 유지) · X/Facebook 반려

### 📒 Sprint 9 Batch 1 — 볼 원장 통일 2경로 (nickname.js + gloveBot.js, 2026-04-24)

- [x] **nickname.js 스키마 정규화**: 기존 `ball_transactions` 레코드가 `{uid, timestamp, amount:음수}` 구스키마라 ballAudit의 `senderUid/createdAt` 쿼리에 잡히지 않음 → thanksball 표준 스키마(`senderUid/senderNickname/resolvedRecipientUid:null/amount:양수/balanceBefore/After/receiverBalanceBefore/After:null/platformFee:0/sourceType:"nickname_change"/details/createdAt`)로 재작성. `details.{oldNickname,newNickname}` 보존
- [x] **gloveBot.js activateInfoBot 원장 신설**: 기존엔 `glove_bot_payments` 영수증만 있고 `ball_transactions` 레코드 없어 ballAudit outflow 집계 누락. 트랜잭션 내부(차감 직후)에 표준 스키마 레코드 추가. `platformFee: 20`(전액 수익)
- [x] **senderNickname 폴백 버그 hotfix**: `request.auth.token?.name || "익명"` 단일 소스 → OAuth 공급자(구글/카카오)만 채우는 필드라 email/pw 계정은 항상 "익명"으로 기록됨. thanksball 표준 패턴(`userData.nickname || token?.name || "익명"`)으로 전환. `glove_bot_payments.payerNickname`도 동시 수정
- [x] **검증**: 깐부10호(email/pw 계정) 2회 활성화 테스트 — 1차 `senderNickname:"익명"` → 버그 확인 → 2차 `senderNickname:"깐부10호"` ✅. 잔액 131→111→91 정확 차감. `resolvedRecipientUid:null` platform sink 확정
- [x] **원장 구조**: platform sink(`resolvedRecipientUid:null`)는 ballAudit L46-53에서 outflow만 집계하고 inflow 스킵 — 유출 없이 "플랫폼 소각"으로 정확히 잡힘
- [x] **잔여 Sprint 9 경로**: `unlockEpisode`, `purchaseMarketItem`, `subscribeMarketShop`, `joinPaidKanbuRoom`, `releaseFromExile`, `executeSayak`, `kanbuPromo` 재정비(3-bis 제거) — 차기 Batch

### 🚑 ogRenderer OOM 핫픽스 — 메모리 128MiB → 256MiB (2026-04-24)

- [x] **증상**: 모바일에서 공유된 글카드 탭 시 "Internal Server Error" + 카카오톡에서 카드 미리보기 안 뜨고 bare URL로만 표시
- [x] **원인**: `ogRenderer` CF 인스턴스가 기동 시점에 128MiB 한도를 131~132MiB로 초과 → Default STARTUP TCP probe 실패 → 500 반환. Firebase Admin SDK + Firestore SDK + fast-xml-parser 로드만으로 기본 heap이 임계치 근접.
- [x] **수정**: [functions/index.js:286](functions/index.js#L286) `memory: "128MiB"` → `"256MiB"` (1줄)
- [x] **배포**: `firebase deploy --only functions:ogRenderer` · 신규 리비전 `ogrenderer-00035-wup` · allTrafficOnLatestRevision=true
- [x] **검증**: `curl -I /p/test` → `HTTP/1.1 200 OK` · 로그 `STARTUP TCP probe succeeded after 1 attempt` · OOM 로그 종료
- [x] **2차 영향**: KakaoTalk 크롤러도 500 받아 unfurl 실패했던 것 — 동일 원인 · 동일 배포로 해소. 기존 공유 링크는 카톡 측 캐시 때문에 재크롤링 전까지 bare URL 유지 (새 공유부터 정상 카드)

### 🛠️ 운영 개선 3종 — ballAudit false critical 해소 · 봇 스케줄 완화 · 채팅 UI 정돈 (2026-04-23)
> 설계: [project_info_bot_schedule.md](memory) · [GLOVE.md](./GLOVE.md) §10 변경 이력

- [x] **ballAudit false critical 해소** (배포 완료)
  - 원인: `kanbuPromo` 홍보 결제가 `ballBalance` 차감만 하고 `ball_transactions` 원장을 쓰지 않아 `auditBallBalance`가 `diff < 0` critical로 오판 (2026-04-23 오전 1건 발생 — 깐부7호 1주일 플랜 6볼)
  - 근본 수정(A-1): `functions/kanbuPromo.js` — 차감 트랜잭션 내부에 `kanbu_promo_history/{uid}_{ts}` 영수증 동시 기록 (`uid/cost/plan/days/paidAt`)
  - 크로스체크(B): `functions/ballAudit.js` — 3-bis 단계에서 `kanbu_promo_history`를 24h 조회해 `outflow` 집계에 합산
  - Rules: `firestore.rules` — `kanbu_promo_history` 블록 read/write false (Admin SDK 전용)
  - 스모크: 깐부2호 1일 플랜 1볼 결제 → 영수증 `cost=1, plan="1일"` 생성 확인
  - 잔여 7경로(잉크병/마켓/유배 등)는 Sprint 9 볼 원장 통일에서 일괄 정리
- [x] **정보봇 스케줄 베타 완화** (배포 완료)
  - `functions/gloveBotFetcher.js` — `fetchBotNews` / `fetchBotDart` 스케줄 `every 30 minutes` → `every 1 hours` 일괄 변경
  - Why: 삼성전자주주방 소곤소곤에 봇 글이 30분마다 대량 유입되어 실유저 글이 묻힘 — 베타 유저 수 적을 때만 완화
  - 정식 서비스 시 복원 계획: [memory/project_info_bot_schedule.md](memory) 참조
- [x] **채팅 UI 정돈** (로컬 검증 완료, 미배포)
  - `src/components/CommunityChatPanel.tsx` 4줄 수정 — 상세는 [GLOVE.md](./GLOVE.md) §10 2026-04-23 엔트리 참조
  - 핵심: ① 고정 `h-[600px]` → 뷰포트 동적 높이로 이중 스크롤 해소 ② 외곽 rounded 박스 제거로 일반 메뉴와 톤 통일 ③ emerald → slate ④ `backgroundAttachment: 'local'` 제거로 `chatBgUrl` 배경 이미지 세로 늘어남 해소
  - Why: 유저 피드백 "스크롤 2개 어지러움 · 채팅창 다 안 보임 · 배경 이미지 찌그러짐 (BTS 그룹샷 유스케이스 상정)"
- [x] **Sprint 10 주가 변동 봇 Phase 1 스코프 확정** — 네이버 금융 임시 소스 + 장중 10분/장후 16:00 하이브리드 스케줄 + 임계값 돌파만 푸시. Sprint 7+7.5 배포 후 착수. 상세 [memory/project_sprint10_price_bot.md](memory)

### 🏅 Sprint 4 Phase A+B — Creator Score 시스템 (2026-04-22)
> 구현 레퍼런스: [CreatorScore.md](./CreatorScore.md) | 커밋: b44b36a

- [x] **Phase A — 타입·Rules 기반 작업 (무위험)**
  - `src/constants.ts`: `CREATOR_SCORE_CONFIG`(SCALING_DIVISOR=1000, RECENT_WINDOW_DAYS=30, MIN_TRUST=0.3) + `ACTIVITY_WEIGHTS`(post=3/comment=1/likeSent=0.5) + `LEVEL_MEDIAN_ACTIVITY`(Lv1~10 5→100) + `TRUST_CONFIG`(ABUSE_PENALTIES·EXILE_PENALTIES·REPEAT_MULTIPLIER·REPORT_PENALTIES) 추가
  - `src/types.ts`: `UserData`에 12개 필드 확장 (`creatorScoreCached/Tier/UpdatedAt`, `recent30d_posts/comments/likesSent`, `recent30dUpdatedAt`, `reportsUniqueReporters/UpdatedAt`, `likesSent`, `exileHistory[]`) + `MapaeKey` 유니언 + `ExileRecord` 인터페이스
  - `firestore.rules`: 10개 필드 클라이언트 쓰기 차단 (users/{uid} update 블록리스트)
- [x] **Phase B — activity_logs + 6종 Cloud Functions**
  - `functions/activityLogger.js`: `logActivity(uid, type, refId)` 공용 헬퍼 — `activity_logs/{autoId}`에 `expiresAt=+30d` 포함 기록. `isEligibleContent()` 헬퍼(10자 이상)
  - `functions/onActivityTriggers.js`: 4종 onCreate/onUpdate 트리거 — `onPostCreatedForActivity`(글 작성 시 logActivity+lastActiveAt), `onCommentCreatedForActivity`(댓글), `onPostLikeChangedForActivity`(likedBy 증가분 감지 → nickname_{X} 색인 조회로 UID 확인 후 logActivity + users.likesSent increment), `onCommentLikeChangedForActivity`(동일 패턴)
  - `functions/utils/creatorScore.js`: 서버 수식 포트 — `calculateCreatorScore`, `calculateActivityScore`, `calculateTrustScore`, `calculateRecent30dTotal`, `getMapaeTier`. 클라이언트 `src/constants.ts`와 상수 동기화
  - `functions/creatorScoreCache.js`: 매일 05:00 KST (reputationCache 04:45 뒤 15분 지연) — `activity_logs` 30일 윈도우 집계 → 전체 유저 순회 → 변화 있으면 users 갱신. 400건 배치·timeoutSeconds 540·memory 1GiB
  - `functions/creatorScoreEvents.js`: `onUserChangedForCreatorScore` — `sanctionStatus/exileHistory/reputationCached/abuseFlags` 변경 감지 시 즉시 재계산. 무한 루프 2중 가드(creatorScoreFields만 변경 시 skip + 결과값 동일 시 skip)
  - `functions/index.js`: 6개 export 추가
- [x] **B-1 전략 채택** — 기존 클라이언트 코드 0줄 수정. Firestore onCreate 트리거로 `activity_logs` 서버측 자동 기록
- [x] **Phase C 보류** — 피드 정렬 공식·광고 경매 품질 가중치·Gate 함수 4종은 1주 관찰 후 결정 (배포 당일 creatorScoreCached=0 분포 고려)
- [x] **문서**: [project_2026-04-23_check.md](../../.claude/projects/e--halmal-itso/memory/project_2026-04-23_check.md) 체크리스트에 Sprint 4 Phase A+B 검증 섹션 5~9 추가

### 🏅 Sprint 3 Phase A+B — REPUTATION V2 Rules + 일일 캐시 파이프라인 (2026-04-22)
> 구현 레퍼런스: [Reputation.md](./Reputation.md) | 커밋: fd35203, 5e3d078

- [x] **Phase A — REPUTATION V2 필드 Rules 차단**
  - `reputationCached`, `reputationTierCached`, `reputationUpdatedAt` 3필드 클라이언트 쓰기 차단 (CF Admin SDK 전용)
  - 기존 `reputationScore` 계산식 공식 정리: `(likes×2) + (totalShares×3) + (ballReceived×5)` — 5단계 티어(neutral/friendly/warm/trusted/beloved)
- [x] **Phase B — 일일 스냅샷 + 평판 캐시 파이프라인**
  - `functions/snapshotUserDaily.js`: 매일 03:30 KST 전체 유저 스냅샷 → `user_snapshots/{yyyyMMdd}_{uid}` 기록 (likes/totalShares/ballReceived/reputation 고정값 보존)
  - `functions/reputationCache.js`: 매일 04:45 KST → users 문서에 `reputationCached/reputationTierCached/reputationUpdatedAt` 갱신. 기존값 동일 시 skip (400건 배치)
  - `functions/utils/reputationV2.js`: 서버 전용 공식 (클라 `utils.ts getReputationScoreV2`와 수식 일치)
- [x] **옵션 B 레벨 동기화 확정**: EXP 변경 시 `level: calculateLevel(newExp)` 동시 쓰기 — useFirestoreActions 등 전 경로 일괄 적용. 프론트 표시도 `calculateLevel(exp)` 실시간 재계산 가능 (DB 값과 일치 보증)
- [x] **효과**: 클라이언트는 `reputationCached` 캐시값 우선 사용 → Firestore 계산 부담 0. `reputationUpdatedAt` 기준으로 UI 갱신 시점 판단.

### 🔧 Sprint 2 — Node 22 마이그레이션 + LEVEL/REPUTATION V2 + 닉네임 사전체크 (2026-04-21 ~ 2026-04-22)
> 커밋: 4c8e2c0, e53dc5f, f85c96b

- [x] **Node.js 20 → 22 업그레이드** — `functions/package.json` engines.node "22"
- [x] **firebase-functions 5.x → 6.6.0 · firebase-admin 12.x → 13.8.0** — Sprint 3/4 신규 CF가 6.x 전용 API(`onDocumentUpdated`, `onSchedule` timeZone 필드) 사용
- [x] **cold start 관찰**: 48h 관찰 기간 설정 (Functions 평균 실행 시간 체크)
- [x] **닉네임 변경 사전 체크** (`MyPage`): 변경 전 `nickname_{X}` 색인 문서 read로 중복·예약어 확인 → 서버 저장 실패 왕복 제거. UX 개선 + Firestore 읽기 비용 1건으로 compute 절감
- [x] **LEVEL V2 확정** (구현 레퍼런스: [LevelSystem.md](./LevelSystem.md)): 옵션 B — DB에 `exp`(누적) + `level`(동기화) 두 필드. EXP 변경 시 `level: calculateLevel(newExp)` 동시 쓰기 (`useFirestoreActions`, `adminAdjustExp`, `kanbuPromo` 등 모든 EXP 경로 통일)

### 🎨 브랜드 전환 — 글러브 GeuLove · geulove.com (2026-04-19)
> 설계: [BRANDING.md](./BRANDING.md)

- [x] **도메인 전환**: `geulove.com` 연결 (Firebase 기본 `halmal-itso.web.app`은 내부 유지)
- [x] **OG/SNS 브랜딩**: `index.html` 타이틀·og:title·og:description·twitter:*·apple-touch-icon·favicon·theme-color(#7c3aed) 전면 교체 → **"글러브 GeuLove"**
- [x] **ogRenderer Cloud Function**: `APP_URL=https://geulove.com`, `SITE_NAME="글러브 GeuLove"`, `OG_IMAGE_ALLOWED_HOSTS`에 `geulove.com` 추가. User-Agent `GeuLove-MarathonHerald/1.0`, `GeuLoveBot/1.0`, `GeuLove-InfoBot/1.0`으로 통일
- [x] **헤더 로고 한글화**: `GLove`(2글자 영문) → **`글러브 beta`** (Pretendard Variable, 글=red·러브=blue·beta=이탤릭 slate). App.tsx 데스크톱+모바일 + Sidebar 푸터 3곳 동일 스타일
- [x] **.md 문서 일괄 치환** (4파일 12곳): `GLove` → `글러브(Geulove)` (`changelog.md` 8곳, `GLOVE.md` 2곳, `STOREHOUSE.md`+`storehouse-dev-plan.md` L5 각 1곳)
- [x] **BRANDING.md 신규**: 브랜드 전환 타임라인 + 현재 표기 규칙 + 치환 금지 식별자 9 카테고리 레지스트리 (Firestore 컬렉션, CF 모듈, 타입, 컴포넌트, hook, 메뉴 키, 변수명, BOT_UID, 고유명사)
- [x] **blueprint.md v39**: 프로젝트 개요 테이블에 "서비스 브랜드/공식 도메인/브랜드 레지스트리" 3행 추가, `Firebase Hㅁosting` 오타 수정
- [x] **CLAUDE.md**: 빅 픽처 위에 브랜드 한 줄 + BRANDING.md 링크
- [x] **ProfileHeader bio 폴백**: "GLove 회원입니다" → "글러브 회원입니다"

### 🏠 깐부방 Phase 2 — 게시판 UX 정리 & 홈 피드 격리 (2026-04-17)
> 설계: [KANBU.md](./KANBU.md)

- [x] **깐부방 찾기 홍보 인터리브** — 방 6개(2줄) → 🤝 깐부맺기 홍보 4명(1줄) → 나머지 방. 홈 피드의 한컷·잉크병 인터리브 패턴과 통일
  - 홍보 필터: `promoEnabled && !expired && uid !== 본인 && !friends.includes(nickname)`
  - 홍보 카드 클릭 → 공개 프로필 모달 (홈 패턴 동일)
  - 헤더 "깐부맺기 →" 버튼 → `friends` 메뉴로 이동
- [x] **홍보 카드 게시 종료 표시 이동** — 닉네임 옆 배지 제거 → `👀 N회 · 게시 종료 N일` 조회수와 같은 줄에 텍스트 표시. 만료 시 slate-400 / 활성 시 amber-500
- [x] **깐부방 게시판 3종 글카드 통일** — 긴 바 목록 → **홈 새글 동일 그리드 카드** (`[repeat(auto-fill,minmax(280px,1fr))]`)
  - 시간 → 제목 → 본문 프리뷰(이미지 숨김) → 이미지 → 아바타/Lv/평판/깐부수 → 댓글/땡스볼/좋아요 완전 동일 구조
  - `KanbuBoardView` props 확장: `allUsers`, `followerCounts`, `commentCounts` 주입 → 실시간 저자 데이터 바인딩
- [x] **홈·카테고리·랭킹·한컷 피드 격리** — `App.tsx basePosts` 필터에 `!p.kanbuRoomId` 추가
  - 깐부방 글은 참새들의 방앗간·카테고리 뷰·랭킹·한컷 어디에도 노출되지 않음
  - 깐부방 내부 `KanbuBoardView` 에서만 열람
  - 이유: 깐부방은 사적 공간, 오픈 피드의 품질·시간 기준과 다른 맥락
- [x] **문서 리팩터링** — 깐부방 관련 설계 내용을 `blueprint.md`에서 `KANBU.md`로 분리 (GLOVE/MARKET/INKWELL 패턴). blueprint는 §3/4/5 요약 + 참조만 유지

### 🔴 라이브 이코노미 Phase 4-A (2026-04-16)
> 설계: [halmal-itso-live-economy.md](./halmal-itso-live-economy.md) | 구현: [KANBU.md](./KANBU.md) §5

- [x] **텍스트 라이브 MVP** — 호스트가 3스타일(normal/highlight/title) 라인 추가 → 참가자 실시간 열람
  - `LiveBoard.tsx`: 보드 + 상태바(경과시간/활성유저수) + 참가자 ⚾ 티어 선택 버튼
  - 관리 탭에서 라이브 진입 UI를 분리 → 채팅 탭 옆 독립 탭(`live`)으로 이동
- [x] **Presence 하트비트** — 클라이언트 60초 ping, 서버 120초 stale cutoff, unmount 시 즉시 삭제
  - `src/hooks/useLivePresence.ts` + Cloud Function `cleanupLivePresence`(매 1분 스케줄러)
- [x] **VFX 오버레이** — 땡스볼 티어별 애니메이션 (bronze 2s · silver 5s · gold 10s · legend 15s)
  - `LiveVfxOverlay.tsx` 큐 기반 순차 재생 + `prefers-reduced-motion` 지원
- [x] **라이브 땡스볼** — `live_sessions.totalThanksball` 참가자 누적 (Rules: `hasOnly(['totalThanksball'])`) + 복합 인덱스 `live_chats: type+createdAt`

### 🏠 깐부방 업그레이드 (2026-04-16)

- [x] **레이아웃 리뉴얼** — 우리들의 장갑 패턴 적용: 헤더(# 깐부방 + 탭 + 만들기) + 2컬럼(메인+사이드바)
  - [깐부방 찾기] 카드 그리드: 깐부 관계만 [가입], 비깐부 🔒 표시
  - [내 깐부방] 카드 그리드 + 사이드바 compact (컬러 도트)
- [x] **방 내부 5탭** — 📋 자유 게시판 / 🔒 유료 1회(A타입) / 🔒 유료 구독(B타입) / 💬 채팅 / 👥 멤버 + ⚙️ 관리(개설자)
  - 유료 탭: 개설자가 관리 탭에서 활성화 시 동적 생성, 미결제 시 페이월
  - 멤버 탭: 유료/무료/구독 배지 구분
  - 관리 탭: 유료 A/B 설정 + 멤버 강퇴 + 방 수정/삭제
- [x] **유료 게시판 수수료** — Lv3-4 30% / Lv5-6 25% / Lv7+ 20% (강변 시장 동일)
- [x] **Cloud Functions**
  - `joinPaidKanbuRoom`: 볼 차감 + 수수료 분배 + platform_revenue/kanbu_room + pendingRevenue(정산) + 알림
  - `checkKanbuSubscriptionExpiry`: 매일 09:00 월 구독 만료 → paidMonthlyMembers 제거 + 알림
- [x] **정산·세무 통합** — pendingRevenue 누적 → 기존 WithdrawModal·SettlementQueue·calculateWithholdingTax 자동 적용
- [x] **관리자 대시보드** — PlatformRevenueDashboard에 깐부방 수익 카드 추가
- [x] **크리에이터 대시보드** — "광고 수익" → "크리에이터 수익" 라벨 범용화 + 수익 경로 안내
- [x] **데이터 모델** — KanbuRoom: paidBoards(once/monthly) + paidOnceMembers + paidMonthlyMembers. Post: kanbuBoardType. kanbu_paid_subs 컬렉션 (월 구독 만료 추적)

### 🛡️ 주주방 인증 체계 Phase A~H + Codef 샌드박스 (2026-04-16)
> 설계: [SHAREHOLDER_TIER.md](./SHAREHOLDER_TIER.md) | 미룬 작업: [SHAREHOLDER_BACKLOG.md](./SHAREHOLDER_BACKLOG.md)

- [x] **Phase A** — types.ts: ShareholderTier + TIER_CONFIG + getTierFromQuantity + tierRangeLabel. VerifiedBadge에 tier/source 추가. Community에 shareholderSettings 추가
- [x] **Phase B** — VerifyShareholderPanel 신규 + CommunityView 독립 '🛡️ 주주 인증' 탭. 종목 설정(1회 잠금) + TierSelector + 인증 부여/해제/등급 변경. 방장 자기 인증(👑 내 등급 설정). 개별/일괄 인증 요청 → 알림 발송
- [x] **Phase C** — 배지 전파 4곳(채팅·멤버·글·댓글). 주주방은 이모지 대신 텍스트("멤버 · 고래 · 주주 인증")
- [x] **Phase H** — 글 하단 "💡 이 의견은 고래(1만~10만주) 주주가 작성했습니다" 스냅샷 (보유수 비노출)
- [x] **멤버 인증 등록** — ShareholderVerifyScreen: 2탭(📸 스크린샷 / 📊 마이데이터) + 차분한 slate 톤. 마이데이터 3단계(조회→결과→제출)
- [x] **스크린샷 보안** — SecureImage(Worker 프록시) + 30일 자동 만료 + 방장만 열람. shareholderCleanup.js 스케줄러(매일 04:30)
- [x] **Codef 샌드박스 연동** — Worker /api/verify-shares: OAuth Basic Auth + URL-encoded 응답 디코딩. 키 3개 등록 완료. Mock 모드 fallback 유지
- [x] **Firestore Rules** — 방장 자기 verified 수정 허용 + 관리자 verifyRequest/reverifyRequestedAt 추가
- [x] **source 3종 구분** — ✏️ 수동(manual) / 📸 스크린샷(screenshot) / 🔗 마이데이터(mydata)

### 🍞 헨젤의 빵부스러기 (2026-04-15)
> 설계: [HANSEL_BREADCRUMBS.md](./HANSEL_BREADCRUMBS.md) v1.1

기존 한컷 시스템을 1~4컷 캐러셀로 확장. "글의 쇼츠" 기능으로 오리지널 긴 글로의 Conversion을 극대화.

- [x] **메뉴 리브랜딩** — 한컷 → `🍞 헨젤의 빵부스러기` (회색톤 이모지 적용)
  - `constants.ts` MENU_MESSAGES.onecut: 제목·설명 교체 (`인생 네컷처럼 내 글도 한컷 · 네컷으로, 그리고 연계는 필수`)
  - `Sidebar.tsx`: SVG 아이콘 → 🍞 이모지 `grayscale opacity-80`
  - `App.tsx` 카테고리 선택 카드: onecut 이모지에 조건부 grayscale
  - `CreateOneCutBox.tsx`: 라벨 4곳 교체 (제목, 버튼, 미리보기 등)
  - DB 값(`category: '한컷'`, `isOneCut: true`) 유지 → 하위호환
- [x] **데이터 모델 확장** — `Post.imageUrls?: string[]` 신설 ([types.ts:82](./src/types.ts))
  - 저장 시 `imageUrl = imageUrls[0]` 동시 저장 → 기존 렌더링 코드 무수정 동작
  - 마이그레이션 없음 (기존 글은 `imageUrl` 단일만 사용)
- [x] **작성 폼 1~4슬롯** — `CreateOneCutBox.tsx`
  - 1~4컷 슬롯 그리드 + 개별 업로드/삭제/위치 배지
  - `+ 다음 컷 추가` 버튼, 💡 가이드 박스 (1~4컷 작성 팁)
  - 캐러셀 미리보기 (화살표·인디케이터·N/M 카운터), 마지막 컷 CTA 미리보기
  - 붙여넣기 → 다음 빈 슬롯 자동 채움, 수정 모드 시 기존 배열 불러오기
- [x] **상세뷰 캐러셀 + CTA** — `OneCutDetailView.tsx`
  - 1컷: 단일 이미지 (기존 동일), 2~4컷: 캐러셀
  - 좌/우 화살표 + 인디케이터 점 + 키보드 ←/→ + 모바일 스와이프 + 우상단 `🍞 N/M` 배지
  - **마지막 컷 CTA 오버레이**: `🔗 숨겨진 자세한 이야기 보러가기` (linkedPostId 또는 linkUrl 있을 때)
    - linkedPostId 우선 → 해당 글로 이동, 없으면 linkUrl → 새 탭
- [x] **리스트 카드 배지** — `OneCutList.tsx` + `AnyTalkList.tsx` 인라인 onecut 섹션
  - 썸네일 좌상단 `🍞 1/N` 배지 (회색 🍞)
  - 1컷도 `🍞 1/1` 표시하여 일관성 유지
- [x] **하위호환 보장** — `images = imageUrls?.length ? imageUrls : (imageUrl ? [imageUrl] : [])` 패턴 전 구간 적용

### 🏚️ 놀부 곳간 후속 정비 (2026-04-14 ~ 2026-04-15)
> 설계 반영: [STOREHOUSE.md §2.5 / §2.7 / §2.8 / §2.9](./STOREHOUSE.md)

- [x] **비유배자 + 새 글 가드** (2026-04-14) — `App.tsx` 헤더 `+ 새 글` `onClick`에 분기 추가: `activeMenu === 'exile_place' && !isExiled`이면 `setActiveMenu('home')` 선행 후 `setIsCreateOpen(true)` → 홈 카테고리 선택 화면 진입. 유배자는 라우팅 가드가 exile_place로 즉시 복귀시키므로 CreateExile 폼 유지
- [x] **헤더·관전자 문구 정리** (2026-04-14) — `ExileMainPage` 서브타이틀에서 "반성하고 속죄하시오" 제거, 비유배자 진입 시 표시되던 3줄 안내 배너(거친 표현/익명화/외부 공유 금지) 전체 제거. 안내 내용은 문서(STOREHOUSE.md §3·§11.3·§11.4)에서 유지
- [x] **받은 땡스볼 ballBalance 반영** (2026-04-15) — `functions/thanksball.js` `sendThanksball` 트랜잭션이 수신자 `ballReceived`만 증가시키고 `ballBalance`는 빠뜨려 받은 땡스볼을 영원히 쓸 수 없던 버그. 두 필드 동시 증가로 수정 → 유배자 속죄금 결제(`releaseFromExile`의 ballBalance 차감) 정상 동작. 과거 누적분 소급 없음, 신규 전송부터 적용
- [x] **유배지 사이드바 필터 완화 + 제목 변경** (2026-04-15) — 3단계(곳간/귀양지/절해고도) 공통 트래픽 부족 문제 해결. `DiscussionView.tsx`에서 `rootPost.category === '유배·귀양지'`일 때 좋아요·시간 필터 스킵, `isHiddenByExile`만 제외. `RelatedPostsSidebar.tsx`에 `title` prop 신설 → 유배글 상세뷰에서만 "게시글 더보기" 표시(기타 카테고리는 "등록글 더보기" 유지)

### 🏚️ 놀부 곳간 상세글 화면 정비 (2026-04-14)
> 설계 반영: [STOREHOUSE.md §2.6 / §3.3 / §11.4.1](./STOREHOUSE.md)

- [x] **상세글 우상단 공유 버튼 제거** — `RootPostCard.tsx`에서 `post.category === '유배·귀양지'` 분기로 숨김 (Sandbox Policy §3 준수)
- [x] **닉네임 자동 익명화 구현** — 기존 미구현 상태 해결
  • `utils.ts` `anonymizeExileNickname(uid)` 추가 — FNV-1a 32bit 해시 → `곳간 거주자 #NNNN` 결정적 변환
  • `useFirestoreActions.ts`의 `handlePostSubmit`/`handleInlineReply`/`handleCommentSubmit` 3개 핸들러에서 유배글·유배댓글 저장 시 `author` 필드 치환
  • `author_id`는 실제 uid 유지 → 본인 수정/삭제 권한 및 관리자 추적 정상
  • 동일 uid는 항상 동일 번호 → 유배 기간 중 닉네임 일관성 보장 (Cloud Function 의존 없음)
- [x] **댓글 영역 Pandora 스타일 전환** — `CATEGORY_RULES['유배·귀양지'].boardType` `'single'` → `'pandora'`
  • 동의/반대 댓글 좌우 2컬럼 지그재그 시간순 표시
  • 각 컬럼 하단에 인라인 댓글 입력폼(placeholder: `댓글을 입력하세요...`)
  • `hideAttachment: true`로 이미지/링크 첨부 차단
  • 기존 `CommentExile.tsx`는 pandora 분기에서 자동 비활성화(파일 존속, 실제 미사용)

### 🏚️ 놀부의 텅 빈 곳간 Phase 1 MVP (2026-04-14)
> 상세 설계: [STOREHOUSE.md](./STOREHOUSE.md)

- [x] **Step A** — 기반 인프라: STOREHOUSE.md 신설, 사이드메뉴 "놀부의 텅 빈 곳간" 이름 변경, types.ts에 SanctionStatus/SANCTION_POLICIES + UserData sanction 필드, firestore.rules (bail_history/release_history/banned_phones/sanction_log/exile_posts/exile_comments)
- [x] **Step B** — Cloud Functions + 관리자 UI: `sendToExile` (strikeCount +1, 단계 자동 판정, 4차 자동 사약), `releaseFromExile` (속죄금 차감/소각 + 깐부 양방향 리셋), ExileManagement.tsx (신고 목록 + 유배 보내기 + 수동 UID 입력), AdAdminPage 🏚️ 유배 관리 탭
- [x] **Step C** — 유배자 메인: ExileMainPage (3탭, 본인 단계만 활성), 상태 카드 + 반성 기간 실시간 카운트다운 + 속죄금 결제 버튼
- [x] **Step D** — 라우팅 가드: useEffect 감지로 유배자 자동 강제 이동, Sidebar isExiled prop (유배지+내정보만 노출), SayakScreen (banned 유저 전용 전체화면 10초 카운트다운 → 강제 로그아웃)
- [x] **테스트 계정**: 불량깐부1~3호 (Lv3/4/5) 추가, 헤더 검색창 축소 (200px, 32h)

### 🏚️ 놀부의 텅 빈 곳간 관리자 강화 + 이의 제기 (2026-04-14)

- [x] **플랫폼 수익 대시보드** 확장: `platform_revenue/penalty`(속죄금 소각) + `platform_revenue/sayak_seized`(사약 몰수) 카드 + 수익 구조 요약에 유배 항목 추가
- [x] **현재 유배자 목록** (ExileManagement 내): `sanctionStatus in [exiled_lv1~3, banned]` 실시간 구독, 단계별 컬러 배지, 90일 초과 경고, 반성기간 남은 일수 표시
- [x] **이의 제기 채널** (`appeals` 컬렉션):
  • 유배자: `AppealForm` — 1000자 제한, 1회 제출 후 검토 대기
  • 관리자: `AppealReview` 탭 — 대기/전체 필터, 인용/기각 + 사유 입력, 대상자 알림 발송
  • Firestore Rules + 인덱스 2건

### 🏚️ 놀부의 텅 빈 곳간 Phase 3 일부 (2026-04-14)

- [x] **문제 글 soft delete**: `sendToExile` postId 파라미터 → isHiddenByExile 플래그 + 피드 필터링 (App.tsx basePosts/onecutAll)
- [x] `executeSayak` Cloud Function: 자산 몰수(platform_revenue/sayak_seized) + 모든 글 일괄 숨김 + banned_phones 등록 + 깐부 양방향 제거 + 감사 로그
- [x] `checkAutoSayak` 스케줄러: 매일 04:00 — 유배 90일 경과 유저 자동 사약
- [x] 관리자 ☠️ 직권 사약 UI (4차 건너뛰고 즉시 영구밴)
- [ ] Phone Auth + banned_phones 가입 차단 (Phase 3 잔여 — 별도 API 발급 필요)

### 🏚️ 놀부의 텅 빈 곳간 Phase 2 (2026-04-14)

- [x] `ExileBoard` — exile_posts 게시판 (유배자 본인 단계 작성, 닉네임 자동 익명화 "곳간 거주자 #NNNN", 500자 제한)
- [x] 일반 유저 관전 뷰 — 3탭 전체 열람, 관전자 안내 문구 (거친 표현 주의 등)
- [x] `PublicProfile`: 유배 배지 ("🏚️ 수감 중 · N범") + 사약 배지 ("☠️ 사약")
- [x] `MyPage`: 유배자 상단 경고 배너 (처분 사유 + 곳간 이동 안내)
- [x] `sendThanksball` 서버 가드: 유배자/사약자 송금 차단 (수신 허용)
- [x] Firestore 인덱스: `exile_posts` level+createdAt DESC

### 🏪 강변 시장 Phase 1~3 (2026-04-13)
> 상세 설계: [MARKET.md](./MARKET.md)

- [x] **Phase 1**: 사이드메뉴 마켓→강변 시장 변경, types.ts 타입 정의, Firestore Rules + 복합 인덱스, MarketHomeView (가판대/단골장부 2탭 + 카테고리 필터, 잉크병/장갑 패턴 sticky 헤더)
- [x] **Phase 2**: 가판대 CRUD — MarketItemEditor (제목/티저/본문/가격/카테고리/태그/표지), MarketItemDetail (페이월+구매+별점리뷰), purchaseMarketItem Cloud Function (레벨별 수수료 30/25/20%)
- [x] **Phase 3**: 단골장부 — MarketShopEditor (개설), MarketShopDetail (구독+판매글목록), subscribeMarketShop Cloud Function, checkSubscriptionExpiry 스케줄러 (만료 3일 전 알림 + 자동 비활성화 + subscriberCount 차감)
- [x] **Phase 4**: 광고 수익 쉐어 — processMarketAdRevenue (매일 00:05, 크리에이터 70%/플랫폼 30%), adAuction에 targetCreatorId 필터, 광고주 캠페인 폼에 크리에이터 타겟팅 UI
- [x] **Phase 5**: 크리에이터 대시보드 (MarketDashboard: 수익현황/판매글관리/단골장부), 판매글 수정 기능 (MarketItemEditor 수정 모드)
- [x] **추가**: 카테고리를 황금알 INFO_GROUPS 38개 항목으로 통일, 미리보기 자동 추출 (앞 200자), 플랫폼 수익 대시보드 (관리자 전용, PlatformRevenueDashboard)

### 🖋️ 마르지 않는 잉크병 (2026-04-11 v38 — Phase 1~5 완료)
> 상세 설계: [INKWELL.md](./INKWELL.md)

- [x] **Phase 1**: Firestore Rules + 복합 인덱스 + 타입 정의 (`series`, `unlocked_episodes`, `series_subscriptions`, Post에 잉크병 필드 추가)
- [x] **Phase 2**: Cloud Functions — `unlockEpisode` (결제 트랜잭션, 멱등성 보장), `onEpisodeCreate` (구독자 알림)
- [x] **Phase 3**: 작품/회차 CRUD — SeriesGrid/Card/Detail, EpisodeReader/CommentBoard/Form, CreateSeries/Episode, EditSeries/Episode
- [x] **Phase 3-D**: PaywallOverlay (미리보기 + 그라데이션 + 결제 박스) + unlockEpisode 연동
- [x] **Phase 4-A**: 구독 시스템 (SubscribeButton + series_subscriptions) + 알림 발송 흐름 완성
- [x] **Phase 4-B**: 마이페이지 "나의 연재작" 탭 (본인 작가 작품)
- [x] **Phase 4-C**: 회차 댓글 기능 (EpisodeCommentBoard/Form, 기존 useFirestoreActions 패턴 차용)
- [x] **Phase 4-D-1/2**: 회차/작품 수정·삭제 (구매자 있으면 비공개 전환, 회차 있으면 작품 비공개 전환)
- [x] **Phase 4-E**: 댓글 좋아요 + 땡스볼 통합 (기존 ThanksballModal 재사용, targetCollection='comments')
- [x] **Phase 4-F**: 작가 대시보드 (InkwellSummaryCards KPI 카드 + 작품별 통계 박스)
- [x] **Phase 4-G**: 회차 본문 좋아요/땡스볼 (인터랙션 바, series.totalLikes 동기화)
- [x] **Phase 4-I**: 댓글 수정/삭제 (작성자 본인 수정·삭제 + 작가는 삭제만)
- [x] **Phase 5**: 알림 라우팅 전파 (NotificationBell → EpisodeReader 직접 진입)
- [x] **Phase 5-A**: 비공개 → 공개 복귀 토글 (isHidden: false / status: 'serializing')
- [x] **Phase 5-B**: 고아 알림 cleanup 트리거 (`onInkwellPostDelete` + NotificationBell fallback)
- [x] **Phase 5-C**: 댓글 Soft delete + placeholder (isDeleted 플래그, content 보존)
- [x] **Phase 5-D**: 1단계 답글(대댓글) — parentCommentId, depth 1 제한
- [x] **홈 통합**: 한컷/깐부맺기 옆 잉크병 인라인 스트립 + 구독글 탭 + 메인 글카드에서 잉크병 제외
- [x] **마이페이지 📚 구독한 작품 탭**: 본인 구독 작품 라이브러리 (series_subscriptions 기반)
- [x] **InkwellHomeView 2탭**: 사이드 메뉴 진입 시 [📖 회차 등록글] + [📚 작품 카탈로그] glove 패턴 sticky 헤더
- [x] **공유 통합**: 공용 `sharePost()` 헬퍼 (Web Share API + fallback 클립보드) — RootPostCard/EpisodeReader 공용
- [x] **EpisodeReader 점세개 메뉴**: 공개프로필/신고(disabled) + 작가 수정·다시공개·삭제
- [x] **차분 톤다운**: 잉크병 전 화면(작품/회차/폼/댓글) slate 계열 통일, 글자 크기 축소, 본문 typography RootPostCard와 동일(text-[15px] leading-[1.8])

### 🧤 우리들의 장갑 — 대표 이미지 + 채팅 바탕화면 (2026-04-12)
- [x] `Community` 인터페이스에 `thumbnailUrl?: string` + `chatBgUrl?: string` 추가
- [x] `CreateCommunityModal` — 대표 이미지 + 채팅 바탕화면 업로드 옵션 (R2, 5MB 제한)
- [x] `CommunityAdminPanel` — 관리 탭에서 대표 이미지/채팅 바탕화면 변경/삭제
- [x] `CommunityList` / `MyCommunityList` / `CommunityView` / `MyPage` — 카드에 썸네일 영역 (없으면 기존 coverColor 바 폴백)
- [x] `CommunityChatPanel` — `chatBgUrl` 있으면 배경 이미지 + linear-gradient 60% 흰색 오버레이
- [x] `useGloveActions` — `thumbnailUrl` / `chatBgUrl` Firestore 저장 전달
- [x] `GLOVE.md` — 활성 뱃지/Presence를 장기 숙제로 등록

### 🤖 장갑 정보봇 Phase 1-2 + 소곤소곤 개선 + 닉네임 배지 (2026-04-13)
- [x] **정보봇 Phase 1**: `activateInfoBot`/`deactivateInfoBot`/`updateInfoBot` + `fetchBotNews` (Google News RSS, 매 30분). 주식 장갑 전용, 대장 월 20볼 결제, 플랫폼 100% 수익
- [x] **정보봇 Phase 2**: `fetchBotDart` (DART OpenAPI, 매 30분). `dartCorpMap.js` — 종목코드→DART 고유번호 자동 매핑 (3,957개 상장 기업). 관리 탭 종목코드 입력 → [조회] 자동 매핑
- [x] **소곤소곤 피드**: 카드 하단 땡스볼 보내기 버튼 (ThanksballModal)
- [x] **소곤소곤 상세글**: 우상단 ⋮ 메뉴 (공개프로필/신고하기 disabled)
- [x] **소곤소곤 댓글**: 우측 ⋮ 메뉴 (본인 외, 공개프로필/신고하기 disabled)
- [x] **채팅 액션 버튼**: 원형 배경 + 호버 색상 (↩ ⚾ +)
- [x] **외부 링크 새 탭**: DOMPurify `ADD_ATTR: ['target']` — 봇 게시글 원문 보기 새 탭
- [x] **닉네임 배지**: `displayBadgeKey` — 채팅 닉네임 옆 finger 역할 + 가입 답변(K단위) 표시. 개설 시 폼 빌더 + 관리 탭 설정
- [x] **모바일 나의 장갑**: 탭 2개→3개 (소곤소곤/장갑찾기/나의장갑). 사이드바 desktop-only 문제 해결
- [x] **이미지 비율 통일**: 모든 대표 이미지 `aspect-[16/9]`, 관리 탭 w-2/3 mx-auto 중앙 정렬
- [x] **정보봇 남은 시간**: D-N일 / 24시간 미만 시 N시간

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
- [x] **헤더 브랜드**: 글러브(Geulove) 로고 옆 "집단지성의 힘" 서브텍스트 추가.
- [x] **사이드바 구조 개편**: 깐부방+깐부맺기 동일 섹션(구분선 아래), 내정보 별도 섹션. 깐부방 배지 색상: `bg-blue-100 text-blue-600` (구: rose 계열).
- [x] **로딩 애니메이션 교체**: 말 뛰어가기 이미지 → pulsing 글러브(Geulove) 로고 (`@keyframes logo-pulse`: opacity 0→1, scale 0.92→1, 1.4s ease-in-out infinite). `index.css`에 정의, `.animate-logo-pulse` 클래스 적용.
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
  - `index.html`: 타이틀·og:title·og:site_name·twitter:title 전면 변경 → **"글러브(Geulove) - 집단지성의 힘"** (기존: "할말있소 — 집단지성의 힘")
  - og:image: 글러브(Geulove) 로고 이미지(`og-image.jpg`, 243KB)를 `public/` 폴더에 배치 → Firebase Hosting에서 직접 서빙(`https://halmal-itso.web.app/og-image.jpg`). R2 경유 시 카카오 크롤러 접근 불가 이슈 해결.
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
  - **모바일 드로어 메뉴**: 햄버거 클릭 시 `fixed inset-0 z-[60] md:hidden` 오버레이 + 좌측 슬라이드 Sidebar(`mobile=true`). Sidebar에 `mobile`, `onClose` prop 추가, 모바일 전용 헤더(글러브(Geulove) 로고 + × 닫기버튼) 포함.
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
  - **헤더**: 좌측 `≡`(드로어 열기) + 글러브(Geulove) 텍스트(홈) 분리. 우측 햄버거 제거 → 알림벨 + 아바타(내정보) / 로그인 버튼.
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

- [x] **한컷 비율 개선 + 홈 피드 인라인 섹션 (2026-04-04 v32)**:

  **한컷 이미지 비율 통일 (9:16 → 16:9)**
  - `CreateOneCutBox.tsx`: 미리보기 `aspect-[9/16]` → `aspect-[16/9]`. 폰 목업 프레임(`rounded-[3.5rem] border-[12px]`) → 심플 프레임(`rounded-xl border-4`). 라벨 "(9:16)" → "(16:9 가로 권장)".
  - `CreateOneCutBox.tsx`: 상세 설명 textarea 블록 제거 — 이미지+제목만으로 한컷 취지 구현.
  - `OneCutList.tsx`: 카드 이미지 `aspect-[9/6.5]` → `aspect-[16/9]`. 설명 텍스트 줄(`stripHtml` 결과) 및 `stripHtml` 함수 제거.
  - `OneCutDetailView.tsx`: 기존 `h-auto object-contain` 방식이므로 비율 변경 불필요 (이미 반응형 자연 비율).

  **홈 피드 탭 한컷 인라인 섹션**
  - `AnyTalkList.tsx`: `oneCutPosts?: Post[]`, `onOneCutMoreClick?: () => void` prop 추가. 일반글 그리드 하단에 `🎞️ 한컷 · N개` 헤더 + 더보기 버튼 + 16:9 카드 2열(모바일)/4열(데스크톱) 그리드. 한컷 없으면 섹션 자체 숨김.
  - `App.tsx`: `onecutTabPosts` 계산 — `allRootPosts.filter(p => p.isOneCut)` 기반, `activeTab` 기준과 동일한 시간·좋아요 필터 적용 후 최신순 정렬. 메인 `AnyTalkList` 호출에 `oneCutPosts={onecutTabPosts} onOneCutMoreClick={() => setActiveMenu('onecut')}` 전달.
  - 일반글 0개일 때도 한컷 섹션 표시 (빈 상태 메시지 높이 `py-40` → `py-10` 자동 조정).

  **배포 후 화이트스크린 버그 수정**
  - `firebase.json`: `headers` 섹션 추가 — `index.html`에 `Cache-Control: no-cache, no-store, must-revalidate`. `/assets/**`에 `Cache-Control: public, max-age=31536000, immutable`. 새 배포 후 구버전 index.html 캐시로 인한 청크 MIME 오류 방지.
  - `main.tsx`: `window.addEventListener('unhandledrejection')` — "Failed to fetch dynamically imported module" 감지 시 `window.location.reload()` 자동 실행. 5초 쿨다운(`sessionStorage chunkReloadAt`)으로 무한루프 방지.

- [x] **R2 업로드 보안 전환 — Worker 프록시 (2026-04-04 v33)**:
  - **문제**: 클라이언트 번들에 R2 API 키(accessKeyId, secretAccessKey)가 평문 노출. 브라우저 개발자도구에서 누구나 확인 가능, 버킷 파일 삭제/덮어쓰기 공격 가능.
  - **해결**: 별도 Cloudflare Worker(`halmal-upload-worker`) 생성. R2 바인딩으로 직접 접근 (API 키 불필요). Firebase Auth ID Token으로 인증. `uploads/` 경로는 본인 UID 폴더만 허용.
  - **Worker**: `upload-worker/src/index.ts` — `POST /` multipart/form-data(file + filePath). JWT 서명 검증(Google 공개키 RSA256). 버킷 자동 선택(`avatars/` → AVATARS_BUCKET, 그 외 → UPLOADS_BUCKET). 10MB 제한.
  - **클라이언트**: `src/uploadToR2.ts` 신규 — `uploadToR2(file, filePath)` 함수. `auth.currentUser.getIdToken()` 자동 획득 → Worker에 Bearer 토큰 전송.
  - **15개 컴포넌트 일괄 전환**: `PutObjectCommand` + `s3Client` 직접 호출 → `uploadToR2()` 단일 함수 호출로 교체. 대상: CreatePostBox, CreateOneCutBox, CreateDebate, CreateMyStory, CreateKnowledge, CreateLocalNews, CreateMarathonHerald, CreateMarket, CreateNakedKing, CreateExile, CreateBoneHitting, DebateBoard, CommunityView, MyPage, MyProfileCard.
  - **패키지 제거**: `@aws-sdk/client-s3` 번들에서 완전 제거 (기존 ~199KB 청크 삭제).
  - **환경변수 정리**: `.env`에서 `VITE_R2_ACCESS_KEY_ID`, `VITE_R2_SECRET_ACCESS_KEY`, `VITE_R2_ENDPOINT`, `VITE_R2_BUCKET_NAME` 제거.

- [x] **한컷 카드 UI 고도화 (2026-04-04 v33)**:
  - **통계 바 추가**: OneCutList, AnyTalkList 인라인 스트립, OneCutDetailView 인터랙션 바에 댓글수·땡스볼·좋아요·공유 버튼 추가. 일반 글 카드와 동일한 상호작용 가능.
  - **인라인 스트립 카드 형태 변경**: 이미지만 표시하던 카드 → OneCutList와 동일한 전체 형태(이미지+제목+작성자+통계 바). 홈 피드에서 바로 좋아요 가능.
  - **게시물 수 표시 제거**: `🎞️ 한컷 · N개` → `🎞️ 한컷` (추후 한컷 증가 시 의미 없어지므로).
  - **하단 여백 축소**: 텍스트 영역 `p-3 gap-1.5` → `px-3 pt-2.5 pb-2 gap-1` (통계 바 아래 불필요 여백 제거).

- [x] **Firestore 감사볼 알림 권한 수정 (2026-04-04 v33)**:
  - **문제**: `notifications/{uid}/items` write 규칙이 `request.auth.uid == nick`으로 제한 → 발신자가 수신자 경로에 알림을 쓸 수 없어 감사볼 전송 실패.
  - **해결**: `create`만 로그인 사용자 전체 허용, `read/update/delete`는 본인만 유지.

- [x] **깐부방 헤더 통일 (2026-04-04 v33)**:
  - CategoryHeader와 동일 스타일의 `#깐부방` sticky 헤더 적용. 설명문 좌측 정렬. `+새 깐부방` 버튼 회색 텍스트로 축소. 빈 상태 안내 텍스트 사이즈 확대.

- [x] **거대 나무 하이브리드 성장 시스템 (2026-04-05 v34)**:
  > 📋 상세 설계 → [GIANTTREE.md](./GIANTTREE.md) (blueprint.md 섹션 10 분리)
  - **1단계 — 숏폼 의견**: 의견 선택화(빈 허용) + 100자→50자, textarea→input. 참여자 보상 likes+1.
  - **2단계 — 잎사귀 시스템**: 직계(카톡 URL, Node) vs 일반(앱 내 진입, Leaf) 분리. `leaves` 서브컬렉션 신규. 잎사귀 참여 폼·목록 별도 UI. `GiantTreeLeaf` 타입.
  - **3단계 — 시든 가지**: 48시간 경과 + childCount < 3 → 🍂 배너 + `giant_tree_wilt` 알림 push. 세션 내 중복 방지.
  - **4단계 — 잎사귀 보너스 진행률**: 잎사귀 10개당 +1% (최대 10%). 전파 현황 바에 합산. 잎사귀만으로 달성 불가.
  - **성장 6단계**: 씨앗(🌰)→새싹(🌱)→어린 나무(🌿)→중간 나무(🌲)→큰 나무(🌳)→거대 나무(🌳금색). 단계별 색상 진행 바.
  - **목록 좌우 레이아웃**: 좌측(8칸) 자라는 나무 + 우측(4칸) 거대 나무 사이드바 (금색 테두리 컴팩트 카드).
  - **동시 활성 제한**: 약간 우호 1개, 우호 2개, 확고 3개. 한도 시 "심은 나무가 거대 나무가 되어야 다시 심기 가능".
  - **작성자 수정·삭제**: 인라인 편집(title/content), "글 삭제" 입력 확인 후 일괄 삭제. Firestore Rules 강화.
  - **권한 안내**: 비로그인 잠금 배너, 평판 부족 안내 배너.
  - **헤더 통일**: CategoryHeader 스타일 `#거대 나무` + 중복 제거.

- [x] **내정보 깐부수(팔로워) 목록 탭 추가 (2026-04-05 v34)**:
  - 깐부 탭 내 서브탭: 깐부 목록(팔로잉) / 깐부수 목록(팔로워). allUsers에서 friendList 역산. 서로 깐부면 '서로 깐부' 배지, 일방향이면 '+깐부맺기' 버튼.

- [x] **마라톤의 전령 10분 분산 수집 + MBC뉴스 추가 (2026-04-05 v34)**:
  - 매 30분 전체 수집 → 매 10분 분대별 1개 언론사 순차 수집. 0분=MBC, 10분=연합, 20분=KBS, 30분=경향, 40분=동아, 50분=뉴스1. 속보 감지 지연 30분→10분.

- [x] **한컷 사이드바 땡스볼·원본글 링크 + 상세글 이미지 전체 너비 (2026-04-05 v34)**:
  - OneCutListSidebar: 댓글·땡스볼·좋아요 통계 바 + linkedPost 원본글 배지. 아바타 실제 이미지 반영.
  - OneCutDetailView: 이미지 w-2/3→w-full. 그리드 9:3→8:4. 사이드바 aspect-[3/4]→[16/9].

- [x] **레벨·평판 시스템 v3 전면 구현 (2026-04-05 v35)**:
  - **레벨(EXP) = 성실도**: DB에 `exp` 필드만 `increment()` 누적. `level` 필드 DB 저장 제거. 프론트에서 `calculateLevel(exp)` 실시간 계산.
  - **EXP 획득**: 새글+2, 등록글(좋아요3)+5, 댓글+2, 깐부맺기+10, 출석+5, 장갑글+2, 전파참여+3, 잎사귀+1, 준땡스볼+1, 글조회+1.
  - **EXP 차감**: 글삭제-2, 댓글삭제-2, 깐부해제-15. 10자 미만 EXP 미지급.
  - **Rate Limit**: 글 60초, 댓글 15초 쿨다운. 어뷰징 방지.
  - **평판(Reputation) = 신뢰도 5단계**: (likes×2)+(totalShares×3)+(ballReceived×5). 중립→약간 우호(300)→우호(1000)→매우 우호(2000)→확고(3000).
  - **17개 컴포넌트** `displayLevel` → `calculateLevel(exp)` 일괄 전환. MyProfileCard level DB 저장 제거.
  - **기존 유저 마이그레이션**: 로그인 시 `exp === 0 && likes > 0`이면 `exp = likes` 자동 이관.

- [x] **공개 프로필 (PublicProfile) 신규 (2026-04-05 v35)**:
  - 아바타 클릭(우측 상단) → 공개 프로필 표시. 사이드바 내정보 → 기존 MyPage 유지.
  - 7영역: Identity(레벨+평판 프로그레스 바) + Social CTA(깐부맺기/서로깐부) + Intro(bio) + Showcase(내 홍보 이미지) + Stats(활동 지표) + Best 3(인기글) + Feed(전체 글 목록).
  - 글카드 작성자 닉네임 클릭 → 해당 유저 공개 프로필.

- [x] **내 홍보 섹션 (MyPromotion) 신규 (2026-04-05 v35)**:
  - 아바타 수집 탭 제거 → 프로필 영역 바로 아래에 '내 홍보' 3×2 그리드 (16:9 비율).
  - 레벨별 해금: 윗줄 Lv1,2,4 항상 표시. 아랫줄 Lv6,8,10 해금 시 펼침 애니메이션.
  - R2 Worker 업로드. `promoImages` 배열로 Firestore 저장.

- [x] **R2 업로드 보안 강화 (2026-04-05 v35)**:
  - Worker 경로 보안: `uploads/`, `promo/`, `avatars/` 3곳 모두 본인 UID 검증.
  - 아바타 경로: `avatars/{nickname}` → `avatars/{uid}/` 로 변경.

- [x] **iOS Safari 로그인 수정 (2026-04-05 v35)**:
  - `signInWithRedirect` → `signInWithPopup` 우선 (ITP 쿠키 차단 우회). 팝업 차단 시에만 redirect 폴백.
  - `getRedirectResult(auth)` 호출 추가.

- [x] **모바일 UX 개선 (2026-04-05 v35)**:
  - 하단 탭바: 홈 → ≡메뉴(드로어 열기)로 교체. 왼손 접근 최적화.
  - 상단: ≡ 삼색선 제거, 글러브(Geulove) 로고만 남김 (터치 시 홈).
  - 삼색선: 자주·빨강·파랑 (PC·모바일 동일).
  - 브랜드 컬러: blue-600 → violet-600 계열 전환. 글러브(Geulove) 로고는 G빨강 L파랑 유지 — G/L 색 설명은 과거 2글자 로고 기준.

- [x] **테스트 계정 5개 레벨·평판 설정 (2026-04-05 v35)**:
  - 깐부1(Lv1,중립) 깐부2(Lv2,약간우호) 깐부3(Lv3,우호) 깐부4(Lv4,매우우호) 깐부5(Lv5,확고).
  - 로그인 시 exp/likes 강제 세팅.

- [x] **⋯ 메뉴 — 공개프로필 보기 + 신고하기 (2026-04-06 v36)**:
  - 상세글(RootPostCard) 헤더 + 댓글 5개 보드(PostCard, DebateBoard, OneCutDetailView, OneCutCommentBoard, FormalBoard) 전체에 ⋯ 점 세 개 메뉴 추가.
  - 공개프로필 보기(활성, onAuthorClick→PublicProfile) + 신고하기(비활성, 향후 유배·귀양지 연계).
  - 글카드(AnyTalkList)는 아바타 클릭으로 충분하므로 ⋯ 제거.
  - 팝업 사이즈 축소(w-28, py-0.5, text-[11px]) + onMouseLeave 자동 닫힘.

- [x] **상세글 골드스타 표시 (2026-04-06 v36)**:
  - RootPostCard, OneCutDetailView 인터랙션 바에 골드스타(★) 추가. Lv5 이상 유저 좋아요 수 표시. 좋아요 좌측 배치.

- [x] **글카드 아바타 간격 축소 (2026-04-06 v36)**:
  - 아바타 gap-2.5→1.5, 사이즈 w-7→w-6, 통계 바 gap-3→2. 깐부수 정보 노출 확보.

- [x] **숫자 표기 K/M 방식 전환 (2026-04-06 v36)**:
  - formatKoreanNumber: 한국어(천,만) → K/M 방식. 1000→1K, 1500→1.5K, 10000→10K, 1000000→1M.

- [x] **RSS HTML 엔티티 디코딩 완성 (2026-04-06 v36)**:
  - 숫자형(&#034;→", &#039;→') + 16진수(&#x27;→') 엔티티 범용 디코딩.
  - functions stripHtml/extractTitle + Workers OG 미리보기 양쪽 적용.

- [x] **OG 미리보기 위치 변경 (2026-04-06 v36)**:
  - 상세글 본문 위 → 본문+이미지 아래로 이동.

- [x] **삼색선 자주색 통일 (2026-04-06 v36)**:
  - 진한자주(#7c3aed)·자주(#a78bfa)·진한자주(#7c3aed). PC·모바일 동일.

- [x] **황금알 분야 업데이트 (2026-04-06 v36)**:
  - 지식·학문: 교육외국어 → 교육·외국어 분리 + 역사 추가. 총 10개.

- [x] **깐부맺기 화면 리뉴얼 — 홍보 카드 시스템 (2026-04-07 v37)**:
  - FriendsView: `#깐부 맺기` 헤더 + 홍보 카드 그리드 (promoEnabled 유저 동적 목록).
  - KanbuPromoCard: 메인 이미지(16:9) + 아바타 + 키워드 태그 + 공약 컴팩트 카드.
  - KanbuPromoModal: 팝업 상세 (레벨/평판 프로그레스 바 + 키워드 + 공약 + 활동 지표 + 깐부맺기 버튼).
  - KanbuPromoForm: 이미지/GIF 업로드 + 키워드 3개(10자) + 공약(100자). Lv2+ 등록 가능.
  - Firestore: `users/{uid}` — `promoEnabled, promoImageUrl, promoKeywords, promoMessage, promoUpdatedAt` 필드.
  - 기존 `FRIENDS_MENU_ALLOWED_NICKNAMES` 하드코딩 제거 → promoEnabled 동적 필터.

- [x] **ADSMARKET 2종 광고 슬롯 + 작성 폼 전체 적용 (2026-04-07 v37)**:
  - 플랫폼 광고(Lv2+): bottom 1개, 자체 프로모션, 클릭 시 새 창.
  - 작성자 광고(Lv5+): 새글 작성 시 ON/OFF 선택 (광고마켓/애드센스).
  - AdSlotSetting 컴포넌트 — 10개 작성 폼 전체 적용.
  - Cloud Functions 4개 배포: adAuction, aggregateDailyRevenue, detectFraud, processSettlements.

- [x] **신포도와 여우 새글 100자 제한 (2026-04-07 v37)**:
  - 공백 제외 순수 글자 수 100자 이내 OR 이미지 1개. 수정은 제한 없음.

- [x] **기타 개선 (2026-04-07 v37)**:
  - 홈/한컷 탭바 좌측 패딩 px-2→px-4 (글카드 라인 정렬).
  - 한컷 빈 상태 메시지 추가.
  - 화이트스크린 방지 ErrorBoundary + Firestore 끊김 자동 복구.

- [x] **한컷 카드 레이아웃 통일 (2026-04-07 v38)**:
  - 한컷 카드(OneCutList + AnyTalkList 인라인 스트립) 하단을 일반 글카드와 완전 동일 구조로 통일.
  - 아바타 w-7→w-6, 아바타 클릭 → 공개 프로필(onAuthorClick) 추가, 공유 버튼(URL 복사) 복원.
  - 원본글 영역 min-h-[22px] 확보 — 원본글 유무와 무관하게 카드 세로 사이즈 동일.
  - AnyTalkList 인라인 스트립에 linkedPostId→원본글 제목 표시 로직 추가 (allPosts prop 전달).

- [x] **Cloud Functions 분리 + 땡스볼 서버 전환 (2026-04-07 v38)**:
  - functions/index.js(766줄) → 8개 모듈로 분리: thanksball, auction, revenue, fraud, settlement, kanbuPromo, testCharge, contentLength.
  - sendThanksball: ballBalance 직접 수정 Rules 차단 → Admin SDK 트랜잭션으로 전환.
  - 수신자 UID: posts.author_id 최우선 조회 (nickname_ 문서 UID 불일치 대응).
  - 발신자 닉네임: Firestore users/{uid}.nickname 조회 (auth.token.name 부정확 대응).
  - testChargeBall: 테스트용 볼 충전도 Cloud Function 전환.

- [x] **광고 딥링크 + 플랫폼 광고 개선 (2026-04-07 v38)**:
  - AdFallback에 '광고' 라벨 배지 추가.
  - /?menu= URL 파라미터로 메뉴 자동 이동 (광고 클릭 → 해당 기능 화면).

- [x] **마라톤의 전령 RSS 피드 교체 (2026-04-08 v39)**:
  - MBC: 깨진 URL → narrativeNews.rss 교체.
  - KBS: RSS 서비스 종료 → 연합뉴스(yna.co.kr) 대체.
  - 뉴스1: RSS 서비스 종료 → 뉴시스(사회/정치/국제/문화 4개 섹션 순차 수집) 대체.
  - 동아일보: rss.donga.com/total.xml(50건)로 확대. urls 배열 지원 추가.

- [x] **공유 링크 로딩 개선 (2026-04-08 v39)**:
  - 공유 링크 클릭 시 "공유된 글을 불러오는 중..." 로딩 화면 표시.
  - 10초 타임아웃 후 홈으로 이동 + 안내 알림 (기존: 무한 대기).

- [x] **나의 한컷 리스트 전환 + 재등록 기능 (2026-04-08 v39)**:
  - 나의 한컷 탭: OneCutList(그리드 카드) → MyContentTabs(리스트) 전환.
  - 등록글 미달 글(2시간 경과 + 좋아요 3개 미만) 재등록 기능 추가 (1회 한정).
  - 재등록 시 제목 앞에 [재등록] 추가 + createdAt 리셋(새글 복귀) + repostedAt 기록.
  - 나의 기록 + 나의 한컷 모두 적용.

- [x] **상태 배지 세분화 (2026-04-08 v39)**:
  - 나의 기록·한컷 리스트의 "게시글" 일괄 배지 → 새글/미등록/등록글/인기글/최고글 상태별 배지.
  - 미등록 상태 옆에 [재등록] 버튼이 자연스럽게 연결.

- [x] **장갑 Phase 6: 가입 폼 빌더 + 인증 마킹 시스템 (2026-04-08 v40)**:
  - **Step 1**: 스키마 — JoinForm, JoinAnswers, VerifiedBadge 등 10개 타입, regions.ts (17시/도 248시/군/구), joinForm.ts 유틸
  - **Step 2**: CreateCommunityModal — 가입 폼 빌더 UI (표준 필드 5개 enabled/required 토글, shares 종목명+단위, 커스텀 질문, 5개 슬롯 제한)
  - **Step 3**: JoinCommunityModal 신규 — 폼 빌더 모드(지역 2단 셀렉트, 주식수 곱셈 미리보기) + 레거시 모드. CommunityList 승인제 모달 분기
  - **Step 4A**: JoinAnswersDisplay 신규 — 관리 탭 승인 대기 구조화 답변 표시
  - **Step 4B**: VerifiedBadge + VerifyMemberModal — 멤버 탭 인증 부여/해제, 글 작성자 배지, 라벨 추천칩+미리보기
  - **Step 5**: Firestore Rules 보강 (create 본인 명의, 본인 민감필드 차단, 관리자 hasOnly+verified, joinAnswers 보호)
  - **Step 6**: 댓글·글 상세 작성자 인증 배지, 비가입자 접근 제한(승인제 차단/open 읽기전용), GLOVE.md 전면 업데이트

- [x] **장갑 Phase 7: 실시간 채팅방 (2026-04-08 v41)**:
  - **Step 1**: ChatMessage 타입, CHAT_MEMBER_LIMIT(50), CommunityChatPanel placeholder, 채팅 탭
  - **Step 2**: onSnapshot 실시간 구독 + 메시지 전송 + 카톡 스타일 좌/우 정렬 + 작성자 스냅샷
  - **Step 3**: 답장(replyTo) + 이모지 반응 6종(👍❤️😂🔥🤔💯)
  - **Step 4**: 이미지 업로드(R2 📎+클립보드+드래그), 라이트박스 원본 보기
  - **Step 5**: 채팅 땡스볼(Cloud Function 확장, ThanksballModal 재사용)
  - **Step 6**: Firestore Rules 정식화, 페이징(스크롤 기반 30개씩), soft delete, GLOVE.md 반영

- [x] **커뮤니티 UI 통일 + 버그 수정 (2026-04-09 v42)**:
  - 글카드 하단 AnyTalkList 패턴 통일 (아바타+Lv/평판/깐부수+댓글/땡스볼/좋아요) — CommunityFeed, CommunityView, CommunityPostDetail
  - 상세글 작성자 카드 RootPostCard 패턴 (큰 아바타+❤️/⚾/깐부맺기 pill, 본인 비활성)
  - 상세글 댓글 DebateBoard 패턴 (좋아요/땡스볼/수정/삭제/고정)
  - CommunityPostDetail 별도 파일 추출 → CommunityFeed에서 상세 모달 직접 오픈
  - 채팅 문서 파일 공유 (PDF/DOC/XLSX/PPTX, 10MB 한도, 아이콘+다운로드)
  - 장갑 개설/가입 레벨 체크: userData.level→calculateLevel(exp) 교체
  - 장갑 개설 후 joinedCommunityIds 즉시 반영
  - 커뮤니티 카드에 가입 조건 나열 (승인제·Lv·필수 필드)
  - 커뮤니티 전체 낙관적 업데이트 (좋아요/승인/거절/인증/역할변경/강퇴)
  - 채팅 읽지 않은 메시지 카운트 (chatLastReadAt)
  - 블라인드 글 관리자에게 표시 (해제 가능)
  - 장갑찾기 기본 탭, 가입된 장갑 카드 제외
  - selectedCommunity 최신값 참조 (communities.find 패턴)
  - firestore.indexes.json 누락 인덱스 정비

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

