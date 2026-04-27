// src/components/CreateGiantTree.tsx — 거대 나무 글 작성 폼
import { useState } from 'react';
import { db } from '../firebase';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import type { UserData } from '../types';
import { getReputationLabel, getReputation, calculateLevel } from '../utils';
import { MAX_SPREAD_BY_REPUTATION } from './GiantTreeView';
import AdSlotSetting from './ads/AdSlotSetting';
import { useAdSlotSetting } from './ads/useAdSlotSetting';

interface Props {
  currentNickname?: string;
  currentUserData?: UserData | null;
  onBack: () => void;
  onCreated: (treeId: string) => void;  // 🚀 생성된 treeId 반환 — 상세 뷰 자동 이동용
}

const CreateGiantTree = ({ currentNickname, currentUserData, onBack, onCreated }: Props) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  // 🚀 ADSMARKET: 광고 슬롯 설정
  const { adSlotFields, adSlotEnabled, adSlotType, selectedAds, onAdSlotChange, onSelectAd } = useAdSlotSetting();

  const reputation = getReputationLabel(currentUserData ? getReputation(currentUserData) : 0);
  const maxSpread = MAX_SPREAD_BY_REPUTATION[reputation] || 0;

  const handleSubmit = async () => {
    if (!currentNickname || !currentUserData) return;
    if (!title.trim() || !content.trim()) return;
    if (maxSpread === 0) { alert('평판 등급이 "약간 우호" 이상이어야 나무를 심을 수 있습니다.'); return; }

    setIsSubmitting(true);
    try {
      const treeId = `tree_${Date.now()}_${currentUserData.uid || currentNickname}`;
      const treeRef = doc(collection(db, 'giant_trees'), treeId);
      await setDoc(treeRef, {
        title: title.trim(),
        content: content.trim(),
        author: currentNickname,
        author_id: currentUserData.uid || '',
        authorLevel: calculateLevel(currentUserData?.exp || 0),
        authorReputation: reputation,
        maxSpread,
        totalNodes: 0,
        agreeCount: 0,
        opposeCount: 0,
        circuitBroken: false,
        createdAt: serverTimestamp(),
        ...adSlotFields,
      });
      onCreated(treeId);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-6 animate-in fade-in duration-500">
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="flex items-center gap-1 text-[11px] font-black text-slate-400 hover:text-slate-700 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"/></svg>
          목록으로
        </button>
        <h2 className="text-lg font-[1000] text-slate-900">🌳 나무 심기</h2>
      </div>

      {/* 전파 규모 안내 */}
      <div className="mb-5 flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
        <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        <p className="text-[12px] font-bold text-emerald-700">
          내 평판 등급 <span className="font-black">{reputation}</span> 기준으로 최대 <span className="font-black text-emerald-800">{maxSpread}명</span>에게 전파됩니다.
        </p>
      </div>

      {/* 제목 */}
      <div className="mb-4">
        <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">주장 제목</label>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="전파할 주장의 핵심을 한 문장으로 적어주세요"
          maxLength={80}
          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-[14px] font-bold text-slate-800 outline-none focus:border-emerald-400 placeholder:text-slate-300 bg-white"
        />
        <span className="text-[10px] font-bold text-slate-300 float-right mt-1">{title.length}/80</span>
      </div>

      {/* 본문 */}
      <div className="mb-6 clear-both">
        <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">주장 본문</label>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="주장의 근거, 배경, 설명을 자세히 작성해주세요. 전파받은 사람이 읽고 판단합니다."
          rows={8}
          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-[13.5px] font-medium text-slate-700 outline-none focus:border-emerald-400 placeholder:text-slate-300 bg-white resize-none leading-relaxed"
        />
      </div>

      {/* 🚀 ADSMARKET: 광고 슬롯 설정 (Lv5+) */}
      <div className="mb-4 border border-slate-100 rounded-xl overflow-hidden">
        <AdSlotSetting userLevel={calculateLevel(currentUserData?.exp || 0)} adSlotEnabled={adSlotEnabled} adSlotType={adSlotType}
          onChange={onAdSlotChange}
          selectedAds={selectedAds} onSelectAd={onSelectAd}
          postCategory="거대나무" />
      </div>

      {/* 제출 */}
      <div className="flex gap-2">
        <button onClick={onBack} className="px-5 py-2.5 text-[12px] font-bold text-slate-400 hover:text-slate-600 rounded-xl border border-slate-200 transition-colors">
          취소
        </button>
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || !title.trim() || !content.trim() || maxSpread === 0}
          className="flex-1 py-2.5 text-[13px] font-[1000] bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-40 transition-colors"
        >
          {isSubmitting ? '심는 중...' : '🌱 나무 심기'}
        </button>
      </div>
    </div>
  );
};

export default CreateGiantTree;
