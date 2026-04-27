# AdsRoadmap — ADSMARKET v2 광고 시스템 고도화 계획

> **목적**: YouTube AdSense / Meta Ads Manager / Naver SAS급 광고주 경험을 단계적으로 도입.
> 정식 오픈 전 P0(필수) → 베타 안정화 P1 → 성장기 P2 순서로 한 스텝씩 진행.
>
> **원칙**: ❶ 광고주 신뢰 우선 ❷ 사용자 광고 피로도 최소화 ❸ 작성자 수익 가시성 ❹ 선진 UIUX
>
> 최종 갱신: 2026-04-26

---

## 📊 진행 트래커

### P0 — 필수 (정식 오픈 전 / 광고주 유치 직결)

- [x] **P0-1** 일/총 예산 자동 차감·정지 — 광고주 안전장치 ✅ 2026-04-26 (커밋 2f47252)
- [x] **P0-2** 빈도 캡 (Frequency Cap) — 사용자 광고 피로도 제어 ✅ 2026-04-26 (커밋 2f47252)
- [x] **P0-3** 광고주 통계 대시보드 — 노출·클릭 트렌드 + 분해 ✅ 2026-04-26 (커밋 2f47252)
- [x] **P0-4** Viewable Impressions (IAB 표준) — 단가 정당화 ✅ 2026-04-26 (커밋 2f47252)

### P1 — 중기 (베타 안정화 후 1~3개월)

- [x] **P1-5** UTM 자동 부착 — 외부 측정 연동 ✅ 2026-04-26 (커밋 2f47252)
- [ ] **P1-6** A/B 다중 소재 — 캠페인 단위 그룹화
- [x] **P1-7** 예상 노출 추정치 — 등록 시 단가 결정 가이드 ✅ 2026-04-26 (커밋 2f47252)
- [x] **P1-8** 콘텐츠 안전 (Brand Safety) — 토픽 차단 옵션 ✅ 2026-04-26 (커밋 2f47252)

### P2 — 장기 (성장기, 광고비 1만볼+ 광고 등장 후)

- [ ] **P2-9** Smart Bidding (목표 CPA / 전환 최대화)
- [ ] **P2-10** 리타게팅 + 픽셀 인프라
- [ ] **P2-11** 후불 정산 + 세금계산서 (사업자/법인)
- [ ] **P2-12** 작성자 슬롯 단가 floor (CPM 100볼+ 등)
- [ ] **P2-13** 부정 클릭 ML — 클릭 패턴 분석·환불

---

## ✅ 2026-04-26 P0~P1 일괄 배포 결과

**상태 요약**: 13항목 중 **7건 완료** (P0 4/4, P1 3/4)

**배포 산출물**:
- **Functions 5종**: `adAuction` (수정) + `enforceBudgetLimits` / `releaseDailyBudgetPause` / `aggregateAdStats` / `estimateAdReach` (신설)
- **컬렉션 신설**: `ad_stats_daily/{adId}_{yyyymmdd}` — 일별 광고 통계
- **신규 필드**: `ads.{pausedReason, todaySpent, lastSpentResetAt, frequencyCap, viewableImpressions, blockedCategories}` + `adEvents.eventType` 'viewable' 추가
- **신규 컴포넌트**: `AdStatsModal` (KPI 4종 + 일별 SVG 라인 + 슬롯/메뉴/지역 분해 + 24h 히트맵)
- **firestore.rules**: 7개 신규 필드 클라 직접 쓰기 차단
- **firestore.indexes**: adEvents (viewerUid, adId, eventType, createdAt) + ad_stats_daily (adId, date) + ads (status, pausedReason)

**자동 운영 스케줄**:
- 매시간 — `enforceBudgetLimits`
- 매일 04:00 KST — `releaseDailyBudgetPause`
- 매일 04:30 KST — `aggregateAdStats`

**검증 일정**:
- D+1 (2026-04-27 04:30+): `ad_stats_daily` 첫 일치 데이터 생성 확인 → AdStatsModal 데이터 노출 확인
- D+7 (2026-05-03): viewableRate 분포 + 빈도 캡 캡 도달률 + 일예산 자동 정지 빈도 점검
- D+14 (2026-05-10): 광고주 카드 통계 사용 비율 + AdStatsModal 도달률 (재구매율 가설 검증)

---

