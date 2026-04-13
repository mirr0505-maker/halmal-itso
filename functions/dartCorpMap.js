// functions/dartCorpMap.js — 🤖 DART 종목코드 → 고유번호 매핑
// 🚀 syncDartCorpMap: DART corpCode.xml 다운로드 → Firestore dart_corp_map 컬렉션에 저장
// 🚀 lookupCorpCode: 종목코드로 DART 고유번호 조회 (onCall)
// 스케줄: 월 1회 (신규 상장 대응) + 수동 트리거 가능
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const { XMLParser } = require("fast-xml-parser");
const AdmZip = require("adm-zip");

const db = getFirestore();

// ════════════════════════════════════════════════════════════
// 🚀 syncDartCorpMap — DART corpCode.xml 다운로드 → Firestore 저장
// ════════════════════════════════════════════════════════════
// DART API: https://opendart.fss.or.kr/api/corpCode.xml?crtfc_key=KEY
// 응답: ZIP 파일 → 내부 CORPCODE.xml → 전체 기업 목록
// 저장: dart_corp_map/{stock_code} = { corpCode, corpName, stockCode, modifyDate }
exports.syncDartCorpMap = onSchedule(
  { schedule: "1 of month 03:00", region: "asia-northeast3", timeoutSeconds: 300 },
  async () => {
    const DART_API_KEY = process.env.DART_API_KEY;
    if (!DART_API_KEY || DART_API_KEY.includes("넣으세요")) {
      console.warn("[DART] API 키 미설정 — 스킵");
      return;
    }

    console.log("[DART] corpCode.xml 다운로드 시작...");

    try {
      // 1. ZIP 다운로드
      const response = await fetch(
        `https://opendart.fss.or.kr/api/corpCode.xml?crtfc_key=${DART_API_KEY}`,
        { signal: AbortSignal.timeout(30000) }
      );
      if (!response.ok) {
        console.error(`[DART] 다운로드 실패: ${response.status}`);
        return;
      }

      const buffer = Buffer.from(await response.arrayBuffer());

      // 2. ZIP 해제 → XML 파싱
      const zip = new AdmZip(buffer);
      const entries = zip.getEntries();
      const xmlEntry = entries.find(e => e.entryName.toLowerCase().endsWith(".xml"));
      if (!xmlEntry) {
        console.error("[DART] ZIP 내 XML 파일 없음");
        return;
      }

      const xmlData = xmlEntry.getData().toString("utf-8");
      const parser = new XMLParser({ ignoreAttributes: false });
      const parsed = parser.parse(xmlData);

      // CORPCODE.xml 구조: <result><list><corp_code>...</corp_code><corp_name>...</corp_name><stock_code>...</stock_code><modify_date>...</modify_date></list>...</result>
      const items = parsed?.result?.list;
      if (!items) {
        console.error("[DART] XML 파싱 실패 — list 없음");
        return;
      }
      const corpList = Array.isArray(items) ? items : [items];

      // 3. 종목코드가 있는 상장 기업만 필터 + Firestore 저장
      // 비상장(stock_code 빈값)은 제외 — 상장 기업만 매핑
      let savedCount = 0;
      const BATCH_SIZE = 400; // Firestore batch 최대 500, 여유 두고 400
      let batch = db.batch();
      let batchCount = 0;

      for (const corp of corpList) {
        const stockCode = String(corp.stock_code || "").trim();
        if (!stockCode) continue; // 비상장 제외

        const corpCode = String(corp.corp_code || "").trim();
        const corpName = String(corp.corp_name || "").trim();
        if (!corpCode || !corpName) continue;

        const docRef = db.collection("dart_corp_map").doc(stockCode);
        batch.set(docRef, {
          corpCode,
          corpName,
          stockCode,
          modifyDate: String(corp.modify_date || ""),
          syncedAt: Timestamp.now(),
        });

        savedCount++;
        batchCount++;

        if (batchCount >= BATCH_SIZE) {
          await batch.commit();
          batch = db.batch();
          batchCount = 0;
        }
      }

      // 남은 batch 커밋
      if (batchCount > 0) {
        await batch.commit();
      }

      console.log(`[DART] corpCode 동기화 완료 — 상장 기업 ${savedCount}건 저장`);
    } catch (err) {
      console.error("[DART] syncDartCorpMap 실패:", err.message);
    }
  }
);

