import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { getClientById } from '@/services/firestore';
import { verifyAuthToken } from '@/lib/api-auth';

export async function POST(req: NextRequest) {
  try {
    const uid = await verifyAuthToken(req);
    if (!uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { clientId } = await req.json();

    if (!clientId) {
      return NextResponse.json({ error: 'Client ID is required.' }, { status: 400 });
    }

    if (uid !== clientId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const client = await getClientById(clientId);
    if (!client) {
      return NextResponse.json({ error: 'Client not found.' }, { status: 404 });
    }

    const priceId = process.env.STRIPE_PRICE_ID;
    if (!priceId) {
      throw new Error('Stripe Price ID is not configured.');
    }

    const origin = req.headers.get('origin') || 'http://localhost:9002';
    const successUrl = `${origin}/client/dashboard?subscription=success`;
    const cancelUrl = `${origin}/client/signup?subscription=cancelled`;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: clientId,
    });

    if (!session.url) {
      throw new Error('Could not create Stripe Checkout session URL.');
    }

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    return NextResponse.json({ error: `Internal Server Error: ${error.message}` }, { status: 500 });
  }
}
