// src/components/admin/ReportManagement.tsx — 🚨 관리자 신고 관리 UI (2026-04-24 Phase 3)
// 기능:
//   - 신고 목록 실시간 구독 (pending 기본, resolved/rejected 필터)
//   - targetId별 그룹화 (같은 글 여러 신고 → 1개 카드로 묶음, 고유 신고자 수 표시)
//   - 조치 3종: hide_content / delete_content / warn_user / none (resolveReport CF)
//   - 기각 (rejectReport CF)
//   - 자동 숨김(isHiddenByReport) 복구 (restoreHiddenPost CF)
// 검색어: ReportManagement

import { useEffect, useMemo, useState } from 'react';
import { db, functions } from '../../firebase';
import { collection, onSnapshot, query, where, orderBy, limit as qLimit } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

type ReportStatus = 'pending' | 'resolved' | 'rejected';
type ReportTargetType = 'post' | 'comment' | 'community_post' | 'community_post_comment' | 'episode';

interface Report {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  targetUid: string;
  reporterUid: string;
  reasonKey?: string;
  reason?: string;
  status: ReportStatus;
  createdAt?: { toDate?: () => Date };
  resolution?: string;
  resolutionNote?: string;
}

// targetId별 그룹핑 결과
interface TargetGroup {
  targetType: ReportTargetType;
  targetId: string;
  targetUid: string;
  reports: Report[];
  uniqueReporters: Set<string>;
  firstCreatedAt: Date | null;
  latestCreatedAt: Date | null;
  sampleReasons: string[];
}

const STATUS_LABELS: Record<ReportStatus, string> = {
  pending: '⏳ 대기',
  resolved: '✅ 처리됨',
  rejected: '🚫 기각',
};

// Appeal queue 항목 — posts + community_posts에서 appealStatus=pending 수집
interface AppealItem {
  collection: 'posts' | 'community_posts';
  id: string;
  authorId: string;
  author: string;
  title: string;
  reportState?: string;
  reportCount?: number;
  dominantReason?: string;
  appealNote: string;
  appealAt?: { toDate?: () => Date };
}

