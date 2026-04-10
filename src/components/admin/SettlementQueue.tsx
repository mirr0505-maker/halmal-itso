// src/components/admin/SettlementQueue.tsx — 정산 승인 대기열 (관리자 전용)
import { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, doc, query, where, orderBy, onSnapshot, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
import type { Settlement } from '../../types';
import { formatKoreanNumber } from '../../utils';

// 계좌번호 마스킹: 1234567890 → ***-***-7890
const maskAccount = (account: string) => {
  if (!account) return '-';
  const tail = account.slice(-4);
  return `***-***-${tail}`;
};

const SettlementQueue = () => {
  const [list, setList] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'settlements'), where('status', '==', 'pending'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setList(snap.docs.map(d => ({ id: d.id, ...d.data() } as Settlement)));
      setLoading(false);
    }, (err) => { console.error('[SettlementQueue]', err); setLoading(false); });
    return () => unsub();
  }, []);

  const handleApprove = async (s: Settlement) => {
    if (!window.confirm(`${s.creatorNickname}님의 정산을 승인하시겠습니까?\n실제 이체는 별도로 진행해야 합니다.`)) return;
    setList(prev => prev.filter(x => x.id !== s.id));
    await updateDoc(doc(db, 'settlements', s.id), { status: 'processing', updatedAt: serverTimestamp() });
  };

  const handleReject = async (s: Settlement) => {
    const reason = prompt('거절 사유를 입력해주세요:');
    if (!reason?.trim()) return;
    setList(prev => prev.filter(x => x.id !== s.id));
    await updateDoc(doc(db, 'settlements', s.id), {
      status: 'rejected',
      rejectionReason: reason.trim(),
      updatedAt: serverTimestamp(),
    });
    // pendingRevenue 원복
    try {
      await updateDoc(doc(db, 'users', s.creatorId), {
        pendingRevenue: increment(s.adRevenue || 0),
        pendingThanksBall: increment(s.thanksBallRevenue || 0),
      });
    } catch (e) { console.warn('[settlement reject 원복 실패]', e); }
  };

  const formatDate = (ts: { seconds: number } | null | undefined) => {
    if (!ts) return '';
    return new Date(ts.seconds * 1000).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  if (loading) return <div className="py-20 text-center text-slate-300 font-bold">불러오는 중...</div>;
  if (list.length === 0) return <div className="py-20 text-center text-slate-300 font-bold italic">정산 대기 중인 항목이 없어요</div>;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[11px] font-[1000] text-slate-400 uppercase tracking-widest">💰 정산 대기 {list.length}건</p>
      {list.map(s => {
        const account = (s as Settlement & { bankAccount?: string }).bankAccount || '';
        const bank = (s as Settlement & { bankName?: string }).bankName || '';
        return (
          <div key={s.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-[15px] font-[1000] text-slate-900">{s.creatorNickname}</h3>
                <p className="text-[10px] font-bold text-slate-400 mt-0.5">{s.creatorId.slice(0, 12)}... · 기간 {s.periodStart} ~ {s.periodEnd}</p>
              </div>
              <span className="text-[10px] font-bold text-slate-300">신청: {formatDate(s.createdAt)}</span>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 mb-3 space-y-1.5 text-[12px] font-bold text-slate-600">
              <div className="flex justify-between"><span>광고 수익</span><span>₩ {formatKoreanNumber(s.adRevenue || 0)}</span></div>
              <div className="flex justify-between"><span>땡스볼 수익</span><span>₩ {formatKoreanNumber(s.thanksBallRevenue || 0)}</span></div>
              <div className="flex justify-between border-t border-slate-200 pt-1.5 mt-1.5"><span>세전 합계</span><span className="text-slate-800">₩ {formatKoreanNumber(s.grossTotal || 0)}</span></div>
              <div className="flex justify-between text-rose-500"><span>원천세 ({s.taxRate}%)</span><span>- ₩ {formatKoreanNumber(s.taxAmount || 0)}</span></div>
              <div className="flex justify-between text-emerald-600 text-[14px] font-[1000] border-t border-slate-200 pt-1.5 mt-1.5"><span>실지급액</span><span>₩ {formatKoreanNumber(s.netAmount || 0)}</span></div>
            </div>
            <div className="text-[11px] font-bold text-slate-500 mb-3 space-y-0.5">
              <p>소득 유형: {s.incomeType === 'business' ? '사업소득' : '기타소득'}</p>
              {bank && <p>은행: {bank} / 계좌: {maskAccount(account)}</p>}
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => handleReject(s)}
                className="px-4 py-2 rounded-lg text-[12px] font-[1000] text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200">❌ 거절</button>
              <button onClick={() => handleApprove(s)}
                className="px-4 py-2 rounded-lg text-[12px] font-[1000] text-white bg-emerald-600 hover:bg-emerald-700">✅ 승인</button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default SettlementQueue;
