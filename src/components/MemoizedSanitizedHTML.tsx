// src/components/MemoizedSanitizedHTML.tsx — sanitizeHtml 결과 캐시용 공통 컴포넌트
// ⚡ 2026-05-13 Perf Phase E-light
//   목적: dangerouslySetInnerHTML 호출부에서 html 미변경 시 DOMPurify 재실행 차단.
//   React.memo + useMemo([html])로 부모 re-render와 무관하게 sanitize 1회만.
//   사용처: CommunityView·CommunityPostDetail 등 카드 전체 분리가 부담스러운 영역.
//   카드 분리를 한 곳(PostCardItem·CommunityFeedCard)은 카드 내부 useMemo로 자체 캐시.
import React, { useMemo } from 'react';
import { sanitizeHtml } from '../sanitize';

interface Props {
  html: string;
  className?: string;
}

const MemoizedSanitizedHTMLInner = ({ html, className }: Props) => {
  const sanitized = useMemo(() => sanitizeHtml(html), [html]);
  return <div className={className} dangerouslySetInnerHTML={{ __html: sanitized }} />;
};

const MemoizedSanitizedHTML = React.memo(MemoizedSanitizedHTMLInner);

export default MemoizedSanitizedHTML;
