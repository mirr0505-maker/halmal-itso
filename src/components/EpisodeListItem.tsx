// src/components/EpisodeListItem.tsx — 마르지 않는 잉크병: 회차 목차 1줄
// 🖋️ 회차 번호 + 제목 + 메타 + 잠금/유료 뱃지
import type { Post } from '../types';

interface EpisodeListItemProps {
  episode: Post;          // posts 컬렉션의 에피소드 (category: 'magic_inkwell')
  isUnlocked?: boolean;   // 현재 유저가 이 회차를 구매했는지 (Phase 3-D에서 활용)
  isAuthor?: boolean;     // 현재 유저가 작가 본인인지
  onClick?: (postId: string) => void;
}

const EpisodeListItem = ({ episode, isUnlocked = false, isAuthor = false, onClick }: EpisodeListItemProps) => {
  const handleClick = () => {
    if (onClick) onClick(episode.id);
  };

  // 🚀 잠금 상태 판정
  // - 무료(isPaid=false 또는 price=0): 뱃지 없음
  // - 유료 + 구매완료 또는 작가본인: 🔓 (회색)
  // - 유료 + 미구매: 🔒 + 가격 (강조)
  const price = episode.price ?? 0;
  const isPaidEpisode = episode.isPaid === true && price > 0;

  // 게시일 포맷 (간단)
  const dateText = (() => {
    const ts = episode.createdAt;
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : (ts.seconds ? new Date(ts.seconds * 1000) : null);
    if (!d) return '';
    return `${d.getMonth() + 1}/${d.getDate()}`;
  })();

  return (
    <div
      onClick={handleClick}
      className="flex items-center gap-3 px-3 py-2.5 border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors last:border-b-0"
    >
      {/* 회차 번호 */}
      <div className="flex-shrink-0 w-10 text-center text-[11px] font-[1000] text-slate-500">
        {episode.episodeNumber ?? '-'}화
      </div>

      {/* 제목 */}
      <div className="flex-1 min-w-0">
        <p className="text-[12px] text-slate-700 truncate font-[1000]">
          {episode.episodeTitle || episode.title || '(제목 없음)'}
        </p>
        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500 font-bold">
          {dateText && <span>{dateText}</span>}
          <span>❤️ {episode.likes || 0}</span>
          <span>💬 {episode.commentCount || 0}</span>
        </div>
      </div>

      {/* 잠금/유료 뱃지 */}
      <div className="flex-shrink-0 text-[10px]">
        {!isPaidEpisode ? null : isUnlocked || isAuthor ? (
          <span className="text-slate-400">🔓</span>
        ) : (
          <span className="px-2 py-0.5 rounded bg-rose-50 border border-rose-200 text-rose-600 font-[1000]">🔒 🏀{price}</span>
        )}
      </div>
    </div>
  );
};

export default EpisodeListItem;
