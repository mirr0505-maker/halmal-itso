// src/components/KanbuRoomView.tsx — 깐부방 상세: 게시판 + 실시간 채팅
import { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, limit, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import type { KanbuRoom, KanbuChat, Post } from '../types';

interface Props {
  room: KanbuRoom;
  roomPosts: Post[];
  onBack: () => void;
  currentUserData: any;
  allUsers: Record<string, any>;
}

const KanbuRoomView = ({ room, roomPosts, onBack, currentUserData }: Props) => {
  const [chats, setChats] = useState<KanbuChat[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [postContent, setPostContent] = useState('');
  const [isPostSubmitting, setIsPostSubmitting] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // 채팅 실시간 구독 (방 입장 시에만)
  useEffect(() => {
    const q = query(
      collection(db, 'kanbu_rooms', room.id, 'chats'),
      orderBy('createdAt', 'asc'),
      limit(50)
    );
    const unsub = onSnapshot(q, snapshot => {
      setChats(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as KanbuChat)));
    });
    return () => unsub();
  }, [room.id]);

  // 새 메시지 오면 스크롤 하단 이동
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chats]);

  const sendChat = async () => {
    if (!chatInput.trim() || isSending || !currentUserData) return;
    setIsSending(true);
    const msgId = `chat_${Date.now()}_${currentUserData.uid}`;
    await setDoc(doc(db, 'kanbu_rooms', room.id, 'chats', msgId), {
      author: currentUserData.nickname,
      authorId: currentUserData.uid,
      content: chatInput.trim(),
      createdAt: serverTimestamp(),
    });
    setChatInput('');
    setIsSending(false);
  };

  const submitPost = async () => {
    if (!postContent.trim() || isPostSubmitting || !currentUserData) return;
    setIsPostSubmitting(true);
    const postId = `room_post_${Date.now()}_${currentUserData.uid}`;
    await setDoc(doc(db, 'posts', postId), {
      author: currentUserData.nickname,
      author_id: currentUserData.uid,
      title: null,
      content: postContent.trim(),
      category: null,
      kanbuRoomId: room.id,
      parentId: null,
      rootId: null,
      side: 'left',
      type: 'comment',
      authorInfo: { level: currentUserData.level, friendCount: 0, totalLikes: currentUserData.likes },
      createdAt: serverTimestamp(),
      likes: 0,
      dislikes: 0,
    });
    setPostContent('');
    setIsPostSubmitting(false);
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp?.seconds) return '';
    const d = new Date(timestamp.seconds * 1000);
    return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp?.seconds) return '';
    const d = new Date(timestamp.seconds * 1000);
    const diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return '방금 전';
    if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
    return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="w-full h-full flex flex-col animate-in fade-in duration-300">
      {/* 헤더 */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-100 shrink-0">
        <button onClick={onBack} className="text-slate-400 hover:text-slate-700 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="w-8 h-8 rounded-lg bg-slate-100 overflow-hidden border border-slate-200 shrink-0">
          <img src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${room.creatorNickname}`} alt="" className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[14px] font-[1000] text-slate-900 tracking-tight truncate">{room.title}</h3>
          <p className="text-[10px] font-bold text-slate-400">{room.creatorNickname} 개설 · Lv{room.creatorLevel}</p>
        </div>
      </div>

      {/* 본문: 게시판(좌) + 채팅(우) */}
      <div className="flex flex-1 overflow-hidden">

        {/* 게시판 영역 */}
        <div className="flex flex-col flex-[7] border-r border-slate-100 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-100 shrink-0">
            <span className="text-[11px] font-[1000] text-slate-500 uppercase tracking-widest">게시판</span>
          </div>

          {/* 글 목록 */}
          <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {roomPosts.length === 0 ? (
              <div className="py-16 text-center text-slate-300 font-bold text-[12px]">첫 글을 남겨보세요.</div>
            ) : (
              roomPosts.map(post => {
                return (
                  <div key={post.id} className="px-4 py-3 border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-6 h-6 rounded-full overflow-hidden bg-slate-100 shrink-0">
                        <img src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${post.author}`} alt="" className="w-full h-full object-cover" />
                      </div>
                      <span className="text-[11px] font-[1000] text-slate-700">{post.author}</span>
                      <span className="text-[9px] font-bold text-slate-300 ml-auto">{formatDate(post.createdAt)}</span>
                    </div>
                    <p className="text-[13px] font-medium text-slate-700 leading-relaxed pl-8 whitespace-pre-wrap">{post.content}</p>
                  </div>
                );
              })
            )}
          </div>

          {/* 글 작성 폼 */}
          <div className="border-t border-slate-100 px-4 py-3 shrink-0 bg-white">
            <div className="flex gap-2">
              <textarea
                value={postContent}
                onChange={e => setPostContent(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submitPost(); }}
                placeholder="이 방에 글을 남겨보세요... (Ctrl+Enter 전송)"
                rows={2}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[12px] font-bold text-slate-700 outline-none focus:border-slate-400 resize-none transition-colors"
              />
              <button
                onClick={submitPost}
                disabled={!postContent.trim() || isPostSubmitting}
                className="px-3 py-2 bg-slate-900 text-white rounded-xl text-[11px] font-[1000] hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
              >
                올리기
              </button>
            </div>
          </div>
        </div>

        {/* 채팅 영역 */}
        <div className="flex flex-col flex-[5] overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-100 shrink-0">
            <span className="text-[11px] font-[1000] text-slate-500 uppercase tracking-widest">실시간 채팅</span>
          </div>

          {/* 메시지 목록 */}
          <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {chats.length === 0 && (
              <div className="py-10 text-center text-slate-200 font-bold text-[11px]">첫 메시지를 보내보세요 💬</div>
            )}
            {chats.map(chat => {
              const isMe = chat.author === currentUserData?.nickname;
              return (
                <div key={chat.id} className={`flex items-end gap-1.5 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                  {!isMe && (
                    <div className="w-6 h-6 rounded-full overflow-hidden bg-slate-100 shrink-0 mb-1">
                      <img src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${chat.author}`} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
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

          {/* 채팅 입력 */}
          <div className="border-t border-slate-100 px-3 py-2.5 shrink-0 bg-white">
            <div className="flex gap-2 items-center">
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
                placeholder="메시지 입력..."
                className="flex-1 bg-slate-50 border border-slate-200 rounded-full px-4 py-2 text-[12px] font-bold text-slate-700 outline-none focus:border-slate-400 transition-colors"
              />
              <button
                onClick={sendChat}
                disabled={!chatInput.trim() || isSending}
                className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KanbuRoomView;