## 🎨 UIUX 디자인 원칙 (전 항목 공통)

### 색상 시스템

| 상태 | 색상 | 용도 |
|------|------|------|
| 활성·정상 | `emerald-600` | active 광고, 수익 발생, OK 신호 |
| 진행·대기 | `violet-600` | 검수중, 진행중, 사용자 액션 유도 |
| 경고·소진 임박 | `amber-500` | 예산 80%↑, 빈도 캡 근접 |
| 위험·정지 | `rose-500` | 일시정지, 거절, 예산 초과 |
| 정보·보조 | `sky-600` | 지역 타겟, 메뉴 일치, 안내 |

### 타이포·레이아웃

- 핵심 KPI: `text-[24px] font-[1000]` (대시보드 카드 헤드)
- 보조 라벨: `text-[10px] font-bold text-slate-400 uppercase tracking-widest`
- 차트 라벨: `text-[9px] font-bold` 절대 12px 안 넘김 (정보 밀도 확보)
- 카드 `rounded-2xl border border-slate-100 shadow-sm` 통일

### 컴포넌트 패턴

- **KPI 카드**: 큰 숫자 + 전일 대비 ↑↓ + 미니 스파크라인 (24h)
- **게이지 바**: 예산 소진율, CTR 분포 — 0~100% 그라데이션 + 임계 색상 전환
- **A/B 평행 카드**: 두 소재 좌우 동일 폭 + 우승자 ⭐ 강조
- **인라인 시뮬레이터**: 슬라이더 → 실시간 추정값 갱신 (debounce 300ms)
- **빈 상태(empty state)**: 아이콘 + 이유 + 1차 액션 버튼 (절대 텍스트 단독 금지)

### 모바일 우선

- 대시보드 차트: PC 멀티 컬럼 → 모바일 세로 스크롤. 미니 차트는 가로 스크롤 캐러셀
- 등록 폼: 모바일 풀스크린 모달 + 스텝별 진행 (5단계 wizard)

### 마이크로카피

- 빈 상태: "아직 데이터가 없어요" → 너무 가벼움. 대신 "노출 24시간 후 데이터가 표시됩니다"
- 위험: "예산이 80% 소진됐어요. 추가 충전 또는 목표 도달 시 자동 종료" (이유 + 다음 행동)

---

## P0-1. 일/총 예산 자동 차감·정지

> **광고주 신뢰의 가장 큰 안전장치.** 현재 dailyBudget·totalBudget 필드는 있지만 실제 차감 미연동.

### 목적
- 광고주가 입력한 예산을 초과해 비용이 빠지지 않음을 보장
- 일예산 도달 → 자동 일시정지(다음날 04:00 자동 재개)
- 총예산 도달 → 자동 종료(status='completed')

### AS-IS
- `dailyBudget` / `totalBudget` 필드만 존재
- auction.js에 예산 체크 로직 없음 — 무제한 노출
- 광고주센터에서 사용자가 수동 일시정지만 가능

### TO-BE
- auction.js: 매칭 시 `today_spent + chargeAmount > dailyBudget` → 후보 제외
- `revenue.js`: 차감 후 `totalSpent + dailyBudget` 갱신
- 새 CF `enforceBudgetLimits` (매시간): 일예산 도달 ad → status='paused' (단, `pausedReason='budget_daily'` 표지) → 매일 04:00 자동 재개 (`releaseDailyBudgetPause`)
- 총예산 도달 ad → status='completed' (재개 안 됨)

### UIUX 시안

**광고주센터 카드 (AdvertiserCenter.tsx)** — 광고 카드 좌측에 게이지 추가:
```
┌─ 분당 제일 꽃집 ─────────── [활성] ────┐
│ 일예산 ⚾ 1,000  ━━━━━━━━━━━━ 78%      │  ← 게이지 바 (78% 소진)
│              720볼 사용 / 280볼 남음    │     amber-500 70%↑
│ 총예산 ⚾ 10,000 ━━━━━━━ 56%          │     rose 95%↑
│              5,600볼 사용              │
└────────────────────────────────────────┘
```

**자동 정지 알림 토스트**:
```
🛑 일예산 소진 — '분당 제일 꽃집' 광고가 일시정지됐어요.
   [즉시 재개 (예산 무시)] [내일 04:00 자동 재개 OK]
```

