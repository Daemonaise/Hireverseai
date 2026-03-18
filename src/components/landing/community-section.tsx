'use client';

import Link from 'next/link';
import { TrendingUp, Award, Trophy, Star, UserPlus, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollReveal } from '@/components/motion/scroll-reveal';
import { AnimateList } from '@/components/motion/animate-list';

const benefits = [
  {
    icon: TrendingUp,
    title: 'Earn XP',
    description: 'Complete projects to gain experience points and level up your freelancer profile.',
  },
  {
    icon: Award,
    title: 'Unlock Badges',
    description: 'Hit milestones to earn skill badges that showcase your expertise to future clients.',
  },
  {
    icon: Trophy,
    title: 'Climb the Leaderboard',
    description: 'Top performers get priority matching and featured placement on the platform.',
  },
];

export function CommunitySection() {
  return (
    <section className="py-16 md:py-20 border-t border-border">
      <div className="container mx-auto px-4 md:px-6">
        <ScrollReveal>
          <div className="mb-10 text-center">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
              &#10217; Community
            </p>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Grow your career while you work
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
              Every project you complete earns recognition. Build your reputation,
              stand out to clients, and unlock new opportunities.
            </p>
          </div>
        </ScrollReveal>

        {/* Benefit cards */}
        <AnimateList className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {benefits.map((benefit) => (
            <div
              key={benefit.title}
              className="group rounded-xl border border-border bg-card p-6 transition-all duration-200 hover:border-primary/50 hover:-translate-y-1 text-center"
            >
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 mb-4 transition-transform duration-200 group-hover:scale-110">
                <benefit.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-base font-semibold mb-1">{benefit.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {benefit.description}
              </p>
            </div>
          ))}
        </AnimateList>

        {/* CTA banner */}
        <ScrollReveal preset="scaleIn">
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-8 md:p-10 text-center">
            <div className="flex items-center justify-center gap-1 mb-3">
              {Array.from({ length: 5 }, (_, i) => (
                <Star key={i} className="h-4 w-4 text-primary" />
              ))}
            </div>
            <h3 className="text-xl font-bold mb-2">
              Join freelancers already growing with Hireverse
            </h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-lg mx-auto">
              Whether you&apos;re a designer, developer, writer, or marketer —
              there&apos;s a place for you here.
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
        </ScrollReveal>
      </div>
    </section>
  );
}
