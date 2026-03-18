# Community Hub Implementation Plan (Plan 3 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the public community hub with forums (5 categories), real Firestore-backed leaderboard, showcase gallery, public activity feed, and community Cloud Function triggers for XP rewards.

**Architecture:** Community posts, replies, and votes stored in Firestore collections. Two new Cloud Function triggers (`onCommunityPost`, `onCommunityVote`) award XP with daily caps via transactions. Community page revamped with tabbed layout (Leaderboard, Forums, Showcase, Activity). Leaderboard rewired from dummy data to real Firestore queries.

**Tech Stack:** Firebase Cloud Functions v2, Firestore, React 19, React Query, shadcn/ui, Lucide icons, Framer Motion.

**Spec:** `docs/superpowers/specs/2026-03-18-gamification-community-design.md` (Sections 3, 4.8)

**Depends on:** Plan 1 (Gamification Engine)

---

## File Map

### New Files - Cloud Functions
| File | Responsibility |
|------|---------------|
| `functions/src/triggers/on-community-post.ts` | XP for new posts (capped) |
| `functions/src/triggers/on-community-vote.ts` | XP for upvotes received (capped) |
| `functions/src/gamification/rules/community-rules.ts` | Community XP rules with daily caps |

### New Files - Client
| File | Responsibility |
|------|---------------|
| `src/types/community.ts` | CommunityPost, Reply, Vote, PostCategory types |
| `src/services/community.ts` | Firestore CRUD for posts, replies, votes, moderation |
| `src/hooks/use-community.ts` | React Query hooks for community data |
| `src/components/community/leaderboard-tab.tsx` | Real Firestore leaderboard with filters |
| `src/components/community/forums-tab.tsx` | Post list with category/sort filters |
| `src/components/community/post-detail.tsx` | Single post with reply thread |
| `src/components/community/post-compose.tsx` | New post form |
| `src/components/community/showcase-tab.tsx` | Gallery grid of showcase posts |
| `src/components/community/activity-tab.tsx` | Public achievement feed |
| `src/components/community/user-card.tsx` | Author card with level badge |
| `src/components/community/upvote-button.tsx` | Idempotent upvote button |

### Modified Files
| File | Change |
|------|--------|
| `functions/src/index.ts` | Add community trigger exports |
| `functions/src/gamification/engine.ts` | Add community-rules import |
| `src/app/community/page.tsx` | Full rewrite with tabbed layout |
| `src/services/firestore.ts` | Rewrite getTopFreelancers to real Firestore query |

---

## Task 1: Community Types + Service

**Files:**
- Create: `src/types/community.ts`
- Create: `src/services/community.ts`

- [ ] **Step 1: Create community types**

```typescript
// src/types/community.ts
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
```

- [ ] **Step 2: Create community service**

