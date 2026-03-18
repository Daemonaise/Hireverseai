# Reputation System Implementation Plan (Plan 2 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the client review/rating system with review prompts after project completion, star ratings with category breakdowns, freelancer replies, rating aggregation via Cloud Functions, and review display on freelancer profiles.

**Architecture:** Client writes reviews to Firestore `reviews/{id}` collection. `onReviewCreated` Cloud Function (new trigger) aggregates ratings into `freelancerStats` and syncs to `freelancers` doc. Review prompts are written by the existing `onProjectCompleted` trigger. Client-side components for review form and display.

**Tech Stack:** Firebase Cloud Functions v2, Firestore, React 19, React Query, shadcn/ui, Lucide icons.

**Spec:** `docs/superpowers/specs/2026-03-18-gamification-community-design.md` (Sections 2, 4.6-4.7)

**Depends on:** Plan 1 (Gamification Engine) - uses processEvent, freelancerStats, notifications

---

## File Map

### New Files - Cloud Functions
| File | Responsibility |
|------|---------------|
| `functions/src/triggers/on-review-created.ts` | Firestore trigger for review creation |
| `functions/src/gamification/rules/review-rules.ts` | Review-based XP/badge rewards |

### New Files - Client
| File | Responsibility |
|------|---------------|
| `src/types/review.ts` | Review, ReviewPrompt types |
| `src/services/reviews.ts` | Firestore CRUD for reviews and review prompts |
| `src/hooks/use-reviews.ts` | React Query hooks for reviews |
| `src/components/reviews/review-form.tsx` | Star rating form with category breakdowns |
| `src/components/reviews/review-list.tsx` | Paginated review list for freelancer profile |
| `src/components/reviews/review-summary.tsx` | Overall rating + category breakdown bars |
| `src/components/reviews/star-rating.tsx` | Reusable clickable star rating input |

### Modified Files
| File | Change |
|------|--------|
| `functions/src/index.ts` | Add onReviewCreated export |
| `functions/src/gamification/engine.ts` | Add review-rules to rule imports |

---

## Task 1: Review Types + Service

**Files:**
- Create: `src/types/review.ts`
- Create: `src/services/reviews.ts`

- [ ] **Step 1: Create review types**

```typescript
// src/types/review.ts
export interface Review {
  id: string;
  projectId: string;
  freelancerId: string;
  clientId: string;
  clientName: string;
  projectTitle: string;
  rating: number;
  categories: {
    quality: number;
    communication: number;
    timeliness: number;
    expertise: number;
  };
  comment: string;
  freelancerReply?: string;
  freelancerRepliedAt?: any;
  isVerified: boolean;
  createdAt: any;
}

export interface ReviewPrompt {
  projectId: string;
  projectTitle: string;
  freelancerId: string;
  freelancerName: string;
  status: 'pending' | 'completed' | 'dismissed';
  createdAt: any;
}
```

- [ ] **Step 2: Create reviews service**

```typescript
// src/services/reviews.ts
import {
  collection,
  doc,
  addDoc,
  getDoc,
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
```

- [ ] **Step 3: Commit**

```bash
git add src/types/review.ts src/services/reviews.ts
git commit -m "feat: add review types and Firestore service"
```

---

## Task 2: Review Cloud Function + Rules

**Files:**
- Create: `functions/src/triggers/on-review-created.ts`
- Create: `functions/src/gamification/rules/review-rules.ts`
- Modify: `functions/src/index.ts`
- Modify: `functions/src/gamification/engine.ts`

- [ ] **Step 1: Create review rules**

```typescript
// functions/src/gamification/rules/review-rules.ts
import type { GamificationEvent, FreelancerStats, Reward } from '../types';

export function getReviewRules(event: GamificationEvent, stats: FreelancerStats): Reward[] {
  if (event.type !== 'review_received') return [];

  const rewards: Reward[] = [];
  const rating = event.metadata.rating ?? 0;

  // Base review XP: 10 + (rating * 10)
  const xp = 10 + rating * 10;
  rewards.push({ type: 'xp', xp, description: `Review received (${rating} stars)` });

  // 5-star bonus
  if (rating === 5) {
    rewards.push({ type: 'xp', xp: 50, description: '5-star review bonus' });
    // First five-star badge
    if (!stats.badges.includes('first-five-star')) {
      rewards.push({ type: 'badge', badgeId: 'first-five-star', description: 'First 5-star review' });
    }
  }

  return rewards;
}
```

