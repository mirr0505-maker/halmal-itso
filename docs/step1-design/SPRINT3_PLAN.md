# Sprint 3 계획서 — 어뷰징 감지 CF + 평판 캐시 파이프라인

> 작성일: 2026-04-21
> 전제: Sprint 2 완료 (LEVEL V2 옵션 B + REPUTATION V2 공식·캐시 필드·이중 링 아바타 시범 + 깐부 표기 정리 + 레벨 동기화 CF 배포 완료)
> 목적: V2 평판 캐시 실제 채우기 + 어뷰징 자동 탐지망 구축

---

## 0. Sprint 3 전체 그림

Sprint 2까지 **공식과 필드만** 준비. `reputationCached` 필드는 모두 `undefined` — 현재는 `getReputation` fallback이 매번 V2 공식을 실시간 계산. Sprint 3에서:

1. **CF가 일일 일괄 계산 → `reputationCached` 채움** → 클라이언트는 DB 캐시값만 읽음 (O(1))
2. **어뷰징 자동 플래그** → `abuseFlags.*` 채움 → V2 공식이 감점 반영
3. **Rules 선제 차단** → V2 필드 7종 클라이언트 직접 쓰기 원천 차단
4. **이상치 감시** → `audit_anomalies` 컬렉션에 기록 → 관리자 검토

---

## 1. 작업 목록 (우선순위 순)

| # | 작업 | 파일 | 일정 | 리스크 |
|---|------|------|------|------|
| 1 | Rules 확장 — V2 필드 7종 차단 | `firestore.rules` | 즉시 | 🟢 저 (차단만 추가) |
| 2 | `reputationCache` CF | `functions/reputationCache.js` | 04:45 KST | 🟡 중 (대량 write) |
| 3 | `snapshotUserDaily` CF | `functions/snapshotUserDaily.js` | 03:30 KST | 🟢 저 (read + write 분리 컬렉션) |
| 4 | `detectCircularThanksball` CF | `functions/detectCircularThanksball.js` | 04:30 KST | 🟡 중 (오탐 가능성) |
| 5 | `auditReputationAnomalies` CF | `functions/auditReputationAnomalies.js` | 05:00 KST | 🟢 저 (감시망) |
| 6 | 휴대폰 인증 Phase B 예고 UI | `ProfileEditForm` | — | 🟢 저 (텍스트만) |

---

## 2. 분할 배포 전략

Sprint 2와 달리 **신규 CF 4개** + Rules 변경 → 동시 배포 시 리스크. 3단계 분할 권장.

### 🅰️ Phase A — Rules 확장 (선제 차단)

- `firestore.rules` 만 수정·배포
- 효과: 클라이언트가 V2 필드 직접 쓰기 시도 차단 (현재는 types에 있지만 Rules 가드 없음)
- 검증: `reputationCached` 등에 클라이언트가 값 설정 시 permission-denied 확인
- **배포 후 24h 모니터링** → 정상 동작 보장 후 Phase B

### 🅱️ Phase B — 기반 CF 2개 (읽기 데이터 축적)

- `snapshotUserDaily.js` — 매일 03:30 `user_snapshots/{yyyyMMdd}_{uid}` 기록
- `reputationCache.js` — 매일 04:45 전체 유저 `getReputationScoreV2` 계산 → `reputationCached` 갱신
- 검증: 하루 지난 후 `reputationCached` 필드가 채워졌는지 확인
- **배포 후 1~2일 관찰** → V2 공식 정확성 검증

### 🅲 Phase C — 탐지망 2개 (어뷰징 차단)

- `detectCircularThanksball.js` — 04:30 지난 7일 `sentBalls` 그래프 분석 → A↔B 맞땡스볼 의심 시 `abuseFlags.circularThanksball = true`
- `auditReputationAnomalies.js` — 05:00 전일 스냅샷 대비 평판 점프(+1000 이상) 탐지 → `audit_anomalies` 기록
- 관리자 검토 UI 연계 (AdAdminPage 시스템 탭 추가 필요 — 메모 참조)

---

## 3. 데이터 모델 추가

### 3.1 `user_snapshots` 컬렉션 (신규)

```
user_snapshots/{yyyyMMdd}_{uid}
{
  uid: string,
  nickname: string,
  exp, likes, totalShares, ballReceived, ballBalance, ballSpent,
  reputationCached,
  friendList_length,
  snapshottedAt: serverTimestamp,
}
```

- 목적: 일일 평판·활동량 변화 추적 (diff 계산용)
- Rules: read 관리자만, write false (CF Admin SDK 전용)

### 3.2 `audit_anomalies` 컬렉션 (기존, Sprint 2에서 Rules 차단됨)

```
audit_anomalies/{yyyyMMdd}_{uid}_{kind}
{
  uid, kind: 'reputation_jump' | 'thanksball_loop' | 'ballance_mismatch',
  severity: 'warning' | 'critical',
  before, after, delta,
  reason, detectedAt,
}
```

