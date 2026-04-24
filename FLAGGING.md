# 🚨 FLAGGING — 신고 시스템 설계서

> Version 1.0 · 2026-04-24 · 한국어 커뮤니티 플랫폼 "글러브(GeuLove)" 신고 시스템 단일 진실 소스

## §1. 개요 + 설계 원칙

**신고 시스템**은 사용자가 커뮤니티 가이드라인 위반 컨텐츠를 제보하고, 시스템이 1차 자동 조치, 관리자가 최종 판단, 작성자가 이의를 제기할 수 있는 **4-actor 파이프라인**.

### 설계 3원칙
1. **편향 담합 방어**: 소수 의견을 다수의 담합 신고로 침묵시키지 못하게 — 카테고리별 차등 threshold + 상태 승격 전용
2. **작성자 권리 보장**: 억울한 숨김 판정을 뒤집을 수 있는 이의제기 경로 + 우선큐
3. **운영 비용 최소화**: 자동 단계로 90%+ 처리, 관리자는 예외 케이스만 개입

### 관련 시스템
- **Creator Score TRUST**: `reportsUniqueReporters` 기반 감산 (5/10/20명 threshold)
- **유배 시스템** (STOREHOUSE.md): 관리자 조치의 최종 단계 — 반복 위반자 유배 보내기
- **admin_actions**: 모든 관리자 조치 감사 로그

---

## §2. 신고 카테고리 9종 + Threshold 매트릭스

### 카테고리 정의
| 키 (reasonKey) | 한국어 레이블 | 이모지 | 설명 |
|---|---|---|---|
| `spam_flooding` | 스팸 · 도배 | 📢 | 반복·광고·무의미 반복 |
| `severe_abuse` | 심한 욕설 | 🤬 | 모욕·인신공격·비방 |
| `life_threat` | 생명 경시 | 💀 | 자살 유도·살해 협박 |
| `discrimination` | 인종·성 차별적 표현 | 🚷 | 인종·성별·소수자 혐오 |
| `unethical` | 비윤리 | ⚖️ | 주관적 판단 여지 큼 |
| `anti_state` | 반국가 | 🏛️ | 주관적 판단 여지 큼 |
| `obscene` | 음란물 | 🔞 | 노골적 성적 컨텐츠 |
| `illegal_fraud_ad` | 불법정보 · 사기 · 광고 | 💸 | 법 위반 또는 사기 |
| `other` | 기타 | 📝 | 50자 사유 입력 필수 |

### Threshold 매트릭스 (고유 신고자 수 기준)

| 카테고리 | review 진입 | preview_warning 진입 | hidden 진입 |
|---|---:|---:|---:|
| **🔴 즉시 대응 (객관적 위반)** | | | |
| `obscene` | 1명 | 2명 | 2명 |
| `life_threat` | 1명 | 2명 | 2명 |
| `illegal_fraud_ad` | 2명 | 2명 | 3명 |
| **🟡 표준** | | | |
| `spam_flooding` | 3명 | 5명 | 7명 |
| `severe_abuse` | 3명 | 5명 | 7명 |
| `discrimination` | 3명 | 5명 | 7명 |
| **🟢 엄격 (편향 공격 방어)** | | | |
| `unethical` | 5명 | 8명 | 12명 |
| `anti_state` | 5명 | 8명 | 12명 |
| `other` | 3명 | 5명 | 7명 |

**지배적 사유 (dominantReason)**: 같은 타겟에 여러 카테고리 신고가 섞일 경우, **최빈 reasonKey**의 threshold가 적용됨.

### 이 수치는 잠정치
- 배포 직후 실측 데이터 없음 → 2~4주 관찰 후 조정
- 조정 시 `src/components/ReportModal.tsx REPORT_REASON_META`와 `functions/reportSubmit.js CATEGORY_THRESHOLDS` 동시 수정 필수
- 튜닝 이력은 §11 참조