**등록 폼 (AdCampaignForm)** — 일예산 입력 옆 "일평균 노출 추정" 미니 라벨:
```
일예산 ⚾ [1000] → 일 약 100,000회 노출 추정 (CPM 10볼 기준)
```

### DB 영향

- `ads/{id}` 신규 필드:
  - `pausedReason?: 'manual' | 'budget_daily' | 'budget_total' | 'rejected'`
  - `todaySpent: number` (KST 자정 리셋)
  - `lastSpentResetAt: Timestamp`
- `audit_logs/budget_pauses` 신규 (정지·재개 이력)

### 서버 변경
- `functions/auction.js` — 매칭 시 `dailyBudget - todaySpent < chargeAmount` 후보 제외
- `functions/revenue.js` — 차감 후 `todaySpent / totalSpent` increment
- `functions/budgetEnforcer.js` (신규)
  - `enforceBudgetLimits` (매시간): dailyBudget 도달 → paused
  - `releaseDailyBudgetPause` (매일 04:00 KST): 일예산 정지 ad 재개 + todaySpent=0 리셋

### 클라 변경
- `AdvertiserCenter.tsx` — 광고 카드에 예산 게이지 + 소진율 색상
- `AdCampaignForm.tsx` — 일예산 입력 옆 노출 추정치
- 자동 정지 알림 — `notifications/items` 신규 type `ad_budget_paused`

### 체크리스트
- [ ] DB 필드 추가 (마이그레이션 — 기존 ad에 todaySpent=0)
- [ ] auction.js 예산 체크 가드
- [ ] revenue.js todaySpent increment
- [ ] budgetEnforcer.js 2종 CF
- [ ] firestore.rules — pausedReason 클라이언트 직접 수정 차단
- [ ] AdvertiserCenter UI 게이지
- [ ] 알림 type 추가

### 예상 분량: **2~2.5h**

---

## P0-2. 빈도 캡 (Frequency Cap)

> **사용자 광고 피로도** 제어. 같은 광고를 같은 사용자에게 24h 내 N회 이상 노출 안 함.

### 목적
- 같은 사용자에게 같은 광고 24h 3회·48h 5회 노출 상한 (광고주 설정 가능)
- 다른 광고로 자연스러운 로테이션 유도

### AS-IS
- AdSlot 매칭 시 viewer ID 미고려 — 동일 사용자가 새로고침 시 같은 광고 노출 가능

### TO-BE
- `adEvents/{eventId}`에 `viewerUid` 기록 (이미 있을 가능성)
- auction.js 매칭 시 `viewerUid + adId` 24h 합산 → frequencyCap 초과 후보 제외
- 광고주가 직접 frequencyCap 설정 (default 24h 3회)

### UIUX 시안

**등록 폼 — 입찰 섹션 옆 신규 카드**:
```
👁 빈도 제한 (사용자별 노출 상한)
○ 자동 (24h 3회 · 권장)
○ 직접 설정
   24시간 내 [3] 회까지 노출
   💡 짧은 시간에 같은 광고를 자주 보면 사용자 거부감 ↑.
       3~5회가 광고 인지·전환의 황금 구간.
```

**대시보드 — 빈도 캡 시각화** (P0-3과 묶음):
```
👁 평균 노출 빈도: 사용자 1명당 1.7회 / 24h  ✅ 캡 3회 내
   빈도 분포: ▁▂▄▆▆▄▃▂▁▁ (1회·2회·3회 횟수 막대)
```

### DB 영향
- `ads/{id}.frequencyCap`: `{ limit: number; periodHours: number }` (default 3, 24)
- `adEvents` 인덱스 — `(viewerUid, adId, createdAt)` 추가

### 서버 변경
- `auction.js` — 매칭 직전 viewerUid 입력 받아 24h 합산. limit 초과 후보 스킵
- 클라이언트 viewerUid 전달 (이미 fetch body에 있을 듯, 점검)

### 클라 변경
- `AdCampaignForm` — 빈도 캡 섹션
- `AdSlot` — fetch body에 viewerUid (auth.currentUser.uid) 포함

### 체크리스트
- [ ] frequencyCap 필드 추가 + default
- [ ] adEvents 색인 추가
- [ ] auction.js 빈도 체크
- [ ] AdCampaignForm UI
- [ ] AdSlot fetch body 점검

### 예상 분량: **1.5h**

