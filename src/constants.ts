// src/constants.ts — 앱 전역 설정값 (메뉴 구성, 테스트 계정, 필터 기준)
import type {
  SanctionPolicy,
  TitleCategory,
  TitleRevocationPolicy,
  TitleNotificationLevel,
  TitleTier,
} from './types';

// ════════════════════════════════════════════════════════════
// 🚩 FEATURE FLAGS — Phase C 토글 스위치
// ════════════════════════════════════════════════════════════
// 🚀 Phase C(Prestige 평판) 자연 발동 감지 루프용 플래그
// Why: TUNING_SCHEDULE.md §3.4 — 첫 전설(10,000 평판) 달성자 감지 시 자동 ON
//      Phase A/B에서는 false 유지, Custom Claims/관리자 CF로 토글 예정
// 참조: Reputation.md (Prestige 티어 legend/awe/mythic)
export const FEATURE_FLAGS = {
  PRESTIGE_REPUTATION_ENABLED: false,
  PRESTIGE_LAUNCH_DATE: null as string | null, // ISO 8601, 예: '2026-10-01'
} as const;

// 🚀 볼 ↔ 원화 환율 — 1볼 = 100원 (PRICING.md §0.3)
// Why: 에러 메시지·UI 표기에서 원화 병기 시 일관성 확보
//      추후 formatBallWithKrw(10) → "10볼(1,000원)" 헬퍼의 기반 상수
export const BALL_TO_KRW = 100;

// ════════════════════════════════════════════════════════════
// 🎖️ REPUTATION — 평판 티어 경계 + 감쇠 설정
// ════════════════════════════════════════════════════════════
// 🚀 평판 티어 경계 — Reputation.md (8단계)
// Why: 현재 utils.ts:79 `REPUTATION_THRESHOLDS`가 neutral/mild/friendly/... 4단계만 정의.
//      Phase C Prestige(legend/awe/mythic) 확장을 미리 상수화
export const REPUTATION_TIERS = {
  neutral: 0,
  mild: 300,
  friendly: 1_000,
  veryFriendly: 2_000,
  firm: 3_000,
  legend: 10_000,    // Phase C Prestige 시작점
  awe: 50_000,
  mythic: 100_000,
} as const;

// 🚀 감쇠 설정 — REPUTATION_V2.md §5 (Phase B 이후)
// Why: 비활성 유저 평판 서서히 감쇠. Phase A는 감쇠 없음, Phase B에서 월 0.5%
export const DECAY_CONFIG = {
  GRACE_PERIOD_DAYS: 30,     // 가입 30일 미만은 감쇠 면제
  MONTHLY_DECAY_RATE: 0.005, // 월 0.5%
  MIN_DECAY_FACTOR: 0.7,     // 최대 30%까지만 감쇠 (하한 보호)
} as const;

// ════════════════════════════════════════════════════════════
// 🏅 MAPAE — 마패 티어 경계
// ════════════════════════════════════════════════════════════
// 🚀 마패 티어 경계 — MAPAE_AND_TITLES_V1.md §3 (5단계)
// Why: 평판 배수 기준(bronze=0.5x, silver=1.0x ...). Sprint 5에서 활용 예정
export const MAPAE_THRESHOLDS = {
  bronze: 0.5,
  silver: 1.0,
  gold: 2.0,
  platinum: 3.5,
  diamond: 5.0,
} as const;

// ════════════════════════════════════════════════════════════
// 🏷️ TITLES — 칭호 시스템 V1 (MAPAE_AND_TITLES_V1.md §4~9) — Sprint 5
// ════════════════════════════════════════════════════════════
// 🚀 TITLE_CATALOG — 14종 마스터 정의 (클라이언트 단일 진실 소스)
// Why: 마스터 문서 seed(`seedTitles` CF)와 UI 라벨/이모지 표시가 동일 소스에서 파생.
//      category=creator|community|loyalty. tiered=true면 labelByTier 참조.
// ⚠️ functions/titleSeed.js의 TITLE_SEED와 반드시 동기화 (CF는 TS import 불가)
// 참조 메모리: project_sprint5_titles.md (추후 작성)
export interface TitleCatalogEntry {
  id: string;
  emoji: string;
  label: string;                                // 기본 라벨 (또는 I단계 라벨)
  labelByTier?: Partial<Record<TitleTier, string>>;
  category: TitleCategory;
  description: string;
  revocationPolicy: TitleRevocationPolicy;
  notificationLevel: TitleNotificationLevel;
  tiered?: boolean;
}

export const TITLE_CATALOG: TitleCatalogEntry[] = [
  // ── creator (5) ─────────────────────────────────────────
  {
    id: 'writer_seed', emoji: '🔰', label: '새싹 작가',
    category: 'creator', description: '첫 유효 글 작성',
    revocationPolicy: 'revoke_on_ban', notificationLevel: 'toast',
  },
  {
    id: 'writer_diligent', emoji: '✍️', label: '근면한 작가',
    labelByTier: { I: '근면한 작가', II: '꾸준한 작가', III: '거장 작가' },
    category: 'creator', description: '연속 일자 유효 글 (I=30일 / II=100일 / III=365일)',
    revocationPolicy: 'suspend_lv2_revoke_lv3', notificationLevel: 'celebration', tiered: true,
  },
  {
    id: 'viral_first', emoji: '🔥', label: '첫 화제',
    category: 'creator', description: '단일 글 고유 좋아요 30개+',
    revocationPolicy: 'suspend_lv2_revoke_lv3', notificationLevel: 'celebration',
  },
  {
    id: 'popular_writer', emoji: '⭐', label: '인기 작가',
    category: 'creator', description: '단일 글 고유 좋아요 100개+',
    revocationPolicy: 'suspend_lv2_revoke_lv3', notificationLevel: 'modal',
  },
  {
    id: 'super_hit', emoji: '💎', label: '초대박',
    category: 'creator', description: '단일 글 고유 좋아요 1,000개+',
    revocationPolicy: 'suspend_lv2_revoke_lv3', notificationLevel: 'modal',
  },
  // ── community (5) ───────────────────────────────────────
  {
    id: 'social_master', emoji: '🤝', label: '사교의 달인',
    category: 'community', description: '맞깐부 30명+',
    revocationPolicy: 'suspend_lv2_revoke_lv3', notificationLevel: 'celebration',
  },
  {
    id: 'chat_master', emoji: '💬', label: '대화의 명수',
    labelByTier: { I: '대화의 명수', II: '대화의 달인', III: '대화의 마스터' },
    category: 'community', description: '누적 유효 댓글 (I=1,000 / II=5,000 / III=20,000)',
    revocationPolicy: 'suspend_lv2_revoke_lv3', notificationLevel: 'celebration', tiered: true,
  },
  {
    id: 'sponsor', emoji: '🎁', label: '후원자',
    labelByTier: { I: '후원자', II: '든든한 후원자', III: '위대한 후원자' },
    category: 'community', description: '누적 보낸 땡스볼 (I=1,000볼 / II=10,000볼 / III=100,000볼)',
    revocationPolicy: 'revoke_on_ban', notificationLevel: 'celebration', tiered: true,
  },
  {
    id: 'kanbu_star', emoji: '🌟', label: '인기인',
    category: 'community', description: '나를 깐부 맺은 수 100명+',
    revocationPolicy: 'suspend_lv2_revoke_lv3', notificationLevel: 'celebration',
  },
  {
    id: 'influencer', emoji: '👑', label: '영향력자',
    category: 'community', description: '나를 깐부 맺은 수 1,000명+',
    revocationPolicy: 'suspend_lv2_revoke_lv3', notificationLevel: 'modal',
  },
  // ── loyalty (4) ─────────────────────────────────────────
  {
    id: 'pioneer_2026', emoji: '🌱', label: '초기 개척자',
    category: 'loyalty', description: '2026년 내 가입 (한정판)',
    revocationPolicy: 'permanent', notificationLevel: 'toast',
  },
  {
    id: 'loyal_1year', emoji: '🎖️', label: '1년 개근',
    category: 'loyalty', description: '가입 365일 + 월 1회+ 활동',
    revocationPolicy: 'suspend_lv2_revoke_lv3', notificationLevel: 'toast',
  },
  {
    id: 'veteran_2year', emoji: '🏛️', label: '베테랑',
    category: 'loyalty', description: '가입 2년+',
    revocationPolicy: 'revoke_on_ban', notificationLevel: 'toast',
  },
  {
    id: 'dedication', emoji: '⚡', label: '헌신',
    labelByTier: { I: '헌신', II: '헌신 (예약)', III: '헌신 (예약)' },
    category: 'loyalty', description: 'Lv10 도달 (Phase C Lv15/20 확장 예약)',
    revocationPolicy: 'suspend_lv2_revoke_lv3', notificationLevel: 'modal', tiered: true,
  },
];

