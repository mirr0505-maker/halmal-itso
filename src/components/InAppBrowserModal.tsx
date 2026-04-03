// src/components/InAppBrowserModal.tsx — 인앱 브라우저 로그인 차단 안내 모달
// alert() 대신 앱 내 커스텀 UI로 교체 — Safari/Chrome으로 유도

interface Props {
  appName: string;          // '카카오톡' | '인스타그램' | '현재 앱'
  isIOS: boolean;
  isAndroid: boolean;
  currentUrl: string;
  onOpenExternal: () => void;
  onClose: () => void;
}

const InAppBrowserModal = ({ appName, isIOS, isAndroid, currentUrl, onOpenExternal, onClose }: Props) => {
  const browserName = isIOS ? 'Safari' : isAndroid ? 'Chrome' : '기본 브라우저';

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center">
      {/* 배경 딤 */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* 모달 카드 */}
      <div className="relative w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-2xl px-6 py-7 shadow-2xl animate-in slide-in-from-bottom-4 duration-300">

        {/* 아이콘 */}
        <div className="flex justify-center mb-4">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
            <svg className="w-7 h-7 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                d="M12 11c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2m-2 4h8m-4-10V3m-6 18H5a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v5" />
            </svg>
          </div>
        </div>

        {/* 제목 */}
        <h2 className="text-[16px] font-[1000] text-slate-900 text-center mb-2">
          {appName} 내부 브라우저 안내
        </h2>

        {/* 설명 */}
        <p className="text-[13px] font-medium text-slate-500 text-center leading-relaxed mb-5">
          보안 정책으로 인해 {appName} 내부 브라우저에서는<br />
          구글 로그인이 지원되지 않습니다.<br />
          <span className="font-bold text-slate-700">{browserName}</span>에서 열어주세요.
        </p>

        {/* URL 복사 안내 (iOS) */}
        {isIOS && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 mb-4 flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide shrink-0">링크</span>
            <span className="text-[11px] font-bold text-slate-500 truncate flex-1">{currentUrl}</span>
          </div>
        )}

        {/* 버튼 */}
        <div className="flex flex-col gap-2">
          <button
            onClick={onOpenExternal}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-[13px] font-[1000] rounded-xl transition-colors"
          >
            {isIOS ? '🔗 링크 복사하고 Safari로 이동' : isAndroid ? '🌐 Chrome으로 열기' : '🌐 기본 브라우저로 열기'}
          </button>
          <button
            onClick={onClose}
            className="w-full py-2.5 text-[12px] font-bold text-slate-400 hover:text-slate-600 transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};

export default InAppBrowserModal;
