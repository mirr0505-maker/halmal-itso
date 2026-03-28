require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

// ⚠️ 보안 경고: API 키를 코드에 직접 하드코딩하지 마세요!
// 환경 변수(Environment Variable)를 통해 API 키를 안전하게 로드합니다.
const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  console.error("\n❌ 오류: GEMINI_API_KEY 환경 변수가 설정되지 않았습니다.");
  console.error("실행 방법: GEMINI_API_KEY=\"내_API_키\" node gemini.cjs \"질문\"");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(API_KEY);

// 모델 설정
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

async function run() {
  const prompt = process.argv.slice(2).join(" ");
  if (!prompt) {
    console.log("\n💡 사용법: node gemini.cjs \"질문 내용\"");
    return;
  }

  console.log("🤔 Gemini가 'halmal-itso' 프로젝트를 위해 생각 중입니다...");

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    console.log("\n========================================");
    console.log(response.text());
    console.log("========================================\n");
  } catch (error) {
    console.error("\n❌ 오류 발생:", error.message);
  }
}

run();