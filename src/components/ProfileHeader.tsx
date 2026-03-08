// src/components/ProfileHeader.tsx
import React, { useRef } from 'react';

interface ProfileHeaderProps {
  userData: any;
  isEditing: boolean;
  editData: { nickname: string; bio: string; avatarUrl: string };
  isUploading: boolean;
  setEditData: React.Dispatch<React.SetStateAction<{ nickname: string; bio: string; avatarUrl: string }>>;
  setIsEditing: (val: boolean) => void;
  onAvatarUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSave: () => void;
}

const ProfileHeader = ({ 
  userData, isEditing, editData, isUploading, 
  setEditData, setIsEditing, onAvatarUpload, onSave 
}: ProfileHeaderProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col md:flex-row items-center md:items-start gap-6 relative z-10">
      {/* 📸 아바타 영역 */}
      <div className="relative shrink-0 group">
        <div className={`w-24 h-24 rounded-full overflow-hidden border-2 ${isEditing ? 'border-blue-500 ring-2 ring-blue-50' : 'border-white'} shadow-md bg-slate-50 flex items-center justify-center transition-all duration-300 relative`}>
          {(isEditing ? editData.avatarUrl : userData.avatarUrl) ? (
            <img src={isEditing ? editData.avatarUrl : userData.avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <svg className="w-10 h-10 text-slate-200" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
          )}
          {isUploading && <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-[1px]"><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /></div>}
          
          {isEditing && (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="absolute inset-0 bg-black/30 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            >
              <svg className="w-5 h-5 text-white mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              <span className="text-white text-[8px] font-black uppercase tracking-widest">변경</span>
            </div>
          )}
        </div>
        <input type="file" ref={fileInputRef} onChange={onAvatarUpload} className="hidden" accept="image/*" />
        
        {!isEditing && (
          <button 
            onClick={() => {
              setEditData({ nickname: userData.nickname, bio: userData.bio, avatarUrl: userData.avatarUrl });
              setIsEditing(true);
            }} 
            className="absolute bottom-0 right-0 w-7 h-7 bg-white rounded-full flex items-center justify-center border border-slate-100 text-slate-900 shadow-md hover:scale-110 hover:bg-slate-900 hover:text-white transition-all z-20"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
          </button>
        )}
      </div>

      <div className="flex-1 pt-1 w-full text-center md:text-left">
        <div className="flex flex-col md:flex-row items-center gap-2 mb-2 justify-center md:justify-start">
          {isEditing ? (
            <input 
              type="text" 
              value={editData.nickname} 
              onChange={e => setEditData(prev => ({ ...prev, nickname: e.target.value }))} 
              className="text-[18px] font-[1000] text-slate-900 border-b border-blue-600 outline-none bg-transparent w-full md:w-auto tracking-tight" 
              autoFocus 
            />
          ) : (
            <>
              <h2 className="text-[18px] font-[1000] text-slate-900 tracking-tight leading-tight">{userData.nickname}</h2>
              <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-full text-[9px] font-black border border-blue-100 uppercase shadow-sm">인증됨</span>
            </>
          )}
        </div>
        
        <div className="flex flex-col gap-2 mb-4 items-center md:items-start">
          {isEditing ? (
            <textarea 
              value={editData.bio} 
              onChange={e => setEditData(prev => ({ ...prev, bio: e.target.value }))}
              className="w-full max-w-md p-3 text-[13px] font-bold text-slate-700 bg-slate-50 border border-slate-200 outline-none focus:border-blue-600 rounded-lg resize-none h-20 transition-all"
              placeholder="소개글을 입력해 주세요."
            />
          ) : (
            <p className="text-[13px] text-slate-500 font-bold leading-relaxed max-w-md italic">
              "{userData.bio || "안녕하세요. 할말있소 회원입니다."}"
            </p>
          )}

          <div className="flex items-center gap-2 flex-wrap justify-center md:justify-start">
            <span className="text-[11px] text-slate-400 font-black tracking-tight">{userData.email}</span>
            <div className="h-2 w-[1px] bg-slate-200 hidden sm:block" />
            
            {userData.isPhoneVerified ? (
              <div className="flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100/50">
                <svg className="w-2.5 h-2.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>
                <span className="text-[10px] text-emerald-600 font-black">인증 완료</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-100/50 animate-pulse shadow-sm">
                {/* 자물쇠 아이콘 강조 */}
                <svg className="w-3 h-3 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                <span className="text-[10px] text-rose-500 font-black">핸드폰 미인증</span>
              </div>
            )}
          </div>
        </div>

        {isEditing && (
          <div className="flex gap-2 justify-center md:justify-start">
            <button onClick={onSave} className="bg-slate-900 text-white px-5 py-2 rounded-lg text-[12px] font-[1000] shadow-md hover:bg-blue-600 transition-all active:scale-95">저장하기</button>
            <button onClick={() => setIsEditing(false)} className="bg-white text-slate-400 border border-slate-200 px-4 py-2 rounded-lg text-[12px] font-[1000] hover:bg-slate-50 transition-all active:scale-95">취소</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileHeader;
