'use client';

import { Award, TrendingUp, Flame } from 'lucide-react';
import { usePublicActivity } from '@/hooks/use-community';

const ICON_MAP: Record<string, typeof Award> = {
  badge_earned: Award,
  level_up: TrendingUp,
  streak_milestone: Flame,
};

export function ActivityTab() {
  const { data: activities, isLoading } = usePublicActivity();

  if (isLoading) return <div className="py-8 text-center text-sm text-muted-foreground">Loading...</div>;

  if (!activities?.length) return <div className="py-8 text-center text-sm text-muted-foreground">No activity yet.</div>;

  return (
    <div className="space-y-2">
      {activities.map((a: any) => {
        const Icon = ICON_MAP[a.type] ?? Award;
        return (
          <div key={a.id} className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm">
                <span className="font-semibold">{a.freelancerName}</span>{' '}
                <span className="text-muted-foreground">{a.title}</span>
              </p>
              {a.description && <p className="text-xs text-muted-foreground">{a.description}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
