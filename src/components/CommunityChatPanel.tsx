// src/components/CommunityChatPanel.tsx — 🚀 Phase 7 Step 3: 채팅 + 답장 + 이모지 반응
import { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, doc, setDoc, updateDoc, arrayUnion, arrayRemove, query, orderBy, limit, onSnapshot, serverTimestamp } from 'firebase/firestore';
import type { Community, UserData, CommunityMember, ChatMessage } from '../types';
import { CHAT_MEMBER_LIMIT } from '../types';
import { calculateLevel } from '../utils';
import VerifiedBadgeComponent from './VerifiedBadge';

interface Props {
  community: Community;
  currentUser: UserData | null;
  members: CommunityMember[];
}

const REACTION_EMOJIS = ['👍', '❤️', '😂', '🔥', '🤔', '💯'] as const;

// 🚀 메시지 한 개 렌더링
function ChatMessageItem({ message, currentUid, onReply, onToggleReaction, reactionPickerFor, setReactionPickerFor }: {
  message: ChatMessage;
  currentUid: string;
  onReply: (msg: ChatMessage) => void;
  onToggleReaction: (msg: ChatMessage, emoji: string) => void;
  reactionPickerFor: string | null;
  setReactionPickerFor: (id: string | null) => void;
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

  // 이모지 반응 데이터 (빈 배열 필터링)
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

        {/* 메시지 본문 + 시간 + 액션 버튼 */}
        <div className={`flex items-end gap-1 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
          <div className={`px-3 py-2 rounded-2xl text-[13px] font-medium whitespace-pre-wrap break-words leading-relaxed ${
            isMine
              ? 'bg-emerald-500 text-white rounded-br-sm'
              : 'bg-white text-slate-800 rounded-bl-sm border border-slate-200'
          }`}>
            {message.deleted ? (
              <span className="italic text-slate-400">삭제된 메시지입니다</span>
            ) : message.content}
          </div>
          <div className="flex flex-col items-center gap-0.5 shrink-0">
            <span className="text-[9px] text-slate-300">{timeStr}</span>
            {/* 액션 버튼 — hover 시 노출 */}
            {!message.deleted && (
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                {!isMine && (
                  <button onClick={() => onReply(message)} className="text-[10px] text-slate-300 hover:text-emerald-500" title="답장">↩</button>
                )}
                <div className="relative">
                  <button onClick={() => setReactionPickerFor(reactionPickerFor === message.id ? null : message.id)}
                    className="text-[10px] text-slate-300 hover:text-amber-500" title="반응">+</button>
                  {/* 🚀 이모지 picker 팝업 */}
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
        {activeReactions.length > 0 && (
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
          </div>
        )}
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 🚀 onSnapshot 실시간 구독 — 최근 50개, cleanup 필수
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

  // 🚀 메시지 전송 (답장 포함)
  const handleSend = async () => {
    if (!currentUser || !myMembership || !input.trim() || sending) return;
    const trimmed = input.trim();
    if (trimmed.length > 500) { alert('메시지는 500자 이내로 입력해주세요.'); return; }

    setSending(true);
    try {
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
      if (myMembership.finger) messageData.authorFinger = myMembership.finger;
      if (myMembership.verified) messageData.authorVerified = myMembership.verified;
      // 🚀 답장 정보
      if (replyTarget) {
        messageData.replyTo = {
          messageId: replyTarget.id,
          author: replyTarget.author,
          snippet: replyTarget.content.length > 50 ? replyTarget.content.slice(0, 50) + '...' : replyTarget.content,
        };
      }

      await setDoc(messageRef, messageData);
      setInput('');
      setReplyTarget(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '메시지 전송 실패';
      alert(msg);
      console.error('[chat send]', e);
    } finally { setSending(false); }
  };

  // 🚀 이모지 반응 토글 (arrayUnion/arrayRemove 원자적)
  const handleToggleReaction = async (message: ChatMessage, emoji: string) => {
    if (!currentUser) return;
    const messageRef = doc(collection(doc(db, 'community_chats', community.id), 'messages'), message.id);
    const currentReactors = message.reactions?.[emoji] ?? [];
    const alreadyReacted = currentReactors.includes(currentUser.uid);
    const fieldKey = `reactions.${emoji}`;
    try {
      await updateDoc(messageRef, {
        [fieldKey]: alreadyReacted ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid),
      });
    } catch (e) { console.error('[reaction toggle]', e); }
  };

  // Enter 전송, Shift+Enter 줄바꿈, IME 보호
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  // 🚀 50명 초과 — 비활성 안내
  if (!isAvailable) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <p className="text-[40px] mb-3">💭</p>
        <p className="text-[15px] font-[1000] text-slate-700 mb-1">채팅은 50명 이하 장갑에서만 사용할 수 있어요</p>
        <p className="text-[12px] font-bold text-slate-400">
          현재 멤버 <strong className="text-slate-600">{community.memberCount}명</strong> · 소규모 장갑의 깊이 있는 소통을 위해 인원 제한을 두고 있습니다.
        </p>
        <p className="text-[10px] font-bold text-slate-300 mt-4">💡 큰 장갑은 글(소곤소곤)을 활용해주세요</p>
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
      {/* 메시지 영역 */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
        {loading && (
          <div className="text-center text-slate-300 text-[12px] font-bold py-8">채팅을 불러오는 중...</div>
        )}
        {!loading && messages.length === 0 && (
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
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* 🚀 답장 미리보기 */}
      {replyTarget && (
        <div className="px-4 py-2 bg-slate-100 border-t border-slate-200 flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-[1000] text-slate-500">↩ {replyTarget.author}님에게 답장</p>
            <p className="text-[11px] text-slate-500 truncate">{replyTarget.content}</p>
          </div>
          <button onClick={() => setReplyTarget(null)} className="text-slate-400 hover:text-slate-600 text-[14px] shrink-0 leading-none" title="답장 취소">✕</button>
        </div>
      )}

      {/* 입력 영역 */}
      <div className="border-t border-slate-200 bg-white px-3 py-2.5 shrink-0">
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={replyTarget ? `${replyTarget.author}님에게 답장...` : '메시지를 입력하세요... (Enter 전송)'}
            maxLength={500}
            rows={2}
            className="flex-1 resize-none px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-400 text-[13px] font-medium text-slate-900 placeholder:text-slate-300"
            disabled={sending}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className={`px-4 py-2 rounded-lg text-[12px] font-[1000] transition-all shrink-0 ${
              !input.trim() || sending
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : 'bg-emerald-500 text-white hover:bg-emerald-600'
            }`}
          >
            {sending ? '전송 중' : '전송'}
          </button>
        </div>
        <p className="text-[9px] font-bold text-slate-300 mt-1 text-right">{input.length}/500</p>
      </div>
    </div>
  );
};

export default CommunityChatPanel;
