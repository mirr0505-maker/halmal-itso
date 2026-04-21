# 🛠️ 글러브(GeuLove) 관리자 시스템 통합 설계서 (ADMIN.md)

> **작성일**: 2026-04-20
> **버전**: v1.0 (Step 1 종합기획 — **최종 문서**)
> **상태**: 신규 시스템 설계, 구현 대기
> **의존**: **9개 Step 1 문서 전부**
> - `GLOVE_SYSTEM_REDESIGN_v2.md` · `PRICING.md` · `TUNING_SCHEDULE.md`
> - `ANTI_ABUSE.md` §10 · `KANBU_V2.md` · `LEVEL_V2.md`
> - `REPUTATION_V2.md` · `CREATOR_SCORE.md` §10.5 · `MAPAE_AND_TITLES_V1.md` §12.4.1
> **후속 의존**: 없음 (Step 1의 마지막 문서)

---

## 📋 목차

- §0. 개요 & 원칙
- §1. 현재 상태 진단
- §2. 관리자 권한 체계
- §3. 감사 로그 시스템
- §4. 유배·제재 관리
- §5. 신고 관리 (수동 제재 중심)
- §6. 수동 조정 도구
- §7. 콘텐츠 관리
- §8. 닉네임 수동 변경
- §9. 회원가입/인증 운영
- §10. 경제 시스템 운영
  - §10.1 광고 경매 (ADSMARKET)
  - §10.2 수익 정산/출금 승인
  - §10.3 강변시장·잉크병·깐부방 관리
  - §10.4 라이브·주주방·정보봇 관리
  - §10.5 플랫폼 수익 조회
- §11. 통합 대시보드
- §12. 경계값 튜닝 도구
- §13. Phase별 로드맵
- §14. 테스트 시나리오
- §15. 결정 요약 & Step 1 완료 선언

---

## 0. 개요 & 원칙

### 0.1 문서 범위

**ADMIN은 글러브 관리자 시스템의 단일 진실 소스**다. Step 1 9개 문서에서 누적된 관리자 요구사항을 **통합**하고, 신고/광고 경매/콘텐츠 관리 등 이전 문서에서 "ADMIN에서 통합 설계"라고 미뤘던 범위를 모두 포괄한다.

**포괄 범위**:
- **관리자 권한 체계**: Firebase Custom Claims 기반 (현재 닉네임 화이트리스트에서 전환)
- **감사 로그**: 모든 관리자 행동 기록 + 조회 UI
- **유배·제재**: 1/2/3차 발동, 해제, 사약 집행, 속죄금 관리
- **신고 관리**: Phase A/B 수동 제재 중심, Phase C 신고 시스템 개발 대비
- **수동 조정**: EXP / 평판 / Creator Score / 마패 / 칭호 / abuseFlags
- **콘텐츠 관리**: 글·댓글·라이브 삭제/블라인드/복원
- **닉네임**: 수동 변경 (신변 위협 등), 예약 닉네임 관리
- **회원가입**: 옵션 A (소셜만, T1/T2/T3 Tier) 운영 상세
- **경제 시스템**: 광고 경매, 수익 출금 승인, 전 메뉴별 관리
- **대시보드**: 분포/통계/검토 큐/수익 현황
- **튜닝 도구**: 경계값 조정 시뮬레이션 + 적용

**다음 범위는 다른 문서가 담당**:

| 범위 | 담당 문서 |
|------|-----------|
| 공식 정의 (평판/Score) | `REPUTATION_V2` / `CREATOR_SCORE` |
| 수수료율 | `PRICING.md` |
| 어뷰징 탐지 로직 | `ANTI_ABUSE.md` |
| 경계값 조정 주기 | `TUNING_SCHEDULE.md` §5 |
| 칭호 조건 로직 | `MAPAE_AND_TITLES_V1.md` §6 |
| 유저 수익 출금 플로우 (유저 측) | 별도 문서 (Step 2 이후) |
| 신고 시스템 구현 상세 | Phase C 별도 스프린트 |

### 0.2 3대 원칙

**① 행동 가능성 우선 (Actionable)**

모든 대시보드 화면은 "보기"에 그치지 않고 **즉시 조치** 버튼 제공.

```
❌ 나쁜 예: "이상치 100건 감지됨" (보기만)
✅ 좋은 예: "이상치 100건 감지됨 [일괄 무시] [일괄 평판 감점] [개별 검토]"
```

**② 감사 가능성 보장 (Auditable)**

**모든** 관리자 행동은 `admin_actions` 컬렉션에 기록. 되돌릴 수 있는 행동은 되돌리기 경로 제공.

```
관리자 행동 → 감사 로그 → 대시보드 조회 → 필요 시 롤백
```

**③ 최소 권한 원칙 (Least Privilege)**

관리자도 역할별 권한 분리 (§2에서 상세):
- **Owner**: 모든 권한 (1~2명)
- **Admin**: 일반 관리 (유배, 수동 조정, 닉네임 변경)
- **Moderator**: 콘텐츠 관리만 (삭제, 경고, 신고 처리)
- **Viewer**: 읽기 전용 (대시보드 조회)

### 0.3 관리자 시스템의 5대 기능

**① 어뷰저 대응**
- 이상치 검토 큐 처리
- 유배 발동 / 해제 / 사약
- 어뷰징 플래그 수동 설정·해제
- 악성 콘텐츠 삭제/블라인드

**② 특수 케이스 해결**
- 신변 위협 닉네임 변경
- 공식 파트너 Creator Score 수동 부여
- 유배 오판정 복구

**③ 경제 시스템 운영**
- 광고 경매 승인/거부
- 수익 출금 승인
- 수수료 조정 (PRICING 연계)
- 플랫폼 수익 조회

**④ 플랫폼 건전성 관찰**
- 마패/평판/Score 분포 대시보드
- 어뷰저 비율 추이
- 수익 정산 현황
- 사용자 피드백 대응

**⑤ 경계값·정책 튜닝**
- TUNING_SCHEDULE 기반 조정
- 시뮬레이션 도구
- grandfathered 관리

### 0.4 관리 대상 전체 지도

글러브가 관리해야 할 모든 영역. ADMIN은 이 전체를 커버해야 한다.

```
┌─ Layer 1: 유저 관리 ────────────────────────────────┐
│  · 계정 (Tier T1/T2/T3, 회원가입, 인증)              │
│  · 유배·제재 (1~3차, 사약)                           │
│  · 닉네임 (수동 변경, 예약)                          │
│  · 어뷰징 플래그 (수동 설정·해제)                    │
│  · 수동 조정 (EXP/평판/Score/마패/칭호)              │
└─────────────────────────────────────────────────────┘
┌─ Layer 2: 콘텐츠 관리 ─────────────────────────────┐
│  · 일반 글 (8 카테고리)                              │
│  · 헨젤의 빵부스러기 / 거대나무                      │
│  · 잉크병 연재                                       │
│  · 강변시장 가판대·단골장부                          │
│  · 댓글 / 공유                                        │
│  · 라이브 방송                                        │
│  · 삭제/블라인드/복원                                 │
└─────────────────────────────────────────────────────┘
┌─ Layer 3: 커뮤니티 관리 ──────────────────────────┐
│  · 장갑 (커뮤니티)                                    │
│  · 주주방 (주식 전용, tier 인증)                     │
│  · 깐부방 (사적 공간, 5탭 + 라이브)                  │
│  · 정보봇 (구독)                                      │
└─────────────────────────────────────────────────────┘
┌─ Layer 4: 경제 운영 ──────────────────────────────┐
│  · 광고 경매 (ADSMARKET)                             │
│  · 수익 정산/출금 승인                               │
│  · 수수료 조정 (PRICING 연계)                        │
│  · 땡스볼 감사 (ballSnapshot/Audit)                  │
│  · 잉크병/강변시장/깐부방 수수료                     │
│  · 플랫폼 수익 조회                                   │
└─────────────────────────────────────────────────────┘
┌─ Layer 5: 플랫폼 관찰 & 튜닝 ─────────────────────┐
│  · 분포 대시보드 (Lv/평판/Score/마패)                │
│  · 어뷰저 통계                                        │
│  · TUNING_SCHEDULE 기반 조정                         │
│  · 시뮬레이션 도구                                    │
│  · 감사 로그 뷰                                       │
└─────────────────────────────────────────────────────┘
```

### 0.5 개발 수칙 (CLAUDE.md 준수)

- **최소 변경 원칙**: 요청받지 않은 파일 건드리지 않기
- **Rules 우선**: `admin_actions`, `sanction_log` 등 읽기/쓰기 엄격 제한
- **CF 경유**: 모든 관리자 조치는 CF를 통해 (클라이언트 직접 조작 금지)
- **트랜잭션 원칙**: 관련 필드 변경은 원자적 트랜잭션
- **롤백 경로**: 되돌릴 수 있는 조치는 반드시 롤백 CF 제공
- **이중 확인**: 파괴적 조치(사약, 칭호 박탈, 수익 취소)는 확인 모달 필수

---

## 1. 현재 상태 진단

### 1.1 관리자 권한 (현재)

**출처**: 코드베이스 실측 + 메모리

**현재 방식**: 닉네임 화이트리스트

```typescript
// src/constants/admin.ts (현재)
export const PLATFORM_ADMIN_NICKNAMES = ["흑무영"];

// 사용 예시 (여러 곳 산재)
const isAdmin = (user: UserData) =>
  PLATFORM_ADMIN_NICKNAMES.includes(user.nickname);
```

**🔴 문제점**:

1. **보안 취약**:
   - 닉네임은 유저가 변경 가능 (v2 이전, 무제한 쿨다운 30일)
   - 신변 위협으로 관리자 본인이 닉네임 변경 시 권한 상실
   - 화이트리스트 복제로 어뷰징 가능성 (Rules에 노출)

2. **확장성 부재**:
   - 역할 분리 불가 (Owner/Admin/Moderator)
   - 관리자 추가·제거 시 코드 수정 + 배포 필요
   - 권한 범위 조정 어려움

3. **감사성 부족**:
   - "누가 관리자인가"가 코드 주석 수준
   - 권한 부여/회수 이력 없음

### 1.2 유배 시스템 (현재)

**출처**: `ANTI_ABUSE.md §1.1.3`, `PRICING.md §2`

**구현 상태**: 🟢 **거의 완성**

- `sendToExile` CF 존재
- `executeSayak` CF 존재
- `checkAutoSayak` CF 존재 (90일 미납 자동 사약)
- `sanctionStatus` 필드: `clean / exiled_lv1 / exiled_lv2 / exiled_lv3 / banned`
- 속죄금 처리 (소각 + `sanction_log` 기록)

**공백**:
- 관리자 **수동** 유배 UI 없음 (CF는 있으나 호출 경로는 코드 수정 필요)
- 해제 UI 없음 (속죄금 납부 자동 해제는 있음)
- 유배 이력 대시보드 없음

### 1.3 수동 조정 도구 (현재)

**현재 상태**: ❌ **전혀 없음**

관리자가 특정 유저의 EXP/평판/칭호 등을 수정하려면:
- Firebase Console → Firestore → Document 직접 수정
- **감사 로그 없음**
- **롤백 경로 없음**
- **실수 가능성 높음**

**REPUTATION_V2/CREATOR_SCORE/MAPAE가 요구하는 도구**:
- `adminAdjustCreatorScore` (freeze/boost/demote)
- `adminAwardTitle`, `adminRevokeTitle`
- `adminSetAbuseFlag`
- `adminAdjustReputation` (오판정 복구)

→ **ADMIN.md §6에서 통합 설계**.

### 1.4 신고 시스템 (현재)

**구현 상태**: ❌ **미개발** (`CREATOR_SCORE.md §5.4.0` 참조)

- `reports` 컬렉션 없음
- 신고 UI 없음
- 관리자 검토 큐 없음

**현재 대체**: 관리자가 **외부 채널**(DM/이메일)로 제보받아 **수동 제재**

**ADMIN.md §5에서 상세**:
- Phase A/B 수동 운영 방법
- 외부 제보 관리 프로세스
- 관리자 조치 도구 (유배, 플래그, 콘텐츠 삭제)

### 1.5 광고 경매 관리 (현재)

**출처**: `PRICING.md §6`, `LEVEL_V2 §1.4`

**구현 상태**: 🟡 **80%**

- 경매 로직 구현됨 (`adAuction` CF)
- 수익 쉐어 테이블 존재 (Lv5-6 30% / Lv7-8 50% / Lv9-10 70%)
- **애드센스·PG 외부 대기**

**관리자 공백**:
- 광고 승인/거부 UI 없음
- 광고주 관리 없음
- 경매 내역 조회 없음
- 부정클릭 대응 UI 없음 (`detectFraud` CF는 있음)

### 1.6 콘텐츠 관리 (현재)

**구현 상태**: ❌ **부분적**

- 글 삭제 CF 있음 (본인만)
- 관리자 강제 삭제 UI 없음
- 블라인드 (soft-delete) 기능 없음
- 신고 기반 자동 조치 없음

### 1.7 대시보드 (현재)

**구현 상태**: ❌ **전혀 없음**

- 분포 대시보드 없음
- 어뷰저 통계 없음
- 수익 현황 조회 없음
- 모든 통계는 Firebase Console 직접 쿼리 필요

### 1.8 진단 결론

| 영역 | 상태 | 우선순위 |
|------|:----:|:--------:|
| 권한 체계 | 🔴 취약 | 🔥 높음 (Phase B 시작 조건) |
| 감사 로그 | ❌ 부재 | 🔥 높음 (보안 필수) |
| 유배 관리 | 🟡 CF는 있음 | 🟠 중간 |
| 수동 조정 | ❌ 부재 | 🔥 높음 (REPUTATION_V2/CREATOR_SCORE/MAPAE 의존) |
| 신고 관리 | ❌ 미개발 | 🟠 중간 (Phase C) |
| 광고 경매 | 🟡 80% | 🟡 낮음 (외부 대기 우선) |
| 콘텐츠 관리 | 🟡 부분 | 🟠 중간 |
| 대시보드 | ❌ 부재 | 🔥 높음 (운영 필수) |

---

## 2. 관리자 권한 체계

### 2.1 🔑 결정 D1: 권한 전환 전략

**배경**: 현재 닉네임 화이트리스트 → Firebase Custom Claims 전환 필요.
**질문**: 언제, 어떻게 전환할 것인가?

#### 2.1.1 대안 D1-α: Phase A 즉시 전환

**방식**: 지금 바로 Custom Claims로 이전, 닉네임 화이트리스트 폐기.

**장점**:
- 보안 즉시 강화
- Phase B 진입 전 안정화
- 모든 새 기능을 Custom Claims 기반으로 설계 가능

**단점**:
- 현재 유일 관리자(흑무영)의 Custom Claims 설정 필요
- Rules 재작성 필요
- 코드 산재된 `PLATFORM_ADMIN_NICKNAMES` 참조 전수 교체
- 잘못 설정 시 **관리자 스스로를 락아웃** 리스크

#### 2.1.2 대안 D1-β: 점진적 전환 (**추천**)

**방식**: 이중 체크 기간을 둔 단계적 전환.

**단계**:
1. **Phase A-1**: Custom Claims 기능 추가 (`isAdmin` 검증은 "Claims OR 닉네임")
2. **Phase A-2**: 기존 관리자에 Custom Claims 부여 (2~3일 검증)
3. **Phase A-3**: 닉네임 화이트리스트 제거 (Claims만 체크)
4. **Phase B**: 역할 분리 활성화 (Admin/Moderator/Viewer)

**장점**:
- 전환 중 락아웃 리스크 최소화
- 각 단계에서 롤백 가능
- Custom Claims 설정 오류 감지 여유

**단점**:
- 전환 기간 동안 코드 복잡도 증가
- 수 주~수 개월 소요

#### 2.1.3 대안 D1-γ: Phase C까지 화이트리스트 유지

**방식**: 정식 출시(Phase C)까지 현재 방식 유지, 그때 전환.

**장점**:
- 현재 가장 단순
- 베타 기간 개발 리소스 절약

**단점**:
- Phase B 기간 내내 보안 취약점 방치
- 역할 분리 불가 → 외부 Moderator 고용 불가
- 관리자 수동 조정 도구 개발 어려움 (권한 검증 기반 부재)

#### 2.1.4 비교 매트릭스

| 기준 | α 즉시 | **β 점진 (추천)** | γ Phase C |
|------|:------:|:-----------------:|:---------:|
| 보안 | ✅ | ⭐⭐ | ❌ |
| 락아웃 리스크 | 🔴 | ✅ | — |
| Phase B 진입 | 가능 | 가능 | 어려움 |
| 구현 복잡도 | ⭐⭐ | ⭐⭐⭐ | ⭐ |
| 롤백 | ❌ | ✅ | N/A |
| 역할 분리 | Phase B | Phase B | Phase C |

#### 2.1.5 추천 — 대안 D1-β (점진적 전환)

**근거**:
1. 현재 유일 관리자 락아웃 리스크 회피
2. 각 단계 검증 가능
3. Phase B 진입 전 완료 가능
4. `ANTI_ABUSE.md §6.2.2` 권한 체계 Phase A 실행 원칙과 정합

**실행 로드맵**:

| 단계 | 기간 | 내용 |
|:----:|:----:|------|
| A-1 | D-0 ~ D-7 | `grantAdminClaim` CF 개발, `isAdmin` 헬퍼를 "Claims OR 화이트리스트"로 변경 |
| A-2 | D-7 ~ D-10 | 흑무영 Custom Claims 부여, 실제 호출 경로로 검증 |
| A-3 | D-10 ~ D-14 | 화이트리스트 제거, Claims만 체크 |
| B | D-14+ | 역할 분리 활성화 (§2.2) |

### 2.2 🔑 결정 D2: 역할 분리 체계

#### 2.2.1 대안 D2-α: 단일 역할 (Admin만)

**방식**: `isAdmin: true` 플래그만 존재. 모든 관리자는 전권 소유.

**장점**:
- 가장 단순
- 권한 혼란 없음

**단점**:
- 콘텐츠 관리자(Moderator) 고용 불가
- 외부 위탁 불가
- 실수 파급력 최대 (Viewer도 사약 실행 가능)

#### 2.2.2 대안 D2-β: 2단계 (Owner/Admin)

**방식**: 소유자와 일반 관리자 분리.

**Owner**: 플랫폼 소유자 (흑무영). 모든 권한 + 다른 관리자 관리.
**Admin**: 일반 관리자. 일상 운영 가능, 다른 관리자 관리 불가.

**장점**:
- 최소한의 역할 분리
- 권한 이양 가능

**단점**:
- Moderator(콘텐츠만) 역할 부재
- 외부 위탁 시 여전히 과도한 권한

#### 2.2.3 대안 D2-γ: 4단계 (Owner/Admin/Moderator/Viewer, **추천**)

**방식**: 업계 표준 RBAC 모델.

**Owner** (1~2명):
- 모든 권한
- 다른 관리자 역할 변경
- 사약 실행, 수수료 조정

**Admin** (5~10명 예상):
- 유배 1~3차 발동/해제
- 수동 조정 (EXP/평판/Score/마패/칭호)
- 닉네임 수동 변경
- 콘텐츠 삭제/블라인드

**Moderator** (10~30명 예상):
- 콘텐츠 삭제/블라인드 (경미)
- 경고 발급
- 신고 검토 (Phase C)
- 유배 **제안** (Admin 승인 대기)

**Viewer** (Finance/Marketing 등):
- 모든 대시보드 조회
- 감사 로그 조회
- 통계 리포트 다운로드
- **쓰기 작업 불가**

**장점**:
- 외부 Moderator 안전하게 고용 가능
- 파이낸스/마케팅 팀에 통계 권한만 부여
- 실수 파급력 제한
- 업계 표준 (Discord, Reddit 등과 유사)

**단점**:
- 구현 복잡도 ↑
- 각 엔드포인트마다 권한 체크 로직 필요
- Custom Claims 5가지 키 관리 (`role`)

#### 2.2.4 비교 매트릭스

| 기준 | α 단일 | β 2단계 | **γ 4단계 (추천)** |
|------|:------:|:-------:|:------------------:|
| 구현 복잡도 | ⭐ | ⭐⭐ | ⭐⭐⭐⭐ |
| 외부 위탁 | ❌ | ⚠️ | ✅ |
| 실수 방지 | ⭐ | ⭐⭐ | ⭐⭐⭐ |
| 스케일 | 소규모만 | 중소 | 대규모 가능 |
| 통계 팀 분리 | ❌ | ❌ | ✅ |
| 업계 표준 | ❌ | 부분 | ✅ |

#### 2.2.5 추천 — 대안 D2-γ (4단계)

**근거**:
1. Phase C 대규모 운영 대비 (플랫폼 성장 시 즉시 적용 가능)
2. 외부 Moderator 고용 경로 확보
3. 통계 팀(Viewer) 분리로 민감 기능 보호
4. 업계 표준 RBAC