- [ ] **Step 2: Create on-review-created trigger**

```typescript
// functions/src/triggers/on-review-created.ts
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { processEvent } from '../gamification/engine';
import { db } from '../utils/firestore';
import { FieldValue } from 'firebase-admin/firestore';

export const onReviewCreated = onDocumentCreated(
  'reviews/{reviewId}',
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    const freelancerId = data.freelancerId;
    if (!freelancerId) return;

    // 1. Process gamification event
    await processEvent({
      type: 'review_received',
      freelancerId,
      metadata: { rating: data.rating, reviewId: event.params.reviewId },
    });

    // 2. Update rating aggregation on freelancerStats
    const statsRef = db.collection('freelancerStats').doc(freelancerId);
    const statsSnap = await statsRef.get();
    const stats = statsSnap.data();

    const oldAvg = stats?.reviewAverage ?? 0;
    const oldCount = stats?.reviewCount ?? 0;
    const newCount = oldCount + 1;
    const newAvg = ((oldAvg * oldCount) + data.rating) / newCount;

    // Category averages
    const oldCats = stats?.categoryAverages ?? { quality: 0, communication: 0, timeliness: 0, expertise: 0 };
    const cats = data.categories ?? {};
    const newCats = {
      quality: ((oldCats.quality * oldCount) + (cats.quality ?? 0)) / newCount,
      communication: ((oldCats.communication * oldCount) + (cats.communication ?? 0)) / newCount,
      timeliness: ((oldCats.timeliness * oldCount) + (cats.timeliness ?? 0)) / newCount,
      expertise: ((oldCats.expertise * oldCount) + (cats.expertise ?? 0)) / newCount,
    };

    await statsRef.update({
      reviewAverage: Math.round(newAvg * 100) / 100,
      reviewCount: newCount,
      categoryAverages: newCats,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // 3. Sync rating to freelancers doc for leaderboard
    await db.collection('freelancers').doc(freelancerId).update({
      rating: Math.round(newAvg * 100) / 100,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
);
```

- [ ] **Step 3: Add review-rules import to engine.ts**

In `functions/src/gamification/engine.ts`, add the import:
```typescript
import { getReviewRules } from './rules/review-rules';
```

And add to the allRules array:
```typescript
...getReviewRules(event, stats),
```

- [ ] **Step 4: Add onReviewCreated export to index.ts**

In `functions/src/index.ts`, add:
```typescript
export { onReviewCreated } from './triggers/on-review-created';
```

- [ ] **Step 5: Commit**

```bash
git add functions/src/triggers/on-review-created.ts functions/src/gamification/rules/review-rules.ts functions/src/index.ts functions/src/gamification/engine.ts
git commit -m "feat: add review Cloud Function trigger with rating aggregation"
```

---

## Task 3: Star Rating Component

**Files:**
- Create: `src/components/reviews/star-rating.tsx`

- [ ] **Step 1: Create reusable star rating input**

```typescript
// src/components/reviews/star-rating.tsx
'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';

interface StarRatingProps {
  value: number;
  onChange?: (value: number) => void;
  readonly?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const sizes = { sm: 'h-3.5 w-3.5', md: 'h-5 w-5', lg: 'h-6 w-6' };

export function StarRating({ value, onChange, readonly = false, size = 'md' }: StarRatingProps) {
  const [hover, setHover] = useState(0);
  const sizeClass = sizes[size];

  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => onChange?.(star)}
          onMouseEnter={() => !readonly && setHover(star)}
          onMouseLeave={() => setHover(0)}
          className={`${readonly ? 'cursor-default' : 'cursor-pointer'} transition-colors`}
        >
          <Star
            className={`${sizeClass} ${
              star <= (hover || value)
                ? 'fill-primary text-primary'
                : 'fill-none text-muted-foreground/30'
            }`}
          />
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/reviews/star-rating.tsx
git commit -m "feat: add reusable star rating component"
```

