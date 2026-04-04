// src/components/GiantTreeView.tsx — 거대 나무 목록 뷰
import { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import type { GiantTree, UserData } from '../types';
import { getReputationLabel, getReputationScore } from '../utils';
import CreateGiantTree from './CreateGiantTree';
import GiantTreeDetail from './GiantTreeDetail';

// 🚀 평판 등급 → 최대 전파 인원 매핑 (초기 개발 규모)
export const MAX_SPREAD_BY_REPUTATION: Record<string, number> = {
  '확고':     100,
  '우호':     30,
  '약간 우호': 10,
  '중립':     0,   // 중립은 전파 불가
};

// 🚀 나무 성장 단계 — 진행률 기반 6단계
const getGrowthStage = (current: number, max: number) => {
  const pct = max > 0 ? Math.min((current / max) * 100, 100) : 0;
  if (pct >= 100) return { emoji: '🌳', label: '거대 나무', color: 'bg-amber-400', textColor: 'text-amber-600', borderColor: 'border-amber-300' };
  if (pct >= 80)  return { emoji: '🌳', label: '큰 나무',   color: 'bg-teal-400',    textColor: 'text-teal-600',    borderColor: 'border-teal-200' };
  if (pct >= 60)  return { emoji: '🌲', label: '중간 나무', color: 'bg-emerald-400',  textColor: 'text-emerald-600',  borderColor: 'border-emerald-200' };
  if (pct >= 40)  return { emoji: '🌿', label: '어린 나무', color: 'bg-green-400',    textColor: 'text-green-600',    borderColor: 'border-green-200' };
  if (pct >= 20)  return { emoji: '🌱', label: '새싹',     color: 'bg-lime-400',     textColor: 'text-lime-600',     borderColor: 'border-lime-200' };
  return                  { emoji: '🌰', label: '씨앗',     color: 'bg-slate-300',    textColor: 'text-slate-500',    borderColor: 'border-slate-200' };
};

// 🚀 평판 등급 → 동시 활성 나무 수 제한
// Why: 남용 방지. 기존 나무가 거대 나무(전파 완료)되어야 다음 나무 심기 가능.
const MAX_ACTIVE_TREES: Record<string, number> = {
  '확고':     3,
  '우호':     2,
  '약간 우호': 1,
  '중립':     0,
};

interface Props {
  currentNickname?: string;
  currentUserData?: UserData | null;
  allUsers?: Record<string, UserData>;
  initialTreeId?: string;       // 🚀 ?tree= URL 파라미터 — 해당 트리 자동 오픈
  initialParentNodeId?: string; // 🚀 ?node= URL 파라미터 — 전파 참여 시 부모 노드
}

const GiantTreeView = ({ currentNickname, currentUserData, allUsers = {}, initialTreeId, initialParentNodeId }: Props) => {
  const [trees, setTrees] = useState<GiantTree[]>([]);
  const [view, setView] = useState<'list' | 'create' | 'detail'>('list');
  const [selectedTree, setSelectedTree] = useState<GiantTree | null>(null);
  // 🚀 전파 URL로 진입한 경우 부모 노드 ID 보존 — GiantTreeDetail에 전달
  const [activeParentNodeId, setActiveParentNodeId] = useState<string | null>(initialParentNodeId || null);
  // 🚀 나무 심기 직후 상세 뷰 자동 이동 — 생성된 treeId 임시 보관
  const [justCreatedId, setJustCreatedId] = useState<string | null>(null);

  // 🚀 giant_trees 컬렉션 실시간 구독 (최신순 20개)
  useEffect(() => {
    const q = query(collection(db, 'giant_trees'), orderBy('createdAt', 'desc'), limit(20));
    const unsub = onSnapshot(q, snap => {
      const loaded = snap.docs.map(d => ({ id: d.id, ...d.data() } as GiantTree));
      setTrees(loaded);

      // 🚀 initialTreeId가 있으면 목록 로드 후 해당 트리 자동 선택
      if (initialTreeId && view === 'list') {
        const target = loaded.find(t => t.id === initialTreeId);
        if (target) { setSelectedTree(target); setView('detail'); }
      }

      // 🚀 나무 심기 직후: Firestore에 트리가 나타나면 즉시 상세 뷰로 이동
      if (justCreatedId) {
        const target = loaded.find(t => t.id === justCreatedId);
        if (target) { setSelectedTree(target); setJustCreatedId(null); setView('detail'); }
      }
    });
    return () => unsub();
  // initialTreeId는 마운트 시 1회만 처리 — deps에서 제외
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatTime = (ts: { seconds: number } | null | undefined) => {
    if (!ts) return '';
    const diff = Math.floor((Date.now() - ts.seconds * 1000) / 60000);
    if (diff < 1) return '방금';
    if (diff < 60) return `${diff}분 전`;
    if (diff < 1440) return `${Math.floor(diff / 60)}시간 전`;
    return new Date(ts.seconds * 1000).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' });
  };

  // 🚀 useMemo: 나무 심기 권한 상태
  const plantStatus = useMemo(() => {
    const rep = getReputationLabel(currentUserData ? getReputationScore(currentUserData) : 0);
    const maxActive = MAX_ACTIVE_TREES[rep] || 0;
    const myActiveTrees = trees.filter(t =>
      t.author_id === currentUserData?.uid && !(t.totalNodes >= t.maxSpread) && !t.circuitBroken
    ).length;
    return { rep, maxActive, canPlant: maxActive > 0 && myActiveTrees < maxActive, maxSpread: MAX_SPREAD_BY_REPUTATION[rep] || 0 };
  }, [currentUserData, trees]);

  // 🚀 useMemo: 목록 분리 (자라는 나무 vs 거대 나무)
  const growingTrees = useMemo(() => trees.filter(t => !(t.totalNodes >= t.maxSpread && !t.circuitBroken)), [trees]);
  const giantTrees = useMemo(() => trees.filter(t => t.totalNodes >= t.maxSpread && !t.circuitBroken), [trees]);

  if (view === 'create') {
    return (
      <CreateGiantTree
        currentNickname={currentNickname}
        currentUserData={currentUserData}
        onBack={() => setView('list')}
        onCreated={(treeId) => { setJustCreatedId(treeId); setView('list'); }}
      />
    );
  }

  if (view === 'detail' && selectedTree) {
    return (
      <GiantTreeDetail
        tree={selectedTree}
        currentNickname={currentNickname}
        currentUserData={currentUserData}
        allUsers={allUsers}
        parentNodeId={activeParentNodeId}
        onBack={() => { setView('list'); setSelectedTree(null); setActiveParentNodeId(null); }}
      />
    );
  }

  return (
    <div className="w-full animate-in fade-in duration-500">
      {/* 🚀 헤더: CategoryHeader와 동일 스타일 — 전체 너비 좌측 정렬 */}
      <div className="sticky top-0 z-30 bg-[#F8FAFC]/80 backdrop-blur-md pt-2">
        <div className="flex items-center border-b border-slate-200 h-[36px] px-4">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-blue-600 font-black text-[15px]">#</span>
              <h2 className="text-[14px] font-[1000] text-slate-900 tracking-tighter whitespace-nowrap">거대 나무</h2>
            </div>
            <div className="w-px h-3 bg-slate-200 shrink-0 mx-1" />
            <p className="text-[12px] font-bold text-slate-500 truncate tracking-tight break-keep">
              할말 있소!!! 자신의 주장을 다단계 형태로 전파
            </p>
            {currentNickname && (
              <>
                <div className="w-px h-3 bg-slate-200 shrink-0 mx-1" />
                {plantStatus.canPlant ? (
                  <button
                    onClick={() => setView('create')}
                    className="flex items-center gap-0.5 text-[11px] font-bold text-slate-400 hover:text-blue-500 transition-colors shrink-0 whitespace-nowrap"
                  >
                    <span className="text-[10px]">+</span>나무 심기
                  </button>
                ) : plantStatus.maxActive === 0 ? (
                  <span className="text-[10px] font-bold text-slate-300 shrink-0 whitespace-nowrap">평판 약간 우호 이상 필요</span>
                ) : (
                  <span className="text-[10px] font-bold text-amber-400 shrink-0 whitespace-nowrap">심은 나무가 거대 나무가 되어야 다시 심기 가능</span>
                )}
              </>
            )}
          </div>
        </div>
        <div className="h-3" />
      </div>

      {/* 🚀 메인 컨텐츠 */}
      {(() => {
        const renderTreeCard = (tree: GiantTree) => {
          const authorData = allUsers[`nickname_${tree.author}`];
          const totalVotes = tree.agreeCount + tree.opposeCount;
          const agreeRatio = totalVotes > 0 ? Math.round((tree.agreeCount / totalVotes) * 100) : 0;
          const pct = tree.maxSpread > 0 ? Math.min((tree.totalNodes / tree.maxSpread) * 100, 100) : 0;
          const stage = getGrowthStage(tree.totalNodes, tree.maxSpread);
          const isBroken = tree.circuitBroken;

          return (
            <button
              key={tree.id}
              onClick={() => { setSelectedTree(tree); setActiveParentNodeId(null); setView('detail'); }}
              className="w-full text-left bg-white border border-slate-100 rounded-2xl p-4 hover:border-emerald-200 hover:shadow-sm transition-all"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full overflow-hidden border border-slate-100">
                    <img src={authorData?.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${tree.author}`} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <span className="text-[12px] font-black text-slate-800">{tree.author}</span>
                    <span className="text-[9px] font-bold text-slate-300 ml-2">{formatTime(tree.createdAt)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {isBroken && <span className="text-[9px] font-black text-red-500 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-md">⚠️ 전파 중단</span>}
                  <span className={`text-[9px] font-black ${stage.textColor} bg-white border ${stage.borderColor} px-1.5 py-0.5 rounded-md`}>
                    {stage.emoji} {stage.label}
                  </span>
                  <span className="text-[9px] font-bold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded-md">{tree.authorReputation} · 최대 {tree.maxSpread}명</span>
                </div>
              </div>
              <h3 className="text-[14px] font-[1000] text-slate-900 leading-snug mb-2 line-clamp-2">{tree.title}</h3>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div className={`h-full ${stage.color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                </div>
                <span className="text-[10px] font-black text-slate-500 shrink-0">{tree.totalNodes} / {tree.maxSpread}명</span>
                <span className="text-[10px] font-bold text-blue-500 shrink-0">공감 {agreeRatio}%</span>
              </div>
            </button>
          );
        };

        // 🚀 사이드바 카드 — 거대 나무(전파 완료)용 (컴팩트)
        const renderGiantCard = (tree: GiantTree) => {
          const authorData = allUsers[`nickname_${tree.author}`];
          const totalVotes = tree.agreeCount + tree.opposeCount;
          const agreeRatio = totalVotes > 0 ? Math.round((tree.agreeCount / totalVotes) * 100) : 0;

          return (
            <div
              key={tree.id}
              onClick={() => { setSelectedTree(tree); setActiveParentNodeId(null); setView('detail'); }}
              className="bg-white border-b border-amber-100 cursor-pointer hover:bg-amber-50/30 transition-all group"
            >
              <div className="px-3 pt-2 pb-1">
                <h5 className="text-[11px] font-[1000] text-slate-900 line-clamp-2 leading-snug tracking-tighter group-hover:text-amber-700 transition-colors">{tree.title}</h5>
              </div>
              <div className="px-3 pb-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className="w-4 h-4 rounded-full overflow-hidden border border-slate-100 bg-slate-50 shrink-0">
                    <img src={authorData?.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${tree.author}`} alt="" className="w-full h-full object-cover" />
                  </div>
                  <span className="text-[9px] font-black text-slate-700 truncate">{tree.author}</span>
                </div>
                <div className="flex items-center gap-2 text-[8px] font-black text-slate-400 shrink-0">
                  <span>{tree.totalNodes}/{tree.maxSpread}명</span>
                  <span className="text-blue-500">공감 {agreeRatio}%</span>
                </div>
              </div>
            </div>
          );
        };

        return (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 w-full max-w-[1600px] mx-auto px-4 pb-6 items-start">
            {/* 🚀 좌측: 자라는 나무 (메인 영역) */}
            <div className="col-span-1 md:col-span-8">
              {/* 권한 안내 배너 */}
              {!currentNickname ? (
                <div className="mb-4 flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                  <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                  <span className="text-[12px] font-bold text-slate-500">나무를 심으려면 로그인과 평판이 필요합니다.</span>
                </div>
              ) : plantStatus.maxSpread === 0 ? (
                <div className="mb-4 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                  <span className="text-[14px]">🌱</span>
                  <span className="text-[12px] font-bold text-amber-700">평판 "약간 우호" 이상이면 나무를 심을 수 있어요. (현재: {plantStatus.rep})</span>
                </div>
              ) : (
                <div className="mb-4 flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">내 전파 규모:</span>
                  <span className="text-[11px] font-black text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg">{plantStatus.rep} · 최대 {plantStatus.maxSpread}명</span>
                </div>
              )}

              {/* 자라는 나무 목록 */}
              {growingTrees.length === 0 && giantTrees.length === 0 ? (
                <div className="py-16 text-center text-slate-300 font-bold text-sm">
                  아직 심어진 나무가 없습니다.<br />첫 번째 주장을 전파해보세요.
                </div>
              ) : growingTrees.length === 0 ? (
                <div className="py-10 text-center text-slate-300 font-bold text-sm">
                  현재 자라는 나무가 없습니다.
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {growingTrees.map(renderTreeCard)}
                </div>
              )}
            </div>

            {/* 🚀 우측: 거대 나무 사이드바 (전파 완료) */}
            <aside className="hidden md:block md:col-span-4 sticky top-12 bg-slate-50 rounded-xl max-h-[calc(100vh-120px)] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] border-l-2 border-amber-200">
              <div className="px-3 py-3 border-b border-amber-200">
                <h4 className="text-[13px] font-[1000] text-amber-600 tracking-tighter flex items-center gap-1.5">
                  🌳 거대 나무 <span className="text-amber-400 font-bold text-[11px]">({giantTrees.length})</span>
                  <span className="text-[9px] font-bold text-amber-400 ml-1">전파가 완료된 주장</span>
                </h4>
              </div>
              {giantTrees.length === 0 ? (
                <div className="py-10 text-center text-slate-300 font-bold text-[11px]">
                  아직 전파 완료된 거대 나무가 없어요.
                </div>
              ) : (
                <div className="flex flex-col">
                  {giantTrees.map(renderGiantCard)}
                </div>
              )}
            </aside>

            {/* 🚀 모바일: 거대 나무 하단 표시 */}
            {giantTrees.length > 0 && (
              <div className="col-span-1 md:hidden border-t border-amber-200 pt-4">
                <h4 className="text-[12px] font-[1000] text-amber-600 tracking-tighter mb-3 flex items-center gap-1.5">
                  🌳 거대 나무 <span className="text-amber-400 font-bold text-[11px]">({giantTrees.length})</span>
                </h4>
                <div className="flex flex-col gap-3">
                  {giantTrees.map(renderTreeCard)}
                </div>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
};

export default GiantTreeView;
