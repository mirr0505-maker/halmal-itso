// src/components/admin/ShareholderStatsPanel.tsx — 📊 주식 카테고리 활성도 통계
// ⚠️ 2026-05-15 Codef 정식 전환 의사결정 보조 — 주주방 활성도 측정
//   지표:
//     1. 주식 카테고리 communities 수 + 멤버 총합 + 정보봇 활성 수
//     2. 주주방 인증 분포 (verifyRequest.status: pending/verified/rejected)
//     3. tier 분포 (shrimp/shark/whale/megawhale)
//     4. Top 5 주주방 by memberCount
//   사용 시점: Codef 마이데이터 정식 전환 의사결정 시. 주주방 활성도 < 30명이면 mock 유지, ≥ 30이면 정식 견적 진행.
import { useEffect, useState } from 'react';
import { db } from '../../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import type { Community, CommunityMember } from '../../types';
import { TIER_CONFIG } from '../../types';

interface Stats {
  totalCommunities: number;
  totalMembers: number;
  botEnabled: number;
  verifyPending: number;
  verifyVerified: number;
  verifyRejected: number;
  noVerifyRequest: number;
  tierDistribution: Record<string, number>;
  topCommunities: { id: string; name: string; memberCount: number; botEnabled: boolean }[];
}

const ShareholderStatsPanel = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [fetchedAt, setFetchedAt] = useState<string>('');

  const fetchStats = async () => {
    if (loading) return;
    setLoading(true); setError('');
    try {
      // 1. 주식 카테고리 communities 조회
      const cq = query(collection(db, 'communities'), where('category', '==', '주식'));
      const cSnap = await getDocs(cq);
      const stockCommunities = cSnap.docs.map(d => ({ id: d.id, ...d.data() } as Community));

      // 2. 멤버십 청크 조회 (Firestore `in` 30개 한도)
      const memberships: CommunityMember[] = [];
      for (let i = 0; i < stockCommunities.length; i += 30) {
        const chunk = stockCommunities.slice(i, i + 30);
        const ids = chunk.map(c => c.id);
        if (ids.length === 0) continue;
        const mq = query(collection(db, 'community_memberships'), where('communityId', 'in', ids));
        const mSnap = await getDocs(mq);
        memberships.push(...mSnap.docs.map(d => d.data() as CommunityMember));
      }

      // 3. 인증 상태 분포 집계 (verifyRequest.status: 'pending' | 'approved' | 'rejected')
      let verifyPending = 0, verifyVerified = 0, verifyRejected = 0, noVerifyRequest = 0;
      const tierDistribution: Record<string, number> = { shrimp: 0, shark: 0, whale: 0, megawhale: 0 };
      for (const m of memberships) {
        const vr = m.verifyRequest;
        if (!vr) {
          noVerifyRequest++;
        } else if (vr.status === 'pending') {
          verifyPending++;
        } else if (vr.status === 'approved') {
          verifyVerified++;
          const tier = m.verified?.tier;
          if (tier && tier in tierDistribution) tierDistribution[tier]++;
        } else if (vr.status === 'rejected') {
          verifyRejected++;
        }
      }

      // 4. 봇 활성 + Top 5
      const botEnabled = stockCommunities.filter(c => c.infoBot?.enabled === true).length;
      const topCommunities = [...stockCommunities]
        .sort((a, b) => (b.memberCount || 0) - (a.memberCount || 0))
        .slice(0, 5)
        .map(c => ({
          id: c.id,
          name: c.name,
          memberCount: c.memberCount || 0,
          botEnabled: c.infoBot?.enabled === true,
        }));

      setStats({
        totalCommunities: stockCommunities.length,
        totalMembers: memberships.length,
        botEnabled,
        verifyPending, verifyVerified, verifyRejected, noVerifyRequest,
        tierDistribution,
        topCommunities,
      });
      setFetchedAt(new Date().toLocaleString('ko-KR'));
    } catch (e) {
      setError(e instanceof Error ? e.message : '알 수 없는 오류');
    } finally {
      setLoading(false);
    }
  };

  // 첫 진입 시 자동 1회 조회
  useEffect(() => { fetchStats(); }, []);

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-[15px] font-[1000] text-slate-900 mb-0.5">📊 주식 카테고리 활성도</h3>
          <p className="text-[10px] font-bold text-slate-400">Codef 정식 전환 의사결정 보조 지표 · 멤버 30+면 정식 견적 진행 권장</p>
        </div>
        <button
          onClick={fetchStats}
          disabled={loading}
          className="px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-[11px] font-[1000] hover:bg-blue-100 disabled:opacity-40 transition-all"
        >
          {loading ? '집계 중...' : '🔄 갱신'}
        </button>
      </div>

      {fetchedAt && (
        <p className="text-[9px] font-bold text-slate-400 mb-3">집계 시각: {fetchedAt}</p>
      )}

      {error && (
        <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-[11px] font-bold text-rose-700">
          ❌ {error}
        </div>
      )}

      {stats && (
        <div className="space-y-4">
          {/* 핵심 KPI 4종 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <KpiCard label="주주방 수" value={stats.totalCommunities} suffix="개" emphasis />
            <KpiCard label="총 멤버" value={stats.totalMembers} suffix="명" emphasis />
            <KpiCard label="정보봇 활성" value={stats.botEnabled} suffix="개" />
            <KpiCard label="인증 완료" value={stats.verifyVerified} suffix="명" />
          </div>

          {/* 의사결정 신호 */}
          <div className={`p-4 rounded-lg border-2 ${
            stats.totalMembers >= 30
              ? 'bg-emerald-50 border-emerald-300'
              : stats.totalMembers >= 10
              ? 'bg-amber-50 border-amber-300'
              : 'bg-slate-50 border-slate-300'
          }`}>
            <p className="text-[12px] font-[1000] mb-1">
              {stats.totalMembers >= 30
                ? '✅ Codef 정식 견적 요청 권장'
                : stats.totalMembers >= 10
                ? '🟡 보류 — 멤버 30명 도달 시 재검토'
                : '⏳ 현 mock + 스크린샷 유지 권장'}
            </p>
            <p className="text-[10px] font-bold text-slate-600">
              주식 카테고리 누적 멤버 {stats.totalMembers}명 / 정식 전환 트리거 30명
            </p>
          </div>

          {/* 인증 상태 분포 */}
          <div className="p-3 bg-white border border-slate-200 rounded-lg">
            <p className="text-[11px] font-[1000] text-slate-800 mb-2">📋 인증 요청 상태 분포</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px]">
              <StatRow label="⏳ 대기 (pending)"   value={stats.verifyPending}   total={stats.totalMembers} color="amber" />
              <StatRow label="✅ 완료 (verified)"  value={stats.verifyVerified}  total={stats.totalMembers} color="emerald" />
              <StatRow label="❌ 거절 (rejected)" value={stats.verifyRejected}  total={stats.totalMembers} color="rose" />
              <StatRow label="– 미요청"            value={stats.noVerifyRequest} total={stats.totalMembers} color="slate" />
            </div>
            <p className="text-[9px] font-bold text-slate-400 mt-2">
              실수요 지표: 인증 요청 = (pending + verified + rejected) / 총멤버 ={' '}
              {stats.totalMembers > 0
                ? `${(((stats.verifyPending + stats.verifyVerified + stats.verifyRejected) / stats.totalMembers) * 100).toFixed(1)}%`
                : '–'}
            </p>
          </div>

          {/* tier 분포 */}
          <div className="p-3 bg-white border border-slate-200 rounded-lg">
            <p className="text-[11px] font-[1000] text-slate-800 mb-2">🏷️ 등급 분포 (인증 완료자 기준)</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px]">
              {(Object.entries(TIER_CONFIG) as [string, typeof TIER_CONFIG[keyof typeof TIER_CONFIG]][]).map(([key, cfg]) => (
                <StatRow
                  key={key}
                  label={`${cfg.emoji} ${cfg.label}`}
                  value={stats.tierDistribution[key] || 0}
                  total={stats.verifyVerified}
                  color="blue"
                />
              ))}
            </div>
          </div>

          {/* Top 5 */}
          <div className="p-3 bg-white border border-slate-200 rounded-lg">
            <p className="text-[11px] font-[1000] text-slate-800 mb-2">🏆 Top 5 주주방 (멤버 수 기준)</p>
            {stats.topCommunities.length === 0 ? (
              <p className="text-[10px] font-bold text-slate-400">주식 카테고리 커뮤니티가 없습니다.</p>
            ) : (
              <div className="flex flex-col gap-1">
                {stats.topCommunities.map((c, i) => (
                  <div key={c.id} className="flex items-center justify-between p-2 bg-slate-50 rounded text-[10px]">
                    <span className="font-bold text-slate-600">
                      <span className="font-[1000] text-slate-900">#{i + 1}</span> · {c.name}
                      {c.botEnabled && <span className="ml-1.5 text-emerald-600">🤖</span>}
                    </span>
                    <span className="font-[1000] text-blue-700">{c.memberCount}명</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const KpiCard = ({ label, value, suffix, emphasis }: { label: string; value: number; suffix: string; emphasis?: boolean }) => (
  <div className={`p-3 rounded-lg border ${emphasis ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200'}`}>
    <p className="text-[9px] font-bold text-slate-400 mb-0.5">{label}</p>
    <p className={`text-[18px] font-[1000] ${emphasis ? 'text-blue-700' : 'text-slate-700'}`}>
      {value.toLocaleString()}<span className="text-[10px] font-bold ml-0.5">{suffix}</span>
    </p>
  </div>
);

const StatRow = ({ label, value, total, color }: { label: string; value: number; total: number; color: 'amber' | 'emerald' | 'rose' | 'slate' | 'blue' }) => {
  const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
  const colorMap: Record<string, string> = {
    amber: 'text-amber-700', emerald: 'text-emerald-700', rose: 'text-rose-700', slate: 'text-slate-700', blue: 'text-blue-700',
  };
  return (
    <div className="flex items-center justify-between bg-slate-50 px-2 py-1.5 rounded">
      <span className="font-bold text-slate-500">{label}</span>
      <span className={`font-[1000] ${colorMap[color]}`}>{value} <span className="text-[8px] opacity-60">({pct}%)</span></span>
    </div>
  );
};

export default ShareholderStatsPanel;
