/**
 * Freelancer presence service — tracks online status and authenticity.
 */

import {
  doc,
  getDoc,
  setDoc,
  getDocs,
  query,
  where,
  orderBy,
  collection,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { PresenceStatus } from '@/lib/presence';

export interface PresenceRecord {
  freelancerId: string;
  status: PresenceStatus;
  authenticityScore: number;
  flags: string[];
  suspiciousCount: number;     // Rolling count of suspicious windows
  lastActiveAt: unknown;       // Firestore Timestamp
  updatedAt: unknown;
}

const presenceRef = collection(db, 'freelancerPresence');

/**
 * Update a freelancer's presence status.
 */
export async function updatePresence(
  freelancerId: string,
  status: PresenceStatus,
  authenticityScore: number,
  flags: string[]
): Promise<void> {
  const docRef = doc(presenceRef, freelancerId);
  const existing = await getDoc(docRef);

  let suspiciousCount = 0;
  if (existing.exists()) {
    suspiciousCount = existing.data().suspiciousCount ?? 0;
  }

  // Increment suspicious count if flagged, decay if clean
  if (status === 'suspicious') {
    suspiciousCount = Math.min(suspiciousCount + 1, 100);
  } else if (status === 'active') {
    suspiciousCount = Math.max(suspiciousCount - 1, 0); // Slow decay
  }

  await setDoc(docRef, {
    freelancerId,
    status,
    authenticityScore,
    flags,
    suspiciousCount,
    lastActiveAt: status === 'active' ? serverTimestamp() : existing?.data()?.lastActiveAt ?? null,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Get a freelancer's current presence.
 */
export async function getPresence(freelancerId: string): Promise<PresenceRecord | null> {
  const snap = await getDoc(doc(presenceRef, freelancerId));
  if (!snap.exists()) return null;
  return snap.data() as PresenceRecord;
}

/**
 * List online freelancers (active status, sorted by authenticity).
 * Used by the matching engine to prioritize online freelancers.
 */
export async function listOnlineFreelancers(): Promise<PresenceRecord[]> {
  const q = query(
    presenceRef,
    where('status', '==', 'active'),
    orderBy('authenticityScore', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as PresenceRecord);
}

/**
 * Check if a freelancer is genuinely online (active + not suspicious).
 */
export function isGenuinelyOnline(presence: PresenceRecord | null): boolean {
  if (!presence) return false;
  return presence.status === 'active' && presence.suspiciousCount < 5;
}
