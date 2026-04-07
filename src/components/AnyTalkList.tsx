// src/components/AnyTalkList.tsx
import React, { useState } from 'react';
import type { Post, UserData } from '../types';
import { formatKoreanNumber, getReputationLabel, getReputationScore, getCategoryDisplayName, calculateLevel } from '../utils';
import { sanitizeHtml, extractText, extractFirstImage } from '../sanitize';

interface Props {
  posts: Post[];
  onTopicClick: (post: Post) => void;
  onLikeClick?: (e: React.MouseEvent, postId: string) => void;
  commentCounts?: Record<string, number>;
  currentNickname?: string;
  currentUserData?: UserData | null;
  allUsers?: Record<string, UserData>;
  followerCounts?: Record<string, number>;
  tab?: string;
  onAuthorClick?: (author: string) => void;
  // 🚀 한컷 인라인 섹션: 탭별 필터된 한컷 목록 + 더보기 콜백
  oneCutPosts?: Post[];
  onOneCutMoreClick?: () => void;
  // 🚀 공유수 카운트: URL 복사 버튼 클릭 시 호출 → posts.shareCount + users.totalShares +1
  onShareCount?: (postId: string, authorId?: string) => void;
}

const AnyTalkList = ({
  posts, onTopicClick, onLikeClick, commentCounts = {}, currentNickname, allUsers = {}, followerCounts = {}, tab, onAuthorClick, onShareCount,
  oneCutPosts, onOneCutMoreClick,
}: Props) => {
  const isNewTab = tab === 'any';

  // 🚀 목록 카드 공유 버튼: 복사된 카드 ID를 추적해 해당 카드에만 피드백 표시
  const [copiedPostId, setCopiedPostId] = useState<string | null>(null);

  const handleCopyUrl = (e: React.MouseEvent, postId: string) => {
    e.stopPropagation(); // 카드 전체 클릭 이벤트(글 열기) 차단
    const shareToken = postId.split('_').slice(0, 2).join('_'); // UID 제거: "topic_타임스탬프"만 사용
    const shareUrl = `${window.location.origin}/p/${shareToken}`; // /p/ 경로 → ogRenderer (동적 OG 태그)
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopiedPostId(postId);
      setTimeout(() => setCopiedPostId(null), 2000);
      // 🚀 공유수 카운트: URL 복사 성공 시 shareCount + totalShares +1
      const postObj = posts.find(p => p.id === postId);
      onShareCount?.(postId, postObj?.author_id);
    });
  };

  // 본문에서 텍스트 존재 여부 확인용 (렌더링은 HTML 그대로)
  const hasText = (html: string) => {
    return !!extractText(html).trim();
  };

  // 🚀 본문 HTML에서 첫 번째 이미지 URL 추출 (sanitize.ts의 안전한 DOMParser 사용)

  const formatRelativeTime = (timestamp: { seconds: number } | null | undefined) => {
    if (!timestamp) return "방금 전";
    const now = new Date();
    const createdAt = new Date(timestamp.seconds * 1000);
    const diffInHours = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60));
    if (diffInHours < 1) return "방금 전";
    if (diffInHours < 24) return `${diffInHours}시간 전`;
    return createdAt.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' });
  };

  // 🚀 인터리브 레이아웃: 일반글 8개(약 2줄)마다 한컷 스트립 삽입
  const POST_CHUNK = 8;
  const postChunks: Post[][] = [];
  for (let i = 0; i < posts.length; i += POST_CHUNK) postChunks.push(posts.slice(i, i + POST_CHUNK));
  if (postChunks.length === 0) postChunks.push([]); // 일반글 없어도 한컷 표시용

  return (
    <div className="w-full pb-20">
      {postChunks.map((chunk, ci) => {
        const stripCuts = (oneCutPosts || []).slice(ci * 4, ci * 4 + 4);
        return (
          <React.Fragment key={ci}>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-2 w-full">
            {chunk.length === 0 && ci === 0 ? (
              <div className={`col-span-full text-center text-slate-400 font-bold text-sm italic ${oneCutPosts && oneCutPosts.length > 0 ? 'py-10' : 'py-40'}`}>첫 번째 이야기를 기다리고 있어요!</div>
            ) : (
              chunk.map((post) => {
          const promoLevel = Math.min(post.likes || 0, 3);
          const commentCount = commentCounts[post.id] || 0;
          const isLikedByMe = currentNickname && post.likedBy?.includes(currentNickname);
          const displayImage = post.imageUrl || extractFirstImage(post.content);
          const hasContent = hasText(post.content);

          // 🚀 실시간 사용자 데이터 바인딩
          const authorData = (post.author_id && allUsers[post.author_id]) || allUsers[`nickname_${post.author}`];
          const realFollowers = followerCounts[post.author] || 0;
          const displayLevel = calculateLevel(authorData?.exp || 0);
          const displayLikes = authorData ? (authorData.likes || 0) : (post.authorInfo?.totalLikes || 0);

          const goldHeartCount = (post.likedBy || []).filter(nickname => {
            const ud = allUsers[`nickname_${nickname}`];
            return ud && calculateLevel(ud.exp || 0) >= 5;
          }).length;

          const DARK_BG = new Set(['#1e293b', '#7c3aed']);
          const isDark = !!(post.bgColor && DARK_BG.has(post.bgColor));

          return (
            <div
              key={post.id}
              onClick={() => onTopicClick(post)}
              className="border border-slate-100 rounded-xl px-3.5 py-2 cursor-pointer hover:border-blue-400 hover:shadow-xl transition-all group flex flex-col shadow-sm"
              style={{ backgroundColor: post.bgColor || '#ffffff' }}
            >
              {/* 1. 최상단: 제목 및 시간/프로모션 */}
              <div className="flex justify-between items-start mb-1 shrink-0">
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className={`text-[9px] font-black uppercase tracking-tighter ${isDark ? 'text-slate-400' : 'text-slate-300'}`}>{formatRelativeTime(post.createdAt)}</span>
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
                  className={`overflow-hidden mb-1 text-[13px] leading-relaxed font-medium [&_img]:hidden [&_p]:mb-1 [&_p:last-child]:mb-0 [&_strong]:font-bold [&_em]:italic [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_h1]:text-[14px] [&_h1]:font-bold [&_h2]:text-[13px] [&_h2]:font-bold [&_h3]:text-[13px] [&_h3]:font-semibold ${displayImage ? 'line-clamp-3' : 'line-clamp-6'} ${isDark ? 'text-slate-300' : 'text-slate-500'}`}
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.content) }}
                />
              )}

              {/* 3. 이미지 — 있는 경우만 노출 */}
              {displayImage && (
                <div className="w-full aspect-video rounded-lg overflow-hidden shrink-0 bg-slate-50 border border-slate-50 mb-1">
                  <img src={displayImage} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                </div>
              )}
              
              {/* 4. 최하단: 카테고리 & 아바타/유저정보 */}
              <div className={`pt-1 border-t mt-auto flex flex-col gap-0.5 shrink-0 ${isDark ? 'border-slate-600' : 'border-slate-50'}`}>
                <div className="flex items-center gap-1.5">
                  <span className="text-[8px] font-[1000] text-blue-500 bg-blue-50 px-2 py-0.5 rounded-md uppercase tracking-widest border border-blue-100/30">
                    {getCategoryDisplayName(post.category)}
                  </span>
                  {post.linkedPostId && post.debatePosition === 'pro'     && <span className="text-[8px] font-[1000] text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">👍 동의</span>}
                  {post.linkedPostId && post.debatePosition === 'con'     && <span className="text-[8px] font-[1000] text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">👎 비동의</span>}
                  {post.linkedPostId && post.debatePosition === 'neutral' && <span className="text-[8px] font-[1000] text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md">🤝 중립</span>}
                  {post.verdict === 'fact'      && <span className="text-[8px] font-[1000] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">✅ 사실 확인</span>}
                  {post.verdict === 'false'     && <span className="text-[8px] font-[1000] text-rose-600    bg-rose-50    border border-rose-200    px-2 py-0.5 rounded-md">❌ 허위 판명</span>}
                  {post.verdict === 'uncertain' && <span className="text-[8px] font-[1000] text-slate-500   bg-slate-50   border border-slate-200   px-2 py-0.5 rounded-md">🔍 미정.보류</span>}
                  {/* 🚀 마라톤의 전령: newsType 기반 속보/뉴스 배지 */}
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
                      <img src={authorData?.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${post.author}`} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className={`text-[11px] font-[1000] truncate leading-none mb-0.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>{post.author}</span>
                      <span className={`text-[9px] font-bold truncate tracking-tight ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>
                        Lv {displayLevel} · {getReputationLabel(authorData ? getReputationScore(authorData) : displayLikes)} · 깐부수 {formatKoreanNumber(realFollowers)}
                      </span>
                    </div>
                  </div>

                  <div className={`flex items-center gap-2 text-[10px] font-black shrink-0 ${isDark ? 'text-slate-400' : 'text-slate-300'}`}>
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
                    {/* 공유 버튼 — hover 시 노출, 클릭 시 ?post=글ID URL 복사 */}
                    <button
                      onClick={(e) => handleCopyUrl(e, post.id)}
                      className={`flex items-center gap-0.5 transition-all ${copiedPostId === post.id ? 'opacity-100 text-emerald-500' : 'opacity-0 group-hover:opacity-100 text-slate-300 hover:text-blue-400'}`}
                      title="글 링크 복사"
                    >
                      {copiedPostId === post.id
                        ? <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"/></svg>
                        : <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
                      }
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
              })
            )}
            </div>

            {/* 🚀 한컷 인터리브 스트립: 일반글 2줄(8개)마다 한컷 4개 삽입, 더보기→한컷 메뉴 */}
            {stripCuts.length > 0 && (
              <div className="my-4 border-y border-slate-100 py-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[13px] font-[1000] text-slate-700 flex items-center gap-1.5">
                    🎞️ 한컷
                  </span>
                  <button onClick={onOneCutMoreClick} className="text-[11px] font-bold text-slate-400 hover:text-violet-600 transition-colors flex items-center gap-0.5">
                    한컷 <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
                  </button>
                </div>
                {/* 🚀 한컷 인라인 카드: OneCutList.tsx와 동일 형태 (이미지+제목+작성자+좋아요) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {stripCuts.map(post => {
                    const isLikedByMe = currentNickname && post.likedBy?.includes(currentNickname);
                    const authorData = (post.author_id && allUsers[post.author_id]) || allUsers[`nickname_${post.author}`];
                    const realFollowers = followerCounts[post.author] || 0;
                    const displayLevel = calculateLevel(authorData?.exp || 0);
                    const displayLikes = authorData ? authorData.likes : (post.authorInfo?.totalLikes || 0);
                    return (
                      <div
                        key={post.id}
                        onClick={() => onTopicClick(post)}
                        className="group flex flex-col bg-white rounded-[4px] overflow-hidden cursor-pointer shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-100"
                      >
                        {/* 이미지 */}
                        <div className="relative aspect-[16/9] overflow-hidden bg-slate-900 shrink-0 border-b border-slate-50">
                          {post.imageUrl ? (
                            <img src={post.imageUrl} alt="" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-700">
                              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            </div>
                          )}
                        </div>
                        {/* 제목 + 작성자 + 통계 바 */}
                        <div className="flex-1 px-3 pt-2.5 pb-2 flex flex-col gap-1 bg-white">
                          <h3 className="text-[13px] font-[1000] text-slate-900 line-clamp-1 tracking-tighter leading-tight group-hover:text-blue-600 transition-colors">
                            {post.title}
                          </h3>
                          {/* 원본글 링크 */}
                          {post.linkUrl && (
                            <a href={post.linkUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                              className="flex items-center gap-1 text-blue-600 bg-blue-50/50 px-2 py-0.5 rounded-[2px] border border-blue-100/20 hover:bg-blue-50 transition-colors">
                              <span className="text-[8px]">🔗</span>
                              <span className="text-[8px] font-black truncate tracking-tighter">{(() => { try { return new URL(post.linkUrl!).hostname; } catch { return '원본글'; } })()}</span>
                            </a>
                          )}
                          {/* 작성자 */}
                          <div className="flex-1" />
                          <div className="pt-1.5 border-t border-slate-50 flex items-center gap-1.5">
                            <div className="w-6 h-6 rounded-full overflow-hidden border border-slate-100 bg-slate-50 shrink-0">
                              <img src={authorData?.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${post.author}`} alt="" className="w-full h-full object-cover" />
                            </div>
                            <div className="flex flex-col min-w-0 leading-tight">
                              <span className="text-slate-900 text-[10px] font-black truncate">{post.author}</span>
                              <span className="text-slate-400 text-[8px] font-bold truncate">
                                Lv {displayLevel} · {getReputationLabel(authorData ? getReputationScore(authorData) : displayLikes)} · 깐부수 {formatKoreanNumber(realFollowers)}
                              </span>
                            </div>
                          </div>
                          {/* 통계 바: 댓글 | 땡스볼 | 좋아요 | 공유 */}
                          <div className="flex items-center justify-end gap-3 text-[10px] font-black text-slate-300">
                            <span className="flex items-center gap-1">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                              {formatKoreanNumber(commentCounts[post.id] || 0)}
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
                              onClick={(e) => handleCopyUrl(e, post.id)}
                              className={`flex items-center gap-0.5 transition-all ${copiedPostId === post.id ? 'text-emerald-500' : 'opacity-0 group-hover:opacity-100 hover:text-blue-400'}`}
                              title="글 링크 복사"
                            >
                              {copiedPostId === post.id
                                ? <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"/></svg>
                                : <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
                              }
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default AnyTalkList;