---

## P0-3. 광고주 통계 대시보드

> 등록 광고의 **노출·클릭 트렌드**를 광고주가 직접 보는 화면. **재구매율의 핵심**.

### 목적
- 일/주/월 노출·클릭 추이 그래프
- 슬롯·메뉴·지역별 분해
- 시간대별 노출 분포 (heatmap)
- 광고별 비교 (다중 광고 소유 시)

### AS-IS
- `totalImpressions / totalClicks / totalSpent / ctr` 누적치만
- 광고주센터 카드에 숫자 1줄 — 트렌드 없음

### TO-BE
- `ad_stats_daily/{adId}_{yyyymmdd}` 일별 집계 문서
  - impressions / clicks / spent / viewableImpressions / uniqueViewers
  - bySlot / byMenu / byRegion / byHour 분해
- AdvertiserCenter > 광고 카드 [📊 통계] 버튼 → AdStatsModal
- 매일 04:30 KST `aggregateAdStats` CF가 전일 adEvents 집계

### UIUX 시안

**AdStatsModal — 풀스크린 모달**:
```
📊 분당 제일 꽃집 — 통계               [최근 7일 ▾]    ✕

┌─ KPI 카드 4종 ────────────────────────────────────────┐
│ 노출     클릭      CTR       소진             │
│ 12,450   245       1.97%     8,500볼          │
│ ↑ 12%    ↑ 8%      ↓ 0.1%p   78% 사용         │
│ ▁▂▄▆█▇▅ ▁▁▂▃▄▅▄  ━━━━━     ━━━━━━━━━━━ 78%  │
└──────────────────────────────────────────────────────┘

┌─ 일별 트렌드 ─────────────────────────────────────────┐
│ [Recharts 또는 SVG 라인 차트 — 노출(violet) + 클릭(amber)] │
│  04/20 04/21 04/22 04/23 04/24 04/25 04/26              │
└──────────────────────────────────────────────────────┘

┌─ 슬롯별 분해 ────┬─ 메뉴별 분해 ───┬─ 지역별 분해 ────┐
│ top    52% ━━━━ │ 너와 나의… 38% │ 서울    45%      │
│ middle 31% ━━   │ 깐부방    28%  │ 경기    32%      │
│ bottom 17% ━    │ 강변시장  17%  │ 인천    11%      │
│                 │ 기타      17%  │ 부산     8%      │
└──────────────────┴─────────────────┴──────────────────┘

┌─ 시간대별 노출 (24h 히트맵) ──────────────────────────┐
│  00 02 04 06 08 10 12 14 16 18 20 22                  │
│  ░░░░░░▒▒▓▓▓▓▒▒▓▓██▓▓▒▒░░  ← 노출 빈도 색농도        │
└──────────────────────────────────────────────────────┘
```

**모바일** — 4종 KPI 카드는 가로 스크롤 캐러셀 / 분해 차트는 세로 스택 / 히트맵은 가로 12시간 단위 2줄.

**구현 라이브러리**:
- Recharts (이미 설치됐는지 확인) 또는 SVG 직접 (가벼움)
- 추천: SVG 직접 — 라이브러리 추가 없이, 작은 차트 4~5종은 100줄 미만으로 가능

### DB 영향
- `ad_stats_daily/{adId}_{yyyymmdd}`:
  - impressions / clicks / spent / viewableImpressions / uniqueViewers
  - bySlot: { top, middle, bottom }
  - byMenu: { [category]: number }
  - byRegion: { [shortName]: number }
  - byHour: number[24]
- `ad_stats_total/{adId}` 누적 (현재 ads doc 안에 있는 것 별도 분리)

### 서버 변경
- `functions/aggregateAdStats.js` (신규) — 매일 04:30 KST
  - 전일 adEvents 광고별 집계
  - bySlot/byMenu/byRegion/byHour 분해
  - ad_stats_daily 작성

### 클라 변경
- `AdStatsModal.tsx` (신규)
- `AdvertiserCenter.tsx` — 카드에 [📊 통계] 버튼
- `KpiCard.tsx` (재사용 가능 — 큰 숫자 + 변화율 + 스파크라인)

### 체크리스트
- [ ] adEvents 인덱스 점검 (광고별 + 날짜)
- [ ] aggregateAdStats CF
- [ ] AdStatsModal — KPI 4종 + 일별 차트 + 분해 3종 + 히트맵
- [ ] KpiCard 공용 컴포넌트
- [ ] 모바일 반응형 (스크롤 캐러셀)

