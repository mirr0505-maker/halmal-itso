// src/types.ts

// 🏚️ 유배·귀양지 카테고리 단일 진실 소스
// Why: literal 문자열이 RootPostCard/DiscussionView/useFirestoreActions/ExileMainPage 등 다수
//      파일에 흩어지면 오타(중점 `·` vs 하이픈 `-` 등) 1글자로 조용히 오동작. 상수로 고정.
export const EXILE_CATEGORY = '유배·귀양지' as const;

// ═══════════════════════════════════════════════════════
// 🛡️ 주주방 인증 체계 (SHAREHOLDER_TIER.md 참조)
// ═══════════════════════════════════════════════════════
export type ShareholderTier = 'shrimp' | 'shark' | 'whale' | 'megawhale';

export const TIER_CONFIG = {
  shrimp:    { emoji: '🐟', label: '새우',    min: 1,      max: 999 },
  shark:     { emoji: '🦈', label: '상어',    min: 1000,   max: 9999 },
  whale:     { emoji: '🐋', label: '고래',    min: 10000,  max: 99999 },
  megawhale: { emoji: '🐳', label: '대왕고래', min: 100000, max: Infinity },
} as const;

export const getTierFromQuantity = (qty: number): ShareholderTier => {
  if (qty >= 100000) return 'megawhale';
  if (qty >= 10000)  return 'whale';
  if (qty >= 1000)   return 'shark';
  return 'shrimp';
};

export const tierRangeLabel = (tier: ShareholderTier): string => ({
  shrimp: '1~999',
  shark: '1천~1만',
  whale: '1만~10만',
  megawhale: '10만+',
}[tier]);

// 🚀 FirestoreTimestamp: Firestore Timestamp 최소 구조 (서버·클라이언트 양쪽 호환)
export interface FirestoreTimestamp {
  seconds: number;
  nanoseconds?: number;
  toDate?: () => Date;
}

// ═══════════════════════════════════════════════════════
// 🏅 평판 V2 (REPUTATION_V2.md §7.1 UserData 확장)
// ═══════════════════════════════════════════════════════
// 본 5단계(Phase A/B/C) + Prestige 3단계(Phase C에서만 활성)
export type TierKey =
  | 'neutral'
  | 'slightlyFriendly'
  | 'friendly'
  | 'veryFriendly'
  | 'firm'
  | 'legend'   // Phase C
  | 'awe'      // Phase C
  | 'mythic';  // Phase C

