# 🌳 거대 나무 (자이언트 트리) — 설계 문서

> 상태: **Phase 1~4 완료 + 하이브리드 성장 시스템 v1 (2026-04-05)**
> 기획 확정일: 2026-04-03  |  D3.js 고도화: Phase 5 (미구현)

---

## 1. 개요

| 항목 | 내용 |
|------|------|
| **메뉴명** | 거대나무 (자이언트 트리) |
| **설명** | 할말 있소!!! 자신의 주장을 다단계 형태로 전파 |
| **사이드바 위치** | 우리들의 장갑(glove)과 랭킹(ranking) 사이 별도 영역 |
| **핵심 가치** | 작성자 중심 — 내 주장의 영향력을 물리적·시각적으로 확장 |

---

## 2. 전파 규모 (평판 기반)

| 평판 등급 | 최대 전파 인원 | 동시 활성 나무 |
|-----------|--------------|---------------|
| 중립 | 전파 불가 | 0개 |
| 약간 우호 | 최대 **10명** | 1개 |
| 우호 | 최대 **30명** | 2개 |
| 확고 | 최대 **100명** | 3개 |

- `maxSpread` 값은 트리 생성 시점의 작성자 평판 등급으로 고정 (이후 평판 변동 무관)
- **동시 활성 제한**: 활성 나무(전파 완료도 중단도 아닌 나무) 수가 한도 초과 시 나무 심기 불가
  - 한도 도달 메시지: "심은 나무가 거대 나무가 되어야 다시 심기 가능"

---

## 3. 참여자 구분 — 하이브리드 성장 시스템

### 직계 전파자 (Node)
- **진입 경로**: 카톡 URL (`?tree={treeId}&node={parentNodeId}`)
- **판별**: `parentNodeId` 존재
- **트리 카운트**: 정식 노드, `totalNodes` 증가
- **전파권**: 3명에게 추가 전파 가능
- **보상**: likes+1 (참여자) + likes+2 (작성자, 공감 시)

### 일반 참여자 (Leaf, 잎사귀)
- **진입 경로**: 앱 내 목록에서 직접 진입 (`parentNodeId` 없음)
- **판별**: `parentNodeId` 미존재
- **트리 카운트**: 미포함 (leaves 서브컬렉션 별도)
- **전파권**: 없음
- **보상**: likes+1
- **진행률 기여**: 잎사귀 10개 = 보너스 +1% (최대 10%)

### 진행률 공식
```
기본 진행률 = (totalNodes / maxSpread) × 100%
잎사귀 보너스 = floor(leafCount / 10) × 1%   (최대 10%)
표시 진행률 = min(기본 진행률 + 잎사귀 보너스, 100%)
거대 나무 달성 = 기본 진행률 >= 100% (잎사귀만으로는 달성 불가)
```

---

## 4. 전파 흐름

```
작성자(depth 0) → 카톡으로 3명에게 공유 (URL에 tree+node 파라미터)
    ↓
수신자가 링크 클릭 → 직계 전파자로 참여 (공감/반대 + 선택 의견 50자)
    → 노드 생성, totalNodes+1, 전파권 3명 획득
    ↓
48시간 내 미참여 → 시든 가지 → 전파자에게 알림 → 재전파 유도
    ↓
앱 내에서 직접 진입한 유저 → 잎사귀로 참여 (공감/반대)
    → 잎사귀 카운트만 증가, 트리 미반영
    ↓
직계 노드가 maxSpread 도달 → 거대 나무 달성
```

- 한 노드당 자식 최대 **3개** (각 참여자가 3명에게 전파)
- 참여자 1인당 전파 1회만 허용 (중복 참여 차단)
- 의견은 **선택 사항** (공감/반대 선택만 필수, 최대 50자)

---

## 5. 시든 가지 시스템

- **유효 시간**: 48시간
- **판정**: 노드 생성(createdAt) 후 48시간 경과 + `childCount < 3`
- **알림**: 해당 전파자가 상세글 방문 시 자동 감지 → `notifications/{uid}/items`에 `giant_tree_wilt` 타입 알림 1회 push
  - 메시지: "전파한 3명 중 N명만 참여했습니다. 나머지 M명에게 재전파하세요."
- **중복 방지**: `sessionStorage`로 세션 내 1회만 발송
- **작성자도 동일**: 나무 생성 후 48시간 경과 + 루트 자식 < 3 → 작성자에게 알림

---

## 6. 나무 성장 단계

| 진행률 | 단계 | 이모지 | 진행 바 색상 |
|--------|------|--------|------------|
| 0~19% | 씨앗 | 🌰 | slate |
| 20~39% | 새싹 | 🌱 | lime |
| 40~59% | 어린 나무 | 🌿 | green |
| 60~79% | 중간 나무 | 🌲 | emerald |
| 80~99% | 큰 나무 | 🌳 | teal |
| 100% | 거대 나무 | 🌳 | amber(금색) |

---

## 7. 목록 뷰 레이아웃

**좌우 2컬럼 (md:grid-cols-12)**:
- **좌측 (col-span-8)**: 🌱 자라는 나무 — 전파 중 + 전파 중단 나무 목록
- **우측 (col-span-4)**: 🌳 거대 나무 사이드바 — 전파 완료 나무 (금색 테두리, 컴팩트 카드)
- **모바일**: 1컬럼 스택 (하단에 거대 나무 섹션)

**권한 안내 배너**:
- 비로그인: `🔒 나무를 심으려면 로그인과 평판이 필요합니다.`
- 로그인 + 평판 부족: `🌱 평판 "약간 우호" 이상이면 나무를 심을 수 있어요. (현재: 중립)`
- 나무 심기 한도 도달: `심은 나무가 거대 나무가 되어야 다시 심기 가능`

