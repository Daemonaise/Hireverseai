import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { getProjectById } from '@/services/firestore'; // To verify project existence

// TODO: Add authentication to ensure only logged-in users can create intents

// Define the platform fee percentage
const PLATFORM_FEE_PERCENTAGE = 0.15; // 15%

export async function POST(request: Request) {
  try {
    // TODO: Get clientId from authenticated session/token
    const { projectId, baseCost, clientId } = await request.json(); // Expect projectId and baseCost

    if (!projectId || typeof baseCost !== 'number' || baseCost <= 0) {
      return NextResponse.json({ error: 'Project ID and a valid base cost are required.' }, { status: 400 });
    }
    if (!clientId) {
        return NextResponse.json({ error: 'Client ID is missing (authentication required).' }, { status: 401 });
    }

    // Optional: Verify project exists and belongs to the client
    const project = await getProjectById(projectId);
    if (!project || project.clientId !== clientId) {
        return NextResponse.json({ error: 'Project not found or access denied.' }, { status: 404 });
    }
    // Optionally check if project is already paid or in a state allowing payment

    // Calculate platform fee and total amount
    const platformFee = Math.round(baseCost * PLATFORM_FEE_PERCENTAGE * 100) / 100; // Calculate fee
    const totalAmount = Math.round((baseCost + platformFee) * 100); // Amount in cents

    // Create a PaymentIntent with the calculated amount
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalAmount,
      currency: 'usd',
      automatic_payment_methods: {
        enabled: true, // Allow Stripe to manage payment methods
      },
      metadata: {
        projectId: projectId,
        clientId: clientId,
        baseCost: baseCost.toString(),
        platformFee: platformFee.toString(),
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
