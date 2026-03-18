/**
 * Stripe Connect server helpers — account creation, session management, status checks.
 */

import { stripe } from '@/lib/stripe';

/**
 * Create a Stripe Connect Express account for a freelancer.
 */
export async function createConnectAccount(
  freelancerId: string,
  email: string
): Promise<string> {
  const account = await stripe.accounts.create({
    type: 'express',
    email,
    metadata: { freelancerId },
    capabilities: {
      transfers: { requested: true },
    },
    settings: {
      payouts: {
        schedule: { interval: 'daily' },
      },
    },
  });

  return account.id;
}

/**
 * Create an account session for embedded Connect components.
 * Used by both onboarding and account management.
 */
export async function createAccountSession(
  stripeAccountId: string,
  components: ('account_onboarding' | 'account_management')[]
): Promise<string> {
  const componentConfig: Record<string, { enabled: boolean }> = {};
  for (const c of components) {
    componentConfig[c] = { enabled: true };
  }

  const session = await stripe.accountSessions.create({
    account: stripeAccountId,
    components: componentConfig as any,
  });

  return session.client_secret;
}

/**
 * Get the status of a Connect account.
 */
export async function getAccountStatus(stripeAccountId: string): Promise<{
  onboardingComplete: boolean;
  payoutsEnabled: boolean;
  chargesEnabled: boolean;
  detailsSubmitted: boolean;
}> {
  const account = await stripe.accounts.retrieve(stripeAccountId);

  return {
    onboardingComplete: account.details_submitted ?? false,
    payoutsEnabled: account.payouts_enabled ?? false,
    chargesEnabled: account.charges_enabled ?? false,
    detailsSubmitted: account.details_submitted ?? false,
  };
}

/**
 * Create a transfer to a freelancer's Connect account.
 * Called when a milestone passes QA.
 */
export async function createTransfer(
  amountCents: number,
  destinationAccountId: string,
  transferGroup: string,
  metadata?: Record<string, string>
): Promise<string> {
  const transfer = await stripe.transfers.create({
    amount: amountCents,
    currency: 'usd',
    destination: destinationAccountId,
    transfer_group: transferGroup,
    metadata,
  });

  return transfer.id;
}
