// functions/adminAdjust.js — 🔧 관리자 수동 조정 CF
// Sprint 4 Phase C — Creator Score 긴급 보정 + Abuse Flag 토글
//   adminAdjustCreatorScore: users.creatorScoreOverride 설정/해제 (옵션 B, [CreatorScore.md] §11)
//     Why: 어뷰징 탐지 CF가 잡지 못하는 케이스의 수동 품질 보정 — 수식이 놓친 곳 수습
//           override는 해제 전까지 유지. expiresAt 도달 시 creatorScoreCache가 자동 제거.
//   adminToggleAbuseFlag: users.abuseFlags.{flag} 토글 (옵션 C)
//     Why: 경미한 제재는 Trust 감산으로 충분. 유배 없이도 품질 가중치 하향 가능.
//           수식 일관성 유지 — 자동 탐지 CF 구현 시 동일 필드를 공유.
// 권한: Sprint 6 A-1 Custom Claims OR 닉네임 화이트리스트 (utils/adminAuth.js)
// 감사: admin_actions/{yyyyMMdd}_{adminUid}_{ts}_{rand} 에 기록 (functions/adminAudit.js)
// 검색어: adminAdjust

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const { getMapaeTier, TRUST_CONFIG } = require("./utils/creatorScore");
const { assertAdmin } = require("./utils/adminAuth");
const { logAdminAction } = require("./adminAudit");

const db = getFirestore();
const REGION = "asia-northeast3";

// Abuse Flag 키 화이트리스트 — utils/creatorScore.js TRUST_CONFIG.ABUSE_PENALTIES와 동기화
const ABUSE_FLAG_KEYS = Object.keys(TRUST_CONFIG.ABUSE_PENALTIES);

// ═══════════════════════════════════════════════════════
// 1) adminAdjustCreatorScore — override 설정/해제
// ═══════════════════════════════════════════════════════
// 입력:
//   { targetUid: string, action: 'set'|'clear', value?: number, reason: string, expiresAt?: number (epoch ms) }
// 처리:
//   set → users.creatorScoreOverride = { value, tier, reason, setBy, setAt, expiresAt? } + creatorScoreCached/Tier 즉시 반영
//   clear → creatorScoreOverride 필드 삭제 (다음 배치/이벤트가 수식 값으로 복구)
// 반환: { success, targetUid, action, prevValue, newValue }
exports.adminAdjustCreatorScore = onCall(
  { region: REGION },
  async (request) => {
    const { adminUid, adminName, viaClaims } = await assertAdmin(request.auth);
    const { targetUid, action, value, reason, expiresAt } = request.data || {};

    if (typeof targetUid !== "string" || !targetUid) {
      throw new HttpsError("invalid-argument", "targetUid가 필요합니다.");
    }
    if (action !== "set" && action !== "clear") {
      throw new HttpsError("invalid-argument", "action은 'set' 또는 'clear'여야 합니다.");
    }
    if (typeof reason !== "string" || reason.trim().length < 2) {
      throw new HttpsError("invalid-argument", "사유(reason)를 2자 이상 입력하세요.");
    }

    const userRef = db.collection("users").doc(targetUid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) throw new HttpsError("not-found", "대상 유저를 찾을 수 없습니다.");
    const prev = userSnap.data();
    const prevValue = prev.creatorScoreCached ?? null;

    const now = Timestamp.now();
    let newValue = null;
    let newTier = null;
    const payload = { creatorScoreUpdatedAt: now };

    if (action === "set") {
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 10) {
        throw new HttpsError("invalid-argument", "value는 0~10 사이의 숫자여야 합니다.");
      }
      const rounded = Math.round(value * 100) / 100;
      newValue = rounded;
      newTier = getMapaeTier(rounded);
      const expTs = typeof expiresAt === "number" && expiresAt > Date.now()
        ? Timestamp.fromMillis(expiresAt)
        : null;
      payload.creatorScoreOverride = {
        value: rounded,
        reason: reason.trim(),
        setBy: adminName,
        setAt: now,
        expiresAt: expTs,
      };
      payload.creatorScoreCached = rounded;
      payload.creatorScoreTier = newTier;
    } else {
      // clear
      payload.creatorScoreOverride = FieldValue.delete();
      // creatorScoreCached는 다음 이벤트/배치에서 수식 값으로 복구됨 —
      // 여기서는 설정값만 제거. 즉시 수식 재계산이 필요하면 onUserChangedForCreatorScore가 발동.
    }

    await userRef.update(payload);

    // 🛡️ Sprint 6: admin_actions 감사 로그
    await logAdminAction({
      action: "adjust_creator_score",
      adminUid,
      adminName,
      viaClaims,
      targetUid,
      payload: {
        subAction: action, // 'set' | 'clear'
        prevValue,
        newValue,
        newTier,
        expiresAt: action === "set" && typeof expiresAt === "number" ? expiresAt : null,
      },
      reason: reason.trim(),
    });

    return {
      success: true,
      targetUid,
      action,
      prevValue,
      newValue,
      newTier,
    };
  }
);

// ═══════════════════════════════════════════════════════
// 2) adminToggleAbuseFlag — abuseFlags.{flag} 토글
// ═══════════════════════════════════════════════════════
// 입력:
//   { targetUid: string, flag: string, enabled: boolean, reason: string }
// 처리:
//   users.abuseFlags.{flag} = true | FieldValue.delete()
//   → creatorScoreEvents 트리거가 감지 → Trust 재계산 → creatorScoreCached 갱신
// 반환: { success, targetUid, flag, enabled }
exports.adminToggleAbuseFlag = onCall(
  { region: REGION },
  async (request) => {
    const { adminUid, adminName, viaClaims } = await assertAdmin(request.auth);
    const { targetUid, flag, enabled, reason } = request.data || {};

    if (typeof targetUid !== "string" || !targetUid) {
      throw new HttpsError("invalid-argument", "targetUid가 필요합니다.");
    }
    if (!ABUSE_FLAG_KEYS.includes(flag)) {
      throw new HttpsError(
        "invalid-argument",
        `flag는 [${ABUSE_FLAG_KEYS.join(", ")}] 중 하나여야 합니다.`
      );
    }
    if (typeof enabled !== "boolean") {
      throw new HttpsError("invalid-argument", "enabled는 boolean이어야 합니다.");
    }
    if (typeof reason !== "string" || reason.trim().length < 2) {
      throw new HttpsError("invalid-argument", "사유(reason)를 2자 이상 입력하세요.");
    }

    const userRef = db.collection("users").doc(targetUid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) throw new HttpsError("not-found", "대상 유저를 찾을 수 없습니다.");
    const prev = userSnap.data();
    const prevFlagOn = !!(prev.abuseFlags && prev.abuseFlags[flag]);

    // 도트 경로 업데이트 — 중첩 객체 key만 변경
    const fieldPath = `abuseFlags.${flag}`;
    await userRef.update({
      [fieldPath]: enabled ? true : FieldValue.delete(),
    });

    // 🛡️ Sprint 6: admin_actions 감사 로그
    await logAdminAction({
      action: "toggle_abuse_flag",
      adminUid,
      adminName,
      viaClaims,
      targetUid,
      payload: {
        flag,
        prevEnabled: prevFlagOn,
        newEnabled: enabled,
        penaltyApplied: TRUST_CONFIG.ABUSE_PENALTIES[flag],
      },
      reason: reason.trim(),
    });

    return {
      success: true,
      targetUid,
      flag,
      enabled,
      penaltyApplied: TRUST_CONFIG.ABUSE_PENALTIES[flag],
    };
  }
);
