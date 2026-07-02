// src/components/CommunityFeedCard.tsx — CommunityFeed의 1개 카드 (소곤소곤 통합 피드)
// ⚡ 2026-05-13 Perf Phase E-light: 카드 분리 + React.memo + sanitize useMemo
// ✨ 2026-05-15 UI/UX 풀세트 Phase 2: 봇 OG 카드 스타일 + 아바타 40px + 좋아요 작동 + 공유 버튼
//   봇 글: 좌측 botSource별 그라데이션 아이콘 박스 + 우측 출처·헤드라인·description
//   일반 글: 아바타 24→40px + 본문 line-clamp 2→3 + 인게이지먼트 시그널 강화
import React, { useMemo } from 'react';
import type { CommunityPost, UserData } from '../types';
import { sanitizeHtml } from '../sanitize';
import { calculateLevel, getReputationLabel, getReputation, formatKoreanNumber } from '../utils';

interface Props {
  post: CommunityPost;
  authorData: UserData | undefined;
  followerCount: number;
  isSelf: boolean;
  isLikedByMe: boolean;
  formattedTime: string;
  onClick: (post: CommunityPost) => void;
  onThanksballClick: (postId: string, author: string) => void;
  onLikeClick: (post: CommunityPost) => void;
  onShareClick: (post: CommunityPost) => void;
}

// 봇 출처별 시각 차별화 (좌측 아이콘 박스 그라데이션)
const BOT_SOURCE_META: Record<string, { emoji: string; label: string; gradient: string; textColor: string }> = {
  news:  { emoji: '📰', label: '뉴스',   gradient: 'from-sky-400 to-blue-500',       textColor: 'text-white' },
  dart:  { emoji: '📋', label: '공시',   gradient: 'from-emerald-400 to-teal-500',  textColor: 'text-white' },
  price: { emoji: '📊', label: '주가',   gradient: 'from-amber-400 to-orange-500',  textColor: 'text-white' },
};

