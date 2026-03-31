// src/components/MyContentTabs.tsx
import type { Post } from '../types';

// 🚀 MixedPost: Post + CommunityPost + 커뮤니티 댓글 혼합 표시용 최소 공통 타입
interface MixedPost {
  id: string;
  content: string;
  title?: string;
  category?: string;
  createdAt?: { seconds: number };
  communityId?: string;
  communityName?: string;
  _source?: 'post' | 'glove';
}

interface Props {
  posts: MixedPost[];
  onPostClick: (post: Post) => void;
  // 🚀 장갑 출처 항목 클릭 시 해당 커뮤니티로 이동
  onGloveClick?: (communityId?: string) => void;
  type: 'posts' | 'comments';
}

const MyContentTabs = ({ posts = [], onPostClick, onGloveClick, type }: Props) => {
  const itemsPerPage = 50;
  const displayList = posts.slice(0, itemsPerPage);

  const formatDateTime = (timestamp: { seconds: number } | null | undefined) => {
    if (!timestamp) return "";
    const date = new Date(timestamp.seconds * 1000);
    return date.toLocaleString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute:'2-digit' });
  };

  return (
    <div className="w-full flex flex-col">
      {displayList.length > 0 ? (
        displayList.map((post) => {
          const isGlove = post._source === 'glove';
          // 장갑 출처: 커뮤니티로 이동 / 일반 출처: 원래 동작
          const handleClick = () => {
            if (isGlove && post.communityId) {
              onGloveClick?.(post.communityId);
            } else {
              // MixedPost 중 'post' 출처는 실제로 완전한 Post 객체이므로 캐스팅 안전
              onPostClick(post as unknown as Post);
            }
          };

          // 표시할 텍스트: 댓글은 HTML 태그 제거
          const displayText = type === 'comments'
            ? (post.content || "").replace(/<[^>]*>?/gm, '')
            : (post.title || "제목 없음");

          return (
            <div
              key={post.id}
              onClick={handleClick}
              className="flex items-center px-6 py-4 border-b border-slate-50 transition-colors cursor-pointer hover:bg-slate-50 group"
            >
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-[1000] text-slate-800 truncate group-hover:text-blue-600 transition-colors tracking-tight">
                  {displayText}
                </p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-[10px] text-slate-400 font-bold">{formatDateTime(post.createdAt)}</span>
                  {/* 🚀 장갑 출처 배지: 커뮤니티명 표시 */}
                  {isGlove && post.communityName && (
                    <span className="text-[9px] font-[1000] text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-100">
                      🧤 {post.communityName}
                    </span>
                  )}
                  {!isGlove && post.category && (
                    <span className="text-[9px] font-black text-blue-400/60 uppercase tracking-widest bg-blue-50/50 px-1.5 py-0.5 rounded">
                      {post.category}
                    </span>
                  )}
                </div>
              </div>
              <div className={`text-[10px] font-black px-2 py-1 rounded shadow-sm shrink-0 ${
                isGlove
                  ? (type === 'comments' ? 'text-teal-600 bg-teal-50' : 'text-teal-600 bg-teal-50')
                  : (type === 'comments' ? 'text-emerald-600 bg-emerald-50' : 'text-blue-600 bg-blue-50')
              }`}>
                {isGlove ? (type === 'comments' ? '장갑댓글' : '장갑글') : (type === 'comments' ? '댓글' : '게시글')}
              </div>
            </div>
          );
        })
      ) : (
        <div className="py-32 flex flex-col items-center justify-center text-slate-300">
          <svg className="w-12 h-12 mb-4 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="font-black italic">기록된 글이 없어요.</p>
        </div>
      )}
    </div>
  );
};

export default MyContentTabs;
