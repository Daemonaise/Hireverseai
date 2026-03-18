import { NextRequest } from 'next/server';
import { adminAuth } from './firebase-admin';

export async function verifyAuthToken(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const idToken = authHeader.slice(7);
  if (!idToken) return null;

  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    return decoded.uid;
  } catch {
    return null;
  }
}
