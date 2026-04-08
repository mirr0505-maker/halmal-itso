// src/types.ts

// 🚀 FirestoreTimestamp: Firestore Timestamp 최소 구조 (서버·클라이언트 양쪽 호환)
export interface FirestoreTimestamp {
  seconds: number;
  nanoseconds?: number;
  toDate?: () => Date;
}

// 🚀 UserData: users 컬렉션 문서 구조 — allUsers Record의 값 타입
export interface UserData {
  uid: string;
  nickname: string;
  email?: string;
  level: number;
  exp?: number;           // 경험치 (레벨업 기준)
  likes: number;          // 누적 좋아요 수 (평판 지표)
  totalShares?: number;   // 내 글이 공유된 총 횟수 (평판 점수에 반영 — likes + totalShares×2)
  points?: number;        // 포인트 (레거시)
  bio?: string;           // 자기소개
  avatarUrl?: string;     // 커스텀 프로필 이미지 URL
  friendList?: string[];  // 깐부 닉네임 목록
  blockList?: string[];   // 차단 유저 닉네임 목록
  subscriberCount?: number;
  isPhoneVerified?: boolean;
  // 🚀 땡스볼 관련 잔액·누적
  ballBalance?: number;   // 보유 볼 잔액
  ballSpent?: number;     // 누적 사용 볼
  ballReceived?: number;  // 누적 받은 볼
  createdAt?: FirestoreTimestamp;        // 가입일 (Firestore Timestamp)
  nicknameChangedAt?: FirestoreTimestamp; // 닉네임 변경일 (30일 쿨다운)
}

export interface AuthorInfo {
  level: number;
  friendCount: number;
  totalLikes: number;
}

export interface Post {
  id: string;
  author: string;
  author_id?: string; // 작성자 고유 UID
  title?: string;
  category?: string; // 🚀 게시글 카테고리
  content: string;
  imageUrl?: string | null;
  linkUrl?: string | null;
  tags?: string[];
  authorInfo?: AuthorInfo;
  parentId: string | null;
  rootId: string | null; // 🚀 최상위 게시글 ID (토론 주제 ID)
  side: 'left' | 'right';
  type: 'comment' | 'formal';
  createdAt: FirestoreTimestamp; // Firestore Timestamp
  likes: number;
  dislikes: number;
  likedBy?: string[]; // 🚀 좋아요를 누른 닉네임 목록
  commentCount?: number; // 🚀 내 정보 목록 표시용
  
  // 🚀 카테고리별 확장 필드
  mood?: string;           // 너와 나의 이야기: 오늘의 기분
  factChecked?: boolean;   // 벌거벗은 임금님: 사실 확인 여부 (레거시)
  // 🚀 판도라의 상자 전용
  claimSource?: string;      // 주장 출처: 언론사/인물/단체명
  claimLinkUrl?: string;     // 주장 출처 링크
  verdict?: 'fact' | 'false' | 'uncertain'; // 작성자 판정
  factCheckResult?: string;  // 팩트체크 결과 내용
  factCheckSources?: string[]; // 팩트체크 출처 링크 목록
  debatePosition?: 'pro' | 'con' | 'neutral'; // 임금님 귀는 당나귀 귀: 초기 입장
  location?: string;       // 현지 소식: 발생 지역
  infoPrice?: number;      // 지식 소매상: 정보 가치(포인트, 레거시)
  infoFields?: string[];   // 황금알을 낳는 거위: 정보 분야 (최대 2개)
  bgColor?: string;        // 뼈때리는 글: 배경색

  // 🚀 마라톤의 전령 전용
  newsType?: 'breaking' | 'news'; // 속보(breaking) vs 일반뉴스(news) 구분 배지용

  // 🚀 한컷 관련 필드
  isOneCut?: boolean;      // 한컷 게시물 여부
  linkedPostId?: string;   // 연계된 원본 게시글 ID
  linkedPostTitle?: string; // 연계된 원본 게시글 제목 (연계글 작성 시 저장)

  // 🚀 깐부방 관련
  kanbuRoomId?: string;    // 소속 깐부방 ID

  // 🚀 댓글 고정
  pinnedCommentId?: string; // 작성자가 고정한 댓글 ID
  commentsLocked?: boolean; // 작성자가 댓글 잠금

  // 🚀 땡스볼
  thanksballTotal?: number; // 받은 총 볼 수 (누적)

  // 🚀 조회수
  viewCount?: number; // 타인이 열람한 횟수 (자기 글 제외, 세션 내 중복 방지)

  // 🚀 공유수
  shareCount?: number; // 카카오/링크 공유 횟수 (누적)

}