```typescript
// src/services/community.ts
import {
  collection, doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc,
  query, where, orderBy, limit, startAfter, serverTimestamp,
  increment, setDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { CommunityPost, CommunityReply, PostCategory } from '@/types/community';

const postsRef = collection(db, 'communityPosts');

// Posts
export async function createPost(
  post: Omit<CommunityPost, 'id' | 'upvotes' | 'replyCount' | 'isPinned' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const docRef = await addDoc(postsRef, {
    ...post,
    upvotes: 0,
    replyCount: 0,
    isPinned: false,
    isHidden: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export type SortOption = 'recent' | 'popular' | 'unanswered';

export async function getPosts(
  category?: PostCategory,
  sort: SortOption = 'recent',
  pageSize: number = 20,
  lastDoc?: any,
): Promise<CommunityPost[]> {
  const constraints: any[] = [where('isHidden', '!=', true)];
  if (category) constraints.push(where('category', '==', category));

  if (sort === 'popular') {
    constraints.push(orderBy('upvotes', 'desc'));
  } else if (sort === 'unanswered') {
    constraints.push(where('replyCount', '==', 0), orderBy('createdAt', 'desc'));
  } else {
    constraints.push(orderBy('createdAt', 'desc'));
  }

  constraints.push(limit(pageSize));
  if (lastDoc) constraints.push(startAfter(lastDoc));

  const q = query(postsRef, ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as CommunityPost));
}

export async function getPost(postId: string): Promise<CommunityPost | null> {
  const snap = await getDoc(doc(postsRef, postId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as CommunityPost;
}

export async function deletePost(postId: string): Promise<void> {
  await deleteDoc(doc(postsRef, postId));
}

// Replies
export async function createReply(
  postId: string,
  reply: Omit<CommunityReply, 'id' | 'upvotes' | 'isAccepted' | 'createdAt'>
): Promise<string> {
  const docRef = await addDoc(collection(db, 'communityPosts', postId, 'replies'), {
    ...reply,
    upvotes: 0,
    isAccepted: false,
    isHidden: false,
    createdAt: serverTimestamp(),
  });
  // Increment reply count on post
  await updateDoc(doc(postsRef, postId), { replyCount: increment(1) });
  return docRef.id;
}

export async function getReplies(postId: string): Promise<CommunityReply[]> {
  const q = query(
    collection(db, 'communityPosts', postId, 'replies'),
    orderBy('createdAt', 'asc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as CommunityReply));
}

export async function acceptReply(postId: string, replyId: string): Promise<void> {
  await updateDoc(doc(db, 'communityPosts', postId, 'replies', replyId), { isAccepted: true });
}

// Votes (idempotent - doc ID = userId)
export async function upvotePost(postId: string, userId: string): Promise<boolean> {
  const voteRef = doc(db, 'communityPosts', postId, 'votes', userId);
  const existing = await getDoc(voteRef);
  if (existing.exists()) return false; // Already voted
  await setDoc(voteRef, { userId, value: 1, createdAt: serverTimestamp() });
  await updateDoc(doc(postsRef, postId), { upvotes: increment(1) });
  return true;
}

export async function hasUserVoted(postId: string, userId: string): Promise<boolean> {
  const voteRef = doc(db, 'communityPosts', postId, 'votes', userId);
  const snap = await getDoc(voteRef);
  return snap.exists();
}

// Moderation
export async function flagContent(
  itemType: 'post' | 'reply',
  itemId: string,
  reporterId: string,
  reason: string,
  postId?: string,
): Promise<void> {
  await addDoc(collection(db, 'moderationQueue'), {
    itemType,
    itemId,
    postId,
    reporterId,
    reason,
    createdAt: serverTimestamp(),
  });
}

// Leaderboard (real Firestore query)
export async function queryLeaderboard(
  pageSize: number = 20,
  lastDoc?: any,
): Promise<any[]> {
  const constraints: any[] = [orderBy('xp', 'desc'), limit(pageSize)];
  if (lastDoc) constraints.push(startAfter(lastDoc));
  const q = query(collection(db, 'freelancers'), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Public activity feed
export async function getPublicActivity(pageSize: number = 50): Promise<any[]> {
  const q = query(
    collection(db, 'publicActivity'),
    orderBy('createdAt', 'desc'),
    limit(pageSize),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
```

- [ ] **Step 3: Commit**

```bash
git add src/types/community.ts src/services/community.ts
git commit -m "feat: add community types and Firestore service"
```

---

## Task 2: Community Cloud Functions

**Files:**
- Create: `functions/src/gamification/rules/community-rules.ts`
- Create: `functions/src/triggers/on-community-post.ts`
- Create: `functions/src/triggers/on-community-vote.ts`
- Modify: `functions/src/index.ts`
- Modify: `functions/src/gamification/engine.ts`

- [ ] **Step 1: Create community rules**

```typescript
// functions/src/gamification/rules/community-rules.ts
import type { GamificationEvent, FreelancerStats, Reward } from '../types';

export function getCommunityRules(event: GamificationEvent, stats: FreelancerStats): Reward[] {
  // Community rules are handled directly in the triggers with transaction-based caps
  // This function handles badge checks only
  const rewards: Reward[] = [];

  if (event.type === 'community_post') {
    // First post badge
    if (!stats.badges.includes('first-post')) {
      rewards.push({ type: 'badge', badgeId: 'first-post', description: 'First community post' });
    }
  }

  return rewards;
}
```

- [ ] **Step 2: Create on-community-post trigger**

