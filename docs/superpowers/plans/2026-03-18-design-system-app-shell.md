# Design System + App Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the foundational design system (dark chrome color tokens, Framer Motion animation primitives, skeleton loaders) and a Wavebox-inspired app shell component shared by both freelancer and client portals.

**Architecture:** New CSS tokens for dark chrome surfaces extend the existing Tailwind v4 theme. A reusable `<AppShell>` component provides webdock (left sidebar with space/group icons) + toolbar (top bar with tabstrip) + content area. Animation presets in `src/lib/motion.ts` power wrapper components in `src/components/motion/`. Skeleton loaders replace spinner-based loading states.

**Tech Stack:** Next.js 15 App Router, Tailwind CSS v4, Framer Motion, shadcn/ui, lucide-react, next-intl

---

## File Map

### New Files

| File | Responsibility |
|---|---|
| `src/lib/motion.ts` | Animation preset objects (fadeIn, fadeInUp, stagger, spring, etc.) |
| `src/components/motion/motion-div.tsx` | `<MotionDiv>` — preset-based motion wrapper |
| `src/components/motion/animate-list.tsx` | `<AnimateList>` — staggered list entrance |
| `src/components/motion/page-transition.tsx` | `<PageTransition>` — page mount animation |
| `src/components/motion/scroll-reveal.tsx` | `<ScrollReveal>` — viewport-triggered animation |
| `src/components/motion/tab-transition.tsx` | `<TabTransition>` — tab content crossfade |
| `src/components/app-shell/app-shell.tsx` | `<AppShell>` — main layout: webdock + toolbar + content |
| `src/components/app-shell/webdock.tsx` | Left sidebar: spaces, groups, avatar |
| `src/components/app-shell/webdock-space-icon.tsx` | Circle nav icon with active bar + tooltip |
| `src/components/app-shell/webdock-group-icon.tsx` | Rounded-square icon with unread badge |
| `src/components/app-shell/webdock-divider.tsx` | 1px horizontal separator |
| `src/components/app-shell/toolbar.tsx` | Top bar: title + tabstrip + actions |
| `src/components/app-shell/toolbar-tabstrip.tsx` | Horizontal tabs with animated active underline |
| `src/components/app-shell/content-area.tsx` | Scrollable content wrapper |
| `src/components/ui/skeleton-card.tsx` | Card-shaped skeleton loader |
| `src/components/ui/skeleton-list.tsx` | List-shaped skeleton loader |
| `src/components/ui/skeleton-tabs.tsx` | Tab+content skeleton loader |
| `src/components/ui/empty-state.tsx` | Consistent empty state with icon + CTA |

### Modified Files

| File | Change |
|---|---|
| `src/app/globals.css` | Add chrome-* tokens to @theme, add shimmer keyframe |
| `src/app/freelancer/hub/layout.tsx` | Replace HubSidebar with `<AppShell role="freelancer">` |
| `src/app/client/dashboard/page.tsx` | Wrap in layout with `<AppShell role="client">` |
| `package.json` | Add `framer-motion` |

---

## Chunk 1: Foundation (Tokens + Animation Library)

### Task 1: Install Framer Motion

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install framer-motion**

```bash
cd /home/user/studio && npm install framer-motion
```

- [ ] **Step 2: Verify installation**

```bash
node -e "require('framer-motion'); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install framer-motion"
```

---

### Task 2: Add Chrome Color Tokens

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add chrome tokens and shimmer keyframe to globals.css**

Insert the following tokens inside the existing `@theme { }` block, after the existing `--animate-accordion-up` line (line 55):

```css
  /* Chrome (dark sidebar/toolbar) tokens */
  --color-chrome: hsl(220 30% 12%);
  --color-chrome-foreground: hsl(210 20% 92%);
  --color-chrome-muted: hsl(220 20% 22%);
  --color-chrome-border: hsl(220 15% 20%);
  --color-primary-glow: hsl(197 100% 50% / 0.15);
  --color-content-bg: hsl(210 20% 98%);
  --color-accent-green: hsl(142 71% 45%);
  --color-accent-amber: hsl(38 92% 50%);
  --color-accent-red: hsl(0 72% 51%);
  --color-unread: hsl(0 72% 51%);

  --animate-shimmer: shimmer 1.5s infinite linear;
```

