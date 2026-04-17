// src/components/CreateKanbuRoomModal.tsx — 깐부방 개설 모달
// 🚀 2026-04-17: 대표 이미지(16:9) R2 업로드 + 카드 표시 옵션 4종 (호스트/멤버/땡스볼/유료프리뷰)
import { useState } from 'react';
import type { KanbuRoom } from '../types';
import { uploadToR2 } from '../uploadToR2';

interface CreatePayload extends Pick<KanbuRoom, 'title' | 'description'> {
  thumbnailUrl?: string;
  cardSettings?: KanbuRoom['cardSettings'];
}

interface Props {
  onSubmit: (data: CreatePayload) => Promise<void>;
  onClose: () => void;
  userUid?: string;                // 표지 R2 업로드 경로용
}

const CreateKanbuRoomModal = ({ onSubmit, onClose, userUid }: Props) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 카드 표시 옵션 (기본 모두 on)
  const [showHostInfo, setShowHostInfo] = useState(true);
  const [showMember, setShowMember] = useState(true);
  const [showThanksball, setShowThanksball] = useState(true);
  const [showPaidPreview, setShowPaidPreview] = useState(true);

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 업로드 가능합니다.');
      return;
    }
    setThumbnailFile(file);
    setThumbnailPreview(URL.createObjectURL(file));
  };

  const handleRemoveThumbnail = () => {
    setThumbnailFile(null);
    if (thumbnailPreview) URL.revokeObjectURL(thumbnailPreview);
    setThumbnailPreview(null);
  };

  const handleSubmit = async () => {
    if (!title.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      // R2 업로드 (선택)
      let thumbnailUrl: string | undefined;
      if (thumbnailFile && userUid) {
        setIsUploading(true);
        const ext = thumbnailFile.name.split('.').pop() || 'jpg';
        const filePath = `uploads/${userUid}/kanburoom_thumb_${Date.now()}.${ext}`;
        const url = await uploadToR2(thumbnailFile, filePath);
        setIsUploading(false);
        if (url) thumbnailUrl = url;
      }
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        thumbnailUrl,
        cardSettings: { showHostInfo, showMember, showThanksball, showPaidPreview },
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <h3 className="text-[15px] font-[1000] text-slate-900 tracking-tight">새 깐부방 개설</h3>
          <button onClick={onClose} className="text-slate-300 hover:text-slate-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4">
          <div>
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">방 제목 *</label>
            <input
              type="text"
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="깐부방 이름을 입력하세요"
              maxLength={30}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-[14px] font-bold text-slate-800 outline-none focus:border-blue-400 transition-colors"
            />
          </div>
          <div>
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">방 소개 (선택)</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="이 방에 대한 짧은 소개를 적어보세요"
              maxLength={100}
              rows={3}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-[13px] font-bold text-slate-700 outline-none focus:border-blue-400 transition-colors resize-none"
            />
          </div>

          {/* 🚀 대표 이미지 (16:9) */}
          <div>
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">방 표지 이미지 (선택, 16:9 권장)</label>
            {thumbnailPreview ? (
              <div className="relative">
                <div className="aspect-[16/9] rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                  <img src={thumbnailPreview} alt="미리보기" className="w-full h-full object-cover" />
                </div>
                <button
                  onClick={handleRemoveThumbnail}
                  className="absolute top-2 right-2 bg-white/90 hover:bg-white rounded-full w-7 h-7 flex items-center justify-center shadow-md transition-all"
                >
                  <svg className="w-3.5 h-3.5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center aspect-[16/9] rounded-xl border-2 border-dashed border-slate-200 cursor-pointer hover:border-blue-300 hover:bg-slate-50 transition-colors">
                <svg className="w-8 h-8 text-slate-300 mb-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-[11px] font-bold text-slate-400">이미지 업로드 (선택)</span>
                <input type="file" accept="image/*" onChange={handleThumbnailChange} className="hidden" />
              </label>
            )}
          </div>

          {/* 🚀 카드 표시 옵션 */}
          <div>
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-2">카드 표시 옵션</label>
            <div className="flex flex-col gap-1 border border-slate-100 rounded-xl p-3 bg-slate-50/50">
              {[
                { key: 'host',  label: '호스트 정보 (Lv·평판)', value: showHostInfo,   set: setShowHostInfo   },
                { key: 'mem',   label: '멤버 수',                 value: showMember,     set: setShowMember     },
                { key: 'ball',  label: '땡스볼 합계',             value: showThanksball, set: setShowThanksball },
                { key: 'paid',  label: '유료/구독 최신글 스니펫', value: showPaidPreview,set: setShowPaidPreview},
              ].map(opt => (
                <label key={opt.key} className="flex items-center justify-between cursor-pointer select-none py-1">
                  <span className="text-[12px] font-bold text-slate-600">{opt.label}</span>
                  <input
                    type="checkbox"
                    checked={opt.value}
                    onChange={e => opt.set(e.target.checked)}
                    className="w-4 h-4 accent-blue-600"
                  />
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2 px-6 pb-5 sticky bottom-0 bg-white pt-3 border-t border-slate-50">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl text-[13px] font-bold text-slate-400 hover:bg-slate-50 transition-colors border border-slate-100">
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={!title.trim() || isSubmitting || isUploading}
            className="flex-1 py-3 rounded-xl text-[13px] font-[1000] bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isUploading ? '이미지 업로드 중...' : isSubmitting ? '개설 중...' : '깐부방 개설'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateKanbuRoomModal;
