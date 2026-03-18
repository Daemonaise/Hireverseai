// functions/src/triggers/on-task-approved.ts
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { processEvent } from '../gamification/engine';

export const onTaskApproved = onDocumentUpdated(
  'projects/{projectId}/microtasks/{taskId}',
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;

    // Only trigger on status transition to 'approved'
    if (before.status === 'approved' || after.status !== 'approved') return;

    const freelancerId = after.assignedFreelancerId;
    if (!freelancerId) return;

    // Determine on-time and revision status
    const isOnTime = after.estimatedDeliveryDate
      ? (after.completedAt?.toDate?.() ?? new Date()) <= after.estimatedDeliveryDate.toDate()
      : false;

    await processEvent({
      type: 'task_approved',
      freelancerId,
      metadata: {
        taskId: event.params.taskId,
        projectId: event.params.projectId,
        qaScore: after.qaScore ?? null,
        isOnTime,
        hasRevisions: (after.revisionCount ?? 0) > 0,
      },
    });
  }
);
