// src/components/MyContentTabs.tsx
import React, { useState } from 'react';
import type { Post } from '../types';

interface Props {
  myFormalPosts: Post[];
  myComments: Post[];
  friends: string[];
  onPostClick: (post: Post) => void;
  onToggleFriend: (name: string) => void;
}

const MyContentTabs = ({ myFormalPosts = [], myComments = [], friends = [], onPostClick, onToggleFriend }: Props) => {
  const [activeTab, setActiveTab] = useState<'formal' | 'comment' | 'friends'>('formal');
  
  const [friendSearchQuery, setFriendSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  const filteredFriends = (friends || []).filter(name => 
    name.toLowerCase().includes(friendSearchQuery.toLowerCase())
  );

  const totalPages = Math.ceil(filteredFriends.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentFriends = filteredFriends.slice(indexOfFirstItem, indexOfLastItem);

  const handleUnfriend = (name: string) => {
    if (window.confirm(`${name}님과 깐부를 해제하시겠소?`)) {
      onToggleFriend(name);
    }
  };

  const handleBlock = (name: string) => {
    if (window.confirm(`${name}님을 차단하시겠소? 더 이상 서로의 할말을 볼 수 없게 되오.`)) {
      // 🚀 현재는 깐부 해제와 동일하게 작동하되, 추후 별도 차단 리스트 연동 가능
      onToggleFriend(name);
      alert(`${name}님을 차단 처리하였소.`);
    }
  };

  return (
    <div className="bg-white border-2 border-slate-200 rounded-[2rem] overflow-hidden shadow-sm">
      <div className="flex border-b-2 border-slate-100">
        <button onClick={() => setActiveTab('formal')} className={`flex-1 py-4 font-black text-sm transition-all ${activeTab === 'formal' ? 'bg-white text-slate-900 border-b-4 border-slate-900' : 'bg-slate-50 text-slate-400'}`}>
          📝 내가 쓴 글 ({myFormalPosts?.length || 0})
        </button>
        <button onClick={() => setActiveTab('comment')} className={`flex-1 py-4 font-black text-sm transition-all ${activeTab === 'comment' ? 'bg-white text-slate-900 border-b-4 border-slate-900' : 'bg-slate-50 text-slate-400'}`}>
          💬 나의 댓글 ({myComments?.length || 0})
        </button>
        <button onClick={() => setActiveTab('friends')} className={`flex-1 py-4 font-black text-sm transition-all ${activeTab === 'friends' ? 'bg-white text-slate-900 border-b-4 border-slate-900' : 'bg-slate-50 text-slate-400'}`}>
          🤝 깐부 관리 ({friends?.length || 0})
        </button>
      </div>

      <div className="p-4 md:p-6 min-h-[400px]">
        {activeTab === 'formal' ? (
          <div className="space-y-4">
            {myFormalPosts && myFormalPosts.length > 0 ? myFormalPosts.map(post => {
              // 🚀 현재 게시 상태 계산 로직
              const now = new Date();
              const createdAt = post.createdAt?.seconds ? new Date(post.createdAt.seconds * 1000) : now;
              const diffInHours = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
              const likes = post.likes || 0;

              let statusText = "아무말 게시 중";
              let statusColor = "bg-blue-50 text-blue-600 border-blue-100";
              let isExpired = false;

              if (likes >= 30 && diffInHours < 6) {
                statusText = "🌟 대세말 게시 중";
                statusColor = "bg-amber-100 text-amber-700 border-amber-200";
              } else if (likes >= 3 && diffInHours < 1) {
                statusText = "📣 주목말 게시 중";
                statusColor = "bg-emerald-100 text-emerald-700 border-emerald-200";
              } else if (diffInHours >= 6) {
                statusText = "다시 할말 (준비 중)";
                statusColor = "bg-slate-100 text-slate-400 border-slate-200";
                isExpired = true;
              }

              return (
                <div key={post.id} onClick={() => onPostClick(post)} className="p-5 border-2 border-slate-100 rounded-2xl hover:border-slate-900 hover:bg-slate-50 cursor-pointer transition-all group relative">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg border ${statusColor}`}>
                      {statusText}
                    </span>
                  </div>
                  <h4 className="font-black text-slate-900 mb-2 group-hover:text-emerald-600 transition-colors">{post.title}</h4>
                  <div className="text-sm text-slate-500 line-clamp-2 leading-relaxed" dangerouslySetInnerHTML={{ __html: post.content }} />
                  
                  {isExpired && (
                    <div className="absolute top-5 right-5">
                      <span className="text-[9px] font-black bg-rose-50 text-rose-500 px-2 py-1 rounded-lg border border-rose-100 animate-pulse">
                        재업로드 준비중
                      </span>
                    </div>
                  )}

                  <div className="mt-3 flex justify-between items-center text-[10px] font-bold text-slate-300 uppercase">
                  <span>{post.createdAt?.seconds ? new Date(post.createdAt.seconds * 1000).toLocaleDateString() : ""}</span>
                  <span className="bg-slate-100 px-2 py-1 rounded">열람하기 🔗</span>
                </div>
              </div>
            );
            }) : <p className="text-center py-20 text-slate-300 font-bold italic">아직 작성한 정식 연계글이 없소.</p>}
          </div>
        ) : activeTab === 'comment' ? (
          <div className="space-y-3">
            {myComments && myComments.length > 0 ? myComments.map(comment => (
              <div key={comment.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="text-sm text-slate-600 line-clamp-3 leading-relaxed" dangerouslySetInnerHTML={{ __html: comment.content }} />
                <div className="mt-2 text-[10px] font-bold text-slate-300">
                  {comment.createdAt?.seconds ? new Date(comment.createdAt.seconds * 1000).toLocaleDateString() : ""}
                </div>
              </div>
            )) : <p className="text-center py-20 text-slate-300 font-bold italic">남긴 댓글이 아직 없소.</p>}
          </div>
        ) : (
          <div className="flex flex-col h-full">
            <div className="mb-6 relative">
              <input 
                type="text" 
                placeholder="이름으로 깐부 찾기..." 
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-emerald-500 focus:bg-white transition-all"
                value={friendSearchQuery}
                onChange={(e) => {
                  setFriendSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
              />
              <span className="absolute left-4 top-3.5 text-slate-400">🔍</span>
            </div>

            <div className="flex-1 space-y-4">
              {currentFriends.length > 0 ? currentFriends.map((name, idx) => (
                <div key={idx} className="flex items-center justify-between p-5 bg-white border-2 border-slate-100 rounded-[1.5rem] hover:border-slate-300 transition-all shadow-sm animate-in fade-in duration-200">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-slate-100 overflow-hidden border-2 border-slate-200 shadow-inner">
                      <img src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${name}`} alt="avatar" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-[1000] text-lg text-slate-900 leading-tight">{name}</span>
                      {/* 🚀 정보 라인에 최근 접속 시간 통합 */}
                      <span className="text-xs font-bold text-slate-400 mt-1.5">
                        Lv.1 · 깐부 2 · 좋아요 123 · <span className="text-emerald-500 font-black">방금 전 접속</span>
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => handleUnfriend(name)} 
                      className="px-4 py-2 bg-slate-100 text-slate-600 text-xs font-[1000] rounded-xl hover:bg-slate-200 transition-all active:scale-95"
                    >
                      깐부해제
                    </button>
                    
                    {/* 🚀 버튼 사이 시각적 상태 점 (Dot) 배치 */}
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" title="현재 접속 중" />
                    
                    <button 
                      onClick={() => handleBlock(name)} 
                      className="px-4 py-2 bg-rose-50 text-rose-600 text-xs font-[1000] rounded-xl border border-rose-100 hover:bg-rose-600 hover:text-white transition-all active:scale-95 shadow-sm"
                    >
                      차단하기
                    </button>
                  </div>
                </div>
              )) : (
                <p className="text-center py-20 text-slate-300 font-bold italic">
                  {friendSearchQuery ? "검색 결과가 없소." : "아직 맺은 깐부가 없소."}
                </p>
              )}
            </div>

            {totalPages > 1 && (
              <div className="mt-10 flex justify-center items-center gap-2">
                {[...Array(Math.min(totalPages, 5))].map((_, i) => (
                  <button key={i} onClick={() => setCurrentPage(i + 1)} className={`w-8 h-8 rounded-lg font-black text-xs transition-all ${currentPage === i + 1 ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:bg-slate-100'}`}>
                    {i + 1}
                  </button>
                ))}
                {totalPages > 5 && <span className="text-slate-300 text-xs">...</span>}
                <button onClick={() => setCurrentPage(totalPages)} className={`px-3 h-8 rounded-lg font-black text-xs transition-all ${currentPage === totalPages ? 'bg-slate-900 text-white' : 'text-slate-400 hover:bg-slate-100'}`}>
                  {totalPages}
                </button>
                <button onClick={() => setCurrentPage(totalPages)} className="px-3 h-8 rounded-lg font-black text-xs text-slate-400 hover:text-slate-900 transition-all uppercase tracking-widest">끝</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyContentTabs;