# AdsTestScenarios — ADSMARKET v2.1 검증 시나리오

> **목적**: ADSMARKET v2 P0~P1 7항목 + v2.1 안정화의 동작 검증.
> 각 시나리오는 self-contained — 사전 조건 / 조작 절차 / 기대 결과 / 검증 위치 명시.
>
> 최종 갱신: 2026-04-26 (commit 67506c3 기준)
>
> **참고 문서**: [AdsRoadmap.md](./AdsRoadmap.md) — 13항목 종합 계획서

---

## 📋 검증 진행 트래커

### 즉시 검증 가능 (인프라 적용 완료)

- [x] S-1 광고 등록 → 검수 → 활성 (smoke test)
- [x] S-2 단일 카운터 (totalClicks +1, totalImpressions +1, viewableImpressions +1)
- [x] S-3 selectedAd 직접 매칭 impression 카운트
- [x] S-4 비율 표시 정상 (viewableRate 100% clamp, ctr clamp)
- [x] S-5 광고 클릭 → 새 탭 이동 + UTM
- [x] S-6 광고주 검수 흐름 (pending → active/rejected + 알림)
- [x] S-7 광고 수정 → 재검수 (Rules merge 통과)
- [x] **S-8 빈도 캡 4번째 차단** ✅ 2026-04-28 통과 (커밋 707b2e2 — selectedAd 빈도 캡 적용 후 / fb96806 — impression 이중 누적 해소 / 0f07aee — 신규 등록 alert 보강)
- [x] **S-9 Brand Safety 차단** ✅ 2026-04-28 통과 (커밋 1158a06 — picker UI 차단 시각 구분 / 628f684 — 메뉴 매칭 누락 추가 발견·해소: AdMarketplaceModal isMenuAllowed + AdSlot directAd 광고주 의도 강제)
- [x] **S-10 다른 슬롯 광고 안내 alert** ✅ 2026-04-28 통과 (S-9 수정 시 함께 검증 완료)
- [x] **S-11 광고 노출 지역 매칭** (Cloudflare cf.region) ✅ 2026-04-28 통과 (커밋 98a4ab5 — region은 viewer 기반이라 차단 X. amber 배지 'ℹ️ 내 지역 미노출' + 클릭 시 confirm)
- [ ] **S-12 노출 추정값 슬라이더 갱신** ← 다음 진행
- [ ] **S-13 자동매칭 명시 결정 — selectedAds[pos]='auto'**

### D+1 (2026-04-28) 이후 검증

- [ ] **S-14 aggregateAdStats 첫 일치 데이터** (04:30 KST 이후)
- [ ] **S-15 AdStatsModal 데이터 노출**

### D+7 (2026-05-03) 안정성 검증

- [ ] **S-16 일예산 자동 정지** (todaySpent ≥ dailyBudget)
- [ ] **S-17 04:00 KST 자동 재개** (releaseDailyBudgetPause)
- [ ] **S-18 viewableRate 분포** (광고주 카드 평균 70~95%)

---

## 🟢 즉시 검증 가능 시나리오

### S-8. 빈도 캡 4번째 차단

**사전 조건**:
- 광고주 광고 1개 활성 (frequencyCap default 24h 3회)
- 일반 사용자 1명 (예: 깐부8호)
- 광고 노출되는 글 1개 (예: 깐부10호 참새방앗간 글, bottom 슬롯)

**조작 절차**:
1. 깐부8호로 로그인
2. 깐부10호 글 진입 (1회) → 광고 영역에 1초+ 머무름 → viewable 1
3. 다른 글로 이동 후 다시 깐부10호 글 진입 (2회) → viewable 2
4. 같은 절차 반복 (3회) → viewable 3
5. 4번째 진입 시도

**기대 결과**:
- 1·2·3회: 같은 광고 노출
- 4회째: **다른 광고** 또는 fallback 'adsense' 표시 (같은 광고 안 보임)
- Firestore `adEvents` — 깐부8호의 viewable 3건만 (4번째는 매칭 자체에서 제외되어 기록 안 됨)
- `ads.viewableImpressions += 3` (4가 아님)

