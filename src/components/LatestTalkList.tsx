// src/components/LatestTalkList.tsx
import type { Post } from '../types';

interface Props {
  rootPosts: Post[]; // 여러 개의 주제들
  onTopicClick: (post: Post) => void;
}

const LatestTalkList = ({ rootPosts, onTopicClick }: Props) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4">
      {rootPosts.map((post) => (
        <div 
          key={post.id}
          onClick={() => onTopicClick(post)}
          className="bg-white border-2 border-slate-200 rounded-[2rem] p-6 cursor-pointer hover:border-slate-900 hover:shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] transition-all group"
        >
          <div className="flex justify-between items-start mb-4">
            <span className="bg-emerald-100 text-emerald-700 text-[10px] font-black px-2 py-1 rounded-md uppercase">Topic</span>
            <span className="text-[10px] font-bold text-slate-300">
              {new Date(post.createdAt?.seconds * 1000).toLocaleDateString()}
            </span>
          </div>
          <h3 className="text-xl font-black text-slate-900 mb-3 group-hover:text-emerald-600 line-clamp-2">
            {post.title}
          </h3>
          <p className="text-sm text-slate-500 line-clamp-3 leading-relaxed mb-6">
            {post.content}
          </p>
          <div className="flex items-center gap-3 pt-4 border-t border-slate-50">
            <div className="w-8 h-8 rounded-full bg-slate-100 overflow-hidden border border-slate-200">
              <img src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${post.author}`} alt="avatar" />
            </div>
            <span className="text-xs font-bold text-slate-700">{post.author}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default LatestTalkList;