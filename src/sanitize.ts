// src/sanitize.ts — HTML 정화 유틸리티
// Why: dangerouslySetInnerHTML에 사용자 입력 HTML을 직접 전달하면 XSS 공격 가능
import DOMPurify from 'dompurify';

/** HTML 문자열을 정화하여 악성 스크립트 제거 후 반환 */
export const sanitizeHtml = (dirty: string): string =>
  DOMPurify.sanitize(dirty);

/** HTML 문자열에서 순수 텍스트만 추출 (안전한 DOMParser 사용) */
export const extractText = (html: string): string => {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || '';
};

/** HTML 문자열에서 첫 번째 이미지 URL 추출 (안전한 DOMParser 사용) */
export const extractFirstImage = (html: string): string | null => {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const img = doc.body.querySelector('img');
  return img ? img.getAttribute('src') : null;
};
