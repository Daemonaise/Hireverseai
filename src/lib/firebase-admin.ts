import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

function getApp(): App {
  if (getApps().length) return getApps()[0];

  // Option 1: Service account JSON passed as env var (for deployed environments)
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (serviceAccountJson) {
    try {
      const serviceAccount = JSON.parse(serviceAccountJson);
      return initializeApp({ credential: cert(serviceAccount) });
    } catch {
      // Fall through to default credentials
    }
  }

  // Option 2: Application Default Credentials (Firebase Studio, Cloud Run, Cloud Functions)
  return initializeApp();
}

const app = getApp();

export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app);
