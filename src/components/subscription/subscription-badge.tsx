'use client';

import { Badge } from '@/components/ui/badge';
import { Crown, Zap } from 'lucide-react';
import type { SubscriptionTier } from '@/lib/subscription';

interface SubscriptionBadgeProps {
  tier: SubscriptionTier;
  className?: string;
}

const BADGE_STYLES: Record<SubscriptionTier, { variant: 'default' | 'secondary' | 'outline'; icon: typeof Crown | null; label: string }> = {
  free: { variant: 'outline', icon: null, label: 'Free' },
  pro: { variant: 'default', icon: Zap, label: 'Pro' },
  enterprise: { variant: 'secondary', icon: Crown, label: 'Enterprise' },
};

export function SubscriptionBadge({ tier, className }: SubscriptionBadgeProps) {
  const style = BADGE_STYLES[tier];
  const Icon = style.icon;

  return (
    <Badge variant={style.variant} className={className}>
      {Icon && <Icon className="h-3 w-3 mr-1" />}
      {style.label}
    </Badge>
  );
}
