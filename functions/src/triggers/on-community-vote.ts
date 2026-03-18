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