export interface Thanksball {
  id: string;
  sender: string;      // 보낸 사람 닉네임
  senderId: string;    // 보낸 사람 UID
  amount: number;      // 볼 수 (1볼 = $1, 향후 실결제 연동)
  message?: string;    // 응원 메시지 (최대 50자, 선택)
  createdAt: FirestoreTimestamp;      // Firestore Timestamp
  isPaid: boolean;     // false = 가상볼(현재), true = 실결제(향후)
}

export interface KanbuRoom {
  id: string;
  title: string;
  description?: string;
  creatorId: string;
  creatorNickname: string;
  creatorLevel: number;
  createdAt: FirestoreTimestamp;
}

export interface KanbuChat {
  id: string;
  author: string;
  authorId: string;
  content: string;
  createdAt: FirestoreTimestamp;
}

// 🚀 우리들의 장갑: 커뮤니티 시스템 타입 정의

// 🚀 다섯 손가락 역할 체계
// thumb(엄지)=개설자, index(검지)=부관리자, middle(중지)=핵심멤버, ring(약지)=일반, pinky(새끼)=신입/대기
export type FingerRole = 'thumb' | 'index' | 'middle' | 'ring' | 'pinky';

// 🚀 가입 방식: open=자동승인, approval=승인제(노크), password=초대코드
export type JoinType = 'open' | 'approval' | 'password';

// 🚀 멤버 가입 상태: active=활성, pending=승인대기, banned=강퇴/차단
export type JoinStatus = 'active' | 'pending' | 'banned';

// 🚀 Phase 6 — 가입 폼 빌더 표준 필드 키
export type StandardFieldKey = 'name' | 'region' | 'phone' | 'email' | 'shares';

// 🚀 주식수 표시 단위
export type SharesUnit = '1' | '10' | '100' | '1000';

// 🚀 시/도 + 시/군/구 (정형 지역 데이터)
export interface Region {
  sido: string;      // 예: "경기도"
  sigungu: string;   // 예: "성남시 분당구"
}

// 🚀 표준 필드 정의 (대장이 가입 폼 빌더에서 설정)
export interface StandardField {
  key: StandardFieldKey;
  enabled: boolean;       // 사용 여부 (false면 가입 폼에 미노출)
  required: boolean;      // 필수 응답 여부
  // shares 전용
  sharesUnit?: SharesUnit;   // 입력 단위 (1=1주, 10=10주, 100=100주, 1000=1K)
  sharesLabel?: string;      // 종목명 (예: "삼성전자")
}

// 🚀 커스텀 질문 (자유 텍스트, 표준 필드에서 비활성화한 자리만큼 추가 가능)
export interface CustomQuestion {
  id: string;             // 'cq_1', 'cq_2' (클라이언트 생성)
  label: string;          // 질문 본문
  placeholder?: string;
  required: boolean;
  maxLength?: number;     // 기본 200
}

// 🚀 가입 폼 전체 정의 (Community에 임베드)
export interface JoinForm {
  standardFields: StandardField[];   // 5개 표준 필드 (enabled로 사용/미사용 결정)
  customQuestions: CustomQuestion[]; // 추가 자유 질문
}

// 🚀 신청자가 제출한 답변 (CommunityMember에 임베드)
export interface JoinAnswers {
  standard?: {
    name?: string;
    region?: Region;
    phone?: string;
    email?: string;
    shares?: { value: number; unit: SharesUnit; label?: string };
  };
  custom?: Array<{
    questionId: string;
    question: string;     // 스냅샷 (질문이 나중에 바뀌어도 당시 질문 보존)
    answer: string;
  }>;
}

// 🚀 인증 마킹 (대장/부대장이 ring 멤버에게 부여)
export interface VerifiedBadge {
  verifiedAt: FirestoreTimestamp;
  verifiedBy: string;          // thumb/index의 UID
  verifiedByNickname: string;  // 부여 시점 닉네임 스냅샷
  label: string;               // "주주", "홀더", "거주민" 등 (없으면 "인증")
}

// ════════════════════════════════════════════════════════════
// 🚀 우리들의 장갑 Phase 7 — 실시간 채팅방
// ════════════════════════════════════════════════════════════

// 채팅 메시지 답장 참조
export interface ChatReplyRef {
  messageId: string;
  author: string;
  snippet: string;        // 원본 메시지 일부 (50자 컷)
}

// 채팅 메시지
export interface ChatMessage {
  id: string;                        // chat_{timestamp}_{uid}
  communityId: string;

  // 작성자 (스냅샷 방식 — 채팅에서 매 메시지마다 members.find는 비용 과다)
  author: string;
  author_id: string;
  authorLevel: number;               // 작성 시점 레벨
  authorFinger?: FingerRole;         // 작성 시점 손가락 역할
  authorVerified?: VerifiedBadge;    // 작성 시점 인증 마킹

  // 본문
  content: string;                   // 최대 500자
  imageUrl?: string;                 // R2 업로드 이미지 (Step 4)

