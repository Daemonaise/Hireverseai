import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/api-auth';
import { getAccountStatus } from '@/lib/stripe-connect';
import { getFreelancerById } from '@/services/firestore';

export async function GET(req: NextRequest) {
  try {
    const uid = await verifyAuthToken(req);
    if (!uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const freelancerId = req.nextUrl.searchParams.get('freelancerId');
    if (!freelancerId || uid !== freelancerId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const freelancer = await getFreelancerById(freelancerId);
    if (!freelancer?.stripeAccountId) {
      return NextResponse.json({
        hasAccount: false,
        onboardingComplete: false,
        payoutsEnabled: false,
      });
    }

    const status = await getAccountStatus(freelancer.stripeAccountId);

    return NextResponse.json({
      hasAccount: true,
      ...status,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch account status' }, { status: 500 });
  }
}
