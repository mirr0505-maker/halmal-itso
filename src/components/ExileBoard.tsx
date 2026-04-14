// src/components/ExileBoard.tsx — 🏚️ 유배지 게시판
// 일반 posts 컬렉션의 `category='유배·귀양지' && exileLevel===N` 글 목록 표시
// 클릭 시 DiscussionView로 연결 (일반 메뉴와 동일 패턴)
import type { Post, UserData } from '../types';
import { sanitizeHtml } from '../sanitize';
import { formatKoreanNumber, calculateLevel } from '../utils';

interface Props {
  posts: Post[];                  // 상위에서 level로 필터된 글 목록 전달
  level: 1 | 2 | 3;
  allUsers: Record<string, UserData>;
  onTopicClick: (post: Post) => void;
  onLikeClick?: (e: React.MouseEvent, postId: string) => void;
  currentNickname?: string;
}

// 상대 시간
function formatRelativeTime(ts?: { toDate?: () => Date; seconds: number }): string {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return '방금 전';
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

const ExileBoard = ({ posts, level, allUsers, onTopicClick, onLikeClick, currentNickname }: Props) => {
  const levelLabel = level === 1 ? '놀부의 곳간' : level === 2 ? '무인도 귀양지' : '절해고도';

  if (posts.length === 0) {
    return (
      <div className="py-10 text-center">
        <p className="text-[13px] font-[1000] text-slate-400">아직 {levelLabel}에 남겨진 글이 없습니다</p>
        <p className="text-[10px] font-bold text-slate-300 mt-1">유배자들이 반성하는 공간입니다</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {posts.map(post => {
        const authorData = allUsers[`nickname_${post.author}`];
        const authorLevel = calculateLevel(authorData?.exp || 0);
        const isLiked = !!(currentNickname && post.likedBy?.includes(currentNickname));
        return (
          <div key={post.id}
            onClick={() => onTopicClick(post)}
            className="bg-white border border-slate-100 rounded-xl px-5 py-4 hover:border-rose-200 hover:shadow-md transition-all group cursor-pointer">
            {/* 상단: 작성자 + 시간 */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-[1000] text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">🏚️ {levelLabel}</span>
              <span className="text-[10px] font-bold text-slate-300">{formatRelativeTime(post.createdAt)}</span>
            </div>

            {/* 제목 */}
            {post.title && (
              <h3 className="text-[14px] font-[1000] text-slate-900 group-hover:text-rose-600 transition-colors mb-1">
                {post.title}
              </h3>
            )}

            {/* 본문 */}
            <div
              className="text-[13px] font-medium text-slate-500 line-clamp-2 leading-relaxed [&_img]:hidden [&_p]:mb-0.5"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.content) }}
            />

            {/* 하단: 작성자 + 통계 */}
            <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-50">
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="w-6 h-6 rounded-full bg-slate-50 overflow-hidden shrink-0 border border-slate-100">
                  <img src={authorData?.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${post.author}`} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[11px] font-[1000] text-slate-900 truncate leading-none mb-0.5">{post.author}</span>
                  <span className="text-[9px] font-bold text-slate-400 truncate tracking-tight">
                    Lv {authorLevel}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-black shrink-0 text-slate-300">
                <span className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                  {formatKoreanNumber(post.commentCount || 0)}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); onLikeClick?.(e, post.id); }}
                  className={`flex items-center gap-1 transition-colors ${isLiked ? 'text-rose-500' : 'hover:text-rose-400'}`}
                >
                  <svg className={`w-3.5 h-3.5 ${isLiked ? 'fill-current' : 'fill-none'}`} stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
                  {formatKoreanNumber(post.likes || 0)}
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ExileBoard;
