// src/components/VerifyShareholderPanel.tsx — 🛡️ 주주방 주주 인증 관리 패널
// Phase B (SHAREHOLDER_TIER.md §6): 방장 전용, community.category === '주식' 일 때만 렌더
// 인증 대기 + 인증 완료 목록 + TierSelector + 종목 설정
import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteField, serverTimestamp } from 'firebase/firestore';
import type { Community, CommunityMember, ShareholderTier } from '../types';
import { TIER_CONFIG, tierRangeLabel } from '../types';
import JoinAnswersDisplay from './JoinAnswersDisplay';

interface Props {
  community: Community;
  currentUid: string;
  currentNickname: string;
}

// 🛡️ TierSelector — 4등급 라디오 버튼 (재사용 가능)
function TierSelector({ value, onChange }: { value: ShareholderTier | null; onChange: (t: ShareholderTier) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {(Object.entries(TIER_CONFIG) as [ShareholderTier, typeof TIER_CONFIG[ShareholderTier]][]).map(([key, cfg]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
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
  const [selectedTiers, setSelectedTiers] = useState<Record<string, ShareholderTier>>({});
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

  // 인증 대기: verified 없는 멤버 / 인증 완료: verified 있는 멤버
  const unverified = members.filter(m => !m.verified?.tier);
  const verified = members.filter(m => !!m.verified?.tier);

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
    const tier = selectedTiers[member.id || `${community.id}_${member.userId}`];
    if (!tier) { alert('등급을 선택해주세요.'); return; }
    const docId = member.id || `${community.id}_${member.userId}`;
    setProcessing(docId);
    try {
      await updateDoc(doc(db, 'community_memberships', docId), {
        verified: {
          verifiedAt: serverTimestamp(),
          verifiedBy: currentUid,
          verifiedByNickname: currentNickname,
          label: '🛡️ 주주 인증',
          tier,
          source: 'manual',
        },
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

      {/* 인증 대기 목록 */}
      <div>
        <p className="text-[10px] font-[1000] text-slate-500 uppercase tracking-widest mb-2">
          인증 대기 ({unverified.length}명)
        </p>
        {unverified.length === 0 ? (
          <p className="text-[11px] text-slate-400 font-bold italic py-3">인증 대기 중인 멤버가 없습니다.</p>
        ) : (
          <div className="space-y-3">
            {unverified.map(m => {
              const mId = (m as CommunityMember & { id: string }).id || `${community.id}_${m.userId}`;
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
                  {/* 가입 답변 — compact */}
                  {m.joinAnswers && (
                    <div className="mb-2 pl-2 border-l-2 border-slate-200">
                      <JoinAnswersDisplay answers={m.joinAnswers} />
                    </div>
                  )}
                  {/* 등급 선택 */}
                  <div className="mb-2">
                    <p className="text-[10px] font-bold text-slate-400 mb-1">등급 선택:</p>
                    <TierSelector
                      value={selectedTiers[mId] || null}
                      onChange={t => setSelectedTiers(prev => ({ ...prev, [mId]: t }))}
                    />
                  </div>
                  {/* 액션 */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleVerify(m as CommunityMember & { id: string })}
                      disabled={!selectedTiers[mId] || processing === mId}
                      className="px-3 py-1.5 bg-blue-600 text-white text-[11px] font-[1000] rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors"
                    >
                      {processing === mId ? '처리 중...' : '인증 부여'}
                    </button>
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
              return (
                <div key={mId} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-lg">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[16px]">{tierCfg?.emoji || '🛡️'}</span>
                    <div className="min-w-0">
                      <span className="text-[12px] font-[1000] text-slate-800">{m.nickname}</span>
                      <span className="text-[10px] font-bold text-slate-400 ml-1.5">
                        {tierCfg?.label || '인증'} · {formatDate(v.verifiedAt)} · {v.source || 'manual'}
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
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default VerifyShareholderPanel;
