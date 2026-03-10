// src/components/DiscussionView.tsx
import React, { useState, useEffect } from 'react';
import type { Post } from '../types';
import RootPostCard from './RootPostCard';
import DebateBoard from './DebateBoard';
import { formatKoreanNumber, getReputationLabel } from '../utils';

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
}

// 🚀 카테고리별 댓글/연계글 렌더링 룰 및 문구 정의
export const CATEGORY_RULES: Record<string, { 
  allowDisagree: boolean, 
  allowFormal: boolean,
  boardType: 'debate' | 'single' | 'qa' | 'info' | 'factcheck' | 'onecut',
  placeholder: string,
  tab1: string,
  tab2?: string
}> = {
  "나의 이야기": { allowDisagree: false, allowFormal: false, boardType: 'single', placeholder: "따뜻한 공감의 한마디를 남겨주시오...", tab1: "💬 댓글 전용", tab2: "👍 공감" },
  "너와 나의 이야기": { allowDisagree: false, allowFormal: false, boardType: 'single', placeholder: "따뜻한 공감의 한마디를 남겨주시오...", tab1: "💬 댓글 전용", tab2: "👍 공감" },
  "임금님 귀는 당나귀 귀": { allowDisagree: true, allowFormal: true, boardType: 'debate', placeholder: "당신의 논리적인 의견을 펼쳐보시오...", tab1: "👍 동의", tab2: "👎 반대" },
  "벌거벗은 임금님": { allowDisagree: true, allowFormal: false, boardType: 'factcheck', placeholder: "정확한 팩트를 제시해주시오...", tab1: "⭕ 진실 (동의)", tab2: "❌ 거짓 (반대)" },
  "유배·귀양지": { allowDisagree: true, allowFormal: false, boardType: 'single', placeholder: "할말을 남기시오...", tab1: "👍 동의", tab2: "👎 반대" },
  "뼈때리는 글": { allowDisagree: false, allowFormal: false, boardType: 'single', placeholder: "뼈때리는 한마디를 남겨주시오...", tab1: "💬 댓글 전용", tab2: "👍 공감" },
  "지식 소매상": { allowDisagree: false, allowFormal: false, boardType: 'qa', placeholder: "궁금한 점을 물어보거나 지식을 보태주시오...", tab1: "💬 질문/답변", tab2: "👍 유용해요" },
  "현지 소식": { allowDisagree: true, allowFormal: false, boardType: 'info', placeholder: "현지의 생생한 정보를 공유해주시오...", tab1: "👍 유용해요", tab2: "👎 별로예요" },
  "한컷": { allowDisagree: true, allowFormal: false, boardType: 'onecut', placeholder: "한컷에 대한 생각을 남겨주시오...", tab1: "👍 동의", tab2: "👎 반대" }
};

