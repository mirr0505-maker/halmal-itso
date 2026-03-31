// src/components/CreateOneCutBox.tsx — 한컷 작성/수정 폼 (이미지 업로드 + 미리보기)
import React, { useState, useRef } from 'react';
import type { Post, UserData } from '../types';
import { s3Client, BUCKET_NAME, PUBLIC_URL } from '../s3Client';
import { PutObjectCommand } from "@aws-sdk/client-s3";
import LinkSearchModal from './LinkSearchModal';

interface Props {
  userData: UserData;
  editingPost: Post | null;
  allPosts: Post[];
  onSubmit: (postData: Partial<Post>, postId?: string) => Promise<void>;
  onClose: () => void;
}

const CreateOneCutBox = ({ userData, editingPost, allPosts, onSubmit, onClose }: Props) => {
  const [postData, setPostData] = useState<Partial<Post>>({
    title: editingPost?.title || '',
    content: editingPost?.content || '',
    category: '한컷',
    tags: editingPost?.tags || ['', '', '', '', ''],
    imageUrl: editingPost?.imageUrl || '',
    isOneCut: true,
    linkedPostId: editingPost?.linkedPostId || '',
  });

  const [showLinkModal, setShowLinkModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isImageUploading, setIsImageUploading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadImageToR2 = async (file: File) => {
    if (!userData) return;
    setIsImageUploading(true);
    setImageError(false);
    const localPreviewUrl = URL.createObjectURL(file);
    setPostData(prev => ({ ...prev, imageUrl: localPreviewUrl }));

    try {
      const arrayBuffer = await file.arrayBuffer();
      const fileData = new Uint8Array(arrayBuffer);
      const extension = file.name.split('.').pop();
      const fileName = `uploads/${userData.uid}/${Date.now()}.${extension}`;
      
      await s3Client.send(new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileName,
        Body: fileData,
        ContentType: file.type,
      }));

      const finalUrl = `${PUBLIC_URL}/${fileName}`;
      setPostData(prev => ({ ...prev, imageUrl: finalUrl }));
    } catch (error: unknown) {
      console.error("업로드 실패:", error);
      alert("이미지 전송에 실패했습니다. 미리보기는 유지됩니다.");
    } finally {
      setIsImageUploading(false);
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) await uploadImageToR2(file);
      }
    }
  };

  // 내 글 목록 (한컷 제외) — LinkSearchModal에 전달
  const myPosts = allPosts.filter(p => !p.isOneCut && p.author === userData?.nickname);
  const selectedLinkPost = myPosts.find(p => p.id === postData.linkedPostId);

  const handleSubmit = async () => {
    if (!postData.imageUrl) { alert("한컷은 이미지가 필수이오!"); return; }
    setIsSubmitting(true);
    try {
      const filteredTags = (postData.tags || []).filter(tag => tag.trim() !== '');
      await onSubmit({ ...postData, tags: filteredTags }, editingPost?.id);
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
            <h2 className="text-[17px] font-[1000] text-slate-900 tracking-tighter">🎞️ 새 한컷 기록</h2>
          </div>
          <div className="flex items-center gap-6">
            <button onClick={onClose} className="text-[14px] font-bold text-slate-400 hover:text-slate-600 transition-colors cursor-pointer">취소</button>
            <button 
              onClick={handleSubmit}
              disabled={isSubmitting || isImageUploading}
              className={`px-10 py-2.5 rounded-2xl font-black text-[14px] transition-all shadow-xl shadow-rose-100/50 ${
                isSubmitting || isImageUploading ? 'bg-slate-100 text-slate-300' : 'bg-[#0F172A] text-white hover:scale-[1.02] active:scale-95 cursor-pointer'
              }`}
            >
              {isSubmitting ? '기록 중...' : isImageUploading ? '사진 전송 중...' : '한컷 올리기'}
            </button>
          </div>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <div className="px-10 py-10 grid grid-cols-1 lg:grid-cols-12 gap-12">
            {/* Left Section: Inputs */}
            <div className="lg:col-span-7 space-y-10">
              <div className="space-y-3">
                <label className="text-[11px] font-black text-slate-400 ml-1 uppercase tracking-widest">한컷 제목</label>
                <input type="text" placeholder="강렬한 한 줄 제목을 입력하세요." value={postData.title} onChange={e => setPostData(prev => ({...prev, title: e.target.value}))} className="w-full bg-slate-50 border-2 border-transparent px-8 py-5 rounded-[1.5rem] text-[18px] font-black text-slate-900 focus:bg-white focus:border-rose-500 outline-none transition-all placeholder:text-slate-200" />
              </div>

              <div className="space-y-3">
                <label className="text-[11px] font-black text-slate-400 ml-1 uppercase tracking-widest">📸 메인 이미지 (9:16)</label>
                <div className="flex gap-3">
                  <input type="text" placeholder="이미지 주소를 입력하거나 아래에 붙여넣으세요." value={postData.imageUrl || ''} onChange={e => setPostData(prev => ({...prev, imageUrl: e.target.value}))} className="flex-1 bg-slate-50 border-2 border-transparent px-6 py-4 rounded-2xl text-[14px] font-bold text-slate-600 focus:bg-white focus:border-rose-500 outline-none transition-all placeholder:text-slate-300" />
                  <button onClick={() => fileInputRef.current?.click()} className="px-8 bg-[#0F172A] text-white rounded-2xl font-black text-[13px] hover:bg-slate-800 transition-all shrink-0 shadow-lg shadow-slate-100">사진 선택</button>
                  <input type="file" ref={fileInputRef} onChange={e => e.target.files?.[0] && uploadImageToR2(e.target.files[0])} accept="image/*" className="hidden" />
                </div>
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
                <label className="text-[11px] font-black text-slate-400 ml-1 uppercase tracking-widest">상세 설명</label>
                <textarea placeholder="한컷에 대한 보충 설명을 입력하세요." value={postData.content ?? ''} onChange={e => setPostData(prev => ({...prev, content: e.target.value}))} className="w-full bg-slate-50 border-2 border-transparent px-8 py-6 rounded-[2rem] text-[15px] font-medium text-slate-700 outline-none focus:bg-white focus:border-rose-500 transition-all resize-none min-h-[180px] leading-relaxed" />
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
            </div>

            {/* Right Section: Mobile Preview */}
            <div className="lg:col-span-5 space-y-4">
              <div className="sticky top-0 space-y-4">
                <label className="text-[11px] font-black text-slate-400 ml-1 uppercase tracking-widest">📱 한컷 미리보기 (9:16)</label>
                <div className="aspect-[9/16] bg-slate-900 rounded-[3.5rem] overflow-hidden border-[12px] border-[#0F172A] shadow-2xl relative flex items-center justify-center group">
                  {postData.imageUrl ? (
                    <>
                      <img src={postData.imageUrl} alt="preview" className={`w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 ${imageError ? 'hidden' : 'block'}`} onError={() => setImageError(true)} />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent pointer-events-none" />
                      <div className="absolute bottom-12 left-10 right-10 text-white">
                        <h3 className="text-[24px] font-[1000] italic leading-tight mb-4 tracking-tighter drop-shadow-lg">{postData.title || "제목을 입력하세요"}</h3>
                        <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl w-fit border border-white/10">
                          <div className="w-7 h-7 rounded-full bg-white/20 overflow-hidden"><img src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${userData?.nickname}`} alt="" className="w-full h-full object-cover" /></div>
                          <span className="text-[12px] font-black opacity-90">{userData?.nickname}</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-center px-10"><p className="text-slate-600 text-[13px] font-black leading-relaxed">이미지를 선택하거나<br/>여기에 붙여넣으세요.</p></div>
                  )}
                  {isImageUploading && (
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center animate-in fade-in">
                      <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin" />
                    </div>
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
