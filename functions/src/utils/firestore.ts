// functions/src/utils/firestore.ts
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const app = initializeApp();
export const db = getFirestore(app);
