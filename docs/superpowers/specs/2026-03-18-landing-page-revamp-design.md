# Landing Page Revamp — Design Spec

**Sub-project 2 of 6** in the Hireverse UI Revamp series.

**Goal:** Transform the landing page from static cards with minimal hover effects into a visually impressive, animation-rich experience with an animated gradient mesh hero, SVG logo draw-in, scroll-triggered section reveals, and dramatic card entrances.

**Depends on:** Sub-project 1 (Design System + App Shell) — uses Framer Motion, animation presets from `src/lib/motion.ts`, and motion wrapper components from `src/components/motion/`.

---

## 1. Hero Section

### 1.1 Animated Gradient Mesh Background

Pure CSS animated background contained to the hero section. 3-4 soft color blobs that slowly morph and drift:

- **Blob colors:** Cyan `#03b9ff` (primary), dark navy `#1a1a3e`, deep blue `#0a2540`, and a subtle purple `#2d1b69`
- **Implementation:** 3-4 `div` elements with `position: absolute`, large `border-radius: 50%`, heavy `blur` (80-120px), and `@keyframes` that animate `transform: translate()` in slow loops (15-25s duration, infinite)
- **Opacity:** Blobs at 20-40% opacity so text remains readable
- **Contained:** The mesh background is `position: absolute` within the hero section, with `overflow: hidden` on the hero container. Does not bleed into other sections.

Component: `src/components/landing/gradient-mesh.tsx`

### 1.2 Logo Draw-In Animation

The Hireverse diamond SVG icon animates on page load:

1. **Draw phase (0–1.5s):** SVG paths animate via Framer Motion's `pathLength: 0 → 1` with `stroke` visible and `fill: transparent`. The diamond outline draws itself.
2. **Fill phase (1.5–2s):** `fill` transitions from transparent to `#03b9ff` as `pathLength` completes.
3. **Pulse phase (2s+):** The 3-layer glow effect (already in the current hero) begins a slow `opacity` oscillation (0.5→1→0.5, 3s infinite ease-in-out).

The draw-in happens once on mount (no re-trigger on scroll).

### 1.3 Text Entrance

Staggered Framer Motion entrance after the logo:

| Element | Animation | Delay |
|---|---|---|
| Heading line 1 ("Expert work done,") | `fadeInUp` | 0.3s |
| Heading line 2 ("faster than ever") | `fadeInUp` | 0.5s |
| Subtitle paragraph | `fadeInUp` | 0.7s |
| CTA buttons | `fadeInUp` | 0.9s |
| AI Matcher form | `scaleIn` | 1.1s |

Split the heading into two `<span>` blocks for independent animation. Each wrapped in `<MotionDiv>` with the appropriate delay.

### 1.4 Component

`src/components/landing/hero-section.tsx` — Self-contained hero with:
- `<GradientMesh />` as absolute-positioned background
- Animated SVG logo
- Staggered text entrance
- AI Matcher form

---

## 2. Features Section

### 2.1 Section Entrance

The entire section is wrapped in `<ScrollReveal>`. The heading (`fadeInUp`) enters first.

### 2.2 Card Grid Animation

The 6 feature cards use `<AnimateList>` with `staggerChildren: 0.08`. Each card enters with the subtle `fadeInUp` preset (16px travel, 400ms).

### 2.3 Enhanced Card Hover

Current: `hover:-translate-y-0.5` + `hover:border-primary/50`

New hover effect:
- Lift: `hover:-translate-y-1` (doubled)
- Left accent: `border-l-[3px] border-l-transparent` default → `hover:border-l-primary` on hover
- Icon scale: The icon container scales to `110%` on card hover via `group-hover:scale-110`
- Transition: `transition-all duration-200`

### 2.4 NEW Badge Pulse

The green "NEW" badge gets a CSS animation: `animate-pulse` (Tailwind built-in, gentle opacity pulse).

### 2.5 Component

`src/components/landing/features-section.tsx` — Receives `keyFeaturesData` as prop or imports it directly.

---