**Phase 별 도입**:
- **Phase A**: Owner/Admin만 활성 (소규모 운영)
- **Phase B**: Moderator 추가 (콘텐츠 관리 분리)
- **Phase C**: Viewer 추가 (통계 팀 분리)

### 2.3 Custom Claims 구조

```typescript
// Firebase Auth Custom Claims (ID Token에 포함)

interface AdminClaims {
  role: 'owner' | 'admin' | 'moderator' | 'viewer';
  grantedAt: number;      // Unix epoch
  grantedBy: string;      // 부여한 관리자 UID
  scopes?: string[];      // 세부 권한 (선택)
}
```

**Claims 설정 CF**:

```javascript
// functions/adminGrant.js

exports.grantAdminRole = onCall({ region: 'asia-northeast3' }, async (req) => {
  // Owner만 실행 가능
  if (req.auth?.token?.role !== 'owner') {
    throw new HttpsError('permission-denied', 'Owner only');
  }

  const { targetUid, role, reason } = req.data;

  if (!['admin', 'moderator', 'viewer'].includes(role)) {
    throw new HttpsError('invalid-argument', 'Invalid role');
  }

  await admin.auth().setCustomUserClaims(targetUid, {
    role,
    grantedAt: Date.now(),
    grantedBy: req.auth.uid,
  });

  // 감사 로그
  await db.collection('admin_actions').add({
    adminUid: req.auth.uid,
    targetUid,
    action: 'grant_admin_role',
    details: { role, reason },
    createdAt: FieldValue.serverTimestamp(),
  });

  return { success: true };
});
```

### 2.4 권한 매트릭스

**전체 관리자 기능에 대한 역할별 권한**:

| 기능 | Owner | Admin | Moderator | Viewer |
|------|:-----:|:-----:|:---------:|:------:|
| 관리자 역할 부여/회수 | ✅ | ❌ | ❌ | ❌ |
| 수수료 조정 (PRICING) | ✅ | ❌ | ❌ | ❌ |
| 사약 집행 | ✅ | ⚠️ 제안 | ❌ | ❌ |
| 경계값 조정 (TUNING) | ✅ | ⚠️ 제안 | ❌ | ❌ |
| 유배 1~3차 발동 | ✅ | ✅ | ⚠️ 제안 | ❌ |
| 유배 해제 | ✅ | ✅ | ❌ | ❌ |
| 닉네임 수동 변경 | ✅ | ✅ | ❌ | ❌ |
| EXP/평판/Score 수동 조정 | ✅ | ✅ | ❌ | ❌ |
| 마패/칭호 수동 부여/박탈 | ✅ | ✅ | ❌ | ❌ |
| abuseFlags 수동 설정 | ✅ | ✅ | ❌ | ❌ |
| 콘텐츠 삭제 (강제) | ✅ | ✅ | ✅ | ❌ |
| 콘텐츠 블라인드 | ✅ | ✅ | ✅ | ❌ |
| 경고 발급 | ✅ | ✅ | ✅ | ❌ |
| 신고 검토 (Phase C) | ✅ | ✅ | ✅ | ❌ |
| 광고 승인/거부 | ✅ | ✅ | ❌ | ❌ |
| 수익 출금 승인 | ✅ | ✅ | ❌ | ❌ |
| 대시보드 조회 | ✅ | ✅ | ✅ | ✅ |
| 감사 로그 조회 | ✅ | ✅ | ⚠️ 본인 것만 | ✅ |
| 통계 리포트 다운로드 | ✅ | ✅ | ✅ | ✅ |

**⚠️ 제안**: 승인 대기 상태로 큐에 추가. Owner/Admin 승인 필요.

### 2.5 isAdmin 헬퍼

```typescript
// src/utils/admin.ts

export const hasRole = (
  claims: AdminClaims | undefined,
  requiredRole: 'owner' | 'admin' | 'moderator' | 'viewer'
): boolean => {
  if (!claims) return false;

  const ROLE_HIERARCHY = {
    owner: 4,
    admin: 3,
    moderator: 2,
    viewer: 1,
  };

  const userLevel = ROLE_HIERARCHY[claims.role] ?? 0;
  const requiredLevel = ROLE_HIERARCHY[requiredRole] ?? 0;

  return userLevel >= requiredLevel;
};

// 편의 헬퍼
export const isOwner = (claims?: AdminClaims) => hasRole(claims, 'owner');
export const isAdmin = (claims?: AdminClaims) => hasRole(claims, 'admin');
export const isModerator = (claims?: AdminClaims) => hasRole(claims, 'moderator');
export const isViewer = (claims?: AdminClaims) => hasRole(claims, 'viewer');
```

**CF 사용 예시**:

```javascript
// 모든 관리자 CF에서 권한 체크
exports.someAdminAction = onCall({...}, async (req) => {
  const claims = req.auth?.token;

  if (!isAdmin(claims)) {
    throw new HttpsError('permission-denied', 'Admin role required');
  }

  // 로직...
});
```

**Rules 사용 예시**:

```javascript
// firestore.rules
function hasAdminRole() {
  return request.auth != null
    && request.auth.token.role in ['owner', 'admin'];
}

function hasOwnerRole() {
  return request.auth != null
    && request.auth.token.role == 'owner';
}

match /admin_actions/{docId} {
  allow read: if hasAdminRole();
  allow write: if false;  // CF only
}

match /platform_revenue/{docId} {
  allow read: if hasAdminRole();
  allow write: if hasOwnerRole();  // Owner만 수수료 조정
}
```

### 2.6 데이터 모델

```typescript
// src/types.ts

// 관리자 역할 이력 (Firestore 컬렉션)
interface AdminRoleHistory {
  id: string;
  targetUid: string;
  role: 'owner' | 'admin' | 'moderator' | 'viewer' | 'revoked';
  previousRole?: string;
  grantedAt: FirestoreTimestamp;
  grantedBy: string;
  reason: string;
  expiresAt?: FirestoreTimestamp;  // 임시 관리자 (선택)
}

// 승인 대기 큐
interface PendingAction {
  id: string;
  proposerUid: string;    // Moderator가 유배 제안한 경우
  proposerRole: string;
  action: 'exile' | 'sayak' | 'tune_threshold' | ...;
  targetUid?: string;
  details: Record<string, unknown>;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  reviewedBy?: string;
  reviewedAt?: FirestoreTimestamp;
  createdAt: FirestoreTimestamp;
  expiresAt: FirestoreTimestamp;  // 72시간 후 자동 만료
}
```

### 2.7 🛡️ 통합 Firestore Rules 선언서

> **목적**: REPUTATION_V2 §7.3, CREATOR_SCORE §7.4, MAPAE §8.4에서 각자 선언된 Rules를 **하나의 실제 `firestore.rules` 파일**로 통합하는 기준. Step 2 구현 시 본 섹션을 단일 진실 소스로 사용.
>
> **배경**: 3개 문서가 각자 "자기 수정 허용 필드"를 선언했지만 필드 목록이 달라 병합 시 모순 발생 가능. 본 섹션에서 최종 통합안 확정.

#### 2.7.1 유저 자기 수정 가능 필드 (통합)

```javascript
// firestore.rules
match /users/{uid} {
  allow read: if true;

  allow update: if request.auth != null
    && request.auth.uid == uid
    && request.resource.data.diff(resource.data).affectedKeys()
        .hasOnly([
          // 기본 프로필 (GLOVE_v2)
          'nickname',           // ⚠️ 단, nicknameChange CF 경유 권장 (ANTI_ABUSE §8)
          'profileImage',
          'bio',

          // 관계 (KANBU_V2)
          'friendList',

          // 대표 칭호 (MAPAE §5)
          'primaryTitles',      // 최대 3개 제약 추가

          // 언어/지역 (GLOVE 글로벌 대응)
          'preferredLanguage',
          'timezone',
          'autoTranslate',

          // 프로모션 설정 (기존)
          'promoEnabled',
          'promoUpdatedAt',
        ])
    // primaryTitles 제약 (MAPAE D2-β)
    && (
      !('primaryTitles' in request.resource.data.diff(resource.data).affectedKeys())
      || (
        request.resource.data.primaryTitles is list
        && request.resource.data.primaryTitles.size() <= 3
      )
    );
}
```

#### 2.7.2 CF 전용 필드 (유저 직접 쓰기 금지)

아래 필드들은 **위 hasOnly 목록에 없으므로 자동 차단**. Admin SDK(Cloud Functions) 경유만 허용.

| 필드 | 출처 문서 | 금지 이유 |
|------|-----------|-----------|
| `exp`, `level` | LEVEL_V2 | EXP 어뷰징 방지 (F12 임의 수정 차단) |
| `likes`, `totalShares`, `ballReceived` | REPUTATION_V2 | 평판 펌핑 방지 |
| `ballBalance` | GLOVE_v2 | 땡스볼 어뷰징 방지 |
| `reputationCached`, `reputationTierCached` | REPUTATION_V2 | 평판 캐시 무결성 |
| `creatorScoreCached`, `creatorScoreTier`, `creatorScoreFrozen`, `creatorScoreManualBoost` | CREATOR_SCORE | Creator Score 무결성 |
| `abuseFlags` | REPUTATION_V2 §3.2.3 | 관리자/CF만 수정 |
| `sanctionStatus`, `exileHistory` | ANTI_ABUSE, ADMIN | 유배 조작 방지 |
| `titles` (배열) | MAPAE | 칭호 무결성 (부여는 CF만) |
| `grandfatheredPrestigeTier`, `grandfatheredMapae` | TUNING_SCHEDULE §4 | 경계값 조정 보호 필드 |
| `validCommentCount`, `ballSentTotal`, `consecutivePostDays` | MAPAE §8.1 | 칭호 조건 카운터 |
| `recent30d_posts`, `recent30d_comments`, `recent30d_likesSent` | CREATOR_SCORE §7.1 | 활동성 집계 |
| `reportsUniqueReporters` | CREATOR_SCORE (Phase C) | 신고 집계 |
| `nickname*` (변경 관련) | ANTI_ABUSE §8 | 닉네임 변경 CF 경유 강제 |
| `tier`, `verifications` | ADMIN §9 | 인증 단계 (T1/T2/T3) |

> **중요**: `nickname` 필드 자체는 §2.7.1의 hasOnly에 포함되어 있지만, 실무에서는 **`changeNickname` CF 경유**를 권장 (`ANTI_ABUSE.md §8.4` 참조). 이는 어뷰저 세탁 방지를 위한 CF 내부 검증(`nicknameChangeCount`, 쿨다운, 수수료) 때문.

#### 2.7.3 타인 수정 허용 (필드 특례)

좋아요·공유 등 "타인의 필드 증가" 패턴:

```javascript
// 타인이 내 users 문서 수정 허용 (Rules 공격 방지 하에)
allow update: if request.auth != null
  && request.auth.uid != uid  // 타인 수정임을 명시
  && request.resource.data.diff(resource.data).affectedKeys()
      .hasOnly(['likes', 'totalShares', 'promoViewCount'])
  // 증가만 허용 (ANTI_ABUSE §4.2)
  && request.resource.data.likes >= resource.data.likes
  && request.resource.data.totalShares >= resource.data.totalShares
  // 1회 증가 한도 (평판 펌핑 차단)
  && request.resource.data.likes - resource.data.likes <= 3
  && request.resource.data.totalShares - resource.data.totalShares <= 1;
```

#### 2.7.4 관리자 전용 컬렉션

```javascript
// 감사 로그
match /admin_actions/{docId} {
  allow read: if hasAdminRole();  // Admin 이상
  allow write: if false;           // CF만
}

// 관리자 역할 이력
match /admin_role_history/{docId} {
  allow read: if hasAdminRole();
  allow write: if false;
}

// 대기 작업 (Moderator 제안 → Admin 승인)
match /pending_actions/{docId} {
  allow read: if hasModeratorRole();
  allow create: if hasModeratorRole();
  allow update: if hasAdminRole();  // 승인은 Admin 이상
  allow delete: if false;
}

// 닉네임 예약
match /reserved_nicknames/{nickname} {
  allow read: if true;              // 중복 체크용 공개 읽기
  allow write: if false;             // CF만
}

// 플랫폼 설정
match /platform_config/{docId} {
  allow read: if hasAdminRole();
  allow write: if hasOwnerRole();   // Owner만
}

// 플랫폼 수익
match /platform_revenue/{docId} {
  allow read: if hasAdminRole();
  allow write: if false;             // CF만
}

// 제재 로그
match /sanction_log/{docId} {
  allow read: if hasAdminRole();
  allow write: if false;
}

// 감사 이상치
match /audit_anomalies/{docId} {
  allow read: if hasAdminRole();
  allow write: if false;
}

// 땡스볼 스냅샷/감사
match /ball_balance_snapshots/{docId} {
  allow read: if hasAdminRole();
  allow write: if false;
}
```

#### 2.7.5 사용자 생성 컬렉션

```javascript
// 활동 로그 (CREATOR_SCORE §4.4)
match /activity_logs/{docId} {
  allow read: if false;              // CF/관리자만
  allow write: if false;
}

// 칭호 획득 이력 (MAPAE §8.3.1)
match /title_achievements/{docId} {
  allow read: if request.auth != null
    && (request.auth.uid == resource.data.uid || hasAdminRole());
  allow write: if false;
}

// 칭호 박탈 이력 (MAPAE §8.3.2)
match /title_revocations/{docId} {
  allow read: if hasAdminRole();
  allow write: if false;
}

// 마패 변동 이력 (MAPAE §8.3.3)
match /mapae_history/{docId} {
  allow read: if request.auth != null
    && (request.auth.uid == resource.data.uid || hasAdminRole());
  allow write: if false;
}

// 문의 접수 (ADMIN §5.6)
match /contact_requests/{docId} {
  allow read: if request.auth != null
    && (request.auth.uid == resource.data.reporterUid || hasModeratorRole());
  allow create: if request.auth != null
    && request.resource.data.reporterUid == request.auth.uid;
  allow update: if hasModeratorRole();
  allow delete: if false;
}

// 인증 대기 목록 (ADMIN §9.2 D4-β)
match /verification_waitlist/{docId} {
  allow read: if request.auth != null
    && (request.auth.uid == resource.data.uid || hasAdminRole());
  allow create: if request.auth != null
    && request.resource.data.uid == request.auth.uid;
  allow write: if false;
}
```

#### 2.7.6 마스터 데이터 컬렉션

```javascript
// 칭호 정의 (MAPAE)
match /titles/{titleId} {
  allow read: if true;              // 누구나 조회 가능
  allow write: if false;             // CF만 (seedTitles)
}
```

#### 2.7.7 헬퍼 함수

```javascript
// 역할 체크 헬퍼
function hasOwnerRole() {
  return request.auth != null
    && request.auth.token.role == 'owner';
}

function hasAdminRole() {
  return request.auth != null
    && request.auth.token.role in ['owner', 'admin'];
}

function hasModeratorRole() {
  return request.auth != null
    && request.auth.token.role in ['owner', 'admin', 'moderator'];
}

function hasViewerRole() {
  return request.auth != null
    && request.auth.token.role in ['owner', 'admin', 'moderator', 'viewer'];
}
```

#### 2.7.8 Phase별 Rules 변화

**Phase A**:
- §2.7.1의 hasOnly에서 `primaryTitles` 제외 (MAPAE 미도입)
- `verifications` 제외 (Tier 시스템 미도입)
- `preferredLanguage`, `timezone`, `autoTranslate` 제외 (글로벌 대응 Phase C)

**Phase B**:
- §2.7.1 전체 활성화 (MAPAE/CREATOR_SCORE 도입)

**Phase C**:
- `reportsUniqueReporters` 필드 활성화 (신고 시스템 개발 완료 후)
- `verifications.phone`, `verifications.payment` 실제 작동

#### 2.7.9 정합성 참조표

각 하위 문서의 Rules 선언 섹션이 **본 §2.7을 최종 참조**:

| 문서 | 기존 선언 위치 | 관계 |
|------|---------------|------|
| REPUTATION_V2.md §7.3 | 평판 필드 Rules | **이 섹션이 상위 참조** |
| CREATOR_SCORE.md §7.4 | Creator Score 필드 Rules | **이 섹션이 상위 참조** |
| MAPAE_AND_TITLES_V1.md §8.4 | 칭호 필드 Rules | **이 섹션이 상위 참조** |
| ANTI_ABUSE.md §4 | 평판 펌핑 방어 Rules | **§2.7.3에서 통합** |
| GLOVE_SYSTEM_REDESIGN_v2.md §5 | 기존 Rules | **§2.7.1에서 통합** |

**Step 2 구현 원칙**:
- 단일 `firestore.rules` 파일로 통합
- 본 §2.7을 청사진으로 사용
- 충돌 시 본 섹션을 최종 결정자로 간주
- 하위 문서 참조는 맥락 이해용

---

## 3. 감사 로그 시스템

### 3.1 🔑 결정 D3: 보존 정책

**배경**: 관리자 행동 감사 로그의 보존 기간과 방식.

#### 3.1.1 대안 D3-α: 영구 보존

**방식**: 모든 `admin_actions`를 영구 저장.

**장점**:
- 완전한 감사성
- 장기 분쟁 시 근거 확보
- 규제 대응 (개인정보보호법 등)

**단점**:
- 스토리지 비용 무제한 증가
- 10년 후 1억 건 시 쿼리 성능 저하

#### 3.1.2 대안 D3-β: 3년 보존 + 삭제

**방식**: 3년 경과 로그는 자동 삭제 (Firestore TTL).

**장점**:
- 스토리지 관리
- 일반적인 법적 보존 기간 (회계 5년, 개인정보 3~5년) 부합

**단점**:
- 10년 분쟁 시 근거 없음
- 삭제 후 복구 불가

#### 3.1.3 대안 D3-γ: 차등 보존 (**추천**)

**방식**: 행동 유형별 보존 기간 차등.

```
영구 보존:
  · 사약 (banned)
  · 수수료 조정
  · 관리자 역할 부여/회수
  · 경계값 조정 (TUNING)
  · Creator Score/평판 수동 조정

5년 보존:
  · 유배 1~3차 발동/해제
  · 칭호 수동 부여/박탈
  · 마패 수동 조정
  · 닉네임 수동 변경

3년 보존:
  · 콘텐츠 삭제/블라인드
  · 경고 발급
  · abuseFlags 수동 설정

1년 보존:
  · 대시보드 조회 로그 (접속 기록)
  · 읽기 전용 조회 이력
```

**장점**:
- 중요 행동 영구 보존 (책임 소재 명확)
- 일상 조회는 짧게 (스토리지 절약)
- 법적 요구 대응

**단점**:
- 구현 복잡도 ↑
- TTL 필드를 행동 유형별로 다르게 설정 필요

#### 3.1.4 비교 매트릭스

| 기준 | α 영구 | β 3년 | **γ 차등 (추천)** |
|------|:------:|:-----:|:-----------------:|
| 감사성 | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ (중요 행동) |
| 스토리지 비용 | 🔴 증가 | ✅ | ⚠️ 중간 |
| 법적 대응 | ✅ | ⚠️ | ✅ |
| 구현 복잡도 | ⭐ | ⭐⭐ | ⭐⭐⭐ |
| TTL 설정 | 불필요 | 단일 | 다중 |

#### 3.1.5 추천 — 대안 D3-γ (차등 보존)

**근거**:
1. 중요 결정(사약, 수수료 조정)은 영구 보존 필수
2. 일상 조회 로그까지 영구 저장은 낭비
3. 법적 보존 기간 충족
4. Firestore TTL 필드로 자동 청소

**구현**:

```typescript
// 행동 유형별 보존 기간 (일 단위)
export const RETENTION_POLICY: Record<string, number | null> = {
  // 영구 (null)
  'sayak': null,
  'tune_platform_fee': null,
  'grant_admin_role': null,
  'revoke_admin_role': null,
  'tune_threshold': null,
  'adjust_creator_score': null,
  'adjust_reputation': null,

  // 5년 (1,825일)
  'exile_lv1': 1825,
  'exile_lv2': 1825,
  'exile_lv3': 1825,
  'release_exile': 1825,
  'award_title': 1825,
  'revoke_title': 1825,
  'adjust_mapae': 1825,
  'change_nickname': 1825,

  // 3년 (1,095일)
  'delete_content': 1095,
  'blind_content': 1095,
  'issue_warning': 1095,
  'set_abuse_flag': 1095,
  'unset_abuse_flag': 1095,

  // 1년 (365일)
  'dashboard_view': 365,
  'log_export': 365,
};

// 감사 로그 저장 시
async function logAdminAction(action: AdminAction) {
  const retentionDays = RETENTION_POLICY[action.action];
  const expiresAt = retentionDays
    ? Timestamp.fromMillis(Date.now() + retentionDays * 24 * 60 * 60 * 1000)
    : null;  // 영구

  await db.collection('admin_actions').add({
    ...action,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt,  // null이면 TTL 적용 안 됨 → 영구 보존
  });
}
```

**TTL 설정**:
- Firestore Console → TTL 정책 → `admin_actions.expiresAt`
- null 필드는 TTL 작동 안 함 → 자동 영구 보존

