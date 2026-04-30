// src/components/AnyTalkList.tsx
import React, { useState } from 'react';
import type { Post, UserData } from '../types';
import { formatKoreanNumber, getReputationLabel, getReputation, getCategoryDisplayName, calculateLevel } from '../utils';
import { sanitizeHtml, extractText, extractFirstImage } from '../sanitize';
import KanbuPromoCard from './KanbuPromoCard';
import KanbuPromoModal from './KanbuPromoModal';
// 🚀 ADSMARKET v3 (2026-04-30): 피드 인라인 광고 카드 (청크 4번째 다음에 인서트, 4:1 비율)
import AdFeedCard from './ads/AdFeedCard';

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
  allPosts?: Post[];
  oneCutPosts?: Post[];
  onOneCutMoreClick?: () => void;
  // 🚀 깐부맺기 인라인 섹션
  onFriendsMoreClick?: () => void;
  friends?: string[];
  onToggleFriend?: (nickname: string) => void;
  // 🖋️ 잉크병 인라인 섹션: 탭별 필터된 회차 목록 + 더보기 콜백
  inkwellPosts?: Post[];
  onInkwellMoreClick?: () => void;
  // 🚀 공유수 카운트: URL 복사 버튼 클릭 시 호출 → posts.shareCount + users.totalShares +1
  onShareCount?: (postId: string, authorId?: string) => void;
  // 🚀 ADSMARKET v3 (2026-04-30): 피드 인라인 광고 — 카테고리 뷰·홈 등록글 탭에만 ON
  showAds?: boolean;
  feedKey?: string;          // postId 합성용 ('home-recent' / 카테고리명 등)
  feedCategory?: string;     // 광고 매칭 postCategory (홈 mixed=빈문자열, 카테고리 뷰=카테고리명)
}

