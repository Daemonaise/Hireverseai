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
