# Landing Page V2 — Design Spec

**Supersedes:** `2026-03-18-landing-page-revamp-design.md` (Sub-project 2 of the UI revamp series, which was already built).

**Goal:** Expand the landing page from 5 lightweight sections into a content-rich, conversion-optimized page that serves both clients and freelancers equally. Replace the plain AiMatcher textarea with an interactive multi-step project builder. Add social proof, audience-specific value props, pricing preview, testimonials, and a dual CTA.

**Inspiration:** Wavebox-style dense, professional website with clear value communication and strong CTAs.

---

## Page Structure (8 sections + footer)

```
1. Hero — Interactive Project Builder (full viewport)
2. Social Proof Bar
3. "For Clients" Feature Block
4. "For Freelancers" Feature Block
5. How It Works (simplified 3-step)
6. Pricing Preview (3 tiers)
7. Testimonials
8. Final Dual CTA
Footer (expanded with column links)
```

---

## 1. Hero — Interactive Project Builder

### Layout
Full-viewport hero. Gradient mesh background (keep existing `GradientMesh` component). **Split layout** on desktop (50/50), stacked on mobile.

### Left Half — Copy
- **Headline:** "Expert work done, faster than ever" (keep existing)
- **Subtitle:** "Describe your project. AI handles the rest — matching, decomposition, quality assurance, delivery."
- **Trust line:** Row of 3 inline stats: "X+ clients | Y+ freelancers | Z+ projects delivered" — placeholder numbers initially, later wired to Firestore aggregate counts
- **Animated logo:** Keep the existing SVG diamond draw-in animation, positioned above the headline (smaller than current — `h-20 w-20`)

### Right Half — Project Builder Card
Replaces the current `AiMatcher` component. A new `ProjectBuilder` component with 3 steps and a horizontal stepper indicator at the top.

**Step 1 — Category Selection:**
- Grid of clickable category pills: Design, Development, Writing, Video, Marketing, Data, Other
- Each pill has an icon and label
- Selecting one advances to Step 2 with the category as context
- Below the grid: "or skip to describe your project" link to jump to Step 2 without a category

**Step 2 — Project Description:**
- Textarea with placeholder text contextualized to the selected category (e.g., "Describe the design work you need..." for Design)
- "Need an example?" button calls `generateProjectIdea({ industryHint })` with the category mapped to `industryHint`:
  - Design → "graphic design", Development → "software development", Writing → "content writing", Video → "video production", Marketing → "digital marketing", Data → "data analysis", Other → undefined (omit)
- Example appears **inline below the textarea** (not in a dialog popup). Shows a small card with the generated idea. "Use This" button fills the textarea.
- "Next" button advances to Step 3
- "Back" button returns to Step 1

**Step 3 — AI Preview:**
- Animated "Analyzing your project..." loading state (pulsing dots or spinner)
- Once complete, reveals: estimated timeline, estimated cost range, team size, required skills as badges
- Two CTAs: "Start This Project" (→ auth gate → checkout) and "Refine" (→ back to Step 2)
- **Important:** This step calls `generateProjectIdea` (which includes cost estimation) — NOT `matchFreelancer`. The `matchFreelancer` flow has Firestore side effects (creates project records, updates status) and should only run after the user commits via "Start This Project". Step 3 is a preview only.
- "Start This Project" behavior:
  - If user is not authenticated: redirect to `/client/signup?redirect=/` with the project brief stored in sessionStorage. After signup/login, auto-fill and resume.
  - If authenticated: call `matchFreelancer` with the brief, then redirect to checkout on success (same as current AiMatcher behavior).

### Transitions
- Steps slide left/right with Framer Motion `AnimatePresence`
- Stepper indicator: 3 numbered circles (1, 2, 3) connected by a thin line. Active step: `bg-primary text-white` filled circle. Completed: `bg-primary` with checkmark. Pending: `border-border text-muted-foreground` outline circle. Line segments between steps fill with `bg-primary` as steps complete. Height: `h-8`, circles `w-8 h-8`, line `h-0.5`.