## 3. Workflow Section

### 3.1 Dramatic Card Entrance

The workflow is the visual payoff section. Cards use a more dramatic entrance:

- Each card enters from `scale: 0.85, opacity: 0` → `scale: 1, opacity: 1`
- Stagger: 0.1s between cards (slightly slower than features for emphasis)
- Duration: 500ms with ease-out
- Custom variant (not a standard preset) defined inline in the component

### 3.2 Connecting Line

A horizontal SVG line drawn above the card grid (desktop only, hidden below `lg` breakpoint):

- Simple horizontal line with 6 evenly-spaced dots (one per step)
- The line draws left→right using Framer Motion `pathLength: 0 → 1` as the section enters viewport
- Duration: 1.2s, triggered by `whileInView`
- Dots fade in sequentially after the line reaches their position

### 3.3 Step Number Animation

Each step number ("01"–"06") enters with a delayed `fadeIn` that syncs with the stagger — so the number appears just before its card animates in.

### 3.4 Component

`src/components/landing/workflow-section.tsx` — Receives `hireverseWorkflowData` as prop or imports it directly.

---

## 4. Community Section

### 4.1 Benefit Cards

The 3 community benefit cards (Earn XP, Unlock Badges, Climb Leaderboard) use `<AnimateList>` with standard `staggerChildren: 0.08` and `fadeInUp` — the subtle treatment.

### 4.2 CTA Banner

The "Join freelancers" banner enters with `scaleIn` (0.95→1) when it scrolls into view. Wrapped in `<ScrollReveal preset="scaleIn">`.

### 4.3 Component

`src/components/landing/community-section.tsx`

---

## 5. Final CTA Section

Simple `<ScrollReveal>` with `fadeInUp` on the heading + button row. No dramatic effects — clean close.

### Component

`src/components/landing/cta-section.tsx`

---

## 6. Footer

Keep minimal. Update background to `bg-chrome` to match the new dark chrome design language. Text becomes `text-chrome-foreground/60`. Logo uses the standard Hireverse logo. No structural changes.

Updated inline in the main `page.tsx`.

---

## 7. Page Structure

The main `src/app/page.tsx` becomes a thin shell:

```tsx
<div className="dark flex min-h-screen flex-col bg-background text-foreground">
  <SplashScreen />
  <header>...</header>
  <main>
    <HeroSection />
    <FeaturesSection />
    <WorkflowSection />
    <CommunitySection />
    <CtaSection />
  </main>
  <footer>...</footer>
</div>
```

Feature data arrays (`keyFeaturesData`, `hireverseWorkflowData`) move into the respective section components.

---

## 8. File Map

### New Files

```
src/components/landing/gradient-mesh.tsx      — Animated CSS background blobs
src/components/landing/hero-section.tsx        — Hero with logo animation + staggered text
src/components/landing/features-section.tsx    — Feature cards with scroll reveal
src/components/landing/workflow-section.tsx    — Workflow steps with connecting line
src/components/landing/community-section.tsx   — Community cards + CTA banner
src/components/landing/cta-section.tsx         — Final call to action
```

### Modified Files

```
src/app/page.tsx                               — Slim down to section imports + header/footer
```

### No Deleted Files

The current `page.tsx` is refactored, not deleted. Components like `AiMatcher`, `SiteLogo`, `SplashScreen`, `HeaderNavigationClient` remain unchanged.

---

## 9. Performance Considerations

- Gradient mesh uses CSS only — no canvas, no JS runtime cost
- SVG `pathLength` animation is GPU-accelerated via Framer Motion
- `ScrollReveal` uses `viewport={{ once: true }}` — animations trigger once, not on every scroll
- Feature/workflow data arrays are static (no API calls)
- Total new JS: ~2-3kb (6 small components, animation config is shared from `src/lib/motion.ts`)

---

## 10. Out of Scope

- Header navigation redesign (Sub-project 6)
- Auth page redesign (Sub-project 3)
- Mobile-specific animations or gestures
- A/B testing or analytics
