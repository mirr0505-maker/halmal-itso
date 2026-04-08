# 🧤 우리들의 장갑 — 설계 및 구현 문서 (GLOVE.md)

> 최종 갱신: 2026-04-08 v1.3 (Phase 7 실시간 채팅방)  |  연계 파일: `blueprint.md` §8

---

## 1. 개요

**우리들의 장갑(Glove)** 은 GLove 플랫폼 내 커뮤니티 시스템입니다.
관심사 기반 소규모 모임(커뮤니티)을 개설·가입하고, 구성원끼리 글과 댓글을 나눌 수 있습니다.
**다섯 손가락 운영 체제**로 역할·권한·가입 조건을 정밀하게 관리합니다.

---

## 2. Firestore 컬렉션 구조

| 컬렉션 | 용도 | ID 규칙 |
|--------|------|---------|
| `communities` | 커뮤니티 메타데이터 | `community_{timestamp}_{uid}` |
| `community_memberships` | 멤버십 플랫 컬렉션 (userId 역조회) | `{communityId}_{userId}` |
| `community_posts` | 커뮤니티 게시글 | `cpost_{timestamp}_{uid}` |
| `community_post_comments` | 커뮤니티 글 댓글 | `cpcomment_{timestamp}_{uid}` |
| `community_chats/{communityId}/messages` | 실시간 채팅 메시지 (서브컬렉션) | `chat_{timestamp}_{uid8자}` |

---

## 3. 타입 정의 (`src/types.ts`)

```typescript
// 🖐 다섯 손가락 역할
export type FingerRole = 'thumb' | 'index' | 'middle' | 'ring' | 'pinky';

// 가입 방식
export type JoinType = 'open' | 'approval' | 'password';

// 멤버 가입 상태
export type JoinStatus = 'active' | 'pending' | 'banned';

export interface Community {
  id: string;                    // community_timestamp_uid
  name: string;
  description?: string;
  category: string;              // 주식|부동산|코인|취미|스포츠|게임|독서|요리|반려동물|여행|음악|개발|기타
  isPrivate: boolean;            // 레거시 — joinType으로 대체됨
  creatorId: string;
  creatorNickname: string;
  creatorLevel: number;
  memberCount: number;           // increment 비정규화
  postCount: number;             // increment 비정규화
  coverColor?: string;           // 대표 색상 (8색 팔레트)
  createdAt: any;
  // 가입 조건
  joinType?: JoinType;           // 가입 방식 (미설정 시 'open')
  minLevel?: number;             // 최소 가입 레벨 (미설정 시 1)
  password?: string;             // 초대 코드 (joinType='password'일 때)
  joinQuestion?: string;         // 승인제 가입 시 안내 문구
  // 운영
  pinnedPostId?: string;         // 공지 고정 글 ID
  notifyMembers?: string[];      // 새 글 알림 opt-in userId 목록
  // Phase 6 — 가입 폼 빌더 (approval 전용)
  joinForm?: JoinForm;           // 표준 필드 5개 + 커스텀 질문 (최대 5개 합산)
}

export interface CommunityMember {
  userId: string;
  nickname: string;
  communityId: string;
  communityName: string;
  joinedAt: any;
  role: 'owner' | 'member';     // 레거시 — finger로 대체됨
  finger?: FingerRole;           // 다섯 손가락 역할 (미설정 시 role로 폴백)
  joinStatus?: JoinStatus;       // 가입 상태 (미설정 시 'active')
  joinMessage?: string;          // 승인제 가입 신청 메시지
  banReason?: string;            // 강퇴/차단 사유
  // Phase 6 — 가입 답변 + 인증 마킹
  joinAnswers?: JoinAnswers;     // 신청자가 제출한 구조화된 답변 (영구 보존)
  verified?: VerifiedBadge;      // 🛡️ 인증 마킹 (thumb/index가 부여)
}

export interface CommunityPost {
  id: string;                    // cpost_timestamp_uid
  communityId: string;
  communityName: string;
  author: string;
  author_id: string;
  title?: string;
  content: string;               // HTML (TiptapEditor)
  imageUrl?: string;
  likes: number;
  likedBy?: string[];
  commentCount: number;
  createdAt: any;
  isPinned?: boolean;            // 공지 고정 여부 (thumb/index만 설정 가능)
  isBlinded?: boolean;           // 관리자 블라인드 처리
}

// Phase 6 — 가입 폼 빌더 + 인증 시스템
export type StandardFieldKey = 'name' | 'region' | 'phone' | 'email' | 'shares';
export type SharesUnit = '1' | '10' | '100' | '1000';
export interface Region { sido: string; sigungu: string; }
export interface StandardField { key: StandardFieldKey; enabled: boolean; required: boolean; sharesUnit?: SharesUnit; sharesLabel?: string; }
export interface CustomQuestion { id: string; label: string; placeholder?: string; required: boolean; maxLength?: number; }
export interface JoinForm { standardFields: StandardField[]; customQuestions: CustomQuestion[]; }
export interface JoinAnswers {
  standard?: { name?: string; region?: Region; phone?: string; email?: string; shares?: { value: number; unit: SharesUnit; label?: string }; };
  custom?: Array<{ questionId: string; question: string; answer: string; }>;
}
export interface VerifiedBadge { verifiedAt: any; verifiedBy: string; verifiedByNickname: string; label: string; }
```