// ════════════════════════════════════════════════════════════
// 🚀 triggerSyncDartCorpMap — 수동 동기화 트리거 (onCall, 테스트/초기 세팅용)
// ════════════════════════════════════════════════════════════
exports.triggerSyncDartCorpMap = onCall(
  { region: "asia-northeast3", timeoutSeconds: 300 },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");

    const DART_API_KEY = process.env.DART_API_KEY;
    if (!DART_API_KEY || DART_API_KEY.includes("넣으세요")) {
      throw new HttpsError("failed-precondition", "DART API 키가 설정되지 않았습니다.");
    }

    console.log("[DART] 수동 동기화 시작...");

    // ZIP 다운로드 → XML 파싱 → Firestore 저장 (syncDartCorpMap과 동일 로직)
    const response = await fetch(
      `https://opendart.fss.or.kr/api/corpCode.xml?crtfc_key=${DART_API_KEY}`,
      { signal: AbortSignal.timeout(30000) }
    );
    if (!response.ok) throw new HttpsError("internal", `DART 다운로드 실패: ${response.status}`);

    const buffer = Buffer.from(await response.arrayBuffer());
    const zip = new AdmZip(buffer);
    const entries = zip.getEntries();
    const xmlEntry = entries.find(e => e.entryName.toLowerCase().endsWith(".xml"));
    if (!xmlEntry) throw new HttpsError("internal", "ZIP 내 XML 파일 없음");

    const xmlData = xmlEntry.getData().toString("utf-8");
    const parser = new XMLParser({ ignoreAttributes: false });
    const parsed = parser.parse(xmlData);
    const items = parsed?.result?.list;
    if (!items) throw new HttpsError("internal", "XML 파싱 실패");
    const corpList = Array.isArray(items) ? items : [items];

    let savedCount = 0;
    const BATCH_SIZE = 400;
    let batch = db.batch();
    let batchCount = 0;

    for (const corp of corpList) {
      const stockCode = String(corp.stock_code || "").trim();
      if (!stockCode) continue;
      const corpCode = String(corp.corp_code || "").trim();
      const corpName = String(corp.corp_name || "").trim();
      if (!corpCode || !corpName) continue;

      batch.set(db.collection("dart_corp_map").doc(stockCode), {
        corpCode, corpName, stockCode,
        modifyDate: String(corp.modify_date || ""),
        syncedAt: Timestamp.now(),
      });
      savedCount++;
      batchCount++;
      if (batchCount >= BATCH_SIZE) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
      }
    }
    if (batchCount > 0) await batch.commit();

    console.log(`[DART] 수동 동기화 완료 — ${savedCount}건`);
    return { success: true, count: savedCount };
  }
);

// ════════════════════════════════════════════════════════════
// 🚀 lookupCorpCode — 종목코드 → DART 고유번호 조회 (onCall)
// ════════════════════════════════════════════════════════════
// 사용자가 종목코드 입력 → UI에서 이 함수 호출 → corpCode + corpName 반환
exports.lookupCorpCode = onCall(
  { region: "asia-northeast3" },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
    const { stockCode } = request.data || {};

    if (typeof stockCode !== "string" || !stockCode.trim()) {
      throw new HttpsError("invalid-argument", "종목코드가 필요합니다.");
    }

    const docRef = db.collection("dart_corp_map").doc(stockCode.trim());
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      throw new HttpsError("not-found", `종목코드 ${stockCode}에 해당하는 기업을 찾을 수 없습니다. 매핑 동기화가 필요할 수 있습니다.`);
    }

    const data = docSnap.data();
    return {
      corpCode: data.corpCode,
      corpName: data.corpName,
      stockCode: data.stockCode,
    };
  }
);
