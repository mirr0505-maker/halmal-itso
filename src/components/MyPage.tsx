// src/components/MyPage.tsx
import { useState } from 'react';
import type { Post } from '../types';
import ActivityStats from './ActivityStats';
import MyContentTabs from './MyContentTabs';
import ProfileHeader from './ProfileHeader';
import ActivityMilestones from './ActivityMilestones';
import AvatarCollection from './AvatarCollection';
import OneCutList from './OneCutList';

interface Props {
  userData: any;
  allUserRootPosts: Post[];
  allUserChildPosts: Post[];
  friends: string[];
  friendCount: number;
  onPostClick: (post: Post) => void;
  onEditPost?: (post: Post) => void; 
  onToggleFriend: (author: string) => void;
  allUsers: Record<string, any>;
  followerCounts: Record<string, number>;
  toggleBlock: (author: string) => void;
  blocks: string[];
}

const MyPage = ({ 
  userData, allUserRootPosts, allUserChildPosts, friends, friendCount, onPostClick, onEditPost, onToggleFriend, allUsers, followerCounts
}: Props) => {
  const [activeTab, setActiveTab] = useState<'posts' | 'onecuts' | 'comments' | 'avatars' | 'friends'>('posts');
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  // 🚀 게시글 분리
  const standardPosts = allUserRootPosts.filter(p => !p.isOneCut);
  const onecutPosts = allUserRootPosts.filter(p => p.isOneCut);

  return (
    <div className="w-full max-w-6xl mx-auto py-10 px-4 md:px-6 animate-in fade-in duration-700">
      <div className="flex flex-col gap-8">
        {/* 🚀 상단 프로필 영역 */}
        <ProfileHeader userData={userData} isEditing={isEditingProfile} setIsEditing={setIsEditingProfile} friendCount={friendCount} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 🚀 좌측: 활동 통계 및 마일스톤 */}
          <div className="lg:col-span-1 flex flex-col gap-6">
            <ActivityStats userData={userData} rootCount={allUserRootPosts.length} />
            <ActivityMilestones 
              userData={userData} 
              rootCount={allUserRootPosts.length} 
              formalCount={allUserChildPosts.filter(p => p.type === 'formal').length} 
              commentCount={allUserChildPosts.filter(p => p.type === 'comment').length} 
            />
          </div>

          {/* 🚀 우측: 게시글/댓글/아바타 탭 콘텐츠 */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            <div className="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-blue-900/5 border border-slate-100 min-h-[600px] flex flex-col relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-600 to-indigo-500" />
              
              <div className="flex items-center gap-6 mb-10 border-b border-slate-50 pb-2 overflow-x-auto no-scrollbar">
                {(['posts', 'onecuts', 'comments', 'avatars', 'friends'] as const).map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)} className={`pb-4 px-2 text-[15px] font-[1000] tracking-tight transition-all relative whitespace-nowrap ${activeTab === tab ? 'text-blue-600' : 'text-slate-300 hover:text-slate-500'}`}>
                    {tab === 'posts' && '나의 기록'}
                    {tab === 'onecuts' && '나의 한컷'}
                    {tab === 'comments' && '참여한 토론'}
                    {tab === 'avatars' && '아바타 수집'}
                    {tab === 'friends' && '깐부 목록'}
                    {activeTab === tab && <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-600 rounded-full" />}
                  </button>
                ))}
              </div>

              <div className="flex-1">
                {activeTab === 'posts' && <MyContentTabs posts={standardPosts} onPostClick={onEditPost || onPostClick} type="posts" />}
                {activeTab === 'onecuts' && (
                  <div className="pt-4">
                    <OneCutList posts={onecutPosts} onTopicClick={onEditPost || onPostClick} allUsers={allUsers} />
                  </div>
                )}
                {activeTab === 'comments' && <MyContentTabs posts={allUserChildPosts} onPostClick={onPostClick} type="comments" />}
                {activeTab === 'avatars' && <AvatarCollection currentLevel={userData.level} />}
                {activeTab === 'friends' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {friends.length === 0 ? (
                      <div className="col-span-full py-20 text-center text-slate-300 font-bold italic">아직 맺은 깐부가 없어요.</div>
                    ) : (
                      friends.map(fname => {
                        const fData = allUsers[`nickname_${fname}`] || allUsers[fname];
                        return (
                          <div key={fname} className="bg-slate-50 p-4 rounded-2xl flex items-center justify-between border border-slate-100">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-white overflow-hidden border border-slate-200 shadow-sm"><img src={fData?.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${fname}`} alt="" /></div>
                              <div className="flex flex-col">
                                <span className="font-black text-[13px] text-slate-900">{fname}</span>
                                <span className="text-[10px] font-bold text-slate-400">Lv {fData?.level || 1} · 깐부 {followerCounts[fname] || 0}</span>
                              </div>
                            </div>
                            <button onClick={() => onToggleFriend(fname)} className="text-[10px] font-black text-rose-500 bg-white px-3 py-1.5 rounded-lg border border-rose-100 shadow-sm hover:bg-rose-50 transition-all">깐부해제</button>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyPage;
