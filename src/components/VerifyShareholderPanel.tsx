// src/components/VerifyShareholderPanel.tsx — 🛡️ 주주방 주주 인증 관리 패널
// Phase B (SHAREHOLDER_TIER.md §6): 방장 전용, community.category === '주식' 일 때만 렌더
// 인증 대기 + 인증 완료 목록 + TierSelector + 종목 설정
import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, doc, setDoc, updateDoc, deleteField, serverTimestamp, addDoc, Timestamp } from 'firebase/firestore';
import type { Community, CommunityMember, ShareholderTier } from '../types';
import { TIER_CONFIG, tierRangeLabel, getTierFromQuantity } from '../types';
import JoinAnswersDisplay from './JoinAnswersDisplay';
import SecureImage from './SecureImage';

interface Props {
  community: Community;
  currentUid: string;
  currentNickname: string;
}

// 🛡️ TierSelector — 4등급 라디오 버튼 (재사용 가능)
function TierSelector({ value, onChange }: { value: ShareholderTier | null; onChange: (t: ShareholderTier | null) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {(Object.entries(TIER_CONFIG) as [ShareholderTier, typeof TIER_CONFIG[ShareholderTier]][]).map(([key, cfg]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(value === key ? null : key)}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-[1000] border transition-all ${
            value === key
              ? 'bg-blue-50 text-blue-700 border-blue-300 ring-1 ring-blue-200'
              : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <span className="text-[14px]">{cfg.emoji}</span>
          <span>{cfg.label}</span>
          <span className="text-[9px] font-bold text-slate-400">({tierRangeLabel(key)}주)</span>
        </button>
      ))}
    </div>
  );
}

