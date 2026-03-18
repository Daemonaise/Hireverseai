import {
  collection,
  doc,
  addDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Review, ReviewPrompt } from '@/types/review';

const reviewsRef = collection(db, 'reviews');

export async function submitReview(
  review: Omit<Review, 'id' | 'createdAt' | 'freelancerReply' | 'freelancerRepliedAt'>
): Promise<string> {
  const docRef = await addDoc(reviewsRef, {
    ...review,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function getFreelancerReviews(
  freelancerId: string,
  pageSize: number = 10,
  lastDoc?: any,
): Promise<Review[]> {
  let q = query(
    reviewsRef,
    where('freelancerId', '==', freelancerId),
    orderBy('createdAt', 'desc'),
    limit(pageSize),
  );
  if (lastDoc) {
    q = query(q, startAfter(lastDoc));
  }
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Review));
}

export async function submitFreelancerReply(reviewId: string, reply: string): Promise<void> {
  await updateDoc(doc(reviewsRef, reviewId), {
    freelancerReply: reply,
    freelancerRepliedAt: serverTimestamp(),
  });
}

// Review prompts
export async function getPendingReviewPrompts(clientId: string): Promise<ReviewPrompt[]> {
  const q = query(
    collection(db, 'reviewPrompts', clientId, 'items'),
    where('status', '==', 'pending'),
    orderBy('createdAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ ...d.data() } as ReviewPrompt));
}

export async function updateReviewPromptStatus(
  clientId: string,
  projectId: string,
  status: 'completed' | 'dismissed',
): Promise<void> {
  await updateDoc(doc(db, 'reviewPrompts', clientId, 'items', projectId), { status });
}
