// src/components/advertiser/AdvertiserRegister.tsx — 광고주 등록 폼
// 🚀 2026-04-25 개편: type별 분기 (personal / individual_business / corporate)
//   1uid:1type 제약. type 변경은 별도 신청·심사 (TODO Sprint 8).
// 🚀 v2.1 (2026-04-26): 모든 광고주 등록은 status='pending_review' (검수 의무)
//   + user 정보 자동 인입 (nickname → contactName, email, phone)
import { useState, useEffect } from 'react';
import { db, auth } from '../../firebase';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import type { AdvertiserType } from '../../types';

interface Props {
  type: AdvertiserType;        // 🚀 신규: 외부에서 type 결정 후 전달
  onComplete: () => void;
  onCancel: () => void;
}

const TYPE_META: Record<AdvertiserType, { title: string; emoji: string; sub: string }> = {
  personal:             { emoji: '🙋', title: '개인 광고주', sub: '사업자 아닌 일반 사용자 — 간소 폼' },
  individual_business:  { emoji: '🏢', title: '개인사업자',   sub: '사업자등록번호·상호명 필수' },
  corporate:            { emoji: '🏛️', title: '법인사업자',   sub: '법인등록번호·법인명·대표자 필수' },
};

const AdvertiserRegister = ({ type, onComplete, onCancel }: Props) => {
  const meta = TYPE_META[type];
  const [form, setForm] = useState({
    contactName: '',
    email: '',
    phone: '',
    businessName: '',
    businessNumber: '',
    representativeName: '',
    businessAddress: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPrefilled, setIsPrefilled] = useState(false);

  // 🚀 v2.1: 글러브 user 정보 자동 인입 — nickname/email/phone
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    const authEmail = auth.currentUser?.email || '';
    if (!uid) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'users', uid));
        const u = snap.exists() ? (snap.data() as { nickname?: string; phoneNumber?: string; phone?: string }) : {};
        setForm(prev => ({
          ...prev,
          contactName: prev.contactName || u.nickname || '',
          email: prev.email || authEmail || '',
          phone: prev.phone || u.phoneNumber || u.phone || '',
        }));
        setIsPrefilled(true);
      } catch { /* ignore */ }
    })();
  }, []);

  const update = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) { alert('로그인이 필요합니다.'); return; }
    // type별 필수 검증
    if (!form.contactName.trim() || !form.email.trim()) {
      alert(type === 'personal' ? '이름·이메일은 필수입니다.' : '담당자명·이메일은 필수입니다.');
      return;
    }
    if (type !== 'personal') {
      if (!form.businessName.trim() || !form.businessNumber.trim()) {
        alert(type === 'corporate' ? '법인명·법인번호 필수입니다.' : '상호명·사업자등록번호 필수입니다.');
        return;
      }
      if (type === 'corporate' && !form.representativeName.trim()) {
        alert('법인 대표자명 필수입니다.');
        return;
      }
    }
    setIsSubmitting(true);
    try {
      // advertiserAccounts 문서 생성 — 1uid:1type
      // 🚀 v2.1 (2026-04-26): status='pending_review' — 모든 광고주 검수 의무
      //   관리자가 AdvertiserReviewQueue에서 승인/거절 후 status 변경
      await setDoc(doc(db, 'advertiserAccounts', uid), {
        uid,
        type,
        contactName: form.contactName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        businessName: type === 'personal' ? '' : form.businessName.trim(),
        businessNumber: type === 'personal' ? '' : form.businessNumber.trim(),
        representativeName: type === 'personal' ? '' : form.representativeName.trim(),
        businessAddress: type === 'personal' ? '' : form.businessAddress.trim(),
        balance: 0,
        totalCharged: 0,
        totalSpent: 0,
        status: 'pending_review',
        isVerified: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      // users 문서 — 광고주 플래그 + type 동기화
      await updateDoc(doc(db, 'users', uid), {
        isAdvertiser: true,
        advertiserAccountId: uid,
        accountType: type,           // 🚀 추후 회원가입 단계 분리 시 활용
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
      <div className="flex items-center gap-3 mb-1">
        <span className="text-[28px]">{meta.emoji}</span>
        <h2 className="text-[20px] font-[1000] text-slate-900">{meta.title} 등록</h2>
      </div>
      <p className="text-[12px] font-bold text-slate-400 mb-2">{meta.sub}</p>
      <p className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-2">
        ⚠️ 모든 광고주 등록은 <strong>관리자 1차 검수</strong> 후 활성화됩니다. 검수 결과는 알림으로 안내드려요. 광고비 결제는 ⚾ 볼 단위. 정식 서비스 시 카드 PG·세금계산서 자동 발행 도입 예정.
      </p>
      {isPrefilled && (
        <p className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 mb-6">
          ✅ 글러브 가입 정보(닉네임·이메일·연락처)를 자동으로 가져왔어요. 필요 시 수정 가능합니다.
        </p>
      )}

      <div className="flex flex-col gap-4">
        {/* 공통 필드 */}
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">
            {type === 'personal' ? '이름 *' : '담당자명 *'}
          </label>
          <input value={form.contactName} onChange={e => update('contactName', e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] font-bold outline-none focus:border-violet-400" placeholder="홍길동" />
        </div>
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">
            이메일 * {type !== 'personal' && '(세금계산서 수신)'}
          </label>
          <input type="email" value={form.email} onChange={e => update('email', e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] font-bold outline-none focus:border-violet-400" placeholder="ad@example.com" />
        </div>
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">연락처</label>
          <input value={form.phone} onChange={e => update('phone', e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] font-bold outline-none focus:border-violet-400" placeholder="010-0000-0000" />
        </div>

        {/* 사업자/법인 전용 필드 */}
        {type !== 'personal' && (
          <>
            <div className="border-t border-slate-100 pt-4">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">
                {type === 'corporate' ? '법인명 *' : '상호명 *'}
              </label>
              <input value={form.businessName} onChange={e => update('businessName', e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] font-bold outline-none focus:border-violet-400"
                placeholder={type === 'corporate' ? '예: 할말있소 주식회사' : '예: 봉이 플라워샵'} />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">
                {type === 'corporate' ? '법인등록번호 *' : '사업자등록번호 *'}
              </label>
              <input value={form.businessNumber} onChange={e => update('businessNumber', e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] font-bold outline-none focus:border-violet-400"
                placeholder={type === 'corporate' ? '000000-0000000' : '000-00-00000'} />
              <p className="text-[9px] font-bold text-slate-300 mt-1">⚠️ 자동 검증은 정식 서비스 시점 도입 — 베타에서는 1차 검수에서 수동 확인</p>
            </div>
            {type === 'corporate' && (
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">대표자명 *</label>
                <input value={form.representativeName} onChange={e => update('representativeName', e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] font-bold outline-none focus:border-violet-400" placeholder="홍길동" />
              </div>
            )}
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">사업장 주소</label>
              <input value={form.businessAddress} onChange={e => update('businessAddress', e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] font-bold outline-none focus:border-violet-400" placeholder="서울시 강남구..." />
            </div>
          </>
        )}
      </div>

      <div className="flex gap-3 mt-6">
        <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl text-[13px] font-[1000] text-slate-400 bg-slate-50 hover:bg-slate-100 transition-colors">취소</button>
        <button onClick={handleSubmit} disabled={isSubmitting}
          className="flex-1 py-2.5 rounded-xl text-[13px] font-[1000] text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-50 transition-colors">
          {isSubmitting ? '등록 중...' : '광고주 등록 — 검수 요청'}
        </button>
      </div>
    </div>
  );
};

export default AdvertiserRegister;
