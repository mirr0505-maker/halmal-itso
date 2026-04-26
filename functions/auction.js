// functions/auction.js — 광고 경매 엔진
const { onRequest } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");

const db = getFirestore();

// 🏅 Creator Score 가중치 경계 — effectiveBid = bidAmount × clamp(score, MIN, MAX)
// Why: 하한 0.3 = MIN_TRUST 철학(유배 3차도 이 바닥), 상한 3.0 = 다이아 과보정 방지
//      집계 전(null)은 1.0 fallback → 신규 광고주 봉쇄 방지. 배포 1주 분포 실측 후 튜닝 예정.
const SCORE_CLAMP_MIN = 0.3;
const SCORE_CLAMP_MAX = 3.0;
const SCORE_FALLBACK = 1.0;

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

exports.adAuction = onRequest(
  { region: "asia-northeast3", cors: true },
  async (req, res) => {
    if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

    const { slotPosition, postCategory, postId, postAuthorId, postAuthorLevel, viewerRegion } = req.body;
    if (!slotPosition || !postId) return res.status(400).json({ error: "slotPosition, postId 필수" });

    if ((postAuthorLevel || 0) < 5) return res.json({ success: true, ad: null, fallback: "promo" });

    try {
      const snap = await db.collection("ads").where("status", "==", "active").get();
      if (snap.empty) return res.json({ success: true, ad: null, fallback: "adsense" });

      const filtered = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(ad => {
          if (!ad.targetSlots?.includes(slotPosition)) return false;
          // 📍 글 메뉴 카테고리 매칭 (2026-04-25 ~) — targetMenuCategories와 글 카테고리(postCategory) 비교
          //   기존 targetCategories는 업종 통계용으로 분리, 매칭에는 미사용
          if (ad.targetMenuCategories?.length > 0 && !ad.targetMenuCategories.includes(postCategory)) return false;
          // 🚀 지역 매칭 (Phase 5 Step 1)
          if (ad.targetRegions?.length > 0 && viewerRegion && !ad.targetRegions.includes(viewerRegion)) return false;
          // 🏪 크리에이터 지면 타겟팅 — 특정 크리에이터 지면에만 노출
          if (ad.targetCreatorId && ad.targetCreatorId !== postAuthorId) return false;
          if (ad.totalSpent >= ad.totalBudget) return false;
          return true;
        });

      if (filtered.length === 0) return res.json({ success: true, ad: null, fallback: "adsense" });

      // 🏅 광고주 Creator Score 일괄 조회 → effectiveBid 계산
      // Why: bidAmount 단순 비교 대신 creatorScoreCached 가중. 평판 낮은 광고주 억제 + 품질 광고 우대
      const advertiserIds = [...new Set(filtered.map(ad => ad.advertiserId).filter(Boolean))];
      const advertiserScores = {};
      if (advertiserIds.length > 0) {
        const userSnaps = await db.getAll(...advertiserIds.map(id => db.collection("users").doc(id)));
        for (const us of userSnaps) {
          const data = us.data() || {};
          const raw = typeof data.creatorScoreCached === "number" ? data.creatorScoreCached : SCORE_FALLBACK;
          advertiserScores[us.id] = clamp(raw, SCORE_CLAMP_MIN, SCORE_CLAMP_MAX);
        }
      }

      const candidates = filtered
        .map(ad => ({
          ...ad,
          _scoreWeight: advertiserScores[ad.advertiserId] || SCORE_FALLBACK,
          _effectiveBid: (ad.bidAmount || 0) * (advertiserScores[ad.advertiserId] || SCORE_FALLBACK),
        }))
        .sort((a, b) => b._effectiveBid - a._effectiveBid);

      const winner = candidates[0];
      // 💰 차순가 결제는 **원본 bidAmount** 기준 — Creator Score는 ranking에만 사용 (대장 과금 공정성)
      const secondPrice = candidates.length > 1 ? candidates[1].bidAmount + 1 : winner.bidAmount;

      await db.collection("adEvents").add({
        adId: winner.id, advertiserId: winner.advertiserId, postId, postAuthorId,
        postCategory: postCategory || "", slotPosition, eventType: "impression",
        bidType: winner.bidType, bidAmount: secondPrice,
        winnerScoreWeight: winner._scoreWeight,      // 🏅 튜닝 관찰용 — 낙찰자 Creator Score 가중
        winnerEffectiveBid: winner._effectiveBid,   // 🏅 튜닝 관찰용 — 실제 랭킹에 쓴 effectiveBid
        viewerUid: "anonymous", sessionId: `session_${Date.now()}`,
        isSuspicious: false, createdAt: Timestamp.now(),
      });

      await db.collection("ads").doc(winner.id).update({
        totalImpressions: FieldValue.increment(1),
        totalSpent: FieldValue.increment(winner.bidType === "cpm" ? secondPrice / 1000 : 0),
      });

      return res.json({
        success: true,
        ad: {
          adId: winner.id, headline: winner.headline, description: winner.description,
          imageUrl: winner.imageUrl, landingUrl: winner.landingUrl, ctaText: winner.ctaText,
          // 🔧 2026-04-26: imageStyle/imagePosition 응답 누락 버그 — 클라 AdBanner가 default 'horizontal'로 fallback해 가로로만 노출되던 문제 해소
          imageStyle: winner.imageStyle || 'horizontal',
          imagePosition: winner.imagePosition || 'left',
          bidType: winner.bidType, chargeAmount: secondPrice,
        },
        fallback: null,
      });
    } catch (err) {
      console.error("[adAuction]", err);
      return res.status(500).json({ error: "경매 처리 실패" });
    }
  }
);
