
'use client';

import Link from 'next/link';
import React, { useRef } from 'react';
import { AiMatcher, type AiMatcherRef } from '@/components/ai-matcher';
import { Button } from '@/components/ui/button';
import {
  BrainCircuit,
  Split,
  ShieldCheck,
  UsersRound,
  GitCompareArrows,
  Workflow,
  FileText,
  GanttChart,
  CheckCircle,
  Rocket,
  ChevronRight,
  UserPlus,
  Trophy,
  Award,
  TrendingUp,
  Star,
} from 'lucide-react';
import { SiteLogo } from '@/components/site-logo';
import { SplashScreen } from '@/components/splash-screen';
import { HeaderNavigationClient } from '@/components/header-navigation-client';

const keyFeaturesData = [
  {
    icon: BrainCircuit,
    title: 'AI-Powered Instant Matching & Auto Assignment',
    description: 'Parses plain-language briefs, finds best-fit freelancers by skills/style/availability, then auto-assigns microtasks for immediate kickoff.',
    isNew: true,
  },
  {
    icon: Split,
    title: 'Microtasks Engine',
    description: 'Decomposes large projects into bite-sized tasks run in parallel and aggregates individual outputs into a cohesive deliverable.',
  },
  {
    icon: ShieldCheck,
    title: 'Built-In Quality Assurance',
    description: 'Automated linting, spec checks and optional peer-review steps ensure every output meets your standards before delivery.',
  },
  {
    icon: UsersRound,
    title: 'Universal Digital Skill Support',
    description: 'One hub for any computer-based work—graphic design, copywriting, editing, video, CAD, development, marketing assets, and more.',
  },
  {
    icon: GitCompareArrows,
    title: 'Seamless Project-Management Integrations',
    description: 'Native connectors for Monday.com and Microsoft Teams let you post tasks, track progress, chat and manage approvals without leaving your existing workspace.',
  },
  {
    icon: Workflow,
    title: 'Dynamic Workflow Engine',
    description: 'Manages dependencies and reroutes work in real time based on performance metrics.',
  },
];

const hireverseWorkflowData = [
  {
    icon: FileText,
    title: 'Submit Your Brief',
    description: 'Provide your project goals and requirements easily and clearly.',
  },
  {
    icon: BrainCircuit,
    title: 'Instant Talent Matching',
    description: "AI immediately matches you with precisely vetted freelancers suited to your project's unique needs.",
  },
  {
    icon: Split,
    title: 'Microtask Efficiency',
    description: 'Your project is intelligently divided into parallel microtasks, speeding up delivery through simultaneous expert collaboration.',
  },
  {
    icon: GanttChart,
    title: 'Dynamic Project Management',
    description: 'Track real-time progress, communicate effortlessly, and request updates or changes anytime.',
  },
  {
    icon: CheckCircle,
    title: 'Quality-Assured Delivery',
    description: 'Every task undergoes automated quality checks and optional peer reviews for unmatched precision.',
  },
  {
    icon: Rocket,
    title: 'Seamless Project Completion',
    description: 'Receive your fully assembled, ready-to-launch project seamlessly integrated from completed microtasks.',
  },
];