// 어뷰징 플래그 — CF 'detectAbuse*' 계열이 설정, 클라이언트 수정 불가(Rules)
export interface AbuseFlags {
  shortPostSpam?: boolean;      // 10자 글 스팸 50%+
  circularThanksball?: boolean; // 맞땡스볼 의심
  multiAccount?: boolean;       // 다계정 (Phase C)
  massFollowUnfollow?: boolean; // 깐부 펌프 (선택)
  flaggedAt?: FirestoreTimestamp;
  flaggedReason?: string;
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
  /**
   * 내가 맺은 깐부(팔로우 중인 유저)의 닉네임 목록 — KANBU_V2 §3.3·§5.1
   * - UI 표기: "깐부 N명" (내가 소비하는 축, 유튜브 '구독 중인 채널'에 해당)
   * - 단방향 팔로우 (상대 동의 불필요 · 상대 문서에 쓰기 없음)
   * - 깐부수(나를 맺은 수)는 followerCounts 전역 집계로 실시간 계산 — users 문서 미저장
   * - Phase D(유저 10,000+)에 UID 배열로 마이그레이션 예정 (같은 필드명 유지)
   */
  friendList?: string[];
  blockList?: string[];   // 차단 유저 닉네임 목록
  subscriberCount?: number;
  isPhoneVerified?: boolean;
  // 🚀 땡스볼 관련 잔액·누적
  ballBalance?: number;   // 보유 볼 잔액
  ballSpent?: number;     // 누적 사용 볼
  ballReceived?: number;  // 누적 받은 볼
  createdAt?: FirestoreTimestamp;        // 가입일 (Firestore Timestamp)
  nicknameChangedAt?: FirestoreTimestamp; // 닉네임 변경일
  nicknameChangeCount?: number;           // 닉네임 변경 횟수 (평생 1회 게이트, ANTI_ABUSE.md §8)
  previousNicknames?: string[];           // 이전 닉네임 이력 (공개 프로필 표시)
  // 🏚️ 놀부의 텅 빈 곳간 (유배귀양지) — Phase 1
  strikeCount?: number;              // 누적 유배 횟수 (기본 0, 영구 보존)
  sanctionStatus?: SanctionStatus;   // 유배 상태 (미설정 시 'active')
  sanctionExpiresAt?: FirestoreTimestamp | null;  // 속죄금 결제 가능 시점 (반성 기간 만료)
  requiredBail?: number;             // 필요 속죄금 (볼)
  sanctionReason?: string;           // 관리자 입력 사유
  sanctionedAt?: FirestoreTimestamp; // 유배 시작 시각
  sanctionedBy?: string;             // 처분 관리자 UID
  phoneVerified?: boolean;           // 휴대폰 인증 여부
  phoneHash?: string | null;         // sha256(phoneNumber) — 블랙리스트 매칭용
  phoneVerifiedAt?: FirestoreTimestamp | null;
  // 📱 Sprint 7 Step 7-C — 추천코드 (generate/redeem CF 전용, 클라 read-only)
  referralCode?: string;             // 본인 코드 (발급 시 자동, 변경 불가)
  referredByCode?: string;           // 가입 시 사용한 타인 코드 (1인 1회)
  referredByUid?: string;            // 추천인 UID 역조회 편의
  referralPendingCount?: number;     // 대기 중 추천 수 (7일 미경과)
  referralConfirmedCount?: number;   // 확정 추천 수 (보상 지급됨)
  referralMonthKey?: string;         // "2026-04" 월 Rate Limit 키
  referralMonthlyCount?: number;     // 이번 달 redeem 횟수
  // 🏅 평판 V2 (REPUTATION_V2.md §7.1) — CF만 쓰기, 클라이언트 read-only
  reputationCached?: number;                // 최종 평판 점수 (v2-R 공식 결과)
  reputationTierCached?: TierKey;           // 캐시된 Tier
  reputationUpdatedAt?: FirestoreTimestamp; // 캐시 갱신 시각
  lastActiveAt?: FirestoreTimestamp;        // 의미 있는 활동 최근 시각 (decay 입력)
  abuseFlags?: AbuseFlags;                  // 어뷰징 감점 입력
  grandfatheredPrestigeTier?: 'legend' | 'awe' | 'mythic'; // Phase C 경계값 조정 시 보호
  grandfatheredAt?: FirestoreTimestamp;
  // 🏅 Creator Score (CREATOR_SCORE.md) — CF만 쓰기, 클라이언트 read-only
  creatorScoreCached?: number;                 // 최종 점수 (rep × act × trust / 1000)
  creatorScoreTier?: MapaeKey;                 // 마패 티어 캐시
  creatorScoreUpdatedAt?: FirestoreTimestamp;  // 캐시 갱신 시각
  recent30d_posts?: number;                    // 최근 30일 글 수
  recent30d_comments?: number;                 // 최근 30일 댓글 수
  recent30d_likesSent?: number;                // 최근 30일 내가 누른 좋아요 수
  recent30dUpdatedAt?: FirestoreTimestamp;     // recent30d 집계 시각
  reportsUniqueReporters?: number;             // Phase C — 고유 신고자 수
  reportsUpdatedAt?: FirestoreTimestamp;       // Phase C — 신고 집계 시각
  likesSent?: number;                          // 누적 내가 누른 좋아요 수 (평생값)
  exileHistory?: ExileRecord[];                // 유배 이력 배열 (단계별 타임스탬프)
  creatorScoreOverride?: CreatorScoreOverride; // Phase C — adminAdjustCreatorScore로 설정한 수동 보정값
  // 🏷️ Sprint 5 — 칭호 시스템 V1 (MAPAE_AND_TITLES_V1.md)
  // CF titleAwarder만 titles/* 쓰기, primaryTitles만 self-write(Rules max 3개 제한)
  titles?: UserTitle[];                 // 보유 칭호 (영구, CF만 append/upgrade)
  primaryTitles?: string[];             // 대표 선택 칭호 id 목록 (D2-β 최대 3개)
  validCommentCount?: number;           // 유효 댓글 누적 (D3-γ: 10자 이상 OR 고유 반응 5+)
  ballSentTotal?: number;               // 누적 보낸 땡스볼 (sponsor I/II/III 판정)
  consecutivePostDays?: number;         // 연속 일자 (writer_diligent I/II/III)
  lastPostDate?: string;                // 'YYYY-MM-DD' (KST) — 연속 판정용
  // 🆔 Sprint 7.5 — 고유번호 (가입 시 자동 발급, 영구 불변, 타인이 "나"를 참조하는 키)
  //    8자리 영숫자 (0/O/I/1 제외). UI 표기: "글러브 #XXXXXXXX"
  //    Rules: create 후 본인 write 차단 (CF 전용)
  userCode?: string;
  // 🗑️ Sprint 7.5 — 회원 탈퇴 (소프트 딜리트 30일 유예)
  //    isDeleted=true 시 purgeDeletedAccounts가 deletedAt+30d 경과 시 Auth+문서 hard 삭제
  //    30일 내 재로그인 시 cancelAccountDeletion으로 부활 가능
  //    Rules: 양쪽 필드 모두 CF 전용 (requestAccountDeletion/cancelAccountDeletion/purgeDeletedAccounts)
  isDeleted?: boolean;
  deletedAt?: FirestoreTimestamp | null;
  deletionReason?: string;              // 탈퇴 사유 (유저 선택/입력)
  // 🔰 Sprint 7.5 — 최초 닉네임 설정 완료 플래그 (온보딩 진입 판단)
  //    false/undefined: NicknameSetupScreen 노출. true: 온보딩 통과.
  //    changeNickname CF가 최초 1회 무료로 전환 후 true 기록.
  nicknameSet?: boolean;
}

