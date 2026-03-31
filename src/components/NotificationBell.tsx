// src/components/NotificationBell.tsx
import { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, limit, onSnapshot, updateDoc, doc, writeBatch } from 'firebase/firestore';

interface Notification {
  id: string;
  type: 'thanksball' | 'community_post' | 'finger_promoted';
  fromNickname?: string;
  amount?: number;
  message?: string;
  postId?: string;
  postTitle?: string;
  communityId?: string;
  communityName?: string;
  createdAt?: { seconds: number } | number;
  read: boolean;
}

interface Props {
  currentUid: string;       // 🚀 UID 기반 경로로 전환
  currentNickname: string;  // 표시용 (읽음 처리에는 미사용)
  onNavigate: (postId: string) => void;
}

const formatTime = (ts: { seconds: number } | number | null | undefined) => {
  if (!ts) return '';
  const d = (ts as { seconds: number }).seconds ? new Date((ts as { seconds: number }).seconds * 1000) : new Date(ts as number);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return '방금 전';
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
};

const NotificationBell = ({ currentUid, onNavigate }: Props) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.read).length;

  // 🚀 경로를 UID 기반으로 변경 — 닉네임 변경 시에도 구독이 끊기지 않음
  useEffect(() => {
    if (!currentUid) return;
    const q = query(
      collection(db, 'notifications', currentUid, 'items'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    return onSnapshot(q, snap => {
      setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() } as Notification)));
    });
  }, [currentUid]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const markAsRead = async (notif: Notification) => {
    if (!notif.read) {
      await updateDoc(doc(db, 'notifications', currentUid, 'items', notif.id), { read: true });
    }
    if (notif.postId) onNavigate(notif.postId);
    setIsOpen(false);
  };

  const markAllRead = async () => {
    const unread = notifications.filter(n => !n.read);
    if (unread.length === 0) return;
    const batch = writeBatch(db);
    unread.forEach(n => {
      batch.update(doc(db, 'notifications', currentUid, 'items', n.id), { read: true });
    });
    await batch.commit();
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className="relative w-[42px] h-[42px] flex items-center justify-center rounded-full border border-slate-100 bg-white hover:bg-slate-50 transition-colors"
      >
        <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-rose-500 text-white text-[9px] font-black rounded-full flex items-center justify-center px-1">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-[50px] w-[320px] bg-white rounded-2xl shadow-2xl border border-slate-100 z-[100] overflow-hidden">
          {/* 헤더 */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-50">
            <div className="flex items-center gap-2">
              <h3 className="text-[13px] font-[1000] text-slate-900">알림</h3>
              {unreadCount > 0 && (
                <span className="text-[10px] font-black text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded-full border border-rose-100">
                  {unreadCount}개 새 알림
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-[11px] font-bold text-blue-500 hover:text-blue-600 transition-colors">
                모두 읽음
              </button>
            )}
          </div>

          {/* 알림 목록 */}
          <div className="max-h-[420px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-2xl mb-2">🔔</p>
                <p className="text-[12px] text-slate-300 font-bold">아직 알림이 없어요</p>
              </div>
            ) : (
              notifications.map(n => {
                // 🚀 타입별 아이콘·메시지 분기
                const icon = n.type === 'community_post' ? '🧤' : n.type === 'finger_promoted' ? '🖐' : '⚾';
                const body = n.type === 'community_post' || n.type === 'finger_promoted'
                  ? (n.message || '')
                  : (<><span className="text-blue-600">{n.fromNickname}</span>님이{' '}<span className="text-amber-500 font-[1000]">{n.amount}볼</span> 땡스볼을 보냈어요</>);
                return (
                  <div
                    key={n.id}
                    onClick={() => markAsRead(n)}
                    className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-slate-50 border-b border-slate-50/80 last:border-0 ${!n.read ? 'bg-amber-50/40' : ''}`}
                  >
                    <span className="text-lg shrink-0 mt-0.5">{icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-[1000] text-slate-800 leading-snug">{body}</p>
                      {n.message && n.type === 'thanksball' && (
                        <p className="text-[11px] text-slate-500 font-bold mt-0.5 truncate">"{n.message}"</p>
                      )}
                      {n.postTitle && (
                        <p className="text-[10px] text-slate-400 font-bold mt-0.5 truncate">{n.postTitle}</p>
                      )}
                      <p className="text-[10px] text-slate-300 font-bold mt-1">{formatTime(n.createdAt)}</p>
                    </div>
                    {!n.read && <div className="w-2 h-2 bg-rose-400 rounded-full shrink-0 mt-2" />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