---

## 4. 🖐 다섯 손가락 역할 체계

| 손가락 | 역할명 | 배지 | 획득 조건 | 주요 권한 |
|--------|--------|------|-----------|-----------|
| 👍 **엄지 (thumb)** | 개설자 | 노란색 | 장갑 개설 시 자동 (단 1명) | 모든 권한. 장갑 폐쇄. index 임명/해임. |
| ☝️ **검지 (index)** | 부관리자 | 파란색 | thumb이 임명 | 승인/거절, 역할 변경, 강퇴, 설정 수정, 공지 고정 |
| 🖐 **중지 (middle)** | 핵심멤버 | 보라색 | 기여도 자동 산정 or thumb 임명 | 특별 배지 표시 |
| 🤝 **약지 (ring)** | 일반멤버 | 초록색 | 가입 승인 시 기본 부여 | 글·댓글·좋아요·땡스볼 |
| 🤙 **새끼 (pinky)** | 신입/대기 | 슬레이트 | 승인제 가입 신청 시 임시 부여 | 대기 중 — 읽기 전용 |

### 역할 폴백 규칙 (레거시 하위호환)
```
finger 없음 + role='owner' → thumb으로 취급
finger 없음 + role='member' → ring으로 취급
```

---

## 5. 가입 방식 (JoinType)

| 방식 | 표시 | 동작 |
|------|------|------|
| `open` | 🟢 자동 승인 | 버튼 클릭 즉시 → `finger: 'ring', joinStatus: 'active'` |
| `approval` | 🔵 승인제 (노크) | 가입 신청 → `finger: 'pinky', joinStatus: 'pending'` → thumb/index 승인 시 ring/active 전환 |
| `password` | 🔒 초대 코드 | 입력 코드 === `community.password` 확인 후 open과 동일 처리 |

### 최소 레벨 체크
`handleJoinCommunity` 진입 시 `community.minLevel > userData.level` 이면 가입 차단.

### Phase 6: 가입 폼 빌더 + 인증 마킹

**가입 폼 빌더** (`CreateCommunityModal`, approval 전용):
- 표준 필드 5개: 이름/지역/연락처/이메일/보유수량 — enabled/required 토글
- 보유수량: 종목명(sharesLabel) + 단위(1/10/100/1000주) 설정
- 커스텀 질문: 자유 텍스트, 표준 + 커스텀 합산 최대 5개
- Firestore: `community.joinForm` 필드에 저장

**신청자 가입 폼** (`JoinCommunityModal`):
- joinForm 있으면 폼 빌더 모드 (이름/지역 2단 셀렉트/연락처/보유수량 곱셈 미리보기/커스텀 질문)
- 없으면 레거시 모드 (단순 메시지 textarea)
- 답변은 `community_memberships.joinAnswers`에 영구 보존

**인증 마킹 시스템** (멤버 탭, thumb/index 전용):
- 승인과 인증은 2단계 분리: 승인(pinky→ring) → 인증(verified 부여)
- `VerifyMemberModal`: 라벨 입력 + 추천칩 + 가입 답변 확인 + 미리보기
- `VerifiedBadge`: `🛡️ {label} 인증 ({YY.M.D})` 형태, 멤버 탭 + 글 작성자 옆에 표시
- 인증 해제: `deleteField()`로 verified 제거

