export type PostCategory = 'general' | 'showcase' | 'help' | 'hiring' | 'feedback';

export interface CommunityPost {
  id: string;
  authorId: string;
  authorName: string;
  authorLevel: number;
  authorLevelTitle: string;
  category: PostCategory;
  title: string;
  body: string;
  tags: string[];
  upvotes: number;
  replyCount: number;
  isPinned: boolean;
  isHidden?: boolean;
  createdAt: any;
  updatedAt: any;
}

export interface CommunityReply {
  id: string;
  authorId: string;
  authorName: string;
  authorLevel: number;
  body: string;
  upvotes: number;
  isAccepted: boolean;
  isHidden?: boolean;
  createdAt: any;
}

export interface ModerationReport {
  itemType: 'post' | 'reply';
  itemId: string;
  postId?: string;
  reporterId: string;
  reason: string;
  createdAt: any;
}
