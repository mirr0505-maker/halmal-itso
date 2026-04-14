// src/components/admin/AppealReview.tsx — 🏚️ 이의 제기 검토 (관리자)
import { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, serverTimestamp, addDoc, Timestamp } from 'firebase/firestore';

interface Appeal {
  id: string;
  uid: string;
  nickname: string;
  content: string;
  sanctionStatus?: string;
  strikeCount?: number;
  sanctionReason?: string;
  status: 'pending' | 'accepted' | 'rejected';
  adminReply?: string;
  createdAt?: { toDate?: () => Date };
}

const AppealReview = () => {
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    const q = filter === 'pending'
      ? query(collection(db, 'appeals'), where('status', '==', 'pending'), orderBy('createdAt', 'desc'))
      : query(collection(db, 'appeals'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setAppeals(snap.docs.map(d => ({ id: d.id, ...d.data() } as Appeal)));
      setLoading(false);
    }, (err) => { console.error('[AppealReview]', err); setLoading(false); });
    return unsub;
  }, [filter]);

  const handleReview = async (appeal: Appeal, decision: 'accepted' | 'rejected') => {
    const reply = prompt(`${decision === 'accepted' ? '인용' : '기각'} 사유를 입력하세요:`);
    if (!reply?.trim()) return;
    if (!window.confirm(`정말 "${appeal.nickname}"님의 이의를 ${decision === 'accepted' ? '인용(유배 해제)' : '기각'}하시겠습니까?`)) return;

    setProcessing(appeal.id);
    try {
      await updateDoc(doc(db, 'appeals', appeal.id), {
        status: decision,
        adminReply: reply.trim(),
        reviewedAt: serverTimestamp(),
      });

      // 알림 발송
      await addDoc(collection(db, 'notifications', appeal.uid, 'items'), {
        type: 'appeal_reviewed',
        decision,
        adminReply: reply.trim(),
        createdAt: Timestamp.now(),
        read: false,
      });

      // 인용 시 유배 해제는 별도 관리자 작업 (executeSayak 해제나 sanctionStatus 수동 변경은
      // Firestore 콘솔에서 직접 처리 — 자동 해제는 악용 가능성으로 수동)
      if (decision === 'accepted') {
        alert(`인용 처리되었습니다.\n\n유배 해제는 Firestore Console에서 직접 처리해주세요:\nusers/${appeal.uid}.sanctionStatus = 'active'`);
      }
    } catch (err) {
      alert('처리 실패: ' + ((err as Error).message || ''));
    } finally {
      setProcessing(null);
    }
  };

  if (loading) return <div className="py-10 text-center text-slate-300 text-[12px] font-bold">불러오는 중...</div>;

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5">
        <button onClick={() => setFilter('pending')}
          className={`px-3 py-1.5 rounded-lg text-[11px] font-[1000] border ${
            filter === 'pending' ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-200 text-slate-500'
          }`}>검토 대기</button>
        <button onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-[11px] font-[1000] border ${
            filter === 'all' ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-200 text-slate-500'
          }`}>전체</button>
      </div>

      {appeals.length === 0 ? (
        <p className="py-10 text-center text-slate-400 font-bold text-[12px]">
          {filter === 'pending' ? '검토 대기 중인 이의 제기가 없습니다' : '이의 제기 이력이 없습니다'}
        </p>
      ) : (
        appeals.map(appeal => (
          <div key={appeal.id} className="bg-white border border-slate-100 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[12px] font-[1000] text-slate-800">{appeal.nickname}</span>
              <span className="text-[9px] font-bold text-slate-400">{appeal.sanctionStatus || '-'}</span>
              {appeal.strikeCount && <span className="text-[9px] font-bold text-slate-400">{appeal.strikeCount}범</span>}
              <span className={`text-[9px] font-[1000] px-1.5 py-0.5 rounded-full ml-auto ${
                appeal.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                appeal.status === 'accepted' ? 'bg-emerald-100 text-emerald-700' :
                'bg-slate-200 text-slate-500'
              }`}>
                {appeal.status === 'pending' ? '검토 중' : appeal.status === 'accepted' ? '인용' : '기각'}
              </span>
            </div>
            {appeal.sanctionReason && (
              <p className="text-[10px] font-bold text-slate-400 mb-1">원 사유: {appeal.sanctionReason}</p>
            )}
            <div className="p-3 bg-slate-50 rounded-lg mb-2">
              <p className="text-[11px] font-medium text-slate-700 whitespace-pre-wrap">{appeal.content}</p>
            </div>
            {appeal.adminReply && (
              <div className="p-3 bg-blue-50 rounded-lg mb-2">
                <p className="text-[9px] font-[1000] text-blue-700 mb-1">관리자 답변</p>
                <p className="text-[11px] font-medium text-blue-800">{appeal.adminReply}</p>
              </div>
            )}
            {appeal.status === 'pending' && (
              <div className="flex gap-1.5">
                <button onClick={() => handleReview(appeal, 'accepted')} disabled={processing === appeal.id}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-[1000] disabled:opacity-50">
                  인용 (해제 권고)
                </button>
                <button onClick={() => handleReview(appeal, 'rejected')} disabled={processing === appeal.id}
                  className="flex-1 py-2 bg-slate-500 hover:bg-slate-600 text-white rounded-lg text-[11px] font-[1000] disabled:opacity-50">
                  기각
                </button>
              </div>
            )}
            <p className="text-[9px] font-bold text-slate-300 mt-1 font-mono">UID: {appeal.uid}</p>
          </div>
        ))
      )}
    </div>
  );
};

export default AppealReview;
