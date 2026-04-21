// functions/toggleKanbu.js — 깐부 토글 (서버 전용, 대칭 ±2 EXP)
// 🛡️ Anti-Abuse Commit 7-B (v2, 대칭형):
//   맺기 +2 / 해제 -2 — 루프 어뷰징 원천 차단 (단순 맺기→해제 반복 시 exp 변동 0)
//   서버측 5초 쿨다운(lastFriendToggleAt) — 클라이언트 setTimeout 우회 방지
//   Admin SDK 경유 → Firestore Rules exp increase-only 가드 우회(정상)
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { calculateLevel } = require("./utils/levelSync");

const db = getFirestore();
const COOLDOWN_MS = 5000;

exports.toggleKanbu = onCall(
  { region: "asia-northeast3" },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
    const uid = request.auth.uid;
    const target = typeof request.data?.targetNickname === "string"
      ? request.data.targetNickname.trim()
      : "";
    if (!target) throw new HttpsError("invalid-argument", "targetNickname 누락");

    const userRef = db.collection("users").doc(uid);

    return db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      if (!snap.exists) throw new HttpsError("not-found", "사용자 문서 없음");
      const u = snap.data();

      if (u.nickname === target) {
        throw new HttpsError("invalid-argument", "본인은 깐부 불가");
      }

      // 🛡️ 서버측 5초 쿨다운 — 클라 바이패스 차단
      const lastAt = u.lastFriendToggleAt?.toMillis?.() || 0;
      if (Date.now() - lastAt < COOLDOWN_MS) {
        throw new HttpsError("resource-exhausted", "5초 후 다시 시도하세요.");
      }

      const friends = Array.isArray(u.friendList) ? u.friendList : [];
      const isFriend = friends.includes(target);
      const nextFriends = isFriend
        ? friends.filter((n) => n !== target)
        : [...friends, target];

      // 🛡️ 대칭 ±2 — 맺기 +2, 해제 -2 (하한 0)
      const expDelta = isFriend ? -2 : 2;
      const nextExp = Math.max(0, (u.exp || 0) + expDelta);

      // 🚀 옵션 B — exp·level 동시 쓰기 (LEVEL_V2.md §5)
      tx.update(userRef, {
        friendList: nextFriends,
        exp: nextExp,
        level: calculateLevel(nextExp),
        lastFriendToggleAt: FieldValue.serverTimestamp(),
      });

      return {
        ok: true,
        isFriend: !isFriend,
        expDelta,
        newExp: nextExp,
      };
    });
  }
);
