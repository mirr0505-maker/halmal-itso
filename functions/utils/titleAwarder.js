// functions/utils/titleAwarder.js — 🏷️ Sprint 5: 칭호 수여/업그레이드 공용 헬퍼
//
// awardTitle(uid, titleId, opts)     — 신규 획득 (이미 보유 시 skip)
// upgradeTitle(uid, titleId, tier)   — 단계형 칭호 티어 상승 (하위 tier만)
// ensureTitle(uid, titleId, tier?, ctx?) — 편의 함수: 없으면 award, 있고 tier 낮으면 upgrade
//
// 부수 효과:
//   1. users.titles 배열 업데이트 (트랜잭션)
//   2. title_achievements/{yyyyMMdd_uid_titleId[_tier]_ts} 감사 로그
//   3. notifications/{uid}/items 알림 추가 (notificationLevel에 따라 type 분기)
//
// Why: awardTitle이 5종 이상의 트리거·인라인 호출에서 재사용 → 중앙화 필수.
//      arrayUnion(object)는 deep-equal 비교라 tier upgrade에 취약 → 트랜잭션으로 수동 머지.

const { getFirestore, Timestamp } = require("firebase-admin/firestore");

const db = getFirestore();

// 🏷️ notificationLevel → 알림 type 매핑 (클라 NotificationBell에서 구분)
const NOTIFICATION_TYPE = {
  toast: "title_awarded_toast",
  celebration: "title_awarded_celebration",
  modal: "title_awarded_modal",
};

// 🚀 티어 비교 헬퍼 — I < II < III
const TIER_ORDER = { I: 1, II: 2, III: 3 };
function tierGreater(a, b) {
  return (TIER_ORDER[a] || 0) > (TIER_ORDER[b] || 0);
}

/**
 * 마스터 정의를 titles/{titleId}에서 조회. 캐시 없음(매번 get) — Stage 2 호출 빈도 낮음.
 * Stage 3+에서 핫패스 캐싱 고려.
 */
async function getTitleMaster(titleId) {
  const snap = await db.collection("titles").doc(titleId).get();
  if (!snap.exists) return null;
  return snap.data();
}

/**
 * 칭호 감사 로그 기록 + 알림 발송
 */
async function writeAchievementAndNotify(uid, titleId, tier, master, action, oldTier = null) {
  const now = Timestamp.now();
  const ymd = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10).replace(/-/g, "");
  const docId = `${ymd}_${uid}_${titleId}${tier ? `_${tier}` : ""}_${Date.now()}`;

  await db.collection("title_achievements").doc(docId).set({
    uid,
    titleId,
    tier: tier || null,
    action, // 'awarded' | 'upgraded'
    oldTier,
    achievedAt: now,
    emoji: master?.emoji || null,
    label: tier && master?.labelByTier?.[tier] ? master.labelByTier[tier] : master?.label || null,
  });

  // 알림 — notificationLevel에 따라 클라에서 토스트·축하·모달 분기
  const notifType = NOTIFICATION_TYPE[master?.notificationLevel || "toast"];
  const displayLabel = tier && master?.labelByTier?.[tier]
    ? master.labelByTier[tier]
    : master?.label || titleId;
  await db.collection("notifications").doc(uid).collection("items").add({
    type: notifType,
    titleId,
    tier: tier || null,
    emoji: master?.emoji || "🏷️",
    message: action === "upgraded"
      ? `${master?.emoji || "🏷️"} 칭호 상승! ${displayLabel}`
      : `${master?.emoji || "🏷️"} 새 칭호 획득! ${displayLabel}`,
    read: false,
    createdAt: now,
  });
}

/**
 * 기본 수여 — 이미 보유하면 skip.
 *
 * @param {string} uid
 * @param {string} titleId
 * @param {{tier?: 'I'|'II'|'III', context?: object}} [opts]
 * @returns {Promise<{awarded: boolean, reason?: string}>}
 */
async function awardTitle(uid, titleId, opts = {}) {
  if (!uid || !titleId) return { awarded: false, reason: "invalid_args" };
  const master = await getTitleMaster(titleId);
  if (!master) return { awarded: false, reason: "title_not_seeded" };

  const { tier = null, context = null } = opts;
  const userRef = db.collection("users").doc(uid);
  const now = Timestamp.now();

  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists) return { awarded: false, reason: "user_not_found" };
    const u = snap.data();
    const titles = Array.isArray(u.titles) ? u.titles : [];
    const existing = titles.find((t) => t.id === titleId);
    if (existing) {
      // 이미 보유 — 단계형은 upgradeTitle() 경로로
      return { awarded: false, reason: "already_has" };
    }

    const newTitle = {
      id: titleId,
      achievedAt: now,
    };
    if (tier) newTitle.tier = tier;
    if (context) newTitle.context = context;

    tx.update(userRef, { titles: [...titles, newTitle] });
    return { awarded: true };
  });

  if (result.awarded) {
    await writeAchievementAndNotify(uid, titleId, tier, master, "awarded");
  }
  return result;
}

/**
 * 단계형 칭호 티어 상승 — 이미 더 높은 tier면 skip.
 *
 * @param {string} uid
 * @param {string} titleId
 * @param {'I'|'II'|'III'} newTier
 * @param {{context?: object}} [opts]
 */
async function upgradeTitle(uid, titleId, newTier, opts = {}) {
  if (!uid || !titleId || !newTier) return { upgraded: false, reason: "invalid_args" };
  const master = await getTitleMaster(titleId);
  if (!master) return { upgraded: false, reason: "title_not_seeded" };
  if (!master.tiered) return { upgraded: false, reason: "not_tiered" };

  const userRef = db.collection("users").doc(uid);
  const now = Timestamp.now();

  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists) return { upgraded: false, reason: "user_not_found" };
    const u = snap.data();
    const titles = Array.isArray(u.titles) ? u.titles : [];
    const existing = titles.find((t) => t.id === titleId);
    if (!existing) {
      // 신규 부여 (단계형 award with tier)
      const newTitle = {
        id: titleId,
        tier: newTier,
        achievedAt: now,
      };
      if (opts.context) newTitle.context = opts.context;
      tx.update(userRef, { titles: [...titles, newTitle] });
      return { upgraded: true, oldTier: null, newTier, isNewAward: true };
    }
    if (!tierGreater(newTier, existing.tier)) {
      return { upgraded: false, reason: "same_or_lower_tier" };
    }
    const updated = titles.map((t) =>
      t.id === titleId
        ? { ...t, tier: newTier, upgradedAt: now, ...(opts.context ? { context: opts.context } : {}) }
        : t,
    );
    tx.update(userRef, { titles: updated });
    return { upgraded: true, oldTier: existing.tier || null, newTier, isNewAward: false };
  });

  if (result.upgraded) {
    await writeAchievementAndNotify(
      uid,
      titleId,
      newTier,
      master,
      result.isNewAward ? "awarded" : "upgraded",
      result.oldTier,
    );
  }
  return result;
}

/**
 * 편의 함수 — 단계형/비단계형 통합.
 *   - tier 없음 → awardTitle (이미 보유 시 skip)
 *   - tier 있음 → upgradeTitle (없으면 신규 + tier, 있으면 상위 tier만 갱신)
 */
async function ensureTitle(uid, titleId, tier = null, context = null) {
  if (tier) {
    return upgradeTitle(uid, titleId, tier, { context });
  }
  return awardTitle(uid, titleId, { context });
}

module.exports = {
  awardTitle,
  upgradeTitle,
  ensureTitle,
};