### 3.2 admin_actions 스키마

```typescript
// Firestore: admin_actions/{actionId}

interface AdminAction {
  id: string;
  adminUid: string;
  adminRole: 'owner' | 'admin' | 'moderator' | 'viewer';
  action: string;             // 'exile_lv1', 'award_title', ...
  targetUid?: string;         // 대상 유저 (있으면)
  targetType?: string;        // 'user', 'post', 'comment', 'platform'
  targetId?: string;          // 대상 ID
  details: Record<string, unknown>;  // 액션별 세부 데이터
  reason: string;             // 필수 입력
  beforeState?: Record<string, unknown>;  // 변경 전 (롤백용)
  afterState?: Record<string, unknown>;   // 변경 후
  canRollback: boolean;
  rolledBackAt?: FirestoreTimestamp;
  rolledBackBy?: string;
  rollbackActionId?: string;  // 롤백 행동의 actionId
  createdAt: FirestoreTimestamp;
  expiresAt?: FirestoreTimestamp;  // null = 영구
  clientIp?: string;           // (선택) 관리자 IP
  userAgent?: string;           // (선택) 브라우저
}
```

### 3.3 로그 조회 UI

**경로**: Admin Dashboard → 감사 로그

**필터**:
- **기간**: 오늘 / 이번 주 / 이번 달 / 사용자 지정
- **관리자**: All / 특정 UID
- **액션 유형**: 드롭다운 (유배/수동조정/콘텐츠 등)
- **대상 유저**: UID 검색
- **상태**: 전체 / 롤백된 것 / 만료 예정

**목록 뷰**:
```
[2026-04-20 14:32] 흑무영 (Owner)
  → exile_lv1: 불량유저A (uid: ...)
  → 이유: "악플 10회 이상, 수동 제재"
  [상세] [롤백] [대상 유저로 이동]

[2026-04-20 14:15] 홍길동 (Admin)
  → award_title: 깐부5호 (uid: ...) 에 super_hit 부여
  → 이유: "커뮤니티 특별 이벤트 당첨"
  [상세] [롤백]
```

**상세 뷰**:
- 전체 details JSON
- beforeState → afterState 비교
- 관련 admin_actions 링크 (연결된 행동)
- 롤백 버튼 (canRollback=true & 아직 안 됨)

### 3.4 롤백 메커니즘

**롤백 가능한 행동**:
- 유배 발동 (`release_exile` 액션 호출)
- 칭호 박탈 (재부여)
- EXP/평판/Score 수동 조정 (beforeState로 복원)
- 콘텐츠 삭제 (블라인드는 복원)
- abuseFlags 설정/해제

**롤백 불가**:
- 사약 (영구 결정, 수동 대응만)
- 이미 속죄금 납부된 유배 해제
- 수수료 조정 (경제에 영향, 재조정으로 대응)

**롤백 CF**:

```javascript
exports.rollbackAdminAction = onCall({...}, async (req) => {
  const claims = req.auth?.token;

  if (!isAdmin(claims)) {
    throw new HttpsError('permission-denied', 'Admin only');
  }

  const { actionId, reason } = req.data;

  const actionDoc = await db.collection('admin_actions').doc(actionId).get();
  if (!actionDoc.exists) {
    throw new HttpsError('not-found', 'Action not found');
  }

  const action = actionDoc.data();
  if (!action.canRollback) {
    throw new HttpsError('failed-precondition', 'Not rollbackable');
  }
  if (action.rolledBackAt) {
    throw new HttpsError('already-exists', 'Already rolled back');
  }

  // 원본 beforeState로 복원
  if (action.targetType === 'user' && action.targetUid) {
    const userRef = db.collection('users').doc(action.targetUid);
    await userRef.update(action.beforeState || {});
  }

  // 롤백 액션을 새 로그로 기록
  const rollbackDoc = await db.collection('admin_actions').add({
    adminUid: req.auth.uid,
    adminRole: claims.role,
    action: `rollback_${action.action}`,
    targetUid: action.targetUid,
    targetType: action.targetType,
    targetId: action.targetId,
    details: { originalActionId: actionId },
    reason,
    canRollback: false,  // 롤백의 롤백은 금지
    createdAt: FieldValue.serverTimestamp(),
  });

  // 원본 액션에 롤백 정보 기록
  await actionDoc.ref.update({
    rolledBackAt: FieldValue.serverTimestamp(),
    rolledBackBy: req.auth.uid,
    rollbackActionId: rollbackDoc.id,
  });

  return { success: true, rollbackActionId: rollbackDoc.id };
});
```

### 3.5 감사 로그 무결성 보장

**원칙**: 관리자도 자신의 행동 로그를 수정할 수 없어야 함.

**구현**:
- `admin_actions` Rules: `allow write: if false` (CF만 쓰기, 관리자 직접 수정 금지)
- 삭제도 CF 금지 (TTL 자동 삭제만 허용)
- 타임스탬프는 `FieldValue.serverTimestamp()` (클라이언트 시각 조작 방지)

**추가 보안**:
- (선택) 해시 체인: 각 로그에 이전 로그의 해시 포함 → 중간 삭제 감지
- (Phase C) 외부 로그 백업: BigQuery 또는 S3에 일일 export

### 3.6 로그 분석 쿼리

**관리자별 활동 빈도**:
```
Collection: admin_actions
Filter: adminUid == X
Group by: action
Count: action count
```

**특정 유저 대상 조치 이력**:
```
Collection: admin_actions
Filter: targetUid == X
Order: createdAt DESC
```

**롤백 빈도 (관리자 품질 지표)**:
```
Collection: admin_actions
Filter: rolledBackAt != null
Group by: adminUid
Count: rollback count
```

### 3.7 인덱스

```
Collection: admin_actions
Fields: adminUid ASC, createdAt DESC
Fields: action ASC, createdAt DESC
Fields: targetUid ASC, createdAt DESC
Fields: expiresAt ASC (TTL용)
```

---
## 4. 유배·제재 관리

### 4.1 유배 시스템 개요

**출처**: `ANTI_ABUSE.md §1.1.3`, `PRICING.md §2.1`

**구현 상태**: 🟢 CF는 거의 완성, 관리자 UI만 부재.

**4단계 구조**:

| 단계 | 상태값 | 반성 기간 | 속죄금 | 원화 | 미납 시 |
|:----:|:------:|:---------:|:------:|:----:|:------:|
| 🟡 1차 | `exiled_lv1` | 3일 | 10볼 | 1,000원 | 90일 후 자동 사약 |
| 🟠 2차 | `exiled_lv2` | 7일 | 50볼 | 5,000원 | 90일 후 자동 사약 |
| 🔴 3차 | `exiled_lv3` | 30일 | 300볼 | 30,000원 | 90일 후 자동 사약 |
| ☠️ 4차 | `banned` | 영구 | 불가 | — | — |

**CF 상태**:
- ✅ `sendToExile` — 유배 발동
- ✅ `executeSayak` — 사약 집행
- ✅ `checkAutoSayak` — 90일 미납 자동 사약 (일일 배치)
- ❌ `releaseExile` — 수동 해제 (구현 필요)
- ❌ 관리자 UI — 호출 경로 없음

### 4.2 유배 발동 UI

**경로**: Admin Dashboard → 유저 상세 → "유배 조치"

**화면 구성**:

```
┌─────────────────────────────────────────────────┐
│ ⚠️ 유배 조치 — 깐부5호 (uid: abc123)             │
├─────────────────────────────────────────────────┤
│                                                 │
│ 현재 상태: 🟢 clean                              │
│ 이전 유배 이력: 0회                              │
│ 평판: 우호 (1,234점)                             │
│ Creator Score: 1.35 (은마패)                    │
│                                                 │
│ ─────────────────────────────────────────────   │
│                                                 │
│ 유배 단계 선택:                                  │
│   ○ 1차 (exiled_lv1) · 3일 · 속죄금 10볼         │
│   ● 2차 (exiled_lv2) · 7일 · 속죄금 50볼         │
│   ○ 3차 (exiled_lv3) · 30일 · 속죄금 300볼       │
│   ○ 사약 (banned) · 영구 · 자산 몰수            │
│                                                 │
│ 사유 (필수, 200자 이내):                         │
│ ┌─────────────────────────────────────────┐    │
│ │ 외부 제보 3건 접수: 악성 댓글 반복        │    │
│ │ 경고 1회 후 재발. 2차 유배 필요 판단.      │    │
│ └─────────────────────────────────────────┘    │
│                                                 │
│ 연관 증거 (선택):                                │
│ · 댓글 #a1b2c3 링크                              │
│ · 댓글 #d4e5f6 링크                              │
│                                                 │
│ ☐ 유배 시작과 동시에 abuseFlag 설정             │
│ ☐ 관련 댓글 자동 블라인드                        │
│                                                 │
│ [ 취소 ]        [ 유배 발동 ]                   │
└─────────────────────────────────────────────────┘
```

**동작**:
1. 관리자가 조건 입력 → "유배 발동" 클릭
2. 확인 모달: "정말 2차 유배를 발동하시겠습니까?"
3. `sendToExile` CF 호출
4. `admin_actions` 기록 (action: `exile_lv2`)
5. 유저에게 알림 발송 (유배 시작, 속죄금 안내)
6. 관련 댓글 자동 블라인드 (옵션 선택 시)

### 4.3 유배 해제 UI

**경로**: Admin Dashboard → 유저 상세 → "유배 해제"

**조건**:
- `sanctionStatus`가 `exiled_*` 상태
- 속죄금 미납 또는 관리자 직권 해제

**화면**:

```
┌─────────────────────────────────────────────┐
│ 유배 해제 — 깐부5호                         │
├─────────────────────────────────────────────┤
│ 현재 상태: 🟠 exiled_lv2                     │
│ 유배 시작: 2026-04-15                        │
│ 반성 기간: 7일 (2/7일 경과)                   │
│ 속죄금 납부: ❌ 미납 (50볼)                  │
│                                             │
│ 해제 사유 (필수):                            │
│   ○ 정상적 속죄 완료 (유저가 볼 납부)        │
│   ● 관리자 직권 해제 (오판정 복구 등)        │
│   ○ 기타                                      │
│                                             │
│ 상세 사유 (200자):                           │
│ ┌─────────────────────────────────────┐    │
│ │ 제보 내용 재검토 결과, 오인 신고로    │    │
│ │ 확인. 즉시 해제 필요.                │    │
│ └─────────────────────────────────────┘    │
│                                             │
│ ☑ 평판 감점 되돌리기                         │
│ ☑ 관련 콘텐츠 블라인드 해제                  │
│                                             │
│ [ 취소 ]        [ 해제 실행 ]               │
└─────────────────────────────────────────────┘
```

**CF** (`releaseExile`):

```javascript
exports.releaseExile = onCall({...}, async (req) => {
  const claims = req.auth?.token;

  if (!isAdmin(claims)) {
    throw new HttpsError('permission-denied', 'Admin only');
  }

  const { targetUid, reason, detailReason, restoreReputation, unblindContent } = req.data;

  const userRef = db.collection('users').doc(targetUid);
  const userDoc = await userRef.get();
  const beforeState = userDoc.data();

  if (!beforeState.sanctionStatus?.startsWith('exiled_')) {
    throw new HttpsError('failed-precondition', 'Not in exile');
  }

  await db.runTransaction(async (tx) => {
    // 1. 유배 해제
    tx.update(userRef, {
      sanctionStatus: 'clean',
      exileReleasedAt: FieldValue.serverTimestamp(),
    });

    // 2. exileHistory에 해제 기록
    const newHistory = [...(beforeState.exileHistory || [])];
    const lastIdx = newHistory.length - 1;
    if (lastIdx >= 0 && !newHistory[lastIdx].releasedAt) {
      newHistory[lastIdx].releasedAt = FieldValue.serverTimestamp();
      newHistory[lastIdx].releaseReason = reason;
    }
    tx.update(userRef, { exileHistory: newHistory });

    // 3. (옵션) 평판 감점 되돌리기
    if (restoreReputation && beforeState.abuseFlags) {
      tx.update(userRef, {
        abuseFlags: {},  // 모든 플래그 해제
      });
      // reputationEvents 트리거가 평판 재계산
    }
  });

  // 4. (옵션) 블라인드 해제
  if (unblindContent) {
    await unblindUserContent(targetUid);
  }

  // 5. 감사 로그
  await db.collection('admin_actions').add({
    adminUid: req.auth.uid,
    adminRole: claims.role,
    action: 'release_exile',
    targetUid,
    targetType: 'user',
    details: { reason, detailReason, restoreReputation, unblindContent },
    reason: detailReason,
    beforeState: {
      sanctionStatus: beforeState.sanctionStatus,
      abuseFlags: beforeState.abuseFlags,
    },
    afterState: {
      sanctionStatus: 'clean',
      abuseFlags: restoreReputation ? {} : beforeState.abuseFlags,
    },
    canRollback: true,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: Timestamp.fromMillis(Date.now() + 1825 * 24 * 60 * 60 * 1000),
  });

  // 6. 유저 알림
  await db.collection('notifications').add({
    uid: targetUid,
    type: 'exile_released',
    data: { reason, by: 'admin' },
    read: false,
    createdAt: FieldValue.serverTimestamp(),
  });

  return { success: true };
});
```

### 4.4 사약 집행 UI

**경로**: Admin Dashboard → 유저 상세 → "사약 집행"

**⚠️ Owner 전용** (Admin 불가)

**경고 UI**:

```
┌─────────────────────────────────────────────┐
│ ☠️ 사약 집행 — 깐부X (uid: ...)              │
├─────────────────────────────────────────────┤
│                                             │
│ ⚠️ 주의: 사약은 영구 정지이며 되돌릴 수     │
│    없습니다.                                │
│                                             │
│ 자동 실행될 처리:                            │
│   ✓ sanctionStatus = 'banned'               │
│   ✓ ballBalance 전액 몰수                    │
│   ✓ pendingRevenue 전액 회수                 │
│   ✓ 칭호 13개 박탈 (pioneer_2026만 유지)     │
│   ✓ 모든 콘텐츠 블라인드                     │
│   ✓ phoneHash 블랙리스트 등록               │
│   ✓ 공개 프로필 숨김                         │
│                                             │
│ 현재 보유 자산:                              │
│   · ballBalance: 2,450볼 (245,000원)         │
│   · pendingRevenue: 15,000원                 │
│                                             │
│ 사유 (필수, 500자 이내):                     │
│ ┌─────────────────────────────────────┐    │
│ │ 3차 유배 후 재범. 반복된 악성 댓글,   │    │
│ │ 맞땡스볼 담합 증거 명확.              │    │
│ └─────────────────────────────────────┘    │
│                                             │
│ 확인을 위해 유저 닉네임 입력 (이중 확인):     │
│ ┌─────────────────────────────────────┐    │
│ │ 깐부X                                │    │
│ └─────────────────────────────────────┘    │
│                                             │
│ [ 취소 ]        [ 사약 집행 ]               │
└─────────────────────────────────────────────┘
```

**이중 확인**:
- 닉네임 정확히 입력해야 "사약 집행" 버튼 활성화
- 실수로 잘못된 유저를 사약하는 것 방지

**CF** (`executeSayak` 래퍼):

```javascript
exports.adminExecuteSayak = onCall({...}, async (req) => {
  const claims = req.auth?.token;

  if (!isOwner(claims)) {
    throw new HttpsError('permission-denied', 'Owner only');
  }

  const { targetUid, reason, confirmNickname } = req.data;

  // 이중 확인
  const userDoc = await db.collection('users').doc(targetUid).get();
  if (userDoc.data().nickname !== confirmNickname) {
    throw new HttpsError('invalid-argument', 'Nickname mismatch');
  }

  // executeSayak CF 호출 (기존 로직 재사용)
  await executeSayakInternal(targetUid, req.auth.uid, reason);

  return { success: true };
});
```

### 4.5 속죄금 관리

**대시보드 경로**: Admin Dashboard → 유배 관리 → 속죄금 현황

**표시**:

```
┌────────────────────────────────────────────────┐
│ 💰 속죄금 현황                                  │
├────────────────────────────────────────────────┤
│ 이번 달 소각: 450볼 (45,000원)                  │
│   - 1차 유배: 12건 × 10볼 = 120볼              │
│   - 2차 유배: 3건 × 50볼 = 150볼               │
│   - 3차 유배: 0건                               │
│   - 기타: 180볼                                 │
│                                                │
│ 이번 달 사약 몰수: 2,450볼 (245,000원)          │
│   - 사약 대상: 깐부X (2,450볼)                  │
│                                                │
│ 미납 대기 (90일 후 자동 사약):                  │
│   · 불량유저A — 2차 유배, 68일 경과, 50볼 미납  │
│   · 불량유저B — 1차 유배, 45일 경과, 10볼 미납  │
└────────────────────────────────────────────────┘
```

**데이터 소스**:
- `platform_revenue/sanction_burn` — 소각 기록
- `platform_revenue/sayak_seized` — 사약 몰수
- `users` where `sanctionStatus` starts with `exiled_` → 미납 상태

### 4.6 데이터 모델

```typescript
interface UserData {
  // === 기존 유배 필드 ===
  sanctionStatus?: 'clean' | 'exiled_lv1' | 'exiled_lv2' | 'exiled_lv3' | 'banned';

  // === 🆕 ADMIN이 추가하는 유배 관련 필드 ===
  exileHistory?: ExileRecord[];  // MAPAE에서도 정의됨, 재확인
  exileStartedAt?: FirestoreTimestamp;
  exileReleasedAt?: FirestoreTimestamp;
  exileReason?: string;  // 최근 유배 사유
  exileEvidence?: string[];  // 증거 링크 (댓글/글 ID 등)
  sanctionPaidAt?: FirestoreTimestamp;
  sanctionAmount?: number;
}

interface ExileRecord {
  level: 1 | 2 | 3;
  startedAt: FirestoreTimestamp;
  releasedAt: FirestoreTimestamp | null;
  reason: string;
  releaseReason?: string;
  releasedBy?: 'self_pay' | 'admin_manual' | 'system_auto';
  sanctionPaidAt?: FirestoreTimestamp;
  sanctionAmount?: number;
  evidence?: string[];
  issuedBy?: string;  // adminUid
}
```

### 4.7 유배 대시보드

**경로**: Admin Dashboard → 유배 관리

**탭 구성**:

**탭 1: 현재 유배 중**
```
유저        | 단계   | 시작일      | 경과 | 속죄금 | 상태    | 조치
-----------|--------|-------------|------|--------|---------|--------
불량유저A  | 2차    | 2026-04-15  | 5일  | 50볼   | 미납    | [해제] [사약]
불량유저B  | 1차    | 2026-03-15  | 36일 | 10볼   | 미납    | [해제] [사약]
```

**탭 2: 최근 해제**
```
유저        | 단계   | 해제일      | 사유           | 해제자
-----------|--------|-------------|----------------|-------
깐부5호    | 2차    | 2026-04-18  | 오판정 복구     | 흑무영 (Owner)
```

**탭 3: 사약 이력 (영구 보존)**
```
유저   | 사약일      | 몰수 금액 | 사유            | 집행자
-------|-------------|-----------|-----------------|-------
깐부X  | 2026-03-22  | 2,450볼   | 3차 후 재범     | 흑무영
```

---

## 5. 신고 관리 (수동 제재 중심)

> ⚠️ **중요 전제**: 신고 시스템은 **현재 미개발**. 본 §5는 Phase A/B **수동 제재 운영 방식**을 상세화하고, Phase C 신고 시스템 도입 시 확장 방향만 제시.

### 5.1 Phase A/B 운영 현황

**제보 경로** (외부 채널):
- 관리자 DM (인스타그램 / 트위터 / 텔레그램 등)
- 공식 이메일 (`support@geulove.com` 등)
- 카카오톡 오픈채팅 운영 채널
- 커뮤니티 공지에 제보 방법 안내

**제보 처리 흐름**:
```
유저 제보 (외부 채널)
        ↓
관리자 수동 확인 (증거 수집)
        ↓
판단 (제재 필요 여부)
        ↓
조치 (유배/플래그/블라인드 등)
        ↓
admin_actions 기록
        ↓
유저 알림 (조치 내용)
```

**한계**:
- 확장성 부재 (관리자 1명 기준 일 수십 건 처리가 한계)
- 제보 경로 분산 → 누락 가능
- 증거 보존이 수동
- Phase B에서 유저 100명 이상 시 한계 명확

### 5.2 수동 제재 작업 플로우 (Phase A/B)

**경로**: Admin Dashboard → 수동 제재

**화면 구성**:

