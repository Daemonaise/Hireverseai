// src/services/hub/bookmarks.ts
import {
  collection,
  doc,
  addDoc,
  getDocs,
  deleteDoc,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Bookmark, CreateBookmarkInput } from '@/types/hub';

function bookmarksCol(freelancerId: string, workspaceId: string) {
  return collection(
    db, 'freelancers', freelancerId, 'workspaces', workspaceId, 'bookmarks'
  );
}

export async function addBookmark(
  freelancerId: string,
  workspaceId: string,
  input: CreateBookmarkInput
): Promise<string> {
  const ref = await addDoc(bookmarksCol(freelancerId, workspaceId), {
    ...input,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function listBookmarks(
  freelancerId: string,
  workspaceId: string
): Promise<Bookmark[]> {
  const q = query(bookmarksCol(freelancerId, workspaceId), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Bookmark));
}

export async function deleteBookmark(
  freelancerId: string,
  workspaceId: string,
  bookmarkId: string
): Promise<void> {
  await deleteDoc(doc(bookmarksCol(freelancerId, workspaceId), bookmarkId));
}
