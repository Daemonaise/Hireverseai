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
        <Button
          variant={ctaVariant}
          className={ctaVariant === 'outline' ? 'border-primary text-primary hover:bg-primary hover:text-white' : ''}
          asChild
        >
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