```
┌─────────────────────────────────────────────────┐
│ 🚨 수동 제재 — 신규 조치                         │
├─────────────────────────────────────────────────┤
│                                                 │
│ 대상 유저 UID 또는 닉네임:                       │
│ ┌─────────────────────────────────────────┐    │
│ │ 깐부X                            [조회]  │    │
│ └─────────────────────────────────────────┘    │
│                                                 │
│ [조회 결과]                                      │
│ 닉네임: 깐부X                                   │
│ Lv.5 · 우호 · 은마패                            │
│ 가입일: 2026-03-01                              │
│ 유배 이력: 0회                                   │
│ 최근 활동: 2시간 전                              │
│                                                 │
│ ─────────────────────────────────────────────   │
│                                                 │
│ 제보 경로:                                       │
│   ● 관리자 DM                                    │
│   ○ 공식 이메일                                  │
│   ○ 카카오톡 오픈채팅                            │
│   ○ 관리자 자체 발견                             │
│   ○ 기타                                         │
│                                                 │
│ 제보 요약 (필수, 200자):                         │
│ ┌─────────────────────────────────────────┐    │
│ │ 인스타 DM으로 제보 3건 접수.             │    │
│ │ 악성 댓글 반복 & 특정 유저 스토킹 의심.   │    │
│ └─────────────────────────────────────────┘    │
│                                                 │
│ 증거 URL/ID (여러 개 허용):                      │
│ ┌─────────────────────────────────────────┐    │
│ │ comment_abc123                           │    │
│ │ comment_def456                           │    │
│ │ post_ghi789                              │    │
│ └─────────────────────────────────────────┘    │
│                                                 │
│ 권장 조치 (관리자 판단):                         │
│   ○ 경고 (유저 알림만)                           │
│   ● 유배 1차                                     │
│   ○ 유배 2차                                     │
│   ○ 유배 3차                                     │
│   ○ abuseFlag 수동 설정                          │
│   ○ 콘텐츠 삭제만                                │
│                                                 │
│ 부가 조치:                                       │
│   ☑ 관련 콘텐츠 블라인드                         │
│   ☐ 닉네임 변경 강제                             │
│                                                 │
│ [ 취소 ]        [ 조치 검토 및 실행 ]           │
└─────────────────────────────────────────────────┘
```

**검토 화면** (실행 전):

```
┌─────────────────────────────────────────┐
│ 조치 요약 — 확인 필요                    │
├─────────────────────────────────────────┤
│                                         │
│ 대상: 깐부X                             │
│                                         │
│ 수행할 조치:                             │
│   1. 유배 1차 발동 (exile_lv1)          │
│   2. 댓글 3건 블라인드                   │
│                                         │
│ 예상 효과:                               │
│   · 속죄금 10볼 부과                     │
│   · 반성 기간 3일                        │
│   · 3일간 활동 제한                      │
│                                         │
│ 감사 로그에 기록될 내용:                 │
│   - adminUid: 흑무영                     │
│   - action: exile_lv1                   │
│   - reason: "인스타 DM 제보 3건..."     │
│   - evidence: [comment_abc..., ...]     │
│                                         │
│ [ 뒤로 ]        [ 확인하고 실행 ]       │
└─────────────────────────────────────────┘
```

### 5.3 경고 시스템

**경고(Warning)**: 유배 이전의 경미한 제재.

**특징**:
- `sanctionStatus` 변경 없음
- `abuseFlags` 변경 없음
- 유저에게 알림만 발송
- `admin_actions` 기록
- 3회 누적 시 자동 1차 유배 권장 (UI에서 경고 표시)

**CF**:

```javascript
exports.issueWarning = onCall({...}, async (req) => {
  const claims = req.auth?.token;

  if (!isModerator(claims)) {
    throw new HttpsError('permission-denied', 'Moderator or higher');
  }

  const { targetUid, reason, evidence } = req.data;

  // 기존 경고 횟수 확인
  const warningsSnap = await db.collection('admin_actions')
    .where('targetUid', '==', targetUid)
    .where('action', '==', 'issue_warning')
    .get();
  const warningCount = warningsSnap.size + 1;

  // 감사 로그
  await db.collection('admin_actions').add({
    adminUid: req.auth.uid,
    adminRole: claims.role,
    action: 'issue_warning',
    targetUid,
    details: { reason, evidence, warningCount },
    reason,
    canRollback: true,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: Timestamp.fromMillis(Date.now() + 1095 * 24 * 60 * 60 * 1000),
  });

  // 유저 알림
  await db.collection('notifications').add({
    uid: targetUid,
    type: 'warning_issued',
    data: { reason, warningCount },
    read: false,
    createdAt: FieldValue.serverTimestamp(),
  });

  // 3회 도달 시 Admin에게 알림
  if (warningCount >= 3) {
    await notifyAdminsOfRepeatWarnings(targetUid, warningCount);
  }

  return { success: true, warningCount };
});
```

### 5.4 외부 제보 기록 (비공식 저장)

Phase A/B 동안 정식 reports 컬렉션이 없으므로, **제보 내용을 감사 로그에 포함**하여 추적.

**예시 `admin_actions` 문서**:
```json
{
  "adminUid": "owner_uid",
  "adminRole": "owner",
  "action": "exile_lv1",
  "targetUid": "bad_user_uid",
  "details": {
    "sanctionLevel": 1,
    "sanctionAmount": 10,
    "reportSource": "instagram_dm",
    "reporterInfo": "@user123 (외부 신원 참고용)",
    "reportReceived": "2026-04-20T10:30:00Z",
    "reportSummary": "악성 댓글 반복",
    "evidence": ["comment_abc", "comment_def", "post_xyz"]
  },
  "reason": "인스타 DM 제보 3건 접수...",
  "canRollback": true
}
```

### 5.5 Phase C 신고 시스템 설계 방향 (예고)

**본 Step 1 범위를 벗어나므로 방향만 제시**.

**예상 구조**:

```typescript
// Phase C 설계 예정
interface Report {
  id: string;
  reporterUid: string;
  targetType: 'user' | 'post' | 'comment' | 'live';
  targetUid?: string;
  targetId?: string;
  category: 'spam' | 'harassment' | 'obscenity' | 'illegal' | 'other';
  description: string;
  evidence?: string[];
  status: 'pending' | 'under_review' | 'action_taken' | 'dismissed';
  severity: 'low' | 'medium' | 'high' | 'critical';
  assignedTo?: string;  // Moderator UID
  reviewedAt?: FirestoreTimestamp;
  createdAt: FirestoreTimestamp;
}
```

**예상 CF**:
- `createReport` (유저 호출)
- `assignReport` (Moderator에게 자동 배정)
- `reviewReport` (Moderator 검토)
- `escalateReport` (Admin으로 올림)

**예상 대시보드**:
- 대기 중인 신고 큐
- 카테고리별 통계
- 심각도별 분류
- Moderator별 처리 속도
- false positive 비율

**Phase C 진입 조건**:
- 유저 수 ≥ 1,000명
- 수동 제재 건수 ≥ 주 20건
- Moderator 3명 이상 고용 완료

### 5.6 Phase B 후반 "제보 접수" 준비

**중간 단계** (Phase B 후반, 유저 50~100명):
- 정식 신고 UI 없이 **"관리자에게 문의" 버튼**만 추가
- 유저가 문의 → `contact_requests` 컬렉션에 저장
- 관리자 대시보드에서 확인 후 수동 제재

**`contact_requests` 스키마**:

```typescript
interface ContactRequest {
  id: string;
  reporterUid: string;
  category: 'bug' | 'abuse_report' | 'question' | 'other';
  subject: string;
  content: string;
  attachments?: string[];  // 스크린샷 URL
  status: 'new' | 'in_progress' | 'resolved';
  assignedTo?: string;
  resolvedAt?: FirestoreTimestamp;
  resolution?: string;
  createdAt: FirestoreTimestamp;
}
```

**CF 권한**:
- 생성: 로그인 유저 (본인만)
- 조회: 관리자 (Moderator 이상) + 본인
- 상태 변경: Moderator 이상

### 5.7 제재 이력 유저 프로필 뷰

**경로**: Admin Dashboard → 유저 상세 → 제재 이력 탭

**표시**:

```
┌──────────────────────────────────────────────┐
│ 🚨 제재 이력 — 깐부X                         │
├──────────────────────────────────────────────┤
│                                              │
│ 경고: 2회                                     │
│   · 2026-04-01 : 비속어 사용 (흑무영)         │
│   · 2026-04-10 : 반복 스팸 (홍길동)           │
│                                              │
│ 유배: 1회                                     │
│   · 2026-04-15 : 2차 유배 (7일)              │
│     - 사유: "악성 댓글 반복"                  │
│     - 해제: 2026-04-20 (속죄금 납부)          │
│     - 발동자: 흑무영 (Owner)                  │
│                                              │
│ abuseFlags 이력:                              │
│   · 2026-04-15 설정: shortPostSpam           │
│   · 2026-04-22 해제: 자동 (30일 경과)         │
│                                              │
│ 콘텐츠 삭제: 5건                              │
│   · 2026-04-15: 댓글 #abc (욕설)             │
│   · ... (더보기)                              │
│                                              │
│ 현재 상태:                                    │
│   · sanctionStatus: clean                    │
│   · 평판 감점: 없음                           │
│   · 위험도: 🟡 주의                           │
│                                              │
│ [ 제재 추가 ]  [ 전체 로그 보기 ]            │
└──────────────────────────────────────────────┘
```

**"위험도" 자동 판정**:
- 🔴 위험: 유배 2회 이상 or abuseFlags 3개 이상
- 🟡 주의: 유배 1회 or 경고 3회 이상
- 🟢 정상: 위 조건 미충족

---

## 6. 수동 조정 도구

### 6.1 개요

**목적**: REPUTATION_V2/CREATOR_SCORE/MAPAE_AND_TITLES 각 문서가 ADMIN에 위임한 수동 조정 기능을 통합 구현.

**대상 필드**:

| 필드 | 소속 문서 | 수정 경로 |
|------|:---------:|-----------|
| `exp`, `level` | LEVEL_V2 | `adjustExp` CF |
| `likes`, `totalShares`, `ballReceived` | REPUTATION_V2 | `adjustReputation` CF |
| `reputationCached` 직접 수정 | REPUTATION_V2 | (일반적으로 X, 배치 재계산 권장) |
| `abuseFlags` | REPUTATION_V2 §3.2.3 | `setAbuseFlag` CF |
| `grandfatheredPrestigeTier` | REPUTATION_V2 §4.5 | `setGrandfathered` CF |
| `creatorScoreFrozen`, `creatorScoreManualBoost` | CREATOR_SCORE §10.5 | `adjustCreatorScore` CF |
| `creatorScoreTier` 수동 | CREATOR_SCORE | (일반적으로 자동 계산) |
| `titles[]`, `primaryTitles[]` | MAPAE | `awardTitle` / `revokeTitle` CF |
| `sanctionStatus` | ANTI_ABUSE | `sendToExile` / `releaseExile` CF (§4) |

### 6.2 EXP/레벨 조정

**권한**: Admin 이상.

**UI**:

```
┌─────────────────────────────────────────┐
│ EXP 조정 — 깐부5호                      │
├─────────────────────────────────────────┤
│ 현재 EXP: 1,250                         │
│ 현재 Lv: 5                              │
│                                         │
│ 조정 방식:                               │
│   ● 절대값 설정                          │
│   ○ 가감산                               │
│                                         │
│ 새 EXP 값: [1,500]                      │
│ 예상 Lv: 6 (변화 +1)                    │
│                                         │
│ 사유 (필수):                             │
│ ┌───────────────────────────────────┐  │
│ │ 3월 이벤트 당첨 → EXP +250         │  │
│ └───────────────────────────────────┘  │
│                                         │
│ ☐ level 필드 자동 재계산                │
│                                         │
│ [ 취소 ]    [ 조정 실행 ]               │
└─────────────────────────────────────────┘
```

**CF** (`adjustExp`):

```javascript
exports.adjustExp = onCall({...}, async (req) => {
  const claims = req.auth?.token;

  if (!isAdmin(claims)) {
    throw new HttpsError('permission-denied', 'Admin only');
  }

  const { targetUid, mode, value, reason, recalculateLevel } = req.data;

  const userRef = db.collection('users').doc(targetUid);
  const userDoc = await userRef.get();
  const beforeState = { exp: userDoc.data().exp, level: userDoc.data().level };

  let newExp: number;
  if (mode === 'absolute') {
    newExp = Math.max(0, value);
  } else {
    newExp = Math.max(0, (userDoc.data().exp || 0) + value);
  }

  const updates: Record<string, unknown> = { exp: newExp };

  if (recalculateLevel) {
    updates.level = calculateLevel(newExp);  // LEVEL_V2 §4.2 공식
  }

  await userRef.update(updates);

  // 감사 로그
  await db.collection('admin_actions').add({
    adminUid: req.auth.uid,
    adminRole: claims.role,
    action: 'adjust_exp',
    targetUid,
    targetType: 'user',
    details: { mode, value, recalculateLevel },
    reason,
    beforeState,
    afterState: { exp: newExp, level: updates.level ?? beforeState.level },
    canRollback: true,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: null,  // 영구 보존
  });

  return { success: true, newExp, newLevel: updates.level };
});
```

### 6.3 평판 조정

**⚠️ 직접 `reputationCached` 수정 대신 원시 필드 조정 권장**:
- `likes`, `totalShares`, `ballReceived` 중 해당 항목 조정
- `reputationCache` CF가 다음 배치 또는 이벤트에서 재계산
- 일관성 유지

**직접 수정이 필요한 경우** (드뭄):
- 오판정 즉시 복구 (하루 기다릴 수 없음)
- 평판 필드가 Critical 버그로 오염됨

**UI**:

```
┌─────────────────────────────────────────┐
│ 평판 조정 — 깐부5호                     │
├─────────────────────────────────────────┤
│ 현재 평판: 1,234 (우호)                  │
│   · likes: 300                          │
│   · totalShares: 50                     │
│   · ballReceived: 80                    │
│   · decay: 1.0                          │
│   · penalty: 0                          │
│                                         │
│ 조정 방식:                               │
│   ● 원시 필드 (권장)                     │
│     - likes: [300]                      │
│     - totalShares: [50]                 │
│     - ballReceived: [80]                │
│   ○ 캐시 직접 수정 (주의)                │
│     - reputationCached: [1,234]         │
│                                         │
│ 사유 (필수):                             │
│ ┌───────────────────────────────────┐  │
│ │ 봇 어뷰저 펌핑 롤백                │  │
│ └───────────────────────────────────┘  │
│                                         │
│ ☑ 즉시 캐시 재계산 (adjustCreatorScore도) │
│                                         │
│ [ 취소 ]    [ 조정 실행 ]               │
└─────────────────────────────────────────┘
```

### 6.4 Creator Score 수동 조정

**출처**: `CREATOR_SCORE.md §10.5`

**기능**:
- **Freeze**: Creator Score를 0으로 고정 (`creatorScoreFrozen: true`)
- **Unfreeze**: Freeze 해제
- **Boost**: 수동 가산 (`creatorScoreManualBoost: +N`)
- **Demote**: 수동 감산

**UI**:

```
┌─────────────────────────────────────────┐
│ Creator Score 조정 — 깐부X              │
├─────────────────────────────────────────┤
│ 현재 상태:                               │
│   Score: 1.85 (은마패)                  │
│   Frozen: ❌                            │
│   Manual Boost: 0                       │
│                                         │
│ 조정 액션:                               │
│   ○ Freeze (Score → 0)                 │
│   ○ Unfreeze                            │
│   ● Boost (+값)                         │
│   ○ Demote (-값)                        │
│                                         │
│ 값: [+0.5]                              │
│                                         │
│ 예상 결과:                               │
│   Score: 1.85 + 0.5 = 2.35 (금마패)    │
│                                         │
│ 사유 (필수):                             │
│ ┌───────────────────────────────────┐  │
│ │ 공식 파트너십 체결 (프로모션)       │  │
│ └───────────────────────────────────┘  │
│                                         │
│ 유효 기간:                               │
│   ○ 영구                                 │
│   ● 기간 제한 [30일]                    │
│                                         │
│ [ 취소 ]    [ 조정 실행 ]               │
└─────────────────────────────────────────┘
```

**CF** (`adjustCreatorScore`):

```javascript
exports.adjustCreatorScore = onCall({...}, async (req) => {
  const claims = req.auth?.token;

  if (!isAdmin(claims)) {
    throw new HttpsError('permission-denied', 'Admin only');
  }

  const { targetUid, action, value, reason, duration } = req.data;
  // action: 'freeze' | 'unfreeze' | 'boost' | 'demote'

  const userRef = db.collection('users').doc(targetUid);
  const beforeDoc = await userRef.get();
  const beforeState = {
    creatorScoreFrozen: beforeDoc.data().creatorScoreFrozen,
    creatorScoreManualBoost: beforeDoc.data().creatorScoreManualBoost,
  };

  const updates: Record<string, unknown> = {
    creatorScoreAdjustedAt: FieldValue.serverTimestamp(),
    creatorScoreAdjustedBy: req.auth.uid,
  };

  switch (action) {
    case 'freeze':
      updates.creatorScoreFrozen = true;
      break;
    case 'unfreeze':
      updates.creatorScoreFrozen = false;
      break;
    case 'boost':
      updates.creatorScoreManualBoost = (beforeState.creatorScoreManualBoost || 0) + value;
      break;
    case 'demote':
      updates.creatorScoreManualBoost = (beforeState.creatorScoreManualBoost || 0) - value;
      break;
  }

  // 기간 제한 (선택)
  if (duration) {
    updates.creatorScoreExpiresAt = Timestamp.fromMillis(
      Date.now() + duration * 24 * 60 * 60 * 1000
    );
  }

  await userRef.update(updates);

  // 감사 로그
  await db.collection('admin_actions').add({
    adminUid: req.auth.uid,
    adminRole: claims.role,
    action: 'adjust_creator_score',
    targetUid,
    targetType: 'user',
    details: { action, value, duration },
    reason,
    beforeState,
    afterState: {
      creatorScoreFrozen: updates.creatorScoreFrozen ?? beforeState.creatorScoreFrozen,
      creatorScoreManualBoost: updates.creatorScoreManualBoost ?? beforeState.creatorScoreManualBoost,
    },
    canRollback: true,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: null,
  });

  return { success: true };
});
```

### 6.5 칭호 수동 부여/박탈

**출처**: `MAPAE_AND_TITLES_V1.md §12.4.1`

**부여 UI**:

```
┌─────────────────────────────────────────┐
│ 칭호 수동 부여 — 깐부5호                │
├─────────────────────────────────────────┤
│ 현재 보유 칭호 (5/14):                   │
│   🔰 새싹 작가                           │
│   ✍️ 근면한 작가 I                       │
│   🔥 첫 화제                             │
│   🤝 사교의 달인                         │
│   🌱 초기 개척자                         │
│                                         │
│ 부여할 칭호:                             │
│ ┌─────────────────────────────────────┐ │
│ │ [💎 초대박 (super_hit)       ▼]     │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ (등급이 있는 칭호인 경우)                │
│   ○ I (기본)                             │
│   ○ II                                   │
│   ● III                                  │
│                                         │
│ 사유 (필수):                             │
│ ┌───────────────────────────────────┐  │
│ │ 플랫폼 공식 이벤트 당첨             │  │
│ └───────────────────────────────────┘  │
│                                         │
│ ☑ 유저에게 알림 발송                     │
│ ☐ 대표 칭호 자동 설정                    │
│                                         │
│ [ 취소 ]    [ 부여 실행 ]               │
└─────────────────────────────────────────┘
```

**박탈 UI**:

```
┌─────────────────────────────────────────┐
│ 칭호 수동 박탈 — 깐부X                  │
├─────────────────────────────────────────┤
│ ⚠️ 박탈은 되돌릴 수 있지만 주의 필요     │
│                                         │
│ 보유 칭호에서 선택:                      │
│   ☐ 🔰 새싹 작가                         │
│   ☑ 🔥 첫 화제                           │
│   ☐ 🤝 사교의 달인                       │
│                                         │
│ 박탈 유형:                               │
│   ○ hide (대표에서만 제거, 복구 가능)    │
│   ● revoke (완전 박탈)                   │
│                                         │
│ 사유 (필수, 500자):                      │
│ ┌───────────────────────────────────┐  │
│ │ 어뷰징 확인, 조건 충족하지 않음     │  │
│ └───────────────────────────────────┘  │
│                                         │
│ [ 취소 ]    [ 박탈 실행 ]               │
└─────────────────────────────────────────┘
```

### 6.6 abuseFlags 수동 설정/해제

**경로**: Admin Dashboard → 유저 상세 → abuseFlags 관리

**UI**:

```
┌─────────────────────────────────────────┐
│ abuseFlags 관리 — 깐부X                 │
├─────────────────────────────────────────┤
│ 현재 플래그:                             │
│   ☐ shortPostSpam (-500 평판)           │
│   ☐ circularThanksball (-300)           │
│   ☐ multiAccount (-1000)                │
│   ☐ massFollowUnfollow (-200)           │
│                                         │
│ 설정할 플래그:                           │
│   ☑ shortPostSpam                       │
│   ☑ circularThanksball                  │
│   ☐ multiAccount                        │
│   ☐ massFollowUnfollow                  │
│                                         │
│ 예상 평판 변화:                          │
│   현재: 2,500                            │
│   플래그 적용 후: 2,500 - 800 = 1,700    │
│                                         │
│ 사유:                                    │
│ ┌───────────────────────────────────┐  │
│ │ 탐지 CF 결과 수동 확인, 설정        │  │
│ └───────────────────────────────────┘  │
│                                         │
│ ☐ Creator Score도 재계산 트리거          │
│                                         │
│ [ 취소 ]    [ 적용 ]                    │
└─────────────────────────────────────────┘
```

