import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit as firestoreLimit,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { AIBriefing } from '@/types/hub';

function briefingsCol(freelancerId: string, workspaceId: string) {
  return collection(
    db, 'freelancers', freelancerId, 'workspaces', workspaceId, 'aiBriefings'
  );
}

export async function storeBriefing(
  freelancerId: string,
  workspaceId: string,
  briefing: Omit<AIBriefing, 'id'>
): Promise<string> {
  const ref = await addDoc(briefingsCol(freelancerId, workspaceId), briefing);
  return ref.id;
}

export async function getLatestBriefing(
  freelancerId: string,
  workspaceId: string
): Promise<AIBriefing | null> {
  const q = query(
    briefingsCol(freelancerId, workspaceId),
    orderBy('generatedAt', 'desc'),
    firestoreLimit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as AIBriefing;
}

export async function listBriefings(
  freelancerId: string,
  workspaceId: string,
  count: number = 10
): Promise<AIBriefing[]> {
  const q = query(
    briefingsCol(freelancerId, workspaceId),
    orderBy('generatedAt', 'desc'),
    firestoreLimit(count)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AIBriefing));
}