// 🔧 Creator Score 수동 조정 override — adminAdjust.js 전용
// Why: 탐지 CF가 놓친 케이스의 긴급 보정. creatorScoreCache·Events가 우선 적용
//      expiresAt 경과 시 자동 제거 → 수식 값으로 fallback
export interface CreatorScoreOverride {
  value: number;                       // 덮어쓸 creatorScore 값 (0~10)
  reason: string;                      // 관리자 입력 사유
  setBy: string;                       // 관리자 닉네임
  setAt: FirestoreTimestamp;           // 설정 시각
  expiresAt: FirestoreTimestamp | null; // null이면 무기한
}

// 🏅 마패 티어 — CREATOR_SCORE.md §마패 티어 경계 (동/은/금/백금/다이아)
// Why: MAPAE_THRESHOLDS(constants.ts)와 짝. Score 범위로 티어 결정
export type MapaeKey = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

// ═══════════════════════════════════════════════════════
// 🏷️ 칭호 시스템 V1 (MAPAE_AND_TITLES_V1.md §3~4) — Sprint 5
// ═══════════════════════════════════════════════════════
// Why: 마패(Creator Score 상태·가변)와 칭호(업적·영구)는 독립 축.
//      titles(마스터) + users.titles(부착본) + title_achievements(감사)
//      + title_revocations(회수 이력) + mapae_history(마패 티어 변경)

export type TitleCategory = 'creator' | 'community' | 'loyalty';
export type TitleTier = 'I' | 'II' | 'III';
export type TitleNotificationLevel = 'toast' | 'celebration' | 'modal';

// 🏷️ 회수 정책 (D5-β 매트릭스 §9) — 실제 3패턴
//  permanent              — 4/4 유지 (pioneer_2026)
//  revoke_on_ban          — 1·2·3차 유배까지는 keep, 사약에서만 revoke
//                            (writer_seed / sponsor / veteran_2year)
//  suspend_lv2_revoke_lv3 — 1차 keep, 2차 suspend(hide·표시 숨김/부활 가능),
//                            3차·사약 영구 revoke (나머지 10종 — 가장 흔한 패턴)
export type TitleRevocationPolicy =
  | 'permanent'
  | 'revoke_on_ban'
  | 'suspend_lv2_revoke_lv3';

