// src/components/admin/SystemPanel.tsx — 🔧 관리자 시스템 운영 도구 (AdAdminPage 시스템 탭)
// Why: 콘솔 httpsCallable 접근이 번거로워 UI 버튼으로 편입 (feedback_admin_cf_ui_button)
//   (1) 예약어 시드 — reserved_nicknames 9종 주입
//   (2) Creator Score 조정 — adminAdjustCreatorScore CF (override 설정/해제)
//   (3) Abuse Flag 토글 — adminToggleAbuseFlag CF (Trust 감산 플래그)
//   (4) 🛡️ Sprint 6: 관리자 역할 부여/회수 — grantAdminRole / revokeAdminRole
//   (5) 🛡️ Sprint 6: admin_actions 감사 로그 뷰어 + 롤백 (5종 지원)
//   (6) 📱 Sprint 7 Step 7-F: 추천 무효화 — revokeReferralUse CF
import { useEffect, useState } from 'react';
import { auth, db, functions } from '../../firebase';
import { httpsCallable } from 'firebase/functions';
import { collection, onSnapshot, orderBy, query, limit, Timestamp } from 'firebase/firestore';

// Abuse Flag 키·라벨·감산값 — functions/utils/creatorScore.js TRUST_CONFIG.ABUSE_PENALTIES와 동기화
const ABUSE_FLAG_OPTIONS: { key: string; label: string; penalty: number }[] = [
  { key: 'shortPostSpam',       label: '단문 스팸 (shortPostSpam)',       penalty: 0.05 },
  { key: 'circularThanksball',  label: '맞땡스볼 (circularThanksball)',   penalty: 0.10 },
  { key: 'multiAccount',        label: '다계정 (multiAccount)',           penalty: 0.15 },
  { key: 'massFollowUnfollow',  label: '깐부 펌프 (massFollowUnfollow)',  penalty: 0.05 },
];

