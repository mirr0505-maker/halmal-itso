// src/components/CommunityAdminPanel.tsx — 🚀 다섯 손가락 Phase 3: 관리 탭 패널
// 승인 대기 처리 + 장갑 설정 수정 + 공지 고정 + 장갑 폐쇄 (thumb/index 전용)
import { useState, useRef } from 'react';
import { db, functions } from '../firebase';
import { doc, updateDoc, deleteField, collection, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { uploadToR2 } from '../uploadToR2';
import type { Community, CommunityMember, FingerRole, PromotionRules, InfoBotSource } from '../types';
import { DEFAULT_PROMOTION_RULES } from '../types';
import JoinAnswersDisplay from './JoinAnswersDisplay';
import { STANDARD_FIELD_LABELS } from '../utils/joinForm';

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
  // 🧤 대표 이미지 수정
  const [newThumbnailFile, setNewThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(community.thumbnailUrl || null);
  const [removeThumbnail, setRemoveThumbnail] = useState(false);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  // 🧤 채팅 바탕화면 수정
  const [newChatBgFile, setNewChatBgFile] = useState<File | null>(null);
  const [chatBgPreview, setChatBgPreview] = useState<string | null>(community.chatBgUrl || null);
  const [removeChatBg, setRemoveChatBg] = useState(false);
  const chatBgInputRef = useRef<HTMLInputElement>(null);
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
      // 🧤 대표 이미지 R2 업로드 (새 파일이 있을 때만)
      let thumbnailUpdate: Record<string, unknown> = {};
      if (newThumbnailFile) {
        const ext = newThumbnailFile.name.split('.').pop() || 'jpg';
        const filePath = `uploads/${community.creatorId}/community_thumb_${Date.now()}.${ext}`;
        const url = await uploadToR2(newThumbnailFile, filePath);
        if (url) thumbnailUpdate = { thumbnailUrl: url };
      } else if (removeThumbnail) {
        thumbnailUpdate = { thumbnailUrl: deleteField() };
      }
      // 🧤 채팅 바탕화면 R2 업로드
      let chatBgUpdate: Record<string, unknown> = {};
      if (newChatBgFile) {
        const ext = newChatBgFile.name.split('.').pop() || 'jpg';
        const filePath = `uploads/${community.creatorId}/community_chatbg_${Date.now()}.${ext}`;
        const url = await uploadToR2(newChatBgFile, filePath);
        if (url) chatBgUpdate = { chatBgUrl: url };
      } else if (removeChatBg) {
        chatBgUpdate = { chatBgUrl: deleteField() };
      }
      await updateDoc(doc(db, 'communities', community.id), {
        name: editName.trim(),
        description: editDesc.trim(),
        category: editCategory,
        coverColor: editColor,
        ...thumbnailUpdate,
        ...chatBgUpdate,
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
    <div className="flex flex-col gap-4 mt-4 max-w-md mx-auto">
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
          {/* 🧤 대표 이미지 */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">대표 이미지</label>
            <input
              ref={thumbnailInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 5 * 1024 * 1024) { alert('이미지는 5MB 이하만 업로드할 수 있습니다.'); return; }
                setNewThumbnailFile(file);
                setThumbnailPreview(URL.createObjectURL(file));
                setRemoveThumbnail(false);
              }}
            />
            {thumbnailPreview && !removeThumbnail ? (
              <div className="relative w-2/3 aspect-[16/9] rounded-lg overflow-hidden border border-slate-200">
                <img src={thumbnailPreview} alt="대표 이미지" className="w-full h-full object-cover" />
                <div className="absolute top-1.5 right-1.5 flex gap-1">
                  <button type="button" onClick={() => thumbnailInputRef.current?.click()}
                    className="w-6 h-6 bg-black/50 text-white rounded-full text-[11px] flex items-center justify-center hover:bg-black/70">✎</button>
                  <button type="button" onClick={() => { setNewThumbnailFile(null); setThumbnailPreview(null); setRemoveThumbnail(true); if (thumbnailInputRef.current) thumbnailInputRef.current.value = ''; }}
                    className="w-6 h-6 bg-black/50 text-white rounded-full text-[11px] flex items-center justify-center hover:bg-red-600">×</button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => thumbnailInputRef.current?.click()}
                className="w-2/3 aspect-[16/9] border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center gap-2 hover:border-blue-300 transition-all">
                <span className="text-[14px]">📷</span>
                <span className="text-[10px] font-bold text-slate-400">이미지 선택 (5MB 이하)</span>
              </button>
            )}
          </div>
          {/* 🧤 채팅 바탕화면 */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">채팅 바탕화면</label>
            <input
              ref={chatBgInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 5 * 1024 * 1024) { alert('이미지는 5MB 이하만 업로드할 수 있습니다.'); return; }
                setNewChatBgFile(file);
                setChatBgPreview(URL.createObjectURL(file));
                setRemoveChatBg(false);
              }}
            />
            {chatBgPreview && !removeChatBg ? (
              <div className="relative w-2/3 aspect-[16/9] rounded-lg overflow-hidden border border-slate-200">
                <img src={chatBgPreview} alt="채팅 바탕화면" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-white/50" />
                <p className="absolute bottom-1.5 left-0 right-0 text-center text-[9px] font-bold text-slate-500">채팅 배경 미리보기</p>
                <div className="absolute top-1.5 right-1.5 flex gap-1">
                  <button type="button" onClick={() => chatBgInputRef.current?.click()}
                    className="w-6 h-6 bg-black/50 text-white rounded-full text-[11px] flex items-center justify-center hover:bg-black/70">✎</button>
                  <button type="button" onClick={() => { setNewChatBgFile(null); setChatBgPreview(null); setRemoveChatBg(true); if (chatBgInputRef.current) chatBgInputRef.current.value = ''; }}
                    className="w-6 h-6 bg-black/50 text-white rounded-full text-[11px] flex items-center justify-center hover:bg-red-600">×</button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => chatBgInputRef.current?.click()}
                className="w-2/3 aspect-[16/9] border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center gap-2 hover:border-blue-300 transition-all">
                <span className="text-[14px]">💬</span>
                <span className="text-[10px] font-bold text-slate-400">채팅 배경 이미지 선택</span>
              </button>
            )}
          </div>
          <button onClick={handleSaveSettings} disabled={isSaving}
            className={`w-full py-2 rounded-lg text-[13px] font-black transition-all ${isSaving ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-900 text-white hover:bg-blue-600'}`}>
            {isSaving ? '저장 중...' : '설정 저장'}
          </button>
        </div>
      </div>

      {/* 🧤 닉네임 배지 설정 */}
      <div className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-3 border-b border-slate-100">
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">🏷️ 닉네임 배지</p>
        </div>
        <div className="px-5 py-4">
          {community.joinForm ? (
            <>
              <p className="text-[9px] font-bold text-slate-400 mb-2">가입 답변 중 하나를 선택하면 채팅/댓글에서 닉네임 옆에 표시됩니다</p>
              <BadgeKeySelector community={community} />
            </>
          ) : (
            <p className="text-[10px] font-bold text-slate-400 italic">승인제(가입 폼)를 설정하면 배지 필드를 선택할 수 있습니다</p>
          )}
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

      {/* 🤖 정보봇 — 주식 장갑 전용 */}
      {isOwner && community.category === '주식' && (() => {
        const bot = community.infoBot;
        const isActive = bot?.enabled && bot?.expiresAt && (bot.expiresAt as unknown as { toMillis?: () => number }).toMillis
          ? (bot.expiresAt as unknown as { toMillis: () => number }).toMillis() > Date.now()
          : false;
        const msLeft = isActive && bot?.expiresAt
          ? (bot.expiresAt as unknown as { toMillis: () => number }).toMillis() - Date.now()
          : 0;
        const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
        const hoursLeft = Math.ceil(msLeft / (1000 * 60 * 60));

        return (
          <InfoBotPanel
            community={community}
            isActive={isActive}
            daysLeft={daysLeft}
            hoursLeft={hoursLeft}
          />
        );
      })()}

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

