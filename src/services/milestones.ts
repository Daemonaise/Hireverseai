import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Milestone, MilestoneStatus } from '@/types/project';

function milestonesCol(projectId: string) {
  return collection(db, 'projects', projectId, 'milestones');
}

export async function createMilestone(
  projectId: string,
  milestone: Omit<Milestone, 'startedAt' | 'completedAt'>
): Promise<string> {
  const docRef = await addDoc(milestonesCol(projectId), {
    ...milestone,
    startedAt: null,
    completedAt: null,
  });
  return docRef.id;
}

export async function getMilestone(
  projectId: string,
  milestoneId: string
): Promise<Milestone | null> {
  const snap = await getDoc(doc(milestonesCol(projectId), milestoneId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Milestone;
}

export async function listMilestones(projectId: string): Promise<Milestone[]> {
  const q = query(milestonesCol(projectId), orderBy('order', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Milestone);
}

export async function updateMilestoneStatus(
  projectId: string,
  milestoneId: string,
  status: MilestoneStatus,
  extra?: { qaScore?: number; qaFeedback?: string }
): Promise<void> {
  const updates: Record<string, unknown> = { status };
  if (status === 'in_progress') updates.startedAt = serverTimestamp();
  if (status === 'approved' || status === 'failed_qa') updates.completedAt = serverTimestamp();
  if (extra?.qaScore !== undefined) updates.qaScore = extra.qaScore;
  if (extra?.qaFeedback) updates.qaFeedback = extra.qaFeedback;
  await updateDoc(doc(milestonesCol(projectId), milestoneId), updates);
}
