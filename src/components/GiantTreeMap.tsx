// src/components/GiantTreeMap.tsx — 거대 나무 트리 시각화 (Phase 3)
// flat 노드 배열 → 계층 트리 구조로 변환 후 CSS flex 렌더링, 줌인/아웃 지원
import { useState, useMemo } from 'react';
import type { GiantTree, GiantTreeNode, UserData } from '../types';

interface Props {
  tree: GiantTree;
  nodes: GiantTreeNode[];
  allUsers?: Record<string, UserData>;
  myNodeId?: string | null;  // 🚀 내 노드 강조용
}

// 🚀 트리 노드 재귀 구조
interface TreeNodeItem {
  node: GiantTreeNode;
  children: TreeNodeItem[];
}

// 🚀 특정 노드 ID 기준 모든 하위 ID 수집 (해당 노드 포함)
function collectSubtreeIds(item: TreeNodeItem, targetId: string): Set<string> {
  if (item.node.id === targetId) {
    const ids = new Set<string>();
    const addAll = (i: TreeNodeItem) => { ids.add(i.node.id); i.children.forEach(addAll); };
    addAll(item);
    return ids;
  }
  for (const child of item.children) {
    const found = collectSubtreeIds(child, targetId);
    if (found.size > 0) return found;
  }
  return new Set<string>();
}

// flat 배열 → 계층 트리 변환 (루트: parentNodeId === null)
function buildTree(nodes: GiantTreeNode[]): TreeNodeItem[] {
  const map = new Map<string, TreeNodeItem>();
  nodes.forEach(n => map.set(n.id, { node: n, children: [] }));

  const roots: TreeNodeItem[] = [];
  nodes.forEach(n => {
    const item = map.get(n.id)!;
    if (!n.parentNodeId) {
      roots.push(item);
    } else {
      const parent = map.get(n.parentNodeId);
      if (parent) parent.children.push(item);
      else roots.push(item); // 부모 미조회 시 루트로 처리
    }
  });

  // 각 레벨 내 생성 시간순 정렬
  const sortChildren = (items: TreeNodeItem[]) => {
    items.sort((a, b) => (a.node.createdAt?.seconds || 0) - (b.node.createdAt?.seconds || 0));
    items.forEach(i => sortChildren(i.children));
  };
  sortChildren(roots);
  return roots;
}

// 🚀 노드 카드 컴포넌트
const NodeCard = ({ item, allUsers, depth = 0, myNodeId, subtreeIds }: {
  item: TreeNodeItem;
  allUsers: Record<string, UserData>;
  depth?: number;
  myNodeId?: string | null;
  subtreeIds?: Set<string>;
}) => {
  const { node, children } = item;
  const authorData = allUsers[`nickname_${node.participantNick}`];

  // 🚀 내 노드 / 내 서브트리 여부 판별
  const isMyNode = !!myNodeId && node.id === myNodeId;
  const isInSubtree = !isMyNode && (subtreeIds?.has(node.id) ?? false);

  const borderColor = isMyNode ? 'border-amber-400'
    : isInSubtree
      ? (node.side === 'agree' ? 'border-blue-400' : 'border-rose-400')
      : (node.side === 'agree' ? 'border-blue-300' : 'border-rose-300');
  const bgColor = isMyNode ? 'bg-amber-50'
    : isInSubtree
      ? (node.side === 'agree' ? 'bg-blue-100' : 'bg-rose-100')
      : (node.side === 'agree' ? 'bg-blue-50' : 'bg-rose-50');
  const sideColor = node.side === 'agree' ? 'text-blue-500' : 'text-rose-500';
  const barColor = isMyNode ? 'bg-amber-400'
    : (node.side === 'agree' ? 'bg-blue-400' : 'bg-rose-400');

  return (
    <div className="flex flex-col items-center">
      {/* 세로 연결선 (루트 제외) */}
      {depth > 0 && (
        <div className={`w-px h-5 ${barColor} opacity-40`} />
      )}

      {/* 노드 카드 */}
      <div className={`relative w-[140px] border-2 ${borderColor} ${bgColor} rounded-xl px-2 py-2 shadow-sm`}>
        {/* depth 배지 */}
        <div className={`absolute -top-2 left-2 text-[8px] font-black px-1.5 py-0.5 rounded-full ${node.side === 'agree' ? 'bg-blue-400 text-white' : 'bg-rose-400 text-white'}`}>
          {depth + 1}차
        </div>
        {/* 🚀 내 노드 배지 */}
        {isMyNode && (
          <div className="absolute -top-2 right-2 text-[8px] font-black px-1.5 py-0.5 rounded-full bg-amber-400 text-white">나</div>
        )}

        <div className="flex items-center gap-1.5 mb-1">
          <div className="w-5 h-5 rounded-full overflow-hidden border border-slate-200 shrink-0">
            <img src={authorData?.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${node.participantNick}`} alt="" className="w-full h-full object-cover" />
          </div>
          <span className="text-[10px] font-black text-slate-700 truncate flex-1">{node.participantNick}</span>
        </div>

        <div className={`text-[8px] font-black mb-1 ${sideColor}`}>
          {node.side === 'agree' ? '👍 공감' : '👎 반대'}
        </div>

        {node.comment && <p className="text-[9px] font-medium text-slate-600 leading-relaxed line-clamp-2">{node.comment}</p>}

        {node.childCount > 0 && (
          <div className="mt-1 text-[8px] font-bold text-emerald-600">→ {node.childCount}명 전파</div>
        )}
      </div>

      {/* 자식 노드들 */}
      {children.length > 0 && (
        <div className={`flex items-start gap-4 mt-0`}>
          {children.map(child => (
            <NodeCard key={child.node.id} item={child} allUsers={allUsers} depth={depth + 1} myNodeId={myNodeId} subtreeIds={subtreeIds} />
          ))}
        </div>
      )}
    </div>
  );
};

// 🚀 작성자(루트) 카드
const RootCard = ({ tree, allUsers }: { tree: GiantTree; allUsers: Record<string, UserData> }) => {
  const authorData = allUsers[`nickname_${tree.author}`];
  return (
    <div className="flex flex-col items-center">
      <div className="w-[160px] border-2 border-emerald-400 bg-emerald-50 rounded-xl px-3 py-2.5 shadow-md">
        <div className="flex items-center gap-1.5 mb-1.5">
          <div className="w-6 h-6 rounded-full overflow-hidden border border-emerald-200 shrink-0">
            <img src={authorData?.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${tree.author}`} alt="" className="w-full h-full object-cover" />
          </div>
          <span className="text-[11px] font-black text-emerald-800 truncate">{tree.author}</span>
          <span className="text-[8px] font-bold text-emerald-500 shrink-0 ml-auto">작성자</span>
        </div>
        <p className="text-[10px] font-black text-emerald-900 leading-snug line-clamp-2">{tree.title}</p>
      </div>
      {/* 작성자 아래 연결선 */}
      <div className="w-px h-5 bg-emerald-300 opacity-60" />
    </div>
  );
};

