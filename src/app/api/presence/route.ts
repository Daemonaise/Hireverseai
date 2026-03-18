import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/api-auth';
import { scoreAuthenticity } from '@/lib/presence';
import { updatePresence } from '@/services/presence';
import type { ActivitySignals } from '@/lib/presence';

export async function POST(req: NextRequest) {
  try {
    const uid = await verifyAuthToken(req);
    if (!uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { freelancerId, signals } = await req.json();

    if (!freelancerId || uid !== freelancerId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!signals) {
      return NextResponse.json({ error: 'Missing activity signals' }, { status: 400 });
    }

    // Score the activity
    const result = scoreAuthenticity(signals as ActivitySignals);

    // Update Firestore presence
    await updatePresence(
      freelancerId,
      result.status,
      result.score,
      result.flags
    );

    return NextResponse.json({
      status: result.status,
      score: result.score,
    });
  } catch {
    return NextResponse.json({ error: 'Presence update failed' }, { status: 500 });
  }
}