```typescript
// functions/src/triggers/on-community-post.ts
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { processEvent } from '../gamification/engine';
import { db } from '../utils/firestore';
import { FieldValue } from 'firebase-admin/firestore';

export const onCommunityPost = onDocumentCreated(
  'communityPosts/{postId}',
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    const authorId = data.authorId;
    if (!authorId) return;

    // Award XP with daily cap via transaction
    const statsRef = db.collection('freelancerStats').doc(authorId);
    const today = new Date().toISOString().split('T')[0];

    await db.runTransaction(async (txn) => {
      const statsSnap = await txn.get(statsRef);
      const stats = statsSnap.data();

      let dailyXp = stats?.dailyCommunityXp ?? 0;
      const dailyDate = stats?.dailyCommunityXpDate ?? '';

      // Reset if new day
      if (dailyDate !== today) {
        dailyXp = 0;
      }

      // Check cap (50 XP/day for posts)
      if (dailyXp >= 50) return;

      const xpToAward = Math.min(5, 50 - dailyXp);

      txn.update(statsRef, {
        dailyCommunityXp: dailyXp + xpToAward,
        dailyCommunityXpDate: today,
        xp: FieldValue.increment(xpToAward),
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Sync XP to freelancers doc
      txn.update(db.collection('freelancers').doc(authorId), {
        xp: FieldValue.increment(xpToAward),
      });
    });

    // Process for badges (outside transaction)
    await processEvent({
      type: 'community_post',
      freelancerId: authorId,
      metadata: { postId: event.params.postId },
    });
  }
);
```

- [ ] **Step 3: Create on-community-vote trigger**

```typescript
// functions/src/triggers/on-community-vote.ts
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { db } from '../utils/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { writeNotification } from '../utils/notifications';

export const onCommunityVote = onDocumentCreated(
  'communityPosts/{postId}/votes/{voteId}',
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    // Get the post author (the one who receives XP)
    const postSnap = await db.collection('communityPosts').doc(event.params.postId).get();
    const postData = postSnap.data();
    if (!postData) return;

    const authorId = postData.authorId;
    if (!authorId) return;

    // Don't award XP for self-votes
    if (data.userId === authorId) return;

    // Award XP with daily cap via transaction
    const statsRef = db.collection('freelancerStats').doc(authorId);
    const today = new Date().toISOString().split('T')[0];

    let awarded = false;
    await db.runTransaction(async (txn) => {
      const statsSnap = await txn.get(statsRef);
      const stats = statsSnap.data();

      let dailyXp = stats?.dailyCommunityXp ?? 0;
      const dailyDate = stats?.dailyCommunityXpDate ?? '';

      if (dailyDate !== today) {
        dailyXp = 0;
      }

      // Check cap (100 XP/day for upvotes received)
      if (dailyXp >= 180) return; // 50 posts + 30 replies + 100 votes = 180 total cap

      const xpToAward = Math.min(10, 180 - dailyXp);

      txn.update(statsRef, {
        dailyCommunityXp: dailyXp + xpToAward,
        dailyCommunityXpDate: today,
        xp: FieldValue.increment(xpToAward),
        updatedAt: FieldValue.serverTimestamp(),
      });

      txn.update(db.collection('freelancers').doc(authorId), {
        xp: FieldValue.increment(xpToAward),
      });

      awarded = true;
    });

    // Check helpful-10 badge
    if (awarded) {
      const totalUpvotes = (postData.upvotes ?? 0) + 1;
      if (totalUpvotes >= 10) {
        const statsSnap = await statsRef.get();
        const badges = statsSnap.data()?.badges ?? [];
        if (!badges.includes('helpful-10')) {
          await statsRef.update({ badges: FieldValue.arrayUnion('helpful-10') });
          await db.collection('freelancers').doc(authorId).update({
            badges: FieldValue.arrayUnion('helpful-10'),
          });
          await writeNotification(authorId, {
            type: 'badge_earned',
            title: 'Badge Earned: Helpful',
            body: 'Received 10 upvotes on your posts',
            metadata: { badgeId: 'helpful-10' },
          });
        }
      }
    }
  }
);
```

- [ ] **Step 4: Update index.ts and engine.ts**

In `functions/src/index.ts` add:
```typescript
export { onCommunityPost } from './triggers/on-community-post';
export { onCommunityVote } from './triggers/on-community-vote';
```

In `functions/src/gamification/engine.ts` add import:
```typescript
import { getCommunityRules } from './rules/community-rules';
```
And add to allRules:
```typescript
...getCommunityRules(event, stats),
```

- [ ] **Step 5: Commit**

```bash
git add functions/src/gamification/rules/community-rules.ts functions/src/triggers/on-community-post.ts functions/src/triggers/on-community-vote.ts functions/src/index.ts functions/src/gamification/engine.ts
git commit -m "feat: add community Cloud Function triggers with daily XP caps"
```

---

## Task 3: Community React Query Hooks

**Files:**
- Create: `src/hooks/use-community.ts`

