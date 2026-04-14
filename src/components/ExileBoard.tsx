// src/components/ExileBoard.tsx — 🏚️ 유배지 게시판
// 유배자가 글을 쓰고, 모든 유저가 관전. 닉네임은 "곳간 거주자 #NNNN"으로 익명화
// 외부 공유 URL 생성 금지 (기획서 §3 Sandbox Policy)
import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, query, where, orderBy, limit, onSnapshot, serverTimestamp } from 'firebase/firestore';
import type { UserData } from '../types';
import { sanitizeHtml } from '../sanitize';

interface ExilePost {
  id: string;
  uid: string;
  anonNickname: string;    // 곳간 거주자 #NNNN
  level: 1 | 2 | 3;
  content: string;
  createdAt?: { toDate?: () => Date; seconds: number };
  likes: number;
  thanksballsReceived: number;
}

interface Props {
  currentUserData: UserData | null;
  level: 1 | 2 | 3;          // 이 보드가 속한 탭 (1/2/3차)
  isExiledHere: boolean;     // 현재 유저가 이 탭에 해당하는 유배자인지 (쓰기 권한)
  composeOpen?: boolean;     // 글 작성 모달 열림 상태 (상위에서 제어)
  onCloseCompose?: () => void;
}

// 닉네임 익명화 — UID의 숫자 부분만 추출해서 4자리
function anonymize(uid: string): string {
  const hash = uid.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return `곳간 거주자 #${String(hash % 10000).padStart(4, '0')}`;
}

// 상대 시간
function formatRelativeTime(ts?: { toDate?: () => Date; seconds: number }): string {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return '방금 전';
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

const ExileBoard = ({ currentUserData, level, isExiledHere, composeOpen, onCloseCompose }: Props) => {
  const [posts, setPosts] = useState<ExilePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 해당 level의 게시글 실시간 구독
  useEffect(() => {
    const q = query(
      collection(db, 'exile_posts'),
      where('level', '==', level),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    const unsub = onSnapshot(q, (snap) => {
      setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() } as ExilePost)));
      setLoading(false);
    }, (err) => {
      console.error('[ExileBoard]', err);
      setLoading(false);
    });
    return unsub;
  }, [level]);

  const handleSubmit = async () => {
    if (!currentUserData || !isExiledHere) return;
    const trimmed = content.trim();
    if (!trimmed) { setError('내용을 입력해주세요.'); return; }
    if (trimmed.length > 500) { setError('500자 이하로 작성해주세요.'); return; }

    setSubmitting(true);
    setError(null);
    try {
      await addDoc(collection(db, 'exile_posts'), {
        uid: currentUserData.uid,
        anonNickname: anonymize(currentUserData.uid),
        level,
        content: trimmed,
        likes: 0,
        thanksballsReceived: 0,
        createdAt: serverTimestamp(),
      });
      setContent('');
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || '글 작성에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const levelLabel = level === 1 ? '놀부의 곳간' : level === 2 ? '무인도 귀양지' : '절해고도';

  // 작성 모달 제출 시 성공하면 상위 onCloseCompose 호출
  const handleModalSubmit = async () => {
    await handleSubmit();
    if (!error && content.trim() === '') onCloseCompose?.();
  };

  return (
    <div className="space-y-3">
      {/* 글 작성 모달 — 상위에서 composeOpen 제어 */}
      {composeOpen && isExiledHere && currentUserData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onCloseCompose}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="text-[14px] font-[1000] text-slate-800">반성의 글 남기기</h2>
              <button onClick={onCloseCompose} className="text-slate-300 hover:text-slate-500 text-[20px] leading-none">×</button>
            </div>
            <div className="px-5 py-4">
              <p className="text-[10px] font-bold text-slate-400 mb-2">
                {levelLabel}에서 익명(곳간 거주자 #NNNN)으로 게시됩니다. 외부 공유 불가.
              </p>
              <textarea
                value={content}
                onChange={(e) => { setContent(e.target.value); if (error) setError(null); }}
                maxLength={500}
                rows={6}
                autoFocus
                placeholder="반성의 글을 남겨보세요..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[12px] focus:outline-none focus:border-slate-400 resize-none placeholder:text-[11px]"
              />
              {error && <p className="text-[11px] font-bold text-red-500 mt-1">{error}</p>}
              <div className="flex items-center justify-between mt-3">
                <span className="text-[10px] font-bold text-slate-300">{content.length}/500</span>
                <div className="flex gap-1.5">
                  <button onClick={onCloseCompose}
                    className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[11px] font-[1000] transition-colors">취소</button>
                  <button onClick={handleModalSubmit} disabled={submitting || !content.trim()}
                    className="px-4 py-1.5 bg-slate-900 hover:bg-slate-700 disabled:opacity-50 text-white rounded-lg text-[11px] font-[1000] transition-colors">
                    {submitting ? '작성 중...' : '글 남기기'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 게시글 목록 */}
      {loading ? (
        <div className="py-10 text-center text-slate-300 text-[12px] font-bold">불러오는 중...</div>
      ) : posts.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-[13px] font-[1000] text-slate-400">아직 {levelLabel}에 남겨진 글이 없습니다</p>
          <p className="text-[10px] font-bold text-slate-300 mt-1">
            {isExiledHere ? '첫 반성의 글을 남겨보세요' : '유배자들이 반성하는 공간입니다'}
          </p>
        </div>
      ) : (
        posts.map(post => (
          <div key={post.id} className="bg-white border border-slate-100 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[11px] font-[1000] text-slate-500">{post.anonNickname}</span>
              <span className="text-[9px] font-bold text-slate-300">{formatRelativeTime(post.createdAt)}</span>
              <span className="text-[9px] font-[1000] text-rose-400 bg-rose-50 px-1.5 py-0.5 rounded-full ml-auto">
                {post.level}차
              </span>
            </div>
            <div
              className="text-[13px] font-medium text-slate-700 leading-relaxed whitespace-pre-wrap [&_p]:mb-1"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.content) }}
            />
            {/* 통계 (향후 확장용) */}
            <div className="flex items-center gap-3 mt-2 pt-2 border-t border-slate-50 text-[10px] font-bold text-slate-300">
              <span>🤍 {post.likes}</span>
              <span>⚾ {post.thanksballsReceived}</span>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

// 외부에서 익명화 함수 재사용 가능하도록 export
export { anonymize as anonymizeExileNickname };
export type { ExilePost };
export default ExileBoard;
