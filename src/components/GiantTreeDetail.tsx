// src/components/GiantTreeDetail.tsx — 거대 나무 상세 뷰 + 전파 참여 폼
import { useState, useEffect } from 'react';
import { db } from '../firebase';
import {
  collection, doc, setDoc, getDoc, updateDoc, increment,
  onSnapshot, query, orderBy
} from 'firebase/firestore';
import type { GiantTree, GiantTreeNode, UserData } from '../types';

interface Props {
  tree: GiantTree;
  currentNickname?: string;
  currentUserData?: UserData | null;
  allUsers?: Record<string, UserData>;
  onBack: () => void;
}

// 🚀 서킷 브레이커 판정: 전체 노드 10개 이상이고 반대 비율 70% 이상
const checkCircuitBreaker = (agreeCount: number, opposeCount: number): boolean => {
  const total = agreeCount + opposeCount;
  if (total < 10) return false;
  return (opposeCount / total) >= 0.7;
};

const GiantTreeDetail = ({ tree, currentNickname, currentUserData, allUsers = {}, onBack }: Props) => {
  const [nodes, setNodes] = useState<GiantTreeNode[]>([]);
  const [hasParticipated, setHasParticipated] = useState(false);
  const [isAuthor, setIsAuthor] = useState(false);

  // 전파 참여 폼 상태
  const [selectedSide, setSelectedSide] = useState<'agree' | 'oppose' | null>(null);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // 🚀 노드 목록 실시간 구독
  useEffect(() => {
    const q = query(
      collection(db, 'giant_trees', tree.id, 'nodes'),
      orderBy('createdAt', 'asc')
    );
    const unsub = onSnapshot(q, snap => {
      setNodes(snap.docs.map(d => ({ id: d.id, ...d.data() } as GiantTreeNode)));
    });
    return () => unsub();
  }, [tree.id]);

  // 🚀 중복 참여 여부 + 작성자 여부 확인
  useEffect(() => {
    if (!currentUserData?.uid) return;
    setIsAuthor(tree.author_id === currentUserData.uid);

    const checkParticipation = async () => {
      const partRef = doc(db, 'giant_trees', tree.id, 'participants', currentUserData.uid);
      const snap = await getDoc(partRef);
      setHasParticipated(snap.exists());
    };
    checkParticipation();
  }, [tree.id, tree.author_id, currentUserData?.uid]);

  const handleParticipate = async () => {
    if (!currentNickname || !currentUserData?.uid || !selectedSide || !comment.trim()) return;
    if (hasParticipated || isAuthor) return;

    setIsSubmitting(true);
    try {
      const nodeId = `node_${Date.now()}_${currentUserData.uid}`;

      // 1. 노드 문서 생성
      await setDoc(doc(db, 'giant_trees', tree.id, 'nodes', nodeId), {
        depth: 1,                        // Phase 1: 단순히 1뎁스로 처리 (다단계는 Phase 2에서 확장)
        parentNodeId: null,
        participantNick: currentNickname,
        participantId: currentUserData.uid,
        side: selectedSide,
        comment: comment.trim(),
        childCount: 0,
        createdAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
      });

      // 2. 중복 참여 차단용 participants 문서 생성
      await setDoc(doc(db, 'giant_trees', tree.id, 'participants', currentUserData.uid), {
        joinedAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
      });

      // 3. 루트 트리 집계 업데이트
      const treeRef = doc(db, 'giant_trees', tree.id);
      const newAgree = tree.agreeCount + (selectedSide === 'agree' ? 1 : 0);
      const newOppose = tree.opposeCount + (selectedSide === 'oppose' ? 1 : 0);
      const shouldBreak = checkCircuitBreaker(newAgree, newOppose);

      await updateDoc(treeRef, {
        totalNodes: increment(1),
        agreeCount: selectedSide === 'agree' ? increment(1) : increment(0),
        opposeCount: selectedSide === 'oppose' ? increment(1) : increment(0),
        ...(shouldBreak ? { circuitBroken: true } : {}),
      });

      setHasParticipated(true);
      setSubmitted(true);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
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
          <span className="text-[13px]">⚠️</span>
          <p className="text-[12px] font-bold text-red-600">이 주장은 다수의 반대로 전파가 중단되었습니다.</p>
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
        {/* 진행 바 */}
        <div className="bg-slate-200 rounded-full h-2 mb-3 overflow-hidden">
          <div
            className="h-full bg-emerald-400 rounded-full transition-all duration-500"
            style={{ width: `${Math.min((tree.totalNodes / tree.maxSpread) * 100, 100)}%` }}
          />
        </div>
        {/* 공감/반대 바 */}
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

      {/* 전파 참여 폼 */}
      {!currentNickname ? (
        <div className="flex items-center gap-2 px-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-[13px] font-bold text-slate-400 mb-4">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
          전파에 참여하려면 로그인이 필요합니다.
        </div>
      ) : isAuthor ? (
        <div className="px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-[12px] font-bold text-slate-400 mb-4 text-center">
          내가 심은 나무입니다. 다른 사람이 전파에 참여합니다.
        </div>
      ) : submitted || hasParticipated ? (
        <div className="flex items-center gap-2 px-4 py-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-[13px] font-bold text-emerald-700 mb-4">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"/></svg>
          전파에 참여했습니다. 고마워요!
        </div>
      ) : tree.circuitBroken ? null : isFull ? (
        <div className="px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-[12px] font-bold text-slate-400 mb-4 text-center">
          최대 전파 인원에 도달했습니다.
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-4">
          <p className="text-[12px] font-black text-slate-600 mb-3">이 주장에 대한 의견을 남기고 전파하세요</p>

          {/* 공감/반대 선택 */}
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => setSelectedSide('agree')}
              className={`flex-1 py-2.5 rounded-xl text-[12px] font-[1000] border transition-all ${selectedSide === 'agree' ? 'bg-blue-500 text-white border-blue-500' : 'bg-blue-50 text-blue-500 border-blue-100 hover:bg-blue-100'}`}
            >
              👍 공감해요
            </button>
            <button
              onClick={() => setSelectedSide('oppose')}
              className={`flex-1 py-2.5 rounded-xl text-[12px] font-[1000] border transition-all ${selectedSide === 'oppose' ? 'bg-rose-500 text-white border-rose-500' : 'bg-rose-50 text-rose-500 border-rose-100 hover:bg-rose-100'}`}
            >
              👎 반대해요
            </button>
          </div>

          {/* 코멘트 입력 */}
          {selectedSide && (
            <div className="mb-3">
              <textarea
                autoFocus
                value={comment}
                onChange={e => setComment(e.target.value.slice(0, 100))}
                placeholder={selectedSide === 'agree' ? '공감하는 이유를 짧게 적어주세요 (최대 100자)' : '반대하는 이유를 짧게 적어주세요 (최대 100자)'}
                rows={2}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-[13px] font-medium text-slate-700 outline-none focus:border-emerald-400 resize-none placeholder:text-slate-300"
              />
              <span className="text-[10px] font-bold text-slate-300 float-right">{comment.length}/100</span>
            </div>
          )}

          <button
            onClick={handleParticipate}
            disabled={isSubmitting || !selectedSide || !comment.trim()}
            className="w-full py-2.5 text-[13px] font-[1000] bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-40 transition-colors clear-both"
          >
            {isSubmitting ? '참여 중...' : '🌿 전파 참여하기'}
          </button>
        </div>
      )}

      {/* 참여자 목록 */}
      <div>
        <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
          <span className="w-2 h-2 bg-emerald-400 rounded-full" />
          참여자 {nodes.length}명
        </h3>
        {nodes.length === 0 ? (
          <p className="text-center text-slate-300 font-bold text-xs py-6">아직 참여자가 없습니다.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {nodes.map(node => {
              const authorData = allUsers[`nickname_${node.participantNick}`];
              return (
                <div
                  key={node.id}
                  className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${node.side === 'agree' ? 'bg-blue-50 border-blue-100' : 'bg-rose-50 border-rose-100'}`}
                >
                  <div className="w-7 h-7 rounded-full overflow-hidden border border-slate-200 shrink-0 mt-0.5">
                    <img src={authorData?.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${node.participantNick}`} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[12px] font-black text-slate-800">{node.participantNick}</span>
                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${node.side === 'agree' ? 'bg-blue-100 text-blue-600' : 'bg-rose-100 text-rose-600'}`}>
                        {node.side === 'agree' ? '👍 공감' : '👎 반대'}
                      </span>
                      <span className="text-[9px] font-bold text-slate-300 ml-auto">{formatTime(node.createdAt)}</span>
                    </div>
                    <p className="text-[12.5px] font-medium text-slate-600 leading-relaxed">{node.comment}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default GiantTreeDetail;
