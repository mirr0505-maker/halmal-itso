// src/components/ads/AdSlotSetting.tsx — 새글 작성 시 광고 슬롯 설정 (Lv5+)
// 🚀 Phase α-2 (2026-04-25 토글화): 평소 1줄(60px) — 본문 공간 보존, 클릭 시 펼침
//   - 펼침 영역: Lv 카드 + 슬롯 위치 미리보기 + 광고 종류 선택
//   - 토글 버튼 텍스트는 "다음 행동" 표시 (OFF 상태에서 [광고 ON] = 누르면 켜짐)
// 🚀 12개 Create*.tsx에서 props 그대로 사용 (변경 불필요)
import { useState } from 'react';
import { getCreatorAdSlots } from '../../constants';

interface Props {
  userLevel: number;
  adSlotEnabled: boolean;
  adSlotType: 'auction' | 'adsense';
  onChange: (enabled: boolean, type: 'auction' | 'adsense') => void;
}

const SLOT_UNLOCK_LEVEL: Record<'top' | 'middle' | 'bottom', number> = {
  top: 7,
  middle: 9,
  bottom: 5,
};

const POSITION_LABEL_KO: Record<'top' | 'middle' | 'bottom', string> = {
  top: '상단',
  middle: '중단',
  bottom: '하단',
};