---

## §3. 상태 전환 (State Machine)

```
null ──(review threshold)──▶ review
         │
         │ (preview_warning threshold)
         ▼
   preview_warning
         │
         │ (hidden threshold)
         ▼
      hidden ◀──────── (영구; 관리자 복구로만 null 복귀)
```

### 상태 특성 (승격 전용 — Demote 불가)
| 상태 | 피드 노출 | 상세뷰 표시 | 작성자 | 일반 유저 |
|---|---|---|---|---|
| `null` | ✅ 일반 | 정상 | 정상 | 정상 |
| `review` | ✅ 유지 | ⚠️ 검토 배지 | 배지 + [⚡ 이의제기] 버튼 | 배지만 |
| `preview_warning` | ✅ 유지 | 🚫 경고 게이트 ("계속 열람" 필요) | 게이트 + [⚡ 이의제기] | 게이트 클릭 후 열람 |
| `hidden` | ❌ 완전 제외 (`isHiddenByReport=true`) | 🙈 숨김 안내 | 숨김 안내 + [⚡ 이의제기] | 접근 불가 |

### 복구 경로 (Escalation만 허용)
- 자연 복구 없음 — **관리자 `restoreHiddenPost` CF만** 상태를 null로 되돌릴 수 있음
- 복구 시 모든 관련 필드 리셋: `reportState=null`, `isHiddenByReport=false`, `reviewStartedAt/previewWarningStartedAt/hiddenByReportAt` 삭제, pending reports 일괄 rejected

---

## §4. 사용자 신고 제출 Flow

```
[1] 사용자가 상세뷰 ⋮ 메뉴 → 🚨 신고하기 클릭
    ↓
[2] handleReport() → CustomEvent("halmal:open-report-modal") 발송
    ↓
[3] App.tsx의 <ReportModalHost /> 감지 → <ReportModal /> 오픈
    ↓
[4] 사용자: 9 카테고리 중 라디오 선택 + (기타 선택 시) 50자 입력
    ↓
[5] submitReportCall() → httpsCallable("submitReport")
    ↓
[6] submitReport CF:
    ├─ 🔒 로그인 + targetType 화이트리스트 + reasonKey 화이트리스트 검증
    ├─ 🔒 자기 신고 차단 (targetUid === reporterUid)
    ├─ 🔒 멱등키 (reportId = {targetType}_{targetId}_{reporterUid})
    ├─ 🔒 일일 상한 검사 (reporter_daily_quota/{uid}_{YYYY-MM-DD}) — 10건/일
    ├─ 📝 reports/{reportId} 생성
    │  └─ { status: 'pending', reasonKey, reason, createdAt, targetUid, reporterUid }
    ├─ 📝 reporter_daily_quota 증가
    ├─ 🧮 targetId별 고유 신고자 집계 + 최빈 reasonKey 판정
    ├─ 🚨 state 승격 판정 (CATEGORY_THRESHOLDS[dominantReason] 기준)
    ├─ 📝 target 문서 update (reportCount, dominantReason, reportState, 타임스탬프)
    └─ 🔔 상태 승격 시 작성자에게 notification 발송 (type: report_state_change)
    ↓
[7] 클라이언트 응답 처리:
    ├─ alert "🚨 신고 접수됨" (또는 "이미 신고함")
    └─ localStorage `hiddenByMe` 배열에 targetId 추가 (신고자 본인 피드 블라인드)
```

### 핵심 세부
- **localStorage 블라인드**는 서버 state와 독립 — 신고자 본인 기기에서만 해당 컨텐츠 숨김
- **App.tsx 피드 필터**: `!p.isHiddenByReport && !hiddenByMe.has(p.id)`
- **에러 케이스**: 일일 상한 초과 시 `resource-exhausted` 반환 + alert로 안내

---

## §5. 관리자 조치 Flow

### 진입 경로
AdAdminPage → **🚨 신고 관리 탭** (ReportManagement.tsx)