### 예상 분량: **4~5h**

---

## P0-4. Viewable Impressions (IAB 표준)

> **광고가 화면에 50% 이상 1초 이상 노출된 경우만 1 viewable impression 카운트.** 광고주 신뢰·단가 정당화.

### 목적
- 화면 밖 또는 즉시 스크롤된 노출은 무효 처리
- viewableRate (viewable / total) — 광고주가 단가 정당성 판단

### AS-IS
- AdSlot 마운트 = 1 impression 즉시 카운트

### TO-BE
- AdSlot 마운트 후 IntersectionObserver로 50% 가시성 1초 충족 시 별도 `viewableImpression` 이벤트
- adEvents에 `eventType: 'view' | 'viewable' | 'click'`
- 단가는 viewable 기준 차감 (광고주 보호)

### UIUX 시안

**광고주센터 카드 — 신규 KPI**:
```
노출 12,450 ▸ 가시 노출 9,820 (78.9%)  ← viewableRate
```

**대시보드 — viewableRate 게이지** + 평균 비교:
```
👁 가시 노출률  78.9%
━━━━━━━━━━━━━━━━━━━━━━━━━ ✅ 평균 65% 대비 우수
```

### DB 영향
- `adEvents` `eventType` 확장: `'view' | 'viewable' | 'click'`
- `ad_stats_daily`에 `viewableImpressions` 추가

### 서버 변경
- `auction.js` — eventType별 차감 로직
- 단가 차감은 viewable 기준 (광고주 입장 공정)

### 클라 변경
- `AdSlot.tsx` — IntersectionObserver 50% × 1초 충족 시 viewable 이벤트 fire
- 1광고당 1 viewable (페이지 내 중복 카운트 차단)

### 체크리스트
- [ ] adEvents type 확장
- [ ] AdSlot IntersectionObserver
- [ ] revenue.js 차감 viewable 기준
- [ ] 통계 viewableImpressions 분리 표시

### 예상 분량: **1~1.5h**

---

## P1-5. UTM 자동 부착

> 광고 클릭 시 랜딩 URL에 `?utm_source=geulove&utm_campaign={adId}&utm_medium={slot}` 자동 추가.

### 목적
- 광고주가 자기 사이트 GA에서 글러브 광고 효과 측정 가능
- 외부 측정 도구 연동의 출발점

### UIUX 시안
- 등록 폼 미리보기 패널에 "최종 랜딩 URL" 표시:
```
🔗 실제 클릭 시:
   landingurl.com/page?utm_source=geulove
                       &utm_campaign=ad_123
                       &utm_medium=top
```

### 서버 변경
- `revenue.js` 또는 클릭 핸들러에서 URL 동적 조립 (DB는 base URL만 저장)

### 클라 변경
- `AdBanner.tsx` 클릭 시 `appendUTM(landingUrl, { adId, slot })` 거쳐 window.open

### 체크리스트
- [ ] appendUTM 헬퍼 함수
- [ ] AdBanner 클릭 핸들러
- [ ] 등록 폼 미리보기 표시

### 예상 분량: **30m**

---

## P1-6. A/B 다중 소재 (Campaign Group)

> **같은 캠페인 내 소재 2~3개 동시 등록 → 라운드로빈 → CTR 비교 → 우승자 자동 선정.**

### 목적
- 광고주가 헤드라인·이미지 A/B 비교
- CTR 30% 이상 차이 시 자동 winner 가중

### AS-IS
- ads 1개 = 소재 1개

### TO-BE
- 새 컬렉션 `ad_campaigns/{campaignId}` — 묶음
- ads에 `campaignId?` 추가 — 같은 campaignId 광고들이 A/B
- auction.js 매칭 시 같은 campaign 내 광고 라운드로빈 (50:50)
- CTR 차이 30% + 노출 1000회+ 도달 시 winner에 가중치 80:20

### UIUX 시안

**등록 폼 상단 — 캠페인 모드 토글**:
```
[ 단일 광고 ] [ A/B 캠페인 ▾ ]
   소재 A: 분당 제일 꽃집 (이미지 1)
   소재 B: 분당 제일 꽃집 (이미지 2)
   [+ 소재 C 추가]
   
💡 두 소재가 50:50 노출 → 1,000 노출 후 CTR 비교 → 우승자 자동 가중
```

