'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ConnectAccountManagement,
  ConnectComponentsProvider,
} from '@stripe/connect-js/react';
import { loadConnectAndInitialize } from '@stripe/connect-js';
import { useAuth } from '@/contexts/auth-context';
import { Loader2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface ConnectAccountManagementProps {
  freelancerId: string;
}

export function ConnectAccountManagementPanel({ freelancerId }: ConnectAccountManagementProps) {
  const { user } = useAuth();
  const [stripeConnectInstance, setStripeConnectInstance] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noAccount, setNoAccount] = useState(false);

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
        components: ['account_management'],
      }),
    });

    if (!res.ok) throw new Error('Failed to create account session');
    const data = await res.json();
    return data.clientSecret;
  }, [freelancerId, user]);

  useEffect(() => {
    async function init() {
      try {
        // Check if account exists first
        const token = await user?.getIdToken();
        const statusRes = await fetch(
          `/api/stripe/connect/account-status?freelancerId=${freelancerId}`,
          { headers: { 'Authorization': `Bearer ${token}` } }
        );
        const status = await statusRes.json();

        if (!status.hasAccount) {
          setNoAccount(true);
          setLoading(false);
          return;
        }

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
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (noAccount) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-sm text-muted-foreground">
            No payment account set up yet. Complete onboarding to manage your payment settings.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-8">
          <AlertCircle className="h-6 w-6 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  if (!stripeConnectInstance) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment Settings</CardTitle>
        <CardDescription>
          Manage your bank account, payout schedule, and tax information.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ConnectComponentsProvider connectInstance={stripeConnectInstance}>
          <ConnectAccountManagement />
        </ConnectComponentsProvider>
      </CardContent>
    </Card>
  );
}