// 🏷️ 유저 부착 칭호 — users.titles[] 원소
export interface UserTitle {
  id: string;                           // TITLE_CATALOG id (e.g., 'writer_diligent')
  tier?: TitleTier;                     // 단계형 칭호만 (writer_diligent/chat_master/sponsor/dedication)
  achievedAt: FirestoreTimestamp;
  upgradedAt?: FirestoreTimestamp;      // 티어 상승 시점
  suspended?: boolean;                  // lv1_suspend 정책에서 유배 중 true
  context?: Record<string, unknown>;    // 달성 컨텍스트 (예: viral_first postId)
}

// 🏷️ 칭호 마스터 — titles/{titleId} 문서
export interface TitleMaster {
  id: string;
  emoji: string;
  label: string;                                   // 기본 라벨 (또는 I단계 라벨)
  labelByTier?: Partial<Record<TitleTier, string>>; // 단계형 전용 (I/II/III별 라벨)
  category: TitleCategory;
  description: string;                             // 달성 조건 설명
  revocationPolicy: TitleRevocationPolicy;
  notificationLevel: TitleNotificationLevel;
  tiered?: boolean;                                // 단계형 여부
  createdAt?: FirestoreTimestamp;
  updatedAt?: FirestoreTimestamp;
}

// 🏚️ 유배 이력 레코드 — exileHistory 배열 원소. 재범 배수 계산용
// Why: sanctionStatus는 현재 상태만 표현, 과거 몇 차례 어떤 단계 유배였는지 trust 공식에 필요
export interface ExileRecord {
  level: 1 | 2 | 3;
  enteredAt: FirestoreTimestamp;       // 유배 시작 시각
  releasedAt?: FirestoreTimestamp;     // 속죄금 납부 또는 만료 (사약 시 미설정)
  reason?: string;                      // 관리자 입력 사유
  bailPaid?: number;                    // 납부 속죄금 (볼)
}

// 🏚️ 유배 상태
export type SanctionStatus = 'active' | 'exiled_lv1' | 'exiled_lv2' | 'exiled_lv3' | 'banned';

// 🏚️ 단계별 유배 정책 (클라이언트/서버 공통)
export interface SanctionPolicy {
  level: 1 | 2 | 3;
  status: SanctionStatus;
  reflectionDays: number;   // 반성 기간 (일)
  bailAmount: number;       // 속죄금 (볼)
}

// 🏚️ SANCTION_POLICIES 상수는 src/constants.ts로 이관 (types.ts는 타입 전용 유지)

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
  // 🍞 헨젤의 빵부스러기 — 1~4컷 캐러셀 배열. 하위호환을 위해 imageUrl도 imageUrls[0]로 동시 저장.
  // 렌더링: imageUrls?.length ? imageUrls : (imageUrl ? [imageUrl] : [])
  imageUrls?: string[];
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
  kanbuBoardType?: 'free' | 'paid_once' | 'paid_monthly';  // 🚀 깐부방 게시판 유형

  // 🚀 댓글 고정
  pinnedCommentId?: string; // 작성자가 고정한 댓글 ID
  commentsLocked?: boolean; // 작성자가 댓글 잠금

  // 🚀 땡스볼
  thanksballTotal?: number; // 받은 총 볼 수 (누적)

  // 🚀 조회수
  viewCount?: number; // 타인이 열람한 횟수 (자기 글 제외, 세션 내 중복 방지)

  // 🚀 공유수
  shareCount?: number; // 카카오/링크 공유 횟수 (누적)

  // 🖋️ Phase 5-C: 잉크병 회차 댓글 soft delete (true면 placeholder로 표시)
  isDeleted?: boolean;

  // 🖋️ Phase 5-D: 잉크병 회차 댓글 답글 (1단계 대댓글) — 원댓글 ID 참조
  parentCommentId?: string;

  // 🖋️ 마르지 않는 잉크병 (연재) 전용 필드 — category가 "magic_inkwell"일 때만 사용
  seriesId?: string;
  episodeNumber?: number;
  episodeTitle?: string;
  authorNote?: string;
  isPaid?: boolean;
  price?: number;
  previewContent?: string;
  isHidden?: boolean;  // 비공개 전환된 회차 (구매자 있을 때 삭제 대신 사용)
  isHiddenByExile?: boolean;  // 🏚️ 유배 처분으로 숨김 처리된 글 (피드에서 제외)
  hiddenByExileAt?: FirestoreTimestamp;
  exileLevel?: 1 | 2 | 3;  // 🏚️ 유배지 글 탭 식별 (category='유배·귀양지'와 함께)
}

