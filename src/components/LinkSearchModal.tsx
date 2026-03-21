// src/components/LinkSearchModal.tsx — 한컷 작성 시 원본 글 검색·선택 팝업
import { useState } from 'react';
import type { Post } from '../types';

interface Props {
  myPosts: Post[];
  onSelectPost: (postId: string) => void;
  onClose: () => void;
}

const LinkSearchModal = ({ myPosts, onSelectPost, onClose }: Props) => {
  const [linkSearch, setLinkSearch] = useState("");

  const filteredPosts = myPosts.filter(p =>
    !linkSearch ||
    p.title?.toLowerCase().includes(linkSearch.toLowerCase()) ||
    p.content.toLowerCase().includes(linkSearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300" onClick={e => e.stopPropagation()}>

        {/* 모달 헤더 */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100">
          <div>
            <h3 className="text-[16px] font-[1000] text-slate-900 tracking-tighter">내 글 선택</h3>
            <p className="text-[11px] font-bold text-slate-400 mt-0.5">한컷과 연결할 원본 글을 선택하세요.</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 transition-colors">
            <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* 검색 입력 */}
        <div className="px-8 pt-5 pb-3">
          <input
            type="text"
            placeholder="제목 또는 내용으로 검색..."
            value={linkSearch}
            onChange={e => setLinkSearch(e.target.value)}
            autoFocus
            className="w-full bg-slate-50 border-2 border-transparent px-5 py-3 rounded-2xl text-[13px] font-bold text-slate-600 focus:bg-white focus:border-blue-500 outline-none transition-all placeholder:text-slate-300"
          />
        </div>

        {/* 글 목록 */}
        <div className="px-8 pb-8 max-h-[400px] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] space-y-2">
          {myPosts.length === 0 ? (
            <p className="text-[13px] text-slate-300 font-bold text-center py-10">작성한 글이 없습니다.</p>
          ) : filteredPosts.length === 0 ? (
            <p className="text-[13px] text-slate-300 font-bold text-center py-10">검색 결과가 없습니다.</p>
          ) : (
            filteredPosts.map(p => (
              <div
                key={p.id}
                onClick={() => onSelectPost(p.id)}
                className="flex items-center justify-between px-5 py-4 bg-slate-50 hover:bg-blue-50 hover:border-blue-200 border-2 border-transparent rounded-2xl cursor-pointer transition-all group"
              >
                <div className="flex flex-col gap-0.5 min-w-0 mr-3">
                  <p className="text-[14px] font-black text-slate-900 truncate group-hover:text-blue-600 transition-colors">{p.title || "(제목 없음)"}</p>
                  <p className="text-[11px] font-bold text-slate-400">{p.category}</p>
                </div>
                <svg className="w-4 h-4 text-slate-300 group-hover:text-blue-400 shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default LinkSearchModal;