// 🚀 단계형 칭호 임계값 — titleChecker.js에서 서버 동기 참조 (Sprint 5 Stage 2)
// Why: 단일 소스 숫자. CF `titleChecker.js` TITLE_THRESHOLDS와 1:1 매칭 필수
export const TITLE_THRESHOLDS = {
  writer_diligent: { I: 30,   II: 100,   III: 365   },  // 연속 일수
  chat_master:     { I: 1000, II: 5000,  III: 20000 },  // 누적 유효 댓글
  sponsor:         { I: 1000, II: 10000, III: 100000 }, // 누적 보낸 땡스볼
  dedication:      { I: 10,   II: 15,    III: 20    },  // 레벨 (Phase C Lv15/20 대비 예약)
} as const;

// 🚀 대표 칭호 최대 개수 (D2-β) — Rules에서도 동일 값 강제
export const MAX_PRIMARY_TITLES = 3;

// 🚀 D3-γ 유효 댓글 판정 기준
// Why: chat_master 카운트 대상 — 10자+ 본문 OR 고유 반응 5+ 수신 (스팸 방어)
export const VALID_COMMENT_RULES = {
  MIN_CONTENT_LENGTH: 10,
  MIN_UNIQUE_REACTIONS: 5,
} as const;

// 🚀 pioneer_2026 한정판 가입 기간 (2026년 내)
// Why: CF registerUser 훅에서 createdAt 월 기준 판정
export const PIONEER_2026_CUTOFF_ISO = '2027-01-01T00:00:00+09:00';

// ════════════════════════════════════════════════════════════
// 🛡️ ABUSE — 어뷰징 처벌 수치
// ════════════════════════════════════════════════════════════
// 🚀 어뷰징 유형별 평판 차감 — ANTI_ABUSE.md §5 (Phase B 이후 CF에서 활용)
// Why: detectCircularThanksball, detectDuplicateAccounts 등에서 일관된 처벌
export const ABUSE_PENALTIES = {
  shortPostSpam: 500,        // 10자 이하 글 반복
  circularThanksball: 300,   // 땡스볼 순환 송금
  multiAccount: 1_000,       // 멀티계정 적발
  massFollowUnfollow: 200,   // 깐부 맺기/해제 루프
} as const;

// ════════════════════════════════════════════════════════════
// 🏅 CREATOR SCORE — Sprint 4 (CreatorScore.md)
// ════════════════════════════════════════════════════════════
// 🚀 Creator Score 공식: (reputation × activity × trust) / SCALING_DIVISOR
// Why: 평판(신뢰도)·활동량(성실도)·트러스트(제재이력) 3축 종합 점수
//      홈 피드 정렬·광고 경매 품질 가중치·Gate 함수(출금/라이브/잉크병)에 공통 입력
// 참조: CreatorScore.md
export const CREATOR_SCORE_CONFIG = {
  SCALING_DIVISOR: 1000,       // (rep × act × trust) / 1000 → 0~5+ 범위
  RECENT_WINDOW_DAYS: 30,      // activity 집계 창
  MIN_TRUST: 0.3,              // trust 하한 (유배 3단계에서도 이 값 유지)
} as const;

// 🚀 활동 가중치 — CREATOR_SCORE §활동 이벤트
// Why: recent30d = posts×3 + comments×1 + likesSent×0.5
export const ACTIVITY_WEIGHTS = {
  post: 3,
  comment: 1,
  likeSent: 0.5,
} as const;

// 🚀 Lv별 활동량 중위값 — CREATOR_SCORE §10 지수 보간 D1-β
// Why: activity = min(1.0, recent30d / LEVEL_MEDIAN_ACTIVITY[level])
//      Lv5 고정=30, Lv10 고정=100 (나머지는 지수 보간)
export const LEVEL_MEDIAN_ACTIVITY: Record<number, number> = {
  1: 5, 2: 10, 3: 15, 4: 22, 5: 30, 6: 45, 7: 60, 8: 75, 9: 87, 10: 100,
};