const CommunityFeedCardInner = ({
  post, authorData, followerCount, isSelf, isLikedByMe, formattedTime,
  onClick, onThanksballClick, onLikeClick, onShareClick,
}: Props) => {
  const sanitized = useMemo(() => sanitizeHtml(post.content), [post.content]);
  const botInfo = post as CommunityPost & { isBot?: boolean; botSource?: string };
  const isBot = !!botInfo.isBot;
  const botMeta = isBot ? BOT_SOURCE_META[botInfo.botSource || ''] || BOT_SOURCE_META.news : null;

  // ✨ 봇 글은 OG 카드 스타일 (좌측 큰 아이콘 박스 + 우측 정보)
  if (isBot && botMeta) {
    return (
      <div
        onClick={() => onClick(post)}
        className="bg-white border border-slate-100 rounded-xl p-3 hover:border-blue-200 hover:shadow-md transition-all group cursor-pointer flex gap-3"
      >
        {/* 좌측: 봇 출처 아이콘 박스 (80×80) */}
        <div className={`w-20 h-20 shrink-0 rounded-lg bg-gradient-to-br ${botMeta.gradient} flex items-center justify-center text-[36px] shadow-sm`}>
          {botMeta.emoji}
        </div>

        {/* 우측: 출처·시간·헤드라인·설명·인터랙션 */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className={`text-[9px] font-[1000] px-1.5 py-0.5 rounded ${botMeta.textColor} bg-gradient-to-br ${botMeta.gradient}`}>
              🤖 {botMeta.label}
            </span>
            <span className="text-[10px] font-[1000] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full truncate">🧤 {post.communityName}</span>
            <span className="text-[10px] font-bold text-slate-400">{formattedTime}</span>
          </div>
          {post.title && (
            <h3 className="text-[14px] font-[1000] text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-2 leading-tight mb-1">
              {post.title}
            </h3>
          )}
          <div
            className="text-[12px] font-medium text-slate-500 line-clamp-2 leading-relaxed [&_img]:hidden [&_p]:mb-0 [&_a]:text-blue-500 [&_a]:underline mt-auto"
            dangerouslySetInnerHTML={{ __html: sanitized }}
          />
          {/* 인터랙션 바 */}
          <div className="flex items-center justify-end gap-2.5 text-[10px] font-black text-slate-400 mt-1.5">
            <span className="flex items-center gap-1">
              <CommentIcon /> {formatKoreanNumber(post.commentCount || 0)}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); if (!isSelf) onThanksballClick(post.id, post.author); }}
              className={`flex items-center gap-0.5 transition-colors ${!isSelf ? 'text-amber-500 hover:text-amber-600' : 'text-slate-300 cursor-default'}`}
            >
              <span className="text-[13px]">⚾</span> {(post.thanksballTotal || 0) > 0 ? post.thanksballTotal : ''}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onLikeClick(post); }}
              className={`flex items-center gap-1 transition-colors ${isLikedByMe ? 'text-rose-500' : 'text-slate-400 hover:text-rose-400'}`}
            >
              <HeartIcon filled={isLikedByMe} /> {formatKoreanNumber(post.likes || 0)}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onShareClick(post); }}
              className="flex items-center gap-0.5 text-slate-400 hover:text-blue-500 transition-colors opacity-0 group-hover:opacity-100"
              title="공유"
            >
              <ShareIcon />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ✨ 일반 글: 아바타 40px + 본문 line-clamp 3 + 인터랙션 강화
  return (
    <div
      onClick={() => onClick(post)}
      className="bg-white border border-slate-100 rounded-xl p-4 hover:border-blue-200 hover:shadow-md transition-all group cursor-pointer"
    >
      <div className="flex items-center gap-2 mb-2.5">
        <span className="text-[10px] font-[1000] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">🧤 {post.communityName}</span>
        <span className="text-[10px] font-bold text-slate-400">{formattedTime}</span>
      </div>
      {post.title && (
        <h3 className="text-[16px] font-[1000] text-slate-900 group-hover:text-blue-600 transition-colors mb-1.5 leading-snug">{post.title}</h3>
      )}
      <div
        className="text-[14px] font-medium text-slate-600 line-clamp-3 leading-relaxed [&_img]:hidden [&_p]:mb-0.5 [&_a]:text-blue-500 [&_a]:underline mb-3"
        dangerouslySetInnerHTML={{ __html: sanitized }}
      />

      {/* 하단: 아바타 40px + 작성자 + 인터랙션 */}
      <div className="flex items-center justify-between pt-2.5 border-t border-slate-50">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-10 h-10 rounded-full bg-slate-50 overflow-hidden shrink-0 border border-white shadow-sm ring-1 ring-slate-100">
            <img src={authorData?.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${post.author}`} alt="" className="w-full h-full object-cover" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[13px] font-[1000] text-slate-900 truncate leading-none mb-0.5">{post.author}</span>
            <span className="text-[10px] font-bold text-slate-400 truncate tracking-tight">
              Lv {calculateLevel(authorData?.exp || 0)} · {getReputationLabel(authorData ? getReputation(authorData) : 0)} · 깐부수 {formatKoreanNumber(followerCount)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2.5 text-[11px] font-black shrink-0 text-slate-400">
          <span className="flex items-center gap-1">
            <CommentIcon /> {formatKoreanNumber(post.commentCount || 0)}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); if (!isSelf) onThanksballClick(post.id, post.author); }}
            className={`flex items-center gap-0.5 transition-colors ${!isSelf ? 'text-amber-500 hover:text-amber-600' : 'text-slate-300 cursor-default'}`}
          >
            <span className="text-[14px]">⚾</span> {(post.thanksballTotal || 0) > 0 ? post.thanksballTotal : ''}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onLikeClick(post); }}
            className={`flex items-center gap-1 transition-colors ${isLikedByMe ? 'text-rose-500' : 'text-slate-400 hover:text-rose-400'}`}
          >
            <HeartIcon filled={isLikedByMe} /> {formatKoreanNumber(post.likes || 0)}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onShareClick(post); }}
            className="flex items-center text-slate-400 hover:text-blue-500 transition-all opacity-0 group-hover:opacity-100"
            title="공유"
          >
            <ShareIcon />
          </button>
        </div>
      </div>
    </div>
  );
};

// ✨ 2026-05-15: authorData 필드별 비교 — allUsers 전체 ref 교체 시 카드 무한 re-render 차단
const CommunityFeedCard = React.memo(CommunityFeedCardInner, (prev, next) => {
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
    authorEqual &&
    prev.followerCount === next.followerCount &&
    prev.isSelf === next.isSelf &&
    prev.isLikedByMe === next.isLikedByMe &&
    prev.formattedTime === next.formattedTime &&
    prev.onClick === next.onClick &&
    prev.onThanksballClick === next.onThanksballClick &&
    prev.onLikeClick === next.onLikeClick &&
    prev.onShareClick === next.onShareClick
  );
});

// 아이콘들 — 인라인 SVG (별 import 절감)
const CommentIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
);
const HeartIcon = ({ filled }: { filled: boolean }) => (
  <svg className={`w-3.5 h-3.5 ${filled ? 'fill-current' : 'fill-none'}`} stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
);
const ShareIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
);

export default CommunityFeedCard;
