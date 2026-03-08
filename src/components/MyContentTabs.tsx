// src/components/MyContentTabs.tsx
import type { Post } from '../types';

interface Props {
  posts: Post[];
  onPostClick: (post: Post) => void;
  type: 'posts' | 'comments';
}

const MyContentTabs = ({ posts = [], onPostClick, type }: Props) => {
  const itemsPerPage = 50; // 충분히 많은 양을 보여주도록 설정
  const displayList = posts.slice(0, itemsPerPage);

  const formatDateTime = (timestamp: any) => {
    if (!timestamp) return "";
    const date = new Date(timestamp.seconds * 1000);
    return date.toLocaleString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute:'2-digit' });
  };

  return (
    <div className="w-full flex flex-col">
      {displayList.length > 0 ? (
        displayList.map((post: any) => (
          <div 
            key={post.id} 
            onClick={() => onPostClick(post)} 
            className="flex items-center px-6 py-4 border-b border-slate-50 transition-colors cursor-pointer hover:bg-slate-50 group"
          >
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-[1000] text-slate-800 truncate group-hover:text-blue-600 transition-colors tracking-tight">
                {type === 'comments' ? (post.content || "").replace(/<[^>]*>?/gm, '') : (post.title || "제목 없음")}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] text-slate-400 font-bold">{formatDateTime(post.createdAt)}</span>
                {post.category && (
                  <span className="text-[9px] font-black text-blue-400/60 uppercase tracking-widest bg-blue-50/50 px-1.5 py-0.5 rounded">
                    {post.category}
                  </span>
                )}
              </div>
            </div>
            <div className={`text-[10px] font-black px-2 py-1 rounded shadow-sm shrink-0 ${type === 'comments' ? 'text-emerald-600 bg-emerald-50' : 'text-blue-600 bg-blue-50'}`}>
              {type === 'comments' ? '댓글' : '게시글'}
            </div>
          </div>
        ))
      ) : (
        <div className="py-32 flex flex-col items-center justify-center text-slate-300">
          <svg className="w-12 h-12 mb-4 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="font-black italic">기록된 할말이 없소.</p>
        </div>
      )}
    </div>
  );
};

export default MyContentTabs;