// 🚀 Trust 감산 상수 — CREATOR_SCORE §신뢰도 공식
// Why: abuse + exile + report 3계층. Phase B는 abuse + exile만, Phase C에서 report 활성
export const TRUST_CONFIG = {
  ABUSE_PENALTIES: {
    shortPostSpam: 0.05,
    circularThanksball: 0.10,
    multiAccount: 0.15,
    massFollowUnfollow: 0.05,
  },
  EXILE_PENALTIES: { 1: 0.05, 2: 0.25, 3: 1.50 }, // 3차는 MIN_TRUST 바닥
  REPEAT_MULTIPLIER: { 2: 1.5, 3: 2.0 },          // 같은 단계 재범
  // 🚨 Phase C 활성 (Sprint 4, 2026-04-22) — 고유 신고자 수 → Trust 감산
  // Why: threshold 내림차순 순회 (서버 creatorScore.js와 동기화). 첫 매치만 적용.
  //      담합 신고 1명은 감산 0 (고유 수로 집계). 잠정 수치 — project_report_penalties_tuning.md
  REPORT_PENALTIES: [
    { threshold: 20, penalty: 0.15 },
    { threshold: 10, penalty: 0.10 },
    { threshold: 5, penalty: 0.05 },
  ],
} as const;

// ════════════════════════════════════════════════════════════
// 📱 REFERRAL — Sprint 7 Step 7-C (REFERRAL_V1.md)
// ════════════════════════════════════════════════════════════
// ⚠️ functions/referral.js 상수와 반드시 동기화 유지 (CF는 Node 런타임이라 TS import 불가)
//    한쪽 변경 시 반드시 다른 쪽 점검 — 코드 길이/상한/보상 불일치 시 보안·UX 사고
export const REFERRAL_CONFIG = {
  CODE_CHARSET: 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', // 32자 (0/O/I/1 제외)
  CODE_LENGTH: 6,
  CODE_LENGTH_FALLBACK: 8,       // 충돌 5회 재시도 후 확장
  MIN_REFERRER_LEVEL: 2,         // 추천자 Lv2+ Gate
  MONTHLY_CAP: 10,               // 월 10명 Rate Limit
  TOTAL_CAP: 30,                 // 베타 — pending+confirmed 합산 상한
  PENDING_DAYS: 7,               // 7-D confirmReferralActivations 판정 윈도우
  MUTUAL_KANBU_EXP_DELTA: 2,     // toggleKanbu 대칭 delta (LevelSystem.md §4.2)
  WELCOME_EXP_REFEREE: 5,        // 7-D confirm 시 피추천자 Welcome EXP
  REWARD_EXP_REFERRER: 10,       // 7-D confirm 시 추천자 보상 EXP
} as const;

// ════════════════════════════════════════════════════════════
// 🆔 USER CODE — Sprint 7.5 고유번호 (타인이 "나"를 참조하는 영구 불변 키)
// ════════════════════════════════════════════════════════════
// 🚀 8자리 영숫자 난수 (referralCode와 동일 Charset, 혼동 문자 0/O/I/1 제외)
// UI 표기: "글러브 #XXXXXXXX" — 배그 친구코드·카카오 OIO 벤치마크
// 발급: users onCreate 트리거 (generateUserCode) — 변경 절대 불가
// ⚠️ functions/userCode.js 상수와 반드시 동기화 (CF는 Node 런타임이라 TS import 불가)
export const USER_CODE_CONFIG = {
  CHARSET: 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', // 32자 (referralCode와 동일)
  LENGTH: 8,
  COLLISION_RETRY: 5,            // 충돌 5회 재시도 후 LENGTH+2 확장
  LENGTH_FALLBACK: 10,
  DISPLAY_PREFIX: '글러브 #',    // UI 표기 접두사
} as const;

// ════════════════════════════════════════════════════════════
// 🗑️ ACCOUNT DELETION — Sprint 7.5 회원탈퇴 (소프트 딜리트 30일 유예)
// ════════════════════════════════════════════════════════════
// 🚀 GDPR·국내 개인정보법 30일 이내 삭제 적법. 유저 후회 복구창 확보.
// 제약: 사약(banned) 유저 탈퇴 불가, 유배(exiled) 유저 탈퇴 가능 but banned_phones 영구 보존.
// 작성글: hard 딜리트 시 author="탈퇴한 유저" / author_id="DELETED_{hash8}"로 익명화
// 잔액: ballBalance는 약관상 소각 (환불 없음 명시)
// ⚠️ functions/accountDeletion.js 상수와 반드시 동기화
export const ACCOUNT_DELETION_CONFIG = {
  GRACE_PERIOD_DAYS: 30,                 // 소프트 딜리트 유예 기간
  PURGE_SCHEDULE: '15 4 * * *',          // 매일 04:15 KST (ballSnapshot 04:00 · auditBall 04:30 사이)
  ANONYMIZED_AUTHOR: '탈퇴한 유저',
  ANONYMIZED_AUTHOR_ID_PREFIX: 'DELETED_',
  DELETION_REASONS: [
    '서비스 이용이 적어서',
    '개인정보 보호 때문에',
    '다른 비슷한 서비스로 이동',
    '원하는 기능이 없어서',
    '기타',
  ],
} as const;

