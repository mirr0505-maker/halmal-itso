// src/components/PostCardItem.tsx — AnyTalkList 그리드 카드 1개
// ⚡ 2026-05-13 Perf Phase E-light: 카드 컴포넌트 분리 + React.memo + sanitize useMemo 캐시
//   목적: AnyTalkList의 onSnapshot 발화 시 모든 카드 re-render + DOMParser × N 폭발 차단.
//   변경 키 외(post.likes/commentCount/thanksballTotal/likedBy 등)는 카드 갱신 skip.
//   sanitizeHtml/extractFirstImage/hasText 결과는 post.content 변경 전까지 캐시.
import React, { useMemo } from 'react';
import type { Post, UserData } from '../types';
import { sanitizeHtml, extractText, extractFirstImage } from '../sanitize';
import { formatKoreanNumber, getReputationLabel, getReputation, getCategoryDisplayName, calculateLevel } from '../utils';

interface Props {
  post: Post;
  isNewTab: boolean;
  commentCount: number;
  isLikedByMe: boolean;
  authorData: UserData | undefined;
  realFollowers: number;
  goldHeartCount: number;
  isCopied: boolean;
  onTopicClick: (post: Post) => void;
  onLikeClick?: (e: React.MouseEvent, postId: string) => void;
  onAuthorClick?: (author: string) => void;
  onCopyUrl: (e: React.MouseEvent, postId: string) => void;
}

const DARK_BG = new Set(['#1e293b', '#7c3aed']);

function formatRelativeTime(timestamp: { seconds: number } | null | undefined): string {
  if (!timestamp) return '방금 전';
  const now = new Date();
  const createdAt = new Date(timestamp.seconds * 1000);
  const diffInHours = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60));
  if (diffInHours < 1) return '방금 전';
  if (diffInHours < 24) return `${diffInHours}시간 전`;
  return createdAt.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' });
}

