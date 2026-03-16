// src/services/hub/notes.ts
import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Note, CreateNoteInput } from '@/types/hub';

function notesCol(freelancerId: string, workspaceId: string) {
  return collection(
    db, 'freelancers', freelancerId, 'workspaces', workspaceId, 'notes'
  );
}

export async function addNote(
  freelancerId: string,
  workspaceId: string,
  input: CreateNoteInput
): Promise<string> {
  const ref = await addDoc(notesCol(freelancerId, workspaceId), {
    ...input,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getNote(
  freelancerId: string,
  workspaceId: string,
  noteId: string
): Promise<Note | null> {
  const snap = await getDoc(doc(notesCol(freelancerId, workspaceId), noteId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Note;
}

export async function listNotes(
  freelancerId: string,
  workspaceId: string
): Promise<Note[]> {
  const q = query(notesCol(freelancerId, workspaceId), orderBy('updatedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Note));
}

export async function updateNote(
  freelancerId: string,
  workspaceId: string,
  noteId: string,
  updates: Partial<Pick<Note, 'title' | 'content'>>
): Promise<void> {
  await updateDoc(doc(notesCol(freelancerId, workspaceId), noteId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteNote(
  freelancerId: string,
  workspaceId: string,
  noteId: string
): Promise<void> {
  await deleteDoc(doc(notesCol(freelancerId, workspaceId), noteId));
}