// ════════════════════════════════════════════════════════════
// 📈 LEVEL — EXP 기반 레벨 경계값
// ════════════════════════════════════════════════════════════
// 🚀 LEVEL_TABLE — Phase A 경계값 (LEVEL_V2.md §11.1 확정, 2026-04-21)
// Why: 적극 유저(27 EXP/일) 기준 Lv10 도달 약 1년 → 파워블로거 수준 희소성 의도
//      Phase C에서 Lv20 확장 시 보상체계 전면 재설계 예정 (LEVEL_V2.md §11.3)
// ⚠️ functions/revenue.js:42 LEVEL_TABLE과 반드시 동기화 유지 (CF는 Node 런타임이라 TS import 불가)
export const LEVEL_TABLE = [0, 30, 100, 250, 500, 1000, 2000, 4000, 7000, 10000] as const;

// ════════════════════════════════════════════════════════════
// 🚪 CREATOR GATES — Sprint 4 Phase C Task 4 (CREATOR_SCORE.md §7)
// ════════════════════════════════════════════════════════════
// 🚀 Gate 4종 — Lv × Creator Score 동시 충족 조건
// Why: 고가치 기능(출금/라이브/잉크병 유료화/깐부방 개설)에 품질 Gate 필요
//      단순 Lv만으로는 평판 낮은 유저가 진입 → 품질 리스크. 평판 기반 추가 필터.
// ⚠️ 현재 값은 **잠정 수치** — 배포 1주 후 creatorScoreCached 분포(P50/P75/P90) 실측 후 튜닝
// ⚠️ functions/utils/gateCheck.js의 CREATOR_GATES와 반드시 동기화 (CF는 TS import 불가)
// 참조 메모리: project_creator_gates_tuning.md
export const CREATOR_GATES = {
  withdraw:    { minLevel: 5, minScore: 1.0, label: '출금' },              // 출금 기능 미구현, 헬퍼만 대기
  live:        { minLevel: 6, minScore: 2.0, label: '라이브 개설' },         // 깐부방 라이브 세션
  inkwellPaid: { minLevel: 0, minScore: 1.0, label: '잉크병 유료 회차' },    // 레벨 무관
  kanbuRoom:   { minLevel: 6, minScore: 0.5, label: '깐부방 개설' },         // 깐부방 신규 개설
} as const;

export type CreatorGateKey = keyof typeof CREATOR_GATES;

// ════════════════════════════════════════════════════════════
// 🤝 KANBU — 깐부방 유료 게시판 수수료율
// ════════════════════════════════════════════════════════════
// 🚀 KANBU_FEE_RATES — 레벨별 플랫폼 수수료 (강변시장 MARKET_FEE_RATES와 동일 구조)
// Why: 매직넘버 방지 — 크리에이터 수수료 정책 변경 시 한 곳에서만 수정
// ⚠️ functions/kanbuPaid.js의 KANBU_FEE_RATES와 반드시 동기화 유지 (CF는 TS import 불가)
export const KANBU_FEE_RATES = {
  default: 0.30, // Lv3~4: 30%
  lv5: 0.25,     // Lv5~6: 25%
  lv7: 0.20,     // Lv7+:  20%
} as const;

// ════════════════════════════════════════════════════════════
// 🏚️ STOREHOUSE — 유배 단계별 정책
// ════════════════════════════════════════════════════════════
// 🚀 SANCTION_POLICIES — 단계별 반성기간·속죄금 (STOREHOUSE.md §1.1)
// Why: 정책 단일 진실 소스 — types.ts에서 이관 (types.ts는 타입 전용)
// ⚠️ functions/storehouse.js의 SANCTION_POLICIES와 반드시 동기화 (CF는 TS import 불가)
export const SANCTION_POLICIES: SanctionPolicy[] = [
  { level: 1, status: 'exiled_lv1', reflectionDays: 3,  bailAmount: 10 },
  { level: 2, status: 'exiled_lv2', reflectionDays: 7,  bailAmount: 50 },
  { level: 3, status: 'exiled_lv3', reflectionDays: 30, bailAmount: 300 },
];

