// src/components/DiscussionView.tsx — 일반 게시글 상세 뷰 (2컬럼 레이아웃)
import React, { useEffect } from 'react';
import type { Post } from '../types';
import RootPostCard from './RootPostCard';
import DebateBoard from './DebateBoard';
import CommentMyStory from './CommentMyStory';
import CommentNakedKing from './CommentNakedKing';
import CommentDebate from './CommentDebate';
import CommentKnowledge from './CommentKnowledge';
import CommentBoneHitting from './CommentBoneHitting';
import CommentLocalNews from './CommentLocalNews';
import CommentExile from './CommentExile';

const CATEGORY_COMMENT_MAP: Record<string, React.FC<any>> = {
  '나의 이야기':         CommentMyStory,   // backward compat
  '너와 나의 이야기':    CommentMyStory,
  '판도라의 상자':       CommentNakedKing,
  '벌거벗은 임금님':     CommentNakedKing, // backward compat
  '솔로몬의 재판':       CommentDebate,
  '임금님 귀는 당나귀 귀': CommentDebate,  // backward compat
  '황금알을 낳는 거위':  CommentKnowledge,
  '지식 소매상':         CommentKnowledge, // backward compat
  '신포도와 여우':       CommentBoneHitting,
  '뼈때리는 글':         CommentBoneHitting, // backward compat
  '마법 수정 구슬':      CommentLocalNews,
  '현지 소식':           CommentLocalNews, // backward compat
  '유배·귀양지':         CommentExile,
};
import RelatedPostsSidebar from './RelatedPostsSidebar';

interface Props {
  rootPost: Post;
  allPosts: Post[];
  otherTopics: Post[];
  onTopicChange: (post: Post) => void;
  userData: any;
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
  allUsers?: Record<string, any>;
  followerCounts?: Record<string, number>;
  toggleBlock?: (author: string) => void;
  onEditPost?: (post: Post) => void;
  onInlineReply?: (content: string, parentPost: Post | null, side?: 'left' | 'right', imageUrl?: string, linkUrl?: string) => Promise<void>;
  onBack?: () => void;
}

// 🚀 카테고리별 댓글/연계글 렌더링 룰 및 문구 정의
export const CATEGORY_RULES: Record<string, {
  allowDisagree: boolean,
  allowFormal: boolean,
  boardType: 'debate' | 'single' | 'qa' | 'info' | 'factcheck' | 'onecut' | 'pandora',
  placeholder: string,
  tab1: string,
  tab2?: string,
  allowInlineReply?: boolean,  // 인라인 답글 폼 활성화 여부
  hideEmptyMessage?: boolean,  // 빈 상태 메시지 숨김 여부
}> = {
  "나의 이야기":          { allowDisagree: false, allowFormal: false, boardType: 'single',   placeholder: "따뜻한 공감의 한마디를 남겨보세요...", tab1: "💬 댓글 전용", tab2: "👍 공감", allowInlineReply: true, hideEmptyMessage: true },  // backward compat
  "너와 나의 이야기":     { allowDisagree: false, allowFormal: false, boardType: 'single',   placeholder: "따뜻한 공감의 한마디를 남겨보세요...", tab1: "💬 댓글 전용", tab2: "👍 공감", allowInlineReply: true, hideEmptyMessage: true },
  "솔로몬의 재판":        { allowDisagree: true,  allowFormal: true,  boardType: 'debate',   placeholder: "논리적인 의견을 펼쳐보세요...", tab1: "👍 동의", tab2: "👎 반대" },
  "임금님 귀는 당나귀 귀":{ allowDisagree: true,  allowFormal: true,  boardType: 'debate',   placeholder: "논리적인 의견을 펼쳐보세요...", tab1: "👍 동의", tab2: "👎 반대" },                  // backward compat
  "판도라의 상자":        { allowDisagree: true,  allowFormal: false, boardType: 'pandora',   placeholder: "정확한 팩트를 제시해 주세요...", tab1: "동의", tab2: "반박", allowInlineReply: true },
  "벌거벗은 임금님":      { allowDisagree: true,  allowFormal: false, boardType: 'pandora',   placeholder: "정확한 팩트를 제시해 주세요...", tab1: "동의", tab2: "반박", allowInlineReply: true },    // backward compat
  "유배·귀양지":          { allowDisagree: true,  allowFormal: false, boardType: 'single',   placeholder: "글을 남겨보세요...", tab1: "👍 동의", tab2: "👎 반대" },
  "신포도와 여우":        { allowDisagree: false, allowFormal: false, boardType: 'single',   placeholder: "뼈때리는 한마디를 남겨보세요...", tab1: "💬 댓글 전용", tab2: "👍 공감" },
  "뼈때리는 글":          { allowDisagree: false, allowFormal: false, boardType: 'single',   placeholder: "뼈때리는 한마디를 남겨보세요...", tab1: "💬 댓글 전용", tab2: "👍 공감" },             // backward compat
  "황금알을 낳는 거위":   { allowDisagree: false, allowFormal: false, boardType: 'qa',       placeholder: "궁금한 점을 묻거나 지식을 나눠주세요...", tab1: "💬 질문/답변", tab2: "👍 유용해요" },
  "지식 소매상":          { allowDisagree: false, allowFormal: false, boardType: 'qa',       placeholder: "궁금한 점을 묻거나 지식을 나눠주세요...", tab1: "💬 질문/답변", tab2: "👍 유용해요" }, // backward compat
  "마법 수정 구슬":       { allowDisagree: true,  allowFormal: false, boardType: 'info',     placeholder: "현지의 생생한 정보를 공유해 주세요...", tab1: "👍 유용해요", tab2: "👎 별로예요" },
  "현지 소식":            { allowDisagree: true,  allowFormal: false, boardType: 'info',     placeholder: "현지의 생생한 정보를 공유해 주세요...", tab1: "👍 유용해요", tab2: "👎 별로예요" },    // backward compat
  "한컷":                 { allowDisagree: true,  allowFormal: false, boardType: 'onecut',   placeholder: "한컷에 대한 생각을 남겨보세요...", tab1: "👍 동의", tab2: "👎 반대" }
};

