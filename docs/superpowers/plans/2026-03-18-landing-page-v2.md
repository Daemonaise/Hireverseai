# Landing Page V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the landing page from 5 sections into 8 content-rich sections + expanded footer, replacing the AiMatcher hero with an interactive multi-step project builder.

**Architecture:** New presentational components in `src/components/landing/`, one new motion utility (`CountUp`). Page root (`src/app/page.tsx`) imports all sections in order. Light sections use explicit `bg-white text-gray-900` to override the page's `.dark` root class. AI flows are called client-side from the `ProjectBuilder` component.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS v4, Framer Motion, shadcn/ui, Lucide icons, existing AI flows (`generateProjectIdea`, `matchFreelancer`).

**Spec:** `docs/superpowers/specs/2026-03-18-landing-page-v2-design.md`

---

## File Map

### New Files
| File | Responsibility |
|------|---------------|
| `src/components/motion/count-up.tsx` | Animated number counter (scroll-triggered) |
| `src/components/landing/project-builder.tsx` | 3-step interactive hero form with stepper, category selection, description, AI preview |
| `src/components/landing/social-proof-bar.tsx` | Stats counters + integration logo pills |
| `src/components/landing/audience-block.tsx` | Reusable left/right feature block (props: side, label, heading, features, cta, children for mockup) |
| `src/components/landing/dashboard-mockup.tsx` | CSS-only client dashboard illustration |
| `src/components/landing/hub-mockup.tsx` | CSS-only freelancer hub illustration |
| `src/components/landing/pricing-preview.tsx` | 3-tier pricing cards from `TIER_CONFIGS` |
| `src/components/landing/testimonials-section.tsx` | 3 placeholder testimonial cards |
| `src/components/landing/dual-cta-section.tsx` | Split CTA for clients + freelancers |

### Modified Files
| File | Change |
|------|--------|
| `src/components/landing/hero-section.tsx` | Full rewrite — split layout, left copy + right ProjectBuilder |
| `src/components/landing/workflow-section.tsx` | Rewrite — 3 steps, dark background, new SVG geometry |
| `src/app/page.tsx` | Replace section imports with new 8-section structure + expanded footer |

### Deleted (imports removed, files kept for now)
| File | Reason |
|------|--------|
| `src/components/landing/features-section.tsx` | Content absorbed into audience blocks |
| `src/components/landing/community-section.tsx` | Content absorbed into freelancer block + testimonials |
| `src/components/landing/cta-section.tsx` | Replaced by dual-cta-section |

### Unchanged
| File | Reason |
|------|--------|
| `src/components/ai-matcher.tsx` | Still used in client dashboard |
| `src/components/landing/gradient-mesh.tsx` | Reused in new hero |
| `src/lib/motion.ts` | All presets used as-is |
| `src/lib/subscription.ts` | Tier data consumed by pricing-preview |

---

## Task 1: CountUp Motion Component

**Files:**
- Create: `src/components/motion/count-up.tsx`

- [ ] **Step 1: Create CountUp component**

```tsx
// src/components/motion/count-up.tsx
'use client';

import { useRef, useState, useEffect } from 'react';
import { useInView, useMotionValue, animate } from 'framer-motion';

interface CountUpProps {
  target: number;
  duration?: number;
  suffix?: string;
  prefix?: string;
  className?: string;
}

export function CountUp({
  target,
  duration = 2,
  suffix = '',
  prefix = '',
  className,
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  const motionValue = useMotionValue(0);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    const controls = animate(motionValue, target, {
      duration,
      ease: 'easeOut',
    });
    const unsubscribe = motionValue.on('change', (v) => {
      setDisplay(Math.round(v));
    });
    return () => {
      controls.stop();
      unsubscribe();
    };
  }, [isInView, target, duration, motionValue]);

  return (
    <span ref={ref} className={className}>
      {prefix}{display.toLocaleString()}{suffix}
    </span>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx next build --no-lint 2>&1 | tail -5` (or just check for TS errors on the file)

- [ ] **Step 3: Commit**

```bash
git add src/components/motion/count-up.tsx
git commit -m "feat: add CountUp scroll-triggered animation component"
```

---

## Task 2: ProjectBuilder Component

**Files:**
- Create: `src/components/landing/project-builder.tsx`

This is the most complex component — 3 steps with stepper, category pills, textarea, AI preview.

- [ ] **Step 1: Create the ProjectBuilder with all 3 steps**

