// src/components/gamification/badge-grid.tsx
'use client';

import { BADGES, type Badge, type BadgeCategory } from '@/types/badge';
import { Lock } from 'lucide-react';

interface BadgeGridProps {
  earnedBadges: string[];
  compact?: boolean; // Show only earned badges without locked
  filterCategory?: BadgeCategory;
}

const allBadges = Object.values(BADGES);

export function BadgeGrid({ earnedBadges, compact = false, filterCategory }: BadgeGridProps) {
  const badges = filterCategory
    ? allBadges.filter((b) => b.category === filterCategory)
    : allBadges;

  const displayed = compact ? badges.filter((b) => earnedBadges.includes(b.id)) : badges;

  if (displayed.length === 0) {
    return <p className="text-sm text-muted-foreground">No badges yet</p>;
  }

  return (
    <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3">
      {displayed.map((badge) => {
        const isEarned = earnedBadges.includes(badge.id);
        return (
          <div
            key={badge.id}
            className="group relative flex flex-col items-center gap-1"
            title={isEarned ? `${badge.name}: ${badge.description}` : `Locked: ${badge.description}`}
          >
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-bold transition-transform group-hover:scale-110 ${
                isEarned
                  ? badge.rarity === 'legendary'
                    ? 'animate-pulse'
                    : ''
                  : 'opacity-40 grayscale'
              }`}
              style={{
                borderColor: isEarned ? `var(--rarity-${badge.rarity})` : undefined,
                color: isEarned ? `var(--rarity-${badge.rarity})` : undefined,
              }}
            >
              {isEarned ? (
                badge.name.charAt(0)
              ) : (
                <Lock className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </div>
            <span className={`text-[10px] text-center leading-tight ${isEarned ? '' : 'text-muted-foreground'}`}>
              {badge.name}
            </span>
          </div>
        );
      })}
    </div>
  );
}
