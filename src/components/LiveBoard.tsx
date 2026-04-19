// src/components/LiveBoard.tsx — 🔴 텍스트 라이브 보드 (Phase 4-A)
// 호스트: 텍스트 입력 → 참여자 화면에 실시간 렌더링
// 참여자: 보드 실시간 구독 (읽기 전용)
import { useState, useEffect, useRef } from 'react';
import { db, functions } from '../firebase';
import {
  collection, onSnapshot, query, orderBy, doc, setDoc, updateDoc,
  serverTimestamp, limit,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import type { LiveSession, LiveBoardLine, UserData } from '../types';
import { useLivePresence } from '../hooks/useLivePresence';
import LiveVfxOverlay from './LiveVfxOverlay';

interface Props {
  session: LiveSession;
  currentUserData: UserData;
  onEnd: () => void;
}

const LiveBoard = ({ session, currentUserData, onEnd }: Props) => {
  const [lines, setLines] = useState<LiveBoardLine[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isHost = session.hostUid === currentUserData.uid;
  const isLive = session.status === 'live';

  // 🔴 presence 하트비트 — 세션 활성 상태에서만
  useLivePresence(isLive ? session.id : null, currentUserData.uid);

  // 보드 라인 실시간 구독
  useEffect(() => {
    const q = query(
      collection(db, 'live_sessions', session.id, 'live_board'),
      orderBy('order', 'asc'),
      limit(200),
    );
    return onSnapshot(q, snap => {
      setLines(snap.docs.map(d => ({ id: d.id, ...d.data() } as LiveBoardLine)));
    });
  }, [session.id]);

  // 새 라인 추가 시 스크롤
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines.length]);

  // 호스트: 라인 전송 (Enter 또는 버튼)
  const commitLine = async (style: 'normal' | 'highlight' | 'title' = 'normal') => {
    if (!inputText.trim() || isSending || !isHost) return;
    setIsSending(true);
    const lineId = `line_${Date.now()}_${currentUserData.uid}`;
    await setDoc(doc(db, 'live_sessions', session.id, 'live_board', lineId), {
      order: lines.length + 1,
      text: inputText.trim(),
      style,
      committedAt: serverTimestamp(),
    });
    setInputText('');
    setIsSending(false);
  };

  // ⚾ 라이브 땡스볼 투척 — 참여자용
  const [tossingBall, setTossingBall] = useState(false);
  const handleLiveThanksball = async () => {
    const amountStr = window.prompt('투척할 볼 개수를 입력하세요 (1~300):\n\n🔶 브론즈 1~9볼\n⚪ 실버 10~49볼 (Q&A 큐 진입)\n⭐ 골드 50~99볼\n👑 레전드 100볼+');
    if (!amountStr) return;
    const amount = parseInt(amountStr, 10);
    if (!amount || amount < 1 || amount > 300) { alert('1~300 사이 숫자를 입력하세요.'); return; }
    const message = window.prompt('메시지 (선택, 엔터로 건너뛰기):') || '';

    setTossingBall(true);
    try {
      // 🔒 sendThanksball CF 경유 — ballBalance 차감 + live_chats/live_sessions 원자 갱신
      // Why: 이전엔 클라가 live_sessions를 직접 increment해서 잔액 차감 없이 무한 투척 가능했음
      const sendFn = httpsCallable(functions, 'sendThanksball');
      await sendFn({
        clientRequestId: crypto.randomUUID(),
        recipientUid: session.hostUid,
        amount,
        message: message.trim() || null,
        liveSessionId: session.id,
      });
      alert(`🏀 ${amount}볼 투척 완료!`);
    } catch (err: unknown) {
      console.error('[LiveBoard] 땡스볼 실패:', err);
      const msg = (err as { message?: string })?.message || '투척에 실패했습니다.';
      alert(msg);
    } finally {
      setTossingBall(false);
    }
  };

  // 호스트: 라이브 시작/종료
  const handleStartLive = async () => {
    await updateDoc(doc(db, 'live_sessions', session.id), {
      status: 'live',
      startedAt: serverTimestamp(),
    });
  };

  const handleEndLive = async () => {
    if (!window.confirm('라이브를 종료하시겠습니까?')) return;
    await updateDoc(doc(db, 'live_sessions', session.id), {
      status: 'ended',
      endedAt: serverTimestamp(),
    });
    onEnd();
  };

  // 라이브 경과 시간
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (session.status !== 'live' || !session.startedAt) return;
    const startMs = (session.startedAt as unknown as { seconds: number }).seconds * 1000;
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startMs) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [session.status, session.startedAt]);

  const formatElapsed = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* 🎇 VFX 오버레이 (전역 포털) */}
      <LiveVfxOverlay sessionId={session.id} />

      {/* 상단 바: 라이브 상태 + 동접 + 시간 */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900 text-white shrink-0">
        <div className="flex items-center gap-2">
          {isLive ? (
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-[12px] font-[1000] text-red-400">LIVE</span>
            </span>
          ) : session.status === 'ready' ? (
            <span className="text-[12px] font-[1000] text-slate-400">대기 중</span>
          ) : (
            <span className="text-[12px] font-[1000] text-slate-500">종료됨</span>
          )}
          <span className="text-[11px] font-bold text-slate-400">
            {session.title}
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-bold text-slate-400">
          {isLive && <span>⏱ {formatElapsed(elapsed)}</span>}
          <span>👥 {session.activeUsers || 0}명</span>
          {isHost && session.status === 'ready' && (
            <button onClick={handleStartLive}
              className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded-full text-[11px] font-[1000] transition-colors">
              🔴 라이브 시작
            </button>
          )}
          {isHost && isLive && (
            <button onClick={handleEndLive}
              className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded-full text-[11px] font-[1000] transition-colors">
              ■ 종료
            </button>
          )}
        </div>
      </div>

      {/* 보드 본문 — 실시간 텍스트 스크롤 */}
      <div className="flex-1 overflow-y-auto px-6 py-4 bg-white">
        {lines.length === 0 ? (
          <div className="py-20 text-center text-slate-300 text-[13px] font-bold italic">
            {isHost ? '텍스트를 입력하면 참여자에게 실시간으로 보여집니다.' : '호스트가 라이브를 시작하면 내용이 표시됩니다.'}
          </div>
        ) : (
          <div className="space-y-2 max-w-2xl mx-auto">
            {lines.map(line => (
              <p key={line.id} className={`leading-[1.8] ${
                line.style === 'title'
                  ? 'text-[18px] font-[1000] text-slate-900 mt-6 mb-2'
                  : line.style === 'highlight'
                    ? 'text-[15px] font-bold text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg border-l-4 border-blue-400'
                    : 'text-[15px] font-medium text-slate-700'
              }`}>
                {line.text}
              </p>
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* 참여자 땡스볼 영역 — 비호스트 + 라이브 중 */}
      {!isHost && isLive && (
        <div className="border-t border-slate-200 px-4 py-3 bg-slate-50 shrink-0 flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-400">
            💰 누적 땡스볼: {session.totalThanksball || 0}볼
          </span>
          <button
            onClick={handleLiveThanksball}
            disabled={tossingBall}
            className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white rounded-full text-[11px] font-[1000] transition-colors"
          >
            {tossingBall ? '투척 중...' : '⚾ 땡스볼 투척'}
          </button>
        </div>
      )}

      {/* 호스트 입력 영역 — 라이브 중일 때만 */}
      {isHost && isLive && (
        <div className="border-t border-slate-200 px-4 py-3 bg-slate-50 shrink-0">
          <div className="flex gap-2 max-w-2xl mx-auto">
            <textarea
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitLine('normal'); }
                if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); commitLine('highlight'); }
              }}
              placeholder="텍스트 입력 (Enter 전송, Ctrl+Enter 강조)"
              rows={2}
              className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-[14px] font-bold text-slate-700 outline-none focus:border-slate-400 resize-none"
            />
            <div className="flex flex-col gap-1 shrink-0">
              <button onClick={() => commitLine('normal')} disabled={!inputText.trim() || isSending}
                className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-[10px] font-[1000] hover:bg-slate-700 disabled:opacity-40 transition-colors">
                전송
              </button>
              <button onClick={() => commitLine('highlight')} disabled={!inputText.trim() || isSending}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[10px] font-[1000] hover:bg-blue-700 disabled:opacity-40 transition-colors">
                강조
              </button>
              <button onClick={() => commitLine('title')} disabled={!inputText.trim() || isSending}
                className="px-3 py-1.5 bg-slate-600 text-white rounded-lg text-[10px] font-[1000] hover:bg-slate-500 disabled:opacity-40 transition-colors">
                제목
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveBoard;
