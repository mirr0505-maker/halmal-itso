// src/components/DiscussionView.tsx — 일반 게시글 상세 뷰 (2컬럼 레이아웃)
import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import type { Post, UserData, KanbuRoom } from '../types';
import { EXILE_CATEGORY } from '../types';
import RootPostCard from './RootPostCard';
import DebateBoard from './DebateBoard';
import AdSlot from './ads/AdSlot';
import OneCutCommentBoard from './OneCutCommentBoard'; // 🚀 황금알을 낳는 거위 작성자(좌)↔독자(우) 지그재그 보드
import CommentMyStory from './CommentMyStory';
import CommentNakedKing from './CommentNakedKing';
import CommentDebate from './CommentDebate';
import CommentKnowledge from './CommentKnowledge';
import CommentBoneHitting from './CommentBoneHitting';
import CommentLocalNews from './CommentLocalNews';
import CommentExile from './CommentExile';

// 카테고리별 댓글 폼 컴포넌트 맵 — 각 컴포넌트가 서로 다른 props 타입을 가지므로
// as unknown as 캐스팅으로 heterogeneous 컴포넌트 맵 허용
const CATEGORY_COMMENT_MAP = {
  '너와 나의 이야기':    CommentMyStory,
  '판도라의 상자':       CommentNakedKing,
  '솔로몬의 재판':       CommentDebate,
  '황금알을 낳는 거위':  CommentKnowledge,
  '신포도와 여우':       CommentBoneHitting,
  '마법 수정 구슬':      CommentLocalNews,
  '마라톤의 전령':       CommentLocalNews,  // pandora 스타일 — 공감/의심 2컬럼 토론
  '유배·귀양지':         CommentExile,
} as unknown as Record<string, React.ComponentType<Record<string, unknown>>>;
import RelatedPostsSidebar from './RelatedPostsSidebar';
import { calculateLevel } from '../utils';

interface Props {
  rootPost: Post;
  allPosts: Post[];
  otherTopics: Post[];
  onTopicChange: (post: Post) => void;
  userData: UserData;
  friends: string[];
  onToggleFriend: (author: string) => void;
  onPostClick: (post: Post) => void;
  replyTarget: Post | null;
  setReplyTarget: (post: Post | null) => void;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  selectedSide: 'left' | 'right';
  setSelectedSide: (side: 'left' | 'right') => void;
  selectedType: 'comment' | 'formal';
  setSelectedType: (type: 'comment' | 'formal') => void;
  newTitle: string;
  setNewTitle: (t: string) => void;
  newContent: string;
  setNewContent: (c: string) => void;
  isSubmitting: boolean;
  commentCounts?: Record<string, number>;
  onLikeClick?: (e: React.MouseEvent | null, postId: string) => void;
  currentNickname?: string;
  allUsers?: Record<string, UserData>;
  followerCounts?: Record<string, number>;
  toggleBlock?: (author: string) => void;
  onEditPost?: (post: Post) => void;
  onInlineReply?: (content: string, parentPost: Post | null, side?: 'left' | 'right', imageUrl?: string, linkUrl?: string) => Promise<void>;
  onOpenLinkedPost?: (side: 'left' | 'right') => void;  // 솔로몬의 재판 연계글 팝업 트리거
  onNavigateToPost?: (postId: string) => void;           // 연계글에서 원본글로 이동
  onBack?: () => void;
  onAuthorClick?: (nickname: string) => void;            // 🚀 공개프로필 이동
}

