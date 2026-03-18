'use client';

import Link from 'next/link';
import { BrainCircuit, Split, ShieldCheck, Briefcase, DollarSign, TrendingUp } from 'lucide-react';
import { SiteLogo } from '@/components/site-logo';
import { SplashScreen } from '@/components/splash-screen';
import { HeaderNavigationClient } from '@/components/header-navigation-client';
import { HeroSection } from '@/components/landing/hero-section';
import { SocialProofBar } from '@/components/landing/social-proof-bar';
import { AudienceBlock } from '@/components/landing/audience-block';
import { DashboardMockup } from '@/components/landing/dashboard-mockup';
import { HubMockup } from '@/components/landing/hub-mockup';
import { WorkflowSection } from '@/components/landing/workflow-section';
import { PricingPreview } from '@/components/landing/pricing-preview';
import { TestimonialsSection } from '@/components/landing/testimonials-section';
import { DualCtaSection } from '@/components/landing/dual-cta-section';

const clientFeatures = [
  { icon: BrainCircuit, title: 'AI-Powered Matching', description: 'No browsing profiles. AI finds the right talent instantly.' },
  { icon: Split, title: 'Parallel Microtasks', description: 'Work gets decomposed and runs simultaneously. 3x faster delivery.' },
  { icon: ShieldCheck, title: 'Built-In QA', description: 'Automated quality gates at every milestone. No surprises.' },
];

const freelancerFeatures = [
  { icon: Briefcase, title: 'Auto-Assigned Projects', description: 'No bidding wars. Work finds you based on your verified skills.' },
  { icon: DollarSign, title: 'Transparent Earnings', description: '100% of project cost goes to you. Clients pay the platform fee.' },
  { icon: TrendingUp, title: 'Grow Your Reputation', description: 'XP, badges, leaderboard. Top performers get priority matching.' },
];

const footerLinks = {
  Product: [
    { label: 'Start a Project', href: '/client/signup' },
    { label: 'Browse Freelancers', href: '/community' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'Integrations', href: '#' },
  ],
  Company: [
    { label: 'About', href: '#' },
    { label: 'Careers', href: '#' },
    { label: 'Community', href: '/community' },
    { label: 'Blog', href: '#' },
  ],
  Legal: [
    { label: 'Terms of Service', href: '#' },
    { label: 'Privacy Policy', href: '#' },
    { label: 'Cookie Policy', href: '#' },
  ],
};

export default function Home() {
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
        {/* 1 */}
        <HeroSection />
        {/* 2 */}
        <SocialProofBar />
        {/* 3 - For Clients */}
        <AudienceBlock
          side="left"
          label="For Clients"
          heading="Post a project. Get results, not headaches."
          features={clientFeatures}
          ctaText="Start a Project"
          ctaHref="/client/signup"
        >
          <DashboardMockup />
        </AudienceBlock>
        {/* 4 - For Freelancers */}
        <AudienceBlock
          side="right"
          label="For Freelancers"
          heading="Steady work. Fair pay. Zero chasing."
          features={freelancerFeatures}
          ctaText="Join as a Freelancer"
          ctaHref="/freelancer/signup"
          ctaVariant="outline"
        >
          <HubMockup />
        </AudienceBlock>
        {/* 5 */}
        <WorkflowSection />
        {/* 6 */}
        <div id="pricing">
          <PricingPreview />
        </div>
        {/* 7 */}
        <TestimonialsSection />
        {/* 8 */}
        <DualCtaSection />
      </main>

      {/* Footer - Expanded */}
      <footer className="bg-chrome border-t border-border py-12">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            {/* Brand */}
            <div className="col-span-2 md:col-span-1">
              <SiteLogo variant="dark" className="h-8 w-auto mb-3" />
              <p className="text-sm text-chrome-foreground/60">
                AI-powered freelancer marketplace. Expert work, delivered faster.
              </p>
            </div>

            {/* Link columns */}
            {Object.entries(footerLinks).map(([title, links]) => (
              <div key={title}>
                <h4 className="text-sm font-semibold text-chrome-foreground mb-3">{title}</h4>
                <ul className="space-y-2">
                  {links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-sm text-chrome-foreground/60 hover:text-primary hover:underline"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="border-t border-border pt-6 flex flex-col items-center justify-between text-center text-sm text-chrome-foreground/60 md:flex-row">
            <p>&copy; {new Date().getFullYear()} Hireverse AI. All rights reserved.</p>
            <Link
              href="https://resume.hireverse.ai/"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 md:mt-0 hover:text-primary hover:underline"
            >
              Looking for help with your resume?
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
