// functions/titleTriggers.js — 🏷️ Sprint 5 Stage 2: 칭호 이벤트 트리거
//
// 5종 Firestore 트리거:
//   1. onTitlePostCreate            — writer_seed + writer_diligent streak 관리
//   2. onTitlePostLikeChanged       — viral_first / popular_writer / super_hit
//   3. onTitleCommentCreate         — chat_master (validCommentCount 증가)
//   4. onTitleUserCreate            — pioneer_2026 (2026년 내 가입자)
//   5. onTitleUserUpdate            — dedication (Lv10/15/20 도달)
//
// Why: 개별 이벤트로 저렴하게 처리 가능한 칭호는 트리거로 즉시 반응,
//      비용이 큰 집계형(맞깐부·팔로워 수·1년 개근 등)은 titleRollup.js 05:30 KST로 이관.
//      sponsor만 thanksball.js 인라인 훅(트랜잭션 직후) — 별도 트리거 불필요.
//
// ⚠️ 무한 루프 가드:
//   onTitleUserUpdate는 awardTitle/upgradeTitle이 users.titles를 건드려 재발화.
//   before.level === after.level이면 즉시 반환하여 재진입 차단.
// 검색어: titleTriggers

const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const { awardTitle, upgradeTitle } = require("./utils/titleAwarder");

const db = getFirestore();
const REGION = "asia-northeast3";

// 🚀 서버용 Threshold — src/constants.ts TITLE_THRESHOLDS와 1:1 매칭
const THRESHOLDS = {
  writer_diligent: { I: 30, II: 100, III: 365 },
  chat_master: { I: 1000, II: 5000, III: 20000 },
  dedication: { I: 10, II: 15, III: 20 },
};

// 🚀 pioneer_2026 cutoff (2027-01-01 00:00:00 KST → UTC = 2026-12-31 15:00:00Z)
const PIONEER_CUTOFF_MS = Date.UTC(2026, 11, 31, 15, 0, 0);

// 유효 콘텐츠 판정 — activityLogger.isEligibleContent와 동일 기준
function isEligibleContent(content) {
  if (!content) return false;
  const plain = String(content).replace(/<[^>]+>/g, "").replace(/\s/g, "");
  return plain.length >= 10;
}

// KST 기준 YYYYMMDD 문자열 (연속 일자 streak 키)
function kstYmd(msOffset = 0) {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000 + msOffset);
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

// tiered 칭호의 현재 값(writer_diligent 30일 → 'I')에서 해당하는 가장 높은 tier 계산
function pickTier(titleId, value) {
  const t = THRESHOLDS[titleId];
  if (!t) return null;
  if (value >= t.III) return "III";
  if (value >= t.II) return "II";
  if (value >= t.I) return "I";
  return null;
}

// ═══════════════════════════════════════════════════════
// 1) 글 생성 → writer_seed + writer_diligent streak
// ═══════════════════════════════════════════════════════
// Why: 첫 유효 글 = writer_seed (비 tier). 이어서 KST 기준 연속 일자 streak 갱신:
//   lastPostDate === today        → 변경 없음 (오늘 이미 집계됨)
//   lastPostDate === yesterday    → consecutivePostDays++, lastPostDate = today
//   그 외(공백/갭)                  → consecutivePostDays = 1, lastPostDate = today
// 유배글·짧은글(10자 미만)은 streak 제외 (스팸 방어)
exports.onTitlePostCreate = onDocumentCreated(
  { document: "posts/{postId}", region: REGION },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;
    const uid = data.author_id;
    if (!uid) return;
    if (!isEligibleContent(data.content)) return;
    // 🏚️ 유배 카테고리는 streak 제외 (정상 활동 아님)
    if (data.category === "유배·귀양지") return;

    // writer_seed — 이미 보유 시 skip
    await awardTitle(uid, "writer_seed");

    // writer_diligent streak — 트랜잭션으로 users 갱신
    const userRef = db.collection("users").doc(uid);
    const today = kstYmd();
    const yesterday = kstYmd(-24 * 60 * 60 * 1000);

    const newStreak = await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      if (!snap.exists) return 0;
      const u = snap.data();
      const last = u.lastPostDate || null;
      const prev = u.consecutivePostDays || 0;
      let next;
      if (last === today) {
        return prev; // 오늘 이미 집계 — 변경 없음
      } else if (last === yesterday) {
        next = prev + 1;
      } else {
        next = 1;
      }
      tx.update(userRef, {
        consecutivePostDays: next,
        lastPostDate: today,
      });
      return next;
    });

    // streak threshold 도달 시 writer_diligent tier 부여/상승
    const tier = pickTier("writer_diligent", newStreak);
    if (tier) {
      await upgradeTitle(uid, "writer_diligent", tier, {
        context: { streak: newStreak },
      });
    }
  },
);

