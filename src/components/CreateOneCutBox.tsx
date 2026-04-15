// src/components/CreateOneCutBox.tsx — 🍞 헨젤의 빵부스러기 작성/수정 폼
// 1~4컷 슬롯 업로드 + 캐러셀 미리보기 (v1.1 HANSEL_BREADCRUMBS.md §5.1)
import React, { useState, useRef } from 'react';
import type { Post, UserData } from '../types';
import { uploadToR2 } from '../uploadToR2';
import LinkSearchModal from './LinkSearchModal';
import AdSlotSetting from './ads/AdSlotSetting';
import { useAdSlotSetting } from './ads/useAdSlotSetting';
import { calculateLevel } from '../utils';

interface Props {
  userData: UserData;
  editingPost: Post | null;
  allPosts: Post[];
  onSubmit: (postData: Partial<Post>, postId?: string) => Promise<void>;
  onClose: () => void;
}

const MAX_SLOTS = 4;

const CreateOneCutBox = ({ userData, editingPost, allPosts, onSubmit, onClose }: Props) => {
  // 🍞 초기 imageUrls — 수정 모드면 기존 배열, 없으면 단일 imageUrl → 1개 배열로 변환 (하위호환)
  const initialUrls: string[] = editingPost?.imageUrls?.length
    ? [...editingPost.imageUrls]
    : (editingPost?.imageUrl ? [editingPost.imageUrl] : []);

  const [postData, setPostData] = useState<Partial<Post>>({
    title: editingPost?.title || '',
    content: editingPost?.content || '',
    category: '한컷',
    tags: editingPost?.tags || ['', '', '', '', ''],
    imageUrl: initialUrls[0] || '',
    isOneCut: true,
    linkedPostId: editingPost?.linkedPostId || '',
  });
  const [imageUrls, setImageUrls] = useState<string[]>(initialUrls);
  const [previewIdx, setPreviewIdx] = useState(0);

  const [showLinkModal, setShowLinkModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // 슬롯별 업로드 진행 상태 (인덱스)
  const [uploadingSlot, setUploadingSlot] = useState<number | null>(null);
  // 🚀 ADSMARKET: 광고 슬롯 설정
  const { adSlotFields, adSlotEnabled, adSlotType, onAdSlotChange } = useAdSlotSetting();
  const fileInputRefs = useRef<Array<HTMLInputElement | null>>([]);

  // 지정 슬롯 이미지 업데이트 (imageUrls + imageUrl[0] 동기화)
  const updateSlotUrl = (idx: number, url: string) => {
    setImageUrls(prev => {
      const next = [...prev];
      next[idx] = url;
      setPostData(p => ({ ...p, imageUrl: next[0] || '' }));
      return next;
    });
  };

  const uploadToSlot = async (idx: number, file: File) => {
    if (!userData) return;
    setUploadingSlot(idx);
    // 즉시 로컬 미리보기 — 업로드 완료 후 최종 URL로 교체
    const localPreviewUrl = URL.createObjectURL(file);
    updateSlotUrl(idx, localPreviewUrl);

    try {
      const extension = file.name.split('.').pop();
      const fileName = `uploads/${userData.uid}/${Date.now()}_${idx}.${extension}`;
      const finalUrl = await uploadToR2(file, fileName);
      updateSlotUrl(idx, finalUrl);
    } catch (error: unknown) {
      console.error("업로드 실패:", error);
      alert("이미지 전송에 실패했습니다. 미리보기는 유지됩니다.");
    } finally {
      setUploadingSlot(null);
    }
  };

  const addSlot = () => {
    if (imageUrls.length >= MAX_SLOTS) return;
    setImageUrls(prev => [...prev, '']);
  };

  const removeSlot = (idx: number) => {
    setImageUrls(prev => {
      const next = prev.filter((_, i) => i !== idx);
      setPostData(p => ({ ...p, imageUrl: next[0] || '' }));
      if (previewIdx >= next.length) setPreviewIdx(Math.max(0, next.length - 1));
      return next;
    });
  };

  // 붙여넣기 — 다음 빈 슬롯 또는 신규 슬롯에 삽입
  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (!file) continue;
        // 빈 슬롯 우선 채우기, 없으면 신규 슬롯(최대 4)
        const emptyIdx = imageUrls.findIndex(u => !u);
        let targetIdx = emptyIdx;
        if (targetIdx < 0) {
          if (imageUrls.length >= MAX_SLOTS) { alert('최대 4컷까지만 가능합니다.'); return; }
          targetIdx = imageUrls.length;
          setImageUrls(prev => [...prev, '']);
        }
        await uploadToSlot(targetIdx, file);
      }
    }
  };

  // 내 글 목록 (한컷 제외) — LinkSearchModal에 전달
  const myPosts = allPosts.filter(p => !p.isOneCut && p.author === userData?.nickname);
  const selectedLinkPost = myPosts.find(p => p.id === postData.linkedPostId);

  const filledUrls = imageUrls.filter(u => !!u);
  const handleSubmit = async () => {
    if (filledUrls.length === 0) { alert("최소 1컷은 이미지가 필요하오!"); return; }
    setIsSubmitting(true);
    try {
      const filteredTags = (postData.tags || []).filter(tag => tag.trim() !== '');
      // 🍞 imageUrl = imageUrls[0] 동시 저장 (하위호환 — 기존 피드/썸네일 코드 그대로 동작)
      await onSubmit({
        ...postData,
        imageUrls: filledUrls,
        imageUrl: filledUrls[0],
        tags: filteredTags,
        ...adSlotFields,
      }, editingPost?.id);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTagChange = (index: number, value: string) => {
    setPostData(prev => {
      const newTags = [...(prev.tags || ['', '', '', '', ''])];
      newTags[index] = value;
      return { ...prev, tags: newTags };
    });
  };

  return (
    <div className="w-full max-w-[1200px] mx-auto py-6 animate-in fade-in slide-in-from-bottom-4 duration-500" onPaste={handlePaste}>
      <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header - Fixed */}
        <div className="px-10 py-7 flex justify-between items-center border-b border-slate-50 bg-white z-[60] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
            <h2 className="text-[17px] font-[1000] text-slate-900 tracking-tighter"><span className="grayscale opacity-80">🍞</span> 새 빵부스러기 기록</h2>
          </div>
          <div className="flex items-center gap-6">
            <button onClick={onClose} className="text-[14px] font-bold text-slate-400 hover:text-slate-600 transition-colors cursor-pointer">취소</button>
            <button 
              onClick={handleSubmit}
              disabled={isSubmitting || uploadingSlot !== null}
              className={`px-10 py-2.5 rounded-2xl font-black text-[14px] transition-all shadow-xl shadow-rose-100/50 ${
                isSubmitting || uploadingSlot !== null ? 'bg-slate-100 text-slate-300' : 'bg-[#0F172A] text-white hover:scale-[1.02] active:scale-95 cursor-pointer'
              }`}
            >
              {isSubmitting ? '기록 중...' : uploadingSlot !== null ? '사진 전송 중...' : '빵부스러기 올리기'}
            </button>
          </div>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <div className="px-10 py-10 grid grid-cols-1 lg:grid-cols-12 gap-12">
            {/* Left Section: Inputs */}
            <div className="lg:col-span-7 space-y-10">
              <div className="space-y-3">
                <label className="text-[11px] font-black text-slate-400 ml-1 uppercase tracking-widest">제목</label>
                <input type="text" placeholder="강렬한 한 줄 제목을 입력하세요." value={postData.title} onChange={e => setPostData(prev => ({...prev, title: e.target.value}))} className="w-full bg-slate-50 border-2 border-transparent px-8 py-5 rounded-[1.5rem] text-[18px] font-black text-slate-900 focus:bg-white focus:border-rose-500 outline-none transition-all placeholder:text-slate-200" />
              </div>

              {/* 🍞 가이드 박스 — 빵부스러기 작성 팁 */}
              <div className="p-4 bg-amber-50/60 border border-amber-100 rounded-2xl">
                <p className="text-[11px] font-[1000] text-amber-700 mb-1.5">💡 빵부스러기 잘 뿌리는 법</p>
                <p className="text-[11px] font-bold text-slate-500 leading-relaxed">
                  1컷: 시선 집중 (어그로) · 2컷: 상황 설명 (공감) · 3컷: 위기/반전 · 4컷: 절단신공 또는 요약 + 🔗 연계
                  <br />
                  👉 마지막 컷에서 결말을 보여주지 말고 원본글로 유도해보세요.
                </p>
              </div>

              {/* 🍞 이미지 슬롯 1~4컷 */}
              <div className="space-y-3">
                <label className="text-[11px] font-black text-slate-400 ml-1 uppercase tracking-widest">📸 이미지 슬롯 (최대 4컷, 16:9 권장)</label>
                <div className="grid grid-cols-2 gap-3">
                  {/* 최소 1개 슬롯은 항상 표시 */}
                  {(imageUrls.length === 0 ? [''] : imageUrls).map((url, idx) => {
                    const isEmpty = !url;
                    return (
                      <div key={idx} className="relative aspect-[16/9] bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl overflow-hidden group">
                        {url ? (
                          <img src={url} alt={`컷 ${idx + 1}`} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-slate-300">
                            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                            <span className="text-[11px] font-black">{idx + 1}컷</span>
                          </div>
                        )}
                        {/* 업로드 버튼 (슬롯 전체 클릭) */}
                        <button
                          type="button"
                          onClick={() => fileInputRefs.current[idx]?.click()}
                          className={`absolute inset-0 flex items-center justify-center transition-all ${isEmpty ? 'hover:bg-slate-100/40' : 'bg-black/0 hover:bg-black/30 opacity-0 hover:opacity-100'}`}
                        >
                          <span className={`px-3 py-1.5 rounded-full text-[11px] font-black ${isEmpty ? 'text-slate-400' : 'bg-white text-slate-900 shadow-lg'}`}>{isEmpty ? '사진 선택' : '교체'}</span>
                        </button>
                        <input
                          type="file"
                          ref={el => { fileInputRefs.current[idx] = el; }}
                          onChange={e => e.target.files?.[0] && uploadToSlot(idx, e.target.files[0])}
                          accept="image/*"
                          className="hidden"
                        />
                        {/* 위치 배지 */}
                        <span className="absolute top-2 left-2 px-2 py-0.5 bg-black/60 text-white text-[10px] font-black rounded-full">{idx + 1}/{Math.max(imageUrls.length, 1)}</span>
                        {/* 삭제 버튼 — 슬롯이 2개 이상일 때만 표시 */}
                        {imageUrls.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeSlot(idx)}
                            className="absolute top-2 right-2 w-6 h-6 bg-black/60 hover:bg-rose-500 text-white rounded-full flex items-center justify-center transition-colors"
                            aria-label={`컷 ${idx + 1} 삭제`}
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                          </button>
                        )}
                        {/* 업로드 스피너 */}
                        {uploadingSlot === idx && (
                          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center">
                            <div className="w-7 h-7 border-4 border-white border-t-transparent rounded-full animate-spin" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {/* + 다음 컷 추가 버튼 */}
                {imageUrls.length < MAX_SLOTS && (
                  <button
                    type="button"
                    onClick={addSlot}
                    className="w-full py-3 bg-slate-50 hover:bg-slate-100 border-2 border-dashed border-slate-200 hover:border-slate-300 rounded-2xl text-[12px] font-black text-slate-500 transition-all"
                  >
                    + 다음 컷 추가 ({imageUrls.length}/{MAX_SLOTS})
                  </button>
                )}
              </div>

              <div className="space-y-3">
                <label className="text-[11px] font-black text-slate-400 ml-1 uppercase tracking-widest">🔗 원본 글 연결 (선택)</label>

                {postData.linkedPostId && selectedLinkPost ? (
                  /* 연결된 글 표시 */
                  <div className="flex items-center justify-between p-5 bg-blue-50 rounded-2xl border-2 border-blue-100">
                    <div className="flex flex-col gap-1 min-w-0 mr-4">
                      <span className="text-[10px] font-black text-blue-400 uppercase tracking-wider">연결됨</span>
                      <p className="text-[14px] font-black text-slate-900 truncate">{selectedLinkPost.title}</p>
                      <p className="text-[11px] text-slate-400 font-bold">{selectedLinkPost.category}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setShowLinkModal(true)}
                        className="flex items-center gap-1.5 text-[11px] font-black text-blue-500 hover:text-blue-600 bg-white px-3 py-2 rounded-xl border border-blue-100 transition-colors"
                      >변경</button>
                      <button
                        onClick={() => setPostData(prev => ({...prev, linkedPostId: ""}))}
                        className="flex items-center gap-1.5 text-[11px] font-black text-rose-500 hover:text-rose-600 bg-white px-3 py-2 rounded-xl border border-rose-100 transition-colors"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        해제
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowLinkModal(true)}
                    className="w-full flex items-center gap-3 px-6 py-4 bg-slate-50 hover:bg-blue-50 border-2 border-dashed border-slate-200 hover:border-blue-300 rounded-2xl transition-all group"
                  >
                    <svg className="w-5 h-5 text-slate-300 group-hover:text-blue-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                    <span className="text-[13px] font-black text-slate-400 group-hover:text-blue-500 transition-colors">원본 글 검색하여 연결하기</span>
                  </button>
                )}
              </div>

              <div className="space-y-3">
                <label className="text-[11px] font-black text-slate-400 ml-1 uppercase tracking-widest">태그</label>
                <div className="grid grid-cols-5 gap-3">
                  {[0,1,2,3,4].map(idx => (
                    <div key={idx} className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-rose-400 font-black text-[13px]">#</span>
                      <input type="text" placeholder="태그" value={postData.tags?.[idx]} onChange={e => handleTagChange(idx, e.target.value)} className="w-full bg-slate-50 border-2 border-transparent pl-8 pr-3 py-3 rounded-xl text-[12px] font-black text-slate-700 focus:bg-white focus:border-rose-500 outline-none transition-all placeholder:text-slate-300" />
                    </div>
                  ))}
                </div>
              </div>

              {/* 🚀 ADSMARKET: 광고 슬롯 설정 (Lv5+) */}
              <AdSlotSetting userLevel={calculateLevel(userData?.exp || 0)} adSlotEnabled={adSlotEnabled} adSlotType={adSlotType}
                onChange={onAdSlotChange} />
            </div>

            {/* Right Section: 캐러셀 미리보기 */}
            <div className="lg:col-span-5 space-y-4">
              <div className="sticky top-0 space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-black text-slate-400 ml-1 uppercase tracking-widest">🖼️ 빵부스러기 미리보기 (16:9)</label>
                  {filledUrls.length > 0 && (
                    <span className="text-[10px] font-black text-slate-400">{previewIdx + 1} / {filledUrls.length}</span>
                  )}
                </div>
                <div className="aspect-[16/9] bg-slate-900 rounded-xl overflow-hidden border-4 border-[#0F172A] shadow-2xl relative flex items-center justify-center group">
                  {filledUrls.length > 0 ? (
                    <>
                      <img src={filledUrls[Math.min(previewIdx, filledUrls.length - 1)]} alt="preview" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
                      {/* 🍞 마지막 컷에만 CTA 미리보기 — 원본글 링크 연결 시 */}
                      {(previewIdx === filledUrls.length - 1) && (postData.linkedPostId || postData.linkUrl) && (
                        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 px-5 py-2.5 bg-black/70 backdrop-blur-sm text-white rounded-full text-[12px] font-black shadow-xl whitespace-nowrap border border-white/20">
                          🔗 숨겨진 자세한 이야기 보러가기
                        </div>
                      )}
                      <div className="absolute bottom-4 left-6 right-6 text-white">
                        <h3 className="text-[18px] font-[1000] italic leading-tight mb-2 tracking-tighter drop-shadow-lg line-clamp-2">{postData.title || "제목을 입력하세요"}</h3>
                        <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-xl w-fit border border-white/10">
                          <div className="w-5 h-5 rounded-full bg-white/20 overflow-hidden"><img src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${userData?.nickname}`} alt="" className="w-full h-full object-cover" /></div>
                          <span className="text-[11px] font-black opacity-90">{userData?.nickname}</span>
                        </div>
                      </div>
                      {/* 좌/우 화살표 — 2컷 이상일 때만 */}
                      {filledUrls.length > 1 && (
                        <>
                          <button type="button" onClick={() => setPreviewIdx(i => Math.max(0, i - 1))} disabled={previewIdx === 0}
                            className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/50 hover:bg-black/70 disabled:opacity-30 text-white rounded-full flex items-center justify-center transition-all"
                            aria-label="이전 컷">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
                          </button>
                          <button type="button" onClick={() => setPreviewIdx(i => Math.min(filledUrls.length - 1, i + 1))} disabled={previewIdx === filledUrls.length - 1}
                            className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/50 hover:bg-black/70 disabled:opacity-30 text-white rounded-full flex items-center justify-center transition-all"
                            aria-label="다음 컷">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
                          </button>
                          {/* 인디케이터 점 */}
                          <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
                            {filledUrls.map((_, i) => (
                              <button key={i} type="button" onClick={() => setPreviewIdx(i)}
                                className={`w-1.5 h-1.5 rounded-full transition-all ${i === previewIdx ? 'bg-white w-4' : 'bg-white/40'}`}
                                aria-label={`컷 ${i + 1}로 이동`} />
                            ))}
                          </div>
                        </>
                      )}
                    </>
                  ) : (
                    <div className="text-center px-10"><p className="text-slate-600 text-[13px] font-black leading-relaxed">이미지를 선택하거나<br/>여기에 붙여넣으세요.</p></div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* 원본 글 검색 팝업 모달 */}
      {showLinkModal && (
        <LinkSearchModal
          myPosts={myPosts}
          onSelectPost={(postId) => { setPostData(prev => ({...prev, linkedPostId: postId})); setShowLinkModal(false); }}
          onClose={() => setShowLinkModal(false)}
        />
      )}
    </div>
  );
};

export default CreateOneCutBox;
