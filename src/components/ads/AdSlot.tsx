// src/components/ads/AdSlot.tsx — 광고 슬롯 컴포넌트
// 🚀 Phase 1: 자체 프로모션만 표시 (Waterfall 3순위)
// Phase 2+: 경매 결과 → 애드센스 → 자체 프로모션 Waterfall
import { getAdRevenueShare } from '../../constants';
import AdFallback from './AdFallback';

interface Props {
  position: 'top' | 'middle' | 'bottom';
  postCategory?: string;
  postAuthorLevel: number;
}

const AdSlot = ({ position, postAuthorLevel }: Props) => {
  const rs = getAdRevenueShare(postAuthorLevel);

  // 해당 레벨에서 이 슬롯 위치가 허용되지 않으면 렌더링 안 함
  if (!rs.positions.includes(position)) return null;

  // Phase 1: 경매 시스템 미구현 → 자체 프로모션 폴백만 표시
  // Phase 2+: useAdSlot hook으로 경매 요청 → 낙찰 광고 or 애드센스 or 프로모션
  return (
    <div className="my-4">
      <AdFallback position={position} />
    </div>
  );
};

export default AdSlot;