**대시보드 A/B 비교 모달**:
```
🆚 A/B 캠페인 — 분당 제일 꽃집

┌─ 소재 A ────────────┬─ 소재 B (⭐ 우승) ──┐
│ [배너 미리보기]       │ [배너 미리보기]      │
│ CTR 1.7%            │ CTR 2.4% (+41%)     │
│ ━━━━━━              │ ━━━━━━━━━━           │
│ 노출 5,200          │ 노출 5,300          │
│ 클릭 88             │ 클릭 127            │
│ [소재 A 종료]         │ [그대로 유지]         │
└──────────────────────┴──────────────────────┘
```

### DB 영향
- `ad_campaigns/{campaignId}`: { name, advertiserId, status, winnerAdId? }
- `ads.campaignId?`

### 서버 변경
- `auction.js` — 같은 campaign 내 라운드로빈 + winner 가중

### 클라 변경
- `AdCampaignForm` 모드 토글 + 소재 슬롯 1~3개
- `AdABCompareModal.tsx` 신규

### 체크리스트
- [ ] ad_campaigns 컬렉션 + Rules
- [ ] auction.js 라운드로빈
- [ ] winner 자동 선정 로직 (CTR 분석 CF)
- [ ] AB 비교 모달

### 예상 분량: **3~4h**

---

## P1-7. 예상 노출 추정치

> 등록 시 단가 슬라이더 → "이 단가면 일 N회 노출 추정" 실시간 표시.

### UIUX 시안

**등록 폼 입찰 섹션 — 인라인 시뮬레이터**:
```
입찰 단가  CPM  ⚾ [━━●━━━━━━━ 10]볼

📊 예상 노출 (지난 7일 데이터 기반)
   ⚾ 5  → 일 약 5,000회   ▒▒▒▒▒
   ⚾ 10 → 일 약 25,000회 ━━━━━━━━━━━ ← 현재
   ⚾ 30 → 일 약 80,000회 ━━━━━━━━━━━━━━━━━━

💡 단가 ↑ → 매칭 우선순위 ↑ → 노출 ↑
   현재 단가는 매칭 광고 평균 대비 +20%
```

### 서버 변경
- `functions/estimateAdReach.js` (callable) — slot/menu/region 조건 + 단가 → 7일 평균 기반 예상 노출

### 클라 변경
- `AdCampaignForm` 입찰 섹션에 슬라이더 + 실시간 fetch (debounce 500ms)

### 체크리스트
- [ ] estimateAdReach CF
- [ ] 슬라이더 UI + 시뮬레이터

### 예상 분량: **2h**

---

## P1-8. 콘텐츠 안전 (Brand Safety)

> 광고주가 "이런 글에는 노출 안 함" 토픽 차단.

### UIUX 시안

**등록 폼 타겟팅 섹션 추가**:
```
🛡 노출 차단 (콘텐츠 안전)
☑ 유배·귀양지 (default 차단)
☑ 신고된 글
☐ 정치
☐ 성인
```

### DB 영향
- `ads.blockedCategories: string[]`

### 서버 변경
- `auction.js` — 글 카테고리·신고 상태가 blockedCategories에 매치되면 후보 제외

### 예상 분량: **1h**

---

## P2-9. Smart Bidding

> 머신러닝 기반 자동 입찰 — "목표 CPA / 전환 최대화 / ROAS 목표".

### 분량: **추정 4주+** — Cloud Functions만으로는 어려움. ML 인프라(Vertex AI 등) 필요.

### 백로그 — 광고비 1만볼+ 광고 등장 후 검토.

---

## P2-10. 리타게팅 + 픽셀

> 광고 클릭 후 미전환 사용자에게 다시 노출. 광고주 사이트 픽셀 설치 필요.

### 분량: **2~3주** (픽셀 SDK 배포 + DB 인프라).

---

## P2-11. 후불 정산 + 세금계산서

> 사업자/법인 대상 월말 청구 + 세금계산서 자동 발행.

### TODO.md Sprint 8 항목과 일치 — 카드 PG 도입 시 함께.

---

## P2-12. 작성자 슬롯 단가 floor

