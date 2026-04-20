import type { UserData } from '../types';
// src/components/ProfileHeader.tsx

interface ProfileHeaderProps {
  userData: UserData;
  isEditing: boolean;
  setIsEditing: (val: boolean) => void;
  friendCount: number;    // 내가 맺은 깐부 수 (팔로잉)
  followerCount?: number; // 나를 맺은 깐부 수 (팔로워)
  totalThanksball?: number;
}

const getThanksballBadge = (total: number) => {
  if (total >= 100) return { label: '⚾ 프리미엄 기여자', bg: 'bg-rose-50', text: 'text-rose-600', border: 'border-rose-100' };
  if (total >= 30)  return { label: '⚾ 골드 기여자',     bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-100' };
  if (total >= 10)  return { label: '⚾ 블루 기여자',     bg: 'bg-blue-50',  text: 'text-blue-600',  border: 'border-blue-100' };
  if (total >= 1)   return { label: '⚾ 땡스볼 수신',     bg: 'bg-slate-50', text: 'text-slate-500', border: 'border-slate-100' };
  return null;
};

const ProfileHeader = ({
  userData, isEditing, setIsEditing, friendCount, followerCount = 0, totalThanksball = 0
}: ProfileHeaderProps) => {
  const thanksballBadge = getThanksballBadge(totalThanksball);

  return (
    <div className="flex flex-col md:flex-row items-center md:items-start gap-6 relative z-10">
      {/* 📸 아바타 영역 */}
      <div className="relative shrink-0 group">
        <div className={`w-24 h-24 rounded-full overflow-hidden border-2 ${isEditing ? 'border-blue-500 ring-2 ring-blue-50' : 'border-white'} shadow-md bg-slate-50 flex items-center justify-center transition-all duration-300 relative`}>
          {userData.avatarUrl ? (
            <img src={userData.avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <svg className="w-10 h-10 text-slate-200" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
          )}
        </div>
        
        {!isEditing && (
          <button 
            onClick={() => setIsEditing(true)} 
            className="absolute bottom-0 right-0 w-7 h-7 bg-white rounded-full flex items-center justify-center border border-slate-100 text-slate-900 shadow-md hover:scale-110 hover:bg-slate-900 hover:text-white transition-all z-20"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
          </button>
        )}
      </div>

      <div className="flex-1 pt-1 w-full text-center md:text-left">
        <div className="flex flex-col md:flex-row items-center gap-2 mb-2 justify-center md:justify-start">
          <h2 className="text-[18px] font-[1000] text-slate-900 tracking-tight leading-tight">{userData.nickname}</h2>
          <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-full text-[9px] font-black border border-blue-100 uppercase shadow-sm">인증됨</span>
        </div>
        
        <div className="flex flex-col gap-2 mb-4 items-center md:items-start">
          <p className="text-[13px] text-slate-500 font-bold leading-relaxed max-w-md italic">
            "{userData.bio || "안녕하세요. 글러브 회원입니다."}"
          </p>

          <div className="flex items-center gap-2 flex-wrap justify-center md:justify-start">
            <span className="text-[11px] text-slate-400 font-black tracking-tight">{userData.email}</span>
            <div className="h-2 w-[1px] bg-slate-200 hidden sm:block" />
            {thanksballBadge && (
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border shadow-sm ${thanksballBadge.bg} ${thanksballBadge.text} ${thanksballBadge.border}`}>
                {thanksballBadge.label}
              </span>
            )}
            
            {userData.isPhoneVerified ? (
              <div className="flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100/50">
                <svg className="w-2.5 h-2.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>
                <span className="text-[10px] text-emerald-600 font-black">인증 완료</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-100/50 animate-pulse shadow-sm">
                <svg className="w-3 h-3 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                <span className="text-[10px] text-rose-500 font-black">핸드폰 미인증</span>
              </div>
            )}
            <div className="h-2 w-[1px] bg-slate-200 hidden sm:block" />
            {/* 🚀 깐부 수 표시: 팔로잉(내가 맺은) vs 팔로워(나를 맺은) 명확히 분리 */}
            <span className="text-[11px] text-slate-400 font-black tracking-tight">깐부 {friendCount}명</span>
            <span className="text-[10px] text-slate-300 font-bold tracking-tight">깐부수 {followerCount}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileHeader;
