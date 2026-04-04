// src/components/RootPostCard.tsx
import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, deleteDoc, updateDoc, increment } from 'firebase/firestore';
import type { Post, UserData } from '../types';
import { getReputationLabel, getReputationScore, formatKoreanNumber, getCategoryDisplayName } from '../utils';
import { CATEGORY_RULES } from './DiscussionView';
import LinkPreviewCard from './LinkPreviewCard';
import type { OgData } from './LinkPreviewCard';
import { EXTERNAL_URLS } from '../constants';
import { sanitizeHtml } from '../sanitize';
import ThanksballModal from './ThanksballModal';
import PandoraDetail from './PandoraDetail';

interface Props {
  post: Post;
  totalComment: number;
  totalFormal: number;
  uniqueAgreeCount: number;
  uniqueDisagreeCount: number;
  isFriend: boolean;
  onToggleFriend: () => void;
  userData: {
    level: number;
    likes: number;
    bio: string;
  };
  friendCount: number;
  onDeleteSuccess?: () => void;
  onLikeClick?: (e: React.MouseEvent | null, postId: string) => void;
  currentNickname?: string;
  onEdit?: (post: Post) => void;
  onBack?: () => void;
  thanksballTotal?: number;
  allUsers?: Record<string, UserData>;
  onNavigateToPost?: (postId: string) => void; // 연계글에서 원본글로 이동
}

