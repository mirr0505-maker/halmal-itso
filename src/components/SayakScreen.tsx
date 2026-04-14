// src/components/SayakScreen.tsx — ☠️ 사약 처분 유저 전용 화면
// 로그인 직후 이 화면만 표시 → 3초 카운트다운 후 강제 로그아웃
import { useState, useEffect } from 'react';

interface Props {
  reason?: string;
  onLogout: () => void;
}

const SayakScreen = ({ reason, onLogout }: Props) => {
  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    if (countdown === 0) {
      onLogout();
      return;
    }
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, onLogout]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col items-center justify-center text-white p-6">
      <div className="max-w-md w-full text-center">
        <p className="text-[40px] mb-4">☠️</p>
        <h1 className="text-[20px] font-[1000] mb-2">대장의 명으로 사약이 내려졌소</h1>
        <p className="text-[12px] font-bold text-slate-400 mb-6">4차 징계 — 영구 이용 정지</p>

        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 mb-6 text-left">
          <p className="text-[10px] font-[1000] text-slate-400 uppercase tracking-widest mb-2">처분 내역</p>
          <div className="space-y-2 text-[11px] font-medium text-slate-300">
            <div className="flex justify-between"><span>상태</span><span className="text-rose-400 font-[1000]">영구 밴 (banned)</span></div>
            <div className="flex justify-between"><span>보유 자산</span><span>전액 몰수</span></div>
            <div className="flex justify-between"><span>게시물</span><span>삭제 처리</span></div>
            <div className="flex justify-between"><span>재가입</span><span className="text-rose-400 font-[1000]">불가 (번호 블랙리스트)</span></div>
          </div>
          {reason && (
            <>
              <div className="my-3 border-t border-slate-700" />
              <p className="text-[10px] font-[1000] text-slate-400 mb-1">사유</p>
              <p className="text-[11px] font-medium text-slate-300">{reason}</p>
            </>
          )}
        </div>

        <p className="text-[11px] font-bold text-slate-500 mb-4">
          {countdown}초 후 자동 로그아웃됩니다
        </p>
        <button onClick={onLogout}
          className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[12px] font-[1000] transition-colors">
          지금 로그아웃
        </button>
      </div>
    </div>
  );
};

export default SayakScreen;