// 🚀 홈 피드 필터링 기준값 — blueprint.md "필터링 로직 (절대 불변)" 과 반드시 동기화
export const POST_FILTER = {
  NEW_POST_WINDOW_MS: 3 * 60 * 60 * 1000, // 새글 노출 시간: 3시간(ms) — 2026-04-30 베타 환경 글 부족 대응 (2h → 3h, "1시간당 좋아요 1개" 비율)
  REGISTERED_MIN_LIKES: 3,                 // 등록글 진입 최소 좋아요 수
  BEST_MIN_LIKES: 10,                      // 인기글 최소 좋아요 수
  RANK_MIN_LIKES: 30,                      // 최고글 최소 좋아요 수
  CATEGORY_MIN_LIKES: 3,                   // 카테고리 뷰 최소 좋아요 수
  GOLD_STAR_MIN_LEVEL: 5,                  // 골드스타 부여 최소 레벨
} as const;

// 🚀 땡스볼 관련 제한값
export const THANKSBALL = {
  MESSAGE_MAX_LENGTH: 50, // 응원 메시지 최대 글자 수
} as const;

// 🚀 외부 서비스 URL — URL 변경 시 이곳만 수정
export const EXTERNAL_URLS = {
  AVATAR_BASE: 'https://api.dicebear.com/7.x/adventurer/svg?seed=', // 아바타 이미지 서비스
  LINK_PREVIEW_WORKER: 'https://halmal-link-preview.mirr0505.workers.dev', // OG 링크 미리보기 Worker
} as const;

// 🚀 OG 이미지 화이트리스트 — 클라이언트·서버 일관성 유지용
// Why: Kakao Share content.imageUrl(클라)과 ogRenderer Cloud Function(서버) 양쪽에서
//      동일한 호스트 집합을 참조해야 SNS 카드 이미지가 일치. 둘 중 한쪽이 이미지를
//      걸러내면 Kakao는 로고, 페북·X는 본문 이미지처럼 카드 간 불일치 발생.
// ⚠️ 이 배열은 functions/index.js의 OG_IMAGE_ALLOWED_HOSTS 상수 기본값 배열과
//    완전히 동일해야 함. 서버가 functions/.env의 OG_IMAGE_ALLOWED_HOSTS 환경변수로
//    오버라이드될 수 있으며, 해당 env 추가·변경 시 이 파일도 반드시 동기화할 것.
//    (클라는 빌드 타임 정적 배열 — 런타임 env 주입 없음)
export const OG_IMAGE_ALLOWED_HOSTS = [
  'geulove.com',
  'halmal-itso.web.app',
  'pub-9e6af273cd034aa6b7857343d0745224.r2.dev',
] as const;

// 🚀 깐부맺기 메뉴 — 현재 테스트/개발 단계라 허용 닉네임만 표시
// TODO: 실 서비스 전환 시 이 배열 제거 후 전체 유저 표시로 변경
export const FRIENDS_MENU_ALLOWED_NICKNAMES = ["깐부1호", "깐부2호", "깐부3호", "깐부4호", "깐부5호", "깐부6호", "깐부7호", "깐부8호", "깐부9호", "깐부10호", "불량깐부1호", "불량깐부2호", "불량깐부3호", "흑무영"];

// 🛡️ Sprint 6 A-3 (2026-04-25 완료): 실제 admin 권한은 Custom Claims 단일 체크.
//   이 배열은 "관리자 메뉴 후보 닉네임" — Sidebar의 메뉴 노출 결정에만 사용.
//   실제 admin 작업 시도는 AdminGuard + assertAdmin이 Claims로 차단.
//   닉네임 표시용이라 메뉴를 잘못 노출해도 보안 영향 없음 (실권한은 Claims 보호).
export const PLATFORM_ADMIN_NICKNAMES = ["흑무영", "Admin"];

