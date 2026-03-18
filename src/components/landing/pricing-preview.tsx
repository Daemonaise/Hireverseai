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
    feeLabel: '10% > 8% > 6% volume',
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
