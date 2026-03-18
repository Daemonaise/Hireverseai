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
