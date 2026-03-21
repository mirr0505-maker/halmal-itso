// src/components/ProfileEditForm.tsx — 마이페이지 프로필 수정 폼 (닉네임·사진·소개글)
import React from 'react';

interface EditData {
  nickname: string;
  bio: string;
  avatarUrl: string;
}

interface Props {
  editData: EditData;
  setEditData: (data: EditData) => void;
  originalData: EditData;
  isUploading: boolean;
  handleImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleUpdate: () => Promise<void>;
  onCancel: () => void;
}

const ProfileEditForm = ({
  editData, setEditData, originalData, isUploading,
  handleImageUpload, handleUpdate, onCancel
}: Props) => {
  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 w-full">

      {/* 닉네임 수정 */}
      <div className="flex flex-col gap-1.5 text-left">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">닉네임</label>
        <input
          value={editData.nickname}
          onChange={e => setEditData({ ...editData, nickname: e.target.value })}
          className="w-full p-2.5 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold outline-none focus:border-slate-900 transition-all"
        />
      </div>

      {/* 프로필 사진 교체 */}
      <div className="flex flex-col gap-1.5 text-left">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">프로필 사진 교체</label>
        <div className="flex gap-2">
          <input
            type="file" accept="image/*" id="avatar-upload" className="hidden"
            onChange={handleImageUpload} disabled={isUploading}
          />
          <label
            htmlFor="avatar-upload"
            className={`flex-1 flex items-center justify-center p-2.5 bg-blue-50 border-2 border-dashed border-blue-200 rounded-xl text-xs font-black text-blue-600 cursor-pointer hover:bg-blue-100 transition-all ${isUploading ? 'opacity-50 cursor-not-allowed animate-pulse' : ''}`}
          >
            {isUploading ? "사진 전송 중..." : "📸 폴더에서 사진 고르기"}
          </label>
          <button
            onClick={() => setEditData({ ...editData, avatarUrl: "" })}
            className="px-4 bg-rose-50 text-rose-500 rounded-xl text-[10px] font-black border border-rose-100 hover:bg-rose-500 hover:text-white transition-all shadow-sm"
          >삭제</button>
        </div>
      </div>

      {/* 소개글(철학) 수정 */}
      <div className="flex flex-col gap-1.5 text-left">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">나의 철학</label>
        <textarea
          value={editData.bio}
          onChange={e => setEditData({ ...editData, bio: e.target.value })}
          className="w-full p-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm outline-none focus:border-slate-900 h-20 resize-none font-medium leading-relaxed"
          placeholder="자신을 소개해 보세요"
        />
      </div>

      {/* 저장·취소 버튼 */}
      <div className="flex gap-2 justify-center md:justify-start pt-2">
        <button
          onClick={() => { setEditData(originalData); onCancel(); }}
          className="px-5 py-2 bg-white border-2 border-slate-100 rounded-xl font-bold text-slate-400 text-sm hover:bg-slate-50 transition-all"
        >취소</button>
        <button
          onClick={handleUpdate}
          disabled={isUploading}
          className={`px-6 py-2 bg-slate-900 text-white rounded-xl font-bold text-sm shadow-md transition-all ${isUploading ? 'opacity-50' : 'hover:bg-emerald-600 active:scale-95'}`}
        >저장하기</button>
      </div>
    </div>
  );
};

export default ProfileEditForm;