// ════════════════════════════════════════════════════════
// 🖋️ 마르지 않는 잉크병 — 연재 시스템 타입
// ════════════════════════════════════════════════════════

export type SeriesGenre = 'novel' | 'poem' | 'essay' | 'webtoon' | 'comic';
export type SeriesStatus = 'serializing' | 'completed' | 'hiatus' | 'deleted';

export interface Series {
  id: string;                      // series_{timestamp}_{uid}
  title: string;
  synopsis: string;                // 시놉시스 (500자 제한)
  coverImageUrl: string;           // R2 URL
  genre: SeriesGenre;
  tags?: string[];                 // 최대 5개

  authorId: string;
  authorNickname: string;
  authorProfileImage?: string;

  totalEpisodes: number;
  totalViews: number;
  totalLikes: number;
  subscriberCount: number;

  isCompleted: boolean;
  status: SeriesStatus;

  // 부분 유료화 설정
  freeEpisodeLimit: number;        // 무료 회차 수 (예: 10)
  defaultPrice: number;            // 기본 회차 가격 (땡스볼)

  lastEpisodeAt: FirestoreTimestamp;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}

// 에피소드는 기존 Post 인터페이스를 확장하여 사용
// posts 컬렉션에 category: "magic_inkwell"로 저장됨
export interface InkwellEpisodeFields {
  category: 'magic_inkwell';
  seriesId: string;
  episodeNumber: number;
  episodeTitle: string;
  authorNote?: string;
  isPaid: boolean;
  price: number;
  previewContent?: string;         // 유료 회차 미리보기 (200자)
}

// 유료 회차 본문 (서브컬렉션 posts/{postId}/private_data/content)
export interface EpisodePrivateContent {
  body: string;
  images?: string[];               // 웹툰/만화 이미지 URL 목록
}

// 구매 영수증
export interface UnlockedEpisode {
  userId: string;
  postId: string;
  seriesId: string;
  authorId: string;
  paidAmount: number;
  unlockedAt: FirestoreTimestamp;
  // 🖋️ 플랫폼 수수료 분배 내역 (2026-04-11~ 적용, 이전 영수증에는 없음)
  platformFee?: number;
  authorRevenue?: number;
  feeRate?: number;
  // 🖋️ 대여 옵션 대비 선제 필드 (현재 미사용 — 영구 소장)
  // 향후 "3일 대여" 같은 옵션 도입 시 EpisodeReader의 isUnlocked 판정에 만료 체크 추가
  expiryDate?: FirestoreTimestamp | null;
}

// 작품 구독 (깐부)
export interface SeriesSubscription {
  userId: string;
  seriesId: string;
  subscribedAt: FirestoreTimestamp;
  notifyOnNewEpisode: boolean;
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
  // 🚀 깐부방 업그레이드 — 멤버십 관리
  memberCount?: number;       // 가입 멤버 수
  memberIds?: string[];       // 가입 멤버 UID 목록 (접근 제어 + 가입 판단)
  // 🚀 유료 게시판 설정 — 개설자가 관리 탭에서 A/B 타입 개설
  paidBoards?: {
    once?: { enabled: boolean; price: number; title: string };     // A타입: 1회 결제
    monthly?: { enabled: boolean; price: number; title: string };  // B타입: 월 구독
  };
  paidOnceMembers?: string[];     // 1회 결제 완료 (영구)
  paidMonthlyMembers?: string[];  // 월 구독 활성 멤버
  // 🔴 라이브 세션 현재 상태 (활성 세션이 있으면 LIVE 배지 표시)
  liveSessionId?: string | null;
  // 🚀 2026-04-17: 대표 이미지 (16:9) R2 업로드, 미설정 시 그라데이션 폴백
  thumbnailUrl?: string;
  // 🚀 2026-04-17: 카드 표시 옵션 — 개설자가 관리 탭에서 on/off. 미정의 시 모두 true
  cardSettings?: {
    showHostInfo?: boolean;       // 호스트 아바타/Lv/평판 스니펫 (기본 true)
    showMember?: boolean;         // 멤버 수 (기본 true)
    showThanksball?: boolean;     // 방 땡스볼 합계 (기본 true)
    showPaidPreview?: boolean;    // 유료/구독 최신글 제목 (기본 true)
  };
}

