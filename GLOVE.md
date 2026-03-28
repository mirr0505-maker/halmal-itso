# 🧤 우리들의 장갑 — 설계 및 구현 문서 (GLOVE.md)

> 최종 갱신: 2026-03-28 v1.0  |  연계 파일: `blueprint.md` §8

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
- 활성 멤버 목록 + 손가락 배지
- thumb/index에게 역할 변경 드롭다운(index~pinky) + 강퇴 버튼 (본인·thumb 제외)

**관리 탭** (`CommunityAdminPanel`)
- 승인 대기 섹션: 신청 메시지 표시 + 승인/거절 버튼
- 장갑 설정 수정: 이름·설명·분야·색상 변경 저장
- 공지 고정 현황: 현재 고정 글 안내 + 고정 해제 버튼
- 장갑 폐쇄 (thumb 전용): 2단계 confirm → writeBatch로 멤버십 전체 삭제 + communities 문서 삭제

---

## 7. 알림 시스템 (Phase 4)

### Opt-in 구독
- `community.notifyMembers[]`에 userId 저장 (`arrayUnion/arrayRemove`)
- 토글 버튼: 가입 멤버에게만 노출, 헤더 우측에 배치

### 새 글 알림 push
```
조건: 구독자(notifyMembers) 수 ≤ 50명
동작: 글 작성 후 구독자 순회 → notifications/{nickname}/items 자동 push
type: 'community_post'
message: '[커뮤니티명] 글 제목'
```
> ⚠️ Cloud Functions 미사용 (Spark 플랜) — 앱 레이어 N writes 방식. 멤버 51명 이상 장갑은 write 비용 절감을 위해 알림 스킵.

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
match /community_memberships/{id} {
  allow read: if request.auth != null;
  allow create: if request.auth != null;
  allow update, delete: if request.auth != null
    && (resource.data.userId == request.auth.uid
     || request.resource.data.keys().hasAny(['finger', 'joinStatus', 'banReason']));
}
match /community_posts/{id} {
  allow read: if true;
  allow write: if request.auth != null;
  match /{sub=**} { allow read: if true; allow write: if request.auth != null; }
}
```

> 역할 기반 세분화(thumb/index만 강퇴 가능 등)는 **앱 레이어(CommunityView, CommunityAdminPanel)에서 처리**.
> Cloud Functions 미사용 환경에서 Rules만으로 역할 검증은 불가 → isAdmin 체크로 UI 차단.

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

---

## 11. 미구현 / 향후 과제

- [ ] **커뮤니티 내 검색**: 가입 커뮤니티 피드 내 키워드 검색 (Firestore 텍스트 검색 한계 → Algolia 연동 필요)
- [ ] **알림 51명+ 장갑 대응**: Cloud Functions(Blaze 플랜 업그레이드 후) 또는 알림 배치 처리
- [ ] **성향 제한**: 특정 칭호(블루 기여자 이상 등) 보유자만 가입 가능 설정
- [ ] **투표(Poll) 기능**: 중지 이상 멤버 전용 투표 생성 권한
- [ ] **커뮤니티 게시글 삭제**: 현재 글 삭제 기능 미구현 (작성자/관리자 삭제 버튼 필요)
- [ ] **강퇴 후 재가입 차단**: `joinStatus: 'banned'` 확인 로직 미구현
