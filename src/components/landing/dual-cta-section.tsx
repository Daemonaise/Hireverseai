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
