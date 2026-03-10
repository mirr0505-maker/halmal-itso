// src/components/CreateOneCutBox.tsx
import React, { useState, useEffect, useRef } from 'react';
import type { Post } from '../types';
import { s3Client, BUCKET_NAME, PUBLIC_URL } from '../s3Client';
import { PutObjectCommand } from "@aws-sdk/client-s3";

interface Props {
  userData: any;
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

  const [linkSearch, setLinkedSearch] = useState("");
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
      const fileName = `posts/${userData.uid}/${Date.now()}.${extension}`;
      
      await s3Client.send(new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileName,
        Body: fileData,
        ContentType: file.type,
      }));

      const finalUrl = `${PUBLIC_URL}/${fileName}`;
      setPostData(prev => ({ ...prev, imageUrl: finalUrl }));
    } catch (error: any) {
      console.error("업로드 실패:", error);
      alert("이미지 서버 전송에 실패했소. 미리보기는 유지되오.");
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

  const filteredLinkPosts = allPosts.filter(p => 
    !p.isOneCut && (p.title?.toLowerCase().includes(linkSearch.toLowerCase()) || p.content.toLowerCase().includes(linkSearch.toLowerCase()))
  ).slice(0, 5);

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

  return (
    <div className="w-full max-w-[1200px] mx-auto py-6 animate-in fade-in zoom-in-95 duration-500" onPaste={handlePaste}>
      <div className="bg-white rounded-[3rem] shadow-2xl border border-slate-100 overflow-hidden">
        <div className="px-12 py-10 flex justify-between items-center border-b border-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-rose-500 animate-pulse" />
            <h2 className="text-xl font-[1000] text-slate-900 tracking-tighter">🎞️ 한컷 남기기</h2>
          </div>
          <div className="flex items-center gap-6">
            <button onClick={onClose} className="text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors">취소</button>
            <button onClick={handleSubmit} disabled={isSubmitting || isImageUploading} className="px-10 py-3 bg-[#0F172A] text-white rounded-2xl font-black text-sm hover:opacity-90 transition-all shadow-lg shadow-blue-100 disabled:bg-slate-100 disabled:text-slate-300">
              {isSubmitting ? '게시 중...' : '할말 올리기'}
            </button>
          </div>
        </div>

        <div className="px-12 py-12 grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-7 space-y-10">
            <div className="space-y-3">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">한컷 제목</label>
              <input type="text" placeholder="강렬한 한줄 제목을 적어주시오." value={postData.title} onChange={e => setPostData({...postData, title: e.target.value})} className="w-full bg-slate-50 border-none px-8 py-5 rounded-[1.5rem] text-lg font-black text-slate-800 focus:bg-white focus:ring-4 focus:ring-blue-50 outline-none transition-all placeholder:text-slate-300" />
            </div>

            <div className="space-y-3">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">📸 이미지 업로드</label>
              <div className="flex gap-3">
                <input type="text" placeholder="이미지 주소를 넣거나 붙여넣으시오." value={postData.imageUrl} onChange={e => setPostData({...postData, imageUrl: e.target.value})} className="flex-1 bg-slate-50 border-none px-6 py-4 rounded-2xl text-sm font-bold text-slate-600 focus:bg-white outline-none transition-all" />
                <button onClick={() => fileInputRef.current?.click()} className="px-6 bg-blue-50 text-blue-600 rounded-2xl font-black text-xs hover:bg-blue-100 transition-all shrink-0">사진 선택</button>
                <input type="file" ref={fileInputRef} onChange={e => e.target.files?.[0] && uploadImageToR2(e.target.files[0])} accept="image/*" className="hidden" />
              </div>
            </div>

            <div className="space-y-3 relative">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">🔗 원본 할말 연결</label>
              <input type="text" placeholder="연결할 원본 글 제목 검색..." value={linkSearch} onChange={e => setLinkedSearch(e.target.value)} className="w-full bg-slate-50 border-none px-6 py-4 rounded-2xl text-sm font-bold text-slate-600 focus:bg-white outline-none transition-all" />
              {linkSearch && !postData.linkedPostId && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-100 rounded-2xl shadow-2xl z-20 overflow-hidden">
                  {filteredLinkPosts.map(p => (
                    <div key={p.id} onClick={() => { setPostData({...postData, linkedPostId: p.id}); setLinkedSearch(p.title || ""); }} className="px-6 py-4 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0">
                      <p className="text-sm font-black text-slate-900">{p.title}</p>
                      <p className="text-[10px] text-slate-400 font-bold">{p.author} · {p.category}</p>
                    </div>
                  ))}
                </div>
              )}
              {postData.linkedPostId && <button onClick={() => { setPostData({...postData, linkedPostId: ""}); setLinkedSearch(""); }} className="mt-2 text-[10px] font-black text-rose-500 underline">연결 해제</button>}
            </div>

            <div className="space-y-3">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">상세 설명</label>
              <textarea placeholder="한컷에 대한 보충 설명을 적어주시오." value={postData.content} onChange={e => setPostData({...postData, content: e.target.value})} className="w-full bg-slate-50 border-none px-8 py-6 rounded-[2rem] text-sm font-medium text-slate-700 outline-none focus:bg-white focus:ring-4 focus:ring-blue-50 transition-all resize-none min-h-[150px]" />
            </div>

            <div className="grid grid-cols-5 gap-3">
              {[0,1,2,3,4].map(idx => (
                <input key={idx} type="text" placeholder="#태그" value={postData.tags?.[idx]} onChange={e => { const newTags = [...(postData.tags || [])]; newTags[idx] = e.target.value; setPostData({...postData, tags: newTags}); }} className="w-full bg-slate-50 border-none px-4 py-3 rounded-xl text-[11px] font-black text-blue-600 focus:bg-white outline-none transition-all" />
              ))}
            </div>
          </div>

          <div className="lg:col-span-5 space-y-4">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">📱 한컷 미리보기 (9:16)</label>
            <div className="aspect-[9/16] bg-slate-900 rounded-[3rem] overflow-hidden border-[12px] border-slate-900 shadow-2xl relative flex items-center justify-center">
              {postData.imageUrl ? (
                <>
                  <img src={postData.imageUrl} alt="preview" className={`w-full h-full object-cover ${imageError ? 'hidden' : 'block'}`} onError={() => setImageError(true)} />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
                  <div className="absolute bottom-12 left-8 right-8 text-white">
                    <h3 className="text-xl font-[1000] italic leading-tight mb-3 tracking-tighter">{postData.title || "제목을 입력하시오"}</h3>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-white/20 border border-white/30 overflow-hidden"><img src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${userData?.nickname}`} alt="" /></div>
                      <span className="text-[11px] font-black opacity-80">{userData?.nickname}</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center px-10"><p className="text-slate-600 text-xs font-bold leading-relaxed">이미지를 선택하거나<br/>붙여넣으시오.</p></div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateOneCutBox;
