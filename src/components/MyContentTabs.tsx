// src/components/MyContentTabs.tsx
import type { Post, Series } from '../types';
import SeriesCard from './SeriesCard';
import InkwellSummaryCards from './InkwellSummaryCards';

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
  type: 'posts' | 'comments' | 'inkwell' | 'subscribedSeries';
  // 🖋️ 잉크병 — 나의 연재작 탭 전용
  mySeries?: Series[];
  onNavigateToSeries?: (seriesId: string) => void;
  // 🖋️ Phase 4-F — 작가 KPI 카드용 (users.ballReceived 그대로 전달, 잉크병 외 수익 포함)
  totalReceivedBalls?: number;
  // 🖋️ 구독한 작품 탭 전용
  subscribedSeries?: Series[];
  onGoToInkwellSeries?: () => void;  // 빈 상태 "작품 둘러보기" 버튼
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

// 🚀 글 상태 판정: 새글/미등록/등록글/인기글/최고글
function getPostStatus(post: MixedPost): { label: string; color: string } {
  if (post._source === 'glove') return { label: '장갑글', color: 'text-teal-600 bg-teal-50' };
  const likes = post.likes || 0;
  if (likes >= 30) return { label: '최고글', color: 'text-amber-600 bg-amber-50' };
  if (likes >= 10) return { label: '인기글', color: 'text-rose-500 bg-rose-50' };
  if (!post.createdAt?.seconds) return { label: '새글', color: 'text-emerald-600 bg-emerald-50' };
  const ageMs = Date.now() - post.createdAt.seconds * 1000;
  if (ageMs <= TWO_HOURS_MS) return { label: '새글', color: 'text-emerald-600 bg-emerald-50' };
  if (likes >= 3) return { label: '등록글', color: 'text-blue-600 bg-blue-50' };
  return { label: '미등록', color: 'text-slate-400 bg-slate-50' };
}

const MyContentTabs = ({ posts = [], onPostClick, onGloveClick, onRepost, type, mySeries, onNavigateToSeries, totalReceivedBalls, subscribedSeries, onGoToInkwellSeries }: Props) => {
  // 🖋️ 구독한 작품 분기
  if (type === 'subscribedSeries') {
    if (!subscribedSeries || subscribedSeries.length === 0) {
      return (
        <div className="py-32 flex flex-col items-center justify-center text-center">
          <div className="text-5xl mb-4 opacity-40">📚</div>
          <p className="text-sm text-slate-500 font-bold mb-1">아직 구독한 작품이 없어요</p>
          <p className="text-[12px] text-slate-500 font-bold">잉크병에서 마음에 드는 작품을 구독해보세요</p>
          {onGoToInkwellSeries && (
            <button
              onClick={onGoToInkwellSeries}
              className="mt-5 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-[1000] transition-colors"
            >
              🖋️ 작품 둘러보기
            </button>
          )}
        </div>
      );
    }
    return (
      <div className="px-2 py-2">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
          {subscribedSeries.map((series) => (
            <SeriesCard
              key={series.id}
              series={series}
              onClick={(s) => onNavigateToSeries?.(s.id)}
            />
          ))}
        </div>
      </div>
    );
  }

  // 🖋️ 잉크병 분기 — 데이터 모델이 완전히 다르므로 early return으로 처리
  if (type === 'inkwell') {
    if (!mySeries || mySeries.length === 0) {
      return (
        <div className="py-32 flex flex-col items-center justify-center text-slate-300">
          <div className="text-5xl mb-3 opacity-40">🖋️</div>
          <p className="font-black italic text-sm mb-1">아직 개설한 작품이 없어요</p>
          <p className="text-[11px] font-bold text-slate-400">잉크병 메뉴에서 새 작품을 만들어보세요</p>
        </div>
      );
    }

    // 🖋️ Phase 4-F: KPI 집계 (mySeries 배열 기반 — 실시간 onSnapshot 자동 반영)
    const summary = {
      totalSeries: mySeries.length,
      totalEpisodes: mySeries.reduce((sum, s) => sum + (s.totalEpisodes || 0), 0),
      totalSubscribers: mySeries.reduce((sum, s) => sum + (s.subscriberCount || 0), 0),
      totalViews: mySeries.reduce((sum, s) => sum + (s.totalViews || 0), 0),
      totalLikes: mySeries.reduce((sum, s) => sum + (s.totalLikes || 0), 0),
      totalRevenue: totalReceivedBalls || 0,
    };

    return (
      <div className="px-2 py-2">
        {/* ⭐ KPI 요약 카드 */}
        <InkwellSummaryCards
          totalSeries={summary.totalSeries}
          totalEpisodes={summary.totalEpisodes}
          totalSubscribers={summary.totalSubscribers}
          totalViews={summary.totalViews}
          totalLikes={summary.totalLikes}
          totalRevenue={summary.totalRevenue}
          variant="full"
        />

        {/* 작품 그리드 (기존 코드) */}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
          {mySeries.map((series) => (
            <SeriesCard
              key={series.id}
              series={series}
              onClick={(s) => onNavigateToSeries?.(s.id)}
            />
          ))}
        </div>
      </div>
    );
  }

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
                {/* 🚀 상태 배지: 새글/미등록/등록글/인기글/최고글 (댓글은 별도) */}
                {(() => {
                  if (type === 'comments') {
                    return (
                      <div className={`text-[10px] font-black px-2 py-1 rounded shadow-sm ${isGlove ? 'text-teal-600 bg-teal-50' : 'text-emerald-600 bg-emerald-50'}`}>
                        {isGlove ? '장갑댓글' : '댓글'}
                      </div>
                    );
                  }
                  const status = getPostStatus(post);
                  return (
                    <div className={`text-[10px] font-black px-2 py-1 rounded shadow-sm ${status.color}`}>
                      {status.label}
                    </div>
                  );
                })()}
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
