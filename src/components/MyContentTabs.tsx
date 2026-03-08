// src/components/MyContentTabs.tsx
import { useState } from 'react';
import type { Post } from '../types';

interface Props {
  myFormalPosts: Post[];
  myComments: Post[];
  friends: string[];
  onPostClick: (post: Post) => void;
  onToggleFriend: (name: string) => void;
  blocks?: string[];
  toggleBlock?: (name: string) => void;
}

const MyContentTabs = ({ myFormalPosts = [], myComments = [], friends = [], onPostClick, onToggleFriend, blocks = [], toggleBlock }: Props) => {
  const [activeTab, setActiveTab] = useState<'posts' | 'comments' | 'friends' | 'blocks'>('posts');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const getListToDisplay = () => {
    switch(activeTab) {
      case 'posts': return myFormalPosts.filter(p => p.type !== 'formal');
      case 'comments': return myComments;
      case 'friends': return friends;
      case 'blocks': return blocks;
      default: return myFormalPosts;
    }
  };

  const currentList = getListToDisplay();
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const paginatedList = currentList.slice(indexOfFirstItem, indexOfLastItem);

  const formatDateTime = (timestamp: any) => {
    if (!timestamp) return "";
    const date = new Date(timestamp.seconds * 1000);
    return date.toLocaleString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute:'2-digit' });
  };

  return (
    <div className="w-full bg-white mt-10">
      <div className="flex border-b border-slate-200 gap-8 px-4 overflow-x-auto no-scrollbar">
        {['posts', 'comments', 'friends', 'blocks'].map((tab) => (
          <button 
            key={tab}
            onClick={() => { setActiveTab(tab as any); setCurrentPage(1); }} 
            className={`py-4 text-[14px] font-[1000] whitespace-nowrap relative transition-colors ${activeTab === tab ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            {tab === 'posts' && '게시글'}
            {tab === 'comments' && '댓글'}
            {tab === 'friends' && `깐부 (${friends.length})`}
            {tab === 'blocks' && `차단 (${blocks.length})`}
            {activeTab === tab && <span className="absolute bottom-0 left-0 w-full h-[3px] bg-blue-600 rounded-t-sm" />}
          </button>
        ))}
      </div>

      <div className="min-h-[300px]">
        {activeTab === 'friends' || activeTab === 'blocks' ? (
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            {paginatedList.length > 0 ? (paginatedList as string[]).map(name => (
              <div key={name} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-white border border-slate-200">
                    <img src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${name}`} alt="" />
                  </div>
                  <span className="font-black text-slate-700 text-sm">{name}</span>
                </div>
                <button 
                  onClick={() => activeTab === 'friends' ? onToggleFriend(name) : toggleBlock?.(name)}
                  className="text-[11px] font-black text-rose-500 hover:bg-rose-50 px-3 py-1.5 rounded-lg transition-colors border border-rose-100"
                >
                  {activeTab === 'friends' ? '깐부해제' : '차단해제'}
                </button>
              </div>
            )) : <p className="col-span-full py-20 text-center text-slate-400 font-bold italic">목록이 비어있소.</p>}
          </div>
        ) : (
          <div className="flex flex-col">
            {paginatedList.length > 0 ? paginatedList.map((post: any) => (
              <div key={post.id} onClick={() => activeTab !== 'comments' && onPostClick(post)} className={`flex items-center px-6 py-4 border-b border-slate-50 transition-colors ${activeTab !== 'comments' ? 'cursor-pointer hover:bg-slate-50' : ''}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-bold text-slate-800 truncate">{activeTab === 'comments' ? post.content.replace(/<[^>]*>?/gm, '') : post.title}</p>
                  <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(post.createdAt)}</span>
                </div>
                <div className="text-[11px] font-black text-blue-500 bg-blue-50 px-2 py-1 rounded">
                  {activeTab === 'comments' ? '댓글' : '게시글'}
                </div>
              </div>
            )) : <p className="py-20 text-center text-slate-400 font-bold italic">기록이 없소.</p>}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyContentTabs;