### 6.7 Grandfathered 지위 수동 부여

**출처**: `REPUTATION_V2.md §4.5`, `TUNING_SCHEDULE.md §4.5`

**목적**: 경계값 조정으로 강등된 기존 달성자 보호.

**UI**:

```
┌─────────────────────────────────────────┐
│ Grandfathered 지위 부여                 │
├─────────────────────────────────────────┤
│ 유저: 깐부10호                           │
│ 현재 평판: 9,500 (확고)                  │
│ 과거 달성 최고: 전설 (14,500, 2026-06)   │
│                                         │
│ 부여할 지위:                             │
│   ● grandfatheredPrestigeTier = 'legend'│
│                                         │
│ 사유:                                    │
│ ┌───────────────────────────────────┐  │
│ │ 2026년 경계값 조정으로 강등된       │  │
│ │ 기존 전설 달성자, 복구 필요.         │  │
│ └───────────────────────────────────┘  │
│                                         │
│ ☑ 유저에게 안내 알림                     │
│                                         │
│ [ 취소 ]    [ 부여 ]                    │
└─────────────────────────────────────────┘
```

### 6.8 일괄 조정

**용도**: 이벤트 보상, 버그 보상, 시스템 마이그레이션 등 대량 조정.

**경로**: Admin Dashboard → 일괄 조정 (Owner 전용)

**UI**:

```
┌─────────────────────────────────────────┐
│ 일괄 조정 (Owner 전용)                   │
├─────────────────────────────────────────┤
│                                         │
│ 대상 선택:                               │
│   ● UID 목록 (CSV 업로드)                │
│   ○ 쿼리 (예: Lv5 이상 & 평판 우호)     │
│                                         │
│ 업로드 파일: affected_users.csv          │
│   (125명)                                │
│                                         │
│ 조정 액션:                               │
│   ● EXP 가산                             │
│   ○ 평판 가산                            │
│   ○ 땡스볼 지급                          │
│   ○ 칭호 부여                            │
│                                         │
│ 값: [+100 EXP]                          │
│                                         │
│ 사유:                                    │
│ ┌───────────────────────────────────┐  │
│ │ 2026-04-20 버그로 EXP 누락 보상     │  │
│ └───────────────────────────────────┘  │
│                                         │
│ ⚠️ 이 작업은 125명의 데이터를 변경합니다 │
│                                         │
│ ☑ Dry run (실제 변경 없이 예상치만 표시) │
│                                         │
│ [ 취소 ]    [ 실행 ]                    │
└─────────────────────────────────────────┘
```

**안전 장치**:
- Dry run 기본값
- 100명 이상 대상 시 Owner 재확인
- 모든 조정이 개별 `admin_actions`로 기록 (롤백 가능)
- 트랜잭션 실패 시 전체 롤백

**CF 배치 로직**:

```javascript
exports.batchAdjust = onCall({...}, async (req) => {
  const claims = req.auth?.token;

  if (!isOwner(claims)) {
    throw new HttpsError('permission-denied', 'Owner only');
  }

  const { targetUids, action, value, reason, dryRun } = req.data;

  if (targetUids.length > 1000) {
    throw new HttpsError('invalid-argument', 'Max 1000 users per batch');
  }

  if (dryRun) {
    return { estimatedChanges: targetUids.length, preview: [...] };
  }

  const batchId = `batch_${Date.now()}`;
  const results = [];

  for (const uid of targetUids) {
    try {
      // 개별 조정
      await performSingleAdjust(uid, action, value);

      // 개별 로그 (batchId 포함)
      await db.collection('admin_actions').add({
        adminUid: req.auth.uid,
        adminRole: claims.role,
        action: `batch_${action}`,
        targetUid: uid,
        details: { value, batchId },
        reason,
        canRollback: true,
        createdAt: FieldValue.serverTimestamp(),
      });

      results.push({ uid, success: true });
    } catch (err) {
      results.push({ uid, success: false, error: err.message });
    }
  }

  return { success: true, batchId, results };
});
```

---

## 7. 콘텐츠 관리

### 7.1 콘텐츠 종류

글러브의 콘텐츠 유형 (관리 대상):

| 유형 | 컬렉션 | 삭제 권한 |
|------|:------:|:---------:|
| 일반 글 | `posts` | 작성자 + Moderator 이상 |
| 헨젤의 빵부스러기 | `carousels` | 작성자 + Moderator |
| 거대나무 글 | `tree_posts` | 작성자 + Moderator |
| 잉크병 연재 | `inkwells` | 작성자 + Admin (유료 고려) |
| 강변시장 가판대 | `market_stalls` | 작성자 + Admin (거래 고려) |
| 댓글 | `comments` | 작성자 + Moderator |
| 공유 | `shares` | 작성자 (Moderator 불가) |
| 라이브 방송 | `live_sessions` | 호스트 + Admin |
| 깐부방 글 | `kanbu_rooms/{}/posts` | 호스트 + Admin |

### 7.2 삭제 vs 블라인드

**삭제 (hard delete)**:
- 문서 완전 제거
- 되돌릴 수 없음 (백업에서만 복구)
- 어뷰저 유해 콘텐츠에만 적용

**블라인드 (soft delete)**:
- `blindedAt`, `blindedBy`, `blindReason` 필드 설정
- UI에서 "차단된 콘텐츠입니다" 표시
- 되돌리기 가능 (unblind)
- 관리자 조치 표준

### 7.3 삭제 UI

**경로**: 관리자가 임의 콘텐츠 우측 상단 메뉴 → "관리자 조치"

```
┌─────────────────────────────────────────┐
│ 관리자 조치 — 댓글 #abc123              │
├─────────────────────────────────────────┤
│                                         │
│ 내용:                                    │
│ ┌───────────────────────────────────┐  │
│ │ (문제의 댓글 내용)                  │  │
│ └───────────────────────────────────┘  │
│                                         │
│ 작성자: 깐부X                           │
│ 작성일: 2026-04-20                       │
│                                         │
│ 조치:                                    │
│   ● 블라인드 (권장)                      │
│   ○ 완전 삭제 (주의)                     │
│                                         │
│ 사유:                                    │
│   ○ 스팸                                 │
│   ● 욕설/비속어                          │
│   ○ 개인정보 유출                        │
│   ○ 저작권 침해                          │
│   ○ 기타                                 │
│                                         │
│ 상세 사유 (200자):                       │
│ ┌───────────────────────────────────┐  │
│ │ 반복 비속어                         │  │
│ └───────────────────────────────────┘  │
│                                         │
│ ☑ 작성자에게 경고 발급                    │
│                                         │
│ [ 취소 ]    [ 조치 실행 ]               │
└─────────────────────────────────────────┘
```

### 7.4 블라인드 CF

```javascript
exports.blindContent = onCall({...}, async (req) => {
  const claims = req.auth?.token;

  if (!isModerator(claims)) {
    throw new HttpsError('permission-denied', 'Moderator or higher');
  }

  const { contentType, contentId, category, reason, issueWarning } = req.data;

  const collectionName = getCollectionName(contentType);
  const contentRef = db.collection(collectionName).doc(contentId);
  const contentDoc = await contentRef.get();
  const authorUid = contentDoc.data().authorUid;

  await contentRef.update({
    blindedAt: FieldValue.serverTimestamp(),
    blindedBy: req.auth.uid,
    blindReason: reason,
    blindCategory: category,
  });

  // 경고 발급 (옵션)
  if (issueWarning) {
    await issueWarningInternal(authorUid, `콘텐츠 제재: ${reason}`);
  }

  // 감사 로그
  await db.collection('admin_actions').add({
    adminUid: req.auth.uid,
    adminRole: claims.role,
    action: 'blind_content',
    targetUid: authorUid,
    targetType: contentType,
    targetId: contentId,
    details: { category, issueWarning },
    reason,
    canRollback: true,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: Timestamp.fromMillis(Date.now() + 1095 * 24 * 60 * 60 * 1000),
  });

  return { success: true };
});
```

### 7.5 블라인드 해제 (Unblind)

**UI**:

```
┌─────────────────────────────────────────┐
│ 블라인드 해제 — 댓글 #abc123            │
├─────────────────────────────────────────┤
│ 현재: 블라인드 상태                      │
│ 블라인드 일시: 2026-04-20 14:32         │
│ 블라인드 사유: "반복 비속어"             │
│ 블라인드 관리자: 홍길동 (Moderator)      │
│                                         │
│ 해제 사유:                               │
│ ┌───────────────────────────────────┐  │
│ │ 재검토 결과 문제 없음               │  │
│ └───────────────────────────────────┘  │
│                                         │
│ ☑ 이전 경고도 철회                       │
│                                         │
│ [ 취소 ]    [ 해제 ]                    │
└─────────────────────────────────────────┘
```

### 7.6 유저의 모든 콘텐츠 일괄 블라인드

**용도**: 사약 집행 시 자동 실행되는 기능.

**수동 실행 경로**: 유저 상세 → "모든 콘텐츠 블라인드"

**⚠️ Admin 이상 권한 필요**

```javascript
exports.blindAllUserContent = onCall({...}, async (req) => {
  const claims = req.auth?.token;

  if (!isAdmin(claims)) {
    throw new HttpsError('permission-denied', 'Admin only');
  }

  const { targetUid, reason } = req.data;

  const contentTypes = ['posts', 'comments', 'carousels', 'tree_posts', ...];
  let totalBlinded = 0;

  for (const collection of contentTypes) {
    const snap = await db.collection(collection)
      .where('authorUid', '==', targetUid)
      .where('blindedAt', '==', null)
      .get();

    const batch = db.batch();
    snap.docs.forEach(doc => {
      batch.update(doc.ref, {
        blindedAt: FieldValue.serverTimestamp(),
        blindedBy: req.auth.uid,
        blindReason: reason,
        blindCategory: 'bulk_action',
      });
      totalBlinded++;
    });
    await batch.commit();
  }

  // 감사 로그
  await db.collection('admin_actions').add({
    adminUid: req.auth.uid,
    adminRole: claims.role,
    action: 'blind_all_content',
    targetUid,
    details: { totalBlinded },
    reason,
    canRollback: true,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: null,
  });

  return { success: true, totalBlinded };
});
```

### 7.7 콘텐츠 재공개 (사용자 요청 시)

**시나리오**: 유배 해제 후 유저가 "내 글 복원" 요청.

**CF** (`unblindAllUserContent`):
- 블라인드 해제 (user_requested 카테고리만)
- 관리자가 수동으로 블라인드한 것은 유지
- Admin 권한 필요

### 7.8 콘텐츠 삭제 대시보드

**경로**: Admin Dashboard → 콘텐츠 관리

**탭**:

**탭 1: 최근 블라인드**
```
콘텐츠    | 유형 | 작성자   | 블라인드 일시 | 처리자 | 사유
---------|------|---------|---------------|--------|------
#abc123  | 댓글 | 깐부X    | 2026-04-20    | 홍길동 | 욕설
```

**탭 2: 블라인드된 유저 (상위 10)**
```
유저     | 블라인드 수 | 마지막 블라인드
--------|-------------|-----------------
깐부X    | 15건        | 2026-04-20
깐부Y    | 8건         | 2026-04-18
```

**탭 3: 복원 요청 큐 (Phase B 후반)**
```
유저     | 요청일자     | 콘텐츠 ID   | 상태     | 처리
--------|-------------|-------------|----------|------
깐부5호  | 2026-04-19  | #def456     | 대기 중  | [검토]
```

---
## 8. 닉네임 수동 변경

### 8.1 배경

**출처**: `GLOVE_SYSTEM_REDESIGN_v2.md §5.3.5`, `PRICING.md §8`, `ANTI_ABUSE.md §8`

**v2 확정 정책**:
- 유저 자발적 변경: 평생 1회, **100볼(10,000원)**
- **관리자 수동 변경**: 특수 사유 시 `nicknameChangeCount` 증가 없이 변경

### 8.2 수동 변경 필요 사유

**인정되는 사유**:
1. **신변 위협**: 스토커/가해자가 닉네임으로 유저 추적
2. **개인정보 유출**: 실명이 닉네임에 포함된 경우
3. **명예훼손**: 제3자가 유저 닉네임을 모욕적 이름으로 표기 (댓글/외부 등)
4. **예약 닉네임 회수**: 관리자가 예약한 닉네임 해제 시 해당 유저 강제 변경
5. **기술적 오류**: 인코딩 오류, 중복 등 시스템 문제

**인정되지 않는 사유**:
- 단순 취향 변경 (유저가 100볼 내고 직접)
- 유료 변경 회피 목적
- 어뷰징 직후 세탁 목적 (`ANTI_ABUSE.md §8 시나리오 5` 방어)

### 8.3 수동 변경 UI

**경로**: Admin Dashboard → 유저 상세 → 닉네임 관리

```
┌─────────────────────────────────────────────┐
│ 닉네임 수동 변경 — 깐부5호                  │
├─────────────────────────────────────────────┤
│                                             │
│ 현재 닉네임: 깐부5호                         │
│ 닉네임 변경 이력:                            │
│   · 없음 (자발적 0회 사용)                   │
│                                             │
│ 새 닉네임: [                        ]       │
│   (2-20자, 한글/영문/숫자/특수기호 일부)     │
│                                             │
│ 중복 확인: ✅ 사용 가능                      │
│                                             │
│ 사유 (필수):                                 │
│   ● 신변 위협 (스토킹)                       │
│   ○ 개인정보 유출                            │
│   ○ 명예훼손                                 │
│   ○ 예약 닉네임 회수                         │
│   ○ 기술 오류                                │
│   ○ 기타                                     │
│                                             │
│ 상세 사유 (500자):                           │
│ ┌─────────────────────────────────────┐    │
│ │ 2026-04-18 유저 제보: 전 배우자가     │    │
│ │ 닉네임으로 추적 중. 즉시 변경 필요.    │    │
│ │ 증거: DM 캡처 3장 (파일 첨부)          │    │
│ └─────────────────────────────────────┘    │
│                                             │
│ 증거 첨부 (URL):                             │
│ ┌─────────────────────────────────────┐    │
│ │ stalking_evidence_1.png              │    │
│ │ stalking_evidence_2.png              │    │
│ └─────────────────────────────────────┘    │
│                                             │
│ ☑ nicknameChangeCount 증가 없음              │
│ ☑ 이전 닉네임 "깐부5호" 예약 (재사용 차단)    │
│ ☑ 유저에게 변경 알림                         │
│ ☐ 이전 닉네임 검색 이력 삭제 (Phase C)       │
│                                             │
│ [ 취소 ]    [ 변경 실행 ]                   │
└─────────────────────────────────────────────┘
```

### 8.4 CF 구현

```javascript
exports.adminChangeNickname = onCall({...}, async (req) => {
  const claims = req.auth?.token;

  if (!isAdmin(claims)) {
    throw new HttpsError('permission-denied', 'Admin only');
  }

  const {
    targetUid,
    newNickname,
    reason,
    detailReason,
    evidence,
    reservePrevious,
    notifyUser,
  } = req.data;

  const userRef = db.collection('users').doc(targetUid);
  const userDoc = await userRef.get();
  const beforeState = userDoc.data();
  const previousNickname = beforeState.nickname;

  // 1. 새 닉네임 중복 검사
  const existingSnap = await db.collection('users')
    .where('nickname', '==', newNickname)
    .limit(1)
    .get();
  if (!existingSnap.empty) {
    throw new HttpsError('already-exists', 'Nickname taken');
  }

  // 2. 예약 닉네임 검사
  const reservedDoc = await db.collection('reserved_nicknames').doc(newNickname).get();
  if (reservedDoc.exists) {
    throw new HttpsError('already-exists', 'Nickname reserved');
  }

  await db.runTransaction(async (tx) => {
    // 3. 닉네임 변경 (nicknameChangeCount 증가 없음)
    tx.update(userRef, {
      nickname: newNickname,
      previousNicknames: FieldValue.arrayUnion(previousNickname),
      nicknameChangedAt: FieldValue.serverTimestamp(),
      // nicknameChangeCount: 그대로 (증가 X)
    });

    // 4. nickname_{old} 문서 삭제, nickname_{new} 생성
    tx.delete(db.collection('users').doc(`nickname_${previousNickname}`));
    tx.set(db.collection('users').doc(`nickname_${newNickname}`), {
      uid: targetUid,
      reservedAt: FieldValue.serverTimestamp(),
    });

    // 5. (옵션) 이전 닉네임 예약
    if (reservePrevious) {
      tx.set(db.collection('reserved_nicknames').doc(previousNickname), {
        originalUid: targetUid,
        reservedAt: FieldValue.serverTimestamp(),
        reservedReason: 'admin_lock',
        reservedBy: req.auth.uid,
      });
    }
  });

  // 6. 감사 로그 (5년 보존)
  await db.collection('admin_actions').add({
    adminUid: req.auth.uid,
    adminRole: claims.role,
    action: 'change_nickname',
    targetUid,
    targetType: 'user',
    details: {
      oldNickname: previousNickname,
      newNickname,
      reason,
      evidence,
      reservePrevious,
    },
    reason: detailReason,
    beforeState: { nickname: previousNickname },
    afterState: { nickname: newNickname },
    canRollback: true,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: Timestamp.fromMillis(Date.now() + 1825 * 24 * 60 * 60 * 1000),
  });

  // 7. sanction_log 기록 (ANTI_ABUSE §8 준수)
  await db.collection('sanction_log').add({
    uid: targetUid,
    type: 'nickname_change_admin',
    oldValue: previousNickname,
    newValue: newNickname,
    reason: detailReason,
    adminUid: req.auth.uid,
    createdAt: FieldValue.serverTimestamp(),
  });

  // 8. 유저 알림
  if (notifyUser) {
    await db.collection('notifications').add({
      uid: targetUid,
      type: 'nickname_changed_by_admin',
      data: {
        oldNickname: previousNickname,
        newNickname,
        reason,
      },
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  return { success: true, newNickname };
});
```

### 8.5 예약 닉네임 관리

**경로**: Admin Dashboard → 예약 닉네임

**목적**:
- 유배자 재가입 방어 (이전 닉네임 예약)
- 브랜드 보호 (공식 닉네임 예약: "admin", "official", "glove" 등)
- 기술 예약 (시스템 메시지 발신자 등)

**UI**:

```
┌────────────────────────────────────────────────┐
│ 🔒 예약 닉네임 관리                             │
├────────────────────────────────────────────────┤
│                                                │
│ [+ 닉네임 예약]                                 │
│                                                │
│ 검색: [                ]                        │
│                                                │
│ 닉네임       | 사유           | 예약일    | 조치 │
│ ─────────────────────────────────────────────  │
│ admin        | admin_lock    | 2026-01-01 | 유지 │
│ official     | admin_lock    | 2026-01-01 | 유지 │
│ 깐부5호      | user_change   | 2026-04-20 | 해제 │
│ 악플왕       | admin_lock    | 2026-03-15 | 유지 │
└────────────────────────────────────────────────┘
```

**예약 CF**:

```javascript
exports.reserveNickname = onCall({...}, async (req) => {
  if (!isAdmin(req.auth?.token)) {
    throw new HttpsError('permission-denied', 'Admin only');
  }

  const { nickname, reason } = req.data;

  // 이미 사용 중인지 확인
  const usedSnap = await db.collection('users')
    .where('nickname', '==', nickname)
    .limit(1)
    .get();
  if (!usedSnap.empty) {
    throw new HttpsError('failed-precondition', 'In use by user');
  }

  await db.collection('reserved_nicknames').doc(nickname).set({
    originalUid: null,
    reservedAt: FieldValue.serverTimestamp(),
    reservedReason: 'admin_lock',
    reservedBy: req.auth.uid,
    reason,
  });

  return { success: true };
});
```

---

## 9. 회원가입/인증 운영

> 기반 정책: 메모리 기록된 **옵션 A** (소셜 로그인만 + 단계별 Tier T1/T2/T3)

### 9.1 정책 요약

**v2 확정 (옵션 A)**:

| 인증 단계 | 필수 요건 | Tier | 권한 |
|:--------:|-----------|:----:|------|
| Step 1 | 소셜 로그인 | **T1** | 글읽기/쓰기/깐부/무료기능 |
| Step 2 | + 휴대폰 본인인증 | **T2** | + 땡스볼 수신·주주방·라이브 호스트 |
| Step 3 | + 신용카드 등록 | **T3** | + 땡스볼 충전·광고·잉크병 유료 |

**소셜 로그인 공급자**:
- **베타 (Phase B)**: Google + Apple
- **정식 (Phase C)**: + Kakao + Naver

**해외 사용자**: T1 고정 (T2/T3은 한국 휴대폰 인증 필요)

