// src/components/TitleAchievementModal.tsx — 🏷️ 칭호 획득 축하 모달 (Sprint 5 Stage 4)
//
// TitleMaster.notificationLevel === 'modal' 인 칭호 수여 시 화면 중앙에 축하 오버레이를 띄운다.
// 사용처: App.tsx가 알림 onSnapshot 구독으로 미확인 title_awarded_modal 감지 시 mount,
//        혹은 MyPage 도감 카드 클릭으로 재노출.
//
// Why: "모달" 레벨 칭호(popular_writer / super_hit / influencer / dedication)는 의미가 큰
//      마일스톤 — 토스트로 묻히면 감흥 하락. 사용자가 직접 닫을 때까지 화면 점유.
import type { TitleTier } from '../types';
import { TITLE_CATALOG } from '../constants';

interface Props {
  titleId: string;
  tier?: TitleTier;
  onClose: () => void;
  action?: 'awarded' | 'upgraded';   // 기본 awarded
}

const TitleAchievementModal = ({ titleId, tier, onClose, action = 'awarded' }: Props) => {
  const master = TITLE_CATALOG.find((t) => t.id === titleId);
  if (!master) return null;

  const label = tier && master.labelByTier?.[tier]
    ? master.labelByTier[tier]
    : master.label;

  const actionText = action === 'upgraded' ? '칭호 상승!' : '새 칭호 획득!';

  // 배경 클릭 닫기
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="title-achievement-heading"
    >
      <div className="relative w-full max-w-sm bg-gradient-to-br from-amber-50 via-white to-amber-100 rounded-2xl shadow-2xl border-2 border-amber-300 overflow-hidden animate-[fadeIn_0.3s_ease-out]">
        {/* 배경 반짝임 장식 */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-amber-200/40 rounded-full blur-2xl -translate-y-8 translate-x-8 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-20 h-20 bg-rose-200/30 rounded-full blur-2xl translate-y-6 -translate-x-6 pointer-events-none" />

        <div className="relative px-6 pt-8 pb-6 text-center">
          <p className="text-xs font-bold text-amber-700 tracking-wider uppercase mb-2">
            🎉 {actionText}
          </p>
          <div className="my-4">
            <div className="text-7xl leading-none mb-3" aria-hidden="true">{master.emoji}</div>
            <h2 id="title-achievement-heading" className="text-2xl font-black text-slate-900">
              {label}
              {tier && <span className="text-amber-600 ml-1">{tier}</span>}
            </h2>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed px-2">
            {master.description}
          </p>
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold rounded-full shadow-md hover:shadow-lg transition-all"
            >
              고마워요
            </button>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
};

export default TitleAchievementModal;
