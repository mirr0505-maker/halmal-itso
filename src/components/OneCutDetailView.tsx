// src/components/OneCutDetailView.tsx — 한컷 상세 뷰 (마법 수정 구슬 레이아웃 기반)
import { useState, useEffect, useRef } from 'react';
import type { Post } from '../types';
import { formatKoreanNumber, getReputationLabel } from '../utils';
import OneCutListSidebar from './OneCutListSidebar';

interface Props {
  rootPost: Post;
  allPosts: Post[];
  otherTopics: Post[];
  onTopicChange: (post: Post) => void;
  userData?: any;
  onInlineReply: (content: string, parentPost: Post | null, side?: 'left' | 'right') => Promise<void>;
  onLikeClick?: (e: React.MouseEvent | null, postId: string) => void;
  currentNickname?: string;
  allUsers?: Record<string, any>;
  followerCounts?: Record<string, number>;
  commentCounts?: Record<string, number>;
  onEditPost?: (post: Post) => void;
  onBack?: () => void;
}

const OneCutDetailView = ({
  rootPost, allPosts, otherTopics, onTopicChange,
  onInlineReply, onLikeClick, currentNickname, allUsers = {}, followerCounts = {},
  commentCounts = {}, onEditPost, onBack
}: Props) => {
  const [imageError, setImageError] = useState(false);
  // 🚀 댓글 입력 내부 상태 — "공감해요(left) / 공감하기 힘들어요(right)"
  const [selectedSide, setSelectedSide] = useState<'left' | 'right'>('left');
  const [inputValue, setInputValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  // 공유 URL 복사 피드백
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setImageError(false); setInputValue(''); setSelectedSide('left'); }, [rootPost.id]);

  const authorData = (rootPost.author_id && allUsers[rootPost.author_id]) || allUsers[`nickname_${rootPost.author}`];
  const realFollowers = followerCounts[rootPost.author] || 0;
  const displayLevel = authorData ? authorData.level : (rootPost.authorInfo?.level || 1);
  const displayLikes = authorData ? authorData.likes : (rootPost.authorInfo?.totalLikes || 0);
  const isLikedByMe = currentNickname && rootPost.likedBy?.includes(currentNickname);
  const isMyPost = !!currentNickname && rootPost.author === currentNickname;

  // 공유 URL 복사 — RootPostCard와 동일 방식
  const handleCopyUrl = () => {
    const shareToken = rootPost.id.split('_').slice(0, 2).join('_');
    const shareUrl = `${window.location.origin}?post=${shareToken}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return "";
    const d = new Date(timestamp.seconds * 1000);
    const diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return "방금 전";
    if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
    return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  // 🚀 Enter 즉시 제출 — 전송 버튼 없음 (Shift+Enter = 줄바꿈, isComposing 보호)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submitComment();
    }
  };

  const submitComment = async () => {
    if (!inputValue.trim() || isSubmitting || !currentNickname) return;
    setIsSubmitting(true);
    try {
      await onInlineReply(inputValue.trim(), null, selectedSide);
      setInputValue('');
      inputRef.current?.focus();
    } finally {
      setIsSubmitting(false);
    }
  };

  // 댓글 목록: 최상위 댓글, 시간 오름차순
  const topComments = allPosts
    .filter(p => p.parentId === p.rootId)
    .sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));

  const agreeCount = allPosts.filter(p => p.side === 'left').length;
  const disagreeCount = allPosts.filter(p => p.side === 'right').length;

  const sideOneCuts = otherTopics.filter(t => (t.isOneCut || t.category === "한컷") && t.id !== rootPost.id);

  // 🚀 원본글 연결: linkedPostId로 내부 게시글 찾기 (연계글 작성 시 저장됨)
  const linkedPost = rootPost.linkedPostId
    ? otherTopics.find(p => p.id === rootPost.linkedPostId)
    : null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 w-full max-w-[1600px] mx-auto animate-in fade-in duration-700 items-start pb-20">

      {/* 메인 컬럼 */}
      <div className="col-span-1 md:col-span-9 flex flex-col">
        <section className="rounded-none flex flex-col mb-0 bg-white">

          {/* 헤더: ← 한컷 / 경과시간 / 공유 / 수정·삭제 */}
          <div className="flex-1 flex flex-col pt-8 px-4 md:px-8 pb-4">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <span
                  onClick={onBack}
                  className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-sm uppercase tracking-widest cursor-pointer hover:bg-blue-100 hover:text-blue-700 hover:-translate-x-0.5 transition-all duration-150 select-none"
                  title="한컷 목록으로 돌아가기"
                >
                  ← 한컷
                </span>
                <span className="text-[11px] font-bold text-slate-400">{formatTime(rootPost.createdAt)}</span>
              </div>
              <div className="flex items-center gap-3">
                {/* 공유 버튼 */}
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
                    <button onClick={() => onEditPost?.(rootPost)} className="text-[11px] font-bold text-slate-400 hover:text-blue-500 transition-colors">수정</button>
                  </>
                )}
              </div>
            </div>

            {/* 제목 */}
            <h2 className="text-[22px] font-[1000] mb-5 leading-snug tracking-tighter max-w-4xl text-slate-900">
              {rootPost.title}
            </h2>

            {/* 원본글 바로가기 — linkedPostId(내부) 또는 linkUrl(외부) */}
            {linkedPost && (
              <button
                onClick={() => onTopicChange(linkedPost)}
                className="group flex items-center gap-2 mb-5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all shadow-sm w-fit max-w-full"
              >
                <span className="text-sm">🔗</span>
                <span className="text-[12px] font-[1000] truncate">원본글: {linkedPost.title}</span>
                <svg className="w-3.5 h-3.5 shrink-0 opacity-80 group-hover:translate-x-0.5 transition-transform ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
              </button>
            )}
            {!linkedPost && rootPost.linkUrl && (
              <a
                href={rootPost.linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-2 mb-5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all shadow-sm w-fit max-w-full"
              >
                <span className="text-sm">🔗</span>
                <span className="text-[12px] font-[1000] truncate">원본글 바로가기</span>
                <svg className="w-3.5 h-3.5 shrink-0 opacity-80 group-hover:translate-x-0.5 transition-transform ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
              </a>
            )}

            {/* 이미지 — 본문 위 배치, 2/3 너비 */}
            {rootPost.imageUrl && !imageError && (
              <div className="w-full md:w-2/3 mb-5 rounded-2xl overflow-hidden border border-slate-100 bg-slate-50">
                <img
                  src={rootPost.imageUrl}
                  alt="한컷"
                  className="w-full h-auto object-contain max-h-[600px]"
                  onError={() => setImageError(true)}
                />
              </div>
            )}

            {/* 본문 텍스트 */}
            {rootPost.content && rootPost.content.trim() ? (
              <div className="text-[15px] mb-6 leading-[1.8] font-medium text-slate-700 max-w-none [&_p]:mb-4 [&_p:last-child]:mb-0 whitespace-pre-wrap">
                {rootPost.content}
              </div>
            ) : null}

            {/* 태그 */}
            {(rootPost.tags || []).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-5">
                {(rootPost.tags || []).map((tag, i) => (
                  <span key={i} className="text-[10px] font-black text-blue-500 bg-blue-50/50 px-2 py-0.5 rounded-[2px] border border-blue-100/30">#{tag}</span>
                ))}
              </div>
            )}
          </div>

          {/* 작성자 정보 + 통계 바 */}
          <div className="border-t border-slate-100 px-4 md:px-8 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-white border border-slate-100 shadow-sm overflow-hidden shrink-0">
                <img src={authorData?.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${rootPost.author}`} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="font-[1000] text-slate-900 text-sm leading-none tracking-tighter">{rootPost.author}</span>
                <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold">
                  <span className="bg-blue-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded-[2px] uppercase">Lv {displayLevel}</span>
                  <span className="w-px h-3 bg-slate-200" />
                  <span>{getReputationLabel(displayLikes)}</span>
                  <span className="w-px h-3 bg-slate-200" />
                  <span>깐부 {formatKoreanNumber(realFollowers)}</span>
                </div>
              </div>
            </div>
            {/* 댓글 수 + 좋아요 */}
            <div className="flex items-center gap-5">
              <div className="text-center">
                <p className="text-[9px] font-[1000] text-slate-300 uppercase tracking-widest">댓글</p>
                <p className="text-sm font-[1000] text-slate-900">{formatKoreanNumber(allPosts.length)}</p>
              </div>
              <button onClick={() => onLikeClick?.(null, rootPost.id)} className="flex flex-col items-center group transition-all active:scale-90">
                <p className="text-[9px] font-[1000] text-slate-300 uppercase tracking-widest group-hover:text-rose-400 transition-colors">좋아요</p>
                <div className="flex items-center gap-1">
                  <svg className={`w-3.5 h-3.5 transition-all ${isLikedByMe ? 'text-rose-500 fill-current' : 'text-slate-200 fill-none group-hover:text-rose-300'}`} stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" /></svg>
                  <span className={`text-sm font-[1000] ${isLikedByMe ? 'text-rose-500' : 'text-slate-900'}`}>{formatKoreanNumber(rootPost.likes || 0)}</span>
                </div>
              </button>
            </div>
          </div>

          {/* 🚀 댓글 입력 — 마법 수정 구슬 스타일: 탭(공감해요/공감하기 힘들어요) + Enter 즉시 제출 */}
          <div className="bg-[#F8FAFC] px-4 md:px-8 py-3 border-t border-slate-200">
            <div className="flex flex-col md:flex-row md:items-center gap-2 mb-2">
              <h4 className="font-[1000] text-slate-400 text-xs tracking-widest shrink-0">글 남기기</h4>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setSelectedSide('left'); inputRef.current?.focus(); }}
                  className={`px-3 py-1.5 rounded-md text-[10px] font-[1000] transition-all border ${selectedSide === 'left' ? 'bg-white text-blue-600 border-blue-200 shadow-sm' : 'text-slate-400 border-transparent hover:bg-white hover:border-slate-200'}`}
                >
                  👍 공감해요
                </button>
                <button
                  type="button"
                  onClick={() => { setSelectedSide('right'); inputRef.current?.focus(); }}
                  className={`px-3 py-1.5 rounded-md text-[10px] font-[1000] transition-all border ${selectedSide === 'right' ? 'bg-white text-rose-500 border-rose-200 shadow-sm' : 'text-slate-400 border-transparent hover:bg-white hover:border-slate-200'}`}
                >
                  👎 공감하기 힘들어요
                </button>
              </div>
            </div>
            {currentNickname ? (
              <div className="relative mt-1">
                <textarea
                  ref={inputRef}
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isSubmitting}
                  placeholder={selectedSide === 'left' ? '공감하는 이유를 남겨주세요... (Enter로 바로 입력)' : '공감하기 힘든 이유를 남겨주세요... (Enter로 바로 입력)'}
                  className="w-full bg-white border border-slate-200 rounded-lg px-5 py-4 text-[13px] font-bold text-slate-700 outline-none focus:border-slate-400 transition-all resize-none h-20 shadow-sm"
                />
                {/* 입력 중 side 인디케이터 */}
                {inputValue.trim() && (
                  <span className={`absolute bottom-3 right-3 text-[9px] font-black px-1.5 py-0.5 rounded ${selectedSide === 'left' ? 'text-blue-600 bg-blue-50' : 'text-rose-500 bg-rose-50'}`}>
                    {selectedSide === 'left' ? '👍 공감해요' : '👎 힘들어요'} · Enter↵
                  </span>
                )}
              </div>
            ) : (
              <p className="text-center text-[12px] font-bold text-slate-400 py-4">로그인 후 댓글을 남길 수 있습니다</p>
            )}
          </div>

          {/* 🚀 댓글 목록 — 심플 리스트, 빈 상태 메시지 없음 */}
          <div className="bg-white">
            {topComments.length > 0 && (
              <div className="border-t border-slate-100">
                {/* 공감 통계 헤더 */}
                <div className="flex border-b border-slate-100">
                  <div className="flex-1 py-2.5 flex items-center justify-center gap-1.5 border-r border-slate-100">
                    <span className="text-[11px] font-[1000] text-blue-600">👍 공감해요</span>
                    <span className="text-[10px] font-bold text-slate-300">{agreeCount}</span>
                  </div>
                  <div className="flex-1 py-2.5 flex items-center justify-center gap-1.5">
                    <span className="text-[11px] font-[1000] text-rose-500">👎 공감하기 힘들어요</span>
                    <span className="text-[10px] font-bold text-slate-300">{disagreeCount}</span>
                  </div>
                </div>

                {/* 댓글 카드 */}
                <div className="flex flex-col divide-y divide-slate-50 px-4 md:px-8">
                  {topComments.map(comment => {
                    const isLiked = !!(currentNickname && (comment.likedBy || []).includes(currentNickname));
                    const commentAuthorData = (comment.author_id && allUsers[comment.author_id]) || allUsers[`nickname_${comment.author}`];
                    const commentLevel = commentAuthorData ? commentAuthorData.level : (comment.authorInfo?.level || 1);
                    const isAgree = comment.side === 'left';
                    return (
                      <div key={comment.id} className="flex items-start gap-2.5 py-3 group">
                        {/* 아바타 */}
                        <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 border border-slate-100 mt-0.5">
                          <img src={commentAuthorData?.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${comment.author}`} alt="" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                            <span className="font-black text-[12px] text-slate-700">{comment.author}</span>
                            <span className="text-[9px] font-bold text-slate-300">Lv{commentLevel}</span>
                            {/* 공감 여부 배지 */}
                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${isAgree ? 'text-blue-500 bg-blue-50' : 'text-rose-400 bg-rose-50'}`}>
                              {isAgree ? '👍 공감해요' : '👎 공감하기 힘들어요'}
                            </span>
                            <span className="text-[9px] font-bold text-slate-300">{formatTime(comment.createdAt)}</span>
                          </div>
                          <p className="text-[13px] font-medium text-slate-700 leading-relaxed whitespace-pre-line break-words">{comment.content}</p>
                        </div>
                        {/* 좋아요 */}
                        <button
                          onClick={e => { e.stopPropagation(); onLikeClick?.(e, comment.id); }}
                          className={`flex items-center gap-1 text-[11px] font-bold shrink-0 transition-colors mt-0.5 ${isLiked ? 'text-rose-500' : 'text-slate-200 hover:text-rose-400'}`}
                        >
                          <svg className={`w-3 h-3 ${isLiked ? 'fill-current' : 'fill-none'}`} stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                          </svg>
                          {comment.likes || 0}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

        </section>
      </div>

      {/* 우측: 다른 한컷 목록 */}
      <OneCutListSidebar
        oneCuts={sideOneCuts}
        onOneCutClick={onTopicChange}
        commentCounts={commentCounts}
        allUsers={allUsers}
        followerCounts={followerCounts}
      />
    </div>
  );
};

export default OneCutDetailView;
