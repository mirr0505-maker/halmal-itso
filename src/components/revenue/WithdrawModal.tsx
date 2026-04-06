// src/components/revenue/WithdrawModal.tsx — 출금 신청 모달
// 🚀 미정산 잔액 ≥ 30,000원 시 활성화. 정산 정보(실명·계좌) 입력 후 settlements 문서 생성.
import { useState } from 'react';
import { db, auth } from '../../firebase';
import { doc, setDoc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
import { SETTLEMENT_MIN_AMOUNT, TAX_RATES, BANK_CODES } from '../../constants';
import { formatKoreanNumber } from '../../utils';

interface Props {
  pendingRevenue: number;
  pendingThanksBall: number;
  onClose: () => void;
}

const WithdrawModal = ({ pendingRevenue, pendingThanksBall, onClose }: Props) => {
  const total = pendingRevenue + pendingThanksBall;
  const uid = auth.currentUser?.uid;

  const [form, setForm] = useState({
    realName: '',
    bankCode: '088', // 신한
    bankAccountNumber: '',
    incomeType: 'other' as 'business' | 'other',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const taxRate = form.incomeType === 'business' ? TAX_RATES.BUSINESS : TAX_RATES.OTHER;
  const taxAmount = Math.floor(total * taxRate);
  const netAmount = total - taxAmount;

  const handleSubmit = async () => {
    if (!uid) return;
    if (!form.realName.trim() || !form.bankAccountNumber.trim()) {
      alert('실명과 계좌번호를 입력해주세요.');
      return;
    }
    if (total < SETTLEMENT_MIN_AMOUNT) {
      alert(`최소 출금 금액은 ₩${formatKoreanNumber(SETTLEMENT_MIN_AMOUNT)}입니다.`);
      return;
    }
    setIsSubmitting(true);
    try {
      const stId = `st_${Date.now()}_${uid}`;
      const today = new Date().toISOString().slice(0, 10);
      await setDoc(doc(db, 'settlements', stId), {
        id: stId,
        creatorId: uid,
        creatorNickname: auth.currentUser?.displayName || '',
        periodStart: today,
        periodEnd: today,
        adRevenue: pendingRevenue,
        thanksBallRevenue: pendingThanksBall,
        grossTotal: total,
        incomeType: form.incomeType,
        taxRate,
        taxAmount,
        netAmount,
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      // 미정산 잔액 차감
      await updateDoc(doc(db, 'users', uid), {
        pendingRevenue: increment(-pendingRevenue),
        pendingThanksBall: increment(-pendingThanksBall),
      });
      alert(`출금 신청 완료! 실지급 예정액: ₩${formatKoreanNumber(netAmount)}`);
      onClose();
    } catch (err) {
      alert('출금 신청 실패: ' + ((err as Error).message || ''));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-[420px] shadow-2xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-[16px] font-[1000] text-slate-900 mb-4">💰 출금 신청</h3>

        {/* 금액 요약 */}
        <div className="bg-slate-50 rounded-xl p-4 mb-4">
          <div className="flex justify-between text-[12px] font-bold mb-1">
            <span className="text-slate-500">광고 수익</span>
            <span className="text-slate-800">₩{formatKoreanNumber(pendingRevenue)}</span>
          </div>
          <div className="flex justify-between text-[12px] font-bold mb-1">
            <span className="text-slate-500">땡스볼 수익</span>
            <span className="text-slate-800">₩{formatKoreanNumber(pendingThanksBall)}</span>
          </div>
          <div className="border-t border-slate-200 pt-1 mt-1">
            <div className="flex justify-between text-[12px] font-bold">
              <span className="text-slate-500">원천세 ({(taxRate * 100).toFixed(1)}%)</span>
              <span className="text-rose-500">-₩{formatKoreanNumber(taxAmount)}</span>
            </div>
            <div className="flex justify-between text-[14px] font-[1000] mt-1">
              <span className="text-slate-800">실지급액</span>
              <span className="text-emerald-600">₩{formatKoreanNumber(netAmount)}</span>
            </div>
          </div>
        </div>

        {/* 소득 유형 선택 */}
        <div className="mb-3">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">소득 유형</p>
          <div className="flex gap-2">
            <button onClick={() => setForm(p => ({ ...p, incomeType: 'other' }))}
              className={`flex-1 py-2 rounded-xl text-[11px] font-[1000] transition-all ${form.incomeType === 'other' ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
              기타소득 (8.8%)
            </button>
            <button onClick={() => setForm(p => ({ ...p, incomeType: 'business' }))}
              className={`flex-1 py-2 rounded-xl text-[11px] font-[1000] transition-all ${form.incomeType === 'business' ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
              사업소득 (3.3%)
            </button>
          </div>
        </div>

        {/* 정산 정보 */}
        <div className="flex flex-col gap-2 mb-4">
          <input value={form.realName} onChange={e => setForm(p => ({ ...p, realName: e.target.value }))}
            placeholder="실명" className="border border-slate-200 rounded-xl px-3 py-2 text-[13px] font-bold outline-none focus:border-violet-400" />
          <select value={form.bankCode} onChange={e => setForm(p => ({ ...p, bankCode: e.target.value }))}
            className="border border-slate-200 rounded-xl px-3 py-2 text-[13px] font-bold outline-none focus:border-violet-400">
            {Object.entries(BANK_CODES).map(([code, name]) => (
              <option key={code} value={code}>{name}</option>
            ))}
          </select>
          <input value={form.bankAccountNumber} onChange={e => setForm(p => ({ ...p, bankAccountNumber: e.target.value }))}
            placeholder="계좌번호" className="border border-slate-200 rounded-xl px-3 py-2 text-[13px] font-bold outline-none focus:border-violet-400" />
        </div>

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-[12px] font-[1000] text-slate-400 bg-slate-50 hover:bg-slate-100">취소</button>
          <button onClick={handleSubmit} disabled={isSubmitting}
            className="flex-1 py-2.5 rounded-xl text-[12px] font-[1000] text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-50">
            {isSubmitting ? '신청 중...' : '출금 신청'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default WithdrawModal;
