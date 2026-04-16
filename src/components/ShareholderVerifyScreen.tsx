// src/components/ShareholderVerifyScreen.tsx — 🛡️ 멤버용 주주 인증 등록 화면
// 주주방 멤버가 증권사 보유 스크린샷을 업로드하고 자기신고 보유수를 입력하여 인증 요청
// 방장이 VerifyShareholderPanel에서 확인 후 등급 부여
import { useState } from 'react';
import { db } from '../firebase';
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

const ShareholderVerifyScreen = ({ community, membership, currentUserData, onClose }: Props) => {
  const [screenshotUrl, setScreenshotUrl] = useState('');
  const [selfReportedQty, setSelfReportedQty] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const existingRequest = membership.verifyRequest;
  const isReverifyRequested = !!membership.reverifyRequestedAt;
  const hasVerified = !!membership.verified?.tier;
  const tierCfg = hasVerified && membership.verified?.tier ? TIER_CONFIG[membership.verified.tier] : null;

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `uploads/${currentUserData.uid}/shareholder_${Date.now()}.${ext}`;
      const url = await uploadToR2(file, path);
      setScreenshotUrl(url);
    } catch {
      alert('이미지 업로드에 실패했습니다.');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!screenshotUrl) { setError('증권사 보유 현황 스크린샷을 등록해주세요.'); return; }
    const qty = parseInt(selfReportedQty, 10);
    if (!qty || qty < 1) { setError('보유수를 1주 이상 입력해주세요.'); return; }

    setSubmitting(true);
    setError(null);
    try {
      // 멤버십 문서에 인증 요청 기록
      await updateDoc(doc(db, 'community_memberships', membership.id), {
        verifyRequest: {
          screenshotUrl,
          selfReportedQty: qty,
          requestedAt: serverTimestamp(),
          status: 'pending',
        },
        // 재인증 요청 플래그 소모
        reverifyRequestedAt: null,
      });

      // 방장(개설자)에게 알림 발송
      if (community.creatorId) {
        await addDoc(collection(db, 'notifications', community.creatorId, 'items'), {
          type: 'shareholder_verify_submitted',
          fromNickname: currentUserData.nickname,
          communityId: community.id,
          communityName: community.name,
          message: `${currentUserData.nickname}님이 주주 인증을 요청했습니다 (자기신고: ${qty.toLocaleString()}주)`,
          createdAt: Timestamp.now(),
          read: false,
        });
      }

      setSubmitted(true);
    } catch (err) {
      console.error('[ShareholderVerifyScreen] 인증 요청 실패:', err);
      setError('인증 요청에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  // 제출 완료 상태
  if (submitted || (existingRequest?.status === 'pending' && !isReverifyRequested)) {
    const suggestedTier = existingRequest ? getTierFromQuantity(existingRequest.selfReportedQty) : null;
    return (
      <div className="p-6 text-center space-y-4">
        <div className="text-[40px]">📋</div>
        <p className="text-[15px] font-[1000] text-slate-800">인증 요청이 제출되었습니다</p>
        {suggestedTier && (
          <p className="text-[13px] font-bold text-slate-500">
            예상 등급: {TIER_CONFIG[suggestedTier].emoji} {TIER_CONFIG[suggestedTier].label} ({tierRangeLabel(suggestedTier)}주)
          </p>
        )}
        <p className="text-[12px] text-slate-400 font-bold">방장의 승인을 기다려주세요.</p>
        <button onClick={onClose} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[12px] font-[1000] transition-colors">
          닫기
        </button>
      </div>
    );
  }

  return (
    <div className="p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-[14px] font-[1000] text-slate-800">🛡️ 주주 인증 등록</h3>
        <button onClick={onClose} className="text-[11px] font-bold text-slate-400 hover:text-slate-600">닫기</button>
      </div>

      {/* 현재 상태 */}
      <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
        {hasVerified ? (
          <div className="flex items-center gap-2">
            <span className="text-[16px]">{tierCfg?.emoji}</span>
            <div>
              <p className="text-[12px] font-[1000] text-slate-800">현재 등급: {tierCfg?.label}</p>
              {isReverifyRequested && (
                <p className="text-[10px] font-bold text-amber-600 mt-0.5">⚠️ 방장이 재인증을 요청했습니다</p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-[12px] font-bold text-slate-500">
            {isReverifyRequested ? '⚠️ 방장이 인증을 요청했습니다. 아래에서 등록해주세요.' : '❌ 미인증 상태입니다. 아래에서 인증을 등록해주세요.'}
          </p>
        )}
      </div>

      {/* 종목 안내 */}
      {community.shareholderSettings?.stockName && (
        <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
          <p className="text-[11px] font-[1000] text-blue-700">
            📌 인증 종목: {community.shareholderSettings.stockName} ({community.shareholderSettings.stockCode})
          </p>
          <p className="text-[10px] font-bold text-blue-500 mt-0.5">
            해당 종목의 보유 현황 스크린샷을 등록해주세요.
          </p>
        </div>
      )}

      {/* 스크린샷 업로드 */}
      <div className="space-y-2">
        <label className="text-[11px] font-[1000] text-slate-600">📸 증권사 보유 현황 스크린샷 <span className="text-red-500">*</span></label>
        <p className="text-[10px] font-bold text-amber-600">🔒 스크린샷은 방장만 열람 가능하며, 인증 승인 후 30일 뒤 자동 삭제됩니다.</p>
        {screenshotUrl ? (
          <div className="relative">
            <img src={screenshotUrl} alt="보유 현황" className="w-full max-h-[300px] object-contain rounded-lg border border-slate-200" />
            <button
              onClick={() => setScreenshotUrl('')}
              className="absolute top-2 right-2 w-6 h-6 bg-black/60 hover:bg-rose-500 text-white rounded-full flex items-center justify-center text-[10px]"
            >✕</button>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center gap-2 py-8 bg-slate-50 border-2 border-dashed border-slate-200 hover:border-blue-300 rounded-xl cursor-pointer transition-colors">
            <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-[12px] font-bold text-slate-400">
              {uploading ? '업로드 중...' : '스크린샷 선택 또는 촬영'}
            </span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0])}
              disabled={uploading}
            />
          </label>
        )}
      </div>

      {/* 자기신고 보유수 */}
      <div className="space-y-2">
        <label className="text-[11px] font-[1000] text-slate-600">📝 보유수 (자기신고) <span className="text-red-500">*</span></label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={selfReportedQty}
            onChange={e => { setSelfReportedQty(e.target.value); if (error) setError(null); }}
            placeholder="예: 15000"
            min={1}
            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-[14px] font-bold focus:outline-none focus:border-blue-400"
          />
          <span className="text-[12px] font-bold text-slate-500 shrink-0">주</span>
        </div>
        {selfReportedQty && parseInt(selfReportedQty) > 0 && (
          <p className="text-[10px] font-bold text-slate-400">
            예상 등급: {(() => {
              const t = getTierFromQuantity(parseInt(selfReportedQty));
              return `${TIER_CONFIG[t].emoji} ${TIER_CONFIG[t].label} (${tierRangeLabel(t)}주)`;
            })()}
          </p>
        )}
      </div>

      {/* 등급 범위 안내 */}
      <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg">
        <p className="text-[10px] font-[1000] text-slate-400 mb-1.5">등급 기준</p>
        <div className="grid grid-cols-2 gap-1">
          {(Object.values(TIER_CONFIG)).map(cfg => (
            <span key={cfg.label} className="text-[10px] font-bold text-slate-500">
              {cfg.emoji} {cfg.label}: {cfg.min.toLocaleString()}주{cfg.max === Infinity ? '+' : `~${cfg.max.toLocaleString()}주`}
            </span>
          ))}
        </div>
      </div>

      {error && <p className="text-[11px] font-bold text-red-500">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={submitting || uploading}
        className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-[13px] font-[1000] transition-colors"
      >
        {submitting ? '제출 중...' : '📸 스크린샷 인증 요청 제출'}
      </button>

      {/* 🛡️ 마이데이터 자동 인증 (Phase E — 현재 mock 모드) */}
      {community.shareholderSettings?.stockCode && (
        <div className="pt-4 border-t border-slate-100">
          <p className="text-[11px] font-[1000] text-slate-600 mb-2">📊 마이데이터 자동 인증</p>
          <p className="text-[10px] font-bold text-slate-400 mb-3">
            증권사 API를 통해 보유수를 자동 조회합니다. (현재 테스트 모드)
          </p>
          <button
            type="button"
            onClick={async () => {
              setSubmitting(true);
              setError(null);
              try {
                const token = await (await import('../firebase')).auth.currentUser?.getIdToken();
                if (!token) { setError('로그인이 필요합니다.'); return; }
                const res = await fetch('https://halmal-upload-worker.mirr0505.workers.dev/api/verify-shares', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                  body: JSON.stringify({
                    stockCode: community.shareholderSettings!.stockCode,
                    communityId: community.id,
                  }),
                });
                const data = await res.json() as { success?: boolean; tier?: string; tierEmoji?: string; tierLabel?: string; message?: string; mock?: boolean; error?: string };
                if (!data.success) { setError(data.error || '인증에 실패했습니다.'); return; }

                // verifyRequest에 마이데이터 결과 저장 (스크린샷 대신)
                await updateDoc(doc(db, 'community_memberships', membership.id), {
                  verifyRequest: {
                    screenshotUrl: '',
                    selfReportedQty: 0,
                    requestedAt: serverTimestamp(),
                    status: 'pending',
                  },
                  reverifyRequestedAt: null,
                });

                // 방장에게 알림
                if (community.creatorId) {
                  await addDoc(collection(db, 'notifications', community.creatorId, 'items'), {
                    type: 'shareholder_verify_submitted',
                    fromNickname: currentUserData.nickname,
                    communityId: community.id,
                    communityName: community.name,
                    message: `${currentUserData.nickname}님이 마이데이터 인증을 요청했습니다 (${data.mock ? 'Mock' : 'API'}: ${data.tierEmoji} ${data.tierLabel})`,
                    createdAt: Timestamp.now(),
                    read: false,
                  });
                }

                alert(`${data.message}\n\n방장의 승인을 기다려주세요.`);
                setSubmitted(true);
              } catch (err) {
                console.error('[ShareholderVerifyScreen] 마이데이터 인증 실패:', err);
                setError('마이데이터 인증에 실패했습니다.');
              } finally {
                setSubmitting(false);
              }
            }}
            disabled={submitting}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-[13px] font-[1000] transition-colors"
          >
            {submitting ? '조회 중...' : '📊 마이데이터로 자동 인증 (테스트)'}
          </button>
        </div>
      )}
    </div>
  );
};

export default ShareholderVerifyScreen;