const AdSlotSetting = ({ userLevel, adSlotEnabled, adSlotType, onChange }: Props) => {
  const rs = getCreatorAdSlots(userLevel);
  const [expanded, setExpanded] = useState(false);

  // Lv 5 미만 — 평소 1줄 헤더만 (호기심 유발) + ▼ 클릭 시 메시지 펼침
  // 추후 문구 자유 수정 가능 — 사용자 합의된 잠정 카피
  if (rs.slots === 0) {
    return (
      <div className="mx-5 my-2 rounded-xl border border-slate-200 bg-slate-50 shrink-0 overflow-hidden">
        <button
          onClick={() => setExpanded(v => !v)}
          className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-100 transition-colors"
        >
          <span className="text-[11px] font-[1000] text-slate-400">
            📢 광고 슬롯 <span className="text-slate-300">(Lv5+ 활성)</span>
          </span>
          <span className="text-[10px] font-bold text-slate-300">{expanded ? '▲ 닫기' : '▼ 자세히'}</span>
        </button>
        {expanded && (
          <div className="px-3 pb-2.5 border-t border-slate-100 pt-2.5">
            <p className="text-[11px] font-[1000] text-slate-500 text-center leading-relaxed">
              🔒 <span className="text-violet-600">Lv5+</span>부터 본인 글에 광고 슬롯이 열립니다 — <span className="text-emerald-600">광고 수익 적립</span>도 함께 시작!
              <span className="text-slate-400 font-bold ml-1">(현재 Lv{userLevel})</span>
            </p>
          </div>
        )}
      </div>
    );
  }

  // 토글 버튼: OFF면 [광고 ON] 강조 (누르면 켜짐 = 다음 행동 표시) / ON이면 [광고 끄기] 회색
  const toggleLabel = adSlotEnabled ? '광고 끄기' : '📢 광고 ON';
  const toggleClass = adSlotEnabled
    ? 'bg-slate-200 text-slate-600 hover:bg-slate-300'
    : 'bg-violet-600 text-white shadow-sm hover:bg-violet-700';

  return (
    <div className="mx-5 my-2 rounded-xl border-2 border-violet-200 bg-gradient-to-br from-violet-50 to-white shrink-0 overflow-hidden">
      {/* 헤더 — 평소엔 이 한 줄만 노출 (60px) */}
      <div className="flex items-center justify-between px-3 py-2.5 gap-2">
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex items-center gap-2 flex-1 min-w-0 text-left hover:bg-violet-50 rounded-md px-1 py-1 transition-colors"
        >
          <span className="text-[14px] shrink-0">📢</span>
          <span className="text-[12px] font-[1000] text-violet-700 shrink-0">광고 슬롯</span>
          <span className="text-[10px] font-bold text-slate-400 shrink-0">·</span>
          <span className="text-[10px] font-[1000] text-slate-600 shrink-0">Lv{userLevel}</span>
          <span className="text-[10px] font-bold text-slate-400 shrink-0">·</span>
          <span className="text-[10px] font-[1000] text-violet-600 shrink-0">{rs.slots}슬롯 활성</span>
          <span className="text-[10px] font-bold text-slate-300 ml-1.5 shrink-0">{expanded ? '▲ 닫기' : '▼ 자세히'}</span>
        </button>
        <button
          onClick={() => onChange(!adSlotEnabled, adSlotType)}
          className={`shrink-0 px-3.5 py-1.5 rounded-full text-[11px] font-[1000] transition-all ${toggleClass}`}
        >
          {toggleLabel}
        </button>
      </div>

      {/* 펼침 영역 — Lv 카드 + 미리보기 + 광고 종류 */}
      {expanded && (
        <div className="px-3 pb-3 border-t border-violet-100 pt-3 space-y-2.5">
          {/* Lv 카드 2단 — 수익률 % 가림 (운영 정책 2026-04-25) */}
          <div className="grid grid-cols-2 gap-1.5">
            <div className="bg-white rounded-lg p-1.5 border border-violet-100 text-center">
              <p className="text-[9px] font-bold text-slate-400">현재 레벨</p>
              <p className="text-[13px] font-[1000] text-violet-700">Lv {userLevel}</p>
            </div>
            <div className="bg-white rounded-lg p-1.5 border border-violet-100 text-center">
              <p className="text-[9px] font-bold text-slate-400">활성 슬롯</p>
              <p className="text-[13px] font-[1000] text-violet-700">{rs.slots}개</p>
            </div>
          </div>

          {/* 슬롯 위치 미리보기 — ON일 때만 활성 박스, OFF면 비활성 표시 */}
          <div className="bg-white rounded-lg p-2 border border-slate-200 space-y-1">
            <p className="text-[9px] font-bold text-slate-400 mb-0.5">📍 노출 위치 미리보기</p>
            {(['top', 'middle', 'bottom'] as const).map(pos => {
              const isActive = rs.positions.includes(pos);
              const willShow = isActive && adSlotEnabled;
              return (
                <div key={pos} className="flex items-center gap-2">
                  <span className={`text-[10px] font-[1000] w-10 shrink-0 ${isActive ? 'text-violet-700' : 'text-slate-300'}`}>
                    {POSITION_LABEL_KO[pos]}
                  </span>
                  {willShow ? (
                    <div className="flex-1 h-5 rounded bg-violet-50 border border-violet-200 flex items-center justify-center">
                      <span className="text-[9px] font-[1000] text-violet-600">📢 광고 노출</span>
                    </div>
                  ) : isActive ? (
                    <div className="flex-1 h-5 rounded bg-slate-50 border border-dashed border-slate-200 flex items-center justify-center">
                      <span className="text-[9px] font-bold text-slate-400">광고 OFF — 노출 없음</span>
                    </div>
                  ) : (
                    <div className="flex-1 h-5 rounded bg-slate-50 border border-dashed border-slate-200 flex items-center justify-center">
                      <span className="text-[9px] font-bold text-slate-300">🔒 Lv{SLOT_UNLOCK_LEVEL[pos]}+ 필요</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 광고 종류 — ON일 때만 */}
          {adSlotEnabled && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-bold text-slate-500 shrink-0">광고 종류:</span>
              <button onClick={() => onChange(true, 'auction')}
                className={`px-2.5 py-1 rounded-md text-[10px] font-[1000] transition-all ${
                  adSlotType === 'auction'
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'bg-white text-slate-600 border border-slate-200 hover:border-violet-300'
                }`}>
                🎯 광고마켓 (경매)
              </button>
              <button disabled
                className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-white text-slate-300 border border-slate-100 cursor-not-allowed">
                구글 애드센스 (준비 중)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdSlotSetting;