**검증 위치**:
- Firebase Console > Firestore > `adEvents` (viewerUid + adId 필터)
- `firebase functions:log --only adAuction --lines 10` — 매칭 로그

**✅ 2026-04-28 검증 통과 + 추가 버그 수정 3종**:

1차 시도 — middle 슬롯의 selectedAd 광고에 빈도 캡 미적용 발견 → **옵션 A 적용** (selectedAd도 빈도 캡 검사). [AdSlot.tsx](src/components/ads/AdSlot.tsx) directAd useEffect에 viewerUid+adId 24h viewable count 검사 추가 (커밋 `707b2e2`).

2차 시도 — 빈도 캡 정상 동작 ✅ but impression이 1회 진입에 +2씩 누적되는 추가 버그 발견:
| 차수 | viewableImpressions | totalImpressions |
|------|--------------------:|----------------:|
| 1 | 1 | +2 |
| 2 | 2 | +4 |
| 3 | 3 | +6 |
| **4** | **3 (불변, 차단)** | +6 |

원인 — selectedAdId가 광고 ID일 때 directAd useEffect와 매칭 useEffect가 동시 실행되어 같은 광고가 매칭 분기에서도 매칭되면서 impression 추가 +1.

수정 — 매칭 useEffect에서 `selectedAdId && selectedAdId !== 'auto'`이면 매칭 fetch skip + setLoaded(true)로 빈 슬롯 메시지 표시 보장 (커밋 `fb96806`).

3차 — 신규 등록 시 alert 누락 발견. 수정 모드는 alert 있는데 신규는 setDoc 후 바로 onBack(). 추가 — `✅ 광고 등록 완료 — 검수 요청이 접수됐어요...` (커밋 `0f07aee`).

---

### S-9. Brand Safety 차단

**사전 조건**:
- 광고 1개 — `blockedCategories: ['유배·귀양지']` (default)
- 유배자 글 1개 (category='유배·귀양지')

**조작 절차**:
1. 유배자 글 진입 (광고 슬롯 ON 상태)
2. 광고 영역 확인

**기대 결과**:
- 차단 카테고리 매칭으로 후보 제외 → 다른 광고 또는 fallback
- `adEvents`에 해당 광고 impression 없음

**검증 위치**:
- 유배자 글 페이지에서 광고 헤드라인 확인
- Functions logs

---

### S-10. 다른 슬롯 광고 안내 alert

**사전 조건**:
- 광고 A: `targetSlots: ['top']` (top 슬롯만)
- 광고 B: `targetSlots: ['bottom']` (bottom 슬롯만)
- 작성자 (예: 깐부10호 Lv10) — 3슬롯 활성

**조작 절차**:
1. 새 글 작성 폼 진입 → 광고 ON
2. **bottom 슬롯**의 광고 picker 클릭 → AdMarketplaceModal 열림
3. 광고 A 카드 클릭 (top만 매칭, bottom 비매칭)

**기대 결과**:
- 광고 A 카드에 `🚫 다른 슬롯` 배지 (rose-100 배경)
- 카드 클릭 시 alert:
  ```
  📌 안내
  "광고 A 헤드라인" 광고는 광고주가 [상단] 슬롯에 등록한 광고예요.
  현재 댓글 끝 슬롯에는 노출되지 않으므로 자동 매칭으로 결정됩니다.
  이 광고를 노출하려면 광고주에게 댓글 끝 슬롯 추가를 요청해주세요.
  ```
- 헤더 카운트: `📌 이 슬롯 매칭 1개 / 전체 활성 2개`

**검증 위치**:
- AdMarketplaceModal 시각 확인

---

### S-11. 광고 노출 지역 매칭

**사전 조건**:
- 광고 A: `targetRegions: ['서울']` (서울만)
- 광고 B: `targetRegions: []` (전국)
- 사용자 IP 위치 = 서울 또는 경기

**조작 절차**:
1. 사용자 위치가 서울인 경우: 광고 노출되는 글 진입
2. 사용자 위치가 경기인 경우: 같은 글 진입

**기대 결과**:
- 서울 사용자: 광고 A 또는 B 노출 가능
- 경기 사용자: 광고 B만 노출 가능 (A는 후보 제외)