// 🚀 카테고리별 댓글/연계글 렌더링 룰 및 문구 정의
export const CATEGORY_RULES: Record<string, {
  allowDisagree: boolean,
  allowFormal: boolean,
  boardType: 'debate' | 'single' | 'qa' | 'info' | 'factcheck' | 'onecut' | 'pandora',
  placeholder: string,
  tab1: string,
  tab2?: string,
  allowInlineReply?: boolean,   // 인라인 답글 폼 활성화 여부
  hideEmptyMessage?: boolean,   // 빈 상태 메시지 숨김 여부
  hintAgree?: string,           // pandora 좌측 힌트 텍스트 (미지정 시 tab1 기반 자동 생성)
  hintRefute?: string,          // pandora 우측 힌트 텍스트
  placeholderAgree?: string,    // pandora 좌측 textarea placeholder
  placeholderRefute?: string,   // pandora 우측 textarea placeholder
  hideAttachment?: boolean,     // pandora 이미지·링크 첨부 버튼 숨김 여부
}> = {
  "너와 나의 이야기":     { allowDisagree: false, allowFormal: false, boardType: 'single',   placeholder: "따뜻한 공감의 한마디를 남겨보세요...", tab1: "💬 댓글 전용", tab2: "👍 공감", allowInlineReply: true, hideEmptyMessage: true },
  "솔로몬의 재판":        { allowDisagree: true,  allowFormal: false, boardType: 'pandora',  placeholder: "논리적인 의견을 펼쳐보세요...", tab1: "동의", tab2: "비동의", allowInlineReply: true, hintAgree: "동의하는 이유를 작성하세요", hintRefute: "비동의하는 이유를 작성하세요", placeholderAgree: "동의 근거를 적어주세요...", placeholderRefute: "비동의 이유를 적어주세요..." },
  "판도라의 상자":        { allowDisagree: true,  allowFormal: false, boardType: 'pandora',   placeholder: "정확한 팩트를 제시해 주세요...", tab1: "동의", tab2: "반박", allowInlineReply: true },
  "유배·귀양지":          { allowDisagree: true,  allowFormal: false, boardType: 'pandora',  placeholder: "댓글을 입력하세요...", tab1: "👍 동의", tab2: "👎 반대", allowInlineReply: true, hintAgree: "동의하는 이유를 남겨주세요", hintRefute: "반대하는 이유를 남겨주세요", placeholderAgree: "댓글을 입력하세요...", placeholderRefute: "댓글을 입력하세요...", hideAttachment: true },
  "신포도와 여우":        { allowDisagree: false, allowFormal: false, boardType: 'single',   placeholder: "뼈때리는 한마디를 남겨보세요...", tab1: "💬 댓글 전용", tab2: "👍 공감", allowInlineReply: true, hideEmptyMessage: true },
  "황금알을 낳는 거위":   { allowDisagree: false, allowFormal: false, boardType: 'qa',       placeholder: "궁금한 점을 묻거나 지식을 나눠주세요...", tab1: "💬 질문/답변", tab2: "👍 유용해요" },
  "마법 수정 구슬":       { allowDisagree: true,  allowFormal: false, boardType: 'pandora',  placeholder: "현지의 생생한 정보를 공유해 주세요...", tab1: "유용해요", tab2: "별로예요", allowInlineReply: true, hintAgree: "유용한 정보 고마워요", hintRefute: "별로라고 생각해요 그래도 정보 고마워요", placeholderAgree: "유용한 정보 감사 댓글 적어 주세요", placeholderRefute: "정보가 별로인 이유가 뭔가요 적어 주세요", hideAttachment: true },
  "현지 소식":            { allowDisagree: true,  allowFormal: false, boardType: 'pandora',  placeholder: "현지의 생생한 정보를 공유해 주세요...", tab1: "유용해요", tab2: "별로예요", allowInlineReply: true, hintAgree: "유용한 정보 고마워요", hintRefute: "별로라고 생각해요 그래도 정보 고마워요", placeholderAgree: "유용한 정보 감사 댓글 적어 주세요", placeholderRefute: "정보가 별로인 이유가 뭔가요 적어 주세요", hideAttachment: true }, // backward compat
  "마라톤의 전령":        { allowDisagree: false, allowFormal: false, boardType: 'pandora',  placeholder: "뉴스에 대한 의견을 남겨주세요...", tab1: "공감해요", tab2: "의심스러워요", allowInlineReply: true, hintAgree: "이 뉴스에 공감해요", hintRefute: "이 뉴스가 의심스러워요", placeholderAgree: "공감하는 이유를 적어주세요...", placeholderRefute: "의심스러운 이유를 적어주세요...", hideAttachment: true },
  "한컷":                 { allowDisagree: true,  allowFormal: false, boardType: 'onecut',   placeholder: "한컷에 대한 생각을 남겨보세요...", tab1: "👍 동의", tab2: "👎 반대" }
};

