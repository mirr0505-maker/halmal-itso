// functions/utils/ipHash.js — 📱 Sprint 7 Step 7-E IP 해시 유틸
//
// Why 별도 파일:
//   redeemReferralCode + 향후 다른 악용 방어 경로에서 재사용.
//   IP 원본은 저장 금지 (개인정보 — GDPR/국내법 대응). 단방향 해시만 보존.
//
// Salt 전략 (2026-04-23 확정):
//   PHONE_HASH_SALT 재사용 — Secret 격리 이익 < 운영 부담.
//   IP는 /24 마스킹으로 이미 엔트로피 저하됨 → 별도 salt 분리 이익 제한적.
//   ⚠️ PHONE_HASH_SALT 변경 시 phoneHash + ipHash 모두 무효화됨 (alignment 유지 목적).

const crypto = require("crypto");
const { PHONE_HASH_SALT } = require("./phoneHash");

/**
 * Express req.ip 에서 클라이언트 IP 추출 — Cloud Functions 뒤에 GFE가 있으므로
 * `x-forwarded-for` 첫 토큰이 실제 클라이언트. Firebase Callable v2는 req.ip가 이미 정리됨.
 *
 * 반환 형식:
 *   IPv4: "203.0.113.42"
 *   IPv6: "2001:db8::1" (축약·루프백 제외)
 *   실패/loopback: null (시그널 무력화 — 쓰는 쪽에서 빈 문자열로 처리)
 */
function extractClientIp(rawRequest) {
  if (!rawRequest) return null;
  // x-forwarded-for 우선 (첫 번째 = 가장 originating)
  const xff = rawRequest.headers?.["x-forwarded-for"];
  if (typeof xff === "string" && xff.length > 0) {
    const first = xff.split(",")[0].trim();
    if (first) return first;
  }
  if (typeof rawRequest.ip === "string" && rawRequest.ip.length > 0) {
    return rawRequest.ip;
  }
  return null;
}

/**
 * IPv4 /24 subnet 추출 → "203.0.113.0"
 * IPv6 /64 prefix 추출 → "2001:db8:0:0::"
 * Why: 클러스터 감지는 subnet 단위로 하되, 개인 식별로 이어지지 않도록 마스킹.
 *      /24는 ISP CGNAT·고정IP 기준 동일 "가정·사무실" 수준. /64는 IPv6 할당 단위.
 * 반환 null: loopback·사설망·파싱 실패 시그널 무력화
 */
function subnetOf(rawIp) {
  if (typeof rawIp !== "string" || rawIp.length === 0) return null;
  // IPv6-mapped IPv4 (::ffff:203.0.113.42) 정규화
  const ip = rawIp.replace(/^::ffff:/i, "");

  // IPv4
  const v4 = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [, a, b, c] = v4;
    const octets = [a, b, c].map(Number);
    if (octets.some(o => o < 0 || o > 255)) return null;
    // loopback·링크로컬 무력화 (감지 가치 없음)
    if (octets[0] === 127 || octets[0] === 0) return null;
    return `${octets[0]}.${octets[1]}.${octets[2]}.0`;
  }

  // IPv6 — 첫 4 그룹(= /64) 유지, 나머지는 0::로 치환
  if (ip.includes(":")) {
    // loopback
    if (ip === "::1" || ip === "0:0:0:0:0:0:0:1") return null;
    // :: 축약 확장 간단 처리 (정확한 RFC5952은 과공학, 감지 정확도만 관건)
    const expanded = expandIpv6(ip);
    if (!expanded) return null;
    const groups = expanded.split(":");
    if (groups.length !== 8) return null;
    return `${groups[0]}:${groups[1]}:${groups[2]}:${groups[3]}::`;
  }
  return null;
}

// IPv6 :: 축약 → 8 그룹으로 복원 (간이 파서 — 악용 방어 시그널 수준)
function expandIpv6(ip) {
  if (ip.indexOf("::") === -1) {
    const parts = ip.split(":");
    return parts.length === 8 ? parts.map(p => p || "0").join(":") : null;
  }
  const [head, tail] = ip.split("::");
  const headParts = head ? head.split(":") : [];
  const tailParts = tail ? tail.split(":") : [];
  const zerosNeeded = 8 - headParts.length - tailParts.length;
  if (zerosNeeded < 0) return null;
  const zeros = Array(zerosNeeded).fill("0");
  return [...headParts, ...zeros, ...tailParts].join(":");
}

/** sha256(value + PHONE_HASH_SALT) → 64자 hex */
function hashWithSalt(value) {
  const salt = PHONE_HASH_SALT.value();
  if (!salt) {
    throw new Error("PHONE_HASH_SALT secret not set");
  }
  return crypto
    .createHash("sha256")
    .update(value + salt)
    .digest("hex");
}

/**
 * subnet 해시 (동일 /24 클러스터 감지용) — 원본 subnet 저장 금지.
 * null 입력 시 빈 문자열 반환 (쓰는 쪽이 skip 판단)
 */
function hashSubnet(rawIp) {
  const subnet = subnetOf(rawIp);
  if (!subnet) return "";
  return hashWithSalt(`subnet:${subnet}`);
}

/**
 * full IP 해시 (디바이스 동일성 보조 — rare하지만 NAT 뒤 단일 사용자 식별).
 * null/loopback 입력 시 빈 문자열.
 */
function hashFullIp(rawIp) {
  if (typeof rawIp !== "string" || rawIp.length === 0) return "";
  const normalized = rawIp.replace(/^::ffff:/i, "");
  if (normalized === "127.0.0.1" || normalized === "::1") return "";
  return hashWithSalt(`ip:${normalized}`);
}

module.exports = {
  extractClientIp,
  subnetOf,
  hashSubnet,
  hashFullIp,
};
