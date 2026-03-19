// src/components/DiscussionView.tsx
import React, { useState, useEffect } from 'react';
import type { Post } from '../types';
import RootPostCard from './RootPostCard';
import DebateBoard from './DebateBoard';
import { formatKoreanNumber, getReputationLabel, getCategoryDisplayName } from '../utils';

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
  "나의 이야기": { allowDisagree: false, allowFormal: false, boardType: 'single', placeholder: "따뜻한 공감의 한마디를 남겨보세요...", tab1: "💬 댓글 전용", tab2: "👍 공감" },
  "너와 나의 이야기": { allowDisagree: false, allowFormal: false, boardType: 'single', placeholder: "따뜻한 공감의 한마디를 남겨보세요...", tab1: "💬 댓글 전용", tab2: "👍 공감" },
  "임금님 귀는 당나귀 귀": { allowDisagree: true, allowFormal: true, boardType: 'debate', placeholder: "논리적인 의견을 펼쳐보세요...", tab1: "👍 동의", tab2: "👎 반대" },
  "벌거벗은 임금님": { allowDisagree: true, allowFormal: false, boardType: 'factcheck', placeholder: "정확한 팩트를 제시해 주세요...", tab1: "⭕ 진실 (동의)", tab2: "❌ 거짓 (반대)" },
  "유배·귀양지": { allowDisagree: true, allowFormal: false, boardType: 'single', placeholder: "글을 남겨보세요...", tab1: "👍 동의", tab2: "👎 반대" },
  "뼈때리는 글": { allowDisagree: false, allowFormal: false, boardType: 'single', placeholder: "뼈때리는 한마디를 남겨보세요...", tab1: "💬 댓글 전용", tab2: "👍 공감" },
  "지식 소매상": { allowDisagree: false, allowFormal: false, boardType: 'qa', placeholder: "궁금한 점을 묻거나 지식을 나눠주세요...", tab1: "💬 질문/답변", tab2: "👍 유용해요" },
  "현지 소식": { allowDisagree: true, allowFormal: false, boardType: 'info', placeholder: "현지의 생생한 정보를 공유해 주세요...", tab1: "👍 유용해요", tab2: "👎 별로예요" },
  "한컷": { allowDisagree: true, allowFormal: false, boardType: 'onecut', placeholder: "한컷에 대한 생각을 남겨보세요...", tab1: "👍 동의", tab2: "👎 반대" }
};