**T2/T3 구현 시점**:
- **베타**: UI 플레이스홀더만 (기능 미작동)
- **정식**: PortOne PG 연동과 동시 실제 작동

### 9.2 🔑 결정 D4: 베타 플레이스홀더 UX 방식

**배경**: Phase B에서 T2/T3 기능 필요 시점에, 실제 연동은 Phase C. 그 간극을 어떻게 채울 것인가?

#### 9.2.1 대안 D4-α: 노출만 (회색 처리)

**방식**: 버튼 존재하되 비활성화 + 툴팁 "정식 출시 후 제공".

**장점**:
- 극단적 단순
- 오해 방지

**단점**:
- 유저 이탈 위험 (뭐야 안 돼?)
- 관심 측정 불가

#### 9.2.2 대안 D4-β: 동작 흉내 + "출시 예정" 안내 (**추천**)

**방식**:
- 유저가 "휴대폰 인증" / "카드 등록" 누름
- 모달 표시: "휴대폰 인증 기능은 2026년 하반기 출시 예정입니다. 미리 알림 받기?"
- 이메일/알림 대기 목록 등록
- T2/T3 출시 시 자동 알림

**장점**:
- 유저 기대 관리
- 출시 시 알림 대상 확보
- 관심도 측정 (대기 등록자 수)

**단점**:
- 구현 필요 (대기 목록 컬렉션)
- 알림 시스템 연동

#### 9.2.3 대안 D4-γ: 별도 페이지 ("로드맵")

**방식**: 메뉴에 "로드맵" 페이지 추가, 출시 예정 기능 전체 공개.

**장점**:
- 투명성
- 전체 비전 공유

**단점**:
- 맥락 부재 (T2/T3 누른 사람에게 맥락 없이 페이지 이동)
- 로드맵 최신화 부담

#### 9.2.4 비교 매트릭스

| 기준 | α 노출만 | **β 흉내+대기 (추천)** | γ 로드맵 |
|------|:--------:|:-----------------------:|:--------:|
| 구현 복잡도 | ⭐ | ⭐⭐⭐ | ⭐⭐ |
| 유저 경험 | ⭐ | ⭐⭐⭐ | ⭐⭐ |
| 관심도 측정 | ❌ | ✅ | 부분 |
| 출시 시 활용 | ❌ | ✅ (알림) | 부분 |
| 투명성 | 낮음 | 중간 | 높음 |

#### 9.2.5 추천 — 대안 D4-β

**근거**:
1. Phase B→C 전환 시 타겟팅 알림 가능
2. 관심도에 따라 개발 우선순위 조정 가능
3. 유저 이탈 방지

**구현**:

```typescript
// src/components/VerificationPlaceholder.tsx

<Button onClick={() => setShowWaitlistModal(true)} disabled>
  휴대폰 인증 🕐 출시 예정
</Button>

<Modal open={showWaitlistModal}>
  <h3>휴대폰 인증 기능</h3>
  <p>
    정식 출시와 함께 2026년 하반기에 제공됩니다.
  </p>
  <p>
    휴대폰 인증 후 이용 가능한 기능:
    - 땡스볼 수신
    - 주주방 참여
    - 라이브 호스트
  </p>
  <Button onClick={joinWaitlist}>
    출시 알림 받기
  </Button>
</Modal>
```

**데이터 모델**:

```typescript
interface VerificationWaitlist {
  uid: string;
  type: 't2_phone' | 't3_payment';
  requestedAt: FirestoreTimestamp;
  notifiedAt?: FirestoreTimestamp;
  notificationMethod: 'email' | 'in_app' | 'both';
}
```

### 9.3 회원가입 플로우 (Phase B)

**4단계 플로우**:

```
┌─────────────────┐
│  Step 1: 시작   │
│  [Google 로그인]│
│  [Apple 로그인]│
└────────┬────────┘
         ↓
┌─────────────────┐
│ Step 2: 닉네임  │
│ [           ]  │
│  중복 확인 ✓   │
└────────┬────────┘
         ↓
┌─────────────────┐
│ Step 3: 언어     │
│  ○ 한국어        │
│  ○ English (C)   │
└────────┬────────┘
         ↓
┌─────────────────┐
│ Step 4: 환영!    │
│  [홈으로]        │
└─────────────────┘
```

**각 단계 저장 필드**:

```typescript
interface UserData {
  // Step 1
  uid: string;
  email: string;
  provider: 'google' | 'apple' | 'kakao' | 'naver';
  createdAt: FirestoreTimestamp;

  // Step 2
  nickname: string;
  nicknameChangeCount: 0;

  // Step 3
  preferredLanguage: 'ko' | 'en' | 'ja' | 'es';
  country?: string;  // IP 기반 자동 감지

  // 🆕 Tier (옵션 A)
  tier: 'T1' | 'T2' | 'T3';  // 초기값 T1
  verifications?: {
    phone?: {
      verifiedAt: FirestoreTimestamp;
      phoneHash: string;  // HMAC-SHA256
    };
    payment?: {
      verifiedAt: FirestoreTimestamp;
      pgProvider: 'portone';
      // 카드 번호 저장 X (PG에 위임)
    };
  };

  // 관리자 자동 기본값
  sanctionStatus: 'clean';
  level: 1;
  exp: 0;

  // ...
}
```

### 9.4 관리자 회원 관리 UI

**경로**: Admin Dashboard → 유저 관리

**기능**:
- UID / 닉네임 / 이메일 검색
- Tier 필터 (T1/T2/T3)
- 국가 필터
- 가입일 범위
- 정렬 (가입일/활동일/레벨/평판/Creator Score)

**목록 뷰**:

```
유저        | Tier | Lv | 평판    | Score | 가입일      | 최근활동 | 상태
-----------|------|-----|---------|-------|-------------|----------|------
깐부5호    | T2   | 5   | 우호    | 1.35  | 2026-03-01  | 2시간 전 | 🟢
깐부X      | T1   | 3   | 중립    | 0.45  | 2026-04-10  | 1일 전   | 🟡 경고2회
```

**개별 유저 상세 뷰**:
- 기본 정보 (UID, 이메일, Tier, 가입일)
- 활동 그래프 (30일)
- 현재 지표 (Lv/평판/Score/마패/칭호)
- 제재 이력 (§5.7)
- 관리자 조치 버튼 (유배/수동조정/닉네임 변경 등)

### 9.5 Tier 강제 조정 (관리자)

**용도**: 특수 파트너에게 T3 즉시 부여, 오판정 Tier 복구 등.

**UI**:

```
┌─────────────────────────────────────────┐
│ Tier 강제 조정 — 파트너A                │
├─────────────────────────────────────────┤
│ 현재 Tier: T1                            │
│                                         │
│ 새 Tier:                                 │
│   ○ T1 (소셜만)                          │
│   ○ T2 (+ 휴대폰 인증)                   │
│   ● T3 (+ 결제 수단) — 수동 부여         │
│                                         │
│ ⚠️ T3는 유료 기능(광고, 잉크병, 땡스볼   │
│    충전)을 활성화합니다.                 │
│                                         │
│ 사유 (필수):                             │
│ ┌───────────────────────────────────┐  │
│ │ 2026-04 공식 파트너십 체결          │  │
│ │ 플랫폼 수익 쉐어 50%.                │  │
│ └───────────────────────────────────┘  │
│                                         │
│ ☑ verifications.phone 플래그 자동 설정  │
│ ☑ verifications.payment 플래그 자동 설정 │
│                                         │
│ [ 취소 ]    [ 강제 부여 ]               │
└─────────────────────────────────────────┘
```

**주의**:
- Owner 전용 (Admin 불가)
- 실제 인증 정보가 없음을 주의 (법적 계약서로 보완)
- 감사 로그 영구 보존

### 9.6 가입 통계 대시보드

**경로**: Admin Dashboard → 회원가입 통계

**그래프**:
- 일별 신규 가입 (30일/90일/1년)
- Tier 전환율 (T1→T2, T2→T3)
- 공급자별 분포 (Google/Apple/Kakao/Naver)
- 국가별 분포
- 평균 초기 활동 (가입 후 7일 내 유효 글 작성률 등)

---

## 10. 경제 시스템 운영

> 글러브는 복합 경제 플랫폼. 광고, 강변시장, 잉크병, 깐부방, 라이브, 정보봇 등 다양한 수익 경로 존재. 각각의 운영 기능을 통합.

### 10.1 광고 경매 (ADSMARKET)

**출처**: `PRICING.md §6`, `LEVEL_V2 §1.4`, `GLOVE_SYSTEM_REDESIGN_v2 §6`

#### 10.1.1 광고 경매 구조 요약

- 광고주 결제: **원화 기반** (볼 아님)
- 경매 단위: CPM / CPC
- 작성자 수익 쉐어:
  - Lv5-6: 30% (bottom slot만)
  - Lv7-8: 50% (top, bottom)
  - Lv9-10: 70% (top, middle, bottom)
- 최소 출금: 30,000원 (300볼 상당)

#### 10.1.2 광고주 관리 UI

**경로**: Admin Dashboard → 광고 → 광고주 관리

**기능**:
- 광고주 등록 (이름, 사업자번호, 이메일, 담당자)
- 예치금 관리
- 광고 이력 조회
- 부정클릭 이력 조회

**목록**:

```
광고주        | 예치금       | 활성 광고 | 총 집행액    | 상태
-------------|--------------|-----------|--------------|-------
OOO 기업     | 1,500,000원 | 3개        | 3,200,000원  | 활성
XXX 주식회사 | 0원          | 0개        | 800,000원    | 정지
```

#### 10.1.3 광고 승인/거부

**경로**: Admin Dashboard → 광고 → 승인 큐

**UI**:

```
┌─────────────────────────────────────────────┐
│ 광고 검토 — AD_20260420_001                 │
├─────────────────────────────────────────────┤
│                                             │
│ 광고주: OOO 기업                            │
│ 캠페인명: 봄 신상품 프로모션                 │
│ 입찰가: 5,000원/CPM                         │
│ 예산: 500,000원                              │
│ 기간: 2026-04-22 ~ 2026-05-22               │
│ 타겟팅: 전체                                 │
│                                             │
│ 크리에이티브:                                 │
│ [이미지 썸네일]                              │
│ 제목: "2026 봄 신상 30% 할인"                │
│ 설명: "...지금 바로 확인"                    │
│ 랜딩 URL: https://ooo.com/spring             │
│                                             │
│ 자동 검증:                                   │
│   ✓ URL 도달 가능                            │
│   ✓ 악성코드 없음 (외부 API 검사)            │
│   ✓ HTTPS 적용                              │
│                                             │
│ 관리자 검토 항목:                            │
│   ☑ 이미지 부적절 콘텐츠 없음                │
│   ☑ 문구 허위·과장 광고 없음                 │
│   ☑ 랜딩 페이지 약관 준수                    │
│                                             │
│ 판정:                                         │
│   ● 승인                                      │
│   ○ 거부 (사유 필요)                          │
│   ○ 수정 요청 (메시지)                        │
│                                             │
│ [ 취소 ]        [ 실행 ]                    │
└─────────────────────────────────────────────┘
```

#### 10.1.4 부정클릭 대응

**CF 상태**: `detectFraud` 존재 (ANTI_ABUSE.md 언급)

**대응 UI**:

```
┌──────────────────────────────────────────────┐
│ 🚨 부정클릭 감지 — AD_20260420_001           │
├──────────────────────────────────────────────┤
│                                              │
│ 감지 시각: 2026-04-20 15:30                  │
│ 감지 유형: 반복 IP 클릭 (동일 IP 100회/분)   │
│                                              │
│ 증거:                                         │
│   · IP: 1.2.3.4 (100회)                       │
│   · User-Agent: Bot (의심)                    │
│   · Referer: 없음                             │
│                                              │
│ 자동 조치:                                    │
│   ✓ 해당 IP 차단                              │
│   ✓ 해당 클릭 수익 환불                       │
│                                              │
│ 추가 관리자 조치:                             │
│   ☐ 광고주에게 통보                           │
│   ☐ 광고주 계정 정지 검토                    │
│                                              │
│ [ 확인 ]                                      │
└──────────────────────────────────────────────┘
```

#### 10.1.5 광고 경매 대시보드

**경로**: Admin Dashboard → 광고 → 경매 현황

**그래프**:
- 일별 총 노출 (CPM)
- 일별 총 클릭 (CPC)
- 일별 수익 (광고주 결제 총액)
- 작성자 수익 분배 (Lv5-6 / 7-8 / 9-10 비율)
- 부정클릭 발생률
- 평균 낙찰가

**예시 테이블**:

```
날짜       | 노출       | 클릭   | 수익         | 작성자 몫   | 플랫폼 몫
----------|------------|--------|--------------|-------------|-----------
2026-04-20 | 1,234,567  | 8,901  | 2,500,000원  | 1,200,000원 | 1,300,000원
```

#### 10.1.6 광고 자격 게이트 (Phase C)

`CREATOR_SCORE.md §10.4` 참조:
```typescript
// 광고 수익 출금 자격
export const canWithdrawRevenue = (user: UserData): boolean => {
  return useCreatorScore(user) >= 1.0;
};
```

**관리자 UI**: 출금 불가 사유 확인
```
깐부X의 수익 출금 시도 → 거부 (Creator Score 0.4 < 1.0)
  [사유: Creator Score 미달]
  [관리자 오버라이드]  (Owner 전용)
```

### 10.2 수익 정산/출금 승인

#### 10.2.1 출금 플로우

**유저 측 플로우**:
```
유저 [수익 확인] → [출금 요청]
     ↓
pendingRevenue → SettlementQueue
     ↓
관리자 승인/거부
     ↓ (승인 시)
원천세 차감 → 지급 처리
     ↓
settled_payouts 기록
```

**원천세**:
- 사업자: 3.3%
- 개인 (기타소득): 8.8%

**최소 출금**: 30,000원 (300볼 상당)

#### 10.2.2 출금 승인 큐

**경로**: Admin Dashboard → 수익 → 출금 승인

**목록**:

```
요청일      | 유저      | 금액         | 유형   | 자격  | 상태     | 조치
----------|-----------|--------------|--------|-------|----------|------
2026-04-20 | 깐부5호   | 50,000원     | 개인   | ✅    | 대기     | [승인]
2026-04-20 | 깐부7호   | 120,000원    | 사업자 | ✅    | 대기     | [승인]
2026-04-19 | 깐부X     | 35,000원     | 개인   | ❌    | 보류     | [확인]
```

**승인 UI**:

```
┌──────────────────────────────────────────────┐
│ 💰 출금 승인 — 깐부5호                        │
├──────────────────────────────────────────────┤
│                                              │
│ 요청 금액: 50,000원                           │
│ 수익 유형: 광고 경매 (3월 분)                  │
│                                              │
│ 자격 검증:                                    │
│   ✓ 최소 금액 ≥ 30,000원                     │
│   ✓ Creator Score 1.35 ≥ 1.0                │
│   ✓ 계좌 인증 완료 (PG 연동)                 │
│   ✓ 사기 이력 없음                            │
│                                              │
│ 원천세 계산:                                  │
│   유형: 개인 (기타소득)                       │
│   세율: 8.8%                                  │
│   세액: 4,400원                               │
│   실 지급: 45,600원                           │
│                                              │
│ 관리자 판정:                                  │
│   ● 승인                                      │
│   ○ 보류 (사유 필요)                          │
│   ○ 거부 (사유 필요)                          │
│                                              │
│ [ 취소 ]    [ 승인 실행 ]                    │
└──────────────────────────────────────────────┘
```

#### 10.2.3 출금 이력

**경로**: Admin Dashboard → 수익 → 이력

**필터**: 기간, 유저, 상태 (승인/보류/거부)

**Export**: CSV 다운로드 (회계용)

### 10.3 강변시장·잉크병·깐부방 관리

#### 10.3.1 강변시장

**출처**: `PRICING.md §3`

**운영 기능**:
- 가판대·단골장부 개설 승인 (Lv3+/Lv5+)
- 환불 처리 (구매자 요청 시)
- 부정 거래 감지
- 수수료 조회 (Lv3-4: 30%, Lv5-6: 25%, Lv7+: 20%)

**환불 UI**:

```
┌─────────────────────────────────────────┐
│ 💳 환불 요청 — TRANSACTION_20260420_001 │
├─────────────────────────────────────────┤
│ 구매자: 깐부3호                          │
│ 판매자: 깐부7호                          │
│ 금액: 5,000원 (50볼)                     │
│ 상품: "강변시장 단골장부 구독 1개월"     │
│ 요청 사유: "품질 불량"                   │
│                                         │
│ 판매자 응답: "동의함"                    │
│                                         │
│ 환불 처리:                               │
│   ○ 전액 (5,000원 환불)                 │
│   ● 부분 (3,000원 환불)                 │
│   ○ 거부 (사유 필요)                     │
│                                         │
│ [ 취소 ]    [ 환불 실행 ]               │
└─────────────────────────────────────────┘
```

#### 10.3.2 잉크병

**출처**: `PRICING.md §4`

**운영 기능**:
- 연재 승인 (개설 자격)
- 무단 복제 제보 대응 (ANTI_ABUSE §3.7)
- 수수료 11% 적용
- 구독 만료 관리

**무단 복제 대응**:
- 유저가 외부에서 연재 내용 복제 발견 시 제보
- 관리자가 확인 → 무단 복제자 유배 (ANTI_ABUSE §3.7 참조)
- DMCA takedown 대응 (외부 플랫폼)

#### 10.3.3 깐부방

**출처**: `KANBU_V2.md`, `GLOVE_v2 §1.2`

**운영 기능**:
- 깐부방 개설 기록
- 호스트 사칭 대응
- 유료 게시판 수수료 (강변시장과 동일: 30/25/20%)
- 라이브 방송 관리 (§10.4)

### 10.4 라이브·주주방·정보봇 관리

#### 10.4.1 라이브 방송

**출처**: `PRICING.md §1`, `GLOVE_v2 §1.2`

**운영 기능**:
- 라이브 방송 모니터링 (실시간 시청)
- 강제 종료 (부적절 콘텐츠 시)
- 땡스볼 VFX 관리
- 호스트 자격 (Phase C: Creator Score ≥ 0.5)

**긴급 종료 UI**:

```
┌─────────────────────────────────────────┐
│ ⚠️ 라이브 긴급 종료                      │
├─────────────────────────────────────────┤
│ 라이브 ID: LIVE_20260420_001             │
│ 호스트: 깐부X                            │
│ 시작: 14:30 (30분 경과)                  │
│ 현재 시청자: 45명                         │
│ 받은 땡스볼: 250볼                        │
│                                         │
│ 종료 사유:                               │
│   ○ 부적절 콘텐츠                        │
│   ● 유저 다수 신고                       │
│   ○ 기술 오류                            │
│                                         │
│ 상세:                                    │
│ ┌───────────────────────────────────┐  │
│ │ 시청자 12명이 욕설 관련 신고        │  │
│ └───────────────────────────────────┘  │
│                                         │
│ 부가 조치:                               │
│   ☑ 받은 땡스볼 시청자에게 환불          │
│   ☑ 호스트 경고 발급                     │
│   ☐ 라이브 녹화 증거 보존                │
│                                         │
│ [ 취소 ]    [ 강제 종료 ]               │
└─────────────────────────────────────────┘
```

#### 10.4.2 주주방

**출처**: `GLOVE_v2 §1.2`, 메모리

**운영 기능**:
- 주주 인증 관리 (Codef Mydata API)
- 티어 배지 (새우/상어/고래/대왕고래)
- 주주방 개설 자격 (`category === '주식'`만)
- 투표 가중치 관리 (×1/×3/×10/×30)
- 부정 인증 대응

**인증 관리 UI**:

```
┌──────────────────────────────────────────┐
│ 주주 인증 관리                            │
├──────────────────────────────────────────┤
│                                          │
│ 수동 인증 요청 (Codef 장애 시):           │
│                                          │
│ 유저        | 요청일    | 증권사 | 증빙    │
│ -----------|-----------|--------|-------- │
│ 깐부5호    | 2026-04-20| 키움   | 캡처1.png│
│ 깐부7호    | 2026-04-18| 삼성   | 캡처2.png│
│                                          │
│ [ 검토 ]                                  │
│                                          │
│ 자동 인증 통계:                           │
│   · 금일 성공: 45건                       │
│   · 금일 실패: 3건 (Codef 타임아웃)       │
│                                          │
│ 티어 분포:                                │
│   · 새우: 1,234명                         │
│   · 상어: 234명                           │
│   · 고래: 45명                            │
│   · 대왕고래: 3명                         │
└──────────────────────────────────────────┘
```

#### 10.4.3 정보봇

**출처**: `PRICING.md §7`

**운영 기능**:
- 정보봇 구독 관리 (월 20볼 = 2,000원)
- 플랫폼 수익 100% 회수
- 구독자 관리
- 콘텐츠 품질 검증 (정보봇 생성 글)

### 10.5 플랫폼 수익 조회

