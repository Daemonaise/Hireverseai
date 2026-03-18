'use client';

import { motion } from 'framer-motion';
import { GradientMesh } from '@/components/landing/gradient-mesh';
import { SiteLogo } from '@/components/site-logo';
import { fadeInLeft } from '@/lib/motion';

const COPY = {
  freelancer: {
    tagline: 'Build your career with AI-matched projects',
    bullets: [
      'Instant matching to projects that fit your skills',
      'Fair, transparent pay with no hidden fees',
      'Grow your reputation with XP and badges',
    ],
  },
  client: {
    tagline: 'Get expert work done, faster than ever',
    bullets: [
      'Vetted talent matched by AI in seconds',
      'Parallel microtasks for rapid delivery',
      'Quality-assured results every time',
    ],
  },
};

interface AuthBrandPanelProps {
  role: 'freelancer' | 'client';
}

export function AuthBrandPanel({ role }: AuthBrandPanelProps) {
  const copy = COPY[role];

  return (
    <div className="relative hidden md:flex w-[45%] bg-chrome flex-col items-center justify-center p-12 overflow-hidden">
      <GradientMesh />

      <motion.div
        initial={fadeInLeft.initial}
        animate={fadeInLeft.animate}
        className="relative z-10 max-w-sm"
      >
        <SiteLogo variant="dark" className="h-10 w-auto mb-12" />

        <h2 className="text-2xl font-bold text-chrome-foreground mb-6 leading-snug">
          {copy.tagline}
        </h2>

        <ul className="space-y-4">
          {copy.bullets.map((bullet) => (
            <li key={bullet} className="flex items-start gap-3">
              <div className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />
              <span className="text-sm text-chrome-foreground/80 leading-relaxed">
                {bullet}
              </span>
            </li>
          ))}
        </ul>
      </motion.div>
    </div>
  );
}