### UI 구조
```
┌─ ⚡ 이의제기 우선큐 (상단, appealStatus=pending 전체) ───────────┐
│  │ POST/COMMUNITY_POST │ 상태 │ 신고자 수 │ 작성자 사유 │ 시간   │
│  │ ...                 │     │           │            │        │
└──────────────────────────────────────────────────────────────────┘

┌─ 상태 필터 탭 [⏳ 대기] [✅ 처리됨] [🚫 기각] ──────────────────┐
│                                                                │
│  targetId별 그룹화 카드 (심각도 색상 rose/amber/slate):       │
│  ┌─ 🚨 고유 신고자 3명 · POST · [자동 숨김됨]  ────────┐       │
│  │ targetId: topic_1234...                            │       │
│  │ targetUid: ...                                     │       │
│  │ 최근 신고: 2026-04-24 14:30                        │       │
│  │ 사유 샘플: "• [스팸] ...", "• [비방] ..."           │       │
│  │ [조치 실행] [기각 3건] [✓ 복구 (오탐)]             │       │
│  └─────────────────────────────────────────────────────┘       │
└────────────────────────────────────────────────────────────────┘
```

### 조치 4종 (resolveReport CF)

| action | 대상 문서 변경 | 신고자 알림 | 피신고자 알림 | 가역성 |
|---|---|---|---|---|
| `hide_content` | `isHiddenByReport=true`, `reportState='hidden'` | ✅ (`notifyParticipants` 시) | ❌ | 가역 (restoreHiddenPost) |
| `delete_content` | 위 + `isDeleted=true` | ✅ | ❌ | 반영구 |
| `warn_user` | 변경 없음 | ✅ | 🔔 `type: report_warning` | — |
| `none` | 변경 없음 | ✅ | ❌ | — |

- 모든 조치 시 **같은 targetId의 pending reports 일괄 resolved** 처리
- `admin_actions`에 `action: resolve_report` 감사 로그 자동 기록

### 기각 (rejectReport CF)
- 단일 또는 다건 pending reports를 rejected 처리
- 신고자의 `users.reportsSubmittedRejected` 카운터 증가 (악성 신고자 판별 지표)
- `admin_actions`에 `action: reject_report` 기록

### 복구 (restoreHiddenPost CF)
- `isHiddenByReport=false`, `reportState=null`, 타임스탬프 전체 삭제
- 해당 타겟의 pending reports 일괄 rejected
- 작성자에게 `type: appeal_accepted` (이의제기 있었으면) 또는 `report_restored` 알림
- `admin_actions`에 `action: restore_hidden_post` 기록

---

## §6. 작성자 이의제기 Flow

### 진입 경로
신고 상태(review/preview_warning/hidden) 도달한 본인 글 상세뷰 → `<ReportStateBanner>` 내부 **[⚡ 이의제기]** 버튼

### 조건
- **작성자 본인** (`targetUid === currentUserUid`)
- 현재 **신고 상태 있음** (`reportState != null`)
- **진행 중인 이의제기 없음** (`appealStatus !== 'pending'`)

### 제출 흐름
```
[1] [⚡ 이의제기] 클릭 → AppealModal 오픈
    ↓
[2] 5~500자 사유 입력 ("본 글은 ... 맥락이므로 ...")
    ↓
[3] submitContentAppeal CF:
    ├─ 🔒 작성자 본인 검증 (doc.author_id === auth.uid)
    ├─ 🔒 신고 상태 여부 (reportState != null)
    ├─ 🔒 중복 방지 (appealStatus !== 'pending')
    ├─ 📝 target 문서 update (appealStatus='pending', appealNote, appealAt)
    └─ (알림 발송 없음 — 관리자가 우선큐에서 확인)
    ↓
[4] alert "⚡ 접수되었습니다. 관리자 우선 검토 중"
```

