# Client Subscription Tiers — Design Spec

## 1. Overview

Three-tier subscription model for clients: Free (pay-per-project), Pro ($49/mo), Enterprise ($299/mo). Higher tiers get lower platform fees, priority matching, higher limits, and better tooling. All self-serve, no sales team.

## 2. Tier Structure

| | Free | Pro ($49/mo) | Enterprise ($299/mo) |
|---|---|---|---|
| Platform fee | 15% | 10% | Volume: 10%→8%→6% |
| Fee breakpoints | — | — | <$10k: 10%, $10-50k: 8%, $50k+: 6% |
| Matching priority | Standard | Priority | Priority + dedicated pool |
| Concurrent projects | 3 | Unlimited | Unlimited |
| Project size cap | $5,000 | $50,000 | Unlimited |
| AI agent | Basic chat | Advanced + analytics | Advanced + API access |
| Freelancer history | Anon IDs | Anon IDs + favorites | Anon IDs + favorites + dedicated team |
| Turnaround | Best effort | 24h response | Custom SLA |
| Analytics | Spend only | Full dashboard | Full + API |
| Billing | Per-project | Monthly consolidated | Monthly + PO/NET-30 |
| Support | AI only | Priority email | Priority email + Slack |

## 3. Fee Calculation Update

The `stripe-fees.ts` module needs to accept a tier parameter:

```
function calculateFees(freelancerCost, tier, monthlySpend?):
  if tier === 'free':     feeRate = 0.15
  if tier === 'pro':      feeRate = 0.10
  if tier === 'enterprise':
    if monthlySpend < 10000:   feeRate = 0.10
    if monthlySpend < 50000:   feeRate = 0.08
    else:                       feeRate = 0.06

  platformCut = freelancerCost × feeRate
  stripeFee = ((freelancerCost + platformCut) × 0.029) + 0.30
  platformFeeDisplay = platformCut + stripeFee
  ... (same as before)
```

## 4. Stripe Products

Create two Stripe Products with Prices:
- **Hireverse Pro**: $49/month recurring
- **Hireverse Enterprise**: $299/month recurring

These are standard Stripe Subscriptions (already have the create-subscription route). The subscription status is stored on the client's Firestore record.

## 5. Client Record Updates

```typescript
// Added to client Firestore document
subscriptionTier: 'free' | 'pro' | 'enterprise';
stripeSubscriptionId?: string;
subscriptionStatus?: 'active' | 'past_due' | 'canceled' | 'trialing';
monthlySpend?: number;  // Rolling 30-day spend, updated on each payment
favoritedFreelancers?: string[];  // Anon IDs for Pro+ "favorites" feature
```

## 6. Subscription Lifecycle

### Upgrade
1. Client clicks "Upgrade to Pro" or "Upgrade to Enterprise" on pricing/dashboard
2. Creates Stripe Checkout Session for the subscription
3. On success webhook → update `subscriptionTier` + `stripeSubscriptionId`
4. New fee rate applies immediately to next project

### Downgrade
1. Client clicks "Downgrade" → cancels at period end
2. Webhook `customer.subscription.updated` with `cancel_at_period_end: true`
3. Tier reverts to Free when subscription actually ends
4. Active projects keep the rate they were started with (no retroactive increase)

### Cancellation
1. Same as downgrade — always cancel at period end, never mid-cycle
2. Client keeps Pro/Enterprise benefits until the billing period ends

## 7. Enforcement Points

| Limit | Where enforced |
|---|---|
| Concurrent projects (3 for Free) | `decompose-project` flow + project creation API |
| Project size cap ($5k/$50k) | `create-payment-intent` route |
| Matching priority | `freelancer-matcher.ts` — Pro/Enterprise clients queued first |
| Fee rate | `stripe-fees.ts` — reads client's tier |
| Favorites | Client dashboard — only shown for Pro+ |
| Analytics | Dashboard components — gate advanced analytics behind tier check |

## 8. File Map

### New Files
```
src/lib/subscription.ts                    — Tier definitions, limits, feature flags per tier
src/components/subscription/
  pricing-table.tsx                         — 3-column pricing comparison
  upgrade-button.tsx                        — Handles checkout session creation
  subscription-badge.tsx                    — Shows current tier in header/dashboard
  subscription-management.tsx               — Current plan, usage, upgrade/downgrade
```

### Modified Files
```
src/lib/stripe-fees.ts                     — Accept tier + monthlySpend params
src/app/api/stripe/create-subscription/route.ts  — Support Pro and Enterprise price IDs
src/app/api/stripe/create-payment-intent/route.ts — Enforce project size cap per tier
src/app/api/stripe/webhook/route.ts        — Handle subscription tier changes
src/services/firestore.ts                  — Add client tier fields + monthly spend tracking
src/types/project.ts                       — Add subscriptionTier to Client type
src/components/client-dashboard.tsx         — Show subscription badge, gate features
```
