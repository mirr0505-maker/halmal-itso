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
  side: 'left' | 'right';
  type: 'comment' | 'formal';
  createdAt: any;
  likes: number;
  dislikes?: number; 
  authorInfo?: AuthorInfo;
  imageUrl?: string; // 🚀 이미지 URL 추가
  linkUrl?: string;  // 🚀 링크 URL 추가
}