### 관리자 우선큐
- `ReportManagement.tsx` 상단 인디고 박스
- `posts.where(appealStatus==='pending')` + `community_posts.where(appealStatus==='pending')` 실시간 구독
- 각 카드에 **작성자 이의제기 사유** + 신고 상태 + 신고자 수 + 지배적 사유 함께 표시
- 관리자는 "🚨 대기" 탭에서 해당 글 찾아 **복구** 또는 **기각** 처리

### 복구 시 자동 후속
- `restoreHiddenPost`가 `appealStatus='resolved'` 세팅 + `appeal_accepted` 알림
- 복구 후 `appealStatus='resolved'` 상태라 작성자는 **재제기 불가** (글이 이미 복구됨)

### 기각 시
- 현재 설계: `rejectReport`는 reports만 rejected로. `appealStatus`는 **그대로 `pending` 유지** (hidden 상태 유지)
- 향후 개선: `rejectAppeal` 전용 CF 또는 `resolveReport(action=hide_content)`가 `appealStatus='resolved'` 갱신하도록

---

## §7. Cloud Functions 인덱스

| CF | 종류 | 경로 | 호출자 | 역할 |
|---|---|---|---|---|
| `submitReport` | onCall | `functions/reportSubmit.js` | 누구나 (로그인) | 신고 제출 + 자동 상태 승격 |
| `reportAggregator` | onSchedule | `functions/reportAggregator.js` | 매일 05:15 KST | users.reportsUniqueReporters 갱신 |
| `resolveReport` | onCall | `functions/reportResolve.js` | 관리자 | 조치 실행 + 일괄 resolved |
| `rejectReport` | onCall | `functions/reportResolve.js` | 관리자 | 기각 + 신고자 기각 카운트 증가 |
| `restoreHiddenPost` | onCall | `functions/reportResolve.js` | 관리자 | 복구 + 이의제기 해결 + 작성자 알림 |
| `submitContentAppeal` | onCall | `functions/reportAppeal.js` | 작성자 본인 | 이의제기 등록 |

모든 onCall CF는 `asia-northeast3` 리전.

---

## §8. Firestore 스키마

### `reports/{reportId}` — 신고 원장
Document ID: `{targetType}_{targetId}_{reporterUid}` (멱등키)

```ts
{
  id: string;
  targetType: 'post' | 'comment' | 'community_post' | 'community_post_comment' | 'episode';
  targetId: string;
  targetUid: string;           // 피신고자 (타겟 작성자)
  reporterUid: string;
  reasonKey: ReasonKey;        // 9종 중 하나
  reason: string;              // "[레이블] 상세설명" 형식 (300자 이내)
  status: 'pending' | 'resolved' | 'rejected';
  createdAt: Timestamp;
  // resolved/rejected 시 채워짐
  resolvedBy?: string;         // 관리자 uid
  resolvedAt?: Timestamp;
  resolution?: 'hide_content' | 'delete_content' | 'warn_user' | 'none';
  resolutionNote?: string;
}
```

### `reporter_daily_quota/{uid}_{YYYY-MM-DD}` — 일일 신고 상한
```ts
{
  reporterUid: string;
  dateKey: string;             // YYYY-MM-DD (UTC)
  count: number;               // 당일 누적 신고 수
  lastReportAt: Timestamp;
}
```
- 10건 초과 시 submitReport가 `resource-exhausted` 에러

### Post / CommunityPost 확장 필드
```ts
{
  // 기존 필드...
  reportCount?: number;        // 고유 신고자 수 (실시간)
  reportState?: 'review' | 'preview_warning' | 'hidden' | null;
  isHiddenByReport?: boolean;  // reportState='hidden' 시 true (피드 필터용 호환)
  hiddenByReportAt?: Timestamp;
  reviewStartedAt?: Timestamp;
  previewWarningStartedAt?: Timestamp;
  dominantReason?: string;     // 최빈 reasonKey
  // 이의제기
  appealStatus?: 'none' | 'pending' | 'resolved';
  appealNote?: string;         // 작성자 사유 (5~500자)
  appealAt?: Timestamp;
}
```