### Mobile
- Stacked: copy block on top, project builder card below
- Category pills become 2-column grid
- Stepper stays horizontal but compact

---

## 2. Social Proof Bar

### Layout
Full-width horizontal strip. `bg-chrome` background (dark). Sits directly below the hero with no gap.

### Content
- **3 animated counters** in a centered row: "500+ Projects Delivered" | "1,200+ Vetted Freelancers" | "98% Satisfaction Rate"
  - Numbers animate from 0 to target on scroll-in using a count-up animation
  - Placeholder numbers — will be replaced with real Firestore aggregates later
- **Integration logos row** below the counters: Monday.com, Microsoft Teams, Stripe, Slack, GitHub (grayscale, hover reveals color). These represent platform integrations.
  - Simple `<img>` tags or inline SVGs, `grayscale` filter with `hover:grayscale-0` transition

### Sizing
- Compact: `py-10 md:py-14`
- Counters in large bold text (`text-4xl font-bold text-white`), labels in small muted text below

---

## 3. "For Clients" Feature Block

### Layout
Two-column on desktop (image left, text right). Stacked on mobile (text first, image below). Light background (`bg-background`).

### Text Column
- **Section label:** "For Clients" in uppercase tracking-widest primary text
- **Heading:** "Post a project. Get results, not headaches."
- **3 value props** stacked vertically, each with:
  - Icon (primary color, in a rounded `bg-primary/15` container)
  - Title (bold)
  - One-line description
  - Props:
    1. `BrainCircuit` — "AI-Powered Matching" / "No browsing profiles. AI finds the right talent instantly."
    2. `Split` — "Parallel Microtasks" / "Work gets decomposed and runs simultaneously. 3x faster delivery."
    3. `ShieldCheck` — "Built-In QA" / "Automated quality gates at every milestone. No surprises."
- **CTA:** "Start a Project" button (`bg-primary`)

### Image Column
CSS-only stylized mockup of the client dashboard. Not a real screenshot — a simplified illustration built with divs/borders:
- A card container with a fake toolbar at top (3 dots + title bar)
- Inside: a project status row (green "In Progress" badge, progress bar at 65%), a mini timeline bar, 3 small avatar circles representing the assigned team
- Subtle `shadow-2xl` and slight rotation (`rotate-1`) for depth
- On scroll-in: the mockup slides in from the left with `fadeInUp`

---

## 4. "For Freelancers" Feature Block

### Layout
Mirrors Section 3 but flipped: text left, image right. Light background continues.

### Text Column
- **Section label:** "For Freelancers"
- **Heading:** "Steady work. Fair pay. Zero chasing."
- **3 value props:**
  1. `Briefcase` — "Auto-Assigned Projects" / "No bidding wars. Work finds you based on your verified skills."
  2. `DollarSign` — "Transparent Earnings" / "100% of project cost goes to you. Clients pay the platform fee."
  3. `TrendingUp` — "Grow Your Reputation" / "XP, badges, leaderboard. Top performers get priority matching."
- **CTA:** "Join as a Freelancer" button (`variant="outline"`)

### Image Column
CSS-only stylized mockup of the freelancer hub:
- Card container with fake webdock sidebar (3 colored dots representing workspace groups)
- Inside: workspace name, 2-3 mini task cards (one with a green checkmark, one "In Progress"), a small earnings graph (3 rising bars)
- Mirror the depth treatment from Section 3 but with `rotate-[-1deg]`

---

## 5. How It Works (Simplified)

### Layout
3 steps in a horizontal row on desktop, vertical stack on mobile. `bg-chrome` background (dark section for contrast).

### Steps
1. **Describe** — `FileText` icon — "Tell us what you need in plain English."
2. **Match & Build** — `BrainCircuit` icon — "AI matches freelancers, decomposes work, and kicks off parallel tasks."
3. **Deliver** — `CheckCircle` icon — "Quality-checked results, assembled and delivered."

