import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Workspace, CreateWorkspaceInput, WorkspaceStatus } from '@/types/hub';

function workspacesCol(freelancerId: string) {
  return collection(db, 'freelancers', freelancerId, 'workspaces');
}

function workspaceDoc(freelancerId: string, workspaceId: string) {
  return doc(db, 'freelancers', freelancerId, 'workspaces', workspaceId);
}

export async function createWorkspace(
  freelancerId: string,
  input: CreateWorkspaceInput
): Promise<string> {
  const ref = await addDoc(workspacesCol(freelancerId), {
    ...input,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getWorkspace(
  freelancerId: string,
  workspaceId: string
): Promise<Workspace | null> {
  const snap = await getDoc(workspaceDoc(freelancerId, workspaceId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Workspace;
}

export async function listWorkspaces(
  freelancerId: string,
  status?: WorkspaceStatus
): Promise<Workspace[]> {
  const col = workspacesCol(freelancerId);
  const q = status
    ? query(col, where('status', '==', status), orderBy('updatedAt', 'desc'))
    : query(col, orderBy('updatedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Workspace));
}

export async function updateWorkspace(
  freelancerId: string,
  workspaceId: string,
  updates: Partial<Pick<Workspace, 'name' | 'clientName' | 'engagementType' | 'status'>>
): Promise<void> {
  await updateDoc(workspaceDoc(freelancerId, workspaceId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

export async function archiveWorkspace(
  freelancerId: string,
  workspaceId: string
): Promise<void> {
  await updateWorkspace(freelancerId, workspaceId, { status: 'archived' });
}

export async function updateLastVisitedAt(
  freelancerId: string,
  workspaceId: string
): Promise<void> {
  await updateDoc(workspaceDoc(freelancerId, workspaceId), {
    lastVisitedAt: serverTimestamp(),
  });
}
