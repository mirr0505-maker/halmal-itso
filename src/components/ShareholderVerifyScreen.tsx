// src/components/ShareholderVerifyScreen.tsx — 🛡️ 멤버용 주주 인증 등록 화면
// 2탭 구조: 📸 스크린샷 인증 / 📊 마이데이터 인증
import { useState } from 'react';
import { db, auth } from '../firebase';
import { doc, updateDoc, serverTimestamp, addDoc, collection, Timestamp } from 'firebase/firestore';
import { uploadToR2 } from '../uploadToR2';
import type { Community, CommunityMember, UserData } from '../types';
import { TIER_CONFIG, getTierFromQuantity, tierRangeLabel } from '../types';

interface Props {
  community: Community;
  membership: CommunityMember & { id: string };
  currentUserData: UserData;
  onClose: () => void;
}

type VerifyMethod = 'screenshot' | 'mydata';
type MydataStep = 'idle' | 'loading' | 'result' | 'submitted';

const ShareholderVerifyScreen = ({ community, membership, currentUserData, onClose }: Props) => {
  const [method, setMethod] = useState<VerifyMethod>('screenshot');
  // 📸 스크린샷 state
  const [screenshotUrl, setScreenshotUrl] = useState('');
  const [selfReportedQty, setSelfReportedQty] = useState('');
  const [uploading, setUploading] = useState(false);
  // 📊 마이데이터 state
  const [mydataStep, setMydataStep] = useState<MydataStep>('idle');
  const [mydataResult, setMydataResult] = useState<{ tier: string; tierEmoji: string; tierLabel: string; message: string; mock: boolean } | null>(null);
  // 공통
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const existingRequest = membership.verifyRequest;
  const isReverifyRequested = !!membership.reverifyRequestedAt;
  const hasVerified = !!membership.verified?.tier;
  const tierCfg = hasVerified && membership.verified?.tier ? TIER_CONFIG[membership.verified.tier] : null;
  const stockName = community.shareholderSettings?.stockName || '';
  const stockCode = community.shareholderSettings?.stockCode || '';

  // 📸 이미지 업로드
  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `uploads/${currentUserData.uid}/shareholder_${Date.now()}.${ext}`;
      setScreenshotUrl(await uploadToR2(file, path));
    } catch { alert('이미지 업로드에 실패했습니다.'); }
    finally { setUploading(false); }
  };

  // 📸 스크린샷 제출
  const handleScreenshotSubmit = async () => {
    if (!screenshotUrl) { setError('스크린샷을 등록해주세요.'); return; }
    const qty = parseInt(selfReportedQty, 10);
    if (!qty || qty < 1) { setError('보유수를 입력해주세요.'); return; }
    setSubmitting(true); setError(null);
    try {
      await updateDoc(doc(db, 'community_memberships', membership.id), {
        verifyRequest: { screenshotUrl, selfReportedQty: qty, requestedAt: serverTimestamp(), status: 'pending' },
        reverifyRequestedAt: null,
      });
      if (community.creatorId) {
        await addDoc(collection(db, 'notifications', community.creatorId, 'items'), {
          type: 'shareholder_verify_submitted', fromNickname: currentUserData.nickname,
          communityId: community.id, communityName: community.name,
          message: `${currentUserData.nickname}님이 스크린샷 인증을 요청했습니다 (${qty.toLocaleString()}주)`,
          createdAt: Timestamp.now(), read: false,
        });
      }
      setSubmitted(true);
    } catch { setError('인증 요청에 실패했습니다.'); }
    finally { setSubmitting(false); }
  };

  // 📊 마이데이터 조회
  const handleMydataQuery = async () => {
    setMydataStep('loading'); setError(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) { setError('로그인이 필요합니다.'); setMydataStep('idle'); return; }
      const res = await fetch('https://halmal-upload-worker.mirr0505.workers.dev/api/verify-shares', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ stockCode, communityId: community.id }),
      });
      const data = await res.json() as { success?: boolean; tier?: string; tierEmoji?: string; tierLabel?: string; message?: string; mock?: boolean; error?: string; details?: string };
      if (!data.success) {
        setError(data.error || '조회에 실패했습니다.');
        setMydataStep('idle');
        return;
      }
      setMydataResult({ tier: data.tier!, tierEmoji: data.tierEmoji!, tierLabel: data.tierLabel!, message: data.message!, mock: data.mock || false });
      setMydataStep('result');
    } catch { setError('마이데이터 조회에 실패했습니다.'); setMydataStep('idle'); }
  };

  // 📊 마이데이터 결과 제출
  const handleMydataSubmit = async () => {
    if (!mydataResult) return;
    setSubmitting(true); setError(null);
    try {
      await updateDoc(doc(db, 'community_memberships', membership.id), {
        verifyRequest: {
          screenshotUrl: '', selfReportedQty: 0, requestedAt: serverTimestamp(), status: 'pending',
          source: 'mydata', suggestedTier: mydataResult.tier, mock: mydataResult.mock,
        },
        reverifyRequestedAt: null,
      });
      if (community.creatorId) {
        await addDoc(collection(db, 'notifications', community.creatorId, 'items'), {
          type: 'shareholder_verify_submitted', fromNickname: currentUserData.nickname,
          communityId: community.id, communityName: community.name,
          message: `${currentUserData.nickname}님이 마이데이터 인증을 요청했습니다 (${mydataResult.tierEmoji} ${mydataResult.tierLabel})`,
          createdAt: Timestamp.now(), read: false,
        });
      }
      setMydataStep('submitted');
      setSubmitted(true);
    } catch { setError('인증 요청에 실패했습니다.'); }
    finally { setSubmitting(false); }
  };

  // ── 제출 완료 화면 ──
  if (submitted || (existingRequest?.status === 'pending' && !isReverifyRequested)) {
    return (
      <div className="py-10 px-6 text-center">
        <p className="text-[14px] font-[1000] text-slate-800 mb-2">인증 요청이 제출되었습니다</p>
        <p className="text-[12px] font-bold text-slate-400">방장의 승인을 기다려주세요.</p>
      </div>
    );
  }

  return (
    <div className="py-4 px-5">
      {/* 상단: 현재 상태 + 종목 한 줄 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 min-w-0">
          {hasVerified && tierCfg ? (
            <span className="text-[11px] font-[1000] text-slate-600">현재 {tierCfg.emoji} {tierCfg.label}</span>
          ) : (
            <span className="text-[11px] font-[1000] text-slate-400">미인증</span>
          )}
          {stockName && <span className="text-[10px] font-bold text-slate-400">· {stockName} ({stockCode})</span>}
          {isReverifyRequested && <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">재인증 요청</span>}
        </div>
      </div>

      {/* 인증 방법 선택 탭 */}
      <div className="flex border border-slate-200 rounded-lg overflow-hidden mb-5">
        {([['screenshot', '📸 스크린샷 인증'], ['mydata', '📊 마이데이터 인증']] as [VerifyMethod, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => { setMethod(key); setError(null); }}
            className={`flex-1 py-2 text-[12px] font-[1000] transition-colors ${
              method === key
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-400 hover:bg-slate-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── 📸 스크린샷 인증 ── */}
      {method === 'screenshot' && (
        <div className="space-y-4">
          {/* 스크린샷 업로드 */}
          <div>
            {screenshotUrl ? (
              <div className="relative">
                <img src={screenshotUrl} alt="" className="w-full max-h-[250px] object-contain rounded-lg border border-slate-200" />
                <button onClick={() => setScreenshotUrl('')}
                  className="absolute top-2 right-2 w-6 h-6 bg-slate-900/60 text-white rounded-full flex items-center justify-center text-[10px]">✕</button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-1.5 py-10 bg-slate-50 border border-dashed border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors">
                <svg className="w-6 h-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                <span className="text-[11px] font-bold text-slate-400">{uploading ? '업로드 중...' : '증권사 보유 현황 스크린샷 선택'}</span>
                <span className="text-[9px] font-bold text-slate-300">방장만 열람 · 승인 후 30일 자동 삭제</span>
                <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0])} disabled={uploading} />
              </label>
            )}
          </div>

          {/* 보유수 입력 */}
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={selfReportedQty}
              onChange={e => { setSelfReportedQty(e.target.value); if (error) setError(null); }}
              placeholder="자기신고) 보유수 입력"
              min={1}
              className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-[13px] font-bold text-slate-700 focus:outline-none focus:border-slate-400 placeholder:text-slate-300"
            />
            <span className="text-[11px] font-bold text-slate-400 shrink-0">주</span>
          </div>
          {selfReportedQty && parseInt(selfReportedQty) > 0 && (() => {
            const t = getTierFromQuantity(parseInt(selfReportedQty));
            return <p className="text-[10px] font-bold text-slate-400">예상 등급: {TIER_CONFIG[t].emoji} {TIER_CONFIG[t].label}</p>;
          })()}

          <p className="text-[9px] font-bold text-slate-400">🔒 스크린샷은 방장만 열람 가능하며, 인증 승인 후 30일 뒤 자동 삭제됩니다.</p>

          {/* 등급 기준 */}
          <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg">
            <p className="text-[9px] font-[1000] text-slate-400 mb-1">등급 기준</p>
            <div className="grid grid-cols-2 gap-0.5">
              {(Object.values(TIER_CONFIG)).map(cfg => (
                <span key={cfg.label} className="text-[9px] font-bold text-slate-500">
                  {cfg.emoji} {cfg.label}: {cfg.min.toLocaleString()}주{cfg.max === Infinity ? '+' : `~${cfg.max.toLocaleString()}주`}
                </span>
              ))}
            </div>
          </div>

          {error && <p className="text-[11px] font-bold text-red-500">{error}</p>}

          <button
            onClick={handleScreenshotSubmit}
            disabled={submitting || uploading}
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-700 disabled:opacity-40 text-white rounded-lg text-[12px] font-[1000] transition-colors"
          >
            {submitting ? '제출 중...' : '인증 요청 제출'}
          </button>
        </div>
      )}

      {/* ── 📊 마이데이터 인증 ── */}
      {method === 'mydata' && (
        <div className="space-y-4">
          {/* Step 1: 조회 전 */}
          {/* 등급 기준 — 마이데이터 탭에서도 표시 */}
          <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg">
            <p className="text-[9px] font-[1000] text-slate-400 mb-1">등급 기준</p>
            <div className="grid grid-cols-2 gap-0.5">
              {(Object.values(TIER_CONFIG)).map(cfg => (
                <span key={cfg.label} className="text-[9px] font-bold text-slate-500">
                  {cfg.emoji} {cfg.label}: {cfg.min.toLocaleString()}주{cfg.max === Infinity ? '+' : `~${cfg.max.toLocaleString()}주`}
                </span>
              ))}
            </div>
          </div>

          {mydataStep === 'idle' && (
            <>
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-lg text-center">
                <p className="text-[12px] font-[1000] text-slate-700 mb-1">증권사 보유 현황을 자동으로 조회합니다</p>
                <p className="text-[10px] font-bold text-slate-400">{stockName} ({stockCode}) 종목의 보유수를 확인합니다</p>
              </div>
              {error && <p className="text-[11px] font-bold text-red-500">{error}</p>}
              <button
                onClick={handleMydataQuery}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-700 text-white rounded-lg text-[12px] font-[1000] transition-colors"
              >
                조회 시작
              </button>
            </>
          )}

          {/* Step 2: 조회 중 */}
          {mydataStep === 'loading' && (
            <div className="py-8 text-center">
              <div className="w-8 h-8 border-3 border-slate-300 border-t-slate-700 rounded-full animate-spin mx-auto mb-3" />
              <p className="text-[12px] font-[1000] text-slate-600">증권사 보유 현황을 조회하고 있습니다...</p>
              <p className="text-[10px] font-bold text-slate-400 mt-1">잠시만 기다려주세요</p>
            </div>
          )}

          {/* Step 3: 결과 확인 */}
          {mydataStep === 'result' && mydataResult && (
            <>
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-center">
                <span className="text-[32px]">{mydataResult.tierEmoji}</span>
                <p className="text-[14px] font-[1000] text-slate-800 mt-2">{mydataResult.tierLabel}</p>
                <p className="text-[10px] font-bold text-slate-400 mt-1">
                  {tierRangeLabel(mydataResult.tier as Parameters<typeof tierRangeLabel>[0])}주 보유 범위
                  {mydataResult.mock && ' · 테스트 모드'}
                </p>
              </div>
              {error && <p className="text-[11px] font-bold text-red-500">{error}</p>}
              <button
                onClick={handleMydataSubmit}
                disabled={submitting}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-700 disabled:opacity-40 text-white rounded-lg text-[12px] font-[1000] transition-colors"
              >
                {submitting ? '제출 중...' : '이 결과로 인증 요청'}
              </button>
              <button
                onClick={() => { setMydataStep('idle'); setMydataResult(null); }}
                className="w-full py-2 text-[11px] font-bold text-slate-400 hover:text-slate-600 transition-colors"
              >
                다시 조회
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ShareholderVerifyScreen;
