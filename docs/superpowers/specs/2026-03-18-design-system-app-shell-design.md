# Design System + App Shell — Design Spec

**Sub-project 1 of 6** in the Hireverse UI Revamp series.

**Goal:** Establish the foundational design system (dark chrome tokens, animation primitives, skeleton loaders) and build a Wavebox-inspired app shell component that both the freelancer and client portals share.

**Depends on:** Nothing (this is the foundation).

**Subsequent sub-projects:** Landing Page Revamp, Auth Pages Revamp, Freelancer Portal Revamp, Client Portal Revamp, Shared Components Polish.

---

## 1. Color System

### Philosophy

Dark navy chrome (sidebar, header, overlays) with the Hireverse logo cyan (`#03b9ff`) as the dominant accent. Light content panels for readability. The app feels like Slack/Wavebox but is unmistakably Hireverse.

The chrome tokens are the same regardless of any mode toggle — the sidebar and top bar are always dark. Only the content area is light. Contrast is structural, not toggled.

### Token Palette

Added to `src/app/globals.css` as CSS custom properties within the Tailwind v4 `@theme` block:

| Token | Value | Usage |
|---|---|---|
| `--color-chrome` | `hsl(220 30% 12%)` | Sidebar, header, nav rail background |
| `--color-chrome-foreground` | `hsl(210 20% 92%)` | Text on chrome surfaces |
| `--color-chrome-muted` | `hsl(220 20% 22%)` | Hover/active states on chrome |
| `--color-chrome-border` | `hsl(220 15% 20%)` | Dividers within chrome surfaces |
| `--color-primary` | `hsl(197 100% 50%)` | `#03b9ff` — the logo cyan. Buttons, active indicators, accents |
| `--color-primary-glow` | `hsl(197 100% 50% / 0.15)` | Glow effects, active background tints |
| `--color-primary-foreground` | `hsl(0 0% 100%)` | Text on cyan buttons/surfaces |
| `--color-content-bg` | `hsl(210 20% 98%)` | Main content area background |
| `--color-card` | `hsl(0 0% 100%)` | Cards within content area |
| `--color-accent-green` | `hsl(142 71% 45%)` | Online status, success states |
| `--color-accent-amber` | `hsl(38 92% 50%)` | Warnings, pending states |
| `--color-accent-red` | `hsl(0 72% 51%)` | Errors, destructive actions |
| `--color-unread` | `hsl(0 72% 51%)` | Unread count badge background |

Existing tokens (`--background`, `--foreground`, `--border`, `--muted`, etc.) remain unchanged for content area usage. The new `chrome-*` tokens layer on top for the app shell surfaces.

---

## 2. App Shell Component

### Layout

