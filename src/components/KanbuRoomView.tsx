// src/components/KanbuRoomView.tsx — 깐부방 상세: 5탭 (자유 게시판 / 유료×2 / 채팅 / 멤버 / 관리)
// 🚀 업그레이드: 2컬럼 분할 → CommunityView 패턴 탭 전환
import { useState, useEffect, useRef } from 'react';
import { db, functions } from '../firebase';
import {
  collection, onSnapshot, query, orderBy, limit, where, doc, setDoc, updateDoc, deleteDoc,
  serverTimestamp, arrayRemove, increment,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import type { KanbuRoom, KanbuChat, Post, UserData, LiveSession } from '../types';
import LiveBoard from './LiveBoard';
import KanbuBoardView from './KanbuBoardView';

interface Props {
  room: KanbuRoom;
  roomPosts: Post[];
  onBack: () => void;
  currentUserData: UserData;
  allUsers: Record<string, UserData>;
  onPostClick?: (post: Post) => void;    // 🆕 깐부방 글 상세보기 라우팅
  followerCounts?: Record<string, number>;
  commentCounts?: Record<string, number>;
}

type TabId = 'free_board' | 'paid_once' | 'paid_monthly' | 'chat' | 'members' | 'admin' | 'live';

const KanbuRoomView = ({ room, roomPosts, onBack, currentUserData, allUsers, onPostClick, followerCounts = {}, commentCounts = {} }: Props) => {
  const [activeTab, setActiveTab] = useState<TabId>('free_board');
  const [chats, setChats] = useState<KanbuChat[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  // 관리 탭 state
  const [editTitle, setEditTitle] = useState(room.title);
  const [editDesc, setEditDesc] = useState(room.description || '');
  const [savingSettings, setSavingSettings] = useState(false);
  // 🚀 2026-04-17: 카드 설정 state (표지·표시 옵션) — 관리 탭에서 사후 수정 가능
  const [editThumbnailFile, setEditThumbnailFile] = useState<File | null>(null);
  const [editThumbnailPreview, setEditThumbnailPreview] = useState<string | null>(null);
  const [isUploadingThumb, setIsUploadingThumb] = useState(false);
  const [showHostInfo, setShowHostInfo] = useState(room.cardSettings?.showHostInfo !== false);
  const [showMember, setShowMember] = useState(room.cardSettings?.showMember !== false);
  const [showThanksball, setShowThanksball] = useState(room.cardSettings?.showThanksball !== false);
  const [showPaidPreview, setShowPaidPreview] = useState(room.cardSettings?.showPaidPreview !== false);
  // 유료 설정 state
  const [onceEnabled, setOnceEnabled] = useState(room.paidBoards?.once?.enabled || false);
  const [oncePrice, setOncePrice] = useState(room.paidBoards?.once?.price || 10);
  const [onceTitle, setOnceTitle] = useState(room.paidBoards?.once?.title || '유료 게시판 (1회)');
  const [monthlyEnabled, setMonthlyEnabled] = useState(room.paidBoards?.monthly?.enabled || false);
  const [monthlyPrice, setMonthlyPrice] = useState(room.paidBoards?.monthly?.price || 20);
  const [monthlyTitle, setMonthlyTitle] = useState(room.paidBoards?.monthly?.title || '유료 게시판 (구독)');
  const [purchasing, setPurchasing] = useState(false);
  // 🔴 라이브 세션 state
  const [liveSession, setLiveSession] = useState<LiveSession | null>(null);
  const [creatingLive, setCreatingLive] = useState(false);

  const isCreator = room.creatorId === currentUserData.uid;
  const isPaidOnceMember = room.paidOnceMembers?.includes(currentUserData.uid) || isCreator;
  const isPaidMonthlyMember = room.paidMonthlyMembers?.includes(currentUserData.uid) || isCreator;
  const hasOnceBoard = room.paidBoards?.once?.enabled;
  const hasMonthlyBoard = room.paidBoards?.monthly?.enabled;
  const memberIds = room.memberIds || [room.creatorId];

  // 수수료율 (강변 시장 동일)
  const feeRate = (room.creatorLevel || 1) >= 7 ? 0.20 : (room.creatorLevel || 1) >= 5 ? 0.25 : 0.30;
  const feePercent = Math.round(feeRate * 100);

  // 🔴 라이브 세션 실시간 구독 — 활성(ready/live) 세션이 있는지 감지
  useEffect(() => {
    const q = query(
      collection(db, 'live_sessions'),
      where('roomId', '==', room.id),
      where('status', 'in', ['ready', 'live']),
      limit(1),
    );
    return onSnapshot(q, snap => {
      if (!snap.empty) {
        setLiveSession({ id: snap.docs[0].id, ...snap.docs[0].data() } as LiveSession);
      } else {
        setLiveSession(null);
      }
    });
  }, [room.id]);

  // 🔴 라이브 세션 생성
  const createLiveSession = async () => {
    const title = window.prompt('라이브 제목을 입력하세요:');
    if (!title?.trim()) return;
    setCreatingLive(true);
    try {
      const sessionId = `live_${Date.now()}_${currentUserData.uid}`;
      await setDoc(doc(db, 'live_sessions', sessionId), {
        roomId: room.id,
        hostUid: currentUserData.uid,
        hostNickname: currentUserData.nickname,
        title: title.trim(),
        type: 'text',
        status: 'ready',
        startedAt: null,
        endedAt: null,
        activeUsers: 0,
        totalThanksball: 0,
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'kanbu_rooms', room.id), { liveSessionId: sessionId });
      setActiveTab('live');
    } finally {
      setCreatingLive(false);
    }
  };

  // 채팅 실시간 구독
  useEffect(() => {
    const q = query(collection(db, 'kanbu_rooms', room.id, 'chats'), orderBy('createdAt', 'asc'), limit(50));
    return onSnapshot(q, snap => setChats(snap.docs.map(d => ({ id: d.id, ...d.data() } as KanbuChat))));
  }, [room.id]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chats]);

  const sendChat = async () => {
    if (!chatInput.trim() || isSending) return;
    setIsSending(true);
    await setDoc(doc(db, 'kanbu_rooms', room.id, 'chats', `chat_${Date.now()}_${currentUserData.uid}`), {
      author: currentUserData.nickname, authorId: currentUserData.uid,
      content: chatInput.trim(), createdAt: serverTimestamp(),
    });
    setChatInput(''); setIsSending(false);
  };

  // 유료 결제
  const handlePurchase = async (type: 'once' | 'monthly') => {
    const price = type === 'once' ? oncePrice : monthlyPrice;
    const label = type === 'once' ? '1회 결제' : '월 구독';
    if (!window.confirm(`🏀 ${price}볼로 ${label} 하시겠습니까?\n(수수료 ${feePercent}% 포함)`)) return;
    setPurchasing(true);
    try {
      const fn = httpsCallable(functions, 'joinPaidKanbuRoom');
      await fn({ roomId: room.id, type });
      alert(`${label} 완료! 유료 게시판에 접근할 수 있습니다.`);
    } catch (err: unknown) {
      const e = err as { message?: string };
      alert(e.message || '결제에 실패했습니다.');
    } finally { setPurchasing(false); }
  };

  // 관리: 설정 저장
  const savePaidSettings = async () => {
    setSavingSettings(true);
    try {
      await updateDoc(doc(db, 'kanbu_rooms', room.id), {
        title: editTitle.trim() || room.title,
        description: editDesc.trim(),
        paidBoards: {
          once: { enabled: onceEnabled, price: oncePrice, title: onceTitle.trim() || '유료 게시판 (1회)' },
          monthly: { enabled: monthlyEnabled, price: monthlyPrice, title: monthlyTitle.trim() || '유료 게시판 (구독)' },
        },
      });
      alert('설정이 저장되었습니다.');
    } finally { setSavingSettings(false); }
  };

  // 🚀 관리: 카드 설정 저장 (표지 교체 + 표시 옵션)
  const saveCardSettings = async () => {
    setIsUploadingThumb(true);
    try {
      const payload: Record<string, unknown> = {
        cardSettings: { showHostInfo, showMember, showThanksball, showPaidPreview },
      };
      if (editThumbnailFile) {
        const { uploadToR2 } = await import('../uploadToR2');
        const ext = editThumbnailFile.name.split('.').pop() || 'jpg';
        const filePath = `uploads/${currentUserData.uid}/kanburoom_thumb_${Date.now()}.${ext}`;
        const url = await uploadToR2(editThumbnailFile, filePath);
        if (url) payload.thumbnailUrl = url;
      }
      await updateDoc(doc(db, 'kanbu_rooms', room.id), payload);
      alert('카드 설정이 저장되었습니다.');
      setEditThumbnailFile(null);
      if (editThumbnailPreview) { URL.revokeObjectURL(editThumbnailPreview); setEditThumbnailPreview(null); }
    } finally { setIsUploadingThumb(false); }
  };

  // 관리: 멤버 강퇴
  const handleKick = async (uid: string, nickname: string) => {
    if (!window.confirm(`${nickname}님을 강퇴하시겠습니까?`)) return;
    await updateDoc(doc(db, 'kanbu_rooms', room.id), {
      memberIds: arrayRemove(uid),
      memberCount: increment(-1),
      paidOnceMembers: arrayRemove(uid),
      paidMonthlyMembers: arrayRemove(uid),
    });
  };

  // 관리: 방 삭제
  const handleDeleteRoom = async () => {
    if (!window.confirm('정말 이 깐부방을 삭제하시겠습니까?\n모든 데이터가 삭제됩니다.')) return;
    if (!window.confirm('되돌릴 수 없습니다. 정말 삭제하시겠습니까?')) return;
    await deleteDoc(doc(db, 'kanbu_rooms', room.id));
    onBack();
  };

  const formatTime = (ts: { seconds: number } | null | undefined) => {
    if (!ts?.seconds) return '';
    return new Date(ts.seconds * 1000).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  };

  // 페이월 렌더
  const renderPaywall = (type: 'once' | 'monthly') => {
    const board = type === 'once' ? room.paidBoards?.once : room.paidBoards?.monthly;
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center p-8 max-w-sm">
          <p className="text-[32px] mb-3">🔒</p>
          <p className="text-[14px] font-[1000] text-slate-800 mb-1">{board?.title || '유료 게시판'}</p>
          <p className="text-[12px] font-bold text-slate-400 mb-4">
            {type === 'once' ? '1회 결제로 영구 이용' : '월 구독으로 이용 (30일마다 갱신)'}
          </p>
          <p className="text-[20px] font-[1000] text-slate-900 mb-1">🏀 {board?.price || 0}볼{type === 'monthly' ? '/월' : ''}</p>
          <p className="text-[10px] font-bold text-slate-400 mb-4">수수료 {feePercent}% 포함</p>
          <button onClick={() => handlePurchase(type)} disabled={purchasing}
            className="px-6 py-2.5 bg-slate-900 hover:bg-slate-700 disabled:opacity-40 text-white rounded-lg text-[12px] font-[1000] transition-colors">
            {purchasing ? '결제 중...' : type === 'once' ? '🏀 결제하기' : '🏀 구독하기'}
          </button>
        </div>
      </div>
    );
  };

  // 탭 목록 동적 생성
  const tabs: { id: TabId; label: string }[] = [
    { id: 'free_board', label: '📋 자유 게시판' },
    ...(hasOnceBoard ? [{ id: 'paid_once' as TabId, label: `🔒 ${room.paidBoards!.once!.title}` }] : []),
    ...(hasMonthlyBoard ? [{ id: 'paid_monthly' as TabId, label: `🔒 ${room.paidBoards!.monthly!.title}` }] : []),
    // 🔴 라이브 탭 — 활성 세션이 있으면 LIVE 배지
    { id: 'chat', label: `💬 채팅 ${chats.length > 0 ? `(${chats.length})` : ''}` },
    // 🔴 라이브 탭 — 방장은 항상 표시(시작 버튼), 참여자는 활성 세션 있을 때만
    ...(isCreator || liveSession
      ? [{ id: 'live' as TabId, label: liveSession
            ? `🔴 LIVE ${liveSession.status === 'live' ? `(${liveSession.activeUsers || 0})` : '(대기)'}`
            : '🔴 텍스트 라이브' }]
      : []),
    { id: 'members', label: `👥 멤버 ${memberIds.length}` },
    ...(isCreator ? [{ id: 'admin' as TabId, label: '⚙️ 관리' }] : []),
  ];

  return (
    <div className="w-full h-full flex flex-col animate-in fade-in duration-300">
      {/* 헤더 */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-100 shrink-0">
        <button onClick={onBack} className="text-slate-400 hover:text-slate-700 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div className="flex-1 min-w-0">
          <h3 className="text-[14px] font-[1000] text-slate-900 tracking-tight truncate">{room.title}</h3>
          <p className="text-[10px] font-bold text-slate-400">{room.creatorNickname} · 멤버 {memberIds.length}명</p>
        </div>
      </div>

      {/* 탭 바 */}
      <div className="flex border-b border-slate-100 bg-white overflow-x-auto shrink-0">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-[11px] font-[1000] transition-colors border-b-2 -mb-px whitespace-nowrap ${
              activeTab === tab.id ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* 탭 컨텐츠 */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* 📋 자유 게시판 */}
        {activeTab === 'free_board' && (
          <KanbuBoardView room={room} boardType="free" posts={roomPosts} currentUserData={currentUserData} onPostClick={p => onPostClick?.(p)} allUsers={allUsers} followerCounts={followerCounts} commentCounts={commentCounts} />
        )}

        {/* 🔒 유료 1회 */}
        {activeTab === 'paid_once' && (
          isPaidOnceMember
            ? <KanbuBoardView room={room} boardType="paid_once" posts={roomPosts} currentUserData={currentUserData} onPostClick={p => onPostClick?.(p)} allUsers={allUsers} followerCounts={followerCounts} commentCounts={commentCounts} />
            : renderPaywall('once')
        )}

        {/* 🔒 유료 구독 */}
        {activeTab === 'paid_monthly' && (
          isPaidMonthlyMember
            ? <KanbuBoardView room={room} boardType="paid_monthly" posts={roomPosts} currentUserData={currentUserData} onPostClick={p => onPostClick?.(p)} allUsers={allUsers} followerCounts={followerCounts} commentCounts={commentCounts} />
            : renderPaywall('monthly')
        )}

        {/* 🔴 라이브 */}
        {activeTab === 'live' && (
          liveSession ? (
            <LiveBoard
              session={liveSession}
              currentUserData={currentUserData}
              onEnd={() => {
                updateDoc(doc(db, 'kanbu_rooms', room.id), { liveSessionId: null });
                setActiveTab('free_board');
              }}
            />
          ) : isCreator ? (
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="text-center max-w-sm">
                <p className="text-[32px] mb-3">🔴</p>
                <p className="text-[14px] font-[1000] text-slate-800 mb-2">텍스트 라이브</p>
                <p className="text-[12px] font-bold text-slate-400 mb-5">
                  깐부들에게 실시간으로 글을 전달할 수 있습니다. 종료하면 보드 내용이 아카이브됩니다.
                </p>
                <button onClick={createLiveSession} disabled={creatingLive}
                  className="px-6 py-2.5 bg-red-500 hover:bg-red-600 disabled:opacity-40 text-white rounded-lg text-[12px] font-[1000] transition-colors">
                  {creatingLive ? '생성 중...' : '🔴 텍스트 라이브 시작하기'}
                </button>
              </div>
            </div>
          ) : null
        )}

        {/* 💬 채팅 */}
        {activeTab === 'chat' && (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-1">
              {chats.length === 0 && <div className="py-10 text-center text-slate-200 font-bold text-[11px]">첫 메시지를 보내보세요 💬</div>}
              {chats.map(chat => {
                const isMe = chat.authorId === currentUserData.uid;
                return (
                  <div key={chat.id} className={`flex items-end gap-1.5 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                    {!isMe && <img src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${chat.author}`} alt="" className="w-6 h-6 rounded-full bg-slate-100 mb-1" />}
                    <div className={`flex flex-col gap-0.5 max-w-[75%] ${isMe ? 'items-end' : 'items-start'}`}>
                      {!isMe && <span className="text-[9px] font-[1000] text-slate-400 px-1">{chat.author}</span>}
                      <div className={`px-3 py-2 rounded-2xl text-[12px] font-bold leading-relaxed break-words ${isMe ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-white border border-slate-100 text-slate-800 rounded-bl-sm'}`}>
                        {chat.content}
                      </div>
                      <span className="text-[9px] font-bold text-slate-300 px-1">{formatTime(chat.createdAt)}</span>
                    </div>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>
            <div className="border-t border-slate-100 px-3 py-2.5 shrink-0 bg-white">
              <div className="flex gap-2 items-center">
                <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
                  placeholder="메시지 입력..."
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-full px-4 py-2 text-[12px] font-bold text-slate-700 outline-none focus:border-slate-400" />
                <button onClick={sendChat} disabled={!chatInput.trim() || isSending}
                  className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center hover:bg-blue-700 disabled:opacity-40 shrink-0">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 12h14M12 5l7 7-7 7" /></svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 👥 멤버 */}
        {activeTab === 'members' && (
          <div className="flex-1 overflow-y-auto">
            <div className="px-4 py-3 border-b border-slate-100">
              <p className="text-[11px] font-[1000] text-slate-400 uppercase tracking-widest">멤버 {memberIds.length}명</p>
            </div>
            {memberIds.map(uid => {
              const u = allUsers[uid];
              const isOwner = uid === room.creatorId;
              const isPaidOnce = room.paidOnceMembers?.includes(uid);
              const isPaidMonthly = room.paidMonthlyMembers?.includes(uid);
              return (
                <div key={uid} className="px-4 py-3 border-b border-slate-100 last:border-0 flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <img src={u?.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${u?.nickname || uid}`} alt="" className="w-8 h-8 rounded-full bg-slate-100" />
                    <div className="flex flex-col min-w-0">
                      <span className="text-[13px] font-bold text-slate-800 truncate">{u?.nickname || uid.slice(0, 8)}</span>
                      <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                        {isOwner && <span className="text-blue-600">개설자</span>}
                        {!isOwner && <span>멤버</span>}
                        {isPaidOnce && <><span>·</span><span className="text-amber-600">1회 결제</span></>}
                        {isPaidMonthly && <><span>·</span><span className="text-emerald-600">구독 중</span></>}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ⚙️ 관리 */}
        {activeTab === 'admin' && isCreator && (
          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {/* 유료 게시판 설정 */}
            <div className="bg-white border border-slate-100 rounded-xl p-4 space-y-4">
              <p className="text-[12px] font-[1000] text-slate-700">💰 유료 게시판 설정</p>
              <p className="text-[10px] font-bold text-slate-400">수수료 {feePercent}% (Lv{room.creatorLevel || 1}) — 플랫폼 {feePercent}% · 개설자 {100 - feePercent}%</p>

              {/* A타입: 1회 결제 */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={onceEnabled} onChange={e => setOnceEnabled(e.target.checked)} className="rounded" />
                  <span className="text-[11px] font-[1000] text-slate-700">A타입 · 1회 결제 (영구)</span>
                </label>
                {onceEnabled && (
                  <div className="flex items-center gap-2 pl-6">
                    <input type="text" value={onceTitle} onChange={e => setOnceTitle(e.target.value)} placeholder="게시판 이름"
                      className="flex-1 px-2 py-1 border border-slate-200 rounded text-[11px] font-bold focus:outline-none" />
                    <input type="number" value={oncePrice} onChange={e => setOncePrice(Math.max(1, parseInt(e.target.value) || 1))} min={1}
                      className="w-16 px-2 py-1 border border-slate-200 rounded text-[11px] font-bold focus:outline-none" />
                    <span className="text-[10px] font-bold text-slate-400">볼</span>
                  </div>
                )}
              </div>

              {/* B타입: 월 구독 */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={monthlyEnabled} onChange={e => setMonthlyEnabled(e.target.checked)} className="rounded" />
                  <span className="text-[11px] font-[1000] text-slate-700">B타입 · 월 구독 (30일)</span>
                </label>
                {monthlyEnabled && (
                  <div className="flex items-center gap-2 pl-6">
                    <input type="text" value={monthlyTitle} onChange={e => setMonthlyTitle(e.target.value)} placeholder="게시판 이름"
                      className="flex-1 px-2 py-1 border border-slate-200 rounded text-[11px] font-bold focus:outline-none" />
                    <input type="number" value={monthlyPrice} onChange={e => setMonthlyPrice(Math.max(1, parseInt(e.target.value) || 1))} min={1}
                      className="w-16 px-2 py-1 border border-slate-200 rounded text-[11px] font-bold focus:outline-none" />
                    <span className="text-[10px] font-bold text-slate-400">볼/월</span>
                  </div>
                )}
              </div>

              <button onClick={savePaidSettings} disabled={savingSettings}
                className="w-full py-2 bg-slate-900 hover:bg-slate-700 disabled:opacity-40 text-white rounded-lg text-[11px] font-[1000] transition-colors">
                {savingSettings ? '저장 중...' : '설정 저장'}
              </button>
            </div>

            {/* 멤버 관리 */}
            <div className="bg-white border border-slate-100 rounded-xl p-4">
              <p className="text-[12px] font-[1000] text-slate-700 mb-3">👥 멤버 관리</p>
              {memberIds.filter(uid => uid !== room.creatorId).map(uid => {
                const u = allUsers[uid];
                return (
                  <div key={uid} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                    <span className="text-[12px] font-bold text-slate-700">{u?.nickname || uid.slice(0, 8)}</span>
                    <button onClick={() => handleKick(uid, u?.nickname || uid)}
                      className="text-[10px] font-bold text-rose-500 hover:text-rose-700 px-2 py-1 rounded hover:bg-rose-50 transition-colors">
                      강퇴
                    </button>
                  </div>
                );
              })}
              {memberIds.filter(uid => uid !== room.creatorId).length === 0 && (
                <p className="text-[11px] font-bold text-slate-300 italic py-2">멤버가 없습니다.</p>
              )}
            </div>

            {/* 방 설정 */}
            <div className="bg-white border border-slate-100 rounded-xl p-4 space-y-3">
              <p className="text-[12px] font-[1000] text-slate-700">🏠 방 설정</p>
              <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="방 제목"
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-[12px] font-bold focus:outline-none focus:border-slate-400" />
              <input type="text" value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="설명 (선택)"
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-[12px] font-bold focus:outline-none focus:border-slate-400" />
            </div>

            {/* 🚀 카드 설정 (표지 이미지 + 표시 옵션) */}
            <div className="bg-white border border-slate-100 rounded-xl p-4 space-y-3">
              <p className="text-[12px] font-[1000] text-slate-700">🎨 카드 설정</p>
              <p className="text-[10px] font-bold text-slate-400 -mt-1">깐부방 찾기 화면 카드에 노출되는 정보</p>

              {/* 표지 이미지 */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">방 표지 (16:9)</label>
                {editThumbnailPreview ? (
                  <div className="relative">
                    <div className="aspect-[16/9] rounded-lg overflow-hidden border border-slate-200 max-w-[240px]">
                      <img src={editThumbnailPreview} alt="" className="w-full h-full object-cover" />
                    </div>
                    <button onClick={() => { setEditThumbnailFile(null); if (editThumbnailPreview) URL.revokeObjectURL(editThumbnailPreview); setEditThumbnailPreview(null); }}
                      className="absolute top-1.5 right-1.5 bg-white/90 rounded-full w-6 h-6 flex items-center justify-center shadow-sm">
                      <svg className="w-3 h-3 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                ) : room.thumbnailUrl ? (
                  <div className="relative">
                    <div className="aspect-[16/9] rounded-lg overflow-hidden border border-slate-200 max-w-[240px]">
                      <img src={room.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                    </div>
                    <label className="absolute bottom-1.5 right-1.5 bg-white/90 hover:bg-white rounded-full px-2.5 py-1 text-[10px] font-bold text-slate-600 cursor-pointer shadow-sm">
                      교체
                      <input type="file" accept="image/*" className="hidden" onChange={e => {
                        const f = e.target.files?.[0];
                        if (f) { setEditThumbnailFile(f); setEditThumbnailPreview(URL.createObjectURL(f)); }
                      }} />
                    </label>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center aspect-[16/9] max-w-[240px] rounded-lg border-2 border-dashed border-slate-200 cursor-pointer hover:border-blue-300 transition-colors">
                    <svg className="w-7 h-7 text-slate-300 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    <span className="text-[10px] font-bold text-slate-400">표지 이미지 업로드</span>
                    <input type="file" accept="image/*" className="hidden" onChange={e => {
                      const f = e.target.files?.[0];
                      if (f) { setEditThumbnailFile(f); setEditThumbnailPreview(URL.createObjectURL(f)); }
                    }} />
                  </label>
                )}
              </div>

              {/* 표시 옵션 토글 */}
              <div className="flex flex-col gap-1 border border-slate-100 rounded-lg p-2 bg-slate-50/50">
                {[
                  { label: '호스트 정보 (Lv·평판)',    v: showHostInfo,   s: setShowHostInfo   },
                  { label: '멤버 수',                   v: showMember,     s: setShowMember     },
                  { label: '땡스볼 합계',               v: showThanksball, s: setShowThanksball },
                  { label: '유료/구독 최신글 스니펫',   v: showPaidPreview,s: setShowPaidPreview},
                ].map((o, i) => (
                  <label key={i} className="flex items-center justify-between cursor-pointer py-0.5">
                    <span className="text-[11px] font-bold text-slate-600">{o.label}</span>
                    <input type="checkbox" checked={o.v} onChange={e => o.s(e.target.checked)} className="w-3.5 h-3.5 accent-blue-600" />
                  </label>
                ))}
              </div>

              <button onClick={saveCardSettings} disabled={isUploadingThumb}
                className="w-full py-2 bg-slate-900 hover:bg-slate-700 disabled:opacity-40 text-white rounded-lg text-[11px] font-[1000] transition-colors">
                {isUploadingThumb ? '저장 중...' : '카드 설정 저장'}
              </button>
            </div>

            {/* 방 삭제 */}
            <div className="bg-white border border-red-100 rounded-xl p-4">
              <p className="text-[12px] font-[1000] text-red-500 mb-1">🗑️ 깐부방 삭제</p>
              <p className="text-[10px] font-bold text-slate-400 mb-3">삭제하면 모든 데이터가 사라집니다.</p>
              <button onClick={handleDeleteRoom}
                className="w-full py-2 border border-red-300 text-red-500 hover:bg-red-50 rounded-lg text-[11px] font-[1000] transition-colors">
                이 깐부방 삭제하기
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default KanbuRoomView;