// ═══════════════════════════════════════════════════════
// 🔴 깐부방 라이브 이코노미 (Phase 4-A 텍스트 라이브)
// ═══════════════════════════════════════════════════════
export type LiveSessionStatus = 'ready' | 'live' | 'ended' | 'killed';

export interface LiveSession {
  id: string;
  roomId: string;                    // 소속 깐부방
  hostUid: string;
  hostNickname: string;
  title: string;
  type: 'text';                      // Phase 4-A: 텍스트 전용. 향후 'audio' | 'onlab' 추가
  status: LiveSessionStatus;
  startedAt: FirestoreTimestamp | null;
  endedAt: FirestoreTimestamp | null;
  activeUsers: number;               // 동접 수 (하트비트 기반)
  totalThanksball: number;           // 누적 후원
  createdAt: FirestoreTimestamp;
}

export interface LiveBoardLine {
  id: string;
  order: number;                     // 표시 순서
  text: string;                      // 한 문장 단위
  style: 'normal' | 'highlight' | 'title';
  committedAt: FirestoreTimestamp;
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
  // 🛡️ 주주방 전용 — 등급 + 인증 출처 (SHAREHOLDER_TIER.md §5)
  tier?: ShareholderTier;
  source?: 'manual' | 'screenshot' | 'mydata' | 'manual_override';
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
  fileUrl?: string;                  // R2 업로드 문서 파일 (PDF/DOC/XLSX/PPTX)
  fileName?: string;                 // 원본 파일명

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
  thumbnailUrl?: string;          // 🧤 커뮤니티 대표 이미지 (R2 업로드, 미설정 시 coverColor 폴백)
  chatBgUrl?: string;             // 🧤 채팅방 바탕화면 이미지 (R2 업로드, 미설정 시 bg-slate-50)
  createdAt: FirestoreTimestamp;
  // 🤖 정보봇 (category='주식' 장갑 전용)
  infoBot?: CommunityInfoBot;
  // 🚀 다섯 손가락 Phase 1 — 가입 조건 설정
  joinType?: JoinType;           // 가입 방식 (미설정 시 'open'으로 취급)
  minLevel?: number;             // 최소 가입 레벨 (미설정 시 1)
  password?: string;             // 초대 코드 (joinType='password'일 때 사용)
  joinQuestion?: string;         // 승인제 가입 시 신청자에게 보여줄 안내 문구
  pinnedPostId?: string;         // 공지 고정 글 ID
  notifyMembers?: string[];      // 🚀 Phase 4: 새 글 알림 opt-in userId 목록
  // 🚀 멤버 승급 조건 (미설정 시 DEFAULT_PROMOTION_RULES 사용)
  promotionRules?: PromotionRules;
  // 🚀 Phase 6 — 가입 폼 빌더 (joinType='approval'일 때 활성)
  joinForm?: JoinForm;
  // 🧤 닉네임 배지 — 가입 답변 중 채팅/댓글 닉네임 옆에 표시할 필드 키
  // 예: 'shares' → 주식수(K단위), 'custom_xxx' → 커스텀 질문 답변
  displayBadgeKey?: string;
  // 🛡️ 주주방 전용 — 종목 설정 (SHAREHOLDER_TIER.md §9)
  shareholderSettings?: {
    stockCode: string;       // 종목코드 (예: "005930")
    stockName: string;       // 종목명 (예: "삼성전자")
    enableMydata: boolean;   // Phase E~F 마이데이터 인증 활성화 (기본 false)
  };
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
  // 🛡️ 주주 인증 요청 (멤버가 스크린샷+자기신고 제출 → 방장이 확인)
  verifyRequest?: {
    screenshotUrl: string;           // R2 업로드 증권사 보유 현황 스크린샷
    selfReportedQty: number;         // 자기신고 보유수
    requestedAt: FirestoreTimestamp;
    status: 'pending' | 'approved' | 'rejected';
    approvedAt?: FirestoreTimestamp;      // 승인 시점 (30일 후 스크린샷 자동 만료)
  };
  // 🛡️ 방장이 재인증 요청한 경우 (멤버에게 알림 → 재등록 유도)
  reverifyRequestedAt?: FirestoreTimestamp;
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
  thanksballTotal?: number;      // 받은 땡스볼 총수
  pinnedCommentId?: string;      // 작성자가 고정한 댓글 ID
}

