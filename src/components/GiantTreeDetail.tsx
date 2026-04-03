// src/components/GiantTreeDetail.tsx — 거대 나무 상세 뷰 + 전파 참여 폼 (Phase 2)
import { useState, useEffect } from 'react';
import { db } from '../firebase';
import {
  collection, doc, setDoc, getDoc, updateDoc, increment,
  onSnapshot, query, orderBy
} from 'firebase/firestore';
import type { GiantTree, GiantTreeNode, UserData } from '../types';
import GiantTreeMap from './GiantTreeMap';

interface Props {
  tree: GiantTree;
  currentNickname?: string;
  currentUserData?: UserData | null;
  allUsers?: Record<string, UserData>;
  parentNodeId?: string | null;  // 🚀 전파 URL에서 넘어온 부모 노드 ID (다단계 depth)
  onBack: () => void;
}

// 🚀 서킷 브레이커: 10노드 이상 + 반대 비율 70% 이상 시 전파 중단
const shouldBreakCircuit = (agree: number, oppose: number): boolean => {
  const total = agree + oppose;
  return total >= 10 && (oppose / total) >= 0.7;
};

const GiantTreeDetail = ({ tree, currentNickname, currentUserData, allUsers = {}, parentNodeId, onBack }: Props) => {
  const [nodes, setNodes] = useState<GiantTreeNode[]>([]);
  const [hasParticipated, setHasParticipated] = useState(false);
  const [isAuthor, setIsAuthor] = useState(false);
  const [parentNodeDepth, setParentNodeDepth] = useState<number | null>(null);

  // 전파 참여 폼 상태
  const [selectedSide, setSelectedSide] = useState<'agree' | 'oppose' | null>(null);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 참여 완료 후 공유 URL 상태
  const [myNodeId, setMyNodeId] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // 🚀 Phase 3: 하단 탭 (참여자 목록 / 나무 지도)
  const [bottomTab, setBottomTab] = useState<'list' | 'map'>('list');

  // 🚀 노드 목록 실시간 구독
  useEffect(() => {
    const q = query(collection(db, 'giant_trees', tree.id, 'nodes'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, snap => {
      setNodes(snap.docs.map(d => ({ id: d.id, ...d.data() } as GiantTreeNode)));
    });
    return () => unsub();
  }, [tree.id]);

  // 🚀 중복 참여 여부 + 작성자 여부 + 부모 노드 depth 확인
  useEffect(() => {
    if (!currentUserData?.uid) return;
    setIsAuthor(tree.author_id === currentUserData.uid);

    // 중복 참여 확인
    getDoc(doc(db, 'giant_trees', tree.id, 'participants', currentUserData.uid)).then(snap => {
      if (snap.exists()) {
        setHasParticipated(true);
        // 이미 참여했다면 내 노드 ID 복원 (전파 URL 재표시용)
        const myNode = nodes.find(n => n.participantId === currentUserData.uid);
        if (myNode) setMyNodeId(myNode.id);
      }
    });

    // 부모 노드 depth 확인 (다단계 전파 depth 산정용)
    if (parentNodeId) {
      getDoc(doc(db, 'giant_trees', tree.id, 'nodes', parentNodeId)).then(snap => {
        if (snap.exists()) setParentNodeDepth((snap.data() as GiantTreeNode).depth);
      });
    }
  }, [tree.id, tree.author_id, currentUserData?.uid, parentNodeId, nodes]);

  const handleParticipate = async () => {
    if (!currentNickname || !currentUserData?.uid || !selectedSide || !comment.trim()) return;
    if (hasParticipated || isAuthor) return;

    setIsSubmitting(true);
    try {
      const nodeId = `node_${Date.now()}_${currentUserData.uid}`;
      // 🚀 다단계 depth: 부모 노드 depth + 1, 부모 없으면 depth=1
      const depth = parentNodeDepth !== null ? parentNodeDepth + 1 : 1;

      // 1. 노드 문서 생성
      await setDoc(doc(db, 'giant_trees', tree.id, 'nodes', nodeId), {
        depth,
        parentNodeId: parentNodeId || null,
        participantNick: currentNickname,
        participantId: currentUserData.uid,
        side: selectedSide,
        comment: comment.trim(),
        childCount: 0,
        createdAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
      });

      // 2. 부모 노드의 childCount 증가
      if (parentNodeId) {
        await updateDoc(doc(db, 'giant_trees', tree.id, 'nodes', parentNodeId), {
          childCount: increment(1),
        });
      }

      // 3. 중복 참여 차단용 participants 문서
      await setDoc(doc(db, 'giant_trees', tree.id, 'participants', currentUserData.uid), {
        joinedAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
      });

      // 4. 루트 트리 집계 업데이트 + 서킷 브레이커 판정
      const newAgree = tree.agreeCount + (selectedSide === 'agree' ? 1 : 0);
      const newOppose = tree.opposeCount + (selectedSide === 'oppose' ? 1 : 0);
      await updateDoc(doc(db, 'giant_trees', tree.id), {
        totalNodes: increment(1),
        agreeCount: selectedSide === 'agree' ? increment(1) : tree.agreeCount,
        opposeCount: selectedSide === 'oppose' ? increment(1) : tree.opposeCount,
        ...(shouldBreakCircuit(newAgree, newOppose) ? { circuitBroken: true } : {}),
      });

      setHasParticipated(true);
      setMyNodeId(nodeId);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 🚀 전파 URL 복사 — 내 노드 ID를 부모로 지정하는 링크 생성
  const handleCopySpreadUrl = () => {
    if (!myNodeId) return;
    const url = `${window.location.origin}/?tree=${tree.id}&node=${myNodeId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    });
  };

  const formatTime = (ts: { seconds: number } | null | undefined) => {
    if (!ts) return '';
    const diff = Math.floor((Date.now() - ts.seconds * 1000) / 60000);
    if (diff < 1) return '방금';
    if (diff < 60) return `${diff}분 전`;
    if (diff < 1440) return `${Math.floor(diff / 60)}시간 전`;
    return new Date(ts.seconds * 1000).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' });
  };

  const totalVotes = tree.agreeCount + tree.opposeCount;
  const agreeRatio = totalVotes > 0 ? Math.round((tree.agreeCount / totalVotes) * 100) : 0;
  const isFull = tree.totalNodes >= tree.maxSpread;

  // 현재 depth 안내 텍스트 (전파 URL로 진입했을 때)
  const depthLabel = parentNodeId
    ? `${(parentNodeDepth ?? 0) + 1}차 전파`
    : '1차 전파';

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-6 animate-in fade-in duration-500">
      {/* 뒤로가기 */}
      <button onClick={onBack} className="flex items-center gap-1 text-[11px] font-black text-slate-400 hover:text-slate-700 mb-4 transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"/></svg>
        목록으로
      </button>

      {/* 서킷 브레이커 경고 */}
      {tree.circuitBroken && (
        <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <span>⚠️</span>
          <p className="text-[12px] font-bold text-red-600">이 주장은 다수의 반대로 전파가 중단되었습니다.</p>
        </div>
      )}

      {/* 전파 URL로 진입한 경우 안내 배지 */}
      {parentNodeId && !hasParticipated && (
        <div className="mb-4 flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
          <span className="text-[13px]">🌿</span>
          <p className="text-[12px] font-bold text-emerald-700">
            누군가의 전파를 통해 이 주장에 초대되었습니다. ({depthLabel})
          </p>
        </div>
      )}

      {/* 글 본문 */}
      <div className="bg-white border border-slate-100 rounded-2xl p-5 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full overflow-hidden border border-slate-100">
            <img src={allUsers[`nickname_${tree.author}`]?.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${tree.author}`} alt="" className="w-full h-full object-cover" />
          </div>
          <div>
            <span className="text-[12px] font-black text-slate-800">{tree.author}</span>
            <span className="text-[9px] font-bold text-slate-400 ml-1.5">{tree.authorReputation} · Lv {tree.authorLevel}</span>
          </div>
          <span className="ml-auto text-[9px] font-bold text-slate-300">{formatTime(tree.createdAt)}</span>
        </div>
        <h2 className="text-[17px] font-[1000] text-slate-900 mb-3 leading-snug">{tree.title}</h2>
        <p className="text-[13.5px] text-slate-600 font-medium leading-relaxed whitespace-pre-line">{tree.content}</p>
      </div>

      {/* 전파 현황 */}
      <div className="bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">전파 현황</span>
          <span className="text-[11px] font-black text-slate-700">{tree.totalNodes} / {tree.maxSpread}명</span>
        </div>
        <div className="bg-slate-200 rounded-full h-2 mb-3 overflow-hidden">
          <div className="h-full bg-emerald-400 rounded-full transition-all duration-500"
            style={{ width: `${Math.min((tree.totalNodes / tree.maxSpread) * 100, 100)}%` }} />
        </div>
        {totalVotes > 0 && (
          <div className="flex rounded-full h-1.5 overflow-hidden mb-2">
            <div className="bg-blue-400 transition-all" style={{ width: `${agreeRatio}%` }} />
            <div className="bg-rose-400 transition-all" style={{ width: `${100 - agreeRatio}%` }} />
          </div>
        )}
        <div className="flex justify-between text-[10px] font-bold">
          <span className="text-blue-500">공감 {tree.agreeCount}명 ({agreeRatio}%)</span>
          <span className="text-rose-500">반대 {tree.opposeCount}명 ({100 - agreeRatio}%)</span>
        </div>
      </div>

      {/* 전파 참여 폼 / 상태 */}
      {!currentNickname ? (
        <div className="flex items-center gap-2 px-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-[13px] font-bold text-slate-400 mb-4">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
          전파에 참여하려면 로그인이 필요합니다.
        </div>
      ) : isAuthor ? (
        <div className="px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-[12px] font-bold text-slate-400 mb-4 text-center">
          내가 심은 나무입니다. 다른 사람이 전파에 참여합니다.
        </div>
      ) : (hasParticipated || myNodeId) ? (
        /* 참여 완료 — 전파 URL 공유 블록 */
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"/></svg>
            <p className="text-[13px] font-black text-emerald-700">전파에 참여했습니다!</p>
          </div>
          <p className="text-[11px] font-bold text-emerald-600 mb-2">아래 링크를 공유하면, 친구들이 이 주장을 이어서 전파할 수 있습니다.</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-white border border-emerald-200 rounded-xl px-3 py-2 text-[11px] font-bold text-slate-500 truncate">
              {`${window.location.origin}/?tree=${tree.id}&node=${myNodeId}`}
            </div>
            <button
              onClick={handleCopySpreadUrl}
              className={`shrink-0 px-3 py-2 text-[11px] font-[1000] rounded-xl transition-all ${copiedUrl ? 'bg-emerald-500 text-white' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
            >
              {copiedUrl ? '복사됨!' : '링크 복사'}
            </button>
          </div>
        </div>
      ) : tree.circuitBroken ? null : isFull ? (
        <div className="px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-[12px] font-bold text-slate-400 mb-4 text-center">
          최대 전파 인원에 도달했습니다.
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-4">
          <p className="text-[12px] font-black text-slate-600 mb-3">
            이 주장에 대한 의견을 남기고 전파하세요
            {parentNodeId && <span className="ml-1.5 text-[10px] font-bold text-emerald-500 bg-emerald-50 px-1.5 py-0.5 rounded-md">{depthLabel}</span>}
          </p>
          <div className="flex gap-2 mb-3">
            <button onClick={() => setSelectedSide('agree')}
              className={`flex-1 py-2.5 rounded-xl text-[12px] font-[1000] border transition-all ${selectedSide === 'agree' ? 'bg-blue-500 text-white border-blue-500' : 'bg-blue-50 text-blue-500 border-blue-100 hover:bg-blue-100'}`}>
              👍 공감해요
            </button>
            <button onClick={() => setSelectedSide('oppose')}
              className={`flex-1 py-2.5 rounded-xl text-[12px] font-[1000] border transition-all ${selectedSide === 'oppose' ? 'bg-rose-500 text-white border-rose-500' : 'bg-rose-50 text-rose-500 border-rose-100 hover:bg-rose-100'}`}>
              👎 반대해요
            </button>
          </div>
          {selectedSide && (
            <div className="mb-3">
              <textarea autoFocus value={comment} onChange={e => setComment(e.target.value.slice(0, 100))}
                placeholder={selectedSide === 'agree' ? '공감하는 이유를 짧게 적어주세요 (최대 100자)' : '반대하는 이유를 짧게 적어주세요 (최대 100자)'}
                rows={2}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-[13px] font-medium text-slate-700 outline-none focus:border-emerald-400 resize-none placeholder:text-slate-300" />
              <span className="text-[10px] font-bold text-slate-300 float-right">{comment.length}/100</span>
            </div>
          )}
          <button onClick={handleParticipate} disabled={isSubmitting || !selectedSide || !comment.trim()}
            className="w-full py-2.5 text-[13px] font-[1000] bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-40 transition-colors clear-both">
            {isSubmitting ? '참여 중...' : '🌿 전파 참여하기'}
          </button>
        </div>
      )}

      {/* 🚀 Phase 3: 하단 탭 — 참여자 목록 / 나무 지도 */}
      <div>
        <div className="flex items-center gap-1 mb-4 border-b border-slate-100 pb-0">
          <button
            onClick={() => setBottomTab('list')}
            className={`px-3 py-2 text-[12px] font-[1000] rounded-t-lg transition-colors border-b-2 -mb-px ${bottomTab === 'list' ? 'text-emerald-700 border-emerald-500' : 'text-slate-400 border-transparent hover:text-slate-600'}`}
          >
            참여자 {nodes.length}명
          </button>
          <button
            onClick={() => setBottomTab('map')}
            className={`px-3 py-2 text-[12px] font-[1000] rounded-t-lg transition-colors border-b-2 -mb-px ${bottomTab === 'map' ? 'text-emerald-700 border-emerald-500' : 'text-slate-400 border-transparent hover:text-slate-600'}`}
          >
            🌳 나무 지도
          </button>
        </div>

        {/* 나무 지도 탭 */}
        {bottomTab === 'map' && (
          <GiantTreeMap tree={tree} nodes={nodes} allUsers={allUsers} />
        )}

        {/* 참여자 목록 탭 */}
        {bottomTab === 'list' && (nodes.length === 0 ? (
          <p className="text-center text-slate-300 font-bold text-xs py-6">아직 참여자가 없습니다.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {nodes.map(node => {
              const authorData = allUsers[`nickname_${node.participantNick}`];
              const isMyNode = node.participantId === currentUserData?.uid;
              return (
                <div key={node.id}
                  className={`flex items-start gap-3 px-4 py-3 rounded-xl border transition-all ${isMyNode ? 'ring-1 ring-emerald-300' : ''} ${node.side === 'agree' ? 'bg-blue-50 border-blue-100' : 'bg-rose-50 border-rose-100'}`}>
                  <div className="w-7 h-7 rounded-full overflow-hidden border border-slate-200 shrink-0 mt-0.5">
                    <img src={authorData?.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${node.participantNick}`} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-[12px] font-black text-slate-800">{node.participantNick}</span>
                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${node.side === 'agree' ? 'bg-blue-100 text-blue-600' : 'bg-rose-100 text-rose-600'}`}>
                        {node.side === 'agree' ? '👍 공감' : '👎 반대'}
                      </span>
                      {node.depth > 1 && <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md">{node.depth}차 전파</span>}
                      {node.childCount > 0 && <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md">→ {node.childCount}명 전파</span>}
                      {isMyNode && <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md">나</span>}
                      <span className="text-[9px] font-bold text-slate-300 ml-auto">{formatTime(node.createdAt)}</span>
                    </div>
                    <p className="text-[12.5px] font-medium text-slate-600 leading-relaxed">{node.comment}</p>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

export default GiantTreeDetail;
