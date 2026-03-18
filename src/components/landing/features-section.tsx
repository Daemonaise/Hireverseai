'use client';

import {
  BrainCircuit,
  Split,
  ShieldCheck,
  UsersRound,
  GitCompareArrows,
  Workflow,
} from 'lucide-react';
import { ScrollReveal } from '@/components/motion/scroll-reveal';
import { AnimateList } from '@/components/motion/animate-list';

const features = [
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

export function FeaturesSection() {
  return (
    <section className="py-16 md:py-20 border-t border-border">
      <div className="container mx-auto px-4 md:px-6">
        <ScrollReveal>
          <div className="mb-10 text-center">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
              &#10217; Features
            </p>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Everything you need to ship faster
            </h2>
          </div>
        </ScrollReveal>

        <AnimateList className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group rounded-xl border border-l-[3px] border-border border-l-transparent bg-card p-6 transition-all duration-200 hover:border-primary/50 hover:border-l-primary hover:-translate-y-1"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 mb-4 transition-transform duration-200 group-hover:scale-110">
                <feature.icon className="h-5 w-5 text-primary" />
              </div>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-base font-semibold">{feature.title}</h3>
                {feature.isNew && (
                  <span className="inline-flex shrink-0 items-center rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent animate-pulse">
                    NEW
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </AnimateList>
      </div>
    </section>
  );
}
