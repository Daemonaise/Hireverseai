'use client';

import Link from 'next/link';
import { MessageSquare, UserPlus } from 'lucide-react';
import { Leaderboard } from '@/components/leaderboard';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { SiteLogo } from '@/components/site-logo';
import { HeaderNavigationClient } from '@/components/header-navigation-client';
import { PageTransition } from '@/components/motion/page-transition';
import { ScrollReveal } from '@/components/motion/scroll-reveal';

export default function CommunityPage() {
  return (
    <div className="dark flex min-h-screen flex-col bg-background text-foreground">
      {/* Header — matches landing page */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
          <Link href="/">
            <SiteLogo variant="dark" className="h-9 w-auto" />
          </Link>
          <HeaderNavigationClient />
        </div>
      </header>

      <main className="flex-1 py-12">
        <div className="container mx-auto px-4 md:px-6 space-y-12">
          <PageTransition>
            <section>
              <Leaderboard />
            </section>
          </PageTransition>

          <Separator />

          <ScrollReveal>
            <section className="text-center">
              <h2 className="text-2xl font-semibold mb-4">Engage & Grow</h2>
              <p className="text-muted-foreground max-w-xl mx-auto mb-6">
                Join discussions, help fellow freelancers, and complete projects to earn XP and badges.
                Your contributions make our community stronger!
              </p>
              <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
                <Button size="lg" disabled>
                  <MessageSquare className="mr-2 h-5 w-5" />
                  Visit Forums (Coming Soon)
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/freelancer/signup">
                    <UserPlus className="mr-2 h-5 w-5" />
                    Join as a Freelancer
                  </Link>
                </Button>
              </div>
            </section>
          </ScrollReveal>
        </div>
      </main>

      {/* Footer — matches landing page */}
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
