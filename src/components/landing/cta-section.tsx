'use client';

import Link from 'next/link';
import { Rocket, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollReveal } from '@/components/motion/scroll-reveal';

interface CtaSectionProps {
  onStartProject?: () => void;
}

export function CtaSection({ onStartProject }: CtaSectionProps) {
  return (
    <section className="py-20 md:py-28 border-t border-border text-center">
      <div className="container mx-auto px-4 md:px-6 max-w-2xl">
        <ScrollReveal>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
            Start your first AI-led project today.
          </h2>
          <p className="text-lg text-muted-foreground md:text-xl mb-8">
            Eliminate scope creep, late work, and bad hires.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Button
              size="lg"
              onClick={onStartProject}
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
        </ScrollReveal>
      </div>
    </section>
  );
}