Also update `--color-primary` to the logo cyan:

```css
  --color-primary: hsl(197 100% 50%);
```

Add the shimmer keyframe after the existing `accordion-up` keyframe (after line 96):

```css
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
```

- [ ] **Step 2: Verify the dev server starts without CSS errors**

```bash
npx next build 2>&1 | tail -5
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(design): add chrome color tokens and shimmer keyframe"
```

---

### Task 3: Animation Presets Library

**Files:**
- Create: `src/lib/motion.ts`

- [ ] **Step 1: Create the animation presets file**

```typescript
import type { Variants, Transition } from 'framer-motion';

// --- Transition configs ---

export const springTransition: Transition = {
  type: 'spring',
  stiffness: 300,
  damping: 30,
};

export const easeTransition: Transition = {
  duration: 0.3,
  ease: [0.25, 0.1, 0.25, 1],
};

// --- Animation presets ---
// Each preset is { initial, animate, exit? } for spreading into motion components.

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.3 } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
};

export const fadeInUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.2 } },
};

export const fadeInDown = {
  initial: { opacity: 0, y: -16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] } },
  exit: { opacity: 0, y: 8, transition: { duration: 0.2 } },
};

export const fadeInLeft = {
  initial: { opacity: 0, x: -16 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] } },
  exit: { opacity: 0, x: -16, transition: { duration: 0.2 } },
};

export const scaleIn = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1, transition: { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] } },
  exit: { opacity: 0, scale: 0.95, transition: { duration: 0.2 } },
};

export const slideInRight = {
  initial: { x: '100%' },
  animate: { x: 0, transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] } },
  exit: { x: '100%', transition: { duration: 0.3 } },
};

export const slideInLeft = {
  initial: { x: '-100%' },
  animate: { x: 0, transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] } },
  exit: { x: '-100%', transition: { duration: 0.3 } },
};

// --- Stagger variants ---

export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.06 },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] },
  },
};

// --- Preset map for MotionDiv ---

export const presets = {
  fadeIn,
  fadeInUp,
  fadeInDown,
  fadeInLeft,
  scaleIn,
  slideInRight,
  slideInLeft,
} as const;

export type PresetName = keyof typeof presets;
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit --pretty 2>&1 | head -10
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/motion.ts
git commit -m "feat(motion): add animation presets library"
```

---

### Task 4: Motion Wrapper Components

**Files:**
- Create: `src/components/motion/motion-div.tsx`
- Create: `src/components/motion/animate-list.tsx`
- Create: `src/components/motion/page-transition.tsx`
- Create: `src/components/motion/scroll-reveal.tsx`
- Create: `src/components/motion/tab-transition.tsx`

- [ ] **Step 1: Create MotionDiv**

`src/components/motion/motion-div.tsx`:

```tsx
'use client';

import { motion } from 'framer-motion';
import { presets, type PresetName } from '@/lib/motion';

interface MotionDivProps {
  preset?: PresetName;
  delay?: number;
  className?: string;
  children: React.ReactNode;
}

export function MotionDiv({
  preset = 'fadeInUp',
  delay,
  className,
  children,
}: MotionDivProps) {
  const p = presets[preset];
  const animate = delay
    ? { ...p.animate, transition: { ...p.animate.transition, delay } }
    : p.animate;

  return (
    <motion.div initial={p.initial} animate={animate} className={className}>
      {children}
    </motion.div>
  );
}
```

- [ ] **Step 2: Create AnimateList**

`src/components/motion/animate-list.tsx`:

```tsx
'use client';

import { motion } from 'framer-motion';
import { staggerContainer, staggerItem } from '@/lib/motion';
import React from 'react';

interface AnimateListProps {
  className?: string;
  children: React.ReactNode;
}

export function AnimateList({ className, children }: AnimateListProps) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className={className}
    >
      {React.Children.map(children, (child) => (
        <motion.div variants={staggerItem}>{child}</motion.div>
      ))}
    </motion.div>
  );
}
```

