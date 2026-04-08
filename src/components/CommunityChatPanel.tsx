// src/components/CommunityChatPanel.tsx — 🚀 Phase 7 Step 4: 채팅 + 답장 + 이모지 + 이미지
import { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, doc, setDoc, updateDoc, arrayUnion, arrayRemove, query, orderBy, limit, onSnapshot, serverTimestamp } from 'firebase/firestore';
import type { Community, UserData, CommunityMember, ChatMessage } from '../types';
import { CHAT_MEMBER_LIMIT } from '../types';
import { calculateLevel } from '../utils';
import { uploadToR2 } from '../uploadToR2';
import VerifiedBadgeComponent from './VerifiedBadge';

interface Props {
  community: Community;
  currentUser: UserData | null;
  members: CommunityMember[];
}

const REACTION_EMOJIS = ['👍', '❤️', '😂', '🔥', '🤔', '💯'] as const;

// 🚀 메시지 한 개 렌더링
function ChatMessageItem({ message, currentUid, onReply, onToggleReaction, reactionPickerFor, setReactionPickerFor, onImageClick, onSendThanksball }: {
  message: ChatMessage;
  currentUid: string;
  onReply: (msg: ChatMessage) => void;
  onToggleReaction: (msg: ChatMessage, emoji: string) => void;
  reactionPickerFor: string | null;
  setReactionPickerFor: (id: string | null) => void;
  onImageClick: (url: string) => void;
  onSendThanksball: (msg: ChatMessage) => void;
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
          <div className="flex items-center gap-1.5 mb-0.5 px-1">
            <span className="text-[11px] font-[1000] text-slate-700">{message.author}</span>
            <span className="text-[9px] font-bold text-slate-300">Lv{message.authorLevel}</span>
            {message.authorVerified && (
              <VerifiedBadgeComponent verified={message.authorVerified} size="sm" showDate={false} />
            )}
          </div>
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
              <div className="flex items-center gap-0.5">
                {!isMine && (
                  <button onClick={() => onReply(message)} className="text-[14px] text-slate-300 hover:text-emerald-500 px-0.5" title="답장">↩</button>
                )}
                {!isMine && (
                  <button onClick={() => onSendThanksball(message)} className="text-[13px] text-slate-300 hover:text-amber-500 px-0.5" title="땡스볼">🎁</button>
                )}
                <div className="relative">
                  <button onClick={() => setReactionPickerFor(reactionPickerFor === message.id ? null : message.id)}
                    className="text-[18px] font-[1000] text-slate-300 hover:text-amber-500 px-0.5 leading-none" title="반응">+</button>
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
                <span>🎁</span>
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

// 🚀 Step 5: 채팅 땡스볼 모달 — Cloud Function(sendThanksball) 경유
function ChatThanksballModal({ message, sender, communityId, onClose }: {
  message: ChatMessage; sender: UserData; communityId: string; onClose: () => void;
}) {
  const [amount, setAmount] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const balance = sender.ballBalance ?? 0;
  const insufficient = balance < amount;

  const handleConfirm = async () => {
    if (insufficient || submitting) return;
    setSubmitting(true);
    try {
      // 🚀 기존 sendThanksball Cloud Function 호출 — chatCommunityId/chatMessageId 파라미터 추가
      const { httpsCallable } = await import('firebase/functions');
      const { functions } = await import('../firebase');
      const sendFn = httpsCallable(functions, 'sendThanksball');
      await sendFn({
        recipientUid: message.author_id,
        amount,
        message: '',
        postId: null,
        postTitle: message.content?.slice(0, 30) || '[채팅 메시지]',
        postAuthor: message.author,
        chatCommunityId: communityId,
        chatMessageId: message.id,
      });
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '땡스볼 전송 실패';
      alert(msg);
      console.error('[chat thanksball]', e);
    } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-[15px] font-[1000] text-slate-900">🎁 땡스볼 보내기</h3>
          <p className="text-[11px] font-bold text-slate-400 mt-0.5"><strong>{message.author}</strong>님의 메시지에 보냅니다</p>
        </div>
        <div className="px-5 py-4 flex flex-col gap-3">
          {/* 메시지 미리보기 */}
          <div className="p-2 bg-slate-50 rounded-lg text-[11px] text-slate-600 border-l-2 border-slate-300 truncate">
            {message.content?.slice(0, 60) || (message.imageUrl ? '[이미지]' : '')}
          </div>
          {/* 수량 선택 */}
          <div>
            <p className="text-[10px] font-[1000] text-slate-400 uppercase tracking-widest mb-1.5">수량</p>
            <div className="flex gap-1.5">
              {[1, 5, 10, 20, 50].map(n => (
                <button key={n} onClick={() => setAmount(n)}
                  className={`flex-1 py-2 rounded-lg text-[12px] font-[1000] border transition-all ${
                    amount === n ? 'bg-amber-100 border-amber-400 text-amber-700' : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-500'
                  }`}
                >{n}볼</button>
              ))}
            </div>
          </div>
          {/* 잔액 */}
          <div className="flex justify-between text-[11px] font-bold">
            <span className="text-slate-400">현재 잔액</span>
            <span className={insufficient ? 'text-rose-500' : 'text-slate-600'}>
              {balance}볼{insufficient && ' (부족)'}
            </span>
          </div>
        </div>
        <div className="px-5 py-3 flex gap-2 border-t border-slate-100">
          <button onClick={onClose} disabled={submitting}
            className="flex-1 py-2.5 rounded-xl text-[13px] font-bold text-slate-500 border border-slate-200 hover:bg-slate-50">취소</button>
          <button onClick={handleConfirm} disabled={insufficient || submitting}
            className={`flex-1 py-2.5 rounded-xl text-[13px] font-[1000] transition-all ${
              insufficient || submitting ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-amber-500 text-white hover:bg-amber-600'
            }`}
          >{submitting ? '전송 중...' : `${amount}볼 보내기`}</button>
        </div>
      </div>
    </div>
  );
}

const CommunityChatPanel = ({ community, currentUser, members }: Props) => {
  const isAvailable = (community.memberCount ?? 0) <= CHAT_MEMBER_LIMIT;
  const myMembership = currentUser ? members.find(m => m.userId === currentUser.uid) : null;
  const isMember = myMembership && (myMembership.joinStatus ?? 'active') === 'active';

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [replyTarget, setReplyTarget] = useState<ChatMessage | null>(null);
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);
  // 🚀 Step 5: 땡스볼 상태
  const [thanksballTarget, setThanksballTarget] = useState<ChatMessage | null>(null);
  // 🚀 Step 4: 이미지 업로드 상태
  const [pendingImage, setPendingImage] = useState<{ file: File; previewUrl: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 🚀 onSnapshot 실시간 구독
  useEffect(() => {
    if (!isAvailable || !isMember) { setLoading(false); return; }
    const messagesRef = collection(doc(db, 'community_chats', community.id), 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'desc'), limit(50));
    const unsubscribe = onSnapshot(q, (snap) => {
      const msgs: ChatMessage[] = snap.docs.map(d => d.data() as ChatMessage);
      msgs.reverse();
      setMessages(msgs);
      setLoading(false);
    }, (err) => { console.error('[community_chats onSnapshot]', err); setLoading(false); });
    return () => unsubscribe();
  }, [community.id, isAvailable, isMember]);

  // 🚀 새 메시지 시 자동 스크롤
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // 🚀 이미지 파일 선택 공통 핸들러
  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) { alert('이미지 파일만 업로드할 수 있습니다.'); return; }
    if (file.size > 5 * 1024 * 1024) { alert('이미지는 5MB 이하만 업로드 가능합니다.'); return; }
    if (pendingImage) URL.revokeObjectURL(pendingImage.previewUrl);
    setPendingImage({ file, previewUrl: URL.createObjectURL(file) });
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
    if (!trimmed && !pendingImage) return;
    if (trimmed.length > 500) { alert('메시지는 500자 이내로 입력해주세요.'); return; }

    setSending(true);
    if (pendingImage) setUploading(true);

    try {
      // 이미지 업로드 (먼저)
      let imageUrl: string | undefined;
      if (pendingImage) {
        const ext = pendingImage.file.name.split('.').pop() || 'jpg';
        const filePath = `chats/${community.id}/${Date.now()}_${currentUser.uid.slice(0, 8)}.${ext}`;
        imageUrl = await uploadToR2(pendingImage.file, filePath);
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
      if (imageUrl) messageData.imageUrl = imageUrl;
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
      if (pendingImage) { URL.revokeObjectURL(pendingImage.previewUrl); setPendingImage(null); }
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
        className={`flex-1 overflow-y-auto px-4 py-3 space-y-2.5 transition-colors ${isDragging ? 'bg-emerald-50/50' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
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
            onReply={(m) => setReplyTarget(m)}
            onToggleReaction={handleToggleReaction}
            reactionPickerFor={reactionPickerFor}
            setReactionPickerFor={setReactionPickerFor}
            onImageClick={setLightboxImage}
            onSendThanksball={(m) => setThanksballTarget(m)}
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
      {pendingImage && (
        <div className="px-4 py-2 bg-slate-100 border-t border-slate-200 flex items-start gap-2">
          <img src={pendingImage.previewUrl} alt="미리보기" className="w-14 h-14 object-cover rounded-lg border border-slate-300" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-slate-500 truncate">{pendingImage.file.name}</p>
            <p className="text-[9px] text-slate-400">{(pendingImage.file.size / 1024).toFixed(0)} KB</p>
          </div>
          <button onClick={() => { URL.revokeObjectURL(pendingImage.previewUrl); setPendingImage(null); }}
            className="text-slate-400 hover:text-slate-600 text-[14px] shrink-0 leading-none">✕</button>
        </div>
      )}

      {/* 입력 영역 */}
      <div className="border-t border-slate-200 bg-white px-3 py-2.5 shrink-0">
        {/* 숨겨진 파일 input */}
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = ''; }} />
        <div className="flex gap-2 items-end">
          <button onClick={() => fileInputRef.current?.click()} disabled={sending}
            className="text-[18px] text-slate-400 hover:text-emerald-500 transition-colors px-1 shrink-0" title="이미지 첨부">📎</button>
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
          <button
            onClick={handleSend}
            disabled={(!input.trim() && !pendingImage) || sending}
            className={`px-4 py-2 rounded-lg text-[12px] font-[1000] transition-all shrink-0 ${
              (!input.trim() && !pendingImage) || sending
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

      {/* 🚀 Step 5: 땡스볼 모달 (Cloud Function 경유) */}
      {thanksballTarget && currentUser && (
        <ChatThanksballModal
          message={thanksballTarget}
          sender={currentUser}
          communityId={community.id}
          onClose={() => setThanksballTarget(null)}
        />
      )}
    </div>
  );
};

export default CommunityChatPanel;
