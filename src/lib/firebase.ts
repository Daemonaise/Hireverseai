// src/lib/firebase.ts
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';

// The check for environment variables is removed.
// Ensure these variables are correctly set in your .env file and accessible during build/runtime.
// Next.js automatically handles loading .env files.

const cfg = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
  measurementId:     process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Defensive check to prevent initializing if config is missing (might happen in specific environments)
if (!cfg.apiKey || !cfg.projectId) {
    console.error("Firebase configuration is missing. Ensure NEXT_PUBLIC_FIREBASE_API_KEY and NEXT_PUBLIC_FIREBASE_PROJECT_ID are set.");
    // Avoid throwing error directly in module scope for client-side safety
    // throw new Error("Firebase configuration is incomplete.");
}


const app: FirebaseApp = !getApps().length
  ? initializeApp(cfg)
  : getApp();

export const db: Firestore = getFirestore(app);

