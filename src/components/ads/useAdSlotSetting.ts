// src/components/ads/useAdSlotSetting.ts — AdSlotSetting 공통 훅
// 🚀 작성 폼에서 광고 ON/OFF·종류·슬롯별 직접 선택 광고 ID를 한 곳에서 관리
//   selectedAds[pos] 값:
//     - undefined : 아직 결정 안 함 (default — 본문 노출 시 자동 매칭)
//     - 'auto'    : 사용자가 "자동 매칭으로 결정" 명시 (UI 피드백용, 노출 동작은 자동 매칭과 동일)
//     - 광고 ID   : 사용자가 광고 직접 선택
import { useState } from 'react';

export type SlotPos = 'top' | 'middle' | 'bottom';
export type SelectedAds = Partial<Record<SlotPos, string>>; // 'auto' 또는 광고 ID

export function useAdSlotSetting(initial?: { adSlotEnabled?: boolean; adSlotType?: 'auction' | 'adsense'; selectedAds?: SelectedAds }) {
  const [adSlotEnabled, setAdSlotEnabled] = useState<boolean>(initial?.adSlotEnabled ?? false);
  const [adSlotType, setAdSlotType] = useState<'auction' | 'adsense'>(initial?.adSlotType ?? 'auction');
  const [selectedAds, setSelectedAds] = useState<SelectedAds>(initial?.selectedAds ?? {});

  const adSlotFields = adSlotEnabled
    ? { adSlotEnabled: true, adSlotType, selectedAds }
    : {};

  const onAdSlotChange = (enabled: boolean, type: 'auction' | 'adsense') => {
    setAdSlotEnabled(enabled);
    setAdSlotType(type);
  };

  // adId 인자: null = default 복귀(delete) / 'auto' = 명시 자동 매칭 / 광고ID = 직접 선택
  const onSelectAd = (slot: SlotPos, adId: string | null) => {
    setSelectedAds(prev => {
      const next = { ...prev };
      if (adId) next[slot] = adId; else delete next[slot];
      return next;
    });
  };

  return { adSlotEnabled, adSlotType, selectedAds, adSlotFields, onAdSlotChange, onSelectAd };
}
