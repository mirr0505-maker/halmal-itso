// src/components/CreateCommunityModal.tsx — 장갑 나누기: 커뮤니티 개설 폼
// 🚀 개설 조건: Lv3 이상 (GLOVE_CREATE_MIN_LEVEL, App.tsx에서 검증)
import type { UserData, JoinForm, StandardFieldKey, SharesUnit, CustomQuestion } from '../types';
import { useState, useRef } from 'react';
import { uploadToR2 } from '../uploadToR2';
import { getDefaultJoinForm, getRemainingSlots, STANDARD_FIELD_LABELS, generateCustomQuestionId } from '../utils/joinForm';

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
    isPrivate: boolean; coverColor?: string; thumbnailUrl?: string; chatBgUrl?: string; displayBadgeKey?: string;
    joinType?: string; minLevel?: number;
    password?: string; joinQuestion?: string;
    joinForm?: JoinForm;
  }) => Promise<void>;
  onClose: () => void;
}

const CreateCommunityModal = ({ userData, onSubmit, onClose }: Props) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('취미');
  const [coverColor, setCoverColor] = useState('#3b82f6');
  const [isSubmitting, setIsSubmitting] = useState(false);
  // 🧤 대표 이미지 (썸네일)
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  // 🧤 채팅 바탕화면 이미지
  const [chatBgFile, setChatBgFile] = useState<File | null>(null);
  const [chatBgPreview, setChatBgPreview] = useState<string | null>(null);
  const chatBgInputRef = useRef<HTMLInputElement>(null);
  // 🚀 다섯 손가락 Phase 1 — 가입 조건 상태
  const [joinType, setJoinType] = useState<'open' | 'approval' | 'password'>('open');
  const [minLevel, setMinLevel] = useState(1);
  const [password, setPassword] = useState('');
  const [joinQuestion, setJoinQuestion] = useState('');
  // 🧤 닉네임 배지 필드 — 채팅/댓글에서 닉네임 옆에 표시할 가입 답변
  const [displayBadgeKey, setDisplayBadgeKey] = useState('');
  // 🚀 Phase 6 — 가입 폼 빌더 상태
  const [joinForm, setJoinForm] = useState<JoinForm>(getDefaultJoinForm());

  // 🚀 표준 필드 업데이트 헬퍼
  const updateStandardField = (key: StandardFieldKey, patch: Partial<import('../types').StandardField>) => {
    setJoinForm(prev => ({
      ...prev,
      standardFields: prev.standardFields.map(f => f.key === key ? { ...f, ...patch } : f),
    }));
  };

  // 🚀 커스텀 질문 관리
  const remainingSlots = getRemainingSlots(joinForm);
  const canAddQuestion = remainingSlots > 0;

  const addCustomQuestion = () => {
    if (!canAddQuestion) return;
    const newQ: CustomQuestion = { id: generateCustomQuestionId(), label: '', placeholder: '', required: false, maxLength: 200 };
    setJoinForm(prev => ({ ...prev, customQuestions: [...prev.customQuestions, newQ] }));
  };

  const updateCustomQuestion = (id: string, patch: Partial<CustomQuestion>) => {
    setJoinForm(prev => ({ ...prev, customQuestions: prev.customQuestions.map(q => q.id === id ? { ...q, ...patch } : q) }));
  };

  const removeCustomQuestion = (id: string) => {
    setJoinForm(prev => ({ ...prev, customQuestions: prev.customQuestions.filter(q => q.id !== id) }));
  };

  const handleSubmit = async () => {
    if (!name.trim()) { alert('커뮤니티 이름을 입력해주세요.'); return; }
    if (joinType === 'password' && !password.trim()) { alert('초대 코드를 입력해주세요.'); return; }
    // 🚀 Phase 6 — 승인제 가입 폼 유효성 검사
    if (joinType === 'approval') {
      const enabledCount = joinForm.standardFields.filter(f => f.enabled).length;
      const customCount = joinForm.customQuestions.length;
      if (enabledCount === 0 && customCount === 0) {
        alert('가입 폼에 최소 1개 항목을 설정해주세요.'); return;
      }
      // 빈 질문 제거
      const validCustom = joinForm.customQuestions.filter(q => q.label.trim());
      if (validCustom.length < joinForm.customQuestions.length) {
        setJoinForm(prev => ({ ...prev, customQuestions: validCustom }));
      }
    }
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      // 🧤 대표 이미지 R2 업로드 (선택 사항)
      let thumbnailUrl: string | undefined;
      if (thumbnailFile && userData.uid) {
        const ext = thumbnailFile.name.split('.').pop() || 'jpg';
        const filePath = `uploads/${userData.uid}/community_thumb_${Date.now()}.${ext}`;
        const url = await uploadToR2(thumbnailFile, filePath);
        if (url) thumbnailUrl = url;
      }
      // 🧤 채팅 바탕화면 R2 업로드 (선택 사항)
      let chatBgUrl: string | undefined;
      if (chatBgFile && userData.uid) {
        const ext = chatBgFile.name.split('.').pop() || 'jpg';
        const filePath = `uploads/${userData.uid}/community_chatbg_${Date.now()}.${ext}`;
        const url = await uploadToR2(chatBgFile, filePath);
        if (url) chatBgUrl = url;
      }
      // 🚀 승인제일 때만 joinForm 저장 (Firestore 문서 깨끗하게 유지)
      const cleanedJoinForm = joinType === 'approval' ? {
        ...joinForm,
        customQuestions: joinForm.customQuestions.filter(q => q.label.trim()),
      } : undefined;
      await onSubmit({
        name: name.trim(), description: description.trim(), category,
        isPrivate: joinType !== 'open', coverColor, thumbnailUrl, chatBgUrl,
        displayBadgeKey: displayBadgeKey || undefined,
        joinType, minLevel,
        password: joinType === 'password' ? password.trim() : undefined,
        joinQuestion: joinType === 'approval' ? joinQuestion.trim() : undefined,
        joinForm: cleanedJoinForm,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden max-h-[90vh] flex flex-col"
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

        <div className="px-6 py-5 flex flex-col gap-4 overflow-y-auto flex-1">
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

          {/* 🧤 대표 이미지 (선택) */}
          <div>
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">대표 이미지 (선택)</label>
            <input
              ref={thumbnailInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 5 * 1024 * 1024) { alert('이미지는 5MB 이하만 업로드할 수 있습니다.'); return; }
                setThumbnailFile(file);
                setThumbnailPreview(URL.createObjectURL(file));
              }}
            />
            {thumbnailPreview ? (
              <div className="relative w-full aspect-[16/9] rounded-lg overflow-hidden border border-slate-200">
                <img src={thumbnailPreview} alt="미리보기" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => { setThumbnailFile(null); setThumbnailPreview(null); if (thumbnailInputRef.current) thumbnailInputRef.current.value = ''; }}
                  className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/50 text-white rounded-full text-[13px] leading-none flex items-center justify-center hover:bg-black/70"
                >×</button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => thumbnailInputRef.current?.click()}
                className="w-full h-24 border-2 border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center gap-1 hover:border-blue-300 hover:bg-blue-50/30 transition-all"
              >
                <span className="text-[18px]">📷</span>
                <span className="text-[11px] font-bold text-slate-400">클릭하여 이미지 선택</span>
                <span className="text-[9px] text-slate-300">5MB 이하 · 미설정 시 대표 색상 표시</span>
              </button>
            )}
          </div>

          {/* 🧤 채팅 바탕화면 (선택) */}
          <div>
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">채팅 바탕화면 (선택)</label>
            <input
              ref={chatBgInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 5 * 1024 * 1024) { alert('이미지는 5MB 이하만 업로드할 수 있습니다.'); return; }
                setChatBgFile(file);
                setChatBgPreview(URL.createObjectURL(file));
              }}
            />
            {chatBgPreview ? (
              <div className="relative w-full aspect-[16/9] rounded-lg overflow-hidden border border-slate-200">
                <img src={chatBgPreview} alt="바탕화면 미리보기" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-white/50" />
                <p className="absolute bottom-2 left-0 right-0 text-center text-[9px] font-bold text-slate-500">채팅 메시지가 이 위에 표시됩니다</p>
                <button
                  type="button"
                  onClick={() => { setChatBgFile(null); setChatBgPreview(null); if (chatBgInputRef.current) chatBgInputRef.current.value = ''; }}
                  className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/50 text-white rounded-full text-[13px] leading-none flex items-center justify-center hover:bg-black/70"
                >×</button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => chatBgInputRef.current?.click()}
                className="w-full h-20 border-2 border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center gap-1 hover:border-blue-300 hover:bg-blue-50/30 transition-all"
              >
                <span className="text-[18px]">💬</span>
                <span className="text-[11px] font-bold text-slate-400">채팅방 배경 이미지 선택</span>
                <span className="text-[9px] text-slate-300">예: 삼성전자 로고, BTS 사진 등</span>
              </button>
            )}
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

          {/* 🚀 Phase 6 — 가입 폼 빌더 (승인제일 때만 노출) */}
          {joinType === 'approval' && (
            <div className="border border-blue-100 rounded-xl p-4 bg-blue-50/30">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-[12px] font-[1000] text-slate-700">📋 가입 폼 빌더</p>
                  <p className="text-[10px] font-bold text-slate-400 mt-0.5">신청자에게 받을 정보를 선택하세요 (최대 5개)</p>
                </div>
                <span className="text-[10px] font-[1000] text-slate-400 bg-white px-2 py-0.5 rounded border border-slate-100">
                  {5 - remainingSlots}/5 사용
                </span>
              </div>

              {/* ━━━ 표준 필드 ━━━ */}
              <p className="text-[9px] font-[1000] text-slate-400 uppercase tracking-widest mb-2">표준 필드</p>
              <div className="flex flex-col gap-2 mb-4">
                {joinForm.standardFields.map((field) => {
                  const isShares = field.key === 'shares';
                  return (
                    <div key={field.key} className={`rounded-lg border p-3 transition-all ${field.enabled ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-100 opacity-50'}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => updateStandardField(field.key, { enabled: !field.enabled })}
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all text-[11px] ${field.enabled ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-300'}`}
                          >
                            {field.enabled && '✓'}
                          </button>
                          <span className="text-[12px] font-[1000] text-slate-700">{STANDARD_FIELD_LABELS[field.key]}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {field.enabled && (
                            <select
                              value={field.required ? 'required' : 'optional'}
                              onChange={(e) => updateStandardField(field.key, { required: e.target.value === 'required' })}
                              className="text-[10px] font-bold border border-slate-200 rounded px-1.5 py-0.5 bg-white text-slate-600 outline-none"
                            >
                              <option value="required">필수</option>
                              <option value="optional">선택</option>
                            </select>
                          )}
                        </div>
                      </div>
                      {/* shares 전용 확장 UI */}
                      {isShares && field.enabled && (
                        <div className="mt-2 ml-7 pl-3 border-l-2 border-blue-200 flex flex-col gap-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-400 w-12 shrink-0">종목명</span>
                            <input
                              type="text"
                              placeholder="예: 삼성전자, 비트코인"
                              value={field.sharesLabel || ''}
                              onChange={(e) => updateStandardField('shares', { sharesLabel: e.target.value })}
                              maxLength={30}
                              className="flex-1 border border-slate-200 rounded px-2 py-1 text-[11px] font-bold text-slate-700 outline-none focus:border-blue-400 placeholder:text-slate-300"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-400 w-12 shrink-0">단위</span>
                            <select
                              value={field.sharesUnit ?? '100'}
                              onChange={(e) => updateStandardField('shares', { sharesUnit: e.target.value as SharesUnit })}
                              className="border border-slate-200 rounded px-2 py-1 text-[11px] font-bold text-slate-700 outline-none bg-white"
                            >
                              <option value="1">1주 단위</option>
                              <option value="10">10주 단위</option>
                              <option value="100">100주 단위</option>
                              <option value="1000">1,000주 단위</option>
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* ━━━ 커스텀 질문 ━━━ */}
              <p className="text-[9px] font-[1000] text-slate-400 uppercase tracking-widest mb-2">
                추가 질문 (잔여 {remainingSlots}개)
              </p>
              <div className="flex flex-col gap-2 mb-3">
                {joinForm.customQuestions.map((q, idx) => (
                  <div key={q.id} className="rounded-lg border border-slate-200 bg-white p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-[1000] text-slate-400">Q{idx + 1}</span>
                      <button
                        type="button"
                        onClick={() => removeCustomQuestion(q.id)}
                        className="text-[14px] text-slate-300 hover:text-rose-500 transition-colors leading-none"
                      >×</button>
                    </div>
                    <input
                      type="text"
                      placeholder="질문을 입력하세요"
                      value={q.label}
                      onChange={(e) => updateCustomQuestion(q.id, { label: e.target.value })}
                      maxLength={100}
                      className="w-full border border-slate-200 rounded px-2 py-1 text-[11px] font-bold text-slate-700 outline-none focus:border-blue-400 mb-1.5 placeholder:text-slate-300"
                    />
                    <input
                      type="text"
                      placeholder="플레이스홀더 (선택)"
                      value={q.placeholder || ''}
                      onChange={(e) => updateCustomQuestion(q.id, { placeholder: e.target.value })}
                      maxLength={100}
                      className="w-full border border-slate-100 rounded px-2 py-1 text-[10px] text-slate-400 outline-none focus:border-blue-300 mb-1.5 placeholder:text-slate-200"
                    />
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={q.required}
                        onChange={(e) => updateCustomQuestion(q.id, { required: e.target.checked })}
                        className="w-3.5 h-3.5 rounded border-slate-300"
                      />
                      <span className="text-[10px] font-bold text-slate-500">필수 응답</span>
                    </label>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addCustomQuestion}
                disabled={!canAddQuestion}
                className={`w-full py-2 rounded-lg text-[11px] font-[1000] border-2 border-dashed transition-all ${
                  canAddQuestion
                    ? 'border-blue-300 text-blue-500 hover:bg-blue-50'
                    : 'border-slate-200 text-slate-300 cursor-not-allowed'
                }`}
              >
                + 질문 추가
              </button>
              {!canAddQuestion && (
                <p className="text-[9px] font-bold text-slate-400 mt-1 text-center">
                  표준 필드를 비활성화하면 추가 질문 슬롯이 생깁니다
                </p>
              )}

              {/* 🧤 닉네임 배지 필드 선택 */}
              <div className="mt-4 pt-3 border-t border-blue-200">
                <p className="text-[10px] font-[1000] text-slate-600 mb-2">🏷️ 닉네임 배지 (채팅/댓글에 표시)</p>
                <p className="text-[9px] font-bold text-slate-400 mb-2">가입 답변 중 하나를 선택하면 닉네임 옆에 표시됩니다</p>
                <div className="flex flex-col gap-1">
                  <label className="flex items-center gap-2 text-[11px] font-bold text-slate-600 cursor-pointer">
                    <input type="radio" name="badgeKey" value="" checked={displayBadgeKey === ''} onChange={() => setDisplayBadgeKey('')} className="w-3 h-3" />
                    사용 안 함
                  </label>
                  {joinForm.standardFields.filter(f => f.enabled).map(f => (
                    <label key={f.key} className="flex items-center gap-2 text-[11px] font-bold text-slate-600 cursor-pointer">
                      <input type="radio" name="badgeKey" value={f.key} checked={displayBadgeKey === f.key} onChange={() => setDisplayBadgeKey(f.key)} className="w-3 h-3" />
                      {STANDARD_FIELD_LABELS[f.key]} {f.key === 'shares' && '(K단위)'}
                    </label>
                  ))}
                  {joinForm.customQuestions.filter(q => q.label.trim()).map(q => (
                    <label key={q.id} className="flex items-center gap-2 text-[11px] font-bold text-slate-600 cursor-pointer">
                      <input type="radio" name="badgeKey" value={q.id} checked={displayBadgeKey === q.id} onChange={() => setDisplayBadgeKey(q.id)} className="w-3 h-3" />
                      {q.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 🤖 정보봇 안내 — 주식 카테고리 전용 */}
          {category === '주식' && (
            <div className="p-3 bg-emerald-50/50 border border-emerald-200 rounded-xl">
              <p className="text-[11px] font-[1000] text-emerald-700 mb-1">🤖 정보봇 사용 가능</p>
              <p className="text-[10px] font-bold text-emerald-600/80 leading-relaxed">
                주식 장갑은 정보봇을 활성화할 수 있습니다.
                뉴스·DART 공시 등을 자동으로 소곤소곤에 게시합니다.
                <br />
                장갑 개설 후 <strong>관리 탭 → 🤖 정보봇</strong>에서 설정하세요. (월 20볼)
              </p>
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
            {thumbnailPreview ? (
              <div className="aspect-[16/9] w-full bg-slate-100">
                <img src={thumbnailPreview} alt="" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="h-2 w-full" style={{ backgroundColor: coverColor }} />
            )}
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
