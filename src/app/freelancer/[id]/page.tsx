'use client';

import Link from 'next/link';
import { FreelancerProfile } from '@/components/freelancer-profile';
import { Button } from '@/components/ui/button';
import { SiteLogo } from '@/components/site-logo';
import { HeaderNavigationClient } from '@/components/header-navigation-client';
import { PageTransition } from '@/components/motion/page-transition';
import { use } from 'react';

export default function FreelancerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: freelancerId } = use(params);

  return (
    <div className="dark flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
          <Link href="/">
            <SiteLogo variant="dark" className="h-9 w-auto" />
          </Link>
          <HeaderNavigationClient />
        </div>
      </header>

      <main className="flex flex-1 items-start justify-center py-12">
        <div className="container mx-auto px-4 md:px-6 max-w-3xl">
          <PageTransition>
            <FreelancerProfile freelancerId={freelancerId} />
            <div className="mt-8 text-center">
              <Button variant="link" asChild>
                <Link href="/community">Back to Leaderboard</Link>
              </Button>
            </div>
          </PageTransition>
        </div>
      </main>

      <footer className="border-t border-border bg-chrome py-8">
        <div className="container mx-auto flex flex-col items-center justify-between px-4 text-center text-sm text-chrome-foreground/60 md:flex-row md:px-6">
          <div className="flex items-center gap-3">
            <SiteLogo variant="dark" className="h-7 w-auto" />
            <p>&copy; {new Date().getFullYear()} Hireverse AI. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
