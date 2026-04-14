// src/components/admin/ExileManagement.tsx — 🏚️ 관리자 유배 처분 관리
// 신고 목록 + 유배 보내기 버튼
import { useState, useEffect } from 'react';
import { db, functions } from '../../firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

interface Report {
  id: string;
  reporterNickname?: string;
  targetNickname?: string;
  targetUid?: string;
  reason?: string;
  postId?: string;
  createdAt?: { toDate: () => Date };
  status?: string;
}

const ExileManagement = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // 신고 목록 실시간 구독
  useEffect(() => {
    const q = query(collection(db, 'reports'), orderBy('createdAt', 'desc'), limit(50));
    const unsub = onSnapshot(q, (snap) => {
      setReports(snap.docs.map(d => ({ id: d.id, ...d.data() } as Report)));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, []);

  const handleExile = async (targetUid: string, targetNickname: string, reason: string) => {
    const userReason = prompt(`"${targetNickname}"님을 유배 보내는 사유를 입력하세요 (기본: ${reason}):`, reason);
    if (!userReason?.trim()) return;

    if (!window.confirm(`⚠️ "${targetNickname}"님을 유배지로 보냅니다.\n\n사유: ${userReason}\n\n진행하시겠습니까? (strikeCount +1 자동 단계 판정)`)) return;

    setProcessing(targetUid);
    setMessage(null);
    try {
      const fn = httpsCallable(functions, 'sendToExile');
      const result = await fn({ targetUid, reason: userReason });
      const data = result.data as { strikeCount: number; status: string; sayakTriggered: boolean };
      if (data.sayakTriggered) {
        setMessage(`☠️ 사약 처분 완료 (${targetNickname}) — 4차 도달로 영구 밴`);
      } else {
        setMessage(`⚖️ 유배 처분 완료 (${targetNickname}) — ${data.status} (${data.strikeCount}차)`);
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      setMessage(`❌ 실패: ${e.message || '알 수 없는 오류'}`);
    } finally { setProcessing(null); }
  };

  if (loading) return <div className="py-10 text-center text-slate-300 text-[12px] font-bold">불러오는 중...</div>;

  return (
    <div className="space-y-4">
      <div className="bg-slate-900 rounded-xl p-4 text-white">
        <p className="text-[12px] font-[1000] mb-1">🏚️ 놀부의 텅 빈 곳간 — 유배 관리</p>
        <p className="text-[10px] font-bold text-slate-400">신고 기반 유배 처분 (strikeCount 자동 증가 + 단계 판정)</p>
        <div className="grid grid-cols-4 gap-2 mt-3 text-[10px] font-bold">
          <div className="bg-slate-800 rounded p-2 text-center">
            <p className="text-yellow-400">1차 놀부곳간</p>
            <p>3일 · 10볼</p>
          </div>
          <div className="bg-slate-800 rounded p-2 text-center">
            <p className="text-orange-400">2차 무인도</p>
            <p>7일 · 50볼</p>
          </div>
          <div className="bg-slate-800 rounded p-2 text-center">
            <p className="text-red-400">3차 절해고도</p>
            <p>30일 · 300볼</p>
          </div>
          <div className="bg-slate-800 rounded p-2 text-center">
            <p className="text-rose-500">☠️ 4차 사약</p>
            <p>영구 밴</p>
          </div>
        </div>
      </div>

      {message && (
        <div className={`p-3 rounded-lg text-[12px] font-bold ${
          message.startsWith('⚖️') || message.startsWith('☠️') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
        }`}>{message}</div>
      )}

      {reports.length === 0 ? (
        <p className="py-10 text-center text-slate-400 font-bold text-[12px]">접수된 신고가 없습니다</p>
      ) : (
        <div className="space-y-2">
          <p className="text-[11px] font-[1000] text-slate-500">신고 목록 ({reports.length})</p>
          {reports.map(report => (
            <div key={report.id} className="bg-white border border-slate-100 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[9px] font-[1000] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                      {report.status || 'pending'}
                    </span>
                    <span className="text-[10px] font-bold text-slate-300">
                      {report.createdAt?.toDate?.().toLocaleString('ko-KR') || ''}
                    </span>
                  </div>
                  <p className="text-[12px] font-[1000] text-slate-800 mb-1">
                    신고자: {report.reporterNickname || '익명'} → 대상: <span className="text-rose-500">{report.targetNickname || '(UID만)'}</span>
                  </p>
                  {report.reason && <p className="text-[11px] font-medium text-slate-500">사유: {report.reason}</p>}
                  {report.postId && <p className="text-[10px] font-bold text-slate-400 mt-1">postId: {report.postId}</p>}
                </div>
                {report.targetUid && (
                  <button
                    onClick={() => handleExile(report.targetUid!, report.targetNickname || '(대상)', report.reason || '')}
                    disabled={processing === report.targetUid}
                    className="shrink-0 px-3 py-2 bg-slate-900 hover:bg-red-600 text-white rounded-lg text-[11px] font-[1000] disabled:opacity-50 transition-colors whitespace-nowrap">
                    {processing === report.targetUid ? '처리 중...' : '⚖️ 유배 보내기'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 수동 유배 — UID 직접 입력 */}
      <details className="bg-white border border-slate-100 rounded-xl p-4">
        <summary className="text-[11px] font-[1000] text-slate-600 cursor-pointer">수동 유배 (UID 직접 입력)</summary>
        <ManualExileForm onSubmit={handleExile} processing={processing} />
      </details>
    </div>
  );
};

function ManualExileForm({ onSubmit, processing }: { onSubmit: (uid: string, nickname: string, reason: string) => void; processing: string | null }) {
  const [uid, setUid] = useState('');
  const [nickname, setNickname] = useState('');
  const [reason, setReason] = useState('');
  return (
    <div className="mt-3 space-y-2">
      <input value={uid} onChange={(e) => setUid(e.target.value)} placeholder="대상 UID"
        className="w-full border border-slate-200 rounded px-3 py-2 text-[12px]" />
      <input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="닉네임 (확인용)"
        className="w-full border border-slate-200 rounded px-3 py-2 text-[12px]" />
      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="사유"
        className="w-full border border-slate-200 rounded px-3 py-2 text-[12px]" />
      <button onClick={() => uid.trim() && onSubmit(uid.trim(), nickname, reason)}
        disabled={!uid.trim() || processing === uid}
        className="w-full py-2 bg-slate-900 hover:bg-red-600 text-white rounded text-[11px] font-[1000] disabled:opacity-50">
        유배 처분
      </button>
    </div>
  );
}

export default ExileManagement;