**경로**: Admin Dashboard → 경제 → 플랫폼 수익

**집계 카테고리** (`PRICING.md §9`):

```
platform_revenue/
  ├── ad_share          (광고 경매 플랫폼 몫)
  ├── market_fee        (강변시장 수수료 30/25/20%)
  ├── inkwell_fee       (잉크병 11%)
  ├── kanbu_room_fee    (깐부방 유료 30/25/20%)
  ├── nickname_change   (닉네임 변경 수수료 100볼/10,000원)
  ├── sanction_burn     (유배 속죄금 소각)
  ├── sayak_seized      (사약 자산 회수)
  └── infobot_sub       (정보봇 구독료 100%)
```

**대시보드 UI**:

```
┌────────────────────────────────────────────────┐
│ 📊 플랫폼 수익 (2026-04)                        │
├────────────────────────────────────────────────┤
│                                                │
│ 이번 달 총 수익: 15,234,000원                   │
│                                                │
│ 카테고리별:                                     │
│   광고 경매 플랫폼 몫: 8,500,000원 (56%)        │
│   강변시장 수수료:     2,300,000원 (15%)        │
│   잉크병 수수료:       1,800,000원 (12%)        │
│   깐부방 유료:         1,500,000원 (10%)        │
│   닉네임 변경:           450,000원 (3%)         │
│   정보봇 구독:           600,000원 (4%)         │
│                                                │
│ 비수익 (감사 용):                               │
│   속죄금 소각:           45,000원               │
│   사약 몰수:             245,000원              │
│                                                │
│ 전월 대비: +18% ↑                               │
│                                                │
│ [ 상세 보기 ]  [ CSV 다운로드 ]                 │
└────────────────────────────────────────────────┘
```

**일별 추이 그래프**: 30일/90일/1년 단위.

**유저당 평균 수익**:
- 광고 경매 참여 유저 평균 수익
- 강변시장 판매자 평균 수익
- 등등

### 10.6 땡스볼 감사 (연계)

**출처**: `ANTI_ABUSE.md §1.1.2`

**기존 CF**:
- `snapshotBallBalance` (04:00)
- `auditBallBalance` (04:30)

**관리자 감사 UI**:

```
┌──────────────────────────────────────────┐
│ ⚖️ 땡스볼 감사 (2026-04-20)               │
├──────────────────────────────────────────┤
│                                          │
│ 스냅샷 일시: 04:00 ✓                     │
│ 감사 일시: 04:30 ✓                       │
│                                          │
│ 총 발행량: 10,234,567볼                   │
│ 총 잔액: 10,234,567볼 ✓                  │
│ 차이: 0 ✓ 정상                           │
│                                          │
│ 이상치 (ball_balance_snapshots):          │
│   · 이상 감지 없음                         │
│                                          │
│ 의심 거래 (audit_anomalies):              │
│   · 맞땡스볼 의심: 2건 (검토 대기)         │
│   · 비정상 큰 송금: 0건                    │
│                                          │
│ [ 이상치 검토 ]                           │
└──────────────────────────────────────────┘
```

### 10.7 수수료 조정 (Owner 전용)

**경로**: Admin Dashboard → 경제 → 수수료 조정

**⚠️ Owner 전용**, 신중한 변경.

**UI**:

```
┌─────────────────────────────────────────┐
│ 📉 수수료 조정                           │
├─────────────────────────────────────────┤
│                                         │
│ 조정 대상:                               │
│   ● 강변시장 수수료                      │
│   ○ 잉크병 수수료                        │
│   ○ 깐부방 유료 수수료                   │
│   ○ 닉네임 변경 수수료                   │
│                                         │
│ 현재:                                    │
│   Lv3-4: 30%                            │
│   Lv5-6: 25%                            │
│   Lv7+: 20%                             │
│                                         │
│ 변경 후:                                 │
│   Lv3-4: [30] %                         │
│   Lv5-6: [23] %                         │
│   Lv7+: [18] %                          │
│                                         │
│ ⚠️ 주의:                                  │
│   · TUNING_SCHEDULE.md 준수              │
│   · 최소 3개월 간 유지 권장               │
│   · 기존 거래에는 거래 스냅샷 방식 적용    │
│                                         │
│ 사유 (필수, 500자):                      │
│ ┌───────────────────────────────────┐  │
│ │ 2026-Q2 경쟁 플랫폼 대비 수수료      │  │
│ │ 인하하여 크리에이터 유입 확대.        │  │
│ └───────────────────────────────────┘  │
│                                         │
│ 적용 일시: [2026-05-01 00:00 KST]       │
│                                         │
│ [ 취소 ]    [ 예약 적용 ]               │
└─────────────────────────────────────────┘
```

**CF 구현**:
- `platform_config` 컬렉션에 수수료 값 저장
- 변경 시 `platform_config_history`에 이력 기록
- 예약 적용 (CF 스케줄러)
- PRICING.md 단일 진실 소스와 일관성 검증

---
## 11. 통합 대시보드

### 11.1 🔑 결정 D5: Admin UI 구현 방식

**배경**: Admin 기능이 많아짐에 따라 UI 구현 방식 결정 필요.

#### 11.1.1 대안 D5-α: Firebase Console 직접 사용

**방식**: 별도 UI 없음. Firestore 문서 직접 수정 + CF는 Firebase Functions 콘솔 호출.

**장점**:
- 개발 비용 0
- 즉시 사용 가능

**단점**:
- 감사 로그 자동 기록 불가
- 권한 분리 어려움
- 실수 위험 (권한 있는 사람이 모든 문서 접근)
- 유저 친화적이지 않음 (JSON 직접 수정)

**적합**: Phase A 초기, 관리자 1명일 때만.

#### 11.1.2 대안 D5-β: 별도 웹앱 (/admin.geulove.com)

**방식**: 관리자 전용 별도 SPA.

**장점**:
- 권한 체계 명확 분리
- UI 최적화 (대시보드 특화)
- 보안 강화 (도메인 분리)
- 외부 Moderator 접근 가능

**단점**:
- 개발 공수 큼 (React 앱 + 인프라)
- 배포·유지보수 2개 사이트

#### 11.1.3 대안 D5-γ: In-app 관리자 탭 (**추천**)

**방식**: 메인 앱 내 `/admin` 경로에 Admin 전용 라우트.

**접근 조건**:
- Custom Claims로 관리자 role 검증
- 로그인 세션 유지 (별도 로그인 불필요)
- 비관리자 접근 시 404

**장점**:
- 개발 공수 적음 (기존 앱 확장)
- 로그인 편의 (단일 세션)
- 기존 UI 컴포넌트 재사용
- 배포 단일화

**단점**:
- 프론트엔드 번들 크기 증가 (코드 스플리팅 필수)
- 메인 앱과 분리 덜 명확 (보안 주의)

**보안 보강**:
- Admin 라우트는 **코드 스플리팅** (비관리자 번들 제외)
- Custom Claims 기반 라우팅 가드
- Rules와 Claims 이중 검증

#### 11.1.4 비교 매트릭스

| 기준 | α Console | β 별도 웹앱 | **γ In-app (추천)** |
|------|:---------:|:----------:|:-------------------:|
| 개발 공수 | 0 | 🔴 | ⭐⭐ |
| UX 품질 | ❌ | ✅ | ✅ |
| 보안 | 중간 | ✅ | ⚠️ 보강 필요 |
| 스케일 | 1명만 | ✅ | ✅ |
| 배포 복잡도 | 없음 | 🔴 | ⭐⭐ |
| 감사 로그 | 부재 | ✅ | ✅ |

#### 11.1.5 추천 — 대안 D5-γ (In-app 탭)

**근거**:
1. Phase B 시점에 개발 리소스 절약
2. Custom Claims 기반 RBAC로 보안 확보
3. 기존 컴포넌트·스타일 재사용
4. 필요 시 Phase C에서 별도 웹앱 분리 가능

**구현**:

```tsx
// src/App.tsx
<Routes>
  <Route path="/" element={<HomePage />} />
  <Route path="/profile/:uid" element={<ProfilePage />} />
  {/* ... 기타 유저 라우트 */}

  {/* 관리자 라우트 (코드 스플리팅) */}
  <Route
    path="/admin/*"
    element={
      <AdminGuard requiredRole="viewer">
        <Suspense fallback={<Loading />}>
          <AdminApp />
        </Suspense>
      </AdminGuard>
    }
  />
</Routes>
```

```tsx
// src/components/AdminGuard.tsx
export const AdminGuard: React.FC<{
  requiredRole: 'owner' | 'admin' | 'moderator' | 'viewer';
  children: React.ReactNode;
}> = ({ requiredRole, children }) => {
  const { user, claims } = useAuth();

  if (!user) return <Navigate to="/login" />;

  if (!hasRole(claims, requiredRole)) {
    return <NotFound />;  // 404로 존재 자체 숨김
  }

  return <>{children}</>;
};
```

```tsx
// src/admin/AdminApp.tsx (지연 로드)
const AdminApp = lazy(() => import('./AdminApp'));
```

### 11.2 메인 대시보드 레이아웃

**경로**: `/admin` (권한별 다른 화면)

```
┌─ Sidebar ─────────┐ ┌─ Main Content ─────────────────┐
│                   │ │                                │
│ 🏠 대시보드        │ │ 📊 대시보드 (오늘)             │
│ 👥 유저 관리       │ │                                │
│ 🚨 제재 관리       │ │ [실시간 활성 유저] 234명        │
│ 📝 콘텐츠 관리     │ │ [신규 가입] 12명                │
│ 💰 경제 운영       │ │ [유배 진행 중] 3명              │
│ 📢 광고 관리       │ │ [대기 작업] 5건                 │
│ 📜 감사 로그       │ │                                │
│ ⚙️ 경계값 튜닝     │ │ [유저 Tier 분포]               │
│ 🛡️ 권한 관리       │ │ [그래프]                       │
│                   │ │                                │
│ (Owner 전용)       │ │ [최근 조치 5건]                │
│ 📉 수수료 조정     │ │ · 14:32 흑무영 → exile_lv1     │
│                   │ │ · 14:15 홍길동 → award_title   │
└───────────────────┘ └────────────────────────────────┘
```

### 11.3 분포 대시보드

**경로**: Admin Dashboard → 분포

#### 11.3.1 Level 분포

```
Lv1: 1,234명 (45%)
Lv2:   567명 (21%)
Lv3:   345명 (13%)
Lv4:   234명  (9%)
Lv5:   178명  (7%)
Lv6-7:  89명  (3%)
Lv8-9:  34명  (1%)
Lv10:   12명  (0%)
```

**경보**:
- Lv10 비율 >10% → TUNING 검토 필요
- Lv1 비율 <30% → 봇 탐지 검토

#### 11.3.2 평판 분포

```
중립        : 1,800명
약간 우호   :   650명
우호        :   400명
매우 우호   :   120명
확고        :    30명
[Phase C]
전설        :     2명
경외        :     0명
신화        :     0명
```

#### 11.3.3 Creator Score 분포 (Phase B~)

```
마패 미달 (<0.5) : 1,456명
🥉 동마패         :   789명
🥈 은마패         :   234명
🥇 금마패         :    67명
💎 백금마패        :    12명
👑 다이아마패     :     3명
```

#### 11.3.4 칭호 획득률 (Phase B~)

```
🔰 새싹 작가      :  95% (대부분 첫 글)
✍️ 근면한 작가 I   :  12%
✍️ 근면한 작가 II  :   3%
🔥 첫 화제        :  34%
⭐ 인기 작가      :   8%
💎 초대박        :   1%
🤝 사교의 달인    :  23%
...
🌱 초기 개척자    : 100% (2026년 가입자 전원)
🎖️ 1년 개근       :  18%
🏛️ 베테랑        :   0% (아직 2년 미경과)
⚡ 헌신          :   2%
```

### 11.4 어뷰저 통계 대시보드

**출처**: `ANTI_ABUSE.md §10.2` 요구사항

**경로**: Admin Dashboard → 제재 관리 → 통계

**지표**:

```
┌────────────────────────────────────────────┐
│ 🚨 어뷰저 통계 (최근 30일)                  │
├────────────────────────────────────────────┤
│                                            │
│ 이상치 감지: 총 234건                       │
│   · 자동 조치: 145건 (62%)                  │
│   · 수동 검토: 89건 (38%)                   │
│                                            │
│ 유형별:                                     │
│   맞땡스볼: 45건                            │
│   평판 급상승: 32건                          │
│   EXP 급상승: 67건                           │
│   다계정 의심: 89건 (Phase C)               │
│                                            │
│ 처리 상태:                                  │
│   · pending: 12건                           │
│   · reviewed: 56건                          │
│   · action_taken: 134건                    │
│   · dismissed: 32건 (false positive)       │
│                                            │
│ 평균 검토 처리 시간: 3.2시간                 │
│                                            │
│ False positive 비율: 13.7%                  │
│   → TUNING 검토 권장                        │
└────────────────────────────────────────────┘
```

### 11.5 수익 대시보드

§10.5 참조. 플랫폼 수익 종합.

### 11.6 활동 대시보드

**지표**:
- DAU (Daily Active Users)
- WAU (Weekly Active Users)
- MAU (Monthly Active Users)
- 평균 세션 시간
- 글 작성 건수 (일별)
- 땡스볼 송금 건수
- 신규 깐부 맺기 수

### 11.7 위험 유저 프로필 뷰 (ANTI_ABUSE §10.3)

유저 상세 페이지 추가 섹션:

```
┌──────────────────────────────────────────────┐
│ 📊 평판 변동 그래프 (30일)                   │
├──────────────────────────────────────────────┤
│                                              │
│ [선 그래프: 일별 평판 추이]                   │
│                                              │
│ 이상 지점 강조:                               │
│   🔴 2026-04-10: +500 (부자연스러움)         │
│   🔴 2026-04-15: +200 (auditAnomaly 발동)    │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│ 💸 땡스볼 송수신 분포 (파이차트)              │
├──────────────────────────────────────────────┤
│                                              │
│ 송금 대상 (최근 30일):                       │
│   깐부Y: 45% ← 이상                          │
│   깐부Z: 30% ← 이상 (맞땡스볼 의심)          │
│   기타: 25%                                  │
│                                              │
│ 수신 출처:                                    │
│   깐부Y: 40%                                 │
│   깐부Z: 35%                                 │
│   기타: 25%                                  │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│ 🏚️ 유배 이력                                  │
├──────────────────────────────────────────────┤
│   · 2026-04-15 ~ 2026-04-22: 2차 유배        │
│     사유: "악성 댓글 반복"                    │
└──────────────────────────────────────────────┘
```

### 11.8 실시간 알림

**경로**: Admin Dashboard → 실시간 알림

**표시 항목** (onSnapshot):
- 신규 유배 요청
- 고액 땡스볼 송금 (500볼+)
- 새 부정클릭 감지
- 이상치 감지 (`audit_anomalies`)
- Moderator 제안 대기 건

### 11.9 대시보드 권한별 접근

| 화면 | Owner | Admin | Moderator | Viewer |
|------|:-----:|:-----:|:---------:|:------:|
| 메인 대시보드 | ✅ | ✅ | ✅ | ✅ |
| 분포 대시보드 | ✅ | ✅ | ✅ | ✅ |
| 어뷰저 통계 | ✅ | ✅ | ✅ | ✅ |
| 수익 대시보드 | ✅ | ✅ | ❌ | ✅ |
| 활동 대시보드 | ✅ | ✅ | ✅ | ✅ |
| 위험 유저 프로필 | ✅ | ✅ | ✅ | ✅ |
| 실시간 알림 | ✅ | ✅ | ⚠️ 일부 | ❌ |
| 감사 로그 | ✅ | ✅ | ⚠️ 본인만 | ✅ |
| 수수료 조정 | ✅ | ❌ | ❌ | ❌ |
| 경계값 튜닝 | ✅ | ⚠️ 제안 | ❌ | ❌ |

---

## 12. 경계값 튜닝 도구

**출처**: `TUNING_SCHEDULE.md` 전체

### 12.1 목적

- Lv/평판/Creator Score/마패 경계값 조정 시 시뮬레이션
- 조정 영향 사전 분석
- grandfathered 보호 필드 관리
- 조정 이력 추적

### 12.2 시뮬레이션 도구

**경로**: Admin Dashboard → 경계값 튜닝 → 시뮬레이션

**UI**:

```
┌────────────────────────────────────────────────┐
│ ⚙️ 경계값 시뮬레이션                            │
├────────────────────────────────────────────────┤
│                                                │
│ 조정 대상:                                      │
│   ○ 레벨 경계 (Lv별 EXP 임계)                   │
│   ● 마패 경계 (Creator Score)                   │
│   ○ 평판 Tier 경계                              │
│   ○ 수수료 (PRICING)                            │
│                                                │
│ 현재 값 → 제안 값:                              │
│   동마패: 0.5 → [0.7]                           │
│   은마패: 1.0 → [1.3]                           │
│   금마패: 2.0 → [2.5]                           │
│   백금: 3.5 → [4.0]                             │
│   다이아: 5.0 → [6.0]                           │
│                                                │
│ ─────────────────────────────────────────────  │
│                                                │
│ [ 시뮬레이션 실행 ]                             │
│                                                │
│ 예상 영향:                                      │
│   · 동마패 → 없음: 234명 강등                    │
│   · 은마패 → 동마패: 89명 강등                   │
│   · 금마패 → 은마패: 23명 강등                   │
│   · 백금 → 금: 5명 강등                         │
│   · 다이아 → 백금: 2명 강등                      │
│                                                │
│   총 영향: 353명 강등                            │
│                                                │
│ [ grandfathered 보호 옵션 ]                     │
│   ☑ 현재 달성자 지위 영구 보존                   │
│                                                │
│ [ 취소 ]        [ 예약 적용 ]                  │
└────────────────────────────────────────────────┘
```

**시뮬레이션 CF**:

```javascript
exports.simulateThresholdChange = onCall({...}, async (req) => {
  const claims = req.auth?.token;

  if (!isAdmin(claims)) {
    throw new HttpsError('permission-denied', 'Admin or higher');
  }

  const { target, proposedValues } = req.data;

  // 현재 경계값
  const currentValues = await loadCurrentThresholds(target);

  // 시뮬레이션 (실제 변경 없음, 계산만)
  const impactPreview = await calculateImpact(target, currentValues, proposedValues);

  return {
    currentValues,
    proposedValues,
    impact: impactPreview,
  };
});
```

### 12.3 경계값 적용

**⚠️ Owner 전용**

**적용 플로우**:

```
관리자 시뮬레이션
        ↓
영향 검토
        ↓
Owner 승인
        ↓
예약 적용 (특정 시점)
        ↓
CF 실행: 경계값 업데이트 + grandfathered 처리
        ↓
전체 유저 Creator Score 재계산 트리거
        ↓
변화 유저에게 알림
        ↓
admin_actions 기록 (영구 보존)
```

### 12.4 Grandfathered 보호 CF

```javascript
exports.applyThresholdWithGrandfathering = onCall({...}, async (req) => {
  if (!isOwner(req.auth?.token)) {
    throw new HttpsError('permission-denied', 'Owner only');
  }

  const { target, newValues, applyAt, grandfather } = req.data;

  // 1. 현재 기준으로 영향받을 유저 식별 (보호 대상)
  const affectedUsers = await findUsersAffectedByChange(target, newValues);

  // 2. grandfathered 처리 (경계값 적용 전에 지위 기록)
  if (grandfather) {
    const batch = db.batch();
    for (const user of affectedUsers) {
      const userRef = db.collection('users').doc(user.uid);
      const grandfatheredField = getGrandfatheredFieldName(target);  // e.g., 'grandfatheredMapae'
      batch.update(userRef, {
        [grandfatheredField]: user.currentTier,
        grandfatheredAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
  }

  // 3. 새 경계값 저장
  await db.collection('platform_config').doc(target).set({
    values: newValues,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: req.auth.uid,
  });

  // 4. 이력 기록
  await db.collection('platform_config_history').add({
    target,
    previousValues: await getCurrentValues(target),
    newValues,
    appliedAt: applyAt || FieldValue.serverTimestamp(),
    appliedBy: req.auth.uid,
  });

  // 5. 감사 로그
  await db.collection('admin_actions').add({
    adminUid: req.auth.uid,
    adminRole: 'owner',
    action: 'tune_threshold',
    details: { target, newValues, affectedCount: affectedUsers.length },
    canRollback: true,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: null,  // 영구
  });

  return { success: true, affectedCount: affectedUsers.length };
});
```

### 12.5 Phase별 튜닝 권한

**출처**: `TUNING_SCHEDULE.md §3`

- **Phase A (베타)**: 튜닝 **금지** (데이터 수집만)
- **Phase B (베타 종료)**: 1회 전면 재조정 (가장 큰 조정)
- **Phase C (정식)**: 6개월~1년 주기

**UI에 Phase 표시**:

