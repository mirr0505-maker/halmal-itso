// src/components/GiantTreeView.tsx — 거대 나무 목록 뷰
import { useState, useEffect } from 'react';
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
    <div className="w-full max-w-2xl mx-auto px-4 py-6 animate-in fade-in duration-500">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-[1000] text-slate-900 flex items-center gap-2">
            🌳 거대 나무
          </h2>
          <p className="text-[12px] font-bold text-slate-400 mt-0.5">자신의 주장을 다단계 전파 형태로 보낼 수 있는 곳</p>
        </div>
        {currentNickname && (
          <button
            onClick={() => {
              const rep = getReputationLabel(currentUserData ? getReputationScore(currentUserData) : 0);
              if (MAX_SPREAD_BY_REPUTATION[rep] === 0) {
                alert('평판 등급이 "약간 우호" 이상이어야 거대 나무를 심을 수 있습니다.');
                return;
              }
              setView('create');
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-[12px] font-[1000] rounded-xl hover:bg-emerald-700 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"/></svg>
            나무 심기
          </button>
        )}
      </div>

      {/* 전파 규모 안내 배지 */}
      {currentNickname && (
        <div className="mb-4 flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">내 전파 규모:</span>
          {(() => {
            const rep = getReputationLabel(currentUserData ? getReputationScore(currentUserData) : 0);
            const max = MAX_SPREAD_BY_REPUTATION[rep] || 0;
            return max > 0
              ? <span className="text-[11px] font-black text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg">{rep} · 최대 {max}명</span>
              : <span className="text-[11px] font-bold text-slate-400 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-lg">중립 · 전파 불가 (약간 우호 이상 필요)</span>;
          })()}
        </div>
      )}

      {/* 목록 */}
      {trees.length === 0 ? (
        <div className="py-16 text-center text-slate-300 font-bold text-sm">
          아직 심어진 나무가 없습니다.<br />첫 번째 주장을 전파해보세요.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {trees.map(tree => {
            const authorData = allUsers[`nickname_${tree.author}`];
            const totalVotes = tree.agreeCount + tree.opposeCount;
            const agreeRatio = totalVotes > 0 ? Math.round((tree.agreeCount / totalVotes) * 100) : 0;
            const isFull = tree.totalNodes >= tree.maxSpread;
            const isBroken = tree.circuitBroken;

            return (
              <button
                key={tree.id}
                onClick={() => { setSelectedTree(tree); setActiveParentNodeId(null); setView('detail'); }}
                className="w-full text-left bg-white border border-slate-100 rounded-2xl p-4 hover:border-emerald-200 hover:shadow-sm transition-all"
              >
                {/* 상단: 작성자 + 상태 배지 */}
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
                    {isFull && !isBroken && <span className="text-[9px] font-black text-slate-400 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded-md">전파 완료</span>}
                    {!isFull && !isBroken && <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md animate-pulse">전파 중</span>}
                    <span className="text-[9px] font-bold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded-md">{tree.authorReputation} · 최대 {tree.maxSpread}명</span>
                  </div>
                </div>

                {/* 제목 */}
                <h3 className="text-[14px] font-[1000] text-slate-900 leading-snug mb-2 line-clamp-2">{tree.title}</h3>

                {/* 하단: 전파 현황 바 */}
                <div className="flex items-center gap-3">
                  {/* 진행 바 */}
                  <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full bg-emerald-400 rounded-full transition-all"
                      style={{ width: `${Math.min((tree.totalNodes / tree.maxSpread) * 100, 100)}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-black text-slate-500 shrink-0">{tree.totalNodes} / {tree.maxSpread}명</span>
                  {/* 공감/반대 */}
                  <span className="text-[10px] font-bold text-blue-500 shrink-0">공감 {agreeRatio}%</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default GiantTreeView;
