# Hireverse AI

An AI-powered freelancer marketplace that matches clients with vetted talent, decomposes projects into parallel microtasks, and delivers quality-assured results. Built with Next.js 15, Firebase, Genkit AI, and Stripe.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Design System](#design-system)
- [Pages & Routes](#pages--routes)
- [Architecture](#architecture)
- [AI Flows (Genkit)](#ai-flows-genkit)
- [Data Models](#data-models)
- [API Routes](#api-routes)
- [Authentication & MFA](#authentication--mfa)
- [Payments (Stripe)](#payments-stripe)
- [Integrations](#integrations)
- [Gamification](#gamification)
- [Environment Variables](#environment-variables)
- [Development](#development)

---

## Overview

Hireverse AI is a two-sided marketplace connecting **clients** (who post projects) with **freelancers** (who complete work). The core differentiator is an AI pipeline that:

1. Parses a plain-English project brief
2. Extracts required skills and matches the best available freelancer
3. Decomposes the project into parallel microtasks
4. Monitors progress and handles change requests
5. Performs automated quality assurance before delivery

Freelancers are onboarded through an adaptive skill assessment and earn XP and badges as they complete work, creating a gamified professional reputation system.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router, Turbopack) |
| Language | TypeScript 5 |
| UI Library | React 19 |
| Styling | Tailwind CSS v4 (CSS-based config, no `tailwind.config.ts`) |
| Components | shadcn/ui + Radix UI primitives |
| Auth | Firebase Auth (email/password + TOTP MFA via `otplib`) |
| Database | Cloud Firestore |
| AI Orchestration | Genkit 1.x |
| AI Models | Google Gemini Flash (latest), OpenAI GPT-5 Mini, Anthropic Claude 4.6 Sonnet |
| Payments | Stripe (PaymentIntents + Subscriptions + Webhooks) |
| Forms | React Hook Form + Zod |
| State Management | Zustand (client/UI state) |
| Data Fetching | TanStack React Query |
| i18n | next-intl (cookie-based locale, en/es/ru) |
| Charts | Recharts |
| Date Utilities | date-fns |
| Dev Server Port | 9002 |

---

## Project Structure

```
src/
├── app/                        # Next.js App Router pages
│   ├── page.tsx                # Landing page
│   ├── community/              # Community leaderboard page
│   ├── client/
│   │   ├── login/              # Client login
│   │   ├── signup/             # Client signup + Stripe subscription
│   │   └── dashboard/          # Client project management
│   ├── freelancer/
│   │   ├── login/              # Freelancer login
│   │   ├── signup/             # Freelancer signup + skill onboarding
│   │   ├── dashboard/          # Redirects to /freelancer/hub
│   │   ├── hub/                # Client Systems Hub dashboard
│   │   │   └── [workspaceId]/  # Workspace detail (tabbed view)
│   │   └── [id]/               # Public freelancer profile
│   ├── (payment)/
│   │   └── checkout/           # Stripe payment checkout
│   └── api/
│       ├── chat/                  # Client chat agent endpoint
│       ├── presence/              # Freelancer presence scoring endpoint
│       ├── stripe/
│       │   ├── connect/
│       │   │   ├── create-account/
│       │   │   ├── create-account-session/
│       │   │   └── account-status/
│       │   ├── transfer/
│       │   ├── create-payment-intent/
│       │   ├── create-subscription/
│       │   └── webhook/
│       ├── hub/
│       │   ├── nango-session/     # Nango OAuth session creation
│       │   └── chat/              # Workspace AI chat agent
│       └── projects/
│           └── create-from-external/
├── ai/
│   ├── flows/                  # Genkit AI flow definitions
│   ├── schemas/                # Zod input/output schemas for flows
│   ├── validate-output.ts
│   └── dev.ts                  # Genkit dev server entry point
├── components/
│   ├── ui/                     # shadcn/ui base components
│   ├── hub/                    # Client Systems Hub components
│   │   ├── hub-sidebar.tsx
│   │   ├── hub-dashboard.tsx
│   │   ├── workspace-card.tsx
│   │   ├── workspace-detail.tsx
│   │   ├── workspace-messages.tsx
│   │   ├── workspace-chat.tsx
│   │   ├── activity-timeline.tsx
│   │   ├── ai-briefing-panel.tsx
│   │   ├── bookmark-list.tsx
│   │   ├── note-editor.tsx
│   │   ├── access-permissions.tsx
│   │   ├── connection-tile.tsx
│   │   └── connection-setup-dialog.tsx
│   ├── messaging/              # Shared messaging components
│   │   ├── message-bubble.tsx
│   │   ├── thread-list.tsx
│   │   └── thread-view.tsx
│   ├── landing/               # Landing page section components
│   │   ├── hero-section.tsx       # Split hero: copy + ProjectBuilder
│   │   ├── project-builder.tsx    # 3-step interactive form (category, describe, AI preview)
│   │   ├── social-proof-bar.tsx   # Animated stat counters + integration pills
│   │   ├── audience-block.tsx     # Reusable left/right feature block
│   │   ├── dashboard-mockup.tsx   # CSS-only client dashboard illustration
│   │   ├── hub-mockup.tsx         # CSS-only freelancer hub illustration
│   │   ├── workflow-section.tsx   # 3-step "how it works"
│   │   ├── pricing-preview.tsx    # 3-tier pricing cards
│   │   ├── testimonials-section.tsx # Placeholder testimonial cards
│   │   ├── dual-cta-section.tsx   # Split CTA (clients + freelancers)
│   │   └── gradient-mesh.tsx      # Animated CSS gradient background
│   ├── motion/                # Framer Motion utility components
│   │   ├── scroll-reveal.tsx      # Scroll-triggered reveal wrapper
│   │   ├── animate-list.tsx       # Staggered mount animation
│   │   └── count-up.tsx           # Scroll-triggered number counter
│   ├── stripe/                # Stripe Connect components
│   │   ├── connect-onboarding.tsx
│   │   ├── connect-account-management.tsx
│   │   └── payment-breakdown.tsx
│   ├── subscription/          # Subscription tier components
│   │   ├── pricing-table.tsx
│   │   ├── subscription-badge.tsx
│   │   └── subscription-management.tsx
│   ├── providers.tsx           # QueryClient + NextIntl + Auth wrapper
│   ├── header-navigation-client.tsx
│   ├── site-logo.tsx
│   ├── client-dashboard.tsx
│   ├── client-messages.tsx
│   ├── freelancer-dashboard.tsx
│   ├── freelancer-profile.tsx
│   ├── ai-matcher.tsx          # Legacy matcher (still used in client dashboard)
│   ├── client-chat-agent.tsx
│   ├── adaptive-skill-assessment.tsx
│   ├── leaderboard.tsx
│   ├── mfa-setup.tsx
│   └── mfa-verify.tsx
├── contexts/
│   └── auth-context.tsx        # Firebase Auth React context + useAuth hook
├── hooks/
│   ├── hub/                    # React Query hooks for hub data
│   │   ├── use-workspace.ts
│   │   ├── use-connections.ts
│   │   ├── use-activity.ts
│   │   ├── use-bookmarks.ts
│   │   ├── use-notes.ts
│   │   ├── use-briefings.ts
│   │   └── use-messages.ts
│   ├── use-toast.ts
│   ├── use-mobile.tsx
│   ├── use-freelancer-id.tsx
│   ├── use-stripe-account.ts   # React Query hook for Stripe Connect status
│   └── use-presence.ts         # Background presence reporting (60s interval + beacon)
├── i18n/
│   └── request.ts              # next-intl config (cookie-based locale)
├── messages/                   # i18n locale files
│   ├── en.json
│   ├── es.json
│   └── ru.json
├── stores/
│   └── hub-store.ts            # Zustand store (sidebar, filters, locale)
├── lib/
│   ├── firebase.ts             # Firebase app + auth + db initialization
│   ├── ai.ts                   # Genkit instance (multi-provider)
│   ├── nango.ts                # Nango server client (OAuth proxy)
│   ├── api-auth.ts             # Firebase token verification for API routes
│   ├── ai-models.ts            # Centralized model registry
│   ├── ai-server-helpers.ts    # Model selection logic
│   ├── stripe.ts               # Stripe SDK initialization
│   ├── stripe-connect.ts       # Stripe Connect account management
│   ├── stripe-fees.ts          # Fee calculation (tier-aware, Stripe processing bundled)
│   ├── subscription.ts         # Tier definitions, limits, feature flags
│   ├── motion.ts               # Framer Motion animation presets
│   ├── timestamp.ts            # Shared Firestore Timestamp utility
│   ├── utils.ts                # cn() utility
│   ├── presence/               # Freelancer presence monitoring
│   │   ├── activity-collector.ts  # Captures mouse, click, keyboard, scroll signals
│   │   ├── authenticity-scorer.ts # 8 heuristics detecting automation patterns
│   │   └── index.ts
│   └── dummy-data.ts           # Seed/demo freelancer data
├── services/
│   ├── firestore.ts            # All Firestore reads/writes + Firebase Auth wrappers
│   ├── freelancer.ts           # Freelancer-specific query helpers
│   ├── presence.ts             # Firestore presence CRUD + suspicious count tracking
│   ├── hub/                    # Hub Firestore services
│   │   ├── workspaces.ts
│   │   ├── connections.ts
│   │   ├── activity.ts
│   │   ├── bookmarks.ts
│   │   ├── notes.ts
│   │   ├── briefings.ts
│   │   ├── messages.ts
│   │   ├── ai-context.ts
│   │   └── sync.ts
│   ├── integrations/           # Provider services (Nango proxy)
│   │   ├── types.ts
│   │   ├── slack.ts
│   │   ├── github.ts
│   │   ├── google-drive.ts
│   │   ├── trello.ts
│   │   └── notion.ts
│   ├── monday.ts               # Monday.com integration stub
│   └── microsoft-teams.ts      # Microsoft Teams integration stub
└── types/
    ├── hub.ts                  # Hub types (Workspace, Connection, Activity, Thread, etc.)
    ├── project.ts
    ├── freelancer.ts
    ├── client.ts
    ├── assessment.ts
    └── badge.ts
```

---

## Design System

### Theme

The app uses a **dark theme** on the landing page and a **light/neutral theme** on auth and dashboard pages.

| Token | Value | Usage |
|---|---|---|
| `--primary` | HSL 204 100% 42% (vivid cyan `#03b9ff`) | Buttons, icons, accents |
| `--foreground` | HSL 228 47% 11% (dark navy `#171738`) | Body text |
| `--accent` | HSL 142 71% 45% (green) | "NEW" badges only |
| `--background` | Dark on landing; white/gray-50 on inner pages | Page backgrounds |

### Logo

The `<SiteLogo>` component (`src/components/site-logo.tsx`) renders `/public/hireverse-logo.svg`. The SVG has a transparent background with the cyan `#03b9ff` icon and dark navy `#171738` wordmark.

- **Header usage**: `<SiteLogo className="h-9 w-auto" />`
- **Footer usage**: `<SiteLogo className="h-7 w-auto" />`

### Component Conventions

- All buttons use **solid `bg-primary`**  - no gradients
- Header: `sticky top-0 z-50 border-b bg-background/80 backdrop-blur` (glassmorphism)
- Cards: `rounded-xl border border-border bg-card p-6` with hover lift (`hover:-translate-y-0.5`)
- Feature/workflow cards: uniform grid layout, icon in a `rounded-lg bg-primary/15` swatch
- Tailwind CSS v4: configuration lives in the global CSS file, not `tailwind.config.ts`

---

## Pages & Routes

| Route | Component | Description |
|---|---|---|
| `/` | `src/app/page.tsx` | Landing page: split-layout hero with interactive ProjectBuilder, social proof bar, audience blocks, pricing preview, testimonials, dual CTA, expanded footer |
| `/community` | `src/app/community/page.tsx` | Public leaderboard showing top freelancers by XP |
| `/client/login` | `src/app/client/login/page.tsx` | Client email/password login with optional MFA verification |
| `/client/signup` | `src/app/client/signup/page.tsx` | Client registration + Stripe subscription checkout |
| `/client/dashboard` | `src/app/client/dashboard/page.tsx` | Project list, change requests, AI chat agent |
| `/freelancer/login` | `src/app/freelancer/login/page.tsx` | Freelancer email/password login |
| `/freelancer/signup` | `src/app/freelancer/signup/page.tsx` | Freelancer registration + adaptive skill assessment |
| `/freelancer/dashboard` | `src/app/freelancer/dashboard/page.tsx` | Redirects to `/freelancer/hub` |
| `/freelancer/hub` | `src/app/freelancer/hub/page.tsx` | Client Systems Hub  - workspace list + create |
| `/freelancer/hub/[workspaceId]` | `src/app/freelancer/hub/[workspaceId]/page.tsx` | Workspace detail with 9 tabs (Overview, Apps, Notes, Tasks, App Messages, Messages, Files, Timeline, AI Briefing, Access & Permissions) |
| `/freelancer/[id]` | `src/app/freelancer/[id]/page.tsx` | Public freelancer profile (skills, XP, badges, ratings) |
| `/(payment)/checkout` | `src/app/(payment)/checkout/page.tsx` | Stripe Elements payment form for one-time project payments |

---

## Architecture

### Request Flow (Client Posts a Project)

```
Client submits brief (plain English)
    |
    v
matchFreelancer flow (Genkit)
    |-- Step 1: Extract required skills from brief (AI)
    |-- Step 2: Fetch available freelancers by skill (Firestore)
    |-- Step 3: Estimate hours + select best candidate (AI)
    |-- Step 4: Calculate pricing breakdown (deterministic)
    |
    v
Stripe PaymentIntent created (POST /api/stripe/create-payment-intent)
    |
    v
Payment confirmed -> Stripe Webhook (POST /api/stripe/webhook)
    |-- Updates project.paymentStatus = 'paid'
    |-- Updates project.status = 'pending'
    |
    v
decomposeProject flow (Genkit)
    |-- Breaks project into microtasks with dependencies
    |-- Writes microtasks subcollection to Firestore
    |-- Sets project.status = 'decomposed'
    |
    v
Microtasks assigned to freelancer(s)
    |-- project.status = 'assigned'
    |-- freelancer.status = 'busy'
    |
    v
Freelancer submits work -> QA -> project.status = 'review' -> 'completed'
```

### Auth Flow

```
User submits credentials
    |
    v
Firebase Auth (signInWithEmailAndPassword)
    |
    v
Check isMfaEnabled on Firestore user document
    |-- false -> proceed to dashboard
    |-- true  -> prompt TOTP code -> verifyMfaToken() -> proceed
    |
    v
AuthProvider (onAuthStateChanged) updates global user state
    |
    v
useAuth() hook consumed by pages/components
```

### AI Model Selection

`src/lib/ai-server-helpers.ts` exports `chooseModelBasedOnPrompt()`, which selects a model at runtime based on prompt characteristics and available API keys. The three registered models are:

| Key | Model | Provider |
|---|---|---|
| `googleFlash` | `gemini-flash-latest` | Google AI |
| `openaiMini` | `gpt-5-mini-2025-08-07` | OpenAI |
| `anthropicSonnet` | `claude46Sonnet` | Anthropic |

All AI interactions go through a single Genkit `ai` instance (`src/lib/ai.ts`) that activates only the plugins for which API keys are present.

> For detailed provider documentation, model catalogs, and SDK examples, see [docs/ai-provider-reference.md](docs/ai-provider-reference.md).

---

## AI Flows (Genkit)

All flows live in `src/ai/flows/` and are marked `'use server'`. Each flow has a corresponding Zod schema file in `src/ai/schemas/`.

### `matchFreelancer`

**File**: `src/ai/flows/match-freelancer.ts`

Matches a client's project brief to the best available freelancer and produces a full pricing breakdown.

**Steps**:
1. **Skill Extraction**  - If `requiredSkills` is not pre-supplied, an AI prompt extracts 1–7 skills from the plain-English brief.
2. **Candidate Fetching**  - Queries Firestore for freelancers who are `isLoggedIn: true`, `status: 'available'`, and have matching skills; ordered by XP descending.
3. **Estimation & Selection**  - A second AI prompt selects the best candidate and estimates hours and timeline.
4. **Pricing Calculation**  - Deterministic calculation:
   - Base cost = `hours * hourlyRate`
   - Rating premium: +2% per rating point above 4.0
   - Complexity surcharge: +5% per skill beyond 3
   - Platform markup: 15%
   - Tax: 7%

**Output**: `matchedFreelancerId`, `estimatedHours`, `estimatedTimeline`, full cost breakdown, `status`.

---

### `decomposeProject`

**File**: `src/ai/flows/decompose-project.ts`

Breaks a project brief into a structured list of microtasks.

**Steps**:
1. Sets `project.status = 'decomposing'`
2. AI generates a JSON array of microtasks, each with: `id`, `description`, `estimatedHours`, `requiredSkill`, `dependencies[]`
3. Validates inter-task dependency references
4. Writes microtasks to the `projects/{id}/microtasks` subcollection (batch write, replacing existing)
5. Sets `project.status = 'decomposed'`

---

### `administerSkillTest`

**File**: `src/ai/flows/administer-skill-test.ts`

Generates scenario-based skill test questions for a freelancer during onboarding.

For each skill in the input array, the AI generates one practical, context-rich question. Falls back to a generic placeholder if generation fails for any individual skill. Returns a `testId`, `instructions`, and `questions[]`.

---

### `scoreSkillTest`

**File**: `src/ai/flows/score-skill-test.ts`

Scores a freelancer's answers to the skill test questions. Returns a numeric score and qualitative feedback per answer.

---

### `generateAssessmentQuestion` / `gradeAssessmentAnswer`

**Files**: `src/ai/flows/generate-assessment-question.ts`, `src/ai/flows/grade-assessment-answer.ts`

Implements an **adaptive skill assessment** used during freelancer signup. Questions are generated dynamically and each answer is graded before the next question is selected, adjusting difficulty based on performance.

---

### `requestProjectChange` (estimateProjectChangeImpact)

**File**: `src/ai/flows/request-project-change.ts`

When a client requests a change to an in-progress project, this flow estimates the impact: revised timeline, additional cost, and a written analysis. The result is stored as a `ChangeRequest` document in the `projects/{id}/changeRequests` subcollection.

---

### `generateProjectIdea`

**File**: `src/ai/flows/generate-project-idea.ts`

Generates creative project brief suggestions to help clients get started. Used by the AI Matcher component on the landing page.

---

### `determinePrimarySkill`

**File**: `src/ai/flows/determine-primary-skill.ts`

Given a list of skills, selects the single most relevant primary skill. Used during freelancer profile setup.

---

### `chatWithClientAgent`

**File**: `src/ai/flows/client-chat-agent.ts`

A tool-using conversational agent available in the client dashboard. The agent can:

- `listClientProjects`  - list the client's projects with status
- `getProjectDetails`  - retrieve full details for a specific project
- `initiateNewProject`  - trigger the full matching flow from a chat message

The agent is defined as a Genkit prompt with the three tools registered and a system prompt establishing it as "Hireverse Agent".

---

## Data Models

### `Freelancer` (Firestore collection: `freelancers`)

```typescript
{
  id: string;                         // Firebase Auth UID
  name: string;
  email: string;
  skills: string[];
  hourlyRate?: number;
  rating?: number;                    // 0–5
  yearsOfExperience?: number;
  testScores?: { [skill: string]: number };
  assessmentResultId?: string | null; // Links to assessments collection
  xp?: number;                        // Gamification points
  badges?: string[];                  // Badge IDs earned
  isLoggedIn?: boolean;
  status?: 'available' | 'busy' | 'offline';
  currentProjects?: string[];
  mfaSecret?: string | null;
  isMfaEnabled?: boolean;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}
```

### `Client` (Firestore collection: `clients`)

```typescript
{
  id: string;                         // Firebase Auth UID
  name: string;
  email: string;
  subscriptionStatus: string;         // Stripe subscription status
  stripeSubscriptionId: string | null;
  mfaSecret?: string | null;
  isMfaEnabled?: boolean;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}
```

### `Project` (Firestore collection: `projects`)

```typescript
{
  id?: string;
  clientId: string;
  name: string;
  brief: string;
  requiredSkills: string[];
  status: ProjectStatus;              // See status lifecycle below
  paymentStatus: 'pending' | 'paid' | 'payment_failed';
  assignedFreelancerId?: string;
  estimatedDeliveryDate?: Timestamp;
  progress?: number;                  // 0–100
  deliveredUrl?: string;
  externalSourceData?: { id: string; system: string };
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}
```

**Project status lifecycle**:
```
pending -> decomposing -> decomposed -> assigned -> in_progress
       -> change_requested -> change_approved -> review -> completed
       -> cancelled | no_candidates
```

### `Microtask` (Firestore subcollection: `projects/{id}/microtasks`)

```typescript
{
  id: string;
  description: string;
  status: 'pending' | 'assigned' | 'in_progress' | 'submitted' | 'approved' | 'rejected';
  assignedFreelancerId?: string;
  estimatedHours?: number;
  requiredSkill?: string;
  dependencies?: string[];            // IDs of prerequisite microtasks
  submittedWorkUrl?: string;
  feedback?: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}
```

### `ChangeRequest` (Firestore subcollection: `projects/{id}/changeRequests`)

```typescript
{
  id: string;
  requestedBy: string;               // Client ID
  description: string;
  priority: 'Normal' | 'High';
  fileUrl?: string;
  status: 'pending_estimate' | 'pending_approval' | 'approved' | 'rejected' | 'cancelled';
  estimatedNewCompletionDate?: Timestamp;
  estimatedAdditionalCost?: number;
  requestedAt: Timestamp;
  updatedAt?: Timestamp;
}
```

### `AdaptiveAssessmentResult` (Firestore collection: `assessments`)

Stores the full result of a freelancer's adaptive skill assessment including question history, scores per skill, and a final aggregate score.

---

## API Routes

### `POST /api/chat`

Handles client chat agent conversations. Accepts a message history and client ID, runs the `chatWithClientAgent` Genkit flow, and returns the AI response as a text stream.

**Request body**:
```json
{ "messages": [{ "id": "...", "role": "user", "content": "..." }], "clientId": "..." }
```

**Logic**:
- Validates `clientId` and `messages` array
- Passes full message history to the `chatWithClientAgent` flow (which has tools for listing projects, getting details, and initiating new projects)
- Caches conversation history per client (in-memory)
- Returns AI response as a `text/plain` readable stream

---

### `POST /api/stripe/create-payment-intent`

Creates a Stripe PaymentIntent for a one-time project payment.

**Request body**:
```json
{ "projectId": "...", "baseCost": 450.00, "clientId": "..." }
```

**Logic**:
- Verifies project exists and belongs to the client
- Applies 15% platform fee on top of `baseCost`
- Creates PaymentIntent with full metadata (`projectId`, `clientId`, `baseCost`, `platformFee`)
- Returns `{ clientSecret }` for use with Stripe Elements

---

### `POST /api/stripe/create-subscription`

Creates a Stripe Checkout Session for a recurring client subscription.

**Request body**:
```json
{ "clientId": "..." }
```

**Logic**:
- Reads `STRIPE_PRICE_ID` from environment
- Creates a Checkout Session in `subscription` mode
- Sets `client_reference_id` to `clientId` for webhook correlation
- Returns `{ url }` for browser redirect

---

### `POST /api/stripe/webhook`

Handles Stripe webhook events. Verifies the `stripe-signature` header against `STRIPE_WEBHOOK_SECRET`.

**Handled events**:
- `payment_intent.succeeded` → sets `project.paymentStatus = 'paid'`, `project.status = 'pending'`
- `payment_intent.payment_failed` → sets `project.paymentStatus = 'payment_failed'`
- `checkout.session.completed` → sets `client.subscriptionStatus` and `client.stripeSubscriptionId`
- `customer.subscription.updated` / `deleted` → updates client subscription status

---

### `POST /api/projects/create-from-external`

Creates a new project from an external integration source (Monday.com, Microsoft Teams).

**Request body**:
```json
{
  "name": "...",
  "brief": "...",
  "requiredSkills": ["..."],
  "clientId": "...",
  "externalProjectId": "..."
}
```

Returns `{ projectId }` of the newly created Firestore document.

---

## Authentication & MFA

Authentication is handled by **Firebase Auth** with email/password. The `AuthProvider` context (`src/contexts/auth-context.tsx`) wraps the entire application and exposes the current user via the `useAuth()` hook.

### Sign-up flow

1. `createAuthUser(email, password)`  - creates a Firebase Auth user and returns `userId`
2. `addFreelancer()` or `addClient()`  - creates the corresponding Firestore document using the Firebase Auth UID as the document ID
3. Freelancers complete the adaptive skill assessment before accessing their dashboard

### Sign-in flow

1. `signInAuthUser(email, password)`  - signs in via Firebase Auth
2. App checks `isMfaEnabled` on the Firestore user document
3. If MFA is enabled, the user is prompted to enter their TOTP code
4. `verifyMfaToken(secret, token)`  - validates the 6-digit code using `otplib`

### MFA Setup

1. `generateMfaSecret()`  - generates a new TOTP secret
2. `generateMfaUri(account, issuer, secret)`  - generates an `otpauth://` URI for QR code display
3. User scans QR code in their authenticator app and confirms with a valid token
4. `enableUserMfa(userId, userType)`  - sets `isMfaEnabled: true` in Firestore

TOTP secrets are stored in Firestore on the user document (`mfaSecret` field). In production these should be encrypted at rest.

---

## Payments (Stripe)

Hireverse uses two Stripe payment modes:

### One-Time Project Payments (PaymentIntents)

Used when a client pays for a specific project after freelancer matching. The flow:

1. Client reviews the match estimate and pricing breakdown
2. Frontend calls `POST /api/stripe/create-payment-intent` with `baseCost`
3. Stripe Elements renders the payment form at `/checkout`
4. On payment success, Stripe sends `payment_intent.succeeded` webhook
5. Webhook handler updates Firestore project status

**Pricing calculation** (server-side, in the `matchFreelancer` flow):
- Platform markup: 15% of base
- Rating premium: 2% per rating point above 4.0
- Complexity surcharge: 5% per required skill beyond 3
- Tax: 7% on subtotal

**API route platform fee**: The 15% platform markup is included in the matched estimate's total cost, then passed to the PaymentIntent.

### Subscriptions (Checkout Sessions)

Used for client plan access. The flow:

1. Client completes signup
2. Frontend calls `POST /api/stripe/create-subscription`
3. Browser is redirected to hosted Stripe Checkout
4. On completion, `checkout.session.completed` webhook updates `client.subscriptionStatus`

---

## Integrations

### Monday.com

**File**: `src/services/monday.ts`

Stub integration for posting tasks to a Monday.com board. The `postTaskToMonday(taskName, boardId)` function currently returns mock data; a full implementation would call the Monday.com GraphQL API.

External projects created via Monday.com webhooks arrive through `POST /api/projects/create-from-external` and are stored with `externalSourceData.system = 'Monday.com'`.

### Microsoft Teams

**File**: `src/services/microsoft-teams.ts`

Stub integration for sending notifications or receiving project creation requests from Microsoft Teams. Same external ingestion path via `POST /api/projects/create-from-external`.

---

## Client Systems Hub

A Wavebox-inspired workspace layer where freelancers manage client engagements, connect external tools, sync activity, and communicate with clients.

### Architecture

- **Workspaces**  - Each client engagement gets a workspace with connected apps, notes, bookmarks, activity timeline, and AI briefings
- **Nango OAuth**  - External tool connections (Slack, GitHub, Google Drive, Trello, Notion) managed via Nango proxy. Connection ID convention: `{workspaceId}-{provider}`
- **State management**  - React Query for server state (all hub data), Zustand for UI state (filters, sidebar, locale)
- **i18n**  - next-intl with cookie-based locale (`NEXT_LOCALE`), 3 locales: English, Spanish, Russian. Locale switcher in header. AI-generated translations in `src/messages/`.

### Workspace Tabs

| Tab | Component | Description |
|---|---|---|
| Overview | `workspace-detail.tsx` | Workspace info + bookmarks |
| Apps | `connection-tile.tsx` + `connection-setup-dialog.tsx` | Connected integrations, add/remove via Nango |
| Notes | `note-editor.tsx` | Two-panel note editor with auto-save |
| Tasks | `activity-timeline.tsx` (filtered) | Task-type activity events |
| App Messages | `activity-timeline.tsx` (filtered) | Message-type activity from connected apps |
| Messages | `workspace-messages.tsx` | Threaded messaging with AI translation |
| Files | `activity-timeline.tsx` (filtered) | Document-type activity events |
| Timeline | `activity-timeline.tsx` | Full activity feed with sync + write actions |
| AI Briefing | `ai-briefing-panel.tsx` + `workspace-chat.tsx` | AI-generated briefings + conversational agent |
| Access & Permissions | `access-permissions.tsx` | Connection management + audit log |

### Message Board

Threaded messaging between freelancers and clients with AI translation on post.

- **Data**: Top-level `workspaceThreads` collection with `messages` subcollection
- **Translation**: `translateMessage` Genkit flow translates on send, stores in `translations` map on each message
- **Freelancer view**: `workspace-messages.tsx` in the Messages tab  - can create threads and reply
- **Client view**: `client-messages.tsx` in the client dashboard  - can reply to threads
- **UI**: Shared components in `src/components/messaging/` (message-bubble, thread-list, thread-view)

### AI Flows (Hub)

| Flow | File | Description |
|---|---|---|
| `workspaceBriefing` | `src/ai/flows/workspace-briefing.ts` | Generates structured briefing (summary, action items, blockers) from workspace activity |
| `workspaceChatAgent` | `src/ai/flows/workspace-chat-agent.ts` | Conversational agent with 5 tools (activity, connections, briefings, notes, bookmarks) |
| `workspaceQaReview` | `src/ai/flows/workspace-qa-review.ts` | Scores submitted work 0-100 against project brief |
| `translateMessage` | `src/ai/flows/translate-message.ts` | Translates a message between locales |
| `translateUiStrings` | `src/ai/flows/translate-ui-strings.ts` | Batch-translates UI string JSON for locale generation |

### API Routes (Hub)

| Route | Method | Description |
|---|---|---|
| `/api/hub/nango-session` | POST | Creates Nango Connect session (requires auth) |
| `/api/hub/chat` | POST | Workspace AI chat agent (requires auth, validates `uid === freelancerId`) |

**Environment variables**: `NANGO_SECRET_KEY` (server-side), `NEXT_PUBLIC_NANGO_PUBLIC_KEY` (client-side).

---

## Gamification

Freelancers earn **XP** (experience points) and **Badges** as they work. These are stored on the `freelancer` Firestore document and drive the community leaderboard.

### XP Awards

| Event | XP Earned |
|---|---|
| Completing the onboarding assessment | 50 + `floor(finalScore / 5)` |
| Earning a badge | 50 |

### Badges

Badge IDs are strings stored in `freelancer.badges[]`. The `onboarding-complete` badge is automatically awarded when a freelancer completes their adaptive assessment.

Additional badges can be awarded via `awardBadge(freelancerId, badgeId)` at any point in the system.

### Leaderboard

`getTopFreelancers(count)` fetches freelancers sorted by XP descending. The community page renders these as a ranked leaderboard showing name, skills, XP, and badges.

---

## Environment Variables

Create a `.env` or `.env.local` file in the project root:

```bash
# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# AI Providers (configure at least one)
GOOGLE_API_KEY=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_ID=                     # Subscription price ID
STRIPE_PRO_PRICE_ID=                 # Pro tier Stripe price ID
STRIPE_ENTERPRISE_PRICE_ID=          # Enterprise tier Stripe price ID
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# Nango - manages OAuth for all hub integrations
NANGO_SECRET_KEY=
NEXT_PUBLIC_NANGO_PUBLIC_KEY=
```

The Genkit AI instance (`src/lib/ai.ts`) only loads plugins for providers whose API key is present, so all three providers are optional - at least one must be configured for AI features to function.

---

## Stripe Connect

Freelancers onboard to Stripe Connect (Express accounts) to receive payouts. Clients pay via destination charges with the platform taking a tier-based fee.

### Architecture

- **Embedded onboarding**: `@stripe/connect-js` renders Stripe's onboarding UI inside the app
- **Embedded account management**: Freelancers manage payouts/tax via embedded Stripe components
- **Destination charges**: Client payment goes to the platform, then Stripe transfers the freelancer's share
- **Fee structure**: Platform fee (15%/10%/volume) + Stripe processing (2.9% + $0.30) bundled as a single "Platform Fee" shown to the client

### Subscription Tiers

| Tier | Price | Platform Fee | Key Limits |
|---|---|---|---|
| Free | $0/mo | 15% | 3 active projects, $5K max |
| Pro | $49/mo | 10% | Unlimited projects, $50K max, priority matching |
| Enterprise | $299/mo | 10% > 8% > 6% volume | Unlimited, dedicated pool, custom SLA, API |

Fee calculation: `src/lib/stripe-fees.ts` - `calculateFees(freelancerCost, tier, monthlySpend, taxRate)`

### API Routes (Stripe Connect)

| Route | Method | Description |
|---|---|---|
| `/api/stripe/connect/create-account` | POST | Creates Express Connect account for a freelancer |
| `/api/stripe/connect/create-account-session` | POST | Creates session for embedded onboarding/management |
| `/api/stripe/connect/account-status` | GET | Checks onboarding and payout status |
| `/api/stripe/transfer` | POST | Creates milestone transfer to freelancer's Connect account |

---

## Freelancer Presence Monitoring

Detects whether freelancers are genuinely active or using automation (mouse jigglers, auto-clickers).

### How It Works

1. `ActivityCollector` (`src/lib/presence/activity-collector.ts`) captures mouse movements, clicks, keystrokes, scroll events, and page navigation in the browser
2. Every 60 seconds, `usePresence` hook sends the collected signals to `POST /api/presence`
3. `scoreAuthenticity` (`src/lib/presence/authenticity-scorer.ts`) analyzes the signals with 8 heuristics:
   - Mouse speed variance, direction change rate, repetitive patterns, mouse-only activity
   - Click element hit rate, click position variance
   - Keystroke timing variance
   - Interaction rate (superhuman detection)
4. Returns a score 0-100 and status: `active` (70+), `suspicious` (40-69), `idle`, or `away`
5. `updatePresence` writes to `freelancerPresence` Firestore collection with rolling suspicious count

### Scoring

| Score | Status | Meaning |
|---|---|---|
| 90-100 | active | Clearly human |
| 70-89 | active | Probably human |
| 40-69 | suspicious | Low-quality activity |
| 0-39 | suspicious | Likely automated |

---

## Development

### Install dependencies

```bash
npm install
```

### Start the Next.js dev server

```bash
npm run dev
# Runs on http://localhost:9002
```

### Start the Genkit dev UI (optional  - for testing AI flows)

```bash
npm run genkit:dev
# or with watch mode:
npm run genkit:watch
```

### Type checking

```bash
npm run typecheck
```

### Linting

```bash
npm run lint
```

### Troubleshooting

**Port already in use**:
```bash
fuser -k 9002/tcp
```

**Stale Turbopack CSS cache** (styles broken after config changes):
```bash
rm -rf .next
npm run dev
```

**Known non-blocking TypeScript errors**:
- Genkit/Zod version mismatch producing `ZodObject` type errors in AI flow files
- `src/app/api/chat/route.ts`: `Message` type from the `ai` package may show warnings (renamed to `UIMessage` in newer versions)
