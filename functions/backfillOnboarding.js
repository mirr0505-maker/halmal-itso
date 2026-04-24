// functions/backfillOnboarding.js — 🚪 Sprint 7.5 핫픽스 레거시 백필 (관리자 1회성)
//
// 🚀 구성:
//   backfillOnboarding — onCall (관리자 전용, 1회 실행 가정)
//
// 🔒 정책:
//   - 대상: createdAt < CUTOFF(2026-04-23 00:00 KST) & onboardingCompleted !== true
//   - 기록: onboardingCompleted=true, onboardingCompletedAt=now, nicknameSet=true(미설정 시만)
//   - phoneVerified는 손대지 않음 (false 유지 → banned_phones 방어 정상 동작)
//   - dryRun=true로 scanned/target 먼저 측정, 확정 후 dryRun=false로 재실행
//   - 400건 배치
//   - admin_actions 감사 로그 기록

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const { assertAdmin } = require("./utils/adminAuth");
const { logAdminAction } = require("./adminAudit");

const db = getFirestore();

// 🚀 Sprint 7.5 배포 시점 (KST)
// 이 시각 이전 가입자는 "레거시" — 온보딩 게이트 무료 통과 대상
// 2026-04-23 00:00:00 KST = 2026-04-22 15:00:00 UTC
const CUTOFF_MS = Date.UTC(2026, 3, 22, 15, 0, 0); // month=3 → April

exports.backfillOnboarding = onCall(
  { region: "asia-northeast3", timeoutSeconds: 540, memory: "512MiB" },
  async (request) => {
    const { adminUid, adminName, viaClaims } = await assertAdmin(request.auth);

    const dryRun = request.data?.dryRun !== false; // 기본 true (안전)
    const reason = typeof request.data?.reason === "string" ? request.data.reason.trim() : "";
    if (!dryRun && reason.length < 2) {
      throw new HttpsError("invalid-argument", "사유는 2자 이상이어야 합니다.");
    }

    const cutoffTs = Timestamp.fromMillis(CUTOFF_MS);

    const snap = await db.collection("users").get();
    let scanned = 0;
    let target = 0;
    let updated = 0;
    let errored = 0;
    const BATCH_LIMIT = 400;
    let batch = db.batch();
    let batchCount = 0;

    for (const doc of snap.docs) {
      scanned += 1;
      const u = doc.data();

      // 이미 온보딩 완결된 유저는 skip
      if (u.onboardingCompleted === true) continue;

      // createdAt 없는 아주 오래된 문서도 레거시로 간주 (안전하게 포함)
      const createdAt = u.createdAt;
      if (createdAt && typeof createdAt.toMillis === "function") {
        if (createdAt.toMillis() >= CUTOFF_MS) continue; // 신규 가입자 제외
      }

      target += 1;
      if (dryRun) continue;

      const update = {
        onboardingCompleted: true,
        onboardingCompletedAt: FieldValue.serverTimestamp(),
      };
      if (u.nicknameSet !== true) {
        // 레거시는 닉네임을 이미 사용 중이므로 nicknameSet=true로 보정
        update.nicknameSet = true;
      }

      try {
        batch.update(doc.ref, update);
        batchCount += 1;
        updated += 1;
        if (batchCount >= BATCH_LIMIT) {
          await batch.commit();
          batch = db.batch();
          batchCount = 0;
        }
      } catch (e) {
        errored += 1;
      }
    }

    if (!dryRun && batchCount > 0) {
      await batch.commit();
    }

    // 감사 로그 — 실제 업데이트한 경우만 기록
    if (!dryRun) {
      await logAdminAction({
        action: "backfill_onboarding",
        adminUid,
        adminName,
        viaClaims,
        targetUid: null,
        payload: { scanned, target, updated, errored, cutoffKST: "2026-04-23 00:00" },
        reason,
      });
    }

    return {
      ok: true,
      dryRun,
      scanned,
      target,
      updated,
      errored,
      cutoffKST: "2026-04-23 00:00",
    };
  }
);
