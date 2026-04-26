// functions/estimateAdReach.js — 등록 시 예상 노출 추정
// 🚀 v2 P1-7 (2026-04-26): 광고주가 입력한 슬롯·메뉴·지역·단가 조건에 따라
//   지난 7일 ad_stats_daily 평균을 기반으로 일 예상 노출 추정.
//   광고주가 단가 슬라이더 움직일 때 실시간 추정값 표시.
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore } = require("firebase-admin/firestore");

const db = getFirestore();

exports.estimateAdReach = onCall(
  { region: "asia-northeast3", memory: "256MiB", timeoutSeconds: 30 },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다');
    const { bidType, bidAmount, targetSlots, targetMenuCategories, targetRegions } = request.data || {};
    if (!bidType || typeof bidAmount !== 'number') {
      throw new HttpsError('invalid-argument', 'bidType, bidAmount 필요');
    }

    // 지난 7일 ad_stats_daily 평균 노출
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400 * 1000);
    const dateStr = sevenDaysAgo.toISOString().slice(0, 10);
    const snap = await db.collection('ad_stats_daily')
      .where('date', '>=', dateStr)
      .get();

    if (snap.empty) {
      // 데이터 부족 시 보수적 추정 (CPM 10볼 기준 일 1000회)
      const baseDaily = bidType === 'cpm' ? Math.round((bidAmount / 10) * 1000) : Math.round(bidAmount * 100);
      return { estimatedDailyImpressions: baseDaily, dataAvailable: false };
    }

    // 슬롯·메뉴·지역 매칭 가중치 적용
    let totalImpressions = 0;
    let dayCount = new Set();
    for (const doc of snap.docs) {
      const s = doc.data();
      dayCount.add(s.date);
      let imps = s.impressions || 0;
      // 슬롯 매칭 비율 — targetSlots 중 해당 광고가 노출된 슬롯의 비중
      if (targetSlots?.length > 0 && s.bySlot) {
        const slotImps = targetSlots.reduce((acc, p) => acc + (s.bySlot[p] || 0), 0);
        imps = imps > 0 ? slotImps : imps;
      }
      totalImpressions += imps;
    }
    const days = Math.max(1, dayCount.size);
    const avgDaily = Math.round(totalImpressions / days);

    // 입찰 단가 가중치 — 평균 단가 대비 현재 단가 비율 (단순 선형)
    // (정확한 시뮬레이션은 실제 경매 재현이 필요하지만 일단 단순 모델)
    const bidMultiplier = bidType === 'cpm' ? clamp(bidAmount / 10, 0.3, 5) : clamp(bidAmount / 100, 0.3, 5);
    const estimated = Math.round(avgDaily * bidMultiplier);

    return {
      estimatedDailyImpressions: estimated,
      dataAvailable: true,
      basedOn: { days, totalImpressions, bidMultiplier },
    };
  }
);

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