Inspired by [Wavebox's interface](https://hub.wavebox.io/wavebox-interface-terminology/). Three zones:

```
┌──────────┬──────────────────────────────────────────────┐
│          │  Toolbar (chrome): group name + tabstrip     │
│ Webdock  │──────────────────────────────────────────────│
│ (60px)   │                                              │
│          │  Content Area (light bg)                     │
│ Spaces   │                                              │
│ Groups   │                                              │
│ Avatar   │                                              │
│          │                                              │
└──────────┴──────────────────────────────────────────────┘
```

### 2.1 Webdock (Left Sidebar, 60px wide)

The [Webdock](https://hub.wavebox.io/webdock/) is the primary navigation surface. Always visible, always dark (`bg-chrome`).

**Structure (top to bottom):**

1. **Logo** (top, centered): Hireverse cyan diamond icon only (no wordmark), 28px. Links to landing page `/`.

2. **Space Icons** (circle, 36px diameter): High-level navigation sections.
   - **Freelancer spaces:** Home, Workspaces, Messages, AI
   - **Client spaces:** Home, Projects, Messages, AI Chat
   - Default state: `text-chrome-foreground/60`
   - Active state: `text-primary` with a 3px left-edge cyan bar (rounded) and `bg-primary-glow` background
   - Hover: `bg-chrome-muted` with tooltip (Framer Motion fade, 150ms delay)
   - Icons from lucide-react: `LayoutGrid`, `Folders`, `MessageSquare`, `Sparkles`

3. **Divider** (`webdock-divider.tsx`): 1px `bg-chrome-border`, 36px wide, centered.

4. **Group Icons** (rounded square, 40px): Contextual to the active space.
   - When "Workspaces" space is active → each workspace appears as a group icon
   - When "Projects" space is active → each project appears as a group icon
   - When "Messages" space is active → recent threads appear
   - Active group: cyan ring (2px border), slight scale-up
   - Unread badge: Small red circle (16px) with white count text, top-right of icon. `bg-unread`. Framer Motion `scale` spring animation when count changes.
   - "+" icon at the bottom of groups to create new workspace/project

5. **Spacer** (`flex-1`)

6. **Bottom controls:**
   - Settings cog icon (`Settings` from lucide-react)
   - User avatar (32px circle) with green online-status dot (4px, bottom-right). Opens a dropdown: profile, locale switcher, logout.

### 2.2 Toolbar (Top Bar, 48px tall)

Full width minus webdock. `bg-chrome`, subtle `border-b border-chrome-border`.

**Left section:**
- Current group name (e.g., workspace name, "All Projects"). `text-chrome-foreground`, `font-semibold`, `text-sm`.
- Breadcrumb separator and sub-context if applicable.

**Center section:**
- Tabstrip (`toolbar-tabstrip.tsx`): Horizontal tabs for the active group.
  - Only shown when a group (workspace/project) is selected.
  - Freelancer workspace tabs: Overview, Apps, Notes, Messages, Timeline, AI Briefing, Access
  - Client project tabs: Overview, Freelancer, Messages, Timeline, Changes
  - Active tab: `text-primary` with 2px cyan bottom border. The border uses Framer Motion `layoutId="active-tab"` for smooth sliding animation between tabs.
  - Inactive: `text-chrome-foreground/60`, hover → `text-chrome-foreground`

**Right section:**
- Search button (magnifying glass icon, triggers cmd+K dialog later)
- Notification bell (with optional unread dot)
- Locale switcher (Globe icon, dropdown with en/es/ru)

### 2.3 Content Area

The remainder of the viewport. `bg-content-bg`. Scrollable independently.

- Subtle `inset shadow` at top edge (1px, `shadow-[inset_0_1px_0_0_rgba(0,0,0,0.06)]`) for depth against the toolbar.
- All page content renders here.
- Padding: `p-6` default, pages can override.

### 2.4 Component Files

```
src/components/app-shell/
  app-shell.tsx            → <AppShell role="freelancer"|"client"> wrapper
  webdock.tsx              → Full left sidebar assembly
  webdock-space-icon.tsx   → Circle icon with active state + tooltip
  webdock-group-icon.tsx   → Rounded-square icon with badge + active ring
  webdock-divider.tsx      → Horizontal separator (1px)
  toolbar.tsx              → Top bar: left title + center tabstrip + right actions
  toolbar-tabstrip.tsx     → Horizontal tabs with animated active indicator
  content-area.tsx         → Scrollable content wrapper
```

### 2.5 Integration Points

- `src/app/freelancer/hub/layout.tsx` — Wraps children in `<AppShell role="freelancer">`
- `src/app/client/dashboard/layout.tsx` — New file. Wraps client dashboard in `<AppShell role="client">`
- The current `hub-sidebar.tsx` is replaced by the webdock
- The current tab list in `workspace-detail.tsx` is replaced by `toolbar-tabstrip.tsx`

---

## 3. Animation System

### 3.1 Package

Install `framer-motion` (latest). ~32kb gzipped. Provides:
- `motion` components for declarative animations
- `AnimatePresence` for enter/exit transitions
- `layoutId` for shared layout animations
- `useInView` for scroll-triggered reveals
- Spring physics for natural-feeling motion

### 3.2 Animation Presets

**File: `src/lib/motion.ts`**

Exported as plain objects compatible with Framer Motion's `variants` or spread into `initial`/`animate` props:

| Preset | Animation | Duration | Use case |
|---|---|---|---|
| `fadeIn` | opacity 0→1 | 300ms | Generic fade |
| `fadeInUp` | opacity 0→1, y 16→0 | 400ms | Cards, sections, page content |
| `fadeInDown` | opacity 0→1, y -16→0 | 400ms | Dropdowns, tooltips |
| `fadeInLeft` | opacity 0→1, x -16→0 | 400ms | Sidebar items |
| `scaleIn` | opacity 0→1, scale 0.95→1 | 300ms | Modals, dialogs, popovers |
| `slideInRight` | x 100%→0 | 350ms ease-out | Sheets, side panels |
| `slideInLeft` | x -100%→0 | 350ms ease-out | Mobile sidebar |
| `spring` | type: spring, stiffness: 300, damping: 30 | — | Bouncy interactions |

**Stagger presets:**

| Preset | Config |
|---|---|
| `staggerContainer` | `{ staggerChildren: 0.06 }` — parent variant |
| `staggerItem` | `fadeInUp` — child variant, inherits stagger delay |

### 3.3 Motion Wrapper Components

**File directory: `src/components/motion/`**

| Component | Props | Behavior |
|---|---|---|
| `<MotionDiv preset="fadeInUp">` | `preset`, `delay?`, `className?`, `children` | Pre-configured `motion.div` with named preset |
| `<AnimateList>` | `children` (array) | Wraps children with `staggerContainer`/`staggerItem` for sequential entrance |
| `<PageTransition>` | `children` | Wraps page content with `fadeInUp` on mount. No exit animation (feels sluggish in App Router). |
| `<ScrollReveal>` | `children`, `preset?` | Uses `whileInView` to trigger animation when element enters viewport. Default preset: `fadeInUp`. `viewport={{ once: true, margin: "-80px" }}` |
| `<TabTransition activeKey={string}>` | `activeKey`, `children` | `AnimatePresence` wrapper for tab content. Crossfades with slight x-slide on key change. |

### 3.4 Specific Animation Behaviors

**Webdock interactions:**
- Space/group icon hover: `scale: 1.08` with spring transition
- Active tab underline: `layoutId="active-tab"` on a `motion.div` for smooth sliding
- Unread badge count change: `scale` spring (0.5 → 1.2 → 1.0)
- Tooltip: `fadeIn` with 150ms delay on hover, instant exit

**Content transitions:**
- Workspace/project cards in grid: `AnimateList` with staggered `fadeInUp`
- Tab content switching: `TabTransition` with fade + 8px x-slide
- Modal/dialog open: `scaleIn` preset
- Sheet/panel open: `slideInRight` preset

**Loading transitions:**
- Skeleton → real content: `AnimatePresence` crossfade (skeleton exits with `fadeOut`, content enters with `fadeIn`)

---

## 4. Skeleton Loaders

Replace all `Loader2` spinner usage with content-shaped skeleton placeholders.

### 4.1 Components

**File directory: `src/components/ui/`**

| Component | Shape | Usage |
|---|---|---|
| `skeleton-card.tsx` | Rounded rect with header bar + 3 text lines + optional footer bar | Workspace cards, project cards |
| `skeleton-list.tsx` | N stacked rows, each with circle (avatar) + 2 text lines | Thread lists, activity feeds, note lists |
| `skeleton-tabs.tsx` | Tab bar (3-4 rectangles) + content placeholder below | Workspace detail, project detail |

### 4.2 Styling

- Light content areas: `bg-muted` base with `animate-shimmer` (CSS gradient sweep left→right, 1.5s infinite)
- Dark chrome areas: `bg-chrome-muted` base with same shimmer
- Rounded corners match the component they replace
- The `animate-shimmer` keyframe is added to `globals.css`:
  ```css
  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
  ```

### 4.3 Transition Pattern

All skeleton → content transitions use `AnimatePresence`:
```tsx
<AnimatePresence mode="wait">
  {isLoading ? (
    <motion.div key="skeleton" exit={{ opacity: 0 }} ...>
      <SkeletonCard />
    </motion.div>
  ) : (
    <motion.div key="content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} ...>
      <RealContent />
    </motion.div>
  )}
</AnimatePresence>
```

---

## 5. Empty State Component

**File: `src/components/ui/empty-state.tsx`**

A consistent empty state pattern used across all views.

**Props:**
- `icon`: Lucide icon component
- `title`: string
- `description`: string
- `action?`: `{ label: string, onClick: () => void }` — optional CTA button

**Styling:**
- Centered in content area (`flex flex-col items-center justify-center`)
- Icon: 48px, `text-muted-foreground/40`
- Title: `text-lg font-semibold text-foreground`
- Description: `text-sm text-muted-foreground`, max-w-sm, centered
- Action button: `<Button variant="outline">` below description
- Entrance animation: `fadeInUp` preset

**Used for:** No workspaces, no projects, no messages, no activity, no notes, no bookmarks, no connections, no briefings.

---

## 6. File Map

### New Files

```
src/lib/motion.ts                          — Animation presets
src/components/motion/motion-div.tsx       — Preset-based motion wrapper
src/components/motion/animate-list.tsx     — Staggered list animation
src/components/motion/page-transition.tsx  — Page mount animation
src/components/motion/scroll-reveal.tsx    — Scroll-triggered animation
src/components/motion/tab-transition.tsx   — Tab content crossfade
src/components/app-shell/app-shell.tsx     — Main layout wrapper
src/components/app-shell/webdock.tsx       — Left sidebar assembly
src/components/app-shell/webdock-space-icon.tsx
src/components/app-shell/webdock-group-icon.tsx
src/components/app-shell/webdock-divider.tsx
src/components/app-shell/toolbar.tsx       — Top bar
src/components/app-shell/toolbar-tabstrip.tsx
src/components/app-shell/content-area.tsx
src/components/ui/skeleton-card.tsx
src/components/ui/skeleton-list.tsx
src/components/ui/skeleton-tabs.tsx
src/components/ui/empty-state.tsx
```

### Modified Files

```
src/app/globals.css                        — Add chrome tokens + shimmer keyframe
src/app/freelancer/hub/layout.tsx          — Use <AppShell role="freelancer">
src/app/client/dashboard/layout.tsx        — New layout using <AppShell role="client">
package.json                               — Add framer-motion
```

---

## 7. Out of Scope

These are handled by subsequent sub-projects:

- Landing page animations and redesign (Sub-project 2)
- Auth page redesign (Sub-project 3)
- Refactoring hub components to use new shell (Sub-project 4)
- Refactoring client dashboard to use new shell (Sub-project 5)
- Header navigation, community page, checkout page (Sub-project 6)
