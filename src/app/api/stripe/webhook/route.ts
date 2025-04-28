import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { updateClientSubscriptionStatus, updateProjectPaymentStatus } from '@/services/firestore'; // Assume these functions exist/are created

const relevantEvents = new Set([
  'checkout.session.completed',
  'customer.subscription.deleted',
  'customer.subscription.updated',
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
]);

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    console.error('Stripe webhook secret or signature missing.');
    return NextResponse.json({ error: 'Webhook secret not configured.' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: any) {
    console.error(`❌ Error message: ${err.message}`);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  if (relevantEvents.has(event.type)) {
    try {
      switch (event.type) {
        case 'checkout.session.completed':
          const checkoutSession = event.data.object as Stripe.Checkout.Session;
          console.log('Checkout Session Completed:', checkoutSession.id);
          if (checkoutSession.mode === 'subscription' && checkoutSession.client_reference_id) {
            // Handle successful subscription creation
            const clientId = checkoutSession.client_reference_id;
            const subscription = await stripe.subscriptions.retrieve(checkoutSession.subscription as string);
            await updateClientSubscriptionStatus(clientId, subscription.status, subscription.id);
            console.log(`Updated subscription status for client ${clientId} to ${subscription.status}`);
          }
          break;

        case 'customer.subscription.updated':
        case 'customer.subscription.deleted':
          const subscription = event.data.object as Stripe.Subscription;
          console.log(`Subscription ${event.type}:`, subscription.id);
          // Find client associated with this subscription (e.g., via Stripe Customer ID or metadata)
          // For demo, assume you can retrieve clientId from metadata or customer ID mapping
          const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
          // const clientId = await findClientByStripeCustomerId(customerId); // Implement this lookup
          // if (clientId) {
          //   await updateClientSubscriptionStatus(clientId, subscription.status, subscription.id);
          //   console.log(`Updated subscription status for client ${clientId} to ${subscription.status}`);
          // }
          break;

        case 'payment_intent.succeeded':
          const paymentIntentSucceeded = event.data.object as Stripe.PaymentIntent;
          console.log('PaymentIntent Succeeded:', paymentIntentSucceeded.id);
          const projectIdSucceeded = paymentIntentSucceeded.metadata.projectId;
          if (projectIdSucceeded) {
             // Update project status to indicate payment received, work can start
             await updateProjectPaymentStatus(projectIdSucceeded, 'paid'); // Implement this function
             console.log(`Project ${projectIdSucceeded} marked as paid.`);
          }
          break;

        case 'payment_intent.payment_failed':
          const paymentIntentFailed = event.data.object as Stripe.PaymentIntent;
          console.warn('PaymentIntent Failed:', paymentIntentFailed.id);
          const projectIdFailed = paymentIntentFailed.metadata.projectId;
          if (projectIdFailed) {
            // Update project status or notify client about payment failure
            await updateProjectPaymentStatus(projectIdFailed, 'payment_failed'); // Implement this function
            console.log(`Payment failed for project ${projectIdFailed}.`);
          }
          break;

        default:
          console.warn(`Unhandled relevant event type: ${event.type}`);
      }
    } catch (error) {
      console.error('Webhook handler error:', error);
      return NextResponse.json({ error: 'Webhook handler failed.' }, { status: 500 });
    }
  } else {
    console.log(`Ignoring irrelevant event type: ${event.type}`);
  }

  return NextResponse.json({ received: true });
}

// Example placeholder for Firestore update functions (implement these in firestore.ts)
// async function updateClientSubscriptionStatus(clientId: string, status: Stripe.Subscription.Status, subscriptionId: string): Promise<void> {
//   console.log(`Placeholder: Updating client ${clientId} subscription ${subscriptionId} status to ${status}`);
//   // Update client document in Firestore with subscription status and ID
// }
// async function updateProjectPaymentStatus(projectId: string, paymentStatus: 'paid' | 'payment_failed'): Promise<void> {
//   console.log(`Placeholder: Updating project ${projectId} payment status to ${paymentStatus}`);
//   // Update project document in Firestore (e.g., set a 'paymentStatus' field or update main 'status')
// }

