'use client';

import { calculateFees, type FeeBreakdown } from '@/lib/stripe-fees';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Info } from 'lucide-react';

interface PaymentBreakdownProps {
  freelancerCost: number;
  taxRate?: number;
}

function formatUSD(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

export function PaymentBreakdown({ freelancerCost, taxRate = 0 }: PaymentBreakdownProps) {
  const fees = calculateFees(freelancerCost, taxRate);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Payment Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between items-start">
          <div>
            <span className="text-sm font-medium">Freelancer Cost</span>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <Info className="h-3 w-3" />
              100% goes directly to freelancers
            </p>
          </div>
          <span className="text-sm font-medium">{formatUSD(fees.freelancerCost)}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">Platform Fee</span>
          <span className="text-sm">{formatUSD(fees.platformFeeDisplay)}</span>
        </div>

        {fees.tax > 0 && (
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Tax</span>
            <span className="text-sm">{formatUSD(fees.tax)}</span>
          </div>
        )}

        <Separator />

        <div className="flex justify-between items-center">
          <span className="text-sm font-semibold">Total</span>
          <span className="text-lg font-bold text-primary">{formatUSD(fees.clientTotal)}</span>
        </div>

        {taxRate === 0 && (
          <p className="text-xs text-muted-foreground">
            Tax will be calculated at checkout based on your location.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