const DiscussionView = ({
  rootPost, allPosts, otherTopics, onTopicChange, userData, friends, onToggleFriend,
  replyTarget, setReplyTarget, handleSubmit, selectedSide, setSelectedSide,
  selectedType, setSelectedType, newTitle, setNewTitle, newContent, setNewContent, isSubmitting,
  commentCounts = {}, onLikeClick, currentNickname, allUsers = {}, followerCounts = {}, onEditPost, onInlineReply, onBack
}: Props) => {
  const rule = CATEGORY_RULES[rootPost.category || "나의 이야기"] || CATEGORY_RULES["나의 이야기"];
  const CommentForm = CATEGORY_COMMENT_MAP[rootPost.category || '나의 이야기'] ?? CommentMyStory;

  useEffect(() => {
    if (!rule.allowDisagree && selectedSide === 'right') setSelectedSide('left');
    if (!rule.allowFormal && selectedType === 'formal') setSelectedType('comment');
  }, [rootPost.category, rule.allowDisagree, rule.allowFormal, selectedSide, selectedType, setSelectedSide, setSelectedType]);

  const now = Date.now();
  const relatedPosts = otherTopics.filter(topic => {
    if (topic.id === rootPost.id || topic.isOneCut) return false;
    if ((topic.likes || 0) < 3) return false;
    const createdMs = topic.createdAt?.seconds ? topic.createdAt.seconds * 1000 : 0;
    return (now - createdMs) >= 3600 * 1000;
  }).slice(0, 10);

  const authorData = (rootPost.author_id && allUsers[rootPost.author_id]) || allUsers[`nickname_${rootPost.author}`];
  const realFollowers = followerCounts[rootPost.author] || 0;
  const displayLevel = authorData ? authorData.level : (rootPost.authorInfo?.level || 1);
  const displayLikes = authorData ? authorData.likes : (rootPost.authorInfo?.totalLikes || 0);

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
          />
        )}

        {rootPost.category && !['너와 나의 이야기', '나의 이야기'].includes(rootPost.category) && rule.boardType !== 'pandora' && (
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
            />
          )
        )}

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
            rootPost={rootPost}
            allUsers={allUsers}
            followerCounts={followerCounts}
          />
        </div>
      </div>

      {/* 우측: 같은 카테고리 관련 글 목록 */}
      <RelatedPostsSidebar
        relatedPosts={relatedPosts}
        onPostClick={onTopicChange}
        commentCounts={commentCounts}
        currentNickname={currentNickname}
        allUsers={allUsers}
        followerCounts={followerCounts}
      />
    </div>
  );
};

export default DiscussionView;