// 🧤 닉네임 배지 필드 선택 (관리 탭용)
function BadgeKeySelector({ community }: { community: Community }) {
  const [selected, setSelected] = useState(community.displayBadgeKey || '');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const form = community.joinForm;
  if (!form) return null;

  const enabledFields = form.standardFields.filter(f => f.enabled);
  const customQs = form.customQuestions?.filter(q => q.label?.trim()) || [];

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'communities', community.id), {
        displayBadgeKey: selected || null,
      });
      setMsg('✅ 저장되었습니다.');
    } catch { setMsg('저장에 실패했습니다.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex items-center gap-2 text-[11px] font-bold text-slate-600 cursor-pointer">
        <input type="radio" name="adminBadgeKey" value="" checked={selected === ''} onChange={() => setSelected('')} className="w-3 h-3" />
        사용 안 함
      </label>
      {enabledFields.map(f => (
        <label key={f.key} className="flex items-center gap-2 text-[11px] font-bold text-slate-600 cursor-pointer">
          <input type="radio" name="adminBadgeKey" value={f.key} checked={selected === f.key} onChange={() => setSelected(f.key)} className="w-3 h-3" />
          {STANDARD_FIELD_LABELS[f.key]} {f.key === 'shares' && '(K단위)'}
        </label>
      ))}
      {customQs.map(q => (
        <label key={q.id} className="flex items-center gap-2 text-[11px] font-bold text-slate-600 cursor-pointer">
          <input type="radio" name="adminBadgeKey" value={q.id} checked={selected === q.id} onChange={() => setSelected(q.id)} className="w-3 h-3" />
          {q.label}
        </label>
      ))}
      {msg && <p className={`text-[10px] font-bold ${msg.startsWith('✅') ? 'text-emerald-600' : 'text-red-500'}`}>{msg}</p>}
      <button onClick={handleSave} disabled={saving}
        className="mt-1 w-full py-1.5 rounded-lg text-[12px] font-black bg-slate-900 text-white hover:bg-blue-600 transition-all disabled:opacity-50">
        {saving ? '저장 중...' : '배지 설정 저장'}
      </button>
    </div>
  );
}