const DiscussionView = ({
  rootPost, allPosts, otherTopics, onTopicChange, userData, friends, onToggleFriend,
  replyTarget, setReplyTarget, handleSubmit, selectedSide, setSelectedSide,
  selectedType, setSelectedType, newTitle, setNewTitle, newContent, setNewContent, isSubmitting,
  commentCounts = {}, onLikeClick, currentNickname, allUsers = {}, followerCounts = {}, onEditPost, onInlineReply, onOpenLinkedPost, onNavigateToPost, onBack, onAuthorClick
}: Props) => {
  const rule = CATEGORY_RULES[rootPost.category || "너와 나의 이야기"] || CATEGORY_RULES["너와 나의 이야기"];
  const CommentForm = CATEGORY_COMMENT_MAP[rootPost.category || '너와 나의 이야기'] ?? CommentMyStory;

  useEffect(() => {
    if (!rule.allowDisagree && selectedSide === 'right') setSelectedSide('left');
    if (!rule.allowFormal && selectedType === 'formal') setSelectedType('comment');
  }, [rootPost.category, rule.allowDisagree, rule.allowFormal, selectedSide, selectedType, setSelectedSide, setSelectedType]);

  const now = Date.now();
  // 🏚️ 유배·귀양지(곳간/귀양지/절해고도 3단계 공통)는 트래픽이 적어
  //    "등록글" 기준(좋아요 3+ & 1시간) 적용 시 사이드바가 비는 문제 →
  //    likes·시간 필터를 스킵하고 isHiddenByExile(문제글 soft-delete)만 제외
  const isExile = rootPost.category === EXILE_CATEGORY;
  const isKanbu = !!rootPost.kanbuRoomId;

  // 🔒 깐부방 유료 게시판 접근 검증 — 글 상세 URL 직접 접근 차단
  const [kanbuRoom, setKanbuRoom] = useState<KanbuRoom | null>(null);
  useEffect(() => {
    if (!rootPost.kanbuRoomId) return;
    return onSnapshot(doc(db, 'kanbu_rooms', rootPost.kanbuRoomId), snap => {
      if (snap.exists()) setKanbuRoom({ id: snap.id, ...snap.data() } as KanbuRoom);
    });
  }, [rootPost.kanbuRoomId]);

  const isPaidBoard = rootPost.kanbuBoardType === 'paid_once' || rootPost.kanbuBoardType === 'paid_monthly';
  const paidAccessOk = !isPaidBoard
    || !kanbuRoom
    || kanbuRoom.creatorId === userData?.uid
    || (rootPost.kanbuBoardType === 'paid_once' && kanbuRoom.paidOnceMembers?.includes(userData?.uid || ''))
    || (rootPost.kanbuBoardType === 'paid_monthly' && kanbuRoom.paidMonthlyMembers?.includes(userData?.uid || ''));
  const relatedPosts = otherTopics.filter(topic => {
    if (topic.id === rootPost.id || topic.isOneCut) return false;
    if (topic.isHiddenByExile) return false;
    // 🏚️ 유배·귀양지 / 🏠 깐부방: 좋아요·시간 필터 스킵 (해당 범위 전체 표시)
    if (isExile || isKanbu) return true;
    if ((topic.likes || 0) < 3) return false;
    const createdMs = topic.createdAt?.seconds ? topic.createdAt.seconds * 1000 : 0;
    return (now - createdMs) >= 3600 * 1000;
  }).slice(0, 10);

  const authorData = (rootPost.author_id && allUsers[rootPost.author_id]) || allUsers[`nickname_${rootPost.author}`];
  const realFollowers = followerCounts[rootPost.author] || 0;
  const displayLevel = calculateLevel(authorData?.exp || 0);
  const displayLikes = authorData ? authorData.likes : (rootPost.authorInfo?.totalLikes || 0);

  // 🔒 유료 게시판 접근 차단 — 페이월 화면
  if (isPaidBoard && !paidAccessOk && kanbuRoom) {
    const label = rootPost.kanbuBoardType === 'paid_once' ? '1회 결제' : '월 구독';
    const boardTitle = rootPost.kanbuBoardType === 'paid_once'
      ? kanbuRoom.paidBoards?.once?.title
      : kanbuRoom.paidBoards?.monthly?.title;
    return (
      <div className="w-full max-w-[640px] mx-auto py-20 px-6 text-center animate-in fade-in">
        <p className="text-[40px] mb-4">🔒</p>
        <p className="text-[15px] font-[1000] text-slate-800 mb-2">{boardTitle || '유료 게시판'}</p>
        <p className="text-[12px] font-bold text-slate-500 mb-6">
          이 글은 {label} 멤버만 열람할 수 있습니다.<br />
          깐부방에 입장하여 결제 후 이용해주세요.
        </p>
        <button onClick={() => onBack?.()}
          className="px-5 py-2 bg-slate-900 hover:bg-slate-700 text-white rounded-lg text-[12px] font-[1000] transition-colors">
          목록으로 돌아가기
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 w-full max-w-[1600px] mx-auto animate-in fade-in duration-700 items-start pb-20">
      {/* 좌측: 게시글 본문 + 댓글 폼 + 댓글 목록 */}
      <div className="col-span-1 md:col-span-8 flex flex-col">
        {!rootPost.isOneCut && (
          <RootPostCard
            post={rootPost}
            totalComment={allPosts.filter(p => p.type === 'comment').length}
            totalFormal={allPosts.filter(p => p.type === 'formal').length}
            uniqueAgreeCount={allPosts.filter(p => p.side === 'left').length}
            uniqueDisagreeCount={allPosts.filter(p => p.side === 'right').length}
            isFriend={friends.includes(rootPost.author)}
            onToggleFriend={() => onToggleFriend(rootPost.author)}
            userData={{ level: displayLevel, likes: displayLikes, bio: authorData?.bio || "" }}
            friendCount={realFollowers}
            onLikeClick={onLikeClick}
            currentNickname={currentNickname}
            onEdit={onEditPost}
            onBack={onBack}
            thanksballTotal={rootPost.thanksballTotal}
            allUsers={allUsers}
            onNavigateToPost={onNavigateToPost}
            onAuthorClick={onAuthorClick}
          />
        )}

        {/* 🚀 ADSMARKET: 본문과 댓글 사이 광고 슬롯 */}
        {/* 🚀 플랫폼 광고 (Lv2+, 자체 프로모션) */}
        <AdSlot position="bottom" postCategory={rootPost.category} postAuthorLevel={displayLevel} type="platform" />
        {/* 🚀 작성자 광고 (Lv5+, 경매/애드센스) */}
        <AdSlot position="bottom" postCategory={rootPost.category} postId={rootPost.id} postAuthorId={rootPost.author_id} postAuthorLevel={displayLevel} type="creator" adSlotEnabled={!!(rootPost as unknown as { adSlotEnabled?: boolean }).adSlotEnabled} />

        {rootPost.category && !['너와 나의 이야기', '신포도와 여우', '황금알을 낳는 거위'].includes(rootPost.category) && rule.boardType !== 'pandora' && (
          !currentNickname ? (
            <div className="flex items-center justify-center gap-2 px-6 py-4 bg-slate-50 border-b border-slate-100 text-[13px] font-bold text-slate-400">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
              댓글을 작성하려면 로그인이 필요합니다.
            </div>
          ) : (
            <CommentForm
              replyTarget={replyTarget}
              setReplyTarget={setReplyTarget}
              selectedSide={selectedSide}
              setSelectedSide={setSelectedSide}
              selectedType={selectedType}
              setSelectedType={setSelectedType}
              newTitle={newTitle}
              setNewTitle={setNewTitle}
              newContent={newContent}
              setNewContent={setNewContent}
              isSubmitting={isSubmitting}
              handleSubmit={handleSubmit}
              placeholder={rule.placeholder}
            />
          )
        )}

        {/* 🚀 황금알을 낳는 거위: 작성자(좌) ↔ 독자(우) 지그재그 전용 보드 */}
        {rootPost.category === '황금알을 낳는 거위' ? (
          <div className="bg-white px-4">
            <OneCutCommentBoard
              allChildPosts={allPosts}
              rootPost={rootPost}
              currentNickname={currentNickname}
              currentUserData={userData}
              onLikeClick={onLikeClick}
              onInlineReply={onInlineReply}
              allUsers={allUsers}
              followerCounts={followerCounts}
            />
          </div>
        ) : (
          <div className="bg-white">
            <DebateBoard
              allChildPosts={allPosts}
              setReplyTarget={setReplyTarget}
              onPostClick={onTopicChange}
              currentUserData={userData}
              currentUserFriends={friends}
              onLikeClick={onLikeClick}
              currentNickname={currentNickname}
              category={rootPost.category || "나의 이야기"}
              onInlineReply={onInlineReply}
              onOpenLinkedPost={onOpenLinkedPost}
              onNavigateToPost={onNavigateToPost}
              rootPost={rootPost}
              allUsers={allUsers}
              followerCounts={followerCounts}
              onAuthorClick={onAuthorClick}
            />
          </div>
        )}
      </div>

      {/* 우측: 같은 카테고리 관련 글 목록 */}
      <RelatedPostsSidebar
        relatedPosts={relatedPosts}
        onPostClick={onTopicChange}
        commentCounts={commentCounts}
        currentNickname={currentNickname}
        allUsers={allUsers}
        followerCounts={followerCounts}
        title={isExile || isKanbu ? '게시글 더보기' : '등록글 더보기'}
      />
    </div>
  );
};

export default DiscussionView;