// ═══════════════════════════════════════════════════════
// 2) 글 좋아요 변경 → viral_first / popular_writer / super_hit
// ═══════════════════════════════════════════════════════
// Why: 단일 글 고유 좋아요 수 = likedBy.length. 임계값을 갓 넘은 순간에만 award.
//      이미 보유한 칭호는 awardTitle 내부에서 already_has로 skip되므로 추가 가드 불필요.
exports.onTitlePostLikeChanged = onDocumentUpdated(
  { document: "posts/{postId}", region: REGION },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;
    const uid = after.author_id;
    if (!uid) return;

    const beforeLen = Array.isArray(before.likedBy) ? before.likedBy.length : 0;
    const afterLen = Array.isArray(after.likedBy) ? after.likedBy.length : 0;
    if (afterLen <= beforeLen) return; // 감소·무변화 → 무시

    const postId = event.params.postId;
    const milestones = [
      { titleId: "viral_first", min: 30 },
      { titleId: "popular_writer", min: 100 },
      { titleId: "super_hit", min: 1000 },
    ];
    for (const m of milestones) {
      if (beforeLen < m.min && afterLen >= m.min) {
        await awardTitle(uid, m.titleId, {
          context: { postId, likes: afterLen },
        });
      }
    }
  },
);

// ═══════════════════════════════════════════════════════
// 3) 댓글 생성 → chat_master (validCommentCount 증가 + tier 재계산)
// ═══════════════════════════════════════════════════════
// Why: 유효 댓글(10자+)만 카운트. Phase 2+에서 '고유 반응 5+' 보조 조건 추가 예정.
//      현재는 본문 길이만으로 판정(Sprint 5 Stage 2 범위).
exports.onTitleCommentCreate = onDocumentCreated(
  { document: "comments/{commentId}", region: REGION },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;
    const uid = data.author_id;
    if (!uid) return;
    if (!isEligibleContent(data.content)) return;

    const userRef = db.collection("users").doc(uid);
    const newCount = await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      if (!snap.exists) return 0;
      const u = snap.data();
      const next = (u.validCommentCount || 0) + 1;
      tx.update(userRef, { validCommentCount: next });
      return next;
    });

    const tier = pickTier("chat_master", newCount);
    if (tier) {
      await upgradeTitle(uid, "chat_master", tier, {
        context: { validCommentCount: newCount },
      });
    }
  },
);

// ═══════════════════════════════════════════════════════
// 4) 유저 생성 → pioneer_2026 (2026년 가입 한정판)
// ═══════════════════════════════════════════════════════
// Why: 2027-01-01 00:00 KST 이전에 생성된 users/{uid} 문서만 해당.
//      createdAt 누락 시 onDocumentCreated 발화 시각(현재)으로 근사.
exports.onTitleUserCreate = onDocumentCreated(
  { document: "users/{uid}", region: REGION },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;
    // 닉네임 색인 문서(nickname_XXX)는 스킵 — 실제 유저 문서만 대상
    const uid = event.params.uid;
    if (uid.startsWith("nickname_")) return;

    const createdMs = data.createdAt?.toMillis?.() ?? Date.now();
    if (createdMs >= PIONEER_CUTOFF_MS) return;

    await awardTitle(uid, "pioneer_2026");
  },
);

// ═══════════════════════════════════════════════════════
// 5) 유저 업데이트 → dedication (Lv10/15/20 도달)
// ═══════════════════════════════════════════════════════
// Why: 레벨 상승 시점에만 tier 판정. before.level === after.level이면 즉시 반환하여
//      awardTitle이 users.titles를 갱신해 재발화시켜도 무한루프 방지.
exports.onTitleUserUpdate = onDocumentUpdated(
  { document: "users/{uid}", region: REGION },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;
    const uid = event.params.uid;
    if (uid.startsWith("nickname_")) return;

    const beforeLv = before.level || 0;
    const afterLv = after.level || 0;
    if (beforeLv === afterLv) return; // 🛡️ 루프 가드

    const tier = pickTier("dedication", afterLv);
    if (!tier) return;
    // 레벨 경계를 갓 넘은 경우만 트리거 (중복 award는 upgradeTitle 내부 same_or_lower_tier로 skip)
    const beforeTier = pickTier("dedication", beforeLv);
    if (beforeTier === tier) return;

    await upgradeTitle(uid, "dedication", tier, {
      context: { level: afterLv },
    });
  },
);
