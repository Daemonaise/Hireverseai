import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/api-auth';
import { adminDb } from '@/lib/firebase-admin';
import { authenticator } from 'otplib';

export async function POST(req: NextRequest) {
  try {
    const uid = await verifyAuthToken(req);
    if (!uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { code, userType } = await req.json();
    if (!code || !userType) {
      return NextResponse.json({ error: 'Missing code or userType' }, { status: 400 });
    }

    const collectionName = userType === 'client' ? 'clients' : 'freelancers';
    const userDoc = await adminDb.collection(collectionName).doc(uid).get();

    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const secret = userDoc.data()?.mfaSecret;
    if (!secret) {
      return NextResponse.json({ error: 'MFA not configured' }, { status: 400 });
    }

    const isValid = authenticator.verify({ token: code, secret });

    return NextResponse.json({ valid: isValid });
  } catch {
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
