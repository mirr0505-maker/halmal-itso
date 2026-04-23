// functions/utils/titleRevoker.js — 🏷️ Sprint 5 Stage 3: 칭호 일시정지/회수/복구 공용 헬퍼
//
// 공개 API:
//   suspendTitle(uid, titleId, reason)      — users.titles[].suspended=true 마킹
//   revokeTitle(uid, titleId, reason)       — users.titles 배열에서 제거 + title_revocations 기록
//   restoreTitle(uid, titleId, reason)      — suspended 플래그 해제 + 알림
//   applyPolicyForStatus(uid, oldStatus, newStatus) — D5-β 매트릭스 일괄 적용
//
// D5-β 매트릭스 (src/constants.ts TITLE_CATALOG.revocationPolicy):
//   permanent               — 유배/사약 무관 영구 보유 (pioneer_2026)
//   revoke_on_ban           — 사약(banned)에서만 회수 (writer_seed / sponsor / veteran_2year)
//   suspend_lv2_revoke_lv3  — lv2 일시정지, lv3+/banned 회수, active 복귀 시 복구
//                              (대부분의 칭호 10종)
//
// Why: 유배는 일시적(속죄금 납부 후 active 복귀 가능) → 경계선 칭호는 일시정지로 보존,
//      결정적 처분(사약·3단계)에만 영구 회수. 불공정성 항의 최소화 + 서비스 자정 균형.
// 검색어: titleRevoker applyPolicyForStatus

const { getFirestore, Timestamp } = require("firebase-admin/firestore");

const db = getFirestore();

// 제재 단계 숫자화 — suspend/revoke 경계 비교용
// undefined/active/null = 0, exiled_lv1 = 1, exiled_lv2 = 2, exiled_lv3 = 3, banned = 4
function statusTier(status) {
  if (!status || status === "active") return 0;
  if (status === "exiled_lv1") return 1;
  if (status === "exiled_lv2") return 2;
  if (status === "exiled_lv3") return 3;
  if (status === "banned") return 4;
  return 0; // 알 수 없는 값은 정상으로 간주
}

/**
 * 주어진 제재 상태에서 특정 정책의 칭호가 어떤 state에 있어야 하는가.
 *   'active'    — 활성 (suspended 아님, revoke 아님)
 *   'suspended' — 일시정지 (titles 배열에 남되 플래그 true)
 *   'revoked'   — 회수 (titles 배열에서 제거)
 */
function computeTargetState(policy, statusStr) {
  const tier = statusTier(statusStr);
  if (policy === "permanent") return "active";
  if (policy === "revoke_on_ban") {
    return tier >= 4 ? "revoked" : "active";
  }
  if (policy === "suspend_lv2_revoke_lv3") {
    if (tier >= 3) return "revoked"; // lv3 or banned
    if (tier >= 2) return "suspended"; // lv2
    return "active"; // clean / lv1
  }
  return "active"; // 알 수 없는 정책은 보수적으로 active
}

// 마스터 정의 로드 — 정책 참조용. 캐시 없음(Stage 3 호출 빈도는 제재 이벤트뿐).
async function getTitleMaster(titleId) {
  const snap = await db.collection("titles").doc(titleId).get();
  return snap.exists ? snap.data() : null;
}

/**
 * 칭호 일시정지. users.titles 배열 중 해당 id에 suspended=true 설정.
 * 이미 suspended면 no-op.
 */
async function suspendTitle(uid, titleId, reason) {
  const userRef = db.collection("users").doc(uid);
  const master = await getTitleMaster(titleId);
  const now = Timestamp.now();

  const { changed, tier } = await db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists) return { changed: false, tier: null };
    const titles = Array.isArray(snap.data().titles) ? snap.data().titles : [];
    const idx = titles.findIndex((t) => t.id === titleId);
    if (idx < 0) return { changed: false, tier: null };
    if (titles[idx].suspended === true) {
      return { changed: false, tier: titles[idx].tier || null };
    }
    const updated = titles.map((t, i) =>
      i === idx
        ? { ...t, suspended: true, suspendedAt: now, suspendReason: reason || null }
        : t,
    );
    tx.update(userRef, { titles: updated });
    return { changed: true, tier: titles[idx].tier || null };
  });

  if (changed) {
    const label = tier && master?.labelByTier?.[tier]
      ? master.labelByTier[tier]
      : master?.label || titleId;
    await db.collection("notifications").doc(uid).collection("items").add({
      type: "title_suspended",
      titleId,
      tier: tier || null,
      emoji: master?.emoji || "⏸️",
      message: `${master?.emoji || "⏸️"} 유배 중 칭호 일시정지: ${label}`,
      read: false,
      createdAt: now,
    });
  }
  return { changed };
}

/**
 * 칭호 회수. users.titles에서 제거 + title_revocations 감사 로그 + 알림.
 */
