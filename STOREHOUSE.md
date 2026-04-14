# 놀부의 텅 빈 곳간 (유배귀양지) 기획서 v0.2

> **Nolbu's Empty Storehouse — Exile System Design**
>
> - **프로젝트:** 할말있소 (Halmal-itso / Glove)
> - **작성일:** 2026-04-14
> - **버전:** v0.2 (통합본)

---

## 목차

0. [개요](#0-개요-overview)
1. [4진 아웃 & 사약 시스템](#1-4진-아웃--사약-시스템)
2. [워크플로우](#2-워크플로우-workflow)
3. [공유 기능 차단 (Sandbox Policy)](#3-공유-기능-차단-sandbox-policy)
4. [공개 프로필 & 내 정보 정책](#4-공개-프로필--내-정보-정책)
5. [휴대폰 인증 (지연 인증 전략)](#5-휴대폰-인증-지연-인증-전략)
6. [해금 절차 (Release Process)](#6-해금-절차-release-process)
7. [사약 (Sayak) 시스템](#7-사약-sayak-시스템)
8. [Firestore 데이터 모델](#8-firestore-데이터-모델)
9. [Cloud Functions 구현 명세](#9-cloud-functions-구현-명세)
10. [라우팅 가드 (App.tsx)](#10-라우팅-가드-apptsx-의사코드)
11. [리스크 대응](#11-리스크-대응)
12. [외부 시스템 연동](#12-외부-시스템-연동)
13. [TODO (미결정 / 후속 논의)](#13-todo-미결정--후속-논의)
14. [구현 우선순위](#14-구현-우선순위-implementation-phases)

---

## 0. 개요 (Overview)

### 0.1 컨셉

> **"심술을 부리다 벌을 받은 놀부가 곳간에 갇혀 반성하는 공간"**

악성 유저를 단순 차단하는 것이 아니라, **'시간(반성 기간) + 재물(속죄금) + 사회적 관계 상실(깐부 리셋)'** 이라는 삼중 장벽을 통해 스스로 반성하게 만드는 한국형 금융치료 시스템.

### 0.2 시스템 목표

1. **악성 유저 진입 장벽 극대화** — 단순 정지가 아닌 '시간 + 비용 + 관계' 삼중 페널티
2. **땡스볼 인플레이션 억제** — 속죄금 회수를 통한 경제적 소각처(Burn Sink) 역할
3. **세계관 강화** — "놀부 곳간", "사약", "속죄금" 등 한국 전통 서사 활용
4. **기존 시스템 무해성** — `users` 컬렉션에 최소 필드만 추가하여 매끄럽게 연동
5. **자가발전형 콘텐츠 생태계** — 유배지 자체가 일반 유저들의 관전 콘텐츠가 되어 트래픽 생산

### 0.3 핵심 키워드 (다국어)

| KR | EN | JP |
|----|----|----|
| 속죄금 | Atonement Fee | 贖罪金 |
| 사약 | Sayak (고유명사) | 賜薬 |
| 놀부의 곳간 | Nolbu's Storehouse | ノルブの蔵 |
| 무인도 귀양지 | Deserted Exile | 無人島の流刑地 |
| 절해고도 | The Forsaken Isle | 絶海の孤島 |
| 금융치료 | Financial Therapy | 金融治療 |
| 트롤 통행료 | Troll Toll | トロール通行料 |

---

## 1. 4진 아웃 & 사약 시스템

### 1.1 단계별 패널티 테이블

| 단계 | 명칭 | 상태값 | 반성 기간 | 속죄금 | 미납 90일 경과 |
|:---:|:---|:---|:---:|:---:|:---:|
| 🟡 1차 | 놀부의 텅 빈 곳간 | `exiled_lv1` | 3일 | 🏀 10볼 | ☠️ 자동 사약 |
| 🟠 2차 | 무인도 귀양지 | `exiled_lv2` | 7일 | 🏀 50볼 | ☠️ 자동 사약 |
| 🔴 3차 | 절해고도 (絶海孤島) | `exiled_lv3` | 30일 | 🏀 300볼 | ☠️ 자동 사약 |
| ☠️ 4차 | 사약 (賜藥) | `banned` | 영구 | 불가 | — |

### 1.2 패널티 적용 원칙

1. `strikeCount`는 **누적**되며 절대 리셋되지 않음 (영구 기록)
2. 1차 유배 만료 후 정상 복귀해도 strikeCount는 1로 유지 → 다음 신고 시 자동으로 2차 적용
3. 단계 건너뛰기 불가, 되돌리기도 불가
4. **"반성 기간"은 속죄금을 낼 수 있게 되는 최소 대기 시간일 뿐** → 기간이 끝나도 속죄금 미납 시 풀려나지 못함 (무기한 유배)
5. 무기한 유배 90일 경과 시 → 자동 사약 처분
6. 유배 중 추가 신고로 인한 단계 승급 여부는 정책 수립 필요 (TODO)

### 1.3 "반성 기간" vs "속죄금"의 의미

- **반성 기간:** 시간 장벽. 이 기간이 지나야 속죄금 결제 버튼이 활성화됨. "최소한 이만큼은 반성해야 한다"는 의미.
- **속죄금:** 비용 장벽. 반성 기간이 지나도 속죄금을 못 내면 풀려나지 못함. "재물을 내놓아야 풀어준다"는 의미.
- **무기한:** 속죄금을 마련할 때까지 곳간에 머무는 상태. 90일 경과 시 자동 사약.

---

## 2. 워크플로우 (Workflow)

### 2.1 신고 → 유배 (Admin Flow)

```
[유저 B] 악성 콘텐츠 발견
    ↓
[공개프로필/팝업의 🚨 신고하기] 클릭
    ↓
[Firestore] reports 컬렉션에 신고 적재
    ↓
[관리자 대시보드] 실시간 알림 수신
    ↓
[대장님] 신고 내용 검토 → [⚖️ 유배 보내기] 클릭
    ↓
[Cloud Function] sendToExile() 실행
    ├─ 대상 유저의 strikeCount 조회
    ├─ strikeCount + 1
    ├─ 단계에 맞는 필드 일괄 업데이트
    │   • sanctionStatus
    │   • sanctionExpiresAt
    │   • requiredBail
    │   • sanctionReason
    │   • sanctionedAt / sanctionedBy
    └─ 4차일 경우 → executeSayak() 자동 호출
    ↓
[대상 유저] 다음 앱 접속 시 강제 유배지 이동
```

### 2.2 유배자 화면 구조 (Exiled User View)

**사이드메뉴 — 유배 중**

```
┌─────────────────────┐
│  ☰ 메뉴             │
├─────────────────────┤
│  🏚️ 유배귀양지       │  ← 유일하게 활성화
│                     │
│  ─────────────      │
│  (다른 메뉴 모두     │
│   숨김 처리)         │
│  ─────────────      │
│                     │
│  👤 내 정보         │  ← 제한적 접근
│  🔓 로그아웃        │
└─────────────────────┘
```

**유배귀양지 메인 — 3탭 구조**

```
┌───────────────────────────────────────────────┐
│  🏚️ 유배귀양지                                 │
├───────────────────────────────────────────────┤
│ [🟡 놀부의곳간] [🟠 무인도] [🔴 절해고도]       │
│  (내가 속한 탭만 활성, 나머지 2개는 🔒 잠금)    │
├───────────────────────────────────────────────┤
│                                               │
│  ┌─ 상단 고정 상태 카드 ──────────────────┐   │
│  │ • 전과: 1범                            │   │
│  │ • 사유: (관리자 입력 사유 표시)         │   │
│  │ • 반성 기간: 2일 14시간 32분 남음       │   │
│  │ • 속죄금: 🏀 10볼                      │   │
│  │ • 보유 땡스볼: 🏀 7볼                   │   │
│  │                                        │   │
│  │ ⚠ 속죄금이 부족합니다. 🏀 3볼 필요      │   │
│  │                                        │   │
│  │ [🔒 기간 만료까지 2일 14시간 남음]      │   │
│  └────────────────────────────────────────┘   │
│                                               │
│  ─── 곳간 게시판 ───                          │
│  • 다른 1차 유배자들의 글 목록                 │
│  • [✏️ 글쓰기] 버튼                            │
│                                               │
└───────────────────────────────────────────────┘
```

### 2.3 일반 유저 화면 구조 (Active User View)

**사이드메뉴 — 정상 상태**

```
┌─────────────────────┐
│  ☰ 메뉴             │
├─────────────────────┤
│  🏠 홈              │
│  👥 깐부방          │
│  🔔 알림            │
│  🏚️ 유배귀양지       │  ← 관전 가능
│  👤 내 정보         │
│  🔓 로그아웃        │
└─────────────────────┘
```

**유배지 관전 — 일반 유저 진입 시**

```
┌───────────────────────────────────────────────┐
│  🏚️ 유배귀양지                                 │
├───────────────────────────────────────────────┤
│ [🟡 놀부의곳간] [🟠 무인도] [🔴 절해고도]       │
│  (3개 탭 모두 자유롭게 열람 가능)               │
├───────────────────────────────────────────────┤
│                                               │
│  ⚠ 이곳은 징계받은 유저들의 공간입니다.        │
│  불쾌한 콘텐츠가 있을 수 있습니다.             │
│                                               │
│  ─── 곳간 게시판 ───                          │
│  📝 [유배자 #4821] 제가 잘못했습니다...       │
│     ❤️ 12  💬 3   [🏀 땡스볼 보내기]           │
│                                               │
│  📝 [유배자 #1130] 반성중입니다                │
│     ❤️ 5   💬 0   [🏀 땡스볼 보내기]           │
│                                               │
└───────────────────────────────────────────────┘
```

### 2.4 유배지 권한 매트릭스

| 기능 | 유배자 | 일반유저 |
|:---|:---:|:---:|
| 글 작성 | ✅ (내 탭) | ❌ |
| 글 읽기 | ✅ (내 탭) | ✅ (전체) |
| 댓글 작성 | ✅ | ❌ |
| 댓글 읽기 | ✅ | ✅ |
| 좋아요 누르기 | ✅ | ✅ |
| 땡스볼 송금 → 유배자 | ❌ | ✅ |
| 땡스볼 송금 → 일반유저 | ❌ | (해당없음) |
| 땡스볼 송금 → 다른 유배자 | ❌ | (해당없음) |
| 외부 공유 (링크/SNS) | ❌ | ❌ |
| 스크린샷 | ⚠️ | ⚠️ |
| 신고하기 | ✅ | ✅ |
| DM / 1:1 채팅 | ❌ | ❌ |
| 깐부 신청 | ❌ | ❌ |
| 프로필 열람 | ✅ | ✅ |

**핵심 규칙:**
- 유배자는 자기 단계 탭에서만 쓰기 작업 가능
- 유배자 간 땡스볼 송금 금지 (담합 방지)
- 일반 유저는 오직 "구경 + 좋아요 + 땡스볼 송금"만
- 댓글은 유배자끼리만 (일반 유저는 한마디도 못 건넴)
- 외부 공유 완전 차단 (샌드박스)

### 2.5 땡스볼 흐름 정책

| 경로 | 허용 여부 |
|:---|:---:|
| [일반 유저] → [유배자] | ✅ 허용 |
| [일반 유저] → [일반 유저] | ✅ 허용 (기존) |
| [유배자] → [일반 유저] | ❌ 차단 |
| [유배자] → [다른 유배자] | ❌ 차단 |
| [유배자] 보유 땡스볼 → 속죄금 결제 | ✅ 허용 (유일한 사용처) |

- 유배자에게 들어온 땡스볼은 오직 속죄금으로만 소진 가능
- 자연스럽게 탈출 자금으로 집중됨
- 담합/자금세탁 경로 원천 차단

---

## 3. 공유 기능 차단 (Sandbox Policy)

### 3.1 차단 대상

| 기능 | 처리 |
|:---|:---|
| 링크 복사 | 공유 URL 자체 생성 안함 |
| 카카오톡 공유 | 공유 버튼 숨김 |
| 외부 SNS 공유 | 공유 버튼 숨김 |
| 스크린샷 | 완벽 차단 불가, 워터마크 표시 |
| 복사/붙여넣기 | `user-select: none` CSS |
| iframe Embed | `X-Frame-Options` 차단 |

### 3.2 샌드박스 원칙

유배지 콘텐츠는 **앱 내부에서만 소비 가능**. 외부로 유출되지 않도록 모든 export 경로를 차단. 단, 화면 캡처(스크린샷)는 기술적으로 완벽히 막을 수 없으므로 워터마크(유저ID, 타임스탬프)를 표시하여 추적 가능성을 확보.

---

## 4. 공개 프로필 & 내 정보 정책

### 4.1 공개 프로필 (Public Profile) — 유배자

**일반 유저가 유배자 프로필을 볼 때:**

```
┌─────────────────────────────┐
│  👤 [닉네임]                 │
│  🏚️ 현재 놀부의 곳간에        │
│     수감 중 (1범)            │
│                             │
│  📝 작성한 글 (과거 글)      │
│  💬 댓글 활동                │
│                             │
│  [🏀 땡스볼 보내기]          │
│  [🚨 신고하기]               │
└─────────────────────────────┘
```

**핵심:** 수감 상태를 공개 표시하여 시스템 신뢰도 확보
- "이 사람 신고당했구나" 공개적으로 인지 가능
- 일반 유저가 "도와줄까 말까" 판단 가능

### 4.2 내 정보 페이지 제한 (유배 중)

| 기능 | 허용 | 이유 |
|:---|:---:|:---|
| 닉네임 변경 | ❌ | 신원 세탁 방지 |
| 프로필 사진 변경 | ❌ | 신원 세탁 방지 |
| 자기소개 변경 | ⚠️ | 허용 + 욕설 필터 강제 |
| 땡스볼 잔액 조회 | ✅ | 속죄금 마련 확인 |
| 전과 기록 조회 | ✅ | "왜 갇혔는지" 확인 |
| 알림 설정 | ✅ | 기본 기능 |
| 비밀번호 변경 | ✅ | 보안 기본 |
| 회원 탈퇴 | ❌ | 탈퇴로 도망 방지 |

**핵심:** 유배 중 회원 탈퇴는 반드시 차단. 그렇지 않으면 "신고→탈퇴→재가입"으로 시스템 무력화.

---

## 5. 휴대폰 인증 (지연 인증 전략)

### 5.1 기본 원칙

> **"휴대폰 인증은 필요할 때 한 번만. 이미 인증된 유저는 재요구하지 않는다."**

### 5.2 인증 트리거 시점

| 시점 | 인증 | 이유 |
|:---|:---:|:---|
| 회원가입 | ❌ | 진입 장벽 최소화 |
| 일반 활동 | ❌ | 99% 유저는 무인증 |
| **첫 유배 해제 시** | ✅ | 신원 확보 시점 |
| 2차/3차 유배 해제 | ❌ | 이미 인증됨 |
| 사약 후 재가입 | ✅ 차단 | 번호 블랙리스트 |

### 5.3 로직 흐름

```
[가입] → 이메일만 → 자유 활동
              ↓
      [신고당해서 1차 유배]
              ↓
   [반성 기간 경과 + 속죄금 마련]
              ↓
      [🔓 풀려나기] 버튼 클릭
              ↓
   ┌─ 이미 인증된 번호 있음? ─┐
   │                          │
  YES                        NO
   │                          │
   ↓                          ↓
 속죄금만 결제          ① 휴대폰 인증
 후 즉시 복귀           ② 블랙리스트 체크
                       ③ 속죄금 결제
                       ④ 복귀
                            ↓
              phoneVerified = true 저장
              (다시는 인증 요구 안 함)
```

### 5.4 기술 스택

- **Firebase Phone Auth**
- 월 10,000건까지 무료 → 1인 개발 규모에서 사실상 공짜
- 연동 난이도: 1~2시간
- 번호 원본 저장 X, `sha256` 해시만 저장 (개인정보 최소수집)

### 5.5 사약 블랙리스트

사약 처분 시 해당 유저의 `phoneHash`가 `banned_phones` 컬렉션에 등록됨. 이후 어떤 계정이 해제 시점에 같은 번호를 인증하려 하면 즉시 차단. 대포폰을 쓰지 않는 한 사실상 영구 차단.

---

## 6. 해금 절차 (Release Process)

### 6.1 완전한 해금 플로우

```
┌──────────────────────────────────────────┐
│   [🔓 풀려나기] 버튼 클릭                 │
└──────────────────────────────────────────┘
                ↓
┌──────────────────────────────────────────┐
│  Step 0: 사전 검증                        │
│  ├─ sanctionStatus가 exiled 상태?        │
│  ├─ sanctionExpiresAt 경과?              │
│  └─ thanksBalls >= requiredBail?         │
│     ❌ 하나라도 실패 → 에러 리턴           │
└──────────────────────────────────────────┘
                ↓
┌──────────────────────────────────────────┐
│  Step 1: 휴대폰 인증 (조건부)             │
│  if (phoneVerified === false) {          │
│    → Firebase Phone Auth 모달            │
│    → OTP 입력 → 검증                     │
│    → banned_phones 블랙리스트 체크       │
│    → phoneVerified = true 저장           │
│  } else 스킵                              │
└──────────────────────────────────────────┘
                ↓
┌──────────────────────────────────────────┐
│  Step 2: 속죄금 결제 확인 모달            │
│  "🏀 10볼을 내고 곳간에서 나가시겠습니까?"│
│  [취소] [확인]                            │
└──────────────────────────────────────────┘
                ↓
┌──────────────────────────────────────────┐
│  Step 3: releaseFromExile() 트랜잭션      │
│                                           │
│  ① 속죄금 차감                             │
│    users/{uid}.thanksBalls -= requiredBail│
│                                           │
│  ② 속죄금 소각                             │
│    platform_revenue/penalty += requiredBail│
│                                           │
│  ③ 깐부 관계 전부 제거 (양방향)            │
│    - 내 kkanbus 배열 비우기              │
│    - 상대방들의 kkanbus에서 나 제거       │
│    - 상대방들의 kkanbuCount -1           │
│    - 내 kkanbuCount = 0                  │
│                                           │
│  ④ 깐부방 멤버십 전부 해제                 │
│    - 호스트였던 경우: handleHostVacancy()│
│      호출 (깐부방 시스템에 위임)           │
│    - 단순 멤버였던 경우: members에서 제거 │
│                                           │
│  ⑤ 유배 상태 해제                          │
│    - sanctionStatus = 'active'           │
│    - sanctionExpiresAt = null            │
│    - requiredBail = 0                    │
│                                           │
│  ⑥ 이력 적재                               │
│    - release_history 컬렉션에 기록        │
│                                           │
│  ⑦ strikeCount는 건드리지 않음 (영구 보존)│
└──────────────────────────────────────────┘
                ↓
┌──────────────────────────────────────────┐
│  Step 4: 복귀 연출 (Client)              │
│  ├─ 곳간 문 열리는 애니메이션             │
│  ├─ "빈손으로 돌아왔습니다" 메시지        │
│  ├─ "깐부 관계 초기화" 안내               │
│  └─ 3초 후 홈 피드로 자동 이동            │
└──────────────────────────────────────────┘
```

### 6.2 복귀 화면 문구

```
━━━━━━━━━━━━━━━━━━━━━━
      🏚️ → 🏠
━━━━━━━━━━━━━━━━━━━━━━

곳간 문이 열렸습니다.

당신은 속죄금 🏀 10볼을 바치고
1차 유배에서 풀려났습니다.

그러나 곳간에서 나오는 자는
빈손으로 나와야 하는 법...

• 모든 깐부 관계가 초기화되었습니다.
• 가입했던 모든 깐부방에서 나왔습니다.
• 전과 기록: 1범 (영구 보존)

다시 좋은 사람으로 살아가시오.

      [홈으로 돌아가기]
```

### 6.3 리셋 대상 vs 유지 대상

| 항목 | 처리 | 비고 |
|:---|:---:|:---|
| 깐부 관계 전체 | 🔴 리셋 | 양방향 제거 |
| 깐부 수 (내 카운트) | 🔴 리셋 | 0으로 |
| 상대방의 깐부 수 | 🔴 감소 | -1 반영 |
| 깐부방 멤버십 | 🔴 탈퇴 | 전체 방에서 |
| 작성한 게시물 | 🟢 유지 | 과거 글 남음 |
| 받은 좋아요/댓글 | 🟢 유지 | |
| 보유 땡스볼 잔액 | 🟢 유지 | 속죄금 후 잔액 |
| 공개 프로필 | 🟢 유지 | 깐부 수만 0 표시 |
| 전과 (strikeCount) | 🟢 유지 | 영구 보존 |
| 휴대폰 인증 상태 | 🟢 유지 | 영구 보존 |

---

## 7. 사약 (Sayak) 시스템

### 7.1 사약 발동 조건

1. 4차 신고 누적 (strikeCount가 4에 도달)
2. 무기한 유배 상태 90일 경과 (자동 사약)
3. 관리자 직권 처분 (중대 사안)

### 7.2 사약 전용 연출

**진입 시점:** 4차 징계가 적용된 유저의 다음 앱 접속

**연출 시퀀스:**

1. 암전 (1초)
2. 두루마리 등장 애니메이션 (1.5초)
3. 선고 문구 타이핑 효과:

   ```
   ━━━━━━━━━━━━━━━━━━━━━━━━
   
   대장의 명으로 사약이 내려졌소.
   
   지속적인 비윤리적 행위로 인해
   글러브(할말있소)에서 영구 추방되었습니다.
   
   • 누적 전과: 4범
   • 최종 처분: 영구 정지 및 자산 몰수
   • 재가입: 영구 불가
   
   ━━━━━━━━━━━━━━━━━━━━━━━━
   ```

4. 3초 카운트다운 (3... 2... 1...)
5. 강제 로그아웃
6. 재로그인 차단

### 7.3 사약 처리 내용

- 보유 땡스볼 → 전액 `platform_revenue/sayak_seized`로 회수
- 작성한 게시물 → soft delete (`isDeletedBySayak: true`)
- 깐부방 호스트였을 경우 → `handleHostVacancy()` 호출
- 모든 깐부 관계 제거
- `phoneHash` → `banned_phones` 컬렉션에 등록 (재가입 차단)
- `sanctionStatus = 'banned'`
- 세션 강제 무효화

---

## 8. Firestore 데이터 모델

### 8.1 users 컬렉션 확장 필드

```typescript
interface UserSanctionFields {
  // 유배 관련
  strikeCount: number;              // 누적 유배 횟수 (기본 0)
  sanctionStatus: 'active' 
                | 'exiled_lv1' 
                | 'exiled_lv2' 
                | 'exiled_lv3' 
                | 'banned';
  sanctionExpiresAt: Timestamp | null;  // 속죄금 결제 가능 시점
  requiredBail: number;             // 필요 속죄금
  sanctionReason?: string;          // 관리자 입력 사유
  sanctionedAt?: Timestamp;         // 유배 시작 시각
  sanctionedBy?: string;            // 처분 관리자 UID
  
  // 휴대폰 인증 관련
  phoneVerified: boolean;           // 인증 여부 (기본 false)
  phoneHash: string | null;         // sha256(phoneNumber)
  phoneVerifiedAt: Timestamp | null;
}
```

### 8.2 신규 컬렉션

#### `bail_history`
속죄금 결제 이력

```typescript
{
  uid: string;
  strikeLevel: 1 | 2 | 3;
  amountPaid: number;
  paidAt: Timestamp;
  releasedAt: Timestamp;
}
```

#### `release_history`
해금 이력 (깐부 리셋 포함 전체 트랜잭션 기록)

```typescript
{
  uid: string;
  strikeLevel: 1 | 2 | 3;
  atonementFeePaid: number;
  kkanbusRemovedCount: number;
  roomsLeftCount: number;
  releasedAt: Timestamp;
}
```

#### `banned_phones`
사약 블랙리스트

```typescript
{
  phoneHash: string;       // 문서 ID로 사용
  bannedAt: Timestamp;
  originalUid: string;
  reason: 'sayak';
}
```

#### `platform_revenue/penalty`
속죄금 소각 누적

```typescript
{
  totalAmount: number;
  totalTransactions: number;
  lastUpdated: Timestamp;
}
```

#### `platform_revenue/sayak_seized`
사약 자산 몰수 누적

```typescript
{
  totalAmount: number;
  totalSayakCount: number;
  lastUpdated: Timestamp;
}
```

#### `exile_posts` / `exile_comments`
유배지 전용 게시판 (기존 `posts`와 분리)

```typescript
{
  uid: string;              // 작성자 (유배자)
  level: 1 | 2 | 3;         // 작성된 탭
  content: string;          // DOMPurify 처리됨
  createdAt: Timestamp;
  likes: number;
  thanksBallsReceived: number;
  // 외부 공유 URL은 생성하지 않음
}
```

### 8.3 Firestore Rules 핵심 정책

- `sanctionStatus !== 'active'` 인 유저는 일반 컬렉션 쓰기 차단 (`posts`, `comments`, `community_posts`, `notifications` 등)
- `exile_posts` 쓰기는 해당 `level`의 유배자만 허용
- `sanctionStatus` 필드는 클라이언트 수정 절대 불가 (서버 전용)
- `strikeCount`도 서버 사이드에서만 증가 가능
- `phoneHash`, `phoneVerified`도 서버 전용 수정
- `banned_phones` 컬렉션은 Cloud Function만 쓰기 가능
- `platform_revenue` 컬렉션은 Cloud Function만 쓰기 가능
- 일반 유저의 `exile_posts` 읽기는 허용 (관전)
- 유배자의 일반 `posts` 읽기는 허용 (과거 글 확인)

---

## 9. Cloud Functions 구현 명세

### 9.1 `sendToExile(targetUid, reason, adminUid)`

- **권한:** 관리자만
- **입력:** 대상 UID, 사유, 처분자 UID
- **동작:**
  1. `strikeCount` 증가
  2. 단계 자동 판정 (1/2/3/4)
  3. 필드 일괄 업데이트 (트랜잭션)
  4. 4차 도달 시 `executeSayak()` 자동 호출
  5. `sanction_log` 컬렉션에 감사 로그 기록

### 9.2 `releaseFromExile(uid, phoneNumber?)`

- **권한:** 본인만
- **검증:**
  - `sanctionStatus`가 exiled 상태인지
  - `sanctionExpiresAt` 경과 확인
  - `thanksBalls >= requiredBail` 확인
  - `phoneVerified === false` 인 경우 `phoneNumber` 필수
- **동작:**
  - **Step 1:** 휴대폰 미인증자만 → 번호 검증 + 블랙리스트 체크
  - **Step 2:** 속죄금 차감 + 소각
  - **Step 3:** 깐부 관계 전체 제거 (양방향)
  - **Step 4:** 깐부방 탈퇴 처리 (호스트였으면 `handleHostVacancy` 호출)
  - **Step 5:** `sanctionStatus = 'active'`
  - **Step 6:** `release_history` 기록
- **동시성:** 단일 Firestore 트랜잭션으로 처리

### 9.3 `executeSayak(targetUid, reason)`

- **권한:** 관리자 또는 내부 호출 (`sendToExile`, `checkAutoSayak`)
- **동작:**
  - 자산 전액 `platform_revenue/sayak_seized`로 회수
  - `phoneHash`를 `banned_phones`에 등록
  - `sanctionStatus = 'banned'`
  - 모든 활동 기록 soft delete
  - 깐부방 호스트 공백 처리
  - 세션 강제 무효화

### 9.4 `checkAutoSayak()` — Scheduled Function

- **스케줄:** 매일 1회 (cron: `"0 4 * * *"` — 새벽 4시)
- **동작:**

```typescript
const ninetyDaysAgo = now - 90 * 24 * 60 * 60 * 1000;
const longExiled = await db.collection('users')
  .where('sanctionStatus', 'in', 
         ['exiled_lv1', 'exiled_lv2', 'exiled_lv3'])
  .where('sanctionedAt', '<=', ninetyDaysAgo)
  .get();

for (const user of longExiled.docs) {
  await executeSayak(user.id, 'AUTO_SAYAK_90D_UNPAID');
}
```

### 9.5 `sendThanksBallToExile(fromUid, toUid, amount)`

- **권한:** 일반 유저만 (`fromUid`의 `sanctionStatus === 'active'`)
- **검증:**
  - 송신자가 일반 유저인지
  - 수신자가 유배자인지
  - 송신자 잔액 충분한지
- **동작:**
  - 송신자 잔액 차감
  - 수신자 잔액 증가
  - 트랜잭션 기록

---

## 10. 라우팅 가드 (App.tsx 의사코드)

```typescript
function App() {
  const { user, sanctionStatus } = useAuth();

  // 1. 비로그인
  if (!user) return <LoginPage />;

  // 2. 사약 받은 유저
  if (sanctionStatus === 'banned') {
    return <SayakScreen onComplete={forceLogout} />;
  }

  // 3. 유배 중인 유저
  if (sanctionStatus?.startsWith('exiled_')) {
    return (
      <ExileLayout>
        <ExileSidebar />  {/* 유배귀양지 + 내정보만 */}
        <Routes>
          <Route path="/exile" element={<ExileMainPage />} />
          <Route path="/myinfo" 
                 element={<MyInfoPage restricted={true} />} />
          <Route path="*" element={<Navigate to="/exile" />} />
        </Routes>
      </ExileLayout>
    );
  }

  // 4. 정상 유저
  return <NormalAppLayout />;
}
```

---

## 11. 리스크 대응

### 11.1 유배지 내 2차 가해

- **리스크:** 분노한 유저들이 모인 공간이 더 험해질 수 있음
- **대응:**
  - 유배지 내에서도 신고 기능 작동
  - 유배 중 추가 신고 → 단계 즉시 승급 (정책 수립 TODO)
  - DOMPurify 엄격 적용

### 11.2 악성 유저 사교장화

- **리스크:** 비슷한 가치관의 유저들끼리 결속
- **대응:**
  - 유배지 내 1:1 DM 차단
  - 깐부 신청 차단
  - 공개 글/댓글만 허용 (사적 관계 형성 차단)

### 11.3 일반 유저의 유해 콘텐츠 노출

- **리스크:** 관전하러 온 일반 유저가 험한 말에 노출
- **대응:**
  - 유배지 진입 시 경고 모달
  - DOMPurify 필터링
  - 심한 콘텐츠 자동 마스킹

### 11.4 성지순례 역효과

- **리스크:** 악성 유저가 오히려 관심을 즐김
- **대응:**
  - 유배자 닉네임 자동 익명화 (`곳간 거주자 #4821`)
  - 프로필 직접 조회 제한
  - 본인은 자기 ID 알지만, 타인은 익명으로만 인지

### 11.5 신고 남용

- **리스크:** 무고한 신고로 유배
- **대응:**
  - 관리자 검토 단계 필수 (자동 유배 없음)
  - 이의 제기 채널 제공 (TODO)
  - 무고 신고자 패널티 (TODO)

---

## 12. 외부 시스템 연동

### 12.1 깐부방 시스템

- **의존:** `handleHostVacancy()` 유틸 함수
- **호출 시점:**
  - `releaseFromExile()` Step 4
  - `executeSayak()` 내부
- **구현 위치:** 깐부방 시스템 (별도 과제)

> ※ 해당 과제는 깐부방 기획서에서 관리. 본 유배 시스템은 해당 함수를 호출만 함.

### 12.2 신고 시스템 (`reports`)

이미 구현된 공개프로필/팝업의 🚨 신고하기 버튼이 본 시스템의 진입점. 관리자 대시보드에서 유배 처분 내림.

### 12.3 땡스볼 시스템

기존 땡스볼 송금 로직에 `sanctionStatus` 체크 추가. 송신자/수신자 중 어느 쪽이 유배자인지에 따라 허용/차단.

---

## 13. TODO (미결정 / 후속 논의)

### 정책

- [ ] 유배 중 추가 신고 시 처리 (즉시 승급 vs 누적 후 승급)
- [ ] 신고 남용 방지 (무고 신고자 패널티)
- [ ] 이의 제기 채널 (억울한 유배에 대한 소명)
- [ ] 사약 명단 공개 여부 (밈 활용 vs 명예훼손 리스크)
- [ ] 자동 신고 임계치 (누적 N건 시 관리자 우선 알림)

### UI/UX

- [ ] 1~3차 유배지 일러스트 디자인 발주
- [ ] 사약 선고 사운드 디자인 (전통 악기 검토)
- [ ] 곳간 문 열림 애니메이션
- [ ] 유배지 탭별 차등화된 비주얼 톤

### 외부 연동

- [ ] `handleHostVacancy()` 구현 (깐부방 기획서 과제)

### 기술

- [ ] Firebase Phone Auth 연동
- [ ] 스크린샷 워터마크 구현
- [ ] `exile_posts` 컬렉션 설계 확정
- [ ] `banned_phones` 블랙리스트 Rules 작성

### 글로벌화

- [ ] 영어/일본어 로컬라이제이션 문구 검수
- [ ] "Sayak" 고유명사 브랜드 가이드

---

## 14. 구현 우선순위 (Implementation Phases)

### Phase 1 — MVP (필수) ✅ 완료 (2026-04-14)

- [x] `users` 컬렉션 확장 필드 추가 (types.ts `UserData` + `SANCTION_POLICIES`)
- [x] Firestore Rules 작성 (bail_history/release_history/banned_phones/sanction_log/exile_posts/exile_comments)
- [x] `sendToExile` / `releaseFromExile` Cloud Function (`functions/storehouse.js`)
- [x] 라우팅 가드 (App.tsx useEffect + Sidebar `isExiled`)
- [x] 유배귀양지 메인 페이지 3탭 (`ExileMainPage.tsx`)
- [x] 상태 카드 + 반성 기간 카운트다운 + 속죄금 결제 버튼
- [x] 관리자 대시보드 [유배 보내기] 탭 (`admin/ExileManagement.tsx`)
- [x] 사약 화면 (`SayakScreen.tsx`) — 10초 카운트다운 + 강제 로그아웃
- [x] 테스트 계정: 불량깐부1~3호 (Lv3/4/5)

### Phase 2 — 핵심 기능 ✅ 완료 (2026-04-14)

- [x] `exile_posts` 게시판 구현 (`ExileBoard.tsx`)
- [x] 일반 유저의 유배지 관전 뷰 (익명 닉네임 "곳간 거주자 #NNNN")
- [x] 땡스볼 송금 가드 — 유배자 송금 차단 (수신 허용)
- [x] 깐부 리셋 로직 (Phase 1 `releaseFromExile`에서 양방향 제거)
- [x] 공개 프로필 "🏚️ 수감 중 · N범" 배지 + "☠️ 사약" 배지
- [x] 내 정보 페이지 상단 경고 배너 (처분 사유 + 곳간 이동 안내)

### Phase 3 — 강화 기능 (일부 완료 2026-04-14)

- [x] 사약 시스템 + SayakScreen 연출 (Phase 1에서 이미 완성)
- [x] `executeSayak` Cloud Function — 자산 몰수 + 모든 글 soft delete + banned_phones 등록 + 깐부 리셋 + 감사 로그
- [x] `checkAutoSayak` 스케줄러 — 매일 04:00, 유배 90일 경과 자동 사약
- [x] 문제 글 soft delete (`isHiddenByExile`) + 피드 필터링 (Step 3a)
- [x] `sendToExile` postId 파라미터로 신고 대상 글 자동 숨김
- [x] 관리자 [☠️ 직권 사약] UI
- [ ] Firebase Phone Auth 연동 (별도 발급 필요)
- [ ] `banned_phones` 블랙리스트 가입 차단 (Phone Auth 선결)

### Phase 4 — 완성도

- [ ] 유배지 일러스트/사운드
- [ ] 애니메이션 연출
- [ ] 익명화 처리
- [ ] 로컬라이제이션
- [ ] 이의 제기 채널

---

**END OF v0.2**
