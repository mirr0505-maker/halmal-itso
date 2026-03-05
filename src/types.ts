// src/types.ts
export interface AuthorInfo {
  level: number;
  friendCount: number;
  totalLikes: number;
}

export interface Post {
  id: string;
  author: string;
  title: string | null;
  content: string;
  parentId: string | null;
  rootId: string | null; // 🚀 최상위 게시글 ID (토론 주제 ID)
  side: 'left' | 'right';
  type: 'comment' | 'formal';
  createdAt: any;
  likes: number;
  dislikes?: number; 
  authorInfo?: AuthorInfo;
  imageUrl?: string; 
  linkUrl?: string;  
  tags?: string[];   
}