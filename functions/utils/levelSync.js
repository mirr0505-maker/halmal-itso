// functions/utils/levelSync.js
// 🚀 CF EXP·Level 동기화 헬퍼 — 트랜잭션 내에서 본인 exp를 읽은 뒤 레벨 함께 업데이트
// 검색어: buildExpLevelUpdate (CF 버전)
//
// ⚠️ src/constants.ts LEVEL_TABLE + src/utils.ts calculateLevel과 반드시 동일 로직 유지
//    (CF는 Node 런타임이라 TS import 불가, 동기화 경고 필수)

const LEVEL_TABLE = [0, 30, 100, 250, 500, 1000, 2000, 4000, 7000, 10000];

function calculateLevel(exp) {
  for (let i = LEVEL_TABLE.length - 1; i >= 0; i--) {
    if (exp >= LEVEL_TABLE[i]) return i + 1;
  }
  return 1;
}

/**
 * @param {object} FieldValue - firebase-admin FieldValue (호출자가 주입)
 * @param {number} currentExp - 트랜잭션 내에서 읽은 본인 현재 EXP
 * @param {number} delta - 증감량 (양수만 — Rules +100 상한)
 */
function buildExpLevelUpdate(FieldValue, currentExp, delta) {
  return {
    exp: FieldValue.increment(delta),
    level: calculateLevel((currentExp || 0) + delta),
  };
}

module.exports = { calculateLevel, buildExpLevelUpdate, LEVEL_TABLE };