const PostCardItemInner = ({
  post, isNewTab, commentCount, isLikedByMe, authorData, realFollowers, goldHeartCount, isCopied,
  onTopicClick, onLikeClick, onAuthorClick, onCopyUrl,
}: Props) => {
  // ⚡ Phase E-light: DOMParser 결과 캐시 — content 변경 전까지 재실행 안 함
  //   잉크병 유료 회차는 content가 빈 문자열이라 previewContent를 본문으로 사용.
  const cardContent = useMemo(() => (
    (post.category === 'magic_inkwell' && post.isPaid && !extractText(post.content).trim() && post.previewContent)
      ? `<p>${post.previewContent}</p>`
      : post.content
  ), [post.category, post.isPaid, post.content, post.previewContent]);
  const hasContent = useMemo(() => !!extractText(cardContent).trim(), [cardContent]);
  const displayImage = useMemo(() => post.imageUrl || extractFirstImage(post.content), [post.imageUrl, post.content]);
  const sanitizedContent = useMemo(() => sanitizeHtml(cardContent), [cardContent]);
  const relativeTime = useMemo(() => formatRelativeTime(post.createdAt), [post.createdAt]);

  const promoLevel = Math.min(post.likes || 0, 3);
  const displayLevel = calculateLevel(authorData?.exp || 0);
  const displayLikes = authorData ? (authorData.likes || 0) : (post.authorInfo?.totalLikes || 0);
  const isDark = !!(post.bgColor && DARK_BG.has(post.bgColor));

  return (
    <div
      onClick={() => onTopicClick(post)}
      /* ✨ 2026-05-15 스크롤 jank fix: transition-all → transition-shadow (color만 transition).
         카드 200개에 transition-all + hover:shadow-xl 조합이 GPU painting 폭주 유발. */
      className="border border-slate-300 rounded-xl px-3.5 py-2 cursor-pointer hover:border-blue-400 hover:shadow-lg transition-shadow group flex flex-col shadow-sm"
      style={{ backgroundColor: post.bgColor || '#ffffff' }}
    >
      {/* 1. 최상단: 제목 및 시간/프로모션 */}
      <div className="flex justify-between items-start mb-1 shrink-0">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className={`text-[9px] font-black uppercase tracking-tighter ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>{relativeTime}</span>
          <h3 className={`text-[15px] font-[1000] line-clamp-2 leading-tight tracking-tight transition-colors ${isDark ? 'text-white group-hover:text-blue-300' : 'text-slate-900 group-hover:text-blue-600'}`}>
            {post.title}
          </h3>
        </div>
        {isNewTab ? (
          <div className="flex gap-0.5 shrink-0 ml-2 pt-1">
            {[1, 2, 3].map((idx) => (
              <svg
                key={idx}
                className={`w-3 h-3 transition-colors ${idx <= promoLevel ? 'text-rose-400 fill-current' : 'text-slate-100 fill-none'}`}
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="3"
              >
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
            ))}
          </div>
        ) : goldHeartCount > 0 && (
          <div className="flex items-center gap-0.5 shrink-0 ml-2 pt-1">
            <svg className="w-3.5 h-3.5 text-amber-400 fill-current" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            <span className="text-[9px] font-[1000] text-amber-400">{goldHeartCount}</span>
          </div>
        )}
      </div>

      {/* 2. 중간: 본문 — HTML 그대로 렌더링, 이미지는 숨김 */}
      {hasContent && (
        <div
          className={`overflow-hidden mb-1 text-[13px] leading-relaxed font-medium [&_img]:hidden [&_p]:mb-1 [&_p:last-child]:mb-0 [&_strong]:font-bold [&_em]:italic [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_h1]:text-[14px] [&_h1]:font-bold [&_h2]:text-[13px] [&_h2]:font-bold [&_h3]:text-[13px] [&_h3]:font-semibold ${displayImage ? 'line-clamp-3' : 'line-clamp-6'} ${isDark ? 'text-slate-500' : 'text-slate-500'}`}
          dangerouslySetInnerHTML={{ __html: sanitizedContent }}
        />
      )}

      {/* 3. 이미지 — 있는 경우만 노출 */}
      {displayImage && (
        <div className="w-full aspect-video rounded-lg overflow-hidden shrink-0 bg-slate-50 border border-slate-300 mb-1">
          <img src={displayImage} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        </div>
      )}

      {/* 4. 최하단: 카테고리 & 아바타/유저정보 */}
      <div className={`pt-1 border-t mt-auto flex flex-col gap-0.5 shrink-0 ${isDark ? 'border-slate-600' : 'border-slate-100'}`}>
        <div className="flex items-center gap-1.5">
          <span className="text-[8px] font-[1000] text-blue-500 bg-blue-50 px-2 py-0.5 rounded-md uppercase tracking-widest border border-blue-100/30">
            {getCategoryDisplayName(post.category)}
          </span>
          {post.category === '솔로몬의 재판' && post.debatePosition === 'pro'     && <span className="text-[8px] font-[1000] text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">👍 동의</span>}
          {post.category === '솔로몬의 재판' && post.debatePosition === 'con'     && <span className="text-[8px] font-[1000] text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">👎 비동의</span>}
          {post.category === '솔로몬의 재판' && post.debatePosition === 'neutral' && <span className="text-[8px] font-[1000] text-slate-500 bg-slate-50 border border-slate-300 px-2 py-0.5 rounded-md">🤝 중립</span>}
          {post.verdict === 'fact'      && <span className="text-[8px] font-[1000] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">✅ 사실 확인</span>}
          {post.verdict === 'false'     && <span className="text-[8px] font-[1000] text-rose-600    bg-rose-50    border border-rose-200    px-2 py-0.5 rounded-md">❌ 허위 판명</span>}
          {post.verdict === 'uncertain' && <span className="text-[8px] font-[1000] text-slate-500   bg-slate-50   border border-slate-300   px-2 py-0.5 rounded-md">🔍 미정.보류</span>}
          {post.newsType === 'breaking' && <span className="text-[8px] font-[1000] text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-md animate-pulse">🚨 속보</span>}
          {post.newsType === 'news'     && <span className="text-[8px] font-[1000] text-sky-700  bg-sky-50  border border-sky-200  px-2 py-0.5 rounded-md">📰 뉴스</span>}
          {post.location && <span className="text-[8px] font-[1000] text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">📍 {post.location.includes(':') ? post.location.split(':')[1] : post.location}</span>}
          {(post.infoFields || []).map(field => (
            <span key={field} className="text-[8px] font-[1000] text-yellow-700 bg-yellow-50 border border-yellow-200 px-2 py-0.5 rounded-md">🪙 {field}</span>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <div
            className="flex items-center gap-1.5 min-w-0 cursor-pointer hover:opacity-70 transition-opacity"
            onClick={(e) => { e.stopPropagation(); onAuthorClick?.(post.author); }}
          >
            <div className="w-6 h-6 rounded-full bg-slate-50 overflow-hidden shrink-0 border border-white shadow-sm ring-1 ring-slate-100">
              <img src={authorData?.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${post.author}`} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className={`text-[11px] font-[1000] truncate leading-none mb-0.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>{post.author}</span>
              <span className={`text-[9px] font-bold truncate tracking-tight ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                Lv {displayLevel} · {getReputationLabel(authorData ? getReputation(authorData) : displayLikes)} · 깐부수 {formatKoreanNumber(realFollowers)}
              </span>
            </div>
          </div>

          <div className={`flex items-center gap-2 text-[10px] font-black shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
              {formatKoreanNumber(commentCount)}
            </span>
            {(post.thanksballTotal || 0) > 0 && (
              <span className="flex items-center gap-0.5 text-amber-400">
                <span className="text-[13px]">⚾</span> {post.thanksballTotal}
              </span>
            )}
            <span
              onClick={(e) => { e.stopPropagation(); onLikeClick?.(e, post.id); }}
              className={`flex items-center gap-1 cursor-pointer transition-colors ${isLikedByMe ? 'text-rose-500' : 'hover:text-rose-400'}`}
            >
              <svg className={`w-3.5 h-3.5 ${isLikedByMe ? 'fill-current' : 'fill-none'}`} stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
              {formatKoreanNumber(post.likes || 0)}
            </span>
            <button
              onClick={(e) => onCopyUrl(e, post.id)}
              className={`flex items-center gap-0.5 transition-all ${isCopied ? 'opacity-100 text-emerald-500' : 'opacity-0 group-hover:opacity-100 text-slate-500 hover:text-blue-400'}`}
              title="글 링크 복사"
            >
              {isCopied
                ? <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"/></svg>
                : <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ⚡ Phase E-light React.memo 커스텀 비교:
//   - post 객체는 onSnapshot이 변경된 문서만 새 ref 발급 → 같은 ref면 카드 갱신 skip
//   - ✨ 2026-05-15: authorData는 useFirebaseListeners가 매 onSnapshot마다 전체 새 객체로 교체 → ref 비교 실패.
//     필드별 비교로 변경 (exp/likes/avatarUrl/totalShares/ballReceived만 카드 표시에 영향).
//     누군가 좋아요 1건 누를 때마다 allUsers 전체 ref 바뀌어도 본 카드의 작성자 필드 미변경이면 re-render skip.
const PostCardItem = React.memo(PostCardItemInner, (prev, next) => {
  const pa = prev.authorData, na = next.authorData;
  const authorEqual = pa === na || (
    pa?.exp === na?.exp &&
    pa?.likes === na?.likes &&
    pa?.avatarUrl === na?.avatarUrl &&
    pa?.totalShares === na?.totalShares &&
    pa?.ballReceived === na?.ballReceived
  );
  return (
    prev.post === next.post &&
    prev.isNewTab === next.isNewTab &&
    prev.commentCount === next.commentCount &&
    prev.isLikedByMe === next.isLikedByMe &&
    authorEqual &&
    prev.realFollowers === next.realFollowers &&
    prev.goldHeartCount === next.goldHeartCount &&
    prev.isCopied === next.isCopied &&
    prev.onTopicClick === next.onTopicClick &&
    prev.onLikeClick === next.onLikeClick &&
    prev.onAuthorClick === next.onAuthorClick &&
    prev.onCopyUrl === next.onCopyUrl
  );
});

export default PostCardItem;
