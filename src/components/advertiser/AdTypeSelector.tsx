// src/components/advertiser/AdTypeSelector.tsx — 광고 종류 선택 카드
// 🚀 ADSMARKET v3 (2026-04-30): 새 광고 등록 진입 시 본문 광고 vs 피드 광고 선택
//   - 본문 광고: 글 상세 페이지 내부 노출, 작성자 RS 분배, 가로/세로 스타일 선택, 작성자 타겟팅 가능
//   - 피드 광고: 글 목록 그리드 인라인, 100% 플랫폼 수익, 글카드 형태 고정, 글 작성자 무관
//   - 처음부터 광고 의도 분리 — 광고주 학습 강화

interface Props {
  onSelect: (adType: 'body' | 'feed') => void;
  onBack: () => void;
}

const AdTypeSelector = ({ onSelect, onBack }: Props) => {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6 animate-in fade-in">
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="text-[11px] font-black text-slate-400 hover:text-slate-700 transition-colors">← 돌아가기</button>
        <h2 className="text-[18px] font-[1000] text-slate-900">📢 새 광고 — 종류 선택</h2>
      </div>

      <p className="text-[12px] font-bold text-slate-500 mb-6">
        어떤 광고를 등록하시겠어요? 본문/피드는 <b>별개의 광고 매체</b>로, 노출 영역·이미지 비율·타겟팅·수익 분배 정책이 다릅니다.
      </p>

      {/* 카드 2개 — 모바일은 세로, 데스크톱은 가로 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 본문 광고 카드 */}
        <button
          type="button"
          onClick={() => onSelect('body')}
          className="group flex flex-col p-6 rounded-2xl border-2 border-slate-200 bg-white hover:border-violet-400 hover:shadow-xl transition-all text-left"
        >
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[28px]">📄</span>
            <div>
              <h3 className="text-[15px] font-[1000] text-slate-900 group-hover:text-violet-600 transition-colors">본문 광고</h3>
              <p className="text-[10px] font-bold text-slate-400 mt-0.5">글 상세 페이지 내부 노출</p>
            </div>
          </div>

          <ul className="space-y-1.5 mb-4 flex-1">
            <li className="text-[11px] font-bold text-slate-600 flex items-start gap-1.5">
              <span className="text-violet-500 mt-0.5">✓</span>
              <span>슬롯 위치 <b>3종</b> (상단/중단/하단) 선택 가능</span>
            </li>
            <li className="text-[11px] font-bold text-slate-600 flex items-start gap-1.5">
              <span className="text-violet-500 mt-0.5">✓</span>
              <span>이미지 스타일 <b>2종</b> (가로 플래카드 3:1 / 세로형 9:16)</span>
            </li>
            <li className="text-[11px] font-bold text-slate-600 flex items-start gap-1.5">
              <span className="text-violet-500 mt-0.5">✓</span>
              <span><b>특정 작성자</b> 타겟팅 가능 (크리에이터 지면)</span>
            </li>
            <li className="text-[11px] font-bold text-slate-600 flex items-start gap-1.5">
              <span className="text-amber-500 mt-0.5">💰</span>
              <span>글 작성자에게 <b>수익 분배 (RS)</b> — Lv별 차등</span>
            </li>
          </ul>

          <span className="px-4 py-2 bg-violet-100 group-hover:bg-violet-600 text-violet-700 group-hover:text-white text-[12px] font-[1000] rounded-xl text-center transition-all">
            본문 광고 선택 →
          </span>
        </button>

        {/* 피드 광고 카드 */}
        <button
          type="button"
          onClick={() => onSelect('feed')}
          className="group flex flex-col p-6 rounded-2xl border-2 border-violet-200 bg-violet-50/30 hover:border-violet-500 hover:shadow-xl transition-all text-left relative"
        >
          {/* NEW 배지 */}
          <span className="absolute top-3 right-3 px-2 py-0.5 text-[9px] font-black bg-violet-600 text-white rounded-md">NEW</span>

          <div className="flex items-center gap-2 mb-3">
            <span className="text-[28px]">📋</span>
            <div>
              <h3 className="text-[15px] font-[1000] text-slate-900 group-hover:text-violet-600 transition-colors">피드 광고</h3>
              <p className="text-[10px] font-bold text-violet-400 mt-0.5">등록글·카테고리 목록 그리드 인라인</p>
            </div>
          </div>

          <ul className="space-y-1.5 mb-4 flex-1">
            <li className="text-[11px] font-bold text-slate-600 flex items-start gap-1.5">
              <span className="text-violet-500 mt-0.5">✓</span>
              <span><b>글카드 형태</b>로 자연스럽게 노출 (16:9 이미지)</span>
            </li>
            <li className="text-[11px] font-bold text-slate-600 flex items-start gap-1.5">
              <span className="text-violet-500 mt-0.5">✓</span>
              <span>등록글 그리드에 <b>4글 다음에 1광고</b> 인서트 (베타)</span>
            </li>
            <li className="text-[11px] font-bold text-slate-600 flex items-start gap-1.5">
              <span className="text-violet-500 mt-0.5">✓</span>
              <span>카테고리·지역 타겟팅 가능 (글 작성자 무관)</span>
            </li>
            <li className="text-[11px] font-bold text-slate-600 flex items-start gap-1.5">
              <span className="text-emerald-500 mt-0.5">⚡</span>
              <span><b>100% 플랫폼 수익</b> (작성자 RS 분배 없음)</span>
            </li>
          </ul>

          <span className="px-4 py-2 bg-violet-200 group-hover:bg-violet-600 text-violet-700 group-hover:text-white text-[12px] font-[1000] rounded-xl text-center transition-all">
            피드 광고 선택 →
          </span>
        </button>
      </div>

      <p className="text-[10px] font-bold text-slate-400 mt-6 text-center">
        본문/피드 광고를 모두 운영하시려면 각각 별도로 등록해 주세요.
      </p>
    </div>
  );
};

export default AdTypeSelector;