  // 답장 (Step 3)
  replyTo?: ChatReplyRef;

  // 이모지 반응 (Step 3) — emoji → userId 배열
  reactions?: { [emoji: string]: string[] };

  // 땡스볼 누적 (Step 5)
  thanksballTotal?: number;
  thanksballSenders?: string[];      // 최근 5명 닉네임

  // 메타
  createdAt: FirestoreTimestamp;
  editedAt?: FirestoreTimestamp;
  deleted?: boolean;                 // soft delete
}

// 채팅 활성화 한도 상수 (50명 이하 장갑만 채팅 사용 가능)
export const CHAT_MEMBER_LIMIT = 50;

export interface Community {
  id: string;                    // community_timestamp_uid 형식
  name: string;                  // 커뮤니티명
  description?: string;          // 한 줄 설명
  category: string;              // 주식|부동산|코인|취미|스포츠|게임|독서|요리|반려동물|여행|음악|개발|기타
  isPrivate: boolean;            // 비밀 장갑 여부 (레거시, joinType으로 대체 예정)
  creatorId: string;
  creatorNickname: string;
  creatorLevel: number;
  memberCount: number;           // increment 비정규화 (Firestore 읽기 비용 절감)
  postCount: number;             // increment 비정규화
  coverColor?: string;           // 커뮤니티 대표 색상 (미지정 시 기본값)
  createdAt: FirestoreTimestamp;
  // 🚀 다섯 손가락 Phase 1 — 가입 조건 설정
  joinType?: JoinType;           // 가입 방식 (미설정 시 'open'으로 취급)
  minLevel?: number;             // 최소 가입 레벨 (미설정 시 1)
  password?: string;             // 초대 코드 (joinType='password'일 때 사용)
  joinQuestion?: string;         // 승인제 가입 시 신청자에게 보여줄 안내 문구
  pinnedPostId?: string;         // 공지 고정 글 ID
  notifyMembers?: string[];      // 🚀 Phase 4: 새 글 알림 opt-in userId 목록
  // 🚀 Phase 6 — 가입 폼 빌더 (joinType='approval'일 때 활성)
  joinForm?: JoinForm;
}

export interface CommunityMember {
  userId: string;
  nickname: string;
  communityId: string;
  communityName: string;
  joinedAt: FirestoreTimestamp;
  role: 'owner' | 'member';     // 레거시 — 하위호환 유지 (thumb=owner, ring=member)
  // 🚀 다섯 손가락 Phase 1 — 역할 및 상태 확장
  finger?: FingerRole;           // 손가락 역할 (미설정 시 role='owner'→thumb, 'member'→ring으로 취급)
  joinStatus?: JoinStatus;       // 가입 상태 (미설정 시 'active'로 취급)
  joinMessage?: string;          // 승인제: 가입 신청 메시지
  banReason?: string;            // 강퇴/차단 사유
  // 🚀 Phase 6 — 가입 답변 (영구 보존, 본인+관리자만 조회)
  joinAnswers?: JoinAnswers;
  // 🚀 Phase 6 — 인증 마킹 (대장/부대장이 부여)
  verified?: VerifiedBadge;
}

export interface CommunityPost {
  id: string;                    // cpost_timestamp_uid 형식
  communityId: string;           // 소속 커뮤니티 ID
  communityName: string;         // 조회 최적화용 비정규화 (커뮤니티명)
  author: string;
  author_id: string;
  title?: string;
  content: string;               // HTML (TiptapEditor)
  imageUrl?: string;
  likes: number;
  likedBy?: string[];
  commentCount: number;
  createdAt: FirestoreTimestamp;
  // 🚀 다섯 손가락 Phase 1
  isPinned?: boolean;            // 공지 고정 여부 (엄지/검지만 설정 가능)
  isBlinded?: boolean;           // 관리자 블라인드 처리
}

// 🚀 거대 나무(자이언트 트리): 주장 전파 루트 문서
export interface GiantTree {
  id: string;                        // "tree_{timestamp}_{uid}"
  title: string;
  content: string;                   // HTML (TiptapEditor)
  author: string;                    // 닉네임
  author_id: string;                 // UID
  authorLevel: number;               // 생성 시점 레벨 스냅샷
  authorReputation: string;          // 생성 시점 평판 등급 스냅샷 ("약간 우호" | "우호" | "확고")
  maxSpread: number;                 // 전파 가능 최대 인원 (생성 시 고정, 초기: 10/30/100)
  totalNodes: number;                // 현재까지 생성된 노드 수 (실시간 집계)
  agreeCount: number;                // 전체 공감 수
  opposeCount: number;               // 전체 반대 수
  circuitBroken: boolean;            // 서킷 브레이커 발동 여부 (반대 비율 ≥ 70%, 최소 10노드)
  createdAt: FirestoreTimestamp;
}