const AnyTalkList = ({
  posts, onTopicClick, onLikeClick, commentCounts = {}, currentNickname, currentUserData, allUsers = {}, followerCounts = {}, tab, onAuthorClick, onShareCount,
  allPosts = [], oneCutPosts, onOneCutMoreClick, onFriendsMoreClick, friends = [], onToggleFriend,
  inkwellPosts, onInkwellMoreClick,
  showAds = false, feedKey = 'home', feedCategory = '',
}: Props) => {
  const isNewTab = tab === 'any';

  // 🚀 목록 카드 공유 버튼: 복사된 카드 ID를 추적해 해당 카드에만 피드백 표시
  const [copiedPostId, setCopiedPostId] = useState<string | null>(null);
  // 🚀 깐부맺기 홍보 모달
  const [selectedPromoUser, setSelectedPromoUser] = useState<UserData | null>(null);

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
        // 🖋️ 잉크병 스트립도 한컷과 동일한 슬라이싱 패턴 (청크당 4개씩 반복)
        const stripInkwell = (inkwellPosts || []).slice(ci * 4, ci * 4 + 4);
        return (
          <React.Fragment key={ci}>
            <div className={`grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-2 w-full ${ci > 0 ? 'mt-2' : ''}`}>
            {chunk.length === 0 && ci === 0 ? (
              <div className={`col-span-full text-center text-slate-500 font-bold text-sm italic ${oneCutPosts && oneCutPosts.length > 0 ? 'py-10' : 'py-40'}`}>첫 번째 이야기를 기다리고 있어요!</div>
            ) : (
              chunk.map((post, idx) => {
          const promoLevel = Math.min(post.likes || 0, 3);
          const commentCount = commentCounts[post.id] || 0;
          const isLikedByMe = currentNickname && post.likedBy?.includes(currentNickname);
          const displayImage = post.imageUrl || extractFirstImage(post.content);
          // 🖋️ 잉크병 유료 회차는 posts.content가 빈 문자열이므로 previewContent(평문 200자)를 fallback으로 사용
          const cardContent = (post.category === 'magic_inkwell' && post.isPaid && !hasText(post.content) && post.previewContent)
            ? `<p>${post.previewContent}</p>`
            : post.content;
          const hasContent = hasText(cardContent);

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
            <React.Fragment key={post.id}>
            <div
              onClick={() => onTopicClick(post)}
              className="border border-slate-300 rounded-xl px-3.5 py-2 cursor-pointer hover:border-blue-400 hover:shadow-xl transition-all group flex flex-col shadow-sm"
              style={{ backgroundColor: post.bgColor || '#ffffff' }}
            >
              {/* 1. 최상단: 제목 및 시간/프로모션 */}
              <div className="flex justify-between items-start mb-1 shrink-0">
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className={`text-[9px] font-black uppercase tracking-tighter ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>{formatRelativeTime(post.createdAt)}</span>
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
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(cardContent) }}
                />
              )}

              {/* 3. 이미지 — 있는 경우만 노출 */}
              {displayImage && (
                <div className="w-full aspect-video rounded-lg overflow-hidden shrink-0 bg-slate-50 border border-slate-300 mb-1">
                  <img src={displayImage} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                </div>
              )}
              
              {/* 4. 최하단: 카테고리 & 아바타/유저정보 */}
              <div className={`pt-1 border-t mt-auto flex flex-col gap-0.5 shrink-0 ${isDark ? 'border-slate-600' : 'border-slate-100'}`}>
                <div className="flex items-center gap-1.5">
                  <span className="text-[8px] font-[1000] text-blue-500 bg-blue-50 px-2 py-0.5 rounded-md uppercase tracking-widest border border-blue-100/30">
                    {getCategoryDisplayName(post.category)}
                  </span>
                  {post.linkedPostId && post.debatePosition === 'pro'     && <span className="text-[8px] font-[1000] text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">👍 동의</span>}
                  {post.linkedPostId && post.debatePosition === 'con'     && <span className="text-[8px] font-[1000] text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">👎 비동의</span>}
                  {post.linkedPostId && post.debatePosition === 'neutral' && <span className="text-[8px] font-[1000] text-slate-500 bg-slate-50 border border-slate-300 px-2 py-0.5 rounded-md">🤝 중립</span>}
                  {post.verdict === 'fact'      && <span className="text-[8px] font-[1000] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">✅ 사실 확인</span>}
                  {post.verdict === 'false'     && <span className="text-[8px] font-[1000] text-rose-600    bg-rose-50    border border-rose-200    px-2 py-0.5 rounded-md">❌ 허위 판명</span>}
                  {post.verdict === 'uncertain' && <span className="text-[8px] font-[1000] text-slate-500   bg-slate-50   border border-slate-300   px-2 py-0.5 rounded-md">🔍 미정.보류</span>}
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
                    {/* 공유 버튼 — hover 시 노출, 클릭 시 ?post=글ID URL 복사 */}
                    <button
                      onClick={(e) => handleCopyUrl(e, post.id)}
                      className={`flex items-center gap-0.5 transition-all ${copiedPostId === post.id ? 'opacity-100 text-emerald-500' : 'opacity-0 group-hover:opacity-100 text-slate-500 hover:text-blue-400'}`}
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
            {/* 🚀 ADSMARKET v3 (2026-04-30): 청크 4번째 글 다음에 피드 인라인 광고 카드 (4:1 비율) */}
            {showAds && idx === 3 && chunk.length > 4 && (
              <AdFeedCard postCategory={feedCategory} feedKey={`${feedKey}-${ci}`} />
            )}
            </React.Fragment>
          );
              })
            )}
            </div>

            {/* 🚀 한컷 인터리브 스트립: 일반글 2줄(8개)마다 한컷 4개 삽입, 더보기→한컷 메뉴 */}
            {stripCuts.length > 0 && (
              <div className="my-2 py-2">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[13px] font-[1000] text-slate-700 flex items-center gap-1.5">
                    🍞 빵부스러기
                  </span>
                  <button onClick={onOneCutMoreClick} className="text-[11px] font-bold text-slate-500 hover:text-violet-600 transition-colors flex items-center gap-0.5">
                    빵부스러기 <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
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
                    // 연결된 원본글 찾기 (OneCutList와 동일)
                    const linkedPost = post.linkedPostId ? allPosts.find(p => p.id === post.linkedPostId) : null;
                    return (
                      <div
                        key={post.id}
                        onClick={() => onTopicClick(post)}
                        className="group flex flex-col bg-white rounded-[4px] overflow-hidden cursor-pointer shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-300"
                      >
                        {/* 이미지 */}
                        <div className="relative aspect-[16/9] overflow-hidden bg-slate-900 shrink-0 border-b border-slate-100">
                          {(() => {
                            // 🍞 헨젤의 빵부스러기 — imageUrls[0] 우선, fallback으로 imageUrl
                            const thumb = post.imageUrls?.[0] || post.imageUrl;
                            const cutCount = post.imageUrls?.length ?? (post.imageUrl ? 1 : 0);
                            return (
                              <>
                                {thumb ? (
                                  <img src={thumb} alt="" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-700">
                                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                  </div>
                                )}
                                {cutCount > 0 && (
                                  <span className="absolute top-2 left-2 px-2 py-0.5 bg-black/60 backdrop-blur-sm text-white text-[10px] font-black rounded-full">
                                    <span className="grayscale opacity-90">🍞</span> 1/{cutCount}
                                  </span>
                                )}
                              </>
                            );
                          })()}
                        </div>
                        {/* 제목 + 작성자 + 통계 바 */}
                        <div className="flex-1 px-3 pt-2.5 pb-2 flex flex-col gap-1 bg-white">
                          <h3 className="text-[13px] font-[1000] text-slate-900 line-clamp-1 tracking-tighter leading-tight group-hover:text-blue-600 transition-colors">
                            {post.title}
                          </h3>
                          {/* 원본글 링크 — 없어도 높이 확보 (카드 세로 사이즈 통일) */}
                          <div className="pt-1 min-h-[22px]">
                            {linkedPost ? (
                              <div className="flex items-center gap-1 text-blue-600 bg-blue-50/50 px-2 py-0.5 rounded-[2px] border border-blue-100/20">
                                <span className="text-[8px]">🔗</span>
                                <span className="text-[8px] font-black truncate tracking-tighter">{linkedPost.title}</span>
                              </div>
                            ) : post.linkUrl ? (
                              <a href={post.linkUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                                className="flex items-center gap-1 text-blue-600 bg-blue-50/50 px-2 py-0.5 rounded-[2px] border border-blue-100/20 hover:bg-blue-50 transition-colors">
                                <span className="text-[8px]">🔗</span>
                                <span className="text-[8px] font-black truncate tracking-tighter">{(() => { try { return new URL(post.linkUrl!).hostname; } catch { return '원본글'; } })()}</span>
                              </a>
                            ) : null}
                          </div>
                          {/* 하단: 일반 글카드와 완전 동일 구조 */}
                          <div className="flex-1" />
                          <div className="pt-1 border-t border-slate-100 flex items-center justify-between">
                            <div
                              className="flex items-center gap-1.5 min-w-0 cursor-pointer hover:opacity-70 transition-opacity"
                              onClick={(e) => { e.stopPropagation(); onAuthorClick?.(post.author); }}
                            >
                              <div className="w-6 h-6 rounded-full bg-slate-50 overflow-hidden shrink-0 border border-white shadow-sm ring-1 ring-slate-100">
                                <img src={authorData?.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${post.author}`} alt="" className="w-full h-full object-cover" />
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="text-[11px] font-[1000] text-slate-900 truncate leading-none mb-0.5">{post.author}</span>
                                <span className="text-[9px] font-bold text-slate-500 truncate tracking-tight">Lv {displayLevel} · {getReputationLabel(authorData ? getReputation(authorData) : displayLikes)} · 깐부수 {formatKoreanNumber(realFollowers)}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 text-[10px] font-black text-slate-500">
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
                              {/* 공유 버튼 — hover 시 노출, 클릭 시 URL 복사 */}
                              <button
                                onClick={(e) => handleCopyUrl(e, post.id)}
                                className={`flex items-center gap-0.5 transition-all ${copiedPostId === post.id ? 'opacity-100 text-emerald-500' : 'opacity-0 group-hover:opacity-100 text-slate-500 hover:text-blue-400'}`}
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
                  })}
                </div>
              </div>
            )}

            {/* 🖋️ 잉크병 인터리브 스트립: 한컷 다음 줄, 4개씩 청크 반복 */}
            {stripInkwell.length > 0 && (
              <div className="my-2 py-2">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[13px] font-[1000] text-slate-700 flex items-center gap-1.5">
                    🖋️ 잉크병
                  </span>
                  <button onClick={onInkwellMoreClick} className="text-[11px] font-bold text-slate-500 hover:text-violet-600 transition-colors flex items-center gap-0.5">
                    잉크병 <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {stripInkwell.map(post => {
                    const isLikedByMe = currentNickname && post.likedBy?.includes(currentNickname);
                    const authorData = (post.author_id && allUsers[post.author_id]) || allUsers[`nickname_${post.author}`];
                    const realFollowers = followerCounts[post.author] || 0;
                    const displayLevel = calculateLevel(authorData?.exp || 0);
                    const displayLikes = authorData ? (authorData.likes || 0) : (post.authorInfo?.totalLikes || 0);
                    // 🖋️ 잉크병 유료 회차는 posts.content가 빈 문자열 → previewContent fallback
                    const inkwellCardContent = (post.isPaid && !hasText(post.content) && post.previewContent)
                      ? `<p>${post.previewContent}</p>`
                      : post.content;
                    const hasInkwellContent = hasText(inkwellCardContent);
                    const inkwellImage = post.imageUrl || extractFirstImage(post.content);
                    const commentCount = commentCounts[post.id] || 0;
                    return (
                      <div
                        key={post.id}
                        onClick={() => onTopicClick(post)}
                        className="border border-slate-300 rounded-xl px-3.5 py-2 cursor-pointer hover:border-blue-400 hover:shadow-xl transition-all group flex flex-col shadow-sm bg-white"
                      >
                        {/* 1. 최상단: 시간 + 제목 (일반 글카드 동일 구조) */}
                        <div className="flex justify-between items-start mb-1 shrink-0">
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <span className="text-[9px] font-black uppercase tracking-tighter text-slate-500">{formatRelativeTime(post.createdAt)}</span>
                            <h3 className="text-[15px] font-[1000] line-clamp-2 leading-tight tracking-tight text-slate-900 group-hover:text-blue-600 transition-colors">
                              {post.episodeTitle || post.title}
                            </h3>
                          </div>
                        </div>

                        {/* 2. 중간: 본문 미리보기 — HTML 렌더 (일반 글카드 동일) */}
                        {hasInkwellContent && (
                          <div
                            className={`overflow-hidden mb-1 text-[13px] leading-relaxed font-medium text-slate-500 [&_img]:hidden [&_p]:mb-1 [&_p:last-child]:mb-0 [&_strong]:font-bold [&_em]:italic [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_h1]:text-[14px] [&_h1]:font-bold [&_h2]:text-[13px] [&_h2]:font-bold [&_h3]:text-[13px] [&_h3]:font-semibold ${inkwellImage ? 'line-clamp-3' : 'line-clamp-6'}`}
                            dangerouslySetInnerHTML={{ __html: sanitizeHtml(inkwellCardContent) }}
                          />
                        )}

                        {/* 3. 이미지 — 있는 경우만 */}
                        {inkwellImage && (
                          <div className="w-full aspect-video rounded-lg overflow-hidden shrink-0 bg-slate-50 border border-slate-300 mb-1">
                            <img src={inkwellImage} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                          </div>
                        )}

                        {/* 4. 최하단: 카테고리 + 아바타/유저정보 + 통계(땡스볼/좋아요/댓글) */}
                        <div className="pt-1 border-t mt-auto flex flex-col gap-0.5 shrink-0 border-slate-100">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[8px] font-[1000] text-blue-500 bg-blue-50 px-2 py-0.5 rounded-md uppercase tracking-widest border border-blue-100/30">
                              {getCategoryDisplayName(post.category)}
                            </span>
                            {post.episodeNumber && (
                              <span className="text-[8px] font-[1000] text-purple-600 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-md">
                                📖 {post.episodeNumber}화
                              </span>
                            )}
                            {/* 🖋️ 유료/무료 뱃지 — 붉은색(유료) / 파란색(무료) */}
                            {post.isPaid ? (
                              <span className="text-[8px] font-[1000] text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">
                                🔒 유료 🏀{post.price || 0}
                              </span>
                            ) : (
                              <span className="text-[8px] font-[1000] text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                                🆓 무료
                              </span>
                            )}
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
                                <span className="text-[11px] font-[1000] text-slate-900 truncate leading-none mb-0.5">{post.author}</span>
                                <span className="text-[9px] font-bold text-slate-500 truncate tracking-tight">
                                  Lv {displayLevel} · {getReputationLabel(authorData ? getReputation(authorData) : displayLikes)} · 깐부수 {formatKoreanNumber(realFollowers)}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 text-[10px] font-black shrink-0 text-slate-500">
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
                              {/* 🖋️ 공유 버튼 — 일반 글카드와 동일 위치 */}
                              <button
                                onClick={(e) => handleCopyUrl(e, post.id)}
                                className={`flex items-center gap-0.5 transition-all ${copiedPostId === post.id ? 'opacity-100 text-emerald-500' : 'opacity-0 group-hover:opacity-100 text-slate-400 hover:text-blue-400'}`}
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
                  })}
                </div>
              </div>
            )}

            {/* 🚀 깐부맺기 인터리브 스트립: 등록글/인기글/최고글에서만, 한컷 다음 줄 */}
            {ci === 0 && onFriendsMoreClick && ['any', 'recent', 'best', 'rank'].includes(tab || '') && (() => {
              // promoEnabled + 만료 안 된 유저 4명
              const now = Date.now();
              // 🚀 nickname_ 접두사 문서 제외 (UID 키 문서만 사용) + 중복 방지
              const seen = new Set<string>();
              const promoUsers = Object.entries(allUsers).filter(([key, u]) => {
                if (key.startsWith('nickname_')) return false;
                const p = u as unknown as { promoEnabled?: boolean; promoExpireAt?: { seconds: number } };
                if (!p.promoEnabled) return false;
                if (p.promoExpireAt && p.promoExpireAt.seconds * 1000 < now) return false;
                if (seen.has(u.nickname)) return false;
                seen.add(u.nickname);
                return true;
              }).map(([, u]) => u).slice(0, 4);
              if (promoUsers.length === 0) return null;
              return (
                <div className="my-2 py-2">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[13px] font-[1000] text-slate-700 flex items-center gap-1.5">
                      🤝 깐부맺기
                    </span>
                    <button onClick={onFriendsMoreClick} className="text-[11px] font-bold text-slate-500 hover:text-violet-600 transition-colors flex items-center gap-0.5">
                      깐부맺기 <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {promoUsers.map(user => (
                      <KanbuPromoCard
                        key={user.uid}
                        userData={user as UserData & { promoImageUrl?: string; promoKeywords?: string[]; promoMessage?: string; promoExpireAt?: { seconds: number }; promoViewCount?: number }}
                        followerCount={followerCounts[user.nickname] || 0}
                        onClick={() => {
                          setSelectedPromoUser(user);
                          // 🚀 홍보 모달 조회수 카운트 (본인 제외)
                          if (user.uid !== (currentUserData?.uid || '')) {
                            import('firebase/firestore').then(({ doc: fbDoc, updateDoc: fbUpdate, increment: fbInc }) => {
                              import('../firebase').then(({ db: fbDb }) => {
                                fbUpdate(fbDoc(fbDb, 'users', user.uid), { promoViewCount: fbInc(1) }).catch(() => {});
                              });
                            });
                          }
                        }}
                      />
                    ))}
                  </div>
                </div>
              );
            })()}
          </React.Fragment>
        );
      })}
      {/* 🚀 깐부맺기 홍보 모달 */}
      {selectedPromoUser && currentNickname && (
        <KanbuPromoModal
          userData={selectedPromoUser as UserData & { promoImageUrl?: string; promoKeywords?: string[]; promoMessage?: string }}
          isFriend={friends.includes(selectedPromoUser.nickname)}
          isMutual={friends.includes(selectedPromoUser.nickname) && !!(selectedPromoUser.friendList && selectedPromoUser.friendList.includes(currentNickname))}
          onToggleFriend={() => { onToggleFriend?.(selectedPromoUser.nickname); setSelectedPromoUser(null); }}
          onViewProfile={() => { setSelectedPromoUser(null); onAuthorClick?.(selectedPromoUser.nickname); }}
          onClose={() => setSelectedPromoUser(null)}
        />
      )}
    </div>
  );
};

export default AnyTalkList;
