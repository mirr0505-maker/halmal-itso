// src/components/advertiser/AdvertiserWelcome.tsx — 광고주 등록 진입 게이트 (3종 타입 카드)
// 🚀 2026-04-25: 박씨 제비 미등록자 첫 화면. type 선택 후 AdvertiserRegister로 라우팅.
//   강변시장 패턴 sticky 헤더 + 본문 3종 카드(개인/개인사업자/법인).
//   1uid:1type 제약, type 변경은 별도 신청·심사 (TODO Sprint 8).
import type { AdvertiserType } from '../../types';

interface Props {
  onSelect: (type: AdvertiserType) => void;
  onCancel: () => void;
}

const AdvertiserWelcome = ({ onSelect, onCancel }: Props) => {
  return (
    <div className="w-full pb-4 animate-in fade-in">
      {/* 강변시장 패턴 sticky 헤더 */}
      <div className="sticky top-0 z-30 bg-[#F8FAFC]/80 backdrop-blur-md pt-2">
        <div className="flex items-center justify-between border-b border-slate-200 h-[44px] gap-3">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-slate-600 font-black text-[15px]">#</span>
            <h2 className="text-[14px] font-[1000] text-slate-900 tracking-tighter whitespace-nowrap">박씨 물고 오는 제비</h2>
            <div className="w-px h-3 bg-slate-200 mx-1.5 hidden md:block" />
            <p className="text-[11px] font-bold text-slate-400 hidden md:block whitespace-nowrap">광고 경매 시장</p>
          </div>
          <button onClick={onCancel}
            className="text-[11px] font-[1000] text-slate-400 hover:text-slate-700 shrink-0 px-2 py-1">
            ← 돌아가기
          </button>
        </div>
      </div>

      {/* 본문 — Welcome + 3종 카드 */}
      <div className="max-w-3xl mx-auto pt-8 px-4">
        <div className="text-center mb-8">
          <h1 className="text-[22px] font-[1000] text-slate-900 mb-2">광고주로 시작해보세요!</h1>
          <p className="text-[12px] font-bold text-slate-500">본인 형태에 맞는 카드를 선택하면 등록 폼이 열립니다.</p>
          <p className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3 inline-block">
            ⚠️ 1계정 1유형만 등록 가능 (변경은 별도 신청·심사). 모든 광고비 결제·정산은 ⚾ 볼 단위.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button onClick={() => onSelect('personal')}
            className="bg-white rounded-2xl border-2 border-slate-200 hover:border-violet-400 transition-all p-5 text-left shadow-sm hover:shadow-md group">
            <p className="text-3xl mb-2 group-hover:scale-110 transition-transform">🙋</p>
            <h3 className="text-[14px] font-[1000] text-slate-900 mb-1">개인 광고주</h3>
            <p className="text-[10px] font-bold text-slate-500 leading-relaxed">사업자 등록 안 한 일반 사용자. 이름·이메일·연락처만 입력.</p>
            <p className="text-[9px] font-bold text-violet-500 mt-2">⚾ 볼 결제 · 1차 검수 후 활성</p>
          </button>

          <button onClick={() => onSelect('individual_business')}
            className="bg-white rounded-2xl border-2 border-slate-200 hover:border-violet-400 transition-all p-5 text-left shadow-sm hover:shadow-md group">
            <p className="text-3xl mb-2 group-hover:scale-110 transition-transform">🏢</p>
            <h3 className="text-[14px] font-[1000] text-slate-900 mb-1">개인사업자</h3>
            <p className="text-[10px] font-bold text-slate-500 leading-relaxed">사업자등록번호 보유한 자영업·소상공인. 상호명·번호·대표자 필요.</p>
            <p className="text-[9px] font-bold text-violet-500 mt-2">⚾ 볼 결제 · 1차 검수 후 활성</p>
          </button>

          <button onClick={() => onSelect('corporate')}
            className="bg-white rounded-2xl border-2 border-slate-200 hover:border-violet-400 transition-all p-5 text-left shadow-sm hover:shadow-md group">
            <p className="text-3xl mb-2 group-hover:scale-110 transition-transform">🏛️</p>
            <h3 className="text-[14px] font-[1000] text-slate-900 mb-1">법인사업자</h3>
            <p className="text-[10px] font-bold text-slate-500 leading-relaxed">법인등록번호 보유한 회사. 법인명·번호·대표자·주소 필요.</p>
            <p className="text-[9px] font-bold text-violet-500 mt-2">⚾ 볼 결제 · 1차 검수 후 활성</p>
          </button>
        </div>

        <div className="mt-8 p-4 bg-slate-50 rounded-xl border border-slate-100">
          <p className="text-[11px] font-[1000] text-slate-700 mb-1.5">📌 베타 단계 안내</p>
          <ul className="text-[10px] font-bold text-slate-500 space-y-1 leading-relaxed list-none">
            <li>• 광고비 결제·정산: <span className="text-amber-600">⚾ 볼 단위</span> (개인·사업자·법인 모두 동일)</li>
            <li>• 카드 결제·세금계산서·사업자번호 자동 검증: 정식 PG 도입 시점 활성화 예정</li>
            <li>• 검수: 모든 등록은 1차 검수 후 활성 (관리자 승인)</li>
            <li>• 한도: 일일·총 예산 제한 없음</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AdvertiserWelcome;
