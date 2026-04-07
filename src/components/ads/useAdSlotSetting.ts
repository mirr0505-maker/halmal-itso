// src/components/ads/useAdSlotSetting.ts — AdSlotSetting 공통 훅
// 🚀 9개 작성 폼에서 반복되는 adSlotEnabled/adSlotType 상태 + onSubmit 확장을 한 곳에서 관리
import { useState } from 'react';

export function useAdSlotSetting() {
  const [adSlotEnabled, setAdSlotEnabled] = useState(false);
  const [adSlotType, setAdSlotType] = useState<'auction' | 'adsense'>('auction');

  // onSubmit 데이터에 광고 슬롯 필드 추가
  const adSlotFields = adSlotEnabled ? { adSlotEnabled: true, adSlotType } : {};

  const onAdSlotChange = (enabled: boolean, type: 'auction' | 'adsense') => {
    setAdSlotEnabled(enabled);
    setAdSlotType(type);
  };

  return { adSlotEnabled, adSlotType, adSlotFields, onAdSlotChange };
}
