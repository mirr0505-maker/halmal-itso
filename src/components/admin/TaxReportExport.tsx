// src/components/admin/TaxReportExport.tsx — 세무 데이터 CSV 내보내기 (관리자 전용)
import { useState } from 'react';
import { db } from '../../firebase';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import type { Settlement } from '../../types';
import { formatKoreanNumber } from '../../utils';

// 이름 마스킹: 홍길동 → 홍**
const maskName = (name: string) => {
  if (!name) return '-';
  return name[0] + '*'.repeat(Math.max(name.length - 1, 1));
};

const formatDateOnly = (ts: { seconds: number } | null | undefined) => {
  if (!ts) return '';
  const d = new Date(ts.seconds * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const TaxReportExport = () => {
  const today = new Date();
  const yearStart = `${today.getFullYear()}-01-01`;
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const [startDate, setStartDate] = useState(yearStart);
  const [endDate, setEndDate] = useState(todayStr);
  const [preview, setPreview] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSettlements = async (): Promise<Settlement[]> => {
    const start = Timestamp.fromDate(new Date(startDate + 'T00:00:00+09:00'));
    const end = Timestamp.fromDate(new Date(endDate + 'T23:59:59+09:00'));
    const q = query(
      collection(db, 'settlements'),
      where('status', '==', 'completed'),
      where('createdAt', '>=', start),
      where('createdAt', '<=', end)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Settlement));
  };

  const handlePreview = async () => {
    setLoading(true);
    try {
      const list = await fetchSettlements();
      setPreview(list.slice(0, 10));
    } catch (e) { console.error(e); alert('조회 실패'); }
    finally { setLoading(false); }
  };

  const handleExportCSV = async () => {
    setLoading(true);
    try {
      const list = await fetchSettlements();
      if (list.length === 0) { alert('해당 기간 정산 완료 건이 없습니다.'); return; }

      const header = '순번,소득자성명,주민등록번호,소득구분,지급액,세율,원천징수세액,지급일자,귀속연월,비고';
      const rows = list.map((s, i) => {
        const realName = (s as Settlement & { realName?: string }).realName || s.creatorNickname || '';
        return [
          i + 1,
          maskName(realName),
          '***-***-****',
          s.incomeType === 'business' ? '사업소득' : '기타소득',
          s.grossTotal || 0,
          (s.taxRate || 0) + '%',
          s.taxAmount || 0,
          formatDateOnly(s.completedAt) || formatDateOnly(s.createdAt),
          (s.periodEnd || '').slice(0, 7),
          '',
        ].join(',');
      });

      const csv = '\uFEFF' + header + '\n' + rows.join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `halmal_tax_report_${startDate}_${endDate}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) { console.error(e); alert('내보내기 실패'); }
    finally { setLoading(false); }
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[11px] font-[1000] text-slate-400 uppercase tracking-widest">📊 세무 데이터 내보내기</p>
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div>
            <label className="text-[10px] font-[1000] text-slate-400 block mb-1">시작일</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-[12px] font-bold text-slate-700 outline-none focus:border-blue-400" />
          </div>
          <div>
            <label className="text-[10px] font-[1000] text-slate-400 block mb-1">종료일</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-[12px] font-bold text-slate-700 outline-none focus:border-blue-400" />
          </div>
          <div className="flex gap-2 ml-auto">
            <button onClick={handlePreview} disabled={loading}
              className="px-4 py-2 rounded-lg text-[12px] font-[1000] text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:opacity-50">
              {loading ? '조회 중...' : '미리보기'}
            </button>
            <button onClick={handleExportCSV} disabled={loading}
              className="px-4 py-2 rounded-lg text-[12px] font-[1000] text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">
              📥 CSV 다운로드
            </button>
          </div>
        </div>

        {preview.length > 0 && (
          <div className="border border-slate-100 rounded-lg overflow-hidden">
            <table className="w-full text-[11px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-slate-500 font-[1000] uppercase">
                  <th className="px-3 py-2 text-left">이름</th>
                  <th className="px-3 py-2 text-left">소득구분</th>
                  <th className="px-3 py-2 text-right">지급액</th>
                  <th className="px-3 py-2 text-right">세율</th>
                  <th className="px-3 py-2 text-right">세액</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {preview.map((s) => {
                  const realName = (s as Settlement & { realName?: string }).realName || s.creatorNickname || '';
                  return (
                    <tr key={s.id} className="font-bold text-slate-600">
                      <td className="px-3 py-2">{maskName(realName)}</td>
                      <td className="px-3 py-2">{s.incomeType === 'business' ? '사업소득' : '기타소득'}</td>
                      <td className="px-3 py-2 text-right">₩ {formatKoreanNumber(s.grossTotal || 0)}</td>
                      <td className="px-3 py-2 text-right">{s.taxRate}%</td>
                      <td className="px-3 py-2 text-right text-rose-500">₩ {formatKoreanNumber(s.taxAmount || 0)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-[10px] font-bold text-slate-300 mt-3">
          ⚠️ CSV는 BOM 포함으로 Excel 한글 정상 표시. 주민등록번호는 별도 수집 절차 필요(이 파일에는 마스킹).
        </p>
      </div>
    </div>
  );
};

export default TaxReportExport;
