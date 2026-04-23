// functions/utils/phoneHash.js — 📱 Sprint 7 Step 7-A 휴대폰 번호 해시 유틸
//
// ⚠️ 중대 제약: PHONE_HASH_SALT는 배포 후 **절대 변경 금지**
//   변경 시 기존 phoneHash 전체가 달라져 banned_phones 매칭이 깨짐
//   → 사약 처분으로 블랙리스트된 유저가 재가입 가능해지는 보안 사고
//   salt 분실·노출 의심 시 banned_phones 전체를 새 salt로 재생성해야 함
//
// Secret 생성 (배포 전 1회):
//   openssl rand -hex 32  →  값 복사
//   firebase functions:secrets:set PHONE_HASH_SALT  →  붙여넣기
//
// Why 해시 저장:
//   원본 번호를 users 문서에 저장하면 유출 시 개인정보 사고.
//   단방향 해시 + salt로 저장하면 매칭은 가능하고 역산은 불가.

const crypto = require("crypto");
const { defineSecret } = require("firebase-functions/params");

const PHONE_HASH_SALT = defineSecret("PHONE_HASH_SALT");

/**
 * E.164 정규화 — 한국 번호 기준
 *   "010-1234-5678" / "01012345678" / "+82 10 1234 5678" → "+821012345678"
 *   이미 +82로 시작하면 그대로 유지 (공백·하이픈만 제거)
 *
 * Sprint 8 국제 확장 시 country code 파라미터 추가 예정.
 */
function normalizeE164(raw) {
  if (typeof raw !== "string") {
    throw new Error("phoneNumber must be string");
  }
  const digits = raw.replace(/[\s\-()]/g, "");
  if (digits.startsWith("+82")) return digits;
  if (digits.startsWith("82") && digits.length >= 12) return "+" + digits;
  if (digits.startsWith("010") && digits.length === 11) return "+82" + digits.slice(1);
  if (digits.startsWith("10") && digits.length === 10) return "+82" + digits;
  throw new Error(`unsupported phone format: ${raw}`);
}

/**
 * sha256(E.164 + salt) → 64자 hex
 * salt는 Secret Manager에서 로드 (CF 런타임에만 접근 가능).
 */
function hashPhone(e164Number) {
  if (typeof e164Number !== "string" || !e164Number.startsWith("+")) {
    throw new Error("e164Number must be E.164 format string");
  }
  const salt = PHONE_HASH_SALT.value();
  if (!salt) {
    throw new Error("PHONE_HASH_SALT secret not set — run: firebase functions:secrets:set PHONE_HASH_SALT");
  }
  return crypto
    .createHash("sha256")
    .update(e164Number + salt)
    .digest("hex");
}

module.exports = {
  PHONE_HASH_SALT,
  normalizeE164,
  hashPhone,
};
