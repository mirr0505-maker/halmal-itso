// functions/contentLength.js — 신포도와 여우 contentTextLength 서버 재계산
// 🚀 Firestore onCreate 트리거 — 클라이언트가 보낸 contentTextLength를 신뢰하지 않고 서버에서 재계산
// Why: 공격자가 contentTextLength를 조작하여 100자 제한을 우회하는 것 방지
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { getFirestore } = require("firebase-admin/firestore");

const db = getFirestore();

exports.recalcContentTextLength = onDocumentCreated(
  { document: "posts/{postId}", region: "asia-northeast3" },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    // 신포도와 여우 카테고리만 재계산
    if (data.category !== "신포도와 여우") return;

    // HTML 태그 제거 + 공백 제거 후 순수 글자 수
    const content = data.content || "";
    const plainText = content.replace(/<[^>]+>/g, "").replace(/\s/g, "");
    const serverLength = plainText.length;

    // 클라이언트가 보낸 값과 다르면 서버 값으로 교정
    if (data.contentTextLength !== serverLength) {
      await db.collection("posts").doc(event.params.postId).update({
        contentTextLength: serverLength,
      });
      console.log(`[contentLength] ${event.params.postId}: 클라이언트 ${data.contentTextLength} → 서버 ${serverLength}`);
    }
  }
);
