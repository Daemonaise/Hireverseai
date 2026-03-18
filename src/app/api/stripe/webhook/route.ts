import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
// Correctly import the handler functions from firestore service
import { handleClientSubscriptionUpdate, handleProjectPaymentUpdate } from '@/services/firestore';

// Define the relevant events to handle
const relevantEvents = new Set([
  'checkout.session.completed',
  'customer.subscription.deleted',
  'customer.subscription.updated',
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
]);

export async function POST(req: NextRequest) {
  let body: string;
  try {
     body = await req.text();
  } catch (error) {
     return NextResponse.json({ error: 'Could not read request body.' }, { status: 400 });
  }

  const sig = req.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig) {
    return NextResponse.json({ error: 'Missing Stripe signature.' }, { status: 400 });
  }
  if (!webhookSecret) {
    return NextResponse.json({ error: 'Webhook secret not configured.' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    // Verify the webhook signature and construct the event
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  // Handle only relevant event types
  if (relevantEvents.has(event.type)) {
    try {
      switch (event.type) {
        // --- Subscription Events ---
        case 'checkout.session.completed':
          const checkoutSession = event.data.object as Stripe.Checkout.Session;
          if (checkoutSession.mode === 'subscription' && checkoutSession.client_reference_id && checkoutSession.subscription) {
            // Retrieve the full subscription object to get the status
            const subscription = await stripe.subscriptions.retrieve(checkoutSession.subscription as string);
            await handleClientSubscriptionUpdate(
              checkoutSession.client_reference_id,
              subscription.status,
              subscription.id
            );
          } else if (checkoutSession.mode === 'payment') {
             // PaymentIntent details are usually included or can be retrieved
             const paymentIntentId = checkoutSession.payment_intent as string;
             if (paymentIntentId) {
                const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
                 const projectId = paymentIntent.metadata.projectId;
                 const clientId = paymentIntent.metadata.clientId; // Client ID if needed
                 if (projectId) {
                    // PaymentIntent succeeded via Checkout
                    await handleProjectPaymentUpdate(projectId, 'paid');
                 } else {
                 }
             }
          }
          break;

        case 'customer.subscription.updated':
        case 'customer.subscription.deleted':
          const subscription = event.data.object as Stripe.Subscription;
          // Find client associated with this subscription
          // This relies on having stored the Stripe Customer ID linked to your client ID
          // or using metadata on the subscription/customer object.
          const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
          // const clientId = await findClientByStripeCustomerId(customerId); // Implement this lookup
          // Example: Assuming clientId is stored in subscription metadata
          const clientIdFromMetadata = subscription.metadata.clientId;
          if (clientIdFromMetadata) {
             await handleClientSubscriptionUpdate(
               clientIdFromMetadata,
               subscription.status,
               subscription.id
             );
          } else {
             // Maybe try looking up client by Stripe Customer ID here as a fallback
          }
          break;

        // --- Payment Intent Events ---
        case 'payment_intent.succeeded':
          const paymentIntentSucceeded = event.data.object as Stripe.PaymentIntent;
          const projectIdSucceeded = paymentIntentSucceeded.metadata.projectId;
          if (projectIdSucceeded) {
             // Update project status to indicate payment received
             await handleProjectPaymentUpdate(projectIdSucceeded, 'paid');
          } else {
          }
          break;

        case 'payment_intent.payment_failed':
          const paymentIntentFailed = event.data.object as Stripe.PaymentIntent;
          const projectIdFailed = paymentIntentFailed.metadata.projectId;
          if (projectIdFailed) {
            // Update project status or notify client about payment failure
            await handleProjectPaymentUpdate(projectIdFailed, 'payment_failed');
             // TODO: Potentially notify the client about the failure
          } else {
          }
          break;

        default:
      }
    } catch (error) {
      // Return 500 to indicate failure, Stripe will retry
      return NextResponse.json({ error: 'Webhook handler failed.' }, { status: 500 });
    }
  } else {
  }

  // Acknowledge receipt of the event
  return NextResponse.json({ received: true });
}

// Example placeholder: You'd need a way to map Stripe Customer ID back to your internal client ID
// async function findClientByStripeCustomerId(stripeCustomerId: string): Promise<string | null> {
//   // Query your database (e.g., Firestore 'clients' collection) for a document
//   // where a field like 'stripeCustomerId' matches the provided ID.
//   console.log(`Placeholder: Looking up client by Stripe Customer ID ${stripeCustomerId}`);
//   return null; // Replace with actual implementation
// }
