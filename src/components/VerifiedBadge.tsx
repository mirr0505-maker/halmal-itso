// src/components/VerifiedBadge.tsx — 🛡️ 인증 마킹 배지 (Phase 6 Step 4B)
// 멤버 탭, 커뮤니티 글/댓글 작성자 옆에 표시되는 재사용 컴포넌트
import type { VerifiedBadge as VerifiedBadgeType } from '../types';

interface Props {
  verified?: VerifiedBadgeType;
  size?: 'sm' | 'md';
  showDate?: boolean;
}

const VerifiedBadgeComponent = ({ verified, size = 'sm', showDate = true }: Props) => {
  if (!verified) return null;

  const label = verified.label?.trim() || '인증';
  let dateStr = '';
  if (showDate && verified.verifiedAt) {
    const ts = verified.verifiedAt;
    const date = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000);
    const yy = String(date.getFullYear()).slice(2);
    const m = date.getMonth() + 1;
    const d = date.getDate();
    dateStr = `${yy}.${m}.${d}`;
  }

  const sizeClass = size === 'sm'
    ? 'text-[9px] px-1.5 py-0.5 gap-0.5'
    : 'text-[10px] px-2 py-0.5 gap-1';

  return (
    <span
      className={`inline-flex items-center ${sizeClass} rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-[1000] whitespace-nowrap`}
      title={`${verified.verifiedByNickname}님이 인증 부여`}
    >
      🛡️ {label} 인증{dateStr && showDate ? ` (${dateStr})` : ''}
    </span>
  );
};

export default VerifiedBadgeComponent;
