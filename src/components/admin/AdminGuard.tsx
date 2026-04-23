// src/components/admin/AdminGuard.tsx — 🛡️ Sprint 6 A-1: 관리자 권한 가드
//
// useAdminAuth() — Custom Claims OR 닉네임 이중 체크 훅
//   Phase A-1: Claims true || 닉네임 화이트리스트 → isAdmin: true
//   Phase A-3: 화이트리스트 제거, Claims 단일 체크로 전환 예정
//
// AdminGuard — 훅을 래핑한 JSX. isAdmin false면 권한 없음 화면 표시.
//
// Why: 기존 `PLATFORM_ADMIN_NICKNAMES.includes(currentUser.nickname)` 방식은
//      닉네임 변경 공격 표면을 가짐 + 화이트리스트 하드코딩이 여러 곳.
//      훅으로 중앙화하여 향후 A-3 전환 시 이 파일만 수정.

import { useEffect, useState } from 'react';
import { getAuth } from 'firebase/auth';
import type { UserData } from '../../types';
import { PLATFORM_ADMIN_NICKNAMES } from '../../constants';

interface AdminAuthState {
  loading: boolean;
  isAdmin: boolean;
  viaClaims: boolean;  // true = Custom Claims 경로 / false = 닉네임 fallback
}

/**
 * 관리자 권한 확인 훅 (Claims + 닉네임 이중 체크)
 *
 * Claims 확인은 `auth.currentUser.getIdTokenResult()` 비동기 호출이라
 * loading 상태를 먼저 노출. 닉네임 경로는 currentUser prop에서 즉시 판정.
 */
export function useAdminAuth(currentUser: UserData | null): AdminAuthState {
  const [state, setState] = useState<AdminAuthState>(() => {
    // 닉네임 경로는 즉시 확정 가능 — loading false로 시작
    const byNickname = !!currentUser && PLATFORM_ADMIN_NICKNAMES.includes(currentUser.nickname);
    return {
      loading: !byNickname, // 닉네임 통과하면 loading 불필요
      isAdmin: byNickname,
      viaClaims: false,
    };
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
        const byNickname = !!currentUser && PLATFORM_ADMIN_NICKNAMES.includes(currentUser.nickname);
        if (!cancelled) {
          setState({
            loading: false,
            isAdmin: adminClaim || byNickname,
            viaClaims: adminClaim,
          });
        }
      } catch {
        // Claims 조회 실패해도 닉네임 fallback 유지
        const byNickname = !!currentUser && PLATFORM_ADMIN_NICKNAMES.includes(currentUser.nickname);
        if (!cancelled) {
          setState({ loading: false, isAdmin: byNickname, viaClaims: false });
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
