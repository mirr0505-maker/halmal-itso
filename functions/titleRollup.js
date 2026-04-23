// functions/titleRollup.js — 🏷️ Sprint 5 Stage 2: 일일 칭호 집계 스케줄 CF
//
// dailyTitleRollup — 매일 05:30 KST 실행 (creatorScoreCache 05:00 뒤 30분 지연)
//
// 처리 항목:
//   1. social_master       — 맞깐부(mutual friend) 30명+
//   2. kanbu_star          — 나를 깐부한 수 100명+
//   3. influencer          — 나를 깐부한 수 1,000명+
//   4. loyal_1year         — 가입 365일+ & 최근 30일 내 활동
//   5. veteran_2year       — 가입 2년+
//   6. writer_diligent streak reset — 어제도 오늘도 글 없는 유저 consecutivePostDays=0
//
// Why: friendList는 닉네임 배열(toggleKanbu 구현). 팔로워 수 카운터 컬렉션이 없어
//      매 이벤트 증감 유지가 어려움 → 일일 전체 스캔으로 일괄 집계(N 유저 규모 < 50K 시 실용적).
//      트리거 경로로 분산하면 write amplification + 결괏값 정합성 위험 → rollup이 단일 진실 소스.
// 검색어: titleRollup dailyTitleRollup

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { awardTitle } = require("./utils/titleAwarder");

const db = getFirestore();
const REGION = "asia-northeast3";

// 🚀 수치 상수 — src/constants.ts와 매칭
const MUTUAL_THRESHOLD = 30;           // social_master
const KANBU_STAR_THRESHOLD = 100;      // kanbu_star
const INFLUENCER_THRESHOLD = 1000;     // influencer
const LOYAL_DAYS = 365;                // loyal_1year
const VETERAN_DAYS = 730;              // veteran_2year
const LAST_ACTIVE_WINDOW_DAYS = 30;    // loyal_1year 활동 판정 창

// KST YYYYMMDD
function kstYmd(msOffset = 0) {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000 + msOffset);
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

exports.dailyTitleRollup = onSchedule(
  {
    schedule: "30 5 * * *",
    timeZone: "Asia/Seoul",
    region: REGION,
    timeoutSeconds: 540,
    memory: "1GiB",
  },
  async () => {
    const startedAt = Date.now();
    console.log("[dailyTitleRollup] 시작");

    // ─── Step 1: 전체 유저 1회 전수 로드 (nickname_* 색인 제외) ───
    const usersSnap = await db.collection("users").get();
    const users = [];
    for (const doc of usersSnap.docs) {
      if (doc.id.startsWith("nickname_")) continue;
      const u = doc.data();
      if (!u.nickname) continue; // 닉네임 없는 반쯤 생성된 문서 skip
      users.push({ uid: doc.id, data: u });
    }
    console.log(`[dailyTitleRollup] 대상 유저 ${users.length}명`);

    // ─── Step 2: nickname → {uid, friendSet} 맵 + 팔로워 카운트 1패스 ───
    const nicknameToUid = new Map();
    const friendSetByNickname = new Map();
    const followerCountByNickname = new Map();

    for (const { uid, data } of users) {
      nicknameToUid.set(data.nickname, uid);
      const fl = Array.isArray(data.friendList) ? data.friendList : [];
      friendSetByNickname.set(data.nickname, new Set(fl));
      for (const f of fl) {
        followerCountByNickname.set(f, (followerCountByNickname.get(f) || 0) + 1);
      }
    }

    // ─── Step 3: 유저별 집계 + 칭호 후보 산출 ───
    const now = Date.now();
    const loyalCutoff = now - LOYAL_DAYS * 24 * 60 * 60 * 1000;
    const veteranCutoff = now - VETERAN_DAYS * 24 * 60 * 60 * 1000;
    const activityCutoff = now - LAST_ACTIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    const yesterday = kstYmd(-24 * 60 * 60 * 1000);
    const today = kstYmd();

    const streakResetBatch = db.batch();
    let streakResetCount = 0;
    const awardPromises = [];

    for (const { uid, data } of users) {
      const myNick = data.nickname;
      const myFriendSet = friendSetByNickname.get(myNick) || new Set();

      // 맞깐부 카운트 — 내 friendList에 있는 닉네임 중, 상대도 나를 포함한 경우
      let mutualCount = 0;
      for (const friendNick of myFriendSet) {
        const theirSet = friendSetByNickname.get(friendNick);
        if (theirSet && theirSet.has(myNick)) mutualCount++;
      }
      // 팔로워 수
      const followerCount = followerCountByNickname.get(myNick) || 0;

      // 🤝 social_master (맞깐부 30+)
      if (mutualCount >= MUTUAL_THRESHOLD) {
        awardPromises.push(awardTitle(uid, "social_master", {
          context: { mutualCount },
        }));
      }
      // 🌟 kanbu_star (팔로워 100+)
      if (followerCount >= KANBU_STAR_THRESHOLD) {
        awardPromises.push(awardTitle(uid, "kanbu_star", {
          context: { followerCount },
        }));
      }
      // 👑 influencer (팔로워 1000+)
      if (followerCount >= INFLUENCER_THRESHOLD) {
        awardPromises.push(awardTitle(uid, "influencer", {
          context: { followerCount },
        }));
      }

      // 🎖️ loyal_1year (가입 365일+ & 최근 30일 내 활동)
      const createdMs = data.createdAt?.toMillis?.() ?? null;
      const lastActiveMs = data.lastActiveAt?.toMillis?.() ?? 0;
      if (createdMs !== null && createdMs <= loyalCutoff && lastActiveMs >= activityCutoff) {
        awardPromises.push(awardTitle(uid, "loyal_1year"));
      }
      // 🏛️ veteran_2year (가입 2년+)
      if (createdMs !== null && createdMs <= veteranCutoff) {
        awardPromises.push(awardTitle(uid, "veteran_2year"));
      }

      // ✍️ writer_diligent streak reset — 어제도 글 없었으면 연속 끊김
      const last = data.lastPostDate || null;
      const prev = data.consecutivePostDays || 0;
      if (prev > 0 && last !== today && last !== yesterday) {
        streakResetBatch.update(db.collection("users").doc(uid), {
          consecutivePostDays: 0,
        });
        streakResetCount++;
        // Firestore 배치 한도(500) 초과 방지는 write 수가 소수일 것으로 예상되지만 안전하게 쪼개는 건 Stage 3 과제
      }
    }

    // ─── Step 4: award 호출 일괄 실행 (awardTitle 내부에서 already_has skip) ───
    console.log(`[dailyTitleRollup] award 후보 ${awardPromises.length}건`);
    // 병렬도 제한 없이 처리 — awardTitle은 트랜잭션 기반으로 자체 conflict 회피
    const awardResults = await Promise.allSettled(awardPromises);
    const awarded = awardResults.filter((r) => r.status === "fulfilled" && r.value?.awarded).length;
    const rejected = awardResults.filter((r) => r.status === "rejected").length;

    // ─── Step 5: streak reset batch commit ───
    if (streakResetCount > 0) {
      await streakResetBatch.commit();
    }

    const elapsedMs = Date.now() - startedAt;
    console.log(
      `[dailyTitleRollup] 완료 — award 신규 ${awarded}건 / rejected ${rejected}건 / streak reset ${streakResetCount}명 / ${elapsedMs}ms`,
    );

    return null;
  },
);
