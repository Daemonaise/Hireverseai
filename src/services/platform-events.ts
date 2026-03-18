/**
 * Platform events collection — captures raw data for the cleaning pipeline.
 */

import {
  collection,
  doc,
  addDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type {
  PlatformEvent,
  PlatformEventType,
  PlatformEventStatus,
  DatastoreId,
} from '@/types/platform-events';

const eventsRef = collection(db, 'platformEvents');

/**
 * Emit a raw platform event for later processing by the cleaning pipeline.
 */
export async function emitPlatformEvent(
  type: PlatformEventType,
  targetDatastore: DatastoreId,
  rawData: Record<string, unknown>
): Promise<string> {
  const docRef = await addDoc(eventsRef, {
    type,
    rawData,
    targetDatastore,
    status: 'raw' as PlatformEventStatus,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

/**
 * List platform events by status, for batch processing.
 */
export async function listEventsByStatus(
  status: PlatformEventStatus,
  maxResults: number = 50
): Promise<PlatformEvent[]> {
  const q = query(
    eventsRef,
    where('status', '==', status),
    orderBy('createdAt', 'asc'),
    firestoreLimit(maxResults)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PlatformEvent);
}

/**
 * Update event status after processing.
 */
export async function updateEventStatus(
  eventId: string,
  status: PlatformEventStatus,
  extra?: {
    cleanedData?: Record<string, unknown>;
    qualityScore?: number;
    rejectionReason?: string;
  }
): Promise<void> {
  const updates: Record<string, unknown> = {
    status,
    processedAt: serverTimestamp(),
  };
  if (extra?.cleanedData) updates.cleanedData = extra.cleanedData;
  if (extra?.qualityScore !== undefined) updates.qualityScore = extra.qualityScore;
  if (extra?.rejectionReason) updates.rejectionReason = extra.rejectionReason;

  await updateDoc(doc(eventsRef, eventId), updates);
}

/**
 * Helper: emit an assessment completion event.
 */
export async function emitAssessmentComplete(
  freelancerId: string,
  data: Record<string, unknown>
): Promise<string> {
  return emitPlatformEvent('assessment_complete', 'freelancer-profiles', {
    freelancerId,
    ...data,
  });
}

/**
 * Helper: emit a project completion event.
 */
export async function emitProjectComplete(
  projectId: string,
  data: Record<string, unknown>
): Promise<string> {
  return emitPlatformEvent('project_complete', 'project-knowledge', {
    projectId,
    ...data,
  });
}

/**
 * Helper: emit a QA review event.
 */
export async function emitQAReview(
  milestoneId: string,
  data: Record<string, unknown>
): Promise<string> {
  return emitPlatformEvent('qa_review', 'qa-feedback', {
    milestoneId,
    ...data,
  });
}
