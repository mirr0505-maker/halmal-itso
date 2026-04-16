// functions/shareholderCleanup.js — 🛡️ 주주 인증 스크린샷 30일 자동 삭제
// 매일 04:30 KST 실행 — approvedAt + 30일 경과한 스크린샷을 R2에서 삭제 + Firestore 정리
// checkAutoSayak 패턴 동일
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const db = getFirestore();

// R2 파일 삭제 — upload-worker의 DELETE 엔드포인트 호출
const WORKER_URL = "https://halmal-upload.mirr0505.workers.dev";

async function deleteR2File(filePath, idToken) {
  try {
    const res = await fetch(`${WORKER_URL}/delete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${idToken}`,
      },
      body: JSON.stringify({ filePath }),
    });
    const data = await res.json();
    return data.success || false;
  } catch (err) {
    console.error(`[shareholderCleanup] R2 삭제 실패: ${filePath}`, err);
    return false;
  }
}

// R2 공개 URL에서 파일 경로 추출
function extractPathFromUrl(url) {
  if (!url) return null;
  // https://pub-xxx.r2.dev/uploads/userId/shareholder_xxx.jpg → uploads/userId/shareholder_xxx.jpg
  const match = url.match(/r2\.dev\/(.+)$/);
  return match ? match[1] : null;
}

exports.cleanupShareholderScreenshots = onSchedule(
  { schedule: "30 4 * * *", timeZone: "Asia/Seoul", region: "asia-northeast3" },
  async () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // approvedAt이 30일 이전인 멤버십 문서 조회
    const snap = await db.collection("community_memberships")
      .where("verifyRequest.status", "==", "approved")
      .get();

    let deleted = 0;
    let skipped = 0;

    for (const doc of snap.docs) {
      const data = doc.data();
      const vr = data.verifyRequest;
      if (!vr?.approvedAt || !vr?.screenshotUrl) { skipped++; continue; }

      const approvedMs = vr.approvedAt.toMillis ? vr.approvedAt.toMillis() : vr.approvedAt.seconds * 1000;
      if (approvedMs > thirtyDaysAgo.getTime()) { skipped++; continue; }

      // R2 파일 삭제
      const filePath = extractPathFromUrl(vr.screenshotUrl);
      if (filePath) {
        // Cloud Function에서는 서비스 계정 토큰이 필요하지만,
        // Worker의 DELETE는 Firebase Auth 토큰을 검증함.
        // 임시 해결: screenshotUrl만 Firestore에서 제거 (R2 파일은 orphan으로 남김)
        // TODO: Worker에 서비스 계정 인증 또는 shared secret 방식 추가 후 실제 R2 삭제
        console.log(`[shareholderCleanup] 만료 스크린샷 정리: ${doc.id} → ${filePath}`);
      }

      // Firestore에서 screenshotUrl 제거 (URL 참조만 삭제 — 열람 불가 상태로 전환)
      await doc.ref.update({
        "verifyRequest.screenshotUrl": FieldValue.delete(),
      });
      deleted++;
    }

    console.log(`[shareholderCleanup] 완료: ${deleted}건 정리, ${skipped}건 스킵`);
  }
);
