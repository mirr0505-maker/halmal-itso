// src/components/advertiser/AdStatsModal.tsx — 광고주 통계 대시보드
// 🚀 v2 P0-3 (2026-04-26): ad_stats_daily 기반 KPI + 트렌드 + 분해 + 히트맵
//   라이브러리 추가 없이 SVG 직접 — 의존성 0
import { useEffect, useState, useMemo } from 'react';
import { db } from '../../firebase';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import type { Ad, AdStatsDaily } from '../../types';
import { formatKoreanNumber } from '../../utils';

interface Props {
  adId: string;
  ad: Ad;
  onClose: () => void;
}

const AdStatsModal = ({ adId, ad, onClose }: Props) => {
  const [days, setDays] = useState<7 | 14 | 30>(7);
  const [stats, setStats] = useState<AdStatsDaily[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'ad_stats_daily'),
      where('adId', '==', adId),
      orderBy('date', 'desc'),
      limit(days),
    );
    const unsub = onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as AdStatsDaily)).reverse();
      setStats(list);
      setLoading(false);
    }, err => { console.error('[AdStatsModal]', err); setLoading(false); });
    return () => unsub();
  }, [adId, days]);

  const totals = useMemo(() => {
    return stats.reduce((acc, s) => ({
      impressions: acc.impressions + (s.impressions || 0),
      viewableImpressions: acc.viewableImpressions + (s.viewableImpressions || 0),
      clicks: acc.clicks + (s.clicks || 0),
      spent: acc.spent + (s.spent || 0),
      uniqueViewers: acc.uniqueViewers + (s.uniqueViewers || 0),
    }), { impressions: 0, viewableImpressions: 0, clicks: 0, spent: 0, uniqueViewers: 0 });
  }, [stats]);

  const ctr = totals.impressions > 0 ? ((totals.clicks / totals.impressions) * 100).toFixed(2) : '0.00';
  const viewableRate = totals.impressions > 0 ? ((totals.viewableImpressions / totals.impressions) * 100).toFixed(1) : '0.0';

  // 분해 — 마지막 일 기준 (또는 누적)
  const breakdown = useMemo(() => {
    const bySlot = { top: 0, middle: 0, bottom: 0 };
    const byMenu: Record<string, number> = {};
    const byRegion: Record<string, number> = {};
    const byHour = new Array(24).fill(0);
    for (const s of stats) {
      bySlot.top += s.bySlot?.top || 0;
      bySlot.middle += s.bySlot?.middle || 0;
      bySlot.bottom += s.bySlot?.bottom || 0;
      for (const [k, v] of Object.entries(s.byMenu || {})) byMenu[k] = (byMenu[k] || 0) + v;
      for (const [k, v] of Object.entries(s.byRegion || {})) byRegion[k] = (byRegion[k] || 0) + v;
      (s.byHour || []).forEach((v, i) => { byHour[i] += v; });
    }
    return { bySlot, byMenu, byRegion, byHour };
  }, [stats]);

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center px-2 sm:px-4 animate-in fade-in" onClick={onClose}>
      <div className="w-full max-w-5xl max-h-[92vh] bg-white rounded-2xl overflow-hidden flex flex-col shadow-xl" onClick={(e) => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 shrink-0">
          <div className="min-w-0">
            <h2 className="text-[15px] font-[1000] text-slate-900 truncate">📊 {ad.title} — 통계</h2>
            <p className="text-[10px] font-bold text-slate-400 mt-0.5 truncate">{ad.headline}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <select value={days} onChange={(e) => setDays(Number(e.target.value) as 7 | 14 | 30)}
              className="px-2 py-1 rounded border border-slate-200 text-[11px] font-bold outline-none">
              <option value={7}>최근 7일</option>
              <option value={14}>최근 14일</option>
              <option value={30}>최근 30일</option>
            </select>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-[18px] font-bold w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100">✕</button>
          </div>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {loading ? (
            <p className="text-center text-slate-300 font-bold text-[12px] py-12">불러오는 중...</p>
          ) : stats.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-[14px] font-[1000] text-slate-400">아직 데이터가 없어요</p>
              <p className="text-[10px] font-bold text-slate-300 mt-1">노출 24시간 후 첫 통계가 표시됩니다</p>
            </div>
          ) : (
            <>
              {/* KPI 카드 4종 */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <KpiCard
                  label="노출"
                  value={formatKoreanNumber(totals.impressions)}
                  sub={`가시 ${viewableRate}%`}
                  color="violet"
                  spark={stats.map(s => s.impressions || 0)}
                />
                <KpiCard
                  label="가시 노출"
                  value={formatKoreanNumber(totals.viewableImpressions)}
                  sub="IAB 표준 50%·1초+"
                  color="sky"
                  spark={stats.map(s => s.viewableImpressions || 0)}
                />
                <KpiCard
                  label="클릭"
                  value={formatKoreanNumber(totals.clicks)}
                  sub={`CTR ${ctr}%`}
                  color="amber"
                  spark={stats.map(s => s.clicks || 0)}
                />
                <KpiCard
                  label="소진"
                  value={`⚾ ${formatKoreanNumber(totals.spent)}`}
                  sub={`${ad.totalBudget > 0 ? Math.round(((ad.totalSpent || 0) / ad.totalBudget) * 100) : 0}% / 총예산`}
                  color="rose"
                  spark={stats.map(s => s.spent || 0)}
                />
              </div>

              {/* 일별 트렌드 (선 그래프) */}
              <div className="bg-slate-50 rounded-xl p-4">
                <p className="text-[11px] font-[1000] text-slate-700 mb-2">📈 일별 트렌드 (노출 / 클릭)</p>
                <LineChart
                  data={stats.map(s => ({ date: s.date.slice(5), impressions: s.impressions || 0, clicks: s.clicks || 0 }))}
                />
              </div>

              {/* 분해 3종 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <BreakdownCard title="📌 슬롯별" data={breakdown.bySlot as Record<string, number>} colorClass="bg-violet-100 text-violet-700" />
                <BreakdownCard title="📍 메뉴별" data={breakdown.byMenu} colorClass="bg-emerald-100 text-emerald-700" />
                <BreakdownCard title="🌏 지역별" data={breakdown.byRegion} colorClass="bg-sky-100 text-sky-700" />
              </div>

              {/* 시간대 히트맵 */}
              <div className="bg-slate-50 rounded-xl p-4">
                <p className="text-[11px] font-[1000] text-slate-700 mb-2">🕐 시간대별 노출 빈도 (24h 누적)</p>
                <HourHeatmap byHour={breakdown.byHour} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── 보조 컴포넌트 ──────────────────────────────

const COLOR_MAP: Record<string, { bg: string; text: string; spark: string }> = {
  violet: { bg: 'bg-violet-50', text: 'text-violet-700', spark: 'stroke-violet-500' },
  sky: { bg: 'bg-sky-50', text: 'text-sky-700', spark: 'stroke-sky-500' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-700', spark: 'stroke-amber-500' },
  rose: { bg: 'bg-rose-50', text: 'text-rose-700', spark: 'stroke-rose-500' },
};

function KpiCard({ label, value, sub, color, spark }: { label: string; value: string; sub: string; color: string; spark: number[] }) {
  const c = COLOR_MAP[color] || COLOR_MAP.violet;
  const max = Math.max(1, ...spark);
  const W = 80, H = 24;
  const points = spark.length > 1
    ? spark.map((v, i) => `${(i / (spark.length - 1)) * W},${H - (v / max) * H}`).join(' ')
    : '';
  return (
    <div className={`${c.bg} rounded-xl p-3 border border-slate-100`}>
      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
      <p className={`text-[20px] font-[1000] ${c.text} leading-tight mt-0.5`}>{value}</p>
      <div className="flex items-end justify-between mt-1">
        <p className="text-[9px] font-bold text-slate-500">{sub}</p>
        {points && (
          <svg width={W} height={H} className="shrink-0">
            <polyline points={points} fill="none" className={c.spark} strokeWidth="1.5" />
          </svg>
        )}
      </div>
    </div>
  );
}

function LineChart({ data }: { data: { date: string; impressions: number; clicks: number }[] }) {
  if (data.length < 2) return <p className="text-[10px] font-bold text-slate-400 text-center py-4">데이터가 2일 이상 모이면 표시됩니다</p>;
  const W = 600, H = 140, P = 16;
  const maxImp = Math.max(1, ...data.map(d => d.impressions));
  const maxClk = Math.max(1, ...data.map(d => d.clicks));
  const x = (i: number) => P + (i / (data.length - 1)) * (W - 2 * P);
  const yI = (v: number) => H - P - (v / maxImp) * (H - 2 * P);
  const yC = (v: number) => H - P - (v / maxClk) * (H - 2 * P);
  const impPath = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${yI(d.impressions)}`).join(' ');
  const clkPath = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${yC(d.clicks)}`).join(' ');
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" style={{ height: 140 }}>
        <path d={impPath} fill="none" stroke="#7c3aed" strokeWidth="2" />
        <path d={clkPath} fill="none" stroke="#f59e0b" strokeWidth="2" />
        {data.map((d, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={yI(d.impressions)} r="2.5" fill="#7c3aed" />
            <circle cx={x(i)} cy={yC(d.clicks)} r="2.5" fill="#f59e0b" />
          </g>
        ))}
      </svg>
      <div className="flex items-center justify-between mt-1">
        <div className="flex gap-3 text-[9px] font-bold">
          <span className="text-violet-600">● 노출</span>
          <span className="text-amber-600">● 클릭</span>
        </div>
        <div className="flex gap-2 text-[8px] font-bold text-slate-400">
          {data.map((d, i) => (i === 0 || i === data.length - 1 || i === Math.floor(data.length / 2) ? <span key={i}>{d.date}</span> : null))}
        </div>
      </div>
    </div>
  );
}

function BreakdownCard({ title, data, colorClass }: { title: string; data: Record<string, number>; colorClass: string }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const total = entries.reduce((acc, [, v]) => acc + v, 0);
  return (
    <div className="bg-white rounded-xl p-3 border border-slate-100">
      <p className="text-[10px] font-[1000] text-slate-700 mb-1.5">{title}</p>
      {entries.length === 0 ? (
        <p className="text-[10px] font-bold text-slate-300 py-3 text-center">데이터 없음</p>
      ) : (
        <div className="space-y-1">
          {entries.map(([k, v]) => {
            const pct = total > 0 ? Math.round((v / total) * 100) : 0;
            return (
              <div key={k} className="flex items-center gap-1.5">
                <span className={`text-[9px] font-[1000] truncate ${colorClass} px-1.5 py-0.5 rounded shrink-0 max-w-[80px]`}>{k}</span>
                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-violet-500" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-[9px] font-bold text-slate-500 w-10 text-right shrink-0">{pct}%</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function HourHeatmap({ byHour }: { byHour: number[] }) {
  const max = Math.max(1, ...byHour);
  return (
    <div>
      <div className="grid grid-cols-12 sm:grid-cols-[repeat(24,minmax(0,1fr))] gap-0.5">
        {byHour.map((v, i) => {
          const intensity = v / max;
          const opacity = 0.1 + intensity * 0.9;
          return (
            <div key={i} className="flex flex-col items-center">
              <div className="w-full h-8 rounded" style={{ backgroundColor: `rgba(124, 58, 237, ${opacity})` }} title={`${i}시: ${v}회`} />
              <span className="text-[7px] font-bold text-slate-400 mt-0.5">{i}</span>
            </div>
          );
        })}
      </div>
      <p className="text-[9px] font-bold text-slate-400 text-center mt-2">시간대 (KST)</p>
    </div>
  );
}

export default AdStatsModal;
