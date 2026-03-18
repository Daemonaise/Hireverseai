import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

export type ProjectEventType =
  | 'project_created'
  | 'decomposition_complete'
  | 'freelancer_matched'
  | 'task_started'
  | 'task_submitted'
  | 'qa_milestone_reviewed'
  | 'task_revised'
  | 'milestone_completed'
  | 'project_completed'
  | 'change_requested';

export interface ProjectEvent {
  id?: string;
  projectId: string;
  type: ProjectEventType;
  data: Record<string, unknown>;
  createdAt?: unknown; // serverTimestamp
}

function eventsCol(projectId: string) {
  return collection(db, 'projects', projectId, 'events');
}

/**
 * Record a project event for analytics.
 */
export async function recordProjectEvent(
  projectId: string,
  type: ProjectEventType,
  data: Record<string, unknown>
): Promise<void> {
  await addDoc(eventsCol(projectId), {
    projectId,
    type,
    data,
    createdAt: serverTimestamp(),
  });
}

/**
 * Get all events for a project, ordered by time.
 */
export async function getProjectEvents(projectId: string): Promise<ProjectEvent[]> {
  const q = query(eventsCol(projectId), orderBy('createdAt', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ProjectEvent);
}

/**
 * Get events of a specific type for a project.
 */
export async function getProjectEventsByType(
  projectId: string,
  type: ProjectEventType
): Promise<ProjectEvent[]> {
  const q = query(
    eventsCol(projectId),
    where('type', '==', type),
    orderBy('createdAt', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ProjectEvent);
}
