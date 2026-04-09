// src/components/CommunityAdminPanel.tsx — 🚀 다섯 손가락 Phase 3: 관리 탭 패널
// 승인 대기 처리 + 장갑 설정 수정 + 공지 고정 + 장갑 폐쇄 (thumb/index 전용)
import { useState } from 'react';
import { db } from '../firebase';
import { doc, updateDoc, collection, getDocs, query, where, writeBatch } from 'firebase/firestore';
import type { Community, CommunityMember, FingerRole, PromotionRules } from '../types';
import { DEFAULT_PROMOTION_RULES } from '../types';
import JoinAnswersDisplay from './JoinAnswersDisplay';

const COVER_COLORS = [
  { value: '#3b82f6', label: '블루' }, { value: '#10b981', label: '에메랄드' },
  { value: '#f59e0b', label: '앰버' }, { value: '#ef4444', label: '레드' },
  { value: '#8b5cf6', label: '바이올렛' }, { value: '#ec4899', label: '핑크' },
  { value: '#0ea5e9', label: '스카이' }, { value: '#64748b', label: '슬레이트' },
];
const CATEGORIES = ['주식', '부동산', '코인', '취미', '스포츠', '게임', '독서', '요리', '반려동물', '여행', '음악', '개발', '기타'];

interface Props {
  community: Community;
  myFinger: FingerRole | null;
  pendingMembers: CommunityMember[];
  onApprove: (m: CommunityMember) => void;
  onReject: (m: CommunityMember) => void;
  onClosed: () => void; // 장갑 폐쇄 후 목록으로 이동
}