- [ ] **Step 1: Create hooks**

```typescript
// src/hooks/use-community.ts
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getPosts, getPost, getReplies, createPost, createReply,
  upvotePost, getPublicActivity, queryLeaderboard,
  type SortOption,
} from '@/services/community';
import type { PostCategory } from '@/types/community';

export function usePosts(category?: PostCategory, sort: SortOption = 'recent') {
  return useQuery({
    queryKey: ['communityPosts', category, sort],
    queryFn: () => getPosts(category, sort),
    staleTime: 30_000,
  });
}

export function usePost(postId: string | undefined) {
  return useQuery({
    queryKey: ['communityPost', postId],
    queryFn: () => getPost(postId!),
    enabled: !!postId,
  });
}

export function useReplies(postId: string | undefined) {
  return useQuery({
    queryKey: ['communityReplies', postId],
    queryFn: () => getReplies(postId!),
    enabled: !!postId,
  });
}

export function useCreatePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createPost,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['communityPosts'] }),
  });
}

export function useCreateReply(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reply: Parameters<typeof createReply>[1]) => createReply(postId, reply),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['communityReplies', postId] });
      qc.invalidateQueries({ queryKey: ['communityPost', postId] });
    },
  });
}

export function useUpvote(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => upvotePost(postId, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['communityPost', postId] }),
  });
}

export function useLeaderboard() {
  return useQuery({
    queryKey: ['leaderboard'],
    queryFn: () => queryLeaderboard(),
    staleTime: 60_000,
  });
}

export function usePublicActivity() {
  return useQuery({
    queryKey: ['publicActivity'],
    queryFn: () => getPublicActivity(),
    staleTime: 30_000,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/use-community.ts
git commit -m "feat: add community React Query hooks"
```

---

## Task 4: Shared Components (UserCard + UpvoteButton)

**Files:**
- Create: `src/components/community/user-card.tsx`
- Create: `src/components/community/upvote-button.tsx`

- [ ] **Step 1: Create user card**

```typescript
// src/components/community/user-card.tsx
interface UserCardProps {
  name: string;
  level: number;
  levelTitle: string;
}

export function UserCard({ name, level, levelTitle }: UserCardProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
        {name.charAt(0).toUpperCase()}
      </div>
      <div>
        <span className="text-sm font-medium">{name}</span>
        <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          Lv.{level} {levelTitle}
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create upvote button**

```typescript
// src/components/community/upvote-button.tsx
'use client';

import { useState, useEffect } from 'react';
import { ArrowBigUp } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { hasUserVoted } from '@/services/community';
import { useUpvote } from '@/hooks/use-community';
import { cn } from '@/lib/utils';

interface UpvoteButtonProps {
  postId: string;
  count: number;
}