---

## Task 4: Review Form Component

**Files:**
- Create: `src/components/reviews/review-form.tsx`

- [ ] **Step 1: Create the review form**

```typescript
// src/components/reviews/review-form.tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StarRating } from './star-rating';
import { submitReview, updateReviewPromptStatus } from '@/services/reviews';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import type { ReviewPrompt } from '@/types/review';

interface ReviewFormProps {
  prompt: ReviewPrompt;
  clientId: string;
  clientName: string;
  onComplete: () => void;
}

export function ReviewForm({ prompt, clientId, clientName, onComplete }: ReviewFormProps) {
  const [rating, setRating] = useState(0);
  const [categories, setCategories] = useState({ quality: 0, communication: 0, timeliness: 0, expertise: 0 });
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const updateCategory = (key: string, value: number) => {
    setCategories((prev) => ({ ...prev, [key]: value }));
  };

  const canSubmit = rating > 0 && comment.length >= 20 &&
    categories.quality > 0 && categories.communication > 0 &&
    categories.timeliness > 0 && categories.expertise > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    try {
      await submitReview({
        projectId: prompt.projectId,
        freelancerId: prompt.freelancerId,
        clientId,
        clientName,
        projectTitle: prompt.projectTitle,
        rating,
        categories,
        comment,
        isVerified: true,
      });
      await updateReviewPromptStatus(clientId, prompt.projectId, 'completed');
      toast({ title: 'Review submitted', description: 'Thank you for your feedback.' });
      onComplete();
    } catch {
      toast({ title: 'Error', description: 'Failed to submit review.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDismiss = async () => {
    await updateReviewPromptStatus(clientId, prompt.projectId, 'dismissed');
    onComplete();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Review: {prompt.projectTitle}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm font-medium mb-1 block">Overall Rating</label>
          <StarRating value={rating} onChange={setRating} size="lg" />
        </div>

        {(['quality', 'communication', 'timeliness', 'expertise'] as const).map((key) => (
          <div key={key} className="flex items-center justify-between">
            <label className="text-sm capitalize">{key}</label>
            <StarRating value={categories[key]} onChange={(v) => updateCategory(key, v)} size="sm" />
          </div>
        ))}

        <div>
          <label className="text-sm font-medium mb-1 block">Comment (min 20 chars)</label>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share your experience working with this freelancer..."
            className="min-h-[80px]"
          />
        </div>

        <div className="flex justify-between">
          <Button variant="ghost" size="sm" onClick={handleDismiss}>Skip</Button>
          <Button size="sm" onClick={handleSubmit} disabled={!canSubmit || isSubmitting}>
            {isSubmitting && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            Submit Review
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/reviews/review-form.tsx
git commit -m "feat: add client review form with category ratings"
```

---

## Task 5: Review Display Components

**Files:**
- Create: `src/components/reviews/review-summary.tsx`
- Create: `src/components/reviews/review-list.tsx`
- Create: `src/hooks/use-reviews.ts`

- [ ] **Step 1: Create React Query hook**

```typescript
// src/hooks/use-reviews.ts
'use client';

import { useQuery } from '@tanstack/react-query';
import { getFreelancerReviews, getPendingReviewPrompts } from '@/services/reviews';

export function useFreelancerReviews(freelancerId: string | undefined) {
  return useQuery({
    queryKey: ['reviews', freelancerId],
    queryFn: () => getFreelancerReviews(freelancerId!),
    enabled: !!freelancerId,
    staleTime: 60_000,
  });
}

export function usePendingReviewPrompts(clientId: string | undefined) {
  return useQuery({
    queryKey: ['reviewPrompts', clientId],
    queryFn: () => getPendingReviewPrompts(clientId!),
    enabled: !!clientId,
    staleTime: 30_000,
  });
}
```

- [ ] **Step 2: Create review summary**

