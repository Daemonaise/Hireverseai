import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/api-auth';
import { createConnectAccount } from '@/lib/stripe-connect';
import { getFreelancerById, updateFreelancer } from '@/services/firestore';

export async function POST(req: NextRequest) {
  try {
    const uid = await verifyAuthToken(req);
    if (!uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { freelancerId } = await req.json();

    if (!freelancerId || uid !== freelancerId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const freelancer = await getFreelancerById(freelancerId);
    if (!freelancer) {
      return NextResponse.json({ error: 'Freelancer not found' }, { status: 404 });
    }

    // Don't create duplicate accounts
    if (freelancer.stripeAccountId) {
      return NextResponse.json({ accountId: freelancer.stripeAccountId });
    }

    const accountId = await createConnectAccount(freelancerId, freelancer.email);

    await updateFreelancer(freelancerId, {
      stripeAccountId: accountId,
      stripeOnboardingComplete: false,
      payoutsEnabled: false,
    });

    return NextResponse.json({ accountId });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
