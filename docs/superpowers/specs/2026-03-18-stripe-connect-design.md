# Stripe Connect Integration — Design Spec

## 1. Overview

Integrate Stripe Connect to handle the full payment lifecycle: clients pay for projects, the platform takes a fee, and freelancers receive payouts as they deliver work. Embedded Stripe components handle onboarding and account management — no redirects to Stripe.

**Key decisions:**
- Stripe Connect Express accounts for freelancers
- Embedded onboarding components (during signup, after assessment)
- Embedded account management components (in hub Settings)
- Destination charges with transfer groups (escrow pattern)
- 15% platform fee + Stripe processing fee bundled into one "Platform Fee" line
- Client pays upfront, freelancers paid per milestone QA approval

## 2. Fee Calculation

```
freelancerCost = sum of all freelancer payouts
platformCut = freelancerCost × 0.15
subtotal = freelancerCost + platformCut
stripeFee = (subtotal × 0.029) + 0.30
preTax = subtotal + stripeFee
tax = preTax × taxRate (via Stripe Tax, jurisdiction-specific)
clientTotal = preTax + tax
```

**Client sees:**
- Freelancer Cost: $X.XX — "100% goes to freelancers"
- Platform Fee: $Y.YY — (platformCut + stripeFee, single line)
- Tax: $Z.ZZ
- Total: $W.WW

**Where money goes:**
- Freelancers: freelancerCost (via per-milestone transfers)
- Platform: platformCut (full 15%)
- Stripe: stripeFee (processing, absorbed into Platform Fee label)
- Tax authority: tax (collected via Stripe Tax)

## 3. Freelancer Connect Account Lifecycle

### 3.1 Onboarding (during signup, after assessment)

1. Assessment completes → scores stored
2. Redirect to Stripe setup page
3. `POST /api/stripe/connect/create-account` creates a Connect Express account
4. Page renders `<ConnectOnboarding />` embedded component
5. Freelancer completes identity, bank, tax info (Stripe-hosted UI)
6. Webhook `account.updated` → store `stripeAccountId`, `stripeOnboardingComplete`, `payoutsEnabled` on freelancer record
7. Freelancer proceeds to hub

### 3.2 Account Management (hub Settings tab)

- Embedded `<ConnectAccountManagement />` component
- Freelancer updates bank details, views payout schedule, manages tax info
- Rendered in the hub workspace Settings or a dedicated "/freelancer/hub/settings" route

### 3.3 Freelancer Record Fields

```typescript
// Added to freelancer Firestore document
stripeAccountId?: string;           // acct_xxxxx
stripeOnboardingComplete?: boolean;
payoutsEnabled?: boolean;
```

## 4. Payment Flow

### 4.1 Client Pays for Project

1. Client approves project plan (or auto-assign triggers for < $500)
2. Frontend shows `<PaymentBreakdown />` with fee calculation
3. Client clicks "Pay & Start Project"
4. `POST /api/stripe/create-payment-intent` with:
   - `amount`: clientTotal in cents
   - `application_fee_amount`: platformCut + stripeFee in cents
   - `transfer_group`: `project_{projectId}`
   - `automatic_tax: { enabled: true }`
   - No `transfer_data.destination` (funds go to platform account first)
5. Client completes payment via existing `<PaymentElement />`
6. Webhook `payment_intent.succeeded` → project status = `funded` → first milestone starts

### 4.2 Freelancer Paid on Milestone Approval

1. Milestone QA passes → `milestone.status = 'approved'`
2. Calculate freelancer payout: `estimatedHours × baseRate × payRateMultiplier`
3. `POST /api/stripe/transfer` creates:
   ```typescript
   stripe.transfers.create({
     amount: payoutCents,
     currency: 'usd',
     destination: freelancerStripeAccountId,
     transfer_group: `project_${projectId}`,
     metadata: { milestoneId, freelancerId },
   });
   ```
4. Freelancer receives funds → Stripe handles payout to their bank

### 4.3 Edge Cases

- **QA fails**: Milestone returns to freelancer, no transfer
- **Project cancelled**: Refund untransferred funds to client, pay freelancers for approved milestones
- **Freelancer payout disabled**: Hold transfer, notify freelancer to update Stripe account
- **Partial refund**: If milestone is partially approved, transfer proportional amount

## 5. API Routes

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/stripe/connect/create-account` | POST | freelancerId verified | Create Connect Express account |
| `/api/stripe/connect/create-account-session` | POST | freelancerId verified | Session token for embedded components |
| `/api/stripe/connect/account-status` | GET | freelancerId verified | Check onboarding + payout status |
| `/api/stripe/transfer` | POST | server-only (called from milestone service) | Transfer to freelancer |
| `/api/stripe/create-payment-intent` | POST | clientId verified | Updated with transfer_group + fee calc |

## 6. Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `connect-onboarding.tsx` | `src/components/stripe/` | Wraps Stripe's `<ConnectAccountOnboarding />` |
| `connect-account-management.tsx` | `src/components/stripe/` | Wraps Stripe's `<ConnectAccountManagement />` |
| `payment-breakdown.tsx` | `src/components/stripe/` | Fee breakdown display for clients |
| `use-stripe-account.ts` | `src/hooks/` | React Query hook for Connect account status |

## 7. Webhook Events

| Event | Handler |
|-------|---------|
| `account.updated` | Update freelancer's `payoutsEnabled`, `stripeOnboardingComplete` |
| `payment_intent.succeeded` | Set project to `funded`, start first milestone |
| `transfer.created` | Log payout in milestone record |
| `transfer.failed` | Flag milestone, notify admin |

## 8. File Map

### New Files
```
src/lib/stripe-connect.ts
src/lib/stripe-fees.ts
src/app/api/stripe/connect/create-account/route.ts
src/app/api/stripe/connect/create-account-session/route.ts
src/app/api/stripe/connect/account-status/route.ts
src/app/api/stripe/transfer/route.ts
src/components/stripe/connect-onboarding.tsx
src/components/stripe/connect-account-management.tsx
src/components/stripe/payment-breakdown.tsx
src/hooks/use-stripe-account.ts
```

### Modified Files
```
src/app/api/stripe/create-payment-intent/route.ts
src/app/api/stripe/webhook/route.ts
src/app/freelancer/signup/page.tsx
src/components/hub/workspace-detail.tsx
src/types/hub.ts
package.json (@stripe/connect-js)
```
