import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { getProjectById } from '@/services/firestore'; // To verify project existence

// TODO: Add authentication to ensure only logged-in users can create intents

export async function POST(request: Request) {
  try {
    // totalCostToClient is the final amount already calculated by matchFreelancer
    // (includes freelancer base cost, platform fee, rating premium, complexity surcharge, and tax).
    // Do NOT apply any additional fee here.
    const { projectId, totalCostToClient, clientId } = await request.json();

    if (!projectId || typeof totalCostToClient !== 'number' || totalCostToClient <= 0) {
      return NextResponse.json({ error: 'Project ID and a valid total cost are required.' }, { status: 400 });
    }
    if (!clientId) {
        return NextResponse.json({ error: 'Client ID is missing (authentication required).' }, { status: 401 });
    }

    const project = await getProjectById(projectId);
    if (!project || project.clientId !== clientId) {
        return NextResponse.json({ error: 'Project not found or access denied.' }, { status: 404 });
    }

    const totalAmount = Math.round(totalCostToClient * 100); // Convert dollars to cents

    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalAmount,
      currency: 'usd',
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        projectId: projectId,
        clientId: clientId,
        totalCostToClient: totalCostToClient.toString(),
      },
      // Optionally link to a Stripe Customer object if you manage them
      // customer: stripeCustomerId,
      description: `Payment for Project: ${project.name ?? projectId}`,
    });

    // Return the client secret to the frontend
    return NextResponse.json({ clientSecret: paymentIntent.client_secret });

  } catch (error: any) {
    console.error('Error creating Stripe Payment Intent:', error);
    return NextResponse.json({ error: `Internal Server Error: ${error.message}` }, { status: 500 });
  }
}
