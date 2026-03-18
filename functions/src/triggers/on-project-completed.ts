// functions/src/triggers/on-project-completed.ts
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { processEvent } from '../gamification/engine';
import { db } from '../utils/firestore';
import { FieldValue } from 'firebase-admin/firestore';

export const onProjectCompleted = onDocumentUpdated(
  'projects/{projectId}',
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;

    // Only trigger on status transition to 'completed'
    if (before.status === 'completed' || after.status !== 'completed') return;

    const freelancerId = after.assignedFreelancerId;
    if (!freelancerId) return;

    await processEvent({
      type: 'project_completed',
      freelancerId,
      metadata: { projectId: event.params.projectId },
    });

    // Write review prompt for client
    if (after.clientId) {
      await db
        .collection('reviewPrompts')
        .doc(after.clientId)
        .collection('items')
        .doc(event.params.projectId)
        .set({
          projectId: event.params.projectId,
          projectTitle: after.name ?? 'Untitled Project',
          freelancerId,
          freelancerName: '', // Will be filled by client-side read
          status: 'pending',
          createdAt: FieldValue.serverTimestamp(),
        });
    }
  }
);