const DiscussionView = ({
  rootPost, allPosts, otherTopics, onTopicChange, userData, friends, onToggleFriend, 
  replyTarget, setReplyTarget, handleSubmit, selectedSide, setSelectedSide,
  selectedType, setSelectedType, newTitle, setNewTitle, newContent, setNewContent, isSubmitting,
  commentCounts = {}, onLikeClick, currentNickname, allUsers = {}, followerCounts = {}, onEditPost
}: Props) => {
  const [isInputFocused, setIsInputFocused] = useState(false);

  const rule = CATEGORY_RULES[rootPost.category || "나의 이야기"] || CATEGORY_RULES["나의 이야기"];

  useEffect(() => {
    if (!rule.allowDisagree && selectedSide === 'right') setSelectedSide('left');
    if (!rule.allowFormal && selectedType === 'formal') setSelectedType('comment');
  }, [rootPost.category, rule.allowDisagree, rule.allowFormal, selectedSide, selectedType, setSelectedSide, setSelectedType]);

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

  const filteredSideTopics = otherTopics.filter(topic => topic.id !== rootPost.id && !topic.isOneCut).slice(0, 10);

  const stripHtml = (html: string) => {
    const tmp = document.createElement("DIV");
    tmp.innerHTML = html;
    return tmp.innerText || tmp.textContent || "";
  };

  const extractFirstImage = (html: string) => {
    const div = document.createElement('div');
    div.innerHTML = html;
    const img = div.querySelector('img');
    return img ? img.src : null;
  };

  const authorData = (rootPost.author_id && allUsers[rootPost.author_id]) || allUsers[`nickname_${rootPost.author}`];
  const realFollowers = followerCounts[rootPost.author] || 0;
  const displayLevel = authorData ? authorData.level : (rootPost.authorInfo?.level || 1);
  const displayLikes = authorData ? authorData.likes : (rootPost.authorInfo?.totalLikes || 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 w-full max-w-[1600px] mx-auto animate-in fade-in duration-700 items-start pb-20">
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
              글 남기기
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
               {rule.allowDisagree && rule.tab2 && (
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
                  placeholder="연계글 제목을 입력하세요..." 
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
      <aside className="hidden md:block md:col-span-4 sticky top-0 pt-2 bg-slate-50 rounded-xl">
        <div className="flex flex-col gap-0 max-h-[calc(100vh-100px)] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] pb-20 pl-4 pr-3 border-l-2 border-slate-200">
          <div className="px-2 mb-2">
            <h4 className="text-[16px] font-[1000] text-slate-900 tracking-tighter">등록글 더보기</h4>
          </div>
          
          {filteredSideTopics.map((topic) => {
            const topicImage = topic.imageUrl || extractFirstImage(topic.content);
            const topicAuthorData = (topic.author_id && allUsers[topic.author_id]) || allUsers[`nickname_${topic.author}`];
            const topicLevel = topicAuthorData ? topicAuthorData.level : (topic.authorInfo?.level || 1);
            const topicLikes = topicAuthorData ? (topicAuthorData.likes || 0) : (topic.authorInfo?.totalLikes || 0);
            const topicFollowers = followerCounts[topic.author] || 0;
            const isLiked = currentNickname && topic.likedBy?.includes(currentNickname);

            return (
              <div
                key={topic.id} onClick={() => onTopicChange(topic)}
                className="bg-white border-b border-slate-200 px-3 py-4 cursor-pointer hover:bg-slate-100 transition-all group flex flex-col gap-2"
              >
                {/* 1. 시간 + 제목 */}
                <div className="flex flex-col gap-0.5">
                  <span className="text-[9px] text-slate-300 font-black">{getTimeAgo(topic.createdAt)}</span>
                  <h5 className="text-[13px] font-[1000] text-slate-900 line-clamp-2 leading-snug tracking-tighter group-hover:text-blue-600 transition-colors">
                    {topic.title}
                  </h5>
                </div>

                {/* 2. 본문 미리보기 */}
                <p className={`text-[11px] text-slate-500 leading-relaxed font-medium ${topicImage ? 'line-clamp-2' : 'line-clamp-4'}`}>
                  {stripHtml(topic.content)}
                </p>

                {/* 3. 이미지 */}
                {topicImage && (
                  <div className="w-full aspect-video rounded-xl overflow-hidden bg-slate-50 border border-slate-50 shrink-0">
                    <img src={topicImage} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  </div>
                )}

                {/* 4. 카테고리 + 아바타/정보 + 댓글·좋아요 */}
                <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-50 mt-1">
                  <span className="text-[8px] font-[1000] text-blue-500 bg-blue-50 px-2 py-0.5 rounded-md w-fit border border-blue-100/30">
                    {getCategoryDisplayName(topic.category)}
                  </span>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 rounded-full bg-slate-50 overflow-hidden shrink-0 border-2 border-white shadow-sm ring-1 ring-slate-100">
                        <img src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${topic.author}`} alt="" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[10px] font-[1000] text-slate-900 truncate leading-none mb-0.5">{topic.author}</span>
                        <span className="text-[8px] font-bold text-slate-400 truncate">
                          Lv {topicLevel} · {getReputationLabel(topicLikes)} · 깐부 {formatKoreanNumber(topicFollowers)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 text-slate-300 text-[9px] font-black shrink-0">
                      <span className="flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                        {formatKoreanNumber(commentCounts[topic.id] || 0)}
                      </span>
                      <span className={`flex items-center gap-1 ${isLiked ? 'text-rose-400' : ''}`}>
                        <svg className={`w-3 h-3 ${isLiked ? 'fill-current' : 'fill-none'}`} stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
                        {formatKoreanNumber(topic.likes || 0)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </aside>
    </div>
  );
};

export default DiscussionView;
