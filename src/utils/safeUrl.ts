// src/utils/safeUrl.ts — 🔒 P1 2026-07-02: 사용자 입력 URL 안전 처리 공용 유틸
// Why: post.linkUrl 등 사용자 입력 URL을 href/window.open에 스킴 검증 없이 넣으면
//      `javascript:`/`data:` 스킴으로 저장형 XSS가 발생. DOMPurify는 content(HTML)만 방어하고 linkUrl은 우회됨.
//      광고(AdBanner)의 ensureProtocol을 일반화해 글 링크에도 동일 정책 적용.

// http/https만 허용. 스킴이 없으면 https:// 부착. 위험 스킴(javascript:, data:, vbscript: 등)은 차단.
export function safeExternalUrl(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // 스킴이 명시된 경우 http/https만 통과
  const schemeMatch = trimmed.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
  if (schemeMatch) {
    const scheme = schemeMatch[1].toLowerCase();
    if (scheme !== 'http' && scheme !== 'https') return null; // javascript:, data:, vbscript: 등 차단
    try {
      // URL 파싱 가능 여부 최종 검증
      // eslint-disable-next-line no-new
      new URL(trimmed);
      return trimmed;
    } catch {
      return null;
    }
  }

  // 스킴 미지정 → https:// 부착 후 검증 (예: "geulove.com/x" → "https://geulove.com/x")
  try {
    const withScheme = `https://${trimmed}`;
    new URL(withScheme);
    return withScheme;
  } catch {
    return null;
  }
}

// 렌더링용 hostname 추출 (실패 시 원본 반환, throw 금지 — 리스트 렌더 크래시 방지)
export function safeHostname(raw: string | null | undefined): string {
  const safe = safeExternalUrl(raw);
  if (!safe) return '';
  try {
    return new URL(safe).hostname;
  } catch {
    return '';
  }
}
