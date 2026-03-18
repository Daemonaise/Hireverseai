'use client';

import Link from 'next/link';
import { SiteLogo } from '@/components/site-logo';
import { SplashScreen } from '@/components/splash-screen';
import { HeaderNavigationClient } from '@/components/header-navigation-client';
import { HeroSection } from '@/components/landing/hero-section';
import { FeaturesSection } from '@/components/landing/features-section';
import { WorkflowSection } from '@/components/landing/workflow-section';
import { CommunitySection } from '@/components/landing/community-section';
import { CtaSection } from '@/components/landing/cta-section';

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
        <HeroSection />
        <FeaturesSection />
        <WorkflowSection />
        <CommunitySection />
        <CtaSection />
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-chrome py-8">
        <div className="container mx-auto flex flex-col items-center justify-between px-4 text-center text-sm text-chrome-foreground/60 md:flex-row md:px-6">
          <div className="flex items-center gap-3">
            <SiteLogo variant="dark" className="h-7 w-auto" />
            <p>&copy; {new Date().getFullYear()} Hireverse AI. All rights reserved.</p>
          </div>
          <div className="mt-4 md:mt-0">
            <Link
              href="https://resume.hireverse.ai/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary hover:underline"
            >
              Looking for help with your resume?
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
