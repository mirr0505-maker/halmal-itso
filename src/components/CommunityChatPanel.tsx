// src/components/CommunityChatPanel.tsx — 🚀 Phase 7 Step 6: 채팅 완성 (삭제 + 페이징 + Rules)
import { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../firebase';
import { collection, doc, setDoc, updateDoc, arrayUnion, arrayRemove, query, orderBy, limit, startAfter, getDocs, onSnapshot, serverTimestamp } from 'firebase/firestore';
import type { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import type { Community, UserData, CommunityMember, ChatMessage } from '../types';
import ThanksballModal from './ThanksballModal';
import { CHAT_MEMBER_LIMIT } from '../types';
import { calculateLevel } from '../utils';
import { uploadToR2 } from '../uploadToR2';
import VerifiedBadgeComponent from './VerifiedBadge';

interface Props {
  community: Community;
  currentUser: UserData | null;
  members: CommunityMember[];
  allUsers?: Record<string, UserData>;
}

const REACTION_EMOJIS = ['👍', '❤️', '😂', '🔥', '🤔', '💯'] as const;

// 🧤 finger 역할 한글 라벨
const FINGER_LABEL: Record<string, string> = {
  thumb: '개설자', index: '부관리', middle: '핵심멤버', ring: '멤버', pinky: '새내기',
};

// 🧤 닉네임 배지 값 포맷 (숫자 → K단위)
function formatBadgeValue(value: unknown): string {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value === 'object' && value !== null && 'value' in value) {
    // shares 타입: { value: number, unit: string, label?: string }
    const v = (value as { value: number }).value;
    if (typeof v === 'number') {
      if (v >= 1000) return `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}K`;
      return String(v);
    }
  }
  if (typeof value === 'number') {
    if (value >= 1000) return `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}K`;
    return String(value);
  }
  return String(value).slice(0, 10);
}

// 🧤 채팅 작성자 라인 — 닉네임 · finger역할 · Lv · 배지값
function ChatAuthorLine({ message, community, members }: { message: ChatMessage; community: Community; members: CommunityMember[] }) {
  const finger = message.authorFinger || 'ring';
  const fingerLabel = FINGER_LABEL[finger] || '멤버';

  // displayBadgeKey에 해당하는 가입 답변 값 조회
  let badgeValue = '';
  if (community.displayBadgeKey) {
    const member = members.find(m => m.userId === message.author_id);
    if (member?.joinAnswers) {
      const key = community.displayBadgeKey;
      if (key.startsWith('custom_')) {
        // 커스텀 질문 답변
        const ans = member.joinAnswers.custom?.find(a => a.questionId === key);
        if (ans) badgeValue = formatBadgeValue(ans.answer);
      } else if (key === 'shares' && member.joinAnswers.standard?.shares) {
        badgeValue = formatBadgeValue(member.joinAnswers.standard.shares);
      } else if (key === 'name' && member.joinAnswers.standard?.name) {
        badgeValue = member.joinAnswers.standard.name;
      } else if (key === 'region' && member.joinAnswers.standard?.region) {
        badgeValue = String(member.joinAnswers.standard.region);
      }
    }
  }

  return (
    <div className="flex items-center gap-1 mb-0.5 px-1 flex-wrap">
      <span className="text-[11px] font-[1000] text-slate-700">{message.author}</span>
      <span className="text-[8px] font-[1000] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{fingerLabel}</span>
      <span className="text-[9px] font-bold text-slate-300">Lv{message.authorLevel}</span>
      {badgeValue && (
        <span className="text-[9px] font-[1000] text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">{badgeValue}</span>
      )}
      {message.authorVerified && (
        <VerifiedBadgeComponent verified={message.authorVerified} size="sm" showDate={false} showTier={community.category === '주식'} />
      )}
    </div>
  );
}

// 🚀 메시지 한 개 렌더링
function ChatMessageItem({ message, currentUid, isAdmin, community, members, onReply, onToggleReaction, reactionPickerFor, setReactionPickerFor, onImageClick, onSendThanksball, onDelete }: {
  message: ChatMessage;
  currentUid: string;
  isAdmin: boolean;
  community: Community;
  members: CommunityMember[];
  onReply: (msg: ChatMessage) => void;
  onToggleReaction: (msg: ChatMessage, emoji: string) => void;
  reactionPickerFor: string | null;
  setReactionPickerFor: (id: string | null) => void;
  onImageClick: (url: string) => void;
  onSendThanksball: (msg: ChatMessage) => void;
  onDelete: (msg: ChatMessage) => void;
}) {
  const isMine = message.author_id === currentUid;

  const timeStr = (() => {
    if (!message.createdAt) return '';
    const ts = message.createdAt;
    const date = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000);
    const h = date.getHours();
    const m = date.getMinutes();
    const ampm = h < 12 ? '오전' : '오후';
    const h12 = h % 12 || 12;
    return `${ampm} ${h12}:${String(m).padStart(2, '0')}`;
  })();

  const activeReactions = message.reactions
    ? Object.entries(message.reactions).filter(([, users]) => users.length > 0)
    : [];

  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} group`}>
      <div className={`max-w-[75%] flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
        {/* 작성자 정보 (내 메시지는 생략) */}
        {!isMine && (
          <ChatAuthorLine message={message} community={community} members={members} />
        )}

        {/* 🚀 답장 인용 미리보기 */}
        {message.replyTo && (
          <div className={`mb-1 px-2.5 py-1.5 rounded-lg border-l-2 text-[11px] max-w-full ${
            isMine ? 'bg-emerald-50 border-emerald-300' : 'bg-slate-100 border-slate-300'
          }`}>
            <p className="font-[1000] text-slate-500 text-[10px]">↩ {message.replyTo.author}</p>
            <p className="text-slate-500 truncate">{message.replyTo.snippet}</p>
          </div>
        )}

        {/* 🚀 이미지 (본문 위) */}
        {message.imageUrl && !message.deleted && (
          <button
            onClick={() => onImageClick(message.imageUrl!)}
            className="block mb-1 max-w-[280px] rounded-xl overflow-hidden border border-slate-200 hover:opacity-90 transition-opacity"
          >
            <img src={message.imageUrl} alt="첨부 이미지" className="w-full h-auto max-h-[300px] object-contain bg-slate-100" loading="lazy" />
          </button>
        )}
        {/* 🚀 문서 파일 첨부 (PDF/DOC/XLSX/PPTX) */}
        {message.fileUrl && !message.deleted && (
          <a
            href={message.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className={`flex items-center gap-2 mb-1 px-3 py-2 rounded-xl border max-w-[280px] transition-colors ${
              isMine ? 'bg-emerald-400/80 border-emerald-300 text-white hover:bg-emerald-400' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <span className="text-[20px] shrink-0">{(() => { const ext = (message.fileName || '').split('.').pop()?.toLowerCase() || ''; const icons: Record<string, string> = { pdf: '📄', doc: '📝', docx: '📝', xls: '📊', xlsx: '📊', ppt: '📑', pptx: '📑' }; return icons[ext] || '📎'; })()}</span>
            <div className="flex flex-col min-w-0">
              <span className="text-[12px] font-bold truncate">{message.fileName || '파일'}</span>
              <span className={`text-[9px] ${isMine ? 'text-emerald-100' : 'text-slate-400'}`}>다운로드</span>
            </div>
          </a>
        )}

        {/* 메시지 본문 + 시간 + 액션 버튼 */}
        <div className={`flex items-end gap-1 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
          {/* 텍스트가 있을 때만 본문 박스 렌더링 */}
          {(message.content || message.deleted) && (
            <div className={`px-3 py-2 rounded-2xl text-[13px] font-medium whitespace-pre-wrap break-words leading-relaxed ${
              isMine
                ? 'bg-emerald-500 text-white rounded-br-sm'
                : 'bg-white text-slate-800 rounded-bl-sm border border-slate-200'
            }`}>
              {message.deleted ? (
                <span className="italic text-slate-400">삭제된 메시지입니다</span>
              ) : message.content}
            </div>
          )}
          <div className="flex flex-col items-center gap-0.5 shrink-0">
            <span className="text-[9px] text-slate-300">{timeStr}</span>
            {!message.deleted && (
              <div className="flex items-center gap-1">
                {!isMine && (
                  <button onClick={() => onReply(message)} className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-100 hover:bg-emerald-100 text-slate-400 hover:text-emerald-600 text-[13px] transition-colors" title="답장">↩</button>
                )}
                {!isMine && (
                  <button onClick={() => onSendThanksball(message)} className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-100 hover:bg-amber-100 text-slate-400 hover:text-amber-600 text-[13px] transition-colors" title="땡스볼">⚾</button>
                )}
                <div className="relative">
                  <button onClick={() => setReactionPickerFor(reactionPickerFor === message.id ? null : message.id)}
                    className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-100 hover:bg-blue-100 text-slate-400 hover:text-blue-600 text-[15px] font-[1000] transition-colors" title="반응">+</button>
                  {reactionPickerFor === message.id && (
                    <div
                      className="absolute z-20 bg-white border border-slate-200 rounded-full shadow-lg px-1.5 py-1 flex gap-0.5 bottom-full mb-1 left-1/2 -translate-x-1/2"
                      onMouseLeave={() => setReactionPickerFor(null)}
                    >
                      {REACTION_EMOJIS.map(emoji => (
                        <button key={emoji}
                          onClick={() => { onToggleReaction(message, emoji); setReactionPickerFor(null); }}
                          className="text-[16px] hover:scale-125 transition-transform px-0.5"
                        >{emoji}</button>
                      ))}
                    </div>
                  )}
                </div>
                {/* 🚀 Step 6: 삭제 버튼 (본인 또는 대장/부대장) */}
                {(isMine || isAdmin) && (
                  <button onClick={() => onDelete(message)} className="text-[12px] text-slate-300 hover:text-rose-500 px-0.5" title="삭제">🗑</button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 🚀 이모지 반응 표시 */}
        {/* 이모지 반응 + 땡스볼 누적 */}
        {(activeReactions.length > 0 || (message.thanksballTotal ?? 0) > 0) && (
          <div className={`flex flex-wrap items-center gap-1 mt-0.5 ${isMine ? 'justify-end' : 'justify-start'}`}>
            {activeReactions.map(([emoji, users]) => {
              const reacted = users.includes(currentUid);
              return (
                <button key={emoji} onClick={() => onToggleReaction(message, emoji)}
                  className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] border transition-colors ${
                    reacted
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <span>{emoji}</span>
                  <span className="font-[1000] text-[10px]">{users.length}</span>
                </button>
              );
            })}
            {/* 🚀 땡스볼 누적 표시 */}
            {(message.thanksballTotal ?? 0) > 0 && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] bg-amber-50 border border-amber-200 text-amber-700">
                <span>⚾</span>
                <span className="font-[1000] text-[10px]">{message.thanksballTotal}볼</span>
                {message.thanksballSenders && message.thanksballSenders.length > 0 && (
                  <span className="text-[9px] text-amber-500">
                    · {message.thanksballSenders.slice(0, 2).join(', ')}
                    {message.thanksballSenders.length > 2 && ` 외 ${message.thanksballSenders.length - 2}명`}
                  </span>
                )}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const CommunityChatPanel = ({ community, currentUser, members, allUsers = {} }: Props) => {
  const isAvailable = (community.memberCount ?? 0) <= CHAT_MEMBER_LIMIT;
  const myMembership = currentUser ? members.find(m => m.userId === currentUser.uid) : null;
  const isMember = myMembership && (myMembership.joinStatus ?? 'active') === 'active';

  const isAdmin = myMembership?.finger === 'thumb' || myMembership?.finger === 'index';

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [replyTarget, setReplyTarget] = useState<ChatMessage | null>(null);
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);
  // 🚀 Step 5: 땡스볼 상태
  const [thanksballTarget, setThanksballTarget] = useState<ChatMessage | null>(null);
  // 🚀 Step 4: 파일 업로드 상태 (이미지 + 문서)
  const [pendingFile, setPendingFile] = useState<{ file: File; previewUrl: string; isImage: boolean } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  // 🚀 Step 6: 페이징 상태
  const [oldestDoc, setOldestDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // 🚀 onSnapshot 실시간 구독 — 최근 50개
  useEffect(() => {
    if (!isAvailable || !isMember) { setLoading(false); return; }
    const messagesRef = collection(doc(db, 'community_chats', community.id), 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'desc'), limit(50));
    const unsubscribe = onSnapshot(q, (snap) => {
      const msgs: ChatMessage[] = snap.docs.map(d => d.data() as ChatMessage);
      msgs.reverse();
      setMessages(prev => {
        // 페이징으로 이미 로드한 과거 메시지 유지 + 최신 50개 병합
        const oldIds = new Set(msgs.map(m => m.id));
        const olderMsgs = prev.filter(m => !oldIds.has(m.id));
        return [...olderMsgs, ...msgs];
      });
      // 가장 오래된 문서 기록 (페이징 커서)
      if (snap.docs.length > 0) setOldestDoc(snap.docs[snap.docs.length - 1]);
      setLoading(false);
    }, (err) => { console.error('[community_chats onSnapshot]', err); setLoading(false); });
    return () => unsubscribe();
  }, [community.id, isAvailable, isMember]);

  // 🚀 Step 6: 과거 메시지 더 불러오기 (스크롤 기반)
  const loadMoreMessages = useCallback(async () => {
    if (loadingMore || !hasMore || !oldestDoc) return;
    setLoadingMore(true);
    try {
      const messagesRef = collection(doc(db, 'community_chats', community.id), 'messages');
      const q = query(messagesRef, orderBy('createdAt', 'desc'), startAfter(oldestDoc), limit(30));
      const snap = await getDocs(q);
      if (snap.empty || snap.docs.length < 30) setHasMore(false);
      if (!snap.empty) {
        const olderMsgs: ChatMessage[] = snap.docs.map(d => d.data() as ChatMessage);
        olderMsgs.reverse();
        setMessages(prev => [...olderMsgs, ...prev]);
        setOldestDoc(snap.docs[snap.docs.length - 1]);
      }
    } catch (e) { console.error('[loadMore]', e); }
    finally { setLoadingMore(false); }
  }, [community.id, loadingMore, hasMore, oldestDoc]);

  // 🚀 스크롤 감지 — 맨 위 도달 시 과거 메시지 로드
  const handleScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el || loadingMore || !hasMore) return;
    if (el.scrollTop < 80) loadMoreMessages();
  }, [loadMoreMessages, loadingMore, hasMore]);

  // 🚀 새 메시지 시 자동 스크롤 (맨 아래에 있을 때만)
  const isNearBottom = useRef(true);
  useEffect(() => {
    if (isNearBottom.current) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  const trackScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    isNearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    handleScroll();
  }, [handleScroll]);

  // 🚀 허용 파일 타입 (이미지 + 문서)
  const ALLOWED_TYPES = ['image/', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument', 'application/vnd.ms-excel', 'application/vnd.ms-powerpoint'];
  const FILE_ICONS: Record<string, string> = { pdf: '📄', doc: '📝', docx: '📝', xls: '📊', xlsx: '📊', ppt: '📑', pptx: '📑' };
  const getFileIcon = (name: string) => { const ext = name.split('.').pop()?.toLowerCase() || ''; return FILE_ICONS[ext] || '📎'; };
  const isAllowedFile = (file: File) => ALLOWED_TYPES.some(t => file.type.startsWith(t));

  // 🚀 파일 선택 공통 핸들러 (이미지 + 문서)
  const handleFileSelect = (file: File) => {
    if (!isAllowedFile(file)) { alert('이미지, PDF, DOC, XLSX, PPTX 파일만 업로드할 수 있습니다.'); return; }
    if (file.size > 10 * 1024 * 1024) { alert('파일은 10MB 이하만 업로드 가능합니다.'); return; }
    if (pendingFile) URL.revokeObjectURL(pendingFile.previewUrl);
    const isImage = file.type.startsWith('image/');
    setPendingFile({ file, previewUrl: isImage ? URL.createObjectURL(file) : '', isImage });
  };

  // 🚀 클립보드 paste (Ctrl+V 이미지)
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData.items;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) { e.preventDefault(); handleFileSelect(file); return; }
      }
    }
  };

  // 🚀 드래그&드롭
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  };

  // 🚀 메시지 전송 (텍스트 + 이미지 + 답장)
  const handleSend = async () => {
    if (!currentUser || !myMembership || sending) return;
    const trimmed = input.trim();
    if (!trimmed && !pendingFile) return;
    if (trimmed.length > 500) { alert('메시지는 500자 이내로 입력해주세요.'); return; }

    setSending(true);
    if (pendingFile) setUploading(true);

    try {
      // 파일 업로드 (이미지 또는 문서)
      let uploadedUrl: string | undefined;
      if (pendingFile) {
        const ext = pendingFile.file.name.split('.').pop() || 'bin';
        const filePath = `chats/${community.id}/${Date.now()}_${currentUser.uid.slice(0, 8)}.${ext}`;
        uploadedUrl = await uploadToR2(pendingFile.file, filePath);
      }

      const messageId = `chat_${Date.now()}_${currentUser.uid.slice(0, 8)}`;
      const messageRef = doc(collection(doc(db, 'community_chats', community.id), 'messages'), messageId);

      const messageData: Record<string, unknown> = {
        id: messageId,
        communityId: community.id,
        author: currentUser.nickname,
        author_id: currentUser.uid,
        authorLevel: calculateLevel(currentUser.exp || 0),
        content: trimmed,
        createdAt: serverTimestamp(),
      };
      // 이미지 vs 문서 분기
      if (uploadedUrl && pendingFile) {
        if (pendingFile.isImage) {
          messageData.imageUrl = uploadedUrl;
        } else {
          messageData.fileUrl = uploadedUrl;
          messageData.fileName = pendingFile.file.name;
        }
      }
      if (myMembership.finger) messageData.authorFinger = myMembership.finger;
      if (myMembership.verified) messageData.authorVerified = myMembership.verified;
      if (replyTarget) {
        messageData.replyTo = {
          messageId: replyTarget.id,
          author: replyTarget.author,
          snippet: (replyTarget.content || '[이미지]').length > 50
            ? (replyTarget.content || '[이미지]').slice(0, 50) + '...'
            : (replyTarget.content || '[이미지]'),
        };
      }

      await setDoc(messageRef, messageData);

      // 정리
      setInput('');
      setReplyTarget(null);
      if (pendingFile) { URL.revokeObjectURL(pendingFile.previewUrl); setPendingFile(null); }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '메시지 전송 실패';
      alert(msg);
      console.error('[chat send]', e);
    } finally { setSending(false); setUploading(false); }
  };

  // 🚀 이모지 반응 토글
  const handleToggleReaction = async (message: ChatMessage, emoji: string) => {
    if (!currentUser) return;
    const messageRef = doc(collection(doc(db, 'community_chats', community.id), 'messages'), message.id);
    const currentReactors = message.reactions?.[emoji] ?? [];
    const alreadyReacted = currentReactors.includes(currentUser.uid);
    const fieldKey = `reactions.${emoji}`;
    try {
      await updateDoc(messageRef, { [fieldKey]: alreadyReacted ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid) });
    } catch (e) { console.error('[reaction toggle]', e); }
  };

  // 🚀 Step 6: 메시지 삭제 (soft delete)
  const handleDeleteMessage = async (message: ChatMessage) => {
    if (!currentUser) return;
    const canDelete = message.author_id === currentUser.uid || isAdmin;
    if (!canDelete) return;
    if (!window.confirm('이 메시지를 삭제하시겠습니까?')) return;
    try {
      const messageRef = doc(collection(doc(db, 'community_chats', community.id), 'messages'), message.id);
      await updateDoc(messageRef, { deleted: true, content: '', imageUrl: null });
    } catch (e) { console.error('[chat delete]', e); alert('삭제에 실패했습니다.'); }
  };

  // Enter 전송, Shift+Enter 줄바꿈, IME 보호
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); handleSend(); }
  };

  // 🚀 50명 초과
  if (!isAvailable) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <p className="text-[40px] mb-3">💭</p>
        <p className="text-[15px] font-[1000] text-slate-700 mb-1">채팅은 50명 이하 장갑에서만 사용할 수 있어요</p>
        <p className="text-[12px] font-bold text-slate-400">현재 멤버 <strong className="text-slate-600">{community.memberCount}명</strong></p>
      </div>
    );
  }

  // 🚀 비멤버 차단
  if (!isMember) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <p className="text-[40px] mb-3">🔒</p>
        <p className="text-[15px] font-[1000] text-slate-700 mb-1">장갑 멤버만 채팅에 참여할 수 있어요</p>
        <p className="text-[12px] font-bold text-slate-400">먼저 가입 신청을 해주세요</p>
      </div>
    );
  }

  // 🚀 채팅 UI
  return (
    <div className="flex flex-col h-[600px] bg-slate-50 rounded-xl overflow-hidden border border-slate-100 mt-4">
      {/* 메시지 영역 (드래그&드롭 수신) */}
      <div
        ref={messagesContainerRef}
        className={`flex-1 overflow-y-auto px-4 py-3 space-y-2.5 transition-colors ${isDragging ? 'bg-emerald-50/50' : ''}`}
        style={community.chatBgUrl ? {
          backgroundImage: `linear-gradient(rgba(255,255,255,0.6), rgba(255,255,255,0.6)), url(${community.chatBgUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'local',
        } : undefined}
        onScroll={trackScroll}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* 🚀 Step 6: 과거 메시지 더보기 */}
        {hasMore && !loading && messages.length >= 50 && (
          <div className="text-center py-2">
            {loadingMore
              ? <span className="text-[11px] font-bold text-slate-300">불러오는 중...</span>
              : <button onClick={loadMoreMessages} className="text-[11px] font-bold text-blue-400 hover:text-blue-600">↑ 이전 메시지 더보기</button>
            }
          </div>
        )}
        {isDragging && (
          <div className="text-center py-8 text-emerald-500 font-[1000] text-[13px]">📎 여기에 이미지를 놓으세요</div>
        )}
        {loading && (
          <div className="text-center text-slate-300 text-[12px] font-bold py-8">채팅을 불러오는 중...</div>
        )}
        {!loading && messages.length === 0 && !isDragging && (
          <div className="text-center text-slate-300 py-16">
            <p className="text-[40px] mb-2">💭</p>
            <p className="text-[13px] font-[1000]">아직 메시지가 없어요</p>
            <p className="text-[10px] font-bold mt-1">첫 메시지를 남겨보세요!</p>
          </div>
        )}
        {!loading && messages.map((msg) => (
          <ChatMessageItem
            key={msg.id}
            message={msg}
            currentUid={currentUser!.uid}
            isAdmin={!!isAdmin}
            community={community}
            members={members}
            onReply={(m) => setReplyTarget(m)}
            onToggleReaction={handleToggleReaction}
            reactionPickerFor={reactionPickerFor}
            setReactionPickerFor={setReactionPickerFor}
            onImageClick={setLightboxImage}
            onSendThanksball={(m) => setThanksballTarget(m)}
            onDelete={handleDeleteMessage}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* 🚀 답장 미리보기 */}
      {replyTarget && (
        <div className="px-4 py-2 bg-slate-100 border-t border-slate-200 flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-[1000] text-slate-500">↩ {replyTarget.author}님에게 답장</p>
            <p className="text-[11px] text-slate-500 truncate">{replyTarget.content || '[이미지]'}</p>
          </div>
          <button onClick={() => setReplyTarget(null)} className="text-slate-400 hover:text-slate-600 text-[14px] shrink-0 leading-none">✕</button>
        </div>
      )}

      {/* 🚀 이미지 미리보기 */}
      {pendingFile && (
        <div className="px-4 py-2 bg-slate-100 border-t border-slate-200 flex items-start gap-2">
          {pendingFile.isImage ? (
            <img src={pendingFile.previewUrl} alt="미리보기" className="w-14 h-14 object-cover rounded-lg border border-slate-300" />
          ) : (
            <span className="text-[32px] shrink-0">{getFileIcon(pendingFile.file.name)}</span>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-slate-500 truncate">{pendingFile.file.name}</p>
            <p className="text-[9px] text-slate-400">{(pendingFile.file.size / 1024).toFixed(0)} KB</p>
          </div>
          <button onClick={() => { if (pendingFile.previewUrl) URL.revokeObjectURL(pendingFile.previewUrl); setPendingFile(null); }}
            className="text-slate-400 hover:text-slate-600 text-[14px] shrink-0 leading-none">✕</button>
        </div>
      )}

      {/* 입력 영역 */}
      <div className="border-t border-slate-200 bg-white px-3 py-2.5 shrink-0">
        {/* 숨겨진 파일 input */}
        <input ref={fileInputRef} type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = ''; }} />
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={replyTarget ? `${replyTarget.author}님에게 답장...` : '메시지를 입력하세요... (Enter 전송)'}
            maxLength={500}
            rows={2}
            className="flex-1 resize-none px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-400 text-[13px] font-medium text-slate-900 placeholder:text-slate-300"
            disabled={sending}
          />
          {/* 파일 첨부 버튼 (이미지+문서) */}
          <button onClick={() => fileInputRef.current?.click()} disabled={sending}
            className="px-2 py-2 rounded-lg text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 transition-colors shrink-0 border border-slate-200" title="파일 첨부 (이미지·PDF·DOC·XLSX·PPTX)">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
          </button>
          <button
            onClick={handleSend}
            disabled={(!input.trim() && !pendingFile) || sending}
            className={`px-4 py-2 rounded-lg text-[12px] font-[1000] transition-all shrink-0 ${
              (!input.trim() && !pendingFile) || sending
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : 'bg-emerald-500 text-white hover:bg-emerald-600'
            }`}
          >
            {uploading ? '업로드 중' : sending ? '전송 중' : '전송'}
          </button>
        </div>
        <p className="text-[9px] font-bold text-slate-300 mt-1 text-right">{input.length}/500</p>
      </div>

      {/* 🚀 라이트박스 (원본 이미지 보기) */}
      {/* 🚀 라이트박스 */}
      {lightboxImage && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setLightboxImage(null)}
          onKeyDown={(e) => { if (e.key === 'Escape') setLightboxImage(null); }}
          tabIndex={0}
        >
          <img src={lightboxImage} alt="원본" className="max-w-full max-h-full object-contain" />
          <button className="absolute top-4 right-4 text-white text-[24px] hover:text-slate-300" onClick={() => setLightboxImage(null)}>✕</button>
        </div>
      )}

      {/* 🚀 Step 5: 땡스볼 모달 — 기존 ThanksballModal 재사용 */}
      {thanksballTarget && currentUser && (
        <ThanksballModal
          postId={thanksballTarget.id}
          postAuthor={thanksballTarget.author}
          postTitle={thanksballTarget.content?.slice(0, 30) || '[채팅 메시지]'}
          currentNickname={currentUser.nickname}
          allUsers={allUsers}
          recipientNickname={thanksballTarget.author}
          targetDocId={thanksballTarget.id}
          targetCollection="__chat__"
          chatCommunityId={community.id}
          chatMessageId={thanksballTarget.id}
          onClose={() => setThanksballTarget(null)}
        />
      )}
    </div>
  );
};

export default CommunityChatPanel;