async function revokeTitle(uid, titleId, reason) {
  const userRef = db.collection("users").doc(uid);
  const master = await getTitleMaster(titleId);
  const now = Timestamp.now();

  const { changed, removedTitle } = await db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists) return { changed: false, removedTitle: null };
    const titles = Array.isArray(snap.data().titles) ? snap.data().titles : [];
    const idx = titles.findIndex((t) => t.id === titleId);
    if (idx < 0) return { changed: false, removedTitle: null };
    const removed = titles[idx];
    const updated = titles.filter((_, i) => i !== idx);
    tx.update(userRef, { titles: updated });
    return { changed: true, removedTitle: removed };
  });

  if (!changed) return { changed };

  const tier = removedTitle.tier || null;
  const ymd = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10).replace(/-/g, "");
  const docId = `${ymd}_${uid}_${titleId}_${Date.now()}`;
  await db.collection("title_revocations").doc(docId).set({
    uid,
    titleId,
    tier,
    reason: reason || "unspecified",
    revokedAt: now,
    achievedAt: removedTitle.achievedAt || null,
    emoji: master?.emoji || null,
    label: tier && master?.labelByTier?.[tier] ? master.labelByTier[tier] : master?.label || null,
  });

  const label = tier && master?.labelByTier?.[tier]
    ? master.labelByTier[tier]
    : master?.label || titleId;
  await db.collection("notifications").doc(uid).collection("items").add({
    type: "title_revoked",
    titleId,
    tier,
    emoji: master?.emoji || "🗑️",
    message: `${master?.emoji || "🗑️"} 칭호가 회수되었습니다: ${label}`,
    read: false,
    createdAt: now,
  });
  return { changed };
}

/**
 * 일시정지된 칭호 복구. suspended 플래그 제거 + 알림.
 */
async function restoreTitle(uid, titleId, reason) {
  const userRef = db.collection("users").doc(uid);
  const master = await getTitleMaster(titleId);
  const now = Timestamp.now();

  const { changed, tier } = await db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists) return { changed: false, tier: null };
    const titles = Array.isArray(snap.data().titles) ? snap.data().titles : [];
    const idx = titles.findIndex((t) => t.id === titleId);
    if (idx < 0) return { changed: false, tier: null };
    if (!titles[idx].suspended) return { changed: false, tier: titles[idx].tier || null };
    const updated = titles.map((t, i) => {
      if (i !== idx) return t;
      // suspended 관련 3필드 제거 (restoredAt은 기록)
      const { suspended, suspendedAt, suspendReason, ...rest } = t;
      return { ...rest, restoredAt: now };
    });
    tx.update(userRef, { titles: updated });
    return { changed: true, tier: titles[idx].tier || null };
  });

  if (changed) {
    const label = tier && master?.labelByTier?.[tier]
      ? master.labelByTier[tier]
      : master?.label || titleId;
    await db.collection("notifications").doc(uid).collection("items").add({
      type: "title_restored",
      titleId,
      tier: tier || null,
      emoji: master?.emoji || "✅",
      message: `${master?.emoji || "✅"} 유배 해제 — 칭호 복구: ${label}`,
      read: false,
      createdAt: now,
    });
  }
  return { changed };
}

/**
 * D5-β 매트릭스 일괄 적용 — sanctionStatus 변경 시 이 유저의 모든 칭호를 순회하며
 * 각 정책에 맞는 target state로 재정렬.
 *
 * @param {string} uid
 * @param {string|null} oldStatus
 * @param {string|null} newStatus
 */
async function applyPolicyForStatus(uid, oldStatus, newStatus) {
  const userRef = db.collection("users").doc(uid);
  const snap = await userRef.get();
  if (!snap.exists) return { changed: 0 };
  const titles = Array.isArray(snap.data().titles) ? snap.data().titles : [];
  if (titles.length === 0) return { changed: 0 };

  // 정책 참조는 마스터에서 — 유저 배열에는 정책이 없음
  // 유저 보유 titleId 집합만큼 titles/{id} 병렬 조회 (소규모 N, ≤ 14)
  const masters = await Promise.all(
    titles.map((t) => getTitleMaster(t.id).then((m) => [t.id, m])),
  );
  const masterMap = new Map(masters);

  // 정책별 action 계획 — revoke는 복구 불가이므로 suspend보다 먼저 처리
  const reason = `sanction_${newStatus || "active"}`;
  const actions = []; // { type: 'revoke'|'suspend'|'restore', titleId }

  for (const t of titles) {
    const master = masterMap.get(t.id);
    const policy = master?.revocationPolicy;
    if (!policy) continue; // 마스터 없는 고아 칭호는 건드리지 않음
    const target = computeTargetState(policy, newStatus);
    const currentlySuspended = t.suspended === true;

    if (target === "revoked") {
      actions.push({ type: "revoke", titleId: t.id });
    } else if (target === "suspended" && !currentlySuspended) {
      actions.push({ type: "suspend", titleId: t.id });
    } else if (target === "active" && currentlySuspended) {
      actions.push({ type: "restore", titleId: t.id });
    }
  }

  let changed = 0;
  for (const a of actions) {
    const res = a.type === "revoke"
      ? await revokeTitle(uid, a.titleId, reason)
      : a.type === "suspend"
        ? await suspendTitle(uid, a.titleId, reason)
        : await restoreTitle(uid, a.titleId, reason);
    if (res.changed) changed++;
  }

  return { changed, planned: actions.length, oldStatus, newStatus };
}

module.exports = {
  statusTier,
  computeTargetState,
  suspendTitle,
  revokeTitle,
  restoreTitle,
  applyPolicyForStatus,
};
