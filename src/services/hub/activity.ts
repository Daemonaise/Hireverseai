import {
  collection,
  doc,
  getDocs,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  writeBatch,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { NormalizedActivity, ProviderId, ActivitySourceType } from '@/types/hub';

function activityCol(freelancerId: string, workspaceId: string) {
  return collection(
    db, 'freelancers', freelancerId, 'workspaces', workspaceId, 'activityEvents'
  );
}

export async function storeActivityEvents(
  freelancerId: string,
  workspaceId: string,
  events: Omit<NormalizedActivity, 'id'>[]
): Promise<void> {
  const col = activityCol(freelancerId, workspaceId);
  // Firestore batches are limited to 500 operations
  const BATCH_SIZE = 499;
  for (let i = 0; i < events.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    const chunk = events.slice(i, i + BATCH_SIZE);
    for (const event of chunk) {
      // Use composite key for deduplication: re-syncing the same event overwrites rather than duplicates
      const docId = `${event.sourceProvider}-${event.sourceExternalId}`;
      const ref = doc(col, docId);
      batch.set(ref, { ...event, updatedAt: serverTimestamp() });
    }
    await batch.commit();
  }
}

export async function listActivityEvents(
  freelancerId: string,
  workspaceId: string,
  options?: {
    provider?: ProviderId;
    sourceType?: ActivitySourceType;
    since?: Date;
    limit?: number;
  }
): Promise<NormalizedActivity[]> {
  const col = activityCol(freelancerId, workspaceId);
  const constraints = [orderBy('createdAt', 'desc')];

  if (options?.provider) {
    constraints.unshift(where('sourceProvider', '==', options.provider));
  }
  if (options?.sourceType) {
    constraints.unshift(where('sourceType', '==', options.sourceType));
  }
  if (options?.since) {
    constraints.unshift(where('createdAt', '>=', Timestamp.fromDate(options.since)));
  }
  if (options?.limit) {
    constraints.push(firestoreLimit(options.limit));
  }

  const q = query(col, ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as NormalizedActivity));
}