export function UpvoteButton({ postId, count }: UpvoteButtonProps) {
  const { user } = useAuth();
  const upvote = useUpvote(postId);
  const [hasVoted, setHasVoted] = useState(false);

  useEffect(() => {
    if (!user) return;
    hasUserVoted(postId, user.uid).then(setHasVoted);
  }, [postId, user]);

  const handleVote = () => {
    if (!user || hasVoted) return;
    upvote.mutate(user.uid, {
      onSuccess: (voted) => { if (voted) setHasVoted(true); },
    });
  };

  return (
    <button
      onClick={handleVote}
      disabled={!user || hasVoted}
      className={cn(
        'flex items-center gap-1 rounded-md px-2 py-1 text-sm transition-colors',
        hasVoted
          ? 'text-primary bg-primary/10'
          : 'text-muted-foreground hover:text-primary hover:bg-primary/5',
      )}
    >
      <ArrowBigUp className={cn('h-4 w-4', hasVoted && 'fill-primary')} />
      {count}
    </button>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/community/user-card.tsx src/components/community/upvote-button.tsx
git commit -m "feat: add community user card and upvote button"
```

---

## Task 5: Forums Tab + Post Compose

**Files:**
- Create: `src/components/community/forums-tab.tsx`
- Create: `src/components/community/post-compose.tsx`

- [ ] **Step 1: Create post compose form**

```typescript
// src/components/community/post-compose.tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/auth-context';
import { useCreatePost } from '@/hooks/use-community';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import type { PostCategory } from '@/types/community';

const CATEGORIES: { value: PostCategory; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'showcase', label: 'Showcase' },
  { value: 'help', label: 'Help' },
  { value: 'hiring', label: 'Hiring' },
  { value: 'feedback', label: 'Feedback' },
];

interface PostComposeProps {
  onClose: () => void;
}

export function PostCompose({ onClose }: PostComposeProps) {
  const { user } = useAuth();
  const createPost = useCreatePost();
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<PostCategory>('general');
  const [tags, setTags] = useState('');

  const handleSubmit = async () => {
    if (!user || !title.trim() || !body.trim()) return;
    try {
      await createPost.mutateAsync({
        authorId: user.uid,
        authorName: user.displayName ?? 'Anonymous',
        authorLevel: 1,
        authorLevelTitle: 'Newcomer',
        category,
        title: title.trim(),
        body: body.trim(),
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      });
      toast({ title: 'Post created' });
      onClose();
    } catch {
      toast({ title: 'Error', description: 'Failed to create post.', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-6">
      <h3 className="text-lg font-semibold">New Post</h3>
      <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c.value}
            onClick={() => setCategory(c.value)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              category === c.value ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>
      <Textarea placeholder="Write your post..." value={body} onChange={(e) => setBody(e.target.value)} className="min-h-[120px]" />
      <Input placeholder="Tags (comma-separated)" value={tags} onChange={(e) => setTags(e.target.value)} />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" onClick={handleSubmit} disabled={!title.trim() || !body.trim() || createPost.isPending}>
          {createPost.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
          Post
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create forums tab**

```typescript
// src/components/community/forums-tab.tsx
'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePosts } from '@/hooks/use-community';
import { UserCard } from './user-card';
import { UpvoteButton } from './upvote-button';
import { PostCompose } from './post-compose';
import type { PostCategory } from '@/types/community';
import type { SortOption } from '@/services/community';

const CATEGORIES: { value: PostCategory | undefined; label: string }[] = [
  { value: undefined, label: 'All' },
  { value: 'general', label: 'General' },
  { value: 'showcase', label: 'Showcase' },
  { value: 'help', label: 'Help' },
  { value: 'hiring', label: 'Hiring' },
  { value: 'feedback', label: 'Feedback' },
];

const SORTS: { value: SortOption; label: string }[] = [
  { value: 'recent', label: 'Recent' },
  { value: 'popular', label: 'Popular' },
  { value: 'unanswered', label: 'Unanswered' },
];

interface ForumsTabProps {
  onSelectPost: (postId: string) => void;
}

export function ForumsTab({ onSelectPost }: ForumsTabProps) {
  const [category, setCategory] = useState<PostCategory | undefined>(undefined);
  const [sort, setSort] = useState<SortOption>('recent');
  const [composing, setComposing] = useState(false);
  const { data: posts, isLoading } = usePosts(category, sort);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <button
              key={c.label}
              onClick={() => setCategory(c.value)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                category === c.value ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {SORTS.map((s) => (
              <button
                key={s.value}
                onClick={() => setSort(s.value)}
                className={`rounded-md px-2 py-1 text-xs transition-colors ${
                  sort === s.value ? 'bg-gray-200 text-gray-900 font-medium' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <Button size="sm" onClick={() => setComposing(true)}>
            <Plus className="mr-1 h-4 w-4" /> New Post
          </Button>
        </div>
      </div>

      {composing && <PostCompose onClose={() => setComposing(false)} />}

      {/* Post list */}
      {isLoading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">Loading posts...</div>
      ) : !posts?.length ? (
        <div className="py-8 text-center text-sm text-muted-foreground">No posts yet. Be the first!</div>
      ) : (
        <div className="space-y-2">
          {posts.map((post) => (
            <button
              key={post.id}
              onClick={() => onSelectPost(post.id)}
              className="flex w-full items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 text-left transition-colors hover:border-primary/30 hover:bg-gray-100"
            >
              <UpvoteButton postId={post.id} count={post.upvotes} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-medium text-gray-600">{post.category}</span>
                  <h3 className="text-sm font-semibold truncate">{post.title}</h3>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <UserCard name={post.authorName} level={post.authorLevel} levelTitle={post.authorLevelTitle} />
                  <span>{post.replyCount} replies</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/community/forums-tab.tsx src/components/community/post-compose.tsx
git commit -m "feat: add forums tab with post list and compose form"
```

---

## Task 6: Post Detail

**Files:**
- Create: `src/components/community/post-detail.tsx`

- [ ] **Step 1: Create post detail with reply thread**

```typescript
// src/components/community/post-detail.tsx
'use client';

import { useState } from 'react';
import { ArrowLeft, Flag, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { usePost, useReplies, useCreateReply } from '@/hooks/use-community';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { flagContent, acceptReply } from '@/services/community';
import { UserCard } from './user-card';
import { UpvoteButton } from './upvote-button';

interface PostDetailProps {
  postId: string;
  onBack: () => void;
}

export function PostDetail({ postId, onBack }: PostDetailProps) {
  const { user } = useAuth();
  const { data: post } = usePost(postId);
  const { data: replies } = useReplies(postId);
  const createReply = useCreateReply(postId);
  const { toast } = useToast();
  const [replyText, setReplyText] = useState('');

  if (!post) return <div className="py-8 text-center text-sm text-muted-foreground">Loading...</div>;

  const handleReply = async () => {
    if (!user || !replyText.trim()) return;
    await createReply.mutateAsync({
      authorId: user.uid,
      authorName: user.displayName ?? 'Anonymous',
      authorLevel: 1,
      body: replyText.trim(),
    });
    setReplyText('');
  };

  const handleFlag = async () => {
    if (!user) return;
    await flagContent('post', postId, user.uid, 'Inappropriate content');
    toast({ title: 'Reported', description: 'This post has been flagged for review.' });
  };

  const handleAccept = async (replyId: string) => {
    await acceptReply(postId, replyId);
    toast({ title: 'Answer accepted' });
  };

  const isAuthor = user?.uid === post.authorId;

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ArrowLeft className="mr-1 h-4 w-4" /> Back
      </Button>

      {/* Post */}
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">{post.category}</span>
            <UserCard name={post.authorName} level={post.authorLevel} levelTitle={post.authorLevelTitle} />
          </div>
          <div className="flex items-center gap-2">
            <UpvoteButton postId={post.id} count={post.upvotes} />
            <button onClick={handleFlag} className="text-muted-foreground hover:text-destructive" title="Flag">
              <Flag className="h-4 w-4" />
            </button>
          </div>
        </div>

        <h2 className="text-xl font-bold mb-2">{post.title}</h2>
        <p className="text-sm whitespace-pre-wrap">{post.body}</p>

        {post.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {post.tags.map((tag: string) => (
              <span key={tag} className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] text-gray-500">{tag}</span>
            ))}
          </div>
        )}
      </div>

      {/* Replies */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">{replies?.length ?? 0} Replies</h3>
        {replies?.map((reply) => (
          <div key={reply.id} className={`rounded-lg border p-4 ${reply.isAccepted ? 'border-primary bg-primary/5' : 'border-gray-200 bg-white'}`}>
            <div className="flex items-center justify-between mb-2">
              <UserCard name={reply.authorName} level={reply.authorLevel} levelTitle="" />
              {reply.isAccepted && (
                <span className="flex items-center gap-1 text-xs text-primary font-medium">
                  <CheckCircle className="h-3 w-3" /> Accepted
                </span>
              )}
              {isAuthor && post.category === 'help' && !reply.isAccepted && (
                <Button size="sm" variant="ghost" className="text-xs" onClick={() => handleAccept(reply.id)}>
                  Accept Answer
                </Button>
              )}
            </div>
            <p className="text-sm whitespace-pre-wrap">{reply.body}</p>
          </div>
        ))}

        {/* Reply form */}
        {user && (
          <div className="flex gap-2">
            <Textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Write a reply..."
              className="min-h-[60px]"
            />
            <Button size="sm" onClick={handleReply} disabled={!replyText.trim() || createReply.isPending}>
              Reply
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/community/post-detail.tsx
git commit -m "feat: add post detail view with reply thread and moderation"
```

---

## Task 7: Leaderboard, Showcase, Activity Tabs

**Files:**
- Create: `src/components/community/leaderboard-tab.tsx`
- Create: `src/components/community/showcase-tab.tsx`
- Create: `src/components/community/activity-tab.tsx`

- [ ] **Step 1: Create leaderboard tab**

```typescript
// src/components/community/leaderboard-tab.tsx
'use client';

import Link from 'next/link';
import { Star, Flame } from 'lucide-react';
import { useLeaderboard } from '@/hooks/use-community';

export function LeaderboardTab() {
  const { data: freelancers, isLoading } = useLeaderboard();

  if (isLoading) return <div className="py-8 text-center text-sm text-muted-foreground">Loading...</div>;

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-100 text-gray-500 text-xs uppercase">
          <tr>
            <th className="px-4 py-3 text-left w-12">#</th>
            <th className="px-4 py-3 text-left">Freelancer</th>
            <th className="px-4 py-3 text-left hidden md:table-cell">Level</th>
            <th className="px-4 py-3 text-left hidden md:table-cell">Skills</th>
            <th className="px-4 py-3 text-right">Rating</th>
            <th className="px-4 py-3 text-right">XP</th>
          </tr>
        </thead>
        <tbody>
          {freelancers?.map((f: any, i: number) => (
            <tr key={f.id} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3 font-bold text-muted-foreground">{i + 1}</td>
              <td className="px-4 py-3">
                <Link href={`/freelancer/${f.id}`} className="font-medium hover:text-primary">
                  {f.name}
                </Link>
              </td>
              <td className="px-4 py-3 hidden md:table-cell">
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                  Lv.{f.level ?? 1} {f.levelTitle ?? 'Newcomer'}
                </span>
              </td>
              <td className="px-4 py-3 hidden md:table-cell">
                <div className="flex flex-wrap gap-1">
                  {(f.skills ?? []).slice(0, 3).map((s: string) => (
                    <span key={s} className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">{s}</span>
                  ))}
                </div>
              </td>
              <td className="px-4 py-3 text-right">
                <span className="flex items-center justify-end gap-1">
                  <Star className="h-3 w-3 fill-primary text-primary" />
                  {f.rating?.toFixed(1) ?? 'N/A'}
                </span>
              </td>
              <td className="px-4 py-3 text-right font-semibold">
                {(f.xp ?? 0).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Create showcase tab**

```typescript
// src/components/community/showcase-tab.tsx
'use client';

import { usePosts } from '@/hooks/use-community';
import { UserCard } from './user-card';
import { UpvoteButton } from './upvote-button';

interface ShowcaseTabProps {
  onSelectPost: (postId: string) => void;
}

export function ShowcaseTab({ onSelectPost }: ShowcaseTabProps) {
  const { data: posts, isLoading } = usePosts('showcase', 'popular');

  if (isLoading) return <div className="py-8 text-center text-sm text-muted-foreground">Loading...</div>;

  if (!posts?.length) return <div className="py-8 text-center text-sm text-muted-foreground">No showcase posts yet.</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {posts.map((post) => (
        <button
          key={post.id}
          onClick={() => onSelectPost(post.id)}
          className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-left transition-all hover:border-primary/30 hover:-translate-y-0.5 hover:shadow-md"
        >
          <h3 className="text-sm font-semibold mb-1 truncate">{post.title}</h3>
          <p className="text-xs text-muted-foreground line-clamp-3 mb-3">{post.body}</p>
          <div className="flex items-center justify-between">
            <UserCard name={post.authorName} level={post.authorLevel} levelTitle={post.authorLevelTitle} />
            <UpvoteButton postId={post.id} count={post.upvotes} />
          </div>
          {post.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {post.tags.slice(0, 3).map((tag: string) => (
                <span key={tag} className="rounded-full bg-gray-200 px-1.5 py-0.5 text-[10px] text-gray-500">{tag}</span>
              ))}
            </div>
          )}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Create activity tab**

```typescript
// src/components/community/activity-tab.tsx
'use client';

import { Award, TrendingUp, Flame } from 'lucide-react';
import { usePublicActivity } from '@/hooks/use-community';

const ICON_MAP: Record<string, typeof Award> = {
  badge_earned: Award,
  level_up: TrendingUp,
  streak_milestone: Flame,
};

export function ActivityTab() {
  const { data: activities, isLoading } = usePublicActivity();

  if (isLoading) return <div className="py-8 text-center text-sm text-muted-foreground">Loading...</div>;

  if (!activities?.length) return <div className="py-8 text-center text-sm text-muted-foreground">No activity yet.</div>;

  return (
    <div className="space-y-2">
      {activities.map((a: any) => {
        const Icon = ICON_MAP[a.type] ?? Award;
        return (
          <div key={a.id} className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm">
                <span className="font-semibold">{a.freelancerName}</span>{' '}
                <span className="text-muted-foreground">{a.title}</span>
              </p>
              {a.description && <p className="text-xs text-muted-foreground">{a.description}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/community/leaderboard-tab.tsx src/components/community/showcase-tab.tsx src/components/community/activity-tab.tsx
git commit -m "feat: add leaderboard, showcase, and activity tabs"
```

---

## Task 8: Community Page Rewrite

**Files:**
- Modify: `src/app/community/page.tsx`

- [ ] **Step 1: Rewrite community page with tabbed layout**

Replace the entire file. The new page has 4 tabs: Leaderboard (default), Forums, Showcase, Activity. Light content area (`bg-white text-gray-900`) for readability. Header stays dark. Uses existing SiteLogo + HeaderNavigationClient.

When a post is selected from Forums or Showcase, it shows PostDetail instead of the tab content. Back button returns to the tab.

```typescript
// src/app/community/page.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { SiteLogo } from '@/components/site-logo';
import { HeaderNavigationClient } from '@/components/header-navigation-client';
import { LeaderboardTab } from '@/components/community/leaderboard-tab';
import { ForumsTab } from '@/components/community/forums-tab';
import { ShowcaseTab } from '@/components/community/showcase-tab';
import { ActivityTab } from '@/components/community/activity-tab';
import { PostDetail } from '@/components/community/post-detail';

type Tab = 'leaderboard' | 'forums' | 'showcase' | 'activity';

const TABS: { value: Tab; label: string }[] = [
  { value: 'leaderboard', label: 'Leaderboard' },
  { value: 'forums', label: 'Forums' },
  { value: 'showcase', label: 'Showcase' },
  { value: 'activity', label: 'Activity' },
];

export default function CommunityPage() {
  const [tab, setTab] = useState<Tab>('leaderboard');
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  const handleSelectPost = (postId: string) => setSelectedPostId(postId);
  const handleBack = () => setSelectedPostId(null);

  return (
    <div className="dark flex min-h-screen flex-col bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
          <Link href="/">
            <SiteLogo variant="dark" className="h-9 w-auto" />
          </Link>
          <HeaderNavigationClient />
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 bg-white text-gray-900">
        <div className="container mx-auto px-4 md:px-6 py-8">
          <h1 className="text-3xl font-bold mb-6">Community</h1>

          {/* Tabs */}
          {!selectedPostId && (
            <div className="flex gap-1 mb-6 border-b border-gray-200">
              {TABS.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setTab(t.value)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    tab === t.value
                      ? 'border-primary text-primary'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}

          {/* Tab content or post detail */}
          {selectedPostId ? (
            <PostDetail postId={selectedPostId} onBack={handleBack} />
          ) : (
            <>
              {tab === 'leaderboard' && <LeaderboardTab />}
              {tab === 'forums' && <ForumsTab onSelectPost={handleSelectPost} />}
              {tab === 'showcase' && <ShowcaseTab onSelectPost={handleSelectPost} />}
              {tab === 'activity' && <ActivityTab />}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/community/page.tsx
git commit -m "feat: rewrite community page with 4-tab layout"
```

---

## Task 9: Rewrite getTopFreelancers + Build Verification

**Files:**
- Modify: `src/services/firestore.ts`

- [ ] **Step 1: Replace getTopFreelancers with real Firestore query**

Find the existing `getTopFreelancers` function and replace with:

```typescript
export async function getTopFreelancers(count: number = 10): Promise<Freelancer[]> {
  const q = query(
    collection(firestoreDB, 'freelancers'),
    orderBy('xp', 'desc'),
    limit(count),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Freelancer));
}
```

Remove the import of `dummyFreelancers` if it's only used by this function.

- [ ] **Step 2: Verify Cloud Functions compile**

```bash
cd functions && npx tsc --noEmit && cd ..
```

- [ ] **Step 3: Verify Next.js build**

```bash
npx next build --no-lint 2>&1 | tail -10
```

- [ ] **Step 4: Commit and push**

```bash
git add src/services/firestore.ts
git commit -m "feat: rewrite getTopFreelancers with real Firestore query"
git push origin feat/client-systems-hub
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Community types + Firestore service | 2 new |
| 2 | Community Cloud Functions (post + vote triggers) | 3 new, 2 modified |
| 3 | React Query hooks | 1 new |
| 4 | UserCard + UpvoteButton | 2 new |
| 5 | Forums tab + Post compose | 2 new |
| 6 | Post detail with replies | 1 new |
| 7 | Leaderboard, Showcase, Activity tabs | 3 new |
| 8 | Community page rewrite | 1 modified |
| 9 | getTopFreelancers rewrite + build verification | 1 modified |

**Total: 14 new files, 5 modified files, 9 tasks.**