### Visual Treatment
- Each step is a card with the step number (`01`, `02`, `03`), icon, title, description
- Animated SVG connecting line between steps on desktop: `<svg viewBox="0 0 1200 20">` with `<line>` from x=200 to x=1000, dots at x=200, x=600, x=1000. Path draws on scroll via `whileInView` + `pathLength` animation (same technique as existing WorkflowSection but with 3 nodes).
- Section background is `bg-chrome` (dark) — cards use `bg-chrome-muted` with `border-border` and `text-chrome-foreground`
- Steps animate in sequentially on scroll using `ScrollReveal` wrapping each card with incremental `delay` props

---

## 6. Pricing Preview

### Layout
3-column card layout, centered. Light background.

### Content
Pulls tier data from existing `src/lib/subscription.ts` definitions:

- **Free:** $0/mo, 15% platform fee, basic matching, up to 3 active projects, $5,000 max project size
- **Pro:** $49/mo, 10% platform fee, priority matching, unlimited projects, $50,000 max project size, advanced analytics, consolidated billing, favorites
- **Enterprise:** $299/mo, 10%→8%→6% volume fee, unlimited project size, dedicated pool, custom SLA, API access

### Visual Treatment
- Each tier is a card (`rounded-xl border bg-card p-8`)
- Enterprise card has a `border-primary` highlight and "Best Value" badge
- Price in large text, fee rate prominent, 4-5 bullet features with checkmark icons
- CTA button on each card: "Get Started" → `/client/signup?tier=free|pro|enterprise`
- Subtext below cards: "All freelancers get paid 100% of project cost. Fees are on the client side only."

---

## 7. Testimonials

### Layout
3 cards in a horizontal row on desktop, horizontal scroll on mobile.

### Content
Placeholder testimonials (3 total — 2 clients, 1 freelancer):

1. Client: "We posted a rebrand project and had a matched team working within minutes. The quality gates caught issues we would have missed." — *Alex Chen, Startup Founder*
2. Freelancer: "No more bidding on projects for hours. Work comes to me based on my skills, and I get paid fairly every time." — *Maria Santos, UI Designer*
3. Client: "The microtask decomposition is a game-changer. Our 3-month project was delivered in 3 weeks." — *Jordan Kim, Product Manager*