### users 확장 필드 (기존)
```ts
{
  reportsUniqueReporters?: number;            // 본인이 당한 고유 신고자 수 (reportAggregator 갱신)
  reportsUpdatedAt?: Timestamp;
  reportsSubmittedRejected?: number;          // 본인이 신고한 건 중 기각된 수 (rejectReport 증가)
  reportsSubmittedRejectedUpdatedAt?: Timestamp;
}
```

### Firestore Rules 핵심
- `reports`: `read: isAdmin()`, `write: false` (CF 전용)
- `reporter_daily_quota`: `read/write: false` (CF 전용)
- users 위 신고 필드 전부 클라 update 블록리스트 (creatorScoreCache 등과 동일 패턴)
- posts/comments/community_posts의 `reportState`, `isHiddenByReport`, `reportCount`, `dominantReason`, `appealStatus` 등은 CF Admin SDK만 쓰기 가능 (클라 update 허용 키 리스트에 없음 → 자동 차단)

---

## §9. Creator Score 연동

**입력**: `users.reportsUniqueReporters` (고유 신고자 수)
**처리 시점**: 매일 05:00 KST `creatorScoreCache`의 Trust 계산 단계

### REPORT_PENALTIES (TRUST_CONFIG)
```ts
REPORT_PENALTIES: [
  { minReporters: 20, penalty: 0.15 },
  { minReporters: 10, penalty: 0.10 },
  { minReporters: 5,  penalty: 0.05 },
]
```
내림차순 첫 매칭 감산 (threshold 중복 방지). `reportsUniqueReporters`가 5 미만이면 감산 없음.

### 담합 신고 방어
- `reportAggregator`가 **고유 reporterUid Set 크기**만 집계 (담합 신고 10회라도 1명이면 1 카운트)
- 같은 IP subnet·깐부망 내 신고 디스카운트는 **중기 과제** (Sprint 8+)

### 신고 시스템 → Creator Score 반영 시점
- `submitReport` 즉시: 대상 문서의 `reportCount` 갱신 (UI용)
- 매일 05:15 `reportAggregator`: `users.reportsUniqueReporters` 갱신
- 다음날 05:00 `creatorScoreCache`: Trust에 감산 반영
- **즉시 반영 아님** — 24시간 이내 delay

---

## §10. 알림 타입

모두 `notifications/{uid}/items` 에 `addDoc` 으로 저장, `fromNickname: "운영진"`.

| type | 대상 | 트리거 | 메시지 예시 |
|---|---|---|---|
| `report_state_change` | 피신고자 (작성자) | submitReport: 상태 승격 시 | "⚠️ 글이 경고 대상으로 검토 중 (여러 신고 접수)" |
| `report_warning` | 피신고자 | resolveReport(action=warn_user) | "귀하의 컨텐츠가 가이드라인 위반으로 판단되어 경고가 발송되었습니다. 사유: ..." |
| `report_resolved` | 신고자 (모든) | resolveReport(notifyParticipants=true) | "신고하신 내용이 검토되어 처리되었습니다. 조치: [컨텐츠 숨김]" |
| `appeal_accepted` | 작성자 | restoreHiddenPost(이의제기 있었음) | "⚡ 이의제기가 수용되어 글이 복구되었습니다" |
| `report_restored` | 작성자 | restoreHiddenPost(이의제기 없었음) | "귀하의 글이 복구되었습니다 (신고 판정 오류)" |

### 알림 설계 의도
- **기각 시 신고자 알림 없음**: 담합/허위 신고자에게 "기각됨"을 알리면 반감·보복 위험
- **숨김·삭제 시 피신고자 직접 알림 없음**: 작성자는 본인 피드에서 글 안 보이는 것으로 인지 (의도된 조용한 조치). warn_user 경로만 명시적 경고
- **이의제기 승인은 명시 알림**: 작성자에게 "당신이 옳았다"는 피드백 필수

