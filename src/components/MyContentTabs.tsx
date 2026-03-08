// src/components/MyContentTabs.tsx
import type { Post } from '../types';

interface Props {
  posts: Post[];
  onPostClick: (post: Post) => void;
  type: 'posts' | 'comments';
}

const MyContentTabs = ({ posts = [], onPostClick, type }: Props) => {
  const itemsPerPage = 10;
  // 페이징 기능이 현재 UI에 노출되지 않으므로 상단 10개만 우선 노출
  const paginatedList = posts.slice(0, itemsPerPage);

  const formatDateTime = (timestamp: any) => {
    if (!timestamp) return "";
    const date = new Date(timestamp.seconds * 1000);
    return date.toLocaleString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute:'2-digit' });
  };

  return (
    <div className="w-full flex flex-col gap-1">
      {paginatedList.length > 0 ? paginatedList.map((post: any) => (
        <div 
          key={post.id} 
          onClick={() => onPostClick(post)} 
          className="flex items-center px-6 py-4 border-b border-slate-50 transition-colors cursor-pointer hover:bg-slate-50 group"
        >
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-bold text-slate-800 truncate group-hover:text-blue-600 transition-colors">
              {type === 'comments' ? post.content.replace(/<[^>]*>?/gm, '') : post.title}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(post.createdAt)}</span>
              {post.category && (
                <span className="text-[9px] font-black text-blue-400/60 uppercase tracking-widest">{post.category}</span>
              )}
            </div>
          </div>
          <div className="text-[11px] font-black text-blue-500 bg-blue-50 px-2 py-1 rounded">
            {type === 'comments' ? '댓글' : '게시글'}
          </div>
        </div>
      )) : (
        <p className="py-20 text-center text-slate-400 font-bold italic">기록이 없소.</p>
      )}
    </div>
  );
};

export default MyContentTabs;
