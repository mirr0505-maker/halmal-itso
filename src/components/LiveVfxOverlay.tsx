// src/components/LiveVfxOverlay.tsx — 🎇 땡스볼 VFX 오버레이
// 티어별 연출: 브론즈(파티클) / 실버(배너 5초) / 골드(전광판 10초) / 레전드(배경 반전 15초)
// prefers-reduced-motion 대응: 모든 VFX는 정적 배너로 대체
import { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, limit, where } from 'firebase/firestore';

export type VfxTier = 'bronze' | 'silver' | 'gold' | 'legend';

export const getTierForAmount = (amount: number): VfxTier => {
  if (amount >= 100) return 'legend';
  if (amount >= 50) return 'gold';
  if (amount >= 10) return 'silver';
  return 'bronze';
};

const TIER_CONFIG: Record<VfxTier, { emoji: string; label: string; duration: number; bg: string }> = {
  bronze:  { emoji: '🔶', label: '브론즈',   duration: 2000,  bg: 'bg-amber-50 border-amber-200 text-amber-700' },
  silver:  { emoji: '⚪', label: '실버',     duration: 5000,  bg: 'bg-slate-50 border-slate-200 text-slate-700' },
  gold:    { emoji: '⭐', label: '골드',     duration: 10000, bg: 'bg-yellow-50 border-yellow-200 text-yellow-700' },
  legend:  { emoji: '👑', label: '레전드',   duration: 15000, bg: 'bg-purple-50 border-purple-300 text-purple-800' },
};

interface VfxEvent {
  id: string;
  tier: VfxTier;
  amount: number;
  sender: string;
  message?: string;
}

interface Props {
  sessionId: string;
}

const LiveVfxOverlay = ({ sessionId }: Props) => {
  const [queue, setQueue] = useState<VfxEvent[]>([]);
  const [current, setCurrent] = useState<VfxEvent | null>(null);
  const playedIds = useRef<Set<string>>(new Set());

  // 최근 thanksball 이벤트 구독
  useEffect(() => {
    const q = query(
      collection(db, 'live_sessions', sessionId, 'live_chats'),
      where('type', '==', 'thanksball'),
      orderBy('createdAt', 'desc'),
      limit(10),
    );
    return onSnapshot(q, snap => {
      const newEvents: VfxEvent[] = [];
      snap.docChanges().forEach(change => {
        if (change.type === 'added') {
          const data = change.doc.data();
          if (playedIds.current.has(change.doc.id)) return;
          playedIds.current.add(change.doc.id);
          newEvents.push({
            id: change.doc.id,
            tier: (data.vfxTier as VfxTier) || 'bronze',
            amount: data.amount || 0,
            sender: data.nickname || '익명',
            message: data.text,
          });
        }
      });
      if (newEvents.length > 0) {
        setQueue(prev => [...prev, ...newEvents]);
      }
    });
  }, [sessionId]);

  // 큐 순차 재생
  useEffect(() => {
    if (current || queue.length === 0) return;
    const next = queue[0];
    setCurrent(next);
    setQueue(prev => prev.slice(1));
    const cfg = TIER_CONFIG[next.tier];
    const timer = setTimeout(() => setCurrent(null), cfg.duration);
    return () => clearTimeout(timer);
  }, [queue, current]);

  if (!current) return null;
  const cfg = TIER_CONFIG[current.tier];

  return (
    <div className="pointer-events-none fixed top-20 left-1/2 -translate-x-1/2 z-50 motion-reduce:animate-none animate-in fade-in slide-in-from-top-4">
      <div className={`px-5 py-3 rounded-2xl border-2 shadow-2xl ${cfg.bg} ${current.tier === 'legend' ? 'motion-safe:animate-pulse' : ''}`}>
        <div className="flex items-center gap-2">
          <span className="text-[22px]">{cfg.emoji}</span>
          <div>
            <p className="text-[13px] font-[1000]">
              {current.sender} → 🏀 {current.amount}볼 ({cfg.label})
            </p>
            {current.message && (
              <p className="text-[11px] font-bold mt-0.5 opacity-80">"{current.message}"</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveVfxOverlay;