const GiantTreeMap = ({ tree, nodes, allUsers = {}, myNodeId }: Props) => {
  const [zoom, setZoom] = useState(1);

  const treeData = useMemo(() => buildTree(nodes), [nodes]);

  // 🚀 내 노드 기준 서브트리 ID 집합 — 하이라이트용
  const subtreeIds = useMemo(() => {
    if (!myNodeId) return new Set<string>();
    for (const root of treeData) {
      const found = collectSubtreeIds(root, myNodeId);
      if (found.size > 0) return found;
    }
    return new Set<string>();
  }, [treeData, myNodeId]);

  return (
    <div className="relative">
      {/* 줌 컨트롤 */}
      <div className="flex items-center gap-2 mb-3 justify-end">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">줌</span>
        <button
          onClick={() => setZoom(z => Math.max(0.4, z - 0.1))}
          className="w-7 h-7 flex items-center justify-center text-[14px] font-black text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
        >−</button>
        <span className="text-[11px] font-bold text-slate-500 w-10 text-center">{Math.round(zoom * 100)}%</span>
        <button
          onClick={() => setZoom(z => Math.min(1.5, z + 0.1))}
          className="w-7 h-7 flex items-center justify-center text-[14px] font-black text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
        >+</button>
        <button
          onClick={() => setZoom(1)}
          className="text-[10px] font-black text-slate-400 hover:text-slate-600 px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
        >초기화</button>
      </div>

      {/* 트리 캔버스 — 가로 스크롤 + 줌 */}
      <div className="overflow-auto border border-slate-100 rounded-2xl bg-slate-50 p-4 min-h-[220px]">
        <div
          style={{ transform: `scale(${zoom})`, transformOrigin: 'top center', transition: 'transform 0.15s ease' }}
        >
          {nodes.length === 0 ? (
            <div className="py-8 text-center text-slate-300 font-bold text-xs">
              아직 전파된 노드가 없습니다.
            </div>
          ) : (
            <div className="flex flex-col items-center">
              {/* 작성자 루트 카드 */}
              <RootCard tree={tree} allUsers={allUsers} />

              {/* 1차 전파 노드들 가로 배열 */}
              {treeData.length > 0 && (
                <>
                  {/* 가로 분기선 */}
                  {treeData.length > 1 && (
                    <div
                      className="h-px bg-slate-300 opacity-40 mb-0"
                      style={{ width: `${Math.max(treeData.length * 160, 160)}px` }}
                    />
                  )}
                  <div className="flex items-start gap-5 flex-wrap justify-center pt-0">
                    {treeData.map(item => (
                      <NodeCard key={item.node.id} item={item} allUsers={allUsers} depth={0} myNodeId={myNodeId} subtreeIds={subtreeIds} />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 범례 */}
      <div className="flex items-center gap-4 mt-2 px-1">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-emerald-400" />
          <span className="text-[9px] font-bold text-slate-400">작성자</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-blue-400" />
          <span className="text-[9px] font-bold text-slate-400">공감</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-rose-400" />
          <span className="text-[9px] font-bold text-slate-400">반대</span>
        </div>
      </div>
    </div>
  );
};

export default GiantTreeMap;
