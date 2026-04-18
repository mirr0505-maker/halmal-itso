// src/utils/share.ts — 글 공유 공용 헬퍼
// 🚀 Web Share API(모바일 네이티브 시트) 우선 + fallback 클립보드 복사
// 🚀 성공 시 posts.shareCount + users.totalShares +1 동시 처리
import { doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../firebase';
import type { GiantTree } from '../types';
import { OG_IMAGE_ALLOWED_HOSTS } from '../constants';
import { extractFirstBodyImage } from './og';

// 🚀 카카오톡 공유 SDK 타입 선언 (방어적 — GiantTreeDetail과 별개로 독립 안전)
declare global { interface Window { Kakao: any; } }

export interface SharePostParams {
  postId: string;            // 공유 대상 문서 ID (shareToken = postId.split('_').slice(0, 2))
  authorId?: string;         // 작성자 UID (있으면 totalShares +1)
  title?: string;            // Web Share 제목 (예: "작품명 · N화 회차제목")
  text?: string;             // Web Share 부가 설명
}

export interface SharePostResult {
  // 'shared'  — Web Share API 성공 (네이티브 시트)
  // 'copied'  — 클립보드 복사 성공 (fallback)
  // 'aborted' — 사용자가 공유를 취소 (카운트 증가 안 함)
  // 'failed'  — 에러 (카운트 증가 안 함)
  status: 'shared' | 'copied' | 'aborted' | 'failed';
}

/**
 * 글 공유 실행 — 공통 로직
 * - /p/{shareToken} 형식 URL 생성
 * - Web Share API 지원 시 네이티브 공유 시트
 * - 미지원 또는 실패 시 클립보드 복사
 * - 성공 시 shareCount/totalShares 카운트 증가
 *
 * 사용 예:
 * ```
 * const result = await sharePost({ postId: post.id, authorId: post.author_id, title: post.title });
 * if (result.status === 'copied') {
 *   setCopied(true); setTimeout(() => setCopied(false), 2000);
 * }
 * ```
 */
export async function sharePost(params: SharePostParams): Promise<SharePostResult> {
  const { postId, authorId, title, text } = params;
  const shareToken = postId.split('_').slice(0, 2).join('_'); // "topic_{timestamp}"
  const shareUrl = `${window.location.origin}/p/${shareToken}`;

  // 공유수 카운트 증가 (성공 시에만 호출)
  const bumpShareCount = () => {
    updateDoc(doc(db, 'posts', postId), { shareCount: increment(1) }).catch(() => {});
    if (authorId) {
      updateDoc(doc(db, 'users', authorId), { totalShares: increment(1) }).catch(() => {});
    }
  };

  // 1. Web Share API 시도 (모바일 우선)
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({
        title: title || '글러브',
        text: text || '',
        url: shareUrl,
      });
      bumpShareCount();
      return { status: 'shared' };
    } catch (err) {
      const e = err as Error;
      // 사용자가 공유 시트 취소 — 에러 아님
      if (e.name === 'AbortError') return { status: 'aborted' };
      // 그 외 에러는 fallback으로
      console.warn('[sharePost] Web Share 실패 → 클립보드 폴백:', err);
    }
  }

  // 2. Fallback — 클립보드 복사
  try {
    await navigator.clipboard.writeText(shareUrl);
    bumpShareCount();
    return { status: 'copied' };
  } catch (err) {
    console.warn('[sharePost] 클립보드 복사 실패:', err);
    return { status: 'failed' };
  }
}

// ════════════════════════════════════════════════════════════
// 🌳 거대 나무 전용 카카오 공유 (shareGiantTree)
// ════════════════════════════════════════════════════════════
// Why: posts의 sharePost()는 shareToken·shareCount·totalShares 로직을 강제하지만
//      tree는 전체 ID 사용 + shareCount 개념 없음. Web Share API 대신 Kakao SDK 전용.
//      content.imageUrl은 Kakao SDK가 OG를 크롤링하지 않으므로 직접 주입 —
//      서버 ogRenderer와 동일 정책(본문 첫 <img> → 로고 폴백)으로 SNS 카드 일관성.

const APP_URL = 'https://halmal-itso.web.app';
const DEFAULT_LOGO = `${APP_URL}/og-image.jpg`;

// HTML 태그 제거 후 limit 자까지 자른 plain text (Kakao card description용)
const stripHtml = (html: string, limit: number): string => {
  const raw = (html || '').replace(/<[^>]+>/g, '').trim();
  return raw.slice(0, limit) + (raw.length > limit ? '...' : '');
};

/**
 * 거대 나무 카카오 공유 — /p/tree_{id} 경유로 ogRenderer의 동적 OG 활용.
 * Kakao JS SDK는 OG 미사용 → content 필드를 직접 채워 카드 렌더링.
 * 서버 ogRenderer와 동일 정책(🌳 프리픽스, 본문 <img> 추출)으로 전 SNS 일관성 확보.
 *
 * @param tree GiantTree 문서 (id, title, content 필요)
 * @param nodeId 부모 노드 ID (루트 공유면 null)
 */
export function shareGiantTree(tree: GiantTree, nodeId: string | null): void {
  if (typeof window === 'undefined' || !window.Kakao?.isInitialized?.()) return;
  const base = `${APP_URL}/p/${tree.id}`;
  const url = nodeId ? `${base}?node=${encodeURIComponent(nodeId)}` : base;
  const extracted = extractFirstBodyImage(tree.content || '', [...OG_IMAGE_ALLOWED_HOSTS]);
  const imageUrl = extracted || DEFAULT_LOGO;
  window.Kakao.Share.sendDefault({
    objectType: 'feed',
    content: {
      title: `🌳 ${tree.title || '거대 나무'}`,
      description: stripHtml(tree.content || '', 80),
      imageUrl,
      link: { mobileWebUrl: url, webUrl: url },
    },
    buttons: [{ title: '전파 참여하기', link: { mobileWebUrl: url, webUrl: url } }],
  });
}
