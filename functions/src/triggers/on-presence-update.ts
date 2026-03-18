// functions/src/triggers/on-presence-update.ts
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { processEvent } from '../gamification/engine';
import { db } from '../utils/firestore';

export const onPresenceUpdate = onDocumentUpdated(
  'freelancerPresence/{freelancerId}',
  async (event) => {
    const after = event.data?.after.data();
    if (!after || after.status !== 'active') return;

    const freelancerId = event.params.freelancerId;

    // Early guard: check if already processed today
    const today = new Date().toISOString().split('T')[0];
    const statsSnap = await db.collection('freelancerStats').doc(freelancerId).get();
    if (statsSnap.exists && statsSnap.data()?.lastActiveDate === today) return;

    await processEvent({
      type: 'presence_update',
      freelancerId,
      metadata: {},
    });
  }
);
