import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { getClientById } from '@/services/firestore'; // To get client email if needed

// TODO: Add authentication to ensure only logged-in users can create sessions

export async function POST(request: Request) {
  try {
    // TODO: Replace with actual authenticated user ID from session/token
    const { clientId } = await request.json(); // Expect clientId in request body

    if (!clientId) {
      return NextResponse.json({ error: 'Client ID is required.' }, { status: 400 });
    }

    // Optionally fetch client details if needed (e.g., email for Stripe customer)
    const client = await getClientById(clientId);
    if (!client) {
      return NextResponse.json({ error: 'Client not found.' }, { status: 404 });
    }

    const priceId = process.env.STRIPE_PRICE_ID;
    if (!priceId) {
      throw new Error('Stripe Price ID is not configured.');
    }

    // Determine success and cancel URLs
    const origin = request.headers.get('origin') || 'http://localhost:9002'; // Fallback for local dev
    const successUrl = `${origin}/client/dashboard?subscription=success`; // Redirect back to dashboard on success
    const cancelUrl = `${origin}/client/signup?subscription=cancelled`; // Redirect back to signup/pricing on cancel

    // Create a Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      // Associate the session with the client for webhooks
      client_reference_id: clientId,
      // Optionally prefill email or manage Stripe Customer objects
      // customer_email: client.email,
      // metadata: { clientId: clientId }, // Can also use metadata
    });

    if (!session.url) {
         throw new Error('Could not create Stripe Checkout session URL.');
    }

    // Return the session URL for redirection
    return NextResponse.json({ url: session.url });

  } catch (error: any) {
    console.error('Error creating Stripe subscription session:', error);
    return NextResponse.json({ error: `Internal Server Error: ${error.message}` }, { status: 500 });
  }
}
