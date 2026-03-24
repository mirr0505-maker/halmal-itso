// src/constants.ts — 앱 전역 설정값 (메뉴 구성, 테스트 계정)

export const TEST_ACCOUNTS = [
  { nickname: "깐부1호", email: "test1@halmal.com", bio: "1번 테스트 계정이오.", level: 1 },
  { nickname: "깐부2호", email: "test2@halmal.com", bio: "2번 테스트 계정이오.", level: 1 },
  { nickname: "깐부3호", email: "test3@halmal.com", bio: "3번 테스트 계정이오.", level: 1 },
  { nickname: "깐부4호", email: "test4@halmal.com", bio: "4번 테스트 계정이오. (Lv5)", level: 5 }
];

export const MENU_MESSAGES: Record<string, { title: string, description: string, emoji: string, categoryKey?: string }> = {
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
    description: "사회 전반 퍼져 있는, 또는 퍼지고 있는 거짓에 대한 거침없는 진실 공개, 가짜 조작/왜곡 뉴스 기사 등의 사실 확인"
  },
  donkey_ears: {
    emoji: "👂",
    title: "솔로몬의 재판",
    description: "정치, 사회, 문화, 종교, 교육, 군사, 체육 등 사회 전반 이슈에 대한 토론"
  },
  knowledge_seller: {
    emoji: "📚",
    title: "황금알을 낳는 거위",
    description: "경제, 주식, 부동산, 코인 그리고 정치, 사회, 문학, 법률, 과학, 스포츠, 어학, 쇼핑 등 지식 공유 전파"
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
  crying_boy: {
    emoji: "🚨",
    title: "양치기 소년의 외침",
    description: "지금 당장 알아야 할 속보, 긴급뉴스, 경보 — 늑대가 진짜 왔다!"
  },
  exile_place: {
    emoji: "🏚️",
    title: "유배·귀양지",
    description: "본문이나 댓글에서, '욕설, 생명경시, 차별적표현, 비윤리, 반국가, 음란물, 불법정보, 광고글, 사기 등' 해당 작성자 격리 공간"
  }
};
