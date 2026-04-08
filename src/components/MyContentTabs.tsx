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
  // 🚀 재등록 관련 필드
  likes?: number;
  repostedAt?: { seconds: number };
  isOneCut?: boolean;
}

interface Props {
  posts: MixedPost[];
  onPostClick: (post: Post) => void;
  // 🚀 장갑 출처 항목 클릭 시 해당 커뮤니티로 이동
  onGloveClick?: (communityId?: string) => void;
  // 🚀 재등록 콜백: 2시간 경과 + 좋아요 3개 미만 + 1회 미사용 글에 표시
  onRepost?: (postId: string) => void;
  type: 'posts' | 'comments';
}

// 🚀 재등록 가능 여부 판단: 2시간 경과 + 좋아요 3개 미만 + repostedAt 없음 + 일반 글/한컷만
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
function canRepost(post: MixedPost): boolean {
  if (post._source === 'glove') return false;
  if (post.repostedAt) return false;
  if ((post.likes || 0) >= 3) return false;
  if (!post.createdAt?.seconds) return false;
  const ageMs = Date.now() - post.createdAt.seconds * 1000;
  return ageMs > TWO_HOURS_MS;
}

const MyContentTabs = ({ posts = [], onPostClick, onGloveClick, onRepost, type }: Props) => {
  const itemsPerPage = 50;
  const displayList = posts.slice(0, itemsPerPage);

  // 🚀 재등록 가능한 글이 1개라도 있으면 안내 메시지 표시
  const hasRepostable = onRepost && type === 'posts' && displayList.some(canRepost);

  const formatDateTime = (timestamp: { seconds: number } | null | undefined) => {
    if (!timestamp) return "";
    const date = new Date(timestamp.seconds * 1000);
    return date.toLocaleString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute:'2-digit' });
  };

  return (
    <div className="w-full flex flex-col">
      {/* 🚀 재등록 안내 메시지 */}
      {hasRepostable && (
        <div className="px-6 py-2.5 bg-amber-50/70 border-b border-amber-100 text-[10px] font-bold text-amber-600 tracking-tight">
          💡 등록글 미달 글은 1회에 한해 [재등록] 가능합니다
        </div>
      )}
      {displayList.length > 0 ? (
        displayList.map((post) => {
          const isGlove = post._source === 'glove';
          const repostable = onRepost && type === 'posts' && canRepost(post);
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
                  {/* 🚀 재등록 완료 표시 */}
                  {post.repostedAt && (
                    <span className="text-[9px] font-[1000] text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-100">
                      재등록됨
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {/* 🚀 재등록 버튼: 조건 충족 시 표시 */}
                {repostable && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onRepost!(post.id); }}
                    className="text-[10px] font-[1000] px-2.5 py-1 rounded-lg shadow-sm text-amber-600 bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors"
                  >
                    재등록
                  </button>
                )}
                <div className={`text-[10px] font-black px-2 py-1 rounded shadow-sm ${
                  isGlove
                    ? (type === 'comments' ? 'text-teal-600 bg-teal-50' : 'text-teal-600 bg-teal-50')
                    : (type === 'comments' ? 'text-emerald-600 bg-emerald-50' : 'text-blue-600 bg-blue-50')
                }`}>
                  {isGlove ? (type === 'comments' ? '장갑댓글' : '장갑글') : (type === 'comments' ? '댓글' : '게시글')}
                </div>
              </div>
            </div>
          );
        })
      ) : (
        <div className="py-32 flex flex-col items-center justify-center text-slate-300">
          <svg className="w-12 h-12 mb-4 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="font-black italic">새로운 이야기를 시작해보세요!</p>
        </div>
      )}
    </div>
  );
};

export default MyContentTabs;