// 공통 httpsCallable 호출 헬퍼
function useCallable(name: string) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string>('');
  const [error, setError] = useState<string>('');

  const call = async (payload: object) => {
    if (busy) return;
    setBusy(true); setResult(''); setError('');
    try {
      const fn = httpsCallable(functions, name);
      const res = await fn(payload);
      setResult(JSON.stringify(res.data, null, 2));
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      setError(`${err.code || 'error'} — ${err.message || String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return { busy, result, error, call };
}

// 결과/에러 표시 블록
const ResultBlock = ({ result, error }: { result: string; error: string }) => (
  <>
    {result && (
      <pre className="mt-3 p-2 bg-slate-50 text-[11px] text-slate-700 rounded border border-slate-200 overflow-x-auto">{result}</pre>
    )}
    {error && (
      <p className="mt-3 p-2 bg-red-50 text-[11px] font-bold text-red-600 rounded border border-red-200">{error}</p>
    )}
  </>
);

// 🚀 섹션 1: 예약어 시드
const SeedReservedSection = () => {
  const { busy, result, error, call } = useCallable('seedReservedNicknames');
  return (
    <div className="p-4 border border-slate-200 rounded-lg">
      <h3 className="text-[13px] font-[1000] text-slate-800 mb-1">예약어 시드 (reserved_nicknames)</h3>
      <p className="text-[11px] font-bold text-slate-500 mb-3">
        흑무영·Admin·admin·운영자·관리자·claude·system·bot·전령 — 9개를 예약어 컬렉션에 주입합니다. 이미 존재하면 merge.
      </p>
      <button onClick={() => call({})} disabled={busy}
        className="px-3 py-1.5 rounded-md text-[12px] font-bold text-white bg-slate-800 hover:bg-slate-700 disabled:opacity-50"
      >
        {busy ? '실행 중...' : '시드 실행'}
      </button>
      <ResultBlock result={result} error={error} />
    </div>
  );
};

// 🏷️ Sprint 5 — 칭호 마스터 14종 seed (titles/{titleId} 주입)
const SeedTitlesSection = () => {
  const { busy, result, error, call } = useCallable('seedTitles');
  return (
    <div className="p-4 border border-slate-200 rounded-lg">
      <h3 className="text-[13px] font-[1000] text-slate-800 mb-1">🏷️ 칭호 마스터 시드 (titles 14종)</h3>
      <p className="text-[11px] font-bold text-slate-500 mb-3">
        creator 5 · community 5 · loyalty 4. 이미 존재하면 merge (카탈로그 변경 시 재실행으로 무중단 반영).
      </p>
      <button onClick={() => call({})} disabled={busy}
        className="px-3 py-1.5 rounded-md text-[12px] font-bold text-white bg-purple-600 hover:bg-purple-500 disabled:opacity-50"
      >
        {busy ? '실행 중...' : '시드 실행'}
      </button>
      <ResultBlock result={result} error={error} />
    </div>
  );
};

// 🆔 Sprint 7.5 — 기존 유저 userCode 일괄 부여 (배포 직후 1회 실행)
// onCreate 트리거는 신규 가입자만 처리 → 기존 유저는 이 버튼으로 일괄 발급.
// 멱등: userCode 이미 있는 유저는 skip. 중단 시 재실행 안전.
const MigrateUserCodesSection = () => {
  const { busy, result, error, call } = useCallable('migrateUserCodes');
  return (
    <div className="p-4 border border-slate-200 rounded-lg">
      <h3 className="text-[13px] font-[1000] text-slate-800 mb-1">🆔 기존 유저 userCode 일괄 부여 (migrateUserCodes)</h3>
      <p className="text-[11px] font-bold text-slate-500 mb-3">
        Sprint 7.5 배포 직후 <strong>1회 실행</strong>. onCreate 트리거가 안 탄 기존 유저 전원에게 8자리 userCode를 발급합니다.
        <br/>멱등 — 이미 userCode 있는 유저는 skip. admin_actions 감사 로그 자동 기록.
      </p>
      <button onClick={() => call({})} disabled={busy}
        className="px-3 py-1.5 rounded-md text-[12px] font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50"
      >
        {busy ? '마이그레이션 중... (최대 9분)' : '일괄 부여 실행'}
      </button>
      <ResultBlock result={result} error={error} />
    </div>
  );
};

// 🎁 Sprint 7 백필 — 기존 유저 referralCode 일괄 부여 (2026-04-24)
// onCreate 트리거 이전 가입자(테스트 계정 전부)가 "발급 중입니다" 무한 노출되는 문제 해결.
// 멱등: referralCode 이미 있는 유저는 skip. 중단 시 재실행 안전.
const BackfillReferralCodesSection = () => {
  const { busy, result, error, call } = useCallable('backfillReferralCodes');
  return (
    <div className="p-4 border border-slate-200 rounded-lg">
      <h3 className="text-[13px] font-[1000] text-slate-800 mb-1">🎁 기존 유저 referralCode 일괄 부여 (backfillReferralCodes)</h3>
      <p className="text-[11px] font-bold text-slate-500 mb-3">
        Sprint 7 트리거 이전 가입자가 MyPage 추천 탭에서 <strong>"발급 중입니다"</strong>로 보이는 문제 해소. 전원에게 6자리 referralCode 발급 + <span className="font-mono">referral_codes/&#123;code&#125;</span> 문서 생성.
        <br/>멱등 — 이미 referralCode 있는 유저는 skip. admin_actions 감사 로그 자동 기록.
      </p>
      <button onClick={() => call({})} disabled={busy}
        className="px-3 py-1.5 rounded-md text-[12px] font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50"
      >
        {busy ? '백필 중... (최대 9분)' : '일괄 부여 실행'}
      </button>
      <ResultBlock result={result} error={error} />
    </div>
  );
};

// 🚪 Sprint 7.5 핫픽스 — 레거시 유저 onboardingCompleted 일괄 주입
// 가입 시점이 Sprint 7.5 배포(2026-04-23 KST) 이전인 유저만 대상. 이미 완결된 유저는 skip.
// dryRun=true로 target 규모 먼저 측정 후, dryRun=false로 실제 반영.
const BackfillOnboardingSection = () => {
  const { busy, result, error, call } = useCallable('backfillOnboarding');
  const [reason, setReason] = useState('');

  return (
    <div className="p-4 border border-slate-200 rounded-lg">
      <h3 className="text-[13px] font-[1000] text-slate-800 mb-1">🚪 온보딩 완결 플래그 백필 (backfillOnboarding)</h3>
      <p className="text-[11px] font-bold text-slate-500 mb-3">
        Sprint 7.5 핫픽스 배포 직후 <strong>1회 실행</strong>. 2026-04-23 이전 가입자 전원에 <span className="font-mono">onboardingCompleted=true</span>를 일괄 주입해 재로그인 시 추천코드 게이트 재노출을 방지합니다.
        <br/>dry-run 먼저 → target 규모 확인 후 실제 반영. phoneVerified는 손대지 않음.
      </p>
      <div className="space-y-2">
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="사유 (실제 반영 시 2자 이상 필수)"
          rows={2}
          className="w-full px-3 py-1.5 text-[12px] border border-slate-200 rounded-md resize-none" />
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => call({ dryRun: true })} disabled={busy}
            className="px-3 py-1.5 rounded-md text-[12px] font-bold text-slate-700 border border-slate-300 hover:bg-slate-50 disabled:opacity-50"
          >
            {busy ? '실행 중...' : '🔍 dry-run (측정만)'}
          </button>
          <button onClick={() => call({ dryRun: false, reason: reason.trim() })} disabled={busy || reason.trim().length < 2}
            className="px-3 py-1.5 rounded-md text-[12px] font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50"
          >
            {busy ? '반영 중...' : '🚀 실제 반영'}
          </button>
        </div>
      </div>
      <ResultBlock result={result} error={error} />
    </div>
  );
};

// 🚀 섹션 2: Creator Score 수동 조정 (override 설정/해제)
const CreatorScoreAdjustSection = () => {
  const { busy, result, error, call } = useCallable('adminAdjustCreatorScore');
  const [uid, setUid] = useState('');
  const [value, setValue] = useState('1.0');
  const [reason, setReason] = useState('');
  const [expiresAtLocal, setExpiresAtLocal] = useState(''); // YYYY-MM-DDTHH:MM (local)

  const submitSet = () => {
    const v = parseFloat(value);
    if (!uid.trim() || isNaN(v) || !reason.trim()) return;
    const expiresAt = expiresAtLocal
      ? new Date(expiresAtLocal).getTime()
      : undefined;
    call({ targetUid: uid.trim(), action: 'set', value: v, reason: reason.trim(), expiresAt });
  };
  const submitClear = () => {
    if (!uid.trim() || !reason.trim()) return;
    call({ targetUid: uid.trim(), action: 'clear', reason: reason.trim() });
  };

  return (
    <div className="p-4 border border-slate-200 rounded-lg">
      <h3 className="text-[13px] font-[1000] text-slate-800 mb-1">🏅 Creator Score 수동 조정 (override)</h3>
      <p className="text-[11px] font-bold text-slate-500 mb-3">
        탐지 CF가 놓친 케이스 긴급 보정. 해제 전까지 유지 · expiresAt 경과 시 자동 제거. 사유 필수.
      </p>
      <div className="space-y-2">
        <input value={uid} onChange={(e) => setUid(e.target.value)} placeholder="targetUid"
          className="w-full px-3 py-1.5 text-[12px] font-mono border border-slate-200 rounded-md" />
        <div className="flex gap-2">
          <input type="number" step="0.01" min="0" max="10" value={value} onChange={(e) => setValue(e.target.value)}
            placeholder="value (0~10)"
            className="w-32 px-3 py-1.5 text-[12px] font-mono border border-slate-200 rounded-md" />
          <input type="datetime-local" value={expiresAtLocal} onChange={(e) => setExpiresAtLocal(e.target.value)}
            className="flex-1 px-3 py-1.5 text-[12px] font-mono border border-slate-200 rounded-md" />
        </div>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="사유 (2자 이상)"
          rows={2}
          className="w-full px-3 py-1.5 text-[12px] border border-slate-200 rounded-md resize-none" />
        <div className="flex gap-2">
          <button onClick={submitSet} disabled={busy || !uid.trim() || !reason.trim()}
            className="px-3 py-1.5 rounded-md text-[12px] font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50"
          >
            {busy ? '실행 중...' : '적용 (set)'}
          </button>
          <button onClick={submitClear} disabled={busy || !uid.trim() || !reason.trim()}
            className="px-3 py-1.5 rounded-md text-[12px] font-bold text-slate-700 border border-slate-300 hover:bg-slate-50 disabled:opacity-50"
          >
            {busy ? '실행 중...' : '해제 (clear)'}
          </button>
        </div>
      </div>
      <ResultBlock result={result} error={error} />
    </div>
  );
};

// 🚀 섹션 3: Abuse Flag 토글 (Trust 감산)
const AbuseFlagSection = () => {
  const { busy, result, error, call } = useCallable('adminToggleAbuseFlag');
  const [uid, setUid] = useState('');
  const [flag, setFlag] = useState(ABUSE_FLAG_OPTIONS[0].key);
  const [reason, setReason] = useState('');

  const submit = (enabled: boolean) => {
    if (!uid.trim() || !reason.trim()) return;
    call({ targetUid: uid.trim(), flag, enabled, reason: reason.trim() });
  };

  const penalty = ABUSE_FLAG_OPTIONS.find(o => o.key === flag)?.penalty ?? 0;

  return (
    <div className="p-4 border border-slate-200 rounded-lg">
      <h3 className="text-[13px] font-[1000] text-slate-800 mb-1">🚨 Abuse Flag 토글 (Trust 감산)</h3>
      <p className="text-[11px] font-bold text-slate-500 mb-3">
        Trust 공식에서 1.0 - Σ(감산) 적용. 하한 0.3. 선택 플래그 감산값: <span className="font-mono">{penalty}</span>
      </p>
      <div className="space-y-2">
        <input value={uid} onChange={(e) => setUid(e.target.value)} placeholder="targetUid"
          className="w-full px-3 py-1.5 text-[12px] font-mono border border-slate-200 rounded-md" />
        <select value={flag} onChange={(e) => setFlag(e.target.value)}
          className="w-full px-3 py-1.5 text-[12px] border border-slate-200 rounded-md"
        >
          {ABUSE_FLAG_OPTIONS.map(o => (
            <option key={o.key} value={o.key}>{o.label} · −{o.penalty}</option>
          ))}
        </select>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="사유 (2자 이상)"
          rows={2}
          className="w-full px-3 py-1.5 text-[12px] border border-slate-200 rounded-md resize-none" />
        <div className="flex gap-2">
          <button onClick={() => submit(true)} disabled={busy || !uid.trim() || !reason.trim()}
            className="px-3 py-1.5 rounded-md text-[12px] font-bold text-white bg-red-600 hover:bg-red-500 disabled:opacity-50"
          >
            {busy ? '실행 중...' : '켜기 (enable)'}
          </button>
          <button onClick={() => submit(false)} disabled={busy || !uid.trim() || !reason.trim()}
            className="px-3 py-1.5 rounded-md text-[12px] font-bold text-slate-700 border border-slate-300 hover:bg-slate-50 disabled:opacity-50"
          >
            {busy ? '실행 중...' : '끄기 (disable)'}
          </button>
        </div>
      </div>
      <ResultBlock result={result} error={error} />
    </div>
  );
};

// 🚀 섹션 4: 🛡️ Sprint 6 — 관리자 역할 부여/회수
// Custom Claims { admin: true } 부여·제거. 자기 자신 회수는 CF에서 차단(락아웃 방지).
// 본인 계정에 부여 후 브라우저에서 auth.currentUser.getIdToken(true) 필요 — 버튼 제공.
const AdminRoleSection = () => {
  const grant = useCallable('grantAdminRole');
  const revoke = useCallable('revokeAdminRole');
  const [uid, setUid] = useState('');
  const [reason, setReason] = useState('');
  const [refreshMsg, setRefreshMsg] = useState('');

  const submitGrant = () => {
    if (!uid.trim() || !reason.trim()) return;
    grant.call({ targetUid: uid.trim(), reason: reason.trim() });
  };
  const submitRevoke = () => {
    if (!uid.trim() || !reason.trim()) return;
    revoke.call({ targetUid: uid.trim(), reason: reason.trim() });
  };

  // 본인 토큰 강제 갱신 — 방금 자신에게 grant한 Claims를 즉시 반영
  const refreshMyToken = async () => {
    setRefreshMsg('');
    const user = auth.currentUser;
    if (!user) { setRefreshMsg('현재 로그인된 사용자가 없습니다.'); return; }
    try {
      await user.getIdToken(true);
      const tok = await user.getIdTokenResult();
      setRefreshMsg(`✅ 갱신 완료 — admin claim: ${tok.claims.admin === true ? 'true' : 'false'}`);
    } catch (e) {
      setRefreshMsg(`❌ 갱신 실패 — ${String(e)}`);
    }
  };

  const busy = grant.busy || revoke.busy;
  const result = grant.result || revoke.result;
  const error = grant.error || revoke.error;

  return (
    <div className="p-4 border border-slate-200 rounded-lg">
      <h3 className="text-[13px] font-[1000] text-slate-800 mb-1">🛡️ 관리자 역할 부여/회수 (Custom Claims)</h3>
      <p className="text-[11px] font-bold text-slate-500 mb-3">
        Auth Custom Claims <span className="font-mono">{'{ admin: true }'}</span> 부여/제거. 자기 자신 회수 차단 · admin_actions 자동 기록.
        <br/>본인에게 부여한 직후 <strong>내 토큰 갱신</strong> 버튼으로 즉시 반영.
      </p>
      <div className="space-y-2">
        <input value={uid} onChange={(e) => setUid(e.target.value)} placeholder="targetUid"
          className="w-full px-3 py-1.5 text-[12px] font-mono border border-slate-200 rounded-md" />
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="사유 (2자 이상)"
          rows={2}
          className="w-full px-3 py-1.5 text-[12px] border border-slate-200 rounded-md resize-none" />
        <div className="flex gap-2 flex-wrap">
          <button onClick={submitGrant} disabled={busy || !uid.trim() || !reason.trim()}
            className="px-3 py-1.5 rounded-md text-[12px] font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50"
          >
            {grant.busy ? '부여 중...' : '권한 부여 (grant)'}
          </button>
          <button onClick={submitRevoke} disabled={busy || !uid.trim() || !reason.trim()}
            className="px-3 py-1.5 rounded-md text-[12px] font-bold text-white bg-orange-600 hover:bg-orange-500 disabled:opacity-50"
          >
            {revoke.busy ? '회수 중...' : '권한 회수 (revoke)'}
          </button>
          <button onClick={refreshMyToken}
            className="px-3 py-1.5 rounded-md text-[12px] font-bold text-slate-700 border border-slate-300 hover:bg-slate-50"
          >
            내 토큰 갱신
          </button>
        </div>
      </div>
      {refreshMsg && (
        <p className="mt-2 p-2 bg-blue-50 text-[11px] font-bold text-blue-700 rounded border border-blue-200">{refreshMsg}</p>
      )}
      <ResultBlock result={result} error={error} />
    </div>
  );
};

// 🚀 섹션 5: 🛡️ Sprint 6 — admin_actions 감사 로그 뷰어 + 롤백
// admin_actions 컬렉션 최근 30건 onSnapshot 구독. 롤백 가능한 action만 버튼 활성.
interface AdminActionDoc {
  id: string;
  action: string;
  adminUid: string;
  adminName: string | null;
  viaClaims: boolean;
  targetUid: string | null;
  payload: Record<string, unknown>;
  reason: string;
  status: 'applied' | 'rolled_back';
  createdAt?: Timestamp;
}

// adminAudit.js ROLLBACKABLE_ACTIONS와 동기화
const ROLLBACKABLE = new Set([
  'grant_admin_role',
  'revoke_admin_role',
  'toggle_abuse_flag',
  'adjust_creator_score',
  'revoke_referral_use', // 🛡️ Sprint 7 Step 7-F — 추천 무효화 복원
]);

const formatKST = (ts: Timestamp | undefined): string => {
  if (!ts) return '-';
  const d = ts.toDate();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const AdminActionsLogSection = () => {
  const [docs, setDocs] = useState<AdminActionDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const rollback = useCallable('rollbackAdminAction');
  const [rollbackReason, setRollbackReason] = useState<Record<string, string>>({});

  useEffect(() => {
    const q = query(collection(db, 'admin_actions'), orderBy('createdAt', 'desc'), limit(30));
    const unsub = onSnapshot(q, (snap) => {
      const rows: AdminActionDoc[] = [];
      snap.forEach((d) => rows.push({ ...(d.data() as AdminActionDoc), id: d.id }));
      setDocs(rows);
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, []);

  const toggle = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id); else next.add(id);
    setExpanded(next);
  };

  const submitRollback = (id: string) => {
    const reason = (rollbackReason[id] || '').trim();
    if (reason.length < 2) return;
    rollback.call({ actionId: id, reason });
  };

  return (
    <div className="p-4 border border-slate-200 rounded-lg">
      <h3 className="text-[13px] font-[1000] text-slate-800 mb-1">📜 admin_actions 감사 로그 (최근 30건)</h3>
      <p className="text-[11px] font-bold text-slate-500 mb-3">
        관리자 CF 호출 이력. 롤백 지원 action: <span className="font-mono">grant/revoke_admin_role · toggle_abuse_flag · adjust_creator_score · revoke_referral_use</span>
      </p>

      {loading && <p className="text-[11px] font-bold text-slate-400">불러오는 중...</p>}
      {!loading && docs.length === 0 && <p className="text-[11px] font-bold text-slate-400">기록된 action이 없습니다.</p>}

      <div className="space-y-2">
        {docs.map((doc) => {
          const isOpen = expanded.has(doc.id);
          const canRollback = ROLLBACKABLE.has(doc.action) && doc.status === 'applied';
          return (
            <div key={doc.id} className="border border-slate-100 rounded-md">
              <button onClick={() => toggle(doc.id)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50"
              >
                <span className="text-[10px] font-mono text-slate-400 w-28 flex-shrink-0">{formatKST(doc.createdAt)}</span>
                <span className="text-[11px] font-[1000] text-slate-800 flex-1 truncate">{doc.action}</span>
                {doc.status === 'rolled_back' && (
                  <span className="text-[10px] font-bold text-orange-600 px-1.5 py-0.5 bg-orange-50 rounded">rolled_back</span>
                )}
                {!doc.viaClaims && doc.action !== 'rollback_admin_action' && (
                  <span className="text-[10px] font-bold text-slate-500 px-1.5 py-0.5 bg-slate-100 rounded">닉네임 fallback</span>
                )}
                <span className="text-[10px] font-mono text-slate-400 w-40 truncate text-right">{doc.adminName || doc.adminUid}</span>
              </button>
              {isOpen && (
                <div className="px-3 pb-3 pt-0 border-t border-slate-100">
                  <dl className="text-[11px] text-slate-600 grid grid-cols-[80px_1fr] gap-y-1 mt-2">
                    <dt className="font-bold">adminUid</dt><dd className="font-mono break-all">{doc.adminUid}</dd>
                    <dt className="font-bold">targetUid</dt><dd className="font-mono break-all">{doc.targetUid || '-'}</dd>
                    <dt className="font-bold">reason</dt><dd>{doc.reason || '-'}</dd>
                    <dt className="font-bold">payload</dt>
                    <dd>
                      <pre className="p-2 bg-slate-50 text-[10px] rounded border border-slate-200 overflow-x-auto">{JSON.stringify(doc.payload, null, 2)}</pre>
                    </dd>
                  </dl>
                  {canRollback && (
                    <div className="mt-2 flex gap-2 items-start">
                      <input
                        value={rollbackReason[doc.id] || ''}
                        onChange={(e) => setRollbackReason({ ...rollbackReason, [doc.id]: e.target.value })}
                        placeholder="롤백 사유 (2자 이상)"
                        className="flex-1 px-2 py-1 text-[11px] border border-slate-200 rounded"
                      />
                      <button onClick={() => submitRollback(doc.id)}
                        disabled={rollback.busy || (rollbackReason[doc.id] || '').trim().length < 2}
                        className="px-3 py-1 rounded text-[11px] font-bold text-white bg-orange-600 hover:bg-orange-500 disabled:opacity-50"
                      >
                        {rollback.busy ? '롤백 중...' : '롤백 실행'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <ResultBlock result={rollback.result} error={rollback.error} />
    </div>
  );
};

// 🚀 섹션 6: 📱 Sprint 7 Step 7-F — 추천 무효화 (revokeReferralUse)
// 의심 추천 수동 무효화. pending은 pendingCount-1만, confirmed는 추천자 -10 · 피추천자 -5 EXP 회수.
// 맞깐부 관계도 양방향 해제(각 -2 EXP). admin_actions에 snapshot 저장 → 롤백 지원.
// 입력 useId 형식: `{code}_{redeemerUid}` (referral_uses 문서 ID 그대로).
const ReferralRevokeSection = () => {
  const { busy, result, error, call } = useCallable('revokeReferralUse');
  const [useId, setUseId] = useState('');
  const [reason, setReason] = useState('');

  const submit = () => {
    if (!useId.trim() || reason.trim().length < 2) return;
    call({ useId: useId.trim(), reason: reason.trim() });
  };

  return (
    <div className="p-4 border border-slate-200 rounded-lg">
      <h3 className="text-[13px] font-[1000] text-slate-800 mb-1">📱 추천 무효화 (revokeReferralUse)</h3>
      <p className="text-[11px] font-bold text-slate-500 mb-3">
        의심 추천 수동 무효화. <span className="font-mono">pending</span>은 카운트만 -1 · <span className="font-mono">confirmed</span>는 추천자 -10 · 피추천자 -5 EXP 회수 + 맞깐부 해제(각 -2 EXP).
        <br/>useId 형식: <span className="font-mono">{'{code}_{redeemerUid}'}</span> · 감사 로그 뷰어에서 롤백 지원.
      </p>
      <div className="space-y-2">
        <input value={useId} onChange={(e) => setUseId(e.target.value)} placeholder="useId (예: ABC123_abcdef1234...)"
          className="w-full px-3 py-1.5 text-[12px] font-mono border border-slate-200 rounded-md" />
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="사유 (2자 이상)"
          rows={2}
          className="w-full px-3 py-1.5 text-[12px] border border-slate-200 rounded-md resize-none" />
        <button onClick={submit} disabled={busy || !useId.trim() || reason.trim().length < 2}
          className="px-3 py-1.5 rounded-md text-[12px] font-bold text-white bg-red-600 hover:bg-red-500 disabled:opacity-50"
        >
          {busy ? '무효화 중...' : '추천 무효화 실행'}
        </button>
      </div>
      <ResultBlock result={result} error={error} />
    </div>
  );
};

const SystemPanel = () => (
  <div className="space-y-4">
    <AdminRoleSection />
    <AdminActionsLogSection />
    <SeedReservedSection />
    <SeedTitlesSection />
    <MigrateUserCodesSection />
    <BackfillReferralCodesSection />
    <BackfillOnboardingSection />
    <CreatorScoreAdjustSection />
    <AbuseFlagSection />
    <ReferralRevokeSection />
  </div>
);

export default SystemPanel;
