'use client';

import { type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MotionDiv } from '@/components/motion/motion-div';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <MotionDiv preset="fadeInUp" className={className}>
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Icon className="h-12 w-12 text-muted-foreground/40 mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-1">{title}</h3>
        <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
        {action && (
          <Button variant="outline" onClick={action.onClick} className="mt-4">
            {action.label}
          </Button>
        )}
      </div>
    </MotionDiv>
  );
}
