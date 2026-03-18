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

    // Allowlist: only permit these embedded components
    const ALLOWED_COMPONENTS = ['account_onboarding', 'account_management'];
    const requested = components ?? ['account_onboarding'];
    const validComponents = (Array.isArray(requested) ? requested : [requested])
      .filter((c: string) => ALLOWED_COMPONENTS.includes(c));

    if (validComponents.length === 0) {
      return NextResponse.json({ error: 'Invalid components requested' }, { status: 400 });
    }

    const clientSecret = await createAccountSession(freelancer.stripeAccountId, validComponents);

    return NextResponse.json({ clientSecret });
  } catch {
    return NextResponse.json({ error: 'Session creation failed' }, { status: 500 });
  }
}