> 작성자가 자기 슬롯에 "CPM 100볼 이상만 받음" 설정. 인기 크리에이터 수익 보호.

### UIUX
- AdSlotSetting에 "최소 CPM" 입력 (default 0)

### 분량: **1.5h**.

---

## P2-13. 부정 클릭 ML

> 클릭 패턴 분석 (뷰포트·지속·이전 행동) → 의심 클릭 환불.

### 분량: **3~4주** (ML 모델 + 환불 워크플로우).

---

## 📅 추천 진행 순서

| 순서 | 항목 | 누적 | 상태 |
|------|------|------|------|
| 1 | P0-1 예산 자동 차감·정지 | 2.5h | ✅ 2026-04-26 |
| 2 | P0-2 빈도 캡 | 4h | ✅ 2026-04-26 |
| 3 | P0-4 Viewable Impressions | 5.5h | ✅ 2026-04-26 |
| 4 | P0-3 통계 대시보드 | 10h | ✅ 2026-04-26 |
| 5 | P1-5 UTM 자동 부착 | 10.5h | ✅ 2026-04-26 |
| 6 | P1-7 예상 노출 추정 | 12.5h | ✅ 2026-04-26 |
| 7 | P1-8 Brand Safety | 13.5h | ✅ 2026-04-26 |
| 8 | **P1-6 A/B 다중 소재** | 17h | 🔜 다음 |
| 9 | P2-12 작성자 floor | 18.5h | 백로그 |
| 10+ | P2-9~11, 13 | — | 성장기 대응 |

---

## 🚀 다음 액션 — P1-6 A/B 다중 소재

> 같은 캠페인 내 소재 2~3개를 라운드로빈으로 노출 → CTR 비교 → winner 자동 가중. 광고주가 헤드라인·이미지 최적화에 활용.

### 의존·우선 조건 (전제)

1. **D+7 (2026-05-03)**: P0~P1 7항목 안정성 검증 완료 후 착수 권장.
2. P0-3 통계 대시보드의 일별 데이터가 정상 누적되는지 확인 (A/B 비교 카드는 ad_stats_daily 의존).
3. ad_campaigns 컬렉션 신설 vs 기존 ads에 `campaignId?` 필드 추가 — 후자 권장 (변경 최소).

### 작업 순서 (예상 3~4h)

1. **타입·DB**:
   - `ads.campaignId?: string` 신설 (그룹 ID, 같은 campaignId = A/B)
   - 기존 ad 1개도 campaignId가 있으면 단독 캠페인으로 호환
2. **auction.js**:
   - 같은 campaignId 후보 묶고 라운드로빈 (50:50)
   - 노출 1000회+ 도달 시 CTR 차이 30%+면 winner에 가중치 (80:20)
3. **AdCampaignForm**:
   - 상단 [단일 광고] / [A/B 캠페인 ▾] 토글
   - A/B 모드: 헤드라인·이미지·CTA 슬롯 2~3개 (다른 필드 공통)
   - 저장 시 같은 campaignId 부여
4. **AdABCompareModal** (신규):
   - 좌·우 평행 카드 (소재 A vs B)
   - CTR 비교 막대 + 우승자 ⭐ 강조
   - [소재 A 종료] / [그대로 유지] 액션
5. **AdCampaignList**:
   - 같은 campaignId 광고 묶음 표시 (children 카드 펼침)

### 리스크
- 라운드로빈 균형 — 단순 50:50이 아닌 기존 effectiveBid 가중과 충돌 가능. 첫 1000회까지는 effectiveBid 무시 강제 50:50.
- 결제 형평성 — 두 소재 모두 같은 광고주 같은 캠페인이라 문제 없음.

---

## 📌 변경 이력

| 날짜 | 변경 |
|------|------|
| 2026-04-26 | 최초 작성 — P0~P2 13항목 정리 |
| 2026-04-26 | P0-1~P0-4 + P1-5/7/8 일괄 배포 완료 (커밋 2f47252) — 7/13 완료 |
| 2026-04-26 | v2.1 안정화 일괄 (커밋 adb67bc~67506c3): 광고주 검수 의무화 + 검수 알림 CF + 카운터 이중 증가 해소 + 모달 전체 광고 표시 + 폼 외부 분리 + protocol 자동 부착 + 비율 clamp 등. AdsTestScenarios.md 18 시나리오 정리 (커밋 17d02a7). |