const CommunityAdminPanel = ({ community, myFinger, pendingMembers, onApprove, onReject, onClosed }: Props) => {
  // 설정 수정 상태
  const [editName, setEditName] = useState(community.name);
  const [editDesc, setEditDesc] = useState(community.description ?? '');
  const [editCategory, setEditCategory] = useState(community.category);
  const [editColor, setEditColor] = useState(community.coverColor ?? '#3b82f6');
  const [isSaving, setIsSaving] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  // 🚀 승급 조건 설정
  const rules = community.promotionRules ?? DEFAULT_PROMOTION_RULES;
  const [promoRules, setPromoRules] = useState<PromotionRules>(rules);
  const [isSavingPromo, setIsSavingPromo] = useState(false);

  const isOwner = myFinger === 'thumb';

  // 🚀 장갑 설정 저장 (thumb/index 가능)
  const handleSaveSettings = async () => {
    if (!editName.trim()) { alert('커뮤니티 이름을 입력해주세요.'); return; }
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'communities', community.id), {
        name: editName.trim(),
        description: editDesc.trim(),
        category: editCategory,
        coverColor: editColor,
      });
      alert('설정이 저장되었습니다.');
    } finally { setIsSaving(false); }
  };

  // 🚀 공지 고정 해제 (pinnedPostId 제거)
  const handleUnpin = async () => {
    await updateDoc(doc(db, 'communities', community.id), { pinnedPostId: null });
  };

  // 🚀 장갑 폐쇄 — thumb 전용, 2단계 confirm + batch 삭제
  const handleCloseCommunity = async () => {
    if (!isOwner) return;
    const step1 = window.confirm(`"${community.name}" 장갑을 폐쇄하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다. 모든 멤버십 데이터가 삭제됩니다.`);
    if (!step1) return;
    const step2 = window.confirm(`정말로 폐쇄합니다. 마지막 확인입니다.\n\n"${community.name}"을 삭제하려면 확인을 클릭하세요.`);
    if (!step2) return;

    setIsClosing(true);
    try {
      // 멤버십 일괄 삭제
      const memSnap = await getDocs(query(collection(db, 'community_memberships'), where('communityId', '==', community.id)));
      const batch = writeBatch(db);
      memSnap.docs.forEach(d => batch.delete(d.ref));
      batch.delete(doc(db, 'communities', community.id));
      await batch.commit();
      onClosed();
    } catch (err) {
      alert('폐쇄 중 오류가 발생했습니다.');
      console.error('[closeCommunity]', err);
    } finally { setIsClosing(false); }
  };

  return (
    <div className="flex flex-col gap-4 mt-4">
      {/* 승인 대기 섹션 */}
      {pendingMembers.length > 0 && (
        <div className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm">
          <div className="px-5 py-3 border-b border-slate-50 bg-blue-50">
            <p className="text-[11px] font-black text-blue-600 uppercase tracking-widest">🔔 승인 대기 {pendingMembers.length}명</p>
          </div>
          {pendingMembers.map(m => (
            <div key={m.userId} className="px-5 py-4 border-b border-slate-50 last:border-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <img src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${m.nickname}`} className="w-9 h-9 rounded-full bg-slate-50 shrink-0" alt="" />
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-slate-800">{m.nickname}</p>
                    {/* 🚀 Phase 6: joinAnswers가 없는 구형 신청은 joinMessage만 표시 */}
                    {!m.joinAnswers && m.joinMessage && (
                      <p className="text-[11px] font-medium text-slate-400 mt-0.5">"{m.joinMessage}"</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => onApprove(m)} className="px-3 py-1.5 rounded-lg text-[12px] font-black bg-blue-600 text-white hover:bg-blue-700 transition-colors">승인</button>
                  <button onClick={() => onReject(m)} className="px-3 py-1.5 rounded-lg text-[12px] font-black bg-slate-100 text-slate-500 hover:bg-red-50 hover:text-red-500 transition-colors">거절</button>
                </div>
              </div>
              {/* 🚀 Phase 6: 구조화된 가입 답변 표시 */}
              {m.joinAnswers && <JoinAnswersDisplay answers={m.joinAnswers} />}
            </div>
          ))}
        </div>
      )}

      {/* 장갑 설정 수정 */}
      <div className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-3 border-b border-slate-100">
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">⚙️ 장갑 설정 수정</p>
        </div>
        <div className="px-5 py-4 flex flex-col gap-3">
          {/* 이름 */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">이름</label>
            <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={30}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] font-bold text-slate-900 outline-none focus:border-blue-400 transition-colors" />
          </div>
          {/* 설명 */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">한 줄 설명</label>
            <input type="text" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} maxLength={60}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] font-bold text-slate-900 outline-none focus:border-blue-400 transition-colors" />
          </div>
          {/* 카테고리 */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">분야</label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map(cat => (
                <button key={cat} type="button" onClick={() => setEditCategory(cat)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all ${editCategory === cat ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'}`}>
                  {cat}
                </button>
              ))}
            </div>
          </div>
          {/* 대표 색상 */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">대표 색상</label>
            <div className="flex gap-2">
              {COVER_COLORS.map(c => (
                <button key={c.value} type="button" onClick={() => setEditColor(c.value)}
                  style={{ backgroundColor: c.value }}
                  className={`w-6 h-6 rounded-full border-2 transition-all ${editColor === c.value ? 'border-slate-900 scale-110' : 'border-transparent'}`} title={c.label} />
              ))}
            </div>
          </div>
          <button onClick={handleSaveSettings} disabled={isSaving}
            className={`w-full py-2 rounded-lg text-[13px] font-black transition-all ${isSaving ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-900 text-white hover:bg-blue-600'}`}>
            {isSaving ? '저장 중...' : '설정 저장'}
          </button>
        </div>
      </div>

      {/* 🚀 멤버 승급 조건 설정 */}
      <div className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-3 border-b border-slate-100">
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">📊 멤버 승급 조건</p>
        </div>
        <div className="px-5 py-4 flex flex-col gap-4">
          {/* 새내기 → 멤버 */}
          <div>
            <p className="text-[12px] font-[1000] text-slate-700 mb-2">🤙 새내기 → 🤝 멤버</p>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-bold text-slate-500">글</span>
              <input type="number" min={1} max={100} value={promoRules.toRing.posts}
                onChange={(e) => setPromoRules(prev => ({ ...prev, toRing: { ...prev.toRing, posts: parseInt(e.target.value) || 1 } }))}
                className="w-16 border border-slate-200 rounded-lg px-2 py-1 text-[13px] font-bold text-center outline-none focus:border-blue-400" />
              <span className="text-[11px] font-bold text-slate-500">개 이상 OR 좋아요</span>
              <input type="number" min={1} max={999} value={promoRules.toRing.likes}
                onChange={(e) => setPromoRules(prev => ({ ...prev, toRing: { ...prev.toRing, likes: parseInt(e.target.value) || 1 } }))}
                className="w-16 border border-slate-200 rounded-lg px-2 py-1 text-[13px] font-bold text-center outline-none focus:border-blue-400" />
              <span className="text-[11px] font-bold text-slate-500">개 이상</span>
            </div>
          </div>
          {/* 멤버 → 핵심멤버 */}
          <div>
            <p className="text-[12px] font-[1000] text-slate-700 mb-2">🤝 멤버 → 🖐 핵심멤버</p>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-bold text-slate-500">글</span>
              <input type="number" min={1} max={100} value={promoRules.toMiddle.posts}
                onChange={(e) => setPromoRules(prev => ({ ...prev, toMiddle: { ...prev.toMiddle, posts: parseInt(e.target.value) || 1 } }))}
                className="w-16 border border-slate-200 rounded-lg px-2 py-1 text-[13px] font-bold text-center outline-none focus:border-blue-400" />
              <span className="text-[11px] font-bold text-slate-500">개 이상 OR 좋아요</span>
              <input type="number" min={1} max={999} value={promoRules.toMiddle.likes}
                onChange={(e) => setPromoRules(prev => ({ ...prev, toMiddle: { ...prev.toMiddle, likes: parseInt(e.target.value) || 1 } }))}
                className="w-16 border border-slate-200 rounded-lg px-2 py-1 text-[13px] font-bold text-center outline-none focus:border-blue-400" />
              <span className="text-[11px] font-bold text-slate-500">개 이상</span>
            </div>
          </div>
          <button onClick={async () => {
            setIsSavingPromo(true);
            try {
              await updateDoc(doc(db, 'communities', community.id), { promotionRules: promoRules });
              alert('승급 조건이 저장되었습니다.');
            } finally { setIsSavingPromo(false); }
          }} disabled={isSavingPromo}
            className={`w-full py-2 rounded-lg text-[13px] font-black transition-all ${isSavingPromo ? 'bg-slate-100 text-slate-400' : 'bg-slate-900 text-white hover:bg-blue-600'}`}>
            {isSavingPromo ? '저장 중...' : '승급 조건 저장'}
          </button>
        </div>
      </div>

      {/* 공지 고정 현황 */}
      {community.pinnedPostId && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-black text-amber-700">📌 공지 고정 중</p>
            <p className="text-[10px] font-bold text-amber-500 mt-0.5">글 목록에서 핀 버튼으로 변경 가능</p>
          </div>
          <button onClick={handleUnpin} className="text-[11px] font-black text-amber-600 hover:text-amber-800 px-3 py-1.5 rounded-lg hover:bg-amber-100 transition-colors">고정 해제</button>
        </div>
      )}

      {/* 장갑 폐쇄 — thumb 전용 */}
      {isOwner && (
        <div className="bg-white border border-red-100 rounded-xl px-5 py-4">
          <p className="text-[12px] font-black text-red-500 mb-1">🗑️ 장갑 폐쇄</p>
          <p className="text-[11px] font-bold text-slate-400 mb-3">폐쇄하면 모든 멤버십 데이터가 삭제됩니다. 게시글은 별도 보관됩니다.</p>
          <button onClick={handleCloseCommunity} disabled={isClosing}
            className="w-full py-2 rounded-lg text-[12px] font-black border border-red-300 text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50">
            {isClosing ? '폐쇄 중...' : '이 장갑 폐쇄하기'}
          </button>
        </div>
      )}
    </div>
  );
};

export default CommunityAdminPanel;