// 🤖 정보봇 설정 (category='주식' 장갑 전용, 대장이 월 20볼 결제)
export type InfoBotSource = 'news' | 'dart' | 'report' | 'price' | 'policy';

export interface CommunityInfoBot {
  enabled: boolean;
  keywords: string[];                  // 매칭 키워드 (최대 5개)
  stockCode?: string;                  // 종목코드 (예: "005930")
  corpCode?: string;                   // DART 고유번호
  sources: InfoBotSource[];            // 활성화된 소스
  priceAlertThresholds: number[];      // 주가 변동 알림 임계값 [5, 10, 15, 20, 25, 30]
  activatedAt: FirestoreTimestamp;
  expiresAt: FirestoreTimestamp;       // activatedAt + 30일
  activatedBy: string;                 // 결제한 대장 uid
  totalPaid: number;                   // 누적 결제 총액
}

// ════════════════════════════════════════════════════════════
// 🏪 강변 시장 (Riverside Market) — 크리에이터 이코노미
// ════════════════════════════════════════════════════════════

// 강변 시장 카테고리 — 황금알을 낳는 거위 INFO_GROUPS와 동일 체계
export type MarketCategory = string;

// 가판대 단건 판매글
export interface MarketItem {
  id: string;                        // mkt_{timestamp}_{uid}
  authorId: string;
  authorNickname: string;
  authorLevel: number;               // 작성 당시 레벨 (Lv3+)
  title: string;
  previewContent: string;            // 티저 본문 (30%)
  category: MarketCategory;
  tags: string[];                    // 최대 5개
  price: number;                     // 땡스볼 1~100
  coverImageUrl?: string;            // 표지 이미지 (R2)
  purchaseCount: number;
  ratingAvg: number;
  ratingCount: number;
  status: 'active' | 'hidden' | 'deleted';
  createdAt: FirestoreTimestamp;
  updatedAt?: FirestoreTimestamp;
}

// 가판대 구매 영수증
export interface MarketPurchase {
  itemId: string;
  userId: string;
  authorId: string;
  pricePaid: number;                 // 구매자 결제 총액
  platformFee: number;               // 플랫폼 수수료
  creatorEarned: number;             // 크리에이터 수령액
  feeRate: number;                   // 적용된 수수료율 (감사 추적)
  rating?: number;                   // 별점 1~5 (구매 후 선택)
  review?: string;                   // 한 줄 평 (선택)
  reviewedAt?: FirestoreTimestamp;
  purchasedAt: FirestoreTimestamp;
}

// 단골장부 상점
export interface MarketShop {
  id: string;                        // creator_{uid}
  creatorId: string;
  shopName: string;
  shopDescription: string;           // 200자 이내
  coverImageUrl?: string;
  subscriptionPrice: number;         // 30일 이용권 가격 (땡스볼)
  subscriberCount: number;
  totalRevenue: number;
  status: 'active' | 'hidden';
  createdAt: FirestoreTimestamp;
}

// 단골장부 구독
export interface MarketSubscription {
  creatorId: string;
  subscriberId: string;
  shopId: string;
  pricePaid: number;
  startedAt: FirestoreTimestamp;
  expiresAt: FirestoreTimestamp;      // startedAt + 30일
  isActive: boolean;
  renewCount: number;
}

// 🚀 멤버 승급 조건 (Community에 임베드)
export interface PromotionRules {
  // 새내기(pinky) → 멤버(ring)
  toRing: { posts: number; likes: number };
  // 멤버(ring) → 핵심멤버(middle)
  toMiddle: { posts: number; likes: number };
}

// 디폴트 승급 조건
export const DEFAULT_PROMOTION_RULES: PromotionRules = {
  toRing: { posts: 3, likes: 10 },
  toMiddle: { posts: 5, likes: 20 },
};

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
