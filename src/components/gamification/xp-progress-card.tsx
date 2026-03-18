'use client';

import { Flame, ChevronRight } from 'lucide-react';
import { useFreelancerStats } from '@/hooks/use-freelancer-stats';
import { BADGES } from '@/types/badge';

interface XpProgressCardProps {
  freelancerId: string;
}

export function XpProgressCard({ freelancerId }: XpProgressCardProps) {
  const { data: stats, isLoading } = useFreelancerStats(freelancerId);

  if (isLoading || !stats) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 animate-pulse">
        <div className="h-4 w-24 bg-muted rounded mb-2" />
        <div className="h-2 w-full bg-muted rounded" />
      </div>
    );
  }

  const xpForCurrentLevel = stats.xp;
  const xpNeeded = stats.xpToNextLevel + stats.xp; // Approximate total for next level
  const progress = xpNeeded > 0 ? Math.min((xpForCurrentLevel / xpNeeded) * 100, 100) : 100;

  const recentBadges = stats.badges.slice(-3).reverse();

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      {/* Level */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-primary">
            Level {stats.level}
          </span>
          <h3 className="text-sm font-bold">{stats.levelTitle}</h3>
        </div>
        {stats.currentStreak > 0 && (
          <div className="flex items-center gap-1 text-sm">
            <Flame className="h-4 w-4 text-orange-500" />
            <span className="font-semibold">{stats.currentStreak}d</span>
          </div>
        )}
      </div>

      {/* XP Bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
          <span>{stats.xp.toLocaleString()} XP</span>
          <span>{stats.xpToNextLevel > 0 ? `${stats.xpToNextLevel.toLocaleString()} to next` : 'Max level'}</span>
        </div>
        <div className="h-2 rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Recent Badges */}
      {recentBadges.length > 0 && (
        <div className="flex items-center gap-1.5">
          {recentBadges.map((badgeId) => {
            const badge = BADGES[badgeId];
            if (!badge) return null;
            return (
              <div
                key={badgeId}
                className="flex h-6 w-6 items-center justify-center rounded-full border text-xs"
                style={{
                  borderColor: `var(--rarity-${badge.rarity})`,
                  color: `var(--rarity-${badge.rarity})`,
                }}
                title={badge.name}
              >
                {badge.name.charAt(0)}
              </div>
            );
          })}
          {stats.badges.length > 3 && (
            <span className="text-xs text-muted-foreground">
              +{stats.badges.length - 3} more
            </span>
          )}
        </div>
      )}
    </div>
  );
}
