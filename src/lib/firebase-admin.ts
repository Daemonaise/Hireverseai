import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

let app: App;

if (!getApps().length) {
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (credPath) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const serviceAccount = require(
      credPath.startsWith('/') ? credPath : `${process.cwd()}/${credPath}`
    );
    app = initializeApp({ credential: cert(serviceAccount) });
  } else {
    // Falls back to Application Default Credentials (works in Cloud Functions, Cloud Run, etc.)
    app = initializeApp();
  }
} else {
  app = getApps()[0];
}

export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app);
