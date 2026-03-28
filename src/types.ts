// src/types.ts

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
  createdAt: any; // Firestore Timestamp
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

}

export interface Thanksball {
  id: string;
  sender: string;      // 보낸 사람 닉네임
  senderId: string;    // 보낸 사람 UID
  amount: number;      // 볼 수 (1볼 = $1, 향후 실결제 연동)
  message?: string;    // 응원 메시지 (최대 50자, 선택)
  createdAt: any;      // Firestore Timestamp
  isPaid: boolean;     // false = 가상볼(현재), true = 실결제(향후)
}

export interface KanbuRoom {
  id: string;
  title: string;
  description?: string;
  creatorId: string;
  creatorNickname: string;
  creatorLevel: number;
  createdAt: any;
}

export interface KanbuChat {
  id: string;
  author: string;
  authorId: string;
  content: string;
  createdAt: any;
}

// 🚀 우리들의 장갑: 커뮤니티 시스템 타입 정의

// 🚀 다섯 손가락 역할 체계
// thumb(엄지)=개설자, index(검지)=부관리자, middle(중지)=핵심멤버, ring(약지)=일반, pinky(새끼)=신입/대기
export type FingerRole = 'thumb' | 'index' | 'middle' | 'ring' | 'pinky';

// 🚀 가입 방식: open=자동승인, approval=승인제(노크), password=초대코드
export type JoinType = 'open' | 'approval' | 'password';

// 🚀 멤버 가입 상태: active=활성, pending=승인대기, banned=강퇴/차단
export type JoinStatus = 'active' | 'pending' | 'banned';

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
  createdAt: any;
  // 🚀 다섯 손가락 Phase 1 — 가입 조건 설정
  joinType?: JoinType;           // 가입 방식 (미설정 시 'open'으로 취급)
  minLevel?: number;             // 최소 가입 레벨 (미설정 시 1)
  password?: string;             // 초대 코드 (joinType='password'일 때 사용)
  joinQuestion?: string;         // 승인제 가입 시 신청자에게 보여줄 안내 문구
  pinnedPostId?: string;         // 공지 고정 글 ID
}

export interface CommunityMember {
  userId: string;
  nickname: string;
  communityId: string;
  communityName: string;
  joinedAt: any;
  role: 'owner' | 'member';     // 레거시 — 하위호환 유지 (thumb=owner, ring=member)
  // 🚀 다섯 손가락 Phase 1 — 역할 및 상태 확장
  finger?: FingerRole;           // 손가락 역할 (미설정 시 role='owner'→thumb, 'member'→ring으로 취급)
  joinStatus?: JoinStatus;       // 가입 상태 (미설정 시 'active'로 취급)
  joinMessage?: string;          // 승인제: 가입 신청 메시지
  banReason?: string;            // 강퇴/차단 사유
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
  createdAt: any;
  // 🚀 다섯 손가락 Phase 1
  isPinned?: boolean;            // 공지 고정 여부 (엄지/검지만 설정 가능)
  isBlinded?: boolean;           // 관리자 블라인드 처리
}
