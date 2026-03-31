// src/components/RelatedPostsSidebar.tsx — 게시글 상세 우측 사이드바: 같은 카테고리 관련 글 목록
import type { Post, UserData } from '../types';
import { formatKoreanNumber, getReputationLabel, getCategoryDisplayName } from '../utils';

interface Props {
  relatedPosts: Post[];
  onPostClick: (post: Post) => void;
  commentCounts: Record<string, number>;
  currentNickname?: string;
  allUsers: Record<string, UserData>;
  followerCounts: Record<string, number>;
}

const RelatedPostsSidebar = ({
  relatedPosts, onPostClick, commentCounts, currentNickname, allUsers, followerCounts
}: Props) => {
  const getTimeAgo = (timestamp: { seconds: number } | null | undefined) => {
    if (!timestamp) return "";
    const now = new Date();
    const createdAt = new Date(timestamp.seconds * 1000);
    const diffInSeconds = Math.floor((now.getTime() - createdAt.getTime()) / 1000);
    if (diffInSeconds < 60) return "방금 전";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}분 전`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}시간 전`;
    return createdAt.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  };


  const extractFirstImage = (html: string) => {
    const div = document.createElement('div');
    div.innerHTML = html;
    const img = div.querySelector('img');
    return img ? img.src : null;
  };

  return (
    <aside className="hidden md:block md:col-span-4 sticky top-0 pt-2 bg-slate-50 rounded-xl">
      <div className="flex flex-col gap-0 max-h-[calc(100vh-100px)] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] pb-20 pl-4 pr-3 border-l-2 border-slate-200">
        <div className="px-2 mb-2">
          <h4 className="text-[16px] font-[1000] text-slate-900 tracking-tighter">등록글 더보기</h4>
        </div>

        {relatedPosts.map((topic) => {
          const topicImage = topic.imageUrl || extractFirstImage(topic.content);
          const topicAuthorData = (topic.author_id && allUsers[topic.author_id]) || allUsers[`nickname_${topic.author}`];
          const topicLevel = topicAuthorData ? topicAuthorData.level : (topic.authorInfo?.level || 1);
          const topicLikes = topicAuthorData ? (topicAuthorData.likes || 0) : (topic.authorInfo?.totalLikes || 0);
          const topicFollowers = followerCounts[topic.author] || 0;
          const isLiked = currentNickname && topic.likedBy?.includes(currentNickname);
          const goldStarCount = (topic.likedBy || []).filter(nick => {
            const ud = allUsers[`nickname_${nick}`];
            return ud && (ud.level || 1) >= 5;
          }).length;

          return (
            <div
              key={topic.id}
              onClick={() => onPostClick(topic)}
              className="bg-white mb-1.5 rounded-lg border border-slate-100 px-3 py-4 cursor-pointer hover:bg-slate-100 transition-all group flex flex-col gap-2"
            >
              {/* 시간 + 제목 */}
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] text-slate-300 font-black">{getTimeAgo(topic.createdAt)}</span>
                <h5 className="text-[14px] font-[1000] text-slate-900 line-clamp-2 leading-snug tracking-tighter group-hover:text-blue-600 transition-colors">
                  {topic.title}
                </h5>
              </div>

              {/* 본문 미리보기 */}
              <div className={`text-[12px] text-slate-500 leading-relaxed font-medium [&_img]:hidden [&_p]:mb-1 [&_p:last-child]:mb-0 [&_strong]:font-bold [&_em]:italic ${topicImage ? 'line-clamp-2' : 'line-clamp-4'}`}
                dangerouslySetInnerHTML={{ __html: topic.content }}
              />

              {/* 썸네일 이미지 */}
              {topicImage && (
                <div className="w-full aspect-[16/7] rounded-lg overflow-hidden bg-slate-50 border border-slate-50 shrink-0">
                  <img src={topicImage} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                </div>
              )}

              {/* 카테고리 + 작성자 + 댓글·좋아요 수 */}
              <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-50 mt-1">
                <span className="text-[10px] font-[1000] text-blue-500 bg-blue-50 px-2 py-0.5 rounded-md w-fit border border-blue-100/30">
                  {getCategoryDisplayName(topic.category)}
                </span>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-full bg-slate-50 overflow-hidden shrink-0 border-2 border-white shadow-sm ring-1 ring-slate-100">
                      <img src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${topic.author}`} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[11px] font-[1000] text-slate-900 truncate leading-none mb-0.5">{topic.author}</span>
                      <span className="text-[9px] font-bold text-slate-400 truncate">
                        Lv {topicLevel} · {getReputationLabel(topicLikes)} · 깐부 {formatKoreanNumber(topicFollowers)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 text-slate-300 text-[10px] font-black shrink-0">
                    {goldStarCount > 0 && (
                      <span className="flex items-center gap-0.5 text-amber-400">
                        <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                        {goldStarCount}
                      </span>
                    )}
                    {(topic.thanksballTotal || 0) > 0 && (
                      <span className="flex items-center gap-0.5 text-amber-400">
                        <span className="text-[13px]">⚾</span> {topic.thanksballTotal}
                      </span>
                    )}
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
  );
};

export default RelatedPostsSidebar;
