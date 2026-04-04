// src/components/GiantTreeDetail.tsx — 거대 나무 상세 뷰 + 전파 참여 폼 (Phase 4)
import { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import {
  collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, increment,
  onSnapshot, query, orderBy, addDoc, serverTimestamp, writeBatch
} from 'firebase/firestore';
import type { GiantTree, GiantTreeNode, GiantTreeLeaf, UserData } from '../types';
import GiantTreeMap from './GiantTreeMap';

// 🚀 카카오톡 공유 SDK 타입 선언
declare global { interface Window { Kakao: any; } }

// 🚀 카카오톡 공유 실행 함수
// nodeId가 있으면 해당 노드 하위로 진입하는 URL, 없으면 작성자 루트 URL
const shareKakao = (treeId: string, nodeId: string | null, title: string) => {
  if (!window.Kakao?.isInitialized()) return;
  const url = nodeId
    ? `https://halmal-itso.web.app/?tree=${treeId}&node=${nodeId}`
    : `https://halmal-itso.web.app/?tree=${treeId}`;
  window.Kakao.Share.sendDefault({
    objectType: 'feed',
    content: {
      title: '🌳 거대 나무 — 주장 전파',
      description: title,
      imageUrl: 'https://halmal-itso.web.app/og-image.jpg',
      link: { mobileWebUrl: url, webUrl: url },
    },
    buttons: [{ title: '전파 참여하기', link: { mobileWebUrl: url, webUrl: url } }],
  });
};

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

const GiantTreeDetail = ({ tree: treeProp, currentNickname, currentUserData, allUsers = {}, parentNodeId, onBack }: Props) => {
  // 🚀 tree 문서 실시간 구독 — 수정 즉시 반영 (props만으로는 부모 리렌더 전까지 반영 안 됨)
  const [tree, setTree] = useState<GiantTree>(treeProp);
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'giant_trees', treeProp.id), snap => {
      if (snap.exists()) setTree({ id: snap.id, ...snap.data() } as GiantTree);
    });
    return () => unsub();
  }, [treeProp.id]);

  const [nodes, setNodes] = useState<GiantTreeNode[]>([]);
  const [hasParticipated, setHasParticipated] = useState(false);
  const [isAuthor, setIsAuthor] = useState(false);
  const [parentNodeDepth, setParentNodeDepth] = useState<number | null>(null);
  // 🚀 작성자 URL 복사 상태
  const [copiedAuthorUrl, setCopiedAuthorUrl] = useState(false);

  // 전파 참여 폼 상태
  const [selectedSide, setSelectedSide] = useState<'agree' | 'oppose' | null>(null);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 참여 완료 후 공유 URL 상태
  const [myNodeId, setMyNodeId] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // 🚀 Phase 3: 하단 탭 (참여자 목록 / 나무 지도)
  const [bottomTab, setBottomTab] = useState<'list' | 'map'>('list');

  // 🚀 잎사귀 (일반 참여자) 상태
  const [leaves, setLeaves] = useState<GiantTreeLeaf[]>([]);
  const [hasLeafed, setHasLeafed] = useState(false);

  // 🚀 작성자 수정·삭제 상태
  const [isEditMode, setIsEditMode] = useState(false);
  const [editTitle, setEditTitle] = useState(tree.title);
  const [editContent, setEditContent] = useState(tree.content);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // 🚀 시든 가지 알림 발송 추적 (useRef — 렌더 간 유지, sessionStorage 불필요)
  const wiltNotifiedRef = useRef<Set<string>>(new Set());

  // 🚀 노드 목록 실시간 구독
  useEffect(() => {
    const q = query(collection(db, 'giant_trees', tree.id, 'nodes'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, snap => {
      setNodes(snap.docs.map(d => ({ id: d.id, ...d.data() } as GiantTreeNode)));
    });
    return () => unsub();
  }, [tree.id]);

  // 🚀 잎사귀 목록 실시간 구독
  useEffect(() => {
    const q = query(collection(db, 'giant_trees', tree.id, 'leaves'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, snap => {
      const leafData = snap.docs.map(d => ({ id: d.id, ...d.data() } as GiantTreeLeaf));
      setLeaves(leafData);
      if (currentUserData?.uid) {
        setHasLeafed(leafData.some(l => l.participantId === currentUserData.uid));
      }
    });
    return () => unsub();
  }, [tree.id, currentUserData?.uid]);

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

    // 🚀 시든 가지 알림: 내 노드 48시간 경과 + childCount < 3 → 1회 알림 push
    const myNodeForWilt = nodes.find(n => n.participantId === currentUserData.uid);
    if (myNodeForWilt && myNodeForWilt.childCount < 3) {
      const createdMs = myNodeForWilt.createdAt?.seconds ? myNodeForWilt.createdAt.seconds * 1000 : 0;
      const isWilted = createdMs > 0 && (Date.now() - createdMs) > 48 * 60 * 60 * 1000;
      const wiltKey = `node_${myNodeForWilt.id}`;
      if (isWilted && !wiltNotifiedRef.current.has(wiltKey)) {
        wiltNotifiedRef.current.add(wiltKey);
        const wiltedCount = 3 - myNodeForWilt.childCount;
        addDoc(collection(db, 'notifications', currentUserData.uid, 'items'), {
          type: 'giant_tree_wilt',
          treeId: tree.id,
          treeTitle: tree.title,
          nodeId: myNodeForWilt.id,
          wiltedCount,
          message: `전파한 3명 중 ${myNodeForWilt.childCount}명만 참여했습니다. 나머지 ${wiltedCount}명에게 재전파하세요.`,
          isRead: false,
          createdAt: serverTimestamp(),
        }).catch(err => console.warn('[시든 가지 알림 발송 실패]', err));
      }
    }

    // 🚀 작성자 시든 가지 알림: 나무 생성 48시간 경과 + 루트 직계 자식(depth=1, parentNodeId===null) < 3
    if (tree.author_id === currentUserData.uid) {
      const treeCreatedMs = tree.createdAt?.seconds ? tree.createdAt.seconds * 1000 : 0;
      // parentNodeId가 null인 노드 = 작성자가 직접 공유한 1차 전파자
      const rootChildren = nodes.filter(n => n.parentNodeId === null || n.parentNodeId === undefined).length;
      const isWilted = treeCreatedMs > 0 && (Date.now() - treeCreatedMs) > 48 * 60 * 60 * 1000 && rootChildren < 3;
      const wiltKey = `author_${tree.id}`;
      if (isWilted && !wiltNotifiedRef.current.has(wiltKey)) {
        wiltNotifiedRef.current.add(wiltKey);
        const wiltedCount = 3 - rootChildren;
        addDoc(collection(db, 'notifications', currentUserData.uid, 'items'), {
          type: 'giant_tree_wilt',
          treeId: tree.id,
          treeTitle: tree.title,
          wiltedCount,
          message: `나무에 전파한 3명 중 ${rootChildren}명만 참여했습니다. 나머지 ${wiltedCount}명에게 재전파하세요.`,
          isRead: false,
          createdAt: serverTimestamp(),
        }).catch(err => console.warn('[작성자 시든 가지 알림 발송 실패]', err));
      }
    }
  }, [tree.id, tree.author_id, currentUserData?.uid, parentNodeId, nodes]);

  const handleParticipate = async () => {
    if (!currentNickname || !currentUserData?.uid || !selectedSide) return;
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

      // 5. 🚀 평판 상승 — 공감 참여 시 작성자 likes+2, 참여자 likes+1
      if (selectedSide === 'agree' && tree.author_id !== currentUserData.uid) {
        await updateDoc(doc(db, 'users', tree.author_id), { likes: increment(2) });
      }
      // 참여자 보상: 공감·반대 무관하게 likes+1 (참여 동기부여)
      await updateDoc(doc(db, 'users', currentUserData.uid), { likes: increment(1) });

      // 6. 🚀 작성자에게 전파 알림 발송 (자기 나무 참여 제외)
      if (tree.author_id !== currentUserData.uid) {
        await addDoc(collection(db, 'notifications', tree.author_id, 'items'), {
          type: 'giant_tree_spread',
          fromNick: currentNickname,
          treeId: tree.id,
          treeTitle: tree.title,
          side: selectedSide,
          isRead: false,
          createdAt: serverTimestamp(),
        });
      }

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

  // 🚀 작성자 루트 전파 카운터 — depth=1 (parentNodeId===null) 노드 수
  const rootSpreadCount = nodes.filter(n => !n.parentNodeId).length;
  const authorSpreadFull = rootSpreadCount >= 3;

  // 🚀 내 노드의 전파 카운터 (참여 완료 후)
  const myNode = nodes.find(n => n.id === myNodeId);
  const myChildCount = myNode?.childCount ?? 0;
  const mySpreadFull = myChildCount >= 3;

  // 🚀 부모 노드가 이미 3명에게 전파한 경우 참여 차단
  const parentNode = parentNodeId ? nodes.find(n => n.id === parentNodeId) : null;
  const parentFull = parentNode !== undefined && parentNode !== null && parentNode.childCount >= 3;

  // 🚀 특정 노드의 모든 하위 인원 수 (재귀 합산)
  const countDescendants = (nodeId: string): number => {
    const children = nodes.filter(n => n.parentNodeId === nodeId);
    return children.length + children.reduce((sum, c) => sum + countDescendants(c.id), 0);
  };

  // 🚀 자식 노드 목록 렌더링 — 작성자/참여자 공용
  const renderChildrenList = (children: GiantTreeNode[], totalDesc: number) => (
    <div className="mt-3">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
        내가 전파한 {children.length}명
      </p>
      <div className="flex flex-col gap-1.5">
        {children.map(child => {
          const data = allUsers[`nickname_${child.participantNick}`];
          return (
            <div key={child.id} className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${child.side === 'agree' ? 'bg-blue-50 border-blue-100' : 'bg-rose-50 border-rose-100'}`}>
              <div className="w-5 h-5 rounded-full overflow-hidden shrink-0">
                <img src={data?.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${child.participantNick}`} alt="" className="w-full h-full object-cover" />
              </div>
              <span className="text-[11px] font-black text-slate-700 flex-1 truncate">{child.participantNick}</span>
              <span className={`text-[10px] font-bold ${child.side === 'agree' ? 'text-blue-500' : 'text-rose-500'}`}>{child.side === 'agree' ? '👍' : '👎'}</span>
              <span className="text-[10px] font-bold text-emerald-600 shrink-0">{child.childCount}/3 전파</span>
            </div>
          );
        })}
      </div>
      {/* 하위 전체 인원이 직계보다 많으면 총합 표시 */}
      {totalDesc > children.length && (
        <p className="text-[10px] font-bold text-emerald-500 mt-1.5 pl-1">└ 내 하위 총 {totalDesc}명 참여 중</p>
      )}
    </div>
  );

  // 🚀 작성자 글 수정 핸들러
  const handleEditSave = async () => {
    if (!editTitle.trim() || !editContent.trim()) return;
    try {
      await updateDoc(doc(db, 'giant_trees', tree.id), {
        title: editTitle.trim(),
        content: editContent.trim(),
      });
      setIsEditMode(false);
    } catch (err) {
      alert('수정에 실패했습니다: ' + ((err as Error).message || ''));
    }
  };

  // 🚀 작성자 글 삭제 핸들러 — nodes + participants + 루트 문서 일괄 삭제
  const handleDelete = async () => {
    if (deleteInput !== '글 삭제') return;
    setIsDeleting(true);
    try {
      // 서브컬렉션(nodes, participants)을 batch로 삭제 — Firestore는 부모 삭제 시 서브컬렉션 자동 삭제 안 됨
      const nodesSnap = await getDocs(collection(db, 'giant_trees', tree.id, 'nodes'));
      const partsSnap = await getDocs(collection(db, 'giant_trees', tree.id, 'participants'));
      const leavesSnap = await getDocs(collection(db, 'giant_trees', tree.id, 'leaves'));

      // writeBatch 500건 제한 대응: 청크 분할
      const allDocs = [...nodesSnap.docs, ...partsSnap.docs, ...leavesSnap.docs];
      for (let i = 0; i < allDocs.length; i += 450) {
        const batch = writeBatch(db);
        allDocs.slice(i, i + 450).forEach(d => batch.delete(d.ref));
        await batch.commit();
      }

      // 루트 문서 삭제
      await deleteDoc(doc(db, 'giant_trees', tree.id));
      onBack();
    } catch (err) {
      alert('삭제에 실패했습니다: ' + ((err as Error).message || ''));
      setIsDeleting(false);
    }
  };

  // 🚀 잎사귀 참여 핸들러 — 앱 내 직접 진입 일반 유저
  const handleLeafParticipate = async () => {
    if (!currentNickname || !currentUserData?.uid || !selectedSide) return;
    if (hasParticipated || hasLeafed || isAuthor) return;
    setIsSubmitting(true);
    try {
      const leafId = `leaf_${Date.now()}_${currentUserData.uid}`;
      await setDoc(doc(db, 'giant_trees', tree.id, 'leaves', leafId), {
        participantNick: currentNickname,
        participantId: currentUserData.uid,
        side: selectedSide,
        comment: comment.trim(),
        createdAt: serverTimestamp(),
      });
      // 잎사귀도 participants에 등록 (중복 참여 방지)
      await setDoc(doc(db, 'giant_trees', tree.id, 'participants', currentUserData.uid), {
        joinedAt: serverTimestamp(), type: 'leaf',
      });
      // 참여자 보상: likes+1
      await updateDoc(doc(db, 'users', currentUserData.uid), { likes: increment(1) });
      setHasLeafed(true);
      setComment('');
      setSelectedSide(null);
    } catch (err) {
      alert('참여에 실패했습니다: ' + ((err as Error).message || ''));
    } finally {
      setIsSubmitting(false);
    }
  };

  // 🚀 작성자 URL 복사 핸들러
  const handleCopyAuthorUrl = () => {
    const url = `${window.location.origin}/?tree=${tree.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedAuthorUrl(true);
      setTimeout(() => setCopiedAuthorUrl(false), 2000);
    });
  };

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
          {/* 🚀 작성자 수정·삭제 버튼 */}
          {isAuthor && !isEditMode && (
            <div className="flex items-center gap-2 ml-2">
              <button onClick={() => { setEditTitle(tree.title); setEditContent(tree.content); setIsEditMode(true); }}
                className="text-[10px] font-bold text-slate-400 hover:text-blue-500 transition-colors">수정</button>
              <button onClick={() => { setShowDeleteConfirm(true); setDeleteInput(''); }}
                className="text-[10px] font-bold text-slate-400 hover:text-rose-500 transition-colors">삭제</button>
            </div>
          )}
        </div>

        {isEditMode ? (
          /* 🚀 수정 모드 — 제목·본문 인라인 편집 */
          <div className="flex flex-col gap-3">
            <input
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              maxLength={80}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-[15px] font-[1000] text-slate-900 outline-none focus:border-blue-400"
              placeholder="제목"
            />
            <textarea
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-[13px] font-medium text-slate-700 outline-none focus:border-blue-400 resize-none h-32"
              placeholder="본문"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setIsEditMode(false)}
                className="px-4 py-1.5 text-[11px] font-bold text-slate-400 hover:text-slate-600 transition-colors">취소</button>
              <button onClick={handleEditSave} disabled={!editTitle.trim() || !editContent.trim()}
                className="px-4 py-1.5 text-[11px] font-bold bg-blue-500 hover:bg-blue-600 text-white rounded-lg disabled:opacity-50 transition-colors">저장</button>
            </div>
          </div>
        ) : (
          <>
            <h2 className="text-[17px] font-[1000] text-slate-900 mb-3 leading-snug">{tree.title}</h2>
            <p className="text-[13.5px] text-slate-600 font-medium leading-relaxed whitespace-pre-line">{tree.content}</p>
          </>
        )}
      </div>

      {/* 🚀 삭제 확인 모달 — "글 삭제" 입력 필수 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-white rounded-2xl p-6 w-[380px] shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-[16px] font-[1000] text-slate-900 mb-2">거대 나무 삭제</h3>
            <p className="text-[12px] font-bold text-slate-500 mb-1">이 나무와 전파된 모든 참여 기록이 영구 삭제됩니다.</p>
            <p className="text-[12px] font-bold text-rose-500 mb-4">삭제하려면 아래에 <strong>"글 삭제"</strong>를 입력하세요.</p>
            <input
              value={deleteInput}
              onChange={e => setDeleteInput(e.target.value)}
              placeholder="글 삭제"
              className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-[14px] font-bold text-slate-900 outline-none focus:border-rose-400 mb-4"
              autoFocus
            />
            <div className="flex gap-2">
              <button onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2.5 rounded-xl text-[12px] font-[1000] text-slate-400 bg-slate-50 hover:bg-slate-100 transition-colors">취소</button>
              <button
                onClick={handleDelete}
                disabled={deleteInput !== '글 삭제' || isDeleting}
                className={`flex-1 py-2.5 rounded-xl text-[12px] font-[1000] transition-all ${deleteInput === '글 삭제' && !isDeleting ? 'bg-rose-500 text-white hover:bg-rose-600' : 'bg-slate-100 text-slate-300 cursor-not-allowed'}`}
              >
                {isDeleting ? '삭제 중...' : '영구 삭제'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 전파 현황 — 잎사귀 보너스 반영 */}
      {(() => {
        const basePct = tree.maxSpread > 0 ? Math.min((tree.totalNodes / tree.maxSpread) * 100, 100) : 0;
        // 잎사귀 보너스: 10개당 1%, 최대 10%
        const leafBonus = Math.min(Math.floor(leaves.length / 10), 10);
        const displayPct = Math.min(basePct + leafBonus, 100);
        return (
          <div className="bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">전파 현황</span>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black text-slate-700">{tree.totalNodes} / {tree.maxSpread}명</span>
                {leaves.length > 0 && (
                  <span className="text-[9px] font-bold text-green-500 bg-green-50 border border-green-100 px-1.5 py-0.5 rounded-md">🍃 {leaves.length}</span>
                )}
              </div>
            </div>
            <div className="bg-slate-200 rounded-full h-2 mb-1 overflow-hidden">
              <div className="h-full bg-emerald-400 rounded-full transition-all duration-500"
                style={{ width: `${displayPct}%` }} />
            </div>
            {leafBonus > 0 && (
              <p className="text-[9px] font-bold text-green-500 mb-2">🍃 잎사귀 보너스 +{leafBonus}% (잎사귀 {leaves.length}개)</p>
            )}
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
        );
      })()}

      {/* 전파 참여 폼 / 상태 */}
      {!currentNickname ? (
        <div className="flex items-center gap-2 px-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-[13px] font-bold text-slate-400 mb-4">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
          전파에 참여하려면 로그인이 필요합니다.
        </div>
      ) : isAuthor ? (
        /* 🚀 작성자 전파 시작 블록 — 3명에게 공유 유도 */
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-4 mb-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[15px]">🌱</span>
            <p className="text-[13px] font-black text-emerald-700">나무를 심었습니다! 3명에게 전파를 시작하세요.</p>
          </div>
          {/* 전파 카운터 */}
          <div className="flex items-center gap-2 mb-3 mt-2">
            <div className="flex gap-1.5">
              {[0, 1, 2].map(i => (
                <div key={i} className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black border-2 transition-all ${i < rootSpreadCount ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-emerald-200 text-emerald-300'}`}>
                  {i < rootSpreadCount ? '✓' : i + 1}
                </div>
              ))}
            </div>
            <span className="text-[11px] font-black text-emerald-600">
              {authorSpreadFull ? '전파 시작 완료 (3/3)' : `${rootSpreadCount}/3명에게 전파함`}
            </span>
          </div>
          {/* 🚀 시든 가지 판정 (작성자) */}
          {(() => {
            const treeCreatedMs = tree.createdAt?.seconds ? tree.createdAt.seconds * 1000 : 0;
            const elapsed = Date.now() - treeCreatedMs;
            const hasWilted = treeCreatedMs > 0 && elapsed > 48 * 60 * 60 * 1000 && rootSpreadCount < 3;
            const wiltedCount = hasWilted ? 3 - rootSpreadCount : 0;
            return hasWilted ? (
              <div className="mb-2 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                <span className="text-[12px]">🍂</span>
                <span className="text-[11px] font-bold text-amber-700">
                  {wiltedCount}개의 시든 가지 — 48시간 내 미참여. 다른 사람에게 재전파하세요.
                </span>
              </div>
            ) : null;
          })()}
          {/* 공유 URL */}
          <p className="text-[11px] font-bold text-emerald-600 mb-2">아래 링크를 3명에게 공유하면 주장이 전파됩니다.</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-white border border-emerald-200 rounded-xl px-3 py-2 text-[11px] font-bold text-slate-500 truncate">
              {`${window.location.origin}/?tree=${tree.id}`}
            </div>
            <button
              onClick={handleCopyAuthorUrl}
              className={`shrink-0 px-3 py-2 text-[11px] font-[1000] rounded-xl transition-all ${copiedAuthorUrl ? 'bg-emerald-500 text-white' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
            >
              {copiedAuthorUrl ? '복사됨!' : '링크 복사'}
            </button>
            <button
              onClick={() => shareKakao(tree.id, null, tree.title)}
              className="shrink-0 px-3 py-2 text-[11px] font-[1000] rounded-xl bg-yellow-400 text-yellow-900 hover:bg-yellow-500 transition-all"
            >
              💬 카카오
            </button>
          </div>
          {/* 🚀 작성자 직계 자식 목록 */}
          {rootSpreadCount > 0 && renderChildrenList(
            nodes.filter(n => !n.parentNodeId),
            nodes.length  // 작성자 기준 하위 = 전체 노드
          )}
        </div>
      ) : (hasParticipated || myNodeId) ? (
        /* 🚀 참여 완료 — 전파 URL 공유 블록 + 카운터 */
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-4 mb-4">
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"/></svg>
            <p className="text-[13px] font-black text-emerald-700">전파에 참여했습니다!</p>
          </div>
          {/* 🚀 전파 카운터 */}
          <div className="flex items-center gap-2 mb-3 mt-2">
            <div className="flex gap-1.5">
              {[0, 1, 2].map(i => (
                <div key={i} className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black border-2 transition-all ${i < myChildCount ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-emerald-200 text-emerald-300'}`}>
                  {i < myChildCount ? '✓' : i + 1}
                </div>
              ))}
            </div>
            <span className="text-[11px] font-black text-emerald-600">
              {mySpreadFull ? '전파 완료 (3/3)' : `${myChildCount}/3명에게 전파함`}
            </span>
          </div>
          {mySpreadFull ? (
            <p className="text-[11px] font-bold text-slate-400 text-center py-1">3명에게 모두 전파했습니다.</p>
          ) : (() => {
            // 🚀 시든 가지 판정: 내 노드 생성 후 48시간 경과 + 아직 3명 미달
            const myCreatedMs = myNode?.createdAt?.seconds ? myNode.createdAt.seconds * 1000 : 0;
            const elapsed = Date.now() - myCreatedMs;
            const WILT_HOURS = 48;
            const hasWiltedSlots = myCreatedMs > 0 && elapsed > WILT_HOURS * 60 * 60 * 1000 && myChildCount < 3;
            const wiltedCount = hasWiltedSlots ? 3 - myChildCount : 0;
            return hasWiltedSlots ? (
              <div className="mb-2 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                <span className="text-[12px]">🍂</span>
                <span className="text-[11px] font-bold text-amber-700">
                  {wiltedCount}개의 시든 가지 — 48시간 내 미참여. 다른 사람에게 재전파하세요.
                </span>
              </div>
            ) : null;
          })()}
          {!mySpreadFull && (
            <>
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
                <button
                  onClick={() => shareKakao(tree.id, myNodeId!, tree.title)}
                  className="shrink-0 px-3 py-2 text-[11px] font-[1000] rounded-xl bg-yellow-400 text-yellow-900 hover:bg-yellow-500 transition-all"
                >
                  💬 카카오
                </button>
              </div>
            </>
          )}
          {/* 🚀 참여자 직계 자식 목록 */}
          {myNodeId && myChildCount > 0 && renderChildrenList(
            nodes.filter(n => n.parentNodeId === myNodeId),
            countDescendants(myNodeId)
          )}
        </div>
      ) : tree.circuitBroken ? null : isFull ? (
        <div className="px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-[12px] font-bold text-slate-400 mb-4 text-center">
          최대 전파 인원에 도달했습니다.
        </div>
      ) : parentFull ? (
        /* 🚀 부모 노드가 이미 3명에게 전파 완료 — 참여 차단 */
        <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-2xl text-[12px] font-bold text-amber-600 mb-4 text-center">
          이 전파 경로는 이미 3명에게 전달되어 더 이상 참여할 수 없습니다.
        </div>
      ) : parentNodeId ? (
        /* 🚀 직계 전파 참여 — 카톡 URL로 진입한 유저 → 정식 노드 */
        <div className="bg-white border border-emerald-200 rounded-2xl p-4 mb-4">
          <p className="text-[12px] font-black text-emerald-700 mb-3">
            🌿 전파 참여 <span className="ml-1.5 text-[10px] font-bold text-emerald-500 bg-emerald-50 px-1.5 py-0.5 rounded-md">{depthLabel}</span>
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
              <input value={comment} onChange={e => setComment(e.target.value.slice(0, 50))}
                placeholder="한 줄 의견 (선택, 최대 50자)"
                className="w-full border border-emerald-200 rounded-xl px-3 py-2.5 text-[13px] font-medium text-slate-700 outline-none focus:border-emerald-400 placeholder:text-slate-300" />
              <span className="text-[10px] font-bold text-slate-300 float-right mt-0.5">{comment.length}/50</span>
            </div>
          )}
          <button onClick={handleParticipate} disabled={isSubmitting || !selectedSide}
            className="w-full py-2.5 text-[13px] font-[1000] bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-40 transition-colors clear-both">
            {isSubmitting ? '참여 중...' : '🌿 전파 참여하기'}
          </button>
        </div>
      ) : hasLeafed ? (
        /* 🚀 잎사귀 참여 완료 */
        <div className="px-4 py-3 bg-green-50 border border-green-200 rounded-2xl text-[12px] font-bold text-green-600 mb-4 text-center">
          🍃 잎사귀로 참여했습니다. 이 나무를 응원하고 있어요!
        </div>
      ) : (
        /* 🚀 잎사귀 참여 — 앱 내 직접 진입한 일반 유저 */
        <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[14px]">🍃</span>
            <p className="text-[12px] font-black text-slate-600">잎사귀로 응원하기</p>
            <span className="text-[9px] font-bold text-slate-300 ml-auto">트리 카운트에는 미포함</span>
          </div>
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
              <input value={comment} onChange={e => setComment(e.target.value.slice(0, 50))}
                placeholder="한 줄 의견 (선택, 최대 50자)"
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] font-medium text-slate-700 outline-none focus:border-emerald-400 placeholder:text-slate-300" />
              <span className="text-[10px] font-bold text-slate-300 float-right mt-0.5">{comment.length}/50</span>
            </div>
          )}
          <button onClick={handleLeafParticipate} disabled={isSubmitting || !selectedSide}
            className="w-full py-2.5 text-[13px] font-[1000] bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-40 transition-colors clear-both">
            {isSubmitting ? '참여 중...' : '🍃 잎사귀 달기'}
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
            참여자 {nodes.length}명{leaves.length > 0 ? ` · 잎사귀 ${leaves.length}` : ''}
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
          <GiantTreeMap tree={tree} nodes={nodes} allUsers={allUsers} myNodeId={myNodeId} />
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
                    {node.comment && <p className="text-[12.5px] font-medium text-slate-600 leading-relaxed">{node.comment}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        {/* 🚀 잎사귀 목록 — 앱 내 직접 진입한 일반 참여자 */}
        {bottomTab === 'list' && leaves.length > 0 && (
          <div className="mt-4 pt-3 border-t border-green-100">
            <h4 className="text-[11px] font-black text-green-600 mb-2 flex items-center gap-1">
              🍃 잎사귀 <span className="text-green-400 font-bold">({leaves.length})</span>
            </h4>
            <div className="flex flex-col gap-1.5">
              {leaves.map(leaf => {
                const leafAuthor = allUsers[`nickname_${leaf.participantNick}`];
                const isMe = leaf.participantId === currentUserData?.uid;
                return (
                  <div key={leaf.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50/50 border border-green-100/50 ${isMe ? 'ring-1 ring-green-300' : ''}`}>
                    <div className="w-5 h-5 rounded-full overflow-hidden border border-slate-100 shrink-0">
                      <img src={leafAuthor?.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${leaf.participantNick}`} alt="" className="w-full h-full object-cover" />
                    </div>
                    <span className="text-[10px] font-black text-slate-700">{leaf.participantNick}</span>
                    <span className={`text-[8px] font-black px-1 py-0.5 rounded ${leaf.side === 'agree' ? 'bg-blue-100 text-blue-600' : 'bg-rose-100 text-rose-600'}`}>
                      {leaf.side === 'agree' ? '👍' : '👎'}
                    </span>
                    {leaf.comment && <span className="text-[10px] font-medium text-slate-500 truncate">{leaf.comment}</span>}
                    {isMe && <span className="text-[8px] font-black text-green-600 ml-auto">나</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GiantTreeDetail;
