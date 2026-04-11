// src/components/InkwellHomeView.tsx — 마르지 않는 잉크병: 사이드 메뉴 진입 화면
// 🖋️ glove 스타일 sticky 헤더 + 2탭 라우터
//   [📖 회차] (등록글 임계값 3) / [📚 작품] (기존 SeriesGrid 카탈로그)
// - 회차 탭: AnyTalkList 재사용, POST_FILTER.REGISTERED_MIN_LIKES 필터
// - 작품 탭: SeriesGrid 그대로 (장르 필터 + 작품 만들기 버튼 포함)
import type { Post, UserData } from '../types';
import { POST_FILTER } from '../constants';
import AnyTalkList from './AnyTalkList';
import SeriesGrid from './SeriesGrid';

export type InkwellTab = 'episodes' | 'series';

interface InkwellHomeViewProps {
  allRootPosts: Post[];
  onTopicClick: (post: Post) => void;
  onLikeClick: (e: React.MouseEvent | null, postId: string) => void;
  commentCounts: Record<string, number>;
  currentNickname?: string;
  currentUserData: UserData | null;
  allUsers: Record<string, UserData>;
  followerCounts: Record<string, number>;
  onShareCount: (postId: string) => void;
  onAuthorClick?: (nickname: string) => void;
  // 작품 탭 (SeriesGrid)
  onSelectSeries: (seriesId: string) => void;
  onCreateSeries: () => void;
  // 🖋️ 탭 상태는 부모에서 관리 (SeriesDetail 진입/복귀 시 유지)
  activeTab: InkwellTab;
  onTabChange: (tab: InkwellTab) => void;
}

const InkwellHomeView = ({
  allRootPosts,
  onTopicClick,
  onLikeClick,
  commentCounts,
  currentNickname,
  currentUserData,
  allUsers,
  followerCounts,
  onShareCount,
  onAuthorClick,
  onSelectSeries,
  onCreateSeries,
  activeTab,
  onTabChange,
}: InkwellHomeViewProps) => {

  // 🖋️ 회차 탭 데이터: 잉크병 카테고리 + 좋아요 3개 이상(등록글 임계값) + 비공개 제외 + 최신순
  const episodePosts = allRootPosts
    .filter((p) =>
      p.category === 'magic_inkwell'
      && (p.likes || 0) >= POST_FILTER.REGISTERED_MIN_LIKES
      && !p.isHidden
    )
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

  const TABS = [
    { id: 'episodes' as const, label: '📖 회차',   desc: '등록된 회차' },
    { id: 'series' as const,   label: '📚 작품',   desc: '작품 카탈로그' },
  ];

  return (
    <div className="w-full animate-in fade-in">
      {/* 🚀 glove 패턴 sticky 헤더 — #타이틀 | 설명 | 탭 버튼 */}
      <div className="sticky top-0 z-30 bg-[#F8FAFC]/80 backdrop-blur-md pt-2">
        <div className="flex items-center justify-between border-b border-slate-200 h-[44px] px-4 gap-3">
          {/* 좌: 타이틀 */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-blue-600 font-black text-[15px]">#</span>
            <h2 className="text-[14px] font-[1000] text-slate-900 tracking-tighter whitespace-nowrap">마르지 않는 잉크병</h2>
            <div className="w-px h-3 bg-slate-200 mx-1.5 hidden md:block" />
            <p className="text-[11px] font-bold text-slate-400 hidden md:block whitespace-nowrap">
              시 · 소설 · 수필 · 웹툰 · 만화 — 작가의 이야기가 마르지 않는 곳
            </p>
          </div>
          {/* 우: 서브탭 2개 */}
          <div className="flex items-center gap-1.5 shrink-0">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all ${
                  activeTab === tab.id
                    ? 'bg-blue-50 border-blue-200 text-blue-700'
                    : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
              >
                <span className="text-[12px] font-[1000] whitespace-nowrap">{tab.label}</span>
                <span className={`text-[10px] font-bold hidden md:inline whitespace-nowrap ${activeTab === tab.id ? 'text-blue-400' : 'text-slate-300'}`}>
                  {tab.desc}
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="h-3" />
      </div>

      {/* 탭별 콘텐츠 */}
      {activeTab === 'episodes' ? (
        episodePosts.length === 0 ? (
          <div className="py-32 text-center">
            <div className="text-5xl mb-3 opacity-30">📖</div>
            <p className="text-sm text-slate-400 font-bold italic mb-1">
              등록된 회차가 아직 없어요
            </p>
            <p className="text-[11px] text-slate-400 font-bold">
              회차는 좋아요 {POST_FILTER.REGISTERED_MIN_LIKES}개 이상이 되면 이곳에 노출됩니다
            </p>
          </div>
        ) : (
          <AnyTalkList
            posts={episodePosts}
            onTopicClick={onTopicClick}
            onLikeClick={onLikeClick}
            commentCounts={commentCounts}
            currentNickname={currentNickname}
            currentUserData={currentUserData}
            allUsers={allUsers}
            followerCounts={followerCounts}
            onShareCount={onShareCount}
            onAuthorClick={onAuthorClick}
          />
        )
      ) : (
        <SeriesGrid onSelectSeries={onSelectSeries} onCreateSeries={onCreateSeries} />
      )}
    </div>
  );
};

export default InkwellHomeView;
