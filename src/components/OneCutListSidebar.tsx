// src/components/OneCutListSidebar.tsx — 한컷 상세 화면 우측 사이드바: 다른 한컷 목록
import type { Post, UserData } from '../types';
import { formatKoreanNumber, getReputationLabel } from '../utils';

interface Props {
  oneCuts: Post[];
  onOneCutClick: (post: Post) => void;
  commentCounts: Record<string, number>;
  allUsers: Record<string, UserData>;
  followerCounts: Record<string, number>;
}

const OneCutListSidebar = ({ oneCuts, onOneCutClick, commentCounts, allUsers, followerCounts }: Props) => {
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

  return (
    <aside className="hidden md:block md:col-span-3 sticky top-0 pt-2 bg-slate-50 rounded-xl max-h-[calc(100vh-100px)] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] border-l-2 border-slate-200">
      <div className="flex flex-col gap-4 pb-20 pl-4 pr-2">
        <div className="px-3 mb-2">
          <h4 className="text-[16px] font-[1000] text-slate-900 tracking-tighter">다른 한컷 보기</h4>
        </div>

        {oneCuts.slice(0, 20).map((topic) => {
          const tAuthor = (topic.author_id && allUsers[topic.author_id]) || allUsers[`nickname_${topic.author}`];
          const tLevel = tAuthor ? tAuthor.level : (topic.authorInfo?.level || 1);
          const tLikes = tAuthor ? (tAuthor.likes || 0) : (topic.authorInfo?.totalLikes || 0);
          const tFollowers = followerCounts[topic.author] || 0;
          const tComments = commentCounts[topic.id] || 0;

          return (
            <div
              key={topic.id}
              onClick={() => onOneCutClick(topic)}
              className="bg-white border-b border-slate-200 cursor-pointer hover:bg-slate-50 transition-all group flex flex-col w-full"
            >
              {/* 제목 */}
              <div className="px-3 pt-1.5 pb-0.5">
                <h5 className="text-[11px] font-[1000] text-slate-900 line-clamp-2 leading-snug tracking-tighter group-hover:text-blue-600 transition-colors">{topic.title}</h5>
              </div>

              {/* 세로형 이미지 */}
              <div className="w-full aspect-[3/4] overflow-hidden">
                <img src={topic.imageUrl || ""} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              </div>

              {/* 작성자 정보 + 댓글·좋아요 수 */}
              <div className="px-3 py-1.5 flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className="w-4 h-4 rounded-full overflow-hidden border border-slate-100 bg-slate-50 shrink-0">
                    <img src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${topic.author}`} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[9px] font-black text-slate-700 truncate">{topic.author}</span>
                    <span className="text-[8px] font-bold text-slate-400 truncate">Lv{tLevel} · {getReputationLabel(tLikes)} · 깐부수 {formatKoreanNumber(tFollowers)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 text-[8px] font-black text-slate-400">
                  <span className="flex items-center gap-0.5">
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                    {formatKoreanNumber(tComments)}
                  </span>
                  <span className="flex items-center gap-0.5 text-rose-400">
                    <svg className="w-2.5 h-2.5 fill-current" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                    {formatKoreanNumber(topic.likes || 0)}
                  </span>
                </div>
              </div>
              <span className="text-[8px] font-black text-slate-300 px-3 pb-1.5">{getTimeAgo(topic.createdAt)}</span>
            </div>
          );
        })}
      </div>
    </aside>
  );
};

export default OneCutListSidebar;
