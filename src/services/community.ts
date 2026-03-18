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