const RootPostCard = ({
  post, totalComment, totalFormal, uniqueAgreeCount, uniqueDisagreeCount, isFriend, onToggleFriend, userData, friendCount, onDeleteSuccess, onLikeClick, currentNickname, onEdit, onBack, thanksballTotal, allUsers = {}, onNavigateToPost
}: Props) => {

  const isMyPost = post.author === currentNickname;
  const isLikedByMe = currentNickname && post.likedBy?.includes(currentNickname);
  const authorData = (post.author_id && allUsers[post.author_id]) || allUsers[`nickname_${post.author}`];
  const [showSelfMsg, setShowSelfMsg] = useState(false);

  // 🚀 linkUrl OG 미리보기: post.linkUrl 우선, 없으면 content HTML의 첫 번째 <a href> 추출
  const [ogData, setOgData] = useState<OgData | null>(null);
  const [ogLoading, setOgLoading] = useState(false);
  const [showLinkPreview, setShowLinkPreview] = useState(true);
  const [contentLinkUrl, setContentLinkUrl] = useState<string | null>(null);

  useEffect(() => {
    // post.linkUrl이 없으면 본문 HTML에서 첫 번째 외부 링크 추출
    if (post.linkUrl) return;
    const parser = new DOMParser();
    const doc = parser.parseFromString(post.content, 'text/html');
    const firstAnchor = doc.querySelector('a[href^="http"]');
    if (firstAnchor) setContentLinkUrl(firstAnchor.getAttribute('href'));
  }, [post.content, post.linkUrl]);

  useEffect(() => {
    const urlToFetch = post.linkUrl || contentLinkUrl;
    if (!urlToFetch) return;
    setOgLoading(true);
    fetch(`${EXTERNAL_URLS.LINK_PREVIEW_WORKER}?url=${encodeURIComponent(urlToFetch)}`)
      .then(r => r.json())
      .then((data: OgData & { error?: string }) => { if (!data.error) setOgData(data); })
      .catch(() => {})
      .finally(() => setOgLoading(false));
  }, [post.linkUrl, contentLinkUrl]);
  const [showThanksball, setShowThanksball] = useState(false);
  const [copied, setCopied] = useState(false); // 공유 URL 복사 완료 피드백용

  // 🚀 글 공유 URL 복사: ?post=topic_타임스탬프 형식 (UID 노출 방지)
  // 예) topic_1234567890123_AbCxYz → ?post=topic_1234567890123
  const handleCopyUrl = () => {
    const shareToken = post.id.split('_').slice(0, 2).join('_'); // "topic_타임스탬프" 까지만
    // /p/{shareToken} 형식 — ogRenderer Cloud Function이 SNS 봇에 동적 OG 반환
    const shareUrl = `${window.location.origin}/p/${shareToken}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000); // 2초 후 버튼 원상복귀
      // 🚀 공유수 카운트: URL 복사 성공 시 posts.shareCount + users.totalShares +1
      updateDoc(doc(db, 'posts', post.id), { shareCount: increment(1) }).catch(() => {});
      if (post.author_id) {
        updateDoc(doc(db, 'users', post.author_id), { totalShares: increment(1) }).catch(() => {});
      }
    });
  };
  const hasImageInContent = post.content.includes('<img');

  const formatTime = (timestamp: { seconds: number } | null | undefined) => {
    if (!timestamp) return "";
    const now = new Date();
    const createdAt = new Date(timestamp.seconds * 1000);
    const diffInSeconds = Math.floor((now.getTime() - createdAt.getTime()) / 1000);
    if (diffInSeconds < 60) return "방금 전";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}분 전`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}시간 전`;
    return createdAt.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const handleDelete = async () => {
    if (window.confirm("정말 영구히 파기하겠소?")) {
      try {
        await deleteDoc(doc(db, "posts", post.id));
        if (onDeleteSuccess) onDeleteSuccess();
        else window.location.reload();
      } catch (error) { console.error("삭제 실패:", error); }
    }
  };

  const DARK_BG = new Set(['#1e293b', '#7c3aed']);
  const isDark = !!(post.bgColor && DARK_BG.has(post.bgColor));

  return (
    <>
    <section className="rounded-none flex flex-col mb-0" style={{ backgroundColor: post.bgColor || '#ffffff' }}>
      {/* 본문 영역 (콤팩트 패딩) */}
      <div className="flex-1 flex flex-col pt-8 px-4 md:px-8 pb-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <span
              onClick={onBack}
              className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-sm uppercase tracking-widest cursor-pointer hover:bg-blue-100 hover:text-blue-700 hover:-translate-x-0.5 transition-all duration-150 select-none"
              title="목록으로 돌아가기"
            >
              ← {getCategoryDisplayName(post.category)}
            </span>
            <span className="text-[11px] font-bold text-slate-400">{formatTime(post.createdAt)}</span>
          </div>
          
          <div className="flex items-center gap-3">
            {/* 공유 버튼 — 모든 글에 표시, 클릭 시 ?post=글ID URL 클립보드 복사 */}
            <button
              onClick={handleCopyUrl}
              className={`flex items-center gap-1 text-[11px] font-bold transition-colors ${copied ? 'text-emerald-500' : 'text-slate-400 hover:text-blue-500'}`}
              title="이 글의 링크를 복사합니다"
            >
              {copied ? (
                <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"/></svg>복사됨</>
              ) : (
                <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>공유</>
              )}
            </button>
            {isMyPost && (
              <>
                <button onClick={() => onEdit?.(post)} className="text-[11px] font-bold text-slate-400 hover:text-blue-500 transition-colors">수정</button>
                <button onClick={handleDelete} className="text-[11px] font-bold text-slate-400 hover:text-rose-500 transition-colors">삭제</button>
              </>
            )}
          </div>
        </div>

        <h2 className={`text-[22px] font-[1000] mb-5 leading-snug tracking-tighter max-w-4xl ${isDark ? 'text-white' : 'text-slate-900'}`}>{post.title}</h2>

        {/* 판도라의 상자 전용 — 마법 수정 구슬 등 다른 pandora 카테고리 제외 */}
        {post.category === '판도라의 상자' && (
          <div className="flex items-center gap-2 mb-3">
            <span className="w-1 h-4 bg-blue-400 rounded-full" />
            <span className="text-[14px] font-black text-blue-600 uppercase tracking-widest">검증 대상</span>
          </div>
        )}
        {/* 🚀 황금알을 낳는 거위 분야 배지 — 제목 바로 아래 표시 */}
        {post.category === '황금알을 낳는 거위' && (post.infoFields || []).length > 0 && (
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            {(post.infoFields || []).map(field => (
              <span key={field} className="text-[12px] font-black text-yellow-700 bg-yellow-50 border border-yellow-200 px-3 py-1 rounded-lg">
                🪙 {field}
              </span>
            ))}
          </div>
        )}
        {/* 🚀 연계글 원본글 바로가기 + 동의/비동의 입장 배지 — linkedPostId/linkedPostTitle이 있는 연계글에만 표시 */}
        {!post.isOneCut && post.linkedPostId && post.linkedPostTitle && onNavigateToPost && (
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <button
              onClick={() => onNavigateToPost(post.linkedPostId!)}
              className="flex items-center gap-1.5 text-[12px] font-bold text-blue-500 bg-blue-50 border border-blue-100 px-3 py-1 rounded-lg hover:bg-blue-100 transition-colors"
            >
              🔗 원본글: {post.linkedPostTitle}
            </button>
            {post.debatePosition === 'pro'     && <span className="text-[11px] font-black text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-lg">👍 동의</span>}
            {post.debatePosition === 'con'     && <span className="text-[11px] font-black text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-lg">👎 비동의</span>}
            {post.debatePosition === 'neutral' && <span className="text-[11px] font-black text-slate-500 bg-slate-50 border border-slate-200 px-2.5 py-0.5 rounded-lg">🤝 중립</span>}
          </div>
        )}

        {/* 🚀 마법 수정 구슬 지역 배지 — 제목 바로 아래 표시 */}
        {post.location && (
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[12px] font-black text-indigo-600 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-lg">
              📍 {post.location.includes(':') ? post.location.split(':')[1] : post.location}
            </span>
          </div>
        )}

        {/* 🚀 OG 미리보기: 본문보다 위에 위치 — URL 주소 바로 아래 미리보기 노출 */}
        {(post.linkUrl || contentLinkUrl) && showLinkPreview && (ogLoading || ogData) && (
          <LinkPreviewCard data={ogData} loading={ogLoading} onClose={() => setShowLinkPreview(false)} />
        )}
        {post.linkUrl && !(showLinkPreview && (ogLoading || ogData)) && (
          // OG fetch 실패 또는 미리보기 닫은 경우 — linkUrl 텍스트 fallback
          <a href={post.linkUrl} target="_blank" rel="noopener noreferrer" className="text-[13px] font-bold text-blue-500 hover:text-blue-600 hover:underline transition-all">
            {post.linkUrl}
          </a>
        )}

        <div className={`text-[15px] mb-6 leading-[1.8] font-medium max-w-none flex-1 [&_p]:mb-4 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-4 [&_li]:mb-1 [&_strong]:font-bold [&_em]:italic [&_a]:text-blue-400 [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-slate-200 [&_blockquote]:pl-4 [&_blockquote]:text-slate-500 [&_h1]:text-2xl [&_h1]:font-black [&_h2]:text-xl [&_h2]:font-black [&_h3]:text-lg [&_h3]:font-black ${isDark ? 'text-slate-200' : 'text-slate-700'}`} dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.content) }} />

        {post.imageUrl && !hasImageInContent && (
          <div className="w-full md:w-2/3 mb-6 rounded-2xl overflow-hidden border border-slate-100 bg-slate-50">
            <img src={post.imageUrl} alt="Post Content" className="w-full h-auto object-contain max-h-[500px]" />
          </div>
        )}

        <div className="flex flex-wrap gap-2 mb-6">
          {(post.tags || []).map((tag, idx) => (
            <span key={idx} className="text-[11px] font-bold text-slate-400 before:content-['#']">
              {tag.replace('#', '')}
            </span>
          ))}
        </div>

        {/* 판도라의 상자 전용: 출처 + 팩트체크 결과 — 마법 수정 구슬 등 제외 */}
        {post.category === '판도라의 상자' && (
          <PandoraDetail post={post} />
        )}

        {/* 작성자 & 인터랙션 바 (박스 형태) */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-2 p-2 border border-slate-100 rounded-2xl bg-slate-50/30 mb-2">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-slate-100 overflow-hidden border border-slate-200 shrink-0">
              <img src={authorData?.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${post.author}`} alt="avatar" className="w-full h-full object-cover" />
            </div>
            <div className="flex flex-col">
              <span className="font-[1000] text-[15px] text-slate-900 mb-0.5">{post.author}</span>
              <span className="text-[11px] text-slate-500 font-bold">
                Lv {userData.level} · {getReputationLabel(getReputationScore(userData))} · 깐부수 {formatKoreanNumber(friendCount)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <button
              onClick={() => onLikeClick?.(null, post.id)}
              className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl transition-all duration-300 font-[1000] text-[12px] whitespace-nowrap ${isLikedByMe ? 'bg-[#FF2E56] text-white ring-2 ring-rose-300 scale-105' : 'bg-white text-rose-400 border border-rose-200 hover:bg-rose-50'}`}
            >
              <svg className={`w-3.5 h-3.5 fill-current shrink-0`} viewBox="0 0 24 24" stroke="none"><path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" /></svg>
              {formatKoreanNumber(post.likes || 0)}
            </button>
            <button
              onClick={() => { if (!isMyPost && currentNickname) setShowThanksball(true); }}
              title={isMyPost ? '본인 글에는 땡스볼을 보낼 수 없습니다' : (currentNickname ? '땡스볼 보내기' : '로그인 후 이용하세요')}
              className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-[12px] font-[1000] whitespace-nowrap transition-all ${
                isMyPost || !currentNickname
                  ? 'bg-white text-slate-300 border-slate-200 cursor-default'
                  : 'bg-white text-amber-500 border-amber-200 hover:bg-amber-50 cursor-pointer'
              }`}
            >
              <span className="text-[14px] leading-none">⚾</span>
              <span>{(thanksballTotal || 0) > 0 ? `${thanksballTotal}볼` : '땡스볼'}</span>
            </button>
            {isMyPost ? (
              <div className="flex-1 md:flex-none flex flex-col items-center gap-1">
                <button
                  onClick={() => { setShowSelfMsg(true); setTimeout(() => setShowSelfMsg(false), 1000); }}
                  className="w-full md:w-auto px-3 py-2 text-[12px] font-[1000] rounded-xl border bg-white text-slate-300 border-slate-200 cursor-default whitespace-nowrap"
                >
                  + 깐부맺기
                </button>
                {showSelfMsg && (
                  <span className="text-[11px] font-bold text-rose-400 bg-rose-50 border border-rose-200 rounded-lg px-3 py-1.5 whitespace-nowrap">
                    본인은 이 세상 절대 깐부입니다 🚫
                  </span>
                )}
              </div>
            ) : (
              <button
                onClick={() => onToggleFriend()}
                className={`flex-1 md:flex-none px-3 py-2 text-[12px] font-[1000] rounded-xl border transition-all whitespace-nowrap ${isFriend ? 'bg-white text-slate-400 border-slate-200' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
              >
                {isFriend ? '깐부해제' : '+ 깐부맺기'}
              </button>
            )}
          </div>
        </div>

        {/* 땡스볼 모달 */}
        {showThanksball && currentNickname && (
          <ThanksballModal
            postId={post.id}
            postAuthor={post.author}
            postTitle={post.title}
            currentNickname={currentNickname}
            allUsers={allUsers}
            onClose={() => setShowThanksball(false)}
          />
        )}
      </div>
    </section>

    {/* 하단 통계 텍스트 — bgColor 영역 밖으로 분리, 댓글 영역의 시작점 */}
    <div className="flex items-center justify-between text-[13px] font-bold text-slate-500 bg-white border-t border-slate-100 px-6 py-2">
      {/* 좌: 댓글 / 연계글 */}
      <div className="flex gap-4">
        <span>댓글 <span className="font-black text-slate-700">{formatKoreanNumber(totalComment)}</span></span>
        {CATEGORY_RULES[post.category || ""]?.allowFormal && (
          <span>연계글 <span className="font-black text-slate-700">{formatKoreanNumber(totalFormal)}</span></span>
        )}
      </div>

      {/* 우: 동의 / 비동의 (pandora는 DebateBoard 헤더에서 표시하므로 생략) */}
      <div className="flex gap-4">
        {CATEGORY_RULES[post.category || ""]?.allowDisagree && CATEGORY_RULES[post.category || ""]?.boardType !== 'pandora' && (
          <>
            <span>동의 <span className="font-black text-slate-700">{formatKoreanNumber(uniqueAgreeCount)}</span></span>
            <span>비동의 <span className="font-black text-slate-700">{formatKoreanNumber(uniqueDisagreeCount)}</span></span>
          </>
        )}
      </div>
    </div>
    </>
  );
};

export default RootPostCard;
