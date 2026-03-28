// src/components/CreateCommunityModal.tsx — 장갑 나누기: 커뮤니티 개설 폼
// 🚀 개설 조건: Lv3 이상 (GLOVE_CREATE_MIN_LEVEL, App.tsx에서 검증)
import { useState } from 'react';

const CATEGORIES = ['주식', '부동산', '코인', '취미', '스포츠', '게임', '독서', '요리', '반려동물', '여행', '음악', '개발', '기타'];

const COVER_COLORS = [
  { value: '#3b82f6', label: '블루' },
  { value: '#10b981', label: '에메랄드' },
  { value: '#f59e0b', label: '앰버' },
  { value: '#ef4444', label: '레드' },
  { value: '#8b5cf6', label: '바이올렛' },
  { value: '#ec4899', label: '핑크' },
  { value: '#0ea5e9', label: '스카이' },
  { value: '#64748b', label: '슬레이트' },
];

interface Props {
  userData: any;
  onSubmit: (data: { name: string; description: string; category: string; isPrivate: boolean; coverColor?: string }) => Promise<void>;
  onClose: () => void;
}

const CreateCommunityModal = ({ userData: _userData, onSubmit, onClose }: Props) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('취미');
  const [isPrivate, setIsPrivate] = useState(false);
  const [coverColor, setCoverColor] = useState('#3b82f6');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) { alert('커뮤니티 이름을 입력해주세요.'); return; }
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onSubmit({ name: name.trim(), description: description.trim(), category, isPrivate, coverColor });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-[16px] font-black text-slate-900">🧤 장갑 나누기</h2>
            <p className="text-[11px] font-bold text-slate-400 mt-0.5">나만의 따뜻한 커뮤니티를 만들어보세요</p>
          </div>
          <button onClick={onClose} className="text-slate-300 hover:text-slate-500 transition-colors text-[20px] leading-none">×</button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4">
          {/* 커뮤니티 이름 */}
          <div>
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">커뮤니티 이름 *</label>
            <input
              type="text"
              placeholder="예: 낚시 장갑, 독서 모임"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={30}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[14px] font-bold text-slate-900 outline-none focus:border-blue-400 transition-colors placeholder:text-slate-200 placeholder:font-normal"
            />
            <span className="text-[10px] font-bold text-slate-300 mt-0.5 block text-right">{name.length}/30</span>
          </div>

          {/* 설명 */}
          <div>
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">한 줄 설명</label>
            <input
              type="text"
              placeholder="어떤 이야기를 나누는 공간인가요?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={60}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[14px] font-bold text-slate-900 outline-none focus:border-blue-400 transition-colors placeholder:text-slate-200 placeholder:font-normal"
            />
          </div>

          {/* 카테고리 */}
          <div>
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">분야</label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1 rounded-full text-[11px] font-bold border transition-all ${
                    category === cat
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* 대표 색상 */}
          <div>
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">대표 색상</label>
            <div className="flex gap-2">
              {COVER_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setCoverColor(c.value)}
                  style={{ backgroundColor: c.value }}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${coverColor === c.value ? 'border-slate-900 scale-110' : 'border-transparent'}`}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          {/* 공개/비밀 */}
          <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
            <div>
              <p className="text-[13px] font-black text-slate-700">{isPrivate ? '🔒 비밀 장갑' : '🌐 공개 장갑'}</p>
              <p className="text-[11px] font-bold text-slate-400 mt-0.5">
                {isPrivate ? '초대받은 사람만 가입할 수 있어요' : '누구나 자유롭게 가입할 수 있어요'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsPrivate(!isPrivate)}
              className={`relative w-11 h-6 rounded-full transition-colors ${isPrivate ? 'bg-slate-700' : 'bg-blue-500'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${isPrivate ? 'left-5' : 'left-0.5'}`} />
            </button>
          </div>
        </div>

        {/* 미리보기 */}
        <div className="px-6 pb-2">
          <div className="rounded-xl overflow-hidden border border-slate-100">
            <div className="h-2 w-full" style={{ backgroundColor: coverColor }} />
            <div className="px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-black text-slate-900">{name || '커뮤니티 이름'}</span>
                {isPrivate && <span className="text-[9px] font-black text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">비밀</span>}
              </div>
              <p className="text-[11px] font-bold text-slate-400 mt-0.5">{category} · 멤버 1명</p>
            </div>
          </div>
        </div>

        {/* 제출 */}
        <div className="px-6 py-4 flex gap-2 border-t border-slate-100">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-[13px] font-bold text-slate-500 border border-slate-200 hover:bg-slate-50 transition-colors">취소</button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !name.trim()}
            className={`flex-1 py-2.5 rounded-xl text-[13px] font-bold transition-all ${
              isSubmitting || !name.trim() ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-900 text-white hover:bg-blue-600'
            }`}
          >
            {isSubmitting ? '만드는 중...' : '장갑 만들기'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateCommunityModal;
