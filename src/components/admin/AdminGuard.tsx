// src/components/admin/AdminGuard.tsx — 🛡️ Sprint 6 A-3 (2026-04-25 완료): Custom Claims 단일 체크
//
// useAdminAuth() — Custom Claims 단일 체크 훅
//   닉네임 fallback 제거. Claims 비동기 조회 → loading 초기값 true.
//
// AdminGuard — 훅을 래핑한 JSX. isAdmin false면 권한 없음 화면 표시.
//
// Why: 닉네임 도용/변경 공격 표면 완전 차단. 권한은 Firebase Auth ID Token에 박힘.
//      복구 경로: Firebase Console → Auth → 해당 uid → 맞춤 클레임 `{"admin":true}` 수동 주입.

import { useEffect, useState } from 'react';
import { getAuth } from 'firebase/auth';
import type { UserData } from '../../types';

interface AdminAuthState {
  loading: boolean;
  isAdmin: boolean;
  viaClaims: boolean;  // 항상 true (다른 경로 없음)
}

/**
 * 관리자 권한 확인 훅 (Custom Claims 단일 체크)
 *
 * Claims 확인은 `auth.currentUser.getIdTokenResult()` 비동기 호출이라
 * loading 상태를 먼저 노출. 토큰 갱신은 호출자가 별도로 처리 (예: SystemPanel "내 토큰 갱신" 버튼).
 */
export function useAdminAuth(currentUser: UserData | null): AdminAuthState {
  const [state, setState] = useState<AdminAuthState>({
    loading: true,
    isAdmin: false,
    viaClaims: false,
  });

  useEffect(() => {
    let cancelled = false;

    async function checkClaims() {
      const user = getAuth().currentUser;
      if (!user) {
        if (!cancelled) setState({ loading: false, isAdmin: false, viaClaims: false });
        return;
      }
      try {
        const tokenResult = await user.getIdTokenResult();
        const adminClaim = tokenResult.claims.admin === true;
        if (!cancelled) {
          setState({
            loading: false,
            isAdmin: adminClaim,
            viaClaims: adminClaim,
          });
        }
      } catch {
        if (!cancelled) {
          setState({ loading: false, isAdmin: false, viaClaims: false });
        }
      }
    }

    checkClaims();
    return () => { cancelled = true; };
  }, [currentUser]);

  return state;
}

interface Props {
  currentUser: UserData | null;
  onBack?: () => void;
  children: React.ReactNode;
}

const AdminGuard = ({ currentUser, onBack, children }: Props) => {
  const { loading, isAdmin } = useAdminAuth(currentUser);

  if (loading) {
    return (
      <div className="w-full max-w-2xl mx-auto py-20 text-center">
        <p className="text-[12px] font-bold text-slate-400">권한 확인 중...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="w-full max-w-2xl mx-auto py-20 text-center">
        <p className="text-[40px] mb-3">🔒</p>
        <p className="text-[15px] font-[1000] text-slate-700 mb-1">접근 권한이 없습니다</p>
        <p className="text-[12px] font-bold text-slate-400">관리자만 이용할 수 있어요</p>
        {onBack && (
          <button onClick={onBack} className="mt-4 px-4 py-2 rounded-lg text-[12px] font-bold text-slate-500 border border-slate-200 hover:bg-slate-50">
            ← 돌아가기
          </button>
        )}
      </div>
    );
  }

  return <>{children}</>;
};

export default AdminGuard;