**Firestore Rules** (Step 5 보강):
- create: 본인 명의만 (`userId == auth.uid`)
- 본인 update: verified/finger/joinStatus/banReason 변경 차단
- 관리자 update: `hasOnly` 검증, joinAnswers 수정 불가

---

## 6. UI 구조

### 6.1 헤더 바 (App.tsx sticky)
```
#우리들의 장갑  |  [💬 소곤소곤]  [🧤 장갑 찾기]  [+ 장갑 만들기 (Lv3+)]
```
- 소곤소곤: `CommunityFeed` (가입 커뮤니티 통합 피드)
- 장갑 찾기: `CommunityList` (전체 목록, 카테고리 필터)
- 장갑 만들기: `CreateCommunityModal`
- 우측 사이드바 (데스크톱): `MyCommunityList compact=true` — 내가 가입한 장갑 목록

### 6.2 CreateCommunityModal
- 이름 / 설명 / 분야(13종, 주식·부동산·코인 우선) / 대표 색상(8색)
- 가입 방식 3종 선택 UI + 조건부 입력 (초대코드 / 안내문구)
- Lv1~5 minLevel 셀렉터
- 실시간 미리보기 카드 (방식 배지 + 레벨 배지 표시)

### 6.3 CommunityView 탭 구조
```
[💬 소곤소곤]  [🤝 멤버 N]  [⚙️ 관리 (N)]  ← 관리 탭: thumb/index만 보임
```

**소곤소곤 탭**
- 공지 고정 글: 피드 최상단 amber 하이라이트 카드 (📌 공지 배지)
- 일반 글 목록: `isBlinded` 글 자동 필터, 관리자에게 📌 핀 버튼 + 🚫 블라인드 버튼 표시
- 헤더 우측: 🔔 알림 ON/OFF 토글 (가입 멤버만) + + 글 쓰기 버튼

**멤버 탭**
- 활성 멤버 목록 + 손가락 배지 + 🛡️ 인증 배지
- thumb/index에게: 📋 가입 답변 보기 + 🛡️ 인증 부여/해제 + 역할 변경 + 강퇴 (본인·thumb 제외)

**관리 탭** (`CommunityAdminPanel`)
- 승인 대기 섹션: joinAnswers 구조화 표시(JoinAnswersDisplay) 또는 레거시 joinMessage + 승인/거절 버튼
- 장갑 설정 수정: 이름·설명·분야·색상 변경 저장
- 공지 고정 현황: 현재 고정 글 안내 + 고정 해제 버튼
- 장갑 폐쇄 (thumb 전용): 2단계 confirm → writeBatch로 멤버십 전체 삭제 + communities 문서 삭제

---

## 7. 알림 시스템 (Phase 4)

### Opt-in 구독
- `community.notifyMembers[]`에 userId 저장 (`arrayUnion/arrayRemove`)
- 토글 버튼: 가입 멤버에게만 노출, 헤더 우측에 배치
- MyPage '내 장갑' 탭에서도 커뮤니티별 알림 ON/OFF 토글 가능

### 새 글 알림 push (writeBatch 원자성 보장)
```
조건: 구독자(notifyMembers) 수 ≤ 50명
동작: 글 작성 + postCount + users.likes + 구독자 알림을 단일 writeBatch로 처리
경로: notifications/{subscriberUid}/items  (UID 기반 — 닉네임 변경에도 안전)
type: 'community_post'
message: '[커뮤니티명] 글 제목'
```
> ⚠️ Cloud Functions 미사용 (Spark 플랜) — 앱 레이어 N writes 방식. 멤버 51명 이상 장갑은 write 비용 절감을 위해 알림 스킵.
> writeBatch 500문서 한도 내 동작 (구독자 ≤50 제한으로 충분).

---

## 8. 중지 자동 산정 (Phase 5)

