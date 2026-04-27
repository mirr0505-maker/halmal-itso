// src/components/admin/AdvertiserReviewQueue.tsx — 관리자 광고주 검수 큐
// 🚀 v2.1 (2026-04-26): advertiserAccounts.status='pending_review' 일괄 검수
//   승인 → 'active', 거절 → 'rejected' + rejectionReason
//   각 액션 시 광고주에게 알림 발송 (notifications/{uid}/items)
import { useEffect, useState } from 'react';
import { db, auth } from '../../firebase';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, serverTimestamp, addDoc, Timestamp } from 'firebase/firestore';
import type { AdvertiserAccount, AdvertiserType } from '../../types';

const formatDate = (ts: { seconds: number } | null | undefined) => {
  if (!ts?.seconds) return '';
  return new Date(ts.seconds * 1000).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
};

const TYPE_LABEL: Record<AdvertiserType, { emoji: string; label: string }> = {
  personal:            { emoji: '🙋', label: '개인' },
  individual_business: { emoji: '🏢', label: '개인사업자' },
  corporate:           { emoji: '🏛️', label: '법인' },
};

const AdvertiserReviewQueue = () => {
  const [accounts, setAccounts] = useState<AdvertiserAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyUid, setBusyUid] = useState<string | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'advertiserAccounts'),
      where('status', '==', 'pending_review'),
      orderBy('createdAt', 'asc'),
    );
    const unsub = onSnapshot(q, snap => {
      setAccounts(snap.docs.map(d => ({ id: d.id, ...d.data() } as AdvertiserAccount)));
      setLoading(false);
    }, err => { console.error('[AdvertiserReviewQueue]', err); setLoading(false); });
    return () => unsub();
  }, []);

  const sendNotice = async (uid: string, type: 'advertiser_approved' | 'advertiser_rejected', message: string) => {
    try {
      await addDoc(collection(db, 'notifications', uid, 'items'), {
        type, message, read: false, isRead: false, createdAt: Timestamp.now(),
      });
    } catch (err) { console.warn('[notify]', err); }
  };

  const handleApprove = async (acc: AdvertiserAccount) => {
    if (!window.confirm(`${acc.contactName} (${TYPE_LABEL[acc.type].label}) 광고주를 승인하시겠습니까?`)) return;
    setBusyUid(acc.uid);
    try {
      await updateDoc(doc(db, 'advertiserAccounts', acc.uid), {
        status: 'active',
        reviewedAt: serverTimestamp(),
        reviewedBy: auth.currentUser?.uid || 'unknown',
        updatedAt: serverTimestamp(),
      });
      await sendNotice(acc.uid, 'advertiser_approved', `✅ 광고주 등록이 승인됐어요. 이제 광고를 등록할 수 있습니다.`);
      alert('✅ 승인 처리 완료');
    } catch (err) {
      alert('승인 실패: ' + ((err as Error).message || ''));
    } finally {
      setBusyUid(null);
    }
  };

  const handleReject = async (acc: AdvertiserAccount) => {
    const reason = window.prompt(`${acc.contactName} 광고주 거절 사유 (광고주에게 알림으로 전송됩니다)`, '');
    if (!reason || reason.trim().length < 2) return;
    setBusyUid(acc.uid);
    try {
      await updateDoc(doc(db, 'advertiserAccounts', acc.uid), {
        status: 'rejected',
        rejectionReason: reason.trim(),
        reviewedAt: serverTimestamp(),
        reviewedBy: auth.currentUser?.uid || 'unknown',
        updatedAt: serverTimestamp(),
      });
      await sendNotice(acc.uid, 'advertiser_rejected', `❌ 광고주 등록이 거절됐어요. 사유: ${reason.trim()}`);
      alert('✅ 거절 처리 완료');
    } catch (err) {
      alert('거절 실패: ' + ((err as Error).message || ''));
    } finally {
      setBusyUid(null);
    }
  };

  if (loading) return <p className="py-12 text-center text-slate-300 font-bold text-[12px]">불러오는 중...</p>;
  if (accounts.length === 0) return (
    <div className="py-16 text-center">
      <p className="text-[40px] mb-2">✅</p>
      <p className="text-[14px] font-[1000] text-slate-500">검수 대기 중인 광고주가 없습니다</p>
      <p className="text-[10px] font-bold text-slate-300 mt-1">새 등록이 들어오면 여기에 자동 표시됩니다</p>
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      {accounts.map(acc => {
        const t = TYPE_LABEL[acc.type];
        const isBusy = busyUid === acc.uid;
        return (
          <div key={acc.uid} className="bg-white rounded-2xl border border-amber-200 p-4 hover:shadow-sm transition-all">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-[24px]">{t.emoji}</span>
                <div>
                  <h3 className="text-[14px] font-[1000] text-slate-900">{acc.contactName}</h3>
                  <p className="text-[10px] font-bold text-slate-500">{t.label} · uid {acc.uid.slice(0, 8)}...</p>
                </div>
              </div>
              <span className="text-[10px] font-bold text-slate-300">{formatDate(acc.createdAt)}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] font-bold text-slate-500 mb-3">
              <p>📧 이메일: <span className="text-slate-700">{acc.email || '—'}</span></p>
              <p>📞 연락처: <span className="text-slate-700">{acc.phone || '—'}</span></p>
              {acc.type !== 'personal' && (
                <>
                  <p>🏢 {acc.type === 'corporate' ? '법인명' : '상호명'}: <span className="text-slate-700">{acc.businessName || '—'}</span></p>
                  <p>🔢 {acc.type === 'corporate' ? '법인번호' : '사업자번호'}: <span className="text-slate-700">{acc.businessNumber || '—'}</span></p>
                  {acc.type === 'corporate' && (
                    <p>👤 대표자: <span className="text-slate-700">{acc.representativeName || '—'}</span></p>
                  )}
                  <p className="sm:col-span-2">📍 사업장: <span className="text-slate-700">{acc.businessAddress || '—'}</span></p>
                </>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={() => handleReject(acc)} disabled={isBusy}
                className="px-4 py-2 rounded-lg text-[12px] font-[1000] text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 disabled:opacity-50">
                ❌ 거절
              </button>
              <button onClick={() => handleApprove(acc)} disabled={isBusy}
                className="px-4 py-2 rounded-lg text-[12px] font-[1000] text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-50">
                ✅ 승인
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default AdvertiserReviewQueue;