```typescript
// src/components/reviews/review-summary.tsx
'use client';

import { StarRating } from './star-rating';

interface ReviewSummaryProps {
  average: number;
  count: number;
  categoryAverages: {
    quality: number;
    communication: number;
    timeliness: number;
    expertise: number;
  };
}

export function ReviewSummary({ average, count, categoryAverages }: ReviewSummaryProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-4xl font-bold">{average.toFixed(1)}</span>
        <div>
          <StarRating value={Math.round(average)} readonly size="md" />
          <p className="text-sm text-muted-foreground mt-0.5">{count} review{count !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <div className="space-y-2">
        {(['quality', 'communication', 'timeliness', 'expertise'] as const).map((key) => (
          <div key={key} className="flex items-center gap-3">
            <span className="text-xs w-24 capitalize text-muted-foreground">{key}</span>
            <div className="flex-1 h-2 rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${(categoryAverages[key] / 5) * 100}%` }}
              />
            </div>
            <span className="text-xs w-6 text-right">{categoryAverages[key].toFixed(1)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create review list**

```typescript
// src/components/reviews/review-list.tsx
'use client';

import { useState } from 'react';
import { StarRating } from './star-rating';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ShieldCheck } from 'lucide-react';
import { submitFreelancerReply } from '@/services/reviews';
import { useToast } from '@/hooks/use-toast';
import type { Review } from '@/types/review';

interface ReviewListProps {
  reviews: Review[];
  isFreelancerView?: boolean; // Show reply option
}

export function ReviewList({ reviews, isFreelancerView = false }: ReviewListProps) {
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const { toast } = useToast();

  const handleReply = async (reviewId: string) => {
    if (!replyText.trim()) return;
    try {
      await submitFreelancerReply(reviewId, replyText.trim());
      setReplyingTo(null);
      setReplyText('');
      toast({ title: 'Reply posted' });
    } catch {
      toast({ title: 'Error', description: 'Failed to post reply.', variant: 'destructive' });
    }
  };

  if (reviews.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">No reviews yet.</p>;
  }

  return (
    <div className="space-y-4">
      {reviews.map((review) => (
        <div key={review.id} className="rounded-lg border border-border p-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-sm font-semibold">{review.clientName}</p>
              <p className="text-xs text-muted-foreground">{review.projectTitle}</p>
            </div>
            <div className="flex items-center gap-2">
              {review.isVerified && (
                <ShieldCheck className="h-4 w-4 text-primary" title="Verified review" />
              )}
              <StarRating value={review.rating} readonly size="sm" />
            </div>
          </div>

          <p className="text-sm mb-3">{review.comment}</p>

          {review.freelancerReply && (
            <div className="ml-4 mt-2 rounded-lg bg-muted/50 p-3 border-l-2 border-primary">
              <p className="text-xs font-medium text-muted-foreground mb-1">Freelancer reply</p>
              <p className="text-sm">{review.freelancerReply}</p>
            </div>
          )}

          {isFreelancerView && !review.freelancerReply && (
            <>
              {replyingTo === review.id ? (
                <div className="mt-3 space-y-2">
                  <Textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Write your reply..."
                    className="min-h-[60px]"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleReply(review.id)}>Post Reply</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setReplyingTo(null); setReplyText(''); }}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <Button size="sm" variant="ghost" className="mt-2 text-xs" onClick={() => setReplyingTo(review.id)}>
                  Reply
                </Button>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/hooks/use-reviews.ts src/components/reviews/review-summary.tsx src/components/reviews/review-list.tsx
git commit -m "feat: add review display components with summary and reply support"
```

---

## Task 6: Build Verification

- [ ] **Step 1: Verify Cloud Functions compile**

```bash
cd functions && npx tsc --noEmit && cd ..
```

- [ ] **Step 2: Verify Next.js builds**

```bash
npx next build --no-lint 2>&1 | tail -10
```

- [ ] **Step 3: Commit fixes if needed, then push**

```bash
git push origin feat/client-systems-hub
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Review types + Firestore service | 2 new |
| 2 | Cloud Function trigger + review rules | 2 new, 2 modified |
| 3 | Star rating component | 1 new |
| 4 | Review form | 1 new |
| 5 | Review display (summary + list + hook) | 3 new |
| 6 | Build verification | N/A |

**Total: 9 new files, 2 modified files, 6 tasks.**
**Next:** Plan 3 (Community Hub)
