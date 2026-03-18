/**
 * Subscription tier definitions, limits, and feature flags.
 */

export type SubscriptionTier = 'free' | 'pro' | 'enterprise';

export interface TierConfig {
  name: string;
  price: number; // monthly USD, 0 for free
  stripePriceId: string | null;
  feeRate: number; // base platform fee rate
  maxConcurrentProjects: number; // 0 = unlimited
  maxProjectSize: number; // 0 = unlimited, in dollars
  priorityMatching: boolean;
  dedicatedPool: boolean;
  favorites: boolean;
  advancedAnalytics: boolean;
  apiAccess: boolean;
  consolidatedBilling: boolean;
  customSla: boolean;
}

export const TIER_CONFIGS: Record<SubscriptionTier, TierConfig> = {
  free: {
    name: 'Free',
    price: 0,
    stripePriceId: null,
    feeRate: 0.15,
    maxConcurrentProjects: 3,
    maxProjectSize: 5000,
    priorityMatching: false,
    dedicatedPool: false,
    favorites: false,
    advancedAnalytics: false,
    apiAccess: false,
    consolidatedBilling: false,
    customSla: false,
  },
  pro: {
    name: 'Pro',
    price: 49,
    stripePriceId: process.env.STRIPE_PRO_PRICE_ID ?? null,
    feeRate: 0.10,
    maxConcurrentProjects: 0, // unlimited
    maxProjectSize: 50000,
    priorityMatching: true,
    dedicatedPool: false,
    favorites: true,
    advancedAnalytics: true,
    apiAccess: false,
    consolidatedBilling: true,
    customSla: false,
  },
  enterprise: {
    name: 'Enterprise',
    price: 299,
    stripePriceId: process.env.STRIPE_ENTERPRISE_PRICE_ID ?? null,
    feeRate: 0.10, // base rate, volume discounts applied dynamically
    maxConcurrentProjects: 0,
    maxProjectSize: 0, // unlimited
    priorityMatching: true,
    dedicatedPool: true,
    favorites: true,
    advancedAnalytics: true,
    apiAccess: true,
    consolidatedBilling: true,
    customSla: true,
  },
};

/**
 * Get the effective platform fee rate for a tier + monthly spend.
 * Enterprise gets volume discounts.
 */
export function getEffectiveFeeRate(tier: SubscriptionTier, monthlySpend: number = 0): number {
  if (tier !== 'enterprise') {
    return TIER_CONFIGS[tier].feeRate;
  }

  // Enterprise volume discounts
  if (monthlySpend >= 50000) return 0.06;
  if (monthlySpend >= 10000) return 0.08;
  return 0.10;
}

/**
 * Check if a feature is available for a given tier.
 */
export function hasFeature(tier: SubscriptionTier, feature: keyof Omit<TierConfig, 'name' | 'price' | 'stripePriceId' | 'feeRate' | 'maxConcurrentProjects' | 'maxProjectSize'>): boolean {
  return TIER_CONFIGS[tier][feature] as boolean;
}

/**
 * Check if a client can create a new project given their tier and current project count.
 */
export function canCreateProject(tier: SubscriptionTier, currentProjectCount: number): boolean {
  const max = TIER_CONFIGS[tier].maxConcurrentProjects;
  return max === 0 || currentProjectCount < max;
}

/**
 * Check if a project cost is within the tier's limit.
 */
export function isWithinProjectSizeLimit(tier: SubscriptionTier, projectCost: number): boolean {
  const max = TIER_CONFIGS[tier].maxProjectSize;
  return max === 0 || projectCost <= max;
}
