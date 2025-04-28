
// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Ensure all required environment variables are present
if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
  throw new Error("Missing Firebase API Key (NEXT_PUBLIC_FIREBASE_API_KEY)");
}
if (!process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN) {
  throw new Error("Missing Firebase Auth Domain (NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN)");
}
if (!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
  throw new Error("Missing Firebase Project ID (NEXT_PUBLIC_FIREBASE_PROJECT_ID)");
}
if (!process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET) {
  throw new Error("Missing Firebase Storage Bucket (NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET)");
}
if (!process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID) {
  throw new Error("Missing Firebase Messaging Sender ID (NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID)");
}
if (!process.env.NEXT_PUBLIC_FIREBASE_APP_ID) {
  throw new Error("Missing Firebase App ID (NEXT_PUBLIC_FIREBASE_APP_ID)");
}
// Add check for optional measurement ID if used, otherwise it can be omitted safely.
// if (!process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID) {
//   console.warn("Optional Firebase Measurement ID (NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID) is missing.");
// }


// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, // Ensure this is correctly set and not empty
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID, // Optional
};

// Initialize Firebase
let app;
if (!getApps().length) {
  try {
    app = initializeApp(firebaseConfig);
    console.log("Firebase initialized successfully.");
  } catch (e) {
    console.error("Firebase initialization error:", e);
    throw new Error("Failed to initialize Firebase. Check configuration and environment variables.");
  }
} else {
  app = getApp();
  console.log("Firebase app already initialized.");
}

let db;
try {
  db = getFirestore(app);
  console.log("Firestore instance obtained successfully.");
} catch(e) {
  console.error("Error getting Firestore instance:", e);
  throw new Error("Failed to get Firestore instance. Ensure Firestore is enabled for your Firebase project.");
}


export { app, db };