```tsx
// src/components/landing/project-builder.tsx
'use client';

import { useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Palette, Code2, PenTool, Video, Megaphone, BarChart3, MoreHorizontal,
  ArrowLeft, ArrowRight, Wand2, Loader2, Rocket, Clock, DollarSign,
  Hourglass, Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { generateProjectIdea } from '@/ai/flows/generate-project-idea';
import { matchFreelancer } from '@/ai/flows/match-freelancer';
import type { GenerateProjectIdeaOutput } from '@/ai/schemas/generate-project-idea-schema';

const CATEGORIES = [
  { id: 'design', label: 'Design', icon: Palette, hint: 'graphic design' },
  { id: 'development', label: 'Development', icon: Code2, hint: 'software development' },
  { id: 'writing', label: 'Writing', icon: PenTool, hint: 'content writing' },
  { id: 'video', label: 'Video', icon: Video, hint: 'video production' },
  { id: 'marketing', label: 'Marketing', icon: Megaphone, hint: 'digital marketing' },
  { id: 'data', label: 'Data', icon: BarChart3, hint: 'data analysis' },
  { id: 'other', label: 'Other', icon: MoreHorizontal, hint: undefined },
] as const;

type Category = (typeof CATEGORIES)[number];

const PLACEHOLDERS: Record<string, string> = {
  design: 'Describe the design work you need — logos, UI mockups, illustrations...',
  development: 'Describe the software you want built — web app, API, mobile...',
  writing: 'Describe the content you need — blog posts, copy, documentation...',
  video: 'Describe the video project — explainer, promo, editing...',
  marketing: 'Describe the marketing work — campaigns, SEO, social media...',
  data: 'Describe the data work — analysis, dashboards, scraping...',
  other: 'Describe your project in detail...',
};

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 200 : -200,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({
    x: direction > 0 ? -200 : 200,
    opacity: 0,
  }),
};

function Stepper({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-6">
      {[1, 2, 3].map((step, i) => (
        <div key={step} className="flex items-center">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
              current > step
                ? 'bg-primary text-white'
                : current === step
                  ? 'bg-primary text-white'
                  : 'border-2 border-border text-muted-foreground'
            }`}
          >
            {current > step ? <Check className="h-4 w-4" /> : step}
          </div>
          {i < 2 && (
            <div className="w-12 md:w-16 h-0.5 mx-1">
              <div
                className={`h-full transition-colors ${
                  current > step ? 'bg-primary' : 'bg-border'
                }`}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function ProjectBuilder() {
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [category, setCategory] = useState<Category | null>(null);
  const [brief, setBrief] = useState('');
  const [preview, setPreview] = useState<GenerateProjectIdeaOutput | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isMatching, setIsMatching] = useState(false);
  const [exampleIdea, setExampleIdea] = useState<GenerateProjectIdeaOutput | null>(null);
  const [exampleLoading, setExampleLoading] = useState(false);
  const [exampleCount, setExampleCount] = useState(0);

  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const goTo = (s: number) => {
    setDirection(s > step ? 1 : -1);
    setStep(s);
  };

  const handleCategory = (cat: Category) => {
    setCategory(cat);
    goTo(2);
  };

  const handleGenerateExample = useCallback(async () => {
    if (exampleCount >= 3) {
      toast({ title: 'Limit reached', description: 'Max 3 examples per session.', variant: 'destructive' });
      return;
    }
    setExampleLoading(true);
    setExampleIdea(null);
    try {
      const result = await generateProjectIdea(
        category?.hint ? { industryHint: category.hint } : undefined
      );
      if (result.status === 'success') {
        setExampleIdea(result);
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to generate example.', variant: 'destructive' });
    } finally {
      setExampleLoading(false);
      setExampleCount((c) => c + 1);
    }
  }, [category, exampleCount, toast]);

  const handleAnalyze = useCallback(async () => {
    if (brief.length < 20) {
      toast({ title: 'Too short', description: 'Please describe your project in at least 20 characters.', variant: 'destructive' });
      return;
    }
    setIsAnalyzing(true);
    setPreview(null);
    goTo(3);
    try {
      const result = await generateProjectIdea(
        category?.hint ? { industryHint: category.hint } : undefined
      );
      // The generateProjectIdea flow gives cost estimates — use it for preview
      setPreview(result.status === 'success' ? result : null);
      if (result.status === 'error') {
        toast({ title: 'Analysis failed', description: result.reasoning || 'Try again.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to analyze project.', variant: 'destructive' });
    } finally {
      setIsAnalyzing(false);
    }
  }, [brief, category, toast]);

  const handleStartProject = useCallback(async () => {
    if (!user) {
      // Store brief in sessionStorage for post-auth resume
      sessionStorage.setItem('hireverse_pending_brief', brief);
      router.push('/client/signup?redirect=/');
      return;
    }

    setIsMatching(true);
    try {
      const result = await matchFreelancer({ projectBrief: brief, freelancerId: user.uid });
      if (result.status === 'matched' && result.totalCostToClient && result.totalCostToClient > 0) {
        const projectId = result.projectId || 'unknown';
        router.push(`/checkout?projectId=${projectId}&cost=${result.totalCostToClient}`);
      } else {
        toast({ title: 'Processing', description: result.reasoning || 'We\'ll find a match soon.', variant: 'default' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to start project.', variant: 'destructive' });
    } finally {
      setIsMatching(false);
    }
  }, [brief, user, router, toast]);

  return (
    <div className="rounded-2xl border border-border bg-background/80 backdrop-blur p-6 md:p-8 shadow-2xl">
      <Stepper current={step} />

      <AnimatePresence mode="wait" custom={direction}>
        {step === 1 && (
          <motion.div
            key="step1"
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <h3 className="text-lg font-semibold mb-1">What do you need?</h3>
            <p className="text-sm text-muted-foreground mb-4">Pick a category to get started.</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => handleCategory(cat)}
                  className="flex items-center gap-2 rounded-lg border border-border bg-card p-3 text-sm font-medium transition-all hover:border-primary hover:bg-primary/5 hover:-translate-y-0.5"
                >
                  <cat.icon className="h-4 w-4 text-primary" />
                  {cat.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => goTo(2)}
              className="mt-3 text-xs text-muted-foreground hover:text-primary hover:underline"
            >
              or skip to describe your project
            </button>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="step2"
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <h3 className="text-lg font-semibold mb-1">
              Describe your project
              {category && <span className="text-primary ml-1 text-sm font-normal">({category.label})</span>}
            </h3>
            <p className="text-sm text-muted-foreground mb-3">Be specific — the more detail, the better our AI can match.</p>
            <Textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder={PLACEHOLDERS[category?.id ?? 'other']}
              className="min-h-[120px] max-h-[200px] resize-y mb-3"
            />

            {/* Inline example */}
            {exampleIdea && (
              <div className="rounded-lg border border-border bg-muted/50 p-3 mb-3 text-sm">
                <p className="font-semibold">{exampleIdea.idea}</p>
                {exampleIdea.details && <p className="text-muted-foreground mt-1">{exampleIdea.details}</p>}
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-2"
                  onClick={() => {
                    setBrief(`${exampleIdea.idea}: ${exampleIdea.details ?? ''}`);
                    setExampleIdea(null);
                  }}
                >
                  Use This
                </Button>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => goTo(1)}>
                  <ArrowLeft className="mr-1 h-4 w-4" /> Back
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleGenerateExample}
                  disabled={exampleLoading || exampleCount >= 3}
                  className="text-primary"
                >
                  {exampleLoading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Wand2 className="mr-1 h-4 w-4" />}
                  Example{exampleCount > 0 ? ` (${exampleCount}/3)` : ''}
                </Button>
              </div>
              <Button size="sm" onClick={handleAnalyze} disabled={brief.length < 20 || isAnalyzing}>
                Next <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div
            key="step3"
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
          >
            {isAnalyzing ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
                <p className="text-sm text-muted-foreground">Analyzing your project...</p>
              </div>
            ) : preview ? (
              <div>
                <h3 className="text-lg font-semibold mb-3">Project Preview</h3>
                <div className="space-y-3 text-sm">
                  {preview.estimatedTimeline && (
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>Timeline: <span className="font-medium">{preview.estimatedTimeline}</span></span>
                    </div>
                  )}
                  {preview.estimatedHours != null && (
                    <div className="flex items-center gap-2">
                      <Hourglass className="h-4 w-4 text-muted-foreground" />
                      <span>Est. Hours: <span className="font-medium">{preview.estimatedHours}</span></span>
                    </div>
                  )}
                  {preview.totalCostToClient != null && preview.totalCostToClient > 0 && (
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span>Est. Cost: <span className="font-medium">${preview.totalCostToClient.toFixed(2)}</span></span>
                    </div>
                  )}
                  {preview.requiredSkills && preview.requiredSkills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {preview.requiredSkills.map((skill) => (
                        <Badge key={skill} variant="secondary" className="text-xs">{skill}</Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between mt-6">
                  <Button size="sm" variant="ghost" onClick={() => goTo(2)}>
                    <ArrowLeft className="mr-1 h-4 w-4" /> Refine
                  </Button>
                  <Button size="sm" onClick={handleStartProject} disabled={isMatching}>
                    {isMatching ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Rocket className="mr-1 h-4 w-4" />}
                    Start This Project
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>Could not generate preview. <button onClick={() => goTo(2)} className="text-primary hover:underline">Try again</button></p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit src/components/landing/project-builder.tsx 2>&1 | head -20` (or check for red squiggles)

- [ ] **Step 3: Commit**

```bash
git add src/components/landing/project-builder.tsx
git commit -m "feat: add interactive ProjectBuilder component for landing hero"
```

---

## Task 3: Hero Section Rewrite

**Files:**
- Modify: `src/components/landing/hero-section.tsx` (full rewrite)

- [ ] **Step 1: Rewrite hero-section.tsx with split layout**

Replace the entire file. Key changes: remove `AiMatcher` import, add `ProjectBuilder`, split into left (copy) + right (builder) columns, keep animated logo (smaller), keep `GradientMesh`.

```tsx
// src/components/landing/hero-section.tsx
'use client';

import { motion } from 'framer-motion';
import { GradientMesh } from './gradient-mesh';
import { ProjectBuilder } from './project-builder';

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.15, delayChildren: 0.3 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] } },
};

const DIAMOND_OUTER = 'M1260.11,1059.79h-80.94a115.88,115.88,0,0,0-94.86,49.38l-10,14.23L1052,1155.31a52.2,52.2,0,0,1-85.53,0l-22.36-31.91-10-14.23a115.88,115.88,0,0,0-94.85-49.38h-81a116,116,0,0,0-115.83,115.83v248.76a116,116,0,0,0,115.83,115.83h81a115.88,115.88,0,0,0,94.85-49.38l10-14.23,22.36-31.91a52.2,52.2,0,0,1,85.53,0l22.37,31.91,10,14.23a115.88,115.88,0,0,0,94.86,49.38h80.94a116,116,0,0,0,115.83-115.83V1175.62A116,116,0,0,0,1260.11,1059.79Zm52.23,268.41v96.18a52.28,52.28,0,0,1-52.23,52.22h-80.94a52.21,52.21,0,0,1-42.77-22.27l-32.32-46.14a115.82,115.82,0,0,0-189.75,0L882,1454.35a52.29,52.29,0,0,1-42.76,22.25h-81a52.27,52.27,0,0,1-52.22-52.22V1175.62a52.27,52.27,0,0,1,52.22-52.22h81A52.29,52.29,0,0,1,882,1145.65l32.31,46.14a115.82,115.82,0,0,0,189.75,0l32.32-46.14a52.21,52.21,0,0,1,42.77-22.27h80.94a52.28,52.28,0,0,1,52.23,52.22Z';
const DIAMOND_DOT = 'M1009.21,1256.44a43.56,43.56,0,1,0,43.56,43.56A43.56,43.56,0,0,0,1009.21,1256.44Z';

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden py-16 md:py-24">
      <GradientMesh />

      <div className="container mx-auto px-4 md:px-6 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left — Copy */}
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="visible"
          >
            {/* Animated logo — smaller */}
            <div className="relative mb-6 flex h-20 w-20 items-center justify-center">
              <motion.div
                className="absolute inset-0 rounded-full bg-primary/10 blur-2xl"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              />
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="630 1050 760 505"
                className="relative h-14 w-auto"
                aria-hidden="true"
              >
                <motion.path
                  d={DIAMOND_OUTER}
                  fill="#03b9ff"
                  stroke="#03b9ff"
                  strokeWidth="3"
                  initial={{ pathLength: 0, fillOpacity: 0 }}
                  animate={{ pathLength: 1, fillOpacity: 1 }}
                  transition={{
                    pathLength: { duration: 1.5, ease: 'easeInOut' },
                    fillOpacity: { duration: 0.5, delay: 1.2 },
                  }}
                />
                <motion.path
                  d={DIAMOND_DOT}
                  fill="#03b9ff"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.3, delay: 1.5 }}
                  style={{ transformOrigin: '1009px 1300px' }}
                />
              </svg>
            </div>

            <motion.h1
              variants={fadeUp}
              className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl leading-[1.1] mb-4"
            >
              Expert work done,{' '}
              <span className="text-primary">faster than ever</span>
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="max-w-lg text-lg text-muted-foreground md:text-xl mb-6"
            >
              Describe your project. AI handles the rest — matching, decomposition,
              quality assurance, delivery.
            </motion.p>

            {/* Trust line */}
            <motion.div
              variants={fadeUp}
              className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground"
            >
              <span><span className="font-semibold text-foreground">500+</span> clients</span>
              <span><span className="font-semibold text-foreground">1,200+</span> freelancers</span>
              <span><span className="font-semibold text-foreground">2,000+</span> projects delivered</span>
            </motion.div>
          </motion.div>

          {/* Right — Project Builder */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <ProjectBuilder />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/landing/hero-section.tsx
git commit -m "feat: rewrite hero section with split layout and ProjectBuilder"
```

---

## Task 4: Social Proof Bar

**Files:**
- Create: `src/components/landing/social-proof-bar.tsx`

- [ ] **Step 1: Create SocialProofBar component**

```tsx
// src/components/landing/social-proof-bar.tsx
'use client';

import { CountUp } from '@/components/motion/count-up';
import { ScrollReveal } from '@/components/motion/scroll-reveal';

const stats = [
  { target: 500, suffix: '+', label: 'Projects Delivered' },
  { target: 1200, suffix: '+', label: 'Vetted Freelancers' },
  { target: 98, suffix: '%', label: 'Satisfaction Rate' },
];

const integrations = ['Monday.com', 'Microsoft Teams', 'Stripe', 'Slack', 'GitHub'];

export function SocialProofBar() {
  return (
    <section className="bg-chrome py-10 md:py-14">
      <div className="container mx-auto px-4 md:px-6">
        <ScrollReveal>
          <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16 mb-8">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-4xl font-bold text-white">
                  <CountUp target={stat.target} suffix={stat.suffix} />
                </div>
                <p className="text-sm text-chrome-foreground/60 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            {integrations.map((name) => (
              <span
                key={name}
                className="rounded-full border border-chrome-foreground/20 px-3 py-1 text-xs text-chrome-foreground/60"
              >
                {name}
              </span>
            ))}
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/landing/social-proof-bar.tsx
git commit -m "feat: add social proof bar with animated counters"
```

---

## Task 5: Dashboard & Hub Mockups

**Files:**
- Create: `src/components/landing/dashboard-mockup.tsx`
- Create: `src/components/landing/hub-mockup.tsx`

- [ ] **Step 1: Create DashboardMockup (CSS-only client dashboard)**

```tsx
// src/components/landing/dashboard-mockup.tsx
export function DashboardMockup() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-2xl rotate-1 overflow-hidden">
      {/* Fake toolbar */}
      <div className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 border-b border-gray-200">
        <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
        <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
        <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
        <span className="ml-2 text-[10px] text-gray-400 font-medium">Client Dashboard</span>
      </div>

      <div className="p-4 space-y-3">
        {/* Project status */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-700">Logo Redesign</span>
          <span className="rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-[10px] font-medium">In Progress</span>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 rounded-full bg-gray-100">
          <div className="h-full w-[65%] rounded-full bg-[#03b9ff]" />
        </div>

        {/* Timeline */}
        <div className="flex items-center gap-1 text-[10px] text-gray-400">
          <span>Started Mar 10</span>
          <span className="mx-1">·</span>
          <span>Due Mar 24</span>
        </div>

        {/* Team avatars */}
        <div className="flex items-center gap-1">
          <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-[9px] font-bold text-primary">JD</div>
          <div className="h-6 w-6 rounded-full bg-emerald-100 flex items-center justify-center text-[9px] font-bold text-emerald-600">MS</div>
          <div className="h-6 w-6 rounded-full bg-purple-100 flex items-center justify-center text-[9px] font-bold text-purple-600">AK</div>
          <span className="text-[10px] text-gray-400 ml-1">3 freelancers assigned</span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create HubMockup (CSS-only freelancer hub)**

```tsx
// src/components/landing/hub-mockup.tsx
export function HubMockup() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-2xl -rotate-1 overflow-hidden">
      <div className="flex">
        {/* Fake webdock sidebar */}
        <div className="w-10 bg-gray-900 flex flex-col items-center py-3 gap-2">
          <div className="h-5 w-5 rounded bg-[#03b9ff]/30" />
          <div className="h-5 w-5 rounded bg-emerald-500/30" />
          <div className="h-5 w-5 rounded bg-purple-500/30" />
        </div>

        <div className="flex-1 p-4 space-y-3">
          <span className="text-xs font-semibold text-gray-700">My Workspace</span>

          {/* Task cards */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 rounded border border-gray-100 bg-gray-50 px-2 py-1.5">
              <div className="h-3.5 w-3.5 rounded-full bg-emerald-500 flex items-center justify-center">
                <svg className="h-2 w-2 text-white" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <span className="text-[10px] text-gray-600">Homepage mockup</span>
            </div>
            <div className="flex items-center gap-2 rounded border border-primary/30 bg-primary/5 px-2 py-1.5">
              <div className="h-3.5 w-3.5 rounded-full border-2 border-primary" />
              <span className="text-[10px] text-gray-600">Icon set — In Progress</span>
            </div>
          </div>

          {/* Earnings mini-graph */}
          <div className="flex items-end gap-1 pt-1">
            <div className="w-4 bg-primary/20 rounded-t" style={{ height: '16px' }} />
            <div className="w-4 bg-primary/40 rounded-t" style={{ height: '24px' }} />
            <div className="w-4 bg-primary rounded-t" style={{ height: '32px' }} />
            <span className="text-[9px] text-gray-400 ml-1 self-end">Earnings ↑</span>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/landing/dashboard-mockup.tsx src/components/landing/hub-mockup.tsx
git commit -m "feat: add CSS-only dashboard and hub mockup illustrations"
```

---

## Task 6: AudienceBlock (Reusable)

**Files:**
- Create: `src/components/landing/audience-block.tsx`

- [ ] **Step 1: Create AudienceBlock component**

```tsx
// src/components/landing/audience-block.tsx
'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollReveal } from '@/components/motion/scroll-reveal';

interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
}

interface AudienceBlockProps {
  side: 'left' | 'right'; // which side the mockup goes on
  label: string;
  heading: string;
  features: Feature[];
  ctaText: string;
  ctaHref: string;
  ctaVariant?: 'default' | 'outline';
  children: React.ReactNode; // mockup component
}

export function AudienceBlock({
  side,
  label,
  heading,
  features,
  ctaText,
  ctaHref,
  ctaVariant = 'default',
  children,
}: AudienceBlockProps) {
  const mockup = (
    <ScrollReveal>
      <div className="flex items-center justify-center">{children}</div>
    </ScrollReveal>
  );

  const text = (
    <ScrollReveal>
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
          {label}
        </p>
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-gray-900 mb-6">
          {heading}
        </h2>
        <div className="space-y-4 mb-6">
          {features.map((f) => (
            <div key={f.title} className="flex gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15">
                <f.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">{f.title}</h3>
                <p className="text-sm text-gray-500">{f.description}</p>
              </div>
            </div>
          ))}
        </div>
        <Button variant={ctaVariant} asChild>
          <Link href={ctaHref}>{ctaText}</Link>
        </Button>
      </div>
    </ScrollReveal>
  );

  return (
    <section className="bg-white text-gray-900 py-16 md:py-20">
      <div className="container mx-auto px-4 md:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {side === 'left' ? (
            <>{mockup}{text}</>
          ) : (
            <>{text}{mockup}</>
          )}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/landing/audience-block.tsx
git commit -m "feat: add reusable AudienceBlock for landing page feature sections"
```

---

## Task 7: Workflow Section Rewrite

**Files:**
- Modify: `src/components/landing/workflow-section.tsx` (full rewrite)

- [ ] **Step 1: Rewrite workflow-section.tsx to 3 steps with dark background**

```tsx
// src/components/landing/workflow-section.tsx
'use client';

import { motion } from 'framer-motion';
import { FileText, BrainCircuit, CheckCircle } from 'lucide-react';

const steps = [
  { icon: FileText, number: '01', title: 'Describe', description: 'Tell us what you need in plain English.' },
  { icon: BrainCircuit, number: '02', title: 'Match & Build', description: 'AI matches freelancers, decomposes work, and kicks off parallel tasks.' },
  { icon: CheckCircle, number: '03', title: 'Deliver', description: 'Quality-checked results, assembled and delivered.' },
];

const cardVariant = {
  hidden: { opacity: 0, scale: 0.85 },
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    transition: { duration: 0.5, delay: i * 0.15, ease: [0.25, 0.1, 0.25, 1] },
  }),
};

export function WorkflowSection() {
  return (
    <section id="how-it-works" className="bg-chrome py-16 md:py-20">
      <div className="container mx-auto px-4 md:px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.4 }}
          className="mb-10 text-center"
        >
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
            &#10217; Process
          </p>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-white">
            How it works
          </h2>
        </motion.div>

        {/* Connecting line (desktop) */}
        <div className="hidden lg:block relative mb-6">
          <motion.svg
            viewBox="0 0 1200 20"
            className="w-full h-5"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-40px' }}
          >
            <motion.line
              x1="200" y1="10" x2="1000" y2="10"
              stroke="hsl(197 100% 50%)"
              strokeWidth="2"
              strokeLinecap="round"
              variants={{
                hidden: { pathLength: 0, opacity: 0.3 },
                visible: { pathLength: 1, opacity: 1, transition: { duration: 1.2, ease: 'easeInOut' } },
              }}
            />
            {[200, 600, 1000].map((cx, i) => (
              <motion.circle
                key={i}
                cx={cx}
                cy="10"
                r="5"
                fill="hsl(197 100% 50%)"
                variants={{
                  hidden: { scale: 0, opacity: 0 },
                  visible: {
                    scale: 1,
                    opacity: 1,
                    transition: { delay: (i / 2) * 1.2 + 0.1, duration: 0.3 },
                  },
                }}
              />
            ))}
          </motion.svg>
        </div>

        {/* Step cards */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
        >
          {steps.map((step, index) => (
            <motion.div
              key={step.title}
              custom={index}
              variants={cardVariant}
              className="group rounded-xl border border-border bg-chrome-muted p-6 transition-all duration-200 hover:border-primary/50 hover:-translate-y-1"
            >
              <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3">
                {step.number}
              </p>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 mb-4 transition-transform duration-200 group-hover:scale-110">
                <step.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-base font-semibold text-chrome-foreground mb-2">{step.title}</h3>
              <p className="text-sm text-chrome-foreground/60 leading-relaxed">
                {step.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/landing/workflow-section.tsx
git commit -m "feat: simplify workflow section to 3 steps with dark chrome background"
```

---

## Task 8: Pricing Preview

**Files:**
- Create: `src/components/landing/pricing-preview.tsx`

- [ ] **Step 1: Create PricingPreview component**

```tsx
// src/components/landing/pricing-preview.tsx
'use client';

import Link from 'next/link';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollReveal } from '@/components/motion/scroll-reveal';

const tiers = [
  {
    name: 'Free',
    price: 0,
    feeLabel: '15% platform fee',
    features: [
      'AI-powered matching',
      'Up to 3 active projects',
      '$5,000 max project size',
      'Standard support',
    ],
    cta: 'Get Started',
    href: '/client/signup?tier=free',
    highlight: false,
  },
  {
    name: 'Pro',
    price: 49,
    feeLabel: '10% platform fee',
    features: [
      'Priority matching',
      'Unlimited projects',
      '$50,000 max project size',
      'Advanced analytics',
      'Consolidated billing',
      'Favorite freelancers',
    ],
    cta: 'Start Pro',
    href: '/client/signup?tier=pro',
    highlight: false,
  },
  {
    name: 'Enterprise',
    price: 299,
    feeLabel: '10% → 8% → 6% volume',
    badge: 'Best Value',
    features: [
      'Dedicated freelancer pool',
      'Unlimited project size',
      'Custom SLA',
      'API access',
      'Volume fee discounts',
      'Everything in Pro',
    ],
    cta: 'Start Enterprise',
    href: '/client/signup?tier=enterprise',
    highlight: true,
  },
];

export function PricingPreview() {
  return (
    <section className="bg-white text-gray-900 py-16 md:py-20">
      <div className="container mx-auto px-4 md:px-6">
        <ScrollReveal>
          <div className="mb-10 text-center">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
              &#10217; Pricing
            </p>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-gray-900">
              Simple, transparent pricing
            </h2>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-5xl mx-auto">
          {tiers.map((tier) => (
            <ScrollReveal key={tier.name}>
              <div
                className={`rounded-xl border p-8 h-full flex flex-col ${
                  tier.highlight
                    ? 'border-primary bg-gray-50 shadow-lg shadow-primary/10 relative'
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                {tier.badge && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-white">
                    {tier.badge}
                  </span>
                )}
                <h3 className="text-lg font-bold text-gray-900">{tier.name}</h3>
                <div className="mt-2 mb-1">
                  <span className="text-4xl font-extrabold text-gray-900">
                    ${tier.price}
                  </span>
                  <span className="text-sm text-gray-500">/mo</span>
                </div>
                <p className="text-sm text-primary font-medium mb-6">{tier.feeLabel}</p>

                <ul className="space-y-2 mb-8 flex-1">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>

                <Button
                  variant={tier.highlight ? 'default' : 'outline'}
                  className="w-full"
                  asChild
                >
                  <Link href={tier.href}>{tier.cta}</Link>
                </Button>
              </div>
            </ScrollReveal>
          ))}
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          All freelancers get paid 100% of project cost. Fees are on the client side only.
        </p>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/landing/pricing-preview.tsx
git commit -m "feat: add pricing preview section with 3-tier cards"
```

---

## Task 9: Testimonials Section

**Files:**
- Create: `src/components/landing/testimonials-section.tsx`

- [ ] **Step 1: Create TestimonialsSection component**

```tsx
// src/components/landing/testimonials-section.tsx
'use client';

import { Star } from 'lucide-react';
import { ScrollReveal } from '@/components/motion/scroll-reveal';

const testimonials = [
  {
    quote: 'We posted a rebrand project and had a matched team working within minutes. The quality gates caught issues we would have missed.',
    name: 'Alex Chen',
    role: 'Startup Founder',
    type: 'Client',
  },
  {
    quote: 'No more bidding on projects for hours. Work comes to me based on my skills, and I get paid fairly every time.',
    name: 'Maria Santos',
    role: 'UI Designer',
    type: 'Freelancer',
  },
  {
    quote: 'The microtask decomposition is a game-changer. Our 3-month project was delivered in 3 weeks.',
    name: 'Jordan Kim',
    role: 'Product Manager',
    type: 'Client',
  },
];

export function TestimonialsSection() {
  return (
    <section className="bg-white text-gray-900 py-16 md:py-20">
      <div className="container mx-auto px-4 md:px-6">
        <ScrollReveal>
          <div className="mb-10 text-center">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
              &#10217; Testimonials
            </p>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-gray-900">
              Trusted by teams and freelancers
            </h2>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-5xl mx-auto">
          {testimonials.map((t) => (
            <ScrollReveal key={t.name}>
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 h-full flex flex-col relative">
                {/* Quote decoration */}
                <span className="absolute top-4 right-4 text-5xl leading-none text-primary/10 font-serif select-none">
                  &ldquo;
                </span>

                <div className="flex gap-0.5 mb-3">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star key={i} className="h-4 w-4 fill-primary text-primary" />
                  ))}
                </div>

                <p className="text-sm text-gray-700 leading-relaxed flex-1 mb-4">
                  &ldquo;{t.quote}&rdquo;
                </p>

                <div className="border-t border-gray-200 pt-3">
                  <p className="text-sm font-semibold text-gray-900">{t.name}</p>
                  <p className="text-xs text-gray-500">{t.role} · {t.type}</p>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/landing/testimonials-section.tsx
git commit -m "feat: add testimonials section with placeholder quotes"
```

---

## Task 10: Dual CTA Section

**Files:**
- Create: `src/components/landing/dual-cta-section.tsx`

- [ ] **Step 1: Create DualCtaSection component**

```tsx
// src/components/landing/dual-cta-section.tsx
'use client';

import Link from 'next/link';
import { Rocket, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollReveal } from '@/components/motion/scroll-reveal';

export function DualCtaSection() {
  return (
    <section className="bg-chrome py-20 md:py-28">
      <div className="container mx-auto px-4 md:px-6 max-w-4xl">
        <ScrollReveal>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-white text-center mb-10">
            Ready to work differently?
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* For Clients */}
            <div className="rounded-xl border border-border bg-chrome-muted p-8 text-center">
              <h3 className="text-xl font-bold text-chrome-foreground mb-2">
                I need work done
              </h3>
              <p className="text-sm text-chrome-foreground/60 mb-6">
                Post your project and let AI find the perfect team.
              </p>
              <Button className="w-full" size="lg" asChild>
                <Link href="/client/signup">
                  Start a Project <Rocket className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </div>

            {/* For Freelancers */}
            <div className="rounded-xl border border-primary/30 bg-primary/10 p-8 text-center">
              <h3 className="text-xl font-bold text-chrome-foreground mb-2">
                I want to earn
              </h3>
              <p className="text-sm text-chrome-foreground/60 mb-6">
                Get matched to projects that fit your skills. No bidding.
              </p>
              <Button variant="outline" className="w-full" size="lg" asChild>
                <Link href="/freelancer/signup">
                  Join as a Freelancer <UserPlus className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/landing/dual-cta-section.tsx
git commit -m "feat: add dual CTA section for clients and freelancers"
```

---

## Task 11: Assemble Page + Expanded Footer

**Files:**
- Modify: `src/app/page.tsx` (full rewrite)

- [ ] **Step 1: Rewrite page.tsx with all 8 sections + expanded footer**

```tsx
// src/app/page.tsx
'use client';

import Link from 'next/link';
import { BrainCircuit, Split, ShieldCheck, Briefcase, DollarSign, TrendingUp } from 'lucide-react';
import { SiteLogo } from '@/components/site-logo';
import { SplashScreen } from '@/components/splash-screen';
import { HeaderNavigationClient } from '@/components/header-navigation-client';
import { HeroSection } from '@/components/landing/hero-section';
import { SocialProofBar } from '@/components/landing/social-proof-bar';
import { AudienceBlock } from '@/components/landing/audience-block';
import { DashboardMockup } from '@/components/landing/dashboard-mockup';
import { HubMockup } from '@/components/landing/hub-mockup';
import { WorkflowSection } from '@/components/landing/workflow-section';
import { PricingPreview } from '@/components/landing/pricing-preview';
import { TestimonialsSection } from '@/components/landing/testimonials-section';
import { DualCtaSection } from '@/components/landing/dual-cta-section';

const clientFeatures = [
  { icon: BrainCircuit, title: 'AI-Powered Matching', description: 'No browsing profiles. AI finds the right talent instantly.' },
  { icon: Split, title: 'Parallel Microtasks', description: 'Work gets decomposed and runs simultaneously. 3x faster delivery.' },
  { icon: ShieldCheck, title: 'Built-In QA', description: 'Automated quality gates at every milestone. No surprises.' },
];

const freelancerFeatures = [
  { icon: Briefcase, title: 'Auto-Assigned Projects', description: 'No bidding wars. Work finds you based on your verified skills.' },
  { icon: DollarSign, title: 'Transparent Earnings', description: '100% of project cost goes to you. Clients pay the platform fee.' },
  { icon: TrendingUp, title: 'Grow Your Reputation', description: 'XP, badges, leaderboard. Top performers get priority matching.' },
];

const footerLinks = {
  Product: [
    { label: 'Start a Project', href: '/client/signup' },
    { label: 'Browse Freelancers', href: '/community' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'Integrations', href: '#' },
  ],
  Company: [
    { label: 'About', href: '#' },
    { label: 'Careers', href: '#' },
    { label: 'Community', href: '/community' },
    { label: 'Blog', href: '#' },
  ],
  Legal: [
    { label: 'Terms of Service', href: '#' },
    { label: 'Privacy Policy', href: '#' },
    { label: 'Cookie Policy', href: '#' },
  ],
};

export default function Home() {
  return (
    <div className="dark flex min-h-screen flex-col bg-background text-foreground">
      <SplashScreen />

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
          <Link href="/">
            <SiteLogo variant="dark" className="h-9 w-auto" />
          </Link>
          <HeaderNavigationClient />
        </div>
      </header>

      <main className="flex-1">
        {/* 1 */}
        <HeroSection />
        {/* 2 */}
        <SocialProofBar />
        {/* 3 — For Clients */}
        <AudienceBlock
          side="left"
          label="For Clients"
          heading="Post a project. Get results, not headaches."
          features={clientFeatures}
          ctaText="Start a Project"
          ctaHref="/client/signup"
        >
          <DashboardMockup />
        </AudienceBlock>
        {/* 4 — For Freelancers */}
        <AudienceBlock
          side="right"
          label="For Freelancers"
          heading="Steady work. Fair pay. Zero chasing."
          features={freelancerFeatures}
          ctaText="Join as a Freelancer"
          ctaHref="/freelancer/signup"
          ctaVariant="outline"
        >
          <HubMockup />
        </AudienceBlock>
        {/* 5 */}
        <WorkflowSection />
        {/* 6 */}
        <div id="pricing">
          <PricingPreview />
        </div>
        {/* 7 */}
        <TestimonialsSection />
        {/* 8 */}
        <DualCtaSection />
      </main>

      {/* Footer — Expanded */}
      <footer className="bg-chrome border-t border-border py-12">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            {/* Brand */}
            <div className="col-span-2 md:col-span-1">
              <SiteLogo variant="dark" className="h-8 w-auto mb-3" />
              <p className="text-sm text-chrome-foreground/60">
                AI-powered freelancer marketplace. Expert work, delivered faster.
              </p>
            </div>

            {/* Link columns */}
            {Object.entries(footerLinks).map(([title, links]) => (
              <div key={title}>
                <h4 className="text-sm font-semibold text-chrome-foreground mb-3">{title}</h4>
                <ul className="space-y-2">
                  {links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-sm text-chrome-foreground/60 hover:text-primary hover:underline"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="border-t border-border pt-6 flex flex-col items-center justify-between text-center text-sm text-chrome-foreground/60 md:flex-row">
            <p>&copy; {new Date().getFullYear()} Hireverse AI. All rights reserved.</p>
            <Link
              href="https://resume.hireverse.ai/"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 md:mt-0 hover:text-primary hover:underline"
            >
              Looking for help with your resume?
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: assemble landing page v2 with 8 sections and expanded footer"
```

---

## Task 12: Build Verification

- [ ] **Step 1: Run the build**

```bash
npx next build --no-lint 2>&1 | tail -20
```

Expected: Build succeeds. If there are TS errors, fix them.

- [ ] **Step 2: Fix any build errors (if needed)**

Address each error one at a time.

- [ ] **Step 3: Final commit (if fixes were needed)**

```bash
git add -A
git commit -m "fix: resolve build errors in landing page v2"
```

---

## Summary

| Task | Component | Est. |
|------|-----------|------|
| 1 | CountUp motion utility | Small |
| 2 | ProjectBuilder (3-step form) | Large |
| 3 | HeroSection rewrite | Medium |
| 4 | SocialProofBar | Small |
| 5 | Dashboard + Hub mockups | Small |
| 6 | AudienceBlock (reusable) | Small |
| 7 | WorkflowSection rewrite | Medium |
| 8 | PricingPreview | Medium |
| 9 | TestimonialsSection | Small |
| 10 | DualCtaSection | Small |
| 11 | Page assembly + footer | Medium |
| 12 | Build verification | Small |

**Total: 9 new files, 3 modified files, 12 tasks.**
