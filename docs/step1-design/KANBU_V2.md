# 🤝 글러브(GeuLove) 깐부 관계 시스템 설계서 (KANBU_V2.md)

> **문서 목적**: 글러브의 **깐부 관계 시스템** 전담 설계서. 팔로우 관계, 네이밍, EXP 보상, 확장성 전략을 통합 관리.
>
> 작성일: 2026-04-19 v1.0
>
> **⚠️ 주의**: 본 문서는 **"관계"** 시스템 전담. **"깐부방"**(커뮤니티 공간)은 별도 문서 `KANBU.md` 참조.
>
> **참조 문서**: `GLOVE_SYSTEM_REDESIGN_v2.md` §4, `ANTI_ABUSE.md` §5, `LEVEL_V2.md`(예정), `CREATOR_SCORE.md`(예정)

---

## 📋 목차

- [0. 개요 & 원칙](#0-개요--원칙)
- [1. 현재 상태 진단](#1-현재-상태-진단)
- [2. 문제점 분석](#2-문제점-분석)
- [3. 용어 정립 (최종 확정)](#3-용어-정립-최종-확정)
- [4. 변경 방향](#4-변경-방향)
- [5. 데이터 모델](#5-데이터-모델)
- [6. 테스트 시나리오](#6-테스트-시나리오)
- [7. Step별 구현 우선순위](#7-step별-구현-우선순위)

---

## 0. 개요 & 원칙

### 0.1 문서 범위

본 문서는 **유저 간 팔로우 관계** 전담:
- 깐부 맺기/해제
- 깐부 / 깐부수 카운트
- 맞깐부 (상호 팔로우)
- 관계 기반 기능(깐부 홍보, 깐부방 입장 자격)의 기반 데이터

**범위 외**:
- 깐부방 (커뮤니티 공간) → `KANBU.md`
- 팔로우 알림 → 알림 시스템 설계서 (별도)
- 깐부 프로모션 → `GLOVE.md` §N

### 0.2 3대 원칙 (v2에서 확정)

| 원칙 | 내용 | 근거 |
|------|------|------|
| **단방향 유지** | 상호 동의 없는 단방향 팔로우 구조 유지 | 유튜브 모델, 크리에이터-팬 비대칭 자연스러움 |
| **네이밍 한국어** | UI는 깐부/깐부수/맞깐부, 변수는 기존 영문 유지 | 사용자 일관성 + 마이그레이션 비용 회피 |
| **확장성 대비** | 유저 규모별 단기/중기/장기 로드맵 준비 | 전체 users 구독이 1만 명 시점에 병목 |

### 0.3 핵심 관점 (크리에이터 중심)

> 🎯 **"나는 깐부수를 늘려야 한다"**
>
> - 깐부 = 내가 소비하는 축 (내가 팔로우하는 크리에이터)
> - 깐부수 = 내가 생산하는 축 (나를 팔로우하는 팬 = **크리에이터 성공 지표** ⭐)

유튜브 대응:
- 깐부 ≈ 내 "구독 중인 채널 목록"
- 깐부수 ≈ 내 "구독자 수"

### 0.4 개발 수칙 (CLAUDE.md 준수)

- **Strict Focus**: 깐부 관련 외 코드 변경 금지
- **Surgical Edit**: 변수명 rename 없음, UI 표기만 변경
- **선보고 후실행**: 각 변경마다 AS-IS/TO-BE 보고 후 진행
- **Human Readable**: 한글 UI 의미를 `types.ts` 주석으로 명시

---

## 1. 현재 상태 진단

### 1.1 데이터 구조 (실측)

**출처**: `src/types.ts:53`

```typescript
export interface UserData {
  // ...
  friendList?: string[];  // 내가 맺은 깐부의 닉네임 목록
}
```

**특징**:
- 저장 위치: **본인** `users` 문서의 배열
- 키: **닉네임 문자열** (UID 아님)
- 상대방 문서에는 **아무 쓰기 없음** → **완전 단방향**
- 양방향(맞깐부) 판별: 양쪽 `friendList`를 모두 조회해야 함

### 1.2 토글 로직

**출처**: `src/hooks/useFirestoreActions.ts:215-226`

```typescript
const toggleFriend = async (author: string) => {
  const isFriend = userData.friendList?.includes(author);
  await updateDoc(doc(db, 'users', userData.uid), {
    friendList: isFriend ? arrayRemove(author) : arrayUnion(author),
    exp: increment(isFriend ? -15 : 10),
  });
};
```

**특징**:
- 단일 `updateDoc` 원자성
- `exp`도 동시 업데이트 (맺기 +10 / 해제 -15)

### 1.3 집계 로직 (깐부수 실시간)

**출처**: `src/hooks/useFirebaseListeners.ts:61-77`

```typescript
unsubUsers = onSnapshot(collection(db, "users"), (snapshot) => {
  const fCounts: Record<string, number> = {};
  snapshot.docs.forEach(docSnap => {
    const data = docSnap.data();
    if (data.friendList) {
      data.friendList.forEach((nickname: string) => {
        fCounts[nickname] = (fCounts[nickname] || 0) + 1;
      });
    }
  });
  setFollowerCounts(fCounts);
});
```

**작동 방식**:
1. 앱 시작 시 **전체 users 컬렉션 구독** (`onSnapshot`)
2. 모든 유저의 `friendList` 순회
3. 각 닉네임이 다른 사람 `friendList`에 등장한 횟수 집계
4. `followerCounts[nickname]`에 저장 (전역 상태)

**비용**:
- 유저 1,000명: 앱 진입 시 1,000 문서 다운로드
- 유저 10,000명: 10,000 문서 × DAU 참여 비율

### 1.4 UI 표기 (현재)

**출처**: `src/components/ProfileHeader.tsx:80-82`

```tsx
<span>깐부 {friendCount}명</span>      // 내가 맺은 = 팔로잉
<span>깐부수 {followerCount}</span>    // 나를 맺은 = 팔로워
```

**출처**: `src/components/PublicProfile.tsx:40-41`

동일한 방식.

### 1.5 현재 관련 기능 전수

| 기능 | 깐부 관계 활용 | 코드 위치 |
|------|---------------|----------|
| 프로필 헤더 카운트 | `friendCount`, `followerCount` | `ProfileHeader.tsx` |
| 공개 프로필 카운트 | 동일 | `PublicProfile.tsx` |
| +구독 버튼 | `toggleFriend()` | `useFirestoreActions.ts` |
| 깐부방 입장 자격 | `friendList` 포함 여부 체크 | `KanbuRoomList.tsx` |
| 깐부 홍보 카드 | Lv2+ 유저의 `kanbuPromo` 등록 | `kanbuPromo.js` |
| 피드 필터 "구독" | `friendList` 기반 필터 | `App.tsx` 피드 로직 |

### 1.6 EXP 증감 트리거 (현재)

| 이벤트 | EXP | 조건 | 처리 위치 |
|--------|:---:|------|----------|
| 깐부 맺기 | **+10** | `arrayUnion` | 클라이언트 |
| 깐부 해제 | **−15** | `arrayRemove` | 클라이언트 |

**출처**: 위 1.2 `toggleFriend` 함수.

---

## 2. 문제점 분석

### 2.1 🟠 Major-1: "깐부"와 단방향의 의미 괴리

**"깐부"의 한국어 의미**:
- 오징어 게임(2021)에서 유명해진 단어
- "**상호 친밀한 관계**" — 딱지 나눠 가진 편
- 네이버 국어사전: "아주 친한 친구, 단짝"

**현재 구현**: 완전 단방향 팔로우 (상대 동의 불필요)

**UX 혼란**:
- "깐부 맺기" 버튼 클릭 → 사용자: "우리 깐부 됐다!"
- 실제로는: "상대는 나를 모르는데 나만 추가한 상태"

**비교**:
- 페이스북: "친구 신청" → 승인 시 양방향 (의미 일치)
- 인스타그램: "팔로우" → 단방향 (의미 일치)
- 현재 글러브: "깐부" + 단방향 (의미 불일치) ❌

### 2.2 🟠 Major-2: 변수명 vs UI 표기 혼동

**변수**:
- `friendCount` = "깐부 N명"
- `followerCount` = "깐부수 N"

**개발자 혼동 포인트**:
- `friend`는 영어권에서 "상호" 뉘앙스 (Facebook 사용)
- 하지만 현재 구현은 단방향 → 의미 불일치
- `friendCount` 변수 보면 "상호 친구 수"로 오해 가능

**완화책** (ANTI_ABUSE.md, v2.md에서 확정):
- 변수명은 **기존 유지** (마이그레이션 비용 회피)
- `types.ts` 주석으로 의미 명시
- **1인 개발이라 혼란 감수 가능**

### 2.3 🟠 Major-3: 닉네임 키 방식의 취약점

**현재**: `friendList: string[]` — 닉네임 문자열 배열

**취약점**:
1. **닉네임 변경 시 관계 깨질 수 있음**
   - 현재 닉네임 변경은 30일 쿨다운만 있음
   - 닉네임 변경 후 상대방 `friendList`의 옛 닉네임은 무효화됨
   - 부분 완화: ANTI_ABUSE §8 닉네임 정책 (평생 1회 유료) → 변경 빈도 극소화

2. **닉네임 대소문자·공백 처리 취약**
   - `깐부1호` vs `깐부1호 ` (공백 포함) → 매칭 실패 가능
   - DB 정규화 없음

3. **유튜브·인스타 등 성공 사례는 모두 UID 기반**
   - 닉네임 변경과 무관하게 관계 유지
   - 스케일 시 조인/쿼리 효율

### 2.4 🟠 Major-4: 전체 users 컬렉션 실시간 구독

**현재 동작** (§1.3):
- 앱 시작 시 **전체 users 컬렉션 `onSnapshot`**
- 한 유저가 `friendList` 수정하면 → **전체 유저에게 실시간 반영**

**유저 규모별 비용 추산**:

| 유저 수 | 초기 로드 문서 수 | 월 Firestore 읽기 비용 (DAU 30%) |
|:-------:|:---------------:|:-------------------------:|
| 100명 | 100 | ~$0.001 |
| 1,000명 | 1,000 | ~$0.03 |
| 10,000명 | 10,000 | ~$3 |
| **100,000명** | **100,000** | **~$300** |
| 1,000,000명 | 1,000,000 | ~$3,000+ |

**클라이언트 메모리**:
- 유저당 평균 문서 크기 ~1KB
- 10,000명 = **10MB 메모리 점유** (모바일 문제)
- 100,000명 = **100MB** (크래시 위험)

**→ 바이럴 성장의 가장 큰 구조적 장애물**

### 2.5 🟢 Minor-1: 깐부 EXP +10/-15 어뷰징

**공격 시나리오**:
1. 다계정 100개 준비
2. 메인 계정이 100개 모두 맺기 → `exp +10 × 100 = +1,000`
3. Lv5 도달 (500 EXP 기준)
4. 해제 안 함 → EXP 유지

**Net 변화**:
- 맺기 +10 / 해제 -15 → 1회 사이클 -5
- 하지만 어뷰저는 **해제 안 함**이 합리적

**해결**: v2-14 결정 — 맺기 **+2** / 해제 **0**

---

## 3. 용어 정립 (최종 확정)

### 3.1 결정사항 요약 (2026-04-19)

**결정 1**: UI 표기는 **한국어 통일**
**결정 2**: 변수명은 **기존 영문 유지** (마이그레이션 비용 회피)
**결정 3**: 크리에이터 관점에서 **"깐부수"가 핵심 지표**

### 3.2 용어 매트릭스

| 개념 | UI 표기 | 변수명 (변경 없음) | 크리에이터 관점 | 유튜브 대응 |
|------|---------|------------------|----------------|------------|
| 내가 팔로우한 사람 | **"깐부 N명"** | `friendCount` / `friendList` | 내가 소비하는 축 | 구독 중인 채널 |
| 나를 팔로우한 사람 | **"깐부수 N"** | `followerCount` / `followerCounts` | **내가 생산하는 축 (크리에이터 성공 지표 ⭐)** | 구독자 수 |
| 상호 팔로우 관계 | **"🤝 맞깐부"** | `mutualKanbu` (신규 필요 시) | 특수 배지 (선택) | — |

### 3.3 types.ts 주석 보강 (Step 2 작업)

**AS-IS**:
```typescript
export interface UserData {
  friendList?: string[];
}
```

**TO-BE**:
```typescript
export interface UserData {
  /**
   * 내가 맺은 깐부(팔로우 중인 유저)의 닉네임 목록
   * - UI 표기: "깐부 N명"
   * - 단방향 팔로우 (상대 동의 불필요)
   * - followerCount(깐부수)는 별도 실시간 집계, users 문서 미저장
   */
  friendList?: string[];
  
  /**
   * 내 깐부수(나를 팔로우한 사람 수) 비정규화 필드
   * - UI 표기: "깐부수 N"
   * - Phase: 중기 도입 (유저 1,000명 시점)
   * - Phase A/B: 미사용, 실시간 집계 유지
   */
  followerCount?: number;
}
```

### 3.4 UI 원칙

**✅ 올바른 표기**:
- "깐부 5명 · 깐부수 120"
- "깐부 맺기 / 깐부 해제"
- "🤝 깐부2호님과 맞깐부"

**❌ 피할 표기**:
- "팔로잉/팔로워" (영어 섞기 금지)
- "구독" (깐부방 구독과 혼동)
- "친구" (friendList 변수명 때문의 혼동 방지)

**유일한 예외**: 기존 UI의 "+구독" 버튼
- 이건 "채널 구독"이 아니라 "깐부 맺기"의 의미
- **Step 2에서 "+깐부 맺기"로 변경** 제안

---

## 4. 변경 방향

### 4.1 UI 네이밍 통일 (Step 2)

#### 4.1.1 변경 대상 전수조사

**출처**: grep으로 확인 필요한 UI 코드

| 위치 | AS-IS | TO-BE |
|------|-------|-------|
| `ProfileHeader.tsx` | "깐부 N명 / 깐부수 N" | ✅ 유지 (이미 맞음) |
| `PublicProfile.tsx` | 동일 | ✅ 유지 |
| `+구독` 버튼 (각 글 카드) | "+구독" / "구독중" | **"+깐부" / "깐부"** |
| 피드 탭 "구독" | "구독" 탭 | **"깐부"** 탭 |
| 알림 텍스트 | "○○님이 구독했습니다" | **"○○님이 깐부를 맺었습니다"** |

**주의**: "구독"은 잉크병·단골장부·정보봇 등 **다른 기능에서도 사용** → 혼동 위험

**→ 깐부 관계의 경우 "구독" 용어를 "깐부"로 통일 권장**

#### 4.1.2 변경 불가 영역

- `kanbuPromo` (깐부 홍보 카드) — 이미 "깐부" 용어 사용 중
- `KanbuRoomList` 등 깐부방 컴포넌트 — 이름에 kanbu 이미 있음
- `friendList` 변수명 — 내부 코드, 변경 안 함

### 4.2 깐부 맺기 EXP 완화 (Step 2)

#### 4.2.1 AS-IS / TO-BE

**AS-IS** (`src/hooks/useFirestoreActions.ts:215-226`):
```typescript
const toggleFriend = async (author: string) => {
  const isFriend = userData.friendList?.includes(author);
  await updateDoc(doc(db, 'users', userData.uid), {
    friendList: isFriend ? arrayRemove(author) : arrayUnion(author),
    exp: increment(isFriend ? -15 : 10),
  });
};
```

**TO-BE** (v2-14 결정):
```typescript
const toggleFriend = async (author: string) => {
  const isFriend = userData.friendList?.includes(author);
  await updateDoc(doc(db, 'users', userData.uid), {
    friendList: isFriend ? arrayRemove(author) : arrayUnion(author),
    // v2-14: 맺기 +2 / 해제 0 (관계 실험 장려)
    exp: increment(isFriend ? 0 : 2),
  });
};
```

#### 4.2.2 효과 시뮬레이션

**정상 유저 시나리오**:
- 깐부 10명 맺기 → +20 EXP (기존 +100)
- 깐부 5명 해제 → 0 EXP (기존 -75)
- 순 효과: +20 (기존 +25)
- **거의 동일한 경험, 관계 실험 자유로움**

**어뷰저 시나리오**:
- 100개 다계정 메인 계정 맺기 → +200 EXP (기존 +1,000)
- Lv2 도달은 가능, Lv5는 불가능 (500 EXP 필요)
- **다계정 EXP 루프 인센티브 80% 감소**

#### 4.2.3 일일 맺기 한도 (Phase B 이후)

현재: 한도 없음

제안 (Phase B):
```typescript
// CF 경유 맺기로 전환 시
const DAILY_FRIEND_LIMIT = 10;

// 24h 내 맺은 횟수 집계
const recentFriendCount = await countFriendsInLast24h(uid);
if (recentFriendCount >= DAILY_FRIEND_LIMIT) {
  // 맺기는 허용, EXP만 미지급
  await addFriend(uid, targetUid);
  return { success: true, expGained: 0, reason: 'daily_limit_exceeded' };
}
```

**왜 맺기 자체는 허용?**
- 차단하면 정상 유저가 답답함
- EXP만 안 주면 어뷰징 인센티브 제거 충분

### 4.3 UID 마이그레이션 로드맵

#### 4.3.1 현재 vs 미래

```
현재: friendList: string[]  // 닉네임 배열
미래: friendList: string[]  // UID 배열 (같은 필드명, 다른 내용)
```

#### 4.3.2 Phase별 계획

| Phase | 상태 | 작업 |
|:-----:|------|------|
| A (현재) | 닉네임 기반 | 변경 없음 |
| B (베타 종료) | 닉네임 기반 유지 | 마이그레이션 설계만 |
| C (정식 출시) | 닉네임 기반 (여전히) | 닉네임 정책 강화(§ANTI_ABUSE §8)로 부분 완화 |
| **D (Step 4 이후)** | **UID 기반** | **일괄 마이그레이션** |

#### 4.3.3 마이그레이션 상세 전략

**옵션 A: 빅뱅 (권장 안 함)**
- 한순간에 전체 변환
- 위험: 변환 실패 시 관계 데이터 소실

**옵션 B: 병행 필드 (권장)**
```typescript
interface UserData {
  friendList?: string[];      // 기존 닉네임 (호환용, 읽기)
  friendListUids?: string[];  // 🆕 UID 기반 (신규 쓰기)
}
```

1. **Phase D-1**: 신규 필드 `friendListUids` 추가 (CF로 백필)
2. **Phase D-2**: UI가 신규 필드 우선 사용, 없으면 구 필드
3. **Phase D-3**: 신규 쓰기는 `friendListUids`만, 구 필드는 read-only
4. **Phase D-4**: 6개월 검증 기간
5. **Phase D-5**: 구 필드 제거

**옵션 C: 별도 컬렉션 (스케일 대비)**
```
follow_relations/{followerUid}_{followedUid}
```
- 장점: 복합 쿼리 효율적
- 단점: 문서 수 폭증 (N × M)
- **유저 10만+ 시점**에 고려

### 4.4 전체 users 구독 개선 (확장성)

#### 4.4.1 Phase별 전략

**단기 (Phase A/B)**: **현상 유지**
- 이유: MVP 단계, 조기 최적화 리스크
- 트리거: 유저 1,000명 도달 시 중기로 전환 검토

**중기 (유저 1,000명~)**: **`followerCount` 비정규화**

현재:
```typescript
// 전체 users 구독 → 실시간 집계
setFollowerCounts(fCounts);  // Record<string, number>
```

중기:
```typescript
// users 문서에 followerCount 필드 저장
interface UserData {
  followerCount?: number;  // 🆕 비정규화
}

// CF 트리거로 증감 관리
exports.updateFollowerCountOnFriendChange = onDocumentUpdated(
  'users/{userId}',
  async (event) => {
    const before = event.data.before.data().friendList || [];
    const after = event.data.after.data().friendList || [];
    
    const added = after.filter(n => !before.includes(n));
    const removed = before.filter(n => !after.includes(n));
    
    // 추가된 대상의 followerCount +1
    for (const nickname of added) {
      const targetDoc = await getNicknameDoc(nickname);
      if (targetDoc) {
        await db.collection('users').doc(targetDoc.uid).update({
          followerCount: FieldValue.increment(1),
        });
      }
    }
    
    // 제거된 대상의 followerCount -1
    for (const nickname of removed) {
      const targetDoc = await getNicknameDoc(nickname);
      if (targetDoc) {
        await db.collection('users').doc(targetDoc.uid).update({
          followerCount: FieldValue.increment(-1),
        });
      }
    }
  }
);
```

**장점**:
- 클라는 필요한 유저 문서만 개별 조회
- 전체 users 구독 폐지
- 비용 절감: 1만 명 × $0.00036 = $3.6 → $0 (조회 시점 과금만)

**트리거**: 유저 10,000명 도달 시 장기로 전환 검토

#### 4.4.2 장기 (유저 10,000명~): **별도 컬렉션**

```typescript
// follow_relations/{followerUid}_{followedUid}
interface FollowRelation {
  followerUid: string;
  followedUid: string;
  createdAt: FirestoreTimestamp;
}

// 쿼리:
// A의 깐부 목록: where followerUid == A
// A의 깐부수: countDocuments where followedUid == A
```

**장점**:
- 복합 인덱스로 쿼리 효율
- 스케일 확장성 (수억 관계도 처리 가능)

**단점**:
- 문서 수 폭증 (1만 명 × 평균 깐부 30명 = 30만 문서)
- 마이그레이션 복잡

**→ 현재는 설계만, 실제 전환은 상황 봐가며**

### 4.5 맞깐부 배지 (선택적, Step 2~3)

#### 4.5.1 개념

**맞깐부**: 양쪽이 서로 깐부 관계 = 진짜 오징어게임 "깐부"

```
A → B (A가 B 맺기)
B → A (B가 A 맺기)
    ↓
   🤝 맞깐부
```

#### 4.5.2 판정 로직

```typescript
export const isMutualKanbu = (
  myFriendList: string[],
  theirFriendList: string[],
  myNickname: string,
  theirNickname: string,
): boolean => {
  return myFriendList.includes(theirNickname)
      && theirFriendList.includes(myNickname);
};
```

#### 4.5.3 UI 표시

**공개 프로필 헤더**:
```tsx
{isMutualKanbu && (
  <span className="ml-2 text-sm bg-amber-100 px-2 py-1 rounded">
    🤝 맞깐부
  </span>
)}
```

**+깐부 버튼 옆**:
```tsx
{!isKanbu ? (
  <button>+깐부</button>
) : isMutualKanbu ? (
  <span className="text-amber-600">🤝 맞깐부</span>
) : (
  <span className="text-slate-500">깐부 맺음</span>
)}
```

#### 4.5.4 맞깐부 EXP 인센티브 (Step 3 검토)

**아이디어**: 맞깐부 관계 달성 시 양쪽에 **보너스 +3 EXP**

**정당화**:
- 양방향 관계는 플랫폼에 더 가치 있음
- 단방향 스팸을 줄이고 상호 관계 장려
- 유튜브 "서로이웃"에 해당

**어뷰징 대비**: 다계정 담합 가능 → Phase C 휴대폰 인증으로 방지

**현재 결정**: 설계만, Step 3에서 정식 결정.

### 4.6 깐부 관계 기반 기능 영향 매트릭스

| 기능 | 현재 구조 | 단기 변화 | 중기 변화 | 장기 변화 |
|------|----------|----------|----------|----------|
| 프로필 카운트 표시 | 실시간 집계 | ✅ | `followerCount` 조회 | 컬렉션 count 쿼리 |
| +깐부 버튼 | `friendList` arrayUnion | ✅ | 동일 | CF 경유 |
| 깐부방 입장 | `friendList` includes 체크 | ✅ | 동일 | UID 조회 |
| 깐부 홍보 카드 | `kanbuPromo` 컬렉션 | ✅ | 동일 | 동일 |
| 피드 "깐부" 탭 | `friendList` where | ✅ | 동일 | UID where |
| 맞깐부 배지 | 없음 | 🆕 추가 | 동일 | 동일 |

---

## 5. 데이터 모델

### 5.1 `UserData` 확장

```typescript
// src/types.ts
export interface UserData {
  uid: string;
  nickname: string;
  
  /**
   * 내가 맺은 깐부(팔로우 중인 유저)의 닉네임 목록
   * - UI 표기: "깐부 N명"
   * - 단방향 팔로우 (상대 동의 불필요)
   * - Phase D(미래)에 UID 기반으로 마이그레이션 예정
   */
  friendList?: string[];
  
  /**
   * 내 깐부수 비정규화 필드
   * - UI 표기: "깐부수 N"
   * - Phase 중기(유저 1,000명)에 도입
   * - Phase A/B: 미사용, 실시간 집계 유지
   */
  followerCount?: number;
  
  // ... 다른 필드
}
```

### 5.2 `nickname_*` 문서 (기존 유지)

**출처**: 기존 시스템

```
users/nickname_{nickname}  // 닉네임 중복 방지용 포인터
{
  uid: string,
  reservedAt: Timestamp,
}
```

**역할**:
- 닉네임 → UID 매핑 (역방향 조회)
- 닉네임 중복 방지

### 5.3 `follow_relations` (장기, 선택적)

```typescript
// follow_relations/{followerUid}_{followedUid}
export interface FollowRelation {
  followerUid: string;     // 맺은 사람
  followedUid: string;     // 맺혀진 사람
  createdAt: FirestoreTimestamp;
  isMutual?: boolean;      // 맞깐부 여부 (비정규화)
}
```

**언제 도입?**
- 유저 10,000명 이상
- users 문서 size 제한 초과 우려 시 (`friendList` 1MB 초과 가능)

---

## 6. 테스트 시나리오

### 6.1 단방향 동작 검증

| # | 행위자 | 행위 | 기대 결과 |
|:-:|-------|------|----------|
| 1 | 깐부1호 | 깐부2호 맺기 | 깐부1호.friendList에 "깐부2호" 추가, 깐부2호 문서 변화 없음 |
| 2 | 깐부1호 | 깐부2호 해제 | 깐부1호.friendList에서 "깐부2호" 제거 |
| 3 | 깐부2호 | 깐부1호를 맺지 않은 상태에서 깐부1호 프로필 확인 | "+깐부" 버튼 표시 |

### 6.2 맞깐부 판정

| # | 행위자 | 행위 | 기대 결과 |
|:-:|-------|------|----------|
| 4 | 깐부1호, 깐부2호 | 서로 맺기 | 양쪽 프로필에 "🤝 맞깐부" 배지 |
| 5 | 깐부1호 | 깐부2호 해제 | 깐부1호 프로필에서 맞깐부 배지 사라짐, 깐부2호는 "깐부 맺음" 상태 |

### 6.3 EXP 완화 검증

| # | 행위자 | 행위 | 기대 결과 |
|:-:|-------|------|----------|
| 6 | 깐부1호 | 깐부2호 맺기 | EXP +2 (기존 +10) |
| 7 | 깐부1호 | 깐부2호 해제 | EXP 변동 없음 (기존 -15) |
| 8 | 깐부1호 | 깐부2호 맺고 해제 반복 10회 | 총 EXP +20 (+2 × 10), 마지막에 맺음 상태 가정 |

### 6.4 UI 네이밍 검증

| # | 화면 | 확인 항목 |
|:-:|------|----------|
| 9 | ProfileHeader | "깐부 N명 · 깐부수 N" 표시 |
| 10 | PublicProfile | 동일 표기 |
| 11 | 피드 탭 | "깐부" 탭 존재 (기존 "구독"에서 변경) |
| 12 | 글 카드 +버튼 | "+깐부" / "깐부" / "🤝 맞깐부" 상태별 표시 |

### 6.5 닉네임 변경 시 관계 유지 (Phase A)

| # | 행위자 | 행위 | 기대 결과 |
|:-:|-------|------|----------|
| 13 | 깐부3호 | 자신의 닉네임을 "깐부3호" → "새이름"으로 변경 (ANTI_ABUSE §8) | 깐부1호의 friendList에 아직 "깐부3호" 남음 (닉네임 기반 한계) |
| 14 | 관리자 | 닉네임 변경 완료 후 백필 CF 실행 | 모든 유저의 friendList에서 "깐부3호" → "새이름" 치환 (Phase B 이후 예정) |

**주의**: 이건 **알려진 한계**. Phase D(UID 마이그레이션) 후에는 자동 해결.

### 6.6 깐부 홍보 카드 연계

| # | 행위자 | 행위 | 기대 결과 |
|:-:|-------|------|----------|
| 15 | 깐부5호 (Lv2+) | 홍보 카드 등록 | `kanbuPromo` 문서 생성 |
| 16 | 깐부1호 | 홍보 카드 보고 +깐부 클릭 | 정상 맺기, EXP +2 |

### 6.7 확장성 시뮬레이션 (이론)

**가상 시나리오**:
- 유저 10,000명 상황에서 앱 진입 시간 측정
- 현재 방식: **5~10초 로딩**
- 중기 방식(`followerCount` 비정규화): **1초 미만**
- 장기 방식(`follow_relations`): **<500ms**

**실제 측정은 Phase B 전환 시점에 진행**.

---

## 7. Step별 구현 우선순위

### 7.1 Step 1 범위 (지금 ~ 투자 유치 기획서)

**산출물**: 본 설계서 확정

| 순서 | 작업 | 파일 | 난이도 |
|:----:|------|------|:------:|
| 1 | 본 문서 승인 | `KANBU_V2.md` | — |
| 2 | `types.ts` 주석 보강 | `types.ts` | 🟢 하 |

**이 단계의 핵심**: **설계만**, 코드 변경은 최소.

### 7.2 Step 2 범위 (기능 보완)

**크리에이터 대시보드 확장 + UI 네이밍 통일**:

| 순서 | 작업 | 파일 | 난이도 | 영향 |
|:----:|------|------|:------:|:---:|
| 1 | 깐부 EXP 완화 (+2/0) | `useFirestoreActions.ts` | 🟢 하 | 어뷰저 80% 완화 |
| 2 | UI 네이밍 "구독" → "깐부" 통일 | 각 컴포넌트 | 🟡 중 | UX 일관성 |
| 3 | 맞깐부 판정 함수 | `utils.ts` | 🟢 하 | 기반 준비 |
| 4 | 맞깐부 배지 UI | `PublicProfile.tsx` | 🟡 중 | UX 개선 |

### 7.3 Step 3 범위 (로그인/회원가입 재설계)

| 작업 | 비고 |
|------|------|
| 첫 깐부 매칭 온보딩 | 신규 유저가 3명 이상 추천 깐부 맺도록 유도 |
| 맞깐부 EXP 인센티브 결정 | +3 EXP 정식 도입 여부 결정 |
| 일일 맺기 한도 CF | `DAILY_FRIEND_LIMIT = 10` (어뷰징 방지) |

### 7.4 Phase B (베타 종료) 작업

| 작업 | 트리거 |
|------|--------|
| `followerCount` 비정규화 CF | 유저 1,000명 돌파 시 |
| 전체 users 구독 폐지 | 위와 동일 |
| 닉네임 변경 시 friendList 백필 CF | ANTI_ABUSE §8 닉네임 정책 배포와 함께 |

### 7.5 Step 4 (투자 유치 기획서 이후)

| 작업 | 트리거 |
|------|--------|
| UID 기반 마이그레이션 | 유저 10,000명 도달 시 |
| `friendListUids` 필드 병행 | 위와 동일 |
| 신규 쓰기 → UID만 | 6개월 검증 후 |

### 7.6 Phase D (10만+ 시점)

| 작업 |
|------|
| `follow_relations` 별도 컬렉션 |
| 대규모 쿼리 최적화 |
| 친구 추천 알고리즘 |

### 7.7 금지 작업 (Step 1 범위 밖)

- ❌ 변수명 `friendCount` → `kanbuCount` 변경 (마이그레이션 비용 큼)
- ❌ UID 마이그레이션 조기 실행 (데이터 축적 없이 위험)
- ❌ `follow_relations` 컬렉션 조기 도입 (오버엔지니어링)
- ❌ 맞깐부 자동 알림 스팸 (관계 강요 느낌)

---

## 📝 결론

글러브의 깐부 관계는 **단방향 팔로우 구조 유지**하되, **네이밍과 확장성 전략**을 명확히 합니다.

**Phase A (현재)에서 할 것**:
- `types.ts` 주석 보강 (용어 의미 명시)
- 현상 유지, 조기 최적화 금지

**Step 2에서 할 것**:
- 깐부 EXP 완화 (+2/0) — 어뷰저 인센티브 감소
- UI 네이밍 "구독" → "깐부" 통일
- 맞깐부 배지 도입

**Phase B 이후 (유저 1,000명~)**:
- `followerCount` 비정규화로 확장성 확보
- 전체 users 구독 폐지

**Step 4 이후 (유저 10,000명~)**:
- UID 기반 마이그레이션
- 장기적으로 `follow_relations` 컬렉션 도입

**핵심 통찰**:
- 단방향 유지 = 유튜브 모델 = 크리에이터-팬 비대칭 허용
- 네이밍 일관성 = 한국어 UI + 영문 변수 (1인 개발 현실 수용)
- 확장성 = Phase별 단계적 대응, 조기 최적화 금지

Step 1 완료 시 **"깐부 관계 설계 헌법"** 확보 → Step 2 UI 작업의 청사진.

---

**문서 버전**: v1.0
**기준**: 단방향 유지 + 한국어 UI + 영문 변수
**다음 업데이트**: Step 2 작업 완료 후 실제 UX 피드백 반영 + Phase B 전환 데이터 추가
