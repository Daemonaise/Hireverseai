/**
 * Stripe fee calculation for Hireverse projects.
 *
 * Client sees: Freelancer Cost + Platform Fee + Tax = Total
 * Platform Fee = tier-based % of freelancer cost + Stripe processing (bundled as one line)
 */

import { getEffectiveFeeRate, type SubscriptionTier } from '@/lib/subscription';

const STRIPE_PROCESSING_RATE = 0.029;
const STRIPE_FIXED_FEE = 0.30; // USD

export interface FeeBreakdown {
  freelancerCost: number;      // What freelancers receive total
  platformCut: number;         // Tier-based % of freelancer cost
  stripeFee: number;           // Stripe processing on subtotal
  platformFeeDisplay: number;  // platformCut + stripeFee (shown to client as "Platform Fee")
  subtotalPreTax: number;      // freelancerCost + platformFeeDisplay
  tax: number;                 // Calculated by Stripe Tax (passed in or estimated)
  clientTotal: number;         // Final amount client pays
  effectiveFeeRate: number;    // The fee rate used (for display)
}

/**
 * Calculate full fee breakdown for a project.
 * @param freelancerCost Total cost of all freelancer payouts
 * @param tier Client's subscription tier (default: 'free')
 * @param monthlySpend Client's rolling 30-day spend (for enterprise volume discounts)
 * @param taxRate Tax rate as decimal (e.g., 0.08 for 8%). Pass 0 if using Stripe Tax auto-calculation.
 */
export function calculateFees(
  freelancerCost: number,
  tier: SubscriptionTier = 'free',
  monthlySpend: number = 0,
  taxRate: number = 0
): FeeBreakdown {
  const effectiveFeeRate = getEffectiveFeeRate(tier, monthlySpend);
  const platformCut = freelancerCost * effectiveFeeRate;
  const subtotal = freelancerCost + platformCut;
  const stripeFee = (subtotal * STRIPE_PROCESSING_RATE) + STRIPE_FIXED_FEE;
  const platformFeeDisplay = platformCut + stripeFee;
  const subtotalPreTax = freelancerCost + platformFeeDisplay;
  const tax = subtotalPreTax * taxRate;
  const clientTotal = subtotalPreTax + tax;

  return {
    freelancerCost: round(freelancerCost),
    platformCut: round(platformCut),
    stripeFee: round(stripeFee),
    platformFeeDisplay: round(platformFeeDisplay),
    subtotalPreTax: round(subtotalPreTax),
    tax: round(tax),
    clientTotal: round(clientTotal),
    effectiveFeeRate,
  };
}

/**
 * Convert dollar amount to Stripe cents (integer).
 */
export function toCents(dollars: number): number {
  return Math.round(dollars * 100);
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
