// src/components/advertiser/AdvertiserRegister.tsx — 광고주 등록 폼
// 🚀 일반 유저 → 광고주 전환. 사업자 정보 입력 후 advertiserAccounts 문서 생성.
import { useState } from 'react';
import { db, auth } from '../../firebase';
import { doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

interface Props {
  onComplete: () => void;
  onCancel: () => void;
}

const AdvertiserRegister = ({ onComplete, onCancel }: Props) => {
  const [form, setForm] = useState({
    businessName: '',
    businessNumber: '',
    representativeName: '',
    businessAddress: '',
    email: '',
    phone: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const update = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) { alert('로그인이 필요합니다.'); return; }
    if (!form.businessName.trim() || !form.representativeName.trim() || !form.email.trim()) {
      alert('상호명, 대표자명, 이메일은 필수 입력입니다.');
      return;
    }
    setIsSubmitting(true);
    try {
      // advertiserAccounts 문서 생성 (ID = UID)
      await setDoc(doc(db, 'advertiserAccounts', uid), {
        uid,
        businessName: form.businessName.trim(),
        businessNumber: form.businessNumber.trim(),
        representativeName: form.representativeName.trim(),
        businessAddress: form.businessAddress.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        balance: 0,
        totalCharged: 0,
        totalSpent: 0,
        status: 'active',
        isVerified: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      // users 문서에 광고주 플래그 추가
      await updateDoc(doc(db, 'users', uid), {
        isAdvertiser: true,
        advertiserAccountId: uid,
      });
      onComplete();
    } catch (err) {
      alert('등록에 실패했습니다: ' + ((err as Error).message || ''));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto py-8 px-4 animate-in fade-in">
      <h2 className="text-[20px] font-[1000] text-slate-900 mb-1">📢 광고주 등록</h2>
      <p className="text-[12px] font-bold text-slate-400 mb-6">사업자 정보를 입력하고 광고를 시작하세요.</p>

      <div className="flex flex-col gap-4">
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">상호명 *</label>
          <input value={form.businessName} onChange={e => update('businessName', e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] font-bold outline-none focus:border-violet-400" placeholder="예: 할말있소 주식회사" />
        </div>
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">사업자등록번호</label>
          <input value={form.businessNumber} onChange={e => update('businessNumber', e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] font-bold outline-none focus:border-violet-400" placeholder="000-00-00000" />
        </div>
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">대표자명 *</label>
          <input value={form.representativeName} onChange={e => update('representativeName', e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] font-bold outline-none focus:border-violet-400" placeholder="홍길동" />
        </div>
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">사업장 주소</label>
          <input value={form.businessAddress} onChange={e => update('businessAddress', e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] font-bold outline-none focus:border-violet-400" placeholder="서울시 강남구..." />
        </div>
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">이메일 * (세금계산서 수신)</label>
          <input type="email" value={form.email} onChange={e => update('email', e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] font-bold outline-none focus:border-violet-400" placeholder="ad@example.com" />
        </div>
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">연락처</label>
          <input value={form.phone} onChange={e => update('phone', e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] font-bold outline-none focus:border-violet-400" placeholder="010-0000-0000" />
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl text-[13px] font-[1000] text-slate-400 bg-slate-50 hover:bg-slate-100 transition-colors">취소</button>
        <button onClick={handleSubmit} disabled={isSubmitting}
          className="flex-1 py-2.5 rounded-xl text-[13px] font-[1000] text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-50 transition-colors">
          {isSubmitting ? '등록 중...' : '광고주 등록'}
        </button>
      </div>
    </div>
  );
};

export default AdvertiserRegister;
