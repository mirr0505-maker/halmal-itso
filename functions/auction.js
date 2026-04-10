// functions/auction.js — 광고 경매 엔진
const { onRequest } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");

const db = getFirestore();

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

      const candidates = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(ad => {
          if (!ad.targetSlots?.includes(slotPosition)) return false;
          if (ad.targetCategories?.length > 0 && !ad.targetCategories.includes(postCategory)) return false;
          // 🚀 지역 매칭 (Phase 5 Step 1)
          // - targetRegions 비어있으면 전국 타겟 (통과)
          // - viewerRegion 비어있으면 지역 무관 (통과)
          // - 둘 다 있으면 포함 여부 확인
          if (ad.targetRegions?.length > 0 && viewerRegion && !ad.targetRegions.includes(viewerRegion)) return false;
          if (ad.totalSpent >= ad.totalBudget) return false;
          return true;
        })
        .sort((a, b) => b.bidAmount - a.bidAmount);

      if (candidates.length === 0) return res.json({ success: true, ad: null, fallback: "adsense" });

      const winner = candidates[0];
      const secondPrice = candidates.length > 1 ? candidates[1].bidAmount + 1 : winner.bidAmount;

      await db.collection("adEvents").add({
        adId: winner.id, advertiserId: winner.advertiserId, postId, postAuthorId,
        postCategory: postCategory || "", slotPosition, eventType: "impression",
        bidType: winner.bidType, bidAmount: secondPrice,
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
