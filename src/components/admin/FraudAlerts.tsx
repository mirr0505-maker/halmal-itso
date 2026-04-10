// src/components/admin/FraudAlerts.tsx — 부정행위 알림 (관리자 전용)
import { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import type { AdEvent } from '../../types';

const FraudAlerts = () => {
  const [events, setEvents] = useState<AdEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'adEvents'),
      where('isSuspicious', '==', true),
      orderBy('createdAt', 'desc'),
      limit(100)
    );
    const unsub = onSnapshot(q, (snap) => {
      setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() } as AdEvent)));
      setLoading(false);
    }, (err) => { console.error('[FraudAlerts]', err); setLoading(false); });
    return () => unsub();
  }, []);

  // 오늘/이번 주 카운트
  const now = Date.now();
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const weekStart = now - 7 * 24 * 60 * 60 * 1000;
  const todayCount = events.filter(e => (e.createdAt?.seconds || 0) * 1000 >= todayStart.getTime()).length;
  const weekCount = events.filter(e => (e.createdAt?.seconds || 0) * 1000 >= weekStart).length;

  const formatTime = (ts: { seconds: number } | null | undefined) => {
    if (!ts) return '-';
    return new Date(ts.seconds * 1000).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  if (loading) return <div className="py-20 text-center text-slate-300 font-bold">불러오는 중...</div>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-[1000] text-slate-400 uppercase tracking-widest">🚨 부정행위 알림 (최근 100건)</p>
        <div className="flex gap-3 text-[11px] font-bold">
          <span className="text-rose-500">오늘 <strong>{todayCount}</strong>건</span>
          <span className="text-amber-500">이번 주 <strong>{weekCount}</strong>건</span>
        </div>
      </div>
      {events.length === 0 ? (
        <div className="py-20 text-center text-slate-300 font-bold italic">의심 이벤트가 없어요 👍</div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-[11px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-slate-500 font-[1000] uppercase tracking-wide">
                <th className="px-3 py-2 text-left">시간</th>
                <th className="px-3 py-2 text-left">유형</th>
                <th className="px-3 py-2 text-left">광고 ID</th>
                <th className="px-3 py-2 text-left">열람자 UID</th>
                <th className="px-3 py-2 text-left">슬롯</th>
                <th className="px-3 py-2 text-right">금액</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {events.map(e => (
                <tr key={e.id} className="font-bold text-slate-600 hover:bg-slate-50">
                  <td className="px-3 py-2">{formatTime(e.createdAt)}</td>
                  <td className="px-3 py-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${e.eventType === 'click' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>
                      {e.eventType}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-500">{e.adId?.slice(0, 12)}...</td>
                  <td className="px-3 py-2 text-slate-500">{e.viewerUid?.slice(0, 12) || '-'}...</td>
                  <td className="px-3 py-2">{e.slotPosition}</td>
                  <td className="px-3 py-2 text-right">₩ {e.bidAmount || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default FraudAlerts;