---

## 8. 서킷 브레이커 (Circuit Breaker)

- 발동 조건: 전체 노드 중 **반대 비율 ≥ 70%** (최소 10노드 이상일 때 판정)
- 발동 시: `circuitBroken: true` 설정 → 신규 노드 생성 차단
- UI: 트리 상세 뷰에 "⚠️ 이 주장은 다수의 반대로 전파가 중단되었습니다" 표시

---

## 9. Firestore 데이터 모델

### 컬렉션: `giant_trees/{treeId}`
```
treeId          : "tree_{timestamp}_{uid}"
title           : string
content         : string           // 본문 (plain text)
author          : string           // 닉네임
author_id       : string           // UID
authorLevel     : number           // 생성 시점 레벨 스냅샷
authorReputation: string           // 생성 시점 평판 등급 스냅샷
maxSpread       : number           // 전파 가능 최대 인원 (생성 시 고정)
totalNodes      : number           // 현재까지 생성된 노드 수 (실시간 집계)
agreeCount      : number           // 전체 공감 수
opposeCount     : number           // 전체 반대 수
circuitBroken   : boolean          // 서킷 브레이커 발동 여부
createdAt       : Timestamp
```

### 서브컬렉션: `giant_trees/{treeId}/nodes/{nodeId}`
```
nodeId          : "node_{timestamp}_{uid}"
depth           : number           // 전파 단계 (1 = 1차 전파, ...)
parentNodeId    : string | null    // 부모 노드 ID (루트 직계는 null)
participantNick : string
participantId   : string           // UID
side            : 'agree' | 'oppose'
comment         : string           // 선택, 최대 50자 (빈 문자열 허용)
childCount      : number           // 자식 노드 수 (0~3)
createdAt       : Timestamp
```

### 서브컬렉션: `giant_trees/{treeId}/leaves/{leafId}`
```
leafId          : "leaf_{timestamp}_{uid}"
participantNick : string
participantId   : string           // UID
side            : 'agree' | 'oppose'
comment         : string           // 선택, 최대 50자
createdAt       : Timestamp
```

### 중복 참여 차단: `giant_trees/{treeId}/participants/{uid}`
```
joinedAt        : Timestamp
type            : 'node' | 'leaf'  // 직계 vs 잎사귀 구분
```

---

## 10. 컴포넌트 구조

| 컴포넌트 | 역할 |
|----------|------|
| `GiantTreeView.tsx` | 목록 뷰 — 좌우 레이아웃 (자라는 나무 + 거대 나무 사이드바), 성장 단계 시각화, 권한 안내 |
| `CreateGiantTree.tsx` | 글 작성 폼 (제목 + textarea + 전파 규모 미리보기) |
| `GiantTreeDetail.tsx` | 상세 뷰 — 트리 정보 + 수정/삭제 + 전파 참여 폼 (직계/잎사귀 분리) + 시든 가지 알림 + 맵 |
| `GiantTreeMap.tsx` | 트리 시각화 — CSS Flexbox 기반, 줌인/아웃 40~150% |

---

## 11. 작성자 수정·삭제

- **수정**: 제목·본문만 인라인 편집 가능 (Firestore Rules `title`/`content` 필드만 허용)
- **삭제**: "글 삭제" 텍스트 입력 확인 → `writeBatch`로 nodes + participants + leaves + 루트 문서 일괄 삭제
- **권한**: 작성자(`author_id == request.auth.uid`)만 수정·삭제 가능

---

## 12. 구현 이력

#### Phase 1~4 — 기반 구조 + 전파 참여 + 시각화 + 고도화 (완료 2026-04-03)
- 전파 참여 UI, 중복 참여 차단, 서킷 브레이커, 다단계 depth
- CSS Flexbox 트리 맵, 카카오톡 공유 API
- 작성자 평판 상승 (공감 참여 시 likes+2)
- 알림: `giant_tree_spread` 타입

#### 하이브리드 성장 시스템 v1 (2026-04-05)
- **1단계**: 의견 선택화 (빈 허용) + 50자 축소 + 참여자 보상 likes+1
- **2단계**: 잎사귀 시스템 — 직계(Node) vs 일반(Leaf) 분리, leaves 서브컬렉션
- **3단계**: 시든 가지 — 48시간 경과 감지, 🍂 배너 + 알림 push (`giant_tree_wilt`)
- **4단계**: 잎사귀 보너스 진행률 반영 (10개당 +1%, 최대 10%)
- **부가**: 성장 6단계 시각화, 좌우 레이아웃, 동시 활성 나무 제한, 작성자 수정/삭제, 권한 안내 배너

#### Phase 5 — D3.js 트리 시각화 고도화 (미구현)
- [ ] `GiantTreeMap.tsx` → D3.js 기반 교체 (노드 50개 이상 대응)
- [ ] 노드 클릭 시 접기/펼치기 (collapse/expand)
- [ ] `d3.zoom()` + SVG 기반 줌·패닝
- [ ] 모바일 핀치 제스처 지원

---

## 13. 핵심 기술 고려사항

- **트리 조회 비용**: 노드가 많아지면 전체 서브컬렉션 구독 비용이 큼 → 초기에는 `limit(50)` + 페이지네이션
- **전파 URL**: `https://halmal-itso.web.app/?tree={treeId}&node={parentNodeId}` — 링크 수신자가 해당 노드의 자식으로 자동 연결
- **카카오 공유 카드**: 제목 + "전파 참여하기" 버튼
- **Firestore Rules**: `giant_trees/{id}` — create 로그인, update 작성자+title/content만, delete 작성자만. 서브컬렉션은 로그인 사용자 write 허용.
