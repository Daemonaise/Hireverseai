'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ConnectAccountOnboarding,
  ConnectComponentsProvider,
} from '@stripe/connect-js/react';
import { loadConnectAndInitialize } from '@stripe/connect-js';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface ConnectOnboardingProps {
  freelancerId: string;
  onComplete: () => void;
}

export function ConnectOnboarding({ freelancerId, onComplete }: ConnectOnboardingProps) {
  const { user } = useAuth();
  const [stripeConnectInstance, setStripeConnectInstance] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);

  const fetchClientSecret = useCallback(async () => {
    const token = await user?.getIdToken();
    const res = await fetch('/api/stripe/connect/create-account-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        freelancerId,
        components: ['account_onboarding'],
      }),
    });

    if (!res.ok) throw new Error('Failed to create account session');
    const data = await res.json();
    return data.clientSecret;
  }, [freelancerId, user]);

  useEffect(() => {
    async function init() {
      try {
        // First ensure the Connect account exists
        const token = await user?.getIdToken();
        await fetch('/api/stripe/connect/create-account', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ freelancerId }),
        });

        // Initialize Connect.js
        const instance = loadConnectAndInitialize({
          publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
          fetchClientSecret,
        });

        setStripeConnectInstance(instance);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    if (user) init();
  }, [user, freelancerId, fetchClientSecret]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="max-w-md mx-auto">
        <CardContent className="flex flex-col items-center gap-3 py-8">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" onClick={() => window.location.reload()}>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  if (complete) {
    return (
      <Card className="max-w-md mx-auto">
        <CardContent className="flex flex-col items-center gap-3 py-8">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
          <p className="text-sm font-medium">Payment setup complete!</p>
          <Button onClick={onComplete}>Continue to Hub</Button>
        </CardContent>
      </Card>
    );
  }

  if (!stripeConnectInstance) return null;

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Set Up Payments</CardTitle>
        <CardDescription>
          Complete your payment profile to receive payouts for your work.
          All information is securely handled by Stripe.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ConnectComponentsProvider connectInstance={stripeConnectInstance}>
          <ConnectAccountOnboarding
            onExit={() => setComplete(true)}
          />
        </ConnectComponentsProvider>
      </CardContent>
    </Card>
  );
}