---

## §11. 보안 · 악용 방어

### 현재 구현된 방어
1. **Firestore Rules**: reports 컬렉션 클라 write 전면 차단 (CF 전용)
2. **멱등키**: `{targetType}_{targetId}_{reporterUid}` 중복 신고 불가
3. **자기 신고 차단**: targetUid === reporterUid 검증
4. **일일 상한 10건**: `reporter_daily_quota` 당일 누적 체크
5. **reasonKey 화이트리스트**: 서버 `ALLOWED_REASON_KEYS` 9종만 통과
6. **멀티 카테고리 무효화**: 같은 타겟에 여러 카테고리로 신고 와도 최빈값 하나만 threshold 적용
7. **담합 신고 디스카운트 (1차)**: `reportAggregator`가 고유 reporterUid만 집계

### 이미 수집 중이지만 미활용 (향후 적용)
- `users.reportsSubmittedRejected`: 관리자가 수동 판단해 `abuseFlags.falseReporter` 추가 가능 (현재 abuseFlags에 해당 키 미정의 — 필요 시 `src/constants.ts ABUSE_PENALTIES`에 추가)

### 중기 개선 과제 (Sprint 8+)
1. **담합 패턴 자동 감지**
   - 같은 글에 1시간 내 3+ 신고 → 담합 의심, threshold +50%
   - 같은 IP /24 subnet 신고자 하나로 카운트 (Sprint 7 악용 방어 인프라 재사용)
   - 깐부 관계인 신고자 3+ → 하나로 카운트
2. **Reporter 가중치 시스템**
   - Lv + 평판 + 가입일 기반 0.3~1.5x 가중치
   - Lv1~3 + 가입 7일 미만 = 0.3x (스팸 봇 방어)
3. **모더레이터 계층** (유저 1만명 이후)
   - Lv8+ 신뢰 유저 N명 자원봉사 모더레이터
   - 자동 숨김 판정된 글은 모더레이터 2명+ confirm 해야 최종 반영

---

## §12. 튜닝 이력 + 다음 체크포인트

| 날짜 | 변경 | 근거 |
|---|---|---|
| 2026-04-24 | 카테고리 8종 → 9종 교체 (스팸·도배 통합, 음란·생명·불법 분리) | 유저 요구 — 한국 커뮤니티 가이드라인 실제 표현 맞춤 |
| 2026-04-24 | 단일 threshold 3 → 3단계 (review/preview/hidden) + 카테고리 차등 | 편향 담합 공격 방어 |
| 2026-04-24 | 작성자 이의제기 루트 추가 | 작성자 권리 보장 + 운영 비용 감소 |

### 다음 튜닝 체크포인트 (2~4주 관찰 후)
- [ ] 카테고리별 실제 신고 분포 실측
- [ ] 자동 hidden 진입 건수 vs 복구율
- [ ] 이의제기 승인율 (승인/전체)
- [ ] 기각률 높은 신고자 수 → falseReporter 플래그 활성화 검토
- [ ] `unethical` / `anti_state` 실제 threshold 12 적정 여부 (너무 높거나 낮거나)
- [ ] "기타" 카테고리 남용 여부 (실제 사유가 기존 8종에 해당하는데 기타로 선택하는 패턴)

### 튜닝 시 동기화 체크리스트
- `src/components/ReportModal.tsx` `REPORT_REASON_META` (카테고리 라벨/이모지)
- `functions/reportSubmit.js` `ALLOWED_REASON_KEYS` (서버 화이트리스트)
- `functions/reportSubmit.js` `CATEGORY_THRESHOLDS` (threshold 매트릭스)
- `src/components/ReportStateBanner.tsx` `REASON_LABEL` (배너 표시)
- `FLAGGING.md` §2, §12 (본 문서)

