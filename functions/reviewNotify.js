// functions/reviewNotify.js — 검수 요청 시 관리자 알림 발송
// 🚀 v2.1 (2026-04-26)
//   - onAdPendingReview: ads/{adId} status='pending_review' 진입 시 모든 admin에게 알림
//   - onAdvertiserPendingReview: advertiserAccounts/{uid} status='pending_review' 진입 시 모든 admin에게 알림
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const { logger } = require("firebase-functions");

const db = getFirestore();

// 모든 admin Custom Claims 보유자 uid 조회 (1000명 한도)
async function listAdminUids() {
  try {
    const auth = getAuth();
    const list = await auth.listUsers(1000);
    return list.users.filter(u => u.customClaims?.admin === true).map(u => u.uid);
  } catch (err) {
    logger.error('[listAdminUids]', err);
    return [];
  }
}

async function notifyAdmins(message, payload) {
  const adminUids = await listAdminUids();
  if (adminUids.length === 0) {
    logger.warn('[notifyAdmins] no admin custom claims found');
    return;
  }
  const now = Timestamp.now();
  const batch = db.batch();
  for (const uid of adminUids) {
    const ref = db.collection('notifications').doc(uid).collection('items').doc();
    batch.set(ref, { ...payload, message, read: false, isRead: false, createdAt: now });
  }
  await batch.commit();
  logger.info(`[notifyAdmins] sent to ${adminUids.length} admins`);
}

// 광고 검수 요청 — status='pending_review' 진입 시
exports.onAdPendingReview = onDocumentWritten(
  { document: "ads/{adId}", region: "asia-northeast3" },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!after) return;
    const becameReview = after.status === 'pending_review' &&
      (!before || before.status !== 'pending_review');
    if (!becameReview) return;
    await notifyAdmins(
      `📋 새 광고 검수 요청 — ${after.title || '제목 없음'} (광고주 ${after.advertiserName || ''})`,
      { type: 'ad_pending_review', adId: event.params.adId, advertiserId: after.advertiserId || '' },
    );
  }
);

// 광고주 등록 검수 요청 — status='pending_review' 진입 시
exports.onAdvertiserPendingReview = onDocumentWritten(
  { document: "advertiserAccounts/{uid}", region: "asia-northeast3" },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!after) return;
    const becameReview = after.status === 'pending_review' &&
      (!before || before.status !== 'pending_review');
    if (!becameReview) return;
    const typeLabel = after.type === 'corporate' ? '법인' : after.type === 'individual_business' ? '개인사업자' : '개인';
    await notifyAdmins(
      `🏢 새 광고주 등록 검수 요청 — ${after.contactName || ''} (${typeLabel})`,
      { type: 'advertiser_pending_review', advertiserUid: event.params.uid },
    );
  }
);
