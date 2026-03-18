'use client';

import { TIER_CONFIGS, type SubscriptionTier } from '@/lib/subscription';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, X } from 'lucide-react';

interface PricingTableProps {
  currentTier: SubscriptionTier;
  onSelectTier: (tier: SubscriptionTier) => void;
  loading?: boolean;
}

const TIER_ORDER: SubscriptionTier[] = ['free', 'pro', 'enterprise'];

const FEATURE_LIST: { label: string; key: string; freeVal: string; proVal: string; entVal: string }[] = [
  { label: 'Platform Fee', key: 'fee', freeVal: '15%', proVal: '10%', entVal: '10% → 8% → 6%' },
  { label: 'Concurrent Projects', key: 'projects', freeVal: '3', proVal: 'Unlimited', entVal: 'Unlimited' },
  { label: 'Project Size Cap', key: 'cap', freeVal: '$5,000', proVal: '$50,000', entVal: 'Unlimited' },
  { label: 'Priority Matching', key: 'priority', freeVal: '', proVal: 'yes', entVal: 'yes' },
  { label: 'Dedicated Freelancer Pool', key: 'pool', freeVal: '', proVal: '', entVal: 'yes' },
  { label: 'Favorite Freelancers', key: 'favorites', freeVal: '', proVal: 'yes', entVal: 'yes' },
  { label: 'Advanced Analytics', key: 'analytics', freeVal: '', proVal: 'yes', entVal: 'yes' },
  { label: 'API Access', key: 'api', freeVal: '', proVal: '', entVal: 'yes' },
  { label: 'Consolidated Billing', key: 'billing', freeVal: '', proVal: 'yes', entVal: 'yes' },
  { label: 'Support', key: 'support', freeVal: 'AI', proVal: 'Priority Email', entVal: 'Email + Slack' },
];

function FeatureCell({ value }: { value: string }) {
  if (value === 'yes') return <Check className="h-4 w-4 text-green-600 mx-auto" />;
  if (value === '') return <X className="h-4 w-4 text-muted-foreground/40 mx-auto" />;
  return <span className="text-sm">{value}</span>;
}

export function PricingTable({ currentTier, onSelectTier, loading }: PricingTableProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
      {TIER_ORDER.map((tier) => {
        const config = TIER_CONFIGS[tier];
        const isCurrent = tier === currentTier;
        const isPopular = tier === 'pro';

        return (
          <Card
            key={tier}
            className={`relative ${isPopular ? 'border-primary shadow-lg' : ''} ${isCurrent ? 'ring-2 ring-primary' : ''}`}
          >
            {isPopular && (
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary">
                Most Popular
              </Badge>
            )}
            <CardHeader className="text-center">
              <CardTitle>{config.name}</CardTitle>
              <CardDescription>
                {config.price === 0 ? (
                  <span className="text-2xl font-bold">Free</span>
                ) : (
                  <>
                    <span className="text-3xl font-bold">${config.price}</span>
                    <span className="text-muted-foreground">/mo</span>
                  </>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {FEATURE_LIST.map((feat) => {
                const val = tier === 'free' ? feat.freeVal : tier === 'pro' ? feat.proVal : feat.entVal;
                return (
                  <div key={feat.key} className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">{feat.label}</span>
                    <FeatureCell value={val} />
                  </div>
                );
              })}
            </CardContent>
            <CardFooter>
              {isCurrent ? (
                <Button variant="outline" className="w-full" disabled>
                  Current Plan
                </Button>
              ) : (
                <Button
                  className="w-full"
                  variant={isPopular ? 'default' : 'outline'}
                  onClick={() => onSelectTier(tier)}
                  disabled={loading}
                >
                  {tier === 'free' ? 'Downgrade' : 'Upgrade'}
                </Button>
              )}
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}
