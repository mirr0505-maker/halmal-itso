import type { UserData } from '../types';
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

// 🚀 가입 방식 옵션 정의
const JOIN_TYPE_OPTIONS = [
  { id: 'open',     emoji: '🟢', label: '자동 승인',    desc: '누구나 즉시 가입' },
  { id: 'approval', emoji: '🔵', label: '승인제 (노크)', desc: '관리자 승인 후 가입' },
  { id: 'password', emoji: '🔒', label: '초대 코드',    desc: '코드 입력 후 가입' },
] as const;

const MIN_LEVEL_OPTIONS = [1, 2, 3, 4, 5];

interface Props {
  userData: UserData;
  onSubmit: (data: {
    name: string; description: string; category: string;
    isPrivate: boolean; coverColor?: string;
    joinType?: string; minLevel?: number;
    password?: string; joinQuestion?: string;
  }) => Promise<void>;
  onClose: () => void;
}

const CreateCommunityModal = ({ userData: _userData, onSubmit, onClose }: Props) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('취미');
  const [coverColor, setCoverColor] = useState('#3b82f6');
  const [isSubmitting, setIsSubmitting] = useState(false);
  // 🚀 다섯 손가락 Phase 1 — 가입 조건 상태
  const [joinType, setJoinType] = useState<'open' | 'approval' | 'password'>('open');
  const [minLevel, setMinLevel] = useState(1);
  const [password, setPassword] = useState('');
  const [joinQuestion, setJoinQuestion] = useState('');

  const handleSubmit = async () => {
    if (!name.trim()) { alert('커뮤니티 이름을 입력해주세요.'); return; }
    if (joinType === 'password' && !password.trim()) { alert('초대 코드를 입력해주세요.'); return; }
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(), description: description.trim(), category,
        isPrivate: joinType !== 'open', coverColor,
        joinType, minLevel,
        password: joinType === 'password' ? password.trim() : undefined,
        joinQuestion: joinType === 'approval' ? joinQuestion.trim() : undefined,
      });
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

          {/* 🚀 가입 방식 선택 (3종) */}
          <div>
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">가입 방식</label>
            <div className="flex flex-col gap-1.5">
              {JOIN_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setJoinType(opt.id)}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border-2 transition-all text-left ${
                    joinType === opt.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-100 bg-white hover:border-slate-200'
                  }`}
                >
                  <span className="text-[16px]">{opt.emoji}</span>
                  <div>
                    <p className="text-[13px] font-black text-slate-800">{opt.label}</p>
                    <p className="text-[11px] font-bold text-slate-400">{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 🚀 초대 코드 입력 (password 방식일 때만) */}
          {joinType === 'password' && (
            <div>
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">초대 코드 *</label>
              <input
                type="text"
                placeholder="멤버에게 알려줄 코드를 설정하세요"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                maxLength={20}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[14px] font-bold text-slate-900 outline-none focus:border-blue-400 transition-colors placeholder:text-slate-200 placeholder:font-normal"
              />
            </div>
          )}

          {/* 🚀 가입 안내 문구 (승인제일 때만) */}
          {joinType === 'approval' && (
            <div>
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">가입 안내 문구</label>
              <input
                type="text"
                placeholder="예: 가입 이유를 간단히 적어주세요"
                value={joinQuestion}
                onChange={(e) => setJoinQuestion(e.target.value)}
                maxLength={50}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[14px] font-bold text-slate-900 outline-none focus:border-blue-400 transition-colors placeholder:text-slate-200 placeholder:font-normal"
              />
            </div>
          )}

          {/* 🚀 최소 가입 레벨 셀렉터 */}
          <div>
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">최소 가입 레벨</label>
            <div className="flex gap-1.5">
              {MIN_LEVEL_OPTIONS.map((lv) => (
                <button
                  key={lv}
                  type="button"
                  onClick={() => setMinLevel(lv)}
                  className={`flex-1 py-1.5 rounded-lg text-[12px] font-black border transition-all ${
                    minLevel === lv
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  Lv{lv}
                </button>
              ))}
            </div>
            <p className="text-[10px] font-bold text-slate-300 mt-1">Lv{minLevel} 이상만 가입할 수 있어요</p>
          </div>
        </div>

        {/* 미리보기 */}
        <div className="px-6 pb-2">
          <div className="rounded-xl overflow-hidden border border-slate-100">
            <div className="h-2 w-full" style={{ backgroundColor: coverColor }} />
            <div className="px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-black text-slate-900">{name || '커뮤니티 이름'}</span>
                {joinType !== 'open' && (
                  <span className="text-[9px] font-black text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                    {joinType === 'password' ? '🔒 초대코드' : '🔵 승인제'}
                  </span>
                )}
                {minLevel > 1 && (
                  <span className="text-[9px] font-black text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">Lv{minLevel}+</span>
                )}
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
