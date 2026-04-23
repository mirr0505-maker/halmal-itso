// src/components/mypage/AccountManagementSection.tsx — 🔰 Sprint 7.5 MyPage 계정 관리 섹션
//
// 🚀 기능명: AccountManagementSection
//   MyPage 하단에 고정 노출되는 계정 관리 블록.
//   ① 내 고유번호(userCode) 표시 + 복사
//   ② 로그아웃 (Sidebar에서 이관)
//   ③ 회원탈퇴 → DeleteAccountFlow 모달
//
// Why 분리:
//   기존 Sidebar 로그아웃은 계정 민감 액션과 탐색 메뉴가 섞여 UX 혼란.
//   탈퇴·로그아웃·식별 정보를 한 카드에 모아 "계정" 맥락 명확화.

import { lazy, Suspense, useState } from "react";
import type { UserData } from "../../types";
import { USER_CODE_CONFIG } from "../../constants";

const DeleteAccountFlow = lazy(() => import("./DeleteAccountFlow"));

interface Props {
  userData: UserData;
  onLogout: () => void;
}

export default function AccountManagementSection({ userData, onLogout }: Props) {
  const [copied, setCopied] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const userCode = userData.userCode || "";
  const ballBalance = userData.ballBalance || 0;

  const handleCopy = async () => {
    if (!userCode) return;
    try {
      await navigator.clipboard.writeText(userCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* 클립보드 차단 환경 무시 */
    }
  };

  const handleDeleteRequested = () => {
    // 서버에서 isDeleted=true → onSnapshot 감지 → AccountRevivalModal 자동 노출
    // 여기서는 모달 닫고 로그아웃 플로우로 빠져나감
    setShowDelete(false);
    alert("탈퇴 요청이 접수되었습니다. 30일 이내 재로그인 시 복구 가능합니다.");
  };

  return (
    <section className="mt-6 bg-white rounded-2xl border border-slate-200 p-5">
      <h3 className="text-[13px] font-[1000] text-slate-900 mb-4">🔑 계정 관리</h3>

      {/* 고유번호 */}
      <div className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2.5 mb-4">
        <div>
          <p className="text-[10px] font-bold text-slate-500">내 고유번호</p>
          <p className="text-[14px] font-[1000] tracking-wider text-slate-800 font-mono">
            {userCode ? `${USER_CODE_CONFIG.DISPLAY_PREFIX}${userCode}` : "발급 중..."}
          </p>
        </div>
        {userCode && (
          <button
            onClick={handleCopy}
            className="text-[11px] font-[1000] text-violet-600 hover:text-violet-700 px-2.5 py-1.5 rounded-lg hover:bg-white"
          >
            {copied ? "✓ 복사됨" : "복사"}
          </button>
        )}
      </div>

      {/* 액션 버튼 */}
      <div className="space-y-2">
        <button
          onClick={onLogout}
          className="w-full h-11 rounded-xl border border-slate-200 text-[12px] font-[1000] text-slate-700 hover:bg-slate-50"
        >
          로그아웃
        </button>
        <button
          onClick={() => setShowDelete(true)}
          className="w-full h-11 rounded-xl text-[12px] font-bold text-rose-500 hover:text-rose-600 hover:bg-rose-50"
        >
          회원탈퇴
        </button>
      </div>

      {showDelete && (
        <Suspense fallback={null}>
          <DeleteAccountFlow
            nickname={userData.nickname || ""}
            ballBalance={ballBalance}
            onClose={() => setShowDelete(false)}
            onRequested={handleDeleteRequested}
          />
        </Suspense>
      )}
    </section>
  );
}