// 🚀 테스트 계정 — exp/likes로 레벨·평판 초기값 설정
// 레벨: exp 기반 (LEVEL_TABLE: 0,30,100,250,500)
// 평판: (likes×2) + (totalShares×3) + (ballReceived×5) — likes만으로 설정
export const TEST_ACCOUNTS = [
  { nickname: "깐부1호", email: "test1@halmal.com", bio: "1번 테스트 계정이오.", level: 1, exp: 0, likes: 0 },
  { nickname: "깐부2호", email: "test2@halmal.com", bio: "2번 테스트 계정이오.", level: 2, exp: 30, likes: 150 },
  { nickname: "깐부3호", email: "test3@halmal.com", bio: "3번 테스트 계정이오.", level: 3, exp: 100, likes: 500 },
  { nickname: "깐부4호", email: "test4@halmal.com", bio: "4번 테스트 계정이오.", level: 4, exp: 250, likes: 1000 },
  { nickname: "깐부5호", email: "test5@halmal.com", bio: "5번 테스트 계정이오.", level: 5, exp: 500, likes: 1500 },
  { nickname: "깐부6호", email: "test6@halmal.com", bio: "6번 테스트 계정이오.", level: 6, exp: 1000, likes: 1000 },
  { nickname: "깐부7호", email: "test7@halmal.com", bio: "7번 테스트 계정이오.", level: 7, exp: 2000, likes: 1000 },
  { nickname: "깐부8호", email: "test8@halmal.com", bio: "8번 테스트 계정이오.", level: 8, exp: 4000, likes: 1000 },
  { nickname: "깐부9호", email: "test9@halmal.com", bio: "9번 테스트 계정이오.", level: 9, exp: 7000, likes: 1000 },
  { nickname: "깐부10호", email: "test10@halmal.com", bio: "10번 테스트 계정이오.", level: 10, exp: 10000, likes: 1000 },
  // 🏚️ 유배 테스트용 불량 계정
  { nickname: "불량깐부1호", email: "bad1@halmal.com", bio: "유배 테스트 1호", level: 3, exp: 100, likes: 50 },
  { nickname: "불량깐부2호", email: "bad2@halmal.com", bio: "유배 테스트 2호", level: 4, exp: 250, likes: 100 },
  { nickname: "불량깐부3호", email: "bad3@halmal.com", bio: "유배 테스트 3호", level: 5, exp: 500, likes: 200 },
];

export const MENU_MESSAGES: Record<string, { title: string, description: string, emoji: string, categoryKey?: string, tags?: string[] }> = {
  onecut: {
    emoji: "🍞",
    title: "헨젤의 빵부스러기",
    description: "인생 네컷처럼 내 글도 한컷 · 네컷으로, 그리고 연계는 필수"
  },
  market: {
    emoji: "🏪",
    title: "강변 시장",
    description: "크리에이터가 지식·감성·정보를 판매하는 크리에이터 이코노미"
  },
  my_story: {
    emoji: "📝",
    title: "참새들의 방앗간",
    description: "현재를 살아가는 너와 내가 들려주는 즐겁고 재밌는, 슬프고 힘든, 짜증나고 싫증나는 일상의 소식들"
  },
  naked_king: {
    emoji: "👑",
    title: "판도라의 상자",
    description: "정치, 역사, 사회, 문화, 종교, 교육, 군사, 체육 등 사회 전반 이슈에 대한 거침없는 진실 공개 및 사실 확인"
  },
  donkey_ears: {
    emoji: "👂",
    title: "솔로몬의 재판",
    description: "정치, 사회, 문화, 종교, 교육, 군사, 체육 등 사회 전반 이슈에 대한 토론"
  },
  knowledge_seller: {
    emoji: "📚",
    title: "황금알을 낳는 거위",
    description: "경제, 주식, 부동산, 코인 그리고 정치, 사회, 문학, 법률, 과학, 스포츠, 어학, 쇼핑 등 지식·정보 공유 전파"
  },
  bone_hitting: {
    emoji: "⚡",
    title: "신포도와 여우",
    description: "현시대를 살아가는 사람들에 경종을 울리는 뼈때리는 명언"
  },
  local_news: {
    emoji: "🔮",
    title: "마법 수정 구슬",
    description: "국내, 해외 지역 곳곳에 살고 있는 주민이 올리는 그 나라, 그 지역의 따끈한 소식들 (기사/뉴스 번역 포함)"
  },
  marathon_herald: {
    emoji: "🏃",
    title: "마라톤의 전령",
    description: "뉴스 속보",
    tags: ["단독", "지진", "폭발", "테러", "비상계엄"]
  },
  ranking: {
    emoji: "🏆",
    title: "실시간 랭킹",
    description: "좋아요 · 땡스볼 · 조회수 · 공유수 기준 실시간 TOP 20"
  },
  giant_tree: {
    emoji: "🌳",
    title: "거대 나무",
    description: "자신의 주장을 다단계 전파 형태로 보낼 수 있는 곳"
  },
  inkwell: {
    emoji: "🖋️",
    title: "마르지 않는 잉크병",
    description: "시 · 소설 · 수필 · 웹툰 · 만화 — 작가의 이야기가 마르지 않는 곳"
  },
  exile_place: {
    emoji: "🏚️",
    title: "놀부의 텅 빈 곳간 (유배귀양지)",
    description: "심술을 부리다 벌을 받은 놀부가 곳간에 갇혀 반성하는 공간 — 속죄금 + 반성기간 + 깐부리셋의 삼중 장벽"
  }
};