```
트리거: 커뮤니티 내 새 글 작성 완료 시
조건: 해당 커뮤니티 내 내 글 수 ≥ 5개  OR  수신 좋아요 합계 ≥ 20개
대상: 현재 ring/pinky인 멤버만 (thumb/index/middle 이미 상위 → 스킵)
동작: finger: 'middle' 업데이트 + 본인 notifications에 "🖐 핵심멤버 승급" push
```

---

## 9. Firestore Security Rules

```
match /communities/{id} {
  allow read: if true;
  allow write: if request.auth != null;
  match /{sub=**} { allow read: if true; allow write: if request.auth != null; }
}

// community_memberships — Phase 6 보강 (2026-04-08)
match /community_memberships/{membershipId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null
    && request.resource.data.userId == request.auth.uid;  // 본인 명의만

  // 본인: verified/finger/joinStatus/banReason 변경 차단
  allow update: if request.auth != null
    && resource.data.userId == request.auth.uid
    && !request.resource.data.diff(resource.data).affectedKeys()
        .hasAny(['verified', 'finger', 'joinStatus', 'banReason']);
  allow delete: if request.auth != null
    && resource.data.userId == request.auth.uid;

  // 관리자: hasOnly 검증 (finger/joinStatus/banReason/role/verified만)
  // joinAnswers는 관리자도 수정 불가 (영구 보존)
  allow update: if request.auth != null
    && resource.data.userId != request.auth.uid
    && request.resource.data.diff(resource.data).affectedKeys()
        .hasOnly(['finger', 'joinStatus', 'banReason', 'role', 'verified'])
    && get(...).data.finger in ['thumb', 'index'];
  allow delete: if request.auth != null
    && resource.data.userId != request.auth.uid
    && get(...).data.finger in ['thumb', 'index'];
}

// community_chats — Phase 7 (2026-04-08)
// 읽기: 로그인 사용자, 생성: 본인 명의, 수정: 본인(soft delete) + 타인(이모지/땡스볼만), 삭제: 금지
match /community_chats/{communityId}/messages/{messageId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null && request.resource.data.author_id == request.auth.uid;
  allow update: if request.auth != null
    && (resource.data.author_id == request.auth.uid
      || request.resource.data.diff(resource.data).affectedKeys()
          .hasOnly(['reactions', 'thanksballTotal', 'thanksballSenders']));
  allow delete: if false;
}

// community_posts — delete 권한 서버사이드 검증 (2026-03-28 강화)
match /community_posts/{id} {
  allow read: if true;
  allow create, update: if request.auth != null;
  allow delete: if request.auth != null
    && (resource.data.author_id == request.auth.uid
      || get(/databases/$(database)/documents/community_memberships/$(resource.data.communityId + '_' + request.auth.uid)).data.finger in ['thumb', 'index']);
  match /{sub=**} { allow read: if true; allow write: if request.auth != null; }
}
```

> ⚠️ `get()` 호출은 Firestore 읽기 1회 소비. 강퇴/역할변경/글삭제 요청당 1 read 추가 발생.
> 앱 레이어(`CommunityView`, `CommunityAdminPanel`) isAdmin 체크는 UI 제어 목적으로 유지.

---

## 10. 개발 이력