```
┌────────────────────────────────────────┐
│ 현재 Phase: A (데이터 수집 중)          │
│                                        │
│ ⚠️ Phase A에서는 경계값 조정이 권장되지  │
│    않습니다. 데이터 수집 후 Phase B에서  │
│    전면 재조정 권장.                     │
│                                        │
│ [ 그래도 조정하기 ]  (Owner 서명 필요)  │
└────────────────────────────────────────┘
```

---

## 13. Phase별 로드맵

### 13.1 Phase A (현재 ~ 베타)

**구축 목표**: 권한 체계 + 핵심 조치 도구

**적용**:
- ✅ D1-β Phase A-1: `grantAdminClaim` CF + 이중 체크 (Claims OR 화이트리스트)
- ✅ D1-β Phase A-2: 흑무영 Custom Claims 부여
- ✅ D1-β Phase A-3: 화이트리스트 제거
- ✅ D2-γ Owner/Admin 활성 (소규모 운영)
- ✅ D3-γ 차등 보존 정책
- ✅ `admin_actions` 컬렉션 + Rules
- ✅ `AdminGuard` 컴포넌트
- ✅ 유배 발동/해제/사약 UI
- ✅ EXP/평판 수동 조정
- ✅ abuseFlags 수동 설정
- ✅ 닉네임 수동 변경
- ✅ 콘텐츠 블라인드
- ✅ 기본 대시보드 (유저 목록, 제재 이력)

**미적용** (Phase B로):
- ❌ Creator Score 수동 조정 (CREATOR_SCORE 의존)
- ❌ 마패/칭호 수동 부여 (MAPAE 의존)
- ❌ 분포 대시보드 (데이터 부족)
- ❌ 광고 경매 관리 (Phase C 외부 연동)

### 13.2 Phase B (베타 종료)

**구축 목표**: 전 시스템 통합 운영

**추가 적용**:
- ✅ D2-γ Moderator 활성 (콘텐츠 관리 분리)
- ✅ Creator Score 수동 조정 (CREATOR_SCORE 이후)
- ✅ 마패 수동 조정 (MAPAE 이후)
- ✅ 칭호 부여/박탈 (MAPAE 이후)
- ✅ 분포 대시보드 (Lv/평판/Score/마패)
- ✅ 어뷰저 통계 대시보드
- ✅ 수익 대시보드
- ✅ D4-β 베타 플레이스홀더 (T2/T3 대기 목록)
- ✅ `contact_requests` 컬렉션 (제보 접수)
- ✅ 시뮬레이션 도구 (TUNING)
- ✅ 일괄 조정 도구 (Owner 전용)

### 13.3 Phase C (정식 출시)

**구축 목표**: 외부 인력 운영 + 자동화

**추가 적용**:
- ✅ D2-γ Viewer 활성 (파이낸스/마케팅 팀)
- ✅ 신고 시스템 (Phase C 별도 스프린트)
- ✅ 광고 경매 전면 관리 (광고주 + 승인 큐)
- ✅ 수익 출금 승인 UI
- ✅ Tier T2/T3 실제 작동 (PortOne PG 연동)
- ✅ 주주 인증 관리 (Codef)
- ✅ 수수료 조정 UI (Owner)
- ✅ 경계값 조정 (TUNING Phase C 주기)
- ✅ grandfathered 관리
- ✅ 실시간 알림 시스템
- ✅ 감사 로그 외부 백업 (BigQuery/S3)

### 13.4 Phase 전환 체크리스트

**Phase A → B 진입 조건**:
- [ ] 유저 100명 이상
- [ ] Moderator 1명 이상 확보 (외부 또는 내부)
- [ ] 모든 REPUTATION_V2/CREATOR_SCORE/MAPAE 문서 구현 완료
- [ ] admin_actions 로그 최소 30일 이상 누적

**Phase B → C 진입 조건**:
- [ ] 유저 1,000명 이상
- [ ] Moderator 3명 이상 고용
- [ ] 관리자 외 파이낸스/CS 인력 확보
- [ ] PortOne PG 연동 완료
- [ ] 법무 검토 (개인정보/수익 분배)
- [ ] 신고 시스템 별도 스프린트 완료

---

## 14. 테스트 시나리오

### 14.1 권한 체계 테스트

**시나리오 1: Custom Claims 이중 체크**

**입력**:
```
Phase A-1 단계
흑무영: 닉네임 "흑무영", Custom Claims 없음
```

**기대**:
- `isAdmin` = true (화이트리스트 매칭)
- Phase A-2로 넘어가 Claims 부여
- Phase A-3 이후 Claims만으로 검증

**시나리오 2: 권한 없는 접근**

**입력**:
```
일반 유저 (Custom Claims 없음)이 /admin 접근 시도
```

**기대**:
- `AdminGuard` 발동 → 404 페이지
- 관리자 페이지 존재 자체 숨김

**시나리오 3: Moderator가 사약 시도**

**입력**:
```
Moderator가 adminExecuteSayak CF 호출
```

**기대**:
- `isOwner` 체크 실패
- `HttpsError('permission-denied', 'Owner only')`
- 실패 admin_actions 로그 (부정 시도 기록)

### 14.2 감사 로그 테스트

**시나리오 4: 로그 보존**

**입력**:
```
exile_lv1 액션 → admin_actions 기록
5년 경과 (1,825일 + 1일)
```

**기대**:
- TTL 자동 삭제
- `admin_actions` 문서 존재 안 함

**시나리오 5: 영구 보존**

**입력**:
```
사약 집행 → action: 'sayak'
10년 경과
```

**기대**:
- `expiresAt: null` → TTL 작동 안 함
- 영구 보존 ✓

**시나리오 6: 롤백**

**입력**:
```
T=0: 관리자 A가 exile_lv1 발동
T=1h: 관리자 B가 rollback 실행
```

**기대**:
- 원본 admin_actions에 `rolledBackAt`, `rolledBackBy` 기록
- 새 `admin_actions` 추가 (`action: 'rollback_exile_lv1'`)
- 유저의 `sanctionStatus` = 'clean' 복원
- 유저 알림 발송

### 14.3 유배 관리 테스트

**시나리오 7: 1차 유배 발동**

**입력**:
```
targetUid: bad_user_uid
level: 1
reason: "악성 댓글 반복"
evidence: ["comment_abc", "comment_def"]
```

**기대**:
- `sanctionStatus: 'exiled_lv1'`
- 속죄금 부과 알림 (10볼)
- exileHistory에 기록 추가
- 유배 대시보드에 표시

**시나리오 8: 90일 미납 자동 사약**

**입력**:
```
유저가 1차 유배 90일째 속죄금 미납
checkAutoSayak 배치 실행
```

**기대**:
- 자동 `executeSayak` 호출
- `sanctionStatus: 'banned'`
- 자산 몰수, 콘텐츠 블라인드
- admin_actions에 `action: 'sayak'` (system 발동)

**시나리오 9: 유배 해제 직권**

**입력**:
```
관리자가 유배 해제 (오판정 복구)
restoreReputation: true
unblindContent: true
```

**기대**:
- `sanctionStatus: 'clean'`
- `abuseFlags: {}` 초기화
- 블라인드 콘텐츠 복원
- 평판 재계산 트리거

### 14.4 신고/수동 제재 테스트

**시나리오 10: 외부 제보 → 수동 제재 기록**

**입력**:
```
인스타 DM 제보 → 관리자가 수동 제재 폼 입력
reportSource: 'instagram_dm'
권장 조치: 유배 1차
```

**기대**:
- `admin_actions` 기록 (details에 reportSource, reportSummary, evidence 포함)
- `sendToExile` CF 호출
- 유저에게 유배 알림

**시나리오 11: 경고 3회 누적**

**입력**:
```
동일 유저에게 경고 3회 발급
```

**기대**:
- 3번째 경고 시 모든 Admin에게 알림
- 유저 상세 페이지 "위험도: 🟡 주의" 표시

### 14.5 수동 조정 테스트

**시나리오 12: EXP 수동 조정 (이벤트 보상)**

**입력**:
```
mode: 'absolute'
value: 1500
reason: "3월 이벤트 1등 보상"
recalculateLevel: true
```

**기대**:
- `exp` = 1500
- `level` 자동 재계산 (Lv6 예상)
- admin_actions 기록

**시나리오 13: Creator Score Freeze**

**입력**:
```
action: 'freeze'
reason: "어뷰징 확인 후 계정 임시 정지"
```

**기대**:
- `creatorScoreFrozen: true`
- 즉시 Score 0으로 표시 (`calculateCreatorScore` 내 조기 반환)
- 다음 배치에서 마패 'none' 자동 설정
- 권한 게이트 차단 (수익 출금 등)

**시나리오 14: 칭호 수동 박탈**

**입력**:
```
targetUid: 어뷰저
titleId: 'super_hit'
mode: 'revoke'
reason: "어뷰징으로 달성된 칭호 박탈"
```

**기대**:
- `users.titles`에서 super_hit 제거
- `primaryTitles`에서도 제거 (포함되어 있었다면)
- `title_revocations` 컬렉션에 기록
- 유저 알림

### 14.6 일괄 조정 테스트

**시나리오 15: 125명 EXP 일괄 지급**

**입력**:
```
targetUids: [125명 UID 배열]
action: 'adjust_exp'
value: +100
reason: "2026-04-20 버그 보상"
dryRun: false
```

**기대**:
- batchId 생성
- 125개 개별 `admin_actions` 기록 (모두 batchId 포함)
- 유저 125명 EXP +100
- 실패 건 리포트 반환

### 14.7 광고·수익 테스트

**시나리오 16: 광고 승인 플로우**

**입력**:
```
adId: AD_20260420_001
관리자 판정: 승인
```

**기대**:
- 광고 상태 'active'
- 자동 검증 통과 기록
- admin_actions에 `action: 'approve_ad'`

**시나리오 17: 부정클릭 자동 대응**

**입력**:
```
동일 IP 100회 클릭/분 감지
detectFraud CF 발동
```

**기대**:
- IP 차단
- 해당 클릭 수익 환불
- 대시보드 실시간 알림 표시
- admin_actions 기록

**시나리오 18: 수익 출금 승인**

**입력**:
```
유저 출금 요청: 50,000원
관리자 판정: 승인
```

**기대**:
- 원천세 계산 (8.8% = 4,400원)
- 실 지급 45,600원 처리
- `settled_payouts` 기록
- 유저 `pendingRevenue` 0원

### 14.8 경계값 튜닝 테스트

**시나리오 19: 시뮬레이션**

**입력**:
```
target: 'mapae_thresholds'
proposedValues: { bronze: 0.7, silver: 1.3, ... }
```

**기대**:
- 실제 DB 변경 없음
- 영향 유저 수 반환 (예: 353명 강등)
- 대시보드에 프리뷰

**시나리오 20: grandfathered 적용**

**입력**:
```
마패 경계값 조정 + grandfather: true
```

**기대**:
- 영향받을 유저의 `grandfatheredMapae` 기록
- 새 경계값 적용
- 보호된 유저는 기존 티어 유지 (`MAPAE_AND_TITLES §7` 연계)

### 14.9 닉네임 수동 변경 테스트

**시나리오 21: 신변 위협 변경**

**입력**:
```
targetUid: victim_uid
newNickname: "새닉네임"
reason: "stalking"
reservePrevious: true
```

**기대**:
- `nickname` 변경
- `nicknameChangeCount` 증가 안 함
- 이전 닉네임 `reserved_nicknames`에 등록
- `sanction_log` 기록
- 유저 알림

### 14.10 D5 대시보드 권한 테스트

**시나리오 22: Viewer 권한**

**입력**:
```
Viewer가 /admin 접근
```

**기대**:
- Sidebar에 대시보드·통계만 표시
- 제재 관리, 수동 조정 등 쓰기 메뉴 숨김
- 수동 조정 API 호출 시 permission-denied

---

## 15. 결정 요약 & Step 1 완료 선언

### 15.1 확정된 결정

**권한 및 감사**:
1. Custom Claims 기반 권한 체계 (D1-β 점진적 전환)
2. 4단계 역할 (D2-γ Owner/Admin/Moderator/Viewer)
3. 차등 보존 감사 로그 (D3-γ: 영구/5년/3년/1년)

**운영 방식**:
4. 신고 시스템은 **Phase C 이후 개발**, Phase A/B는 관리자 수동 제재 중심
5. 베타 플레이스홀더 UX: 대기 목록 방식 (D4-β)
6. In-app 관리자 탭 (D5-γ)

**전면 통합 기능**:
7. 유배·제재 관리 UI (발동/해제/사약 이중 확인)
8. 수동 조정 도구 (EXP/평판/Score/마패/칭호/abuseFlags/Grandfathered)
9. 콘텐츠 삭제/블라인드/복원
10. 닉네임 수동 변경 + 예약 관리
11. 회원가입/인증 운영 (Tier T1/T2/T3)
12. 광고 경매 관리 (광고주/승인/부정클릭)
13. 수익 정산/출금 승인
14. 전 메뉴 관리 (강변시장/잉크병/깐부방/라이브/주주방/정보봇)
15. 플랫폼 수익 조회
16. 경계값 튜닝 도구 (시뮬레이션 + grandfathered)

### 15.2 🔑 사용자 최종 결정 필요 항목

| 결정 | 위치 | 추천 | 대안 |
|------|------|------|------|
| **D1** 권한 전환 전략 | §2.1 | **β 점진적** | α 즉시 / γ Phase C |
| **D2** 역할 분리 | §2.2 | **γ 4단계** | α 단일 / β 2단계 |
| **D3** 감사 로그 보존 | §3.1 | **γ 차등** | α 영구 / β 3년 |
| **D4** 베타 플레이스홀더 | §9.2 | **β 대기 목록** | α 노출만 / γ 로드맵 |
| **D5** Admin UI 방식 | §11.1 | **γ In-app** | α Console / β 별도 웹앱 |

### 15.3 신고 시스템 관련 중대 전제

**Phase A/B 동안**:
- 신고 시스템은 개발되지 않음
- 관리자가 외부 채널 제보(DM/이메일)로 받아 수동 제재
- `CREATOR_SCORE.md §5.4` `calculateReportPenalty`는 항상 0 반환
- `ADMIN.md §5`의 수동 제재 UI로 대응

**Phase C 이후** (별도 스프린트):
- 정식 신고 시스템 개발
- `reports` 컬렉션 신설
- Moderator 검토 큐
- CREATOR_SCORE의 신고 감산 공식 활성화

### 15.4 구현 TODO 체크리스트

**Phase A 도입 전**:
- [ ] 이 문서 최종 승인
- [ ] 5개 결정 (D1~D5) 사용자 최종 결정

**Phase A-1 (1주)**:
- [ ] `grantAdminClaim` CF
- [ ] `admin_actions` 컬렉션 + Rules
- [ ] `isAdmin` 헬퍼 이중 체크 (Claims OR 화이트리스트)
- [ ] TTL 정책 설정 (`admin_actions.expiresAt`)

**Phase A-2 (3일)**:
- [ ] 흑무영 Custom Claims 부여
- [ ] 검증 (모든 관리 경로 동작 확인)

**Phase A-3 (1주)**:
- [ ] 화이트리스트 제거
- [ ] `PLATFORM_ADMIN_NICKNAMES` 참조 제거

**Phase A 기본 UI**:
- [ ] `AdminGuard` 컴포넌트
- [ ] `/admin` 라우트 + 코드 스플리팅
- [ ] 유저 목록/검색/상세
- [ ] 유배 발동/해제/사약 UI
- [ ] EXP/평판 수동 조정 UI
- [ ] abuseFlags 설정 UI
- [ ] 닉네임 수동 변경 UI
- [ ] 콘텐츠 블라인드 UI
- [ ] 감사 로그 조회 + 롤백

**Phase B 확장**:
- [ ] Moderator role 활성
- [ ] Creator Score 수동 조정
- [ ] 마패/칭호 수동 부여/박탈
- [ ] 분포 대시보드 (Lv/평판/Score/마패/칭호)
- [ ] 어뷰저 통계
- [ ] 수익 대시보드
- [ ] `contact_requests` 컬렉션 + 제보 접수
- [ ] T2/T3 대기 목록 UI
- [ ] 시뮬레이션 도구
- [ ] 일괄 조정 도구

**Phase C 완성**:
- [ ] Viewer role 활성
- [ ] 신고 시스템 (별도 스프린트)
- [ ] 광고 경매 전면 관리
- [ ] 수익 출금 승인 UI
- [ ] PortOne PG 연동 (T2/T3 작동)
- [ ] Codef 주주 인증 관리
- [ ] 수수료 조정 UI (Owner)
- [ ] 경계값 조정 (TUNING 주기)
- [ ] grandfathered 관리
- [ ] 실시간 알림
- [ ] 감사 로그 외부 백업

### 15.5 모든 Step 1 문서의 교차 참조

| 문서 | ADMIN에 공급 | ADMIN이 소비 |
|------|-------------|-------------|
| **GLOVE_v2** | 전체 아키텍처, 권한 체계 원칙 | §2 (isAdmin), §13 |
| **PRICING** | 수수료·속죄금 구조 | §4.5, §8, §10.1~10.5, §10.7 |
| **TUNING_SCHEDULE** | Phase별 튜닝 주기 | §12 |
| **ANTI_ABUSE** | 이상치 검토 큐, 어뷰징 방어 | §4, §5, §6.6, §11.4, §11.7 |
| **KANBU_V2** | 맞깐부 관계 수동 해제 | §6 (필요 시), §14.14 |
| **LEVEL_V2** | EXP/level 수동 조정 | §6.2 |
| **REPUTATION_V2** | abuseFlags/grandfathered | §6.3, §6.6, §6.7 |
| **CREATOR_SCORE** | freeze/boost/demote API | §6.4, §10.1.6, §11.3.3 |
| **MAPAE_AND_TITLES_V1** | 칭호 부여/박탈 API | §6.5, §11.3.4 |

### 15.6 Step 1 기획 완료 선언

**Step 1 종합기획 진행률**: **10/10 (100%)** ✅

```
✅ GLOVE_SYSTEM_REDESIGN_v2.md
✅ PRICING.md
✅ TUNING_SCHEDULE.md
✅ ANTI_ABUSE.md
✅ KANBU_V2.md
✅ LEVEL_V2.md
✅ REPUTATION_V2.md
✅ CREATOR_SCORE.md
✅ MAPAE_AND_TITLES_V1.md
✅ ADMIN.md  ← 이 문서, 최종
```

**전체 기획 분량**:
- 10개 문서
- 총 15,000~18,000줄 규모
- 6개 Phase 결정 (REPUTATION 2 + CREATOR_SCORE 4 + MAPAE 5 + ADMIN 5 = 16개 D-결정)
- 3대 원칙 일관 적용 (각 문서 §0.2)
- Phase별 로드맵 (A → B → C) 통일

### 15.7 다음 단계 (Step 1 이후)

**16개 D-결정 사용자 확정 단계**:

Step 1이 기획 단계에서 완료되었지만, 각 문서마다 사용자 최종 결정이 필요한 D-결정들이 있음:

| 문서 | D-결정 수 | 추천안들 |
|------|:---------:|----------|
| REPUTATION_V2 | 저장 B, 감쇠 Phase B (2개 확정 추천) | — |
| CREATOR_SCORE | 4개 (D1 지수, D2 logs, D3 계단재범, D4 계단고유) | — |
| MAPAE_AND_TITLES_V1 | 5개 (D1 축소, D2 3개, D3 이중, D4 차등, D5 매트릭스) | — |
| ADMIN | 5개 (D1 점진, D2 4단계, D3 차등, D4 대기목록, D5 In-app) | — |

**총 16개 추천안 검토 → 확정**. 검토 완료 후 Step 2 실제 구현 코드 작업.

**Step 2 예상 순서** (메모리 기록 기반):
1. Anti-Abuse §4 긴급 패치 완료 (Commit 5~6)
2. Node 22 + firebase-functions 5.1+ 마이그레이션
3. Step 1 각 문서 기반 실제 구현 (순서: LEVEL_V2 → REPUTATION_V2 → CREATOR_SCORE → MAPAE → ADMIN)
4. Feature Freeze
5. 번역 Phase 1~2
6. 베타

### 15.8 최종 소회

**본 Step 1 기획의 의의**:

1. **단일 진실 소스 확보**: 각 시스템마다 "어디서 정의되는가"가 명확
2. **의존성 방향 설정**: 하향식 참조 (상위 문서는 하위 미참조)
3. **Phase별 롤아웃**: 각 기능의 도입 시점 명확
4. **의사결정 투명성**: 모든 D-결정이 대안 비교 + 추천 + 근거로 문서화
5. **Step 2 청사진**: 구현 시 추측 없이 문서 참조만으로 충분

**1인 바이브 개발자로서의 장점 활용**:
- Claude가 기획자 + 아키텍트 역할
- 흑무영이 구현 실행 + 검증
- 문서 기반 자기 감사 (Claude 코드 CLI가 각 문서 준수 여부 확인 가능)

---

**문서 끝.**

> **Step 1 종합기획 완료**. 16개 D-결정 확정 후 Step 2 구현 착수 권장.

> **마지막 업데이트**: 2026-04-20