**검증 위치**:
- `firebase functions:log --only adAuction` — `viewerRegion` 로그
- `https://halmal-link-preview.mirr0505.workers.dev/region` 응답 (사용자 IP 기반)
- 직접 호출: `curl -H "Origin: https://geulove.com" https://halmal-link-preview.mirr0505.workers.dev/region`

---

### S-12. 노출 추정값 슬라이더 갱신

**사전 조건**:
- 광고주 등록 폼 (AdCampaignForm) 진입

**조작 절차**:
1. 입찰가 input 5볼 입력 → 0.5초 대기
2. 입찰가 30볼로 변경 → 0.5초 대기

**기대 결과**:
- "📊 예상 일 노출" 카드 숫자 갱신
- 단가 ↑ → 노출 추정 ↑ (선형 비례)
- "💡 지난 7일 데이터 기반 추정" 안내문

**검증 위치**:
- AdCampaignForm 입찰 섹션
- Functions logs: `estimateAdReach` 호출 로그
- 아직 7일 데이터 없으면 "데이터 부족 — 보수적 추정" 메시지

---

### S-13. 자동매칭 명시 결정

**사전 조건**:
- 광고 슬롯 picker 진입 (AdSlotSetting)

**조작 절차**:
1. picker 라벨 확인:
   - 처음: `🎲 자동 매칭 — 직접 선택하기`
2. 광고 경매시장 모달 → "🎲 선택 안 함 — 자동 매칭" 카드 클릭
3. 우측 [✓ 자동 매칭으로 결정] 버튼 클릭
4. picker 라벨 재확인:
   - 변경: `✅ 자동 매칭 결정됨 — 변경하기` (보라색 강조)

**기대 결과**:
- selectedAds[pos] = 'auto' (Firestore 글 doc 저장 시)
- AdSlot이 'auto'를 받으면 directAd fetch skip → 경매 매칭으로 fallback

**검증 위치**:
- AdSlotSetting picker 라벨 변화
- 글 게시 후 Firestore `posts/{postId}.selectedAds`

---

## ⏰ D+1 이후 검증 시나리오

### S-14. aggregateAdStats 첫 일치 데이터

**검증 시점**: 2026-04-28 04:30 KST 이후

**사전 조건**:
- 2026-04-27에 광고 활성화 + 1회 이상 viewable/click 발생

**기대 결과**:
- `ad_stats_daily/{adId}_20260427` 문서 생성
- 필드: `impressions / viewableImpressions / clicks / spent / uniqueViewers / bySlot / byMenu / byRegion / byHour`

**검증 위치**:
- Firebase Console > Firestore > `ad_stats_daily` 컬렉션
- `firebase functions:log --only aggregateAdStats --lines 5`

---

### S-15. AdStatsModal 데이터 노출

**사전 조건**: S-14 데이터 생성 완료

**조작 절차**:
1. 광고주(깐부6호) 로그인
2. AdvertiserCenter > 캠페인 탭 > 광고 카드 [📊 통계] 클릭

**기대 결과**:
- AdStatsModal 풀스크린 모달 열림
- KPI 4종 카드 (노출 / 가시 / 클릭 / 소진) — 숫자 + 스파크라인
- 일별 트렌드 SVG 라인 차트 (2일 이상 누적되면 표시)
- 분해 3종 (슬롯 / 메뉴 / 지역) — 막대 차트
- 시간대 24h 히트맵 (보라색 농도)

**검증 위치**: AdStatsModal 시각 확인

---

## 🔴 D+7 안정성 검증

### S-16. 일예산 자동 정지

**검증 시점**: 일예산 도달 시점

**사전 조건**:
- 광고 일예산 작게 설정 (테스트용 — 예: dailyBudget=1)
- 노출 100회 이상 누적 → todaySpent ≥ 1

**조작 절차**:
1. 매시간 정각에 `enforceBudgetLimits` 자동 실행
2. todaySpent ≥ dailyBudget 광고 자동 정지

**기대 결과**:
- `ads.status = 'paused'`
- `ads.pausedReason = 'budget_daily'`
- `notifications/{advertiserId}/items` 새 문서 — `type='ad_budget_paused'` + 메시지
- 광고주센터 카드: `📊 예산소진` 배지 + 일예산 게이지 100% (rose 색상)