// ════════════════════════════════════════════════════════════
// 🚀 ADSMARKET — 광고 경매 시장 상수
// ════════════════════════════════════════════════════════════

// 🚀 작성자 광고 슬롯 — 레벨별 수익 배분율 (Revenue Share)
//   2026-04-26 위치 재정의: top=본문 시작 직전 / middle=본문 끝·댓글 위 / bottom=댓글 끝·관련글 위
//   Lv별 매핑: Lv5~6 가장 효과적인 middle 1개 / Lv7~8 top+middle / Lv9~10 모두
export const CREATOR_AD_SLOTS: Record<number, { slots: number; positions: ('top' | 'middle' | 'bottom')[]; creatorRate: number }> = {
  1: { slots: 0, positions: [], creatorRate: 0 },         // Lv1~4: 작성자 광고 없음
  5: { slots: 1, positions: ['middle'], creatorRate: 0.3 }, // Lv5~6: middle (본문 끝 + 댓글 위 — 가장 효과적)
  7: { slots: 2, positions: ['top', 'middle'], creatorRate: 0.5 }, // Lv7~8: top + middle
  9: { slots: 3, positions: ['top', 'middle', 'bottom'], creatorRate: 0.7 }, // Lv9~10: 전체
};

export const getCreatorAdSlots = (level: number) => {
  if (level >= 9) return CREATOR_AD_SLOTS[9];
  if (level >= 7) return CREATOR_AD_SLOTS[7];
  if (level >= 5) return CREATOR_AD_SLOTS[5];
  return CREATOR_AD_SLOTS[1];
};

// 🚀 플랫폼 광고 — Lv2+ 모든 글에 bottom 1개 (글러브팀 자체 프로모션, 수익 0%)
export const PLATFORM_AD_MIN_LEVEL = 2;

// 하위 호환용 alias
export const AD_REVENUE_SHARE = CREATOR_AD_SLOTS;
export const getAdRevenueShare = getCreatorAdSlots;

// 광고 카테고리 — 📂 업종 분류 (광고주 통계·관리 태그용, 2026-04-25 매칭에서 분리)
//   매칭은 AD_MENU_CATEGORIES만 사용. 이 리스트는 통계 분류 라벨일 뿐.
export const AD_CATEGORIES = [
  '음식점', 'IT/테크', '교육', '패션', '뷰티', '금융', '부동산', '여행', '건강', '기타'
] as const;

// 📍 광고 노출 위치 글 메뉴 카테고리 — 글 카테고리(post.category DB 저장값)와 직접 매칭
//   라벨(label)과 저장값(value)이 다른 메뉴 있음 — 참새/한컷:
//     - 참새들의 방앗간 → DB category="너와 나의 이야기" (구 이름 유지)
//     - 헨젤의 빵부스러기 → DB category="한컷" + isOneCut:true
//   광고 등록 시 label 표시, value 저장. 매칭은 value↔post.category로 정확히 비교.
export const AD_MENU_CATEGORIES: { label: string; value: string }[] = [
  { label: '참새들의 방앗간', value: '너와 나의 이야기' },
  { label: '판도라의 상자', value: '판도라의 상자' },
  { label: '솔로몬의 재판', value: '솔로몬의 재판' },
  { label: '황금알을 낳는 거위', value: '황금알을 낳는 거위' },
  { label: '신포도와 여우', value: '신포도와 여우' },
  { label: '마법 수정 구슬', value: '마법 수정 구슬' },
  { label: '마라톤의 전령', value: '마라톤의 전령' },
  { label: '헨젤의 빵부스러기', value: '한컷' },
];

// 정산 최소 출금액 (원)
export const SETTLEMENT_MIN_AMOUNT = 30_000;

// 세율
export const TAX_RATES = {
  BUSINESS: 0.033,  // 사업소득 3.3%
  OTHER: 0.088,     // 기타소득 8.8%
} as const;

// 은행 코드
export const BANK_CODES: Record<string, string> = {
  '004': 'KB국민', '011': 'NH농협', '020': '우리', '023': 'SC제일',
  '027': '한국씨티', '032': '대구', '034': '광주', '035': '제주',
  '037': '전북', '039': '경남', '045': '새마을금고', '048': '신협',
  '071': '우체국', '081': '하나', '088': '신한', '089': 'K뱅크',
  '090': '카카오뱅크', '092': '토스뱅크',
};
