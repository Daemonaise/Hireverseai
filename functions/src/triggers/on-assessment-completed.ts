// functions/src/triggers/on-assessment-completed.ts
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { processEvent } from '../gamification/engine';

export const onAssessmentCompleted = onDocumentUpdated(
  'freelancers/{freelancerId}',
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;

    // Only trigger when assessmentResultId is set for the first time
    if (before.assessmentResultId || !after.assessmentResultId) return;

    // Read the assessment to get the score
    const assessmentSnap = await event.data?.after.ref.firestore
      .collection('assessments')
      .doc(after.assessmentResultId)
      .get();

    const finalScore = assessmentSnap?.data()?.finalScore ?? 50;

    await processEvent({
      type: 'assessment_completed',
      freelancerId: event.params.freelancerId,
      metadata: { finalScore },
    });
  }
);
