'use client';

import React from 'react';
import { useAuth } from '@/contexts/auth-context';
import { ClientDashboard } from '@/components/client-dashboard';
import { PageTransition } from '@/components/motion/page-transition';
import { SkeletonCard } from '@/components/ui/skeleton-card';
import { useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

function DashboardContent() {
  const { user, loading } = useAuth();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  // Handle redirects from Stripe Checkout/Payment Intent
  useEffect(() => {
    const subscriptionStatus = searchParams?.get('subscription');
    const paymentIntentStatus = searchParams?.get('payment_intent_status');
    const projectId = searchParams?.get('project_id');

    if (subscriptionStatus === 'success') {
      toast({
        title: 'Subscription Activated!',
        description: 'Your Hireverse AI subscription is now active.',
      });
    } else if (subscriptionStatus === 'cancelled') {
      toast({
        title: 'Subscription Cancelled',
        description: 'Your subscription setup was cancelled. You can try again.',
        variant: 'destructive',
      });
    }

    if (paymentIntentStatus === 'succeeded' && projectId) {
      toast({
        title: 'Payment Successful!',
        description: `Payment for project ${projectId} received. Work will begin shortly.`,
      });
    }
  }, [searchParams, toast]);

  if (loading) {
    return (
      <SkeletonCard
        count={4}
        className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-6xl mx-auto"
      />
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        Please log in to view the dashboard.
      </div>
    );
  }

  return (
    <PageTransition>
      <ClientDashboard clientId={user.uid} />
    </PageTransition>
  );
}

export default function ClientDashboardPage() {
  return (
    <React.Suspense
      fallback={
        <SkeletonCard
          count={4}
          className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-6xl mx-auto"
        />
      }
    >
      <DashboardContent />
    </React.Suspense>
  );
}