const ReportManagement = () => {
  const [statusFilter, setStatusFilter] = useState<ReportStatus>('pending');
  const [reports, setReports] = useState<Report[]>([]);
  const [appeals, setAppeals] = useState<AppealItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyReportId, setBusyReportId] = useState<string | null>(null);
  const [resolveTarget, setResolveTarget] = useState<TargetGroup | null>(null);

  // 실시간 구독
  useEffect(() => {
    setLoading(true);
    const q = query(
      collection(db, 'reports'),
      where('status', '==', statusFilter),
      orderBy('createdAt', 'desc'),
      qLimit(100),
    );
    const unsub = onSnapshot(q, (snap) => {
      setReports(snap.docs.map(d => ({ id: d.id, ...d.data() } as Report)));
      setLoading(false);
    }, (err) => {
      console.error('[ReportManagement]', err);
      setLoading(false);
    });
    return unsub;
  }, [statusFilter]);

  // ⚡ 이의제기 우선큐 — posts + community_posts 에서 appealStatus=pending
  useEffect(() => {
    const parse = (coll: 'posts' | 'community_posts') => (snap: ReturnType<typeof collection> extends never ? never : any) => {
      return snap.docs.map((d: any) => {
        const data = d.data() || {};
        return {
          collection: coll,
          id: d.id,
          authorId: data.author_id || data.authorId || '',
          author: data.author || '',
          title: data.title || data.episodeTitle || '(제목 없음)',
          reportState: data.reportState,
          reportCount: data.reportCount,
          dominantReason: data.dominantReason,
          appealNote: data.appealNote || '',
          appealAt: data.appealAt,
        } as AppealItem;
      });
    };
    const qPosts = query(collection(db, 'posts'), where('appealStatus', '==', 'pending'), qLimit(50));
    const qCommunity = query(collection(db, 'community_posts'), where('appealStatus', '==', 'pending'), qLimit(50));
    let postAppeals: AppealItem[] = [];
    let communityAppeals: AppealItem[] = [];
    const merge = () => setAppeals([...postAppeals, ...communityAppeals].sort((a, b) => {
      const at = a.appealAt?.toDate?.()?.getTime() || 0;
      const bt = b.appealAt?.toDate?.()?.getTime() || 0;
      return bt - at;
    }));
    const unsub1 = onSnapshot(qPosts, (s) => { postAppeals = parse('posts')(s); merge(); });
    const unsub2 = onSnapshot(qCommunity, (s) => { communityAppeals = parse('community_posts')(s); merge(); });
    return () => { unsub1(); unsub2(); };
  }, []);

  // targetId별 그룹핑
  const groups = useMemo<TargetGroup[]>(() => {
    const map = new Map<string, TargetGroup>();
    for (const r of reports) {
      const key = `${r.targetType}_${r.targetId}`;
      if (!map.has(key)) {
        map.set(key, {
          targetType: r.targetType,
          targetId: r.targetId,
          targetUid: r.targetUid,
          reports: [],
          uniqueReporters: new Set(),
          firstCreatedAt: null,
          latestCreatedAt: null,
          sampleReasons: [],
        });
      }
      const g = map.get(key)!;
      g.reports.push(r);
      g.uniqueReporters.add(r.reporterUid);
      const created = r.createdAt?.toDate?.() || null;
      if (created) {
        if (!g.firstCreatedAt || created < g.firstCreatedAt) g.firstCreatedAt = created;
        if (!g.latestCreatedAt || created > g.latestCreatedAt) g.latestCreatedAt = created;
      }
      if (r.reason && g.sampleReasons.length < 3) g.sampleReasons.push(r.reason);
    }
    return [...map.values()].sort((a, b) => b.uniqueReporters.size - a.uniqueReporters.size);
  }, [reports]);

  const handleReject = async (reportIds: string[]) => {
    const note = window.prompt('기각 사유를 입력해주세요 (2자 이상, 악성·허위 신고 등)', '');
    if (!note || note.trim().length < 2) return;
    setBusyReportId(reportIds.join(','));
    try {
      const fn = httpsCallable(functions, 'rejectReport');
      for (const id of reportIds) {
        await fn({ reportId: id, note: note.trim() });
      }
      alert(`${reportIds.length}건 기각 완료`);
    } catch (err) {
      console.error('[rejectReport]', err);
      alert('기각 실패: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setBusyReportId(null);
    }
  };

  const handleRestore = async (group: TargetGroup) => {
    const note = window.prompt('복구 사유 (오탐/재검토 후 복원 등, 2자+)', '');
    if (!note || note.trim().length < 2) return;
    setBusyReportId(group.targetId);
    try {
      const fn = httpsCallable(functions, 'restoreHiddenPost');
      const res = await fn({ targetType: group.targetType, targetId: group.targetId, note: note.trim() });
      const data = res.data as { success: boolean; bulkRejectedCount: number };
      alert(`복구 완료 — ${data.bulkRejectedCount}건 pending 신고 기각됨`);
    } catch (err) {
      console.error('[restoreHiddenPost]', err);
      alert('복구 실패: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setBusyReportId(null);
    }
  };

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-[16px] font-[1000] text-slate-800">🚨 신고 관리</h2>
        <p className="text-[11px] font-bold text-slate-500 mt-0.5">
          카테고리별 차등 threshold. 한번 올라간 상태는 관리자 복구만 가능. 작성자 이의제기는 우선큐에 표시.
        </p>
      </div>

      {/* ⚡ 이의제기 우선큐 — 작성자가 제기한 복구 요청 */}
      {appeals.length > 0 && (
        <div className="mb-5 p-3 border-2 border-indigo-300 bg-indigo-50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[13px] font-[1000] text-indigo-800">⚡ 이의제기 우선큐 ({appeals.length}건)</h3>
            <span className="text-[10px] font-bold text-indigo-600">작성자 본인이 복구 요청한 글 — 우선 검토</span>
          </div>
          <div className="space-y-1.5">
            {appeals.slice(0, 20).map(a => (
              <div key={`${a.collection}_${a.id}`} className="p-2.5 bg-white rounded border border-indigo-200">
                <div className="flex items-start gap-2 flex-wrap">
                  <span className="text-[10px] font-[1000] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">
                    {a.collection === 'posts' ? 'POST' : 'COMMUNITY_POST'}
                  </span>
                  <span className="text-[10px] font-bold text-slate-500">상태: {a.reportState || '-'}</span>
                  <span className="text-[10px] font-bold text-slate-500">신고 {a.reportCount || 0}명</span>
                  <span className="text-[10px] font-bold text-slate-500">사유: {a.dominantReason || '-'}</span>
                  <span className="text-[10px] font-bold text-slate-400 ml-auto">
                    {a.appealAt?.toDate?.()?.toLocaleString('ko-KR') || '-'}
                  </span>
                </div>
                <p className="text-[11px] font-[1000] text-slate-800 mt-1.5 truncate">{a.title}</p>
                <p className="text-[10px] font-mono text-slate-500">작성자: {a.author} ({a.authorId})</p>
                <div className="mt-1.5 p-2 bg-indigo-50 rounded">
                  <p className="text-[10px] font-bold text-indigo-600 mb-0.5">이의제기 사유:</p>
                  <p className="text-[11px] text-slate-700 whitespace-pre-wrap">{a.appealNote}</p>
                </div>
                <div className="mt-1.5 text-[10px] font-bold text-slate-500">
                  💡 조치: 해당 글의 신고 항목을 "🚨 대기" 탭에서 찾아 "복구" 또는 "기각" 처리 ·
                  복구 시 작성자에게 복구 알림 자동 발송
                </div>
              </div>
            ))}
            {appeals.length > 20 && (
              <p className="text-[10px] font-bold text-indigo-500 text-center py-1">
                ...외 {appeals.length - 20}건
              </p>
            )}
          </div>
        </div>
      )}

      {/* 상태 필터 탭 */}
      <div className="flex gap-1 mb-4 border-b border-slate-200">
        {(Object.keys(STATUS_LABELS) as ReportStatus[]).map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-2 text-[12px] font-black transition-colors border-b-2 -mb-px ${
              statusFilter === s ? 'border-rose-500 text-rose-600' : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}>
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="py-10 text-center text-slate-400 font-bold text-[12px]">불러오는 중...</p>
      ) : groups.length === 0 ? (
        <p className="py-10 text-center text-slate-400 font-bold text-[12px]">
          {statusFilter === 'pending' ? '대기 중인 신고가 없습니다' : '해당 상태 신고 없음'}
        </p>
      ) : (
        <div className="space-y-2">
          <p className="text-[11px] font-[1000] text-slate-500">
            타겟 {groups.length}건 (총 {reports.length}개 신고)
          </p>
          {groups.map(g => {
            const reportIds = g.reports.map(r => r.id);
            const severity = g.uniqueReporters.size >= 3 ? 'rose' : g.uniqueReporters.size >= 2 ? 'amber' : 'slate';
            const busyThis = busyReportId?.startsWith(g.targetId) || reportIds.some(id => busyReportId?.includes(id));
            return (
              <div key={`${g.targetType}_${g.targetId}`}
                className={`p-3 border rounded-lg bg-white ${
                  severity === 'rose' ? 'border-rose-200 bg-rose-50/30'
                  : severity === 'amber' ? 'border-amber-200 bg-amber-50/30'
                  : 'border-slate-200'
                }`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-[1000] px-1.5 py-0.5 rounded ${
                        severity === 'rose' ? 'bg-rose-100 text-rose-700'
                        : severity === 'amber' ? 'bg-amber-100 text-amber-700'
                        : 'bg-slate-100 text-slate-600'
                      }`}>
                        🚨 고유 신고자 {g.uniqueReporters.size}명
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">
                        총 {g.reports.length}건 / {g.targetType}
                      </span>
                      {g.uniqueReporters.size >= 3 && statusFilter === 'pending' && (
                        <span className="text-[10px] font-[1000] bg-rose-600 text-white px-1.5 py-0.5 rounded">
                          자동 숨김됨
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] font-mono text-slate-500 truncate mt-1">
                      targetId: {g.targetId}
                    </p>
                    <p className="text-[11px] font-mono text-slate-500 truncate">
                      targetUid: {g.targetUid}
                    </p>
                    <p className="text-[11px] font-bold text-slate-600 mt-1.5">
                      최근 신고: {g.latestCreatedAt?.toLocaleString('ko-KR') || '-'}
                    </p>
                    {g.sampleReasons.length > 0 && (
                      <div className="mt-1.5 space-y-0.5">
                        {g.sampleReasons.map((r, i) => (
                          <p key={i} className="text-[11px] text-slate-500 bg-slate-50 px-2 py-1 rounded">
                            • {r || '(사유 없음)'}
                          </p>
                        ))}
                        {g.reports.length > g.sampleReasons.length && (
                          <p className="text-[10px] font-bold text-slate-400">
                            ...외 {g.reports.length - g.sampleReasons.length}건
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {statusFilter === 'pending' && (
                  <div className="mt-2.5 flex gap-1.5 flex-wrap">
                    <button onClick={() => setResolveTarget(g)} disabled={busyThis}
                      className="px-2.5 py-1 rounded text-[11px] font-bold bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-50">
                      조치 실행
                    </button>
                    <button onClick={() => handleReject(reportIds)} disabled={busyThis}
                      className="px-2.5 py-1 rounded text-[11px] font-bold bg-slate-200 text-slate-700 hover:bg-slate-300 disabled:opacity-50">
                      기각 ({reportIds.length}건)
                    </button>
                    {g.uniqueReporters.size >= 3 && (
                      <button onClick={() => handleRestore(g)} disabled={busyThis}
                        className="px-2.5 py-1 rounded text-[11px] font-bold bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50">
                        ✓ 복구 (오탐)
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 조치 실행 모달 */}
      {resolveTarget && (
        <ResolveModal group={resolveTarget}
          onClose={() => setResolveTarget(null)}
          onDone={() => { setResolveTarget(null); /* onSnapshot이 자동 갱신 */ }} />
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// 조치 실행 모달
// ═══════════════════════════════════════════════════════════════
const RESOLVE_ACTIONS: { key: string; label: string; desc: string; color: string }[] = [
  { key: 'hide_content', label: '🙈 컨텐츠 숨김', desc: 'isHiddenByReport=true. 복구 가능', color: 'amber' },
  { key: 'delete_content', label: '🗑️ 컨텐츠 삭제', desc: 'isDeleted=true 영구 표식', color: 'rose' },
  { key: 'warn_user', label: '⚠️ 작성자 경고', desc: '알림 발송. 컨텐츠는 유지', color: 'amber' },
  { key: 'none', label: '🚫 조치 없음', desc: '신고만 resolved 처리', color: 'slate' },
];

interface ResolveModalProps {
  group: TargetGroup;
  onClose: () => void;
  onDone: () => void;
}

const ResolveModal = ({ group, onClose, onDone }: ResolveModalProps) => {
  const [action, setAction] = useState('hide_content');
  const [note, setNote] = useState('');
  const [notifyParticipants, setNotifyParticipants] = useState(true);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (note.trim().length < 2) {
      alert('사유를 2자 이상 입력해주세요.');
      return;
    }
    setBusy(true);
    try {
      const fn = httpsCallable(functions, 'resolveReport');
      const firstReportId = group.reports[0].id;
      const res = await fn({ reportId: firstReportId, action, note: note.trim(), notifyParticipants });
      const data = res.data as { success: boolean; bulkResolvedCount: number; action: string };
      alert(`조치 완료 — ${data.action} / 일괄 처리 ${data.bulkResolvedCount + 1}건`);
      onDone();
    } catch (err) {
      console.error('[resolveReport]', err);
      alert('조치 실패: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center px-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-[14px] font-[1000] text-slate-900">🚨 신고 조치</h2>
            <p className="text-[11px] text-slate-500 font-bold mt-0.5">
              타겟: {group.targetType}/{group.targetId.slice(0, 20)}... (고유 신고자 {group.uniqueReporters.size}명)
            </p>
          </div>
          <button onClick={onClose} disabled={busy} className="text-slate-400 hover:text-slate-600 text-[14px] font-bold disabled:opacity-50">✕</button>
        </div>
        <div className="px-5 py-4 space-y-3 max-h-[60vh] overflow-y-auto">
          <div>
            <p className="text-[11px] font-[1000] text-slate-700 mb-2">조치 선택</p>
            <div className="space-y-1.5">
              {RESOLVE_ACTIONS.map(a => (
                <label key={a.key}
                  className={`flex items-start gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                    action === a.key ? `bg-${a.color}-50 border border-${a.color}-200` : 'bg-slate-50 border border-slate-100 hover:bg-slate-100'
                  }`}>
                  <input type="radio" name="act" checked={action === a.key} onChange={() => setAction(a.key)}
                    className="mt-0.5 w-3.5 h-3.5 accent-rose-500 cursor-pointer" />
                  <div className="flex-1">
                    <p className={`text-[12px] ${action === a.key ? 'font-[1000] text-slate-800' : 'font-bold text-slate-700'}`}>{a.label}</p>
                    <p className="text-[10px] font-bold text-slate-500 mt-0.5">{a.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[11px] font-[1000] text-slate-700 mb-1.5">사유 <span className="text-rose-500">*</span> (admin_actions 기록용, 2자 이상)</p>
            <textarea value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="조치 사유를 구체적으로..." maxLength={300} rows={3}
              className="w-full px-3 py-2 text-[12px] border border-slate-200 rounded-lg resize-none focus:outline-none focus:border-rose-300 font-medium text-slate-900 placeholder:text-slate-300" />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={notifyParticipants} onChange={(e) => setNotifyParticipants(e.target.checked)}
              className="w-3.5 h-3.5 accent-rose-500 cursor-pointer" />
            <span className="text-[11px] font-bold text-slate-600">신고자들에게 처리 결과 알림 발송</span>
          </label>
        </div>
        <div className="px-5 py-3 border-t border-slate-100 flex gap-2 justify-end">
          <button onClick={onClose} disabled={busy}
            className="px-4 py-2 rounded-lg text-[12px] font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-50">취소</button>
          <button onClick={submit} disabled={busy}
            className="px-4 py-2 rounded-lg text-[12px] font-[1000] text-white bg-rose-500 hover:bg-rose-600 disabled:opacity-50">
            {busy ? '처리 중...' : '조치 실행'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReportManagement;
