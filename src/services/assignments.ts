import {
  collection,
  doc,
  addDoc,
  getDocs,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { FreelancerAssignment } from '@/types/project';

function assignmentsCol(projectId: string) {
  return collection(db, 'projects', projectId, 'assignments');
}

export async function storeAssignments(
  projectId: string,
  assignments: FreelancerAssignment[]
): Promise<void> {
  const batch = writeBatch(db);
  for (const assignment of assignments) {
    const ref = doc(assignmentsCol(projectId));
    batch.set(ref, assignment);
  }
  await batch.commit();
}

export async function getAssignmentsForProject(
  projectId: string
): Promise<FreelancerAssignment[]> {
  const snap = await getDocs(assignmentsCol(projectId));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as FreelancerAssignment);
}

export async function getAssignmentsForMilestone(
  projectId: string,
  milestoneId: string
): Promise<FreelancerAssignment[]> {
  const q = query(assignmentsCol(projectId), where('milestoneId', '==', milestoneId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as FreelancerAssignment);
}

export async function getAssignmentsForFreelancer(
  projectId: string,
  freelancerId: string
): Promise<FreelancerAssignment[]> {
  const q = query(assignmentsCol(projectId), where('freelancerId', '==', freelancerId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as FreelancerAssignment);
}