// 🚀 거대 나무: 전파 노드 (giant_trees/{treeId}/nodes/{nodeId} 서브컬렉션)
export interface GiantTreeNode {
  id: string;                        // "node_{timestamp}_{uid}"
  depth: number;                     // 전파 단계 (0=작성자 루트, 1=1차 전파, ...)
  parentNodeId: string | null;       // 부모 노드 ID (루트는 null)
  participantNick: string;           // 이 노드 참여자 닉네임
  participantId: string;             // 이 노드 참여자 UID
  side: 'agree' | 'oppose';          // 공감 or 반대
  comment: string;                   // 짧은 코멘트 (선택, 최대 50자, 빈 문자열 허용)
  childCount: number;                // 자식 노드 수 (0~3)
  createdAt: FirestoreTimestamp;
}

// 🚀 거대 나무 잎사귀 — 앱 내에서 직접 진입한 일반 참여자
// 트리 정식 카운트(totalNodes)에 미포함, 잎사귀 10개 = 보너스 1% 성장 (최대 10%)
export interface GiantTreeLeaf {
  id: string;
  participantNick: string;
  participantId: string;
  side: 'agree' | 'oppose';
  comment: string;                   // 선택, 최대 50자
  createdAt: FirestoreTimestamp;
}

// ════════════════════════════════════════════════════════════
// 🚀 ADSMARKET — 광고 경매 시장 시스템
// ════════════════════════════════════════════════════════════

// 광고 소재 (광고주가 등록한 광고 단위)
export interface Ad {
  id: string;
  advertiserId: string;
  advertiserName: string;
  title: string;                     // 관리용 제목
  headline: string;                  // 배너 헤드라인 (최대 30자)
  description: string;               // 설명 문구 (최대 60자)
  imageUrl: string;                  // 배너 이미지 URL
  landingUrl: string;                // 클릭 시 이동 URL
  ctaText: string;                   // CTA 버튼 텍스트
  targetCategories: string[];        // 노출 대상 카테고리 (빈 배열 = 전체)
  targetRegions: string[];           // 노출 대상 지역 (빈 배열 = 전국)
  targetSlots: ('top' | 'middle' | 'bottom')[];
  bidType: 'cpm' | 'cpc';
  bidAmount: number;                 // 입찰가 (원)
  dailyBudget: number;
  totalBudget: number;
  startDate: FirestoreTimestamp;
  endDate: FirestoreTimestamp;
  status: 'draft' | 'pending_review' | 'active' | 'paused' | 'rejected' | 'completed' | 'exhausted';
  rejectionReason?: string;
  totalImpressions: number;
  totalClicks: number;
  totalSpent: number;
  ctr: number;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}

// 광고 이벤트 로그 (노출/클릭)
export interface AdEvent {
  id: string;
  adId: string;
  advertiserId: string;
  postId: string;
  postAuthorId: string;
  postCategory: string;
  slotPosition: 'top' | 'middle' | 'bottom';
  eventType: 'impression' | 'click';
  bidType: 'cpm' | 'cpc';
  bidAmount: number;
  viewerUid: string;
  sessionId: string;
  isSuspicious: boolean;
  createdAt: FirestoreTimestamp;
}

// 일일 광고 수익 집계
export interface DailyAdRevenue {
  id: string;
  date: string;                      // 'YYYY-MM-DD'
  postAuthorId: string;
  postAuthorNickname: string;
  postBreakdown: {
    postId: string;
    postTitle: string;
    category: string;
    impressions: number;
    clicks: number;
    grossRevenue: number;
  }[];
  totalImpressions: number;
  totalClicks: number;
  grossRevenue: number;
  creatorShare: number;
  platformShare: number;
  revenueShareRate: number;
  creatorLevel: number;
  status: 'provisional' | 'confirmed' | 'adjusted';
  createdAt: FirestoreTimestamp;
}

// 광고주 계정
export interface AdvertiserAccount {
  id: string;
  uid: string;
  businessName: string;
  businessNumber: string;
  representativeName: string;
  businessAddress: string;
  email: string;
  phone: string;
  balance: number;
  totalCharged: number;
  totalSpent: number;
  status: 'active' | 'suspended' | 'dormant';
  isVerified: boolean;
  createdAt: FirestoreTimestamp;
}

// 글 작성자 정산 내역
export interface Settlement {
  id: string;
  creatorId: string;
  creatorNickname: string;
  periodStart: string;
  periodEnd: string;
  adRevenue: number;
  thanksBallRevenue: number;
  grossTotal: number;
  incomeType: 'business' | 'other';
  taxRate: number;
  taxAmount: number;
  netAmount: number;
  status: 'pending' | 'processing' | 'completed' | 'rejected' | 'cancelled';
  rejectionReason?: string;
  completedAt?: FirestoreTimestamp;
  createdAt: FirestoreTimestamp;
}