const VerifyShareholderPanel = ({ community, currentUid, currentNickname }: Props) => {
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [loading, setLoading] = useState(true);
  // 종목 설정 state
  const [stockCode, setStockCode] = useState(community.shareholderSettings?.stockCode || '');
  const [stockName, setStockName] = useState(community.shareholderSettings?.stockName || '');
  const [savingSettings, setSavingSettings] = useState(false);
  // 인증 대기 선택 state — memberId → tier
  const [selectedTiers, setSelectedTiers] = useState<Record<string, ShareholderTier | null>>({});
  const [processing, setProcessing] = useState<string | null>(null);

  // 실시간 멤버 구독 (active ring 멤버만 — pending 제외)
  useEffect(() => {
    const q = query(
      collection(db, 'community_memberships'),
      where('communityId', '==', community.id),
    );
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs
        .map(d => ({ ...d.data(), id: d.id } as CommunityMember & { id: string }))
        .filter(m => m.joinStatus !== 'pending' && m.joinStatus !== 'banned');
      setMembers(list);
      setLoading(false);
    });
    return unsub;
  }, [community.id]);

  // 인증 대기: verified 없는 멤버 + verifyRequest pending 멤버 (방장 제외)
  // (이미 인증된 멤버라도 재인증 요청 제출 시 인증 대기에 표시)
  const unverified = members.filter(m =>
    m.userId !== currentUid &&
    (!m.verified?.tier || m.verifyRequest?.status === 'pending')
  );
  // 인증 완료: verified 있고 pending 요청 없는 멤버 (방장 포함)
  const verified = members.filter(m =>
    !!m.verified?.tier && m.verifyRequest?.status !== 'pending'
  );

  // 종목 설정 저장
  const handleSaveSettings = async () => {
    if (!stockCode.trim() || !stockName.trim()) return;
    setSavingSettings(true);
    try {
      await updateDoc(doc(db, 'communities', community.id), {
        'shareholderSettings.stockCode': stockCode.trim(),
        'shareholderSettings.stockName': stockName.trim(),
        'shareholderSettings.enableMydata': false,
      });
    } finally {
      setSavingSettings(false);
    }
  };

  // 인증 부여
  const handleVerify = async (member: CommunityMember & { id: string }) => {
    const mId = member.id || `${community.id}_${member.userId}`;
    const suggestedTier = member.verifyRequest?.status === 'pending' ? getTierFromQuantity(member.verifyRequest.selfReportedQty) : null;
    const tier = selectedTiers[mId] ?? suggestedTier;
    if (!tier) { alert('등급을 선택해주세요.'); return; }
    const docId = member.id || `${community.id}_${member.userId}`;
    setProcessing(docId);
    try {
      await updateDoc(doc(db, 'community_memberships', docId), {
        verified: {
          verifiedAt: serverTimestamp(),
          verifiedBy: currentUid,
          verifiedByNickname: currentNickname,
          label: '주주',
          tier,
          source: member.verifyRequest?.status === 'pending'
            ? ((member.verifyRequest as typeof member.verifyRequest & { source?: string })?.source === 'mydata' ? 'mydata' : 'screenshot')
            : 'manual',
        },
        // 인증 요청이 있었으면 approved + approvedAt 기록 (30일 후 스크린샷 자동 만료)
        ...(member.verifyRequest ? {
          'verifyRequest.status': 'approved',
          'verifyRequest.approvedAt': serverTimestamp(),
        } : {}),
      });
    } finally {
      setProcessing(null);
    }
  };

  // 인증 해제
  const handleRevoke = async (member: CommunityMember & { id: string }) => {
    if (!window.confirm(`${member.nickname}님의 주주 인증을 해제하시겠습니까?`)) return;
    const docId = member.id || `${community.id}_${member.userId}`;
    setProcessing(docId);
    try {
      await updateDoc(doc(db, 'community_memberships', docId), {
        verified: deleteField(),
      });
    } finally {
      setProcessing(null);
    }
  };

  // 등급 변경
  const handleChangeTier = async (member: CommunityMember & { id: string }, newTier: ShareholderTier) => {
    const docId = member.id || `${community.id}_${member.userId}`;
    setProcessing(docId);
    try {
      await updateDoc(doc(db, 'community_memberships', docId), {
        'verified.tier': newTier,
        'verified.source': 'manual_override',
      });
    } finally {
      setProcessing(null);
    }
  };

  // 🛡️ 개별 인증 요청 발송 — 멤버에게 알림
  const sendVerifyRequest = async (member: CommunityMember & { id: string }) => {
    const docId = member.id || `${community.id}_${member.userId}`;
    setProcessing(docId);
    try {
      await updateDoc(doc(db, 'community_memberships', docId), {
        reverifyRequestedAt: serverTimestamp(),
      });
      await addDoc(collection(db, 'notifications', member.userId, 'items'), {
        type: 'shareholder_verify_request',
        fromNickname: currentNickname,
        communityId: community.id,
        communityName: community.name,
        message: `'${community.name}' 주주방에서 주주 인증을 요청했습니다`,
        createdAt: Timestamp.now(),
        read: false,
      });
    } finally {
      setProcessing(null);
    }
  };

  // 🛡️ 일괄 인증 요청 — 미인증 + 인증 완료(재인증) 멤버 전체
  const sendBulkVerifyRequest = async () => {
    const targets = unverified.filter(m => !m.verifyRequest || m.verifyRequest.status !== 'pending');
    if (targets.length === 0) { alert('인증 요청할 대상이 없습니다.'); return; }
    if (!window.confirm(`${targets.length}명에게 인증 요청을 보내시겠습니까?`)) return;
    setProcessing('__bulk');
    try {
      for (const m of targets) {
        const docId = (m as CommunityMember & { id: string }).id || `${community.id}_${m.userId}`;
        await updateDoc(doc(db, 'community_memberships', docId), {
          reverifyRequestedAt: serverTimestamp(),
        });
        await addDoc(collection(db, 'notifications', m.userId, 'items'), {
          type: 'shareholder_verify_request',
          fromNickname: currentNickname,
          communityId: community.id,
          communityName: community.name,
          message: `'${community.name}' 주주방에서 주주 인증을 요청했습니다`,
          createdAt: Timestamp.now(),
          read: false,
        });
      }
      alert(`${targets.length}명에게 인증 요청을 보냈습니다.`);
    } finally {
      setProcessing(null);
    }
  };

  const formatDate = (ts: unknown) => {
    if (!ts) return '';
    const d = typeof (ts as { toDate?: () => Date }).toDate === 'function'
      ? (ts as { toDate: () => Date }).toDate()
      : new Date((ts as { seconds: number }).seconds * 1000);
    return d.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' });
  };

  if (loading) return <div className="py-6 text-center text-slate-400 text-[12px] font-bold">불러오는 중...</div>;

  return (
    <div className="bg-white border border-slate-100 rounded-xl px-5 py-4 space-y-5">
      <p className="text-[12px] font-black text-slate-700">🛡️ 주주 인증 관리</p>

      {/* 📌 종목 설정 */}
      <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
        <p className="text-[10px] font-[1000] text-slate-500 uppercase tracking-widest mb-2">📌 종목 설정</p>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={stockCode}
            onChange={e => setStockCode(e.target.value)}
            placeholder="종목코드 (005930)"
            className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-[12px] font-bold focus:outline-none focus:border-blue-400"
          />
          <input
            type="text"
            value={stockName}
            onChange={e => setStockName(e.target.value)}
            placeholder="종목명 (삼성전자)"
            className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-[12px] font-bold focus:outline-none focus:border-blue-400"
          />
          <button
            onClick={handleSaveSettings}
            disabled={savingSettings || !stockCode.trim() || !stockName.trim()}
            className="px-3 py-1.5 bg-slate-900 text-white text-[11px] font-[1000] rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors shrink-0"
          >
            {savingSettings ? '저장 중...' : '저장'}
          </button>
        </div>
        {community.shareholderSettings?.stockCode && (
          <p className="text-[10px] font-bold text-slate-400 mt-1.5">
            현재: {community.shareholderSettings.stockName} ({community.shareholderSettings.stockCode})
          </p>
        )}
      </div>

      {/* 🛡️ 방장(개설자) 자기 인증 — memberships 문서가 없을 수 있으므로 별도 처리 */}
      {(() => {
        const ownerMember = members.find(m => m.userId === currentUid);
        const ownerHasTier = !!ownerMember?.verified?.tier;
        // 방장이 memberships에 없거나 tier 미부여 상태일 때만 표시
        if (ownerHasTier) return null;
        return (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-[10px] font-[1000] text-blue-700 uppercase tracking-widest mb-2">👑 내 등급 설정 (방장)</p>
            <TierSelector
              value={selectedTiers['__owner'] || null}
              onChange={t => setSelectedTiers(prev => ({ ...prev, '__owner': t }))}
            />
            <button
              onClick={async () => {
                const tier = selectedTiers['__owner'];
                if (!tier) { alert('등급을 선택해주세요.'); return; }
                setProcessing('__owner');
                try {
                  const docId = ownerMember
                    ? ((ownerMember as CommunityMember & { id: string }).id || `${community.id}_${currentUid}`)
                    : `${community.id}_${currentUid}`;
                  await setDoc(doc(db, 'community_memberships', docId), {
                    userId: currentUid,
                    nickname: currentNickname,
                    communityId: community.id,
                    communityName: community.name,
                    role: 'owner',
                    finger: 'thumb',
                    verified: {
                      verifiedAt: serverTimestamp(),
                      verifiedBy: currentUid,
                      verifiedByNickname: currentNickname,
                      label: '주주',
                      tier,
                      source: 'manual',
                    },
                  }, { merge: true });
                } catch (err) {
                  console.error('[VerifyShareholderPanel] 방장 자기 인증 실패:', err);
                  alert('등급 저장에 실패했습니다. 다시 시도해주세요.');
                } finally {
                  setProcessing(null);
                }
              }}
              disabled={!selectedTiers['__owner'] || processing === '__owner'}
              className="mt-2 px-3 py-1.5 bg-blue-600 text-white text-[11px] font-[1000] rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors"
            >
              {processing === '__owner' ? '처리 중...' : '내 등급 저장'}
            </button>
          </div>
        );
      })()}

      {/* 인증 대기 목록 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-[1000] text-slate-500 uppercase tracking-widest">
            인증 대기 ({unverified.length}명)
          </p>
          {unverified.length > 0 && (
            <button
              onClick={sendBulkVerifyRequest}
              disabled={processing === '__bulk'}
              className="px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-[1000] rounded-lg hover:bg-amber-100 disabled:opacity-40 transition-colors"
            >
              {processing === '__bulk' ? '발송 중...' : '📢 일괄 인증 요청'}
            </button>
          )}
        </div>
        {unverified.length === 0 ? (
          <p className="text-[11px] text-slate-400 font-bold italic py-3">인증 대기 중인 멤버가 없습니다.</p>
        ) : (
          <div className="space-y-3">
            {unverified.map(m => {
              const mId = (m as CommunityMember & { id: string }).id || `${community.id}_${m.userId}`;
              const vr = m.verifyRequest;
              const hasPendingRequest = vr?.status === 'pending';
              const vrAny = vr as typeof vr & { source?: string; suggestedTier?: string; mock?: boolean };
              const isMydata = vrAny?.source === 'mydata';
              const suggestedTier = hasPendingRequest
                ? (isMydata && vrAny.suggestedTier ? vrAny.suggestedTier as ShareholderTier : getTierFromQuantity(vr!.selfReportedQty))
                : null;
              return (
                <div key={mId} className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-[11px] font-[1000] text-slate-500">
                      {m.nickname?.[0] || '?'}
                    </div>
                    <div>
                      <span className="text-[12px] font-[1000] text-slate-800">{m.nickname}</span>
                      <span className="text-[10px] font-bold text-slate-400 ml-1.5">{m.finger || 'ring'} · 가입 {formatDate(m.joinedAt)}</span>
                    </div>
                  </div>
                  {/* 가입 답변 */}
                  {m.joinAnswers && (
                    <div className="mb-2 pl-2 border-l-2 border-slate-200">
                      <JoinAnswersDisplay answers={m.joinAnswers} />
                    </div>
                  )}
                  {/* 📸 멤버가 제출한 스크린샷 + 자기신고 보유수 */}
                  {hasPendingRequest && (
                    <div className="mb-2 p-2 bg-blue-50 border border-blue-100 rounded-lg">
                      {isMydata ? (
                        <p className="text-[10px] font-[1000] text-emerald-700">📊 마이데이터 인증 {vrAny.mock ? '(테스트)' : ''} → 예상 {suggestedTier && TIER_CONFIG[suggestedTier].emoji} {suggestedTier && TIER_CONFIG[suggestedTier].label}</p>
                      ) : (
                        <>
                          <p className="text-[10px] font-[1000] text-blue-700 mb-1.5">📸 스크린샷 인증 (자기신고: {vr!.selfReportedQty.toLocaleString()}주 → 예상 {suggestedTier && TIER_CONFIG[suggestedTier].emoji} {suggestedTier && TIER_CONFIG[suggestedTier].label})</p>
                          {vr!.screenshotUrl && (
                            <SecureImage r2Url={vr!.screenshotUrl} alt="보유 현황" className="w-full max-h-[200px] object-contain rounded border border-slate-200 cursor-pointer" />
                          )}
                        </>
                      )}
                    </div>
                  )}
                  {/* 등급 선택 — 인증 요청이 있으면 자동 선택 */}
                  <div className="mb-2">
                    <p className="text-[10px] font-bold text-slate-400 mb-1">등급 선택:</p>
                    <TierSelector
                      value={selectedTiers[mId] ?? suggestedTier ?? null}
                      onChange={t => setSelectedTiers(prev => ({ ...prev, [mId]: t }))}
                    />
                  </div>
                  {/* 액션 */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleVerify(m as CommunityMember & { id: string })}
                      disabled={!(selectedTiers[mId] ?? suggestedTier) || processing === mId}
                      className="px-3 py-1.5 bg-blue-600 text-white text-[11px] font-[1000] rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors"
                    >
                      {processing === mId ? '처리 중...' : '인증 부여'}
                    </button>
                    {!hasPendingRequest && (
                      <button
                        onClick={() => sendVerifyRequest(m as CommunityMember & { id: string })}
                        disabled={processing === mId}
                        className="px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-[1000] rounded-lg hover:bg-amber-100 disabled:opacity-40 transition-colors"
                      >
                        📢 인증 요청
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 인증 완료 목록 */}
      <div>
        <p className="text-[10px] font-[1000] text-slate-500 uppercase tracking-widest mb-2">
          인증 완료 ({verified.length}명)
        </p>
        {verified.length === 0 ? (
          <p className="text-[11px] text-slate-400 font-bold italic py-3">인증된 멤버가 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {verified.map(m => {
              const mId = (m as CommunityMember & { id: string }).id || `${community.id}_${m.userId}`;
              const v = m.verified!;
              const tierCfg = v.tier ? TIER_CONFIG[v.tier] : null;
              // 📸 스크린샷 30일 만료 체크
              const vr = m.verifyRequest;
              const hasScreenshot = vr?.screenshotUrl && vr?.status === 'approved';
              const approvedMs = vr?.approvedAt
                ? ((vr.approvedAt as unknown as { toMillis?: () => number }).toMillis?.() || (vr.approvedAt as unknown as { seconds: number }).seconds * 1000)
                : 0;
              const isScreenshotExpired = hasScreenshot && approvedMs > 0 && (Date.now() - approvedMs) > 30 * 24 * 60 * 60 * 1000;
              const daysLeft = hasScreenshot && approvedMs > 0 ? Math.max(0, Math.ceil((approvedMs + 30 * 24 * 60 * 60 * 1000 - Date.now()) / (24 * 60 * 60 * 1000))) : 0;
              return (
                <div key={mId} className="p-3 bg-white border border-slate-100 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[16px]">{tierCfg?.emoji || '🛡️'}</span>
                      <div className="min-w-0">
                        <span className="text-[12px] font-[1000] text-slate-800">{m.nickname}</span>
                        <span className="text-[10px] font-bold text-slate-400 ml-1.5">
                          {tierCfg?.label || '인증'} · {formatDate(v.verifiedAt)} · {v.source === 'screenshot' ? '📸 스크린샷' : v.source === 'mydata' ? '🔗 마이데이터' : '✏️ 수동'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                    {/* 등급 변경 — 인라인 셀렉트 */}
                    <select
                      value={v.tier || ''}
                      onChange={e => handleChangeTier(m as CommunityMember & { id: string }, e.target.value as ShareholderTier)}
                      disabled={processing === mId}
                      className="text-[10px] font-bold border border-slate-200 rounded px-1.5 py-1 bg-white focus:outline-none"
                    >
                      {(Object.entries(TIER_CONFIG) as [ShareholderTier, typeof TIER_CONFIG[ShareholderTier]][]).map(([key, cfg]) => (
                        <option key={key} value={key}>{cfg.emoji} {cfg.label}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleRevoke(m as CommunityMember & { id: string })}
                      disabled={processing === mId}
                      className="text-[10px] font-bold text-rose-500 hover:text-rose-700 px-2 py-1 rounded hover:bg-rose-50 transition-colors disabled:opacity-40"
                    >
                      해제
                    </button>
                  </div>
                  </div>
                  {/* 📸 스크린샷 열람 (30일 보관) */}
                  {hasScreenshot && (
                    <div className="mt-2 pt-2 border-t border-slate-50">
                      {isScreenshotExpired ? (
                        <p className="text-[10px] font-bold text-slate-400 italic">📸 스크린샷 만료됨 (30일 경과) — 재인증 요청 필요</p>
                      ) : (
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-bold text-blue-500">📸 스크린샷 (자기신고: {vr!.selfReportedQty.toLocaleString()}주)</p>
                          <SecureImage r2Url={vr!.screenshotUrl} alt="보유 현황" className="w-full max-h-[150px] object-contain rounded border border-slate-200" />
                          <span className="text-[9px] font-bold text-slate-300">{daysLeft}일 후 만료</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default VerifyShareholderPanel;