const DiscussionView = ({
  rootPost, allPosts, otherTopics, onTopicChange, userData, friends, onToggleFriend, 
  replyTarget, setReplyTarget, handleSubmit, selectedSide, setSelectedSide,
  selectedType, setSelectedType, newTitle, setNewTitle, newContent, setNewContent, isSubmitting,
  commentCounts = {}, onLikeClick, currentNickname, allUsers = {}, followerCounts = {}, onEditPost, toggleBlock
}: Props) => {
  const [isInputFocused, setIsInputFocused] = useState(false);

  const rule = CATEGORY_RULES[rootPost.category || "나의 이야기"] || CATEGORY_RULES["나의 이야기"];

  useEffect(() => {
    if (!rule.allowDisagree && selectedSide === 'right') setSelectedSide('left');
    if (!rule.allowFormal && selectedType === 'formal') setSelectedType('comment');
  }, [rootPost.category]);

  const getTimeAgo = (timestamp: any) => {
    if (!timestamp) return "";
    const now = new Date();
    const createdAt = new Date(timestamp.seconds * 1000);
    const diffInSeconds = Math.floor((now.getTime() - createdAt.getTime()) / 1000);
    if (diffInSeconds < 60) return "방금 전";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}분 전`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}시간 전`;
    return createdAt.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  };

  const filteredSideTopics = otherTopics.filter(topic => topic.id !== rootPost.id).slice(0, 10);

  const authorData = (rootPost.author_id && allUsers[rootPost.author_id]) || allUsers[`nickname_${rootPost.author}`];
  const realFollowers = followerCounts[rootPost.author] || 0;
  const displayLevel = authorData ? authorData.level : (rootPost.authorInfo?.level || 1);
  const displayLikes = authorData ? authorData.likes : (rootPost.authorInfo?.totalLikes || 0);
  const isLikedByMe = currentNickname && rootPost.likedBy?.includes(currentNickname);

  const linkedPost = otherTopics.find(p => p.id === rootPost.linkedPostId);

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-8 w-full max-w-[1600px] mx-auto animate-in fade-in duration-700 items-start pb-20">
      {/* Left Column: Post Details */}
      <div className="col-span-1 md:col-span-8 flex flex-col">
        
        {/* 🚀 일반 게시글일 경우 (콤팩트 RootPostCard 적용) */}
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
          />
        )}

        {/* 🚀 콤팩트 댓글/할말 입력 영역 (카테고리별 맞춤 탭 UI) */}
        <div className="bg-[#F8FAFC] md:px-8 py-8 border-b border-slate-200">
          <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
            <h4 className="font-[1000] text-slate-400 text-xs tracking-widest shrink-0 flex items-center gap-2">
              할말 남기기
              {replyTarget && (
                <span className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-900 text-white rounded text-[9px] ml-2">
                  🎯 {replyTarget.author}
                  <button onClick={() => setReplyTarget(null)} className="hover:text-rose-400 ml-1">✕</button>
                </span>
              )}
            </h4>

            {/* 카테고리별 탭 셀렉터 */}
            <div className="flex items-center gap-2">
               <button 
                 type="button" 
                 onClick={() => setSelectedSide('left')} 
                 className={`px-3 py-1.5 rounded-md text-[10px] font-[1000] transition-all border ${selectedSide === 'left' ? 'bg-white text-blue-600 border-blue-200 shadow-sm' : 'text-slate-400 border-transparent hover:bg-white hover:border-slate-200'}`}
               >
                 {rule.tab1}
               </button>
               {rule.allowDisagree && (
                 <button 
                   type="button" 
                   onClick={() => setSelectedSide('right')} 
                   className={`px-3 py-1.5 rounded-md text-[10px] font-[1000] transition-all border ${selectedSide === 'right' ? 'bg-white text-rose-500 border-rose-200 shadow-sm' : 'text-slate-400 border-transparent hover:bg-white hover:border-slate-200'}`}
                 >
                   {rule.tab2}
                 </button>
               )}
               {rule.allowFormal && (
                  <select 
                    value={selectedType} 
                    onChange={(e) => setSelectedType(e.target.value as any)} 
                    className="ml-2 bg-white border border-slate-200 rounded-md px-2 py-1.5 text-[10px] font-[1000] text-slate-600 outline-none cursor-pointer shadow-sm"
                  >
                    <option value="comment">일반 댓글</option>
                    <option value="formal">연계글 작성</option>
                  </select>
               )}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="relative mt-2">
             {selectedType === 'formal' && (
                <input 
                  value={newTitle} 
                  onChange={e => setNewTitle(e.target.value)} 
                  placeholder="연계글 제목을 입력하시오..." 
                  className="w-full bg-white border border-slate-200 border-b-0 rounded-t-lg px-5 py-3 text-[13px] font-black outline-none focus:border-slate-400 transition-all" 
                />
              )}
            <div className="relative">
              <textarea 
                value={newContent} onChange={e => setNewContent(e.target.value)}
                onFocus={() => setIsInputFocused(true)}
                placeholder={rule.placeholder}
                className={`w-full bg-white border border-slate-200 px-5 py-4 text-[13px] font-bold text-slate-700 outline-none focus:border-slate-400 transition-all resize-none shadow-sm ${isInputFocused ? 'h-32' : 'h-20'} ${selectedType === 'formal' ? 'rounded-b-lg' : 'rounded-lg'}`}
              />
              <button 
                type="submit" 
                disabled={isSubmitting || !newContent.trim()} 
                className="absolute bottom-3 right-3 bg-slate-900 text-white px-4 py-2 rounded-md text-[10px] font-[1000] shadow-md hover:bg-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed tracking-wider"
              >
                전송 🚀
              </button>
            </div>
          </form>
        </div>

        {/* 🚀 댓글 리스트 영역 (DebateBoard 내부에서 카테고리 룰에 따라 헤더가 변경됨) */}
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
          />
        </div>
      </div>

      {/* Right Column: Next Halmals */}
      <aside className="hidden md:block md:col-span-4 sticky top-0 pt-8">
        <div className="flex flex-col gap-4 max-h-[calc(100vh-100px)] overflow-y-auto no-scrollbar pb-20 pl-4 border-l border-slate-100">
          <div className="px-2 mb-2">
            <h4 className="text-[16px] font-[1000] text-slate-900 tracking-tighter">주목 할말 더보기</h4>
          </div>
          
          {filteredSideTopics.map((topic) => (
            <div 
              key={topic.id} onClick={() => onTopicChange(topic)}
              className="bg-white border-b border-slate-100 p-4 pb-6 cursor-pointer hover:bg-slate-50 transition-all group flex flex-col gap-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-slate-300">{getTimeAgo(topic.createdAt)}</span>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded-full bg-slate-50 border border-slate-100 overflow-hidden"><img src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${topic.author}`} alt="" /></div>
                  <span className="text-[9px] font-black text-slate-400">{topic.author}</span>
                </div>
              </div>
              
              <div className="flex gap-4">
                <div className="flex-1">
                  <h5 className="text-[13px] font-[1000] text-slate-900 line-clamp-2 leading-snug tracking-tighter group-hover:text-blue-600 transition-colors">{topic.title}</h5>
                  <p className="text-[11px] text-slate-400 line-clamp-1 mt-1 font-medium">{topic.content.replace(/<[^>]*>?/gm, '')}</p>
                </div>
                {topic.imageUrl && (
                  <div className="w-16 h-16 rounded-lg bg-slate-50 border border-slate-100 shrink-0 overflow-hidden">
                    <img src={topic.imageUrl} alt="" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 text-slate-300 text-[9px] font-black mt-1">
                <span>댓글 {formatKoreanNumber(commentCounts[topic.id] || 0)}</span>
                <span className={`${currentNickname && topic.likedBy?.includes(currentNickname) ? 'text-rose-400' : ''}`}>❤️ {formatKoreanNumber(topic.likes || 0)}</span>
              </div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
};

export default DiscussionView;
