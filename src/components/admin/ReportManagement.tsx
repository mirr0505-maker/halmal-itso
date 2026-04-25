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
import { collection, onSnapshot, query, where, orderBy, limit as qLimit, getDocs, documentId } from 'firebase/firestore';
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
  dominantReasonKey?: string;  // 🚨 그룹 내 최빈 reasonKey — 자동 숨김 임계 계산용
}

const STATUS_LABELS: Record<ReportStatus, string> = {
  pending: '⏳ 대기',
  resolved: '✅ 처리됨',
  rejected: '🚫 기각',
};

// 🚨 카테고리별 hidden threshold (functions/reportSubmit.js CATEGORY_THRESHOLDS와 동기화 필수)
//    threshold 도달 시 isHiddenByReport=true 자동 적용
//    2026-04-25 — 전체 10배 강화 (기존 수치 루즈, 소수 담합 침묵 우려)
const HIDDEN_THRESHOLDS: Record<string, number> = {
  obscene: 20,
  life_threat: 20,
  illegal_fraud_ad: 30,
  spam_flooding: 70,
  severe_abuse: 70,
  discrimination: 70,
  other: 70,
  unethical: 120,
  anti_state: 120,
};

const REASON_LABELS_KO: Record<string, string> = {
  obscene: '음란물',
  life_threat: '생명위협',
  illegal_fraud_ad: '불법사기광고',
  spam_flooding: '스팸',
  severe_abuse: '심한욕설',
  discrimination: '차별',
  unethical: '비윤리',
  anti_state: '반국가',
  other: '기타',
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
  const [nicknameMap, setNicknameMap] = useState<Record<string, { nickname: string; level?: number }>>({});
  const [reasonFilter, setReasonFilter] = useState<string>('all');  // 🚨 reasonKey 필터 ('all' or 9 카테고리)
  const [showFlow, setShowFlow] = useState(false);  // 📌 플로우 박스 접고/펼치기

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
    const reasonCountMap = new Map<string, Record<string, number>>();
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
        reasonCountMap.set(key, {});
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
      // 🚨 reasonKey 최빈치 누적 — 자동 숨김 임계 표시용
      const rcm = reasonCountMap.get(key)!;
      const rk = r.reasonKey || 'other';
      rcm[rk] = (rcm[rk] || 0) + 1;
    }
    // 그룹별 dominantReasonKey 채우기 (최빈 reasonKey 1개 선정)
    for (const [key, g] of map.entries()) {
      const rcm = reasonCountMap.get(key) || {};
      let dominant = 'other';
      let maxCnt = 0;
      for (const [rk, cnt] of Object.entries(rcm)) {
        if (cnt > maxCnt) { dominant = rk; maxCnt = cnt; }
      }
      g.dominantReasonKey = dominant;
    }
    return [...map.values()].sort((a, b) => b.uniqueReporters.size - a.uniqueReporters.size);
  }, [reports]);

  // 🚨 reasonKey 필터 적용 (클라 측 필터 — 인덱스 추가 불필요)
  const filteredGroups = useMemo<TargetGroup[]>(() => {
    if (reasonFilter === 'all') return groups;
    return groups.filter(g => g.dominantReasonKey === reasonFilter);
  }, [groups, reasonFilter]);

  // 🚨 작성자 + 신고자 닉네임 일괄 조회 (휴먼 가독성) — 새 uid만 fetch (10개씩 in 쿼리 분할)
  //    Why: 작성자(targetUid)뿐 아니라 누가 신고했는지(reporterUid)도 카드에 표시 → 패턴 식별 용이
  useEffect(() => {
    const targetUids = groups.map(g => g.targetUid).filter(Boolean);
    const reporterUids = groups.flatMap(g => g.reports.map(r => r.reporterUid).filter(Boolean));
    const uids = Array.from(new Set([...targetUids, ...reporterUids]));
    const missing = uids.filter(u => !nicknameMap[u]);
    if (missing.length === 0) return;
    let cancelled = false;
    (async () => {
      const result: Record<string, { nickname: string; level?: number }> = {};
      for (let i = 0; i < missing.length; i += 10) {
        const slice = missing.slice(i, i + 10);
        try {
          const snap = await getDocs(query(collection(db, 'users'), where(documentId(), 'in', slice)));
          snap.docs.forEach(d => {
            const data = d.data() as { nickname?: string; level?: number };
            result[d.id] = { nickname: data.nickname || '(이름 없음)', level: data.level };
          });
        } catch (err) {
          console.error('[ReportManagement] nickname fetch failed', err);
        }
      }
      if (!cancelled && Object.keys(result).length > 0) {
        setNicknameMap(prev => ({ ...prev, ...result }));
      }
    })();
    return () => { cancelled = true; };
    // nicknameMap은 의존성 제외 — 캐시 재사용 + 무한 루프 방지
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups]);

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

  // 🚀 우선큐 전용: 이의제기 인용 (= 글 복구)
  //    appeals.collection('posts'|'community_posts') → restoreHiddenPost CF에 보낼 targetType 변환
  const handleAppealAccept = async (a: AppealItem) => {
    const note = window.prompt('이의제기 인용 사유 (= 복구 사유, 2자+) — 작성자에게 알림 발송', '');
    if (!note || note.trim().length < 2) return;
    const targetType = a.collection === 'community_posts' ? 'community_post' : 'post';
    setBusyReportId(a.id);
    try {
      const fn = httpsCallable(functions, 'restoreHiddenPost');
      const res = await fn({ targetType, targetId: a.id, note: note.trim() });
      const data = res.data as { success: boolean; bulkRejectedCount: number };
      alert(`이의제기 인용 완료 — 글 복구 + ${data.bulkRejectedCount}건 pending 신고 기각`);
    } catch (err) {
      console.error('[restoreHiddenPost via appeal]', err);
      alert('인용 실패: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setBusyReportId(null);
    }
  };

  // 🚀 우선큐 전용: 이의제기 기각 (글 hidden 유지, appealStatus만 resolved)
  const handleAppealReject = async (a: AppealItem) => {
    const note = window.prompt('이의제기 기각 사유 (2자+) — 작성자에게 알림 발송, 글은 숨김 유지', '');
    if (!note || note.trim().length < 2) return;
    const targetType = a.collection === 'community_posts' ? 'community_post' : 'post';
    setBusyReportId(a.id);
    try {
      const fn = httpsCallable(functions, 'rejectAppeal');
      await fn({ targetType, targetId: a.id, note: note.trim() });
      alert('이의제기 기각 완료 — 작성자에게 알림 발송됨');
    } catch (err) {
      console.error('[rejectAppeal]', err);
      alert('기각 실패: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setBusyReportId(null);
    }
  };

  return (
    <div>
      <div className="mb-3">
        <h2 className="text-[16px] font-[1000] text-slate-800">🚨 신고 관리</h2>
        <p className="text-[11px] font-bold text-slate-500 mt-0.5">
          카테고리별 차등 threshold. 한번 올라간 상태는 관리자 복구만 가능. 작성자 이의제기는 우선큐에 표시.
        </p>
      </div>

      {/* 📌 신고 처리 플로우 — 헤더 직후 토글 (스크롤 없이 접근, 평소엔 접힘) */}
      <div className="mb-3">
        <button onClick={() => setShowFlow(v => !v)}
          className="text-[11px] font-[1000] text-slate-500 hover:text-slate-700 flex items-center gap-1.5 px-2 py-1 rounded hover:bg-slate-100 transition-colors">
          <span>📌 신고 처리 플로우</span>
          <span className="text-slate-400 text-[9px]">{showFlow ? '▲ 닫기' : '▼ 보기'}</span>
        </button>
        {showFlow && (
          <div className="mt-2 p-3 border border-slate-200 bg-slate-50 rounded-lg">
            <div className="flex items-center justify-between gap-1 text-[10px] font-bold text-slate-600 mb-2 flex-wrap">
              <span className="flex-1 min-w-[80px] text-center bg-white px-2 py-1 rounded">① 신고 접수<br/><span className="text-slate-400 font-normal">9 카테고리</span></span>
              <span className="text-slate-300">→</span>
              <span className="flex-1 min-w-[80px] text-center bg-white px-2 py-1 rounded">② 자동 검토<br/><span className="text-slate-400 font-normal">고유 신고자 수</span></span>
              <span className="text-slate-300">→</span>
              <span className="flex-1 min-w-[80px] text-center bg-white px-2 py-1 rounded">③ 관리자 조치<br/><span className="text-slate-400 font-normal">숨김/삭제/경고/기각</span></span>
              <span className="text-slate-300">→</span>
              <span className="flex-1 min-w-[80px] text-center bg-white px-2 py-1 rounded">④ 작성자 이의제기<br/><span className="text-slate-400 font-normal">선택 사항</span></span>
              <span className="text-slate-300">→</span>
              <span className="flex-1 min-w-[80px] text-center bg-white px-2 py-1 rounded">⑤ 복구 / 유지<br/><span className="text-slate-400 font-normal">관리자 최종</span></span>
            </div>
            <p className="text-[10px] font-bold text-slate-500 leading-relaxed">
              💡 <span className="text-slate-700">자동 숨김 임계</span>는 카테고리별 차등 — 음란물·생명위협 <strong>20명</strong> / 불법사기광고 <strong>30명</strong> / 스팸·심한욕설·차별·기타 <strong>70명</strong> / 비윤리·반국가 <strong>120명</strong>. threshold 도달 시 isHiddenByReport=true 자동 적용 → 작성자가 이의제기로 복구 요청 가능.
            </p>
          </div>
        )}
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
                {/* 🚀 우선큐 직접 처리 — [✅ 인용] / [🚫 기각] */}
                <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                  <button onClick={() => handleAppealAccept(a)}
                    disabled={busyReportId === a.id}
                    className="px-2.5 py-1 rounded text-[11px] font-[1000] bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50">
                    ✅ 인용 (글 복구)
                  </button>
                  <button onClick={() => handleAppealReject(a)}
                    disabled={busyReportId === a.id}
                    className="px-2.5 py-1 rounded text-[11px] font-[1000] bg-slate-600 text-white hover:bg-slate-700 disabled:opacity-50">
                    🚫 기각 (숨김 유지)
                  </button>
                  <span className="text-[10px] font-bold text-slate-400">
                    인용 시 글 자동 복구 + 작성자 알림 · 기각 시 글 숨김 유지 + 작성자 알림
                  </span>
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

      {/* 상태 필터 탭 + 사유 카테고리 필터 (한 줄, 우측 정렬) */}
      <div className="flex gap-2 mb-4 border-b border-slate-200 items-end justify-between flex-wrap">
        <div className="flex gap-1">
          {(Object.keys(STATUS_LABELS) as ReportStatus[]).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 text-[12px] font-black transition-colors border-b-2 -mb-px ${
                statusFilter === s ? 'border-rose-500 text-rose-600' : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}>
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 pb-1.5">
          <span className="text-[10px] font-[1000] text-slate-500">사유</span>
          <select value={reasonFilter} onChange={(e) => setReasonFilter(e.target.value)}
            className="text-[11px] font-bold text-slate-700 border border-slate-200 rounded px-2 py-1 bg-white focus:outline-none focus:border-rose-300 cursor-pointer">
            <option value="all">전체</option>
            {Object.entries(REASON_LABELS_KO).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <p className="py-10 text-center text-slate-400 font-bold text-[12px]">불러오는 중...</p>
      ) : filteredGroups.length === 0 ? (
        <p className="py-10 text-center text-slate-400 font-bold text-[12px]">
          {reasonFilter !== 'all'
            ? `해당 사유 카테고리(${REASON_LABELS_KO[reasonFilter] || reasonFilter}) 신고 없음`
            : statusFilter === 'pending' ? '대기 중인 신고가 없습니다' : '해당 상태 신고 없음'}
        </p>
      ) : (
        <>
          <p className="text-[11px] font-[1000] text-slate-500 mb-2">
            타겟 {filteredGroups.length}건
            {reasonFilter !== 'all' && <span className="text-slate-400 font-bold"> · 전체 {groups.length}건 중</span>}
            <span className="text-slate-400 font-bold"> (총 {reports.length}개 신고)</span>
          </p>
          {/* 🚀 grid 2열 (큰 화면) — 카드 한 줄에 가로 너무 길게 펴지는 문제 해소 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
          {filteredGroups.map(g => {
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
                      {/* 🚨 자동 숨김 임계 진행률 (dominantReasonKey 기준) */}
                      {(() => {
                        const rk = g.dominantReasonKey || 'other';
                        const thr = HIDDEN_THRESHOLDS[rk] ?? 7;
                        const remaining = Math.max(0, thr - g.uniqueReporters.size);
                        const reasonLabel = REASON_LABELS_KO[rk] || '기타';
                        if (remaining === 0) {
                          return (
                            <span className="text-[10px] font-[1000] bg-rose-600 text-white px-1.5 py-0.5 rounded">
                              🙈 자동 숨김 임계 도달 ({reasonLabel})
                            </span>
                          );
                        }
                        return (
                          <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            자동 숨김까지 {remaining}명 ({reasonLabel} · hidden={thr})
                          </span>
                        );
                      })()}
                    </div>
                    <p className="text-[11px] font-mono text-slate-500 truncate mt-1 flex items-center gap-2">
                      <span className="truncate">targetId: {g.targetId}</span>
                      {g.targetType === 'post' ? (
                        <button onClick={() => window.open(`${window.location.origin}/?post=${encodeURIComponent(g.targetId)}`, '_blank', 'noopener,noreferrer')}
                          className="shrink-0 text-[10px] font-[1000] bg-indigo-100 text-indigo-700 hover:bg-indigo-200 px-1.5 py-0.5 rounded">
                          🔗 글 보기
                        </button>
                      ) : (
                        <button onClick={() => { navigator.clipboard?.writeText(g.targetId); alert('targetId 복사됨 — 해당 페이지에서 직접 검색하세요'); }}
                          className="shrink-0 text-[10px] font-[1000] bg-slate-100 text-slate-600 hover:bg-slate-200 px-1.5 py-0.5 rounded">
                          📋 ID 복사
                        </button>
                      )}
                    </p>
                    <p className="text-[11px] font-mono text-slate-500 truncate">
                      targetUid: {g.targetUid}
                      {nicknameMap[g.targetUid] && (
                        <span className="ml-1 not-italic font-bold text-slate-700">
                          ({nicknameMap[g.targetUid].nickname}{nicknameMap[g.targetUid].level ? ` · Lv${nicknameMap[g.targetUid].level}` : ''})
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] font-bold text-slate-600 mt-1.5">
                      최근 신고: {g.latestCreatedAt?.toLocaleString('ko-KR') || '-'}
                    </p>
                    {/* 🚨 신고자별 한 줄 — 닉네임 + uid 일부 + 사유 (패턴 식별용) */}
                    <div className="mt-1.5 space-y-0.5">
                      {g.reports.slice(0, 3).map((r) => {
                        const reporterInfo = nicknameMap[r.reporterUid];
                        return (
                          <p key={r.id} className="text-[11px] text-slate-500 bg-slate-50 px-2 py-1 rounded">
                            <span className="font-[1000] text-slate-700">
                              {reporterInfo?.nickname || '(조회 중)'}
                            </span>
                            <span className="text-slate-400 font-mono text-[10px]"> · {r.reporterUid.slice(0, 8)}…</span>
                            <span className="text-slate-400 mx-1">·</span>
                            <span>{r.reason || '(사유 없음)'}</span>
                          </p>
                        );
                      })}
                      {g.reports.length > 3 && (
                        <p className="text-[10px] font-bold text-slate-400">
                          ...외 {g.reports.length - 3}건
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {statusFilter === 'pending' && (
                  <div className="mt-2.5 flex gap-1.5 flex-wrap items-center">
                    <button onClick={() => setResolveTarget(g)} disabled={busyThis}
                      className="px-2.5 py-1 rounded text-[11px] font-bold bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-50">
                      조치 실행
                    </button>
                    <span className="text-[10px] font-bold text-slate-400">▶ 숨김 / 삭제 / 경고 / 없음 중 선택</span>
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
        </>
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
            <p className="text-[10px] text-slate-400 font-bold mt-1 leading-relaxed">
              💡 <span className="text-slate-600">숨김</span>(isHiddenByReport=true · 복구 가능) / <span className="text-slate-600">삭제</span>(isDeleted · 영구) / <span className="text-slate-600">경고</span>(컨텐츠 유지+알림) / <span className="text-slate-600">없음</span>(상태만 변경)
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