| 날짜 | Phase | 내용 |
|------|-------|------|
| 2026-03-25 | 초기 구현 | Firestore 컬렉션, 기본 가입/탈퇴, CommunityView 글 작성·좋아요 |
| 2026-03-28 | UI 개편 | 4탭 → 2탭+버튼+사이드바, 헤더 바 통합, 주식·부동산·코인 카테고리 추가 |
| 2026-03-28 | Phase 1 | 타입 확장 (FingerRole·JoinType·JoinStatus), CreateCommunityModal 가입조건 UI, handleJoinCommunity joinType 분기 |
| 2026-03-28 | Phase 2 | CommunityView 3탭 구조, 손가락 배지, 멤버 탭, 관리 탭(승인/거절/역할변경/강퇴) |
| 2026-03-28 | Phase 3 | CommunityAdminPanel 신규, 공지 고정, 블라인드, 설정 수정, 장갑 폐쇄 |
| 2026-03-28 | Phase 4 | 커뮤니티 알림 Opt-in (notifyMembers + 글 작성 시 push) |
| 2026-03-28 | Phase 5 | 중지 자동 산정 (기여도 임계값 → finger: 'middle' 자동 승격) |
| 2026-03-28 | 보안·안정성 강화 | 알림 경로 UID 마이그레이션, 닉네임 변경 30일 쿨다운+배치 동기화, 강퇴 재가입 차단, 알림 writeBatch 원자성, Firestore Rules 서버사이드 권한 검증, 글 삭제 기능, 유저 전체 통계 합산, MyPage 활동 기록 통합, 내 장갑 탭 신규 |
| 2026-04-08 | Phase 6 Step 1 | 가입 폼 빌더 스키마 (JoinForm, JoinAnswers, VerifiedBadge 등 타입), regions.ts (17개 시/도 248개 시/군/구), joinForm.ts 유틸 |
| 2026-04-08 | Phase 6 Step 2 | CreateCommunityModal 가입 폼 빌더 UI (표준 필드 토글 + shares 확장 + 커스텀 질문 + 5개 슬롯 제한) |
| 2026-04-08 | Phase 6 Step 3 | JoinCommunityModal 신규 (폼 빌더 모드 + 레거시 모드), CommunityList 승인제 모달 분기, handleJoinCommunity joinAnswers 파라미터 |
| 2026-04-08 | Phase 6 Step 4A | JoinAnswersDisplay 신규 (구조화 답변 표시), CommunityAdminPanel 승인 대기 답변 렌더링 |
| 2026-04-08 | Phase 6 Step 4B | VerifiedBadge + VerifyMemberModal 신규, 멤버 탭 인증 부여/해제/가입답변 보기, 글 작성자 인증 배지 |
| 2026-04-08 | Phase 6 Step 5 | Firestore Rules 보강 (create 본인 명의, 본인 민감필드 차단, 관리자 hasOnly, joinAnswers 보호), 클라이언트 가드 |
| 2026-04-08 | Phase 6 Step 6 | 댓글 작성자 인증 배지, 글 상세 작성자 인증 배지, 비가입자 접근 제한(승인제 차단/open 읽기전용), GLOVE.md 전면 업데이트 |
| 2026-04-08 | Phase 7 Step 1 | ChatMessage 타입 + CHAT_MEMBER_LIMIT(50) + CommunityChatPanel placeholder + 채팅 탭 추가 |
| 2026-04-08 | Phase 7 Step 2 | 실시간 메시지 송수신 (onSnapshot limit 50 + cleanup), 카톡 스타일 좌/우 정렬, 작성자 스냅샷(Lv/finger/verified) |
| 2026-04-08 | Phase 7 Step 3 | 답장(replyTo snippet 50자) + 이모지 반응 6종(arrayUnion/arrayRemove 원자적) |
| 2026-04-08 | Phase 7 Step 4 | 이미지 업로드(R2 재사용, 📎+클립보드+드래그), 라이트박스 원본 보기 |
| 2026-04-08 | Phase 7 Step 5 | 채팅 땡스볼(기존 Cloud Function 확장, ThanksballModal 재사용, thanksballSenders 5명 한도) |
| 2026-04-08 | Phase 7 Step 6 | Firestore Rules 정식화, 페이징(스크롤 기반 30개씩), soft delete(본인+관리자), GLOVE.md Phase 7 반영 |

---

## 11. 미구현 / 향후 과제

- [x] ~~커뮤니티 댓글 인증 배지~~: Step 6에서 완료
- [ ] **인증 멤버 필터링**: 멤버 탭에서 "인증된 멤버만 보기" 필터 (선택적 편의 기능)
- [ ] **인증 만료 정책**: 1년 후 자동 만료 또는 재인증 요구 (장기 과제)
- [ ] **인증 라벨 통계**: 같은 라벨끼리 묶어 카운트 표시 ("주주 12명 / 거주민 5명")
- [ ] **커뮤니티 내 검색**: 가입 커뮤니티 피드 내 키워드 검색 (Firestore 텍스트 검색 한계 → Algolia 연동 필요)
- [ ] **알림 51명+ 장갑 대응**: Cloud Functions(Blaze 플랜 업그레이드 후) 또는 알림 배치 처리
- [ ] **성향 제한**: 특정 칭호(블루 기여자 이상 등) 보유자만 가입 가능 설정
- [ ] **투표(Poll) 기능**: 중지 이상 멤버 전용 투표 생성 권한
