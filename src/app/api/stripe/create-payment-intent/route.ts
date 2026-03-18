import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { getProjectById } from '@/services/firestore';
import { verifyAuthToken } from '@/lib/api-auth';
import { calculateFees, toCents } from '@/lib/stripe-fees';

export async function POST(req: NextRequest) {
  try {
    const uid = await verifyAuthToken(req);
    if (!uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId, freelancerCost, clientId } = await req.json();

    if (!projectId || typeof freelancerCost !== 'number' || freelancerCost <= 0) {
      return NextResponse.json({ error: 'Project ID and a valid freelancer cost are required.' }, { status: 400 });
    }

    if (!clientId || uid !== clientId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const project = await getProjectById(projectId);
    if (!project || project.clientId !== clientId) {
      return NextResponse.json({ error: 'Project not found or access denied.' }, { status: 404 });
    }

    // Calculate fees: freelancer cost + 15% platform fee + stripe processing + tax
    const fees = calculateFees(freelancerCost);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: toCents(fees.clientTotal),
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      // Platform keeps platformCut + stripeFee (client sees as one "Platform Fee")
      application_fee_amount: toCents(fees.platformFeeDisplay),
      transfer_group: `project_${projectId}`,
      metadata: {
        projectId,
        clientId,
        freelancerCost: freelancerCost.toString(),
        platformFee: fees.platformFeeDisplay.toString(),
      },
      description: `Payment for Project: ${project.name ?? projectId}`,
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      fees,
    });
  } catch (error: any) {
    return NextResponse.json({ error: `Internal Server Error: ${error.message}` }, { status: 500 });
  }
}