// 🤖 정보봇 관리 패널 (주식 장갑 전용, 대장만 사용)
function InfoBotPanel({ community, isActive, daysLeft, hoursLeft }: { community: Community; isActive: boolean; daysLeft: number; hoursLeft: number }) {
  // 남은 시간 표시: 1일 이상이면 D-N일, 24시간 미만이면 N시간
  const remainLabel = daysLeft >= 1 ? `D-${daysLeft}일` : `${Math.max(1, hoursLeft)}시간`;
  const ALL_SOURCES: { id: InfoBotSource; icon: string; label: string }[] = [
    { id: 'news', icon: '📰', label: '뉴스 기사' },
    { id: 'dart', icon: '📋', label: 'DART 공시' },
    { id: 'price', icon: '📈', label: '주가 변동 알림' },
    { id: 'policy', icon: '🏛️', label: '정부 정책' },
  ];
  // Phase 1에서는 news만 활성, 나머지는 "준비 중"
  // Phase 1: news, Phase 2: dart 활성화. price/policy는 준비 중.
  const AVAILABLE_SOURCES: InfoBotSource[] = ['news', 'dart'];

  const bot = community.infoBot;
  const [keywords, setKeywords] = useState<string[]>(bot?.keywords || []);
  const [newKeyword, setNewKeyword] = useState('');
  const [sources, setSources] = useState<InfoBotSource[]>(bot?.sources || ['news']);
  const [stockCode, setStockCode] = useState(bot?.stockCode || '');
  const [corpCode, setCorpCode] = useState(bot?.corpCode || '');
  const [corpName, setCorpName] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const addKeyword = () => {
    const k = newKeyword.trim();
    if (!k || keywords.length >= 5 || keywords.includes(k)) return;
    setKeywords(prev => [...prev, k]);
    setNewKeyword('');
  };

  const handleActivate = async () => {
    if (sources.includes('news') && keywords.length === 0) { setMessage('뉴스 소스를 선택하려면 키워드를 1개 이상 입력해주세요.'); return; }
    if (sources.includes('dart') && !corpCode.trim()) { setMessage('DART 공시 소스를 선택하려면 DART 고유번호를 입력해주세요.'); return; }
    if (sources.length === 0) { setMessage('최소 1개 소스를 선택해주세요.'); return; }
    if (!window.confirm('정보봇을 활성화하면 20볼이 차감됩니다. 진행하시겠습니까?')) return;
    setIsProcessing(true);
    setMessage(null);
    try {
      const fn = httpsCallable(functions, 'activateInfoBot');
      await fn({ communityId: community.id, keywords, sources, stockCode: stockCode || null, corpCode: corpCode || null, priceAlertThresholds: [5, 10, 15, 20, 25, 30] });
      setMessage('✅ 정보봇이 활성화되었습니다! (30일간)');
    } catch (err: unknown) {
      const e = err as { message?: string };
      setMessage(e.message || '활성화에 실패했습니다.');
    } finally { setIsProcessing(false); }
  };

  const handleDeactivate = async () => {
    if (!window.confirm('정보봇을 중지하시겠습니까? 남은 기간에 대한 환불은 없습니다.')) return;
    setIsProcessing(true);
    try {
      const fn = httpsCallable(functions, 'deactivateInfoBot');
      await fn({ communityId: community.id });
      setMessage('⏹ 정보봇이 중지되었습니다.');
    } catch (err: unknown) {
      const e = err as { message?: string };
      setMessage(e.message || '중지에 실패했습니다.');
    } finally { setIsProcessing(false); }
  };

  const handleUpdate = async () => {
    if (keywords.length === 0) { setMessage('키워드를 1개 이상 입력해주세요.'); return; }
    setIsProcessing(true);
    setMessage(null);
    try {
      const fn = httpsCallable(functions, 'updateInfoBot');
      await fn({ communityId: community.id, keywords, sources, stockCode: stockCode || null, corpCode: corpCode || null });
      setMessage('✅ 설정이 수정되었습니다.');
    } catch (err: unknown) {
      const e = err as { message?: string };
      setMessage(e.message || '수정에 실패했습니다.');
    } finally { setIsProcessing(false); }
  };

  return (
    <div className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm">
      <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">🤖 정보봇</p>
        {isActive && (
          <span className="text-[10px] font-[1000] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
            ✅ 활성 · {remainLabel}
          </span>
        )}
      </div>
      <div className="px-5 py-4 flex flex-col gap-3">
        {/* 키워드 */}
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">검색 키워드 (최대 5개)</label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {keywords.map((k, i) => (
              <span key={i} className="flex items-center gap-1 bg-blue-50 text-blue-700 text-[11px] font-bold px-2 py-0.5 rounded-full">
                {k}
                <button type="button" onClick={() => setKeywords(prev => prev.filter((_, idx) => idx !== i))} className="text-blue-400 hover:text-red-500">×</button>
              </span>
            ))}
          </div>
          {keywords.length < 5 && (
            <div className="flex gap-1.5">
              <input type="text" value={newKeyword} onChange={(e) => setNewKeyword(e.target.value)} maxLength={30}
                placeholder="예: 삼성전자" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addKeyword(); } }}
                className="flex-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-[12px] font-bold outline-none focus:border-blue-400" />
              <button type="button" onClick={addKeyword} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[11px] font-black hover:bg-blue-700">추가</button>
            </div>
          )}
        </div>

        {/* 종목코드 입력 → DART 고유번호 자동 조회 */}
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">종목코드</label>
          <div className="flex gap-1.5">
            <input type="text" value={stockCode}
              onChange={(e) => { setStockCode(e.target.value); setCorpCode(''); setCorpName(''); }}
              maxLength={10} placeholder="예: 005930"
              className="w-28 border border-slate-200 rounded-lg px-2.5 py-1.5 text-[12px] font-bold outline-none focus:border-blue-400" />
            <button type="button" disabled={!stockCode.trim() || lookupLoading}
              onClick={async () => {
                setLookupLoading(true);
                setCorpName(''); setCorpCode('');
                try {
                  const fn = httpsCallable(functions, 'lookupCorpCode');
                  const res = await fn({ stockCode: stockCode.trim() });
                  const data = res.data as { corpCode: string; corpName: string };
                  setCorpCode(data.corpCode);
                  setCorpName(data.corpName);
                } catch {
                  setMessage('종목코드를 찾을 수 없습니다. 매핑 동기화가 필요할 수 있습니다.');
                } finally { setLookupLoading(false); }
              }}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[11px] font-black hover:bg-blue-700 disabled:opacity-50">
              {lookupLoading ? '...' : '조회'}
            </button>
          </div>
          {corpCode && (
            <p className="text-[10px] font-bold text-emerald-600 mt-1">
              ✅ {corpName} (DART: {corpCode})
            </p>
          )}
          {/* DART 매핑 동기화 — 최초 1회 또는 신규 상장 반영 시 */}
          <button type="button" disabled={lookupLoading}
            onClick={async () => {
              if (!window.confirm('DART 전체 상장 기업 매핑을 동기화합니다. 1~2분 소요될 수 있습니다.')) return;
              setLookupLoading(true);
              try {
                const fn = httpsCallable(functions, 'triggerSyncDartCorpMap');
                const res = await fn({});
                const data = res.data as { count: number };
                setMessage(`✅ DART 매핑 동기화 완료 — ${data.count}개 기업`);
              } catch {
                setMessage('DART 매핑 동기화에 실패했습니다.');
              } finally { setLookupLoading(false); }
            }}
            className="text-[9px] font-bold text-slate-400 hover:text-blue-500 mt-1 underline underline-offset-2">
            🔄 DART 매핑 동기화 (최초 1회)
          </button>
        </div>

        {/* 소스 선택 */}
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">정보 소스</label>
          <div className="flex flex-col gap-1.5">
            {ALL_SOURCES.map(s => {
              const available = AVAILABLE_SOURCES.includes(s.id);
              const checked = sources.includes(s.id);
              return (
                <label key={s.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                  !available ? 'border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed' :
                  checked ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-white hover:border-blue-200 cursor-pointer'
                }`}>
                  <input type="checkbox" checked={checked} disabled={!available}
                    onChange={(e) => {
                      if (e.target.checked) setSources(prev => [...prev, s.id]);
                      else setSources(prev => prev.filter(x => x !== s.id));
                    }}
                    className="w-3.5 h-3.5 rounded" />
                  <span className="text-[12px] font-bold text-slate-700">{s.icon} {s.label}</span>
                  {!available && <span className="text-[9px] font-bold text-slate-400 ml-auto">준비 중</span>}
                </label>
              );
            })}
          </div>
        </div>

        {/* 상태 메시지 */}
        {message && (
          <div className={`p-2.5 rounded-lg text-[11px] font-bold ${message.startsWith('✅') || message.startsWith('⏹') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
            {message}
          </div>
        )}

        {/* 누적 정보 (활성 상태일 때) */}
        {isActive && bot && (
          <div className="text-[10px] font-bold text-slate-400">
            누적 결제: {bot.totalPaid || 0}볼
          </div>
        )}

        {/* 액션 버튼 */}
        <div className="flex gap-2">
          {isActive ? (
            <>
              <button onClick={handleUpdate} disabled={isProcessing}
                className="flex-1 py-2 rounded-lg text-[12px] font-black bg-slate-900 text-white hover:bg-blue-600 transition-all disabled:opacity-50">
                {isProcessing ? '처리 중...' : '설정 수정'}
              </button>
              <button onClick={handleDeactivate} disabled={isProcessing}
                className="px-4 py-2 rounded-lg text-[12px] font-black border border-red-300 text-red-500 hover:bg-red-50 transition-all disabled:opacity-50">
                중지
              </button>
            </>
          ) : (
            <button onClick={handleActivate} disabled={isProcessing || keywords.length === 0}
              className="w-full py-2.5 rounded-lg text-[12px] font-black bg-blue-600 text-white hover:bg-blue-700 transition-all disabled:opacity-50">
              {isProcessing ? '처리 중...' : '💰 정보봇 시작하기 — 월 20볼'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default CommunityAdminPanel;
