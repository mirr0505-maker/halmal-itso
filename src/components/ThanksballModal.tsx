// src/components/ThanksballModal.tsx
import { useState } from 'react';
import { db, auth } from '../firebase';
import { collection, addDoc, doc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';

interface Props {
  postId: string;
  postAuthor: string;
  postTitle?: string;
  currentNickname: string;
  onClose: () => void;
}

const PRESETS = [1, 2, 3, 5, 10];

const getTier = (amount: number) => {
  if (amount >= 10) return { bg: 'bg-rose-500',    text: 'text-white', border: 'border-rose-400',    label: '프리미엄', btnHover: 'hover:bg-rose-600' };
  if (amount >= 5)  return { bg: 'bg-amber-400',   text: 'text-white', border: 'border-amber-300',   label: '골드',     btnHover: 'hover:bg-amber-500' };
  if (amount >= 3)  return { bg: 'bg-violet-500',  text: 'text-white', border: 'border-violet-400',  label: '스페셜',   btnHover: 'hover:bg-violet-600' };
  if (amount >= 2)  return { bg: 'bg-blue-500',    text: 'text-white', border: 'border-blue-400',    label: '블루',     btnHover: 'hover:bg-blue-600' };
  return              { bg: 'bg-slate-200',   text: 'text-slate-700', border: 'border-slate-300', label: '베이직', btnHover: 'hover:bg-slate-300' };
};

const ThanksballModal = ({ postId, postAuthor, postTitle, currentNickname, onClose }: Props) => {
  const [selected, setSelected] = useState(1);
  const [custom, setCustom] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  const finalAmount = custom !== '' ? Math.max(1, parseInt(custom) || 1) : selected;
  const tier = getTier(finalAmount);

  const handleSend = async () => {
    if (sending) return;
    setSending(true);
    try {
      const uid = auth.currentUser?.uid || '';
      await addDoc(collection(db, 'posts', postId, 'thanksBalls'), {
        sender: currentNickname,
        senderId: uid,
        amount: finalAmount,
        message: message.trim() || null,
        createdAt: serverTimestamp(),
        isPaid: false,
      });
      await updateDoc(doc(db, 'posts', postId), {
        thanksballTotal: increment(finalAmount),
      });
      // 보낸볼 내역 기록 (발신자 기준)
      await addDoc(collection(db, 'sentBalls', currentNickname, 'items'), {
        postId,
        postTitle: postTitle || null,
        postAuthor,
        amount: finalAmount,
        message: message.trim() || null,
        createdAt: serverTimestamp(),
      });
      // 수신자 알림 기록
      await addDoc(collection(db, 'notifications', postAuthor, 'items'), {
        type: 'thanksball',
        fromNickname: currentNickname,
        amount: finalAmount,
        message: message.trim() || null,
        postId,
        postTitle: postTitle || null,
        createdAt: serverTimestamp(),
        read: false,
      });
      setDone(true);
      setTimeout(onClose, 1800);
    } catch (e) {
      console.error(e);
      setSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl p-6 w-[340px] shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {done ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <span className="text-5xl animate-bounce">⚾</span>
            <p className="text-[16px] font-[1000] text-slate-800 mt-1">
              {postAuthor}님께 {finalAmount}볼 전달!
            </p>
            <p className="text-[12px] text-slate-400 font-bold">감사가 전달되었습니다</p>
          </div>
        ) : (
          <>
            {/* 헤더 */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[16px] font-[1000] text-slate-900">⚾ 땡스볼 보내기</h3>
              <button onClick={onClose} className="text-slate-300 hover:text-slate-500 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <p className="text-[12px] font-bold text-slate-400 mb-4">
              <span className="text-slate-800 font-[1000]">{postAuthor}</span>님의 글이 도움이 되었나요?
            </p>

            {/* 프리셋 버튼 */}
            <div className="flex gap-1.5 mb-3">
              {PRESETS.map(n => {
                const t = getTier(n);
                const isActive = custom === '' && selected === n;
                return (
                  <button
                    key={n}
                    onClick={() => { setSelected(n); setCustom(''); }}
                    className={`flex-1 py-2 rounded-xl text-[13px] font-[1000] transition-all ${
                      isActive
                        ? `${t.bg} ${t.text} scale-105 shadow-md`
                        : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    {n}볼
                  </button>
                );
              })}
            </div>

            {/* 직접 입력 */}
            <div className="flex items-center gap-2 mb-4">
              <input
                type="number"
                min={1}
                value={custom}
                onChange={e => setCustom(e.target.value)}
                placeholder="직접 입력"
                className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-[13px] font-bold outline-none focus:border-blue-400 transition-colors"
              />
              <span className="text-[11px] text-slate-400 font-bold whitespace-nowrap shrink-0">
                1볼 = $1
              </span>
            </div>

            {/* 티어 표시 */}
            <div className={`flex items-center justify-center gap-2 py-2 rounded-xl mb-4 ${tier.bg}`}>
              <span className={`text-[13px] font-[1000] ${tier.text}`}>
                ⚾ {finalAmount}볼 · {tier.label}
              </span>
            </div>

            {/* 응원 메시지 */}
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value.slice(0, 50))}
              placeholder="응원 메시지 남기기 (선택, 50자)"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-[13px] font-medium resize-none h-[60px] outline-none focus:border-blue-400 transition-colors mb-1"
            />
            <p className="text-[10px] text-slate-300 font-bold text-right mb-4">{message.length}/50</p>

            {/* 액션 버튼 */}
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-[1000] text-slate-400 bg-slate-50 hover:bg-slate-100 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSend}
                disabled={sending}
                className={`flex-1 py-2.5 rounded-xl text-[13px] font-[1000] ${tier.text} ${tier.bg} ${tier.btnHover} transition-all ${sending ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {sending ? '전송 중...' : `⚾ ${finalAmount}볼 보내기`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ThanksballModal;
