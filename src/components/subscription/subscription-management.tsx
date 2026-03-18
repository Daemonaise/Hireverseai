'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { TIER_CONFIGS, type SubscriptionTier } from '@/lib/subscription';
import { PricingTable } from './pricing-table';
import { SubscriptionBadge } from './subscription-badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface SubscriptionManagementProps {
  clientId: string;
  currentTier: SubscriptionTier;
  monthlySpend?: number;
}

export function SubscriptionManagement({
  clientId,
  currentTier,
  monthlySpend = 0,
}: SubscriptionManagementProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  async function handleSelectTier(tier: SubscriptionTier) {
    if (tier === 'free') {
      // Downgrade — cancel subscription at period end
      toast({
        title: 'Downgrade',
        description: 'Your plan will revert to Free at the end of your billing period.',
      });
      return;
    }

    setLoading(true);
    try {
      const token = await user?.getIdToken();
      const config = TIER_CONFIGS[tier];

      if (!config.stripePriceId) {
        toast({ title: 'Error', description: 'Subscription plan not configured.', variant: 'destructive' });
        return;
      }

      const res = await fetch('/api/stripe/create-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ clientId }),
      });

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'Failed to create subscription');
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  const config = TIER_CONFIGS[currentTier];

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Your Plan</CardTitle>
              <CardDescription>
                {currentTier === 'free'
                  ? 'Upgrade to unlock lower fees and more features.'
                  : `You're on the ${config.name} plan.`}
              </CardDescription>
            </div>
            <SubscriptionBadge tier={currentTier} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Platform Fee</p>
              <p className="font-medium">{(config.feeRate * 100).toFixed(0)}%</p>
            </div>
            <div>
              <p className="text-muted-foreground">Monthly Spend</p>
              <p className="font-medium">${monthlySpend.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Concurrent Projects</p>
              <p className="font-medium">
                {config.maxConcurrentProjects === 0 ? 'Unlimited' : config.maxConcurrentProjects}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <PricingTable
        currentTier={currentTier}
        onSelectTier={handleSelectTier}
        loading={loading}
      />
    </div>
  );
}
