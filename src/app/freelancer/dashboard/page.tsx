
"use client";

import { FreelancerDashboard } from '@/components/freelancer-dashboard';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

function FreelancerDashboardInner() {
  // For testing, always use a default ID.
  const freelancerId = "test-freelancer-001";

  // The login flow is removed, so this check is simplified.
  if (!freelancerId) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <p className="text-destructive">Freelancer ID is missing.</p>
        <Link href="/">
          <Button className="mt-4">Go to Homepage</Button>
        </Link>
      </div>
    );
  }

  return <FreelancerDashboard freelancerId={freelancerId} />;
}

export default function FreelancerDashboardPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6 sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <Link href="/" aria-label="Hireverse AI Home" className="flex items-center gap-2">
          <span className="text-xl font-bold text-foreground">Hireverse AI</span>
        </Link>
        <nav className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">(Logout in Dashboard)</span>
        </nav>
      </header>

      {/* Main */}
      <main className="flex-1 py-8 md:py-12">
        <div className="container mx-auto px-4 md:px-6">
          <Suspense fallback={<Skeleton className="h-24 w-full" />}>
            <FreelancerDashboardInner />
          </Suspense>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-muted/40 py-6 mt-12">
        <div className="container mx-auto flex flex-col items-center justify-between px-4 text-center text-sm text-muted-foreground md:flex-row md:px-6">
          <p>&copy; {new Date().getFullYear()} Hireverse AI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
