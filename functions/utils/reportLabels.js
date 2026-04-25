// functions/utils/reportLabels.js
// 🚨 신고 시스템 알림 메시지 표준화 헬퍼
// Why: 클라이언트(REASON_LABELS_KO)와 서버 측 알림 본문/메타에서
//      reasonKey/action 코드가 영문 그대로 노출되는 문제를 막기 위해 단일 소스로 분리.
// 검색어: REASON_LABELS_KO ACTION_LABELS_KO getTargetTitle

const REASON_LABELS_KO = {
  obscene: "음란물",
  life_threat: "생명위협",
  illegal_fraud_ad: "불법사기광고",
  spam_flooding: "스팸",
  severe_abuse: "심한욕설",
  discrimination: "차별",
  unethical: "비윤리",
  anti_state: "반국가",
  other: "기타",
};

const ACTION_LABELS_KO = {
  hide_content: "컨텐츠 숨김",
  delete_content: "컨텐츠 삭제",
  warn_user: "작성자 경고",
  none: "조치 없음",
};

function getReasonLabel(key) {
  return REASON_LABELS_KO[key] || "기타";
}

function getActionLabel(action) {
  return ACTION_LABELS_KO[action] || "처리됨";
}

// 🚀 글/댓글 데이터에서 휴먼 식별 가능한 제목 30자 snippet 추출
//    title → episodeTitle → body/content(HTML strip) 우선순위
function getTargetTitle(targetData) {
  if (!targetData) return "(글 없음)";
  const stripHtml = (s) => String(s).replace(/<[^>]*>/g, "").trim();
  if (targetData.title) return String(targetData.title).slice(0, 30);
  if (targetData.episodeTitle) return String(targetData.episodeTitle).slice(0, 30);
  if (targetData.body) return stripHtml(targetData.body).slice(0, 30);
  if (targetData.content) return stripHtml(targetData.content).slice(0, 30);
  return "(제목 없음)";
}

module.exports = {
  REASON_LABELS_KO,
  ACTION_LABELS_KO,
  getReasonLabel,
  getActionLabel,
  getTargetTitle,
};