### Visual Treatment
- Each card: large quote text, horizontal rule, name + role in muted text, 5-star rating
- Card style: `bg-card border rounded-xl p-6`
- Subtle quote mark icon (") in `text-primary/20` as background decoration
- Cards stagger in on scroll

---

## 8. Final Dual CTA

### Layout
Full-width section. `bg-chrome` background (dark).

### Content
- **Headline:** "Ready to work differently?" (centered, large)
- **Two side-by-side CTA cards** on desktop (stacked on mobile):

**Left card — For Clients:**
- Dark card (`bg-chrome-muted border-border`) — NOT `bg-card` since we're in a dark `bg-chrome` context without `.dark` class
- Heading: "I need work done"
- Subtext: "Post your project and let AI find the perfect team."
- CTA: "Start a Project" button (`bg-primary`, full-width)

**Right card — For Freelancers:**
- Primary-tinted card (`bg-primary/10 border-primary/30`)
- Heading: "I want to earn"
- Subtext: "Get matched to projects that fit your skills. No bidding."
- CTA: "Join as a Freelancer" button (`variant="outline"`, full-width)

---

## 9. Footer (Expanded)

### Layout
4-column grid on desktop, 2x2 on tablet, stacked on mobile. `bg-chrome` background continuous from Section 8.

### Columns
1. **Brand:** Logo + one-line tagline + social icons (placeholder)
2. **Product:** Start a Project, Browse Freelancers, Pricing, Integrations
3. **Company:** About, Careers, Community, Blog (placeholder links)
4. **Legal:** Terms of Service, Privacy Policy, Cookie Policy

### Bottom Bar
Copyright line + "Looking for help with your resume?" link (keep existing).

---

## Components to Create

| Component | Path | Description |
|-----------|------|-------------|
| `ProjectBuilder` | `src/components/landing/project-builder.tsx` | Multi-step hero form (replaces AiMatcher in hero) |
| `SocialProofBar` | `src/components/landing/social-proof-bar.tsx` | Counters + integration logos |
| `AudienceBlock` | `src/components/landing/audience-block.tsx` | Reusable left-right feature block (used for both client/freelancer) |
| `DashboardMockup` | `src/components/landing/dashboard-mockup.tsx` | CSS-only client dashboard illustration |
| `HubMockup` | `src/components/landing/hub-mockup.tsx` | CSS-only freelancer hub illustration |
| `PricingPreview` | `src/components/landing/pricing-preview.tsx` | 3-tier pricing cards |
| `TestimonialsSection` | `src/components/landing/testimonials-section.tsx` | Testimonial cards |
| `DualCtaSection` | `src/components/landing/dual-cta-section.tsx` | Two-path final CTA |
| `CountUp` | `src/components/motion/count-up.tsx` | Animated number counter |

## Components to Modify

| Component | Change |
|-----------|--------|
| `src/app/page.tsx` | Replace section imports with new structure |
| `src/components/landing/hero-section.tsx` | Complete rewrite — split layout + ProjectBuilder |
| `src/components/landing/cta-section.tsx` | Remove (replaced by DualCtaSection) |
| `src/components/landing/workflow-section.tsx` | Simplify to 3 steps |
| `src/components/landing/community-section.tsx` | Remove (content absorbed into "For Freelancers" block + testimonials) |
| `src/components/landing/features-section.tsx` | Remove (content absorbed into audience blocks) |

## Components Unchanged
| Component | Reason |
|-----------|--------|
| `src/components/ai-matcher.tsx` | Keep — still used in client dashboard. Not deleted, just no longer in hero. |
| `src/components/landing/gradient-mesh.tsx` | Keep — reused in new hero |

---

## Animation Strategy

All sections use existing Framer Motion presets from `src/lib/motion.ts`:
- `fadeInUp` for text blocks (named export from motion.ts)
- `scaleIn` for cards (named export from motion.ts)
- `staggerContainer` + `staggerItem` for lists/grids (named exports — note: NOT `stagger`)
- `ScrollReveal` wrapper (`src/components/motion/scroll-reveal.tsx`) for scroll-triggered sections — uses `whileInView`
- `AnimateList` (`src/components/motion/animate-list.tsx`) for card grids — note: this triggers on mount, not scroll. For scroll-triggered stagger, wrap individual cards in `ScrollReveal` with incremental `delay` props instead.
- New: `CountUp` component for animated number counters (see spec below)
- New: `AnimatePresence` (from `framer-motion`) for ProjectBuilder step transitions

### CountUp Component Spec
`src/components/motion/count-up.tsx`

Props: `{ target: number; duration?: number; suffix?: string; prefix?: string }`

Implementation:
- Uses `framer-motion`'s `useInView` to trigger when scrolled into view
- Uses `useMotionValue` + `useTransform` + `animate` to count from 0 to `target`
- Rounds to integer during animation, displays final value
- Default duration: 2 seconds, ease: `easeOut`
- Renders as a `<span>` wrapping `{prefix}{animatedValue}{suffix}`

---

## Design Tokens Used

All from existing design system — no new tokens:
- `bg-chrome`, `text-chrome-foreground` — dark sections
- `bg-background`, `bg-card` — light sections
- `text-primary` (`#03b9ff`) — accents
- `border-border` — card borders
- `bg-primary/15` — icon containers
- `text-muted-foreground` — secondary text

---

## What's NOT in Scope

- Real testimonials (using placeholders)
- Real Firestore aggregate counts for social proof (using placeholder numbers)
- Integration logo assets — use text labels styled as pills (`border rounded-full px-3 py-1 text-xs text-chrome-foreground/60`) as placeholders. No grayscale/hover treatment until real SVG assets exist.
- Blog or About pages (footer links are placeholder)
- Mobile app references
- SEO/meta tags (separate concern)
