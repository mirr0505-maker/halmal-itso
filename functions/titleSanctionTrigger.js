// functions/titleSanctionTrigger.js — 🏷️ Sprint 5 Stage 3: 제재 상태 변경 → 칭호 정책 적용
//
// onSanctionChangedForTitles — users/{uid} onDocumentUpdated
//
// sanctionStatus 변경 시 D5-β 매트릭스에 따라 해당 유저의 모든 칭호를 일괄 재정렬:
//   clean → exiled_lv2      → 해당 정책 칭호 일시정지 (suspended 플래그)
//   exiled_lv2 → exiled_lv3 → 해당 정책 칭호 회수 (titles 배열 제거)
//   banned                   → revoke_on_ban 정책 칭호까지 회수
//   * → active               → suspended 플래그 해제 (복구)
//
// Why: 제재 CF(sendToExile/releaseFromExile/executeSayak) 여러 경로에서 sanctionStatus를 갱신.
//      각 CF에 인라인 칭호 처리를 뿌리면 경로별 누락·불일치 위험 → 트리거 단일 통로.
//
// 🛡️ 루프 가드:
//   이 트리거가 users.titles를 갱신 → 같은 users/{uid} 문서 onUpdate 재발화.
//   sanctionStatus 불변 분기로 즉시 반환하여 재진입 종료.
//   onTitleUserUpdate(Stage 2)는 level 변경만 감시하므로 영향 없음.
//   onUserChangedForCreatorScore는 sanctionStatus/exileHistory/reputationCached/abuseFlags/
//   creatorScoreOverride 5필드만 감시 — titles 변경은 무시(영향 없음).
// 검색어: titleSanctionTrigger onSanctionChangedForTitles

const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { applyPolicyForStatus } = require("./utils/titleRevoker");

const REGION = "asia-northeast3";

exports.onSanctionChangedForTitles = onDocumentUpdated(
  { document: "users/{uid}", region: REGION },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;
    const uid = event.params.uid;
    // nickname_* 색인 문서 스킵
    if (uid.startsWith("nickname_")) return;

    const oldStatus = before.sanctionStatus || null;
    const newStatus = after.sanctionStatus || null;
    // 🛡️ 루프 가드 — 상태 불변이면 즉시 종료
    if (oldStatus === newStatus) return;

    const result = await applyPolicyForStatus(uid, oldStatus, newStatus);
    if (result.changed > 0) {
      console.log(
        `[onSanctionChangedForTitles] uid=${uid} ${oldStatus} → ${newStatus} — titles ${result.changed}/${result.planned} 건 정책 적용`,
      );
    }
  },
);
