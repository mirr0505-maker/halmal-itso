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
  factChecked?: boolean;   // 벌거벗은 임금님: 사실 확인 여부
  debatePosition?: 'pro' | 'con' | 'neutral'; // 임금님 귀는 당나귀 귀: 초기 입장
  location?: string;       // 현지 소식: 발생 지역
  infoPrice?: number;      // 지식 소매상: 정보 가치(포인트)
  bgColor?: string;        // 뼈때리는 글: 배경색

  // 🚀 한컷 관련 필드
  isOneCut?: boolean;      // 한컷 게시물 여부
  linkedPostId?: string;   // 연계된 원본 게시글 ID
}
