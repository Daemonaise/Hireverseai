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
