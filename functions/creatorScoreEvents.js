// functions/creatorScoreEvents.js — 🏅 Creator Score 이벤트 기반 즉시 재계산
// Sprint 4 Phase B — 유배 상태·평판 변경 시 즉시 반영 (다음 05:00 배치 대기 불필요)
// Why: sanctionStatus 'exiled_lv3'로 변경 → trust 1.50 차감 → 즉시 Gate 차단 필요
//      reputationCached 급등 → 즉시 마패 승급 반영
// 검색어: creatorScoreEvents

const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const { calculateCreatorScore, getMapaeTier } = require("./utils/creatorScore");

const db = getFirestore();
const REGION = "asia-northeast3";

// users/{uid} 업데이트 → 트리거 입력 필드 변경 감지 시에만 Creator Score 재계산
// Why: 모든 users 쓰기마다 재계산하면 무한 루프 위험.
//      아래 "감지 대상 필드"만 체크해서 바뀐 경우에만 진행
exports.onUserChangedForCreatorScore = onDocumentUpdated(
  { document: "users/{uid}", region: REGION },
  async (event) => {
    if (event.params.uid.startsWith("nickname_")) return; // 닉네임 색인 제외
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;

    // 무한 루프 가드: 이번 업데이트가 Creator Score 필드만 바꾼 경우 재발동 안 함
    const creatorScoreFields = [
      "creatorScoreCached", "creatorScoreTier", "creatorScoreUpdatedAt",
      "recent30d_posts", "recent30d_comments", "recent30d_likesSent", "recent30dUpdatedAt",
    ];
    const changedKeys = Object.keys(after).filter((k) => {
      try {
        return JSON.stringify(before[k]) !== JSON.stringify(after[k]);
      } catch {
        return before[k] !== after[k];
      }
    });
    if (changedKeys.length === 0) return;
    if (changedKeys.every((k) => creatorScoreFields.includes(k))) return;

    // 트리거 대상 필드: sanctionStatus, exileHistory, reputationCached, abuseFlags
    const triggerFields = ["sanctionStatus", "exileHistory", "reputationCached", "abuseFlags"];
    const shouldRecalc = triggerFields.some((f) => {
      try {
        return JSON.stringify(before[f]) !== JSON.stringify(after[f]);
      } catch {
        return before[f] !== after[f];
      }
    });
    if (!shouldRecalc) return;

    const newScore = calculateCreatorScore(after);
    const newTier = getMapaeTier(newScore);

    // 결과값이 기존 캐시와 동일하면 쓰기 생략 (무한 루프 1차 방어에 추가)
    if (after.creatorScoreCached === newScore && after.creatorScoreTier === newTier) return;

    await db.collection("users").doc(event.params.uid).update({
      creatorScoreCached: newScore,
      creatorScoreTier: newTier,
      creatorScoreUpdatedAt: Timestamp.now(),
    });
    console.log(`[creatorScoreEvents] ${event.params.uid}: ${after.creatorScoreCached ?? "-"} → ${newScore} (${newTier ?? "untiered"})`);
  }
);
