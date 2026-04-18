// src/utils/og.ts — OG 이미지 추출 클라이언트 헬퍼
// ⚠️ 이 파일의 extractFirstBodyImage 로직은 functions/index.js의 ogRenderer
//    본문 <img> 추출 로직(tree·posts 양 분기에서 공용)과 완전히 동일하게 유지할 것.
//    서버는 SNS 봇 크롤링 시 og:image로, 클라는 Kakao Share content.imageUrl로 사용 —
//    두 경로가 같은 결과를 내야 카카오톡·페이스북·X·디스코드 카드가 일치.
//    변경 시 양쪽 모두 수정. 서버 위치: functions/index.js ogRenderer 내부.

/**
 * HTML 본문에서 첫 번째 <img src="https://..."> URL을 추출하고 화이트리스트로 검증.
 *
 * @param htmlContent Tiptap 에디터 HTML 본문 문자열 (null/undefined 안전)
 * @param allowedHosts 허용 호스트명 배열 (src/constants.ts의 OG_IMAGE_ALLOWED_HOSTS)
 * @returns https URL (화이트리스트 통과) 또는 null (없거나 차단)
 */
export function extractFirstBodyImage(
  htmlContent: string,
  allowedHosts: string[],
): string | null {
  if (typeof htmlContent !== 'string' || htmlContent.length === 0) return null;
  const match = htmlContent.match(/<img[^>]+src=["'](https:\/\/[^"']+)["']/i);
  if (!match) return null;
  const url = match[1];
  if (!isHttps(url)) return null;
  try {
    const u = new URL(url);
    if (allowedHosts.includes(u.hostname)) return url;
    return null;
  } catch {
    return null;
  }
}

function isHttps(v: unknown): v is string {
  return typeof v === 'string' && v.startsWith('https://') && v.length > 10;
}
