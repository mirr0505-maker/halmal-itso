// functions/utils/gateCheck.js
// 🚪 Creator Gate 서버 assert — 출금/라이브/잉크병 유료화/깐부방 개설 품질 Gate
// 검색어: assertPassesGate
//
// Why: 프론트 버튼 차단 + Firestore Rules 차단 + CF assert 3중 방어
//      클라이언트 우회 시도(직접 Rules write / CF 호출)를 서버에서 최종 차단
// ⚠️ src/constants.ts CREATOR_GATES와 반드시 동기화 유지
//    배포 1주 후 creatorScoreCached 분포 보고 튜닝 예정 (project_creator_gates_tuning.md)

const { HttpsError } = require("firebase-functions/v2/https");
const { calculateLevel } = require("./levelSync");

// 🚀 Gate 4종 — 잠정 수치 (2026-04-22 적용). 분포 실측 후 튜닝 대상
const CREATOR_GATES = {
  withdraw:    { minLevel: 5, minScore: 1.0, label: "출금" },
  live:        { minLevel: 6, minScore: 2.0, label: "라이브 개설" },
  inkwellPaid: { minLevel: 0, minScore: 1.0, label: "잉크병 유료 회차" },
  kanbuRoom:   { minLevel: 6, minScore: 0.5, label: "깐부방 개설" },
};

/**
 * Gate 통과 여부 검사. 차단되면 HttpsError throw.
 * @param {object} userData - users/{uid} 문서 스냅샷 데이터
 * @param {string} gateKey - "withdraw" | "live" | "inkwellPaid" | "kanbuRoom"
 */
function assertPassesGate(userData, gateKey) {
  const gate = CREATOR_GATES[gateKey];
  if (!gate) {
    throw new HttpsError("internal", `알 수 없는 Gate: ${gateKey}`);
  }
  const exp = typeof userData.exp === "number" ? userData.exp : 0;
  const level = typeof userData.level === "number" ? userData.level : calculateLevel(exp);
  const score = typeof userData.creatorScoreCached === "number" ? userData.creatorScoreCached : 0;

  if (level < gate.minLevel) {
    throw new HttpsError(
      "failed-precondition",
      `${gate.label} 기능은 Lv${gate.minLevel} 이상부터 이용할 수 있습니다. (현재 Lv${level})`
    );
  }
  if (score < gate.minScore) {
    throw new HttpsError(
      "failed-precondition",
      `${gate.label} 기능은 크리에이터 점수 ${gate.minScore.toFixed(1)} 이상부터 이용할 수 있습니다. (현재 ${score.toFixed(2)})`
    );
  }
}

module.exports = { assertPassesGate, CREATOR_GATES };
