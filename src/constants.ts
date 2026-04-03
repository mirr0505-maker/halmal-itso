// src/constants.ts — 앱 전역 설정값 (메뉴 구성, 테스트 계정, 필터 기준)

// 🚀 홈 피드 필터링 기준값 — blueprint.md "필터링 로직 (절대 불변)" 과 반드시 동기화
export const POST_FILTER = {
  NEW_POST_WINDOW_MS: 2 * 60 * 60 * 1000, // 새글 노출 시간: 2시간(ms)
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

// 🚀 깐부맺기 메뉴 — 현재 테스트/개발 단계라 허용 닉네임만 표시
// TODO: 실 서비스 전환 시 이 배열 제거 후 전체 유저 표시로 변경
export const FRIENDS_MENU_ALLOWED_NICKNAMES = ["깐부1호", "깐부2호", "깐부3호", "깐부4호", "흑무영"];

export const TEST_ACCOUNTS = [
  { nickname: "깐부1호", email: "test1@halmal.com", bio: "1번 테스트 계정이오.", level: 1 },
  { nickname: "깐부2호", email: "test2@halmal.com", bio: "2번 테스트 계정이오.", level: 1 },
  { nickname: "깐부3호", email: "test3@halmal.com", bio: "3번 테스트 계정이오.", level: 1 },
  { nickname: "깐부4호", email: "test4@halmal.com", bio: "4번 테스트 계정이오. (Lv5)", level: 5 }
];

export const MENU_MESSAGES: Record<string, { title: string, description: string, emoji: string, categoryKey?: string, tags?: string[] }> = {
  onecut: {
    emoji: "🎞️",
    title: "한컷",
    description: "이미지 한장으로 전하는, 원본글 요약이나 짧은 메세지 (원본글 링크, 이미지 상세 내용 포함)"
  },
  market: {
    emoji: "🛒",
    title: "마켓",
    description: "해당 레벨 충족 시 유료로 판매 가능한 고급 분석 글들"
  },
  my_story: {
    emoji: "📝",
    title: "너와 나의 이야기",
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
  exile_place: {
    emoji: "🏚️",
    title: "유배·귀양지",
    description: "본문이나 댓글에서, '욕설, 생명경시, 차별적표현, 비윤리, 반국가, 음란물, 불법정보, 광고글, 사기 등' 해당 작성자 격리 공간"
  }
};