- [ ] **Step 3: Create PageTransition**

`src/components/motion/page-transition.tsx`:

```tsx
'use client';

import { motion } from 'framer-motion';
import { fadeInUp } from '@/lib/motion';

interface PageTransitionProps {
  className?: string;
  children: React.ReactNode;
}

export function PageTransition({ className, children }: PageTransitionProps) {
  return (
    <motion.div
      initial={fadeInUp.initial}
      animate={fadeInUp.animate}
      className={className}
    >
      {children}
    </motion.div>
  );
}
```

- [ ] **Step 4: Create ScrollReveal**

`src/components/motion/scroll-reveal.tsx`:

```tsx
'use client';

import { motion } from 'framer-motion';
import { presets, type PresetName } from '@/lib/motion';

interface ScrollRevealProps {
  preset?: PresetName;
  className?: string;
  children: React.ReactNode;
}

export function ScrollReveal({
  preset = 'fadeInUp',
  className,
  children,
}: ScrollRevealProps) {
  const p = presets[preset];

  return (
    <motion.div
      initial={p.initial}
      whileInView={p.animate}
      viewport={{ once: true, margin: '-80px' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
```

- [ ] **Step 5: Create TabTransition**

`src/components/motion/tab-transition.tsx`:

```tsx
'use client';

import { AnimatePresence, motion } from 'framer-motion';

interface TabTransitionProps {
  activeKey: string;
  className?: string;
  children: React.ReactNode;
}

export function TabTransition({
  activeKey,
  className,
  children,
}: TabTransitionProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={activeKey}
        initial={{ opacity: 0, x: 8 }}
        animate={{ opacity: 1, x: 0, transition: { duration: 0.25 } }}
        exit={{ opacity: 0, x: -8, transition: { duration: 0.15 } }}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npx tsc --noEmit --pretty 2>&1 | head -10
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/motion/
git commit -m "feat(motion): add MotionDiv, AnimateList, PageTransition, ScrollReveal, TabTransition"
```

---

## Chunk 2: Skeleton Loaders + Empty State

### Task 5: Skeleton Loader Components

**Files:**
- Create: `src/components/ui/skeleton-card.tsx`
- Create: `src/components/ui/skeleton-list.tsx`
- Create: `src/components/ui/skeleton-tabs.tsx`

- [ ] **Step 1: Create SkeletonCard**

`src/components/ui/skeleton-card.tsx`:

```tsx
interface SkeletonCardProps {
  count?: number;
  className?: string;
}

function SingleCard() {
  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-4">
      <div className="h-5 w-2/3 rounded bg-muted animate-shimmer bg-[length:200%_100%] bg-gradient-to-r from-muted via-muted/60 to-muted" />
      <div className="space-y-2">
        <div className="h-3 w-full rounded bg-muted animate-shimmer bg-[length:200%_100%] bg-gradient-to-r from-muted via-muted/60 to-muted" />
        <div className="h-3 w-5/6 rounded bg-muted animate-shimmer bg-[length:200%_100%] bg-gradient-to-r from-muted via-muted/60 to-muted" />
        <div className="h-3 w-3/4 rounded bg-muted animate-shimmer bg-[length:200%_100%] bg-gradient-to-r from-muted via-muted/60 to-muted" />
      </div>
      <div className="h-4 w-1/3 rounded bg-muted animate-shimmer bg-[length:200%_100%] bg-gradient-to-r from-muted via-muted/60 to-muted" />
    </div>
  );
}

export function SkeletonCard({ count = 1, className }: SkeletonCardProps) {
  return (
    <div className={className}>
      {Array.from({ length: count }, (_, i) => (
        <SingleCard key={i} />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create SkeletonList**

`src/components/ui/skeleton-list.tsx`:

```tsx
interface SkeletonListProps {
  rows?: number;
  className?: string;
}

