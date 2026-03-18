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
  limit as firestoreLimit,
  startAfter,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type {
  Thread,
  ThreadMessage,
  CreateThreadInput,
  PostMessageInput,
} from '@/types/hub';

const threadsRef = collection(db, 'workspaceThreads');

export async function createThread(input: CreateThreadInput): Promise<string> {
  const docRef = await addDoc(threadsRef, {
    ...input,
    participants: [
      { id: input.freelancerId, role: 'freelancer', locale: 'en' },
      { id: input.clientId, role: 'client', locale: 'en' },
    ],
    lastMessageAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    createdBy: input.freelancerId,
  });
  return docRef.id;
}

export async function getThread(threadId: string): Promise<Thread | null> {
  const snap = await getDoc(doc(threadsRef, threadId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Thread;
}

export async function listThreads(workspaceId: string): Promise<Thread[]> {
  const q = query(
    threadsRef,
    where('workspaceId', '==', workspaceId),
    orderBy('lastMessageAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Thread);
}

export async function listThreadsByClient(clientId: string): Promise<Thread[]> {
  const q = query(
    threadsRef,
    where('clientId', '==', clientId),
    orderBy('lastMessageAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Thread);
}

function messagesCol(threadId: string) {
  return collection(threadsRef, threadId, 'messages');
}

export async function postMessage(
  threadId: string,
  input: PostMessageInput
): Promise<string> {
  const col = messagesCol(threadId);
  const docRef = await addDoc(col, {
    authorId: input.authorId,
    authorRole: input.authorRole,
    originalText: input.text,
    originalLocale: input.locale,
    translations: {},
    createdAt: serverTimestamp(),
  });
  await updateDoc(doc(threadsRef, threadId), {
    lastMessageAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function listMessages(
  threadId: string,
  options?: { pageSize?: number; afterTimestamp?: Timestamp }
): Promise<ThreadMessage[]> {
  const col = messagesCol(threadId);
  const constraints: any[] = [orderBy('createdAt', 'asc')];
  if (options?.afterTimestamp) {
    constraints.push(startAfter(options.afterTimestamp));
  }
  constraints.push(firestoreLimit(options?.pageSize || 50));
  const q = query(col, ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ThreadMessage);
}

export async function addTranslation(
  threadId: string,
  messageId: string,
  locale: string,
  translatedText: string
): Promise<void> {
  const msgRef = doc(messagesCol(threadId), messageId);
  await updateDoc(msgRef, {
    [`translations.${locale}`]: translatedText,
  });
}

export async function updateParticipantLocale(
  threadId: string,
  participantId: string,
  locale: string
): Promise<void> {
  const thread = await getThread(threadId);
  if (!thread) return;
  const updatedParticipants = thread.participants.map((p) =>
    p.id === participantId ? { ...p, locale } : p
  );
  await updateDoc(doc(threadsRef, threadId), {
    participants: updatedParticipants,
  });
}
