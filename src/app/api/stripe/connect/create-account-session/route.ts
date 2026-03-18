import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/api-auth';
import { createAccountSession } from '@/lib/stripe-connect';
import { getFreelancerById } from '@/services/firestore';

export async function POST(req: NextRequest) {
  try {
    const uid = await verifyAuthToken(req);
    if (!uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { freelancerId, components } = await req.json();

    if (!freelancerId || uid !== freelancerId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const freelancer = await getFreelancerById(freelancerId);
    if (!freelancer?.stripeAccountId) {
      return NextResponse.json({ error: 'No Stripe account found. Complete onboarding first.' }, { status: 400 });
    }

    const validComponents = components ?? ['account_onboarding'];
    const clientSecret = await createAccountSession(freelancer.stripeAccountId, validComponents);

    return NextResponse.json({ clientSecret });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