---

## §13. 용어 사전

| 용어 | 정의 |
|---|---|
| **신고** | 유저가 가이드라인 위반 컨텐츠를 시스템에 제보 |
| **reasonKey** | 신고 카테고리 영문 키 (`spam_flooding` 등 9종) |
| **고유 신고자** | 같은 타겟에 대한 서로 다른 `reporterUid` 수. 담합 방어 1차 장치 |
| **dominantReason** | 같은 타겟에 들어온 신고들 중 최빈 reasonKey |
| **reportState** | null → review → preview_warning → hidden 4단계 상태값 |
| **이의제기** | 작성자 본인이 신고 판정에 반박하고 복구를 요청하는 행위 |
| **우선큐** | `appealStatus='pending'` 항목만 모아 관리자가 최우선 검토하는 UI 섹션 |
| **복구** | 관리자가 `restoreHiddenPost` CF로 신고 상태 전체를 null로 리셋 |

---

## §14. 향후 Phase 로드맵

### Phase C (관찰 후)
- `src/constants.ts ABUSE_PENALTIES`에 `falseReporter` 추가 + `adminToggleAbuseFlag` UI에 체크박스
- 기각률 80%+ 유저 자동 `falseReporter=true` 설정 (스케줄 CF)

### Phase D (담합 감지)
- `functions/flaggingCollusionDetector.js` (가칭)
- 같은 글에 1시간 내 3+ 신고 → `collusion_flag` 세팅, threshold 1.5x
- IP subnet hashing (`functions/utils/ipHash.js` 재사용)

### Phase E (Community Moderator)
- 새 role: `moderator` (users.role 필드 또는 Custom Claims)
- Lv8+ + 평판 매우 우호 + 유배 이력 0 + 관리자 지명
- 자동 숨김 판정된 글에 대해 모더레이터 2명+ confirm 시 최종 반영
- 모더레이터 자체 어뷰징 감지 (판정 일관성 체크) → 수퍼어드민 에스컬레이션

---

## §15. 관련 파일 인덱스

### Frontend
- [src/components/ReportModal.tsx](src/components/ReportModal.tsx) — 신고 제출 모달 (9 카테고리 + 기타 50자)
- [src/components/ReportModalHost.tsx](src/components/ReportModalHost.tsx) — 전역 모달 호스트 (App.tsx 루트)
- [src/components/ReportStateBanner.tsx](src/components/ReportStateBanner.tsx) — 상세뷰 경고 배너 + 이의제기 모달
- [src/components/admin/ReportManagement.tsx](src/components/admin/ReportManagement.tsx) — 관리자 UI (⚡ 우선큐 + 그룹화 + 조치)
- [src/utils/reportHandler.ts](src/utils/reportHandler.ts) — handleReport() 이벤트 디스패치 + localStorage 블라인드

### Backend
- [functions/reportSubmit.js](functions/reportSubmit.js) — submitReport (카테고리 차등 + 3단계 threshold)
- [functions/reportAggregator.js](functions/reportAggregator.js) — 매일 05:15 KST 고유 신고자 집계
- [functions/reportResolve.js](functions/reportResolve.js) — resolveReport / rejectReport / restoreHiddenPost
- [functions/reportAppeal.js](functions/reportAppeal.js) — submitContentAppeal

### 설계 참조
- [CreatorScore.md](CreatorScore.md) — TRUST 감산 연동
- [STOREHOUSE.md](STOREHOUSE.md) — 유배 시스템 (관리자 조치의 최종 단계)
- [CLAUDE.md](CLAUDE.md) — 전체 프로젝트 지침
- [changelog.md](changelog.md) — 배포 이력 (신고 시스템 관련 엔트리)

---

_본 문서는 신고 시스템 단일 진실 소스. threshold·카테고리·flow 변경 시 반드시 이 문서 동기화 필수._