**검증 위치**:
- Firestore `ads/{id}` 문서
- 광고주 알림 종
- `firebase functions:log --only enforceBudgetLimits --lines 5`

---

### S-17. 04:00 KST 자동 재개

**검증 시점**: S-16 발생 다음날 04:00 KST 이후

**기대 결과**:
- `ads.status = 'active'` 복귀
- `ads.pausedReason` 삭제
- `ads.todaySpent = 0` 리셋
- `ads.lastSpentResetAt` 업데이트

**검증 위치**:
- Firestore `ads/{id}` 문서
- `firebase functions:log --only releaseDailyBudgetPause --lines 5`

---

### S-18. viewableRate 분포

**검증 시점**: 2026-05-03 (D+7)

**기대 결과**:
- 광고당 viewableImpressions / totalImpressions = 70~95%
- 광고주센터 카드 `가시 X (70~95%)` 표시
- 평균 viewableRate가 60% 미만이면 → 페이지 디자인·광고 위치 점검 필요

**검증 위치**:
- 광고주센터 광고 카드들
- AdStatsModal 누적 평균

---

## 🛠️ 진단 명령어 모음

### Functions Logs

```bash
# 광고 매칭 + viewable + click
firebase functions:log --only adAuction --lines 30

# 일예산 정지
firebase functions:log --only enforceBudgetLimits --lines 10

# 일예산 재개
firebase functions:log --only releaseDailyBudgetPause --lines 10

# 일별 통계 집계
firebase functions:log --only aggregateAdStats --lines 10

# 검수 알림
firebase functions:log --only onAdPendingReview --lines 10
firebase functions:log --only onAdvertiserPendingReview --lines 10
```

### Cloudflare Worker /region 직접 호출

```bash
curl -H "Origin: https://geulove.com" https://halmal-link-preview.mirr0505.workers.dev/region
# 응답: { "region": "Gyeonggi-do", "country": "KR", "city": "..." }
```

### Firestore Console 핵심 문서

- `ads/{adId}` — 광고 카운터·예산·상태
- `adEvents/*` — viewerUid+adId+eventType 필터로 빈도 캡 검증
- `ad_stats_daily/{adId}_{yyyymmdd}` — 일별 집계 (D+1 이후)
- `advertiserAccounts/{uid}` — 광고주 status·검수 정보
- `notifications/{uid}/items` — 광고 관련 알림 type
  - `ad_pending_review` (관리자에게)
  - `advertiser_pending_review` (관리자에게)
  - `advertiser_approved` / `advertiser_rejected` (광고주에게)
  - `ad_budget_paused` (광고주에게)

---

## ⚠️ 주의 사항

1. **카운터 reset 후 검증**: 광고 doc의 누적 카운터가 비정상이면 Firebase Console에서 수동 0 reset 후 새로 누적 — 깨끗한 비율 확인.
2. **viewable 캐시**: AdSlot의 `viewableFiredRef`/`impressionFiredRef`는 컴포넌트 mount 단위. 페이지 새로고침마다 새 ref → 같은 사용자가 새로고침 N회 = N 누적.
3. **빈도 캡 검증** 시 같은 사용자로 4회 이상 새로고침 — Firestore `adEvents` 필터로 누적 확인.
4. **Brand Safety**: default `['유배·귀양지']` 외 추가 차단 카테고리 토글은 등록 폼에서 광고주 선택 가능.
5. **광고주 본인 광고**는 자기 글에 자동 노출 가능 (제한 없음).
6. **Cloudflare cf.region**은 IP 기반 — VPN 사용 시 결과 다름. 일반 IP 기준 검증.

---

## 📌 다음 세션 시작점

1. 위 트래커에서 미검증 항목 (`[ ]`) 우선 진행
2. D+1, D+7 일정 도달 시 자동 검증 항목 (`S-14~S-18`) 점검
3. 모든 시나리오 통과 후 → AdsRoadmap.md **P1-6 A/B 다중 소재** 착수

---

## 📅 변경 이력

| 날짜 | 변경 |
|------|------|
| 2026-04-26 | 최초 작성 — 18 시나리오 정리 (S-1~S-18) |
