// src/components/ReferralSection.tsx
// 🎁 Sprint 7 Step 7-D — 추천코드 섹션 (MyPage 🎁 추천 탭)
// 영역:
//   1) 내 코드 카드 — 본인 referralCode 표시 + 복사 + /r/:code 공유 링크
//   2) 추천 통계 — pending / confirmed / monthlyCount / TOTAL_CAP 진행률
//   3) 코드 입력 — referredByCode 미설정자 전용 (redeemReferralCode CF)
//
// Why 단일 컴포넌트:
//   MyPage 탭에만 들어가는 독립 섹션. 입력/통계/공유가 하나의 맥락 — 분리 과공학.

import { useEffect, useMemo, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { getInstallations, getId } from 'firebase/installations';
import app, { functions } from '../firebase';
import { REFERRAL_CONFIG } from '../constants';
import type { UserData } from '../types';

// 🛡️ Step 7-E — Firebase Installations ID를 deviceFingerprint로 재사용.
//    장점: SDK 공식 지원 + 브라우저·앱 단위 고유 (로그인 상태 무관) + 서버 저장·매칭만 하면 됨.
//    실패 복원: 회사망·광고차단기 등 ID 수집 차단 시 빈 문자열 반환 — 서버가 시그널 무력으로 처리.
async function getDeviceFingerprint(): Promise<string> {
  try {
    const id = await getId(getInstallations(app));
    return typeof id === 'string' && id.length > 0 && id.length <= 128 ? id : '';
  } catch {
    return '';
  }
}

interface Props {
  userData: UserData;
}

// 🎁 CF 에러 코드 → 한국어 메시지 매핑
// Why: redeemReferralCode가 HttpsError로 던지는 각 케이스를 사용자 친화적으로 표시
function mapRedeemError(code: string | undefined, message: string): string {
  if (!code) return message || '추천코드 등록에 실패했습니다.';
  if (code === 'functions/unauthenticated') return '로그인이 필요합니다.';
  if (code === 'functions/invalid-argument') return message || '추천코드 형식이 올바르지 않습니다.';
  if (code === 'functions/not-found') return '존재하지 않는 추천코드입니다.';
  if (code === 'functions/permission-denied') return '사용할 수 없는 추천코드입니다 (비활성/사약).';
  if (code === 'functions/already-exists') return message || '이미 사용했거나 중복된 번호입니다.';
  if (code === 'functions/failed-precondition') return message || '휴대폰 인증이 먼저 필요합니다.';
  if (code === 'functions/resource-exhausted') return message || '추천인이 상한에 도달했습니다.';
  if (code === 'functions/unavailable') return '일시적으로 처리할 수 없습니다. 잠시 후 다시 시도해주세요.';
  return message || '추천코드 등록에 실패했습니다.';
}

export default function ReferralSection({ userData }: Props) {
  const myCode = userData.referralCode || '';
  const alreadyRedeemed = !!userData.referredByCode;
  // 🚪 Sprint 7.5 핫픽스 — 추천코드는 "회원가입 시에만" 입력 가능.
  // Why: 온보딩 완결(onboardingCompleted=true) 유저가 MyPage에서 뒤늦게 입력해도 서버가 거절하므로,
  //      UI도 입력창 대신 안내 메시지로 전환. redeem 경로가 남아있지 않다는 명확한 시그널.
  const onboardingLocked = userData.onboardingCompleted === true && !alreadyRedeemed;
  const shareUrl = useMemo(
    () => (myCode ? `https://geulove.com/r/${myCode}` : ''),
    [myCode]
  );

  const pending = userData.referralPendingCount || 0;
  const confirmed = userData.referralConfirmedCount || 0;
  const monthlyCount = userData.referralMonthlyCount || 0;
  const totalUsed = pending + confirmed;
  const totalPct = Math.min(100, Math.round((totalUsed / REFERRAL_CONFIG.TOTAL_CAP) * 100));
  const monthlyPct = Math.min(100, Math.round((monthlyCount / REFERRAL_CONFIG.MONTHLY_CAP) * 100));

  const [inputCode, setInputCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // 🎁 공유 링크로 접근한 신규 유저: sessionStorage에 보관된 코드 자동 프리필
  useEffect(() => {
    if (alreadyRedeemed) return;
    try {
      const saved = sessionStorage.getItem('pendingReferralCode');
      if (saved && /^[A-Z0-9]{6,8}$/.test(saved)) {
        setInputCode(saved);
      }
    } catch { /* sessionStorage 차단 환경 무시 */ }
  }, [alreadyRedeemed]);

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 레거시 브라우저 fallback
      const el = document.createElement('textarea');
      el.value = shareUrl;
      document.body.appendChild(el);
      el.select();
      try { document.execCommand('copy'); setCopied(true); setTimeout(() => setCopied(false), 1500); }
      finally { document.body.removeChild(el); }
    }
  };

  const handleShare = async () => {
    if (!shareUrl) return;
    const shareData = {
      title: `글러브 GeuLove 초대`,
      text: `${userData.nickname}님이 당신을 초대했어요.`,
      url: shareUrl,
    };
    // Web Share API 있으면 네이티브 시트, 없으면 복사로 폴백
    if (typeof navigator.share === 'function') {
      try { await navigator.share(shareData); return; }
      catch { /* 사용자 취소 등 — 아무 동작 없음 */ }
    }
    handleCopy();
  };

  const handleRedeem = async () => {
    const trimmed = inputCode.trim().toUpperCase();
    if (trimmed.length < REFERRAL_CONFIG.CODE_LENGTH || trimmed.length > REFERRAL_CONFIG.CODE_LENGTH_FALLBACK) {
      setResult({ type: 'error', text: '추천코드 길이가 올바르지 않습니다.' });
      return;
    }
    if (!/^[A-Z0-9]+$/.test(trimmed)) {
      setResult({ type: 'error', text: '영문 대문자/숫자만 입력 가능합니다.' });
      return;
    }
    setSubmitting(true);
    setResult(null);
    try {
      // 🛡️ Step 7-E: Installations ID 수집은 redeem 직전에만 (미리 전역 수집 X — 프라이버시 노출 최소화)
      const deviceFingerprint = await getDeviceFingerprint();
      const call = httpsCallable<
        { code: string; deviceFingerprint: string },
        { ok: boolean; codeOwnerNickname: string; mutualKanbuEstablished: boolean }
      >(functions, 'redeemReferralCode');
      const { data } = await call({ code: trimmed, deviceFingerprint });
      // sessionStorage 정리 — 재진입 방지
      try { sessionStorage.removeItem('pendingReferralCode'); } catch { /* 무시 */ }
      setInputCode('');
      const mutualMsg = data.mutualKanbuEstablished
        ? ` 🤝 ${data.codeOwnerNickname}님과 자동으로 깐부가 되었어요 (+2 EXP)`
        : '';
      setResult({
        type: 'ok',
        text: `${data.codeOwnerNickname}님의 추천 등록 완료. 7일 내 글 1개 또는 댓글 3개 작성 시 Welcome +5 EXP!${mutualMsg}`,
      });
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      setResult({ type: 'error', text: mapRedeemError(err.code, err.message || '') });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* ─────────────────────────────────────────── */}
      {/* 1) 내 코드 카드 */}
      {/* ─────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-100 bg-gradient-to-br from-indigo-50/50 to-white p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[20px]">🎁</span>
          <h3 className="text-[15px] font-[1000] text-slate-800 tracking-tight">내 추천코드</h3>
        </div>
        {myCode ? (
          <>
            <div className="flex items-center gap-2 mb-4">
              <div className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 font-mono text-[22px] font-[1000] text-indigo-600 tracking-[0.2em] text-center select-all">
                {myCode}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-[12px] text-slate-500 break-all">
                {shareUrl}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCopy}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-[13px] font-[1000] transition-all"
                >
                  {copied ? '✅ 복사됨' : '🔗 링크 복사'}
                </button>
                <button
                  onClick={handleShare}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 text-[13px] font-[1000] transition-all"
                >
                  📤 공유하기
                </button>
              </div>
            </div>
            <p className="mt-4 text-[11px] text-slate-400 leading-relaxed">
              친구가 이 코드로 가입 + 7일 내 글 1개 또는 댓글 3개 작성 시
              <br />
              당신에게 <span className="text-indigo-500 font-[1000]">+10 EXP</span>, 친구에게 <span className="text-indigo-500 font-[1000]">+5 EXP</span> 지급.
              가입 직후 양쪽 <span className="text-indigo-500 font-[1000]">🤝 깐부 자동 맺기</span>(+2 EXP씩).
            </p>
          </>
        ) : (
          <p className="text-[13px] text-slate-400">추천코드 발급 중입니다. 잠시 후 새로고침 해주세요.</p>
        )}
      </div>

      {/* ─────────────────────────────────────────── */}
      {/* 2) 추천 통계 */}
      {/* ─────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <h3 className="text-[15px] font-[1000] text-slate-800 tracking-tight mb-4">📊 추천 현황</h3>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
            <div className="text-[11px] font-[1000] text-amber-500 mb-1">대기 중</div>
            <div className="text-[24px] font-[1000] text-amber-600">{pending}</div>
            <div className="text-[10px] text-amber-400 mt-0.5">7일 활성 판정 중</div>
          </div>
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
            <div className="text-[11px] font-[1000] text-emerald-500 mb-1">확정됨</div>
            <div className="text-[24px] font-[1000] text-emerald-600">{confirmed}</div>
            <div className="text-[10px] text-emerald-400 mt-0.5">보상 지급 완료</div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-[1000] text-slate-500">이번 달 한도</span>
              <span className="text-[11px] font-[1000] text-slate-400">{monthlyCount} / {REFERRAL_CONFIG.MONTHLY_CAP}</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-400 transition-all" style={{ width: `${monthlyPct}%` }} />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-[1000] text-slate-500">베타 상한</span>
              <span className="text-[11px] font-[1000] text-slate-400">{totalUsed} / {REFERRAL_CONFIG.TOTAL_CAP}</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-slate-500 transition-all" style={{ width: `${totalPct}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────── */}
      {/* 3) 코드 입력 (referredByCode 미설정자만) */}
      {/* ─────────────────────────────────────────── */}
      {alreadyRedeemed ? (
        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-6">
          <h3 className="text-[15px] font-[1000] text-slate-800 tracking-tight mb-2">✅ 추천코드 등록 완료</h3>
          <p className="text-[12px] text-slate-500">
            추천받은 코드: <span className="font-mono font-[1000] text-slate-700">{userData.referredByCode}</span>
          </p>
          <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
            코드는 1인 1회만 사용할 수 있습니다. 7일 내 활성 기준(글 1개 또는 댓글 3개)을 달성하면 Welcome +5 EXP가 자동 지급됩니다.
          </p>
        </div>
      ) : onboardingLocked ? (
        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-6">
          <h3 className="text-[15px] font-[1000] text-amber-900 tracking-tight mb-2">🎟️ 추천코드는 가입 시에만 입력 가능합니다</h3>
          <p className="text-[12px] text-amber-700 leading-relaxed">
            회원가입 온보딩의 마지막 단계에서 1회만 입력할 수 있어요.
            <br />
            가입 완료 후에는 다시 입력할 수 없지만, <b>내 코드를 친구에게 공유</b>하면 맞깐부 + EXP 보너스를 계속 받을 수 있습니다.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <h3 className="text-[15px] font-[1000] text-slate-800 tracking-tight mb-2">🎟️ 추천코드 입력</h3>
          <p className="text-[12px] text-slate-400 mb-4 leading-relaxed">
            친구에게 받은 코드를 입력하면 자동 깐부 + Welcome EXP를 받아요.
            <br />
            <span className="text-slate-300">휴대폰 인증 완료자만 사용 가능 · 1인 1회</span>
          </p>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value.toUpperCase().slice(0, REFERRAL_CONFIG.CODE_LENGTH_FALLBACK))}
              placeholder="예: ABC123"
              className="flex-1 px-4 py-3 rounded-xl border border-slate-200 bg-white font-mono text-[18px] font-[1000] tracking-[0.2em] text-center text-slate-700 placeholder:text-slate-300 focus:outline-none focus:border-indigo-400"
              disabled={submitting}
              maxLength={REFERRAL_CONFIG.CODE_LENGTH_FALLBACK}
            />
            <button
              onClick={handleRedeem}
              disabled={submitting || inputCode.length < REFERRAL_CONFIG.CODE_LENGTH}
              className="px-5 py-3 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 disabled:bg-slate-200 disabled:text-slate-400 text-[13px] font-[1000] transition-all whitespace-nowrap"
            >
              {submitting ? '처리 중...' : '등록'}
            </button>
          </div>
          {result && (
            <div
              className={`rounded-xl px-4 py-3 text-[12px] leading-relaxed ${
                result.type === 'ok'
                  ? 'bg-emerald-50 border border-emerald-100 text-emerald-600'
                  : 'bg-rose-50 border border-rose-100 text-rose-600'
              }`}
            >
              {result.text}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