export default function Home() {
  const aiMatcherRef = useRef<AiMatcherRef>(null);

  const handleStartProjectClick = () => {
    aiMatcherRef.current?.triggerSubmit();
  };

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
        {/* Hero */}
        <section className="py-24 md:py-36 text-center">
          <div className="container mx-auto px-4 md:px-6 max-w-4xl">
            {/* Centered icon with glow */}
            <div className="relative mx-auto mb-10 flex h-36 w-36 items-center justify-center">
              {/* Outer glow */}
              <div className="absolute inset-0 rounded-full bg-primary/10 blur-3xl" />
              {/* Mid glow */}
              <div className="absolute inset-[15%] rounded-full bg-primary/15 blur-2xl" />
              {/* Inner glow */}
              <div className="absolute inset-[30%] rounded-full bg-primary/20 blur-xl" />
              {/* Icon */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="630 1050 760 505"
                className="relative h-24 w-auto drop-shadow-[0_0_24px_rgba(3,185,255,0.6)]"
                aria-hidden="true"
              >
                <path
                  fill="#03b9ff"
                  d="M1260.11,1059.79h-80.94a115.88,115.88,0,0,0-94.86,49.38l-10,14.23L1052,1155.31a52.2,52.2,0,0,1-85.53,0l-22.36-31.91-10-14.23a115.88,115.88,0,0,0-94.85-49.38h-81a116,116,0,0,0-115.83,115.83v248.76a116,116,0,0,0,115.83,115.83h81a115.88,115.88,0,0,0,94.85-49.38l10-14.23,22.36-31.91a52.2,52.2,0,0,1,85.53,0l22.37,31.91,10,14.23a115.88,115.88,0,0,0,94.86,49.38h80.94a116,116,0,0,0,115.83-115.83V1175.62A116,116,0,0,0,1260.11,1059.79Zm52.23,268.41v96.18a52.28,52.28,0,0,1-52.23,52.22h-80.94a52.21,52.21,0,0,1-42.77-22.27l-32.32-46.14a115.82,115.82,0,0,0-189.75,0L882,1454.35a52.29,52.29,0,0,1-42.76,22.25h-81a52.27,52.27,0,0,1-52.22-52.22V1175.62a52.27,52.27,0,0,1,52.22-52.22h81A52.29,52.29,0,0,1,882,1145.65l32.31,46.14a115.82,115.82,0,0,0,189.75,0l32.32-46.14a52.21,52.21,0,0,1,42.77-22.27h80.94a52.28,52.28,0,0,1,52.23,52.22Z"
                />
                <path
                  fill="#03b9ff"
                  d="M1009.21,1256.44a43.56,43.56,0,1,0,43.56,43.56A43.56,43.56,0,0,0,1009.21,1256.44Z"
                />
              </svg>
            </div>

            <h1 className="text-5xl font-extrabold tracking-tight sm:text-6xl md:text-7xl leading-[1.1] mb-6">
              Expert work done, <span className="text-primary">faster than ever</span>
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground md:text-xl mb-10">
              Describe your project in plain English, and our AI instantly matches you with vetted freelancers, decomposes work into parallel microtasks, and delivers quality-assured results at unprecedented speed.
            </p>

            <div className="flex flex-col sm:flex-row justify-center gap-4 mb-12">
              <Button
                size="lg"
                onClick={handleStartProjectClick}
                className="shadow-lg shadow-primary/20"
              >
                Start a Project <Rocket className="ml-2 h-5 w-5" />
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="#how-it-works">
                  See How It Works <ChevronRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </div>

            {/* AI Matcher Form */}
            <div className="mx-auto max-w-xl">
              <AiMatcher ref={aiMatcherRef} />
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-16 md:py-20 border-t border-border">
          <div className="container mx-auto px-4 md:px-6">
            <div className="mb-10 text-center">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
                &#10217; Features
              </p>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Everything you need to ship faster
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {keyFeaturesData.map((feature) => (
                <div
                  key={feature.title}
                  className="group rounded-xl border border-border bg-card p-6 transition-all duration-200 hover:border-primary/50 hover:-translate-y-0.5"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 mb-4">
                    <feature.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-base font-semibold">{feature.title}</h3>
                    {feature.isNew && (
                      <span className="inline-flex shrink-0 items-center rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
                        NEW
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Process / How It Works */}
        <section id="how-it-works" className="py-16 md:py-20 border-t border-border">
          <div className="container mx-auto px-4 md:px-6">
            <div className="mb-10 text-center">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
                &#10217; Process
              </p>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Our workflow, simplified
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {hireverseWorkflowData.map((step, index) => (
                <div
                  key={step.title}
                  className="group rounded-xl border border-border bg-card p-6 transition-all duration-200 hover:border-primary/50 hover:-translate-y-0.5"
                >
                  <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3">
                    {String(index + 1).padStart(2, '0')}
                  </p>
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 mb-4">
                    <step.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="text-base font-semibold mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Community */}
        <section className="py-16 md:py-20 border-t border-border">
          <div className="container mx-auto px-4 md:px-6">
            <div className="mb-10 text-center">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
                &#10217; Community
              </p>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Grow your career while you work
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
                Every project you complete earns recognition. Build your reputation, stand out to clients, and unlock new opportunities.
              </p>
            </div>

            {/* Benefit cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="group rounded-xl border border-border bg-card p-6 transition-all duration-200 hover:border-primary/50 hover:-translate-y-0.5 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 mb-4">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-base font-semibold mb-1">Earn XP</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Complete projects to gain experience points and level up your freelancer profile.
                </p>
              </div>

              <div className="group rounded-xl border border-border bg-card p-6 transition-all duration-200 hover:border-primary/50 hover:-translate-y-0.5 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 mb-4">
                  <Award className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-base font-semibold mb-1">Unlock Badges</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Hit milestones to earn skill badges that showcase your expertise to future clients.
                </p>
              </div>

              <div className="group rounded-xl border border-border bg-card p-6 transition-all duration-200 hover:border-primary/50 hover:-translate-y-0.5 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 mb-4">
                  <Trophy className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-base font-semibold mb-1">Climb the Leaderboard</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Top performers get priority matching and featured placement on the platform.
                </p>
              </div>
            </div>

            {/* CTA banner */}
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-8 md:p-10 text-center">
              <div className="flex items-center justify-center gap-1 mb-3">
                <Star className="h-4 w-4 text-primary" />
                <Star className="h-4 w-4 text-primary" />
                <Star className="h-4 w-4 text-primary" />
                <Star className="h-4 w-4 text-primary" />
                <Star className="h-4 w-4 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-2">
                Join freelancers already growing with Hireverse
              </h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-lg mx-auto">
                Whether you&apos;re a designer, developer, writer, or marketer — there&apos;s a place for you here.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-3">
                <Button size="lg" asChild>
                  <Link href="/freelancer/signup">
                    Become a Freelancer <UserPlus className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/community">
                    Explore Community <ChevronRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 md:py-28 border-t border-border text-center">
          <div className="container mx-auto px-4 md:px-6 max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
              Start your first AI-led project today.
            </h2>
            <p className="text-lg text-muted-foreground md:text-xl mb-8">
              Eliminate scope creep, late work, and bad hires.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Button
                size="lg"
                onClick={handleStartProjectClick}
                className="shadow-lg shadow-primary/20"
              >
                Start a Project <Rocket className="ml-2 h-5 w-5" />
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/client/signup">
                  Create an Account <UserPlus className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container mx-auto flex flex-col items-center justify-between px-4 text-center text-sm text-muted-foreground md:flex-row md:px-6">
          <div className="flex items-center gap-3">
            <SiteLogo variant="dark" className="h-7 w-auto" />
            <p>&copy; {new Date().getFullYear()} Hireverse AI. All rights reserved.</p>
          </div>
          <div className="mt-4 md:mt-0">
            <Link
              href="https://resume.hireverse.ai/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary hover:underline"
            >
              Looking for help with your resume?
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