- kind 확장: 기존 `ballance_mismatch`(Sprint 2) + 신규 2종

---

## 4. Rules 확장 상세 (Phase A)

**AS-IS** (현재 `firestore.rules` users write 가드에 V2 필드 차단 없음):

```
match /users/{uid} {
  allow write: if ...기존 가드;
  // reputationCached, abuseFlags 등은 체크 없음 → 클라이언트 임의 수정 가능
}
```

**TO-BE**:

```
function hasReputationV2Fields() {
  return request.resource.data.diff(resource.data).affectedKeys()
    .hasAny(['reputationCached', 'reputationTierCached', 'reputationUpdatedAt',
             'lastActiveAt', 'abuseFlags', 'grandfatheredPrestigeTier', 'grandfatheredAt']);
}

allow write: if ...기존 가드
  && !hasReputationV2Fields();  // V2 필드는 CF Admin SDK만 write
```

---

## 5. V2 공식 비용 추산

Sprint 2에 구현된 `getReputationScoreV2`:
- `base = likes×2 + totalShares×3 + ballReceived×5`
- `decay = calculateDecayFactor(lastActiveAt)` (월별 0.05씩 감쇠, 하한 0.5)
- `penalty = calculateAbusePenalty(abuseFlags)` (4종 합산)
- `return max(0, floor(base × decay - penalty))`

`reputationCache.js` 비용 (유저 10,000명 기준):
- 읽기: 10,000 docs (1회/일)
- 쓰기: 10,000 docs (1회/일, 변동 있을 때만)
- 월: 300,000 R + 300,000 W ≈ **$0.3** (조기 단계에선 무시 가능)

배치 단위: 400 docs/batch (Firestore 트랜잭션 한도).

---

## 6. 완료 판정 조건

- [ ] Phase A 배포 후 24h 동안 클라이언트 에러 로그에 `permission-denied` 없음 (정상)
- [ ] Phase B 배포 다음 날 04:45 이후 모든 유저 `reputationCached` != undefined
- [ ] Phase B 배포 후 테스트 계정의 `reputationCached`와 `getReputationScoreV2` 실시간 계산값 ±0 일치
- [ ] Phase C 배포 후 첫 탐지 발생 시 `audit_anomalies` 생성 확인
- [ ] Sprint 3 종료 시 클라이언트의 `getReputation()`이 거의 캐시만 사용 (fallback 비율 < 5%)

---

## 7. 유보된 항목 (Sprint 3에서 하지 않음)

- **Sprint 2 Task ⑥ — 20+ 컴포넌트 아바타 교체**: 사용자 보류 (시범 적용 1곳 완료). Sprint 3 중간에도 개별 요청 있을 때만 진행.
- **휴대폰 실인증 게이트**: Phase B 정식 출시 시 활성. Sprint 3에선 UI 텍스트 예고만.
- **multiAccount 탐지**: 휴대폰 인증 없이는 신뢰할 탐지 불가. Phase C(정식 출시) 이후.
- **추천코드·Lv20 로드맵**: 별도 세션에서 설계 (메모 참조).

---

## 8. 선행 확인 사항 (착수 전 결정)

1. **`snapshotUserDaily` 보관 기간**: 무제한 vs 30일 vs 1년. 기본 제안: **90일** (audit 역추적 기간)
2. **`reputationCached` 갱신 빈도**: 일일 전체 재계산 vs 트리거 기반 증분. 기본 제안: **일일 전체** (단순·정합성 우선, 1만 명까지 비용 $0.3/월)
3. **`detectCircularThanksball` 임계값**: A→B, B→A 7일 내 각 2회+ OR 총 5회+. 기본 제안은 이 값 — 튜닝 필요.
4. **오탐 시 복구 CF**: `clearAbuseFlag` 관리자 CF 필요. AdAdminPage 🔧 시스템 탭에 버튼 (사용자 선호 — 메모).

---

## 9. 참조 문서

- [REPUTATION_V2.md](./REPUTATION_V2.md) §5 캐시 전략, §8 어뷰징 모델
- [ANTI_ABUSE.md](./ANTI_ABUSE.md) §3 Circular Thanksball, §4 Multi-Account
- [ADMIN.md](./ADMIN.md) §2 audit 검토 UI
- [GAP_ANALYSIS_STEP1.md](../GAP_ANALYSIS_STEP1.md) §Sprint 3 원본 계획

---

## 📝 착수 프롬프트 예시

> "Sprint 3 Phase A 착수하자. Rules 확장만 먼저."

> "Sprint 3 Phase B — reputationCache + snapshotUserDaily CF 생성."

착수 시 본 계획서의 **우선순위 순 + 분할 배포 전략**을 따름.