function SingleRow() {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="h-9 w-9 rounded-full bg-muted animate-shimmer bg-[length:200%_100%] bg-gradient-to-r from-muted via-muted/60 to-muted shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3.5 w-2/3 rounded bg-muted animate-shimmer bg-[length:200%_100%] bg-gradient-to-r from-muted via-muted/60 to-muted" />
        <div className="h-3 w-1/2 rounded bg-muted animate-shimmer bg-[length:200%_100%] bg-gradient-to-r from-muted via-muted/60 to-muted" />
      </div>
    </div>
  );
}

export function SkeletonList({ rows = 5, className }: SkeletonListProps) {
  return (
    <div className={className}>
      {Array.from({ length: rows }, (_, i) => (
        <SingleRow key={i} />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Create SkeletonTabs**

`src/components/ui/skeleton-tabs.tsx`:

```tsx
interface SkeletonTabsProps {
  tabs?: number;
  className?: string;
}

export function SkeletonTabs({ tabs = 4, className }: SkeletonTabsProps) {
  return (
    <div className={className}>
      <div className="flex gap-4 border-b border-border pb-2 mb-6">
        {Array.from({ length: tabs }, (_, i) => (
          <div
            key={i}
            className="h-4 rounded bg-muted animate-shimmer bg-[length:200%_100%] bg-gradient-to-r from-muted via-muted/60 to-muted"
            style={{ width: `${60 + Math.random() * 40}px` }}
          />
        ))}
      </div>
      <div className="space-y-4">
        <div className="h-5 w-1/3 rounded bg-muted animate-shimmer bg-[length:200%_100%] bg-gradient-to-r from-muted via-muted/60 to-muted" />
        <div className="h-32 w-full rounded-lg bg-muted animate-shimmer bg-[length:200%_100%] bg-gradient-to-r from-muted via-muted/60 to-muted" />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/skeleton-card.tsx src/components/ui/skeleton-list.tsx src/components/ui/skeleton-tabs.tsx
git commit -m "feat(ui): add skeleton-card, skeleton-list, skeleton-tabs loaders"
```

---

### Task 6: Empty State Component

**Files:**
- Create: `src/components/ui/empty-state.tsx`

- [ ] **Step 1: Create the empty state component**

`src/components/ui/empty-state.tsx`:

```tsx
'use client';

import { type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MotionDiv } from '@/components/motion/motion-div';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <MotionDiv preset="fadeInUp" className={className}>
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Icon className="h-12 w-12 text-muted-foreground/40 mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-1">{title}</h3>
        <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
        {action && (
          <Button
            variant="outline"
            onClick={action.onClick}
            className="mt-4"
          >
            {action.label}
          </Button>
        )}
      </div>
    </MotionDiv>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit --pretty 2>&1 | head -10
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/empty-state.tsx
git commit -m "feat(ui): add reusable EmptyState component with animation"
```

---

## Chunk 3: App Shell — Webdock

### Task 7: Webdock Primitive Components

**Files:**
- Create: `src/components/app-shell/webdock-space-icon.tsx`
- Create: `src/components/app-shell/webdock-group-icon.tsx`
- Create: `src/components/app-shell/webdock-divider.tsx`

- [ ] **Step 1: Create WebdockSpaceIcon**

`src/components/app-shell/webdock-space-icon.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { type LucideIcon } from 'lucide-react';
import { springTransition } from '@/lib/motion';

interface WebdockSpaceIconProps {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  onClick?: () => void;
}

export function WebdockSpaceIcon({
  icon: Icon,
  label,
  active = false,
  onClick,
}: WebdockSpaceIconProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div className="relative flex items-center justify-center">
      {/* Active indicator bar */}
      {active && (
        <motion.div
          layoutId="space-active-bar"
          className="absolute left-0 w-[3px] h-5 rounded-r-full bg-primary"
          transition={springTransition}
        />
      )}

      <motion.button
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        whileHover={{ scale: 1.08 }}
        transition={springTransition}
        className={`relative flex items-center justify-center w-9 h-9 rounded-full transition-colors ${
          active
            ? 'bg-primary-glow text-primary'
            : 'text-chrome-foreground/60 hover:bg-chrome-muted hover:text-chrome-foreground'
        }`}
      >
        <Icon className="h-[18px] w-[18px]" />
      </motion.button>

      {/* Tooltip */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0, x: 4 }}
            animate={{ opacity: 1, x: 0, transition: { delay: 0.15 } }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            className="absolute left-[calc(100%+8px)] z-50 rounded-md bg-foreground px-2.5 py-1 text-xs font-medium text-background whitespace-nowrap shadow-lg"
          >
            {label}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 2: Create WebdockGroupIcon**

`src/components/app-shell/webdock-group-icon.tsx`:

```tsx
'use client';

import { motion } from 'framer-motion';
import { springTransition } from '@/lib/motion';

interface WebdockGroupIconProps {
  label: string;
  active?: boolean;
  unreadCount?: number;
  onClick?: () => void;
}

export function WebdockGroupIcon({
  label,
  active = false,
  unreadCount = 0,
  onClick,
}: WebdockGroupIconProps) {
  // Get initials from label (first 2 characters or first letters of first 2 words)
  const initials = label
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.08 }}
      transition={springTransition}
      className={`relative flex items-center justify-center w-10 h-10 rounded-lg text-xs font-semibold transition-colors ${
        active
          ? 'ring-2 ring-primary bg-chrome-muted text-primary'
          : 'bg-chrome-muted/60 text-chrome-foreground/70 hover:bg-chrome-muted hover:text-chrome-foreground'
      }`}
      title={label}
    >
      {initials}

      {/* Unread badge */}
      {unreadCount > 0 && (
        <motion.div
          key={unreadCount}
          initial={{ scale: 0.5 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 15 }}
          className="absolute -top-1 -right-1 flex items-center justify-center min-w-[16px] h-4 rounded-full bg-unread px-1"
        >
          <span className="text-[10px] font-bold text-white leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        </motion.div>
      )}
    </motion.button>
  );
}
```

- [ ] **Step 3: Create WebdockDivider**

`src/components/app-shell/webdock-divider.tsx`:

```tsx
export function WebdockDivider() {
  return (
    <div className="flex justify-center py-2">
      <div className="w-9 h-px bg-chrome-border" />
    </div>
  );
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit --pretty 2>&1 | head -10
```

- [ ] **Step 5: Commit**

```bash
git add src/components/app-shell/
git commit -m "feat(shell): add webdock primitives — space icon, group icon, divider"
```

---

### Task 8: Webdock Assembly

**Files:**
- Create: `src/components/app-shell/webdock.tsx`

The webdock reads the `role` prop to determine which space icons and group data to show. It uses React context or URL state to track the active space and group.

- [ ] **Step 1: Create the webdock component**

`src/components/app-shell/webdock.tsx`:

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutGrid,
  Folders,
  Briefcase,
  MessageSquare,
  Sparkles,
  Settings,
  Plus,
  LogOut,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/contexts/auth-context';
import { signOutUser } from '@/services/firestore';
import { WebdockSpaceIcon } from './webdock-space-icon';
import { WebdockGroupIcon } from './webdock-group-icon';
import { WebdockDivider } from './webdock-divider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';

type SpaceId = 'home' | 'workspaces' | 'projects' | 'messages' | 'ai';

interface WebdockProps {
  role: 'freelancer' | 'client';
  groups?: Array<{
    id: string;
    label: string;
    unreadCount?: number;
    href: string;
  }>;
  onCreateGroup?: () => void;
}

const FREELANCER_SPACES = [
  { id: 'home' as SpaceId, icon: LayoutGrid, label: 'Home', href: '/freelancer/hub' },
  { id: 'workspaces' as SpaceId, icon: Folders, label: 'Workspaces', href: '/freelancer/hub' },
  { id: 'messages' as SpaceId, icon: MessageSquare, label: 'Messages', href: '/freelancer/hub' },
  { id: 'ai' as SpaceId, icon: Sparkles, label: 'AI', href: '/freelancer/hub' },
];

const CLIENT_SPACES = [
  { id: 'home' as SpaceId, icon: LayoutGrid, label: 'Home', href: '/client/dashboard' },
  { id: 'projects' as SpaceId, icon: Briefcase, label: 'Projects', href: '/client/dashboard' },
  { id: 'messages' as SpaceId, icon: MessageSquare, label: 'Messages', href: '/client/dashboard' },
  { id: 'ai' as SpaceId, icon: Sparkles, label: 'AI Chat', href: '/client/dashboard' },
];

export function Webdock({ role, groups = [], onCreateGroup }: WebdockProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const t = useTranslations('sidebar');
  const spaces = role === 'freelancer' ? FREELANCER_SPACES : CLIENT_SPACES;

  // Derive active space from URL
  const [activeSpace, setActiveSpace] = useState<SpaceId>('home');

  // Derive active group from URL
  const activeGroupId = groups.find((g) => pathname.startsWith(g.href))?.id ?? null;

  return (
    <aside className="w-[60px] h-full bg-chrome flex flex-col items-center py-3 shrink-0">
      {/* Logo */}
      <Link href="/" className="mb-4">
        <div className="w-7 h-7 rounded bg-primary flex items-center justify-center">
          <span className="text-white font-bold text-xs">H</span>
        </div>
      </Link>

      {/* Space icons */}
      <div className="flex flex-col items-center gap-1.5">
        {spaces.map((space) => (
          <WebdockSpaceIcon
            key={space.id}
            icon={space.icon}
            label={space.label}
            active={activeSpace === space.id}
            onClick={() => setActiveSpace(space.id)}
          />
        ))}
      </div>

      <WebdockDivider />

      {/* Group icons */}
      <ScrollArea className="flex-1 w-full">
        <div className="flex flex-col items-center gap-1.5 px-[10px]">
          {groups.map((group) => (
            <Link key={group.id} href={group.href}>
              <WebdockGroupIcon
                label={group.label}
                active={activeGroupId === group.id}
                unreadCount={group.unreadCount}
              />
            </Link>
          ))}

          {onCreateGroup && (
            <button
              onClick={onCreateGroup}
              className="flex items-center justify-center w-10 h-10 rounded-lg border border-dashed border-chrome-border text-chrome-foreground/40 hover:text-chrome-foreground hover:border-chrome-foreground/40 transition-colors"
            >
              <Plus className="h-4 w-4" />
            </button>
          )}
        </div>
      </ScrollArea>

      {/* Bottom controls */}
      <div className="flex flex-col items-center gap-2 mt-2">
        <button className="text-chrome-foreground/60 hover:text-chrome-foreground transition-colors">
          <Settings className="h-[18px] w-[18px]" />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="relative">
              <div className="w-8 h-8 rounded-full bg-chrome-muted flex items-center justify-center text-xs font-semibold text-chrome-foreground">
                {user?.email?.[0]?.toUpperCase() ?? 'U'}
              </div>
              <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-accent-green border-2 border-chrome" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="end" className="w-48">
            <DropdownMenuItem className="text-xs text-muted-foreground" disabled>
              {user?.email}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => signOutUser()}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit --pretty 2>&1 | head -10
```

- [ ] **Step 3: Commit**

```bash
git add src/components/app-shell/webdock.tsx
git commit -m "feat(shell): add webdock sidebar assembly with spaces, groups, avatar"
```

---

## Chunk 4: App Shell — Toolbar + Content Area + Integration

### Task 9: Toolbar and Content Area

**Files:**
- Create: `src/components/app-shell/toolbar-tabstrip.tsx`
- Create: `src/components/app-shell/toolbar.tsx`
- Create: `src/components/app-shell/content-area.tsx`

- [ ] **Step 1: Create ToolbarTabstrip**

`src/components/app-shell/toolbar-tabstrip.tsx`:

```tsx
'use client';

import { motion } from 'framer-motion';
import { springTransition } from '@/lib/motion';

export interface TabDef {
  id: string;
  label: string;
}

interface ToolbarTabstripProps {
  tabs: TabDef[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export function ToolbarTabstrip({
  tabs,
  activeTab,
  onTabChange,
}: ToolbarTabstripProps) {
  return (
    <div className="flex items-center gap-1 h-full">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`relative px-3 h-full text-xs font-medium transition-colors ${
              isActive
                ? 'text-primary'
                : 'text-chrome-foreground/60 hover:text-chrome-foreground'
            }`}
          >
            {tab.label}
            {isActive && (
              <motion.div
                layoutId="active-tab"
                className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary"
                transition={springTransition}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Create Toolbar**

`src/components/app-shell/toolbar.tsx`:

```tsx
'use client';

import { Search, Bell, Globe } from 'lucide-react';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ToolbarTabstrip, type TabDef } from './toolbar-tabstrip';

interface ToolbarProps {
  title: string;
  tabs?: TabDef[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
}

export function Toolbar({ title, tabs, activeTab, onTabChange }: ToolbarProps) {
  const locale = useLocale();
  const router = useRouter();

  function switchLocale(newLocale: string) {
    document.cookie = `NEXT_LOCALE=${newLocale};path=/;max-age=31536000`;
    router.refresh();
  }

  return (
    <div className="h-12 bg-chrome border-b border-chrome-border flex items-center px-4 shrink-0">
      {/* Left: title */}
      <div className="text-sm font-semibold text-chrome-foreground mr-4 shrink-0">
        {title}
      </div>

      {/* Center: tabstrip */}
      {tabs && activeTab && onTabChange && (
        <div className="flex-1 h-full flex items-center overflow-x-auto">
          <ToolbarTabstrip
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={onTabChange}
          />
        </div>
      )}

      {!tabs && <div className="flex-1" />}

      {/* Right: actions */}
      <div className="flex items-center gap-1 shrink-0 ml-4">
        <button className="p-2 text-chrome-foreground/60 hover:text-chrome-foreground transition-colors rounded-md hover:bg-chrome-muted">
          <Search className="h-4 w-4" />
        </button>

        <button className="p-2 text-chrome-foreground/60 hover:text-chrome-foreground transition-colors rounded-md hover:bg-chrome-muted relative">
          <Bell className="h-4 w-4" />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-2 text-chrome-foreground/60 hover:text-chrome-foreground transition-colors rounded-md hover:bg-chrome-muted">
              <Globe className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {(['en', 'es', 'ru'] as const).map((loc) => (
              <DropdownMenuItem
                key={loc}
                onClick={() => switchLocale(loc)}
                className={locale === loc ? 'font-semibold' : ''}
              >
                {{ en: 'English', es: 'Español', ru: 'Русский' }[loc]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create ContentArea**

`src/components/app-shell/content-area.tsx`:

```tsx
import { ScrollArea } from '@/components/ui/scroll-area';

interface ContentAreaProps {
  children: React.ReactNode;
  className?: string;
}

export function ContentArea({ children, className }: ContentAreaProps) {
  return (
    <ScrollArea className="flex-1">
      <div
        className={`bg-content-bg min-h-full shadow-[inset_0_1px_0_0_rgba(0,0,0,0.06)] ${className ?? 'p-6'}`}
      >
        {children}
      </div>
    </ScrollArea>
  );
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit --pretty 2>&1 | head -10
```

- [ ] **Step 5: Commit**

```bash
git add src/components/app-shell/toolbar-tabstrip.tsx src/components/app-shell/toolbar.tsx src/components/app-shell/content-area.tsx
git commit -m "feat(shell): add toolbar with tabstrip, locale switcher, and content area"
```

---

### Task 10: AppShell Wrapper

**Files:**
- Create: `src/components/app-shell/app-shell.tsx`

- [ ] **Step 1: Create the main AppShell component**

`src/components/app-shell/app-shell.tsx`:

```tsx
'use client';

import { Webdock } from './webdock';
import { Toolbar } from './toolbar';
import { ContentArea } from './content-area';
import type { TabDef } from './toolbar-tabstrip';

interface AppShellProps {
  role: 'freelancer' | 'client';
  title?: string;
  tabs?: TabDef[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  groups?: Array<{
    id: string;
    label: string;
    unreadCount?: number;
    href: string;
  }>;
  onCreateGroup?: () => void;
  children: React.ReactNode;
  contentClassName?: string;
}

export function AppShell({
  role,
  title = '',
  tabs,
  activeTab,
  onTabChange,
  groups,
  onCreateGroup,
  children,
  contentClassName,
}: AppShellProps) {
  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Webdock role={role} groups={groups} onCreateGroup={onCreateGroup} />
      <div className="flex flex-col flex-1 min-w-0">
        <Toolbar
          title={title}
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={onTabChange}
        />
        <ContentArea className={contentClassName}>{children}</ContentArea>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit --pretty 2>&1 | head -10
```

- [ ] **Step 3: Commit**

```bash
git add src/components/app-shell/app-shell.tsx
git commit -m "feat(shell): add AppShell layout wrapper combining webdock + toolbar + content"
```

---

### Task 11: Integrate AppShell into Hub Layout

**Files:**
- Modify: `src/app/freelancer/hub/layout.tsx`

This replaces the current `HubSidebar` with the new `AppShell`. The hub-sidebar.tsx file is NOT deleted (sub-project 4 handles the full portal revamp). Instead we swap the layout to use the new shell while keeping existing pages functional.

- [ ] **Step 1: Update the hub layout**

Replace the entire content of `src/app/freelancer/hub/layout.tsx`:

```tsx
'use client';

import { useAuth } from '@/contexts/auth-context';
import { useWorkspaces } from '@/hooks/hub/use-workspace';
import { AppShell } from '@/components/app-shell/app-shell';
import { Loader2 } from 'lucide-react';

export default function HubLayout({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { data: workspaces = [] } = useWorkspaces(user?.uid ?? '');

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-chrome">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-chrome">
        <p className="text-chrome-foreground">Please log in to access the hub.</p>
      </div>
    );
  }

  const groups = workspaces
    .filter((w) => w.status === 'active')
    .map((w) => ({
      id: w.id,
      label: w.name,
      href: `/freelancer/hub/${w.id}`,
    }));

  return (
    <AppShell
      role="freelancer"
      title="Workspaces"
      groups={groups}
    >
      {children}
    </AppShell>
  );
}
```

- [ ] **Step 2: Verify the build succeeds**

```bash
npx next build 2>&1 | tail -10
```

Expected: Build succeeds, `/freelancer/hub` route present.

- [ ] **Step 3: Commit**

```bash
git add src/app/freelancer/hub/layout.tsx
git commit -m "feat(shell): integrate AppShell into freelancer hub layout"
```

---

### Task 12: Add Client Dashboard Layout with AppShell

**Files:**
- Create: `src/app/client/dashboard/layout.tsx`

- [ ] **Step 1: Create the client dashboard layout**

`src/app/client/dashboard/layout.tsx`:

```tsx
'use client';

import { useAuth } from '@/contexts/auth-context';
import { AppShell } from '@/components/app-shell/app-shell';
import { Loader2 } from 'lucide-react';

export default function ClientDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-chrome">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-chrome">
        <p className="text-chrome-foreground">Please log in to access the dashboard.</p>
      </div>
    );
  }

  return (
    <AppShell role="client" title="Dashboard">
      {children}
    </AppShell>
  );
}
```

- [ ] **Step 2: Verify the build succeeds**

```bash
npx next build 2>&1 | tail -10
```

Expected: Build succeeds, `/client/dashboard` route present.

- [ ] **Step 3: Commit**

```bash
git add src/app/client/dashboard/layout.tsx
git commit -m "feat(shell): add client dashboard layout with AppShell"
```

---

### Task 13: Final Build Verification

- [ ] **Step 1: Run full build**

```bash
cd /home/user/studio && npx next build 2>&1 | tail -15
```

Expected: Build succeeds with all routes listed.

- [ ] **Step 2: Start dev server and verify key routes**

```bash
npx next dev --port 9002 &
sleep 12
curl -s -o /dev/null -w "%{http_code}" http://localhost:9002/freelancer/hub
curl -s -o /dev/null -w "%{http_code}" http://localhost:9002/client/dashboard
curl -s -o /dev/null -w "%{http_code}" http://localhost:9002/
```

Expected: All return 200.

- [ ] **Step 3: Kill dev server**

```bash
fuser -k 9002/tcp 2>/dev/null
```
