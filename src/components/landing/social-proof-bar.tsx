'use client';

import { Rocket } from 'lucide-react';
import { ScrollReveal } from '@/components/motion/scroll-reveal';

const integrations = ['Monday.com', 'Microsoft Teams', 'Stripe', 'Slack', 'GitHub'];

export function SocialProofBar() {
  return (
    <section className="bg-chrome py-10 md:py-14">
      <div className="container mx-auto px-4 md:px-6">
        <ScrollReveal>
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 mb-3">
              <Rocket className="h-5 w-5 text-primary" />
              <span className="text-lg font-semibold text-white">We're in beta</span>
            </div>
            <p className="text-sm text-chrome-foreground/60 max-w-md mx-auto">
              We're building the future of freelance work. Join us early as a client or freelancer and help shape the platform.
            </p>
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
