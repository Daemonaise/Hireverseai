import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { getProjectById } from '@/services/firestore';
import { verifyAuthToken } from '@/lib/api-auth';

export async function POST(req: NextRequest) {
  try {
    const uid = await verifyAuthToken(req);
    if (!uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId, totalCostToClient, clientId } = await req.json();

    if (!projectId || typeof totalCostToClient !== 'number' || totalCostToClient <= 0) {
      return NextResponse.json({ error: 'Project ID and a valid total cost are required.' }, { status: 400 });
    }

    if (!clientId || uid !== clientId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const project = await getProjectById(projectId);
    if (!project || project.clientId !== clientId) {
      return NextResponse.json({ error: 'Project not found or access denied.' }, { status: 404 });
    }

    const totalAmount = Math.round(totalCostToClient * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalAmount,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      metadata: {
        projectId,
        clientId,
        totalCostToClient: totalCostToClient.toString(),
      },
      description: `Payment for Project: ${project.name ?? projectId}`,
    });

    return NextResponse.json({ clientSecret: paymentIntent.client_secret });
  } catch (error: any) {
    return NextResponse.json({ error: `Internal Server Error: ${error.message}` }, { status: 500 });
  }
}
